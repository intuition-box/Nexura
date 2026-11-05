import { BACKEND_URL } from "./constants";
import { DEV_ACCESS_ON, onApiWrite } from "./devAccess";

// Test app usage for the dashboard's Test App Access page: active time, visits, pages and actions.
// A minute only counts while the tab is in front and the tester did something in the last 2 minutes.
const PING_EVERY_MS = 60_000;
const IDLE_AFTER_MS = 2 * 60_000;
const FIRST_PING_MS = 5_000;
const USAGE_URL = `${BACKEND_URL}/api/dev-access/usage`;
// Requests that aren't something the tester did (sign-in, the gate itself, background bookkeeping)
const NOT_ACTIONS = [/^\/dev-access(\/|$)/, /^\/user\/sign-in$/, /^\/admin(\/|$)/, /notifications\/read$/];

const isId = (s: string) =>
  /^0x[0-9a-f]+$/i.test(s) || /^\d+$/.test(s) || /^[0-9a-f]{24}$/i.test(s) || /^[0-9a-f-]{32,36}$/i.test(s) ||
  s.length > 30 || (s.length >= 16 && /\d/.test(s) && /[a-z]/i.test(s));

/** "/quests/6650f1…/tasks" → "/quests/:id/tasks", so pages group across items. */
const normalisePath = (path: string) =>
  "/" + path.split("/").filter(Boolean).map(s => (isId(s) ? ":id" : s.toLowerCase().replace(/[^a-z0-9-]/g, ""))).filter(Boolean).join("/");

/** POST /api/quest/claim-quest/<id> → "quest/claim-quest". */
function actionFor(url: string): string | null {
  let path: string;
  try { path = new URL(url, window.location.origin).pathname; } catch { return null; }
  path = path.replace(/^\/api(?=\/)/, "");
  if (NOT_ACTIONS.some(re => re.test(path))) return null;
  const parts = path.split("/").filter(s => s && !isId(s)).map(s => s.toLowerCase());
  if (!parts.length) return null;
  const key = parts.length > 1 ? `${parts[0]}/${parts[parts.length - 1]}` : parts[0]!;
  return /^[a-z0-9-]{1,30}(\/[a-z0-9-]{1,40})?$/.test(key) ? key : null;
}

let pages: Record<string, number> = {};
let actions: Record<string, number> = {};
let lastInput = Date.now();
let lastPage = "";

const bump = (into: Record<string, number>, key: string) => { into[key] = (into[key] ?? 0) + 1; };

export function trackTestAppPage(pathname: string) {
  if (!DEV_ACCESS_ON) return;
  const page = normalisePath(pathname);
  if (page === lastPage) return;
  lastPage = page;
  bump(pages, page);
}

function send(active: boolean) {
  if (!active && !Object.keys(pages).length && !Object.keys(actions).length) return;
  const body = JSON.stringify({ active, pages, actions });
  pages = {};
  actions = {};
  fetch(USAGE_URL, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body }).catch(() => { /* best effort */ });
}

const isActive = () => document.visibilityState === "visible" && Date.now() - lastInput < IDLE_AFTER_MS;

/** Starts tracking once the tester is past the gate; returns a stop function. */
export function startTestAppUsage(): () => void {
  if (!DEV_ACCESS_ON || typeof window === "undefined") return () => {};
  lastInput = Date.now();
  const onInput = () => { lastInput = Date.now(); };
  const onHide = () => { if (document.visibilityState === "hidden") send(false); };
  const inputs = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove", "scroll"] as const;
  inputs.forEach(e => window.addEventListener(e, onInput, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);
  onApiWrite(url => { const action = actionFor(url); if (action) bump(actions, action); });
  const first = setTimeout(() => send(isActive()), FIRST_PING_MS);
  const timer = setInterval(() => send(isActive()), PING_EVERY_MS);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
    inputs.forEach(e => window.removeEventListener(e, onInput, { capture: true }));
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onHide);
    onApiWrite(null);
    send(false);
  };
}
