// Spike record of one fly decision: the single source for the live view.
// Spikes arrive in time order (windows from the worker), so time queries are binary searches.

export class SpikeRecorder {
  private steps = new Int32Array(1 << 16);
  private neurons = new Int32Array(1 << 16);
  private n = 0;
  /** Step after the last simulated step received. */
  endStep = 0;
  /** Incremented on every change, for React subscribers. */
  version = 0;

  reset(): void {
    this.n = 0;
    this.endStep = 0;
    this.version++;
  }

  get count(): number {
    return this.n;
  }

  append(steps: Int32Array, neurons: Int32Array, toStep: number): void {
    if (steps.length !== neurons.length) throw new Error("steps/neurons length mismatch");
    if (this.n > 0 && steps.length > 0 && steps[0] < this.steps[this.n - 1]) throw new Error("spikes out of order");
    const need = this.n + steps.length;
    if (need > this.steps.length) {
      let cap = this.steps.length;
      while (cap < need) cap *= 2;
      const s = new Int32Array(cap);
      const nr = new Int32Array(cap);
      s.set(this.steps.subarray(0, this.n));
      nr.set(this.neurons.subarray(0, this.n));
      this.steps = s;
      this.neurons = nr;
    }
    this.steps.set(steps, this.n);
    this.neurons.set(neurons, this.n);
    this.n = need;
    this.endStep = Math.max(this.endStep, toStep);
    this.version++;
  }

  /** Index of the first spike with step >= s. */
  lowerBound(s: number): number {
    let lo = 0;
    let hi = this.n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.steps[mid] < s) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Spikes with fromStep <= step < toStep (views, valid until the next append). */
  range(fromStep: number, toStep: number): { steps: Int32Array; neurons: Int32Array } {
    const a = this.lowerBound(fromStep);
    const b = this.lowerBound(toStep);
    return { steps: this.steps.subarray(a, b), neurons: this.neurons.subarray(a, b) };
  }
}

/** The decision being shown (live, then its final state). */
export const brainRecorder = new SpikeRecorder();
