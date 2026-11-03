"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { usePathname, useRouter } from "next/navigation";
import { useStudioWallet } from "./useStudioWallet";
import { ChainLogo, NETWORKS, NetworkList, POPOVER, POPOVER_TITLE, getInjectedWallet, switchWalletChain, type NetworkId } from "@/components/admin/CreateNewCampaign";
import { useStudioNetwork } from "@/lib/studioNetwork";
import { OPEN_PROPOSALS_EVENT, useProposalNotifications } from "./useProposalNotifications";
import NotificationsPanel from "./NotificationsPanel";
import { describeNotice, noticeUrl, useProjectNotifications } from "./useProjectNotifications";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const POPPED_KEY = "nexura:studio-notices-popped";
import { STUDIO_SIGN_IN_URL, useProjectSession } from "./useProjectSession";
import SignInPrompt from "./SignInPrompt";
import { clearProjectSession, getStoredProjectInfo, projectApiRequest } from "@/lib/projectApi";

import { MAIN_APP_URL as NEXURA_MAIN_APP_URL } from "@/lib/mainAppUrl";

const shortAddress = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

type Menu = "network" | "bell" | "wallet" | "avatar" | "signin-bell" | "signin-wallet" | null;

/**
 * The one header used across Nexura Studio: sign up / sign in, the dashboard pages, Profile and the
 * campaign builder. Network, wallet and notifications come from shared state, so they are the same
 * on every page and in every open tab.
 */
export default function StudioHeader({ title, showLogo = false, network: controlledNetwork, onNetworkChange, extra }: {
  title?: string;
  /** Show the Nexura logo instead of a page title (sign up, sign in). */
  showLogo?: boolean;
  /** The campaign builder drives the network from the campaign's reward network. */
  network?: NetworkId;
  onNetworkChange?: (id: NetworkId) => void;
  /** Extra controls shown before the wallet, e.g. the builder's save status. */
  extra?: ReactNode;
}) {
  const { address: connectedAddress, connect: connectWallet, disconnect: disconnectWallet, verified, verifying, verifyDeclined, verify, live } = useStudioWallet();
  const signedIn = useProjectSession();
  // Dashboard pages show the wallet only while the Studio session is valid; sign up / sign in always can
  const walletAddress = signedIn || showLogo ? connectedAddress : null;
  const needsSignIn = !signedIn && !showLogo;
  const { chainId } = useAccount();
  const [sharedNetwork, setSharedNetwork] = useStudioNetwork();
  const network = controlledNetwork ?? sharedNetwork;
  const [open, setOpen] = useState<Menu>(null);
  // A wallet that connects or is switched to in the extension signs once to prove it is theirs
  useEffect(() => {
    if (signedIn && walletAddress && live && !verified && !verifying && !verifyDeclined) void verify();
  }, [walletAddress, live, verified, verifying, verifyDeclined, verify]);

  // Signed in with one wallet and switched to another in the extension: the session ends
  useEffect(() => {
    if (!signedIn || !live) return;
    const signedInWith = String(getStoredProjectInfo()?.walletAddress ?? "");
    if (!signedInWith || signedInWith.toLowerCase() === live.toLowerCase()) return;
    void (async () => {
      try { await projectApiRequest({ method: "POST", endpoint: "/hub/logout" }); } catch { /* ends locally either way */ }
      clearProjectSession();
      try { sessionStorage.setItem("nexura:signed-out-reason", "You switched wallets. Sign in with the wallet linked to your studio."); } catch { /* ignore */ }
      router.push(STUDIO_SIGN_IN_URL);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, live]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { items: allNotifications, unread: allUnread, markRead } = useProposalNotifications();
  const { items: allNotices, unread: noticesUnread, markRead: markNoticesRead } = useProjectNotifications();
  const notifications = signedIn ? allNotifications : [];
  const notices = signedIn ? allNotices : [];
  const unread = signedIn ? allUnread + noticesUnread : 0;

  // A new project settings notice pops up once (per notice, on any device it first reaches)
  const { toast } = useToast();
  useEffect(() => {
    if (!signedIn) return;
    let popped: string[] = [];
    try { popped = JSON.parse(localStorage.getItem(POPPED_KEY) ?? "[]"); } catch { /* ignore */ }
    const fresh = notices.filter(n => !n.readByMe && !popped.includes(n.id));
    if (!fresh.length) return;
    try { localStorage.setItem(POPPED_KEY, JSON.stringify([...popped, ...fresh.map(n => n.id)].slice(-200))); } catch { /* ignore */ }
    const newest = fresh[0];
    const d = describeNotice(newest);
    toast({
      title: fresh.length > 1 ? `${fresh.length} new updates` : newest.kind === "campaign" ? "Campaign is live" : "Project settings changed",
      description: `${d.who} ${d.what}.`,
      action: (
        <ToastAction altText="View changes" onClick={() => { markNoticesRead([newest.id]); router.push(noticeUrl(newest)); }}>
          View
        </ToastAction>
      ),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, notices]);
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // Follow the network the connected wallet is on
  useEffect(() => {
    const match = NETWORKS.find(n => n.chainId === chainId);
    if (match) { setSharedNetwork(match.id); if (controlledNetwork && match.id !== controlledNetwork) onNetworkChange?.(match.id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]);

  // The builder's chosen network becomes the shared one too
  useEffect(() => { if (controlledNetwork) setSharedNetwork(controlledNetwork); }, [controlledNetwork, setSharedNetwork]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  useEffect(() => { if (!walletAddress && open === "wallet") setOpen(null); }, [walletAddress, open]);

  const active = NETWORKS.find(n => n.id === network) || NETWORKS[0];
  const toggle = (m: Exclude<Menu, null>) => setOpen(o => (o === m ? null : m));

  const changeNetwork = (id: NetworkId) => {
    setOpen(null);
    setSharedNetwork(id);
    onNetworkChange?.(id);
    const eth = getInjectedWallet();
    const net = NETWORKS.find(n => n.id === id);
    if (eth && net?.chainId) switchWalletChain(eth, net.chainId).catch(() => {});
  };

  const openProposal = () => {
    setOpen(null);
    if (pathname?.includes("/studio-dashboard/admin-management")) window.dispatchEvent(new Event(OPEN_PROPOSALS_EVENT));
    else router.push("/studio-dashboard/admin-management?tab=proposals");
  };

  // Disconnecting the wallet also ends the Studio session: connecting again means signing in again
  const disconnectAndSignOut = async () => {
    setOpen(null);
    disconnectWallet();
    if (!signedIn) return;
    try { await projectApiRequest({ method: "POST", endpoint: "/hub/logout" }); } catch { /* ends locally either way */ }
    clearProjectSession();
    router.push(STUDIO_SIGN_IN_URL);
  };

  const menuItem = "flex w-full items-center gap-[9px] rounded-[10px] px-[9px] py-[7px] text-left text-[12.5px] font-semibold text-[#1c2533] hover:bg-[#f7f4fe]";

  return (
    <header
      className="sticky top-0 z-[100] flex h-[60px] w-full shrink-0 items-center justify-between gap-3 border-b-[0.833px] border-[rgba(28,37,51,0.19)] bg-[rgba(255,255,255,0.29)] px-4 backdrop-blur-[8px] sm:px-[36px]"
      style={{ fontFamily: "Geist, var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" }}
    >
      {showLogo ? (
        <Link href="/studio" aria-label="Nexura Studio home" className="block h-[28px] w-[110px] shrink-0">
          <img src="/studio-auth/logo.png" alt="Nexura" className="h-full w-full object-cover" />
        </Link>
      ) : (
        <span className="truncate whitespace-nowrap text-[20px] font-semibold leading-[20.93px] text-[#1c2533]">{title}</span>
      )}

      <div ref={ref} className="flex items-center gap-[10px]">
        {/* Network */}
        <div className="relative hidden sm:block">
          <button
            type="button" aria-haspopup="listbox" aria-expanded={open === "network"} onClick={() => toggle("network")}
            className="flex items-center gap-[9px] rounded-[999px] border-[1.25px] border-[rgba(28,37,51,0.15)] bg-white px-[16px] py-[8px] drop-shadow-[0px_3px_5px_rgba(0,0,0,0.17)]"
          >
            <ChainLogo logo={active.logo} size={16} />
            <span className="whitespace-nowrap text-[13.5px] font-semibold text-[#1c2533]">{active.name}</span>
            <img src="/studio-auth/chevron-down.svg" alt="" width={15.9961} height={15.9961} className={`shrink-0 transition-transform ${open === "network" ? "rotate-180" : ""}`} />
          </button>
          {open === "network" && (
            <div style={{ ...POPOVER, right: 0, width: 220, borderRadius: 16, padding: 5 }}>
              <div style={{ ...POPOVER_TITLE, fontSize: 10.5, padding: "6px 9px 4px" }}>Network</div>
              <NetworkList value={network} onSelect={changeNetwork} />
            </div>
          )}
        </div>

        {/* Theme */}
        <div role="radiogroup" aria-label="Theme" className="hidden h-[38px] items-center gap-[2px] rounded-[999px] border border-[rgba(28,37,51,0.09)] bg-[#f7f4fe] p-[2.833px] md:flex">
          {(["light", "dark"] as const).map(t => (
            <button
              key={t} type="button" role="radio" aria-checked={theme === t} aria-label={t === "light" ? "Light theme" : "Dark theme"}
              onClick={() => setTheme(t)}
              className={`flex size-[26px] items-center justify-center rounded-[999px] ${theme === t ? "bg-[#8a3ffc]" : ""}`}
            >
              <img src={t === "light" ? "/studio-auth/sun.svg" : "/studio-auth/moon.svg"} alt="" width={14} height={14} />
            </button>
          ))}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-expanded={open === "bell" || open === "signin-bell"}
            onClick={() => toggle(signedIn ? "bell" : "signin-bell")}
            className="relative flex size-[37.99px] items-center justify-center rounded-[40px] border border-[rgba(28,37,51,0.09)] bg-[#f7f5ff]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2.5A4 4 0 005 6.5V10.5L3.5 12.5h11L13 10.5V6.5A4 4 0 009 2.5z" stroke="#6B7280" strokeWidth="1.3"/><path d="M7.5 14.5a1.5 1.5 0 003 0" stroke="#6B7280" strokeWidth="1.3" strokeLinecap="round"/></svg>
            {unread > 0 && (
              <span className="absolute left-[20.7px] top-[-5px] box-border h-[19px] min-w-[19px] rounded-[10px] border-[1.667px] border-[#faf9ff] bg-[#e4545b] px-[5px] text-center text-[11px] font-bold leading-[15.7px] text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {open === "signin-bell" && <SignInPrompt what="see your notifications" onSignIn={() => { setOpen(null); router.push(STUDIO_SIGN_IN_URL); }} />}
          {open === "bell" && signedIn && (
            <NotificationsPanel
              items={notifications} notices={notices} unread={unread} onOpen={openProposal} onMarkRead={markRead}
              onMarkNoticesRead={markNoticesRead}
              onOpenNotice={n => { setOpen(null); router.push(noticeUrl(n)); }}
              onViewAll={openProposal}
              onViewChanges={() => { setOpen(null); router.push("/studio-dashboard/admin-management?tab=history"); }}
            />
          )}
        </div>

        {extra}

        {/* Wallet */}
        <div className="relative">
          {!walletAddress ? (
            <button
              type="button" onClick={() => { if (needsSignIn) { toggle("signin-wallet"); return; } setOpen(null); connectWallet(); }}
              className="flex h-[38px] items-center gap-[8px] whitespace-nowrap rounded-[999px] border border-[rgba(255,255,255,0.08)] pl-[12.833px] pr-[12px] py-[6.833px]"
              style={{ backgroundImage: "linear-gradient(164.92deg, rgb(124, 58, 237) 0%, rgb(107, 33, 216) 100%)" }}
            >
              <img src="/studio-auth/wallet.svg" alt="" className="size-[15.996px] shrink-0" />
              <span className="text-[12.5px] font-semibold text-[#f7f5ff]">Connect wallet</span>
            </button>
          ) : (
            <button
              type="button" aria-haspopup="menu" aria-expanded={open === "wallet"} onClick={() => toggle("wallet")}
              className="flex h-[38px] items-center gap-[9px] rounded-[999px] border-[1.25px] border-[#e3def3] px-[16px] py-[8px]"
              style={{ backgroundImage: "linear-gradient(167.98deg, rgb(124, 58, 237) 0%, rgb(107, 33, 216) 100%)" }}
            >
              <span className={`size-[7.988px] shrink-0 rounded-[3.994px] ${verified ? "bg-[#00e1a2] shadow-[0px_0px_0px_3px_rgba(0,225,162,0.2)]" : "bg-[#f5a524] shadow-[0px_0px_0px_3px_rgba(245,165,36,0.25)]"}`} />
              <span className="whitespace-nowrap text-[13.5px] font-semibold text-white">{!verified && verifying ? "Check your wallet" : shortAddress(walletAddress)}</span>
              <img src="/studio-auth/chevron-down-white.svg" alt="" className={`size-[15.996px] shrink-0 transition-transform ${open === "wallet" ? "rotate-180" : ""}`} />
            </button>
          )}
          {open === "signin-wallet" && <SignInPrompt what="connect your wallet" onSignIn={() => { setOpen(null); router.push(STUDIO_SIGN_IN_URL); }} />}
          {open === "wallet" && walletAddress && (
            <div style={{ ...POPOVER, right: 0, width: 210, borderRadius: 16, padding: 5 }}>
              <button type="button" onClick={disconnectAndSignOut} className={`${menuItem} text-[#EF4444] hover:bg-[rgba(239,68,68,0.06)]`}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 14H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2H6M10.5 11.5L14 8l-3.5-3.5M14 8H6" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Disconnect wallet
              </button>
            </div>
          )}
        </div>

        {/* Account */}
        <div className="relative">
          <button
            type="button" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open === "avatar"} onClick={() => toggle("avatar")}
            className="relative flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[#6a4dff]"
          >
            <img src="/studio-auth/user.svg" alt="" className="size-[15.2px]" />
            <span className="absolute left-[2.54px] top-0 size-[35.467px] rounded-full border-[0.633px] border-[rgba(255,255,255,0.1)]">
              <span className={`absolute left-[25.96px] top-[28.5px] size-[7.6px] rounded-full border-[1.267px] border-[#111317] ${signedIn ? "bg-[#22c55e]" : "bg-[#98a0b4]"}`} />
            </span>
          </button>
          {open === "avatar" && (
            <div role="menu" style={{ ...POPOVER, right: 0, width: 200, borderRadius: 16, padding: 5 }}>
              {signedIn ? (
                <>
                  <a role="menuitem" href={NEXURA_MAIN_APP_URL} className={menuItem}>Back to Main App</a>
                </>
              ) : (
                <>
                  <Link role="menuitem" href={STUDIO_SIGN_IN_URL} onClick={() => setOpen(null)} className={menuItem}>Sign in</Link>
                  <a role="menuitem" href={NEXURA_MAIN_APP_URL} className={menuItem}>Back to Main App</a>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
