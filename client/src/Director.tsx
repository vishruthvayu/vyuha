import type {
  Scenario,
  GhostSkill,
  TrainingProfile,
  DirectorDecision,
} from "./types";
import { skillLabel } from "./Ghost";
export function ProfilePanel({ profile }: { profile: TrainingProfile | null }) {
  return (
    <section className="panel training-profile">
      <div className="panel-header">
        <strong>Training profile</strong>
        <span className="status">SERVER EVIDENCE</span>
      </div>
      {profile?.version === "shared-crew-not-individual" ? (
        <p>
          This is a shared crew result. Individual mastery is not inferred or
          copied to crew members.
        </p>
      ) : !profile ? (
        <p>
          Connect to the original local server to load the four-skill profile.
        </p>
      ) : (
        <>
          <p>
            VYUHA training mastery estimates · {profile.sessions} processed
            sessions · not validated operational competence.
          </p>
          <div className="ghost-skill-grid">
            {Object.entries(profile.skills).map(([skill, p]) => (
              <div key={skill}>
                <span>{skillLabel[skill as GhostSkill]}</span>
                <strong>{Math.round(p.mean * 100)}%</strong>
                <small>
                  {p.observations === 0
                    ? "Baseline prior · 0 observations"
                    : `${p.observations} observations${p.observations < 5 ? " · limited evidence" : ""}`}
                </small>
                <small>
                  Beta({p.alpha}, {p.beta})
                </small>
              </div>
            ))}
          </div>
          {profile.unprocessed_sessions.length > 0 && (
            <p>
              {profile.unprocessed_sessions.length} legacy sessions could not be
              reconstructed and are excluded.
            </p>
          )}
        </>
      )}
    </section>
  );
}
export function DirectorCard({
  decision,
  onStart,
  busy,
}: {
  decision: DirectorDecision;
  onStart?: () => void;
  busy: boolean;
}) {
  return (
    <section className="panel director-card">
      <div className="panel-header">
        <strong>Next adaptive drill</strong>
        <span className="status">INDIVIDUAL DIRECTOR</span>
      </div>
      <div className="ghost-skill-grid">
        <div>
          <span>Training focus</span>
          <strong>{skillLabel[decision.focus_skill]}</strong>
        </div>
        <div>
          <span>Estimated mastery</span>
          <strong>{Math.round(decision.mastery_estimate * 100)}%</strong>
          <small>
            {decision.observations
              ? `${decision.observations} observations${decision.observations < 5 ? " · limited evidence" : ""}`
              : "Baseline prior · 0 observations"}
          </small>
        </div>
        <div>
          <span>Difficulty</span>
          <strong>{decision.difficulty_label}</strong>
        </div>
        <div>
          <span>Selection basis</span>
          <strong>Training challenge</strong>
          <details className="director-basis">
            <summary>Difficulty model</summary>
            <small>
              ≈70% success is a heuristic difficulty target, not a calibrated
              prediction of your next result.
            </small>
          </details>
        </div>
      </div>
      <h3>Why this focus?</h3>
      <p>{decision.reason}</p>
      <h3>Scenario conditions</h3>
      <ul>
        {decision.scenario_features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p className="footnote">
        {decision.scenario_template} · Seed {decision.scenario_seed}.{" "}
        {decision.anti_rote.rejected_candidates} recent templates avoided.
        {decision.anti_rote.fallback
          ? " All candidates were recent; the least-recent suitable template was used."
          : ""}
      </p>
      {onStart && (
        <button
          className="button primary"
          onClick={onStart}
          disabled={busy}
          title={busy ? "A server request is in progress." : undefined}
        >
          Start adaptive drill
        </button>
      )}
    </section>
  );
}
export async function launchPreparedScenario(
  scenario: Scenario,
  trainee: string,
  create: (body: {
    scenario_id: string;
    trainee: string;
  }) => Promise<{ id: string }>,
) {
  if (
    scenario.director_decision &&
    scenario.director_decision.trainee_id !== trainee
  )
    throw new Error("Prepare this trainee’s adaptive drill first.");
  const session = await create({ scenario_id: scenario.id, trainee });
  return { scenario, sessionId: session.id };
}
