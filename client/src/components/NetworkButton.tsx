"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useAccount } from "wagmi";
import { useToast } from "../hooks/use-toast";
import {
  WALLET_NETWORKS,
  WALLET_NETWORK_BY_ID,
  hexChainId,
  parseChainId,
  type WalletNetwork,
} from "../lib/walletNetworks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

function ChainMark({
  icon,
  name,
  iconBg,
  size = "sm",
}: {
  icon: string;
  name: string;
  iconBg: "white" | "black";
  size?: "sm" | "md";
}) {
  const box = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const glyph = iconBg === "black" ? "h-full w-full object-cover" : "h-[85%] w-[85%] object-contain";
  return (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-full ${
        iconBg === "black" ? "bg-black" : "bg-white"
      }`}
    >
      <img src={icon} alt="" className={glyph} />
      <span className="sr-only">{name}</span>
    </span>
  );
}

async function providerRequest(provider: any, method: string, params: unknown[]) {
  return provider.request({ method, params });
}

export default function NetworkButton({ className }: { className?: string }) {
  const { toast } = useToast();
  const { connector, chainId: wagmiChainId } = useAccount();
  const [chainId, setChainId] = useState<number | null>(wagmiChainId ?? null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (wagmiChainId != null) setChainId(wagmiChainId);
  }, [wagmiChainId]);

  useEffect(() => {
    let provider: any;
    let onChain: ((id: unknown) => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        provider = (await connector?.getProvider?.()) ?? (window as any).ethereum;
      } catch {
        provider = (window as any).ethereum;
      }
      if (cancelled || !provider?.request) return;
      try {
        const hex = await provider.request({ method: "eth_chainId" });
        const id = parseChainId(hex);
        if (!cancelled && id != null) setChainId(id);
      } catch {
        /* wallet may not be ready yet */
      }
      onChain = (next) => {
        const id = parseChainId(next);
        if (id != null) setChainId(id);
      };
      provider.on?.("chainChanged", onChain);
    })();

    return () => {
      cancelled = true;
      provider?.removeListener?.("chainChanged", onChain);
    };
  }, [connector]);

  const current = chainId != null ? WALLET_NETWORK_BY_ID.get(chainId) : undefined;

  const switchTo = async (net: WalletNetwork) => {
    if (pending || net.id === chainId) return;
    let provider: any;
    try {
      provider = (await connector?.getProvider?.()) ?? (window as any).ethereum;
    } catch {
      provider = (window as any).ethereum;
    }
    if (!provider?.request) {
      toast({
        title: "Wallet not found",
        description: "Connect a wallet that can switch networks.",
        variant: "destructive",
      });
      return;
    }

    setPending(true);
    const target = hexChainId(net.id);
    try {
      try {
        await providerRequest(provider, "wallet_switchEthereumChain", [{ chainId: target }]);
      } catch (switchErr: any) {
        const code = switchErr?.code;
        if (code === 4001) {
          toast({ title: "Request cancelled", description: "You cancelled the request.", variant: "destructive" });
          return;
        }
        await providerRequest(provider, "wallet_addEthereumChain", [
          {
            chainId: target,
            chainName: net.name,
            nativeCurrency: net.native,
            rpcUrls: [net.rpc],
            blockExplorerUrls: [net.explorer],
          },
        ]);
      }
      setChainId(net.id);
      toast({ title: "Network switched", description: `Now on ${net.name}.` });
    } catch (err: any) {
      if (err?.code === 4001) {
        toast({ title: "Request cancelled", description: "You cancelled the request.", variant: "destructive" });
      } else {
        toast({
          title: "Couldn't switch network",
          description: err?.message || "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={current ? `Network: ${current.name}` : "Select network"}
          className={
            className ??
            "flex items-center gap-2 glass glass-hover px-3 py-1.5 sm:px-4 sm:py-2 rounded-full transition-all cursor-pointer"
          }
        >
          {current ? (
            <ChainMark icon={current.icon} name={current.name} iconBg={current.iconBg} size="md" />
          ) : (
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white">
              ?
            </span>
          )}
          <span className="text-xs sm:text-sm font-medium text-white hidden sm:inline">
            {current?.name ?? (chainId != null ? `Chain ${chainId}` : "Network")}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-white/70 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 p-1.5 glass rounded-2xl border-white/10"
      >
        {WALLET_NETWORKS.map((net) => {
          const active = net.id === chainId;
          return (
            <DropdownMenuItem
              key={net.id}
              disabled={pending}
              onSelect={() => {
                void switchTo(net);
              }}
              className={`cursor-pointer rounded-xl px-2 py-2 text-sm text-white focus:bg-white/10 focus:text-white ${
                active ? "bg-white/10" : ""
              }`}
            >
              <ChainMark icon={net.icon} name={net.name} iconBg={net.iconBg} />
              <span className="flex-1 truncate">{net.name}</span>
              {active && <Check className="h-4 w-4 text-white/80" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
