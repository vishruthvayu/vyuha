# Raid Composer v2 contract

The compiler creates a new frozen `version: 2`, `engine_version: vyuha-0.4.0` scenario. It does not alter the original roster/generator, frozen historical specs or historical scoring. Root integration must dispatch v2 scenarios through their versioned engine and use these motion functions consistently in execution, prioritisation, scoring, replay and Ghost.

## Inputs and outputs

`RaidRequest` accepts a seed, 60–180 second duration, foundational/standard/challenging difficulty, one of the four existing focus skills, urban/rural terrain, night/fog, optional family, optional exact contact composition or total count, optional measured weak sector, and up to five recent feature signatures. Invalid or impossible explicit rosters are rejected with an explanation; they are never silently truncated. The global 200-contact bound is a serialization safety ceiling. The actual difficulty caps of 3/6/12 simultaneous hostiles and available wave travel time deliberately impose a lower feasible roster bound.

`compose_raid` samples a bounded grammar with 1–4 waves plus background birds/friendly UAVs. Different seeds change composition, contact order, timings, motion, sectors and formation. It tries up to 24 deterministic candidates when a sampled geometry or anti-repeat rule fails. A recent multiset signature with Jaccard similarity above 0.6 is rejected. The effective seed, requested seed, rejection count and history count are recorded. Fingerprint features include contact kind, 45-degree sector, wave and motion primitive.

Families: `DIRECT`, `SATURATION`, `DECOY_THEN_STRIKE`, `STAGGERED_WAVES`, `LOW_APPROACH`, `SPLIT_SWARM`, `PROBE_AND_RETREAT`, `BLIND_SECTOR`. The measured-sector variant records its explicit input basis. Without a measured sector the blind-sector family records a seeded random sector, never claiming a learned weakness. A decoy family delays no-RF strike contacts by seven seconds. Low approaches have an explicit low altitude and weave. Coordinated saturation/split groups use a common leader, compatible speed bands and member slots; split and wedge displacement change actual coordinates rather than labels alone.

New additive track fields:

```text
motion: {
  version: 1,
  primitive: direct | weave | orbit_then_dash | dogleg | probe_retreat,
  phase_s, lateral_m, period_s, turn_deg
}
group_id?: string
formation_offset_m?: number     # lateral slot
formation_forward_m?: number    # wedge depth
group_split_s?: number
expires_tick?: integer
threat_profile: string
```

`raid_position` / `position_v2` in Python and `raidPosition` in TypeScript take only a frozen track and logical tick. They use closed-form paths with an explicitly shared 1 micrometer output grid, avoiding frame-dependent accumulation. A v2 active contact must satisfy spawn ≤ tick < expires_tick when expiry exists, in addition to resolved/impact rules. Probes really approach then retreat and expire; background orbit contacts do not spuriously strike the asset.

## Frozen configuration

`examples/finale-threats-v1.json` and `examples/finale-effectors-v1.json` hold versioned JSON defaults, labels, units, bounded speed/altitude bands, sensor geometry and available response ranges. The compiler validates them and deep-copies them into every scenario. Changing configuration files does not change an already frozen scenario. These are illustrative research/training parameters, not calibrated sensor data, real weapon specifications or official doctrine.

Current defaults use meter/kilometer distances, 8–42 m/s hostile speed bands, a 3,000 m illustrative radar range, 1,500 m RF response and 1,000 m kinetic response. All scenarios retain the explicit 8 m protected-asset radius. Urban scenarios preserve a restricted kinetic sector; rural defaults disable that sector. The future sensor model may reduce actual evidence reliability; this compiler does not certify that a human will succeed.

## Validation and group metrics

`validate_raid` checks bounded track and motion schemas, IDs, spawn/expiry/duration, available effective actions, restricted kinetic sectors, a minimum seven-second baseline geometric response window per hostile, and planned peak simultaneous hostile workload. Its evidence label explicitly distinguishes geometric baseline checks from full sensor stochastic reliability, certified solvability and human performance.

`group_metrics` consumes reconstructed events and state at the observed end. It reports group membership, observed leakers, unresolved contacts, time to first engagement, attempt counts and descriptive attempts/resolved contact. Planned saturation index is labelled planned. These fields do not independently change original scores or persistent skill updates. No GNSS area effector, certified expert policy, autonomous boids or learned swarm behavior is asserted by this module.

## Integration dependencies

The compiler and motion contracts are complete standalone modules. Completion of the product capability still requires root-owned API protection, request wiring, Scenario Studio/Director launch integration, new engine version dispatch, new sensor model, variable-duration event/control schemas, response/sensor geometry displays, Ghost and observed instructor views, v2 portable history reconstruction and integrated browser verification. A module existing is not evidence that those application flows passed.
