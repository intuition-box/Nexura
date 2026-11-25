// API-level E2E for STUDIO side: prove /api/hub/save-campaign accepts + persists the 4 atlas task types.
import { readFileSync } from "node:fs";
const API = process.env.API || "http://localhost:5600";
const creds = JSON.parse(readFileSync("C:/Users/orion/Desktop/nawa/nexura-next/qa-studio-creds.json", "utf8"));
const { email, password } = creds.project;

async function signIn() {
  const res = await fetch(`${API}/api/hub/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`sign-in ${res.status}: ${JSON.stringify(data)}`);
  return data.accessToken || data.token;
}

const NEW_TYPES = [
  { tag: "i-trust" },
  { tag: "i-collaborated" },
  { tag: "i-interact" },
  { tag: "i-follow" },
];

async function saveCampaign(token, quests, title) {
  const fd = new FormData();
  fd.append("title", title);
  fd.append("description", "Atlas studio E2E campaign");
  fd.append("nameOfProject", title);
  fd.append("starts_at", "2026-07-01T00:00:00.000Z");
  fd.append("ends_at", "2026-07-31T23:59:00.000Z");
  fd.append("maxParticipants", "100");
  fd.append("isDraft", "true");
  fd.append("reward", JSON.stringify({ xp: 200, pool: 0, trust: 0 }));
  fd.append("campaignQuests", JSON.stringify(quests));
  const res = await fetch(`${API}/api/hub/save-campaign`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function getQuests(token, id) {
  const res = await fetch(`${API}/api/hub/get-campaign?id=${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, quests: data.campaignQuests || [] };
}

async function ensureHub(token) {
  // 1x1 PNG
  const pngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const logo = new Blob([Buffer.from(pngB64, "base64")], { type: "image/png" });
  const fd = new FormData();
  fd.append("name", `Atlas QA Hub ${creds.createdAt}`);
  fd.append("description", "Atlas QA hub created for end-to-end verification of the four Intuition portal-claim task types (i-trust, i-collaborated, i-interact, i-follow) on the localhost Nexura backend stack.");
  fd.append("website", "https://example.com");
  fd.append("xAccount", "https://x.com/atlasqa");
  fd.append("discordServer", "https://discord.gg/atlasqa");
  fd.append("logo", logo, "logo.png");
  const res = await fetch(`${API}/api/hub/create-hub`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  console.log("CREATE-HUB", res.status, JSON.stringify(data));
}

const token = await signIn();
console.log("STUDIO SIGN-IN ok as", email);
await ensureHub(token);

const quests = NEW_TYPES.map((t) => ({
  quest: `${t.tag} task`,
  link: `https://portal.example.com/${t.tag}`,
  tag: t.tag,
  category: "other",
  verificationMode: "",
}));

const title = `Atlas Studio E2E ${Date.now().toString(16)}`;
const saved = await saveCampaign(token, quests, title);
console.log("SAVE", saved.status, JSON.stringify(saved.data));
if (!saved.ok) { console.error("FAIL: studio save non-2xx"); process.exit(1); }

const id = saved.data.campaignId || saved.data._id || saved.data.id;
console.log("campaignId:", id);
const back = await getQuests(token, id);
const persisted = back.quests.map((q) => q.tag).sort();
const expected = NEW_TYPES.map((t) => t.tag).sort();
console.log("GET", back.status, "persisted tags:", JSON.stringify(persisted));
const ok = expected.every((t) => persisted.includes(t));
if (saved.ok && ok) { console.log("PASS: studio backend accepted + persisted all 4 atlas tags."); process.exit(0); }
console.error("FAIL: not all atlas tags persisted on studio path.", JSON.stringify(expected));
process.exit(1);
