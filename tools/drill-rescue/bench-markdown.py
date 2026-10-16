"""Markdown tables from bench.mjs JSONL rows.

Usage: python3 bench-markdown.py <file.jsonl> <label> [<label> ...]
Prints one table per label: tier × contacts × camera with mean fps / 1 % low,
frames over 33 ms, median GPU ms (when measured), draw calls and triangles.
"""
import json
import sys

rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
for label in sys.argv[2:]:
    sel = [r for r in rows if r["label"] == label]
    if not sel:
        continue
    print(f"\n**{label}** ({sel[0].get('world', '')}, {sel[0]['vision']})\n")
    print("| Camera | Tier | Contacts | fps mean / 1 % low | > 33 ms | GPU ms median | Draw calls | Triangles |")
    print("|---|---|---|---|---|---|---|---|")
    for r in sel:
        gpu = r.get("gpuMedianMs")
        print(f"| {r['camera']} | {r['tier']} | {r['contacts']} | {r.get('fpsMean')} / {r.get('onePctLowFps')} | {r.get('over33')} | {gpu if gpu is not None else '—'} | {r.get('drawCalls')} | {r.get('triangles'):,} |")
