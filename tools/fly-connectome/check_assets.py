"""Re-read public/fly-brain/v1 from meta.json alone and check it against the pipeline outputs."""

import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
DEST = HERE.parent.parent / "public" / "fly-brain" / "v1"


def read(path: Path, layout: dict) -> dict[str, np.ndarray]:
    buf = path.read_bytes()
    return {k: np.frombuffer(buf, dtype=np.dtype(v["dtype"]).newbyteorder("<"), count=v["length"], offset=v["offset"])
            for k, v in layout.items()}


def main() -> None:
    meta = json.loads((DEST / "meta.json").read_text())
    net = read(DEST / "network.bin", meta["files"]["network.bin"]["layout"])
    neu = read(DEST / "neurons.bin", meta["files"]["neurons.bin"]["layout"])
    n, m = meta["counts"]["neurons"], meta["counts"]["connections"]
    sub = pd.read_parquet(HERE / "data/subnet/neurons.parquet")
    e = np.load(HERE / "data/subnet/edges.npz")

    assert len(net["offsets"]) == n + 1 and net["offsets"][-1] == m == len(e["w"])
    assert np.all(np.diff(net["offsets"].astype(np.int64)) >= 0)
    assert int(np.abs(net["weights"].astype(np.int64)).sum()) == int(e["w"].sum())
    # Same edge multiset, keyed by body ids.
    pre_idx = np.repeat(np.arange(n), np.diff(net["offsets"].astype(np.int64)))
    body = neu["bodyId"].astype(np.int64)
    a = pd.DataFrame({"pre": body[pre_idx], "post": body[net["targets"]], "w": np.abs(net["weights"])})
    sb = sub.bodyId.values
    b = pd.DataFrame({"pre": sb[e["pre"]], "post": sb[e["post"]], "w": e["w"]})
    assert a.sort_values(["pre", "post"]).values.tolist() == b.sort_values(["pre", "post"]).values.tolist()
    # Signs follow the presynaptic neuron's inhibitory flag.
    inh = (neu["flags"] & meta["flags"]["inhibitory"]) > 0
    assert np.all((net["weights"] < 0) == inh[pre_idx])
    # Outputs and ROI ranges.
    types = np.array(meta["types"])[neu["type"]]
    for k, i in meta["outputs"].items():
        assert types[i] == k.split("_")[0], k
    for r in meta["rois"]:
        assert np.all(neu["roi"][r["start"]:r["start"] + r["count"]] == meta["rois"].index(r))
    inputs = (neu["flags"] & meta["flags"]["input"]) > 0
    assert set(types[inputs]) == {"L1", "L2", "L3"} and np.all(neu["hex1"][inputs] >= 0)
    pos = neu["position"].reshape(-1, 3)
    print("OK", {"neurons": n, "connections": m, "inputs": int(inputs.sum()),
                "inhibitory_frac": round(float(inh.mean()), 3),
                "pos_min_um": pos.min(0).round(1).tolist(), "pos_max_um": pos.max(0).round(1).tolist()})

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import trimesh

    scene = trimesh.load(DEST.parent.parent.parent / "tools/fly-connectome/data/meshes/neuropils-raw.glb")
    fig, ax = plt.subplots(figsize=(12, 7), dpi=110)
    for name, g in scene.geometry.items():
        if "shell" in name:
            continue
        v = g.vertices
        ax.scatter(v[::7, 0], v[::7, 1], s=0.05, c="#9bb", alpha=0.25)
    sc = np.array(meta["superclasses"])[neu["superclass"]]
    for s, col in [("ol_intrinsic", "#3b82f6"), ("visual_projection", "#10b981"), ("cb_intrinsic", "#f59e0b"),
                   ("descending_neuron", "#ef4444")]:
        k = sc == s
        ax.scatter(pos[k, 0], pos[k, 1], s=0.3, c=col, label=f"{s} ({k.sum()})")
    for k, i in meta["outputs"].items():
        ax.scatter(*pos[i, :2], s=80, marker="*", c="k")
        ax.annotate(k, pos[i, :2], fontsize=8)
    ax.invert_yaxis()
    ax.set_aspect("equal")
    ax.legend(markerscale=12, fontsize=8, loc="lower right")
    ax.set_title("MaleCNS v1.0 visuo-motor subnetwork (front view, x/y in µm)")
    out = HERE / "data" / "check_assets.png"
    fig.savefig(out, bbox_inches="tight")
    print("preview:", out)


if __name__ == "__main__":
    main()
