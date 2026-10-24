import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { LearningEvidence } from "./LearningEvidence";
import type { LearningReview } from "./learning";

test("verified review links only observed known competencies to an explicit course selection", () => {
  const review: LearningReview = {
    context: {
      version: "learning-v1",
      catalog_hash: "a".repeat(64),
      item_id: "C01_PRACTICE_A",
      mode: "practice",
      assistance: "full",
      seed: 7,
      selection: {
        policy: "direct-item-v1",
        reason: "Explicit practice",
        coverage: {},
        recent_items: [],
        candidates: ["C01_PRACTICE_A"],
      },
    },
    evidence: {
      version: "competency-evidence-v1",
      item_id: "C01_PRACTICE_A",
      mode: "practice",
      assessed: false,
      assistance: "full",
      summary: {
        C01: { correct: 0, incorrect: 1, unassessable: 0 },
        C02: { correct: 0, incorrect: 0, unassessable: 1 },
        C03: { correct: 0, incorrect: 0, unassessable: 0 },
        LEGACY_DETECTION: { correct: 1, incorrect: 0, unassessable: 0 },
      },
      observations: [],
      original_review_hash: "b".repeat(64),
      limitation: "Scenario-bound evidence, not mastery.",
    },
  };
  const original = structuredClone(review);
  const dom = new JSDOM(
    renderToStaticMarkup(<LearningEvidence review={review} />),
  );
  try {
    assert.deepEqual(
      [...dom.window.document.querySelectorAll("a")].map((a) =>
        a.getAttribute("href"),
      ),
      ["/academy?competency=C01", "/academy?competency=C02"],
    );
    assert.match(
      dom.window.document.body.textContent ?? "",
      /Practice only · excluded from individual assessment/,
    );
    assert.deepEqual(review, original);
    assert.doesNotMatch(
      renderToStaticMarkup(
        <LearningEvidence review={{ ...review, evidence: null }} />,
      ),
      /href=|Explore .*practice/,
    );
  } finally {
    dom.window.close();
  }
});
