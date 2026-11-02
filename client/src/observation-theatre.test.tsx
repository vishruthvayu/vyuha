import test from "node:test";
import assert from "node:assert/strict";
import React, { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { JSDOM } from "jsdom";
import ObservationConsole from "./ObservationConsole";
import {
  observationDockStatus,
  type ObservationDockSnapshot,
} from "./product/observation-status";
import SiteEpisodeReview from "./SiteEpisodeReview";
import type { GroupResult } from "./Unit";
async function mount(
  run: (d: Document, r: ReturnType<typeof createRoot>) => Promise<void>,
  fetcher?: typeof fetch,
) {
  const dom = new JSDOM('<main id="root"></main>', { url: "http://qa.local" }),
    saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [k, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    ...(fetcher ? { fetch: fetcher } : {}),
  })) {
    saved.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
    Object.defineProperty(globalThis, k, {
      value,
      configurable: true,
      writable: true,
    });
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    await run(dom.window.document, root);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(globalThis, k, d);
      else Reflect.deleteProperty(globalThis, k);
    }
  }
}
test("console retains instrument state and exactly one camera portal across workspace changes", async () =>
  mount(async (d, root) => {
    function Instrument() {
      const [n, set] = useState(0);
      return <button onClick={() => set(n + 1)}>Requests {n}</button>;
    }
    function Station({ visible }: { visible: boolean }) {
      const host = useRef<HTMLDivElement>(null),
        [ready, setReady] = useState(false);
      return (
        <>
          <ObservationConsole visible={visible} controlsHost={host}>
            <Instrument />
          </ObservationConsole>
          <button onClick={() => setReady(true)}>Mount camera</button>
          {ready &&
            host.current &&
            createPortal(<button>Pan camera</button>, host.current)}
        </>
      );
    }
    await act(async () => root.render(<Station visible />));
    await act(async () => {
      d.querySelector<HTMLButtonElement>(
        '[aria-label="Open observation console"]',
      )!.click();
    });
    const instrument = [...d.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Requests"),
    )!;
    const mountCamera = [...d.querySelectorAll("button")].find(
      (b) => b.textContent === "Mount camera",
    )!;
    await act(async () => {
      instrument.click();
      mountCamera.click();
    });
    const camera = d.querySelector(".theatre-camera-dock button");
    const panel = d.getElementById("vyuha-observation-console-panel")!;
    await act(async () =>
      d
        .querySelector<HTMLButtonElement>(
          '[aria-label="Pin observation console"]',
        )!
        .click(),
    );
    assert.equal(d.querySelector("section")!.dataset.pinned, "true");
    await act(async () =>
      d
        .querySelector<HTMLButtonElement>(
          '[aria-label="Close observation console"]',
        )!
        .click(),
    );
    assert.equal(panel.hidden, true);
    assert.equal(d.querySelector("section")!.dataset.pinned, "false");
    assert.equal(
      d.activeElement?.getAttribute("aria-label"),
      "Open observation console",
    );
    assert.equal(d.querySelector(".theatre-camera-dock button"), camera);
    await act(async () =>
      d
        .querySelector<HTMLButtonElement>(
          '[aria-label="Open observation console"]',
        )!
        .click(),
    );
    assert.equal(panel.hidden, false);
    assert.equal(d.querySelector("section")!.dataset.pinned, "true");
    await act(async () => root.render(<Station visible={false} />));
    assert.equal(d.querySelector("section")!.hidden, true);
    await act(async () => root.render(<Station visible />));
    assert.match(d.body.textContent!, /Requests 1/);
    assert.equal(d.querySelectorAll(".theatre-camera-dock button").length, 1);
    assert.equal(d.querySelector(".theatre-camera-dock button"), camera);
    assert.equal(
      [...d.querySelectorAll("button")].find((b) =>
        b.textContent?.startsWith("Requests"),
      ),
      instrument,
    );
    await act(async () =>
      instrument.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    assert.equal(panel.hidden, true);
    assert.equal(
      d.activeElement?.getAttribute("aria-label"),
      "Open observation console",
    );
  }));
test("instructor evidence blocks duplicate requests and preserves separate results and exact Ghost links", async () => {
  let resolve: (r: Response) => void = () => {};
  const calls: string[] = [];
  await mount(
    async (d, root) => {
      await act(async () =>
        root.render(
          <SiteEpisodeReview
            groups={[{ exercise_group_id: "G_one" } as GroupResult]}
          />,
        ),
      );
      const select = d.querySelector("select")!,
        button = d.querySelector("button")!;
      assert.ok(button.disabled);
      await act(async () => {
        select.value = "G_one";
        select.dispatchEvent(new window.Event("change", { bubbles: true }));
      });
      await act(async () => button.click());
      await act(async () => button.click());
      assert.deepEqual(calls, [
        "/api/v1/units/local/exercises/G_one/observation-evidence",
      ]);
      assert.ok(select.disabled);
      await act(async () =>
        resolve(
          new Response(
            JSON.stringify({
              site: "Freight corridor",
              mode: "assessment",
              limitations: ["No mastery inferred."],
              results: [
                {
                  session_id: "s_one",
                  callsign: "SITE-A",
                  verified: true,
                  original_tactical_score: 0,
                  evidence: {
                    observed_end_tick: 330,
                    decisions: 1,
                    requests: 0,
                    competencies: [{ id: "uncertainty", status: "supported" }],
                    declared_deferrals: [
                      {
                        tick: 300,
                        reason: "affiliation_unresolved",
                        track: "T1",
                      },
                    ],
                    follow_up: {
                      href: "/?mission_site=freight_corridor",
                      reason: "Practice evidence reconciliation",
                    },
                  },
                },
                {
                  session_id: "s_two",
                  callsign: "SITE-B",
                  status: "active",
                  verified: false,
                  evidence: null,
                },
              ],
            }),
            { status: 200 },
          ),
        ),
      );
      assert.match(d.body.textContent!, /Verified tactical score 0\/100/);
      assert.match(d.body.textContent!, /11.0s observed/);
      assert.match(d.body.textContent!, /active · evidence pending/);
      assert.match(d.body.textContent!, /no mastery inferred/);
      assert.equal(
        d.querySelector("a")!.getAttribute("href"),
        "/?session=s_one&review=officer",
      );
      assert.equal(d.querySelectorAll("a").length, 2);
    },
    ((url: string) => {
      calls.push(url);
      return new Promise<Response>((r) => (resolve = r));
    }) as typeof fetch,
  );
});

const pendingObservation = {
  id: "request-one",
  trackId: "T1",
  channel: "eo" as const,
  acceptedTick: 10,
  acceptedOrder: 1,
  sampleTick: 20,
  releaseTick: 30,
  resultId: "result-one",
};
const publishedObservation = {
  ...pendingObservation,
  releasedOrder: 2,
  expiryTick: 60,
  reading: { available: true, level: "none" as const },
};
test("collapsed console reports only authoritative phase boundaries without remounting or opening on selection changes", async () =>
  mount(async (d, root) => {
    function Station({
      snapshot,
      selected,
    }: {
      snapshot: ObservationDockSnapshot;
      selected: string;
    }) {
      const host = useRef<HTMLDivElement>(null);
      return (
        <ObservationConsole visible controlsHost={host} snapshot={snapshot}>
          <label>
            Reported contact
            <input value={selected} readOnly />
          </label>
        </ObservationConsole>
      );
    }
    const pending: ObservationDockSnapshot = {
      tick: 15,
      acquisition: { pending: pendingObservation, results: [] },
    };
    const source = structuredClone(pending);
    await act(async () =>
      root.render(<Station snapshot={pending} selected="T1" />),
    );
    const instrument = d.querySelector("input");
    const panel = d.getElementById("vyuha-observation-console-panel")!;
    assert.match(
      d.querySelector('[role="status"]')!.textContent!,
      /EO task pending · T1/,
    );
    await act(async () =>
      root.render(
        <Station snapshot={{ ...pending, tick: 25 }} selected="T2" />,
      ),
    );
    assert.equal(d.querySelector("input"), instrument);
    assert.equal(panel.hidden, true);
    assert.match(
      d.querySelector('[role="status"]')!.textContent!,
      /EO task pending · T1/,
    );
    const released: ObservationDockSnapshot = {
      tick: 30,
      acquisition: { pending: null, results: [publishedObservation] },
    };
    await act(async () =>
      root.render(<Station snapshot={released} selected="T2" />),
    );
    assert.match(
      d.querySelector('[role="status"]')!.textContent!,
      /Published evidence · EO · T1/,
    );
    await act(async () =>
      root.render(
        <Station snapshot={{ ...released, tick: 59 }} selected="T2" />,
      ),
    );
    assert.match(
      d.querySelector('[role="status"]')!.textContent!,
      /Published evidence/,
    );
    await act(async () =>
      root.render(
        <Station snapshot={{ ...released, tick: 60 }} selected="T2" />,
      ),
    );
    assert.match(
      d.querySelector('[role="status"]')!.textContent!,
      /Expired evidence · EO · T1/,
    );
    assert.equal(d.querySelector("input"), instrument);
    assert.equal(panel.hidden, true);
    assert.deepEqual(pending, source);
  }));
test("sensor ribbon rejects future or malformed publication boundaries and does not turn no-detection into identity", () => {
  const snapshot = (
    results: NonNullable<ObservationDockSnapshot["acquisition"]>["results"],
  ) => ({ tick: 30, acquisition: { pending: null, results } });
  assert.equal(
    observationDockStatus(
      snapshot([{ ...publishedObservation, releaseTick: 31 }]),
    )?.text,
    "No optical publication yet",
  );
  for (const result of [
    { ...publishedObservation, sampleTick: NaN },
    { ...publishedObservation, acceptedTick: -1 },
    { ...publishedObservation, expiryTick: 30 },
  ])
    assert.equal(
      observationDockStatus(snapshot([result]))?.text,
      "No optical publication yet",
    );
  assert.equal(
    observationDockStatus(snapshot([publishedObservation]))?.text,
    "Published evidence · EO · T1",
  );
  assert.equal(
    observationDockStatus(
      snapshot([
        {
          ...publishedObservation,
          reading: { available: false, level: "none" },
        },
      ]),
    )?.text,
    "Channel unavailable · EO · T1",
  );
});
