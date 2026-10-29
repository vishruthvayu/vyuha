import test from "node:test";
import assert from "node:assert/strict";
import React, { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { JSDOM } from "jsdom";
import ObservationConsole from "./ObservationConsole";
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
      d.querySelector("button")!.click();
      d.querySelectorAll("button")[1].click();
    });
    await act(async () => root.render(<Station visible={false} />));
    assert.equal(d.querySelector("section")!.hidden, true);
    await act(async () => root.render(<Station visible />));
    assert.match(d.body.textContent!, /Requests 1/);
    assert.equal(d.querySelectorAll(".theatre-camera-dock button").length, 1);
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
