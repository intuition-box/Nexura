export type WalletNetwork = {
  id: number;
  name: string;
  icon: string;
  /** Badge behind the mark. White logos need black. */
  iconBg: "white" | "black";
  rpc: string;
  explorer: string;
  native: { name: string; symbol: string; decimals: number };
};

const ETH = { name: "Ether", symbol: "ETH", decimals: 18 };

/** Main-page network selector. Keep this list alphabetical. */
export const WALLET_NETWORKS: WalletNetwork[] = [
  {
    id: 42161,
    name: "Arbitrum",
    icon: "/chains/arbitrum.png",
    iconBg: "white",
    rpc: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
    native: ETH,
  },
  {
    id: 8453,
    name: "Base",
    icon: "/chains/base.png",
    iconBg: "white",
    rpc: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    native: ETH,
  },
  {
    id: 56,
    name: "BNB Chain",
    icon: "/chains/bnb.png",
    iconBg: "white",
    rpc: "https://bsc-dataseed.binance.org",
    explorer: "https://bscscan.com",
    native: { name: "BNB", symbol: "BNB", decimals: 18 },
  },
  {
    id: 1,
    name: "Ethereum",
    icon: "/chains/ethereum.png",
    iconBg: "white",
    rpc: "https://ethereum.publicnode.com",
    explorer: "https://etherscan.io",
    native: ETH,
  },
  {
    id: 1155,
    name: "Intuition Mainnet",
    icon: "/chains/intuition.png",
    iconBg: "black",
    rpc: "https://rpc.intuition.systems",
    explorer: "https://explorer.intuition.systems",
    native: { name: "Trust", symbol: "TRUST", decimals: 18 },
  },
  {
    id: 4663,
    name: "Robinhood",
    icon: "/chains/robinhood.svg",
    iconBg: "black",
    rpc: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robinhoodchain.blockscout.com",
    native: ETH,
  },
];

export const WALLET_NETWORK_BY_ID = new Map(WALLET_NETWORKS.map((net) => [net.id, net]));

export function hexChainId(id: number) {
  return `0x${id.toString(16)}`;
}

export function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
