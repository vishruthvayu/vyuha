import test from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { JSDOM } from "jsdom";
import Analytics from "./Analytics";

const history = {
  prior: {
    detection: 0.5,
    classification_iff: 0.5,
    effector_choice: 0.5,
    degraded_sensor_response: 0.5,
  },
  points: [],
  sessions: [],
  note: "Unchanged persisted fixture; no new outcomes",
};
const trainee = {
  unit_id: "local",
  unit_name: "Synthetic QA unit",
  trainee_id: "synthetic-trainee",
  callsign: "QA",
};
async function mounted(
  url: string,
  body: (
    document: Document,
    window: JSDOM["window"],
    requests: string[],
  ) => Promise<void>,
  respond?: (url: string) => unknown | Promise<unknown>,
) {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>Analytics navigation</title></head><body><div id="root"></div></body></html>',
    { url },
  );
  const requests: string[] = [];
  const before = JSON.stringify(history);
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    assert.equal(
      init?.method ?? "GET",
      "GET",
      "Navigation cannot write training evidence",
    );
    const result =
      (await respond?.(url)) ??
      (url.endsWith("/units")
        ? { units: [{ id: "local", name: "Synthetic QA unit" }] }
        : url.endsWith("/trainees")
          ? { trainees: [trainee] }
          : url.includes("/skill-heatmap")
            ? {
                unit_id: "local",
                trainee_id: null,
                included_sessions: 0,
                excluded_sessions: 0,
                note: "No completed fixture sessions",
                skills: [],
                rows: [],
              }
            : url.includes("/trainees/")
              ? history
              : { points: [], note: "Unit fixture only" });
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    await act(async () => root.render(<Analytics identity={trainee} />));
    await body(dom.window.document, dom.window, requests);
    assert.equal(
      JSON.stringify(history),
      before,
      "Persisted estimates remain unchanged",
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}
function button(document: Document, text: string) {
  const result = [...document.querySelectorAll(".analytics-tabs button")].find(
    (item) => item.textContent === text,
  );
  assert.ok(result, text);
  return result as HTMLButtonElement;
}
async function traversal(
  window: JSDOM["window"],
  direction: "back" | "forward",
) {
  await act(async () => {
    await new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      window.history[direction]();
    });
  });
}

test("Compliance and tour scenario-skill deep links mount the exact evidence target on first render", async () =>
  mounted(
    "http://qa.local/analytics?source=compliance#scenario-skill",
    async (document, window, requests) => {
      assert.ok(document.querySelector("#scenario-skill"));
      assert.equal(
        button(document, "Scenario × skill").getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(document.querySelector(".analytics-overview"), null);
      assert.equal(window.location.search, "?source=compliance");
      assert.ok(requests.some((url) => url.includes("/skill-heatmap")));
      assert.ok(
        requests.some((url) =>
          url.endsWith("/trainees/synthetic-trainee/analytics"),
        ),
      );
    },
  ));

test("Hash changes select the corresponding analytics workspace and unknown anchors retain the safe overview", async () =>
  mounted("http://qa.local/analytics", async (document, window) => {
    assert.ok(document.querySelector(".analytics-overview"));
    await act(async () => {
      window.history.replaceState(null, "", "#scenario-skill");
      window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    });
    assert.ok(document.querySelector("#scenario-skill"));
    await act(async () => {
      window.history.replaceState(null, "", "#not-a-workspace");
      window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    });
    assert.ok(document.querySelector(".analytics-overview"));
    assert.equal(document.querySelector("#scenario-skill"), null);
  }));

test("Analytics tab navigation preserves query and browser history for back, forward and reloadable view links", async () =>
  mounted(
    "http://qa.local/analytics?source=proof#scenario-skill",
    async (document, window) => {
      await act(async () => button(document, "Session comparison").click());
      assert.equal(window.location.hash, "#session-comparison");
      assert.ok(document.querySelector("#session-comparison"));
      assert.equal(window.location.search, "?source=proof");
      await act(async () => button(document, "Director history").click());
      assert.equal(window.location.hash, "#director-history");
      assert.ok(document.querySelector("#director-history"));
      await traversal(window, "back");
      assert.equal(
        button(document, "Session comparison").getAttribute("aria-pressed"),
        "true",
      );
      await traversal(window, "back");
      assert.equal(window.location.hash, "#scenario-skill");
      assert.ok(document.querySelector("#scenario-skill"));
      await traversal(window, "forward");
      assert.ok(document.querySelector("#session-comparison"));
      await act(async () => button(document, "Unit trend").click());
      assert.equal(window.location.hash, "#unit-trend");
      assert.ok(document.querySelector("#unit-trend"));
      await act(async () => button(document, "Overview").click());
      assert.equal(window.location.hash, "");
      assert.ok(document.querySelector(".analytics-overview"));
      assert.equal(window.location.search, "?source=proof");
    },
  ));

test("Empty analytics explains comparison prerequisites instead of offering an unusable action", async () =>
  mounted("http://qa.local/analytics", async (document) => {
    assert.match(
      document.body.textContent!,
      /comparison becomes available after two completed/i,
    );
    assert.equal(
      [...document.querySelectorAll(".analytics-overview button")].some(
        (button) =>
          button.textContent?.includes("Inspect two recorded sessions"),
      ),
      false,
    );
  }));

const comparisonSessions = ["first", "second", "third"].map((id, index) => ({
  id,
  title: `Synthetic ${id}`,
  pack: "Synthetic QA",
  seed: index,
  observed_tick: 300,
  score: 50 + index,
  nodes: { detect: 10, classify: 10, prioritise: 10, engage: 20 + index },
  leakers: 0,
  roe_breaches: 0,
  failures: {},
}));
const secondTrainee = {
  ...trainee,
  trainee_id: "second-trainee",
  callsign: "Second QA",
};
const otherTrainee = {
  ...trainee,
  unit_id: "other",
  trainee_id: "other-trainee",
  callsign: "Other QA",
};
function comparisonFixture(url: string) {
  if (url.endsWith("/units"))
    return {
      units: [
        { id: "local", name: "Synthetic QA unit" },
        { id: "other", name: "Other unit" },
      ],
    };
  if (url.endsWith("/units/local/trainees"))
    return { trainees: [trainee, secondTrainee] };
  if (url.endsWith("/units/other/trainees"))
    return { trainees: [otherTrainee] };
  if (url.includes("/trainees/") && url.endsWith("/analytics"))
    return { ...history, sessions: comparisonSessions };
}
async function select(
  document: Document,
  window: JSDOM["window"],
  index: number,
  value: string,
) {
  await act(async () => {
    const input = document.querySelectorAll("select")[index];
    assert.ok(input);
    input.value = value;
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
function values(document: Document) {
  return [...document.querySelectorAll("select")].map((input) => input.value);
}

test("Shared analytics link restores the exact trainee and session pair without writing evidence", async () => {
  const before = JSON.stringify(comparisonSessions);
  await mounted(
    "http://qa.local/analytics?source=proof&unit=local&trainee=second-trainee&sessionA=third&sessionB=first#session-comparison",
    async (document, _window, requests) => {
      assert.deepEqual(values(document), [
        "local",
        "second-trainee",
        "third",
        "first",
      ]);
      assert.ok(
        requests.some((url) =>
          url.endsWith("/trainees/second-trainee/analytics"),
        ),
      );
      assert.ok(
        !requests.some((url) =>
          url.endsWith("/trainees/synthetic-trainee/analytics"),
        ),
      );
    },
    comparisonFixture,
  );
  assert.equal(JSON.stringify(comparisonSessions), before);
});

test("Selection changes retain source context and restore comparison, trainee and unit through browser history", async () =>
  mounted(
    "http://qa.local/analytics?source=proof#session-comparison",
    async (document, window) => {
      assert.deepEqual(values(document), [
        "local",
        "synthetic-trainee",
        "second",
        "third",
      ]);
      await select(document, window, 2, "first");
      assert.equal(
        new URLSearchParams(window.location.search).get("sessionA"),
        "first",
      );
      await select(document, window, 1, "second-trainee");
      assert.deepEqual(values(document), [
        "local",
        "second-trainee",
        "second",
        "third",
      ]);
      await select(document, window, 0, "other");
      assert.deepEqual(values(document), [
        "other",
        "other-trainee",
        "second",
        "third",
      ]);
      await traversal(window, "back");
      assert.deepEqual(values(document), [
        "local",
        "second-trainee",
        "second",
        "third",
      ]);
      await traversal(window, "back");
      assert.deepEqual(values(document), [
        "local",
        "synthetic-trainee",
        "first",
        "third",
      ]);
      await traversal(window, "forward");
      assert.deepEqual(values(document), [
        "local",
        "second-trainee",
        "second",
        "third",
      ]);
      assert.equal(
        new URLSearchParams(window.location.search).get("source"),
        "proof",
      );
    },
    comparisonFixture,
  ));

test("Unavailable linked trainees never trigger analytics requests or substitute another trainee", async () =>
  mounted(
    "http://qa.local/analytics?unit=local&trainee=missing#session-comparison",
    async (document, window, requests) => {
      assert.match(
        document.body.textContent!,
        /linked trainee is unavailable/i,
      );
      assert.equal(
        requests.some((url) => /\/trainees\/[^/]+\/analytics$/.test(url)),
        false,
      );
      await select(document, window, 1, "second-trainee");
      assert.deepEqual(values(document), [
        "local",
        "second-trainee",
        "second",
        "third",
      ]);
    },
    comparisonFixture,
  ));

test("Missing linked sessions stay unselected and explicit empty selection survives reload", async () =>
  mounted(
    "http://qa.local/analytics?unit=local&trainee=synthetic-trainee&sessionA=missing&sessionB=#session-comparison",
    async (document, window) => {
      assert.deepEqual(values(document), [
        "local",
        "synthetic-trainee",
        "",
        "",
      ]);
      assert.match(
        document.body.textContent!,
        /linked session is unavailable/i,
      );
      await select(document, window, 2, "first");
      assert.equal(
        new URLSearchParams(window.location.search).get("sessionB"),
        "",
      );
      assert.doesNotMatch(
        document.body.textContent!,
        /linked session is unavailable/i,
      );
    },
    comparisonFixture,
  ));

test("Delayed previous-trainee response cannot replace the newly selected trainee's evidence", async () => {
  let release!: (value: unknown) => void;
  const delayed = new Promise((resolve) => {
    release = resolve;
  });
  await mounted(
    "http://qa.local/analytics#session-comparison",
    async (document, window) => {
      await select(document, window, 1, "second-trainee");
      assert.deepEqual(values(document), [
        "local",
        "second-trainee",
        "second",
        "third",
      ]);
      await act(async () => {
        release({
          ...history,
          sessions: [
            { ...comparisonSessions[0], id: "stale", title: "Stale evidence" },
          ],
        });
      });
      assert.deepEqual(values(document), [
        "local",
        "second-trainee",
        "second",
        "third",
      ]);
      assert.doesNotMatch(document.body.textContent!, /Stale evidence/);
    },
    (url) =>
      url.endsWith("/trainees/synthetic-trainee/analytics")
        ? delayed
        : comparisonFixture(url),
  );
});

test("An unavailable trainee link cannot show an aggregate heatmap as their individual evidence", async () =>
  mounted(
    "http://qa.local/analytics?unit=local&trainee=missing#scenario-skill",
    async (document, _window, requests) => {
      assert.match(
        document.body.textContent!,
        /linked trainee is unavailable/i,
      );
      assert.equal(
        requests.some((url) => url.includes("skill-heatmap")),
        false,
      );
    },
    comparisonFixture,
  ));
