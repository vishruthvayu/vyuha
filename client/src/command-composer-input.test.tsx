import test from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { JSDOM } from "jsdom";
import RaidStudio from "./RaidStudio";

async function run(
  body: (
    document: Document,
    requests: { duration: number }[],
    input: HTMLInputElement,
    enter: (value: string) => Promise<void>,
  ) => Promise<void>,
) {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
    url: "http://qa.local",
  });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const requests: { duration: number }[] = [];
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (_url: unknown, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      requests.push(request);
      return new Response(
        JSON.stringify({
          id: `raid-${requests.length}`,
          title: request.name,
          duration: request.duration,
          tracks: [],
          engine_version: "vyuha-0.4.0",
          raid: { family: "DIRECT", fingerprint: `frozen-${requests.length}` },
        }),
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
  try {
    await act(async () => root.render(<RaidStudio />));
    const input = [...dom.window.document.querySelectorAll("label")]
      .find((label) => label.textContent?.trim() === "Duration (seconds)")!
      .querySelector("input")!;
    const enter = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          dom.window.HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, value);
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
    };
    await body(dom.window.document, requests, input, enter);
  } finally {
    await act(async () => root.unmount());
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    dom.window.close();
  }
}
const click = async (document: Document, name: string) => {
  await act(async () =>
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent === name)!
      .click(),
  );
};

test("Composer duration preserves an incremental 9 then 90 edit and submits ninety seconds", async () =>
  run(async (document, requests, input, enter) => {
    await enter("9");
    assert.equal(
      input.value,
      "9",
      "Intermediate input must not be silently clamped to sixty",
    );
    assert.equal(document.querySelector('[role="alert"]'), null);
    await enter(input.value + "0");
    assert.equal(input.value, "90");
    await click(document, "Preview raid");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].duration, 90);
  }));

test("Composer empty duration stays editable and compile blocks with linked feedback and input focus", async () =>
  run(async (document, requests, input, enter) => {
    await enter("");
    assert.equal(input.value, "");
    await click(document, "Compile and save frozen raid");
    assert.equal(requests.length, 0);
    assert.equal(document.activeElement, input);
    assert.equal(input.getAttribute("aria-invalid"), "true");
    const feedback = document.getElementById(
      input.getAttribute("aria-describedby")!,
    )!;
    assert.equal(feedback.getAttribute("role"), "alert");
    assert.match(feedback.textContent!, /whole-number duration from 60 to 180/);
  }));

test("Composer invalid range or fractional duration is explained on blur and never reaches preview or save", async () =>
  run(async (document, requests, input, enter) => {
    for (const value of ["59", "181", "90.5"]) {
      await enter(value);
      assert.equal(input.value, value);
      await act(async () =>
        input.dispatchEvent(
          new document.defaultView!.FocusEvent("focusout", { bubbles: true }),
        ),
      );
      assert.equal(input.getAttribute("aria-invalid"), "true");
      await click(document, "Preview raid");
      await click(document, "Compile and save frozen raid");
      assert.equal(requests.length, 0);
      assert.equal(
        input.value,
        value,
        "The user must see and correct their draft, not an invented replacement value",
      );
    }
    await enter("90");
    assert.equal(input.getAttribute("aria-invalid"), null);
    await click(document, "Compile and save frozen raid");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].duration, 90);
    assert.match(document.body.textContent!, /Frozen raid saved/);
  }));

test("Composer accepts both duration boundaries and preserves the last saved result when a later draft is invalid", async () =>
  run(async (document, requests, input, enter) => {
    await enter("60");
    await click(document, "Preview raid");
    await enter("180");
    await click(document, "Compile and save frozen raid");
    assert.deepEqual(
      requests.map((request) => request.duration),
      [60, 180],
    );
    await enter("1");
    await click(document, "Preview raid");
    assert.equal(requests.length, 2);
    assert.match(
      document.querySelector(".composer-preview")!.textContent!,
      /Frozen raid saved.*previous configuration/,
    );
  }));
