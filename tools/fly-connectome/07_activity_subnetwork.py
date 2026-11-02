"""Activity-based subnetwork selection, validated against the full brain.

Why: the path-based selection of phase 1 (K <= 5 hops, w >= 11) removes too much
inhibition: DNa01/DNa02 fired up to 12x more than in the full network (REPORT.md 2.3).
In Shiu et al.'s LIF model neurons have no spontaneous activity, so a neuron that never
spikes for a stimulus has no effect on the outputs for that stimulus. Keeping the
neurons that spike in the full 166 700-neuron network for game-like stimuli is exact
for those stimuli; held-out stimuli measure the error.

  select    random legal positions x headings x gains (vision module, js/stimuli.ts),
            full-brain TS simulations, union of active neurons -> data/activity/active.npy
            then: 02_build_subnetwork.py --active data/activity/active.npy, 03, 05
  validate  held-out stimuli, full brain vs exported subnetwork: DN rates per stimulus.
"""

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
REPO = HERE.parent.parent
ASSETS = REPO / "public" / "fly-brain" / "v1"
FULL = HERE / "data" / "full_network"
ACT = HERE / "data" / "activity"
GAINS = "100,200,400"
DURATION_MS = 500.0


def ts(*args: str) -> str:
    r = subprocess.run(["npx", "tsx", *args], cwd=REPO, check=True, capture_output=True, text=True)
    return r.stdout


def stimuli(name: str, count: int, seed: int) -> list[dict]:
    path = ACT / f"stimuli_{name}.json"
    if not path.exists():
        ACT.mkdir(parents=True, exist_ok=True)
        ts("tools/fly-connectome/js/stimuli.ts", str(path), str(count), str(seed), GAINS)
    return json.loads(path.read_text())["stimuli"]


def column_index() -> dict[tuple, int]:
    c = json.loads((ASSETS / "columns.json").read_text())
    return {(e, p, q): i for i, (e, p, q) in enumerate(zip(c["eye"], c["p"], c["q"]))}


def input_targets(body_ids: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(neuron index in the network with these body ids, column index) of every L1/L2/L3 input."""
    inp = pd.read_parquet(HERE / "data/visual/inputs.parquet")
    cols = column_index()
    pos = pd.Series(np.arange(len(body_ids)), index=body_ids)
    inp = inp[inp.bodyId.isin(pos.index)]
    col = np.array([cols[(e, int(p), int(q))] for e, p, q in zip(inp.eye, inp.hex1, inp.hex2)])
    return pos[inp.bodyId.values].values, col


def run(net_dir: Path, tag: str, targets: np.ndarray, rates: np.ndarray, trials: int, seed: int) -> np.ndarray:
    job = {"network_dir": str(net_dir), "duration_ms": DURATION_MS, "trials": trials, "seed": seed,
           "out": str(ACT / tag),
           "poisson": {"targets": [int(t) for t in targets], "rates_hz": [float(r) for r in rates]}}
    jp = ACT / f"{tag}.job.json"
    jp.write_text(json.dumps(job))
    info = json.loads(ts("tools/fly-connectome/js/sim-cli.ts", str(jp)).strip().splitlines()[-1])
    counts = np.fromfile(ACT / f"{tag}.counts.u32", dtype="<u4").reshape(trials, info["neurons"])
    (ACT / f"{tag}.counts.u32").unlink()
    return counts


def full_body_ids() -> np.ndarray:
    return np.array(json.loads((FULL / "meta.json").read_text())["bodyId"], dtype=np.int64)


def cmd_select(args) -> None:
    body = full_body_ids()
    targets, col = input_targets(body)
    active = np.zeros(len(body), dtype=bool)
    per_stim = []
    for s in stimuli("select", args.count, seed=1):
        c = run(FULL, f"select_{s['id']}", targets, np.array(s["rates_hz"])[col], 1, 10 + s["id"])[0]
        active |= c > 0
        per_stim.append({"id": s["id"], "gain_hz": s["gain_hz"], "heading_deg": s["heading_deg"],
                         "active": int((c > 0).sum()), "union": int(active.sum())})
        print(json.dumps(per_stim[-1]), flush=True)
    np.save(ACT / "active.npy", active)
    np.save(ACT / "active_bodies.npy", body[active])
    (ACT / "select.json").write_text(json.dumps(per_stim, indent=1))


def cmd_validate(args) -> None:
    body = full_body_ids()
    meta = json.loads((ASSETS / "meta.json").read_text())
    nb = (ASSETS / "neurons.bin").read_bytes()
    lay = meta["files"]["neurons.bin"]["layout"]["bodyId"]
    sub_body = np.frombuffer(nb, dtype="<u4", count=lay["length"], offset=lay["offset"]).astype(np.int64)
    f_targets, f_col = input_targets(body)
    s_targets, s_col = input_targets(sub_body)
    full_pos = pd.Series(np.arange(len(body)), index=body)
    outs = meta["outputs"]
    rows = []
    for s in stimuli("validate", args.count, seed=2):
        rates = np.array(s["rates_hz"])
        fc = run(FULL, f"val_full_{s['id']}", f_targets, rates[f_col], args.trials, 500 + s["id"])
        sc = run(ASSETS, f"val_sub_{s['id']}", s_targets, rates[s_col], args.trials, 900 + s["id"])
        fr = fc.mean(0) / (DURATION_MS / 1000)
        sr = sc.mean(0) / (DURATION_MS / 1000)
        fr_sub = fr[full_pos[sub_body].values]
        act = (fr_sub > 0) | (sr > 0)
        row = {"id": s["id"], "gain_hz": s["gain_hz"], "heading_deg": s["heading_deg"],
               "rate_corr": round(float(np.corrcoef(fr_sub[act], sr[act])[0, 1]), 4),
               "outside_active_full": int((fr > 0).sum() - (fr_sub > 0).sum())}
        for k, i in outs.items():
            row[f"{k}_full"] = round(float(fr_sub[i]), 2)
            row[f"{k}_sub"] = round(float(sr[i]), 2)
        rows.append(row)
        print(json.dumps(row), flush=True)
    df = pd.DataFrame(rows)
    steer_f = df.DNa02_R_full - df.DNa02_L_full
    steer_s = df.DNa02_R_sub - df.DNa02_L_sub
    summary = {
        "stimuli": len(df), "trials": args.trials, "duration_ms": DURATION_MS,
        "median_rate_corr": float(df.rate_corr.median()),
        "dna02_steer_corr": float(np.corrcoef(steer_f, steer_s)[0, 1]) if steer_f.std() and steer_s.std() else None,
        "mean_abs_dn_error_hz": float(np.mean([abs(df[f"{k}_full"] - df[f"{k}_sub"]).mean() for k in outs])),
        "mean_dn_rate_full_hz": float(np.mean([df[f"{k}_full"].mean() for k in outs])),
        "rows": rows,
    }
    (ACT / "validate.json").write_text(json.dumps(summary, indent=1))
    print(json.dumps({k: v for k, v in summary.items() if k != "rows"}, indent=1))


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("select")
    p.add_argument("--count", type=int, default=30)
    p = sub.add_parser("validate")
    p.add_argument("--count", type=int, default=9)
    p.add_argument("--trials", type=int, default=3)
    args = ap.parse_args()
    {"select": cmd_select, "validate": cmd_validate}[args.cmd](args)


if __name__ == "__main__":
    main()
