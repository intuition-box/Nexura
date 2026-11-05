import { projectApiRequest } from "./projectApi";

export type PricedToken = "TRUST" | "ETH" | "BNB";
export type TokenPrices = Partial<Record<PricedToken, number>>;

const COINGECKO_IDS: Record<PricedToken, string> = { TRUST: "intuition", ETH: "ethereum", BNB: "binancecoin" };

const clean = (raw: Record<string, unknown> | undefined): TokenPrices => {
  const out: TokenPrices = {};
  for (const t of Object.keys(COINGECKO_IDS) as PricedToken[]) {
    const v = Number(raw?.[t]);
    if (Number.isFinite(v) && v > 0) out[t] = v;
  }
  return out;
};

async function fromCoinGecko(): Promise<TokenPrices> {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`CoinGecko answered ${res.status}`);
  const body = await res.json() as Record<string, { usd?: number }>;
  return clean(Object.fromEntries((Object.entries(COINGECKO_IDS) as Array<[PricedToken, string]>).map(([t, id]) => [t, body?.[id]?.usd])));
}

/** USD prices from the Nexura API (CoinGecko with CoinMarketCap behind it), or straight from CoinGecko if the API can't answer. */
export async function loadTokenPrices(): Promise<TokenPrices> {
  try {
    const res = await projectApiRequest<{ prices?: Record<string, unknown> }>({ method: "GET", endpoint: "/token-prices" });
    const prices = clean(res?.prices);
    if (Object.keys(prices).length) return prices;
  } catch { /* fall back below */ }
  return fromCoinGecko();
}
