"use client";

// Realistic blue plastic connect-four board (react-three-fiber). Units: cm.

import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import palette from "../vision/palette.json";
import { BOARD, BOARD_HEIGHT, BOARD_WIDTH, holeCenter } from "../vision/geometry";
import { HUMAN, useGame, type PlacedPiece } from "../game/store";
import { DEFAULT_DECISION } from "../motor/decide";
import {
  BOARD_CENTER_Y,
  FACE_Z,
  RELEASE_Y,
  SLIDER_TOP,
  SLOT_GAP,
  faceGeometry,
  legGeometry,
  pieceGeometry,
  topCapGeometry,
} from "./geometry3d";
import { GRAVITY_CM_S2, dropTrajectory } from "./physics";
import { clack, unlockAudio } from "./sound";
import { useRenderGate } from "../renderGate";

const SLIDER_OUT_S = 0.35; // slider opening time before pieces fall
const CLEAR_S = 1.6;

function plastic(color: string) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.15,
  });
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Shared impulse for the board shake, written by landing pieces. */
interface Shake {
  amp: number;
  t0: number;
}

function Piece({
  piece,
  geometry,
  material,
  highlight,
  onImpact,
}: {
  piece: PlacedPiece;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  highlight: boolean;
  onImpact: (relativeSpeed: number) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [x, yRest] = holeCenter(piece.col, piece.row);
  const traj = useMemo(() => dropTrajectory(RELEASE_Y, yRest), [yRest]);
  const nextImpact = useRef(0);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const glow = useMemo(() => {
    if (!highlight) return null;
    const m = (material as THREE.MeshPhysicalMaterial).clone();
    m.emissive = new THREE.Color(piece.player === HUMAN ? "#ff3b30" : "#ffd60a");
    return m;
  }, [highlight, material, piece.player]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const now = performance.now();
    const { clearingSince } = useGame.getState();
    if (clearingSince !== null) {
      const t = (now - clearingSince) / 1000 - SLIDER_OUT_S - piece.col * 0.03;
      mesh.position.y = t > 0 ? yRest - 0.5 * GRAVITY_CM_S2 * t * t : yRest;
      mesh.visible = mesh.position.y > -BOARD_CENTER_Y - 6;
      return;
    }
    const t = (now - piece.droppedAt) / 1000;
    mesh.position.y = reduced ? (t < traj.impacts[0].t ? traj.y(t) : yRest) : traj.y(t);
    while (nextImpact.current < traj.impacts.length && t >= traj.impacts[nextImpact.current].t) {
      const imp = traj.impacts[nextImpact.current++];
      const rel = imp.speed / Math.sqrt(2 * GRAVITY_CM_S2 * BOARD_HEIGHT);
      if (t - imp.t < 0.1) {
        clack(rel, piece.player === HUMAN ? 1 : 1.06);
        if (!reduced) onImpact(rel);
      }
    }
    if (highlight) (mesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.25 + 0.25 * Math.sin(now / 180);
  });

  return <mesh ref={ref} geometry={geometry} material={glow ?? material} position={[x, RELEASE_Y, 0]} castShadow />;
}

function FloatingPiece({ geometry, material }: { geometry: THREE.BufferGeometry; material: THREE.Material }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const { status, hoverCol, flyHeadingDeg } = useGame.getState();
    let targetX: number | null = null;
    if (status === "human" && hoverCol !== null) targetX = holeCenter(hoverCol, 0)[0];
    if (status === "fly" && flyHeadingDeg !== null) {
      // where the fly's heading meets the board plane
      const x = DEFAULT_DECISION.distanceCm * Math.tan((flyHeadingDeg * Math.PI) / 180);
      targetX = Math.max(-BOARD_WIDTH / 2 - 2, Math.min(BOARD_WIDTH / 2 + 2, x));
    }
    mesh.visible = targetX !== null;
    if (targetX === null) return;
    mesh.position.x += (targetX - mesh.position.x) * Math.min(1, dt * 12);
    mesh.position.y = RELEASE_Y + 0.6 + 0.25 * Math.sin(performance.now() / 300);
  });
  return <mesh ref={ref} geometry={geometry} material={material} position={[0, RELEASE_Y, 0]} visible={false} />;
}

function Board() {
  const pieces = useGame((s) => s.pieces);
  const outcome = useGame((s) => s.outcome);
  const status = useGame((s) => s.status);
  const shake = useRef<Shake>({ amp: 0, t0: 0 });
  const group = useRef<THREE.Group>(null);
  const onImpact = useCallback((rel: number) => {
    shake.current.amp = Math.max(shake.current.amp * 0.5, 0.0035 * rel);
    shake.current.t0 = performance.now();
  }, []);
  const slider = useRef<THREE.Mesh>(null);

  const geo = useMemo(
    () => ({ face: faceGeometry(), top: topCapGeometry(), leg: legGeometry(), piece: pieceGeometry() }),
    [],
  );
  const mat = useMemo(() => {
    const ghostRed = plastic(palette.red);
    ghostRed.transparent = true;
    ghostRed.opacity = 0.45;
    const ghostYellow = plastic(palette.yellow);
    return { blue: plastic(palette.board), red: plastic(palette.red), yellow: plastic(palette.yellow), ghostRed, ghostYellow };
  }, []);

  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  const winning = useMemo(() => new Set(outcome.kind === "win" ? outcome.line : []), [outcome]);

  useFrame(() => {
    const now = performance.now();
    const g = group.current;
    if (g) {
      const t = (now - shake.current.t0) / 1000;
      const a = shake.current.amp * Math.exp(-t / 0.09) * Math.sin(2 * Math.PI * 22 * t);
      g.rotation.z = a;
      g.position.y = BOARD_CENTER_Y + a * 25;
    }
    const { clearingSince, clearFinished } = useGame.getState();
    if (slider.current) {
      if (clearingSince === null) slider.current.position.x = 0;
      else {
        const t = (now - clearingSince) / 1000;
        const open = 1 - (1 - Math.min(1, t / SLIDER_OUT_S)) ** 2; // ease-out
        const close = t > CLEAR_S - 0.3 ? Math.min(1, (t - (CLEAR_S - 0.3)) / 0.3) : 0;
        slider.current.position.x = BOARD_WIDTH * 0.85 * (open - close);
        if (t > CLEAR_S) clearFinished();
      }
    }
  });

  const sliderH = 0.55;
  const humanTurn = status === "human";

  return (
    <group ref={group} position={[0, BOARD_CENTER_Y, 0]}>
      <mesh geometry={geo.face} material={mat.blue} position={[0, 0, FACE_Z]} castShadow receiveShadow />
      <mesh geometry={geo.face} material={mat.blue} position={[0, 0, -FACE_Z]} castShadow receiveShadow />
      <mesh geometry={geo.top} material={mat.blue} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat.blue} position={[s * (BOARD_WIDTH / 2 - 0.35), 0, 0]} castShadow>
          <boxGeometry args={[0.7, BOARD_HEIGHT - 0.2, SLOT_GAP + 0.02]} />
        </mesh>
      ))}
      <mesh ref={slider} material={mat.blue} position={[0, SLIDER_TOP - sliderH / 2, 0]} castShadow>
        <boxGeometry args={[BOARD_WIDTH - 1.4, sliderH, SLOT_GAP - 0.06]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={`leg${s}`}
          geometry={geo.leg}
          material={mat.blue}
          position={[s * (BOARD_WIDTH / 2 - BOARD.legOverlap + BOARD.legWidth / 2), -BOARD_CENTER_Y, 0]}
          castShadow
          receiveShadow
        />
      ))}
      {pieces.map((p) => (
        <Piece
          key={p.id}
          piece={p}
          geometry={geo.piece}
          material={p.player === HUMAN ? mat.red : mat.yellow}
          highlight={winning.has(p.row * BOARD.cols + p.col)}
          onImpact={onImpact}
        />
      ))}
      <FloatingPiece geometry={geo.piece} material={humanTurn ? mat.ghostRed : mat.ghostYellow} />
      {Array.from({ length: BOARD.cols }, (_, c) => (
        <mesh
          key={`hit${c}`}
          position={[holeCenter(c, 0)[0], 2, 1.5]}
          visible={false}
          onPointerMove={(e) => {
            e.stopPropagation();
            useGame.getState().setHover(c);
          }}
          onPointerOut={() => useGame.getState().setHover(null)}
          onClick={(e) => {
            e.stopPropagation();
            unlockAudio();
            useGame.getState().humanPlay(c);
          }}
        >
          <boxGeometry args={[BOARD.pitch, BOARD_HEIGHT + 8, 4]} />
        </mesh>
      ))}
    </group>
  );
}

function Studio() {
  return (
    <Environment resolution={256}>
      <Lightformer form="rect" intensity={3} position={[0, 40, 20]} rotation-x={Math.PI / 2} scale={[60, 20, 1]} />
      <Lightformer form="rect" intensity={1.5} position={[-40, 20, 30]} rotation-y={Math.PI / 3} scale={[30, 40, 1]} />
      <Lightformer form="rect" intensity={1.2} position={[40, 15, 25]} rotation-y={-Math.PI / 3} scale={[30, 40, 1]} />
      <Lightformer form="rect" intensity={0.8} position={[0, 15, -40]} scale={[60, 30, 1]} />
      <Lightformer form="circle" intensity={2} position={[15, 30, 40]} scale={8} />
    </Environment>
  );
}

const VIEW_DIR = new THREE.Vector3(22, 9, 60).normalize(); // 3/4 view
const TARGET = new THREE.Vector3(0, BOARD_CENTER_Y + 1, 0);

/** Camera distance that fits the whole board (feet and floating piece included) for this aspect ratio. */
function fitDistance(fovDeg: number, aspect: number): number {
  const half = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const fitH = BOARD_HEIGHT + BOARD.legHeight + 8;
  const fitW = BOARD_WIDTH + 2 * BOARD.legWidth + 4;
  return 1.05 * Math.max(fitH / 2 / half, fitW / 2 / (half * aspect));
}

function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const dist = fitDistance(camera.fov, aspect);
  useEffect(() => {
    camera.position.copy(TARGET).addScaledVector(VIEW_DIR, dist);
    camera.lookAt(TARGET);
  }, [camera, dist]);
  return (
    <OrbitControls
      target={TARGET}
      enablePan={false}
      enableZoom={false}
      enableDamping
      minDistance={dist * 0.75}
      maxDistance={dist * 1.5}
      minAzimuthAngle={-0.75}
      maxAzimuthAngle={0.75}
      minPolarAngle={0.95}
      maxPolarAngle={1.55}
    />
  );
}

export default function Board3D() {
  const box = useRef<HTMLDivElement>(null);
  const frameloop = useRenderGate(box);
  return (
    <div ref={box} style={{ width: "100%", height: "100%" }}>
      <Canvas
        frameloop={frameloop}
        shadows="percentage"
        dpr={[1, 1.5]}
        camera={{ position: [22, BOARD_CENTER_Y + 10, 60], fov: 32, near: 1, far: 800 }}
        style={{ width: "100%", height: "100%", touchAction: "none" }}
        onPointerMissed={() => useGame.getState().setHover(null)}
        aria-label="Plateau de Puissance 4 en 3D"
      >
        {/* Studio backdrop: the same light grey the fly sees behind the board (palette.background). */}
        <color attach="background" args={[palette.background]} />
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[600, 600]} />
          <meshStandardMaterial color={palette.background} roughness={0.95} />
        </mesh>
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[18, 50, 35]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={40}
          shadow-camera-bottom={-10}
          shadow-bias={-0.0004}
        />
        <Studio />
        <Board />
        <ContactShadows position={[0, 0.01, 0]} scale={70} blur={2.2} far={20} opacity={0.55} resolution={1024} />
        <CameraRig />
      </Canvas>
    </div>
  );
}

