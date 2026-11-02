"use client";

// Real-time 3D map of the simulated brain: neuropils (fresnel shells coloured by activity),
// neurons (points flashing on each spike), particles along the strongest connections of
// spiking neurons, and the four DNa01/DNa02 output neurons. The live view reads the
// same recorded spikes (recorder.ts); nothing here is decorative or independent of them.

import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BRAIN_CENTER, BRAIN_SCALE, type BrainData } from "./data";
import { advancePlayhead, useBrainUi } from "./playback";
import { useRenderGate } from "../renderGate";
import { brainRecorder } from "./recorder";

export interface TopEdges {
  k: number;
  targets: Int32Array;
  weights: Int16Array;
}

const FLASH_TAU_STEPS = 200; // 20 ms of simulated time
const REGION_WINDOW_STEPS = 500; // 50 ms sliding window
const DN_WINDOW_STEPS = 2000; // 200 ms, for the output gauges
const PARTICLE_LIFE_S = 0.55;

/** Shared, mutable per-frame readout for the HTML overlay (DN gauges). */
export const dnReadout = { rates: { DNa02_L: 0, DNa02_R: 0, DNa01_L: 0, DNa01_R: 0 }, step: 0 };

const COLORMAP = ["#2c4372", "#2f5fd0", "#22d3ee", "#a3e635", "#fde047", "#ffffff"].map((c) => new THREE.Color(c));
function colormap(t: number, out: THREE.Color): THREE.Color {
  const x = Math.max(0, Math.min(1, t)) * (COLORMAP.length - 1);
  const i = Math.min(COLORMAP.length - 2, Math.floor(x));
  return out.copy(COLORMAP[i]).lerp(COLORMAP[i + 1], x - i);
}

const fresnelVertex = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const fresnelFragment = /* glsl */ `
  uniform vec3 uColor; uniform float uAct; uniform float uHover; uniform float uBase;
  varying vec3 vN; varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    float a = (uBase + 0.5 * uAct) * (0.25 + 0.75 * f) + 0.25 * uHover * f;
    gl_FragColor = vec4(uColor * (0.7 + 1.6 * uAct + 0.6 * uHover), a);
  }`;

const pointsVertex = /* glsl */ `
  attribute float aLast; attribute vec3 aColor; attribute float aSize;
  uniform float uPlayhead; uniform float uTau; uniform float uPx;
  varying vec3 vColor; varying float vFlash;
  void main() {
    float dt = uPlayhead - aLast;
    vFlash = dt >= 0.0 ? exp(-dt / uTau) : 0.0;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (1.0 + 2.2 * vFlash) * uPx * (150.0 / -mv.z);
  }`;
const pointsFragment = /* glsl */ `
  varying vec3 vColor; varying float vFlash;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    float soft = 1.0 - r * 4.0;
    vec3 c = mix(vColor * 0.45, vec3(1.0, 0.96, 0.8) * 1.6, vFlash);
    gl_FragColor = vec4(c, soft * (0.4 + 0.6 * vFlash));
  }`;

const particleVertex = /* glsl */ `
  attribute vec3 aStart; attribute vec3 aEnd; attribute float aBirth; attribute float aInhib;
  uniform float uTime; uniform float uLife; uniform float uPx;
  varying float vA; varying float vInhib;
  void main() {
    float t = (uTime - aBirth) / uLife;
    float alive = step(0.0, t) * step(t, 1.0);
    float e = t * t * (3.0 - 2.0 * t);
    vec4 mv = modelViewMatrix * vec4(mix(aStart, aEnd, e), 1.0);
    vA = alive * sin(3.14159 * clamp(t, 0.0, 1.0));
    vInhib = aInhib;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = alive * 3.0 * uPx * (150.0 / -mv.z);
  }`;
const particleFragment = /* glsl */ `
  varying float vA; varying float vInhib;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    if (dot(d, d) > 0.25) discard;
    vec3 c = mix(vec3(1.0, 0.78, 0.35), vec3(0.45, 0.7, 1.0), vInhib);
    gl_FragColor = vec4(c * 1.8, vA);
  }`;

interface RegionMesh {
  name: string;
  geometry: THREE.BufferGeometry;
  /** Node transform: gltfpack quantises positions and stores the dequantisation here. */
  matrix: THREE.Matrix4;
  material: THREE.ShaderMaterial;
  roi: number;
  shell: boolean;
}

/** Colours each neuropil by the spike rate of its neurons over a sliding window. */
class RegionShading {
  readonly meshes: RegionMesh[] = [];
  private smoothed: Float32Array;
  private counts: Int32Array;
  private tmp = new THREE.Color();

  constructor(scene: THREE.Object3D, private data: BrainData) {
    this.smoothed = new Float32Array(data.meta.rois.length);
    this.counts = new Int32Array(data.meta.rois.length);
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      // gltfpack names meshes "mesh_<i>"; the ROI name is on the parent node (-kn)
      const name = o.parent && o.parent !== scene ? o.parent.name : o.name;
      const shell = name.includes("shell");
      const geometry = (o as THREE.Mesh).geometry;
      // the export has no normals; uniform quantisation scale keeps their directions right
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      this.meshes.push({
        name,
        geometry,
        matrix: o.matrixWorld.clone(),
        roi: data.meta.rois.findIndex((r) => r.name === name),
        shell,
        material: new THREE.ShaderMaterial({
          vertexShader: fresnelVertex,
          fragmentShader: fresnelFragment,
          uniforms: {
            uColor: { value: new THREE.Color(shell ? "#40506e" : COLORMAP[0]) },
            uAct: { value: 0 },
            uHover: { value: 0 },
            uBase: { value: shell ? 0.12 : 0.32 },
          },
          transparent: true,
          depthWrite: false,
        }),
      });
    });
  }

  update(p: number, dt: number, hovered: string | null) {
    const c = this.counts;
    c.fill(0);
    const { neurons } = brainRecorder.range(p - REGION_WINDOW_STEPS, p);
    for (let i = 0; i < neurons.length; i++) c[this.data.roi[neurons[i]]]++;
    const k = Math.min(1, dt * 8);
    for (const m of this.meshes) {
      if (m.roi >= 0) {
        const rate = c[m.roi] / (Math.max(1, this.data.regionCount[m.roi]) * (REGION_WINDOW_STEPS / 10000));
        const act = 1 - Math.exp(-rate / 15);
        this.smoothed[m.roi] += (act - this.smoothed[m.roi]) * k;
        const a = this.smoothed[m.roi];
        m.material.uniforms.uAct.value = a;
        (m.material.uniforms.uColor.value as THREE.Color).copy(colormap(a, this.tmp));
      }
      m.material.uniforms.uHover.value = hovered === m.name ? 1 : 0;
    }
  }

  dispose() {
    for (const m of this.meshes) m.material.dispose();
  }
}

function Neuropils({ url, data }: { url: string; data: BrainData }) {
  const gltf = useGLTF(url, false, true);
  const setHovered = useBrainUi((s) => s.setHoveredRegion);
  const shading = useMemo(() => new RegionShading(gltf.scene, data), [gltf, data]);
  useEffect(() => () => shading.dispose(), [shading]);
  useFrame((_, dt) => shading.update(dnReadout.step, dt, useBrainUi.getState().hoveredRegion));

  return (
    <group>
      {shading.meshes.map((m) => (
        <mesh
          key={m.name}
          geometry={m.geometry}
          material={m.material}
          matrix={m.matrix}
          matrixAutoUpdate={false}
          renderOrder={m.shell ? 0 : 1}
          raycast={m.shell ? () => null : undefined}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(m.name);
          }}
          onPointerOut={() => setHovered(null)}
        />
      ))}
    </group>
  );
}

class Particles {
  readonly geometry = new THREE.BufferGeometry();
  readonly material: THREE.ShaderMaterial;
  private start: Float32Array;
  private end: Float32Array;
  private birth: Float32Array;
  private inhib: Float32Array;
  private cursor = 0;
  private dirtyFrom = Infinity;
  private dirtyTo = -1;

  constructor(readonly capacity: number) {
    this.start = new Float32Array(capacity * 3);
    this.end = new Float32Array(capacity * 3);
    this.birth = new Float32Array(capacity).fill(-1e9);
    this.inhib = new Float32Array(capacity);
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
    this.geometry.setAttribute("aStart", new THREE.BufferAttribute(this.start, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aEnd", new THREE.BufferAttribute(this.end, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aBirth", new THREE.BufferAttribute(this.birth, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aInhib", new THREE.BufferAttribute(this.inhib, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...BRAIN_CENTER), 2000);
    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: { uTime: { value: 0 }, uLife: { value: PARTICLE_LIFE_S }, uPx: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  spawn(pos: Float32Array, from: number, to: number, inhibitory: boolean, now: number) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.start.set(pos.subarray(from * 3, from * 3 + 3), i * 3);
    this.end.set(pos.subarray(to * 3, to * 3 + 3), i * 3);
    this.birth[i] = now;
    this.inhib[i] = inhibitory ? 1 : 0;
    this.dirtyFrom = Math.min(this.dirtyFrom, i);
    this.dirtyTo = Math.max(this.dirtyTo, i);
  }

  flush() {
    if (this.dirtyTo < 0) return;
    for (const name of ["aStart", "aEnd", "aBirth", "aInhib"]) {
      const a = this.geometry.getAttribute(name) as THREE.BufferAttribute;
      a.needsUpdate = true;
    }
    this.dirtyFrom = Infinity;
    this.dirtyTo = -1;
  }

  frame(nowS: number, pixelRatio: number) {
    this.material.uniforms.uTime.value = nowS;
    this.material.uniforms.uPx.value = pixelRatio;
  }

  clear() {
    this.birth.fill(-1e9);
    (this.geometry.getAttribute("aBirth") as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Per-neuron "last spike" times (the shader turns them into flashes) and DN rates. */
class NeuronFlashes {
  readonly geometry = new THREE.BufferGeometry();
  readonly material: THREE.ShaderMaterial;
  private last: Float32Array;
  private prev = 0;
  private dn: Record<string, number>;

  constructor(private data: BrainData) {
    const g = this.geometry;
    g.setAttribute("position", new THREE.BufferAttribute(data.neurons.position, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(data.colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(data.sizes, 1));
    this.last = new Float32Array(data.n).fill(-1e9);
    g.setAttribute("aLast", new THREE.BufferAttribute(this.last, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      vertexShader: pointsVertex,
      fragmentShader: pointsFragment,
      uniforms: { uPlayhead: { value: 0 }, uTau: { value: FLASH_TAU_STEPS }, uPx: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dn = Object.fromEntries(data.outputs.map((o) => [o.key, o.index]));
  }

  /** Apply the spikes between the previous and the new playhead; spawn particles going forward. */
  update(p: number, pixelRatio: number, particles: Particles | null, edges: TopEdges | null, budget: number) {
    this.material.uniforms.uPx.value = pixelRatio;
    let from = this.prev;
    const backwards = p < this.prev - 1;
    if (backwards) {
      // new decision: rebuild the recent past
      this.last.fill(-1e9);
      particles?.clear();
      from = p - 6 * FLASH_TAU_STEPS;
    }
    const { steps, neurons } = brainRecorder.range(from, p);
    const spawn = particles && edges && !backwards && p - this.prev < 3000;
    const stride = Math.max(1, Math.ceil((neurons.length * (edges?.k ?? 1)) / budget));
    const pos = this.data.neurons.position;
    const nowS = performance.now() / 1000;
    for (let i = 0; i < neurons.length; i++) {
      const nIdx = neurons[i];
      this.last[nIdx] = steps[i];
      if (!spawn || i % stride !== 0) continue;
      for (let j = 0; j < edges.k; j++) {
        const t = edges.targets[nIdx * edges.k + j];
        if (t >= 0) particles.spawn(pos, nIdx, t, edges.weights[nIdx * edges.k + j] < 0, nowS);
      }
    }
    if (neurons.length || backwards) (this.geometry.getAttribute("aLast") as THREE.BufferAttribute).needsUpdate = true;
    particles?.flush();
    this.material.uniforms.uPlayhead.value = p;
    this.prev = p;
    this.readDn(p);
  }

  private readDn(p: number) {
    const w = brainRecorder.range(p - DN_WINDOW_STEPS, p).neurons;
    const r = dnReadout.rates;
    r.DNa02_L = r.DNa02_R = r.DNa01_L = r.DNa01_R = 0;
    for (let i = 0; i < w.length; i++) {
      const n = w[i];
      if (n === this.dn.DNa02_L) r.DNa02_L++;
      else if (n === this.dn.DNa02_R) r.DNa02_R++;
      else if (n === this.dn.DNa01_L) r.DNa01_L++;
      else if (n === this.dn.DNa01_R) r.DNa01_R++;
    }
    const span = Math.max(1, Math.min(DN_WINDOW_STEPS, p)) / 10000;
    r.DNa02_L /= span;
    r.DNa02_R /= span;
    r.DNa01_L /= span;
    r.DNa01_R /= span;
    dnReadout.step = p;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function Activity({ data, edges, light, reducedMotion }: { data: BrainData; edges: TopEdges | null; light: boolean; reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const flashes = useMemo(() => new NeuronFlashes(data), [data]);
  const particles = useMemo(() => (reducedMotion ? null : new Particles(light ? 600 : 3000)), [light, reducedMotion]);
  useEffect(() => () => flashes.dispose(), [flashes]);
  useEffect(() => () => particles?.dispose(), [particles]);

  useFrame((state, dt) => {
    const p = advancePlayhead(Math.min(dt, 0.1));
    const px = state.gl.getPixelRatio();
    particles?.frame(performance.now() / 1000, px);
    flashes.update(p, px, particles, edges, light ? 30 : 140);
  });

  const pos = data.neurons.position;
  return (
    <>
      <points ref={pointsRef} geometry={flashes.geometry} material={flashes.material} raycast={() => null} />
      <NeuronPicker target={pointsRef} n={data.n} />
      {particles && <points geometry={particles.geometry} material={particles.material} raycast={() => null} />}
      {data.outputs.map((o) => (
        <DnMarker key={o.key} label={o.key} position={pos.subarray(o.index * 3, o.index * 3 + 3)} />
      ))}
    </>
  );
}

/**
 * Click a neuron: the nearest projected neuron within 10 px of a click (not a drag).
 * Done by hand rather than with Points raycasting, whose threshold ignores the parent's scale.
 */
function NeuronPicker({ target, n }: { target: React.RefObject<THREE.Points | null>; n: number }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const selectNeuron = useBrainUi((s) => s.selectNeuron);
  useEffect(() => {
    const el = gl.domElement;
    let down: [number, number] | null = null;
    const v = new THREE.Vector3();
    const onDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || !target.current) return;
      const rect = el.getBoundingClientRect();
      const pos = (target.current.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
      const m = target.current.matrixWorld;
      let best = -1;
      let bestD = 10 * 10;
      for (let i = 0; i < n; i++) {
        v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(m).project(camera);
        if (v.z > 1 || v.z < -1) continue;
        const dx = ((v.x + 1) / 2) * rect.width - (e.clientX - rect.left);
        const dy = ((1 - v.y) / 2) * rect.height - (e.clientY - rect.top);
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      selectNeuron(best >= 0 ? best : null);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl, n, selectNeuron, target]);
  return null;
}

function DnMarker({ label, position }: { label: string; position: Float32Array }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const rate = dnReadout.rates[label as keyof typeof dnReadout.rates] ?? 0;
    if (mat.current) mat.current.color.setRGB(1, 0.3 + Math.min(0.7, rate / 30), 0.4).multiplyScalar(0.8 + Math.min(2.5, rate / 8));
  });
  const [type, side] = label.split("_");
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh>
        <sphereGeometry args={[7, 16, 16]} />
        <meshBasicMaterial ref={mat} color="#ff5470" toneMapped={false} />
      </mesh>
      {/* data y points down: DNa02 labels above the soma, DNa01 below, so they do not overlap */}
      <Html center style={{ pointerEvents: "none" }} position={[0, type === "DNa02" ? -18 : 20, 0]}>
        <span style={{ fontSize: 11, color: "#ffd1da", whiteSpace: "nowrap", fontFamily: "var(--font-geist-mono)" }}>
          {type} {side === "L" ? "G" : "D"}
        </span>
      </Html>
    </group>
  );
}

export default function Brain3D({
  data,
  edges,
  glbUrl,
  light,
  reducedMotion,
}: {
  data: BrainData;
  edges: TopEdges | null;
  glbUrl: string;
  light: boolean;
  reducedMotion: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const frameloop = useRenderGate(box);
  return (
    <div ref={box} style={{ width: "100%", height: "100%" }}>
      <Canvas
        frameloop={frameloop}
        dpr={light ? 1 : [1, 1.5]}
        camera={{ position: [0, 4, 60], fov: 35, near: 0.5, far: 400 }}
        style={{ width: "100%", height: "100%" }}
        aria-label="Carte 3D du cerveau de Simone"
      >
        <color attach="background" args={["#05070b"]} />
        {/* MaleCNS coordinates (µm, y ventral, z posterior) -> frontal view, brain centred */}
        <group scale={BRAIN_SCALE} rotation={[Math.PI, 0, 0]}>
          <group position={[-BRAIN_CENTER[0], -BRAIN_CENTER[1], -BRAIN_CENTER[2]]}>
            <Neuropils url={glbUrl} data={data} />
            <Activity data={data} edges={edges} light={light} reducedMotion={reducedMotion} />
          </group>
        </group>
        <OrbitControls enablePan={false} enableZoom={false} minDistance={25} maxDistance={110} enableDamping />
        {!light && (
          <EffectComposer frameBufferType={THREE.UnsignedByteType}>
            <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.35} luminanceSmoothing={0.25} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
