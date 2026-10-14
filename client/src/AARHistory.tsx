import { ChevronRight, ShieldCheck, Clock3 } from "lucide-react";
import type { Record as TrainingRecord } from "./types";
import { HZ } from "./sim";
export default function AARHistory({
  records,
  selectedId,
  traineeLabel,
  onOpen,
}: {
  records: TrainingRecord[];
  selectedId?: string;
  traineeLabel: (id: string) => string;
  onOpen: (record: TrainingRecord) => void;
}) {
  return (
    <div
      className="record-list aar-history-list"
      role="group"
      aria-label="Saved exercise reviews"
    >
      {records.map((record) => (
        <button
          key={record.id}
          aria-pressed={record.id === selectedId}
          className={record.id === selectedId ? "selected" : ""}
          onClick={() => onOpen(record)}
        >
          <span className="history-exercise">
            <strong>{record.scenario.title}</strong>
            <span>
              {traineeLabel(record.trainee)} ·{" "}
              {new Date(record.created_at).toLocaleString()}
            </span>
            <small>
              Seed {record.scenario.seed} · {record.scenario.tracks.length}{" "}
              contacts · {Math.round(record.endTick / HZ)}s recorded ·{" "}
              {record.events.length} decisions
            </small>
            <span
              className={`history-verification ${record.verified ? "verified" : "pending"}`}
            >
              {record.verified ? (
                <ShieldCheck size={14} aria-hidden="true" />
              ) : (
                <Clock3 size={14} aria-hidden="true" />
              )}
              {record.verified
                ? "Server verified"
                : "Device score · verification pending"}
              {record.id === selectedId && " · Reviewing"}
            </span>
            <small className="mono">Exercise {record.id.slice(0, 12)}</small>
          </span>
          <span className="history-score">
            <strong>
              {record.scorecard.score}
              <small>/100</small>
            </strong>
          </span>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
