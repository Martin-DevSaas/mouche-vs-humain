"""Download the MaleCNS v1.0 files the pipeline needs into data/raw/ (gitignored).

Source: public bucket gs://flyem-male-cns (Janelia FlyEM, CC-BY 4.0), read over HTTPS.
Sizes are checked against the bucket listing before downloading; files already
present with the right size are skipped. syn-points / syn-partners are never fetched.
"""

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

BUCKET = "flyem-male-cns"
API = f"https://storage.googleapis.com/storage/v1/b/{BUCKET}/o"
PUBLIC = f"https://storage.googleapis.com/{BUCKET}/"
FLAT = "v1.0/connectome-data/flat-connectome/"
ROI_PREFIX = "v1.0/database/dvid-exports/api/node/:v1.0/roisSmoothedDecimated/key/"

FILES = [
    FLAT + "body-annotations-male-cns-v1.0-minconf-0.5.feather",
    FLAT + "body-neurotransmitters-male-cns-v1.0.feather",
    FLAT + "connectome-weights-male-cns-v1.0-minconf-0.5.feather",
    # Per-T-bar NT predictions: needed to apply Shiu et al.'s sign rule exactly
    # (inhibitory iff > 50 % of a neuron's presynaptic sites are GABA/Glu).
    FLAT + "tbar-neurotransmitters-male-cns-v1.0.feather",
    # neuPrint ingestion table: per-neuron roiInfo (synapse counts per neuropil),
    # used to find each neuron's main neuropil without a neuPrint token.
    "v1.0/database/neuprint-inputs/Neuprint_Neurons.feather",
]

RAW = Path(__file__).parent / "data" / "raw"


def list_objects(prefix: str) -> dict[str, int]:
    out: dict[str, int] = {}
    token = None
    while True:
        q = {"prefix": prefix, "fields": "items(name,size),nextPageToken"}
        if token:
            q["pageToken"] = token
        with urllib.request.urlopen(f"{API}?{urllib.parse.urlencode(q)}") as r:
            page = json.load(r)
        for item in page.get("items", []):
            out[item["name"]] = int(item["size"])
        token = page.get("nextPageToken")
        if not token:
            return out


def fetch(name: str, size: int, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size == size:
        print(f"  ok (cached)  {dest.name}")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    url = PUBLIC + urllib.parse.quote(name)
    with urllib.request.urlopen(url) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    if tmp.stat().st_size != size:
        sys.exit(f"size mismatch for {name}")
    tmp.rename(dest)
    print(f"  downloaded   {dest.name} ({size / 1e6:.1f} MB)")


def main() -> None:
    listing: dict[str, int] = {}
    for prefix in {f.rsplit("/", 1)[0] + "/" for f in FILES}:
        listing.update(list_objects(prefix))
    total = sum(listing[f] for f in FILES)
    print(f"connectome files: {total / 1e9:.2f} GB")
    for f in FILES:
        fetch(f, listing[f], RAW / Path(f).name)

    # Per-column / per-layer optic-lobe ROIs (~5 000 files) are not neuropils: skip them.
    rois = {
        n: s for n, s in list_objects(ROI_PREFIX).items()
        if "_col_" not in n and "_layer_" not in n
    }
    print(f"neuropil meshes (roisSmoothedDecimated): {len(rois)} files, {sum(rois.values()) / 1e6:.1f} MB")
    for name, size in rois.items():
        fetch(name, size, RAW / "rois" / Path(name).name)


if __name__ == "__main__":
    main()
