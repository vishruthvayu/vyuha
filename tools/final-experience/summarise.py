#!/usr/bin/env python3
"""Summarise every recorded repetition; no frame outliers or cases are removed."""
import json,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]/'docs/final-experience'
def read(p):return json.loads((ROOT/p).read_text())
def average(rows,key):
 values=[r[key] for r in rows if r.get(key) is not None]
 return statistics.mean(values) if values else None
comparisons=[]
for category,bpath,apath in [('matrix','baseline/results-matrix.json','after/results-all.json'),('throttle4','baseline/throttle4/results-matrix.json','after/throttle4/results-matrix.json')]:
 before=read(bpath);after=read(apath)
 for world,count in sorted({(r['world'],r['contacts']) for r in before['cases'] if r['type']=='matrix'}):
  b=[r['measurement'] for r in before['cases'] if r['type']=='matrix' and r['world']==world and r['contacts']==count];a=[r['measurement'] for r in after['cases'] if r['type']=='matrix' and r['world']==world and r['contacts']==count]
  assert len(b)==len(a)>0
  row={'category':category,'world':world,'contacts':count,'repeats':len(b),'before':{},'after':{}}
  for key in ['mean_fps','p95_ms','p99_ms','max_ms','mean_draw_calls','script_ms_per_second','task_ms_per_second']:
   row['before'][key]=average(b,key);row['after'][key]=average(a,key)
  row['script_reduction_pct']=(row['before']['script_ms_per_second']-row['after']['script_ms_per_second'])/row['before']['script_ms_per_second']*100
  comparisons.append(row)
for view in ['THERMAL','DAY TV']:
 b=[r for r in read('baseline/closeup-results.json') if r['vision']==view];a=[r for r in read('after/closeup-results.json') if r['vision']==view];assert len(a)==len(b)==3
 assert all(r['canvas']==b[0]['canvas'] for r in b+a),'Pixel dimensions differ'
 row={'category':'closeup','vision':view,'repeats':len(b),'canvas':b[0]['canvas'],'before':{},'after':{}}
 for key in ['mean_fps','p95_ms','p99_ms','max_ms','mean_draw_calls','mean_triangles','script_ms_per_second','gpu_mean_ms','gpu_p95_ms']:
  row['before'][key]=average(b,key);row['after'][key]=average(a,key)
 for key in ['mean_draw_calls','script_ms_per_second','gpu_mean_ms']:
  x,y=row['before'][key],row['after'][key];row[key+'_reduction_pct']=(x-y)/x*100 if x else None
 comparisons.append(row)
(ROOT/'performance-comparison.json').write_text(json.dumps({'aggregation':'Arithmetic mean across all per-run summaries. p95/p99 columns are mean per-run percentiles, not pooled percentiles. Maximums and complete samples remain in raw JSON. No outlier trimming.','comparisons':comparisons},indent=2)+'\n')
lines=['# Browser performance measurements','','All repetitions are retained. Percentiles below are means of per-run percentiles. See the raw receipts for individual maxima and variation. This host used Chromium 141 and the Intel/Mesa ANGLE OpenGL renderer, fixed Medium quality and DPR 1. These are bounded browser measurements, not platform certification.','','## Normal fixed-size benchmark','','| Workload | Before / after FPS | Before / after p99 ms | Before / after script ms/s | Script reduction |','|---|---:|---:|---:|---:|']
for row in comparisons:
 if row['category']=='matrix':
  b,a=row['before'],row['after'];lines.append(f"| {row['world']} / {row['contacts']} configured contacts | {b['mean_fps']:.2f} / {a['mean_fps']:.2f} | {b['p99_ms']:.2f} / {a['p99_ms']:.2f} | {b['script_ms_per_second']:.2f} / {a['script_ms_per_second']:.2f} | {row['script_reduction_pct']:.1f}% |")
lines+=['','## Sensor close-up diagnostic','','The optical canvas was fixed to 1034×400 CSS/device pixels in both sources. Each case runs the real legacy worker and selects the same visible T2 contact through browser input; it is an engineering diagnostic rather than the normal layout. GPU timing uses disjoint timer queries when available. Main optics still renders every display frame; only the sensor-limited close-up texture refresh is capped at 30 Hz, with immediate context invalidation. Its sensor pixel budget and 4× supersampling are unchanged.','','| View | Draw calls/frame before → after | GPU mean ms before → after | GPU reduction | Script ms/s before → after |','|---|---:|---:|---:|---:|']
for r in comparisons:
 if r['category']=='closeup':
  b,a=r['before'],r['after'];gpu=f"{b['gpu_mean_ms']:.3f} → {a['gpu_mean_ms']:.3f}" if b['gpu_mean_ms'] is not None else 'Unavailable';gain=f"{r['gpu_mean_ms_reduction_pct']:.1f}%" if r['gpu_mean_ms_reduction_pct'] is not None else 'Unmeasured';lines.append(f"| {r['vision']} | {b['mean_draw_calls']:.2f} → {a['mean_draw_calls']:.2f} | {gpu} | {gain} | {b['script_ms_per_second']:.2f} → {a['script_ms_per_second']:.2f} |")
lines+=['','## Synthetic CPU constraint','','DevTools 4× **main-thread** CPU throttle, two repeats per world at 200 configured contacts. This does not model an entire low-end device or throttle the server/GPU consistently.','','| Workload | FPS before → after | p95 ms before → after | p99 ms before → after |','|---|---:|---:|---:|']
for r in comparisons:
 if r['category']=='throttle4':
  b,a=r['before'],r['after'];lines.append(f"| {r['world']} | {b['mean_fps']:.2f} → {a['mean_fps']:.2f} | {b['p95_ms']:.2f} → {a['p95_ms']:.2f} | {b['p99_ms']:.2f} → {a['p99_ms']:.2f} |")
lines+=['','FPS near the 60 Hz cap is not evidence of an FPS increase. Script/GPU work reductions represent additional frame budget; rare long frames, shader warm-up, host contention and physical input/display latency remain distinct concerns. EO foundation shading costs one extra static draw batch; unchanged or worse cells are retained above.']
(ROOT/'PERFORMANCE.md').write_text('\n'.join(lines)+'\n')
print(json.dumps(comparisons,indent=2))
