import test from "node:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import RaidStudio from "./RaidStudio";
import ExerciseStudio from "./ExerciseStudio";
import { WhiteCell } from "./WhiteCell";
import { CrewPicture, type CrewState } from "./Crew";
import { crewTask } from "./command-crew-context";
import type { Scenario } from "./types";

async function mounted(
  node: ReactNode,
  fetcher: typeof fetch,
  body: (document: Document) => Promise<void>,
) {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
    url: "http://qa.local",
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    await act(async () => root.render(node));
    await body(dom.window.document);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test("White Cell never substitutes a different picture for a controlled missing command target", async () => {
  const selected: string[] = [];
  await mounted(
    <WhiteCell
      selectedSessionId="selected-completed"
      onSelectSession={(id) => selected.push(id)}
    />,
    async () =>
      new Response(
        JSON.stringify({
          schema_version: 1,
          pictures: [
            {
              schema_version: 1,
              session_id: "different-active",
              status: "RECONSTRUCTION_UNAVAILABLE",
              error: "Other trainee reconstruction",
            },
          ],
        }),
      ),
    async (document) => {
      assert.match(
        document.body.textContent!,
        /No current picture for the selected session/,
      );
      assert.equal(
        document.querySelector('[aria-pressed="true"]')?.textContent,
        "Observed evidence",
      );
      const other = [...document.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Other trainee reconstruction"),
      )!;
      assert.equal(other.getAttribute("aria-pressed"), "false");
      await act(async () => other.click());
      assert.deepEqual(selected, ["different-active"]);
      assert.match(
        document.body.textContent!,
        /No current picture for the selected session/,
      );
    },
  );
});

test("Composer labels an outdated result, freezes in-flight inputs, and sends the new saved configuration", async () => {
  const bodies: { name: string }[] = [];
  const saved: Scenario[] = [];
  let release: (() => void) | undefined;
  await mounted(
    <RaidStudio onSaved={(scenario) => saved.push(scenario)} />,
    async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (bodies.length === 1)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return new Response(
        JSON.stringify({
          id: `raid-${bodies.length}`,
          title: bodies.at(-1)!.name,
          duration: 90,
          tracks: [],
          engine_version: "vyuha-0.4.0",
          raid: { family: "DIRECT", fingerprint: "frozen" },
        }),
      );
    },
    async (document) => {
      const button = (name: string) =>
        [...document.querySelectorAll("button")].find(
          (element) => element.textContent === name,
        )!;
      await act(async () => {
        button("Preview raid").click();
      });
      assert.equal(document.querySelector("fieldset")!.disabled, true);
      await act(async () => {
        release!();
      });
      assert.equal(document.querySelector("fieldset")!.disabled, false);
      assert.match(document.body.textContent!, /Raid preview/);
      const name = [...document.querySelectorAll("label")]
        .find((label) => label.textContent === "Name")!
        .querySelector("input")!;
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          document.defaultView!.HTMLInputElement.prototype,
          "value",
        )!.set!;
        setter.call(name, "Changed raid");
        name.dispatchEvent(
          new document.defaultView!.Event("input", { bubbles: true }),
        );
        name.dispatchEvent(
          new document.defaultView!.Event("change", { bubbles: true }),
        );
      });
      assert.match(
        document.querySelector('[role="status"]')!.textContent!,
        /previous configuration/,
      );
      await act(async () => button("Compile and save frozen raid").click());
      assert.equal(bodies.at(-1)!.name, "Changed raid");
      assert.equal(saved.length, 1);
      assert.equal(saved[0].title, "Changed raid");
      assert.equal(document.querySelector('[role="status"]'), null);
      assert.match(document.body.textContent!, /Frozen raid saved/);
    },
  );
});

test("Crew task guidance uses current observations and role prerequisites, with explicit completed scope", () => {
  const state = {
    role: "responder",
    status: "active",
    paused: false,
    done: false,
    contacts: [{ id: "T1", designated: null, classification: null }],
  } as CrewState;
  assert.match(crewTask(state, ""), /Select a currently observed/);
  assert.match(crewTask(state, "T1"), /Waiting for the spotter/);
  assert.match(
    crewTask(
      { ...state, contacts: [{ ...state.contacts[0], designated: 30 }] },
      "T1",
    ),
    /Classify T1/,
  );
  assert.match(
    crewTask(
      {
        ...state,
        contacts: [
          { ...state.contacts[0], designated: 30, classification: "quad" },
        ],
      },
      "T1",
    ),
    /Choose a simulated response/,
  );
  assert.match(
    crewTask({ ...state, contacts: [] }, "T1"),
    /no current observation.*wait for reacquisition/,
  );
  assert.match(
    crewTask({ ...state, status: "completed" }, "T1"),
    /Review the shared result/,
  );
});

test("Exercise Studio makes a newly frozen raid assignable immediately without a page reload or missing legacy labels", async () => {
  await mounted(
    <ExerciseStudio />,
    async (input) => {
      const path = String(input);
      let value: unknown;
      if (path.endsWith("/doctrine-packs")) value = { packs: [] };
      else if (path.endsWith("/units"))
        value = { units: [{ id: "local", name: "Local" }] };
      else if (path.endsWith("/scenario-library")) value = { scenarios: [] };
      else if (path.endsWith("/doctrine")) value = { id: "army-forward-post" };
      else if (path.endsWith("/trainees")) value = { trainees: [] };
      else if (path.endsWith("/raids"))
        value = {
          id: "saved-frozen",
          title: "New frozen raid",
          duration: 90,
          tracks: [],
          engine_version: "vyuha-0.4.0",
          raid: { family: "DIRECT", fingerprint: "new-frozen" },
        };
      else throw new Error(`Unexpected request ${path}`);
      return new Response(JSON.stringify(value));
    },
    async (document) => {
      const button = [...document.querySelectorAll("button")].find(
        (element) => element.textContent === "Compile and save frozen raid",
      )!;
      await act(async () => button.click());
      const library = document.querySelector("#scenario-library")!;
      const select = library.querySelector("select")!;
      assert.equal(select.value, "saved-frozen");
      assert.match(select.textContent!, /New frozen raid.*DIRECT.*vyuha-0.4.0/);
      assert.ok(!library.textContent!.includes("undefined"));
      assert.match(
        document.querySelector('[role="status"]')!.textContent!,
        /saved and selected/,
      );
    },
  );
});

test("Crew picture presents the assigned callsign without inventing identity or rendering hidden contacts", () => {
  const state = {
    name: "Shared acceptance",
    role: "spotter",
    member_id: "member-watch",
    roster: [{ id: "member-watch", callsign: "WATCH", role: "spotter" }],
    tick: 30,
    duration: 90,
    status: "active",
    paused: false,
    done: false,
    contacts: [],
    note: "Shared scope",
    clock_note: "Server clock",
  } as unknown as CrewState;
  const html = renderToStaticMarkup(<CrewPicture state={state} />);
  assert.match(html, /WATCH.*Shared acceptance/);
  assert.match(html, /SHARED EXERCISE/);
  assert.ok(!html.includes("T1"));
  const unknown = renderToStaticMarkup(
    <CrewPicture state={{ ...state, roster: [] }} />,
  );
  assert.match(unknown, /Assigned role/);
  assert.ok(!unknown.includes("WATCH"));
});
