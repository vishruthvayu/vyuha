import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, symlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { replay } from "./sim";
import { makeScenario } from "./scenario";
import type Cockpit from "./VRCockpit";
import type { Action } from "./types";

test("actual cockpit requires second confirmation, suppresses duplicate/stale receipts and clears changed contexts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vyuha-vr-dom-"));
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><body><div id="mount"></div></body></html>',
    { url: "http://localhost/" },
  );
  const define = (name: string, value: unknown) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  };
  define("window", dom.window);
  define("document", dom.window.document);
  define("navigator", dom.window.navigator);
  define("IS_REACT_ACT_ENVIRONMENT", true);
  const source = resolve(import.meta.dirname, "VRCockpit.tsx");
  const root = createRoot(document.getElementById("mount")!);
  try {
    await symlink(
      resolve(import.meta.dirname, "../node_modules"),
      join(directory, "node_modules"),
    );
    const fiber = join(directory, "fiber.mjs");
    await writeFile(
      fiber,
      "import React from 'react'; export const Canvas=()=>React.createElement('div',{'data-renderer-stub':true});export const useFrame=()=>{};export const useThree=()=>({});",
    );
    let code = ts.transpileModule(await readFile(source, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    code = code.replace(
      /from\s+(["'])([^"']+)\1/g,
      (all, quote, spec: string) => {
        if (spec === "@react-three/fiber")
          return `from ${JSON.stringify(pathToFileURL(fiber).href)}`;
        if (!spec.startsWith("./")) return all;
        const path = [
          resolve(import.meta.dirname, spec) + ".ts",
          resolve(import.meta.dirname, spec) + ".tsx",
        ].find(existsSync)!;
        return `from ${JSON.stringify(pathToFileURL(path).href)}`;
      },
    );
    const output = join(directory, "cockpit.mjs");
    await writeFile(output, code);
    const Component = (await import(pathToFileURL(output).href))
      .default as typeof Cockpit;
    const scenario = makeScenario(),
      state = replay(scenario, [], 150).snapshot();
    const t = state.tracks.find((t) => t.active && (t.radar || t.thermal))!;
    t.designated = 1;
    t.classification = "quad";
    t.declared = "neutral";
    const actions: Omit<Action, "tick">[] = [];
    let props: ComponentProps<typeof Cockpit> = {
      state,
      scenario,
      phase: "running",
      selected: t.id,
      sessionKey: "session-one",
      feedback: null,
      quality: "low",
      vision: "thermal",
      busy: false,
      startLabel: "Start",
      onStart() {},
      onPause() {},
      onSuspend() {},
      onSelect() {},
      onVision() {},
      onAction(a) {
        actions.push(a);
      },
      onClose() {},
    };
    let mountKey = 0;
    const render = () =>
      act(async () => {
        root.render(<Component key={mountKey} {...props} />);
      });
    const click = async (id: string) => {
      const button = document.querySelector<HTMLButtonElement>(
        `[data-vr-action="${id}"]`,
      )!;
      assert.ok(button && !button.disabled, id + " available");
      await act(async () => button.click());
    };
    const enabled = (id: string) =>
      !document.querySelector<HTMLButtonElement>(`[data-vr-action="${id}"]`)!
        .disabled;
    await render();
    await click("hold");
    assert.equal(actions.length, 0);
    assert.equal(enabled("confirm"), true);
    await click("confirm");
    assert.equal(actions.length, 1);
    assert.equal(enabled("hold"), false);
    assert.equal(enabled("confirm"), false);
    // A receipt for a different contact/action must never unlock this in-flight request.
    props = {
      ...props,
      feedback: {
        seq: 1,
        action: {
          k: "classify",
          track: "other",
          kind: "bird",
          identity: "neutral",
        },
        status: "accepted",
      },
    };
    await render();
    assert.equal(enabled("hold"), false);
    props = {
      ...props,
      feedback: { seq: 2, action: actions[0], status: "accepted" },
    };
    await render();
    assert.equal(enabled("hold"), true);
    await click("hold");
    props = { ...props, phase: "paused" };
    await render();
    assert.equal(enabled("confirm"), false);
    props = { ...props, phase: "running" };
    await render();
    assert.equal(enabled("confirm"), false);
    await click("hold");
    props = { ...props, sessionKey: "session-two" };
    await render();
    assert.equal(enabled("confirm"), false);
    await click("hold");
    props = { ...props, selected: "missing" };
    await render();
    assert.equal(enabled("confirm"), false);
    assert.equal(actions.length, 1);
    props = { ...props, selected: t.id };
    await render();
    await click("hold");
    // Two controller/DOM events can occur before React commits a selection.
    const staleConfirm = document.querySelector<HTMLButtonElement>(
      '[data-vr-action="confirm"]',
    )!;
    await act(async () => {
      document
        .querySelector<HTMLButtonElement>(".vr-contact-picker button")!
        .click();
      staleConfirm.click();
    });
    assert.equal(
      actions.length,
      1,
      "selection clears the confirmation latch synchronously",
    );
    await click("hold");
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + 9000;
      await click("confirm");
    } finally {
      Date.now = originalNow;
    }
    assert.equal(
      actions.length,
      1,
      "confirmation checks expiry at activation, even without a new snapshot",
    );
    props = {
      ...props,
      sessionKey: "fresh",
      selected: "T-FRESH",
      state: {
        ...state,
        tracks: [{ ...t, id: "T-FRESH", classification: null, declared: null }],
      },
    };
    await render();
    assert.equal(enabled("classify"), false, "no inherited default answer");
    assert.match(
      document.querySelector('[data-vr-action="kind"]')!.textContent!,
      /choose/,
    );
    await click("kind");
    assert.equal(enabled("classify"), false, "identity also required");
    await click("identity");
    assert.equal(enabled("classify"), true);
    await click("classify");
    assert.equal(enabled("classify"), false, "duplicate submission is latched");
    assert.deepEqual(actions[1], {
      k: "classify",
      track: "T-FRESH",
      kind: "quad",
      identity: "hostile",
    });
    // Switching contact while its acknowledgment is delayed clears choices,
    // but cannot unlock the still-owned request.
    props = {
      ...props,
      selected: "T-NEXT",
      feedback: { seq: 3, action: actions[1], status: "submitted" },
      state: {
        ...state,
        tracks: [{ ...t, id: "T-NEXT", classification: null, declared: null }],
      },
    };
    await render();
    assert.equal(enabled("kind"), false);
    assert.equal(enabled("classify"), false);
    // Closing/reopening VR loses local component state, never App ownership.
    mountKey++;
    await render();
    assert.equal(enabled("kind"), false);
    assert.equal(enabled("hold"), false);
    props = {
      ...props,
      feedback: { seq: 3, action: actions[1], status: "accepted" },
    };
    await render();
    assert.equal(enabled("kind"), true);
    assert.equal(
      enabled("classify"),
      false,
      "new contact needs explicit answers",
    );
    await click("kind");
    await click("identity");
    props = { ...props, state: { ...props.state, tick: props.state.tick + 1 } };
    await render();
    assert.equal(
      enabled("classify"),
      true,
      "ordinary snapshots preserve unsent choices",
    );
    props = { ...props, sessionKey: "another-exercise" };
    await render();
    assert.equal(
      enabled("classify"),
      false,
      "same contact ID in a new session has no defaults",
    );
    // Re-entry restores only the trainee's own persisted declaration.
    props = {
      ...props,
      state: {
        ...state,
        tracks: [
          { ...t, id: "T-NEXT", classification: "bird", declared: "friendly" },
        ],
      },
    };
    mountKey++;
    await render();
    assert.match(
      document.querySelector('[data-vr-action="kind"]')!.textContent!,
      /Bird/,
    );
    assert.match(
      document.querySelector('[data-vr-action="identity"]')!.textContent!,
      /friendly/,
    );
    assert.equal(enabled("classify"), true);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await rm(directory, { recursive: true, force: true });
  }
});
