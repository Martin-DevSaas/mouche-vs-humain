#!/bin/bash
# Full phase-8 benchmark, resumable. Usage: run-benchmark.sh <shard> <shards>
# Runs at the lowest CPU priority; results are appended to data/bench/bench.jsonl.
set -u
cd "$(dirname "$0")/../../.."
OUT=tools/fly-connectome/data/bench/bench.jsonl
SHARD=$1; SHARDS=$2
run() { nice -n 19 npx tsx tools/fly-connectome/js/benchmark.ts "$OUT.$SHARD" "$@" --shard "$SHARD/$SHARDS"; }
for opp in random minimax1 minimax3 minimax5; do run "$opp" 200; done
run random 200 --control dna02
run random 200 --control swap
echo "shard $SHARD done $(date -Is)"
