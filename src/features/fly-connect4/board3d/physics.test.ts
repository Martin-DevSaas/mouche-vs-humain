import { describe, expect, it } from "vitest";
import { GRAVITY_CM_S2, RESTITUTION, dropTrajectory } from "./physics";

describe("piece drop", () => {
  const tr = dropTrajectory(30, 0);

  it("falls freely, hitting the rest height at sqrt(2h/g)", () => {
    const t1 = Math.sqrt((2 * 30) / GRAVITY_CM_S2);
    expect(tr.impacts[0].t).toBeCloseTo(t1, 10);
    expect(tr.y(t1 / 2)).toBeCloseTo(30 - 0.5 * GRAVITY_CM_S2 * (t1 / 2) ** 2, 10);
    expect(tr.y(t1)).toBeCloseTo(0, 6);
  });

  it("bounces lower each time and never goes below the rest height", () => {
    expect(tr.impacts.length).toBeGreaterThan(1);
    for (let i = 1; i < tr.impacts.length; i++) {
      expect(tr.impacts[i].speed).toBeCloseTo(tr.impacts[i - 1].speed * RESTITUTION, 6);
    }
    for (let t = 0; t <= tr.duration + 0.1; t += 0.001) expect(tr.y(t)).toBeGreaterThanOrEqual(-1e-9);
    const firstBounceTop = (tr.impacts[0].speed * RESTITUTION) ** 2 / (2 * GRAVITY_CM_S2);
    const mid = tr.impacts[0].t + (tr.impacts[0].speed * RESTITUTION) / GRAVITY_CM_S2;
    expect(tr.y(mid)).toBeCloseTo(firstBounceTop, 6);
  });

  it("is at rest after its duration", () => {
    expect(tr.y(tr.duration + 1)).toBe(0);
    expect(dropTrajectory(0, 0).y(0.5)).toBe(0);
  });
});
