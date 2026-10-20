import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  workspaceHref,
  workspaceViewFromSearch,
  type NavigationItem,
  type WorkspaceView,
} from "./routes";
import type { Record as TrainingRecord } from "./types";
type Setter<T> = Dispatch<SetStateAction<T>>;
type Options = {
  view: WorkspaceView;
  current: TrainingRecord | null;
  reviewOnly: boolean;
  setView: Setter<WorkspaceView>;
  setCurrent: Setter<TrainingRecord | null>;
  setReplayPlay: Setter<boolean>;
  setReplayTick: Setter<number>;
  setMode: Setter<"scripted" | "adaptive" | "library">;
};

/** Own browser history and workspace URLs independently of simulation/session
 * effects. Changing a review URL must clear stale session data immediately. */
export function useWorkspaceNavigation({
  view,
  current,
  reviewOnly,
  setView,
  setCurrent,
  setReplayPlay,
  setReplayTick,
  setMode,
}: Options) {
  const [routeSearch, setRouteSearch] = useState(window.location.search);
  const focusPending = useRef(false);
  useEffect(() => {
    const update = () => {
      const search = window.location.search,
        params = new URLSearchParams(search);
      const next = reviewOnly ? "aar" : workspaceViewFromSearch(search),
        id = params.get("session");
      setCurrent((record) =>
        id
          ? record?.id === id
            ? record
            : null
          : next === "aar"
            ? null
            : record,
      );
      setRouteSearch(search);
      setView(next);
      setReplayPlay(false);
      if (params.get("mode") === "adaptive") setMode("adaptive");
      focusPending.current = true;
    };
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [reviewOnly, setCurrent, setView, setReplayPlay, setMode]);
  useEffect(() => {
    const href = workspaceHref(
      view,
      window.location.search,
      current?.verified ? current.id : undefined,
    );
    if (href !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", href);
      window.dispatchEvent(new Event("vyuha-workspace-navigation"));
    }
  }, [view, current?.id, current?.verified]);
  useEffect(() => {
    if (focusPending.current) {
      document.getElementById("workspace-content")?.focus();
      focusPending.current = false;
    }
  }, [view, routeSearch]);
  const navigateWorkspace = useCallback((item: NavigationItem) => {
    window.history.pushState(null, "", item.href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);
  const openReview = useCallback(
    (record: TrainingRecord) => {
      window.history.pushState(
        null,
        "",
        workspaceHref("aar", "", record.verified ? record.id : undefined),
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
      setCurrent(record);
      setReplayTick(0);
    },
    [setCurrent, setReplayTick],
  );
  return { routeSearch, navigateWorkspace, openReview };
}
