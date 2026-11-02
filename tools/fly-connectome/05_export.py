"""Export the subnetwork to compact binary assets in public/fly-brain/v1/.

Files (all little-endian; byte layout recorded in meta.json):
  network.bin   CSR adjacency, rows = presynaptic neuron
                  offsets  Uint32[n + 1]
                  targets  Uint16[m]    postsynaptic neuron index (n <= 65 536)
                  weights  Int16[m]     signed synapse count (sign from the presynaptic neuron)
  neurons.bin   per-neuron arrays, each starting at a 4-byte aligned offset
                  position Float32[3n]  micrometres; soma if known, else T-bar centroid
                  bodyId   Uint32[n]    MaleCNS v1.0 body id
                  type     Uint16[n]    index into meta.types
                  superclass, side, roi, nt, flags, hops   Uint8[n]
                  hex1, hex2   Int8[n]  input column (-1 if not an input)
  meta.json     dictionaries, layout, outputs, defaults, stats, attribution
  neuropils.glb meshopt-compressed neuropil meshes (from 04_meshes.py)
  columns.json  optic-lobe columns (eye, hex p/q, azimuth/elevation in degrees) from 03_visual_mapping.py
Every file also gets a .gz twin (gzip -9) for nginx gzip_static.

Neurons are ordered by main neuropil, then type, so each neuropil is a contiguous
index range (meta.rois[i].start / count).
"""

import gzip
import json
import shutil
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
SUB = HERE / "data" / "subnet"
VIS = HERE / "data" / "visual"
MESH = HERE / "data" / "meshes"
DEST = HERE.parent.parent / "public" / "fly-brain" / "v1"

VOXEL_UM = 0.008
SIDES = ["L", "R", "M", "?"]
FLAG_INPUT, FLAG_OUTPUT, FLAG_INHIBITORY, FLAG_SOMA = 1, 2, 4, 8

# Shiu et al. 2024, model.py (github.com/philshiu/Drosophila_brain_model, MIT).
SHIU_PARAMS = {
    "v_rest_mV": -52.0, "v_reset_mV": -52.0, "v_threshold_mV": -45.0,
    "tau_membrane_ms": 20.0, "tau_synapse_ms": 5.0, "refractory_ms": 2.2,
    "synaptic_delay_ms": 1.8, "w_syn_mV": 0.275, "poisson_rate_Hz": 150.0,
    "poisson_weight_factor": 250, "dt_ms": 0.1,
}


def aligned(chunks: list[tuple[str, np.ndarray]]) -> tuple[bytes, dict]:
    out, layout, off = bytearray(), {}, 0
    for name, arr in chunks:
        pad = (-off) % 4
        out += b"\0" * pad
        off += pad
        b = np.ascontiguousarray(arr).astype(arr.dtype.newbyteorder("<")).tobytes()
        layout[name] = {"offset": off, "length": int(arr.size), "dtype": arr.dtype.name}
        out += b
        off += len(b)
    return bytes(out), layout


def main() -> None:
    sub = pd.read_parquet(SUB / "neurons.parquet")
    e = np.load(SUB / "edges.npz")
    stats = json.loads((SUB / "stats.json").read_text())
    vis = pd.read_parquet(VIS / "inputs.parquet")
    vstats = json.loads((VIS / "stats.json").read_text())
    neuropils = json.loads((MESH / "neuropils.json").read_text())

    # Order: main neuropil, then type, then body id.
    sub["type"] = sub.type.fillna("untyped")
    rois = sorted(sub.main_roi.unique())
    order = sub.assign(_r=sub.main_roi.map({r: i for i, r in enumerate(rois)})) \
        .sort_values(["_r", "type", "bodyId"]).index.values
    new = np.empty(len(sub), dtype=np.int64)
    new[order] = np.arange(len(sub))
    sub = sub.loc[order].reset_index()  # keeps old position in "index"
    n = len(sub)
    assert n <= 65536

    pre, post = new[e["pre"]], new[e["post"]]
    sign = np.where(sub.inhibitory.values, -1, 1)
    w = (e["w"] * sign[pre]).astype(np.int16)
    o = np.lexsort((post, pre))
    pre, post, w = pre[o], post[o], w[o]
    offsets = np.zeros(n + 1, dtype=np.uint32)
    np.cumsum(np.bincount(pre, minlength=n), out=offsets[1:])
    net_bytes, net_layout = aligned([
        ("offsets", offsets), ("targets", post.astype(np.uint16)), ("weights", w),
    ])

    # Positions: soma when known, else T-bar centroid.
    soma = sub.somaLocation.apply(lambda p: p if p is not None and len(p) == 3 else None)
    has_soma = soma.notna().values
    xyz = np.where(
        has_soma[:, None],
        np.stack([np.asarray(p, float) if p is not None else np.zeros(3) for p in soma]),
        sub[["tbar_x", "tbar_y", "tbar_z"]].values,
    ) * VOXEL_UM

    types = sorted(sub.type.unique())
    superclasses = sorted(sub.superclass.unique())
    nts = sorted(sub.nt_majority.unique())
    side = sub.somaSide.fillna(sub.rootSide).map({s: i for i, s in enumerate(SIDES)}).fillna(SIDES.index("?"))
    flags = (sub.is_input.values * FLAG_INPUT | sub.is_output.values * FLAG_OUTPUT
             | sub.inhibitory.values * FLAG_INHIBITORY | has_soma * FLAG_SOMA).astype(np.uint8)
    hexmap = vis.set_index("sub_index")
    hex1 = sub["index"].map(hexmap.hex1).fillna(-1).astype(np.int8).values
    hex2 = sub["index"].map(hexmap.hex2).fillna(-1).astype(np.int8).values

    neu_bytes, neu_layout = aligned([
        ("position", xyz.astype(np.float32).ravel()),
        ("bodyId", sub.bodyId.values.astype(np.uint32)),
        ("type", sub.type.map({t: i for i, t in enumerate(types)}).values.astype(np.uint16)),
        ("superclass", sub.superclass.map({s: i for i, s in enumerate(superclasses)}).values.astype(np.uint8)),
        ("side", side.values.astype(np.uint8)),
        ("roi", sub.main_roi.map({r: i for i, r in enumerate(rois)}).values.astype(np.uint8)),
        ("nt", sub.nt_majority.map({t: i for i, t in enumerate(nts)}).values.astype(np.uint8)),
        ("flags", flags),
        ("hops", sub.hops_from_input.values.astype(np.uint8)),
        ("hex1", hex1), ("hex2", hex2),
    ])

    roi_ranges = sub.groupby("main_roi", sort=False).apply(lambda g: (int(g.index.min()), len(g)))
    mesh_names = {m["name"] for m in neuropils}
    outputs = {
        f"{r.type}_{r.somaSide}": int(i) for i, r in sub[sub.is_output].iterrows()
    }
    meta = {
        "format": "fly-brain/v1",
        "dataset": "MaleCNS v1.0 (Janelia FlyEM et al.)",
        "license": "CC-BY 4.0",
        "attribution": "Berg et al., Sexual dimorphism in the complete connectome of the Drosophila "
                       "male central nervous system, Cell 189 (2026), doi:10.1016/j.cell.2026.08.015",
        "counts": {"neurons": n, "connections": int(len(w)), "synapses": int(np.abs(w.astype(np.int64)).sum())},
        "files": {
            "network.bin": {"bytes": len(net_bytes), "layout": net_layout},
            "neurons.bin": {"bytes": len(neu_bytes), "layout": neu_layout},
            "neuropils.glb": {"units": "micrometre"},
        },
        "flags": {"input": FLAG_INPUT, "output": FLAG_OUTPUT, "inhibitory": FLAG_INHIBITORY, "soma": FLAG_SOMA},
        "sides": SIDES,
        "types": types,
        "superclasses": superclasses,
        "nts": nts,
        "rois": [
            {"name": r, "start": roi_ranges[r][0], "count": roi_ranges[r][1], "mesh": r in mesh_names}
            for r in rois
        ],
        "meshes": [m["name"] for m in neuropils],
        "outputs": outputs,
        "input_types": ["L1", "L2", "L3"],
        "sign_rule": "inhibitory iff > 50 % of a neuron's T-bars are predicted GABA, glutamate or histamine "
                     "(Shiu et al. 2024 rule, histamine added)",
        "selection": {"w_min": stats["w_min"], "k": stats["k"]},
        "model_defaults": SHIU_PARAMS,
        "stats": {
            "subnetwork": stats["sub"],
            "full": stats["full"],
            "outputs": stats["outputs"],
            "columns_per_eye": vstats["columns_per_eye"],
        },
    }

    cols = pd.read_parquet(VIS / "columns.parquet").sort_values(["eye", "hex1", "hex2"])
    columns = {
        "source": "03_visual_mapping.py: hex lattice oriented with MaleCNS anatomy, Zhao et al. 2025 field of view",
        "eye": cols.eye.tolist(),
        "p": cols.hex1.astype(int).tolist(),
        "q": cols.hex2.astype(int).tolist(),
        "az": cols.azimuth_deg.round(3).tolist(),
        "el": cols.elevation_deg.round(3).tolist(),
        "dphi_deg": {e: round(float(g.dphi_deg.iloc[0]), 3) for e, g in cols.groupby("eye")},
    }

    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / "columns.json").write_text(json.dumps(columns, separators=(",", ":")))
    (DEST / "network.bin").write_bytes(net_bytes)
    (DEST / "neurons.bin").write_bytes(neu_bytes)
    (DEST / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
    shutil.copy(MESH / "neuropils.glb", DEST / "neuropils.glb")
    total_raw = total_gz = 0
    for f in ["network.bin", "neurons.bin", "meta.json", "neuropils.glb", "columns.json"]:
        data = (DEST / f).read_bytes()
        gz = gzip.compress(data, compresslevel=9, mtime=0)
        (DEST / f"{f}.gz").write_bytes(gz)
        total_raw += len(data)
        total_gz += len(gz)
        print(f"  {f:15s} {len(data) / 1e6:6.2f} MB  gzip {len(gz) / 1e6:6.2f} MB")
    print(f"  total           {total_raw / 1e6:6.2f} MB  gzip {total_gz / 1e6:6.2f} MB")


if __name__ == "__main__":
    main()
