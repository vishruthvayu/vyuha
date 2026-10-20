import test from "node:test";
import assert from "node:assert/strict";
import { validatedJSONText } from "./import-json";

test("portable upload validation retains original legacy number spellings and whitespace", () => {
  const original =
    '{\n "algorithm": "HMAC-SHA256", "payload": {"alpha": 1.0, "zero": -0.0, "word": "日本"}, "hmac": "abc"\n}';
  assert.equal(validatedJSONText(original, 1024), original);
  assert.notEqual(JSON.stringify(JSON.parse(original)), original);
});

test("portable raw upload still rejects malformed, nonobject and oversized input", () => {
  for (const value of ["{broken", "null", "[]", "1"])
    assert.throws(() => validatedJSONText(value, 1024));
  assert.throws(() => validatedJSONText('{"x":"日本"}', 10), /size limit/);
});
