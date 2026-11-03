export type Unit = "Hours" | "Days" | "Weeks" | "Months";

export type Timing = {
  mode: "immediate" | "after";
  amount: number;
  unit: Unit;
};

export type ActivityKind =
  | "custom"
  | "x-follow"
  | "x-like"
  | "x-comment"
  | "x-repost"
  | "x-post"
  | "x-quote"
  | "discord-join"
  | "discord-message"
  | "telegram"
  | "trust-name"
  | "i-trust"
  | "i-collab"
  | "i-interact"
  | "i-follow"
  | "portal"
  | "product"
  | "product-account"
  | "product-profile"
  | "product-workflow"
  | "product-return"
  | "feedback"
  | "survey"
  | "rate";

export type ActivityCategory = "All" | "Social" | "On-chain" | "Product" | "Feedback" | "Community" | "Custom";

export type Activity = {
  id: string;
  kind: ActivityKind;
  title: string;
  description: string;
  url: string;
  validation: string;
};

export type Stage = {
  id: string;
  name: string;
  timing: Timing;
  activities: Activity[];
};

export type Template = {
  id: string;
  name: string;
  months: number;
  retention: number;
  splits: number[];
  timings: Timing[];
  stageNames: string[];
};

export type Details = {
  name: string;
  description: string;
  coverName: string;
  coverUrl: string;
  start: string;
  end: string;
};

export type RetentionDraft = {
  step: "templates" | "details" | "journey" | "rewards" | "review";
  rewardsOn: boolean;
  templateId: string | null;
  details: Details;
  stages: Stage[];
  budget: number;
  validationOn: boolean;
  curatorOn: boolean;
  splits: number[];
  recipients: number;
  retentionReq: number;
  paid: boolean;
  published: boolean;
};

export const MAX_STAGES = 6;
export const MAX_ACTIVITIES = 10;
export const SERVICE_FEE = 10;
export const AMBASSADOR_FEE = 5;
export const VALIDATION_FEE = 2;
export const CURATOR_FEE = 1;
export const NEW_USER_FEE = 12;
export const BASE_EXISTING = 70;
export const OPENING_FEE = 500;
export const MIN_PER_STAGE = 2;

export const STAGE_NAMES = [
  "Social Tasks",
  "On-chain Tasks",
  "Product Tasks",
  "Feedback Tasks",
  "Custom Tasks",
  "Bonus Return",
];

export const TEMPLATES: Template[] = [
  {
    id: "t1",
    name: "Template 1",
    months: 3,
    retention: 75,
    splits: [10, 10, 15, 25, 40],
    stageNames: STAGE_NAMES.slice(0, 5),
    timings: [
      { mode: "immediate", amount: 0, unit: "Days" },
      { mode: "after", amount: 7, unit: "Days" },
      { mode: "after", amount: 14, unit: "Days" },
      { mode: "after", amount: 3, unit: "Weeks" },
      { mode: "after", amount: 1, unit: "Months" },
    ],
  },
  {
    id: "t2",
    name: "Template 2",
    months: 9,
    retention: 90,
    splits: [10, 10, 15, 25, 40],
    stageNames: STAGE_NAMES.slice(0, 5),
    timings: [
      { mode: "immediate", amount: 0, unit: "Days" },
      { mode: "after", amount: 14, unit: "Days" },
      { mode: "after", amount: 45, unit: "Days" },
      { mode: "after", amount: 3, unit: "Months" },
      { mode: "after", amount: 6, unit: "Months" },
    ],
  },
  {
    id: "t3",
    name: "Template 3",
    months: 5,
    retention: 70,
    splits: [10, 10, 15, 30, 35],
    stageNames: STAGE_NAMES.slice(0, 5),
    timings: [
      { mode: "immediate", amount: 0, unit: "Days" },
      { mode: "after", amount: 7, unit: "Days" },
      { mode: "after", amount: 14, unit: "Days" },
      { mode: "after", amount: 30, unit: "Days" },
      { mode: "after", amount: 60, unit: "Days" },
    ],
  },
];

export const CATALOG: {
  kind: ActivityKind;
  title: string;
  category: ActivityCategory;
  verify: string;
  urlLabel: string;
  urlPlaceholder: string;
  description: string;
  validationOptions?: string[];
}[] = [
  { kind: "custom", title: "Create a custom activity", category: "Custom", verify: "You choose how it is checked", urlLabel: "Link", urlPlaceholder: "https://", description: "Describe the action" },
  { kind: "x-follow", title: "Follow an account on X", category: "Social", verify: "Verified via X API. X task completion is verified through the participant’s X account.", urlLabel: "Profile URL", urlPlaceholder: "https://x.com/Emmylweb3", description: "Follow Emmylweb3 on X" },
  { kind: "x-like", title: "Like a post on X", category: "Social", verify: "Verified via X API.", urlLabel: "Post URL", urlPlaceholder: "https://x.com/...", description: "Like our pinned post on X" },
  { kind: "x-comment", title: "Comment on a post on X", category: "Social", verify: "Verified via X API.", urlLabel: "Post URL", urlPlaceholder: "https://x.com/...", description: "Comment on the announcement post" },
  { kind: "x-quote", title: "Quote an X post", category: "Social", verify: "Verified via X API.", urlLabel: "Post URL", urlPlaceholder: "https://x.com/...", description: "Quote an X post" },
  { kind: "x-repost", title: "Repost an X post", category: "Social", verify: "Verified via X API.", urlLabel: "Post URL", urlPlaceholder: "https://x.com/...", description: "Repost the announcement" },
  { kind: "x-post", title: "Post an X post", category: "Social", verify: "Verified via X API.", urlLabel: "Reference URL", urlPlaceholder: "https://x.com/...", description: "Post about the campaign" },
  { kind: "discord-message", title: "Send message in discord channel", category: "Community", verify: "Verified via Discord auth.", urlLabel: "Channel", urlPlaceholder: "https://discord.gg/...", description: "Send a message in the campaign channel" },
  { kind: "telegram", title: "Join TG announcement group", category: "Community", verify: "Telegram verification is optional. Connect Telegram in the studio to create these tasks.", urlLabel: "Server invite", urlPlaceholder: "https://t.me/..", description: "Join the announcement group" },
  { kind: "discord-join", title: "Join Discord Channel", category: "Community", verify: "Discord verification is optional. Connect Discord in the studio to create these tasks.", urlLabel: "Server invite", urlPlaceholder: "https://discord.gg/..", description: "Join the Nexura discord server" },
  { kind: "trust-name", title: "Own a .trust username", category: "On-chain", verify: "Verified by TNS.", urlLabel: "", urlPlaceholder: "", description: "Own a .trust username" },
  { kind: "i-trust", title: "I Trust (Portal claims)", category: "On-chain", verify: "Auto-verified via Intuition.", urlLabel: "", urlPlaceholder: "", description: "Publish an I Trust claim" },
  { kind: "i-collab", title: "I Collaborated (Portal claims)", category: "On-chain", verify: "Auto-verified via Intuition.", urlLabel: "", urlPlaceholder: "", description: "Publish an I Collaborated claim" },
  { kind: "i-interact", title: "I Interacted (Portal claims)", category: "On-chain", verify: "Auto-verified via Intuition.", urlLabel: "", urlPlaceholder: "", description: "Publish an I Interacted claim" },
  { kind: "i-follow", title: "I Follow (Portal claims)", category: "On-chain", verify: "Auto-verified via Intuition.", urlLabel: "", urlPlaceholder: "", description: "Publish an I Follow claim" },
  { kind: "portal", title: "Portal Claims (Support or Oppose)", category: "On-chain", verify: "Auto verified via portal. Completion is verified after the user completes the task.", urlLabel: "Portal Claims URL", urlPlaceholder: "https://portal.intuition", description: "Support I love Nexura on Intuition" },
  { kind: "product", title: "Use a product feature", category: "Product", verify: "Checked with the validation type you pick.", urlLabel: "Product URL", urlPlaceholder: "https://", description: "Use a product feature", validationOptions: ["Automatic validation", "Evidence upload", "Submit link"] },
  { kind: "product-account", title: "Create an account", category: "Product", verify: "Checked with the validation type you pick.", urlLabel: "Product URL", urlPlaceholder: "https://", description: "Create an account", validationOptions: ["Automatic validation", "Evidence upload", "Submit link"] },
  { kind: "product-profile", title: "Complete a profile", category: "Product", verify: "Checked with the validation type you pick.", urlLabel: "Product URL", urlPlaceholder: "https://", description: "Complete a profile", validationOptions: ["Automatic validation", "Evidence upload", "Submit link"] },
  { kind: "product-workflow", title: "Complete a product workflow", category: "Product", verify: "Checked with the validation type you pick.", urlLabel: "Product URL", urlPlaceholder: "https://", description: "Complete a product workflow", validationOptions: ["Automatic validation", "Evidence upload", "Submit link"] },
  { kind: "product-return", title: "Return and use the product", category: "Product", verify: "Checked with the validation type you pick.", urlLabel: "Product URL", urlPlaceholder: "https://", description: "Return and use the product", validationOptions: ["Automatic validation", "Evidence upload", "Submit link"] },
  { kind: "feedback", title: "Give feedback", category: "Feedback", verify: "Written feedback, reviewed manually.", urlLabel: "", urlPlaceholder: "", description: "Give feedback" },
  { kind: "survey", title: "Complete a survey", category: "Feedback", verify: "Reviewed manually.", urlLabel: "Survey URL", urlPlaceholder: "https://", description: "Complete a survey" },
  { kind: "rate", title: "Rate a feature", category: "Feedback", verify: "Reviewed manually.", urlLabel: "", urlPlaceholder: "", description: "Rate a feature" },
];

export function catalogMeta(kind: ActivityKind) {
  return CATALOG.find((item) => item.kind === kind) ?? CATALOG[0];
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T00:00`;
}

export function parseIso(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(base: Date, months: number) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function formatChip(value: string) {
  const d = parseIso(value);
  if (!d) return "—";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date.replace(",", " ·")}, ${time}`.replace(" ·,", " · ");
}

export function formatField(value: string) {
  const d = parseIso(value);
  if (!d) return "";
  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function durationBreakdown(start: string, end: string) {
  const a = parseIso(start);
  const b = parseIso(end);
  if (!a || !b || b <= a) return null;
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  const weeks = Math.floor(days / 7);
  const rem = days % 7;
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  months = Math.max(0, months);
  const weekLabel = `${weeks} week${weeks === 1 ? "" : "s"}${rem ? ` ${rem} day${rem === 1 ? "" : "s"}` : ""}`;
  const monthLabel = months === 1 ? "1 month" : `${months} months`;
  const headline = months >= 1 ? `${months} Month${months === 1 ? "" : "s"}` : days === 1 ? "1 Day" : `${days} Days`;
  return { days, headline, detail: `${days} days · ${weekLabel} · ${monthLabel}` };
}

export function timingLabel(t: Timing) {
  if (t.mode === "immediate") return "Immediately after joining";
  const raw = t.amount === 1 ? t.unit.replace(/s$/, "") : t.unit;
  return `${t.amount} ${raw.toLowerCase()}`;
}

export function timingShort(t: Timing) {
  if (t.mode === "immediate") return "Immediately";
  if (t.amount === 1 && t.unit === "Months") return "1 month";
  if (t.amount === 3 && t.unit === "Weeks") return "3 weeks";
  const unit = t.amount === 1 ? t.unit.replace(/s$/, "").toLowerCase() : t.unit.toLowerCase();
  return `${t.amount} ${unit}`;
}

export function timingMenuLabel(t: Timing) {
  if (t.mode === "immediate") return "Immediately after joining";
  if (t.amount === 3 && t.unit === "Days") return "3 Days";
  if (t.amount === 7 && t.unit === "Days") return "7 Days";
  if (t.amount === 14 && t.unit === "Days") return "14 Days";
  if (t.amount === 1 && t.unit === "Months") return "1 Month";
  return "Custom";
}

export function money(n: number) {
  if (!Number.isFinite(n)) return "$0";
  const digits = Math.abs(n) >= 100 && Math.abs(n - Math.round(n)) < 0.001 ? 0 : 2;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function stagesFromTemplate(template: Template): Stage[] {
  return template.timings.map((timing, i) => ({
    id: uid(),
    name: template.stageNames[i] ?? STAGE_NAMES[i] ?? `Stage ${i + 1}`,
    timing,
    activities: [],
  }));
}

export function blankStage(index: number): Stage {
  return {
    id: uid(),
    name: STAGE_NAMES[index] ?? `Stage ${index + 1}`,
    timing: index === 0 ? { mode: "immediate", amount: 0, unit: "Days" } : { mode: "after", amount: 7, unit: "Days" },
    activities: [],
  };
}

export function existingPct(validationOn: boolean, curatorOn: boolean) {
  return BASE_EXISTING + (validationOn ? 0 : VALIDATION_FEE) + (curatorOn ? 0 : CURATOR_FEE);
}

export function feeRows(budget: number, validationOn: boolean, curatorOn: boolean) {
  const existing = existingPct(validationOn, curatorOn);
  const rows = [
    { label: "Existing User Participation Pool", pct: existing, amount: (budget * existing) / 100, off: false },
    { label: "New User Pool", pct: NEW_USER_FEE, amount: (budget * NEW_USER_FEE) / 100, off: false },
    { label: "Project Curator", pct: curatorOn ? CURATOR_FEE : 0, amount: curatorOn ? (budget * CURATOR_FEE) / 100 : 0, off: !curatorOn },
    { label: "Ambassador Pool", pct: AMBASSADOR_FEE, amount: (budget * AMBASSADOR_FEE) / 100, off: false },
    { label: "Validation Rewards", pct: validationOn ? VALIDATION_FEE : 0, amount: validationOn ? (budget * VALIDATION_FEE) / 100 : 0, off: !validationOn },
    { label: "Nexura Service Fee", pct: SERVICE_FEE, amount: (budget * SERVICE_FEE) / 100, off: false },
  ];
  return rows;
}
