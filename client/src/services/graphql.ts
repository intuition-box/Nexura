import { resilientFetch } from "@/lib/resilientFetch";
const GRAPHQL_URL = "https://mainnet.intuition.sh/v1/graphql";

type Variables = Record<string, any>;

export const fetchGraphQL = async (query: string, variables: Variables = {}) => {
  console.log("[GRAPHQL] fetchGraphQL", { query, variables });
  const res = await resilientFetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  }, { retries: 2 }); // queries only read, so retrying is safe

  if (!res.ok) {
    throw new Error(`GraphQL error ${res.status}`);
  }

  const json = await res.json();
  console.log("[GRAPHQL] fetchGraphQL ✓", json.data);
  return json.data;
};

export const getAllAgents = async () => {
  console.log("[GRAPHQL] getAllAgents");
  const vaultQuery = `
    query GetAllAgents {
      vaults(limit: 100, order_by: { total_assets: desc }) {
        term_id
        total_assets
        total_shares
        current_share_price
      }
    }
  `;

  const vaultData = await fetchGraphQL(vaultQuery);
  const vaults = vaultData?.vaults ?? [];

  const termIds = vaults.map((v: any) => v.term_id);

  if (termIds.length === 0) {
    console.log("[GRAPHQL] getAllAgents ✓", []);
    return [];
  }

  const atomQuery = `
    query GetAgentsData($ids: [String!]!) {
      atoms(where: { term_id: { _in: $ids } }) {
        term_id
        label
        image
        type
      }
    }
  `;

  const atomData = await fetchGraphQL(atomQuery, { ids: termIds });
  const atoms = atomData?.atoms ?? [];

  return vaults.map((v: any) => {
    const meta = atoms.find(
      (a: any) => a.term_id.toLowerCase() === v.term_id.toLowerCase()
    );

    return {
      id: v.term_id,
      label: meta?.label ?? "Unknown Agent",
      image: meta?.image ?? null,
      totalAssets: v.total_assets,
      totalShares: v.total_shares,
    };
  });
};
