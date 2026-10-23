import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import Evaluation from "./Evaluation";

const identity = (id: string) => ({
  trainee_id: id,
  unit_id: "local",
  callsign: id,
});
const pilot = (id: string, participant = "P01") => ({
  id,
  participant,
  drills_required: 3,
  drills: Array.from({ length: 3 }, (_, i) => ({
    id: `${id}-drill-${i}`,
    score: 0,
    failures: {},
  })),
  pre: { accuracy: 0 },
  post: null,
  session_ids: { pre: `${id}-pre` },
  observed_difference: null,
  note: "Synthetic lifecycle fixture only",
  protocol: `Informal protocol ${id}`,
});
type Request = { url: string; method: string; body: unknown };
async function mounted(
  savedProtocols: Record<string, string>,
  body: (qa: {
    document: Document;
    storage: Storage;
    requests: Request[];
    button: (text: string) => HTMLButtonElement;
    click: (text: string) => Promise<void>;
    consent: () => Promise<void>;
    participant: (value: string) => Promise<void>;
    render: (trainee: string) => Promise<void>;
    leave: () => Promise<void>;
    release: (
      url: string,
      value: unknown,
      status?: number,
      method?: string,
    ) => Promise<void>;
  }) => Promise<void>,
) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://qa.local/evaluation",
  });
  for (const [id, protocol] of Object.entries(savedProtocols))
    dom.window.localStorage.setItem(`vyuha-evaluation:${id}`, protocol);
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const waiting = new Map<string, ((response: Response) => void)[]>();
  const requests: Request[] = [];
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (input: unknown, init?: RequestInit) => {
      const url = String(input),
        method = init?.method ?? "GET",
        key = `${method} ${url}`;
      requests.push({
        url,
        method,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Promise<Response>((resolve) =>
        waiting.set(key, [...(waiting.get(key) ?? []), resolve]),
      );
    },
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
  const button = (text: string) => {
    const result = [...dom.window.document.querySelectorAll("button")].find(
      (b) => b.textContent === text,
    );
    assert.ok(result, `Expected button ${text}`);
    return result;
  };
  const click = async (text: string) => {
    await act(async () => button(text).click());
  };
  const render = async (id: string) => {
    await act(async () => root.render(<Evaluation identity={identity(id)} />));
  };
  const release = async (
    url: string,
    value: unknown,
    status = 200,
    method = "GET",
  ) => {
    const resolve = waiting.get(`${method} /api/v1${url}`)?.shift();
    assert.ok(resolve, `Expected pending ${method} ${url}`);
    await act(async () => {
      resolve(new Response(JSON.stringify(value), { status }));
      await new Promise((done) => setTimeout(done, 0));
    });
  };
  try {
    await render("T1");
    await body({
      document: dom.window.document,
      storage: dom.window.localStorage,
      requests,
      button,
      click,
      render,
      release,
      leave: async () => {
        await act(async () => root.render(null));
      },
      consent: async () => {
        const field = [...dom.window.document.querySelectorAll("label")]
          .find((l) =>
            l.textContent?.includes(
              "Participant has agreed to this informal evaluation",
            ),
          )!
          .querySelector("input")!;
        await act(async () => field.click());
      },
      participant: async (value: string) => {
        const field = [...dom.window.document.querySelectorAll("label")]
          .find((l) => l.textContent?.startsWith("Participant ID"))!
          .querySelector("input")!;
        await act(async () => {
          Object.getOwnPropertyDescriptor(
            dom.window.HTMLInputElement.prototype,
            "value",
          )!.set!.call(field, value);
          field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        });
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

test("identity changes reload the correct stored protocol and discard delayed load results and errors", async () => {
  for (const status of [200, 401])
    await mounted({ T1: "A", T2: "B" }, async (qa) => {
      await qa.render("T2");
      await qa.release("/evaluations/B", pilot("B", "P02"));
      await qa.release(
        "/evaluations/A",
        status === 200 ? pilot("A", "P99") : { detail: "Old trainee error" },
        status,
      );
      assert.match(qa.document.body.textContent ?? "", /Informal protocol B/);
      assert.doesNotMatch(
        qa.document.body.textContent ?? "",
        /Informal protocol A|P99|Old trainee error/,
      );
      assert.ok(qa.document.querySelector('a[href="/rapid-id?session=B-pre"]'));
      assert.equal(qa.document.querySelector('[role="alert"]'), null);
    });
});

test("late pre-test protocol creation cannot write another identity or retain consent/request state", () =>
  mounted({}, async (qa) => {
    await qa.consent();
    await qa.click("Create evaluation protocol");
    await qa.click("Create evaluation protocol");
    assert.equal(
      qa.requests.filter(
        (r) => r.method === "POST" && r.url === "/api/v1/evaluations",
      ).length,
      1,
    );
    await qa.render("T2");
    assert.equal(qa.button("Create evaluation protocol").disabled, true);
    await qa.consent();
    await qa.click("Create evaluation protocol");
    const sent = qa.requests
      .filter((r) => r.method === "POST" && r.url === "/api/v1/evaluations")
      .map((r) => r.body as { request_id: string; trainee_id: string });
    assert.deepEqual(
      sent.map((r) => r.trainee_id),
      ["T1", "T2"],
    );
    assert.notEqual(sent[0].request_id, sent[1].request_id);
    await qa.release("/evaluations", pilot("A", "P99"), 200, "POST");
    assert.equal(qa.storage.getItem("vyuha-evaluation:T1"), null);
    assert.equal(qa.storage.getItem("vyuha-evaluation:T2"), null);
    assert.doesNotMatch(
      qa.document.body.textContent ?? "",
      /Informal protocol A|P99/,
    );
    await qa.release("/evaluations", pilot("B", "P02"), 200, "POST");
    await qa.release("/evaluations/B", pilot("B", "P02"));
    assert.equal(qa.storage.getItem("vyuha-evaluation:T2"), "B");
    assert.match(qa.document.body.textContent ?? "", /Informal protocol B/);
  }));

test("late post-test success and error cannot replace the next identity's protocol", async () => {
  for (const status of [200, 422])
    await mounted({ T1: "A", T2: "B" }, async (qa) => {
      await qa.release("/evaluations/A", pilot("A"));
      await qa.click("Prepare post-test");
      await qa.click("Prepare post-test");
      assert.equal(
        qa.requests.filter((r) => r.url.endsWith("/A/post")).length,
        1,
      );
      await qa.render("T2");
      await qa.release("/evaluations/B", pilot("B", "P02"));
      await qa.release(
        "/evaluations/A/post",
        status === 200
          ? { ...pilot("A", "P99"), session_ids: { post: "wrong-post" } }
          : { detail: "Old post error" },
        status,
        "POST",
      );
      assert.match(qa.document.body.textContent ?? "", /Informal protocol B/);
      assert.equal(qa.document.querySelector('a[href*="wrong-post"]'), null);
      assert.equal(qa.document.querySelector('[role="alert"]'), null);
    });
});

test("late manual refresh cannot overwrite a later identity or surface its error", () =>
  mounted({ T1: "A", T2: "B" }, async (qa) => {
    await qa.release("/evaluations/A", pilot("A"));
    await qa.click("Refresh protocol results");
    await qa.render("T2");
    await qa.release("/evaluations/B", pilot("B", "P02"));
    await qa.release(
      "/evaluations/A",
      { detail: "Obsolete refresh failure" },
      503,
    );
    assert.match(qa.document.body.textContent ?? "", /Informal protocol B/);
    assert.equal(qa.document.querySelector('[role="alert"]'), null);
  }));

test("unmount revokes a late creation result before any persistent identity write", () =>
  mounted({}, async (qa) => {
    await qa.consent();
    await qa.click("Create evaluation protocol");
    await qa.leave();
    await qa.release("/evaluations", pilot("A"), 200, "POST");
    assert.equal(qa.storage.getItem("vyuha-evaluation:T1"), null);
    assert.equal(qa.document.body.textContent, "");
  }));

test("mismatched load/post receipts fail closed without replacing the selected protocol", () =>
  mounted({ T1: "A" }, async (qa) => {
    await qa.release("/evaluations/A", pilot("B", "P99"));
    assert.match(
      qa.document.querySelector('[role="alert"]')?.textContent ?? "",
      /does not match/,
    );
    assert.doesNotMatch(
      qa.document.body.textContent ?? "",
      /Informal protocol B|P99/,
    );
    // Re-enter the identity to retry its stored protocol, preserving the same key.
    await qa.render("T2");
    await qa.render("T1");
    await qa.release("/evaluations/A", pilot("A"));
    await qa.click("Prepare post-test");
    await qa.release("/evaluations/A/post", pilot("B", "P99"), 200, "POST");
    assert.match(
      qa.document.querySelector('[role="alert"]')?.textContent ?? "",
      /does not match/,
    );
    assert.match(qa.document.body.textContent ?? "", /Informal protocol A/);
    assert.doesNotMatch(
      qa.document.body.textContent ?? "",
      /Informal protocol B|P99/,
    );
    assert.equal(qa.storage.getItem("vyuha-evaluation:T1"), "A");
  }));

test("a failed creation can retry unchanged but editing creates a fresh immutable request", () =>
  mounted({}, async (qa) => {
    await qa.consent();
    await qa.click("Create evaluation protocol");
    assert.equal(
      (
        qa.document.querySelector(
          'input[pattern="P[0-9]{2,4}"]',
        ) as HTMLInputElement
      ).disabled,
      true,
    );
    await qa.release("/evaluations", { detail: "Unavailable" }, 503, "POST");
    await qa.click("Create evaluation protocol");
    await qa.release("/evaluations", { detail: "Unavailable" }, 503, "POST");
    await qa.participant("P02");
    await qa.click("Create evaluation protocol");
    const sent = qa.requests
      .filter((r) => r.method === "POST" && r.url === "/api/v1/evaluations")
      .map((r) => r.body as { request_id: string; participant: string });
    assert.equal(sent[0].request_id, sent[1].request_id);
    assert.notEqual(sent[1].request_id, sent[2].request_id);
    assert.equal(sent[2].participant, "P02");
    await qa.release("/evaluations", pilot("B", "P02"), 200, "POST");
    await qa.release("/evaluations/B", pilot("B", "P02"));
    assert.equal(qa.document.querySelector('[role="alert"]'), null);
    assert.match(qa.document.body.textContent ?? "", /Informal protocol B/);
  }));
