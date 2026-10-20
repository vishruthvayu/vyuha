> Historical release evidence. This document describes the source/date recorded below; it is not acceptance of the current Ultimate working tree. Current reconciliation: [IMPLEMENTATION-RECONCILIATION.md](IMPLEMENTATION-RECONCILIATION.md).

# Measured software performance and scope

Current implementation `e07a3845cc465f430b572ece7fbded687c1e3729`; source SHA256 `02cf2c87a2fc59d459e5e696aa3141c83092a1e224c81663b78db1cef1ba982a`. Final validation: **609 backend PASS / 160 frontend PASS / zero failures**, production build: 27 local assets / cache `d4234414a93b`, lint and all mutable TSX/hook formatting PASS. Source is frozen; subsequent receipt commits only change documentation. Protected fallback `release/v1.0.1` and peeled tag `v1.0.1` remain `2ca96105044ad6a14952d74db619e20006c26eca`.

Independent provisional **84.0/100** = 46/50 PS + 18/25 realism/AI + 20/25 engineering/demo. This is engineering judgement under the original rubric, not official SIH marks or winning probability. Current **62 PASS / 30 PARTIAL / 1 N/A / 0 BLOCKED** =67.3913% closure excluding N/A. X10 final pin reconciliation passed independent verification; software RC may be sealed. No new source behavior defect was reproduced.

Dashboardpaired20member snapshotbenchmark: baseline repeatedmedian16.6323ms, current .559563ms; fullJSONhash equal. Coldcurrent17.3536ms; zero normal cached SQLqueries excludesobserver PRAGMA. See workstreams/unit-query-cache-receipt.json.

Dedicated clean20syntheticHTTP/SSEclients:20readers held concurrently;20isolatedpauses/concurrent persistedACKs;20serial verifiedAARs. Board reads and telemetry batches interleaved, not all simultaneous.5board samples; SSE241ms includes deliberate issuance/releasebarrier and is not intrinsic deliverylatency. Rawmedians,p95,harnesshash in LIVE-20-CLIENT-RECEIPT.json. Not20physical/renderingbrowsers orhuman/endurancecertification.

DatedOctober12measurements remain separatelyqualified: fixedMediumM1/8GB20s at8/25/50/100/200contacts eachmedian60FPS;180s200contactsmedian60FPS withmainpage heaponly; matched200contact HTTPreconstruction9.753→7.382s(3repeats, exactfullreviews). No wholeWorker/GPU/processmemory certification, fieldparameters orhumanload claims. See BENCHMARK-20261012.json,ENDURANCE-BROWSER-20261012.json,RECONSTRUCTION-CYCLE2-RECEIPT.json.
