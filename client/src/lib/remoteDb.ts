import { WalletSchema, Wallet } from "../schemas/wallet.schema";
import { ProjectSchema, Project } from "../schemas/project.schema";
import { UserSchema, type User } from "../schemas/user.schema";
import { buildUrl } from "./queryClient";
import { resilientFetch } from "@/lib/resilientFetch";

// Prefer configured remote backends, otherwise use the local server endpoints.
const WALLETS_BASE = process.env.NEXT_PUBLIC_WALLETS_API_URL || "";
const PROJECTS_BASE = process.env.NEXT_PUBLIC_PROJECTS_API_URL || "";


async function safeFetch(url: string, opts: any) {
  const fullUrl = url.startsWith('http') ? url : buildUrl(url);
  const finalOpts = { ...(opts || {}) };
  try {
    // Inject Authorization header from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          finalOpts.headers = finalOpts.headers || {};
          if (!finalOpts.headers['Authorization'] && !finalOpts.headers['authorization']) {
            finalOpts.headers['Authorization'] = `Bearer ${token}`;
          }
        }
      } catch (e) { /* ignore */ }
    }
  } catch (e) {
    // ignore
  }
  const res = await resilientFetch(fullUrl, finalOpts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Remote DB error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function createWallet(payload: Wallet) {
  const parsed = WalletSchema.parse(payload);
  // Prefer a configured wallets backend; otherwise do nothing (server-side
  // wallet provisioning happens via the /auth/wallet flow).
  if (WALLETS_BASE) {
    return safeFetch(`${WALLETS_BASE.replace(/\/$/, "")}/wallets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
  }
  // No-op on client when local server handles wallet provisioning via /auth/wallet
  return null as any;
}

// Request a server-side challenge message for a specific address.
// The backend may expose GET /challenge?address=... or POST /challenge.
export async function requestChallenge(address: string) {
  // Use configured wallets backend if present, otherwise call local /challenge
  const base = WALLETS_BASE ? WALLETS_BASE.replace(/\/$/, "") : "";
  if (base) {
    try {
      return await safeFetch(`${base}/challenge?address=${encodeURIComponent(address)}`, { method: "GET" });
    } catch (e) {
      return await safeFetch(`${base}/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
    }
  }

  // Local server
  try {
    return await safeFetch(`/challenge?address=${encodeURIComponent(address)}`, { method: "GET" });
  } catch (e) {
    return await safeFetch(`/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
  }
}

// Request a server-issued challenge (nonce/message) for the provided address.
// The server should return JSON like: { message: string }
// (duplicate removed - use the fallback-aware `requestChallenge` above)

export async function listWallets() {
  // No client-side wallet index when no external backend is configured.
  if (WALLETS_BASE) {
    return safeFetch(`${WALLETS_BASE.replace(/\/$/, "")}/wallets`, { method: "GET" });
  }
  return [];
}

// Create or upsert a user record from a wallet signature verification
export async function createUserFromWallet(payload: User) {
  const parsed = UserSchema.parse(payload);
  // Prefer an external users backend when configured. Otherwise rely on the
  // server-side wallet auth flow which will auto-provision users on /auth/wallet.
  try {
    try {
      const json = await safeFetch(`/api/me`, { method: "GET" });
      return json;
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }
  return null as any;
}

export async function createProject(payload: Project) {
  const parsed = ProjectSchema.parse(payload);
  // Prefer configured projects backend (Supabase or separate service). If
  // not configured, fall back to the local server API at /projects.
  if (PROJECTS_BASE) {
    return safeFetch(`${PROJECTS_BASE.replace(/\/$/, "")}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });
  }

  return safeFetch(`/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
}

// Create or upsert a project account linked to a wallet address (project-level login)
export async function createProjectAccount(payload: any) {
  // payload should be at minimum { address, chainId?, metadata?: {} }
  // Create a minimal project account on the projects API if no external
  // project-accounts backend is configured. This will create a placeholder
  // project owned by the provided wallet address.
  if (PROJECTS_BASE) {
    return safeFetch(`${PROJECTS_BASE.replace(/\/$/, "")}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  // Fallback: create a minimal project using the local /projects endpoint
  const placeholder = {
    name: `Project for ${payload.address?.slice?.(0, 8) ?? "unknown"}`,
    ownerAddress: payload.address,
    description: "Auto-created project account",
  } as any;
  return createProject(placeholder as any);
}

export async function createCampaign(projectId: string, campaign: any) {
  if (!PROJECTS_BASE) throw new Error("VITE_PROJECTS_API_URL not configured");
  return safeFetch(`${PROJECTS_BASE.replace(/\/$/, "")}/projects/${projectId}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(campaign),
  });
}

export async function createQuest(projectId: string, quest: any) {
  if (!PROJECTS_BASE) throw new Error("VITE_PROJECTS_API_URL not configured");
  return safeFetch(`${PROJECTS_BASE.replace(/\/$/, "")}/projects/${projectId}/quests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quest),
  });
}
