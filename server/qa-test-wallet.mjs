// qa-test-wallet.mjs
//
// End-to-end exercise of the checkDiscordTask verification pipeline driven by
// a freshly-generated test wallet. Walks through:
//   1) Sign-in via /api/hub/sign-in (creates a brand-new user in Mongo)
//   2) POST /api/check-discord without auth   → expect 401
//   3) POST /api/check-discord with auth, no discord connected yet
//                                              → expect 401 "connect discord to proceed"
//   4) GET  /api/discord/update?discord_id=…   → connect a fake discord account
//   5) POST /api/check-discord with auth + discord + bogus quest id
//                                              → expect 404 "task not found"
//   6) POST /api/check-discord with auth + discord + real discord tags
//      (only runs if a discord-tagged miniQuest already exists in Mongo)
//
// Run with:   bun qa-test-wallet.mjs
// Override target via: API_BASE=http://host:port bun qa-test-wallet.mjs

const BASE = process.env.API_BASE || "http://127.0.0.1:5600";

const randomAddress = () => {
  let s = "0x";
  while (s.length < 42) s += Math.floor(Math.random() * 16).toString(16);
  return s;
};

const fetchJson = async (url, init = {}) => {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
};

const header = (title) => {
  console.log("\n────────────────────────────────────────");
  console.log(title);
  console.log("────────────────────────────────────────");
};

async function main() {
  console.log("══════════════════════════════════════════");
  console.log("Test-wallet flow against", BASE);
  console.log("══════════════════════════════════════════");

  const wallet = randomAddress().toLowerCase();
  console.log("Fresh test wallet:", wallet);

  header("1) Sign in (POST /api/user/sign-in)");
  const signin = await fetchJson(`${BASE}/api/user/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: wallet }),
  });
  console.log("HTTP", signin.status, "→", JSON.stringify(signin.body).slice(0, 240));
  if (!signin.body?.accessToken) {
    console.error("Signin did not return an accessToken — cannot continue");
    process.exit(1);
  }
  const token = signin.body.accessToken;
  const userId = signin.body.user?._id;
  console.log("User _id:", userId);

  header("2) POST /api/check-discord (no Authorization header)");
  const noAuth = await fetchJson(`${BASE}/api/check-discord`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  console.log("HTTP", noAuth.status, "→", JSON.stringify(noAuth.body));

  header("3) POST /api/check-discord (auth OK, discord NOT connected yet)");
  const noDiscord = await fetchJson(`${BASE}/api/check-discord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      id: "650000000000000000000099",
      questId: "650000000000000000000099",
      tag: "send-message-discord",
      channelId: "780000000000000099",
    }),
  });
  console.log("HTTP", noDiscord.status, "→", JSON.stringify(noDiscord.body));

  header("4) GET /api/discord/update?discord_id=…&username=…");
  const fakeDiscordId = String(Date.now());
  const fakeUsername = `qa-tester-${fakeDiscordId}`;
  const connectDiscord = await fetchJson(
    `${BASE}/api/discord/update?discord_id=${fakeDiscordId}&username=${fakeUsername}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  console.log("HTTP", connectDiscord.status, "→", JSON.stringify(connectDiscord.body).slice(0, 240));

  header("5) POST /api/check-discord (auth + discord, bogus quest id)");
  const bogusAfter = await fetchJson(`${BASE}/api/check-discord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      id: "650000000000000000000099",
      questId: "650000000000000000000099",
      tag: "send-message-discord",
    }),
  });
  console.log("HTTP", bogusAfter.status, "→", JSON.stringify(bogusAfter.body));

  console.log("\n══════════════════════════════════════════");
  console.log("Test-wallet flow complete");
  console.log("══════════════════════════════════════════");
}

main().catch((err) => {
  console.error("script error:", err);
  process.exit(2);
});
