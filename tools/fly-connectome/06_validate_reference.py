"""Cross-validate the TypeScript LIF engine against Shiu et al.'s Brian2 model.

The reference is Shiu et al.'s own model.py (github.com/philshiu/Drosophila_brain_model,
commit 91bdd1e, MIT), imported as is: create_model / run_trial build the Brian2
network from files in their format, which we write for our subnetwork.

Subcommands
  brian2   same subnetwork, same stimulus:
           - deterministic: identical input events in both engines (Brian2 through a
             SpikeGeneratorGroup with on_pre "v += w_syn * f_poi", delivered in the same
             schedule slot as PoissonInput) -> spike-by-spike comparison;
           - stochastic: model.py's PoissonInput vs our seeded Poisson, several trials
             -> correlation of per-neuron firing rates.
  pruning  TS engine on the full 166 700-neuron MaleCNS network vs the subnetwork,
           same stimulus -> effect of the K-hop selection, left/right DN balance.
  flywire  offline bonus on FlyWire (CC BY-NC, never deployed): sugar GRNs -> MN9,
           TS engine vs Brian2 (model.py) on Shiu's own connectivity files.

Results: data/validation/*.json (summarised in REPORT.md).
"""

import argparse
import gc
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
REPO = HERE.parent.parent
ASSETS = REPO / "public" / "fly-brain" / "v1"
REF = HERE / "data" / "ref"
OUT = HERE / "data" / "validation"
CACHE = HERE / "data" / "cache"

MODEL_URL = ("https://raw.githubusercontent.com/philshiu/Drosophila_brain_model/"
             "91bdd1e7dcf193f3e7ca5a8933497fcef63b7960/")
MODEL_SHA256 = "fc45837d7122c6ce2a7f3f2f23c515992e4b232aadb919efabb72337fac88e4e"
DT_MS = 0.1


# ---------------------------------------------------------------- helpers

def fetch(name: str, sha: str | None = None) -> Path:
    import urllib.request

    dest = REF / name
    if not dest.exists():
        REF.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(MODEL_URL + name, dest)
    if sha and hashlib.sha256(dest.read_bytes()).hexdigest() != sha:
        sys.exit(f"{name}: unexpected sha256")
    return dest


def shiu():
    fetch("model.py", MODEL_SHA256)
    sys.path.insert(0, str(REF))
    import model  # noqa: E402  (Shiu et al.'s model.py)

    return model


def read_network(d: Path) -> tuple[dict, np.ndarray, np.ndarray, np.ndarray]:
    meta = json.loads((d / "meta.json").read_text())
    buf = (d / "network.bin").read_bytes()
    lay = meta["files"]["network.bin"]["layout"]
    arr = {k: np.frombuffer(buf, dtype=np.dtype(v["dtype"]).newbyteorder("<"), count=v["length"],
                            offset=v["offset"]) for k, v in lay.items()}
    return meta, arr["offsets"], arr["targets"], arr["weights"]


def write_network(d: Path, n: int, pre: np.ndarray, post: np.ndarray, w: np.ndarray, extra: dict) -> None:
    """Write a network in the public/fly-brain/v1 layout (uint32 targets, int32 weights)."""
    o = np.lexsort((post, pre))
    pre, post, w = pre[o], post[o], w[o]
    offsets = np.zeros(n + 1, dtype=np.uint32)
    np.cumsum(np.bincount(pre, minlength=n), out=offsets[1:])
    chunks = [("offsets", offsets), ("targets", post.astype(np.uint32)), ("weights", w.astype(np.int32))]
    out, layout, off = bytearray(), {}, 0
    for name, a in chunks:
        b = a.astype(a.dtype.newbyteorder("<")).tobytes()
        layout[name] = {"offset": off, "length": int(a.size), "dtype": a.dtype.name}
        out += b
        off += len(b)
    d.mkdir(parents=True, exist_ok=True)
    (d / "network.bin").write_bytes(bytes(out))
    meta = {"counts": {"neurons": n, "connections": int(len(w))},
            "files": {"network.bin": {"bytes": len(out), "layout": layout}}, **extra}
    (d / "meta.json").write_text(json.dumps(meta))


def write_shiu_format(d: Path, n: int, pre, post, w) -> tuple[Path, Path]:
    """Files read by model.create_model: completeness csv (index = neuron) + connectivity parquet."""
    d.mkdir(parents=True, exist_ok=True)
    comp, con = d / "completeness.csv", d / "connectivity.parquet"
    pd.DataFrame({"Completed": True}, index=pd.Index(np.arange(n), name="id")).to_csv(comp)
    pd.DataFrame({
        "Presynaptic_Index": pre.astype(np.int64),
        "Postsynaptic_Index": post.astype(np.int64),
        "Excitatory x Connectivity": w.astype(np.int64),
    }).to_parquet(con)
    return comp, con


def poisson_events(targets: np.ndarray, rate_hz: float, duration_ms: float, seed: int) -> np.ndarray:
    """Bernoulli(rate * dt) per step per target, as PoissonInput(N=1). Returns (step, target) rows."""
    steps = int(round(duration_ms / DT_MS))
    rng = np.random.default_rng(seed)
    hit = rng.random((steps, len(targets))) < rate_hz * DT_MS * 1e-3
    s, k = np.nonzero(hit)
    return np.stack([s, targets[k]], axis=1).astype(np.int32)


def run_ts(net_dir: Path, tag: str, duration_ms: float, trials: int, seed: int,
           poisson: tuple[np.ndarray, float] | None = None, scheduled: np.ndarray | None = None,
           silence: list[int] | None = None, record: bool = False) -> tuple[np.ndarray, np.ndarray | None, dict]:
    OUT.mkdir(parents=True, exist_ok=True)
    job = {"network_dir": str(net_dir), "duration_ms": duration_ms, "trials": trials, "seed": seed,
           "out": str(OUT / tag), "record_spikes": record}
    if poisson is not None:
        job["poisson"] = {"targets": [int(x) for x in poisson[0]], "rate_hz": poisson[1]}
    if scheduled is not None:
        p = OUT / f"{tag}.events.i32"
        scheduled.astype("<i4").tofile(p)
        job["scheduled"] = str(p)
    if silence:
        job["silence"] = silence
    jp = OUT / f"{tag}.job.json"
    jp.write_text(json.dumps(job))
    r = subprocess.run(["npx", "tsx", "tools/fly-connectome/js/sim-cli.ts", str(jp)],
                       cwd=REPO, check=True, capture_output=True, text=True)
    info = json.loads(r.stdout.strip().splitlines()[-1])
    meta_n = info["neurons"]
    counts = np.fromfile(OUT / f"{tag}.counts.u32", dtype="<u4").reshape(trials, meta_n)
    spikes = np.fromfile(OUT / f"{tag}.spikes.i32", dtype="<i4").reshape(-1, 3) if record else None
    return counts, spikes, info


def run_brian2_scheduled(model, comp: Path, con: Path, events: np.ndarray, duration_ms: float):
    import brian2 as b2

    params = dict(model.default_params)
    params["t_run"] = duration_ms * b2.ms
    b2.start_scope()
    b2.defaultclock.dt = DT_MS * b2.ms
    neu, syn, spk = model.create_model(comp, con, params)
    targets = np.unique(events[:, 1])
    slot = {t: k for k, t in enumerate(targets)}
    gen = b2.SpikeGeneratorGroup(len(targets), [slot[t] for t in events[:, 1]], events[:, 0] * DT_MS * b2.ms)
    w_poi = params["w_syn"] * params["f_poi"]
    inp = b2.Synapses(gen, neu, on_pre="v_post += w_poi", namespace={"w_poi": w_poi})
    inp.connect(i=np.arange(len(targets)), j=targets)
    neu.rfc[targets] = 0 * b2.ms  # as model.poi does for Poisson targets
    net = b2.Network(neu, syn, spk, gen, inp)
    t0 = time.time()
    net.run(params["t_run"])
    wall = time.time() - t0
    steps = np.round(np.asarray(spk.t / b2.ms) / DT_MS).astype(np.int64)
    return np.asarray(spk.i), steps, wall


def run_brian2_poisson(model, comp: Path, con: Path, targets: np.ndarray, rate_hz: float,
                       duration_ms: float, trials: int, seed: int) -> tuple[np.ndarray, float]:
    """Stochastic Brian2 runs.

    Few targets: model.run_trial verbatim (one PoissonInput per target, as model.poi does).
    Many targets: model.poi would compile one Cython object per target (hours for
    thousands), so the same process is built once: a PoissonGroup (one Bernoulli
    draw of rate * dt per step and target) with on_pre "v += w_syn * f_poi" and no
    delay, delivered in the "synapses" slot like PoissonInput, targets with rfc = 0.
    """
    import brian2 as b2

    params = dict(model.default_params)
    params["t_run"] = duration_ms * b2.ms
    params["r_poi"] = rate_hz * b2.Hz
    n = len(pd.read_csv(comp, index_col=0))
    counts = np.zeros((trials, n), dtype=np.int64)
    t0 = time.time()
    for k in range(trials):
        b2.start_scope()
        b2.seed(seed + k)
        b2.defaultclock.dt = DT_MS * b2.ms
        if len(targets) <= 50:
            trains = model.run_trial(list(map(int, targets)), [], [], comp, con, params)
            for i, ts in trains.items():
                counts[k, i] = len(ts)
            del trains
            gc.collect()
            continue
        neu, syn, spk = model.create_model(comp, con, params)
        pg = b2.PoissonGroup(len(targets), rates=params["r_poi"])
        w_poi = params["w_syn"] * params["f_poi"]
        inp = b2.Synapses(pg, neu, on_pre="v_post += w_poi", namespace={"w_poi": w_poi})
        inp.connect(i=np.arange(len(targets)), j=targets)
        neu.rfc[targets] = 0 * b2.ms
        b2.Network(neu, syn, spk, pg, inp).run(params["t_run"])
        counts[k] = np.bincount(np.asarray(spk.i), minlength=n)
    return counts, time.time() - t0


def pearson(a: np.ndarray, b: np.ndarray) -> float:
    if a.std() == 0 or b.std() == 0:
        return float("nan")
    return float(np.corrcoef(a, b)[0, 1])


def choose_inputs(meta_dir: Path, fraction: float, seed: int) -> np.ndarray:
    meta = json.loads((meta_dir / "meta.json").read_text())
    buf = (meta_dir / "neurons.bin").read_bytes()
    lay = meta["files"]["neurons.bin"]["layout"]["flags"]
    flags = np.frombuffer(buf, dtype=np.uint8, count=lay["length"], offset=lay["offset"])
    inputs = np.nonzero(flags & meta["flags"]["input"])[0]
    if fraction >= 1:
        return inputs
    rng = np.random.default_rng(seed)
    return np.sort(rng.choice(inputs, size=int(round(fraction * len(inputs))), replace=False))


# ---------------------------------------------------------------- brian2

def cmd_brian2(args) -> None:
    model = shiu()
    meta, offsets, targets, weights = read_network(ASSETS)
    n = meta["counts"]["neurons"]
    pre = np.repeat(np.arange(n), np.diff(offsets.astype(np.int64)))
    comp, con = write_shiu_format(REF / "subnet", n, pre, targets, weights)
    outputs = meta["outputs"]
    results = {"model_py_sha256": MODEL_SHA256, "brian2": __import__("brian2").__version__, "stimuli": {}}

    for frac in args.fractions:
        inputs = choose_inputs(ASSETS, frac, seed=11)
        key = f"inputs_{int(frac * 100)}pct_{args.rate:g}Hz"
        res: dict = {"n_inputs": int(len(inputs)), "duration_ms": args.duration}

        # Deterministic: identical input events.
        ev = poisson_events(inputs, args.rate, args.duration, seed=5)
        bi, bs, bwall = run_brian2_scheduled(model, comp, con, ev, args.duration)
        tc, tsp, tinfo = run_ts(ASSETS, f"det_{key}", args.duration, 1, 0, scheduled=ev, record=True)
        bset = set(zip(bs.tolist(), bi.tolist()))
        tset = set(zip(tsp[:, 1].tolist(), tsp[:, 2].tolist()))
        bcount = np.bincount(bi, minlength=n)
        tcount = tc[0]
        act = (bcount > 0) | (tcount > 0)
        first_b = min(bset - tset, default=None)
        first_t = min(tset - bset, default=None)
        res["deterministic"] = {
            "spikes_brian2": int(len(bset)), "spikes_ts": int(len(tset)),
            "identical_spikes": int(len(bset & tset)),
            "identical_frac": round(len(bset & tset) / max(len(bset | tset), 1), 6),
            "first_mismatch_step": min([x[0] for x in (first_b, first_t) if x is not None], default=None),
            "active_neurons": int(act.sum()),
            "count_corr": round(pearson(bcount[act], tcount[act]), 6),
            "outputs_brian2": {k: int(bcount[i]) for k, i in outputs.items()},
            "outputs_ts": {k: int(tcount[i]) for k, i in outputs.items()},
            "wall_s_brian2": round(bwall, 1), "wall_s_ts": tinfo["wall_s"],
        }
        print(key, "deterministic", json.dumps(res["deterministic"]))

        # Stochastic: model.py PoissonInput vs our Poisson, independent RNGs.
        bc, bwall = run_brian2_poisson(model, comp, con, inputs, args.rate, args.duration, args.trials, seed=100)
        tc, _, tinfo = run_ts(ASSETS, f"sto_{key}", args.duration, args.trials, 1000, poisson=(inputs, args.rate))
        br, tr = bc.mean(0) / (args.duration / 1000), tc.mean(0) / (args.duration / 1000)
        act = (br > 0) | (tr > 0)
        non_input = act.copy()
        non_input[inputs] = False
        res["stochastic"] = {
            "trials": args.trials,
            "active_neurons": int(act.sum()),
            "rate_corr_all_active": round(pearson(br[act], tr[act]), 4),
            "rate_corr_non_input": round(pearson(br[non_input], tr[non_input]), 4),
            "mean_rate_brian2": round(float(br[act].mean()), 3), "mean_rate_ts": round(float(tr[act].mean()), 3),
            "outputs_rate_brian2": {k: round(float(br[i]), 2) for k, i in outputs.items()},
            "outputs_rate_ts": {k: round(float(tr[i]), 2) for k, i in outputs.items()},
            "outputs_active_same": sorted(k for k, i in outputs.items() if br[i] > 0)
            == sorted(k for k, i in outputs.items() if tr[i] > 0),
            "wall_s_brian2": round(bwall, 1), "wall_s_ts": tinfo["wall_s"],
        }
        print(key, "stochastic", json.dumps(res["stochastic"]))
        results["stimuli"][key] = res

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "brian2.json").write_text(json.dumps(results, indent=1))


# ---------------------------------------------------------------- pruning

def cmd_pruning(args) -> None:
    full_dir = HERE / "data" / "full_network"
    sub_neurons = pd.read_parquet(HERE / "data/subnet/neurons.parquet")
    full = pd.read_feather(HERE / "data/raw/body-annotations-male-cns-v1.0-minconf-0.5.feather")
    full = full[full.superclass.notna()].reset_index(drop=True)
    sub_meta, *_ = read_network(ASSETS)
    nb = (ASSETS / "neurons.bin").read_bytes()
    lay = sub_meta["files"]["neurons.bin"]["layout"]["bodyId"]
    sub_body = np.frombuffer(nb, dtype="<u4", count=lay["length"], offset=lay["offset"]).astype(np.int64)
    if not (full_dir / "network.bin").exists():
        e = np.load(CACHE / "edges_neurons.npz")
        # Same sign rule as the subnetwork (02_build_subnetwork.py), recomputed for all neurons.
        tb = pd.read_parquet(CACHE / "tbar_stats.parquet")
        tot = tb.tbar_total.replace(0, np.nan)
        frac = (tb.tbar_gaba + tb.tbar_glutamate + tb.tbar_histamine) / tot
        nt = pd.read_feather(HERE / "data/raw/body-neurotransmitters-male-cns-v1.0.feather") \
            .drop_duplicates("body").set_index("body").reindex(full.bodyId.values).consensus_nt
        inh = np.where(tot.notna(), frac > 0.5, nt.isin(["gaba", "glutamate", "histamine"]).values)
        sign = np.where(inh, -1, 1)
        write_network(full_dir, len(full), e["pre"], e["post"], e["w"] * sign[e["pre"]],
                      {"bodyId": full.bodyId.tolist()})
        assert sub_neurons.bodyId.isin(full.bodyId).all()
    full_index = pd.Series(np.arange(len(full)), index=full.bodyId.values)
    sub_to_full = full_index[sub_body].values
    _, s_off, s_tgt, s_w = read_network(ASSETS)
    outputs = sub_meta["outputs"]
    results = {}
    for frac in args.fractions:
        inputs = choose_inputs(ASSETS, frac, seed=11)
        key = f"inputs_{int(frac * 100)}pct_{args.rate:g}Hz"
        sc, _, si = run_ts(ASSETS, f"prune_sub_{key}", args.duration, args.trials, 2000, poisson=(inputs, args.rate))
        fc, _, fi = run_ts(full_dir, f"prune_full_{key}", args.duration, args.trials, 2000,
                           poisson=(sub_to_full[inputs], args.rate))
        sr = sc.mean(0) / (args.duration / 1000)
        fr = fc.mean(0)[sub_to_full] / (args.duration / 1000)
        act = (sr > 0) | (fr > 0)
        outside = np.ones(fc.shape[1], bool)
        outside[sub_to_full] = False
        res = {
            "rate_corr_sub_neurons": round(pearson(sr[act], fr[act]), 4),
            "active_in_sub": int((sr > 0).sum()), "active_same_neurons_in_full": int((fr > 0).sum()),
            "active_outside_sub_in_full": int((fc.mean(0)[outside] > 0).sum()),
            "outputs_rate_sub": {k: round(float(sr[i]), 2) for k, i in outputs.items()},
            "outputs_rate_full": {k: round(float(fr[i]), 2) for k, i in outputs.items()},
            "wall_s": {"sub": si["wall_s"], "full": fi["wall_s"]},
        }
        print(key, json.dumps(res))
        results[key] = res
    (OUT / "pruning.json").write_text(json.dumps(results, indent=1))


# ---------------------------------------------------------------- flywire (bonus, offline only)

SUGAR_R = [  # example.ipynb of Shiu et al. (right sugar-sensing GRNs, FlyWire 630)
    720575940624963786, 720575940630233916, 720575940637568838, 720575940638202345,
    720575940617000768, 720575940630797113, 720575940632889389, 720575940621754367,
    720575940621502051, 720575940640649691, 720575940639332736, 720575940616885538,
    720575940639198653, 720575940620900446, 720575940617937543, 720575940632425919,
    720575940633143833, 720575940612670570, 720575940628853239, 720575940629176663,
    720575940611875570,
]


def cmd_flywire(args) -> None:
    model = shiu()
    comp = fetch("2023_03_23_completeness_630_final.csv")
    con = fetch("2023_03_23_connectivity_630_final.parquet")
    df_comp = pd.read_csv(comp, index_col=0)
    df_con = pd.read_parquet(con)
    n = len(df_comp)
    fw_dir = HERE / "data" / "flywire_630"
    if not (fw_dir / "network.bin").exists():
        write_network(fw_dir, n, df_con["Presynaptic_Index"].values, df_con["Postsynaptic_Index"].values,
                      df_con["Excitatory x Connectivity"].values, {"note": "FlyWire 630, CC BY-NC, offline only"})
    flyid2i = {f: i for i, f in enumerate(df_comp.index)}
    exc = np.array([flyid2i[f] for f in SUGAR_R])
    mn9 = {"MN9_L": flyid2i[720575940660219265], "MN9_R": flyid2i[720575940645521262]}  # figures.ipynb
    # Results are merged into flywire.json after each rate, so rates can run in
    # separate processes (Brian2 keeps ~4 GB per FlyWire network alive).
    path = OUT / "flywire.json"
    res = json.loads(path.read_text()) if path.exists() else {"by_rate": {}}
    res.update({"neurons": n, "connections": int(len(df_con)), "trials": args.trials})
    for rate in args.rates:
        # TS first: its Node process and Brian2's ~4 GB network are never resident together.
        tc, _, tinfo = run_ts(fw_dir, f"flywire_sugarR_{rate:g}Hz", args.duration, args.trials, 3000,
                              poisson=(exc, rate))
        bc, bwall = run_brian2_poisson(model, comp, con, exc, rate, args.duration, args.trials, seed=300)
        br, tr = bc.mean(0) / (args.duration / 1000), tc.mean(0) / (args.duration / 1000)
        act = (br > 0) | (tr > 0)
        top_b = np.argsort(-br)[:20]
        r = {
            "rate_corr_all_active": round(pearson(br[act], tr[act]), 4),
            "active_neurons": int(act.sum()),
            "mn9_brian2_hz": {k: round(float(br[i]), 2) for k, i in mn9.items()},
            "mn9_ts_hz": {k: round(float(tr[i]), 2) for k, i in mn9.items()},
            "mn9_sd_brian2_hz": {k: round(float(bc[:, i].std() / (args.duration / 1000)), 2) for k, i in mn9.items()},
            "mn9_sd_ts_hz": {k: round(float(tc[:, i].std() / (args.duration / 1000)), 2) for k, i in mn9.items()},
            "top20_brian2": [{"flywire_id": int(df_comp.index[i]), "brian2_hz": round(float(br[i]), 1),
                              "ts_hz": round(float(tr[i]), 1)} for i in top_b],
            "wall_s_brian2": round(bwall, 1), "wall_s_ts": tinfo["wall_s"],
        }
        print(f"{rate:g} Hz", json.dumps({k: v for k, v in r.items() if k != "top20_brian2"}))
        res["by_rate"][f"{rate:g}"] = r
        OUT.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(res, indent=1))


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ["brian2", "pruning", "flywire"]:
        p = sub.add_parser(name)
        p.add_argument("--duration", type=float, default=1000.0, help="ms")
        p.add_argument("--trials", type=int, default=5)
        p.add_argument("--rate", type=float, default=150.0, help="Poisson rate, Hz")
        p.add_argument("--fractions", type=float, nargs="+", default=[0.3, 1.0])
        p.add_argument("--rates", type=float, nargs="+", default=[50, 100, 150, 200], help="flywire only")
    args = ap.parse_args()
    {"brian2": cmd_brian2, "pruning": cmd_pruning, "flywire": cmd_flywire}[args.cmd](args)


if __name__ == "__main__":
    main()
