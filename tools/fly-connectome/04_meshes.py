"""Neuropil meshes -> one decimated, meshopt-compressed GLB (one named node per neuropil).

Source: MaleCNS v1.0 ROI meshes (dvid roisSmoothedDecimated, OBJ in 8 nm voxel
units), i.e. the same meshes neuPrint serves with fetch_roi_mesh, so they share
the coordinate space of the neurons. Output coordinates are in micrometres
(voxel * 0.008), the unit 05_export.py uses for neuron positions.

Kept: every primary brain neuropil of neuPrint (both sides), plus the brain
shell and the VNC neuropil shell as context. Node name = neuPrint ROI name.
"""

import csv
import json
import subprocess
from pathlib import Path

import fast_simplification
import numpy as np
import trimesh

HERE = Path(__file__).parent
RAW = HERE / "data" / "raw"
OUT = HERE / "data" / "meshes"
REPO = HERE.parent.parent

VOXEL_UM = 0.008
SHELLS = {"brain-shell": 12000, "vnc-neuropil-shell": 8000}
GLTFPACK = "gltfpack@0.24.0"


def brain_primary_rois() -> list[str]:
    csv.field_size_limit(10**9)
    with open(RAW / "Neuprint_Meta.csv") as f:
        prim = next(csv.DictReader(f))["primaryRois:string[]"].split(";")
    # neuPrint lists brain neuropils first, then the *-unspecified ROIs, then the VNC.
    return prim[: prim.index("CentralBrain-unspecified")]


def target_faces(n_faces: int) -> int:
    return int(np.clip(n_faces * 0.05, 300, 4000))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    scene = trimesh.Scene()
    info = []
    names = brain_primary_rois() + list(SHELLS)
    for name in names:
        src = RAW / "rois" / name
        if not src.exists():
            print(f"  missing mesh: {name}")
            continue
        m = trimesh.load(src, file_type="obj", force="mesh", process=True)
        target = SHELLS.get(name, target_faces(len(m.faces)))
        v, f = fast_simplification.simplify(
            m.vertices.astype(np.float32), m.faces.astype(np.int32),
            target_reduction=max(0.0, 1 - target / len(m.faces)),
        )
        d = trimesh.Trimesh(v * VOXEL_UM, f, process=True)
        d.fix_normals()
        scene.add_geometry(d, node_name=name, geom_name=name)
        info.append({
            "name": name,
            "faces_raw": int(len(m.faces)),
            "faces": int(len(d.faces)),
            "centroid_um": [round(float(x), 2) for x in d.centroid],
            "volume_um3": round(float(abs(d.volume)), 1) if d.is_watertight else None,
        })
    raw_glb = OUT / "neuropils-raw.glb"
    scene.export(raw_glb)
    packed = OUT / "neuropils.glb"
    # -cc: meshopt compression (decoded in the browser by three's MeshoptDecoder); -kn: keep named nodes.
    subprocess.run(["npx", "-y", GLTFPACK, "-i", str(raw_glb), "-o", str(packed), "-cc", "-kn", "-vp", "14"],
                   check=True, cwd=REPO)
    (OUT / "neuropils.json").write_text(json.dumps(info, indent=1))
    print(f"{len(info)} meshes, {sum(i['faces'] for i in info)} faces, "
          f"raw {raw_glb.stat().st_size / 1e6:.2f} MB -> packed {packed.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
