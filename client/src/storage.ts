import type { Action, AppliedCommand, Record as TrainingRecord } from "./types";
export const RECONSTRUCTION_TIMEOUT_MS = 120000;
/** Keep local unsynchronized advice requests while accepting the authoritative server score. */
export function mergeServerRecord(
  local: TrainingRecord | undefined,
  remote: TrainingRecord,
): TrainingRecord {
  if (local?.id !== remote.id || local.scenario.id !== remote.scenario.id)
    return remote;
  return {
    ...remote,
    eventBatches: remote.eventBatches ?? local.eventBatches,
    fusionExposures: local.fusionExposures ?? remote.fusionExposures,
  };
}
const DB = "vyuha-training-v1";
async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("records", { keyPath: "id" });
      r.result.createObjectStore("drafts", { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function put(store: string, value: unknown) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(store, "readwrite");
      t.objectStore(store).put(value);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}
export async function saveRecord(record: TrainingRecord) {
  await put("records", record);
}
export type Draft = {
  id: string;
  events: Action[];
  scenario: TrainingRecord["scenario"];
  trainee: string;
  tick: number;
  server: boolean;
  commands?: AppliedCommand[];
  eventBatches?: Action[][];
  fusionExposures?: import("./types").FusionExposure[];
  learning?: import("./learning").LearningPreparation;
  updated_at: string;
};
export async function saveDraft(
  id: string,
  events: Action[],
  scenario: TrainingRecord["scenario"],
  trainee: string,
  tick: number,
  server = false,
  commands: AppliedCommand[] = [],
  eventBatches: Action[][] = [],
  fusionExposures: import("./types").FusionExposure[] = [],
  learning?: import("./learning").LearningPreparation,
) {
  await put("drafts", {
    id,
    events,
    scenario,
    trainee,
    tick,
    server,
    commands,
    eventBatches,
    fusionExposures,
    learning,
    updated_at: new Date().toISOString(),
  });
}
export async function readDrafts() {
  const db = await open();
  try {
    return await new Promise<Draft[]>((resolve, reject) => {
      const r = db.transaction("drafts").objectStore("drafts").getAll();
      r.onsuccess = () =>
        resolve(
          r.result.sort((a: Draft, b: Draft) =>
            b.updated_at.localeCompare(a.updated_at),
          ),
        );
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function removeLocal(store: "drafts" | "records", id: string) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(store, "readwrite");
      t.objectStore(store).delete(id);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}
export async function readRecords() {
  const db = await open();
  try {
    return await new Promise<TrainingRecord[]>((resolve, reject) => {
      const r = db.transaction("records").objectStore("records").getAll();
      r.onsuccess = () =>
        resolve(
          r.result.sort((a: TrainingRecord, b: TrainingRecord) =>
            b.created_at.localeCompare(a.created_at),
          ),
        );
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
const OFFICER_SESSION = "vyuha-officer-session";
export function officerToken() {
  try {
    return sessionStorage.getItem(OFFICER_SESSION) ?? "";
  } catch {
    return "";
  }
}
export function setOfficerToken(token: string) {
  try {
    if (token) sessionStorage.setItem(OFFICER_SESSION, token);
    else sessionStorage.removeItem(OFFICER_SESSION);
  } catch {
    throw new Error("Browser session storage is required for officer sign-in.");
  }
  window.dispatchEvent(new Event("vyuha-officer-session"));
}
async function requestJSON<T>(
  path: string,
  body: string | undefined,
  timeoutMs: number,
): Promise<T> {
  const token = officerToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const result = await fetch(`/api/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!result.ok) {
    if (result.status === 401 && token) setOfficerToken("");
    const data = await result
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail
              .map(
                (e: { msg: string; loc: string[] }) =>
                  `${e.loc.slice(1).join(".")}: ${e.msg}`,
              )
              .join("; ")
          : "The server rejected this session.",
    );
  }
  return result.json();
}
export async function api<T>(
  path: string,
  body?: unknown,
  timeoutMs = 6000,
): Promise<T> {
  return requestJSON<T>(
    path,
    body === undefined ? undefined : JSON.stringify(body),
    timeoutMs,
  );
}
/** Preserve the exact numeric JSON spelling of signed legacy transfer files. */
export async function apiRawJSON<T>(
  path: string,
  text: string,
  timeoutMs = 6000,
): Promise<T> {
  return requestJSON<T>(path, text, timeoutMs);
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
