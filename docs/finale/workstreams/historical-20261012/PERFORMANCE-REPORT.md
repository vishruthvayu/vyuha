# Measured Finale performance — 12 October 2026

Actual workstation: MacBook Air, Apple M1,8GB RAM, macOS27.0.1, Codex in-app Chromium155. General hardware was read with system_profiler; no serial IDs retained. Five actual20-second WebGL/worker runs used engine0.4, Medium fixed tier, auto quality OFF, thermal trainee camera. The synthetic fixture spawns contacts together and exercises Sensor Truth; it is not a solvable Raid Composer exercise or a requirement to render every hidden contact as geometry.

| Contacts | Median WebGL FPS | Median tick ms | p95 tick ms |
| --- | --- | --- | --- |
| 8 | 60 | 0.300 | 0.500 |
| 25 | 60 | 0.700 | 1.300 |
| 50 | 60 | 1.600 | 5.300 |
| 100 | 60 | 2.300 | 3.400 |
| 200 | 60 | 3.500 | 5.300 |

Raw samples and browser metadata are in BENCHMARK-20261012.json. This validates this workload on one physical laptop through the desktop browser. It is not Android, native Windows/Linux, full Crew concurrency, endurance/memory certification or training efficacy. Historical device measurements are separately versioned.

The worker advances30Hz with at most five catch-up ticks, drops excess stall wall time and suspends hidden tabs; scoring fidelity is unchanged. Crew advances a shared logical engine on connected client polling, caps long stalls and pauses after durable-cache recovery. White Cell cache is bounded and input-addressed. Actual six-client HTTP completion load and isolated-process browser recovery are now recorded below. Wider endurance/memory/interaction acceptance remains open. Production build retains a large Three.js chunk warning.

Actual server reconstruction throughput: six synthetic HTTP completions concurrently, 5.231s total, individual completion 4745.48–5213.34ms. A 200-contact roster took 27,381.25ms; actual browser AAR showed Server verified and 200 selectable/scored rows. A 120-second reconstruction request budget avoids the former six-second false timeout while tactical controls retain their original request budget. See RUNTIME-LOAD-RECEIPT.json; workload is 197 neutral birds/three hostiles, not 200 hostile targets. No endurance/memory or physical-client scale result is inferred.

Current optimization and longer workload are in RECONSTRUCTION-PROFILE-RECEIPT.json and ENDURANCE-BROWSER-20261012.json. Complete review/card equivalence was checked, all453backend/132frontend tests passed, and logical scoring remains unchanged. In the180s browser run5376ticks advanced (179.2 logical seconds), median60FPS, worker median4.4/p9510.3ms. Main-page heap ranged14,279,915–102,781,872 bytes with collection observed; these samples exclude Worker/GPU/total-process memory. No zero-stall, leak-free or operational capacity claim is supported.

## Cycle 2 paired reconstruction measurements

Profiling identified repeated memory deep copies inside Sensor Truth reconstruction. The optimized internal scalar-memory path copies its containers directly; unknown, nested or extended schemas retain the deep-copy fallback. Public validation and mutable-input/output isolation remain intact. Complete review and scorecard hashes match before/after at 8, 25, 50, 100 and 200 contacts.

The paired runner uses a 60-second / 1,800-tick workload, three alternating direct and real HTTP samples per size. At 200 contacts, direct medians were **9.670718 → 7.141739 seconds** and HTTP medians **9.753084 → 7.382451 seconds**. Shared-workstation background load varied. These are reconstruction latencies, not render FPS or certified capacity. The final button styling change does not alter the measured backend. See RECONSTRUCTION-CYCLE2-RECEIPT.json; raw profiles are retained outside Git.

The separate cProfile samples show recursive `deepcopy` cumulative cost20.462s in the before profile; after optimization, `_optical_observation` is the largest remaining sensor component at10.642s. Total profiled review time was38.915s→23.866s; instrumentation overhead prevents treating these as unprofiled latencies. The eight-contact direct median worsened0.4565s→0.5347s, so the data does not establish a universal speedup. Optical likelihood calibration and wider performance measurements remain separate future work.
