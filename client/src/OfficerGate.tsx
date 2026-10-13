import { useEffect, useState, type ReactNode } from "react";
import { api, setOfficerToken } from "./storage";

export default function OfficerGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false),
    [checking, setChecking] = useState(true),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [configured, setConfigured] = useState(true);
  useEffect(() => {
    let stopped = false;
    const check = () =>
      void api<{ authenticated: boolean; configured: boolean }>("/auth/session")
        .then((r) => {
          if (!stopped) {
            setAuthenticated(r.authenticated);
            setConfigured(r.configured);
          }
        })
        .catch((e) => {
          if (!stopped) setError(e.message);
        })
        .finally(() => {
          if (!stopped) setChecking(false);
        });
    check();
    window.addEventListener("vyuha-officer-session", check);
    return () => {
      stopped = true;
      window.removeEventListener("vyuha-officer-session", check);
    };
  }, []);
  async function login() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ token: string }>("/auth/login", { password });
      setOfficerToken(r.token);
      setPassword("");
      setAuthenticated(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (checking) return <p role="status">Checking officer session…</p>;
  if (authenticated)
    return (
      <>
        <div className="setup-bar officer-session-bar">
          <span>
            Officer session · expires after eight hours or server restart
          </span>
          <button
            className="button subtle"
            onClick={() =>
              void api("/auth/logout", {}).finally(() => {
                setOfficerToken("");
                setAuthenticated(false);
              })
            }
          >
            Sign out
          </button>
        </div>
        {children}
      </>
    );
  return (
    <main className="instructor-page officer-login">
      <section className="panel">
        <h1>Officer sign-in</h1>
        <p>
          Instructor controls and data transfer require an authenticated officer
          session.
        </p>
        {!configured && (
          <p role="status">
            Officer setup is missing. On the server, run{" "}
            <code>python scripts/setup-auth.py</code> using the project virtual
            environment.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <label>
            Officer password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              maxLength={256}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={busy || !password || !configured}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
        <p className="footnote">
          Use browser-trusted HTTPS on the unit LAN to protect credentials in
          transit.
        </p>
      </section>
    </main>
  );
}
