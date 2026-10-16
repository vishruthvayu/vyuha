import { PageHeader } from "./UI";
import { useEffect, useRef, useState } from "react";
import { api, apiRawJSON, download } from "./storage";
import { validatedJSONText } from "./import-json";
export default function Transfer() {
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]),
    [unit, setUnit] = useState("local"),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void api<{ units: { id: string; name: string }[] }>("/units")
      .then((r) => setUnits(r.units))
      .catch((e) => setError(e.message));
  }, []);
  async function exportBundle() {
    setBusy(true);
    setStatus("Reconstructing bounded history for export…");
    setError("");
    try {
      const value = await api(`/units/${unit}/bundle/export`, {}, 120000);
      download("vyuha-portable-bundle.json", value);
      setStatus("Portable bundle exported. The shared key is not included.");
      setError("");
    } catch (e) {
      setStatus("");
      setError(
        `${(e as Error).message} If the response was lost, retry the same bundle; canonical sessions import once.`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function importBundle() {
    setBusy(true);
    setStatus("Verifying integrity and reconstructing bounded history…");
    setError("");
    try {
      const f = file.current?.files?.[0];
      if (!f) throw new Error("Choose a JSON bundle");
      if (f.size > 8 * 1024 * 1024)
        throw new Error("Bundle exceeds 8 MiB limit");
      const r = await apiRawJSON<{
        inserted_sessions: number;
        skipped_sessions: number;
      }>(
        "/bundle/import",
        validatedJSONText(await f.text(), 8 * 1024 * 1024),
        120000,
      );
      setStatus(
        `Integrity verified. Imported ${r.inserted_sessions} sessions; skipped ${r.skipped_sessions} identical sessions. Individual profiles rebuilt from validated outcomes; shared crew results remain ungraded for individuals.`,
      );
      setError("");
    } catch (e) {
      setStatus("");
      setError(
        `${(e as Error).message} If the response was lost, retry the same bundle; canonical sessions import once. For an older bundle, use the unchanged original file or re-export with the current version; do not edit its signature.`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="instructor-page advanced-page utility-page">
      <PageHeader
        eyebrow="LOCAL DATA OPERATIONS"
        title="Data transfer"
        description="Move verified training archives between prepared unit servers."
        actions={
          <nav className="advanced-nav">
            <a href="/instructor">Instructor</a>
          </nav>
        }
      />
      <p>
        Trusted LAN prototype. Authenticated officer transfer. Do not expose to
        public networks. HMAC-SHA256 checks bundle integrity with a local shared
        secret; it does not attest identity, authenticity or non-repudiation.
      </p>
      <section className="panel advanced-card">
        <label>
          Unit
          <select
            disabled={busy}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <p>
          Exports pseudonymous trainee references, completed
          tactical/recognition records, frozen scenarios and pack rules, outcome
          evidence, individual profile summaries, pseudonymous shared crew
          attribution, reconstructable Fusion exposures and up to 20 recordings.
          Teaching annotations retain their free text; review it before sharing.
          Signed cohort bindings preserve imported Crew trends without restoring
          memberships or role codes. Session limits: 200 tactical / 100
          recognition. Accepted histories import atomically; conflicts roll
          back.
        </p>
        <button
          disabled={busy}
          className="button primary"
          onClick={() => void exportBundle()}
        >
          Export HMAC bundle
        </button>
        <label>
          Portable JSON bundle
          <input
            disabled={busy}
            type="file"
            accept=".json,application/json"
            ref={file}
          />
        </label>
        <button
          disabled={busy}
          className="button subtle"
          onClick={() => void importBundle()}
        >
          Validate and import bundle
        </button>
        <p>
          Configure VYUHA_BUNDLE_KEYFILE on both installations before transfer;
          see Stage 6 documentation. Keep the key outside source control and
          exchange it through a trusted offline channel.
        </p>
        {status && <p role="status">{status}</p>}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
