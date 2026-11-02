"""Select the visuo-motor subnetwork of MaleCNS v1.0 and compute per-neuron metadata.

Inputs  : lamina monopolar cells L1, L2, L3, both eyes, all columns. In v1.0 the
          left L3 cells have no assignedOlHex column; they are still inputs
          (otherwise the right eye would get an extra pathway and bias turning),
          and their column is derived in 03_visual_mapping.py.
Outputs : DNa01 and DNa02, left and right (Rayshubskiy et al., eLife 2025).

Selection: a neuron is kept if it lies on a directed path input -> output of at
most K hops, using only connections with >= W_MIN synapses for the path search
(forward BFS distance + backward BFS distance <= K). The simulated network then
contains *every* connection (any synapse count) between kept neurons.

Why this is principled for the Shiu et al. LIF model: neurons there have no
spontaneous activity, so a neuron not reachable from the inputs never spikes,
and a neuron that cannot reach the outputs cannot influence them. The only
approximation is the (K, W_MIN) cut, whose cost is reported below.

Sign rule (Shiu et al. 2024, Methods): a neuron is inhibitory if more than half
of its presynaptic sites are predicted GABA or glutamate; otherwise excitatory.
Applied here per T-bar (argmax of the 7 NT probabilities). Deviation, documented
in SCIENTIFIC_NOTES.md: histamine (absent from the FlyWire predictions Shiu used)
is counted as inhibitory, because Drosophila histamine receptors are chloride
channels (HisCl1, ort).
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.ipc as ipc
import scipy.sparse as sp

HERE = Path(__file__).parent
RAW = HERE / "data" / "raw"
CACHE = HERE / "data" / "cache"
OUT = HERE / "data" / "subnet"

ANN = RAW / "body-annotations-male-cns-v1.0-minconf-0.5.feather"
NT = RAW / "body-neurotransmitters-male-cns-v1.0.feather"
WEIGHTS = RAW / "connectome-weights-male-cns-v1.0-minconf-0.5.feather"
TBAR = RAW / "tbar-neurotransmitters-male-cns-v1.0.feather"
NEURONS = RAW / "Neuprint_Neurons.feather"
META = RAW / "Neuprint_Meta.csv"

INPUT_TYPES = ["L1", "L2", "L3"]
OUTPUT_TYPES = ["DNa01", "DNa02"]
NT_NAMES = ["acetylcholine", "dopamine", "gaba", "glutamate", "histamine", "octopamine", "serotonin"]
TBAR_MIN_CONF = 0.5  # same threshold as the minconf-0.5 connectome tables


def load_neurons() -> pd.DataFrame:
    a = pd.read_feather(ANN)
    # A body with a superclass is a neuron: 166 700 bodies, matching the paper's count.
    a = a[a.superclass.notna()].reset_index(drop=True)
    return a


def load_edges(neurons: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    cache = CACHE / "edges_neurons.npz"
    if cache.exists():
        e = np.load(cache)
        return e["pre"], e["post"], e["w"]
    ids = pa.array(neurons.bodyId.values)
    idx = pd.Series(np.arange(len(neurons), dtype=np.int32), index=neurons.bodyId.values)
    r = ipc.open_file(WEIGHTS)
    pre, post, w = [], [], []
    for i in range(r.num_record_batches):
        b = r.get_batch(i)
        b = b.filter(pc.and_(pc.is_in(b["body_pre"], ids), pc.is_in(b["body_post"], ids)))
        pre.append(idx[b["body_pre"].to_numpy()].values)
        post.append(idx[b["body_post"].to_numpy()].values)
        w.append(b["weight"].to_numpy().astype(np.int32))
    pre, post, w = np.concatenate(pre), np.concatenate(post), np.concatenate(w)
    CACHE.mkdir(parents=True, exist_ok=True)
    np.savez(cache, pre=pre, post=post, w=w)
    return pre, post, w


def tbar_stats(neurons: pd.DataFrame) -> pd.DataFrame:
    """Per neuron: count of T-bars by argmax NT, and T-bar centroid (fallback position)."""
    cache = CACHE / "tbar_stats.parquet"
    if cache.exists():
        return pd.read_parquet(cache)
    n = len(neurons)
    ids = pa.array(neurons.bodyId.values)
    idx = pd.Series(np.arange(n), index=neurons.bodyId.values)
    counts = np.zeros((n, len(NT_NAMES)), dtype=np.int64)
    xyz = np.zeros((n, 3), dtype=np.float64)
    r = ipc.open_file(TBAR)
    for i in range(r.num_record_batches):
        b = r.get_batch(i)
        b = b.filter(pc.and_(pc.is_in(b["body"], ids), pc.greater_equal(b["conf"], TBAR_MIN_CONF)))
        if b.num_rows == 0:
            continue
        k = idx[b["body"].to_numpy()].values
        probs = np.stack([b[f"nt_{t}_prob"].to_numpy() for t in NT_NAMES], axis=1)
        np.add.at(counts, (k, probs.argmax(axis=1)), 1)
        for j, c in enumerate("xyz"):
            xyz[:, j] += np.bincount(k, weights=b[c].to_numpy(), minlength=n)
    tot = counts.sum(axis=1)
    df = pd.DataFrame(counts, columns=[f"tbar_{t}" for t in NT_NAMES])
    df["tbar_total"] = tot
    with np.errstate(invalid="ignore", divide="ignore"):
        for j, c in enumerate("xyz"):
            df[f"tbar_{c}"] = xyz[:, j] / tot
    CACHE.mkdir(parents=True, exist_ok=True)
    df.to_parquet(cache)
    return df


def main_rois(neurons: pd.DataFrame, primary: list[str]) -> pd.DataFrame:
    """Per neuron: primary neuropil with the most synapses (pre + post), from neuPrint roiInfo."""
    cache = CACHE / "main_roi.parquet"
    if cache.exists():
        return pd.read_parquet(cache)
    ids = pa.array(neurons.bodyId.values)
    prim = set(primary)
    rows = {}
    r = ipc.open_file(NEURONS)
    for i in range(r.num_record_batches):
        b = r.get_batch(i).select(["bodyId:long", "roiInfo:string"])
        b = b.filter(pc.is_in(b["bodyId:long"], ids))
        for body, info in zip(b["bodyId:long"].to_pylist(), b["roiInfo:string"].to_pylist()):
            best, best_n, total = None, -1, 0
            for roi, s in json.loads(info or "{}").items():
                if roi not in prim:
                    continue
                c = s.get("pre", 0) + s.get("post", 0)
                total += c
                if c > best_n:
                    best, best_n = roi, c
            rows[body] = (best, best_n / total if total else np.nan)
    df = pd.DataFrame(
        [(rows.get(b, (None, np.nan))) for b in neurons.bodyId.values],
        columns=["main_roi", "main_roi_frac"],
    )
    CACHE.mkdir(parents=True, exist_ok=True)
    df.to_parquet(cache)
    return df


def primary_rois() -> list[str]:
    import csv

    csv.field_size_limit(10**9)
    with open(META) as f:
        row = next(csv.DictReader(f))
    return row["primaryRois:string[]"].split(";")


def hops(src: np.ndarray, pre: np.ndarray, post: np.ndarray, n: int, kmax: int) -> np.ndarray:
    A = sp.csr_matrix((np.ones(len(pre), dtype=np.int8), (pre, post)), shape=(n, n))
    AT = A.T.tocsr()
    d = np.full(n, 255, dtype=np.uint8)
    d[src] = 0
    front = np.zeros(n, dtype=bool)
    front[src] = True
    for k in range(1, kmax + 1):
        nxt = (AT @ front.astype(np.int8)) > 0
        nxt &= d == 255
        d[nxt] = k
        front = nxt
        if not front.any():
            break
    return d


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--w-min", type=int, default=11, help="min synapses per connection for the path search")
    ap.add_argument("-k", type=int, default=5, help="max path length input -> output, in hops")
    ap.add_argument("--active", type=Path, help="activity-based selection (07_activity_subnetwork.py): boolean "
                    "mask over all neurons; keeps active neurons that can reach DNa01/DNa02, plus inputs")
    args = ap.parse_args()

    neurons = load_neurons()
    n = len(neurons)
    pre, post, w = load_edges(neurons)
    print(f"neurons {n}, connections {len(w)}, synapses {w.sum()}")

    tb = tbar_stats(neurons)
    roi = main_rois(neurons, primary_rois())
    nt = pd.read_feather(NT).drop_duplicates("body").set_index("body")
    neurons = pd.concat([neurons, tb, roi], axis=1)
    neurons["consensus_nt"] = nt.reindex(neurons.bodyId.values)["consensus_nt"].values

    # Sign rule.
    tot = neurons.tbar_total.replace(0, np.nan)
    frac_shiu = (neurons.tbar_gaba + neurons.tbar_glutamate) / tot
    frac_used = (neurons.tbar_gaba + neurons.tbar_glutamate + neurons.tbar_histamine) / tot
    fallback = neurons.consensus_nt.isin(["gaba", "glutamate", "histamine"])
    neurons["inhibitory_shiu"] = np.where(tot.notna(), frac_shiu > 0.5, fallback)
    neurons["inhibitory"] = np.where(tot.notna(), frac_used > 0.5, fallback)
    neurons["nt_majority"] = np.where(
        tot.notna(),
        np.array(NT_NAMES)[neurons[[f"tbar_{t}" for t in NT_NAMES]].values.argmax(axis=1)],
        neurons.consensus_nt.fillna("unknown"),
    )

    inputs = np.where(neurons.type.isin(INPUT_TYPES))[0]
    outputs = np.where(neurons.type.isin(OUTPUT_TYPES))[0]
    if args.active:
        # Activity-based: neurons that spiked in full-brain runs of game stimuli and can
        # influence the outputs through any path (all connections, unbounded length).
        active = np.load(args.active)
        assert active.shape == (n,)
        df = hops(inputs, pre, post, n, 254)
        db = hops(outputs, post, pre, n, 254)
        on = (active & (db < 255)) | np.isin(np.arange(n), inputs)
    else:
        m = w >= args.w_min
        df = hops(inputs, pre[m], post[m], n, args.k)
        db = hops(outputs, post[m], pre[m], n, args.k)
        on = (df.astype(int) + db.astype(int)) <= args.k
    on[outputs] = True

    keep = np.where(on)[0]
    remap = np.full(n, -1, dtype=np.int64)
    remap[keep] = np.arange(len(keep))
    e = on[pre] & on[post]
    sub = neurons.iloc[keep].reset_index(drop=True)
    sub["hops_from_input"] = df[keep]
    sub["hops_to_output"] = db[keep]
    sub["is_input"] = np.isin(keep, inputs)
    sub["is_output"] = np.isin(keep, outputs)

    insyn = np.bincount(post, weights=w, minlength=n)
    kept_in = np.bincount(post[e], weights=w[e], minlength=n)
    sub["input_syn_total"] = insyn[keep].astype(np.int64)
    sub["input_syn_kept"] = kept_in[keep].astype(np.int64)

    OUT.mkdir(parents=True, exist_ok=True)
    np.savez(OUT / "edges.npz", pre=remap[pre[e]].astype(np.int32), post=remap[post[e]].astype(np.int32), w=w[e])
    sub.to_parquet(OUT / "neurons.parquet")

    # ---- statistics -------------------------------------------------------
    s: dict = {"selection": "activity" if args.active else "paths", "w_min": args.w_min, "k": args.k}
    s["full"] = {"neurons": int(n), "connections": int(len(w)), "synapses": int(w.sum())}
    s["sub"] = {"neurons": int(len(keep)), "connections": int(e.sum()), "synapses": int(w[e].sum())}
    s["inputs"] = {t: int((sub.is_input & (sub.type == t)).sum()) for t in INPUT_TYPES}
    s["outputs"] = [
        {"type": r.type, "side": r.somaSide, "bodyId": int(r.bodyId), "nt": r.nt_majority,
         "inhibitory": bool(r.inhibitory), "hops_from_input": int(r.hops_from_input),
         "input_syn_kept_frac": round(r.input_syn_kept / max(r.input_syn_total, 1), 3)}
        for r in sub[sub.is_output].itertuples()
    ]
    s["min_hops_full_graph"] = {f"{neurons.type[o]}_{neurons.somaSide[o]}": int(df[o]) for o in outputs}
    s["neurons_per_hop_from_input"] = {int(k): int(v) for k, v in sub.hops_from_input.value_counts().sort_index().items()}
    side = sub.somaSide.fillna(sub.rootSide)
    s["side_balance"] = {
        sc: side[sub.superclass == sc].value_counts().to_dict()
        for sc in ["ol_intrinsic", "visual_projection", "cb_intrinsic", "descending_neuron"]
    }
    s["synapses_kept_frac"] = round(w[e].sum() / w.sum(), 4)
    s["median_input_kept_frac"] = round(float(np.median(sub.input_syn_kept / sub.input_syn_total.clip(lower=1))), 3)
    s["superclass"] = sub.superclass.value_counts().to_dict()
    s["main_roi"] = sub.main_roi.fillna("none").value_counts().to_dict()
    s["top_types"] = sub.type.fillna("untyped").value_counts().head(40).to_dict()
    s["n_types"] = int(sub.type.nunique())
    s["nt_majority"] = sub.nt_majority.value_counts().to_dict()
    s["inhibitory_frac"] = round(float(sub.inhibitory.mean()), 3)
    s["sign_vs_shiu_rule_disagreements"] = int((sub.inhibitory != sub.inhibitory_shiu).sum())
    s["sign_disagreements_without_histamine"] = int(
        ((sub.inhibitory != sub.inhibitory_shiu) & (sub.tbar_histamine == 0)).sum()
    )
    s["soma_known"] = int(sub.somaLocation.notna().sum())
    s["max_index_fits_uint16"] = bool(len(keep) <= 65536)
    (OUT / "stats.json").write_text(json.dumps(s, indent=2, ensure_ascii=False))
    print(json.dumps({k: s[k] for k in ["sub", "inputs", "outputs", "neurons_per_hop_from_input",
                                       "synapses_kept_frac", "median_input_kept_frac"]}, indent=1))


if __name__ == "__main__":
    main()
