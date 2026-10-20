import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { NavigationLinks } from "./Navigation";
import { pageComponents } from "./RoutePages";
import {
  routes,
  navigationItems,
  resolveRoute,
  activeNavigation,
  workspaceViewFromSearch,
  workspaceHref,
  officerReviewRequested,
  officerReviewHref,
} from "./routes";

test("route coverage: every actual renderer has a canonical discoverability policy", () => {
  assert.deepEqual(
    Object.keys(pageComponents).sort(),
    routes.map((r) => r.id).sort(),
  );
  for (const route of routes) {
    assert.ok(
      ["NAVIGATED", "SECONDARY_REACHABLE", "INTENTIONALLY_HIDDEN"].includes(
        route.policy,
      ),
    );
    assert.ok(route.reason.length > 20, route.path);
    assert.ok(route.title && route.audience && route.status);
    if (route.policy === "NAVIGATED")
      assert.equal(
        navigationItems.filter((n) => n.href === route.path).length,
        1,
        route.path,
      );
    else if (route.policy === "SECONDARY_REACHABLE") {
      assert.ok(resolveRoute(route.parent));
      assert.equal(
        navigationItems.some((n) => n.href === route.path),
        false,
        route.path,
      );
    }
  }
});
test("navigation policies retain all baseline page paths and finale pages and have no duplicate links", () => {
  assert.deepEqual(
    routes.map((r) => r.path).sort(),
    [
      "/",
      "/rapid-id",
      "/unit",
      "/instructor",
      "/analytics",
      "/exercises",
      "/recorded",
      "/transfer",
      "/system/evidence",
      "/evaluation",
      "/system/benchmark",
      "/system/compliance",
      "/crew",
    ].sort(),
  );
  assert.equal(new Set(routes.map((r) => r.path)).size, routes.length);
  assert.equal(
    new Set(navigationItems.map((n) => n.id)).size,
    navigationItems.length,
  );
  assert.equal(
    new Set(navigationItems.map((n) => n.href)).size,
    navigationItems.length,
  );
});
test("Transfer is a visible, descriptive anchor that reaches the canonical route", () => {
  const html = renderToStaticMarkup(<NavigationLinks pathname="/" />);
  assert.match(html, /<a[^>]*href="\/transfer"[^>]*aria-label="Data transfer"/);
  assert.match(html, />Data transfer<\/span>/);
  const target = navigationItems.find((n) => n.id === "transfer")!;
  assert.equal(
    resolveRoute(new URL(target.href, "http://unit.local").pathname)?.id,
    "transfer",
  );
});
test("each navigated page highlights exactly its own link with aria-current page", () => {
  for (const route of routes.filter((r) => r.policy === "NAVIGATED")) {
    const html = renderToStaticMarkup(
      <NavigationLinks pathname={route.path} />,
    );
    assert.equal(
      (html.match(/aria-current="page"/g) ?? []).length,
      1,
      route.path,
    );
    assert.match(
      html,
      new RegExp(
        `href="${route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*aria-current="page"`,
      ),
    );
  }
});
test("review, Director, session details and retained embedded unit view resolve intentionally", () => {
  assert.equal(workspaceViewFromSearch("?view=aar"), "aar");
  assert.equal(workspaceViewFromSearch("?session=completed-id"), "aar");
  assert.equal(workspaceViewFromSearch("?view=unit"), "unit");
  assert.equal(workspaceViewFromSearch("?view=bogus"), "drill");
  assert.equal(activeNavigation("/", "?view=aar"), "review");
  assert.equal(activeNavigation("/", "?session=completed-id"), "review");
  assert.equal(activeNavigation("/", "?mode=adaptive"), "director");
  assert.equal(activeNavigation("/", "?view=unit"), "unit");
  assert.equal(activeNavigation("/", "", "aar"), "review");
});
test("engineering and opt-in evaluation stay secondary, with parent location highlighting", () => {
  for (const route of routes.filter(
    (r) => r.policy === "SECONDARY_REACHABLE",
  )) {
    const html = renderToStaticMarkup(
      <NavigationLinks pathname={route.path} />,
    );
    assert.doesNotMatch(html, new RegExp(`href="${route.path}"`));
    assert.equal((html.match(/aria-current="location"/g) ?? []).length, 1);
    assert.equal(activeNavigation(route.path), resolveRoute(route.parent)?.id);
  }
});
test("matching supports canonical trailing slash but does not capture unknown prefix or nested URLs", () => {
  assert.equal(resolveRoute("/transfer/")?.id, "transfer");
  assert.equal(activeNavigation("/analytics/"), "analytics");
  for (const path of [
    "/unit-other",
    "/analytics-extra",
    "/unit/unknown",
    "/aar",
    "/training",
    "/api/v1/health",
  ]) {
    assert.equal(resolveRoute(path), undefined, path);
    assert.equal(activeNavigation(path), undefined, path);
  }
});
test("all links expose keyboard-native anchor semantics, labels and text rather than icon-only controls", () => {
  const html = renderToStaticMarkup(
    <NavigationLinks pathname="/transfer" reviewCount={3} />,
  );
  assert.match(html, /nav aria-label="Main navigation"/);
  assert.equal((html.match(/<a /g) ?? []).length, navigationItems.length);
  for (const item of navigationItems) {
    assert.ok(html.includes(`aria-label="${item.label}"`));
    assert.ok(html.includes(`<span>${item.label}</span>`));
  }
  assert.match(html, /class="nav-count">3/);
  assert.doesNotMatch(html, /tabindex="-1"/i);
});

test("secondary workflows retain real links in their parent components", () => {
  const rapid = readFileSync(new URL("./RapidID.tsx", import.meta.url), "utf8");
  const evidence = readFileSync(
    new URL("./Evidence.tsx", import.meta.url),
    "utf8",
  );
  const unit = readFileSync(new URL("./Unit.tsx", import.meta.url), "utf8");
  assert.ok(rapid.includes('href="/evaluation"'));
  assert.ok(evidence.includes('href="/system/benchmark"'));
  assert.ok(unit.includes("officerReviewHref(r.id)"));
  assert.ok(unit.includes('href="/?view=unit"'));
});

test("Unit navigation retains the embedded workspace without unloading a live trainee exercise", () => {
  const trainee = renderToStaticMarkup(
    <NavigationLinks pathname="/" view="drill" />,
  );
  const officer = renderToStaticMarkup(
    <NavigationLinks pathname="/instructor" />,
  );
  assert.match(
    trainee,
    /href="\/\?view=unit"[^>]*aria-label="Unit training overview"/,
  );
  assert.match(
    officer,
    /href="\/unit"[^>]*aria-label="Unit training overview"/,
  );
});

test("internal view transitions clear stale reviews and retain refreshable session details", () => {
  assert.equal(workspaceHref("drill", "?view=aar&session=old-id"), "/");
  assert.equal(workspaceHref("unit", "?session=old-id"), "/?view=unit");
  assert.equal(
    workspaceHref("aar", "", "verified-id"),
    "/?view=aar&session=verified-id",
  );
  assert.equal(
    workspaceHref("aar", "?session=loading-id"),
    "/?session=loading-id&view=aar",
  );
  assert.equal(
    workspaceHref("drill", "?mode=adaptive&view=aar&session=old-id"),
    "/?mode=adaptive",
  );
});

test("officer AAR routing requires explicit complete-review intent and preserves trainee links", () => {
  const href = officerReviewHref("session & special");
  assert.equal(
    new URL(href, "http://unit.local").searchParams.get("session"),
    "session & special",
  );
  assert.equal(officerReviewRequested("/", href.slice(1)), true);
  for (const search of [
    "?session=normal",
    "?view=aar",
    "?review=officer",
    "?session=&review=officer",
    "?session=id&review=trainee",
  ])
    assert.equal(officerReviewRequested("/", search), false);
  assert.equal(
    officerReviewRequested("/unit", "?session=id&review=officer"),
    false,
  );
  const main = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
  assert.match(main, /officerReview[\s\S]*?<Page reviewOnly/);
  assert.match(main, /officerReview \|\|/);
  assert.match(
    main,
    /<OfficerGate(?:\s+fallbackNavigation=\{officerReview \? <Navigation \/> : undefined\})?\s*>\s*\{rendered\}\s*<\/OfficerGate>/,
  );
  assert.match(
    main,
    /fallbackNavigation=\{officerReview \? <Navigation \/> : undefined\}/,
  );
});
