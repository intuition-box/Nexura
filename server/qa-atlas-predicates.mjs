// Standalone test harness — no project code changes; mirrors the exact GraphQL
// decision made in app.controller.ts `validateAtlasTask` so we can verify
// i-trust / i-collaborated / i-follow / i-interact behave correctly against
// live Intuition Atlas data without needing a logged-in JWT.
//
// Run with: bun server/qa-atlas-predicates.mjs   (from nexura-app/)

import { config } from "dotenv";
config({ path: "./.env" });

import mongoose from "mongoose";
import { GraphQLClient, gql } from "graphql-request";
import { checksumAddress } from "viem";
import { API_URL_DEV, API_URL_PROD } from "@0xintuition/graphql";

const DB_URI = process.env.DB_URI;
const NETWORK = (process.env.NETWORK ?? "testnet").trim().toLowerCase();
const GRAPHQL_API_URL =
  NETWORK === "mainnet" ? API_URL_PROD : API_URL_DEV;

const PREDICATES = {
  "i-trust": "0x3a73f3b1613d166eea141a25a2adc70db9304ab3c4e90daecad05f86487c3ee9",
  "i-collaborated":
    "0x314e6d36910ee516b9fc5f20470b0bca0e36137f5dbcb38e30356fc5396cccdc",
  "i-follow":
    "0xffd07650dc7ab341184362461ebf52144bf8bcac5a19ef714571de15f1319260",
  "i-interact":
    "0x6e4659631eae2d115a8d2a557a1705dead1b0d8e8987b5f7a0f567d8cc676b8a",
};

const Q = gql`
  query GetAtomTriples($atomId: String!, $address: String!) {
    atom(term_id: $atomId) {
      label
      as_predicate_triples(
        where: { positions: { account_id: { _eq: $address } } }
      ) {
        term {
          triple {
            term_id
            subject {
              label
            }
            object {
              label
            }
          }
        }
      }
    }
  }
`;

if (!DB_URI) {
  console.error("DB_URI missing from server/.env");
  process.exit(1);
}

console.log("NETWORK:", NETWORK);
console.log("GRAPHQL_API_URL:", GRAPHQL_API_URL);
console.log(
  "PREDICATES:",
  Object.fromEntries(
    Object.entries(PREDICATES).map(([k, v]) => [k, v.slice(0, 10) + "…"])
  )
);
console.log("---");

await mongoose.connect(DB_URI);
console.log("Mongo connected.");

const client = new GraphQLClient(GRAPHQL_API_URL);

// Pick 3 distinct users with non-empty addresses from the live DB.
const users = await mongoose.connection.db
  .collection("users")
  .find(
    { address: { $exists: true, $ne: "" } },
    { projection: { _id: 1, username: 1, address: 1 } }
  )
  .limit(3)
  .toArray();

if (!users.length) {
  console.error("No users with address found in Mongo. Aborting.");
  await mongoose.disconnect();
  process.exit(2);
}

console.log(
  `Found ${users.length} test user(s):`,
  users.map((u) => `${u.username}@${u.address.slice(0, 8)}`).join(", ")
);
console.log("===");

let pass = 0;
let fail = 0;

for (const u of users) {
  const addr = checksumAddress(u.address);
  console.log(`\nUSER  ${u.username ?? "<noname>"}  ${addr}`);

  for (const [tag, atomId] of Object.entries(PREDICATES)) {
    try {
      const data = await client.request(Q, { atomId, address: addr });
      const atom = data?.atom;
      const triples = atom?.as_predicate_triples ?? [];
      const label = atom?.label ?? "(no label)";

      console.log(
        `  • ${tag.padEnd(16)}  atom=${JSON.stringify(label)}  triples=${triples.length}  ${triples.length > 0 ? "✓ HAS POSITION" : "— no position"}`
      );
      if (triples.length > 0 && triples.length <= 3) {
        for (const t of triples) {
          const tr = t?.term?.triple;
          console.log(
            `      ↪ ${tr?.subject?.label ?? "?"}  —  ${label}  —  ${tr?.object?.label ?? "?"}   (term_id=${tr?.term_id?.slice(0, 12)}…)`
          );
        }
      }
      pass++;
    } catch (err) {
      console.log(`  • ${tag.padEnd(16)}  ERROR: ${err.message?.slice(0, 80) ?? err}`);
      fail++;
    }
  }
}

console.log("\n===");
console.log(`Probe complete.  tag×user combos run: ${pass} ok, ${fail} failed.`);

await mongoose.disconnect();
