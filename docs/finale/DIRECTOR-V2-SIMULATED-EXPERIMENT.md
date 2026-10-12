# Director v2 synthetic policy comparison

**Synthetic model evidence only — no demonstrated human learning benefit.**

Synthetic model evidence only; no human learning efficacy, calibrated difficulty or operational competence claim.

Compared 24 paired seeds per regime, 60 sessions and four synthetic contact outcomes per session. Both policies see the same type of processed evidence; latent skill is withheld. No user profiles, scenarios or completed histories are written.

| Synthetic regime | V1 final latent probe | V2 final latent probe | Paired V2−V1 | Approx. 95% seed interval | V1/V2 training success |
| --- | --- | --- | --- | --- | --- |
| plastic moderate forgetting | 0.5812 | 0.5792 | -0.0020 | [-0.0060, +0.0020] | 0.5174 / 0.5580 |
| slow learning fast forgetting | 0.2399 | 0.2404 | +0.0005 | [-0.0026, +0.0036] | 0.4050 / 0.4335 |
| stationary | 0.4114 | 0.4114 | +0.0000 | [+0.0000, +0.0000] | 0.4257 / 0.4663 |

No positive learning advantage is established by the recorded regimes when their paired intervals include zero. Training success and learning must be interpreted separately.

The interval describes paired synthetic seed variability under the stated model. It is not a clinical, human or operational training estimate. Higher training success can follow easier tasks without better learning; the stationary regime explicitly separates those effects. Do not select only a favourable regime or convert these figures into a measured human improvement claim.

## Assumptions and reproducibility

Only the selected skill receives four synthetic outcomes in a session; real VYUHA drills can generate evidence for multiple skills, so this is selector sensitivity rather than an end-to-end trainee model. Four latent skills start near 0.25/0.65/0.45/0.30 with ±0.05 seeded jitter. Foundational/standard/challenging tasks shift success probability by +0.20/0/−0.20, clipped to [0.05,0.95]. Learning and unpractised decay follow the coefficients in the JSON; these are illustrative model assumptions, not calibrated learner data. Contact Bernoulli outcomes are paired by seed, step and skill. The identical-standard probe is the mean latent ability, not an observed human test.

Run `PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m server.director_v2_experiment --output <directory>` from the repository. The JSON records exact configuration, per-seed results, policy/focus/difficulty counts and trace hashes. Repetition tests assert determinism, bounded outcomes, unchanged policy inputs and identical stationary latent skill rather than assuming v2 wins.

Actual Raid Composer diversity/validity, full-engine parity, curriculum portability and live UI remain separate acceptance evidence. This experiment does not run the 3D simulator or substitute for a controlled human evaluation.
