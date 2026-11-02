import type { EvidenceSupport } from "./ObservationAssessmentReview";
import type { ObservationTemplate, MissionMode } from "./observation-missions";
export type JourneyEvidence = {
  session_id: string;
  scenario_id: string;
  created_at: string;
  completed_at: string | null;
  evidence_at: string;
  evidence_time_source: "completed_at" | "created_at_legacy_fallback";
  competency: string;
  template: ObservationTemplate;
  mission_version: string;
  assessment_version: string;
  site: string | null;
  mode: MissionMode;
  status: EvidenceSupport;
  criterion: string;
  report_hash: string;
  href: string;
  decisions: { id: string; tick: number; order: number }[];
};
export type JourneyCandidate = {
  competency: string;
  template: ObservationTemplate;
  mode: MissionMode;
  priority: number;
  prior_context_sessions: number;
  already_supported: boolean;
  rank: number[];
  based_on: JourneyEvidence[];
};
export type LearningJourney = {
  version: "observation-journey-v1";
  trainee: string;
  window: {
    limit: number;
    included_sessions: number;
    total_sessions: number;
    truncated: boolean;
    ordering: string;
  };
  competencies: {
    id: string;
    title: string;
    state:
      | "independent-gap"
      | "independent-supported"
      | "practice-only"
      | "not-observed";
    latest_practice: JourneyEvidence | null;
    latest_independent: JourneyEvidence | null;
    independent_contexts: number;
    evidence: JourneyEvidence[];
  }[];
  recommendation: JourneyCandidate & {
    policy: string;
    seed: number;
    mission_version: number;
    site: string | null;
    reason: string;
    novelty: string;
    href: string;
  };
  candidates: JourneyCandidate[];
  limitations: string[];
};
export function journeyMatches(value: LearningJourney, trainee: string) {
  return (
    value?.version === "observation-journey-v1" &&
    value.trainee === trainee &&
    Array.isArray(value.competencies) &&
    Array.isArray(value.candidates) &&
    Boolean(value.recommendation?.href) &&
    Boolean(value.window)
  );
}
