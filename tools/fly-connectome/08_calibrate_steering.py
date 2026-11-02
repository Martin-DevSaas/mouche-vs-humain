"""Turning gain from real recordings: rotational velocity (deg/s) per spike/s of
right-minus-left DN activity, measured on Rayshubskiy et al. 2025 (eLife 102230)
dual recordings, Harvard Dataverse doi:10.7910/DVN/0NCLP1 (CC0).

Pipeline re-implemented after their analysis code (github.com/wilson-lab/
rayshubskiy_elife_102230_secondary_analysis_code @ 7e28953, MIT), whose
proc_utils/spike_tools no longer run on numpy 2:
  - spikes: zero-phase Butterworth high-pass (buttord wp=100, ws=0.05 Hz), voltage
    standardised by a rolling (1 s) median absolute deviation, scipy find_peaks
    (height 2.5, prominence P, wlen 10 s). The authors tuned P per fly by eye. Here the
    peak prominences are bimodal (noise ~6, spikes ~20-50 in MAD units), and P is set
    per cell at the valley of the log-prominence histogram; the slope is also reported
    for 0.8 P and 1.25 P.
  - firing rate: 12.5 ms bins, Gaussian kernel sigma 25 ms (their values), in Hz.
  - ball: yaw * 0.000395 / 0.000436 -> deg/s (their calibration), 5-sample smoothing.
  - fit: yaw(t + lag) = m * (rate_R - rate_L)(t) + b, lag maximising |correlation|
    in 0-500 ms, on samples where the fly moves.
  - a recording is used only if neural activity leads rotation (lag >= 50 ms) and the
    slope keeps its sign for spike thresholds x0.8 / x1 / x1.25.
The summary is also written to src/features/fly-connect4/motor/steering-calibration.json.
Files: ephys_A = left cell, ephys_B = right cell (fly_dict of import_preprocess_data).
"""

import hashlib
import json
import urllib.request
from pathlib import Path

import numpy as np
import scipy.io as sio
from scipy.signal import buttord, butter, filtfilt, find_peaks

HERE = Path(__file__).parent
RAW = HERE / "data" / "raw" / "rayshubskiy"
OUT = HERE / "data" / "validation" / "steering_calibration.json"

# Dataverse file id, md5, cell type
RECORDINGS = {
    "a2_d_08": (11634638, "f3d0d40d7435af8f3d4e73d004bd3f9d", "DNa02"),
    "a2_d_12": (11634639, "71ed13ab29ecd3b3abcf7bf6b77940e4", "DNa02"),
    "a2_d_13": (11634640, "c3f95c76e9efc1a5b2277e7ee958143e", "DNa02"),
    "a2_d_14": (11634641, "eb0950ad281d61c4473404ea126b386a", "DNa02"),
    "a1_d_07": (11634630, "50108c60bc0fefeb23be81d74506c3ac", "DNa01"),
    "a1_d_09": (11634631, "cb098a94778db58a5637855882a63119", "DNa01"),
}
P_SCALES = [0.8, 1.0, 1.25]


def valley_prominence(z: np.ndarray, fs: int) -> float:
    """Prominence threshold at the valley right of the noise mode (log-prominence
    histogram); the slope's sensitivity to this choice is reported (x0.8, x1.25)."""
    _, pr = find_peaks(z, height=2.5, prominence=2, wlen=10 * fs)
    lp = np.log10(pr["prominences"])
    h, e = np.histogram(lp, bins=np.arange(0.3, 2.0, 0.02))
    h = np.convolve(h, np.ones(5) / 5, mode="same")
    c = (e[:-1] + e[1:]) / 2
    noise = int(np.argmax(h))
    spike_win = np.nonzero((c > c[noise] + 0.3) & (c < c[noise] + 0.9))[0]
    spike = int(spike_win[np.argmax(h[spike_win])])
    valley = noise + int(np.argmin(h[noise:spike + 1]))
    return float(10 ** c[valley])


def fetch(name: str, file_id: int, md5: str) -> Path:
    p = RAW / f"{name}.mat"
    if not p.exists():
        RAW.mkdir(parents=True, exist_ok=True)
        # Dataverse rejects urllib's default User-Agent (HTTP 403).
        req = urllib.request.Request(f"https://dataverse.harvard.edu/api/access/datafile/{file_id}",
                                     headers={"User-Agent": "fly-connectome/0.1 (curl-compatible)"})
        tmp = p.with_suffix(".part")
        with urllib.request.urlopen(req) as r, open(tmp, "wb") as f:
            while chunk := r.read(1 << 22):
                f.write(chunk)
        tmp.rename(p)
    h = hashlib.md5()
    with open(p, "rb") as f:
        while chunk := f.read(1 << 22):
            h.update(chunk)
    if h.hexdigest() != md5:
        raise SystemExit(f"{name}: md5 mismatch")
    return p


def standardised_hp(v: np.ndarray, fs: int) -> np.ndarray:
    order, wn = buttord(wp=100, ws=0.05, gpass=3, gstop=30, fs=fs)
    b, a = butter(order, wn, btype="high", fs=fs)
    x = filtfilt(b, a, v)
    n = len(x) // fs * fs
    x = x[:n].reshape(-1, fs)
    med = np.median(x, axis=1, keepdims=True)
    mad = np.median(np.abs(x - med), axis=1, keepdims=True)
    return ((x - med) / mad).ravel()


def rate_hz(z: np.ndarray, fs: int, prominence: float, t_out: np.ndarray) -> tuple[np.ndarray, int]:
    peaks, _ = find_peaks(z, height=2.5, prominence=prominence, wlen=10 * fs)
    bin_len = 0.0125
    nb = int(bin_len * fs)
    counts = np.bincount(peaks // nb, minlength=len(z) // nb)[: len(z) // nb]
    sigma = 0.025
    tau = np.arange(-5 * sigma, 5 * sigma, bin_len)
    k = np.exp(-0.5 * (tau / sigma) ** 2)
    k /= k.sum()
    fr = np.convolve(counts, k, mode="same") / bin_len
    t_bins = (np.arange(len(fr)) + 0.5) * bin_len
    return np.interp(t_out, t_bins, fr), len(peaks)


def fit(diff: np.ndarray, yaw: np.ndarray, moving: np.ndarray, dt: float) -> dict:
    best = (0.0, 0)
    for lag in range(0, int(0.5 / dt) + 1):
        x, y, m = diff[: len(diff) - lag], yaw[lag:], moving[lag:]
        r = np.corrcoef(x[m], y[m])[0, 1]
        if abs(r) > abs(best[0]):
            best = (r, lag)
    r, lag = best
    x, y, m = diff[: len(diff) - lag], yaw[lag:], moving[lag:]
    slope, intercept = np.polyfit(x[m], y[m], 1)
    return {"lag_ms": round(lag * dt * 1000), "r": round(float(r), 3), "slope_deg_s_per_hz": round(float(slope), 3),
            "intercept_deg_s": round(float(intercept), 2), "samples": int(m.sum())}


def analyse(name: str, cell: str, path: Path) -> dict:
    d = sio.loadmat(path)
    fs = int(d["ephys_SR"].ravel()[0])
    t_ball = d["t_ball"].ravel()
    yaw = d["yaw"].ravel() * 0.000395 / 0.000436
    yaw = np.convolve(yaw, np.ones(5) / 5, mode="same")
    yaw -= np.median(yaw)
    fwd = d["fwd"].ravel() * 0.0051 / 0.000436
    moving = (np.abs(yaw) + np.abs(np.convolve(fwd, np.ones(5) / 5, mode="same"))) > 5.0
    zl = standardised_hp(d["ephys_A"].ravel(), fs)
    zr = standardised_hp(d["ephys_B"].ravel(), fs)
    dt = float(np.median(np.diff(t_ball)))
    pl, pr_ = valley_prominence(zl, fs), valley_prominence(zr, fs)
    res = {"recording": name, "cell": cell, "duration_s": round(len(zl) / fs, 1),
           "prominence_L": round(pl, 1), "prominence_R": round(pr_, 1), "fits": {}}
    for k in P_SCALES:
        rl, _ = rate_hz(zl, fs, k * pl, t_ball)
        rr, _ = rate_hz(zr, fs, k * pr_, t_ball)
        f = fit(rr - rl, yaw, moving, dt)
        f.update({"mean_rate_L_hz": round(float(rl.mean()), 1), "mean_rate_R_hz": round(float(rr.mean()), 1),
                  "mean_rate_moving_hz": round(float((rl[moving].mean() + rr[moving].mean()) / 2), 1)})
        # binned means (as in their Fig. 3B), with the fitted lag
        lag = int(f["lag_ms"] / 1000 / dt)
        x, y, m = (rr - rl)[: len(rl) - lag], yaw[lag:], moving[lag:]
        edges = np.percentile(x[m], np.linspace(2, 98, 11))
        idx = np.digitize(x[m], edges)
        f["binned"] = [[round(float(x[m][idx == i].mean()), 1), round(float(y[m][idx == i].mean()), 1)]
                       for i in range(1, len(edges)) if (idx == i).sum() > 50]
        res["fits"][str(k)] = f
    # Usable if neural activity leads behaviour and the slope's sign does not depend on
    # the spike threshold (no assumption on the sign itself).
    slopes = [res["fits"][str(k)]["slope_deg_s_per_hz"] for k in P_SCALES]
    res["usable"] = bool(res["fits"]["1.0"]["lag_ms"] >= 50 and (min(slopes) > 0 or max(slopes) < 0))
    return res


def main() -> None:
    results = []
    for name, (fid, md5, cell) in RECORDINGS.items():
        r = analyse(name, cell, fetch(name, fid, md5))
        print(json.dumps(r), flush=True)
        results.append(r)
    summary = {}
    for cell in ["DNa02", "DNa01"]:
        rows = [r for r in results if r["cell"] == cell and r["usable"]]
        if not rows:
            summary[cell] = {"usable_recordings": 0}
            continue
        slopes = [r["fits"]["1.0"]["slope_deg_s_per_hz"] for r in rows]
        summary[cell] = {
            "usable_recordings": [r["recording"] for r in rows],
            "slopes_deg_s_per_hz": slopes,
            "mean_slope_deg_s_per_hz": round(float(np.mean(slopes)), 3),
            "mean_lag_ms": round(float(np.mean([r["fits"]["1.0"]["lag_ms"] for r in rows]))),
            "mean_slope_for_prominence_x0.8_x1_x1.25": [
                round(float(np.mean([r["fits"][str(k)]["slope_deg_s_per_hz"] for r in rows])), 3) for k in P_SCALES
            ],
            "mean_rate_moving_hz": round(float(np.mean([r["fits"]["1.0"]["mean_rate_moving_hz"] for r in rows])), 1),
        }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"summary": summary, "recordings": results}, indent=1))
    ts_json = HERE.parent.parent / "src" / "features" / "fly-connect4" / "motor" / "steering-calibration.json"
    ts_json.write_text(json.dumps({
        "_comment": "Generated by tools/fly-connectome/08_calibrate_steering.py from Rayshubskiy et al. 2025 "
                    "dual recordings (Harvard Dataverse doi:10.7910/DVN/0NCLP1, CC0); do not edit.",
        **summary,
    }, indent=1) + "\n")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
