import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import Academy from "./Academy";
import {
  academyCourses,
  initialCompetency,
  nextAcademyStage,
  preparationMatches,
  stageEvidence,
} from "./academy-journey";
import type { AcademyProgress } from "./academy-journey";
import type { LearningCatalogue, LearningPreparation } from "./learning";

const raw = JSON.parse(
  readFileSync(
    new URL("../../server/config/learning-v1.json", import.meta.url),
    "utf8",
  ),
) as LearningCatalogue;
const catalogue: LearningCatalogue = {
  ...raw,
  catalog_hash: "a".repeat(64),
  items: raw.items.map(
    ({
      id,
      title,
      competency_id,
      pool,
      form,
      assistance,
      audience,
      objective,
      instructions,
      reflection,
    }) => ({
      id,
      title,
      competency_id,
      pool,
      form,
      assistance,
      audience,
      objective,
      instructions,
      reflection,
    }),
  ),
};
function progress(practiced_items: string[] = []): AcademyProgress {
  return {
    practiced_items,
    practice_attempts: practiced_items.length,
    assessed_attempts: 0,
    competencies: Object.fromEntries(
      raw.competencies
        .filter((c) => c.scope === "individual")
        .map((c) => [
          c.id,
          { correct: 0, incorrect: 0, unassessable: 0, assessed_sessions: 0 },
        ]),
    ),
    limitation: "Evidence counts are not calibrated mastery.",
  };
}
type Body = {
  request_id: string;
  trainee: string;
  mode: "practice" | "assessment" | "adaptive";
  seed: number;
  item_id?: string;
  form?: string;
};
function preparation(body: Body): LearningPreparation {
  const item = catalogue.items.find(
    (i) => i.id === (body.item_id ?? "C02_PRACTICE_B"),
  )!;
  return {
    preparation_id: body.request_id,
    scenario: { title: item.title },
    context: {
      version: "learning-v1",
      catalog_hash: catalogue.catalog_hash,
      item_id: item.id,
      mode: body.mode,
      seed: body.seed,
      assistance: item.assistance,
      selection: {
        policy:
          body.mode === "adaptive" ? "coverage-director-v1" : "direct-item-v1",
        reason: "Explicit frozen selection",
        coverage: {},
        recent_items: [],
        candidates: [item.id],
      },
    },
  } as unknown as LearningPreparation;
}
test("real catalog maps five individual journeys and keeps pools, help and Crew distinct", () => {
  const before = structuredClone(catalogue),
    courses = academyCourses(catalogue);
  assert.deepEqual(
    courses.map((c) => c.competency.id),
    ["C01", "C02", "C03", "C04", "C05"],
  );
  for (const c of courses) {
    assert.equal(c.supported.length, 1);
    assert.equal(c.faded.length, 1);
    assert.equal(c.assessment.length, 8);
    assert.ok(
      c.assessment.every(
        (i) => i.assistance === "none" && i.pool === "assessment",
      ),
    );
  }
  assert.deepEqual(catalogue, before);
  assert.equal(initialCompetency(courses, "C02"), "C02");
  for (const invalid of ["C06", "C99", "../C02", "c02", null])
    assert.equal(initialCompetency(courses, invalid), "C01");
});
test("suggestions use positive practice observations, not assessed mastery or unassessable counts", () => {
  const course = academyCourses(catalogue)[0],
    p = progress();
  p.competencies.C01.unassessable = 8;
  assert.equal(nextAcademyStage(course, p), "supported");
  assert.equal(
    stageEvidence(course, "assessment", p),
    "No assessable session recorded",
  );
  p.practiced_items = ["C01_PRACTICE_A"];
  assert.equal(nextAcademyStage(course, p), "faded");
  p.practiced_items.push("C01_PRACTICE_B");
  assert.equal(nextAcademyStage(course, p), "assessment");
  assert.equal(nextAcademyStage(academyCourses(catalogue)[1], p), "supported");
  delete p.practiced_items;
  assert.equal(
    stageEvidence(course, "faded", p),
    "Practice-item evidence unavailable",
  );
});
test("preparation acceptance binds catalogue, selected item, pool and immutable assistance mode", () => {
  const body: Body = {
    request_id: "test-ticket",
    trainee: "T_A",
    mode: "assessment",
    seed: 62147,
    item_id: "C04_TRANSFER-D_A",
    form: "transfer-d",
  };
  const response = preparation(body),
    expected = catalogue.items.find((i) => i.id === body.item_id)!;
  assert.equal(
    preparationMatches(response, catalogue, "assessment", expected),
    true,
  );
  for (const change of [
    { assistance: "full" },
    { mode: "practice" },
    { catalog_hash: "b".repeat(64) },
    { item_id: "C01_BASELINE-A_A" },
  ])
    assert.equal(
      preparationMatches(
        {
          ...response,
          context: { ...response.context, ...change },
        } as LearningPreparation,
        catalogue,
        "assessment",
        expected,
      ),
      false,
    );
});

type Pending = {
  url: string;
  body: Body | null;
  settled: boolean;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};
async function mounted(
  body: (q: {
    document: Document;
    requests: Pending[];
    click: (text: string, twice?: boolean) => Promise<void>;
    select: (label: string, value: string) => Promise<void>;
    release: (index: number, value: unknown, status?: number) => Promise<void>;
    reject: (index: number) => Promise<void>;
    load: (
      from?: number,
      data?: LearningCatalogue,
      p?: AcademyProgress,
    ) => Promise<void>;
    render: (trainee: string) => Promise<void>;
    audit: () => Promise<void>;
  }) => Promise<void>,
  query = "?competency=C02",
) {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>Academy</title></head><body><div id="root"></div></body></html>',
    { url: `http://qa.local/academy${query}`, runScripts: "outside-only" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>(),
    requests: Pending[] = [];
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: unknown, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) =>
        requests.push({
          url: String(url),
          body: init?.body ? JSON.parse(String(init.body)) : null,
          settled: false,
          resolve,
          reject,
        }),
      ),
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const { createRoot } = await import("react-dom/client"),
    root = createRoot(dom.window.document.getElementById("root")!);
  const render = async (trainee: string) => {
    await act(async () =>
      root.render(
        <Academy
          identity={{
            trainee_id: trainee,
            unit_id: "local",
            callsign: trainee,
          }}
        />,
      ),
    );
  };
  const release = async (index: number, value: unknown, status = 200) => {
    assert.ok(requests[index] && !requests[index].settled);
    await act(async () => {
      requests[index].settled = true;
      requests[index].resolve(new Response(JSON.stringify(value), { status }));
      await new Promise((done) => setTimeout(done, 0));
    });
  };
  try {
    await render("T_A");
    await body({
      document: dom.window.document,
      requests,
      release,
      render,
      click: async (text, twice = false) => {
        const button = Array.from(
          dom.window.document.querySelectorAll("button"),
        ).find(
          (b) =>
            b.textContent === text ||
            b.querySelector("strong")?.textContent === text,
        );
        assert.ok(button, `Missing button ${text}`);
        await act(async () => {
          button.click();
          if (twice) button.click();
        });
      },
      select: async (label, value) => {
        const select = Array.from(
          dom.window.document.querySelectorAll("select"),
        ).find(
          (s) =>
            s.getAttribute("aria-label") === label ||
            s.closest("label")?.textContent?.startsWith(label),
        );
        assert.ok(select);
        await act(async () => {
          select.value = value;
          select.dispatchEvent(
            new dom.window.Event("change", { bubbles: true }),
          );
        });
      },
      reject: async (index) => {
        await act(async () => {
          requests[index].settled = true;
          requests[index].reject(new TypeError("Synthetic network loss"));
          await new Promise((done) => setTimeout(done, 0));
        });
      },
      load: async (from = 0, data = catalogue, p = progress()) => {
        for (let index = from; index < requests.length; index++) {
          const req = requests[index];
          if (!req.settled && !req.body)
            await release(index, req.url.endsWith("/catalogue") ? data : p);
        }
      },
      audit: async () => {
        dom.window.eval(axe.source);
        const result = await (
          dom.window as unknown as { axe: typeof axe }
        ).axe.run(dom.window.document, {
          rules: { "color-contrast": { enabled: false } },
        });
        assert.equal(
          result.violations.length,
          0,
          JSON.stringify(result.violations),
        );
      },
    });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

test("competency-linked journey prepares full, faded and independent tasks explicitly and passes axe", () =>
  mounted(async (q) => {
    await q.load();
    assert.match(
      q.document.querySelector("#academy-lesson-title")!.textContent!,
      /Evidence-based classification/,
    );
    assert.equal(q.requests.filter((r) => r.body).length, 0);
    await q.click("Prepare selected lesson", true);
    assert.equal(q.requests.length, 3);
    assert.equal(q.requests[2].body!.trainee, "T_A");
    assert.equal(q.requests[2].body!.item_id, "C02_PRACTICE_A");
    assert.equal(q.requests[2].body!.form, undefined);
    await q.release(2, preparation(q.requests[2].body!));
    assert.ok(
      q.document.querySelector(
        `a[href="/?mode=adaptive&learning=${q.requests[2].body!.request_id}"]`,
      ),
    );
    assert.match(
      q.document.querySelector('[role="status"]')!.textContent!,
      /no exercise has started automatically/,
    );
    await q.click("2 · Try with less guidance");
    assert.equal(
      q.document.querySelector('[aria-label="Prepared Academy attempt"]'),
      null,
    );
    assert.equal(q.requests.length, 3);
    assert.equal(
      q.document.querySelector<HTMLSelectElement>('[aria-label="Lesson"]')!
        .value,
      "C02_PRACTICE_B",
    );
    await q.click("Prepare selected lesson");
    await q.release(3, preparation(q.requests[3].body!));
    assert.match(
      q.document.querySelector('[aria-label="Prepared Academy attempt"]')!
        .textContent!,
      /Guidance: faded/,
    );
    await q.click("3 · Demonstrate independently");
    await q.select("Assessment form", "transfer-d");
    await q.click("Prepare assessment item");
    assert.equal(q.requests[4].body!.mode, "assessment");
    assert.equal(q.requests[4].body!.item_id, "C02_TRANSFER-D_A");
    assert.equal(q.requests[4].body!.form, "transfer-d");
    await q.release(4, preparation(q.requests[4].body!));
    assert.match(
      q.document.querySelector('[aria-label="Prepared Academy attempt"]')!
        .textContent!,
      /Guided hints and Fusion advice are disabled/,
    );
    assert.match(
      q.document.body.textContent!,
      /not stage completion or per-form results/,
    );
    await q.audit();
  }));
test("late preparations cannot restore another stage or identity and preparation never counts as completion", () =>
  mounted(async (q) => {
    await q.load();
    await q.click("Prepare selected lesson");
    await q.click("2 · Try with less guidance");
    await q.click("Prepare selected lesson");
    await q.release(2, preparation(q.requests[2].body!));
    assert.equal(
      q.document.querySelector('[aria-label="Prepared Academy attempt"]'),
      null,
    );
    assert.ok(
      Array.from(q.document.querySelectorAll("button")).some(
        (b) => b.textContent === "Preparing frozen attempt…" && b.disabled,
      ),
    );
    await q.render("T_B");
    await q.release(3, { detail: "Old learner conflict" }, 409);
    await q.load(4);
    assert.equal(q.document.querySelector('[role="alert"]'), null);
    assert.equal(
      q.document.querySelector<HTMLSelectElement>('[aria-label="Lesson"]')!
        .value,
      "C02_PRACTICE_A",
    );
    await q.click("Prepare selected lesson");
    assert.equal(q.requests[6].body!.trainee, "T_B");
    await q.release(6, preparation(q.requests[6].body!));
    assert.match(
      q.document.querySelector(".academy-stage-nav")!.textContent!,
      /No supporting practice observation recorded/,
    );
  }));
test("network retry retains the frozen request while a deliberate new attempt gets a new ID", () =>
  mounted(async (q) => {
    await q.load();
    await q.click("Prepare selected lesson");
    await q.reject(2);
    assert.match(
      q.document.querySelector('[role="alert"]')!.textContent!,
      /Synthetic network loss/,
    );
    await q.click("Prepare selected lesson");
    assert.deepEqual(q.requests[3].body, q.requests[2].body);
    await q.release(3, preparation(q.requests[3].body!));
    await q.click("Prepare another attempt");
    await q.click("Prepare selected lesson");
    assert.notEqual(
      q.requests[4].body!.request_id,
      q.requests[3].body!.request_id,
    );
    await q.release(4, preparation(q.requests[4].body!));
  }));
test("supporting evidence suggests less guidance without switching or granting mastery, refresh preserves choice", () =>
  mounted(async (q) => {
    await q.load(0, catalogue, progress(["C02_PRACTICE_A"]));
    assert.match(
      q.document.querySelector(".academy-stage-suggestion")!.textContent!,
      /Less-guided practice/,
    );
    assert.equal(
      q.document.querySelector<HTMLSelectElement>("select")!.value,
      "C02_PRACTICE_A",
    );
    await q.click("Try with less guidance");
    assert.equal(
      q.document.querySelector<HTMLSelectElement>("select")!.value,
      "C02_PRACTICE_B",
    );
    assert.equal(q.requests.filter((r) => r.body).length, 0);
    await q.click("Refresh evidence");
    await q.load(2, catalogue, progress(["C02_PRACTICE_A", "C02_PRACTICE_B"]));
    assert.match(
      q.document.querySelector(".academy-stage-suggestion")!.textContent!,
      /Independent assessment/,
    );
    assert.equal(
      q.document.querySelector<HTMLSelectElement>("select")!.value,
      "C02_PRACTICE_B",
    );
  }));
test("sparse assessment forms normalize the visible selection and actual request; invalid route cannot select Crew", () =>
  mounted(async (q) => {
    const sparse = {
      ...catalogue,
      items: catalogue.items.filter(
        (i) => i.pool === "practice" || i.form === "retention-c",
      ),
    };
    await q.load(0, sparse);
    assert.match(
      q.document.querySelector("#academy-lesson-title")!.textContent!,
      /Observation acquisition/,
    );
    await q.click("3 · Demonstrate independently");
    assert.equal(q.document.querySelectorAll("select")[1].value, "retention-c");
    await q.click("Prepare assessment item");
    assert.equal(q.requests[2].body!.form, "retention-c");
    assert.equal(q.requests[2].body!.item_id, "C01_RETENTION-C_A");
    await q.release(2, preparation(q.requests[2].body!));
    assert.equal(
      q.document.querySelectorAll(".academy-course-nav li").length,
      5,
    );
  }, "?competency=C06"));
test("initial load and mismatched preparation fail visibly with explicit retry and no accepted launch", () =>
  mounted(async (q) => {
    await q.release(0, { detail: "Curriculum unavailable" }, 503);
    await q.release(1, progress());
    assert.match(
      q.document.querySelector('[role="alert"]')!.textContent!,
      /Curriculum unavailable/,
    );
    await q.click("Reload curriculum and evidence");
    await q.load(2);
    await q.click("Prepare selected lesson");
    const wrong = preparation(q.requests[4].body!);
    wrong.context.assistance = "none";
    await q.release(4, wrong);
    assert.equal(
      q.document.querySelector('[aria-label="Prepared Academy attempt"]'),
      null,
    );
    assert.match(
      q.document.querySelector('[role="alert"]')!.textContent!,
      /does not match this learner journey/,
    );
  }));
