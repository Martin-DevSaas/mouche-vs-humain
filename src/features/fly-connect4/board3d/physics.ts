// Falling piece: free fall under gravity, then damped bounces on the piece below.
// Units: cm and seconds.

export const GRAVITY_CM_S2 = 981;
/** Coefficient of restitution of a plastic disc landing on another (small bounce). */
export const RESTITUTION = 0.22;
const MIN_BOUNCE_SPEED = 12; // cm/s: below this the piece just settles

export interface DropTrajectory {
  /** Height at time t (s) since release. */
  y(t: number): number;
  /** Times (s) of each impact, with the impact speed (cm/s), for sound and shake. */
  impacts: { t: number; speed: number }[];
  /** Time after which the piece is at rest. */
  duration: number;
}

export function dropTrajectory(y0: number, yRest: number, g = GRAVITY_CM_S2, e = RESTITUTION): DropTrajectory {
  const h = Math.max(0, y0 - yRest);
  const t1 = Math.sqrt((2 * h) / g);
  const impacts = [{ t: t1, speed: g * t1 }];
  // Bounce arcs: each starts at an impact with speed v, lasts 2v/g.
  const arcs: { t0: number; v: number }[] = [];
  let t = t1;
  let v = g * t1 * e;
  while (v > MIN_BOUNCE_SPEED) {
    arcs.push({ t0: t, v });
    t += (2 * v) / g;
    impacts.push({ t, speed: v });
    v *= e;
  }
  const duration = t;
  return {
    impacts,
    duration,
    y(time: number) {
      if (time <= 0) return y0;
      if (time < t1) return y0 - 0.5 * g * time * time;
      for (const a of arcs) {
        const dt = time - a.t0;
        if (dt >= 0 && dt <= (2 * a.v) / g) return yRest + a.v * dt - 0.5 * g * dt * dt;
      }
      return yRest;
    },
  };
}
