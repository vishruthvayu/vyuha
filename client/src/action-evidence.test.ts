import test from "node:test";
import assert from "node:assert/strict";
import { ActionEvidenceLedger } from "./action-evidence";
import type { FusionAdvice } from "./fusion";
const action = {
  k: "classify" as const,
  track: "T1",
  kind: "quad" as const,
  identity: "neutral" as const,
};
const accepted = { ...action, tick: 90, order: 2 };
const advice = () =>
  ({
    exposure_id: "display-A",
    evidence: { tick: 89, track_id: "T1" },
    context: { before_order: 2 },
  }) as FusionAdvice;
test("dispatch freezes advice and confidence without mutating the ordinary action", () => {
  const ledger = new ActionEvidenceLedger(),
    shown = advice();
  ledger.capture("run-a", 1, action, shown, 73);
  shown.exposure_id = "later-B";
  shown.evidence.tick = 92;
  const captured = ledger.take("run-a", 1, accepted)!;
  assert.equal(captured.advice?.exposure_id, "display-A");
  assert.equal(captured.advice?.evidence.tick, 89);
  assert.equal(captured.confidence, 73);
  assert.deepEqual(captured.action, action);
  assert.deepEqual(Object.keys(action), ["k", "track", "kind", "identity"]);
  assert.equal(ledger.size, 0);
});
test("VR records no browser advice or confidence when an acknowledgment is delayed until return", () => {
  const ledger = new ActionEvidenceLedger();
  ledger.capture("run-a", 1, action, null, null);
  const captured = ledger.take("run-a", 1, accepted)!;
  assert.equal(captured.advice, null);
  assert.equal(captured.confidence, null);
  assert.equal(ledger.take("run-a", 1, accepted), undefined);
});
test("wrong scope, absent ID or changed payload cannot consume another action evidence", () => {
  const ledger = new ActionEvidenceLedger();
  ledger.capture("run-a", 7, action, advice(), 60);
  assert.equal(ledger.take("run-b", 7, accepted), undefined);
  assert.equal(ledger.take("run-a", undefined, accepted), undefined);
  assert.equal(
    ledger.take("run-a", 7, { ...accepted, kind: "bird" }),
    undefined,
  );
  assert.equal(
    ledger.take("run-a", 7, { ...accepted, track: "T2" }),
    undefined,
  );
  assert.equal(ledger.size, 1);
  assert.ok(ledger.take("run-a", 7, accepted));
  assert.equal(ledger.size, 0);
});
test("out-of-order replies preserve each request snapshot and reset clears prior session ownership", () => {
  const ledger = new ActionEvidenceLedger();
  ledger.capture("a", 1, action, advice(), 55);
  ledger.capture("a", 2, { ...action, kind: "bird" }, null, null);
  assert.equal(
    ledger.take("a", 2, { ...accepted, kind: "bird" })?.confidence,
    null,
  );
  assert.equal(ledger.take("a", 1, accepted)?.confidence, 55);
  ledger.capture("old", 3, action, advice(), 80);
  ledger.clear();
  assert.equal(ledger.size, 0);
  assert.equal(ledger.take("old", 3, accepted), undefined);
});

test("acquisition acknowledgments bind channel and stable query ID without adopting Fusion advice", () => {
  const ledger = new ActionEvidenceLedger();
  const inspect = {
    k: "inspect" as const,
    track: "T1",
    channel: "ir" as const,
    request_id: "query1",
  };
  ledger.capture("active", 99, inspect, null, null);
  assert.equal(
    ledger.take("active", 99, {
      ...inspect,
      channel: "eo",
      tick: 100,
      order: 0,
    }),
    undefined,
  );
  assert.equal(
    ledger.take("active", 99, {
      ...inspect,
      request_id: "query2",
      tick: 100,
      order: 0,
    }),
    undefined,
  );
  assert.equal(ledger.size, 1);
  const accepted = ledger.take("active", 99, {
    ...inspect,
    tick: 100,
    order: 0,
  })!;
  assert.equal(accepted.advice, null);
  assert.equal(accepted.confidence, null);
  assert.equal(ledger.size, 0);
});
