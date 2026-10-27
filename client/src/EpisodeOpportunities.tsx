import { useEffect, useId, useRef, useState } from "react";
import type { Scenario } from "./types";
import {
  OPPORTUNITY_CHANNELS,
  opportunityStateLabel,
  requestEpisodeOpportunities,
  type EpisodeOpportunities as Rehearsal,
  type OpportunityChannel,
} from "./episode-opportunities";
export type OpportunityInspection = {
  scenarioId: string;
  trackId: string;
  tick: number;
};
/** Officer-only composition below the frozen spatial rehearsal. Parent callback
 * may seek its reference world; this component never changes a live exercise. */
export default function EpisodeOpportunities(props: {
  scenario: Scenario;
  stale?: boolean;
  onInspect?: (moment: OpportunityInspection) => void;
}) {
  return (
    <OpportunityRun
      key={`${props.scenario.id}:${props.scenario.raid?.fingerprint}`}
      {...props}
    />
  );
}
function OpportunityRun({
  scenario,
  stale = false,
  onInspect,
}: {
  scenario: Scenario;
  stale?: boolean;
  onInspect?: (moment: OpportunityInspection) => void;
}) {
  const [result, setResult] = useState<Rehearsal | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [channel, setChannel] = useState<OpportunityChannel>("radar"),
    [selected, setSelected] = useState(scenario.tracks[0]?.id ?? ""),
    [limit, setLimit] = useState(20);
  const epoch = useRef(0),
    pending = useRef(false),
    staleRef = useRef(stale),
    heading = useId();
  staleRef.current = stale;
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  useEffect(() => {
    if (stale) {
      epoch.current++;
      pending.current = false;
      setBusy(false);
      setResult(null);
    }
  }, [stale]);
  const supported =
    scenario.engine_version === "vyuha-0.4.0" &&
    scenario.tracks.length <= 20 &&
    scenario.tracks.length * scenario.duration * 30 <= 72000;
  async function run() {
    if (stale || !supported || pending.current) return;
    const request = ++epoch.current;
    pending.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const value = await requestEpisodeOpportunities(scenario);
      if (epoch.current === request && !staleRef.current) setResult(value);
    } catch (failure) {
      if (epoch.current === request)
        setError(
          (failure as Error).message ||
            "Report rehearsal unavailable. The frozen exercise is unchanged.",
        );
    } finally {
      if (epoch.current === request) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  const contact = result?.contacts.find((c) => c.track_id === selected),
    intervals = contact?.channels[channel].intervals ?? [],
    end = result?.horizon.end_tick_exclusive ?? scenario.duration * 30;
  const choose = (trackId: string) => {
    setSelected(trackId);
    setLimit(20);
  };
  return (
    <section
      className="episode-opportunities"
      aria-labelledby={heading}
      aria-busy={busy}
    >
      <header>
        <p className="eyebrow">03 / MODELED EVIDENCE REHEARSAL</p>
        <h3 id={heading}>Test the information your exercise can provide</h3>
        <strong className="opportunity-boundary">
          AUTHOR COUNTERFACTUAL · NO TRAINEE ACTIONS
        </strong>
        <p>
          Reconstruct the unchanged sensor engine over this frozen raid, inspect
          when reports appear or remain insufficient, then revisit that moment
          in the spatial reference. This is a passive model run, not what a
          trainee noticed or a solvability certification.
        </p>
      </header>
      {!supported && (
        <p role="note">
          This bounded rehearsal supports engine 0.4, at most 20 planned
          contacts and 72,000 contact-ticks. Reduce the roster or duration to
          inspect it; saving and running a valid larger exercise remain
          separate.
        </p>
      )}
      {stale && (
        <p role="status">
          Exercise settings changed. Compile a new frozen preview before
          reconstructing its reports.
        </p>
      )}
      <button
        type="button"
        className="button"
        onClick={() => void run()}
        disabled={stale || !supported || busy}
      >
        {busy
          ? "Reconstructing modeled reports…"
          : result
            ? "Reconstruct reports again"
            : "Reconstruct modeled reports"}
      </button>
      {error && <p role="alert">{error} No partial timeline is shown.</p>}
      {result && !stale && (
        <>
          <p className="opportunity-source">
            Frozen source {result.scenario_id} · {result.planned_contacts}{" "}
            planned contacts · {result.horizon.end_tick_exclusive / 30}s · no
            actions or commands applied
          </p>
          <nav
            aria-label="Modeled report channel"
            className="opportunity-channels"
          >
            {OPPORTUNITY_CHANNELS.map((name) => (
              <button
                type="button"
                className="button subtle"
                key={name}
                aria-pressed={channel === name}
                onClick={() => {
                  setChannel(name);
                  setLimit(20);
                }}
              >
                {name.toUpperCase()}
              </button>
            ))}
          </nav>
          <figure className="opportunity-timeline">
            <svg
              viewBox={`0 0 1000 ${result.contacts.length * 32 + 36}`}
              role="img"
              aria-label={`${channel.toUpperCase()} modeled report intervals for every planned contact; native contact and interval controls follow`}
            >
              <text x="60" y="14">
                0s
              </text>
              <text x="940" y="14" textAnchor="end">
                {end / 30}s
              </text>
              {result.contacts.map((row, i) => (
                <g key={row.track_id}>
                  <text x="8" y={40 + i * 32}>
                    {row.track_id}
                  </text>
                  {row.channels[channel].intervals.map((window, n) => (
                    <rect
                      key={n}
                      x={60 + (window.first_tick / end) * 880}
                      y={23 + i * 32}
                      width={Math.max(
                        0.1,
                        ((window.end_tick_exclusive - window.first_tick) /
                          end) *
                          880,
                      )}
                      height="22"
                      className={`opportunity-state state-${window.state}`}
                    >
                      <title>
                        {row.track_id}: {opportunityStateLabel(window.state)};
                        T+{(window.first_tick / 30).toFixed(2)} to{" "}
                        {(window.end_tick_exclusive / 30).toFixed(2)}s, end
                        excluded
                      </title>
                    </rect>
                  ))}
                </g>
              ))}
            </svg>
            <figcaption>
              Exact logical report intervals, including unavailable and
              no-detection gaps. Shape quality is not type or affiliation.
              Inactive periods are not evidence opportunities.
            </figcaption>
          </figure>
          <ul
            className="opportunity-legend"
            aria-label={`${channel.toUpperCase()} chart legend`}
          >
            {[
              ...new Set(
                result.contacts.flatMap((row) =>
                  Object.keys(row.channels[channel].state_ticks),
                ),
              ),
            ].map((state) => (
              <li key={state}>
                <svg aria-hidden="true" viewBox="0 0 14 14">
                  <rect
                    width="14"
                    height="14"
                    className={`opportunity-state state-${state}`}
                  />
                </svg>
                {opportunityStateLabel(state)}
              </li>
            ))}
          </ul>
          <div className="opportunity-controls">
            <label>
              Planned contact
              <select value={selected} onChange={(e) => choose(e.target.value)}>
                {result.contacts.map((row) => (
                  <option key={row.track_id}>{row.track_id}</option>
                ))}
              </select>
            </label>
            <p>
              {contact?.active_ticks
                ? `${(contact.active_ticks / 30).toFixed(2)}s active in the unintervened model`
                : "No active interval in this horizon"}
            </p>
          </div>
          <ol
            className="opportunity-intervals"
            aria-label={`${selected} ${channel.toUpperCase()} exact report intervals`}
          >
            {intervals.slice(0, limit).map((window, i) => (
              <li key={i}>
                <span>
                  <strong>{opportunityStateLabel(window.state)}</strong>
                  <span>
                    T+{(window.first_tick / 30).toFixed(2)}–
                    {(window.end_tick_exclusive / 30).toFixed(2)}s · end
                    excluded
                  </span>
                  <small>
                    {window.first_sample_tick === null
                      ? "Separate sample time not recorded"
                      : `Sample clocks in this interval: ${(window.first_sample_tick / 30).toFixed(2)}–${(window.last_sample_tick! / 30).toFixed(2)}s; held reports may repeat a sample`}
                  </small>
                </span>
                {onInspect && (
                  <button
                    type="button"
                    className="button subtle"
                    onClick={() =>
                      onInspect({
                        scenarioId: result.scenario_id,
                        trackId: selected,
                        tick: window.first_tick,
                      })
                    }
                  >
                    Inspect reference at {(window.first_tick / 30).toFixed(2)}s
                  </button>
                )}
              </li>
            ))}
          </ol>
          {intervals.length > limit && (
            <button
              type="button"
              className="button subtle"
              onClick={() => setLimit((n) => n + 20)}
            >
              Show more exact intervals ({intervals.length - limit} remaining)
            </button>
          )}
          <p className="opportunity-limitation">{result.limitation}</p>
        </>
      )}
    </section>
  );
}
