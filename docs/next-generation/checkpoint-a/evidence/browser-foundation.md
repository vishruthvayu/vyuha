# Foundation browser receipt

Production localhost QA on macOS/M1, disposable database; runtime hash is in the exported timing JSON, working source explicitly dirty. Registry desktop at 1440 × 900 CSS and mobile at 375 × 812, scale 1. Mobile document width 375; evidence table scrolls locally (client 307, scroll 667, keyboard ArrowRight moved to 40 with focus retained). Screenshots retained.

Initial timing export exposed double JSON encoding, missing Benchmark phase/worker wiring and dependence on a throttled stop timer. These were corrected before the foundation commit. Initial capture is retained as defect evidence, **not a performance qualification result**. No matched cold/warm or retained-200 improvement is claimed. Corrected export and full curriculum browser acceptance remain required.
