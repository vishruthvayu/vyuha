import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import React, { createRef, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { mkdtemp, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { makeScenario } from "./scenario";
import { Simulation, score } from "./sim";
import type { Record as TrainingRecord } from "./types";
type SceneProps = React.ComponentProps<typeof import("./Scene").Scene>;
type XRProps = React.ComponentProps<typeof import("./VRWorld").VRWorld>;
type TheatreProps = React.ComponentProps<
  typeof import("./ReviewTheatre").default
>;
let directory: string;
let Scene: ComponentType<SceneProps>;
let XR: ComponentType<XRProps>;
let Theatre: ComponentType<TheatreProps>;
before(async () => {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url));
  directory = await mkdtemp(join(tmpdir(), "vyuha-world-flow-"));
  await symlink(
    resolve(sourceDirectory, "../node_modules"),
    join(directory, "node_modules"),
  );
  const capture = join(directory, "capture.mjs"),
    fiber = join(directory, "fiber.mjs");
  await writeFile(
    capture,
    `import React from 'react';
    const capture=(kind,p)=>React.createElement('div',{['data-'+kind]:JSON.stringify(p.sensorConfig??null),'data-origin':JSON.stringify(p.sensorOrigin??null),'data-site':JSON.stringify(p.trainingSite??null)});
    export const Environment=p=>capture('environment',p),InspectionPass=p=>capture('inspection',p),Scene=p=>capture('scene',p),ContactRenderer=()=>null,WorldSurveyControls=p=>capture('survey',p);
    export const LAYER_WORLD=0,LAYER_CONTACTS=1,LAYER_OCCLUDERS=2;`,
  );
  await writeFile(
    fiber,
    `import React from 'react';import {PerspectiveCamera,Scene} from 'three';
    const camera=new PerspectiveCamera(38,1.6,.5,20000),scene=new Scene();
    export const Canvas=p=>React.createElement(React.Fragment,null,p.children),useFrame=()=>{},useThree=()=>({camera,scene,size:{width:960,height:600},gl:{info:{},shadowMap:{}}});`,
  );
  async function load(file: string) {
    const source = await readFile(join(sourceDirectory, file), "utf8");
    const output = ts
      .transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      })
      .outputText.replace(
        /from\s+(["'])([^"']+)\1/g,
        (original, _quote, specifier: string) => {
          if (specifier === "@react-three/fiber")
            return `from ${JSON.stringify(pathToFileURL(fiber).href)}`;
          if (
            [
              "./LazyScene",
              "./world/Environment",
              "./InspectionPass",
              "./ContactRenderer",
              "./WorldSurveyControls",
            ].includes(specifier)
          )
            return `from ${JSON.stringify(pathToFileURL(capture).href)}`;
          if (!specifier.startsWith("./")) return original;
          const base = resolve(sourceDirectory, specifier);
          const dependency = [base + ".ts", base + ".tsx"].find(existsSync)!;
          return `from ${JSON.stringify(pathToFileURL(dependency).href)}`;
        },
      );
    const path = join(directory, file + ".mjs");
    await writeFile(path, output);
    return import(pathToFileURL(path).href);
  }
  Scene = (await load("Scene.tsx")).Scene;
  XR = (await load("VRWorld.tsx")).VRWorld;
  Theatre = (await load("ReviewTheatre.tsx")).default;
});
after(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
const config = {
  eo_ifov_rad: 0.00024,
  ir_ifov_rad: 0.00009,
  eo_max_range_m: 10000,
  clear_visibility_m: 30000,
  dense_visibility_m: 500,
  ir_fog_factor: 0.8,
};
function readCapture(html: string, kind: string) {
  const dom = new JSDOM(html);
  try {
    const node = dom.window.document.querySelector(`[data-${kind}]`);
    assert.ok(node, `Missing ${kind} configuration forwarding`);
    return JSON.parse(node.getAttribute(`data-${kind}`)!);
  } finally {
    dom.window.close();
  }
}
test("actual browser Scene forwards frozen configuration to both environment and sensor-limited inspection", () => {
  const scenario = makeScenario(),
    state = new Simulation(scenario).snapshot();
  const before = JSON.stringify({ scenario, state, config });
  const html = renderToStaticMarkup(
    <Scene
      state={state}
      selected={null}
      vision="day"
      onFps={() => {}}
      sensorConfig={config}
      fallback={<p>Fallback</p>}
    />,
  );
  assert.deepEqual(readCapture(html, "environment"), config);
  assert.deepEqual(readCapture(html, "inspection"), config);
  assert.equal(JSON.stringify({ scenario, state, config }), before);
});
test("actual XR world forwards the same scenario configuration without adding browser inspection", () => {
  const scenario = { ...makeScenario(), sensor_config: config };
  const state = new Simulation(scenario).snapshot();
  const before = JSON.stringify({ scenario, state });
  const html = renderToStaticMarkup(
    <XR
      scenario={scenario}
      state={state}
      selected={null}
      vision="thermal"
      context="world-config"
      quality="medium"
    />,
  );
  assert.deepEqual(readCapture(html, "environment"), config);
  assert.doesNotMatch(html, /data-inspection/);
  assert.equal(JSON.stringify({ scenario, state }), before);
});
test("actual reconstruction theatre preserves source sensor configuration when creating its modeled scene", () => {
  const scenario = { ...makeScenario(), sensor_config: config };
  const simulation = new Simulation(scenario);
  const record: TrainingRecord = {
    id: "world-config-review",
    trainee: "QA",
    scenario,
    events: [],
    endTick: 0,
    scorecard: score(simulation),
    created_at: "2026-10-25T00:00:00Z",
    verified: true,
  };
  const before = JSON.stringify(record);
  const html = renderToStaticMarkup(
    <Theatre
      record={record}
      snapshot={simulation.snapshot()}
      tick={0}
      endTick={0}
      selected={null}
      decisionId={null}
      playing={false}
      quality="medium"
      headingRef={createRef<HTMLHeadingElement>()}
      inspector={<p>Evidence</p>}
      onSeek={() => {}}
      onSelect={() => {}}
      onDecision={() => {}}
      onPlay={() => {}}
    />,
  );
  assert.deepEqual(readCapture(html, "scene"), config);
  assert.equal(JSON.stringify(record), before);
});

test("authored public site reaches the real browser environment and briefing survey without admitting contact truth", () => {
  const site: import("./training-site-contract").TrainingSite = {
    version: "training-site-v1",
    id: "freight_corridor",
    title: "Fixture site",
    summary: "Public geometry",
    structures: [
      {
        id: "hall",
        label: "Hall",
        style: "warehouse",
        x_min: 50,
        x_max: 90,
        z_min: 150,
        z_max: 200,
        height: 12,
      },
    ],
    surfaces: [],
    landmarks: [],
  };
  const scenario = makeScenario(),
    state = new Simulation(scenario).snapshot();
  const html = renderToStaticMarkup(
    <Scene
      state={state}
      selected={null}
      vision="day"
      onFps={() => {}}
      sensorConfig={config}
      trainingSite={site}
      terrainBoxes={site.structures}
      presentation="briefing"
      briefingSurvey={true}
      fallback={<p>Fallback</p>}
    />,
  );
  const dom = new JSDOM(html);
  try {
    for (const kind of ["environment", "survey"]) {
      const node = dom.window.document.querySelector(`[data-${kind}]`)!;
      assert.ok(node);
      assert.deepEqual(JSON.parse(node.getAttribute("data-site")!), site);
    }
  } finally {
    dom.window.close();
  }
});
