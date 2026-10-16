import { ArrowUpRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { NavigationLinks } from "./Navigation";
import { resolveRoute } from "./routes";

/** Surrounding workspaces only: the live drill retains its own navigation. */
export default function PlatformRail() {
  const route = resolveRoute(window.location.pathname);
  return (
    <aside className="platform-rail" aria-label="Workspace directory">
      <div className="platform-rail-heading">
        <span>TRAINING PLATFORM</span>
        <span className="platform-edition">SIH26247</span>
      </div>
      <NavigationLinks
        pathname={window.location.pathname}
        search={window.location.search}
      />
      <div className="platform-rail-footer">
        <a href="/" className="platform-return">
          <ArrowLeft size={16} aria-hidden="true" />
          Open training ground
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
        <p>
          <ShieldCheck size={14} aria-hidden="true" />
          {route?.audience.includes("Officer") ||
          route?.audience.includes("Instructor")
            ? "Officer access checked by server"
            : "Local training · evidence preserved"}
        </p>
      </div>
    </aside>
  );
}
