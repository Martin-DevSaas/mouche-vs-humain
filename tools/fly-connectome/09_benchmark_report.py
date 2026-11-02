"""Statistics of the phase-8 benchmark (js/benchmark.ts results).

Inputs : data/bench/bench.jsonl.* (fly games, any number of shards; partial runs are fine)
         data/bench/baseline.jsonl  (a random player in the fly's seat: chance level)
Outputs: data/bench/summary.json
         src/features/fly-connect4/ui/benchmark.json (what the page shows)

Per condition: wins / draws / losses with 95 % Wilson intervals.
"Better than chance?": the fly vs a random player in the same seat against the same
opponent: chi-square on the 2 x 3 table (win/draw/loss) and one-sided Fisher exact test
on wins. Column preference: observed columns vs the columns a uniformly random legal move
would give in the same positions (chi-square goodness of fit).
"""

import glob
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from scipy import stats

HERE = Path(__file__).parent
BENCH = HERE / "data" / "bench"
UI_JSON = HERE.parent.parent / "src" / "features" / "fly-connect4" / "ui" / "benchmark.json"
COLS, ROWS = 7, 6
OPPONENTS = ["random", "minimax1", "minimax3", "minimax5"]
OPP_FR = {"random": "joueur aléatoire", "minimax1": "minimax profondeur 1", "minimax3": "minimax profondeur 3", "minimax5": "minimax profondeur 5"}


def load(pattern: str) -> list[dict]:
    rows = []
    for f in sorted(glob.glob(str(BENCH / pattern))):
        for line in open(f):
            if line.strip():
                rows.append(json.loads(line))
    return rows


def wilson(k: int, n: int, z: float = 1.96) -> list[float]:
    if n == 0:
        return [0.0, 0.0]
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0.0, c - h), 4), round(min(1.0, c + h), 4)]


def wdl(games: list[dict]) -> dict:
    n = len(games)
    w = sum(g["result"] == "win" for g in games)
    d = sum(g["result"] == "draw" for g in games)
    l = n - w - d
    return {
        "n": n, "wins": w, "draws": d, "losses": l,
        "win_rate": round(w / n, 4) if n else None, "win_ci95": wilson(w, n),
        "draw_rate": round(d / n, 4) if n else None,
        "loss_rate": round(l / n, 4) if n else None, "loss_ci95": wilson(l, n),
        "fly_first": {"n": sum(g["flyFirst"] for g in games), "wins": sum(g["flyFirst"] and g["result"] == "win" for g in games)},
        "fly_second": {"n": sum(not g["flyFirst"] for g in games), "wins": sum((not g["flyFirst"]) and g["result"] == "win" for g in games)},
    }


def versus(a: list[dict], b: list[dict]) -> dict:
    """Is `a` (fly) different from / better than `b` (reference)?"""
    ta = [sum(g["result"] == r for g in a) for r in ("win", "draw", "loss")]
    tb = [sum(g["result"] == r for g in b) for r in ("win", "draw", "loss")]
    table = np.array([ta, tb])
    table = table[:, table.sum(0) > 0]
    chi_p = float(stats.chi2_contingency(table)[1]) if table.shape[1] > 1 else 1.0
    fisher_p = float(stats.fisher_exact([[ta[0], len(a) - ta[0]], [tb[0], len(b) - tb[0]]], alternative="greater")[1])
    return {"chi2_p": round(chi_p, 4), "fisher_wins_greater_p": round(fisher_p, 4)}


def column_preference(games: list[dict]) -> dict:
    obs = np.zeros(COLS)
    exp = np.zeros(COLS)
    turned = 0
    moves = 0
    dn_spikes = 0
    fallbacks = 0
    for g in games:
        h = [0] * COLS
        fly_turn = g["flyFirst"]
        k = 0
        for col in g["moves"]:
            if fly_turn:
                legal = [c for c in range(COLS) if h[c] < ROWS]
                for c in legal:
                    exp[c] += 1 / len(legal)
                obs[col] += 1
                m = g["fly"][k]
                k += 1
                moves += 1
                turned += abs(m["final"] - m["init"]) >= 0.5
                dn_spikes += m["dn"]
                fallbacks += m["aimed"] != m["col"]
            h[col] += 1
            fly_turn = not fly_turn
    gof_p = float(stats.chisquare(obs, exp * obs.sum() / exp.sum())[1]) if moves else None
    left, right = obs[:3].sum(), obs[4:].sum()
    eleft, eright = exp[:3].sum(), exp[4:].sum()
    return {
        "moves": int(moves),
        "observed_pct": [round(float(x), 1) for x in 100 * obs / max(1, obs.sum())],
        "expected_random_pct": [round(float(x), 1) for x in 100 * exp / max(1e-9, exp.sum())],
        "chi2_gof_p": round(gof_p, 6) if gof_p is not None else None,
        "left_share": round(float(left / max(1, left + right)), 3),
        "left_share_expected": round(float(eleft / max(1e-9, eleft + eright)), 3),
        "moves_with_turn": round(turned / max(1, moves), 3),
        "mean_dn_spikes_per_move": round(dn_spikes / max(1, moves), 2),
        "fallback_share": round(fallbacks / max(1, moves), 3),
    }


def main() -> None:
    fly = load("bench.jsonl.*")
    base = load("baseline.jsonl")
    by = lambda rows, opp, ctl="none": [g for g in rows if g["opponent"] == opp and g["control"] == ctl]
    out = {"generated": datetime.now(timezone.utc).isoformat(timespec="minutes"), "conditions": [], "controls": []}
    for opp in OPPONENTS:
        f, b = by(fly, opp), by(base, opp)
        if not f:
            continue
        out["conditions"].append({
            "opponent": opp, "label": OPP_FR[opp], "fly": wdl(f), "chance": wdl(b),
            "vs_chance": versus(f, b), "columns": column_preference(f),
        })
    normal = by(fly, "random")
    for ctl, label in [("dna02", "DNa02 silencés"), ("swap", "couleurs des pions inversées")]:
        c = by(fly, "random", ctl)
        if not c:
            continue
        out["controls"].append({
            "control": ctl, "label": label, "opponent": "random", "fly": wdl(c),
            "vs_normal_fly": versus(normal, c) if normal else None,
            "vs_chance": versus(c, by(base, "random")), "columns": column_preference(c),
        })
    planned = 200 * (len(OPPONENTS) + 2)
    out["progress"] = {"games": len(fly), "planned": planned}
    BENCH.mkdir(parents=True, exist_ok=True)
    (BENCH / "summary.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    UI_JSON.write_text(json.dumps(out, ensure_ascii=False) + "\n")
    for c in out["conditions"]:
        print(c["opponent"], "n", c["fly"]["n"], "W/D/L", c["fly"]["wins"], c["fly"]["draws"], c["fly"]["losses"],
              "| chance win", c["chance"]["win_rate"], "| p", c["vs_chance"], "| left", c["columns"]["left_share"], "vs", c["columns"]["left_share_expected"])
    for c in out["controls"]:
        print(c["control"], "n", c["fly"]["n"], "W/D/L", c["fly"]["wins"], c["fly"]["draws"], c["fly"]["losses"], c["vs_normal_fly"])
    print("progress", out["progress"])


if __name__ == "__main__":
    main()
