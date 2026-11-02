// Plastic "clac" synthesised with WebAudio (no audio file): a short band-passed noise
// burst (the impact) plus a brief damped tone (the disc ringing).

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

export function setMuted(m: boolean): void {
  muted = m;
}

/** Must be called from a user gesture once (browsers block audio before that). */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  if (!noise) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
}

/** intensity in [0, 1]: impact speed relative to a full-height drop. */
export function clack(intensity: number, pitch = 1): void {
  if (muted || !ctx || !noise || ctx.state !== "running") return;
  const t = ctx.currentTime;
  const gain = Math.min(1, Math.max(0.05, intensity)) * 0.5;

  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = pitch;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2600 * pitch;
  bp.Q.value = 1.4;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(gain, t);
  ng.gain.exponentialRampToValueAtTime(0.0008, t + 0.035);
  src.connect(bp).connect(ng).connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.05);

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1150 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(820 * pitch, t + 0.05);
  const og = ctx.createGain();
  og.gain.setValueAtTime(gain * 0.35, t);
  og.gain.exponentialRampToValueAtTime(0.0006, t + 0.06);
  osc.connect(og).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.07);
}
