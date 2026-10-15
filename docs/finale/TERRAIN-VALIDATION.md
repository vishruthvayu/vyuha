# SC07 — urban and rural terrain proof

This is software/model evidence for urban and rural training environments. It is not a surveyed GIS model, measured sensor calibration or physical field validation.

The implemented authoring control is **Exercise studio → Finale Raid Composer → Terrain** (`/exercises#raid-composer`). After officer sign-in, choose `urban` or `rural`, preview and compile a frozen raid. Open it from the training library; verify that the frozen scenario and observation setting identify the chosen terrain. Changes to an authored draft do not mutate a previously saved scenario.

Source: `server/raid_v2.py` compiles terrain selections and boxes; `server/sensors_v2.py` evaluates terrain line of sight and observation consequences. Matching client contracts are `client/src/raid-v2.ts`, `client/src/sensors-v2.ts` and `client/src/Scene.tsx`. `client/src/RaidStudio.tsx` exposes the terrain selector; it does not fabricate live observations. Camera presentation does not override sensor visibility or scoring.

Reproduce the deterministic contracts from the repository root:

```sh
.venv/bin/python -m pytest server/tests/test_sensors_v2.py server/tests/test_raid_v2.py -q
cd client
node --import tsx --test src/sensors-v2.test.ts src/raid-v2.test.ts src/finale-parity.test.ts
```

These tests cover configured terrain obstruction, seeded raid compilation and Python/TypeScript reconstruction agreement. Final regression evidence and the exact current source pin are recorded separately in `ultimate/CURRENT-REGRESSION.json`. An old PASS in the original audit is not physical or current-browser acceptance.
