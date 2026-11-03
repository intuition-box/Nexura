"use client";
import { NexuraScoreInfoButton } from "@/components/studio/NexuraScoreExplainer";
import React, { useState, useRef, useEffect } from "react";
import { scrollToTop } from "@/lib/scrollToTop";
import SignInPrompt from "@/components/studio/SignInPrompt";
import StudioHeader from "@/components/studio/StudioHeader";
import { STUDIO_SIGN_IN_URL, useProjectSession } from "@/components/studio/useProjectSession";
import { readUrlParam, writeUrlParam } from "@/hooks/use-url-state";

// ─── TEMPLATE DATA ────────────────────────────────────────────────────────────
const DEFAULT_RETENTION_REQUIREMENT = "90";
const COVER_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/gif"];
const COVER_MAX_BYTES = 5 * 1024 * 1024; // the server rejects uploads over 5MB
import { MAIN_APP_URL as NEXURA_MAIN_APP_URL } from "@/lib/mainAppUrl";
const TEMPLATES = [
  {
    id: "tpl1", months: 3, stageCount: 5, retentionPct: 75, name: "Template 1", badge: "Retention",
    duration: "3 months", stages: "5 stages", retentionRate: "75%",
    structure: [
      { pct: 10, barColor: "#8b6bf0", dotColor: "#8b6bf0", roundL: true,  roundR: false },
      { pct: 10, barColor: "#8b6bf0", dotColor: "#8b6bf0", roundL: false, roundR: false },
      { pct: 15, barColor: "#a484ff", dotColor: "#7c5cfc", roundL: false, roundR: false },
      { pct: 25, barColor: "#9b7cff", dotColor: "#9b7cff", roundL: false, roundR: false },
      { pct: 40, barColor: "#00e5c0", dotColor: "#00e5c0", roundL: false, roundR: true  },
    ],
  },
  {
    id: "tpl2", months: 9, stageCount: 5, retentionPct: 90, name: "Template 2", badge: "Retention",
    duration: "9 months", stages: "5 stages", retentionRate: "90%",
    structure: [
      { pct: 10, barColor: "#8b6bf0", dotColor: "#8b6bf0", roundL: true,  roundR: false },
      { pct: 10, barColor: "#8b6bf0", dotColor: "#8b6bf0", roundL: false, roundR: false },
      { pct: 15, barColor: "#a484ff", dotColor: "#7c5cfc", roundL: false, roundR: false },
      { pct: 25, barColor: "#9b7cff", dotColor: "#9b7cff", roundL: false, roundR: false },
      { pct: 40, barColor: "#00e5c0", dotColor: "#00e5c0", roundL: false, roundR: true  },
    ],
  },
  {
    id: "tpl3", months: 5, stageCount: 5, retentionPct: 70, name: "Template 3", badge: "Retention",
    duration: "5 months", stages: "5 stages", retentionRate: "70%",
    structure: [
      { pct: 10, barColor: "#8b6bf0", dotColor: "#8b6bf0", roundL: true,  roundR: false },
      { pct: 10, barColor: "#8b6bf0", dotColor: "#8b6bf0", roundL: false, roundR: false },
      { pct: 15, barColor: "#a484ff", dotColor: "#7c5cfc", roundL: false, roundR: false },
      { pct: 30, barColor: "#9b7cff", dotColor: "#9b7cff", roundL: false, roundR: false },
      { pct: 35, barColor: "#00e5c0", dotColor: "#00e5c0", roundL: false, roundR: true  },
    ],
  },
];

// ─── NETWORKS & TOKENS ────────────────────────────────────────────────────────
// Official logos: chains/tokens from @web3icons/core (branded set); Intuition mark from the Nexura Figma file.
const CHAIN_LOGO_SVG: Record<string, string> = {
  net_arbitrum: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\" viewBox=\"0 0 24 24\">\n    <g clip-path=\"url(#arbitrum-one__a)\">\n        <path fill=\"#213147\" d=\"M24 0H0v24h24z\"/>\n        <path fill=\"#fff\" d=\"m13.203 13.216-.787 2.124a.27.27 0 0 0 0 .183l1.354 3.655 1.565-.89-1.879-5.072c-.042-.117-.21-.117-.253 0m1.577-3.573a.135.135 0 0 0-.253 0l-.787 2.124a.27.27 0 0 0 0 .183l2.217 5.985 1.565-.89z\"/>\n        <path fill=\"#fff\" d=\"M11.999 4.991a.24.24 0 0 1 .111.03l5.969 3.393a.22.22 0 0 1 .112.19v6.787a.22.22 0 0 1-.112.19l-5.969 3.395a.2.2 0 0 1-.111.029.24.24 0 0 1-.113-.03l-5.968-3.39a.22.22 0 0 1-.112-.19v-6.79a.22.22 0 0 1 .112-.19l5.969-3.393a.23.23 0 0 1 .111-.03m0-.991c-.213 0-.426.054-.616.163L5.416 7.556a1.21 1.21 0 0 0-.616 1.05v6.787c0 .433.234.834.616 1.05l5.968 3.394a1.25 1.25 0 0 0 1.232 0l5.968-3.394a1.21 1.21 0 0 0 .616-1.05V8.606a1.21 1.21 0 0 0-.616-1.05l-5.97-3.393A1.24 1.24 0 0 0 11.998 4\"/>\n        <path fill=\"#fff\" d=\"m8.052 17.943.55-1.482 1.105.905-1.034.93zm3.445-9.823H9.984a.27.27 0 0 0-.254.175l-3.243 8.757 1.565.89L11.623 8.3a.132.132 0 0 0-.127-.179\"/>\n        <path fill=\"#fff\" d=\"M14.144 8.12h-1.513a.27.27 0 0 0-.253.175l-3.704 10 1.565.89 4.032-10.886a.133.133 0 0 0-.127-.179\"/>\n    </g>\n    <defs>\n        <clipPath id=\"arbitrum-one__a\">\n            <path fill=\"#fff\" d=\"M0 0h24v24H0z\"/>\n        </clipPath>\n    </defs>\n</svg>",
  net_base: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 111 111\" fill=\"none\"><circle cx=\"55.5\" cy=\"55.5\" r=\"55.5\" fill=\"#fff\"/><path d=\"M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z\" fill=\"#0052FF\"/></svg>",
  net_ethereum: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\" viewBox=\"0 0 24 24\">\n    <g clip-path=\"url(#ethereum__a)\">\n        <path fill=\"#000\" d=\"M24 0H0v24h24z\"/>\n        <path fill=\"#8FFCF3\" d=\"M12 4v5.912l5 2.237z\"/>\n        <path fill=\"#CABCF8\" d=\"m12 4-5 8.148 5-2.235z\"/>\n        <path fill=\"#CBA7F5\" d=\"M12 15.98V20l5-6.92z\"/>\n        <path fill=\"#74A0F3\" d=\"M12 20v-4.02l-5-2.9z\"/>\n        <path fill=\"#CBA7F5\" d=\"m12 15.049 5-2.9-5-2.236z\"/>\n        <path fill=\"#74A0F3\" d=\"m7 12.149 5 2.9V9.913z\"/>\n        <path fill=\"#202699\" fill-rule=\"evenodd\" d=\"m12 15.048-5-2.9L12 4l5 8.148zm-4.67-3.136 4.588-7.475v5.435zm-.068.204 4.656-2.068v4.768zm4.816-2.068v4.768l4.653-2.7zm0-.176 4.588 2.04-4.588-7.475z\" clip-rule=\"evenodd\"/>\n        <path fill=\"#202699\" fill-rule=\"evenodd\" d=\"m12 15.917-5-2.84L12 20l5-6.924zm-4.44-2.341 4.36 2.48v3.56zm4.519 2.48v3.56l4.36-6.04z\" clip-rule=\"evenodd\"/>\n    </g>\n    <defs>\n        <clipPath id=\"ethereum__a\">\n            <path fill=\"#fff\" d=\"M0 0h24v24H0z\"/>\n        </clipPath>\n    </defs>\n</svg>",
  net_bnb: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\" viewBox=\"0 0 24 24\">\n    <g clip-path=\"url(#binance-smart-chain__a)\">\n        <path fill=\"#F0B90B\" d=\"M24 0H0v24h24z\"/>\n        <path fill=\"#fff\" d=\"M7.635 6.449 12 4l4.364 2.449-1.6.907L12 5.809 9.24 7.356zm8.73 3.093-1.6-.906L12 10.182 9.24 8.636l-1.605.906v1.81l2.756 1.546v3.089l1.609.906 1.604-.906v-3.09l2.76-1.546zm0 4.903V12.63l-1.6.907v1.809zm1.141.64-2.76 1.542v1.813l4.365-2.453v-4.898l-1.605.902zm-1.604-7.09 1.6.907v1.81l1.609-.903V7.996l-1.605-.907L15.902 8zm-5.511 9.29v1.808L12 20l1.604-.907V17.29l-1.604.9-1.605-.907zM7.635 14.44l1.6.907v-1.81l-1.6-.906v1.813zm2.756-6.444L12 8.902l1.604-.906L12 7.089 10.395 8zm-3.898.906 1.605-.906-1.6-.907L4.888 8v1.813l1.605.903zm0 3.09-1.604-.903v4.898l4.364 2.453v-1.818L6.498 15.08v-3.093z\"/>\n    </g>\n    <defs>\n        <clipPath id=\"binance-smart-chain__a\">\n            <path fill=\"#fff\" d=\"M0 0h24v24H0z\"/>\n        </clipPath>\n    </defs>\n</svg>",
  net_robinhood: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\" viewBox=\"0 0 24 24\">\n    <g clip-path=\"url(#robinhood__a)\">\n        <path fill=\"#CF0\" d=\"M24 0H0v24h24z\"/>\n        <path fill=\"#1C180D\" d=\"M5.597 20h.37c.067 0 .134-.032.157-.086C8.918 13.13 11.958 9.77 13.866 7.76c.078-.086.045-.15-.068-.15h-3.41a.4.4 0 0 0-.315.15l-2.446 2.889c-.359.428-.448.824-.448 1.39v2.954c-.797 2.13-1.302 3.574-1.672 4.88-.023.083.011.128.09.128M17.905 4.43c-.527-.534-2.906-.555-4.006-.149a2.2 2.2 0 0 0-.55.31 28 28 0 0 0-2.322 2.12c-.079.074-.045.149.067.149h3.782c.347 0 .55.193.55.524v4.066c0 .107.09.14.156.043l2.278-2.835c.37-.46.483-.6.584-1.242.134-.941.056-2.386-.54-2.985m-4.88 10.787 1.559-2.45a.4.4 0 0 0 .045-.193V8.486c0-.107-.079-.15-.157-.064-2.345 2.493-4.174 5.115-5.868 8.272-.043.079.01.15.112.117l3.5-1.027c.395-.116.618-.268.808-.567\"/>\n    </g>\n    <defs>\n        <clipPath id=\"robinhood__a\">\n            <path fill=\"#fff\" d=\"M0 0h24v24H0z\"/>\n        </clipPath>\n    </defs>\n</svg>",
  tok_ETH: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\" viewBox=\"0 0 24 24\">\n    <g clip-path=\"url(#ETH__a)\">\n        <path fill=\"#000\" d=\"M24 0H0v24h24z\"/>\n        <path fill=\"#8FFCF3\" d=\"M12 4v5.912l5 2.236z\"/>\n        <path fill=\"#CABCF8\" d=\"m12 4-5 8.148 5-2.236z\"/>\n        <path fill=\"#CBA7F5\" d=\"M12 15.98V20l5-6.92z\"/>\n        <path fill=\"#74A0F3\" d=\"M12 20v-4.02l-5-2.9z\"/>\n        <path fill=\"#CBA7F5\" d=\"m12 15.048 5-2.9-5-2.236z\"/>\n        <path fill=\"#74A0F3\" d=\"m7 12.148 5 2.9V9.912z\"/>\n        <path fill=\"#202699\" fill-rule=\"evenodd\" d=\"m12 15.048-5-2.9L12 4l5 8.148zm-4.668-3.136 4.588-7.476v5.436zm-.068.204 4.656-2.068v4.768zm4.816-2.068v4.768l4.652-2.7zm0-.176 4.588 2.04-4.588-7.476z\" clip-rule=\"evenodd\"/>\n        <path fill=\"#202699\" fill-rule=\"evenodd\" d=\"m12 15.916-5-2.84L12 20l5-6.924zm-4.44-2.34 4.36 2.48v3.56zm4.52 2.48v3.56l4.36-6.04z\" clip-rule=\"evenodd\"/>\n    </g>\n    <defs>\n        <clipPath id=\"ETH__a\">\n            <path fill=\"#fff\" d=\"M0 0h24v24H0z\"/>\n        </clipPath>\n    </defs>\n</svg>",
  tok_USDC: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\" viewBox=\"0 0 24 24\">\n    <g clip-path=\"url(#USDC__a)\">\n        <path fill=\"#0B53BF\" d=\"M24 0H0v24h24z\"/>\n        <path fill=\"#fff\" fill-rule=\"evenodd\" d=\"M12 20c4.435 0 8-3.565 8-8s-3.565-8-8-8-8 3.565-8 8 3.565 8 8 8m2.2-6.735c0-1.165-.7-1.565-2.1-1.73-1-.135-1.2-.4-1.2-.87 0-.465.335-.765 1-.765.6 0 .935.2 1.1.7.035.1.135.165.235.165h.53c.135 0 .235-.1.235-.23v-.036c-.135-.734-.735-1.434-1.5-1.5v-.734c0-.135-.1-.235-.265-.265h-.44c-.135 0-.26.1-.295.265V9c-1 .135-1.665.9-1.665 1.735 0 1.1.665 1.53 2.065 1.7.935.165 1.235.365 1.235.9 0 .53-.47.9-1.1.9-.87 0-1.17-.37-1.27-.87-.03-.13-.13-.2-.23-.2h-.57c-.13 0-.23.1-.23.235v.035c.13.83.665 1.4 1.765 1.565v.74c0 .135.1.224.265.26h.48c.13 0 .22-.09.255-.26V15c1-.165 1.7-.835 1.7-1.735m-5.566 2.49c.483.443 1.05.786 1.666 1.01.1.07.2.2.2.3v.47c0 .064 0 .1-.035.13-.03.134-.165.2-.3.134a6 6 0 0 1 0-11.435c.035-.03.1-.03.135-.03.135.03.2.13.2.265v.465c0 .17-.065.27-.2.335a4.93 4.93 0 0 0-2.965 2.965 4.965 4.965 0 0 0 1.299 5.391M13.535 6.5c.03-.135.165-.2.3-.135a6.05 6.05 0 0 1 3.9 3.935c1 3.165-.735 6.535-3.9 7.535-.035.03-.1.03-.135.03-.135-.03-.2-.13-.2-.265v-.465c0-.17.065-.27.2-.335a4.93 4.93 0 0 0 2.965-2.965 4.967 4.967 0 0 0-2.965-6.4c-.1-.07-.2-.2-.2-.335v-.465c0-.07 0-.1.035-.135\" clip-rule=\"evenodd\"/>\n    </g>\n    <defs>\n        <clipPath id=\"USDC__a\">\n            <path fill=\"#fff\" d=\"M0 0h24v24H0z\"/>\n        </clipPath>\n    </defs>\n</svg>",
  tok_USDT: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\" viewBox=\"0 0 24 24\">\n    <g clip-path=\"url(#USDT__a)\">\n        <path fill=\"#009393\" d=\"M24 0H0v24h24z\"/>\n        <path fill=\"#fff\" d=\"m12 18.4-8-7.892L7.052 5.6h9.896L20 10.508zm.8-7.2v-.976c1.44.072 2.784.352 3.2.716-.484.424-2.216.732-4 .732s-3.516-.308-4-.732c.412-.364 1.76-.64 3.2-.72v.98zM8 10.936v.588c.412.364 1.756.64 3.2.72V14.4h1.6v-2.16c1.44-.072 2.788-.352 3.2-.716v-1.172c-.412-.364-1.76-.644-3.2-.72V8.8h2.4V7.6H8.8v1.2h2.4v.832c-1.444.076-2.788.356-3.2.72z\"/>\n    </g>\n    <defs>\n        <clipPath id=\"USDT__a\">\n            <path fill=\"#fff\" d=\"M0 0h24v24H0z\"/>\n        </clipPath>\n    </defs>\n</svg>",
  tok_BNB: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\" viewBox=\"0 0 24 24\">\n    <g clip-path=\"url(#BNB__a)\">\n        <path fill=\"#000\" d=\"M24 0H0v24h24z\"/>\n        <path fill=\"#F0B90B\" d=\"M7.454 6.449 12 4l4.547 2.449-1.667.907L12 5.809 9.125 7.356zm9.093 3.093-1.667-.906L12 10.182 9.125 8.636l-1.671.906v1.81l2.87 1.546v3.089l1.676.906 1.672-.906v-3.09l2.875-1.546zm0 4.903V12.63l-1.667.907v1.809zm1.19.64-2.876 1.542v1.813l4.547-2.453v-4.898l-1.672.902zm-1.672-7.09 1.667.907v1.81l1.676-.903V7.996l-1.672-.907L16.065 8zm-5.74 9.29v1.808L12 20l1.672-.907V17.29l-1.672.9-1.671-.907zM7.453 14.44l1.667.907v-1.81l-1.667-.906v1.813zm2.87-6.444L12 8.902l1.672-.906L12 7.089 10.33 8zm-4.06.906 1.671-.906-1.666-.907L4.593 8v1.813l1.671.903V8.902m0 3.09-1.671-.903v4.898l4.546 2.453v-1.818L6.27 15.08v-3.093z\"/>\n    </g>\n    <defs>\n        <clipPath id=\"BNB__a\">\n            <path fill=\"#fff\" d=\"M0 0h24v24H0z\"/>\n        </clipPath>\n    </defs>\n</svg>",
  intuition: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\"><circle cx=\"12\" cy=\"12\" r=\"12\" fill=\"#0B1022\"/><circle cx=\"12\" cy=\"12\" r=\"7.6\" stroke=\"#E8ECF8\" stroke-width=\"1.7\"/></svg>",
};
type TokenSymbol = "ETH" | "USDC" | "USDT" | "BNB" | "TRUST" | "tTRUST";
export type NetworkId = "intuition-testnet" | "arbitrum" | "base" | "ethereum" | "bnb" | "intuition" | "robinhood";
// Nexura launches on Intuition Testnet first (chain ID 13579, native token tTRUST), so it is the default network.
const DEFAULT_NETWORK: NetworkId = "intuition-testnet";
export const NETWORKS: Array<{ id: NetworkId; name: string; logo: string; tokens: TokenSymbol[]; chainId: number | null }> = [
  { id: "intuition-testnet", name: "Intuition Testnet", logo: "intuition", tokens: ["tTRUST"], chainId: 13579 },
  { id: "arbitrum",  name: "Arbitrum",          logo: "net_arbitrum",  tokens: ["ETH", "USDC", "USDT"], chainId: 42161 },
  { id: "base",      name: "Base",              logo: "net_base",      tokens: ["ETH", "TRUST", "USDC"], chainId: 8453 },
  { id: "ethereum",  name: "Ethereum",          logo: "net_ethereum",  tokens: ["ETH", "USDC", "USDT"], chainId: 1 },
  { id: "bnb",       name: "BNB Chain",         logo: "net_bnb",       tokens: ["USDT", "USDC", "BNB"], chainId: 56 },
  { id: "intuition", name: "Intuition Mainnet", logo: "intuition",     tokens: ["TRUST"], chainId: 1155 },
  { id: "robinhood", name: "Robinhood Chain",   logo: "net_robinhood", tokens: ["ETH"], chainId: null },
];
const TOKEN_LOGO: Record<TokenSymbol, string> = { ETH: "tok_ETH", USDC: "tok_USDC", USDT: "tok_USDT", BNB: "tok_BNB", TRUST: "intuition", tTRUST: "intuition" };
const STABLE_TOKENS: TokenSymbol[] = ["USDC", "USDT"];
// USD price used for the $ rules. Testnet TRUST is valued at a fixed $100 (overridable via the tokenPricesUsd prop).
const TESTNET_TRUST_USD = 100;
function usdPriceOf(t: TokenSymbol, prices?: Partial<Record<TokenSymbol, number>>): number | null {
  if (STABLE_TOKENS.includes(t)) return 1;
  if (t === "tTRUST") return prices?.tTRUST ?? TESTNET_TRUST_USD;
  return prices?.[t] ?? null;
}
export function ChainLogo({ logo, size = 18 }: { logo: string; size?: number }) {
  const svg = (CHAIN_LOGO_SVG[logo] || "").replace('width="24" height="24"', `width="${size}" height="${size}"`);
  return <span aria-hidden="true" style={{ display: "inline-flex", width: size, height: size, flexShrink: 0, lineHeight: 0, borderRadius: "50%", overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
const TOKEN_NAMES: Record<TokenSymbol, string> = { ETH: "Ether", USDC: "USD Coin", USDT: "Tether USD", BNB: "BNB", TRUST: "Intuition TRUST", tTRUST: "Testnet TRUST" };
export function CheckMark() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M13.3 4L6 11.3 2.7 8" stroke="#8b3efe" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function MenuRow({ selected, onClick, logo, title, sub }: { selected: boolean; onClick: () => void; logo: string; title: string; sub?: string }) {
  return (
    <button
      role="option" aria-selected={selected} onClick={onClick}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "#f7f4fe"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 14, border: "none", background: selected ? "rgba(138,63,252,0.08)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const, transition: "background 0.12s" }}
    >
      <ChainLogo logo={logo} size={28} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1c2533", lineHeight: "18px" }}>{title}</span>
        {sub && <span style={{ fontSize: 11.5, color: "#69728a", lineHeight: "16px", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>}
      </span>
      {selected && <CheckMark />}
    </button>
  );
}
export function NetworkList({ value, onSelect }: { value: NetworkId; onSelect: (id: NetworkId) => void }) {
  return (
    <div role="listbox" aria-label="Network" style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {NETWORKS.map(n => {
        const sel = value === n.id;
        return (
          <button key={n.id} role="option" aria-selected={sel}
            onMouseDown={e => { e.preventDefault(); onSelect(n.id); }}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(n.id); } }}
            onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#f7f4fe"; }}
            onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 10, border: "none", background: sel ? "rgba(138,63,252,0.08)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const }}>
            <ChainLogo logo={n.logo} size={18} />
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: sel ? 600 : 500, color: "#1c2533", whiteSpace: "nowrap" as const }}>{n.name}</span>
            {sel && <CheckMark />}
          </button>
        );
      })}
    </div>
  );
}
export const POPOVER: React.CSSProperties = { position: "absolute", top: "calc(100% + 8px)", width: 290, maxWidth: "calc(100vw - 32px)", background: "white", border: "1px solid rgba(28,37,51,0.1)", borderRadius: 20, boxShadow: "0 18px 40px -14px rgba(28,37,51,0.28)", padding: 6, zIndex: 200, boxSizing: "border-box" };
export const POPOVER_TITLE: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#98a0b4", letterSpacing: 0.6, textTransform: "uppercase", padding: "8px 12px 6px" };
// Retention distribution supplied by the backend (users bucketed by their retention %)
type RetentionStats = { totalUsers: number; buckets: Array<{ fromPct: number; toPct: number; users: number }>; updatedAt?: string };
// SAMPLE DATA for previews only. Used when the `retentionStats` prop is not passed at all.
// In the app, pass real stats from the API (or `null` while unavailable) so this is never shown to projects.
const SAMPLE_RETENTION_STATS: RetentionStats = {
  totalUsers: 48200,
  buckets: [
    { fromPct: 90, toPct: 100, users: 4120 },
    { fromPct: 80, toPct: 90,  users: 6180 },
    { fromPct: 70, toPct: 80,  users: 7350 },
    { fromPct: 60, toPct: 70,  users: 6900 },
    { fromPct: 50, toPct: 60,  users: 6400 },
    { fromPct: 40, toPct: 50,  users: 5200 },
    { fromPct: 30, toPct: 40,  users: 4300 },
    { fromPct: 20, toPct: 30,  users: 3600 },
    { fromPct: 10, toPct: 20,  users: 2600 },
    { fromPct: 0,  toPct: 10,  users: 1550 },
  ],
};

// ─── TASK CATALOG ─────────────────────────────────────────────────────────────
export const TASK_CATALOG = [
  { id: "custom",              name: "Create a custom task",           category: "Custom",   points: 50,  description: "Create a unique task tailored to your specific campaign goals.", subtext: "Manual Validation" },
  { id: "follow-x",           name: "Follow an account on X",             category: "Social",   points: 100, description: "Ask participants to follow your official X (Twitter) account.",        subtext: "Auto Validated"   },
  { id: "portal-claims",      name: "I Trust (Portal claims)",            category: "On-chain", points: 200, description: "Verify on-chain trust attestations through the portal system.",        subtext: "Auto Validated"   },
  { id: "product-feature",    name: "Use a product feature",              category: "Product",  points: 150, description: "Encourage participants to explore and use a key product feature.",     subtext: "Manual Validation" },
  { id: "trust-username",     name: "Own a .trust username",              category: "On-chain", points: 250, description: "Verify ownership of a .trust username on-chain.",                    subtext: "Auto Validated"   },
  { id: "discord-msg",        name: "Send message in discord channel",    category: "Community", points: 75,  description: "Engage participants by having them send a message in your Discord.",   subtext: "Auto Validated"   },
  { id: "give-feedback",      name: "Give feedback",                      category: "Feedback", points: 100, description: "Collect valuable feedback from participants about your product.",       subtext: "Manual Validation" },
  { id: "comment-x",          name: "Comment on X",                       category: "Social",   points: 75,  description: "Have participants comment on a specific post on X (Twitter).",         subtext: "Auto Validated"   },
  { id: "retweet-x",          name: "Retweet on X",                       category: "Social",   points: 75,  description: "Amplify your reach by having participants retweet your post.",         subtext: "Auto Validated"   },
  { id: "like-x",             name: "Like a post on X",                   category: "Social",   points: 50,  description: "Encourage participants to like your post on X (Twitter).",             subtext: "Auto Validated"   },
  { id: "join-discord",       name: "Join Discord server",                category: "Community", points: 125, description: "Grow your community by having participants join your Discord server.",  subtext: "Auto Validated"   },
  { id: "telegram-join",      name: "Join Telegram group",                category: "Community", points: 100, description: "Have participants join your official Telegram group or channel.",       subtext: "Auto Validated"   },
  { id: "portal-collab",      name: "I Collaborated (Portal claims)",     category: "On-chain", points: 200, description: "Verify on-chain collaboration attestations through the portal.",       subtext: "Auto Validated"   },
  { id: "portal-interacted",  name: "I Interacted (Portal claims)",       category: "On-chain", points: 175, description: "Verify on-chain interaction attestations through the portal.",        subtext: "Auto Validated"   },
  { id: "portal-follow",      name: "I Follow (Portal claims)",           category: "On-chain", points: 150, description: "Verify on-chain follow attestations through the portal.",             subtext: "Auto Validated"   },
  { id: "portal-support",     name: "Portal Claims (Support or Oppose)",  category: "On-chain", points: 225, description: "Signal your stance by supporting or opposing claims on the portal.",  subtext: "Auto Validated"   },
];

type ValidationMode = "manual" | "peer" | "link" | "api";
const MAX_STAGES = 6;
const MAX_TASKS_PER_STAGE = 10;
// Retention presets: days after the previous stage (stage 1: after joining)
const RETENTION_PRESETS = [0, 1, 2, 3, 5, 7, 14];
// Social task links must point at the right platform
const SOCIAL_URL_RULES: Array<{ tasks: string[]; hosts: string[]; message: string }> = [
  { tasks: ["follow-x", "comment-x", "retweet-x", "like-x"], hosts: ["x.com"], message: "This is not an X.com URL. Use a link that starts with https://x.com/" },
  { tasks: ["join-discord", "discord-msg"], hosts: ["discord.com", "discord.gg"], message: "This is not a Discord URL. Use a discord.com or discord.gg link" },
  { tasks: ["telegram-join"], hosts: ["t.me", "telegram.me"], message: "This is not a Telegram URL. Use a t.me link" },
];
function socialUrlError(taskTypeId: string, raw: string): string | null {
  const rule = SOCIAL_URL_RULES.find(r => r.tasks.includes(taskTypeId));
  const value = raw.trim();
  if (!rule || !value) return null;
  let host = "";
  try { host = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase(); } catch { return rule.message; }
  host = host.replace(/^www\./, "");
  const ok = rule.hosts.some(h => host === h || host.endsWith(`.${h}`));
  return ok ? null : rule.message;
}
function isSocialUrlTask(taskTypeId: string): boolean { return SOCIAL_URL_RULES.some(r => r.tasks.includes(taskTypeId)); }
const JOURNEY_STAGE_NAMES = ["Join & explore", "Come back", "Build the habit", "Go deeper", "Stay active", "Complete the journey"];
function journeyTemplatePlan(count: number, cadence: "daily" | "weekly"): Array<{ name: string; returnDays: number; when: string }> {
  const n = Math.max(1, Math.min(MAX_STAGES, count));
  const gap = cadence === "daily" ? 1 : 7;
  const names = n >= JOURNEY_STAGE_NAMES.length ? JOURNEY_STAGE_NAMES : [...JOURNEY_STAGE_NAMES.slice(0, n - 1), JOURNEY_STAGE_NAMES[JOURNEY_STAGE_NAMES.length - 1]];
  return names.slice(0, n).map((name, i) => ({ name, returnDays: i === 0 ? 0 : gap, when: cadence === "daily" ? `Day ${i + 1}` : `Week ${i + 1}` }));
}
function addMonthsISO(iso: string, months: number): string {
  const [datePart, timePart = "00:00"] = iso.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return "";
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(Math.min(d, lastDay))}T${timePart}`;
}
function fmtRetention(days: number): string {
  if (days <= 0) return "Immediately";
  if (days % 30 === 0) { const m = days / 30; return `${m} month${m !== 1 ? "s" : ""}`; }
  if (days >= 21 && days % 7 === 0) { const w = days / 7; return `${w} weeks`; }
  return `${days} day${days !== 1 ? "s" : ""}`;
}
// ─── Rewards maths (Figma: Reward pool & eligibility) ───
const MIN_PER_STAGE_USD = 2;
const OPENING_FEE_USD = 500;
const RETURN_ORDINALS = ["Entry stage", "First Return", "Second Return", "Third Return", "Fourth Return", "Fifth Return"];
const TEMPLATE_SPLITS: Record<number, number[]> = { 1: [100], 2: [40, 60], 3: [20, 30, 50], 4: [10, 20, 30, 40], 5: [10, 10, 15, 25, 40], 6: [5, 10, 10, 15, 25, 35] };
function fmtUSD(n: number): string {
  if (!isFinite(n)) return "$0";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function fmtNum(n: number): string { return n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function round1(n: number): number { return Math.round(n * 10) / 10; }
// Even split that always sums to exactly 100 (one decimal)
function evenSplit(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((100 / n) * 10) / 10;
  const out = Array(n).fill(base);
  out[n - 1] = round1(100 - base * (n - 1));
  return out;
}
// Template split, raised so every stage clears the $2 minimum where the pool allows it
function templateSplit(n: number, maxPerRecipient: number): number[] {
  if (n <= 0) return [];
  const t = [...(TEMPLATE_SPLITS[n] || evenSplit(n))];
  if (maxPerRecipient <= 0) return t;
  const minPct = Math.ceil((MIN_PER_STAGE_USD / maxPerRecipient) * 1000) / 10;
  if (minPct * n > 100) return t;
  let deficit = 0;
  const out = t.map(v => { if (v < minPct) { deficit += minPct - v; return minPct; } return v; });
  while (deficit > 0.0001) {
    let idx = -1;
    out.forEach((v, i) => { if (v - minPct > 0.0001 && (idx === -1 || v > out[idx])) idx = i; });
    if (idx === -1) break;
    const take = Math.min(deficit, out[idx] - minPct);
    out[idx] = round1(out[idx] - take);
    deficit = round1(deficit - take);
  }
  const sum = out.reduce((a, b) => a + b, 0);
  out[out.length - 1] = round1(out[out.length - 1] + (100 - sum));
  return out.map(round1);
}
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// "Jul 1 · 2026, 10:00 AM"
function fmtReviewDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return "Not set";
  let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()} · ${d.getFullYear()}, ${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`;
}
// "Jan 10, 2027"
function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return "the end date";
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
// "20000.5" -> "20,000.5" for display while typing
function fmtInputNumber(raw: string): string {
  if (!raw) return "";
  const [i, d] = raw.split(".");
  const int = i.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return d !== undefined ? `${int}.${d}` : int;
}
function titleCase(s: string): string { return s.replace(/\b\w/g, c => c.toUpperCase()); }
// Tasks where the admin picks how completion is validated
const CONFIGURABLE_VALIDATION_TASKS = ["custom", "give-feedback", "product-feature"];
// Custom and survey/feedback tasks can be peer reviewed by the community
const PEER_REVIEW_TASKS = ["custom", "give-feedback"];
/** `questId` is the saved quest this task maps to, so editing a live campaign keeps its submissions. */
export type TaskEntry = { id: string; taskTypeId: string; name: string; category: string; points: number; description: string; subtext: string; validationMode?: ValidationMode; apiEndpoint?: string; taskUrl?: string; questId?: string };

function TaskIcon({ type, size = 30 }: { type: string; size?: number }) {
  const bg: Record<string, string> = { Social: "#e8f4fd", "On-chain": "#ede9fe", Product: "#fff3e0", Feedback: "#fce4ec", Custom: "#f3e5f5", default: "#f0f0f0" };
  const stroke: Record<string, string> = { Social: "#1da1f2", "On-chain": "#7c3aed", Product: "#f59e0b", Feedback: "#e91e63", Custom: "#9c27b0", default: "#666" };

  const icons: Record<string, React.ReactNode> = {
    "follow-x":       <svg width={size*0.55} height={size*0.55} viewBox="0 0 20 20" fill={stroke["Social"]}><path d="M17.5 3L11.2 9.4 18 17h-4.4l-4.3-5.2L3.7 17H1l6.7-7L1 3h4.5l3.9 4.7L16.8 3H17.5z"/></svg>,
    "comment-x":      <svg width={size*0.55} height={size*0.55} viewBox="0 0 20 20" fill={stroke["Social"]}><path d="M17.5 3L11.2 9.4 18 17h-4.4l-4.3-5.2L3.7 17H1l6.7-7L1 3h4.5l3.9 4.7L16.8 3H17.5z"/></svg>,
    "retweet-x":      <svg width={size*0.55} height={size*0.55} viewBox="0 0 20 20" fill={stroke["Social"]}><path d="M17.5 3L11.2 9.4 18 17h-4.4l-4.3-5.2L3.7 17H1l6.7-7L1 3h4.5l3.9 4.7L16.8 3H17.5z"/></svg>,
    "like-x":         <svg width={size*0.55} height={size*0.55} viewBox="0 0 20 20" fill={stroke["Social"]}><path d="M17.5 3L11.2 9.4 18 17h-4.4l-4.3-5.2L3.7 17H1l6.7-7L1 3h4.5l3.9 4.7L16.8 3H17.5z"/></svg>,
    "join-discord":   <svg width={size*0.58} height={size*0.58} viewBox="0 0 24 24" fill={stroke["Social"]}><path d="M20.3 4.4A19.1 19.1 0 0015 2.9a13 13 0 00-.6 1.2 17.7 17.7 0 00-5-.7c-.2-.5-.4-.9-.6-1.2A19.2 19.2 0 003.7 4.4C.5 9.2-.3 13.9.1 18.5A19.3 19.3 0 005.9 21a14.7 14.7 0 001.3-2.1 12.5 12.5 0 01-2-.9l.5-.4a13.8 13.8 0 0011.6 0l.5.4a12.5 12.5 0 01-2 .9A14.7 14.7 0 0017 21a19.2 19.2 0 005.9-2.5C23.5 13.6 21.9 8.9 20.3 4.4zM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4S9.2 15.4 8 15.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>,
    "discord-msg":    <svg width={size*0.58} height={size*0.58} viewBox="0 0 24 24" fill={stroke["Social"]}><path d="M20.3 4.4A19.1 19.1 0 0015 2.9a13 13 0 00-.6 1.2 17.7 17.7 0 00-5-.7c-.2-.5-.4-.9-.6-1.2A19.2 19.2 0 003.7 4.4C.5 9.2-.3 13.9.1 18.5A19.3 19.3 0 005.9 21a14.7 14.7 0 001.3-2.1 12.5 12.5 0 01-2-.9l.5-.4a13.8 13.8 0 0011.6 0l.5.4a12.5 12.5 0 01-2 .9A14.7 14.7 0 0017 21a19.2 19.2 0 005.9-2.5C23.5 13.6 21.9 8.9 20.3 4.4zM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4S9.2 15.4 8 15.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>,
    "telegram-join":  <svg width={size*0.55} height={size*0.55} viewBox="0 0 24 24" fill={stroke["Social"]}><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.9 8.2l-2 9.5c-.2.7-.6.9-1.2.5l-3.3-2.4-1.6 1.5c-.2.2-.4.3-.7.3l.3-3.5 6.4-5.8c.3-.2-.1-.4-.4-.2L6.5 13.1 3.3 12c-.7-.2-.7-.7.2-1l11.6-4.5c.6-.2 1.1.1.8 1.7z"/></svg>,
    "portal-claims":  <svg width={size*0.55} height={size*0.55} viewBox="0 0 20 20" fill="none" stroke={stroke["On-chain"]} strokeWidth="1.5"><circle cx="10" cy="10" r="8"/><path d="M7 10l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    "trust-username": <svg width={size*0.55} height={size*0.55} viewBox="0 0 20 20" fill="none" stroke={stroke["On-chain"]} strokeWidth="1.5"><path d="M10 2l2 5h5l-4 3 1.5 5L10 12.5 5.5 15 7 10 3 7h5z" strokeLinejoin="round"/></svg>,
    "product-feature":<svg width={size*0.55} height={size*0.55} viewBox="0 0 20 20" fill="none" stroke={stroke["Product"]} strokeWidth="1.5"><path d="M10 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L10 14l-4.8 2.6.9-5.3-3.8-3.7 5.3-.8z" strokeLinejoin="round"/></svg>,
    "give-feedback":  <svg width={size*0.55} height={size*0.55} viewBox="0 0 20 20" fill="none" stroke={stroke["Feedback"]} strokeWidth="1.5"><path d="M18 3H2a1 1 0 00-1 1v9a1 1 0 001 1h3v3l4-3h9a1 1 0 001-1V4a1 1 0 00-1-1z" strokeLinejoin="round"/></svg>,
    "custom":         <svg width={size*0.55} height={size*0.55} viewBox="0 0 20 20" fill="none" stroke={stroke["Custom"]} strokeWidth="1.5"><path d="M10 2v4M10 14v4M2 10h4M14 10h4M4.2 4.2l2.8 2.8M13 13l2.8 2.8M4.2 15.8l2.8-2.8M13 7l2.8-2.8" strokeLinecap="round"/></svg>,
  };

  const catMap: Record<string, string> = { "follow-x": "Social", "comment-x": "Social", "retweet-x": "Social", "like-x": "Social", "join-discord": "Community", "discord-msg": "Community", "telegram-join": "Community", "portal-claims": "On-chain", "trust-username": "On-chain", "portal-collab": "On-chain", "portal-interacted": "On-chain", "portal-follow": "On-chain", "portal-support": "On-chain", "product-feature": "Product", "give-feedback": "Feedback", "custom": "Custom" };
  const cat = catMap[type] || "default";
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: bg[cat] || bg.default, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {icons[type] || <svg width={size*0.55} height={size*0.55} viewBox="0 0 20 20" fill="none" stroke="#999" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/></svg>}
    </div>
  );
}

// ─── FIGMA ICONS (exported as SVG from the Nexura Figma file) ─────────────────
const FIGMA_SVG: Record<string, string> = {
  flag: "<svg width=\"32\" height=\"32\" viewBox=\"0 0 32 32\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5.32812 19.992C5.32812 19.992 6.66104 18.6591 10.6598 18.6591C14.6585 18.6591 17.3244 21.3249 21.3231 21.3249C25.3219 21.3249 26.6548 19.992 26.6548 19.992V3.99698C26.6548 3.99698 25.3219 5.3299 21.3231 5.3299C17.3244 5.3299 14.6585 2.66406 10.6598 2.66406C6.66104 2.66406 5.32812 3.99698 5.32812 3.99698V19.992Z\" stroke=\"white\" stroke-width=\"2.39925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M5.32812 29.3232V19.9922\" stroke=\"white\" stroke-width=\"2.39925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  dateArrow: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3.32812 7.9974H12.6554M8.65799 11.9948L12.6554 7.9974L8.65799 4\" stroke=\"#98A0B4\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  reviewPencil: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7.99219 13.3281H13.9883\" stroke=\"#1C2533\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M10.9942 2.32801C11.2592 2.06296 11.6187 1.91406 11.9935 1.91406C12.3683 1.91406 12.7278 2.06296 12.9929 2.32801C13.2579 2.59305 13.4068 2.95253 13.4068 3.32736C13.4068 3.70219 13.2579 4.06166 12.9929 4.32671L4.66493 12.6546L2 13.3209L2.66623 10.6559L10.9942 2.32801Z\" stroke=\"#1C2533\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  returnArrow: "<svg width=\"11\" height=\"11\" viewBox=\"0 0 11 11\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5.49436 1.375V7.7856M8.24176 5.0382L5.49436 7.7856L2.74696 5.0382M2.28906 9.6172H8.69966\" stroke=\"#00A87C\" stroke-width=\"0.82425\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  statusCheck: "<svg width=\"18\" height=\"18\" viewBox=\"0 0 18 18\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M8.99625 15.7425C12.7221 15.7425 15.7425 12.7221 15.7425 8.99625C15.7425 5.2704 12.7221 2.25 8.99625 2.25C5.2704 2.25 2.25 5.2704 2.25 8.99625C2.25 12.7221 5.2704 15.7425 8.99625 15.7425Z\" stroke=\"#00A87C\" stroke-width=\"1.34925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M6.36719 9.36615L8.24115 11.2401L11.6143 7.49219\" stroke=\"#00A87C\" stroke-width=\"1.34925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  modalInfo: "<svg width=\"18\" height=\"18\" viewBox=\"0 0 18 18\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M2.25 8.99625C2.25 12.7196 5.27289 15.7425 8.99625 15.7425C12.7196 15.7425 15.7425 12.7196 15.7425 8.99625C15.7425 5.27289 12.7196 2.25 8.99625 2.25C5.27289 2.25 2.25 5.27289 2.25 8.99625V8.99625\" stroke=\"#6E2BD8\" stroke-width=\"1.34925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M9 11.9967V8.99833M9 6H9.0075\" stroke=\"#6E2BD8\" stroke-width=\"1.34925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  split: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M2.66406 3.13281H13.3238M2.66406 7.13021H13.3238M2.66406 11.1276H13.3238\" stroke=\"#3D485C\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M5.33247 4.46571C6.06837 4.46571 6.66493 3.86915 6.66493 3.13325C6.66493 2.39735 6.06837 1.80078 5.33247 1.80078C4.59657 1.80078 4 2.39735 4 3.13325C4 3.86915 4.59657 4.46571 5.33247 4.46571Z\" stroke=\"#3D485C\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M10.6606 8.46181C11.3965 8.46181 11.9931 7.86524 11.9931 7.12934C11.9931 6.39344 11.3965 5.79688 10.6606 5.79688C9.92469 5.79688 9.32812 6.39344 9.32812 7.12934C9.32812 7.86524 9.92469 8.46181 10.6606 8.46181Z\" stroke=\"#3D485C\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M6.66059 12.4618C7.39649 12.4618 7.99306 11.8652 7.99306 11.1293C7.99306 10.3934 7.39649 9.79688 6.66059 9.79688C5.92469 9.79688 5.32812 10.3934 5.32812 11.1293C5.32812 11.8652 5.92469 12.4618 6.66059 12.4618Z\" stroke=\"#3D485C\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  reset: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M9.99805 4.46777H13.9971V0.46875M13.9971 4.46777L11.9976 2.66821C11.1348 1.89654 10.0672 1.39097 8.92355 1.21247C7.77989 1.03398 6.60901 1.19018 5.55214 1.66225C4.49527 2.13432 3.59755 2.90209 2.96727 3.87294C2.33698 4.8438 2.00105 5.97628 2 7.13379M5.99902 9.79981H2V13.7988M2 9.79981L3.99951 11.5994C4.86227 12.371 5.92986 12.8766 7.07352 13.0551C8.21718 13.2336 9.38807 13.0774 10.4449 12.6053C11.5018 12.1333 12.3995 11.3655 13.0298 10.3946C13.6601 9.42378 13.996 8.2913 13.9971 7.13379\" stroke=\"#3D485C\" stroke-width=\"1.19971\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  tickDecagram: "<svg width=\"18\" height=\"18\" viewBox=\"0 0 18 18\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M17.25 8.13406L15.42 6.04906L15.675 3.28906L12.9675 2.67406L11.55 0.289062L9 1.38406L6.45 0.289062L5.0325 2.67406L2.325 3.28156L2.58 6.04156L0.75 8.13406L2.58 10.2191L2.325 12.9866L5.0325 13.6016L6.45 15.9866L9 14.8841L11.55 15.9791L12.9675 13.5941L15.675 12.9791L15.42 10.2191L17.25 8.13406ZM7.5 11.8841L4.5 8.88406L5.5575 7.82656L7.5 9.76156L12.4425 4.81906L13.5 5.88406L7.5 11.8841Z\" fill=\"#00A87C\"/></svg>",
  warnTriangle: "<svg width=\"17\" height=\"17\" viewBox=\"0 0 17 17\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M8.74219 6.05859V8.89063M8.74219 11.7227H8.74927\" stroke=\"#E4545B\" stroke-width=\"1.27425\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M7.54302 2.44734L1.52573 12.429C1.40238 12.6425 1.33696 12.8846 1.33595 13.1313C1.33494 13.3779 1.39837 13.6205 1.51996 13.8351C1.64156 14.0497 1.81709 14.2288 2.02919 14.3546C2.24129 14.4805 2.48258 14.5488 2.72919 14.5527H14.7638C15.0104 14.5488 15.2517 14.4805 15.4638 14.3546C15.6759 14.2288 15.8514 14.0497 15.973 13.8351C16.0946 13.6205 16.158 13.3779 16.157 13.1313C16.156 12.8846 16.0906 12.6425 15.9672 12.429L10.4455 2.44734C10.3185 2.24246 10.1413 2.07338 9.93071 1.95613C9.72011 1.83888 9.48306 1.77734 9.24202 1.77734C9.00098 1.77734 8.76393 1.83888 8.55332 1.95613C8.34272 2.07338 8.16554 2.24246 8.03856 2.44734H7.54302Z\" stroke=\"#E4545B\" stroke-width=\"1.27425\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  rowWarn: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6.82812 5.41406V7.7448M6.82812 10.0755H6.83395\" stroke=\"#E4545B\" stroke-width=\"1.04883\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M5.83559 2.4421L0.882778 10.6579C0.78125 10.8337 0.727404 11.033 0.726572 11.236C0.72574 11.439 0.777951 11.6387 0.878034 11.8153C0.978117 11.9919 1.1226 12.1393 1.29718 12.2429C1.47175 12.3465 1.67036 12.4027 1.87334 12.406H11.779C11.9819 12.4027 12.1805 12.3465 12.3551 12.2429C12.5297 12.1393 12.6742 11.9919 12.7743 11.8153C12.8743 11.6387 12.9266 11.439 12.9257 11.236C12.9249 11.033 12.871 10.8337 12.7695 10.6579L8.22459 2.4421C8.12007 2.27346 7.97424 2.13429 7.80089 2.03778C7.62754 1.94128 7.43243 1.89062 7.23403 1.89062C7.03563 1.89062 6.84051 1.94128 6.66716 2.03778C6.49382 2.13429 6.34798 2.27346 6.24346 2.4421H5.83559Z\" stroke=\"#E4545B\" stroke-width=\"1.04883\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  info: "<svg width=\"18\" height=\"18\" viewBox=\"0 0 18 18\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M9.24561 15.9912C12.9711 15.9912 15.9912 12.9711 15.9912 9.24561C15.9912 5.52011 12.9711 2.5 9.24561 2.5C5.52011 2.5 2.5 5.52011 2.5 9.24561C2.5 12.9711 5.52011 15.9912 9.24561 15.9912Z\" stroke=\"#6E2BD8\" stroke-width=\"1.34912\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M9.24219 12.2461V9.24805M9.24219 6.25H9.24968\" stroke=\"#6E2BD8\" stroke-width=\"1.34912\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  card: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M13.3203 3.32812H2.66059C1.92469 3.32812 1.32812 3.92469 1.32812 4.66059V11.3229C1.32812 12.0588 1.92469 12.6554 2.66059 12.6554H13.3203C14.0562 12.6554 14.6528 12.0588 14.6528 11.3229V4.66059C14.6528 3.92469 14.0562 3.32812 13.3203 3.32812Z\" stroke=\"white\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M10.6554 7.99653H10.6621M1.32812 6.66406H14.6528\" stroke=\"white\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  x: "<svg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M15.1979 1.875H17.9563L11.9313 8.75833L19.0146 18.125H13.4646L9.12292 12.4417L4.14792 18.125H1.38125L7.82292 10.7583L1.03125 1.875H6.72292L10.6479 7.06667L15.1979 1.875ZM14.2313 16.475H15.7563L5.83958 3.44167H4.19792L14.2313 16.475Z\" fill=\"#1C2533\"/></svg>",
  taskDup: "<svg width=\"17\" height=\"17\" viewBox=\"0 0 17 17\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12.7496 6.03906H7.38117C6.63994 6.03906 6.03906 6.63994 6.03906 7.38117V12.7496C6.03906 13.4908 6.63994 14.0917 7.38117 14.0917H12.7496C13.4908 14.0917 14.0917 13.4908 14.0917 12.7496V7.38117C14.0917 6.63994 13.4908 6.03906 12.7496 6.03906Z\" stroke=\"#1C2533\" stroke-width=\"1.20789\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M3.35938 10.0683V3.35773C3.35938 3.00178 3.50077 2.66041 3.75247 2.40872C4.00416 2.15702 4.34553 2.01563 4.70148 2.01562H11.412\" stroke=\"#1C2533\" stroke-width=\"1.20789\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  taskDel: "<svg width=\"17\" height=\"17\" viewBox=\"0 0 17 17\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M2.01562 4.02796H14.0946M5.37089 4.02796V2.68586C5.37089 2.32991 5.51229 1.98854 5.76398 1.73684C6.01568 1.48515 6.35704 1.34375 6.71299 1.34375H9.3972C9.75315 1.34375 10.0945 1.48515 10.3462 1.73684C10.5979 1.98854 10.7393 2.32991 10.7393 2.68586V4.02796M12.7525 4.02796L12.0814 13.4227C12.0814 13.7786 11.94 14.12 11.6883 14.3717C11.4366 14.6234 11.0953 14.7648 10.7393 14.7648H5.37089C5.01494 14.7648 4.67357 14.6234 4.42188 14.3717C4.17018 14.12 4.02878 13.7786 4.02878 13.4227L3.35773 4.02796\" stroke=\"#1C2533\" stroke-width=\"1.20789\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  discord: "<svg width=\"17\" height=\"17\" viewBox=\"0 0 17 17\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5.9043 2.79688C6.02187 3.01497 6.14196 3.25459 6.22461 3.45605L6.33008 3.71289L6.60547 3.67188C7.85904 3.48137 9.13412 3.48137 10.3877 3.67188L10.6602 3.71289L10.7676 3.45898C10.8507 3.2616 10.9694 3.01821 11.084 2.79785C12.1462 3.00358 13.1807 3.33339 14.165 3.7832C15.9896 6.45477 16.895 9.44834 16.5869 12.8965C15.421 13.7431 14.1293 14.399 12.7588 14.8428C12.5592 14.5524 12.3712 14.2542 12.1992 13.9443C12.5631 13.7909 12.9167 13.6173 13.2617 13.416L13.2656 13.4141C13.3218 13.3803 13.3689 13.3331 13.4033 13.2773C13.4376 13.2217 13.4588 13.1589 13.4639 13.0938C13.4664 13.0611 13.4642 13.0282 13.459 12.9961L13.4326 12.9023L13.3838 12.8174C13.3644 12.7912 13.3416 12.7671 13.3164 12.7461H13.3174L13.3086 12.7393L13.0469 12.5342L13.043 12.5312C13.0141 12.5092 12.9825 12.4912 12.9492 12.4775L12.8447 12.4502C12.7726 12.4412 12.6987 12.4519 12.6318 12.4805L12.623 12.4844C9.96952 13.7086 7.06701 13.709 4.37598 12.4834L4.36816 12.4805L4.26367 12.4512C4.228 12.4462 4.19133 12.4457 4.15527 12.4502C4.08326 12.4593 4.01475 12.4872 3.95703 12.5312L3.9541 12.5342L3.69141 12.7393L3.68359 12.7461C3.65841 12.7671 3.63559 12.7912 3.61621 12.8174L3.56836 12.9023C3.54288 12.9627 3.53208 13.0284 3.53711 13.0938C3.54217 13.1588 3.56244 13.2218 3.59668 13.2773C3.6139 13.3052 3.63407 13.3316 3.65723 13.3545L3.73438 13.4141L3.74219 13.4189C4.08413 13.6127 4.43719 13.7876 4.80273 13.9434C4.63334 14.2536 4.44654 14.553 4.24316 14.8438C2.8722 14.3993 1.57998 13.7429 0.413086 12.8965C0.153548 9.9057 0.74059 6.88684 2.82129 3.7832C3.8062 3.33279 4.84124 3.00223 5.9043 2.79688ZM5.68066 7.37305C4.58994 7.3732 3.79688 8.33722 3.79688 9.44141C3.79693 10.5489 4.61421 11.5096 5.68066 11.5098C6.70334 11.5098 7.46451 10.6623 7.55566 9.64648L7.56543 9.44141C7.57942 8.33804 6.7663 7.37305 5.68066 7.37305ZM11.333 7.37305C10.2424 7.37329 9.44922 8.33727 9.44922 9.44141C9.44927 10.5489 10.2666 11.5095 11.333 11.5098C12.3557 11.5098 13.1169 10.6623 13.208 9.64648L13.2178 9.44141C13.2318 8.33804 12.4186 7.37305 11.333 7.37305Z\" fill=\"#C3C0D4\" stroke=\"#1C2533\" stroke-width=\"0.708333\"/></svg>",
  telegram: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7.96734 1.00002C6.11649 1.00865 4.34439 1.74996 3.03869 3.06178C1.73299 4.3736 0.99998 6.14915 1 8.00002C1 9.85653 1.7375 11.637 3.05025 12.9498C4.36301 14.2625 6.14348 15 8 15C9.85652 15 11.637 14.2625 12.9497 12.9498C14.2625 11.637 15 9.85653 15 8.00002C15 6.1435 14.2625 4.36303 12.9497 3.05027C11.637 1.73752 9.85652 1.00002 8 1.00002C7.98911 0.999994 7.97823 0.999994 7.96734 1.00002ZM10.8618 5.21402C10.9202 5.21285 11.0491 5.22744 11.1331 5.29569C11.1889 5.34417 11.2245 5.41182 11.2328 5.48527C11.2422 5.53952 11.2538 5.66377 11.2445 5.7606C11.1395 6.86777 10.6833 9.55344 10.4512 10.793C10.3532 11.318 10.1601 11.4936 9.97283 11.5105C9.56683 11.5484 9.25825 11.2422 8.8645 10.9843C8.2485 10.5801 7.90025 10.3287 7.30233 9.93435C6.61108 9.47935 7.05908 9.22852 7.45283 8.82019C7.55608 8.71285 9.34692 7.0836 9.38192 6.93602C9.386 6.91735 9.39008 6.84852 9.34925 6.81235C9.30842 6.77618 9.24775 6.78844 9.204 6.79835C9.14217 6.81235 8.15808 7.46335 6.25175 8.7496C5.97175 8.9421 5.71917 9.03544 5.49225 9.0296C5.24258 9.02494 4.76192 8.88902 4.40433 8.77294C3.96567 8.63002 3.61742 8.55477 3.64775 8.31269C3.6635 8.18669 3.83733 8.05777 4.16867 7.92594C6.20917 7.03694 7.5695 6.45069 8.25083 6.16777C10.1945 5.35927 10.5988 5.21869 10.8618 5.21402Z\" fill=\"black\"/></svg>",
  plusDark: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7.99969 3.32812V12.6556M3.33594 7.99187H12.6634\" stroke=\"#1C2533\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  plusWhite: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7.99957 3.32812V12.6554M3.33594 7.99176H12.6632\" stroke=\"white\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  rename: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6.89062 11.5859H12.0581\" stroke=\"#6F6A80\" stroke-width=\"1.14833\"/><path d=\"M9.47 2.11455C9.94534 1.63922 10.7172 1.63922 11.1925 2.11455C11.6678 2.58989 11.6678 3.36172 11.1925 3.83705L4.01542 11.0141L1.71875 11.5883L2.29292 9.29164L9.47 2.11455V2.11455\" stroke=\"#6F6A80\" stroke-width=\"1.14833\"/></svg>",
  stageDup: "<svg width=\"18\" height=\"18\" viewBox=\"0 0 18 18\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M8.24917 6.75H14.2458C15.0732 6.75 15.745 7.42175 15.745 8.24917V14.2458C15.745 15.0732 15.0732 15.745 14.2458 15.745H8.24917C7.42175 15.745 6.75 15.0732 6.75 14.2458V8.24917C6.75 7.42175 7.42175 6.75 8.24917 6.75V6.75\" stroke=\"#3D485C\" stroke-width=\"1.34925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M3.75 11.245V3.74917C3.75 2.92175 4.42175 2.25 5.24917 2.25H12.745\" stroke=\"#3D485C\" stroke-width=\"1.34925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  stageDel: "<svg width=\"18\" height=\"18\" viewBox=\"0 0 18 18\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M2.25 4.49833H15.7425M5.99792 4.49833V2.99917C5.99792 2.17175 6.66967 1.5 7.49708 1.5H10.4954C11.3228 1.5 11.9946 2.17175 11.9946 2.99917V4.49833M14.2433 4.49833L13.4937 14.9925C13.4937 15.8199 12.822 16.4917 11.9946 16.4917H5.99792C5.1705 16.4917 4.49875 15.8199 4.49875 14.9925L3.74917 4.49833\" stroke=\"#3D485C\" stroke-width=\"1.34925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  bolt: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M8.66504 1.33594L2 9.33399H7.33203L6.66553 14.666L13.3306 6.66797H7.99854L8.66504 1.33594Z\" stroke=\"#8A3FFC\" stroke-width=\"1.19971\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  readyCheck: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7.99854 13.9971C11.3114 13.9971 13.9971 11.3114 13.9971 7.99854C13.9971 4.68564 11.3114 2 7.99854 2C4.68564 2 2 4.68564 2 7.99854C2 11.3114 4.68564 13.9971 7.99854 13.9971Z\" stroke=\"#00A87C\" stroke-width=\"1.19971\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M5.66406 8.33032L7.33032 9.99658L10.3296 6.66406\" stroke=\"#00A87C\" stroke-width=\"1.19971\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  chevron: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M4 6L8 10L12 6\" stroke=\"#8B889E\" stroke-width=\"1.33333\"/></svg>",
  pencilWhite: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7.99219 13.3281H13.9884\" stroke=\"white\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M10.9944 2.32802C11.5459 1.77645 12.4416 1.77645 12.9931 2.32802C13.5447 2.87959 13.5447 3.7752 12.9931 4.32677L4.665 12.6549L2 13.3211L2.66625 10.6561L10.9944 2.32802\" stroke=\"white\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  clock: "<svg width=\"13\" height=\"13\" viewBox=\"0 0 13 13\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6.49625 11.3675C9.18657 11.3675 11.3675 9.18657 11.3675 6.49625C11.3675 3.80593 9.18657 1.625 6.49625 1.625C3.80593 1.625 1.625 3.80593 1.625 6.49625C1.625 9.18657 3.80593 11.3675 6.49625 11.3675Z\" stroke=\"#6E2BD8\" stroke-width=\"0.97425\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M6.49219 3.78906V6.49531L8.11594 7.57781\" stroke=\"#6E2BD8\" stroke-width=\"0.97425\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  pencilDark: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7.99219 13.3281H13.9883\" stroke=\"#3D485C\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M10.9942 2.33582C11.2592 2.07078 11.6187 1.92188 11.9935 1.92188C12.3683 1.92188 12.7278 2.07078 12.9929 2.33582C13.2579 2.60086 13.4068 2.96034 13.4068 3.33517C13.4068 3.71 13.2579 4.06948 12.9929 4.33452L4.66493 12.6624L2 13.3287L2.66623 10.6637L10.9942 2.33582Z\" stroke=\"#3D485C\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  arrowLeft: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12.6556 7.9975H3.32812M7.32562 11.995L3.32812 7.9975L7.32562 4\" stroke=\"#1C2533\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  arrowRightWhite: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3.32812 7.9975H12.6556M8.65812 4L12.6556 7.9975L8.65812 11.995\" stroke=\"white\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  eye: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0.664062 7.99406C0.664062 7.99406 3.32906 2.66406 7.99281 2.66406C12.6566 2.66406 15.3216 7.99406 15.3216 7.99406C15.3216 7.99406 12.6566 13.3241 7.99281 13.3241C3.32906 13.3241 0.664062 7.99406 0.664062 7.99406V7.99406\" stroke=\"#1C2533\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M6 7.99094C6 9.09408 6.89561 9.98969 7.99875 9.98969C9.10189 9.98969 9.9975 9.09408 9.9975 7.99094C9.9975 6.8878 9.10189 5.99219 7.99875 5.99219C6.89561 5.99219 6 6.8878 6 7.99094V7.99094\" stroke=\"#1C2533\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  checkWhite: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M13.3241 4L5.99531 11.3287L2.66406 7.9975\" stroke=\"white\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  basicsDot: "<svg width=\"26\" height=\"26\" viewBox=\"0 0 26 26\" fill=\"none\"><rect width=\"25.99\" height=\"25.99\" rx=\"12.995\" fill=\"url(#paint0_linear_9053_42301)\"/><path d=\"M13.018 16C12.1317 16 11.4012 15.7179 10.8263 15.1538C10.2754 14.5641 10 13.8462 10 13C10 12.1538 10.2754 11.4487 10.8263 10.8846C11.4012 10.2949 12.1317 10 13.018 10C13.9042 10 14.6228 10.2949 15.1737 10.8846C15.7246 11.4487 16 12.1538 16 13C16 13.8462 15.7246 14.5641 15.1737 15.1538C14.6228 15.7179 13.9042 16 13.018 16Z\" fill=\"white\"/><defs><linearGradient id=\"paint0_linear_9053_42301\" x1=\"0\" y1=\"0\" x2=\"25.99\" y2=\"25.99\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#7C3AED\"/><stop offset=\"1\" stop-color=\"#6B21D8\"/></linearGradient></defs></svg>",
  stackTpl: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\"><path d=\"M7.9961 1.33594L13.9922 4.6671L7.9961 7.99827L2 4.6671L7.9961 1.33594Z\" stroke=\"#1C2533\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M2 7.99219L7.9961 11.3234L13.9922 7.99219M2 11.3234L7.9961 14.6545L13.9922 11.3234\" stroke=\"#1C2533\" stroke-width=\"1.19925\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
};
const UPLOAD_ICON_SRC = "data:image/png;base64,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";
const INTUITION_ICON_SRC = "data:image/png;base64,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";
function FigmaIcon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 0, flexShrink: 0, ...style }} dangerouslySetInnerHTML={{ __html: FIGMA_SVG[name] || "" }} />;
}


// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcDuration(startISO: string, endISO: string): { label: string; detail: string } {
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return { label: "—", detail: "" };
  const days = Math.round((e.getTime() - s.getTime()) / 86400000);
  const months = Math.round(days / 30.44);
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  const mLabel = months === 1 ? "1 Month" : `${months} Months`;
  const plural = (n: number, w: string) => `${n} ${w}${n !== 1 ? "s" : ""}`;
  // e.g. "157 days in total, which is 22 weeks and 3 days."
  const weekPart = weeks > 0 ? `${plural(weeks, "week")}${remDays > 0 ? ` and ${plural(remDays, "day")}` : ""}` : "";
  const detail = weekPart ? `${plural(days, "day")} in total, which is ${weekPart}.` : `${plural(days, "day")} in total.`;
  return { label: mLabel, detail };
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = months[d.getMonth()];
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  // Format time from the value only if it contains a time component
  if (iso.includes("T")) {
    let h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${mon} ${dd}, ${yyyy} · ${h}:${min} ${ampm}`;
  }
  return `${mon} ${dd}, ${yyyy}`;
}

// ─── INJECTED WALLET (window.ethereum) ────────────────────────────────────────
type InjectedWallet = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
export function getInjectedWallet(): InjectedWallet | undefined {
  return typeof window !== "undefined" ? (window as unknown as { ethereum?: InjectedWallet }).ethereum : undefined;
}
// Details a wallet needs to add a chain it doesn't know yet (Ethereum mainnet is built into every wallet)
const ADD_CHAIN_PARAMS: Record<number, { chainName: string; nativeCurrency: { name: string; symbol: string; decimals: number }; rpcUrls: string[]; blockExplorerUrls: string[] }> = {
  13579: { chainName: "Intuition Testnet", nativeCurrency: { name: "tTRUST", symbol: "tTRUST", decimals: 18 }, rpcUrls: ["https://testnet.rpc.intuition.systems"], blockExplorerUrls: ["https://testnet.explorer.intuition.systems"] },
  1155:  { chainName: "Intuition Mainnet", nativeCurrency: { name: "TRUST", symbol: "TRUST", decimals: 18 }, rpcUrls: ["https://intuition.calderachain.xyz/http"], blockExplorerUrls: ["https://explorer.intuition.systems"] },
  42161: { chainName: "Arbitrum One", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://arb1.arbitrum.io/rpc"], blockExplorerUrls: ["https://arbiscan.io"] },
  8453:  { chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"], blockExplorerUrls: ["https://basescan.org"] },
  56:    { chainName: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: ["https://bsc-dataseed.binance.org"], blockExplorerUrls: ["https://bscscan.com"] },
};
export async function switchWalletChain(eth: InjectedWallet, chainId: number | null): Promise<void> {
  if (!chainId) return; // network without a chain ID yet (e.g. Robinhood Chain)
  const hexId = "0x" + chainId.toString(16);
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch (err) {
    const add = ADD_CHAIN_PARAMS[chainId];
    // 4902 = chain not added to the wallet yet; some wallets report it nested in data.originalError
    const code = (err as { code?: number; data?: { originalError?: { code?: number } } })?.code;
    const nested = (err as { data?: { originalError?: { code?: number } } })?.data?.originalError?.code;
    if (!add || (code !== 4902 && nested !== 4902)) throw err;
    await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: hexId, ...add }] });
  }
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
function shortAddress(a: string): string { return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }
type SaveState = "idle" | "saving" | "saved" | "skipped" | "error";
function Header({ saveState = "idle", saveError, activeChain, onChainChange, walletAddress: connectedAddress, onConnectWallet, onDisconnectWallet, signedIn = true, onSignIn }: {
  saveState?: SaveState; saveError?: string; activeChain: NetworkId; onChainChange: (id: NetworkId) => void;
  walletAddress?: string | null; onConnectWallet?: () => void; onDisconnectWallet?: () => void;
  /** False once the studio session has expired: the wallet and notifications ask to sign in again. */
  signedIn?: boolean; onSignIn?: () => void;
}) {
  const chip = saveState !== "idle" && saveState !== "skipped" && (() => {
          const tone = saveState === "saving" ? { bg: "rgba(28,37,51,0.05)", bd: "rgba(28,37,51,0.16)", fg: "#6b7280" }
            : saveState === "saved" ? { bg: "rgba(0,229,192,0.1)", bd: "#00e5c0", fg: "#00875a" }
            : { bg: "rgba(245,158,11,0.14)", bd: "rgba(194,124,0,0.3)", fg: "#c27c00" };
          const text = saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Not saved";
          return (
          <div title={saveState === "error" && saveError ? saveError : undefined} style={{ background: tone.bg, border: `1px solid ${tone.bd}`, borderRadius: 20, height: 24, display: "flex", alignItems: "center", paddingLeft: 8, paddingRight: 12, gap: 6, flexShrink: 0 }}>
            {saveState === "saving" ? (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="5" stroke="rgba(28,37,51,0.2)" strokeWidth="1.5"/>
                <path d="M6.5 1.5A5 5 0 0111.5 6.5" stroke="#8b3efe" strokeWidth="1.5" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 6.5 6.5" to="360 6.5 6.5" dur="0.75s" repeatCount="indefinite"/>
                </path>
              </svg>
            ) : saveState === "saved" ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="#00875a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : null}
            <span style={{ fontSize: 12, fontWeight: 500, color: tone.fg, whiteSpace: "nowrap" }}>{text}</span>
          </div>
          );
        })();
  return <StudioHeader title="Campaigns" network={activeChain} onNetworkChange={onChainChange} extra={chip} />;
}

// ─── WIZARD PROGRESS BAR ──────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: "Template",          sub: "Starting point"   },
  { n: 2, label: "Details",           sub: "Name, duration..."  },
  { n: 3, label: "Journey",           sub: "Stages & tasks"   },
  { n: 4, label: "Rewards & Funding", sub: "Budget & payment" },
  { n: 5, label: "Review & Fund",     sub: "Summary & Publish" },
];

function WizardProgress({ currentStep, onStepClick, minStep = 1, maxStep = 0 }: { currentStep: number; onStepClick?: (step: number) => void; minStep?: number; maxStep?: number }) {
  return (
    <div style={{ background: "white", border: "1px solid rgba(28,37,51,0.09)", borderRadius: 40, height: 68, display: "flex", alignItems: "center", padding: "0 6px", gap: 0, minWidth: 0, overflow: "hidden" }}>
      {STEPS.map((step, idx) => {
        const active    = step.n === currentStep;
        // Steps already reached (before or after this one) stay done and can be reopened, except those before minStep
        const completed = !active && (step.n < currentStep || step.n <= maxStep);
        const clickable = completed && step.n >= minStep && !!onStepClick;
        const isWide    = step.n === 4; // "Rewards & Funding" is wider

        return (
          <React.Fragment key={step.n}>
            {idx > 0 && (
              <div style={{ flex: "0 1 26px", minWidth: 6, height: 1.5, background: "rgba(68,65,81,0.3)" }} />
            )}
            <div
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              title={clickable ? step.label : undefined}
              onClick={clickable ? () => onStepClick!(step.n) : undefined}
              onKeyDown={clickable ? (e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStepClick!(step.n); } }) : undefined}
              style={{
              cursor: clickable ? "pointer" : "default",
              display: "flex", alignItems: "center",
              gap: isWide ? 16 : 11,
              padding: isWide ? "10.99px 16px" : "10.99px 16px",
              borderRadius: 40,
              background: active ? "rgba(138,63,252,0.12)" : "transparent",
              flex: "0 1 auto", minWidth: 0, boxSizing: "border-box" as const,
              height: 54,
              width: step.n === 1 ? 147 : step.n === 2 ? 160 : step.n === 3 ? 160 : undefined,
              justifyContent: step.n === 1 ? "flex-start" : "center",
            }}>
              {/* Circle */}
              <div style={{
                width: 25.99, height: 25.99, borderRadius: 13, flexShrink: 0,
                background: completed || active
                  ? "linear-gradient(120deg, #9b7cff 0%, #7c5cfc 45%, #5aa8ff 100%)"
                  : "#efeafb",
                border: completed || active ? "none" : "1.25px solid rgba(28,37,51,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {completed
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif" }}>✓</span>
                  : <span style={{ fontSize: 13, fontWeight: 700, color: active ? "white" : "rgba(118,122,140,0.5)" }}>{step.n}</span>
                }
              </div>
              {/* Labels */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: step.n === 1 ? "flex-start" : "center", gap: 0, minWidth: 0, overflow: "hidden" }}>
                <span style={{ fontSize: step.n === 4 ? 13.5 : 13, fontWeight: 600, color: active ? "#1c2533" : "#767a8c", lineHeight: "normal", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                  {step.label}
                </span>
                <span style={{ fontSize: step.n === 4 ? 11.5 : 11, fontWeight: 400, color: step.n === 4 ? "#98a0b4" : "#9a9dae", lineHeight: "normal", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                  {step.sub}
                </span>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── TEMPLATE CARD ────────────────────────────────────────────────────────────
function TemplateCard({ tpl, onUseTemplate }: { tpl: typeof TEMPLATES[0]; onUseTemplate: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Use ${tpl.name}`}
      onClick={() => onUseTemplate(tpl.id)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onUseTemplate(tpl.id); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: "white", border: `1px solid ${hovered ? "#8a3ffc" : "rgba(28,37,51,0.09)"}`, borderRadius: 40, overflow: "hidden", width: "100%", minWidth: 0, height: 338, boxSizing: "border-box" as const, position: "relative", cursor: "pointer", boxShadow: hovered ? "0 4px 20px rgba(138,63,252,0.12)" : "none", transition: "border-color 0.15s, box-shadow 0.15s" }}
    >
      {/* Header: name + badge */}
      <div style={{ position: "absolute", left: 19, right: 19, top: 25, display: "flex", alignItems: "center", justifyContent: "space-between", height: 27 }}>
        <span style={{ fontSize: 15.5, fontWeight: 600, color: "#1c2533", letterSpacing: -0.31, lineHeight: "17.83px" }}>{tpl.name}</span>
        <div style={{ background: "rgba(155,124,255,0.14)", border: "1px solid rgba(155,124,255,0.3)", borderRadius: 20, padding: "4.16px 11.833px 4.74px", width: 78, textAlign: "center" }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#936ff3", lineHeight: "17.25px" }}>{tpl.badge}</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ position: "absolute", left: 19, right: 19, top: 68, height: 100, borderTop: "0.833px solid rgba(28,37,51,0.09)", borderBottom: "0.833px solid rgba(28,37,51,0.09)" }}>
        {[
          { label: "Duration",       value: tpl.duration      },
          { label: "Stages",         value: tpl.stages        },
          { label: "Retention rate", value: tpl.retentionRate },
        ].map((row, i) => (
          <div key={row.label} style={{ position: "absolute", left: 0, right: 0, top: i === 0 ? 12.3 : i === 1 ? 39.66 : 66.35, display: "flex", alignItems: "center", justifyContent: "space-between", height: 19.38 }}>
            <span style={{ fontSize: 12.5, fontWeight: 400, color: "#9a9dae", lineHeight: "19.38px" }}>{row.label}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#4b4e5e", lineHeight: "19.38px" }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Reward structure */}
      <div style={{ position: "absolute", left: 19, right: 19, top: 184, display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#605d72", letterSpacing: 1, lineHeight: "19.38px", whiteSpace: "nowrap" }}>
            Reward structure - {tpl.structure.length} Stages{" "}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 2 }}>
            {tpl.structure.map((seg, i) => (
              <div key={i} style={{ flex: `${seg.pct} 1 0`, minWidth: 0, height: 10, background: seg.barColor, borderRadius: seg.roundL && seg.roundR ? 30 : seg.roundL ? "30px 0 0 30px" : seg.roundR ? "0 30px 30px 0" : 0 }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, columnGap: 12, rowGap: 4 }}>
            {tpl.structure.map((seg, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: seg.dotColor, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "#767a8c", letterSpacing: 0.72, lineHeight: "18px", whiteSpace: "nowrap" }}>{seg.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Use template button */}
      <div style={{ position: "absolute", left: 19, right: 19, top: 273 }}>
        <button
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          onClick={e => { e.stopPropagation(); onUseTemplate(tpl.id); }}
          style={{
            width: "100%", height: 34, borderRadius: 40, cursor: "pointer", fontSize: 13, fontWeight: 600,
            transition: "background 0.15s, color 0.15s, border-color 0.15s",
            background: btnHovered ? "linear-gradient(to bottom, #8a3ffc, #6b21d8)" : "white",
            color: btnHovered ? "white" : "#8a3ffc",
            border: btnHovered ? "1px solid transparent" : "1px solid #8a3ffc",
          }}
        >
          Use template
        </button>
      </div>
    </div>
  );
}

// ─── DATE PICKER ──────────────────────────────────────────────────────────────
const CAL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CAL_DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function DatePicker({ value, onChange, label, hint }: { value: string; onChange: (v: string) => void; label: string; hint: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const parsed = value ? new Date(value) : null;
  const now = new Date();

  const [viewYear,  setViewYear]  = useState(parsed?.getFullYear()  ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth()      ?? now.getMonth());
  const [selDay,    setSelDay]    = useState<number | null>(parsed?.getDate() ?? null);
  const [hour,      setHour]      = useState(parsed ? (parsed.getHours() % 12 || 12) : 12);
  const [minute,    setMinute]    = useState(parsed?.getMinutes() ?? 0);
  const [ampm,      setAmpm]      = useState<"AM"|"PM">(parsed ? (parsed.getHours() >= 12 ? "PM" : "AM") : "AM");

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  // Save as soon as a day is picked (and whenever the time changes), so closing the picker never loses the date
  const [selYM, setSelYM] = useState<[number, number] | null>(parsed ? [parsed.getFullYear(), parsed.getMonth()] : null);
  const commit = (y: number, mo: number, d: number, h12: number, mi: number, ap: "AM" | "PM") => {
    let h24 = h12 % 12;
    if (ap === "PM") h24 += 12;
    onChange(`${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h24).padStart(2, "0")}:${String(mi).padStart(2, "0")}`);
  };
  const firstTimeRender = useRef(true);
  useEffect(() => {
    if (firstTimeRender.current) { firstTimeRender.current = false; return; }
    if (selDay !== null && selYM) commit(selYM[0], selYM[1], selDay, hour, minute, ampm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hour, minute, ampm]);
  const handleConfirm = () => {
    if (selDay === null) return;
    let h24 = hour % 12;
    if (ampm === "PM") h24 += 12;
    const [cy, cm] = selYM || [viewYear, viewMonth];
    const iso = `${cy}-${String(cm+1).padStart(2,"0")}-${String(selDay).padStart(2,"0")}T${String(h24).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
    onChange(iso);
    setOpen(false);
  };

  const adjHour   = (d: number) => setHour(h   => { let n = h   + d; if (n < 1) n = 12; if (n > 12) n = 1;  return n; });
  const adjMinute = (d: number) => setMinute(m => { let n = m   + d; if (n < 0) n = 55; if (n > 59) n = 0; return n; });

  const todayY = now.getFullYear(); const todayM = now.getMonth(); const todayD = now.getDate();

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, position: "relative" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#3d485c", lineHeight: "20.15px" }}>{label}</span>

      {/* Trigger button */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ background: "#f4f1fc", border: `1.25px solid ${open ? "#8b3efe" : "rgba(28,37,51,0.15)"}`, borderRadius: 40, height: 45, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", cursor: "pointer", userSelect: "none" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <rect x="1.5" y="3" width="13" height="11.5" rx="2" stroke={open ? "#8b3efe" : "#6b7280"} strokeWidth="1.2"/>
          <path d="M1.5 6.5h13" stroke={open ? "#8b3efe" : "#6b7280"} strokeWidth="1.2"/>
          <path d="M5 1.5V4M11 1.5V4" stroke={open ? "#8b3efe" : "#6b7280"} strokeWidth="1.2" strokeLinecap="round"/>
          <circle cx="5.5" cy="9.5" r="0.75" fill={open ? "#8b3efe" : "#6b7280"}/>
          <circle cx="8"   cy="9.5" r="0.75" fill={open ? "#8b3efe" : "#6b7280"}/>
          <circle cx="10.5" cy="9.5" r="0.75" fill={open ? "#8b3efe" : "#6b7280"}/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 400, color: value ? "#1c2533" : "#9ca3af", flex: 1, letterSpacing: 0.2 }}>
          {value ? fmtDate(value) : "Select date and time…"}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke={open ? "#8b3efe" : "#6b7280"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Calendar popover */}
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 500, background: "white", border: "1px solid rgba(28,37,51,0.1)", borderRadius: 16, boxShadow: "0 8px 28px rgba(0,0,0,0.12)", padding: "12px 12px 10px", width: 256 }}>

          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button onClick={prevMonth} style={{ width: 24, height: 24, borderRadius: 12, border: "1px solid rgba(28,37,51,0.12)", background: "#f7f5ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 2L3 5l4 3" stroke="#1c2533" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1c2533" }}>{CAL_MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} style={{ width: 24, height: 24, borderRadius: 12, border: "1px solid rgba(28,37,51,0.12)", background: "#f7f5ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2l4 3-4 3" stroke="#1c2533" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 2 }}>
            {CAL_DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "#9ca3af" }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`}/>)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const isSelected = selDay === day && (!selYM || (selYM[0] === viewYear && selYM[1] === viewMonth));
              const isToday    = day === todayD && viewMonth === todayM && viewYear === todayY;
              return (
                <div
                  key={day}
                  onClick={() => { setSelDay(day); setSelYM([viewYear, viewMonth]); commit(viewYear, viewMonth, day, hour, minute, ampm); }}
                  style={{ textAlign: "center", padding: "4px 0", borderRadius: 8, fontSize: 11, fontWeight: isSelected ? 700 : 400, cursor: "pointer", background: isSelected ? "#8b3efe" : isToday ? "rgba(139,62,254,0.08)" : "transparent", color: isSelected ? "white" : isToday ? "#8b3efe" : "#1c2533" }}
                >
                  {day}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid rgba(28,37,51,0.07)", margin: "8px 0 6px" }}/>

          {/* Time picker — single compact row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {/* Hour nudge */}
            <button onClick={() => adjHour(-1)} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(28,37,51,0.12)", background: "#f7f5ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M6 2L3 4.5 6 7" stroke="#1c2533" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>
            <div style={{ width: 30, height: 26, background: "#f4f1fc", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#1c2533" }}>{String(hour).padStart(2,"0")}</div>
            <button onClick={() => adjHour(1)}  style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(28,37,51,0.12)", background: "#f7f5ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M3 2l3 2.5-3 2.5" stroke="#1c2533" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>

            <span style={{ fontSize: 14, fontWeight: 700, color: "#1c2533" }}>:</span>

            {/* Minute nudge */}
            <button onClick={() => adjMinute(-5)} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(28,37,51,0.12)", background: "#f7f5ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M6 2L3 4.5 6 7" stroke="#1c2533" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>
            <div style={{ width: 30, height: 26, background: "#f4f1fc", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#1c2533" }}>{String(minute).padStart(2,"0")}</div>
            <button onClick={() => adjMinute(5)}  style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(28,37,51,0.12)", background: "#f7f5ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M3 2l3 2.5-3 2.5" stroke="#1c2533" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>

            {/* AM/PM inline toggle */}
            <div style={{ display: "flex", background: "#f4f1fc", borderRadius: 8, padding: 2, gap: 2, marginLeft: 2 }}>
              <div onClick={() => setAmpm("AM")} style={{ padding: "3px 7px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", background: ampm === "AM" ? "#8b3efe" : "transparent", color: ampm === "AM" ? "white" : "#6b7280" }}>AM</div>
              <div onClick={() => setAmpm("PM")} style={{ padding: "3px 7px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", background: ampm === "PM" ? "#8b3efe" : "transparent", color: ampm === "PM" ? "white" : "#6b7280" }}>PM</div>
            </div>
          </div>

          {/* Confirm */}
          <button
            onClick={handleConfirm}
            disabled={selDay === null}
            style={{ marginTop: 8, width: "100%", height: 30, borderRadius: 40, border: "none", background: selDay ? "#8b3efe" : "rgba(28,37,51,0.07)", color: selDay ? "white" : "#9ca3af", fontSize: 12, fontWeight: 600, cursor: selDay ? "pointer" : "not-allowed" }}
          >
            {selDay ? `Confirm — ${CAL_MONTHS[viewMonth].slice(0,3)} ${selDay}` : "Pick a day first"}
          </button>
        </div>
      )}

      <span style={{ fontSize: 12, fontWeight: 400, color: value ? "#8b3efe" : "#69728a", lineHeight: "18.75px" }}>{hint}</span>
    </div>
  );
}

// ─── REWARDS TOGGLE ───────────────────────────────────────────────────────────
function RewardsToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ border: "1.25px solid rgba(28,37,51,0.21)", borderRadius: 40, background: "white", boxShadow: "inset 8px 0 0 0 #8a3ffc", display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", minHeight: 78 }}>
      <div style={{ width: 33.984, height: 33.984, background: "rgba(138,63,252,0.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="17.988" height="17.988" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="8" width="16" height="2.5" rx="1" stroke="#8a3ffc" strokeWidth="1.5"/>
          <rect x="3" y="10.5" width="14" height="7" rx="1" stroke="#8a3ffc" strokeWidth="1.5"/>
          <path d="M10 8V17.5" stroke="#8a3ffc" strokeWidth="1.5"/>
          <path d="M10 8C10 8 7 8 7 5.5C7 3.8 8.2 3 9.5 3 11 3 10 5.5 10 8z" stroke="#8a3ffc" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M10 8C10 8 13 8 13 5.5C13 3.8 11.8 3 10.5 3 9 3 10 5.5 10 8z" stroke="#8a3ffc" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "#1c2533", margin: 0, lineHeight: "20.925px" }}>
          Will this campaign offer rewards?
        </p>
        <p style={{ fontSize: 12.5, margin: 0, lineHeight: "18.75px" }}>
          <span style={{ fontWeight: 600, color: "#3d485c" }}>{enabled ? "Rewards on" : "Rewards off"}</span>
          <span style={{ fontWeight: 400, color: "#69728a" }}>
            {enabled
              ? " · Participants can earn rewards. You set the budget and how it is split on the Rewards & Funding step."
              : " · This is a non-incentivised campaign."}
          </span>
        </p>
      </div>
      <div
        onClick={() => onChange(!enabled)}
        style={{ width: 46, height: 26, borderRadius: 20, background: enabled ? "#8a3ffc" : "#D1D5DB", border: `1px solid ${enabled ? "#8a3ffc" : "#D1D5DB"}`, cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.18s" }}
      >
        <div style={{ position: "absolute", top: 3, left: enabled ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "white", transition: "left 0.18s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }} />
      </div>
    </div>
  );
}

// ─── NOTICE DIALOG (Figma 9053:41689) ─────────────────────────────────────────
function NoticeDialog({ title, body, note, cancelLabel = "Cancel", confirmLabel, tone = "primary", onCancel, onConfirm, children }: {
  title: string; body: React.ReactNode; note?: React.ReactNode; cancelLabel?: string; confirmLabel: string;
  tone?: "primary" | "danger"; onCancel: () => void; onConfirm: () => void; children?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(4,3,9,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" as const }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: children ? 560 : 480, background: "white", border: "1.25px solid rgba(28,37,51,0.15)", borderRadius: 40, boxShadow: "0 22px 50px -22px rgba(28,37,51,0.28)", boxSizing: "border-box" as const, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 24px 0", fontSize: 16.38, fontWeight: 600, color: "#1c2533", letterSpacing: -0.3276, lineHeight: "18.84px" }}>{title}</div>
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 14, color: "#3d485c", lineHeight: "22.4px" }}>{body}</div>
          {children}
          {note && (
            <div style={{ background: "rgba(138,63,252,0.1)", border: "1.25px solid rgba(138,63,252,0.24)", borderRadius: 40, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <FigmaIcon name="modalInfo" style={{ marginTop: 1 }} />
              <span style={{ fontSize: 13, color: "#6e2bd8", lineHeight: "20.15px" }}>{note}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px 22px", flexWrap: "wrap" as const }}>
          <button onClick={onCancel}
            style={{ minHeight: 40, padding: "10px 16px", borderRadius: 40, background: "#f7f4fe", border: "1.25px solid rgba(28,37,51,0.15)", fontSize: 14, fontWeight: 600, color: "#1c2533", fontFamily: "inherit", cursor: "pointer" }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} autoFocus
            style={tone === "danger"
              ? { minHeight: 40, padding: "10px 16px", borderRadius: 40, background: "rgba(248,113,113,0.16)", border: "1.25px solid rgba(228,84,91,0.34)", fontSize: 14, fontWeight: 600, color: "#e4545b", fontFamily: "inherit", cursor: "pointer" }
              : { minHeight: 40, padding: "10px 16px", borderRadius: 40, background: "#8b3efe", border: "1.25px solid transparent", fontSize: 14, fontWeight: 600, color: "white", fontFamily: "inherit", cursor: "pointer" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, icon, figmaIcon }: { title: string; subtitle: string; icon?: React.ReactNode; figmaIcon?: string }) {
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start", marginBottom: 0 }}>
      {figmaIcon ? (
        <FigmaIcon name={figmaIcon} style={{ width: 25.99, height: 25.99 }} />
      ) : (
        <div style={{ width: 25.99, height: 25.99, borderRadius: 8, background: "linear-gradient(135deg, #9b7cff 0%, #7c5cfc 50%, #5aa8ff 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#1c2533", letterSpacing: -0.32, lineHeight: "19px" }}>{title}</div>
        <div style={{ fontSize: 12.5, fontWeight: 400, color: "#767a8c", lineHeight: "19.38px" }}>{subtitle}</div>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export type PublishedCampaign = {
  name: string; description: string; startDate: string; endDate: string; rewardsEnabled: boolean;
  /** Template the campaign started from, or null when built from scratch. */
  templateId: string | null;
  /** The uploaded cover image file, for the backend to store. null when none was added. */
  coverImage: File | null;
  /** Each task's `title` is its Task Description: the text participants see in the main app. */
  stages: Array<{ id: string; name: string; returnDays: number; tasks: Array<TaskEntry & { title: string }>; allocationPct: number | null }>;
  rewards: null | { budget: number; token: TokenSymbol; network: NetworkId; validationRewardsOn: boolean; curatorRewardsOn: boolean; curatorAddress: string | null; recipients: number; nexuraScoreRequirementPct: number; participantPool: number; totalPaid: number; paymentTxHash: string | null };
  /** Raw builder state, saved with the draft so it reopens exactly where it was left. */
  builder: BuilderState;
};
/** Everything on screen in the builder, including the step the admin was on. */
export type BuilderState = {
  version: 1;
  step: number;
  templateId: string | null;
  journeyCadence: "daily" | "weekly";
  rewardsEnabled: boolean;
  name: string; description: string; startDate: string; endDate: string;
  stages: Array<{ id: string; name: string; tasks: TaskEntry[]; returnDays: number; retentionType: "immediately" | "custom" }>;
  rewardBudget: string; rewardNetwork: NetworkId; rewardToken: TokenSymbol; rewardRecipients: string;
  retentionRequirement: string; stageAlloc: Record<string, string>;
  paidKey: string | null; paymentTxHash: string | null;
  /** The furthest step reached, so a reopened draft can jump forward again. */
  furthestStep?: number;
};
/** What the wallet is asked to pay when "Pay campaign total" is clicked. */
export type CampaignPayment = {
  network: NetworkId; chainId: number | null; token: TokenSymbol;
  /** Opening fee + reward budget, in `token`. */
  totalAmount: number; rewardBudget: number; openingFee: number;
  /** Share of the budget paid out to participants, and how many participants can be rewarded. */
  participantPool: number; recipients: number;
  campaignName: string; startDate: string;
};
export default function CreateNewCampaign({
  onUseTemplate, onScratch, onPublish, onAutosave, onPay,
  walletAddress, onConnectWallet, onDisconnectWallet,
  tokenPricesUsd,
  retentionStats,
  projectCurator,
  initialState,
  initialCoverUrl,
  mode = "create",
}: {
  /** A saved draft to reopen: the builder starts on the step it was left on, with every field filled in. */
  initialState?: BuilderState | null;
  /** Cover image already stored for the campaign being reopened. */
  initialCoverUrl?: string | null;
  /** "live" edits a published campaign: nothing autosaves, and the last step saves the changes instead of publishing. */
  mode?: "create" | "live";
  onUseTemplate?: (id: string) => void;
  onScratch?: () => void;
  /** Saves and publishes the campaign. When it returns a promise, the page shows "Published" only after it resolves, and shows the error if it rejects. */
  onPublish?: (campaign: PublishedCampaign) => void | Promise<void>;
  /** Saves the work in progress as a draft. Resolve "skipped" when there isn't enough to save yet; reject to show "Draft not saved". */
  onAutosave?: (campaign: PublishedCampaign) => Promise<"saved" | "skipped">;
  /**
   * Sends the campaign payment from the connected wallet. It should open the wallet's
   * transaction prompt and resolve once the transaction is confirmed (reject if the user
   * declines or it fails). Until the backend is connected this can be left out and the
   * button simply marks the payment as confirmed.
   */
  onPay?: (payment: CampaignPayment) => Promise<{ txHash?: string } | void>;
  /** Connected wallet address (null = not connected). Leave out to let the page connect a browser wallet (window.ethereum) itself. */
  walletAddress?: string | null;
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
  /** Live USD prices for non-stable tokens, e.g. { ETH: 3200, BNB: 600, TRUST: 0.4 }. USDC/USDT are always 1. */
  tokenPricesUsd?: Partial<Record<TokenSymbol, number>>;
  /** Retention distribution of Nexura users, from the backend. */
  retentionStats?: RetentionStats | null;
  /** First person to curate this project, from the curator check. undefined = still checking, null = no curator yet. */
  projectCurator?: { name: string; address?: string } | null;
} = {}) {
  // ── Wizard navigation ──
  const signedIn = useProjectSession();
  const init = initialState ?? null;
  // A reopened campaign (live or saved draft) already has its content: picking a template or
  // starting from scratch would overwrite it, so the Template step can't be reopened.
  const templateLocked = mode === "live" || init !== null;
  // A refresh reopens the step in the URL (?step=), falling back to where the draft was saved
  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (!templateLocked) return 1;
    const fromUrl = Number(readUrlParam("step"));
    const step = Number.isInteger(fromUrl) && fromUrl >= 2 && fromUrl <= 5 ? fromUrl : Math.max(init?.step ?? 2, 2);
    return step === 4 && init?.rewardsEnabled === false ? 3 : step;
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(init?.templateId ?? null);
  const [startChoice, setStartChoice] = useState<{ kind: "template"; id: string } | { kind: "scratch" } | null>(null);
  const [pendingRewards, setPendingRewards] = useState<boolean | null>(null);
  const [showJourneyTpl, setShowJourneyTpl] = useState(false);
  const [journeyCadence, setJourneyCadence] = useState<"daily" | "weekly">(init?.journeyCadence ?? "weekly");
  const goToStep = (step: number) => { setCurrentStep(step); scrollToTop(); };
  const [furthestStep, setFurthestStep] = useState(() => Math.max(init?.furthestStep ?? 0, init?.step ?? 0, currentStep));
  useEffect(() => { setFurthestStep(f => Math.max(f, currentStep)); }, [currentStep]);
  // Every step opens at the top (the Studio scrolls inside its <main> panel, not the window)
  useEffect(() => { scrollToTop(); writeUrlParam("step", currentStep > 1 ? String(currentStep) : null); }, [currentStep]);

  // ── Step 1 state ──
  const [rewardsEnabled, setRewardsEnabled] = useState(init?.rewardsEnabled ?? true);
  const [scratchHovered, setScratchHovered] = useState(false);

  // ── Step 2 state ──
  const [campaignName, setCampaignName]               = useState(init?.name ?? "");
  const [campaignDescription, setCampaignDescription] = useState(init?.description ?? "");
  const [coverPreview, setCoverPreview]               = useState<string | null>(initialCoverUrl ?? null);
  const [coverFile, setCoverFile]                     = useState<File | null>(null);
  const [coverError, setCoverError]                   = useState("");
  const [coverDragOver, setCoverDragOver]             = useState(false);
  const [startDate, setStartDate]                     = useState(init?.startDate ?? "");
  const [endDate, setEndDate]                         = useState(init?.endDate ?? "");
  const [continueHovered, setContinueHovered]         = useState(false);
  const [backHovered, setBackHovered]                 = useState(false);
  const [saveState, setSaveState]                     = useState<SaveState>("idle");
  const [saveError, setSaveError]                     = useState("");
  const fileRef    = useRef<HTMLInputElement>(null);
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Step 3 state ──
  const [stages, setStages] = useState<BuilderState["stages"]>(init?.stages ?? []);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [addStageHovered, setAddStageHovered] = useState(false);
  const [useJourneyTplHovered, setUseJourneyTplHovered] = useState(false);
  const [continueStep3Hovered, setContinueStep3Hovered] = useState(false);
  const [backStep3Hovered, setBackStep3Hovered] = useState(false);
  const [addNextStageHovered, setAddNextStageHovered] = useState(false);
  // ── Configure-Tasks modal state ──
  const [showTaskModal, setShowTaskModal] = useState<string | null>(null); // stageId
  const [taskModalStep, setTaskModalStep] = useState<"select" | "configure">("select");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskFilterCat, setTaskFilterCat] = useState("All");
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [selectedTaskCatalogItem, setSelectedTaskCatalogItem] = useState<typeof TASK_CATALOG[0] | null>(null);
  const [taskUrlInput, setTaskUrlInput] = useState("");
  const [taskDescInput, setTaskDescInput] = useState("");
  const [taskValidationMode, setTaskValidationMode] = useState<ValidationMode>("manual");
  const [taskApiEndpoint, setTaskApiEndpoint] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [customisingStageId, setCustomisingStageId] = useState<string | null>(null);
  // ── Rewards & Funding state ──
  const [rewardBudget, setRewardBudget] = useState(init?.rewardBudget ?? "");
  const [rewardNetwork, setRewardNetwork] = useState<NetworkId>(init?.rewardNetwork ?? DEFAULT_NETWORK);
  const [rewardToken, setRewardToken] = useState<TokenSymbol>(init?.rewardToken ?? NETWORKS.find(n => n.id === DEFAULT_NETWORK)!.tokens[0]);
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const tokenMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tokenMenuOpen) return;
    const onDown = (e: MouseEvent) => { if (tokenMenuRef.current && !tokenMenuRef.current.contains(e.target as Node)) setTokenMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setTokenMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [tokenMenuOpen]);
  const [rewardRecipients, setRewardRecipients] = useState(init?.rewardRecipients ?? "");
  const [retentionRequirement, setRetentionRequirement] = useState(init?.retentionRequirement ?? DEFAULT_RETENTION_REQUIREMENT);
  const templateEndDateRef = useRef<string | null>(null); // end date the template filled in, so scratch can undo it
  const [stageAlloc, setStageAlloc] = useState<Record<string, string>>(init?.stageAlloc ?? {});
  const [paidKey, setPaidKey] = useState<string | null>(init?.paidKey ?? null);
  // Wallet: the app can control it via props; otherwise the page connects an injected browser wallet itself
  const [injectedAddress, setInjectedAddress] = useState<string | null>(null);
  const [walletNotice, setWalletNotice] = useState("");
  const connectedAddress: string | null = walletAddress !== undefined ? walletAddress : injectedAddress;
  async function connectWallet() {
    setWalletNotice("");
    if (onConnectWallet) { onConnectWallet(); return; }
    const eth = getInjectedWallet();
    if (!eth) { setWalletNotice("No browser wallet found. Install a wallet such as MetaMask, then try again."); return; }
    try {
      // Ask for permissions explicitly so the wallet always shows its connect prompt, even after a disconnect
      try {
        await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      } catch (err) {
        if ((err as { code?: number })?.code === 4001) throw err; // user rejected
        // wallet doesn't support wallet_requestPermissions: fall back to eth_requestAccounts below
      }
      const accounts = await eth.request({ method: "eth_requestAccounts" }) as string[];
      const addr = accounts && accounts[0] ? accounts[0] : null;
      setInjectedAddress(addr);
      if (addr) switchWalletChain(eth, activeNetworkInfo.chainId).catch(() => {});
    } catch {
      setWalletNotice("Wallet connection was cancelled.");
    }
  }
  function disconnectWallet() {
    if (onDisconnectWallet) { onDisconnectWallet(); return; }
    setInjectedAddress(null);
    // Revoke the site's account permission so the next "Connect wallet" prompts again
    getInjectedWallet()?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }).catch(() => {});
  }
  useEffect(() => {
    if (walletAddress !== undefined) return;
    const eth = (window as unknown as { ethereum?: { on?: (e: string, f: (a: string[]) => void) => void; removeListener?: (e: string, f: (a: string[]) => void) => void } }).ethereum;
    if (!eth?.on) return;
    const onAccounts = (accounts: string[]) => setInjectedAddress(accounts && accounts[0] ? accounts[0] : null);
    eth.on("accountsChanged", onAccounts);
    return () => { eth.removeListener?.("accountsChanged", onAccounts); };
  }, [walletAddress]);
  const [payStatus, setPayStatus] = useState<"idle" | "awaiting" | "error">("idle");
  const [payError, setPayError] = useState("");
  const [paymentTxHash, setPaymentTxHash] = useState<string | null>(init?.paymentTxHash ?? null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

  const duration = calcDuration(startDate, endDate);

  // ── Rewards & Funding derived values ──
  // Budget is entered in the selected token; reward rules ($2 minimum per stage) are checked in USD.
  const isStableToken = STABLE_TOKENS.includes(rewardToken);
  const tokenPriceUsd: number | null = usdPriceOf(rewardToken, tokenPricesUsd);
  const priceKnown = tokenPriceUsd !== null && tokenPriceUsd > 0;
  const budgetNum = Math.max(0, Number(rewardBudget) || 0);                 // in rewardToken
  const budgetUsd = priceKnown ? budgetNum * (tokenPriceUsd as number) : 0;
  // Validation Rewards only apply when a task is peer-reviewed by the community; the Project Curator share always applies.
  const peerReviewTasks = stages.reduce((n, st) => n + st.tasks.filter(t => t.validationMode === "peer").length, 0);
  const validationRewardsOn = peerReviewTasks > 0;
  const curatorRewardsOn = true;
  const participationPct = 70 + (validationRewardsOn ? 0 : 2);
  const allocationRows = [
    { label: "Existing User Participation Pool", pct: participationPct as number | null },
    { label: "New User Pool", pct: 12 as number | null },
    { label: "Project Curator", pct: 1 as number | null },
    { label: "Ambassador Pool", pct: 5 as number | null },
    { label: "Validation Rewards", pct: validationRewardsOn ? 2 : null },
    { label: "Nexura Service Fee", pct: 10 as number | null },
  ];
  const participantPoolTokens = budgetNum * participationPct / 100;
  const participantPool = budgetUsd * participationPct / 100;               // USD
  const openingFeeTokens = priceKnown ? OPENING_FEE_USD / (tokenPriceUsd as number) : null;
  const totalPaymentDue = openingFeeTokens !== null ? budgetNum + openingFeeTokens : null; // in rewardToken
  const fmtToken = (n: number) => isStableToken ? fmtUSD(n) : `${n.toLocaleString("en-US", { maximumFractionDigits: n >= 100 ? 2 : 4 })} ${rewardToken}`;
  const usdHint = (n: number) => (!isStableToken && priceKnown) ? ` (≈ ${fmtUSD(n * (tokenPriceUsd as number))})` : "";
  const recipientsNum = Math.max(0, Math.floor(Number(rewardRecipients) || 0));
  const maxPerRecipient = recipientsNum > 0 ? participantPool / recipientsNum : 0; // USD
  const allocValues = stages.map(st => Math.max(0, Number(stageAlloc[st.id]) || 0));
  const rewardedStageCount = allocValues.filter(v => v > 0).length || stages.length;
  const minPerRecipient = MIN_PER_STAGE_USD * rewardedStageCount;
  const recipientCapacity = minPerRecipient > 0 ? Math.floor(participantPool / minPerRecipient) : 0;
  const recipientsOverCapacity = priceKnown && recipientsNum > recipientCapacity;
  const capacityShortfall = Math.max(0, recipientsNum * minPerRecipient - participantPool);
  const extraBudgetUsd = capacityShortfall / (participationPct / 100);
  const extraBudgetTokens = priceKnown ? (isStableToken ? Math.ceil(extraBudgetUsd) : Math.ceil((extraBudgetUsd / (tokenPriceUsd as number)) * 10000) / 10000) : 0;
  const totalAllocated = round1(allocValues.reduce((a, b) => a + b, 0));
  const stageMinPct = maxPerRecipient > 0 ? Math.ceil((MIN_PER_STAGE_USD / maxPerRecipient) * 1000) / 10 : 100;
  const stageAllocErrors = allocValues.map(v => priceKnown && v > 0 && (maxPerRecipient * v / 100) < MIN_PER_STAGE_USD);
  const paymentKey = totalPaymentDue !== null ? `${rewardNetwork}|${rewardToken}|${totalPaymentDue}` : null;
  // A live campaign was paid for when it was published
  const isPaid = mode === "live" || (paidKey !== null && paidKey === paymentKey);
  const rewardsValid = priceKnown && budgetNum > 0 && recipientsNum > 0 && !recipientsOverCapacity && Math.abs(totalAllocated - 100) < 0.05 && !stageAllocErrors.some(Boolean);
  const canContinueToReview = rewardsValid && isPaid;
  /** Opens a step from the progress bar, forward too, as far as the filled-in steps allow. */
  function jumpToStep(n: number) {
    if (n > currentStep) {
      const journeyOk = stages.length > 0 && stages.every(st => st.tasks.length > 0);
      if (n >= 4 && !journeyOk) n = 3;
      if (n === 4 && !rewardsEnabled) n = 5;
      if (n === 5 && rewardsEnabled && !canContinueToReview) n = 4;
    }
    goToStep(n);
  }
  const activeNetworkInfo = NETWORKS.find(n => n.id === rewardNetwork) || NETWORKS[0];

  async function handlePay() {
    if (!rewardsValid || !paymentKey || totalPaymentDue === null || payStatus === "awaiting" || !connectedAddress) return;
    const key = paymentKey;
    if (!onPay) { setPaidKey(key); return; }
    setPayStatus("awaiting"); setPayError("");
    try {
      const res = await onPay({
        network: rewardNetwork, chainId: activeNetworkInfo.chainId, token: rewardToken,
        totalAmount: totalPaymentDue, rewardBudget: budgetNum, openingFee: openingFeeTokens ?? 0,
        participantPool: participantPoolTokens, recipients: recipientsNum,
        campaignName: campaignName.trim(), startDate,
      });
      setPaymentTxHash(res && res.txHash ? res.txHash : null);
      setPaidKey(key);
      setPayStatus("idle");
    } catch (err) {
      setPayStatus("error");
      setPayError(err instanceof Error && err.message ? err.message : "The transaction was not completed.");
    }
  }

  function handleNetworkChange(id: NetworkId, token?: TokenSymbol) {
    const net = NETWORKS.find(n => n.id === id);
    if (!net || isPaid) return; // a confirmed payment locks its network and token
    setRewardNetwork(id);
    // Ask the connected wallet to switch to the chosen network
    const eth = getInjectedWallet();
    if (eth && connectedAddress) {
      switchWalletChain(eth, net.chainId).catch(() => setWalletNotice(`Switch your wallet to ${net.name} to pay on that network.`));
    }
    const nextToken: TokenSymbol = token && net.tokens.includes(token) ? token
      : net.tokens.includes(rewardToken) ? rewardToken
      : (net.tokens.find(t => STABLE_TOKENS.includes(t)) || net.tokens[0]);
    if (nextToken !== rewardToken) {
      // Keep the budget's value when the token changes (needs both USD prices)
      const priceOf = (t: TokenSymbol): number | null => usdPriceOf(t, tokenPricesUsd);
      const from = priceOf(rewardToken), to = priceOf(nextToken);
      if (from && to && budgetNum > 0) {
        const converted = (budgetNum * from) / to;
        setRewardBudget(String(STABLE_TOKENS.includes(nextToken) ? Math.round(converted) : Math.round(converted * 10000) / 10000));
      }
      setRewardToken(nextToken);
    }
  }

  // Reward rows mirror the journey stages: (re)seed the split when stages change
  useEffect(() => {
    if (currentStep !== 4) return;
    const ids = stages.map(st => st.id);
    // Keep the split already entered; only a stage without a share starts the split over
    if (ids.every(id => id in stageAlloc)) {
      if (Object.keys(stageAlloc).length !== ids.length) setStageAlloc(Object.fromEntries(ids.map(id => [id, stageAlloc[id]])));
      return;
    }
    const tplSplit = TEMPLATES.find(t => t.id === selectedTemplateId)?.structure.map(x => x.pct);
    const split = tplSplit && tplSplit.length === ids.length ? tplSplit : templateSplit(ids.length, maxPerRecipient);
    const next: Record<string, string> = {};
    ids.forEach((id, i) => { next[id] = String(split[i] ?? 0); });
    setStageAlloc(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, stages]);

  // A chosen template sets the campaign length: fill the end date once a start date exists
  useEffect(() => {
    const tpl = TEMPLATES.find(t => t.id === selectedTemplateId);
    if (tpl && startDate && !endDate) { const e = addMonthsISO(startDate, tpl.months); templateEndDateRef.current = e; setEndDate(e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, selectedTemplateId]);


  /** Everything the page needs to save or publish this campaign. */
  function buildPayload(): PublishedCampaign {
    return {
      name: campaignName.trim(), description: campaignDescription.trim(), coverImage: coverFile, startDate, endDate, rewardsEnabled,
      templateId: selectedTemplateId,
      stages: stages.map(st => ({ id: st.id, name: st.name, returnDays: st.returnDays, tasks: st.tasks.map(t => ({ ...t, title: t.description.trim() || t.name })), allocationPct: rewardsEnabled ? (Number(stageAlloc[st.id]) || 0) : null })),
      rewards: rewardsEnabled ? { budget: budgetNum, token: rewardToken, network: rewardNetwork, validationRewardsOn, curatorRewardsOn, curatorAddress: projectCurator?.address ?? null, recipients: recipientsNum, nexuraScoreRequirementPct: Number(retentionRequirement) || 0, participantPool: participantPoolTokens, totalPaid: isPaid && totalPaymentDue !== null ? totalPaymentDue : 0, paymentTxHash: isPaid ? paymentTxHash : null } : null,
      builder: {
        version: 1, step: currentStep, templateId: selectedTemplateId, journeyCadence, rewardsEnabled,
        name: campaignName, description: campaignDescription, startDate, endDate, stages,
        rewardBudget, rewardNetwork, rewardToken, rewardRecipients, retentionRequirement, stageAlloc,
        paidKey, paymentTxHash, furthestStep,
      },
    };
  }

  // ── Auto-save: shows "Saving…" on any change, then saves the draft 1.5 s after typing stops ──
  // A reopened draft isn't saved again until something changes; a live campaign never autosaves.
  const skipFirstAutosave = useRef(!!initialState);
  // The save still waiting on its 1.5 s delay; sent straight away if the builder closes first
  const pendingAutosave = useRef<(() => void) | null>(null);
  useEffect(() => () => { pendingAutosave.current?.(); }, []);
  useEffect(() => {
    if (mode === "live" || currentStep < 2) return;
    if (skipFirstAutosave.current) { skipFirstAutosave.current = false; return; }
    setSaveState("saving");
    if (saveTimer.current)  clearTimeout(saveTimer.current);
    if (hideTimer.current)  clearTimeout(hideTimer.current);
    const payload = buildPayload();
    pendingAutosave.current = () => { onAutosave?.(payload).catch(() => {}); };
    saveTimer.current = setTimeout(async () => {
      pendingAutosave.current = null;
      let result: SaveState = "saved";
      if (onAutosave) {
        try { result = await onAutosave(buildPayload()); setSaveError(""); }
        catch (err) { result = "error"; setSaveError(err instanceof Error ? err.message : "The draft could not be saved."); }
      }
      setSaveState(result);
      if (result === "saved") hideTimer.current = setTimeout(() => setSaveState("idle"), 3000);
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignName, campaignDescription, startDate, endDate, rewardsEnabled, coverPreview, stages, currentStep, selectedTemplateId, journeyCadence, rewardBudget, rewardNetwork, rewardToken, rewardRecipients, retentionRequirement, stageAlloc, paidKey]);

  // Template / scratch choices ask for confirmation first
  function handleUseTemplate(id: string) { setStartChoice({ kind: "template", id }); }
  function handleScratch() { setStartChoice({ kind: "scratch" }); }
  function confirmStartChoice() {
    if (!startChoice) return;
    if (startChoice.kind === "template") {
      const tpl = TEMPLATES.find(t => t.id === startChoice.id);
      if (tpl) {
        setSelectedTemplateId(tpl.id);
        setRetentionRequirement(String(tpl.retentionPct));
        if (startDate) { const e = addMonthsISO(startDate, tpl.months); templateEndDateRef.current = e; setEndDate(e); }
        if (stages.length === 0) setJourneyCadence("daily");
      }
      onUseTemplate?.(startChoice.id);
    } else {
      // Scratch undoes everything a previously chosen template filled in
      if (selectedTemplateId) {
        setRetentionRequirement(DEFAULT_RETENTION_REQUIREMENT);
        if (templateEndDateRef.current && endDate === templateEndDateRef.current) setEndDate("");
        setStageAlloc({});
      }
      templateEndDateRef.current = null;
      setSelectedTemplateId(null);
      onScratch?.();
    }
    setStartChoice(null);
    goToStep(2);
  }
  // Rewards toggle always shows a notice first
  function requestRewardsChange(next: boolean) { if (next !== rewardsEnabled) setPendingRewards(next); }

  // ── Cover image pick ──
  function acceptCover(file: File | undefined) {
    if (!file) return;
    if (!COVER_TYPES.includes(file.type)) { setCoverError("Use an SVG, PNG, JPG or GIF image."); return; }
    if (file.size > COVER_MAX_BYTES) { setCoverError("That image is over 5MB. Use a smaller file."); return; }
    setCoverError("");
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }
  function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    acceptCover(e.target.files?.[0]);
    e.target.value = ""; // lets the same file be picked again after an error
  }

  // ── Journey stage handlers ──
  function handleAddFirstStage() {
    const newId = `stage-${Date.now()}`;
    setStages([{ id: newId, name: "", tasks: [], returnDays: 0, retentionType: "immediately" }]);
    setActiveStageId(newId);
  }
  function handleAddNextStage() {
    const newId = `stage-${Date.now()}`;
    if (stages.length >= MAX_STAGES) return;
    setStages(prev => [...prev, { id: newId, name: "", tasks: [], returnDays: 7, retentionType: "custom" }]);
    setActiveStageId(newId);
  }
  function handleUseJourneyTemplate() { setShowJourneyTpl(true); }
  const chosenTemplate = TEMPLATES.find(t => t.id === selectedTemplateId) ?? null;
  // A campaign template sets up its stages straight away: open the daily/weekly picker the first time the empty journey is shown
  const autoOpenedTplRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentStep === 3 && selectedTemplateId && stages.length === 0 && autoOpenedTplRef.current !== selectedTemplateId) {
      autoOpenedTplRef.current = selectedTemplateId;
      setShowJourneyTpl(true);
    }
  }, [currentStep, selectedTemplateId, stages.length]);
  function applyJourneyTemplate() {
    const plan = journeyTemplatePlan(TEMPLATES.find(t => t.id === selectedTemplateId)?.stageCount ?? 5, journeyCadence);
    const stamp = Date.now();
    const tplStages = plan.map((p, i) => ({ id: `stage-${stamp}-${i + 1}`, name: p.name, tasks: [], returnDays: p.returnDays, retentionType: (p.returnDays === 0 ? "immediately" : "custom") as "immediately" | "custom" }));
    setStages(tplStages);
    setActiveStageId(tplStages[0].id);
    setShowJourneyTpl(false);
  }
  function handleUpdateStageName(id: string, name: string) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }
  function handleDeleteStage(id: string) {
    setStages(prev => prev.filter(s => s.id !== id));
    if (activeStageId === id) setActiveStageId(null);
  }
  function handleDoneStage() {
    setActiveStageId(null);
    setCustomisingStageId(null);
  }
  function handleDuplicateStage(id: string) {
    if (stages.length >= MAX_STAGES) return;
    setStages(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const src = prev[idx];
      const stamp = Date.now();
      const copy = { ...src, id: `stage-${stamp}`, name: src.name ? `${src.name} (copy)` : "", tasks: src.tasks.map((t, i) => ({ ...t, id: `task-${stamp}-${i}` })) };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  }
  function handleSetRetention(id: string, days: number) {
    const d = Math.max(0, Math.round(days || 0));
    setStages(prev => prev.map(s => s.id === id ? { ...s, returnDays: d, retentionType: d === 0 ? "immediately" : "custom" } : s));
  }
  function handleDuplicateTask(stageId: string, taskId: string) {
    setStages(prev => prev.map(s => {
      if (s.id !== stageId || s.tasks.length >= MAX_TASKS_PER_STAGE) return s;
      const idx = s.tasks.findIndex(t => t.id === taskId);
      if (idx < 0) return s;
      const copy = { ...s.tasks[idx], id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
      return { ...s, tasks: [...s.tasks.slice(0, idx + 1), copy, ...s.tasks.slice(idx + 1)] };
    }));
  }
  function handleEditTask(stageId: string, task: TaskEntry) {
    const item = TASK_CATALOG.find(t => t.id === task.taskTypeId);
    if (!item) return;
    setShowTaskModal(stageId);
    setTaskModalStep("configure");
    setTaskSearch("");
    setTaskFilterCat("All");
    setSelectedTaskCatalogItem(item);
    setTaskUrlInput(task.taskUrl || "");
    setTaskDescInput(task.description || "");
    setTaskValidationMode(task.validationMode || "manual");
    setTaskApiEndpoint(task.apiEndpoint || "");
    setEditingTaskId(task.id);
  }

  // ── Task modal handlers ──
  function handleOpenTaskModal(stageId: string) {
    setEditingTaskId(null);
    setActiveStageId(stageId);
    setShowTaskModal(stageId);
    setTaskModalStep("select");
    setTaskSearch("");
    setTaskFilterCat("All");
    setSelectedTaskCatalogItem(null);
    setTaskUrlInput("");
    setTaskDescInput("");
    setTaskValidationMode("manual");
    setTaskApiEndpoint("");
  }
  function handleCloseTaskModal() {
    setEditingTaskId(null);
    setShowTaskModal(null);
    setTaskModalStep("select");
    setTaskSearch("");
    setTaskFilterCat("All");
    setHoveredTaskId(null);
    setSelectedTaskCatalogItem(null);
    setTaskUrlInput("");
    setTaskDescInput("");
    setTaskValidationMode("manual");
    setTaskApiEndpoint("");
  }
  function handleSelectTaskType(catalogItem: typeof TASK_CATALOG[0]) {
    setSelectedTaskCatalogItem(catalogItem);
    setTaskModalStep("configure");
    setTaskUrlInput("");
    setTaskDescInput("");
    setTaskValidationMode("manual");
    setTaskApiEndpoint("");
  }
  const canSaveTask = !!selectedTaskCatalogItem && !!taskDescInput.trim()
    && !(isSocialUrlTask(selectedTaskCatalogItem.id) && (!taskUrlInput.trim() || !!socialUrlError(selectedTaskCatalogItem.id, taskUrlInput)));
  function handleAddTask(stageId: string) {
    if (!selectedTaskCatalogItem || !taskDescInput.trim()) return;
    if (isSocialUrlTask(selectedTaskCatalogItem.id) && (!taskUrlInput.trim() || socialUrlError(selectedTaskCatalogItem.id, taskUrlInput))) return;
    const newTask: TaskEntry = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskTypeId: selectedTaskCatalogItem.id,
      name: selectedTaskCatalogItem.name,
      category: selectedTaskCatalogItem.category,
      points: selectedTaskCatalogItem.points,
      description: taskDescInput.trim(),
      subtext: CONFIGURABLE_VALIDATION_TASKS.includes(selectedTaskCatalogItem.id)
        ? (taskValidationMode === "manual" || taskValidationMode === "peer" ? "Manual Validation" : "Auto Validated")
        : "Auto Validated",
      taskUrl: taskUrlInput.trim(),
      ...(CONFIGURABLE_VALIDATION_TASKS.includes(selectedTaskCatalogItem.id) ? { validationMode: taskValidationMode } : {}),
      ...(CONFIGURABLE_VALIDATION_TASKS.includes(selectedTaskCatalogItem.id) && taskValidationMode === "api" ? { apiEndpoint: taskApiEndpoint.trim() } : {}),
    };
    setStages(prev => prev.map(s => {
      if (s.id !== stageId) return s;
      if (editingTaskId) return { ...s, tasks: s.tasks.map(t => t.id === editingTaskId ? { ...newTask, id: editingTaskId } : t) };
      if (s.tasks.length >= MAX_TASKS_PER_STAGE) return s;
      return { ...s, tasks: [...s.tasks, newTask] };
    }));
    handleCloseTaskModal();
  }
  function handleRemoveTask(stageId: string, taskId: string) {
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, tasks: s.tasks.filter(t => t.id !== taskId) } : s));
  }
  function getTaskUrlLabel(taskId: string): string {
    const labels: Record<string, string> = {
      "follow-x": "Profile URL",
      "comment-x": "Post URL",
      "retweet-x": "Post URL",
      "like-x": "Post URL",
      "join-discord": "Discord Server URL",
      "discord-msg": "Discord Channel URL",
      "telegram-join": "Telegram Group URL",
      "portal-claims": "Portal URL",
      "trust-username": ".trust Username",
      "portal-collab": "Portal URL",
      "portal-interacted": "Portal URL",
      "portal-follow": "Portal URL",
      "portal-support": "Portal URL",
      "product-feature": "Feature URL",
      "give-feedback": "Feedback Form URL",
      "custom": "Task URL",
    };
    return labels[taskId] || "URL";
  }
  function getTaskUrlPlaceholder(taskId: string): string {
    const placeholders: Record<string, string> = {
      "follow-x": "https://x.com/yourusername",
      "comment-x": "https://x.com/...",
      "retweet-x": "https://x.com/...",
      "like-x": "https://x.com/...",
      "join-discord": "https://discord.gg/...",
      "discord-msg": "https://discord.com/channels/...",
      "telegram-join": "https://t.me/...",
      "portal-claims": "https://portal.intuition.systems/...",
      "trust-username": "yourusername.trust",
      "portal-collab": "https://portal.intuition.systems/...",
      "portal-interacted": "https://portal.intuition.systems/...",
      "portal-follow": "https://portal.intuition.systems/...",
      "portal-support": "https://portal.intuition.systems/...",
      "product-feature": "https://...",
      "give-feedback": "https://...",
      "custom": "https://...",
    };
    return placeholders[taskId] || "https://...";
  }
  function getAutoVerifyInfo(taskId: string): { title: string; subtitle: string } {
    const xTasks = ["follow-x", "comment-x", "retweet-x", "like-x"];
    const discordTasks = ["join-discord", "discord-msg"];
    const telegramTasks = ["telegram-join"];
    if (xTasks.includes(taskId)) return { title: "Verified via X api", subtitle: "X task completion will be automatically verified through users X accounts." };
    if (discordTasks.includes(taskId)) return { title: "Verified via Discord api", subtitle: "Discord task completion will be automatically verified through users Discord accounts." };
    if (telegramTasks.includes(taskId)) return { title: "Verified via Telegram api", subtitle: "Telegram task completion will be automatically verified through users Telegram accounts." };
    return { title: "Verified via Intuition knowledge graph", subtitle: "On-chain task completion will be automatically verified through the Intuition knowledge graph." };
  }

  // ── Derived task list for modal ──
  const TASK_CATEGORIES = ["All", "Social", "On-chain", "Product", "Feedback", "Custom"];
  function getFilteredTasks() {
    return TASK_CATALOG.filter(t => {
      // Social tab also shows Community tasks (Discord/Telegram grouped under Social)
      const matchCat = taskFilterCat === "All"
        ? true
        : taskFilterCat === "Social"
          ? t.category === "Social" || t.category === "Community"
          : t.category.toLowerCase() === taskFilterCat.toLowerCase();
      const matchSearch = !taskSearch.trim() || t.name.toLowerCase().includes(taskSearch.toLowerCase()) || t.category.toLowerCase().includes(taskSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }

  function getTaskRowIcon(taskId: string): React.ReactNode {
    const item = TASK_CATALOG.find(t => t.id === taskId);
    if (item && item.category === "On-chain") return <img src={INTUITION_ICON_SRC} width={20} height={20} alt="" style={{ display: "block", width: 20, height: 20 }} />;
    return getTaskPlatformIcon(taskId);
  }
  function getTaskPlatformIcon(taskId: string): React.ReactNode {
    const xIcon = (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M9.4 6.9L14.9 0.5H13.6L8.8 6.1 5 0.5H0.5L6.3 8.7 0.5 15.5H1.8L6.9 9.5 11 15.5H15.5L9.4 6.9ZM7.5 8.8L6.9 8 1.8 1.4H4.4L7.9 6.4 8.5 7.2L13.6 14.1H11L7.5 8.8Z" fill="#0f1419"/>
      </svg>
    );
    const discordIcon = (
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
        <path d="M15.2 1.2A14.9 14.9 0 0011.6.2l-.5 1.3a13.7 13.7 0 00-4 0L6.6.2A14.9 14.9 0 002.8 1.2C.4 4.8-.2 8.3.1 11.7a14.9 14.9 0 004.5 2.4c.33-.46.63-.94.9-1.4-.5-.2-1-.4-1.5-.7l.4-.3a10.6 10.6 0 009.4 0l.4.3c-.5.3-1 .5-1.5.7.27.46.57.94.9 1.4a14.9 14.9 0 004.5-2.4c.4-4-.6-7.4-2.7-10.5zM5.9 9.5c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8zm6.2 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8z" fill="#5865F2"/>
      </svg>
    );
    const telegramIcon = (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="9" fill="#2AABEE"/>
        <path d="M13 5.5L4 8.5l2.5.8.8 2.7 1.2-1.5 2.2 1.6L13 5.5z" fill="white"/>
      </svg>
    );
    const onchainIcon = (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" stroke="#8b3efe" strokeWidth="1.5"/>
        <path d="M5.5 9l2.5 2.5 4.5-5" stroke="#8b3efe" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    const productIcon = (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke="#f59e0b" strokeWidth="1.5"/>
        <path d="M6 9h6M9 6v6" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
    const feedbackIcon = (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M15.5 2.5H2.5a1 1 0 00-1 1v8a1 1 0 001 1H6v3l3-3h6.5a1 1 0 001-1v-8a1 1 0 00-1-1z" stroke="#e91e63" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    );
    const customIcon = (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="6.5" stroke="#9c27b0" strokeWidth="1.5"/>
        <path d="M9 6v6M6 9h6" stroke="#9c27b0" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
    // Figma-matched icons
    const slidersIcon = (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="4.5" cy="5" r="2" stroke="#1c2533" strokeWidth="1.4"/>
        <path d="M8.5 5h7" stroke="#1c2533" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="13.5" cy="13" r="2" stroke="#1c2533" strokeWidth="1.4"/>
        <path d="M2.5 13h7" stroke="#1c2533" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    );
    // Intuition mark: the exact image used in Figma ("CAMPAIGN@72x"), exported at 3x
    const ringIcon = (
      <img src={INTUITION_ICON_SRC} width={22} height={22} alt="" style={{ display: "block", width: 22, height: 22 }} />
    );
    const boltIcon = (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M10 1.5L3.5 10h5l-1 6.5L14.5 8h-5l.5-6.5z" stroke="#1c2533" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    );
    const trustIcon = (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="4.5" width="14" height="9" rx="2" fill="#3b7bff"/>
        <path d="M5.5 9h7M9 6.5v5" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    );
    const discordGreyIcon = (
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
        <path d="M15.2 1.2A14.9 14.9 0 0011.6.2l-.5 1.3a13.7 13.7 0 00-4 0L6.6.2A14.9 14.9 0 002.8 1.2C.4 4.8-.2 8.3.1 11.7a14.9 14.9 0 004.5 2.4c.33-.46.63-.94.9-1.4-.5-.2-1-.4-1.5-.7l.4-.3a10.6 10.6 0 009.4 0l.4.3c-.5.3-1 .5-1.5.7.27.46.57.94.9 1.4a14.9 14.9 0 004.5-2.4c.4-4-.6-7.4-2.7-10.5zM5.9 9.5c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8zm6.2 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8z" fill="#69728a"/>
      </svg>
    );
    const feedbackGreyIcon = (
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
        <path d="M15.2 1.2A14.9 14.9 0 0011.6.2l-.5 1.3a13.7 13.7 0 00-4 0L6.6.2A14.9 14.9 0 002.8 1.2C.4 4.8-.2 8.3.1 11.7a14.9 14.9 0 004.5 2.4c.33-.46.63-.94.9-1.4-.5-.2-1-.4-1.5-.7l.4-.3a10.6 10.6 0 009.4 0l.4.3c-.5.3-1 .5-1.5.7.27.46.57.94.9 1.4a14.9 14.9 0 004.5-2.4c.4-4-.6-7.4-2.7-10.5zM5.9 9.5c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8zm6.2 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8z" fill="#b4b9c8"/>
      </svg>
    );
    const figmaX = <FigmaIcon name="x" />;
    const figmaDiscord = <FigmaIcon name="discord" />;
    const figmaTelegram = <FigmaIcon name="telegram" />;
    void trustIcon; void onchainIcon; void xIcon; void discordGreyIcon; void telegramIcon; void productIcon; void feedbackIcon; void customIcon; void discordIcon;
    const map: Record<string, React.ReactNode> = {
      "follow-x": figmaX, "comment-x": figmaX, "retweet-x": figmaX, "like-x": figmaX,
      "join-discord": figmaDiscord, "discord-msg": figmaDiscord,
      "telegram-join": figmaTelegram,
      "portal-claims": ringIcon, "trust-username": ringIcon,
      "portal-collab": ringIcon, "portal-interacted": ringIcon,
      "portal-follow": ringIcon, "portal-support": ringIcon,
      "product-feature": boltIcon,
      "give-feedback": feedbackGreyIcon,
      "custom": slidersIcon,
    };
    return map[taskId] || customIcon;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f7f5ff", fontFamily: "'Geist', 'DM Sans', 'Inter', sans-serif" }}>

      <Header saveState={saveState} saveError={saveError} activeChain={rewardNetwork} onChainChange={handleNetworkChange} walletAddress={connectedAddress} onConnectWallet={connectWallet} onDisconnectWallet={disconnectWallet} signedIn={signedIn} onSignIn={() => { window.location.href = STUDIO_SIGN_IN_URL; }} />

      {/* ══════════ STEP 1 ══════════ */}
      {currentStep === 1 && (
        <div style={{ flex: 1, padding: "0 46px 56px 36px" }}>

          {/* Heading */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 30, marginBottom: 30, width: 644, maxWidth: "100%" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "#1c2533", margin: 0, lineHeight: "18.2px" }}>
              Create a retention campaign
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#767a8c", margin: 0, lineHeight: "21.7px" }}>
              Choose whether participants can earn rewards, then pick a template or start from scratch. You can fully edit everything next.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 21 }}>
            {/* Rewards toggle */}
            <RewardsToggle enabled={rewardsEnabled} onChange={requestRewardsChange} />

            {/* Template cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
              {TEMPLATES.map(tpl => (
                <TemplateCard key={tpl.id} tpl={tpl} onUseTemplate={handleUseTemplate} />
              ))}
            </div>

            {/* OR divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 24 }}>
              <div style={{ flex: "1 0 24px", height: 0.996, background: "rgba(28,37,51,0.09)" }} />
              <p style={{ margin: 0, fontSize: 11.5, color: "#525a6e", letterSpacing: 1.035, flex: "0 1 auto", minWidth: 0, textAlign: "center" as const }}>
                <span style={{ fontWeight: 600, textTransform: "uppercase" }}>OR</span>
                <span style={{ fontWeight: 400 }}>{" Begin with an empty journey and define every checkpoint, timing rule and reward yourself. Nothing is pre-filled."}</span>
              </p>
              <div style={{ flex: "1 0 24px", height: 0.996, background: "rgba(28,37,51,0.09)" }} />
            </div>
          </div>
        </div>
      )}

      {/* ══════════ STEP 2 ══════════ */}
      {currentStep === 2 && (
        <div style={{ flex: 1, padding: "0 46px 56px 36px" }}>

          {/* Wizard progress */}
          <div style={{ marginTop: 20 }}>
            <WizardProgress currentStep={2} onStepClick={jumpToStep} minStep={templateLocked ? 2 : 1} maxStep={furthestStep} />
          </div>

          {/* Rewards toggle */}
          <div style={{ marginTop: 24 }}>
            <RewardsToggle enabled={rewardsEnabled} onChange={requestRewardsChange} />
          </div>

          {/* Page heading */}
          <div style={{ marginTop: 24, marginBottom: 24 }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "#1c2533", margin: 0, letterSpacing: -0.65, lineHeight: "40.3px" }}>
              Campaign details
            </h1>
            <p style={{ fontSize: 14, fontWeight: 400, color: "#767a8c", margin: "0", lineHeight: "21.7px" }}>
              Provide the essential information users need to understand your campaign before they participate.
            </p>
          </div>

          {/* ── BASICS CARD ── */}
          <div style={{ background: "white", border: "1px solid rgba(28,37,51,0.09)", borderRadius: 40, padding: "24px 27px 32px", marginBottom: 24 }}>
            <SectionHeader
              title="Basics"
              subtitle="How the campaign is identified"
              figmaIcon="basicsDot"
            />

            {/* Campaign name */}
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#4b4e5e", lineHeight: "20.15px" }}>Campaign name</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ background: "#f4f7ff", border: "1px solid rgba(28,37,51,0.16)", borderRadius: 40, height: 45, display: "flex", alignItems: "center", padding: "0 13.82px" }}>
                  <input
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                    placeholder="Enter a campaign name"
                    style={{ background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 400, color: "#1c2533", width: "100%", lineHeight: "21px" }}
                  />
                </div>
                <span style={{ fontSize: 12.5, color: "#767a8c", lineHeight: "18.75px" }}>Visible to all participants</span>
              </div>
            </div>

            {/* Campaign description */}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#4b4e5e", lineHeight: "20.15px" }}>Campaign description</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ background: "#f4f7ff", border: "1px solid rgba(28,37,51,0.16)", borderRadius: 26, minHeight: 121, display: "flex", padding: "21.83px 24.82px" }}>
                  <textarea
                    value={campaignDescription}
                    onChange={e => setCampaignDescription(e.target.value)}
                    placeholder="Describe what this campaign is about and what participants can expect…"
                    style={{ background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 14, fontWeight: 400, color: "#1c2533", width: "100%", lineHeight: "21px", flex: 1, fontFamily: "inherit", minHeight: 80 }}
                  />
                </div>
                <span style={{ fontSize: 12.5, color: "#767a8c", lineHeight: "18.75px" }}>Keep it clear and practical.</span>
              </div>
            </div>

            {/* Cover image */}
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="#4b4e5e" strokeWidth="1.2"/><circle cx="5.5" cy="6" r="1.25" stroke="#4b4e5e" strokeWidth="1.1"/><path d="M1.5 10.5l3.5-3 3 2.5 2.5-2 3 3" stroke="#4b4e5e" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#4b4e5e", lineHeight: "20px" }}>Cover Image</span>
              </div>
              <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg,.gif,image/svg+xml,image/png,image/jpeg,image/gif" style={{ display: "none" }} onChange={handleCoverFile} />
              <div
                role="button" tabIndex={0} aria-label="Upload cover image"
                onClick={() => fileRef.current?.click()}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
                onDragOver={e => { e.preventDefault(); setCoverDragOver(true); }}
                onDragLeave={() => setCoverDragOver(false)}
                onDrop={e => { e.preventDefault(); setCoverDragOver(false); acceptCover(e.dataTransfer.files?.[0]); }}
                style={{ background: coverDragOver ? "rgba(138,63,252,0.08)" : "#f4f7ff", border: coverDragOver ? "1.5px dashed #8b3efe" : "1.5px dashed rgba(28,37,51,0.28)", borderRadius: 40, height: 194, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", overflow: "hidden", position: "relative" }}
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="cover" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <>
                    <div style={{ width: 50, height: 50, borderRadius: 34.184, background: "linear-gradient(to bottom, #8b3efe, #532598)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 20V10M14 10L10 14M14 10L18 14" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 22h16" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#1c2533", textAlign: "center" }}>
                        <span style={{ color: "#8b3efe" }}>Click to upload </span>OR you can drag and drop
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 300, color: "rgba(28,37,51,0.5)", textAlign: "center" }}>1200 × 630px landscape. SVG, PNG, JPG or GIF, up to 5 MB</span>
                    </div>
                  </>
                )}
              </div>
              {coverError ? (
                <div role="alert" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "#e4545b", lineHeight: "18.75px", paddingLeft: 6 }}>
                  <FigmaIcon name="rowWarn" />
                  {coverError}
                </div>
              ) : (
                <span style={{ fontSize: 12.5, color: "#69728a", lineHeight: "18.75px", paddingLeft: 6 }}>
                  {coverPreview
                    ? "Click the image to replace it. Use 1200 × 630px with the main subject in the middle: campaign cards and pages crop the edges to fit."
                    : mode === "live"
                    ? "This campaign has no saved cover image yet. Add one here and it's saved with your changes, so you only do it once."
                    : "Use a wide banner image for best results: at least 1200 × 300 px, ideally 1600 × 400 px (4:1). Keep logos and text near the centre, as the edges may be cropped."}
                </span>
              )}
            </div>
          </div>

          {/* ── DURATION CARD ── */}
          <div style={{ background: "white", border: "1px solid rgba(28,37,51,0.09)", borderRadius: 40, padding: "24px 27px 32px" }}>
            <SectionHeader
              title="Duration"
              subtitle="When the campaign runs"
              icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.2"/><path d="M7 4v3l2 2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>}
            />

            {/* Start / End dates side by side */}
            <div style={{ marginTop: 24, display: "flex", gap: 24 }}>
              <DatePicker
                label="Start date"
                value={startDate}
                onChange={setStartDate}
                hint={(() => {
                  if (!startDate) return "Select when your campaign will start.";
                  const today = new Date(); today.setHours(0,0,0,0);
                  const d = new Date(startDate); d.setHours(0,0,0,0);
                  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
                  if (diff < 0) return "This date is in the past.";
                  if (diff === 0) return "Your campaign begins today.";
                  if (diff === 1) return "Your campaign begins tomorrow.";
                  return `Your campaign begins in ${diff} days.`;
                })()}
              />
              <DatePicker
                label="End date"
                value={endDate}
                onChange={setEndDate}
                hint={(() => {
                  if (!endDate) return "Select when your campaign will end.";
                  if (startDate) {
                    const s = new Date(startDate); s.setHours(0,0,0,0);
                    const e = new Date(endDate); e.setHours(0,0,0,0);
                    const dur = Math.round((e.getTime() - s.getTime()) / 86400000);
                    if (dur <= 0) return "End date must be after start date.";
                    return `Campaign runs for ${dur} day${dur !== 1 ? "s" : ""}.`;
                  }
                  const today = new Date(); today.setHours(0,0,0,0);
                  const e = new Date(endDate); e.setHours(0,0,0,0);
                  const diff = Math.round((e.getTime() - today.getTime()) / 86400000);
                  if (diff < 0) return "This date is in the past.";
                  if (diff === 0) return "Campaign ends today.";
                  return `Campaign ends in ${diff} days.`;
                })()}
              />
            </div>

            {/* Campaign duration display */}
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#3d485c", lineHeight: "20.15px" }}>Campaign duration</span>
              </div>
              <div style={{ background: "#f4f1fc", border: "1.25px solid rgba(28,37,51,0.09)", borderRadius: 40, height: 56, display: "flex", alignItems: "center", padding: "0 24px" }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "#1c2533", lineHeight: "26.35px" }}>{duration.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 400, color: "#69728a", lineHeight: "18.6px" }}>{duration.detail}</div>
                </div>
              </div>
              <span style={{ fontSize: 12.5, color: "#69728a", lineHeight: "18.75px" }}>Worked out automatically from the start and end dates you picked.</span>
            </div>

            {/* Info banner */}
            <div style={{ marginTop: 24, background: "rgba(138,63,252,0.1)", border: "1.25px solid rgba(138,63,252,0.24)", borderRadius: 40, height: 51, display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="9" cy="9" r="7.5" stroke="#6e2bd8" strokeWidth="1.3"/>
                <path d="M9 8v5" stroke="#6e2bd8" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="9" cy="5.5" r="0.8" fill="#6e2bd8"/>
              </svg>
              <p style={{ margin: 0, fontSize: 13, lineHeight: "20.15px", color: "#4b4e5e", fontWeight: 400 }}>
                {"The start and end dates define when participants can join and complete campaign tasks."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ STEP 3 ══════════ */}
      {currentStep === 3 && (
        <div style={stages.length === 0
          ? { flex: 1, padding: "0 46px 24px 36px", minHeight: "calc(100vh - 53px)", boxSizing: "border-box" as const, display: "flex", flexDirection: "column" }
          : { flex: 1, padding: "0 46px 56px 36px" }}>

          {/* Wizard progress */}
          <div style={{ marginTop: 20 }}>
            <WizardProgress currentStep={3} onStepClick={jumpToStep} minStep={templateLocked ? 2 : 1} maxStep={furthestStep} />
          </div>

          {/* Rewards toggle */}
          <div style={{ marginTop: 24 }}>
            <RewardsToggle enabled={rewardsEnabled} onChange={requestRewardsChange} />
          </div>

          {/* Heading row */}
          <div style={{ marginTop: 30, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" as const }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 26, fontWeight: 600, color: "#1c2533", margin: 0, letterSpacing: -0.65, lineHeight: "36px" }}>
                Build the retention{" "}
                <em style={{ color: "#8a3ffc", fontStyle: "italic", fontFamily: "'Times New Roman', Georgia, serif", fontWeight: 400 }}>journey</em>
              </h1>
              <p style={{ fontSize: 14, fontWeight: 400, color: "#767a8c", margin: "8px 0 0 0", lineHeight: "21.7px" }}>
                Choose when participants return and what they do at each stage.<br />
                Everything is set up right here on this page.
              </p>
            </div>
          </div>

          {/* ── JOURNEY SUMMARY CARD (hidden until the first stage exists) ── */}
          {stages.length > 0 && (() => {
            const totalTasks = stages.reduce((n, s) => n + s.tasks.length, 0);
            const emptyStageIdx = stages.findIndex(s => s.tasks.length === 0);
            const ready = stages.length > 0 && emptyStageIdx === -1;
            const durationLabel = duration.label === "—" ? "—" : duration.label.toLowerCase();
            const cells = [
              { label: "Stages", val: `${stages.length} of ${MAX_STAGES}`, color: "#1c2533" },
              { label: "Total tasks", val: String(totalTasks), color: "#1c2533" },
              { label: "Journey duration", val: durationLabel, color: "#1c2533" },
              { label: "Status", val: ready ? "Ready" : stages.length === 0 ? "Not ready" : "In progress", color: ready ? "#00a87c" : "#c27c00" },
            ];
            return (
              <div style={{ background: "white", border: "1.25px solid rgba(28,37,51,0.09)", borderRadius: 40, padding: "20px 18px 17px", marginBottom: 30 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 6 }}>
                  <FigmaIcon name="bolt" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1c2533", letterSpacing: -0.28, lineHeight: "16.1px" }}>Journey summary</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", columnGap: 24, marginBottom: 9 }}>
                  {cells.map(c => (
                    <div key={c.label} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 0" }}>
                      <span style={{ fontSize: 13, color: "#69728a", lineHeight: "20.15px" }}>{c.label}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: c.color, lineHeight: "19.375px", fontFamily: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}>{c.val}</span>
                    </div>
                  ))}
                </div>
                {ready ? (
                  <div style={{ background: "rgba(0,225,162,0.06)", border: "1.25px solid rgba(0,168,124,0.28)", borderRadius: 40, padding: 12, display: "flex", alignItems: "flex-start", gap: 9 }}>
                    <FigmaIcon name="readyCheck" style={{ marginTop: 1 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#00a87c", lineHeight: "19.375px" }}>This journey is ready.</span>
                  </div>
                ) : (
                  <div style={{ background: "rgba(245,177,61,0.1)", border: "1.25px solid rgba(245,177,61,0.28)", borderRadius: 40, padding: 12, display: "flex", alignItems: "flex-start", gap: 9 }}>
                    <svg width="16" height="16" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M7.5 1.5L13.5 12H1.5L7.5 1.5Z" stroke="#c27c00" strokeWidth="1.3" strokeLinejoin="round"/><path d="M7.5 6v3" stroke="#c27c00" strokeWidth="1.3" strokeLinecap="round"/><circle cx="7.5" cy="10.5" r=".7" fill="#c27c00"/></svg>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#c27c00", lineHeight: "19.375px" }}>
                      {stages.length === 0 ? "The journey has no stages yet." : `Stage ${emptyStageIdx + 1} has no tasks yet. Add at least one task to every stage.`}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── EMPTY STATE (Figma 9053:43180) ── */}
          {stages.length === 0 && (
            <div style={{ background: "white", border: "1px dashed #a855f7", borderRadius: 40, minHeight: 222, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 24px 28px", marginTop: 14, boxSizing: "border-box" as const }}>
              <div style={{ width: 86, height: 86, borderRadius: "50%", background: "linear-gradient(to bottom, #8b3efe, #532598)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <img src={UPLOAD_ICON_SRC} alt="" width={52.65} height={52.65} style={{ display: "block" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 12 }}>
                <span style={{ fontSize: 15.9, fontWeight: 600, color: "#1c2533", lineHeight: "24px" }}>{chosenTemplate ? `Build your ${chosenTemplate.name} journey` : "Build your retention journey"}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#767a8c", textAlign: "center", maxWidth: 508, lineHeight: "20px" }}>
                  {chosenTemplate
                    ? `${chosenTemplate.name} has ${chosenTemplate.stageCount} stages. Choose daily or weekly tasks and the stages are set up for you, or add your own.`
                    : "Create stages that bring participants back over time and guide them toward the campaign outcome."}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 25, flexWrap: "wrap" as const, justifyContent: "center" }}>
                <button
                  onMouseEnter={() => setAddStageHovered(true)}
                  onMouseLeave={() => setAddStageHovered(false)}
                  onClick={handleAddFirstStage}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "14px 22px", boxSizing: "border-box" as const,
                    background: addStageHovered ? "#7a28e8" : "#8b3efe",
                    color: "white", border: "none", borderRadius: 52, cursor: "pointer",
                    fontSize: 15, fontWeight: 600, fontFamily: "inherit", transition: "background 0.15s",
                  }}
                >
                  <FigmaIcon name="plusWhite" />
                  Add first stage
                </button>
                <button
                  onMouseEnter={() => setUseJourneyTplHovered(true)}
                  onMouseLeave={() => setUseJourneyTplHovered(false)}
                  onClick={handleUseJourneyTemplate}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "14px 22px", boxSizing: "border-box" as const,
                    background: useJourneyTplHovered ? "rgba(21,19,34,0.05)" : "white",
                    color: "#1c2533", border: "1px solid rgba(21,19,34,0.13)", borderRadius: 52, cursor: "pointer",
                    fontSize: 15, fontWeight: 600, fontFamily: "inherit", transition: "background 0.15s",
                  }}
                >
                  <FigmaIcon name="stackTpl" />
                  {chosenTemplate ? `Set up ${chosenTemplate.name} stages` : "Use a journey template"}
                </button>
              </div>
            </div>
          )}

          {stages.length === 0 && (
            <div style={{ marginTop: "auto", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => goToStep(2)}
                style={{ width: 78, height: 34, borderRadius: 40, background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#1c2533", fontFamily: "inherit" }}
              >
                <FigmaIcon name="arrowLeft" />
                Back
              </button>
              <button
                disabled
                title="Add a stage to continue"
                style={{ height: 34, borderRadius: 40, padding: "0 16px", background: "#c4a6fe", border: "1px solid transparent", cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "white", fontFamily: "inherit" }}
              >
                {rewardsEnabled ? "Continue to rewards and funding" : "Continue to review"}
                <FigmaIcon name="arrowRightWhite" />
              </button>
            </div>
          )}

          {/* ── POPULATED JOURNEY ── */}
          {stages.length > 0 && (() => {
            const totalTasks = stages.reduce((n, s) => n + s.tasks.length, 0);
            const journeyReady = stages.length > 0 && stages.every(s => s.tasks.length > 0);
            const timelineLine: React.CSSProperties = { width: 2, background: "linear-gradient(to bottom, rgba(155,124,255,0.28), #5b3fd6)", marginLeft: 27 };
            const iconBtn34: React.CSSProperties = { width: 34, height: 34, borderRadius: 35.79, background: "#f4f1fc", border: "0.895px solid rgba(28,37,51,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0, boxSizing: "border-box" as const };
            const stageIconBtn = (r: number): React.CSSProperties => ({ width: 37.99, height: 37.99, borderRadius: r, background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.09)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0, boxSizing: "border-box" as const, transition: "background 0.15s" });
            void totalTasks;
            return (
            <div style={{ display: "flex", flexDirection: "column" }}>

              {/* Campaign start marker */}
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ width: 51, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", paddingTop: 16 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 7, background: "#8a3ffc", boxShadow: "0 0 0 4px rgba(138,63,252,0.1)", marginLeft: 22 }} />
                  <div style={{ ...timelineLine, height: 60, marginLeft: 28 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1.25, paddingTop: 1.9 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1c2533", lineHeight: "20.93px" }}>Campaign start</span>
                  <span style={{ fontSize: 12.5, color: "#69728a", lineHeight: "19.38px" }}>Participants join and the journey begins</span>
                </div>
              </div>

              {stages.map((stage, idx) => {
                const isActive = activeStageId === stage.id;
                const isFirst = idx === 0;
                const retentionLabel = fmtRetention(stage.returnDays);
                const chipLabel = isFirst
                  ? (stage.returnDays === 0 ? "Immediately the campaign starts" : `${retentionLabel} after joining`)
                  : (stage.returnDays === 0 ? "Immediately after previous stage" : `${retentionLabel} after previous stage`);
                const retentionSub = isFirst
                  ? (stage.returnDays === 0 ? "Participants can start immediately after joining." : `Participants can start ${retentionLabel} after joining.`)
                  : (stage.returnDays === 0 ? "Participants can start immediately after the previous stage." : `Participants can start ${retentionLabel} after previous stage.`);
                const presetValue = RETENTION_PRESETS.includes(stage.returnDays) ? String(stage.returnDays) : "custom";
                return (
                  <React.Fragment key={stage.id}>
                    {/* connector between cards */}
                    {idx > 0 && <div style={{ ...timelineLine, height: 54, marginLeft: 28 }} />}

                    {isActive ? (
                      /* ── EXPANDED STAGE CARD ── */
                      <div style={{ background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.2)", borderRadius: 40, marginTop: idx === 0 ? -5 : 0 }}>
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "16px 18px 2px" }}>
                          <div style={{ width: 5.99, flexShrink: 0 }} />
                          <div style={{ paddingTop: 1, flexShrink: 0 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 40, background: "#efeafb", border: "1px solid rgba(138,63,252,0.32)", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" as const }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#3d485c", lineHeight: "20.93px" }}>{idx + 1}</span>
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8a3ffc", letterSpacing: "0.945px", textTransform: "uppercase" as const, lineHeight: "16.27px", marginBottom: 5 }}>Stage {idx + 1}</div>
                            <div style={{ background: "#f4f1fc", border: "1px solid rgba(28,37,51,0.15)", borderRadius: 40, display: "flex", alignItems: "center", gap: 8, padding: "10.83px 11px 10.83px 13.83px", maxWidth: 340, boxSizing: "border-box" as const }}>
                              <input
                                id={`stage-name-${stage.id}`}
                                autoFocus={stage.name === ""}
                                value={stage.name}
                                onChange={e => handleUpdateStageName(stage.id, e.target.value)}
                                placeholder="Name this stage"
                                style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontSize: 15, fontWeight: 600, color: "#1c2533", fontFamily: "inherit", lineHeight: "22.5px", padding: 0 }}
                              />
                              <button
                                title="Rename stage"
                                onClick={() => (document.getElementById(`stage-name-${stage.id}`) as HTMLInputElement | null)?.focus()}
                                style={{ width: 24, height: 24, borderRadius: 28, border: "1px solid rgba(28,37,51,0.3)", background: "#f4f1fc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, boxSizing: "border-box" as const }}
                              >
                                <FigmaIcon name="rename" />
                              </button>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button title="Duplicate stage" disabled={stages.length >= MAX_STAGES} onClick={() => handleDuplicateStage(stage.id)}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(138,63,252,0.1)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "#f7f4fe"; }}
                              style={{ ...stageIconBtn(12), opacity: stages.length >= MAX_STAGES ? 0.4 : 1 }}>
                              <FigmaIcon name="stageDup" />
                            </button>
                            <button title="Delete stage" onClick={() => handleDeleteStage(stage.id)}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "#f7f4fe"; }}
                              style={stageIconBtn(12)}>
                              <FigmaIcon name="stageDel" />
                            </button>
                          </div>
                        </div>

                        {/* Body */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 15.8, padding: "15px 18px 27px" }}>

                          {/* Retention period card */}
                          <div style={{ background: "linear-gradient(to bottom, #f7f4fe, white)", border: "1px solid rgba(138,63,252,0.32)", borderRadius: 40, padding: "14.83px 37px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" as const }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8a3ffc", letterSpacing: "0.945px", textTransform: "uppercase" as const, lineHeight: "16.27px", marginBottom: 2 }}>Retention period</div>
                                <div style={{ fontSize: 26, fontWeight: 600, color: "#1c2533", letterSpacing: -0.52, lineHeight: "40.3px" }}>{titleCase(retentionLabel)}</div>
                                <div style={{ fontSize: 12.8, color: "#69728a", lineHeight: "19.84px" }}>{retentionSub}</div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", width: 285, maxWidth: "100%" }}>
                                {customisingStageId === stage.id ? (
                                  <div style={{ width: "100%", background: "#f4f1fc", border: "1px solid rgba(138,63,252,0.45)", borderRadius: 52, display: "flex", alignItems: "center", padding: "0 14px 0 13.83px", height: 38, boxSizing: "border-box" as const }}>
                                    <input
                                      type="number" min={0} max={365} autoFocus
                                      value={stage.returnDays}
                                      onChange={e => handleSetRetention(stage.id, Number(e.target.value))}
                                      style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#1c2533", fontFamily: "inherit" }}
                                    />
                                    <span style={{ fontSize: 13, color: "#69728a" }}>{isFirst ? "days after joining" : "days after previous stage"}</span>
                                  </div>
                                ) : (
                                  <div style={{ position: "relative" as const, width: "100%" }}>
                                    <select
                                      value={presetValue}
                                      onChange={e => { if (e.target.value === "custom") setCustomisingStageId(stage.id); else handleSetRetention(stage.id, Number(e.target.value)); }}
                                      style={{ width: "100%", appearance: "none" as const, WebkitAppearance: "none" as const, background: "#f4f1fc", border: "1px solid rgba(28,37,51,0.15)", borderRadius: 52, padding: "8.83px 38.83px 8.83px 13.83px", fontSize: 13, color: "#1c2533", fontFamily: "inherit", lineHeight: "19.5px", cursor: "pointer", outline: "none", boxSizing: "border-box" as const }}
                                    >
                                      {RETENTION_PRESETS.map(d => (
                                        <option key={d} value={d}>{d === 0 ? (isFirst ? "Immediately after joining" : "Immediately after previous stage") : fmtRetention(d)}</option>
                                      ))}
                                      {presetValue === "custom" && <option value="custom">{fmtRetention(stage.returnDays)}</option>}
                                    </select>
                                    <FigmaIcon name="chevron" style={{ position: "absolute" as const, right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" as const }} />
                                  </div>
                                )}
                                <button
                                  onClick={() => setCustomisingStageId(customisingStageId === stage.id ? null : stage.id)}
                                  onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(to bottom, #9d4fff, #7a28e8)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "#8b3efe"; }}
                                  style={{ background: "#8b3efe", border: "1px solid rgba(28,37,51,0.15)", borderRadius: 40, minHeight: 34, padding: "8.24px 12.83px 8.26px", color: "white", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", gap: 7.99, alignItems: "center", boxSizing: "border-box" as const }}
                                >
                                  <FigmaIcon name="pencilWhite" />
                                  {customisingStageId === stage.id ? "Use a preset" : "Customise"}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Tasks card */}
                          <div style={{ background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.09)", borderRadius: 40, padding: "20px 23px 22px 20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 8px 4px" }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1c2533", lineHeight: "20.93px" }}>Tasks</span>
                              <span style={{ fontSize: 12.6, fontWeight: 500, color: "#3d485c", lineHeight: "19.53px" }}>{stage.tasks.length} of {MAX_TASKS_PER_STAGE}</span>
                            </div>

                            {stage.tasks.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8.2 }}>
                                {stage.tasks.map((task, tIdx) => (
                                  <div key={task.id} style={{ background: "#fdfcff", border: "1px solid rgba(28,37,51,0.15)", borderRadius: 40, minHeight: 67, padding: "10px 17px 10px 22px", display: "flex", alignItems: "center", gap: 16, boxSizing: "border-box" as const }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 20, flex: 1, minWidth: 0 }}>
                                      <div style={{ width: 26, height: 26, borderRadius: 34.67, background: "#9b7cff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <span style={{ fontSize: 11.7, fontWeight: 600, color: "white", lineHeight: "18.14px" }}>{tIdx + 1}</span>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                        <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                          {getTaskRowIcon(task.taskTypeId)}
                                        </div>
                                        <span style={{ fontSize: 15, fontWeight: 600, color: "#1c2533", letterSpacing: -0.15, lineHeight: "17.25px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{task.description || task.name}</span>
                                      </div>
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(28,37,51,0.5)", whiteSpace: "nowrap" as const, flexShrink: 0 }}>{task.category}</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 5.37, flexShrink: 0 }}>
                                      <button
                                        onClick={() => handleEditTask(stage.id, task)}
                                        onMouseEnter={e => { e.currentTarget.style.background = "#7a28e8"; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = "#8b3efe"; }}
                                        style={{ background: "#8b3efe", border: "0.895px solid rgba(255,255,255,0.13)", borderRadius: 35.79, minHeight: 30.42, padding: "6.56px 10.44px", fontSize: 12, fontWeight: 600, color: "#f4f3f9", fontFamily: "inherit", cursor: "pointer", boxSizing: "border-box" as const }}
                                      >Edit</button>
                                      <button title="Duplicate task" disabled={stage.tasks.length >= MAX_TASKS_PER_STAGE} onClick={() => handleDuplicateTask(stage.id, task.id)} style={{ ...iconBtn34, opacity: stage.tasks.length >= MAX_TASKS_PER_STAGE ? 0.4 : 1 }}>
                                        <FigmaIcon name="taskDup" />
                                      </button>
                                      <button title="Delete task" onClick={() => handleRemoveTask(stage.id, task.id)} style={iconBtn34}>
                                        <FigmaIcon name="taskDel" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 4px", gap: 10 }}>
                                <div style={{ textAlign: "center" as const, color: "#98a0b4", fontSize: 13, lineHeight: "18px", maxWidth: 280 }}>
                                  No task yet. Add at least one for participants to complete.
                                </div>
                              </div>
                            )}

                            {stage.tasks.length < MAX_TASKS_PER_STAGE && (
                              <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
                                <button
                                  onClick={() => handleOpenTaskModal(stage.id)}
                                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(138,63,252,0.08)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "#f7f4fe"; }}
                                  style={{ width: "53.5%", minWidth: 220, minHeight: 40, borderRadius: 82, background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.2)", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#1c2533", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7.99, padding: "10.83px 16.83px", boxSizing: "border-box" as const, transition: "background 0.15s" }}
                                >
                                  <FigmaIcon name="plusDark" />
                                  Add Task
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Done */}
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              onClick={handleDoneStage}
                              onMouseEnter={e => { e.currentTarget.style.background = "#7a28e8"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "#8b3efe"; }}
                              style={{ background: "#8b3efe", border: "1px solid transparent", borderRadius: 40, minHeight: 34, padding: "7.24px 11.83px 7.26px", color: "white", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", boxShadow: "0 8px 22px -10px rgba(124,92,252,0.65)", boxSizing: "border-box" as const }}
                            >
                              <FigmaIcon name="checkWhite" />
                              Done
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ── SAVED (COLLAPSED) STAGE CARD ── */
                      <div style={{ background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.25)", borderRadius: 40, padding: 10, marginTop: idx === 0 ? -5 : 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, padding: "16px 18px" }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8a3ffc", letterSpacing: "0.945px", textTransform: "uppercase" as const, lineHeight: "16.27px" }}>Stage {idx + 1}</div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: "#1c2533", letterSpacing: -0.15, lineHeight: "17.25px", marginTop: 2.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{stage.name || `Stage ${idx + 1}`}</div>
                            <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: "4px 8px", marginTop: 5 }}>
                              <button
                                title="Change retention"
                                onClick={() => setActiveStageId(stage.id)}
                                style={{ background: "rgba(138,63,252,0.1)", border: "none", borderRadius: 999, padding: "3px 10px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "inherit" }}
                              >
                                <FigmaIcon name="clock" />
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: "#6e2bd8" }}>Retention:</span>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#6e2bd8" }}>{chipLabel}</span>
                              </button>
                              <span style={{ fontSize: 12.6, color: "#98a0b4", lineHeight: "19.53px" }}>·</span>
                              <span style={{ fontSize: 12.6, color: "#3d485c", lineHeight: "19.53px" }}>{stage.tasks.length} Task{stage.tasks.length !== 1 ? "s" : ""}</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2.1, marginTop: 8 }}>
                              {stage.tasks.length === 0 && (
                                <div style={{ fontSize: 13, color: "#c27c00", lineHeight: "20.15px" }}>No tasks yet</div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button title="Duplicate stage" disabled={stages.length >= MAX_STAGES} onClick={() => handleDuplicateStage(stage.id)}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(138,63,252,0.1)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "#f7f4fe"; }}
                              style={{ ...stageIconBtn(22), opacity: stages.length >= MAX_STAGES ? 0.4 : 1 }}>
                              <FigmaIcon name="stageDup" />
                            </button>
                            <button title="Delete stage" onClick={() => handleDeleteStage(stage.id)}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "#f7f4fe"; }}
                              style={stageIconBtn(22)}>
                              <FigmaIcon name="stageDel" />
                            </button>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 7.99, padding: "0 18px 16px 20px" }}>
                          {stage.tasks.length < MAX_TASKS_PER_STAGE && (
                            <button
                              onClick={() => handleOpenTaskModal(stage.id)}
                              onMouseEnter={e => { e.currentTarget.style.background = "#7a28e8"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "#8b3efe"; }}
                              style={{ background: "#8b3efe", border: "1px solid rgba(28,37,51,0.15)", borderRadius: 28, minHeight: 34, padding: "7.24px 11.83px 7.26px", color: "white", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", boxSizing: "border-box" as const }}
                            >
                              <FigmaIcon name="plusWhite" />
                              Add Task
                            </button>
                          )}
                          <button
                            onClick={() => setActiveStageId(stage.id)}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(28,37,51,0.05)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                            style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.3)", borderRadius: 40, minHeight: 34, padding: "7.24px 11.83px 7.26px", color: "#3d485c", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", gap: 7.99, alignItems: "center", boxSizing: "border-box" as const }}
                          >
                            <FigmaIcon name="pencilDark" />
                            Edit Stage
                          </button>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Add Next Stage */}
              {stages.length < MAX_STAGES && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 22 }}>
                  <button
                    onMouseEnter={() => setAddNextStageHovered(true)}
                    onMouseLeave={() => setAddNextStageHovered(false)}
                    onClick={handleAddNextStage}
                    style={{ width: "41%", minWidth: 220, height: 38, borderRadius: 40, background: addNextStageHovered ? "linear-gradient(to bottom, #9d4fff, #6022cc)" : "linear-gradient(to bottom, #8a3ffc, #6e2bd8)", color: "white", border: "1px solid transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s" }}
                  >
                    <FigmaIcon name="plusWhite" />
                    Add Next Stage
                  </button>
                </div>
              )}

              {/* Back / Continue */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginTop: 30, flexWrap: "wrap" as const }}>
                <button
                  onMouseEnter={() => setBackStep3Hovered(true)}
                  onMouseLeave={() => setBackStep3Hovered(false)}
                  onClick={() => setCurrentStep(2)}
                  style={{ width: 78, height: 34, borderRadius: 40, background: backStep3Hovered ? "rgba(138,63,252,0.1)" : "#f7f4fe", border: "1px solid rgba(28,37,51,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#1c2533", fontFamily: "inherit", transition: "background 0.15s" }}
                >
                  <FigmaIcon name="arrowLeft" />
                  Back
                </button>
                <button
                  disabled={!journeyReady}
                  onMouseEnter={() => setContinueStep3Hovered(true)}
                  onMouseLeave={() => setContinueStep3Hovered(false)}
                  onClick={() => { if (!journeyReady) return; setActiveStageId(null); setCurrentStep(rewardsEnabled ? 4 : 5); scrollToTop(); }}
                  style={{ height: 34, borderRadius: 40, padding: "0 16px", background: !journeyReady ? "#c4a6fe" : continueStep3Hovered ? "#7a28e8" : "#8b3efe", border: "1px solid transparent", cursor: journeyReady ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "white", fontFamily: "inherit", transition: "background 0.15s" }}
                >
                  {rewardsEnabled ? "Continue to rewards and funding" : "Continue to review"}
                  <FigmaIcon name="arrowRightWhite" />
                </button>
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {/* ══════════ STEP 4 · REWARDS & FUNDING ══════════ */}
      {currentStep === 4 && (() => {
        const sectionCard: React.CSSProperties = { background: "white", border: "1.25px solid rgba(28,37,51,0.09)", borderRadius: 40, padding: 22, boxSizing: "border-box" as const };
        const sectionHead = (n: number, title: string, sub: string) => (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 40, background: "rgba(138,63,252,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#8a3ffc", lineHeight: "20.15px" }}>{n}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1c2533", letterSpacing: -0.32, lineHeight: "18.4px" }}>{title}</div>
              <div style={{ fontSize: 12.5, color: "#69728a", lineHeight: "19.375px" }}>{sub}</div>
            </div>
          </div>
        );
        const label = (t: string) => <div style={{ fontSize: 13, fontWeight: 600, color: "#3d485c", lineHeight: "20.15px" }}>{t}</div>;
        const help = (t: string) => <div style={{ fontSize: 12.5, color: "#69728a", lineHeight: "18.75px" }}>{t}</div>;
        const pillInput: React.CSSProperties = { width: "100%", height: 46, background: "#f4f1fc", border: "1.25px solid rgba(28,37,51,0.15)", borderRadius: 40, padding: "0 110px 0 36px", fontSize: 14, color: "#1c2533", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
        const suffix: React.CSSProperties = { position: "absolute" as const, right: 18, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: "#69728a", pointerEvents: "none" as const, display: "flex", alignItems: "center", gap: 8 };
        const cell: React.CSSProperties = { padding: 12, borderBottom: "1.25px solid rgba(28,37,51,0.09)", fontSize: 13.5, lineHeight: "20.925px" };
        const mono = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
        const allocOk = Math.abs(totalAllocated - 100) < 0.05;
        const remaining = round1(100 - totalAllocated);
        return (
          <div style={{ flex: 1, padding: "0 46px 56px 36px" }}>
            {/* Back link */}
            <button onClick={() => goToStep(3)} style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 8, height: 34, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1c2533", fontFamily: "inherit" }}>
              <FigmaIcon name="arrowLeft" />
              Back to journey
            </button>

            <div style={{ marginTop: 20 }}>
              <WizardProgress currentStep={4} onStepClick={jumpToStep} minStep={templateLocked ? 2 : 1} maxStep={furthestStep} />
            </div>

            {/* Heading */}
            <div style={{ marginTop: 20, maxWidth: 754 }}>
              <h1 style={{ fontSize: 26, fontWeight: 600, color: "#1c2533", margin: 0, letterSpacing: -0.65, lineHeight: "40.3px" }}>Reward pool &amp; eligibility</h1>
              <p style={{ fontSize: 14, color: "#767a8c", margin: 0, lineHeight: "21.7px", maxWidth: 442 }}>Split your reward pool across the retention periods you created in the journey.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 31 }}>

              {/* 1 · Budget & allocation */}
              <div style={sectionCard}>
                {sectionHead(1, "Campaign Reward Budget & Allocation", "Set the budget. Fees come out first, and what is left is the pool for rewarding participants")}
                <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 18 }}>
                  {label("Campaign Reward Budget")}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, alignItems: "stretch" }}>
                    {/* Amount + token */}
                    <div ref={tokenMenuRef} style={{ position: "relative" as const, flex: "1 1 100%", minWidth: 0 }}>
                      <input inputMode="decimal" aria-label="Campaign reward budget" readOnly={isPaid} value={fmtInputNumber(rewardBudget)} onChange={e => { if (isPaid) return; const raw = e.target.value.replace(/[^0-9.]/g, ""); const [i, ...d] = raw.split("."); setRewardBudget(d.length ? `${i}.${d.join("")}` : i); }}  style={{ ...pillInput, paddingLeft: 22, paddingRight: 140 }} />
                      <button aria-haspopup="listbox" aria-expanded={tokenMenuOpen} aria-label="Payment token"
                        disabled={isPaid}
                        onClick={() => setTokenMenuOpen(o => !o)}
                        style={{ position: "absolute" as const, right: 5, top: 5, height: 36, display: "flex", alignItems: "center", gap: 7, padding: "0 10px 0 5px", background: "white", border: tokenMenuOpen ? "1px solid #8b3efe" : "1px solid rgba(28,37,51,0.12)", borderRadius: 40, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(28,37,51,0.06)" }}>
                        <ChainLogo logo={TOKEN_LOGO[rewardToken]} size={26} />
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1c2533" }}>{rewardToken}</span>
                        <FigmaIcon name="chevron" />
                      </button>
                      {tokenMenuOpen && (
                        <>
                          <div role="listbox" aria-label="Token" className="modal-scroll" style={{ ...POPOVER, right: 0, width: 280, maxHeight: 360, overflowY: "auto" as const }}>
                            {NETWORKS.map(net => (
                              <div key={net.id} role="group" aria-label={net.name}>
                                <div style={{ ...POPOVER_TITLE, display: "flex", alignItems: "center", gap: 6 }}><ChainLogo logo={net.logo} size={12} />{net.name}</div>
                                {net.tokens.map(t => (
                                  <MenuRow key={`${net.id}-${t}`} selected={rewardNetwork === net.id && rewardToken === t} onClick={() => { handleNetworkChange(net.id, t); setTokenMenuOpen(false); }} logo={TOKEN_LOGO[t]} title={t} sub={`${TOKEN_NAMES[t]} · ${net.name}`} />
                                ))}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {help(isPaid
                    ? `Paid in ${rewardToken} on ${activeNetworkInfo.name}. The budget, token and network are locked now that the payment is confirmed.`
                    : `Gross budget, paid in ${rewardToken} on ${activeNetworkInfo.name}. Picking a token here also sets the network your wallet pays on. The Nexura Service Fee is included in the reward budget.`)}
                  {!isStableToken && (priceKnown
                    ? (budgetNum > 0 ? help(`≈ ${fmtUSD(budgetUsd)} at the current ${rewardToken} price ($${(tokenPriceUsd as number).toLocaleString("en-US", { maximumFractionDigits: 4 })}).`) : null)
                    : <div style={{ fontSize: 12.5, color: "#c27c00", lineHeight: "18.75px" }}>The live {rewardToken} price isn&apos;t available yet, so USD values and the ${MIN_PER_STAGE_USD} minimum can&apos;t be checked. Pick USDC or USDT, or try again shortly.</div>)}
                </div>


                {/* Allocation table */}
                <div style={{ paddingTop: 16, overflowX: "auto" as const }}>
                  <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" as const }}>
                    <thead>
                      <tr>
                        <th style={{ ...cell, height: 39, textAlign: "left" as const, fontSize: 12, fontWeight: 600, color: "#69728a", letterSpacing: 0.36, textTransform: "uppercase" as const, lineHeight: "18.6px" }}>Allocation Breakdown</th>
                        <th style={{ ...cell, textAlign: "center" as const, fontSize: 12, fontWeight: 600, color: "#1c2533", letterSpacing: 0.36, fontFamily: mono, lineHeight: "18.6px", width: 80 }}>%</th>
                        <th style={{ ...cell, textAlign: "right" as const, fontSize: 12, fontWeight: 600, color: "#1c2533", letterSpacing: 0.36, textTransform: "uppercase" as const, fontFamily: mono, lineHeight: "18.6px", width: 240 }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocationRows.map((r, i) => {
                        const last = i === allocationRows.length - 1;
                        return (
                          <tr key={r.label}>
                            <td style={{ ...cell, color: "#3d485c", borderBottom: last ? "none" : cell.borderBottom }}>{r.label}</td>
                            <td style={{ ...cell, color: "#1c2533", textAlign: "center" as const, fontFamily: mono, borderBottom: last ? "none" : cell.borderBottom }}>{r.pct === null ? "Off" : `${r.pct}%`}</td>
                            <td style={{ ...cell, color: "#1c2533", textAlign: "right" as const, fontFamily: mono, borderBottom: last ? "none" : cell.borderBottom }}>{fmtToken(r.pct === null ? 0 : budgetNum * r.pct / 100)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div style={{ marginTop: 14, background: "#f4f1fc", border: "1.25px solid rgba(28,37,51,0.09)", borderRadius: 40, overflow: "hidden" }}>
                  {[
                    { k: "Campaign Reward Budget", v: fmtToken(budgetNum) },
                    { k: "Campaign Opening Fee (flat, non-refundable)", v: isStableToken ? fmtUSD(OPENING_FEE_USD) : openingFeeTokens !== null ? `${fmtToken(openingFeeTokens)} ($${OPENING_FEE_USD})` : `$${OPENING_FEE_USD}` },
                  ].map(r => (
                    <div key={r.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 29px 13px 18px", borderBottom: "1.25px solid rgba(28,37,51,0.09)" }}>
                      <span style={{ fontSize: 13.5, color: "#69728a", lineHeight: "20.925px" }}>{r.k}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: "#1c2533", fontFamily: mono, lineHeight: "20.925px" }}>{r.v}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 29px 13px 18px", background: "rgba(138,63,252,0.1)" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1c2533", lineHeight: "20.925px" }}>Total Payment Due</span>
                    <span style={{ fontSize: 17, fontWeight: 600, color: "#8a3ffc", fontFamily: mono, lineHeight: "26.35px" }}>{totalPaymentDue !== null ? fmtToken(totalPaymentDue) : "—"}</span>
                  </div>
                </div>
              </div>

              {/* 2 · Reward configuration */}
              <div style={sectionCard}>
                {sectionHead(2, "Reward Configuration", "Recipients are limited by the pool left after fees")}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, paddingTop: 18 }}>
                  {[
                    { k: "Max reward per participant", v: fmtUSD(round1(maxPerRecipient)) },
                  ].map(c => (
                    <div key={c.k}>
                      <div style={{ fontSize: 11, color: "#98a0b4", lineHeight: "17.05px" }}>{c.k}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#3d485c", lineHeight: "20.925px", paddingTop: 3 }}>{c.v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 24 }}>
                  {label("Reward Recipients")}
                  <div style={{ position: "relative" as const }}>
                    <input inputMode="numeric" aria-label="Reward recipients" value={fmtInputNumber(rewardRecipients)} onChange={e => setRewardRecipients(e.target.value.replace(/[^0-9]/g, ""))} style={pillInput} />
                    <span style={suffix}>participants</span>
                  </div>
                  {help(`How many qualifying participants the pool rewards. More people can still join without a reward. Each recipient needs at least $${MIN_PER_STAGE_USD} per rewarded stage.`)}

                  <div style={{ paddingTop: 14 }}>
                    {budgetNum <= 0 ? (
                      <div style={{ background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.12)", borderRadius: 40, padding: "13.16px 15.83px 11.98px", display: "flex", gap: 8, alignItems: "center" }}>
                        <FigmaIcon name="modalInfo" />
                        <span style={{ fontSize: 13, color: "#3d485c", lineHeight: "20.15px" }}>Enter a campaign reward budget to see how many recipients it can serve.</span>
                      </div>
                    ) : recipientsOverCapacity && recipientsNum > 0 ? (
                      <div style={{ background: "rgba(0,168,124,0.1)", border: "1px solid rgba(28,28,28,0.2)", borderRadius: 40, padding: "13.16px 15.83px 11.98px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <FigmaIcon name="warnTriangle" style={{ marginTop: 1 }} />
                        <div style={{ minWidth: 0, fontSize: 13, lineHeight: "20.15px", color: "#e4545b" }}>
                          <div style={{ fontWeight: 700 }}>Your available reward pool can&apos;t cover {fmtNum(recipientsNum)} recipients.</div>
                          <div style={{ paddingTop: 6 }}>
                            <b>How this is worked out:</b> every rewarded stage pays each recipient at least ${MIN_PER_STAGE_USD}, and this journey has {rewardedStageCount} rewarded stage{rewardedStageCount !== 1 ? "s" : ""}. So each recipient needs ${MIN_PER_STAGE_USD} × {rewardedStageCount} = <b>{fmtUSD(minPerRecipient)}</b>, and {fmtNum(recipientsNum)} recipients need {fmtNum(recipientsNum)} × {fmtUSD(minPerRecipient)} = <b>{fmtUSD(recipientsNum * minPerRecipient)}</b>.
                          </div>
                          <div style={{ paddingTop: 4 }}>
                            Your current budget can serve up to <b>{fmtNum(recipientCapacity)}</b> recipients. Add <b>{fmtToken(extraBudgetTokens)}</b> to the budget, or lower the number of recipients.
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, paddingTop: 8 }}>
                            <button onClick={() => setRewardBudget(String(round1((budgetNum + extraBudgetTokens) * 10000) / 10000))}
                              style={{ minHeight: 34, padding: "7px 12px", borderRadius: 40, background: "#8b3efe", border: "1.25px solid transparent", color: "white", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 11px rgba(138,63,252,0.25)" }}>
                              Add {fmtToken(extraBudgetTokens)} to budget
                            </button>
                            <button onClick={() => setRewardRecipients(String(recipientCapacity))}
                              style={{ minHeight: 34, padding: "7px 12px", borderRadius: 40, background: "#f7f4fe", border: "1.25px solid rgba(28,37,51,0.15)", color: "#1c2533", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                              Use {fmtNum(recipientCapacity)} recipients
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: "rgba(0,168,124,0.1)", border: "1px solid rgba(28,28,28,0.2)", borderRadius: 40, padding: "13.16px 15.83px 11.98px", display: "flex", gap: 8, alignItems: "center" }}>
                        <FigmaIcon name="tickDecagram" />
                        <span style={{ fontSize: 13, color: "#00a87c", lineHeight: "20.15px" }}>
                          Your budget can serve up to <b>{fmtNum(recipientCapacity)}</b> recipients at the ${MIN_PER_STAGE_USD} per stage minimum.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {(() => {
                  const req = Math.min(100, Math.max(0, Number(retentionRequirement) || 0));
                  const stats = retentionStats === undefined ? SAMPLE_RETENTION_STATS : retentionStats;
                  const hasStats = !!stats && stats.buckets.length > 0;
                  // Whole buckets at or above the requirement, plus the share of a bucket the requirement falls inside
                  const eligible = hasStats ? Math.round(stats!.buckets.reduce((n, b) => {
                    if (b.fromPct >= req) return n + b.users;
                    if (b.toPct > req && b.toPct > b.fromPct) return n + b.users * (b.toPct - req) / (b.toPct - b.fromPct);
                    return n;
                  }, 0)) : 0;
                  const box: React.CSSProperties = { height: 45, background: "#f4f1fc", border: "1.25px solid rgba(28,37,51,0.15)", borderRadius: 40, boxSizing: "border-box" as const, display: "flex", alignItems: "center" };
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, paddingTop: 16 }}>
                      {/* Field 1: the requirement */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{label("Nexura Score Requirement")}<NexuraScoreInfoButton /></div>
                        <div style={{ ...box, position: "relative" as const }}>
                          <input inputMode="numeric" aria-label="Nexura score requirement percent" value={retentionRequirement}
                            onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ""); setRetentionRequirement(v === "" ? "" : String(Math.min(100, Number(v)))); }}
                            placeholder="0"
                            style={{ width: "100%", height: "100%", background: "transparent", border: "none", outline: "none", padding: "0 44px 0 18px", fontSize: 14, color: "#1c2533", fontFamily: "inherit", boxSizing: "border-box" as const }} />
                          <span style={{ position: "absolute" as const, right: 18, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: "#69728a", pointerEvents: "none" as const }}>%</span>
                        </div>
                        {help("The Nexura score a participant needs to be reward-eligible.")}
                      </div>
                      {/* Field 2: Nexura users who meet it */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                        {label("Eligible Nexura Users")}
                        <div aria-live="polite" title={hasStats ? `${fmtNum(eligible)} of ${fmtNum(stats!.totalUsers)} Nexura users have a Nexura score of ${req}% or higher` : undefined}
                          style={{ ...box, gap: 10, padding: "0 18px", background: hasStats ? "white" : "rgba(228,84,91,0.06)", border: hasStats ? "1.25px solid rgba(28,37,51,0.15)" : "1.25px solid rgba(228,84,91,0.34)", whiteSpace: "nowrap" as const, overflow: "hidden" }}>
                          {hasStats ? (
                            <>
                              <span style={{ fontSize: 15, fontWeight: 600, color: "#1c2533", fontVariantNumeric: "tabular-nums" as const }}>{fmtNum(eligible)}</span>
                              <span style={{ fontSize: 13, color: "#69728a" }}>users</span>
                            </>
                          ) : (
                            <>
                              <FigmaIcon name="rowWarn" />
                              <span style={{ fontSize: 13, fontWeight: 500, color: "#e4545b", overflow: "hidden", textOverflow: "ellipsis" }}>Nexura score data unavailable</span>
                            </>
                          )}
                        </div>
                        {help(hasStats ? `Nexura users with a Nexura score of ${req}% or higher right now.` : "Counts appear here once Nexura score data is available.")}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 3 · Allocation by retention period */}
              <div style={{ ...sectionCard, border: "1px solid rgba(28,37,51,0.09)", padding: 21.83, display: "flex", flexDirection: "column", gap: 16 }}>
                {sectionHead(3, "Reward allocation by retention period", "Split 100% of the campaign reward pool across the return periods")}
                <div style={{ background: allocOk ? "rgba(0,168,124,0.1)" : "rgba(228,84,91,0.08)", border: "1px solid rgba(28,28,28,0.2)", borderRadius: 40, padding: "13.16px 15.83px 11.98px", display: "flex", gap: 8, alignItems: "center" }}>
                  {allocOk ? <FigmaIcon name="tickDecagram" /> : <FigmaIcon name="warnTriangle" />}
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: allocOk ? "#00a87c" : "#e4545b", lineHeight: "22.48px" }}>
                    Total allocated: {totalAllocated}% · {remaining >= 0 ? `Remaining: ${remaining}%` : `Over by ${Math.abs(remaining)}%`}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, padding: "8px 12px" }}>
                  <button onClick={() => { const sp = evenSplit(stages.length); const n: Record<string, string> = {}; stages.forEach((st, i) => { n[st.id] = String(sp[i]); }); setStageAlloc(n); }}
                    style={{ minHeight: 34, padding: "7px 12px", borderRadius: 40, border: "1.25px solid rgba(0,0,0,0.09)", background: "transparent", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#3d485c", fontFamily: "inherit", cursor: "pointer" }}>
                    <FigmaIcon name="split" />
                    Split evenly across stages
                  </button>
                  <button onClick={() => { const sp = templateSplit(stages.length, maxPerRecipient); const n: Record<string, string> = {}; stages.forEach((st, i) => { n[st.id] = String(sp[i]); }); setStageAlloc(n); }}
                    style={{ minHeight: 34, padding: "7px 12px", borderRadius: 40, border: "1.25px solid rgba(0,0,0,0.09)", background: "transparent", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#3d485c", fontFamily: "inherit", cursor: "pointer" }}>
                    <FigmaIcon name="reset" />
                    Reset to template split, adjusted to the ${MIN_PER_STAGE_USD} minimum
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {stages.map((st, i) => {
                    const pct = allocValues[i];
                    const per = maxPerRecipient * pct / 100;
                    const err = stageAllocErrors[i];
                    const title = i === 0 ? (st.returnDays === 0 ? "At join" : `${fmtRetention(st.returnDays)} after joining`) : fmtRetention(st.returnDays);
                    return (
                      <div key={st.id} style={{ background: "white", border: err ? "1px solid rgba(228,84,91,0.75)" : "1px solid rgba(28,37,51,0.15)", borderRadius: 40, padding: "15px 24px", display: "flex", flexDirection: "column", gap: 8.99 }}>
                        <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1c2533", lineHeight: "22.48px" }}>{title}</div>
                            <div style={{ fontSize: 12.2, color: "#69728a", lineHeight: "18.91px" }}>{RETURN_ORDINALS[i] || `Return ${i}`} · {st.name || `Stage ${i + 1}`} · {st.tasks.length} assigned task{st.tasks.length !== 1 ? "s" : ""}</div>
                          </div>
                          <div style={{ position: "relative" as const, width: 88, flexShrink: 0 }}>
                            <input inputMode="decimal" aria-label={`${title} allocation percent`} value={stageAlloc[st.id] ?? ""}
                              onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ""); setStageAlloc(prev => ({ ...prev, [st.id]: v })); }}
                              style={{ width: "100%", height: 42.67, background: "#f4f1fc", border: err ? "1px solid #e4545b" : "1px solid rgba(28,37,51,0.15)", borderRadius: 40, padding: "0 27.83px 0 12.83px", textAlign: "right" as const, fontSize: 14, fontWeight: 600, color: err ? "#e4545b" : "#1c2533", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }} />
                            <span style={{ position: "absolute" as const, right: 11.6, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: "#69728a", pointerEvents: "none" as const }}>%</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 12.4, color: err ? "#e4545b" : "#00a87c", lineHeight: "19.22px", fontFamily: mono }}>
                          Estimated {fmtUSD(round1(per * 100) / 100)} per participant ({pct}% of {fmtUSD(round1(maxPerRecipient))})
                        </div>
                        {err && (
                          <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                            <FigmaIcon name="rowWarn" style={{ marginTop: 2 }} />
                            <span style={{ fontSize: 12.4, color: "#e4545b", lineHeight: "18.6px" }}>
                              {fmtUSD(round1(per * 100) / 100)} is below the ${MIN_PER_STAGE_USD} minimum per stage. Use at least {stageMinPct}%, or set it to 0% to leave this stage unrewarded.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4 · Unused rewards */}
              <div style={sectionCard}>
                {sectionHead(4, "Unused Rewards", "What happens to rewards that are not claimed")}
                <div style={{ paddingTop: 18 }}>
                  <div style={{ background: "rgba(138,63,252,0.1)", border: "1.25px solid rgba(138,63,252,0.24)", borderRadius: 40, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <FigmaIcon name="info" style={{ marginTop: 1 }} />
                    <span style={{ fontSize: 13, color: "#6e2bd8", lineHeight: "20.15px" }}>
                      <b>Leftover rewards can be withdrawn after the campaign ends.</b> Whatever remains in the Campaign Reward Pool once the campaign is over can be withdrawn by the Owner or a Super Admin
                    </span>
                  </div>
                </div>
              </div>

              {/* 5 · Payment summary */}
              <div style={{ ...sectionCard, border: "1px solid rgba(28,37,51,0.09)", padding: 21.83, display: "flex", flexDirection: "column", gap: 15.8 }}>
                {sectionHead(5, "Payment Summary", "One combined payment, never split into separate charges")}
                <style>{"@keyframes nx-spin { to { transform: rotate(360deg); } }"}</style>
                <div style={{ paddingTop: 18 }}>
                  {[
                    { k: "Campaign Reward Budget", v: fmtToken(budgetNum), bold: false },
                    { k: "Campaign Opening Fee", v: openingFeeTokens !== null ? (isStableToken ? fmtUSD(OPENING_FEE_USD) : `${fmtToken(openingFeeTokens)} ($${OPENING_FEE_USD})`) : `$${OPENING_FEE_USD}`, bold: false },
                    { k: "Total Payment Due", v: totalPaymentDue !== null ? fmtToken(totalPaymentDue) + usdHint(totalPaymentDue) : "—", bold: true },
                  ].map((r, i) => (
                    <div key={r.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottom: i < 2 ? "1.25px solid rgba(28,37,51,0.09)" : "none" }}>
                      <span style={{ fontSize: 13.5, fontWeight: r.bold ? 700 : 400, color: "#3d485c", lineHeight: "20.925px" }}>{r.k}</span>
                      <span style={{ fontSize: 13.5, fontWeight: r.bold ? 700 : 400, color: "#1c2533", fontFamily: mono, lineHeight: "20.925px" }}>{r.v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderBottom: "0.833px solid rgba(28,37,51,0.09)", padding: "14px 6px 14px", display: "flex", flexWrap: "wrap" as const, alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                  <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1c2533", lineHeight: "21.7px" }}>Campaign payment (opening fee + reward budget)</div>
                    <div style={{ fontSize: 12.5, color: "#69728a", lineHeight: "19.375px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>Every allocation above is funded from this one transaction. Paying in <ChainLogo logo={TOKEN_LOGO[rewardToken]} size={14} /> {rewardToken} on <ChainLogo logo={activeNetworkInfo.logo} size={14} /> {activeNetworkInfo.name}.</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 14, flex: "0 0 auto", marginLeft: "auto" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1c2533", fontFamily: mono, lineHeight: "21.7px", whiteSpace: "nowrap" as const }}>{totalPaymentDue !== null ? fmtToken(totalPaymentDue) : "—"}</span>
                    {isPaid ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2.83px 8.83px", borderRadius: 20, background: "rgba(0,225,162,0.16)", border: "1px solid rgba(63,217,184,0.3)" }}>
                        <span style={{ width: 7, height: 7, borderRadius: 3.5, background: "#00a87c" }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#00a87c", lineHeight: "16.8px" }}>Confirmed</span>
                      </span>
                    ) : (
                      <>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2.83px 8.83px", borderRadius: 20, background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.15)" }}>
                          <span style={{ width: 7, height: 7, borderRadius: 3.5, background: "#69728a" }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#3d485c", lineHeight: "16.8px" }}>Not paid</span>
                        </span>
                        <button
                          disabled={!rewardsValid || payStatus === "awaiting"}
                          aria-busy={payStatus === "awaiting"}
                          title={!rewardsValid ? "Fix the budget, recipients and allocation above first" : !connectedAddress ? "Connect your wallet to pay" : undefined}
                          onClick={() => { if (!connectedAddress) { connectWallet(); return; } handlePay(); }}
                          style={{ minHeight: 34, padding: "7.25px 11.83px", borderRadius: 40, background: "#8b3efe", border: "1px solid transparent", color: "white", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: rewardsValid && payStatus !== "awaiting" ? "pointer" : "not-allowed", opacity: rewardsValid ? (payStatus === "awaiting" ? 0.75 : 1) : 0.5, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                          {payStatus === "awaiting"
                            ? <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 7, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", animation: "nx-spin 0.8s linear infinite", flexShrink: 0 }} />
                            : <FigmaIcon name="card" />}
                          {payStatus === "awaiting" ? "Confirm in your wallet…" : !connectedAddress ? "Connect wallet to pay" : payStatus === "error" ? "Try payment again" : "Pay campaign total"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {walletNotice && !connectedAddress && (
                  <div role="alert" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "#e4545b", lineHeight: "18.75px", padding: "0 6px" }}>
                    <FigmaIcon name="rowWarn" />
                    {walletNotice}
                  </div>
                )}
                {!isPaid && payStatus === "awaiting" && (
                  <div role="status" style={{ fontSize: 12.5, color: "#6e2bd8", lineHeight: "18.75px", padding: "0 6px" }}>
                    Approve the {totalPaymentDue !== null ? fmtToken(totalPaymentDue) : ""} transaction in your wallet on {activeNetworkInfo.name}. Keep this page open until it confirms.
                  </div>
                )}
                {!isPaid && payStatus === "error" && (
                  <div role="alert" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "#e4545b", lineHeight: "18.75px", padding: "0 6px" }}>
                    <FigmaIcon name="rowWarn" />
                    Payment not completed: {payError}
                  </div>
                )}
              </div>
            </div>

            {/* Back / Continue */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginTop: 34, flexWrap: "wrap" as const }}>
              <button onClick={() => { setCurrentStep(3); scrollToTop(); }}
                style={{ width: 78, height: 34, borderRadius: 40, background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#1c2533", fontFamily: "inherit" }}>
                <FigmaIcon name="arrowLeft" />
                Back
              </button>
              <button disabled={!canContinueToReview}
                title={canContinueToReview ? undefined : !rewardsValid ? "Fix the highlighted issues first" : "Pay the campaign total to continue"}
                onClick={() => { if (canContinueToReview) { setCurrentStep(5); scrollToTop(); } }}
                style={{ height: 34, borderRadius: 40, padding: "0 16px", background: "#8b3efe", opacity: canContinueToReview ? 1 : 0.45, border: "1px solid transparent", cursor: canContinueToReview ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "white", fontFamily: "inherit" }}>
                Continue to review
                <FigmaIcon name="arrowRightWhite" />
              </button>
            </div>
          </div>
        );
      })()}

      {/* ══════════ STEP 5 · REVIEW ══════════ */}
      {currentStep === 5 && (() => {
        const totalTasks = stages.reduce((n, st) => n + st.tasks.length, 0);
        const s0 = new Date(startDate); const e0 = new Date(endDate);
        const durationDays = !isNaN(s0.getTime()) && !isNaN(e0.getTime()) && e0 > s0 ? Math.round((e0.getTime() - s0.getTime()) / 86400000) : null;
        const journeyOk = stages.length > 0 && stages.every(st => st.tasks.length > 0);
        const datesOk = durationDays !== null;
        const allChecksOk = journeyOk && datesOk && campaignName.trim() !== "" && (!rewardsEnabled || canContinueToReview);
        const statLabel: React.CSSProperties = { fontSize: 10.5, fontWeight: 500, color: "#767a8c", letterSpacing: 0.84, textTransform: "uppercase" as const, lineHeight: "16.27px" };
        const statValue: React.CSSProperties = { fontSize: 19, fontWeight: 600, color: "#1c2533", lineHeight: "29.45px", paddingTop: 2.87 };
        const statSub: React.CSSProperties = { fontSize: 11.5, color: "#69728a", lineHeight: "17.83px" };
        const stats: Array<{ k: string; v: string; sub?: string; green?: boolean }> = [
          ...(rewardsEnabled ? [
            { k: "Reward pool", v: fmtToken(budgetNum), sub: isPaid ? `Funded in ${rewardToken} on ${activeNetworkInfo.name}` : "Awaiting payment", green: true },
            { k: "Reward / participant", v: fmtUSD(round1(maxPerRecipient)) },
          ] : []),
          { k: "Duration", v: durationDays !== null ? `${durationDays} Day${durationDays !== 1 ? "s" : ""}` : "—" },
          { k: "Stages", v: String(stages.length), sub: `${totalTasks} task${totalTasks !== 1 ? "s" : ""} total` },
          ...(rewardsEnabled ? [{ k: "Retention rate", v: `${Number(retentionRequirement) || 0}%` }] : []),
        ];
        return (
          <div style={{ flex: 1, padding: "0 46px 56px 36px" }}>
            <button onClick={() => goToStep(rewardsEnabled ? 4 : 3)} style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 8, height: 34, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1c2533", fontFamily: "inherit" }}>
              <FigmaIcon name="arrowLeft" />
              {rewardsEnabled ? "Back to rewards" : "Back to journey"}
            </button>

            <div style={{ marginTop: 20 }}>
              <WizardProgress currentStep={5} onStepClick={jumpToStep} minStep={templateLocked ? 2 : 1} maxStep={furthestStep} />
            </div>

            {/* Heading */}
            <div style={{ marginTop: 30, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" as const }}>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, color: "#1c2533", margin: 0, letterSpacing: -0.65, lineHeight: "40.3px" }}>Review</h1>
                <p style={{ fontSize: 14, color: "#767a8c", margin: 0, lineHeight: "21.7px" }}>Everything below reflects how your campaign is configured. Edit any stage, task or section, then publish.</p>
              </div>
            </div>

            {/* Campaign card */}
            <div style={{ marginTop: 9, background: "white", border: "1px solid rgba(28,37,51,0.09)", borderRadius: 40, padding: "38.73px 19.83px 19.83px", boxShadow: "0 14px 18px rgba(28,37,51,0.22)", display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 18, alignItems: "flex-start" }}>
                <div style={{ width: 84, height: 84, borderRadius: 16, flexShrink: 0, overflow: "hidden", background: "linear-gradient(135deg, #3a1e6e 0%, #7c5cfc 60%, #3fd9b8 100%)", boxShadow: "0 14px 36px -22px rgba(28,37,51,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {coverPreview
                    ? <img src={coverPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" as const, display: "block" }} />
                    : <FigmaIcon name="flag" />}
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 22, fontWeight: 600, color: campaignName.trim() ? "#1c2533" : "#c27c00", letterSpacing: -0.44, lineHeight: "25.3px" }}>{campaignName.trim() || "No campaign name yet"}</div>
                  {campaignDescription.trim() && (
                    <div style={{ fontSize: 13.5, color: "#3d485c", lineHeight: "20.93px", marginTop: 6, maxWidth: 640 }}>{campaignDescription}</div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 12, marginTop: 9 }}>
                    {[{ k: "Starts", v: fmtReviewDate(startDate) }, { k: "Ends", v: fmtReviewDate(endDate) }].map((d, i) => (
                      <React.Fragment key={d.k}>
                        {i === 1 && <FigmaIcon name="dateArrow" />}
                        <div style={{ background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.09)", borderRadius: 12, padding: "7.33px 13.83px 7.83px", display: "flex", flexDirection: "column", gap: 2.75 }}>
                          <span style={{ fontSize: 10, color: "#98a0b4", letterSpacing: 0.8, textTransform: "uppercase" as const, lineHeight: "15.5px" }}>{d.k}</span>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1c2533", lineHeight: "20.93px", whiteSpace: "nowrap" as const }}>{d.v}</span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ borderTop: "0.833px solid rgba(28,37,51,0.09)", paddingTop: 17.41, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
                {stats.map(st => (
                  <div key={st.k} style={{ display: "flex", flexDirection: "column", gap: 1.3, minWidth: 0 }}>
                    <span style={statLabel}>{st.k}</span>
                    <span style={{ ...statValue, color: st.green ? "#00a87c" : "#1c2533" }}>{st.v}</span>
                    {st.sub && <span style={statSub}>{st.sub}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Stage overview */}
            <div style={{ paddingTop: 21.8, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1c2533", letterSpacing: -0.3, lineHeight: "17.25px" }}>Stage Overview</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {stages.map((st, i) => {
                  const pct = rewardsEnabled ? (Number(stageAlloc[st.id]) || 0) : 0;
                  const perStage = maxPerRecipient * pct / 100;
                  const timing = i === 0 ? (st.returnDays === 0 ? "Immediately" : `${fmtRetention(st.returnDays)} after joining`) : (st.returnDays === 0 ? "Immediately after previous stage" : `${fmtRetention(st.returnDays)} after previous stage`);
                  const next = stages[i + 1];
                  return (
                    <React.Fragment key={st.id}>
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <div style={{ width: 30, height: 30, borderRadius: 15, background: "#8a3ffc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "white", lineHeight: "20.15px" }}>{i + 1}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, paddingBottom: 10 }}>
                          <div style={{ background: "white", border: "1px solid rgba(28,37,51,0.09)", borderRadius: 40, padding: "13.83px 20px", display: "flex", flexWrap: "wrap" as const, alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" as const }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#8a3ffc", letterSpacing: 0.33, lineHeight: "17px" }}>Stage {i + 1}</span>
                                <span style={{ fontSize: 14.5, fontWeight: 600, color: "#1c2533", lineHeight: "22.475px" }}>{st.name || `Stage ${i + 1}`}</span>
                              </div>
                              <div style={{ fontSize: 12.5, lineHeight: "19.38px", display: "flex", gap: 2, flexWrap: "wrap" as const }}>
                                <span style={{ color: "#69728a" }}>{timing} </span>
                                <span style={{ color: "#98a0b4" }}>·</span>
                                <span style={{ color: "#69728a" }}>{st.tasks.length} task{st.tasks.length !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7.99 }}>
                              {rewardsEnabled && (
                                <span style={{ height: 34, boxSizing: "border-box" as const, display: "inline-flex", alignItems: "center", gap: 6.99, padding: "0 11.83px", borderRadius: 999, background: "rgba(0,168,124,0.1)", border: "1px solid rgba(0,168,124,0.26)" }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#00a87c", letterSpacing: -0.125 }}>+${perStage.toFixed(2)}</span>
                                  <span style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(0,168,124,0.72)", letterSpacing: -0.125 }}>{pct}%</span>
                                </span>
                              )}
                              <button
                                onClick={() => { setActiveStageId(st.id); setCurrentStep(3); scrollToTop(); }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(138,63,252,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "#f7f4fe"; }}
                                style={{ minHeight: 34, padding: "7.24px 11.83px 7.26px", borderRadius: 40, background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.15)", display: "flex", alignItems: "center", gap: 7.99, fontSize: 13, fontWeight: 600, color: "#1c2533", fontFamily: "inherit", cursor: "pointer" }}
                              >
                                <FigmaIcon name="reviewPencil" />
                                Edit
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      {next && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 13, height: 27.8, marginTop: -6 }}>
                          <div style={{ width: 1.99, height: 20, background: "rgba(138,63,252,0.32)" }} />
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 10px", borderRadius: 999 }}>
                            <FigmaIcon name="returnArrow" />
                            <span style={{ fontSize: 11.5, color: "#00a87c", lineHeight: "17.83px" }}>{next.returnDays === 0 ? "Continues immediately" : `Return after ${fmtRetention(next.returnDays)}`}</span>
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div style={{ marginTop: 19, background: published ? "rgba(138,63,252,0.1)" : allChecksOk ? "rgba(0,225,162,0.16)" : "rgba(245,177,61,0.12)", border: published ? "1px solid rgba(155,124,255,0.24)" : allChecksOk ? "1px solid rgba(63,217,184,0.26)" : "1px solid rgba(245,177,61,0.35)", borderRadius: 40, padding: "12.91px 15.83px 13.88px", display: "flex", alignItems: "center", gap: 12 }}>
              {published ? <FigmaIcon name="modalInfo" /> : allChecksOk ? <FigmaIcon name="statusCheck" /> : <FigmaIcon name="warnTriangle" />}
              <span style={{ fontSize: 13, lineHeight: "20.15px", color: published ? "#6e2bd8" : allChecksOk ? "#00a87c" : "#c27c00" }}>
                {published
                  ? `Published. ${campaignName.trim() || "Untitled campaign"} is now in Upcoming. Participants can join from ${fmtShortDate(startDate)}.`
                  : allChecksOk
                    ? (rewardsEnabled ? "Everything checks out. Payments are confirmed and the configuration is valid." : "Everything checks out. The configuration is valid.")
                    : !campaignName.trim() ? "Add a campaign name in Details before publishing."
                    : !datesOk ? "Set a valid start and end date in Details before publishing."
                    : !journeyOk ? "Every stage needs at least one task before publishing."
                    : "Finish the Rewards & Funding step (allocation and payment) before publishing."}
              </span>
            </div>

            {/* Back / Publish */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginTop: 30, flexWrap: "wrap" as const }}>
              <button onClick={() => { setCurrentStep(rewardsEnabled ? 4 : 3); scrollToTop(); }}
                style={{ width: 78, height: 34, borderRadius: 40, background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#1c2533", fontFamily: "inherit" }}>
                <FigmaIcon name="arrowLeft" />
                Back
              </button>
              <button disabled={!allChecksOk || published}
                onClick={() => { if (allChecksOk && !published) setShowPublishModal(true); }}
                style={{ height: 34, borderRadius: 40, padding: "0 16px", background: "#8b3efe", opacity: allChecksOk && !published ? 1 : 0.45, border: "1px solid transparent", cursor: allChecksOk && !published ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "white", fontFamily: "inherit" }}>
                {published ? (mode === "live" ? "Proposed" : "Published") : (mode === "live" ? "Propose changes" : "Publish")}
                <FigmaIcon name={published ? "checkWhite" : "arrowRightWhite"} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* ══════════ PUBLISH CONFIRMATION ══════════ */}
      {/* ── Template / scratch confirmation ── */}
      {startChoice && (() => {
        const tpl = startChoice.kind === "template" ? TEMPLATES.find(t => t.id === startChoice.id) : undefined;
        return tpl ? (
          <NoticeDialog
            title={`Use ${tpl.name}?`}
            body={<>You chose to use <b style={{ fontWeight: 600, color: "#1c2533" }}>{tpl.name}</b>: a {tpl.months}-month campaign with {tpl.stageCount} stages and a minimum retention rate of {tpl.retentionRate}.</>}
            note="You can still customise everything (dates, stages, tasks and the reward split) in the next steps."
            cancelLabel="No"
            confirmLabel="Yes, use template"
            onCancel={() => setStartChoice(null)}
            onConfirm={confirmStartChoice}
          />
        ) : (
          <NoticeDialog
            title="Start from scratch?"
            body="You chose to begin with an empty journey. You will set every stage, timing rule and reward split yourself."
            note="Nothing is pre-filled, and you can switch to a journey template later on the Journey step."
            cancelLabel="No"
            confirmLabel="Yes, start from scratch"
            onCancel={() => setStartChoice(null)}
            onConfirm={confirmStartChoice}
          />
        );
      })()}

      {/* ── Rewards toggle notice ── */}
      {pendingRewards === false && (
        <NoticeDialog
          title="Turn off rewards?"
          body="This campaign already has reward configuration. Turning rewards off will remove rewards from this campaign flow."
          note="Your reward settings are kept aside, so they come back if you turn rewards on again before publishing."
          tone="danger"
          confirmLabel="Continue without rewards"
          onCancel={() => setPendingRewards(null)}
          onConfirm={() => { setRewardsEnabled(false); setPendingRewards(null); }}
        />
      )}
      {pendingRewards === true && (
        <NoticeDialog
          title="Turn on rewards?"
          body="Participants will be able to earn rewards. You set the budget and how it is split on the Rewards & Funding step."
          note="The reward pool must be funded before this campaign can be published."
          confirmLabel="Turn on rewards"
          onCancel={() => setPendingRewards(null)}
          onConfirm={() => { setRewardsEnabled(true); setPendingRewards(null); }}
        />
      )}

      {/* ── Journey template preview ── */}
      {showJourneyTpl && (() => {
        const tpl = TEMPLATES.find(t => t.id === selectedTemplateId);
        const plan = journeyTemplatePlan(tpl?.stageCount ?? 5, journeyCadence);
        const split = tpl && tpl.structure.length === plan.length ? tpl.structure.map(x => x.pct) : (TEMPLATE_SPLITS[plan.length] || evenSplit(plan.length));
        const unit = journeyCadence === "daily" ? "day" : "week";
        return (
          <NoticeDialog
            title={tpl ? `Set up ${tpl.name} stages` : "Use a journey template"}
            body={<>Choose how often participants come back. {plan.length} stages, one every {unit}{tpl ? <>, based on <b style={{ fontWeight: 600, color: "#1c2533" }}>{tpl.name}</b></> : null}.</>}
            note="You can rename stages, change their timing and add tasks after applying the template."
            confirmLabel="Use this journey"
            onCancel={() => setShowJourneyTpl(false)}
            onConfirm={applyJourneyTemplate}
          >
            <div role="radiogroup" aria-label="How often participants return" style={{ display: "flex", gap: 4, padding: 4, background: "#f4f1fc", border: "1.25px solid rgba(28,37,51,0.12)", borderRadius: 40 }}>
              {(["daily", "weekly"] as const).map(c => {
                const on = journeyCadence === c;
                return (
                  <button key={c} role="radio" aria-checked={on} onClick={() => setJourneyCadence(c)}
                    style={{ flex: 1, height: 36, borderRadius: 40, border: on ? "1.25px solid rgba(138,63,252,0.4)" : "1.25px solid transparent", background: on ? "white" : "transparent", boxShadow: on ? "0 2px 8px rgba(138,63,252,0.15)" : "none", fontSize: 13.5, fontWeight: 600, color: on ? "#6e2bd8" : "#69728a", fontFamily: "inherit", cursor: "pointer" }}>
                    {c === "daily" ? "Daily tasks" : "Weekly tasks"}
                  </button>
                );
              })}
            </div>
            <div style={{ border: "1.25px solid rgba(28,37,51,0.09)", borderRadius: 28, padding: "6px 0" }}>
              {plan.map((st, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", borderTop: i === 0 ? "none" : "1px solid rgba(28,37,51,0.06)" }}>
                  <span style={{ width: 24, height: 24, borderRadius: 12, background: "linear-gradient(120deg, #9b7cff 0%, #7c5cfc 45%, #5aa8ff 100%)", color: "white", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1c2533" }}>{st.name}</span>
                    <span style={{ fontSize: 12, color: "#69728a" }}>{st.when} · {i === 0 ? "opens when the participant joins" : `opens 1 ${unit} after stage ${i}`}</span>
                  </div>
                  {rewardsEnabled && <span style={{ fontSize: 12, fontWeight: 600, color: "#6e2bd8", background: "rgba(138,63,252,0.1)", borderRadius: 20, padding: "3px 10px", flexShrink: 0, fontVariantNumeric: "tabular-nums" as const }}>{split[i]}% of pool</span>}
                </div>
              ))}
            </div>
          </NoticeDialog>
        );
      })()}

      {showPublishModal && (() => {
        const start = new Date(startDate);
        const daysUntilStart = isNaN(start.getTime()) ? null : Math.ceil((start.getTime() - Date.now()) / 86400000);
        const startText = daysUntilStart === null ? "" : daysUntilStart > 1 ? `, ${daysUntilStart} days after you publish. Use that time for marketing and promotion.` : daysUntilStart === 1 ? ", 1 day after you publish." : ". Joining opens as soon as you publish.";
        return (
          <div onClick={() => { if (!publishing) setShowPublishModal(false); }} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(4,3,9,0.7)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" as const }}>
            <div role="dialog" aria-modal="true" aria-labelledby="publish-title" onClick={e => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 480.33, background: "white", border: "1px solid rgba(28,37,51,0.15)", borderRadius: 40, overflow: "hidden", padding: "29px 6px 1px", boxSizing: "border-box" as const }}>
              <div id="publish-title" style={{ padding: "0 24px", fontSize: 16.4, fontWeight: 600, color: "#1c2533", letterSpacing: -0.328, lineHeight: "18.84px" }}>{mode === "live" ? "Propose changes to this campaign?" : "Publish this campaign?"}</div>
              <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 15.99 }}>
                <div style={{ fontSize: 14, color: "#3d485c", lineHeight: "21.7px" }}>
                  {mode === "live"
                    ? `This campaign is published, so your changes to ${campaignName.trim() || "this campaign"} go to Admin Management as a proposal. You will sign it with your wallet. Once enough signers approve, any signer can execute it to apply the changes.`
                    : <>Once published, {campaignName.trim() || "Untitled campaign"} moves to Upcoming and appears on the public page, but participants cannot join until it starts. {rewardsEnabled ? "Reward amounts and reserved participant funds become locked. You can still increase the pool later." : ""}</>}
                </div>
                <div style={{ background: "rgba(138,63,252,0.1)", border: "1px solid rgba(155,124,255,0.24)", borderRadius: 40, padding: "21px 16.83px", display: mode === "live" ? "none" : "flex", gap: 12, alignItems: "flex-start" }}>
                  <FigmaIcon name="modalInfo" style={{ marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#6e2bd8", lineHeight: "20.15px" }}>
                    <b style={{ fontWeight: 600 }}>Starts {fmtReviewDate(startDate)}</b>{startText} Participants can join from the start date until <b>{fmtShortDate(endDate)}.</b>
                  </span>
                </div>
                {publishError && (
                  <div role="alert" style={{ background: "rgba(248,113,113,0.16)", border: "1px solid rgba(228,84,91,0.4)", borderRadius: 20, padding: "12px 16px", fontSize: 13, color: "#e4545b", lineHeight: "20px" }}>
                    {publishError}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 9.99, padding: "16px 24px 22px" }}>
                <button onClick={() => setShowPublishModal(false)} disabled={publishing}
                  style={{ minHeight: 40, padding: "10.83px 16.83px", borderRadius: 40, background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.15)", fontSize: 14, fontWeight: 600, color: "#1c2533", fontFamily: "inherit", cursor: publishing ? "not-allowed" : "pointer", opacity: publishing ? 0.5 : 1 }}>
                  Not yet
                </button>
                <button
                  disabled={publishing}
                  onClick={async () => {
                    setPublishing(true);
                    setPublishError("");
                    try {
                    await onPublish?.(buildPayload());;
                      setPublished(true);
                      setShowPublishModal(false);
                    } catch (err) {
                      setPublishError(err instanceof Error && err.message ? err.message : "The campaign could not be published. Try again.");
                    } finally {
                      setPublishing(false);
                    }
                  }}
                  style={{ minHeight: 40, padding: "10.83px 16.83px", borderRadius: 40, background: "#8b3efe", border: "1px solid transparent", fontSize: 14, fontWeight: 600, color: "white", fontFamily: "inherit", cursor: publishing ? "wait" : "pointer", opacity: publishing ? 0.7 : 1, display: "flex", alignItems: "center", gap: 7.99 }}>
                  <FigmaIcon name="checkWhite" />
                  {mode === "live" ? (publishing ? "Proposing…" : "Sign & propose") : (publishing ? "Publishing…" : "Publish")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════ FOOTER ══════════ */}
      <div style={{ position: "sticky", bottom: 0, marginTop: "auto", background: "white", borderTop: "1px solid #E5E7EB", padding: "7px 46px 7px 36px", display: currentStep >= 3 ? "none" : "flex", justifyContent: "space-between", alignItems: "center", zIndex: 50 }}>

        {/* STEP 1 FOOTER */}
        {currentStep === 1 && (
          <>
            <button
              onClick={() => { window.location.href = NEXURA_MAIN_APP_URL; }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(28,37,51,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f7f4fe"; }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#f7f4fe", border: "1px solid rgba(28,37,51,0.15)", borderRadius: 40, width: 78, height: 34, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#1c2533", transition: "background 0.15s" }}
            >
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M11 7H3M3 7L7 3M3 7L7 11" stroke="#1c2533" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Back
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Campaign already has content: go back to it without applying a template or clearing it */}
            {(initialState || stages.length > 0 || campaignName.trim()) && (
              <button
                onClick={() => goToStep(2)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#8b3efe", color: "white", border: "1px solid transparent", borderRadius: 40, padding: "0 16px", height: 34, cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}
              >
                Continue editing
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M11 7L7 3M11 7L7 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
            <button
              onMouseEnter={() => setScratchHovered(true)}
              onMouseLeave={() => setScratchHovered(false)}
              onClick={handleScratch}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                borderRadius: 40, width: 150, height: 34, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                transition: "background 0.15s, color 0.15s, border-color 0.15s",
                background: scratchHovered ? "#8b3efe" : "white",
                color: scratchHovered ? "white" : "#8b3efe",
                border: scratchHovered ? "1px solid transparent" : "1px solid #8b3efe",
              }}
            >
              Start from scratch
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M11 7L7 3M11 7L7 11" stroke={scratchHovered ? "white" : "#8b3efe"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            </div>
          </>
        )}

        {/* STEP 2 FOOTER */}
        {currentStep === 2 && (
          <>
            <button
              onMouseEnter={() => setBackHovered(true)}
              onMouseLeave={() => setBackHovered(false)}
              onClick={() => { if (templateLocked) window.location.href = "/studio-dashboard/campaigns-tab"; else setCurrentStep(1); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: backHovered ? "rgba(28,37,51,0.06)" : "#f7f4fe", border: "1px solid rgba(28,37,51,0.15)", borderRadius: 40, width: 78, height: 34, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#1c2533", transition: "background 0.15s" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 7H3M3 7L7 3M3 7L7 11" stroke="#1c2533" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Back
            </button>
            <button
              onMouseEnter={() => setContinueHovered(true)}
              onMouseLeave={() => setContinueHovered(false)}
              onClick={() => setCurrentStep(3)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                background: continueHovered ? "#8b3efe" : "white",
                color: continueHovered ? "white" : "#8b3efe",
                border: continueHovered ? "1px solid transparent" : "1px solid #8b3efe",
                borderRadius: 40, padding: "0 24px", height: 34, whiteSpace: "nowrap",
                cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                transition: "background 0.15s, color 0.15s, border-color 0.15s",
                boxShadow: continueHovered ? "0 4px 16px rgba(139,62,254,0.35)" : "none",
              }}
            >
              Continue to journey
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M11 7L7 3M11 7L7 11" stroke={continueHovered ? "white" : "#8b3efe"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        )}

        {/* STEP 3 FOOTER */}
        {currentStep === 3 && (
          <>
            <button
              onMouseEnter={() => setBackStep3Hovered(true)}
              onMouseLeave={() => setBackStep3Hovered(false)}
              onClick={() => setCurrentStep(2)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: backStep3Hovered ? "rgba(28,37,51,0.06)" : "#f7f4fe", border: "1px solid rgba(28,37,51,0.15)", borderRadius: 40, width: 78, height: 34, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#1c2533", transition: "background 0.15s" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 7H3M3 7L7 3M3 7L7 11" stroke="#1c2533" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Back
            </button>
            <button
              onMouseEnter={() => { if (stages.length > 0) setContinueStep3Hovered(true); }}
              onMouseLeave={() => setContinueStep3Hovered(false)}
              onClick={() => { if (stages.length > 0) setCurrentStep(4); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                background: stages.length === 0 ? "#f7f4fe" : continueStep3Hovered ? "#8b3efe" : "white",
                color: stages.length === 0 ? "#9ca3af" : continueStep3Hovered ? "white" : "#8b3efe",
                border: stages.length === 0 ? "1px solid rgba(28,37,51,0.15)" : continueStep3Hovered ? "1px solid transparent" : "1px solid #8b3efe",
                borderRadius: 40, padding: "0 24px", height: 34, whiteSpace: "nowrap",
                cursor: stages.length === 0 ? "not-allowed" : "pointer", fontSize: 12.5, fontWeight: 600,
                opacity: stages.length === 0 ? 0.6 : 1,
                transition: "background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s",
                boxShadow: continueStep3Hovered && stages.length > 0 ? "0 4px 16px rgba(139,62,254,0.35)" : "none",
              }}
            >
              Continue to rewards
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M11 7L7 3M11 7L7 11" stroke={stages.length === 0 ? "#9ca3af" : continueStep3Hovered ? "white" : "#8b3efe"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        )}
      </div>

      {/* ══════════ CONFIGURE TASKS MODAL ══════════ */}
      {showTaskModal && (
        <div
          onClick={handleCloseTaskModal}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", overflowY: "auto" as const }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "white", borderRadius: 26, border: "1px solid rgba(28,37,51,0.08)", width: "100%", maxWidth: 540, maxHeight: taskModalStep === "select" ? "88vh" : "none", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.16)" }}
          >
            <style>{`
              .modal-scroll::-webkit-scrollbar { width: 5px; }
              .modal-scroll::-webkit-scrollbar-track { background: transparent; }
              .modal-scroll::-webkit-scrollbar-thumb { background: #8b3efe; border-radius: 10px; }
              .modal-scroll::-webkit-scrollbar-button { display: none !important; width: 0 !important; height: 0 !important; }
              .modal-scroll { scrollbar-width: thin; scrollbar-color: #8b3efe transparent; }
              .cat-scroll::-webkit-scrollbar { display: none; }
              .cat-scroll { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* ── STEP 1: TASK SELECTION ── */}
            {taskModalStep === "select" && (
              <>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 18px", borderBottom: "1px solid rgba(28,37,51,0.08)" }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#1c2533", letterSpacing: -0.3 }}>Configure Tasks</div>
                  <button
                    onClick={handleCloseTaskModal}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(28,37,51,0.07)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(28,37,51,0.04)"; }}
                    style={{ width: 32, height: 32, borderRadius: 16, border: "1px solid rgba(28,37,51,0.12)", background: "rgba(28,37,51,0.04)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0, transition: "background 0.15s" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 10.5l9-9M10.5 10.5l-9-9" stroke="#1c2533" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </button>
                </div>

                {/* Search */}
                <div style={{ padding: "16px 24px 12px", flexShrink: 0 }}>
                  <div style={{ position: "relative" as const }}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ position: "absolute" as const, left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" as const }}>
                      <circle cx="6.5" cy="6.5" r="5" stroke="#98a0b4" strokeWidth="1.4"/>
                      <path d="M10.5 10.5l3 3" stroke="#98a0b4" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <input
                      value={taskSearch}
                      onChange={e => setTaskSearch(e.target.value)}
                      placeholder="Search tasks…"
                      style={{ width: "100%", height: 46, borderRadius: 40, border: "1px solid rgba(124,92,252,0.43)", background: "#f4f7ff", outline: "none", paddingLeft: 40, paddingRight: 14, fontSize: 13.5, color: "#1c2533", fontFamily: "inherit", boxSizing: "border-box" as const }}
                    />
                  </div>
                </div>

                {/* Category filter tabs */}
                <div style={{ padding: "4px 24px 18px", flexShrink: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                    {TASK_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setTaskFilterCat(cat)}
                        style={{
                          height: 30, padding: "0 13px", borderRadius: 40,
                          border: taskFilterCat === cat ? "1.5px solid #9b7cff" : "1.5px solid rgba(28,37,51,0.13)",
                          background: taskFilterCat === cat ? "rgba(155,124,255,0.14)" : "white",
                          color: "#1c2533",
                          fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                          whiteSpace: "nowrap" as const,
                        }}
                      >{cat}</button>
                    ))}
                  </div>
                </div>

                {/* Task list */}
                <div className="modal-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" as const, padding: "0 0 16px" }}>
                  {getFilteredTasks().length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "36px 16px", gap: 10 }}>
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="14" cy="14" r="9" stroke="#c4c9d8" strokeWidth="1.8"/><path d="M21 21l6 6" stroke="#c4c9d8" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      <div style={{ fontSize: 13.5, color: "#98a0b4", textAlign: "center" as const }}>No tasks match your search.</div>
                    </div>
                  ) : (() => {
                    const tasks = getFilteredTasks();
                    const items: React.ReactNode[] = [
                      <div key="hdr" style={{ padding: "4px 24px 8px", fontSize: 11, fontWeight: 500, color: "#605d72", letterSpacing: "0.9px", textTransform: "uppercase" as const }}>
                        {taskFilterCat}
                      </div>
                    ];
                    tasks.forEach((task) => {
                      const isHov = hoveredTaskId === task.id;
                      items.push(
                        <div
                          key={task.id}
                          onClick={() => handleSelectTaskType(task)}
                          onMouseEnter={() => setHoveredTaskId(task.id)}
                          onMouseLeave={() => setHoveredTaskId(null)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "13px 24px",
                            cursor: "pointer",
                            background: isHov ? "rgba(138,63,252,0.05)" : "transparent",
                            transition: "background 0.12s",
                          }}
                        >
                          {/* Platform icon */}
                          <div style={{ width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {getTaskPlatformIcon(task.id)}
                          </div>
                          {/* Task name */}
                          <span style={{ flex: 1, fontSize: 13.6, fontWeight: 400, color: "#1c2533", lineHeight: "20px", minWidth: 0 }}>{task.name}</span>
                          {/* Category label */}
                          <span style={{ fontSize: 11.2, color: "#605d72", fontWeight: 400, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{task.category}</span>
                        </div>
                      );
                    });
                    return items;
                  })()}
                </div>
              </>
            )}

            {/* ── STEP 2: TASK CONFIGURATION ── */}
            {taskModalStep === "configure" && selectedTaskCatalogItem && (
              <>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "26px 28px 4px", flexShrink: 0 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#1c2533", letterSpacing: -0.3 }}>Configure Tasks</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#69728a", marginTop: 6, lineHeight: "18px" }}>Edit the details of your tasks</div>
                  </div>
                  <button
                    onClick={handleCloseTaskModal}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(28,37,51,0.07)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(28,37,51,0.04)"; }}
                    style={{ width: 32, height: 32, borderRadius: 16, border: "1px solid rgba(28,37,51,0.12)", background: "rgba(28,37,51,0.04)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0, transition: "background 0.15s", marginTop: 2 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 10.5l9-9M10.5 10.5l-9-9" stroke="#1c2533" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </button>
                </div>

                {/* Config body */}
                <div style={{ padding: "18px 28px 0" }}>

                  {/* Task Type row */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1c2533", marginBottom: 8 }}>Task Type</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 18px", border: "1px solid rgba(124,92,252,0.43)", borderRadius: 40, background: "#f4f7ff", boxSizing: "border-box" as const }}>
                      <div style={{ width: 20, height: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {getTaskPlatformIcon(selectedTaskCatalogItem.id)}
                      </div>
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: "#1c2533", minWidth: 0 }}>{selectedTaskCatalogItem.name}</span>
                      <button
                        onClick={() => setTaskModalStep("select")}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#7c5cfc", padding: 0, flexShrink: 0, fontFamily: "inherit" }}
                      >Change</button>
                    </div>
                  </div>

                  {/* URL input */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1c2533", marginBottom: 8 }}>{getTaskUrlLabel(selectedTaskCatalogItem.id)}</div>
                    {(() => {
                      const urlErr = socialUrlError(selectedTaskCatalogItem.id, taskUrlInput);
                      return (
                        <>
                          <input
                            value={taskUrlInput}
                            onChange={e => setTaskUrlInput(e.target.value)}
                            placeholder={getTaskUrlPlaceholder(selectedTaskCatalogItem.id)}
                            aria-invalid={!!urlErr}
                            aria-describedby={urlErr ? "task-url-error" : undefined}
                            style={{ width: "100%", height: 46, borderRadius: 40, border: urlErr ? "1.25px solid #e4545b" : "1px solid rgba(124,92,252,0.43)", background: urlErr ? "rgba(228,84,91,0.05)" : "#f4f7ff", outline: "none", padding: "0 18px", fontSize: 13.5, color: "#1c2533", fontFamily: "inherit", boxSizing: "border-box" as const }}
                          />
                          {urlErr && (
                            <div id="task-url-error" role="alert" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, paddingLeft: 6, fontSize: 12.5, fontWeight: 500, color: "#e4545b", lineHeight: "18px" }}>
                              <FigmaIcon name="rowWarn" />
                              {urlErr}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Task Description (required: this is the text participants see in the app) */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1c2533", marginBottom: 8 }}>Task Description</div>
                    <input
                      value={taskDescInput}
                      onChange={e => setTaskDescInput(e.target.value)}
                      placeholder="What participants will see in the app"
                      style={{ width: "100%", height: 46, borderRadius: 40, border: "1px solid rgba(124,92,252,0.43)", background: "#f4f7ff", outline: "none", padding: "0 18px", fontSize: 13.5, color: "#1c2533", fontFamily: "inherit", boxSizing: "border-box" as const }}
                    />
                  </div>

                  {/* Verification — bottom */}
                  {CONFIGURABLE_VALIDATION_TASKS.includes(selectedTaskCatalogItem.id) ? (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1c2533", marginBottom: 8 }}>Validation Method</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {([
                          { mode: "manual" as const, title: "Manual review" },
                          ...(PEER_REVIEW_TASKS.includes(selectedTaskCatalogItem.id) ? [{ mode: "peer" as const, title: "Peer review" }] : []),
                          { mode: "link" as const, title: "Link click" },
                          { mode: "api" as const, title: "API check" },
                        ] as Array<{ mode: ValidationMode; title: string }>).map(opt => {
                          const active = taskValidationMode === opt.mode;
                          return (
                            <button
                              key={opt.mode}
                              onClick={() => setTaskValidationMode(opt.mode)}
                              style={{ flex: 1, minWidth: 0, height: 40, padding: "0 10px", borderRadius: 40, border: active ? "1.5px solid #8b3efe" : "1px solid rgba(124,92,252,0.3)", background: active ? "rgba(155,124,255,0.16)" : "#f4f7ff", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: active ? "#6b21d6" : "#1c2533", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", boxSizing: "border-box" as const }}
                            >{opt.title}</button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 12, color: "#69728a", lineHeight: "17px", marginTop: 8, paddingLeft: 4 }}>
                        {taskValidationMode === "manual" && "An admin reviews and approves each submission."}
                        {taskValidationMode === "peer" && "Other community members review each submission. Reviewers are paid from Validation Rewards (2% of the reward budget)."}
                        {taskValidationMode === "link" && "Completed automatically when the user opens your link."}
                        {taskValidationMode === "api" && "Your server confirms completion through an endpoint you provide."}
                      </div>

                      {taskValidationMode === "api" && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1c2533", marginBottom: 8 }}>Verification Endpoint</div>
                          <input
                            value={taskApiEndpoint}
                            onChange={e => setTaskApiEndpoint(e.target.value)}
                            placeholder="https://api.yourproject.com/verify"
                            style={{ width: "100%", height: 46, borderRadius: 40, border: "1px solid rgba(124,92,252,0.43)", background: "#f4f7ff", outline: "none", padding: "0 18px", fontSize: 13.5, color: "#1c2533", fontFamily: "inherit", boxSizing: "border-box" as const }}
                          />
                          <div style={{ fontSize: 11.5, color: "#69728a", lineHeight: "17px", marginTop: 8, paddingLeft: 4 }}>
                            We call <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#1c2533" }}>?address=0x…</span> and expect <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#1c2533" }}>{`{ "completed": true }`}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (() => {
                    const info = getAutoVerifyInfo(selectedTaskCatalogItem.id);
                    return (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "16px 20px", borderRadius: 24, background: "#9b6dff", marginBottom: 4 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 10, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "white", lineHeight: "18px" }}>{info.title}</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: "17px", marginTop: 3 }}>{info.subtitle}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, padding: "24px 28px 28px", flexShrink: 0 }}>
                  <button
                    onClick={() => setTaskModalStep("select")}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(155,124,255,0.14)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f4f7ff"; }}
                    style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px", borderRadius: 40, border: "1px solid rgba(124,92,252,0.3)", background: "#f4f7ff", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "#1c2533", fontFamily: "inherit", transition: "background 0.15s" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11.5 7h-9M2.5 7L6 3.5M2.5 7L6 10.5" stroke="#1c2533" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Back
                  </button>
                  <button
                    onClick={() => handleAddTask(showTaskModal!)}
                    disabled={!canSaveTask}
                    title={!taskDescInput.trim() ? "Add a task description first" : !canSaveTask ? "Enter a valid link first" : undefined}
                    onMouseEnter={e => { if (canSaveTask) (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(to bottom, #9d4fff, #7a28e8)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = canSaveTask ? "#8b3efe" : "#c4a6fe"; }}
                    style={{ display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 20px", borderRadius: 40, border: "none", background: canSaveTask ? "#8b3efe" : "#c4a6fe", cursor: canSaveTask ? "pointer" : "not-allowed", fontSize: 13.5, fontWeight: 600, color: "white", fontFamily: "inherit", transition: "background 0.15s" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3.5 3.5 5.5-6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {editingTaskId ? "Save task" : "Add task"}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}