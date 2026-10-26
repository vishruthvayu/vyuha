# Authored world: Logistics Quarter

26 October 2026. Baseline `56baab6`. This is the next authored composition, not a new physics engine or another terrain label.

The old urban world had a small isolated compound on predominantly unstructured terrain. The new composition gives the station a legible setting: public terminal/forecourt, loading sheds, service yard, avenue, planted street edge and inhabited fringe. Original metric geometry supplies recessed glazed facades, structural bays, roof services, true sawtooth roofs/clerestories and a water-tower landmark. Existing local PBR maps retain material scale. Shared material batches keep the added detail from becoming one draw per object. No new downloads, asset rights or decoder dependencies.

References inspected:

- [Epic Level Instancing](https://dev.epicgames.com/documentation/en-us/unreal-engine/level-instancing-in-unreal-engine): coherent reusable arrangements and packed static assemblies. VYUHA inference: author recognizable places, append geometry into shared batches. No Unreal content or code imported.
- [Three: Optimize Lots of Objects](https://threejs.org/manual/pages/optimize-lots-of-objects.html): merging static geometry can reduce draw calls. This does not itself prove speed; matched browser workloads are recorded separately.
- [Three MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html): metallic/roughness PBR, environment illumination and material maps. Retain the existing calibrated-for-display lighting pipeline rather than retune contact contrast to make a screenshot brighter. VYUHA is not empirically sensor calibrated.

Implemented scope: one complete urban presentation composition, original procedural kit, streetscape and public manifest. Existing sky/probe, relief, fog, airframes and sensor visibility remain unchanged. No cosmetic rain, dust, bloom, moving vehicles or displaced near terrain: these could obscure tiny contacts or suggest modeled cues without authoritative support. Rural world remains unchanged.

The exact original urban layout remains available as `legacyUrbanOutpost()` for presentation compatibility tests. Its original concertina budget fixture remains at25k; the new larger composition is checked by the complete-facility200k budget rather than inflating that old fixture's limit. This is a presentation revision; historical scenario observations and scorecards remain immutable, but old urban screenshots are not guaranteed pixel-identical.

Active-observation research proceeds separately in [the proposed versioned contract](../../competitive-research/ACTIVE-OBSERVATION-CONTRACT.md). Deliberate acquisition is not implemented by these graphics changes. Camera cropping does not change sensor resolution.
