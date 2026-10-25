import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { initialTrainingMode, nextTrainingSeed } from "./training-setup";
import { TrainingWelcome } from "./TrainingWelcome";
import DrillSetup from "./DrillSetup";
import { makeScenario } from "./scenario";
test("fresh training defaults to adaptive while explicit legacy/library links remain supported", () => {
  assert.equal(initialTrainingMode(""), "adaptive");
  assert.equal(initialTrainingMode("?mode=adaptive"), "adaptive");
  assert.equal(initialTrainingMode("?mode=scripted"), "scripted");
  assert.equal(initialTrainingMode("?mode=legacy"), "scripted");
  assert.equal(initialTrainingMode("?mode=library"), "library");
  assert.equal(initialTrainingMode("?session=abc&review=officer"), "adaptive");
});
test("unprepared adaptive entry describes a real preparation step without fabricated observations or success prediction", () => {
  const html = renderToStaticMarkup(<TrainingWelcome />);
  assert.match(html, /synthetic environment/);
  assert.match(html, /sensor picture/);
  assert.doesNotMatch(html, /60 fps|100%|live contact|70% success/);
  assert.match(html, /frozen exercise loads after preparation/);
});
test("separated drill setup preserves legacy access, frozen callsign ownership and empty-library recovery", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(
    <DrillSetup
      mode="library"
      onMode={noop}
      night={true}
      onNight={noop}
      seed={9}
      onSeed={noop}
      trainee="opaque-id"
      onTrainee={noop}
      identity={{
        trainee_id: "opaque-id",
        callsign: "CHECK",
        unit_id: "local",
      }}
      profile={null}
      prepared={null}
      onStart={noop}
      busy={false}
      library={[]}
      libraryId=""
      onLibrary={noop}
    />,
  );
  assert.match(html, /value="CHECK"/);
  assert.match(html, /readOnly/);
  assert.match(html, /Original Night Watch/);
  assert.match(html, /No saved exercises/);
  assert.match(html, /href="\/exercises"/);
});
test("saved Finale scenario labels do not invent legacy doctrine or undefined metadata", () => {
  const spec = makeScenario();
  const noop = () => {};
  const html = renderToStaticMarkup(
    <DrillSetup
      mode="library"
      onMode={noop}
      night={true}
      onNight={noop}
      seed={9}
      onSeed={noop}
      trainee="CHECK"
      onTrainee={noop}
      profile={null}
      prepared={null}
      onStart={noop}
      busy={false}
      library={[spec]}
      libraryId={spec.id}
      onLibrary={noop}
    />,
  );
  assert.doesNotMatch(html, /undefined/);
  assert.match(html, /Night watch/);
});

test("new seed wraps the maximum allowed unsigned seed without creating an invalid request", () => {
  assert.equal(nextTrainingSeed(4294967295), 0);
  assert.equal(nextTrainingSeed(482913), 482914);
});

test("pending preparation locks every mutable scenario input until its request finishes", () => {
  const noop = () => {};
  for (const mode of ["adaptive", "library", "scripted"] as const) {
    const html = renderToStaticMarkup(
      <DrillSetup
        mode={mode}
        onMode={noop}
        night={true}
        onNight={noop}
        seed={9}
        onSeed={noop}
        trainee="CHECK"
        onTrainee={noop}
        profile={null}
        prepared={null}
        onStart={noop}
        busy={true}
        library={[makeScenario()]}
        libraryId=""
        onLibrary={noop}
      />,
    );
    const inputs = html.match(/<(?:input|select|button)\b[^>]*>/g) ?? [];
    assert.ok(inputs.length >= 4);
    for (const input of inputs)
      assert.match(
        input,
        /disabled/,
        `Pending ${mode} control must be disabled: ${input}`,
      );
  }
});
