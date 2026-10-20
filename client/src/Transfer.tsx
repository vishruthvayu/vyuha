import { PageHeader } from "./UI";
import { Download, FileCheck2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, apiRawJSON, download } from "./storage";
import { validatedJSONText } from "./import-json";
export default function Transfer() {
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]),
    [unit, setUnit] = useState("local"),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selectedFile, setSelectedFile] = useState<File | null>(null);
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
      <div className="transfer-workbench" aria-busy={busy}>
        <section className="panel transfer-operation">
          <div className="transfer-operation-label">
            <Download size={18} aria-hidden="true" />
            <span>01 / EXPORT</span>
          </div>
          <h2>Take your evidence with you.</h2>
          <p>
            Create a signed archive of this unit’s completed training. The
            shared key stays on the server.
          </p>
          <label>
            Source unit
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
          <dl className="transfer-manifest">
            <div>
              <dt>Tactical history</dt>
              <dd>Up to 200 sessions</dd>
            </div>
            <div>
              <dt>Recognition history</dt>
              <dd>Up to 100 records</dd>
            </div>
            <div>
              <dt>Recordings</dt>
              <dd>Up to 20 exercises</dd>
            </div>
            <div>
              <dt>Included evidence</dt>
              <dd>
                Frozen scenarios, outcomes, profiles, Crew attribution and
                reconstructable Fusion exposures
              </dd>
            </div>
          </dl>
          <p className="transfer-note">
            Teaching annotations retain free text. Review it before sharing.
            Trainee references are pseudonymous.
          </p>
          <button
            disabled={busy || !units.length}
            className="button primary"
            onClick={() => void exportBundle()}
          >
            Export HMAC bundle
          </button>
        </section>
        <section className="panel transfer-operation">
          <div className="transfer-operation-label">
            <Upload size={18} aria-hidden="true" />
            <span>02 / IMPORT</span>
          </div>
          <h2>Restore a trusted archive.</h2>
          <p>
            Choose the unchanged JSON file. The server checks its signature and
            validates its history before accepting it.
          </p>
          <label className="transfer-file">
            Portable JSON bundle
            <input
              disabled={busy}
              type="file"
              accept=".json,application/json"
              ref={file}
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] ?? null);
                setError("");
                setStatus("");
              }}
            />
          </label>
          <div className="transfer-file-summary" role="status">
            <FileCheck2 size={24} aria-hidden="true" />
            <div>
              <strong>{selectedFile?.name ?? "No archive selected"}</strong>
              <span>
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KiB · maximum 8 MiB · verification pending`
                  : "Choose a .json bundle to begin. Maximum 8 MiB."}
              </span>
            </div>
          </div>
          <ol className="transfer-checks">
            <li>Verify HMAC-SHA256 integrity</li>
            <li>Reconstruct bounded training history</li>
            <li>Import once; skip identical sessions</li>
          </ol>
          <p className="transfer-note">
            Accepted histories import atomically. Conflicting histories roll
            back. Shared Crew results never become individual grades.
          </p>
          <button
            disabled={
              busy || !selectedFile || selectedFile.size > 8 * 1024 * 1024
            }
            className="button primary"
            onClick={() => void importBundle()}
          >
            Validate and import bundle
          </button>
          {selectedFile && selectedFile.size > 8 * 1024 * 1024 && (
            <p role="alert">
              Bundle exceeds the 8 MiB limit. Choose a smaller archive.
            </p>
          )}
        </section>
      </div>
      {status && (
        <p className="transfer-feedback" role="status">
          {status}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <details className="evidence-disclosure transfer-security">
        <summary>Trust, shared keys and recovery</summary>
        <p>
          Authenticated officer transfer for trusted LAN installations.
          Configure VYUHA_BUNDLE_KEYFILE on both servers and exchange the key
          through a trusted offline channel. Keep it outside source control.
        </p>
        <p>
          HMAC checks integrity using a shared secret; it does not attest
          identity or provide non-repudiation. Memberships and role codes are
          not restored. Signed cohort bindings retain imported Crew trends.
        </p>
        <p>
          If a response is lost, retry the same file. Canonical sessions import
          once. Do not edit signatures; use the unchanged original archive or
          export it again from the source server.
        </p>
      </details>
    </main>
  );
}
