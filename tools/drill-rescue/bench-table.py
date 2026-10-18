import json, sys
for f in sys.argv[1:]:
    rows=[json.loads(l) for l in open(f)]
    print('\n##', f, len(rows))
    print(f"{'camera':9s}{'tier':7s}{'n':>4s} {'appFPS':>7s} {'mean':>6s} {'p95ms':>6s} {'p99ms':>6s} {'max':>7s} {'1%low':>6s} {'>33':>4s} {'calls':>6s} {'tris':>8s} {'heapMB':>12s}")
    for r in rows:
        print(f"{r['camera']:9s}{r['tier']:7s}{r['contacts']:>4d} {str(r.get('appMedianFps')):>7s} {r.get('fpsMean',0):>6} {r.get('p95Ms',0):>6} {r.get('p99Ms',0):>6} {r.get('maxMs',0):>7} {r.get('onePctLowFps',0):>6} {r.get('over33',0):>4} {str(r.get('drawCalls')):>6s} {r.get('triangles',0):>8} {str(r.get('heapStartMB'))+'→'+str(r.get('heapEndMB')):>12s}")
