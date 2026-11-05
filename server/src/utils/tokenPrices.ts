import axios from "axios";
import logger from "@/config/logger";

// Reward tokens whose USD price isn't fixed (stablecoins are always $1), by each source's id
const SOURCES = {
  TRUST: { coingecko: "intuition", coinmarketcap: "intuition" },
  ETH: { coingecko: "ethereum", coinmarketcap: "ethereum" },
  BNB: { coingecko: "binancecoin", coinmarketcap: "bnb" },
} as const;
export type PricedToken = keyof typeof SOURCES;
type Prices = Partial<Record<PricedToken, number>>;

const CACHE_MS = 60_000;
const TIMEOUT_MS = 8_000;
const TOKENS = Object.keys(SOURCES) as PricedToken[];
const valid = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

async function fromCoinGecko(): Promise<Prices> {
  const ids = TOKENS.map(t => SOURCES[t].coingecko).join(",");
  const res = await axios.get("https://api.coingecko.com/api/v3/simple/price", { params: { ids, vs_currencies: "usd" }, timeout: TIMEOUT_MS });
  const prices: Prices = {};
  for (const t of TOKENS) {
    const usd = valid(res.data?.[SOURCES[t].coingecko]?.usd);
    if (usd !== null) prices[t] = usd;
  }
  return prices;
}

/** CoinMarketCap needs an API key (CMC_API_KEY); without one it's skipped. */
async function fromCoinMarketCap(tokens: PricedToken[]): Promise<Prices> {
  const key = process.env.CMC_API_KEY?.trim();
  if (!key || !tokens.length) return {};
  const res = await axios.get("https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest", {
    params: { slug: tokens.map(t => SOURCES[t].coinmarketcap).join(","), convert: "USD" },
    headers: { "X-CMC_PRO_API_KEY": key },
    timeout: TIMEOUT_MS,
  });
  const bySlug = new Map<string, number>();
  for (const coin of Object.values(res.data?.data ?? {}) as any[]) {
    const usd = valid(coin?.quote?.USD?.price);
    if (usd !== null && typeof coin?.slug === "string") bySlug.set(coin.slug, usd);
  }
  const prices: Prices = {};
  for (const t of tokens) {
    const usd = bySlug.get(SOURCES[t].coinmarketcap);
    if (usd !== undefined) prices[t] = usd;
  }
  return prices;
}

async function fetchPrices(): Promise<Prices> {
  const primary = await fromCoinGecko().catch(err => { logger.warn(`CoinGecko prices failed: ${err?.message}`); return {} as Prices; });
  const missing = TOKENS.filter(t => primary[t] === undefined);
  const fallback = await fromCoinMarketCap(missing).catch(err => { logger.warn(`CoinMarketCap prices failed: ${err?.message}`); return {} as Prices; });
  return { ...fallback, ...primary };
}

let cached: { at: number; prices: Prices } | null = null;
let inflight: Promise<Prices> | null = null;

/** Live USD prices from CoinGecko, filled in from CoinMarketCap, cached for a minute. Keeps the last known price of any token both sources miss. */
export async function tokenPricesUsd(): Promise<Prices> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.prices;
  inflight ??= fetchPrices()
    .then(fresh => {
      const prices = { ...(cached?.prices ?? {}), ...fresh };
      cached = { at: Date.now(), prices };
      return prices;
    })
    .finally(() => { inflight = null; });
  return inflight;
}
