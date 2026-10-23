# Rejected experiment — not production code

A compiled FBM lattice reproduced every tested reference sample exactly across 16/512/1024 grids and three procedural noise fields. However, the Node microbenchmark at the actual 1024 resolution was slower after counting setup: approximately 65.6+2.0 versus59.4 ms;44.6+2.2 versus40.9 ms;44.4+8.7 versus40.7 ms. These are single-run local CPU observations, not a browser or device qualification.

**Rejected for integration.** Extra scratch-memory/lookup overhead and no demonstrated speed benefit do not justify replacing the existing FBM kernel. `splat-noise-prototype.ts` is retained solely as a research artifact; its relative terrain import refers to the existing reference implementation under client/src/world. No production import, dependency or scoring change.
