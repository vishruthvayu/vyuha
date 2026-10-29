import type { Scenario, Action } from "./types";
export type ObservationTemplate =
  "night_switch" | "civil_restraint" | "timed_window";
export type MissionMode = "practice" | "assessment";
export type ObservationMissionRequest = {
  version:
    | "observation-mission-v1"
    | "observation-mission-v2"
    | "observation-mission-v3";
  site?: "freight_corridor" | "open_campus";
  template: ObservationTemplate;
  seed: number;
  mode: MissionMode;
  title: string;
  duration: number;
  terrain: "urban" | "rural" | null;
  night: boolean | null;
  fog: number | null;
  dwell_ticks: number;
  expiry_ticks: number | null;
  objectives: string[] | null;
  extra_contacts: number;
};
export type ObservationMission = {
  version:
    | "observation-mission-v1"
    | "observation-mission-v2"
    | "observation-mission-v3";
  assessment_version: "evidence-assessment-v1" | "evidence-assessment-v2";
  template: ObservationTemplate;
  criterion_profile: ObservationTemplate;
  mode: MissionMode;
  title: string;
  objectives: string[];
  competencies: string[];
  authoring: ObservationMissionRequest;
};
export type MissionTemplateBrief = {
  id: ObservationTemplate;
  title: string;
  summary: string;
  objectives: string[];
  competencies: string[];
  default_conditions: {
    night: boolean;
    fog: number;
    terrain: "urban" | "rural";
  };
};
export type ObservationMissionCatalog = {
  version:
    | "observation-mission-v1"
    | "observation-mission-v2"
    | "observation-mission-v3";
  templates: MissionTemplateBrief[];
  missions: {
    id: string;
    mission_version?: 1 | 2 | 3;
    title: string;
    objectives: string[];
    mode: MissionMode;
    template: ObservationTemplate;
  }[];
};
export type MissionRehearsal = {
  site_geometry?: {
    version: "training-site-rehearsal-v1";
    site_id: string;
    line_of_sight_intervals: {
      track: string;
      start_tick: number;
      end_tick: number;
      clear: boolean;
    }[];
    clear_after_occlusion: boolean;
    scope: string;
  };
  version: "observation-mission-rehearsal-v1";
  scenario_id: string;
  request_schedule: Action[];
  results: {
    id: string;
    trackId: string;
    channel: "eo" | "ir";
    acceptedTick: number;
    sampleTick: number;
    releaseTick: number;
    expiryTick: number;
    reading: { available: boolean; level: string };
  }[];
  passive_intervals: {
    track: string;
    channel: string;
    start_tick: number;
    end_tick: number;
    active: boolean;
    available: boolean;
    state: string;
  }[];
  coverage: {
    radar_aliases: string[];
    accepted_requests: number;
    published_results: number;
    unavailable_results: number;
    optical_detections: number;
    positive_affiliation_reports: {
      track: string;
      tick: number;
      cue: string;
    }[];
  };
  checks: { id: string; passed: boolean; description: string }[];
  attainable_probe: boolean;
  limitations: string[];
};
export type CompiledObservationMission = {
  scenario: Scenario;
  rehearsal: MissionRehearsal;
};
export const initialMissionRequest: ObservationMissionRequest = {
  version: "observation-mission-v3",
  site: "freight_corridor",
  template: "night_switch",
  seed: 482913,
  mode: "practice",
  title: "",
  duration: 90,
  terrain: null,
  night: null,
  fog: null,
  dwell_ticks: 30,
  expiry_ticks: null,
  objectives: null,
  extra_contacts: 0,
};
