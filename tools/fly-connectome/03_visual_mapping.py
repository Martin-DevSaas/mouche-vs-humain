"""Assign an optic-lobe hex column (eye, hex1, hex2) to every input neuron (L1, L2, L3).

Most inputs carry assignedOlHex1/2 in the MaleCNS annotations (Nern et al. 2025
column system). Left L3 cells do not. For any input without a column we take a
synaptic vote: the column of its hex-assigned postsynaptic partners (same side),
weighted by synapse count. The vote is validated on inputs whose column is known
(reported as exact-match and neighbour-match rates).

Visual direction of each column (phase 3). MaleCNS has no measured eye map, so a
regular hexagonal lattice is laid on the sphere and oriented with this fly's anatomy:
  - h ~ p - q and v ~ p + q (Nern et al. 2025 / Zhao et al. 2025 convention); in both
    optic lobes the medulla's posterior axis follows p - q and its dorsal axis p + q.
  - dorsal = high p + q: the dorsal-rim photoreceptors R7d/R8d target columns with
    p + q ~ 64 (all columns: ~39).
  - anterior = high p - q: high p - q columns are posterior in the medulla, and the
    outer optic chiasm swaps anterior and posterior between lamina and medulla.
  - lattice: neighbours (1,0), (0,1) at +-60 deg of vertical, (1,1) vertical.
  - spacing dPhi: the columns of each eye tile the field of view measured by
    Zhao et al. 2025 (elevation -70..+90 deg, azimuth from ~10 deg contralateral to
    155 deg), i.e. sqrt(solid angle / (n_columns * sqrt(3)/2)).
  - equator: splits the columns into two equal halves (Zhao et al. 2025, Fig. 3).
  - median frontal edge of the eye at FRONT_DEG into the contralateral hemifield
    (binocular overlap < 20 deg, Zhao et al. 2025); azimuth steps grow as 1/cos(el).
Azimuth > 0 is to the fly's right; elevation > 0 is up.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
RAW = HERE / "data" / "raw"
CACHE = HERE / "data" / "cache"
SUB = HERE / "data" / "subnet"
OUT = HERE / "data" / "visual"

ANN = RAW / "body-annotations-male-cns-v1.0-minconf-0.5.feather"


FRONT_DEG = 8.0  # median frontal edge: binocular overlap ~17 deg near the equator (< 20 deg, Zhao et al. 2025)
FOV_AZ = (-10.0, 155.0)  # Zhao et al. 2025, ipsilateral-positive azimuth
FOV_EL = (-70.0, 90.0)


def column_directions(cols: pd.DataFrame) -> pd.DataFrame:
    """cols: one row per (eye, hex1, hex2). Adds dphi_deg, azimuth_deg, elevation_deg."""
    out = []
    for eye, g in cols.groupby("eye"):
        g = g.copy()
        p, q = g.hex1.values, g.hex2.values
        x = (p - q) * np.sqrt(3) / 2  # +h: anterior, in units of dPhi
        y = (p + q) / 2  # +v: dorsal
        omega = np.deg2rad(FOV_AZ[1] - FOV_AZ[0]) * (np.sin(np.deg2rad(FOV_EL[1])) - np.sin(np.deg2rad(FOV_EL[0])))
        dphi = np.rad2deg(np.sqrt(omega / (len(g) * np.sqrt(3) / 2)))
        el = (y - np.median(y)) * dphi
        # Frontal edge as a smooth function of elevation: rolling MEAN of the rows' frontal
        # columns over an even number of rows. Adjacent rows (p + q even / odd) sit half a
        # column apart; a mean does not snap to either, so that offset is preserved (a
        # rolling median picked one row's own value and erased it in places).
        rows = pd.Series(x).groupby(p + q).max()
        edge = rows.rolling(8, center=True, min_periods=1).mean()
        x_front = edge.reindex(p + q).values
        cos_el = np.clip(np.cos(np.deg2rad(el)), 0.2, 1.0)
        az_ipsi = -FRONT_DEG + (x_front - x) * dphi / cos_el  # ipsilateral-positive
        g["dphi_deg"] = dphi
        g["elevation_deg"] = el
        g["azimuth_deg"] = az_ipsi if eye == "R" else -az_ipsi
        out.append(g)
    return pd.concat(out)


def hex_distance(a1, a2, b1, b2):
    # Columns use two oblique hex axes; distance on an axial hex grid.
    d1, d2 = a1 - b1, a2 - b2
    return np.maximum(np.abs(d1), np.maximum(np.abs(d2), np.abs(d1 - d2)))


def main() -> None:
    full = pd.read_feather(ANN)
    full = full[full.superclass.notna()].reset_index(drop=True)
    side = full.somaSide.fillna(full.rootSide).values
    hex1, hex2 = full.assignedOlHex1.values, full.assignedOlHex2.values
    e = np.load(CACHE / "edges_neurons.npz")
    pre, post, w = e["pre"], e["post"], e["w"]

    sub = pd.read_parquet(SUB / "neurons.parquet")
    pos = pd.Series(np.arange(len(full)), index=full.bodyId.values)
    inputs = sub[sub.is_input]
    gidx = pos[inputs.bodyId.values].values

    # Synaptic vote over hex-assigned, same-side postsynaptic partners.
    m = np.isin(pre, gidx) & ~np.isnan(hex1[post]) & (side[pre] == side[post])
    votes = pd.DataFrame({"pre": pre[m], "h1": hex1[post[m]], "h2": hex2[post[m]], "w": w[m]})
    best = (
        votes.groupby(["pre", "h1", "h2"]).w.sum().reset_index()
        .sort_values("w", ascending=False).drop_duplicates("pre").set_index("pre")
    )

    rows = []
    for sub_i, g in zip(inputs.index, gidx):
        known = not np.isnan(hex1[g])
        v = best.loc[g] if g in best.index else None
        rows.append({
            "sub_index": int(sub_i),
            "bodyId": int(full.bodyId[g]),
            "type": full.type[g],
            "eye": side[g],
            "hex1": hex1[g] if known else (v.h1 if v is not None else np.nan),
            "hex2": hex2[g] if known else (v.h2 if v is not None else np.nan),
            "source": "dataset" if known else ("synaptic_vote" if v is not None else "none"),
            "vote_h1": v.h1 if v is not None else np.nan,
            "vote_h2": v.h2 if v is not None else np.nan,
        })
    df = pd.DataFrame(rows)

    known = df[df.source == "dataset"].dropna(subset=["vote_h1"])
    d = hex_distance(known.hex1, known.hex2, known.vote_h1, known.vote_h2)
    val = {
        t: {
            "n": int((known.type == t).sum()),
            "exact": round(float((d[known.type == t] == 0).mean()), 3),
            "within_1": round(float((d[known.type == t] <= 1).mean()), 3),
        }
        for t in ["L1", "L2", "L3"]
    }
    summary = {
        "inputs": int(len(df)),
        "by_source": df.source.value_counts().to_dict(),
        "by_eye_type": {f"{k[0]}_{k[1]}": int(v) for k, v in df.groupby(["eye", "type"]).size().items()},
        "vote_validation_on_known_columns": val,
        "columns_per_eye": df.dropna(subset=["hex1"]).groupby("eye")
        .apply(lambda g: int(len(set(zip(g.hex1, g.hex2))))).to_dict(),
    }
    cols = column_directions(df.dropna(subset=["hex1"])[["eye", "hex1", "hex2"]].drop_duplicates())
    df = df.merge(cols, on=["eye", "hex1", "hex2"], how="left")
    summary["directions"] = {
        eye: {
            "dphi_deg": round(float(g.dphi_deg.iloc[0]), 3),
            "azimuth_range_deg": [round(float(g.azimuth_deg.min()), 1), round(float(g.azimuth_deg.max()), 1)],
            "elevation_range_deg": [round(float(g.elevation_deg.min()), 1), round(float(g.elevation_deg.max()), 1)],
        }
        for eye, g in cols.groupby("eye")
    }
    OUT.mkdir(parents=True, exist_ok=True)
    cols.to_parquet(OUT / "columns.parquet")
    df.drop(columns=["vote_h1", "vote_h2"]).to_parquet(OUT / "inputs.parquet")
    (OUT / "stats.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
