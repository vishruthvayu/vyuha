import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import ControlledStudy from "./ControlledStudy";

const identity = (id: string) => ({
  trainee_id: id,
  unit_id: "local",
  callsign: id,
});
const study = (id: string) => ({
  id,
  protocol: {
    protocol_hash: "a".repeat(64),
    retention_hours: 24,
    competency: "C02",
    limitations: [],
  },
  participants: [
    {
      id: `${id}-participant`,
      participant: "P01",
      trainee: "T1",
      arm: "full",
      consented_at: "2026-10-23T00:00:00Z",
      attempts: [],
    },
  ],
  note: "Synthetic UI fixture only",
});
async function mounted(
  body: (qa: {
    document: Document;
    requests: string[];
    payloads: { url: string; body: unknown }[];
    button: (name: string) => HTMLButtonElement;
    input: (label: string, value: string) => Promise<void>;
    select: (label: string, value: string) => Promise<void>;
    release: (url: string, value: unknown, status?: number) => Promise<void>;
    render: (trainee: string) => Promise<void>;
    load: (id: string) => Promise<void>;
  }) => Promise<void>,
) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://qa.local/evaluation",
  });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const set = (name: string, value: unknown) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  };
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    set(name, value);
  const waiting = new Map<string, ((response: Response) => void)[]>();
  const requests: string[] = [];
  const payloads: { url: string; body: unknown }[] = [];
  set("fetch", async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    requests.push(url);
    payloads.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Promise<Response>((resolve) =>
      waiting.set(url, [...(waiting.get(url) ?? []), resolve]),
    );
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const button = (name: string) =>
    [...dom.window.document.querySelectorAll("button")].find(
      (b) => b.textContent === name,
    )!;
  const input = async (label: string, value: string) => {
    const field = [...dom.window.document.querySelectorAll("label")]
      .find((l) => l.textContent?.includes(label))!
      .querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )!.set!.call(field, value);
      field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  };
  const release = async (url: string, value: unknown, status = 200) => {
    const resolve = waiting.get("/api/v1" + url)?.shift();
    assert.ok(resolve, `Expected pending ${url}`);
    await act(async () => {
      resolve(new Response(JSON.stringify(value), { status }));
      await new Promise((done) => setTimeout(done, 0));
    });
  };
  const select = async (label: string, value: string) => {
    const field = [...dom.window.document.querySelectorAll("label")]
      .find((l) => l.textContent?.includes(label))!
      .querySelector("select")!;
    await act(async () => {
      field.value = value;
      field.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
  };
  const render = async (trainee: string) => {
    await act(async () =>
      root.render(<ControlledStudy identity={identity(trainee)} />),
    );
  };
  const load = async (id: string) => {
    await input("Existing protocol ID", id);
    await act(async () => button("Load registered protocol").click());
    await release(`/evaluations/controlled/${id}`, study(id));
  };
  try {
    await render("T1");
    await body({
      document: dom.window.document,
      requests,
      payloads,
      button,
      input,
      select,
      release,
      render,
      load,
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
const preparePath = (id: string) =>
  `/evaluations/controlled/${id}/participants/${id}-participant/baseline/prepare`;
const readyLink = (document: Document) =>
  document.querySelector('a[href*="learning="]');

test("a prepared registered attempt disappears when another protocol is loaded", () =>
  mounted(async (qa) => {
    await qa.load("A");
    await act(async () => qa.button("Prepare baseline for P01").click());
    await qa.release(preparePath("A"), { preparation_id: "A-preparation" });
    await qa.release("/evaluations/controlled/A", study("A"));
    assert.match(
      readyLink(qa.document)?.getAttribute("href") ?? "",
      /A-preparation/,
    );
    await qa.load("B");
    assert.equal(readyLink(qa.document), null);
    assert.match(qa.document.body.textContent ?? "", /Protocol B/);
  }));

test("a delayed preparation cannot appear after a protocol switch or trigger an obsolete refresh", () =>
  mounted(async (qa) => {
    await qa.load("A");
    await act(async () => qa.button("Prepare baseline for P01").click());
    await qa.load("B");
    const before = qa.requests.length;
    await qa.release(preparePath("A"), { preparation_id: "A-preparation" });
    assert.equal(qa.requests.length, before);
    assert.equal(readyLink(qa.document), null);
    assert.match(qa.document.body.textContent ?? "", /Protocol B/);
  }));

test("a delayed preparation refresh cannot replace the newly selected protocol", () =>
  mounted(async (qa) => {
    await qa.load("A");
    await act(async () => qa.button("Prepare baseline for P01").click());
    await qa.release(preparePath("A"), { preparation_id: "A-preparation" });
    await qa.load("B");
    await qa.release("/evaluations/controlled/A", study("A"));
    assert.equal(readyLink(qa.document), null);
    assert.match(qa.document.body.textContent ?? "", /Protocol B/);
  }));

test("identity switches discard late preparation success and failure", async () => {
  for (const status of [200, 422])
    await mounted(async (qa) => {
      await qa.load("A");
      await act(async () => qa.button("Prepare baseline for P01").click());
      await qa.render("T2");
      await qa.release(
        preparePath("A"),
        status === 200
          ? { preparation_id: "old-preparation" }
          : { detail: "Old trainee error" },
        status,
      );
      assert.equal(readyLink(qa.document), null);
      assert.equal(qa.document.querySelector('[role="alert"]'), null);
      assert.doesNotMatch(qa.document.body.textContent ?? "", /Protocol A/);
    });
});

test("participant edits invalidate late preparation and old error feedback", () =>
  mounted(async (qa) => {
    await qa.load("A");
    await act(async () => qa.button("Prepare baseline for P01").click());
    await qa.input("Pseudonymous participant label", "P02");
    await qa.release(
      preparePath("A"),
      { detail: "Old participant error" },
      422,
    );
    assert.equal(readyLink(qa.document), null);
    assert.equal(qa.document.querySelector('[role="alert"]'), null);
    assert.equal(qa.button("Prepare baseline for P01").disabled, false);
  }));

test("late protocol loading and registration cannot cross a trainee switch", async () => {
  for (const register of [false, true])
    await mounted(async (qa) => {
      if (register)
        await act(async () => qa.button("Register frozen protocol").click());
      else {
        await qa.input("Existing protocol ID", "A");
        await act(async () => qa.button("Load registered protocol").click());
      }
      await qa.render("T2");
      const before = qa.requests.length;
      await qa.release(
        register ? "/evaluations/controlled" : "/evaluations/controlled/A",
        register ? { id: "A" } : study("A"),
      );
      assert.equal(qa.requests.length, before);
      assert.doesNotMatch(qa.document.body.textContent ?? "", /Protocol A/);
      assert.equal(qa.document.querySelector('[role="alert"]'), null);
    });
});

test("late enrollment after a participant edit does not refresh the obsolete context", () =>
  mounted(async (qa) => {
    await qa.load("A");
    const consent = qa.document.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    await act(async () => consent.click());
    await act(async () => qa.button("Enroll joined trainee").click());
    await qa.input("Pseudonymous participant label", "P02");
    const before = qa.requests.length;
    await qa.release("/evaluations/controlled/A/participants", {
      id: "A-participant",
    });
    assert.equal(qa.requests.length, before);
    assert.equal(
      (
        qa.document.querySelector(
          'input[pattern="P[0-9]{2,4}"]',
        ) as HTMLInputElement
      ).value,
      "P02",
    );
    assert.equal(qa.document.querySelector('[role="alert"]'), null);
  }));

const dispositionPath =
  "/evaluations/controlled/A/participants/A-participant/dispositions";
const dispositionRecord = {
  id: "disposition-fixture",
  disposition: "withdrawn",
  reason: "Participant requested withdrawal",
  recorded_at: "2026-10-23T12:00:00Z",
};

test("terminal disposition requires an explicit choice and reason, posts the scoped payload, and preserves evidence", () =>
  mounted(async (qa) => {
    await qa.load("A");
    const confirm = () => qa.button("Confirm terminal disposition for P01");
    assert.equal(confirm().disabled, true);
    await qa.select("Disposition for P01", "withdrawn");
    assert.equal(confirm().disabled, true);
    await qa.input(
      "Disposition reason for P01",
      "Participant requested withdrawal",
    );
    assert.equal(confirm().disabled, false);
    await act(async () => confirm().click());
    const sent = qa.payloads.find((entry) =>
      entry.url.endsWith("/dispositions"),
    )!.body as { request_id: string; disposition: string; reason: string };
    assert.match(sent.request_id, /^[A-Za-z0-9_-]{8,80}$/);
    assert.equal(sent.disposition, "withdrawn");
    assert.equal(sent.reason, "Participant requested withdrawal");
    await qa.release(dispositionPath, dispositionRecord);
    assert.equal(qa.button("Prepare baseline for P01").disabled, true);
    await qa.release("/evaluations/controlled/A", {
      ...study("A"),
      participants: [
        {
          ...study("A").participants[0],
          lifecycle_status: "withdrawn",
          dispositions: [dispositionRecord],
          attempts: [
            {
              phase: "baseline",
              status: "completed",
              session_id: "original-session",
              exposure_eligible: false,
            },
          ],
        },
      ],
    });
    assert.match(qa.document.body.textContent ?? "", /withdrawn/);
    assert.match(
      qa.document.body.textContent ?? "",
      /Participant requested withdrawal/,
    );
    assert.match(qa.document.body.textContent ?? "", /baseline · completed/);
    assert.match(qa.document.body.textContent ?? "", /not exposure-qualified/);
    assert.match(
      qa.document.body.textContent ?? "",
      /Already-created sessions may finish/,
    );
    assert.equal(readyLink(qa.document), null);
    assert.ok(
      qa.document.querySelector('time[datetime="2026-10-23T12:00:00Z"]'),
    );
  }));

test("disposition errors are shown and retries reuse the original request without fabricating a terminal status", () =>
  mounted(async (qa) => {
    await qa.load("A");
    await qa.select("Disposition for P01", "dropout");
    await qa.input("Disposition reason for P01", "No further participation");
    await act(async () =>
      qa.button("Confirm terminal disposition for P01").click(),
    );
    await qa.release(
      dispositionPath,
      { detail: "Officer authorization expired" },
      401,
    );
    assert.match(
      qa.document.querySelector('[role="alert"]')?.textContent ?? "",
      /Officer authorization expired/,
    );
    assert.equal(qa.button("Prepare baseline for P01").disabled, false);
    await act(async () =>
      qa.button("Confirm terminal disposition for P01").click(),
    );
    const posts = qa.payloads.filter((entry) =>
      entry.url.endsWith("/dispositions"),
    );
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[0].body, posts[1].body);
    await qa.release(dispositionPath, {
      ...dispositionRecord,
      disposition: "dropout",
      reason: "No further participation",
    });
    await qa.release(
      "/evaluations/controlled/A",
      { detail: "Report refresh unavailable" },
      503,
    );
    assert.equal(qa.button("Prepare baseline for P01").disabled, true);
    assert.match(
      qa.document.body.textContent ?? "",
      /Participant status: dropout/,
    );
  }));

test("a late disposition receipt cannot change another protocol", () =>
  mounted(async (qa) => {
    await qa.load("A");
    await qa.select("Disposition for P01", "withdrawn");
    await qa.input(
      "Disposition reason for P01",
      "Participant requested withdrawal",
    );
    await act(async () =>
      qa.button("Confirm terminal disposition for P01").click(),
    );
    await qa.load("B");
    const before = qa.requests.length;
    await qa.release(dispositionPath, dispositionRecord);
    assert.equal(qa.requests.length, before);
    assert.match(qa.document.body.textContent ?? "", /Protocol B/);
    assert.doesNotMatch(
      qa.document.body.textContent ?? "",
      /Participant status: withdrawn/,
    );
    assert.equal(qa.button("Prepare baseline for P01").disabled, false);
  }));

test("frozen v2 analysis, terminal history and legacy omissions are displayed without rewriting them", () =>
  mounted(async (qa) => {
    await qa.load("A");
    assert.match(
      qa.document.body.textContent ?? "",
      /Historical protocol: no versioned analysis contract/,
    );
    await act(async () => qa.button("Refresh registered evidence").click());
    await qa.release("/evaluations/controlled/A", {
      ...study("A"),
      protocol: {
        ...study("A").protocol,
        version: "controlled-pilot-v2",
        analysis_contract: {
          version: "controlled-analysis-v1",
          estimand: "Descriptive change only",
          population: "All allocated participants retained",
          primary: {
            phases: ["baseline", "immediate"],
            measure: "Registered primary measure",
            denominator: "Assessable observations only",
          },
          secondary: [
            {
              phases: ["baseline", "transfer"],
              measure: "Available pair count",
            },
          ],
          allocation: "Full versus faded only",
          exclusions: ["Short exposure excluded from qualified summaries"],
          missing_data: "No imputation",
          terminal_dispositions: "No reactivation",
          reporting: "No causal inference",
          power: "Enrollment ceiling is not power",
        },
      },
      participants: [
        {
          ...study("A").participants[0],
          lifecycle_status: "dropout",
          dispositions: [{ ...dispositionRecord, disposition: "dropout" }],
        },
      ],
    });
    assert.doesNotMatch(
      qa.document.body.textContent ?? "",
      /Historical protocol: no versioned analysis contract/,
    );
    for (const text of [
      "controlled-analysis-v1",
      "Registered primary measure",
      "Assessable observations only",
      "Short exposure excluded",
      "No imputation",
      "No reactivation",
      "No causal inference",
      "Enrollment ceiling is not power",
    ])
      assert.ok(qa.document.body.textContent?.includes(text), text);
    assert.equal(qa.button("Prepare baseline for P01").disabled, true);
  }));

test("officer preparation uses the actual participant owner and never offers a mismatched launch", () =>
  mounted(async (qa) => {
    await qa.input("Existing protocol ID", "B");
    await act(async () => qa.button("Load registered protocol").click());
    const other = study("B");
    other.participants[0].trainee = "T2";
    await qa.release("/evaluations/controlled/B", other);
    await act(async () => qa.button("Prepare baseline for P01").click());
    await qa.release(preparePath("B"), { preparation_id: "B-owner-ticket" });
    await qa.release("/evaluations/controlled/B", other);
    assert.equal(readyLink(qa.document), null);
    assert.match(
      qa.document.body.textContent ?? "",
      /Join that participant's trainee identity/,
    );
  }));
