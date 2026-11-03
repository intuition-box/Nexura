"use client";

import { useCallback, useEffect, useState } from "react";
import { projectApiRequest } from "@/lib/projectApi";

export type HubInfo = {
  _id?: string; name?: string; description?: string; categories?: string[]; website?: string; xAccount?: string; logo?: string;
  discordConnected?: boolean; discordServer?: string; superAdmin?: string;
  telegramConnected?: boolean; telegramHandle?: string; xConnected?: boolean;
};
export type AdminInfo = { _id: string; name?: string; email?: string; role?: string; twoFactorEnabled?: boolean; usernameChanges?: number; usernameChangesAllowed?: number };

export function useStudioProfile() {
  const [hub, setHub] = useState<HubInfo | null>(null);
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [adminCount, setAdminCount] = useState(0);
  const [campaignCount, setCampaignCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [me, admins, campaigns] = await Promise.allSettled([
      projectApiRequest<{ hub: HubInfo; admin: AdminInfo }>({ method: "GET", endpoint: "/hub/me" }),
      projectApiRequest<{ admins?: unknown[]; pendingInvites?: unknown[] }>({ method: "GET", endpoint: "/hub/hub-admins" }),
      projectApiRequest<{ hubCampaigns?: unknown[] }>({ method: "GET", endpoint: "/hub/get-campaigns" }),
    ]);
    if (me.status === "fulfilled") { setHub(me.value.hub ?? null); setAdmin(me.value.admin ?? null); }
    if (admins.status === "fulfilled") setAdminCount((admins.value.admins?.length ?? 0) + (admins.value.pendingInvites?.length ?? 0));
    if (campaigns.status === "fulfilled") setCampaignCount(campaigns.value.hubCampaigns?.length ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const isOwner = !!hub?.superAdmin && !!admin?._id && String(hub.superAdmin) === String(admin._id);
  const roleLabel = isOwner ? "Owner" : admin?.role === "superadmin" ? "Super Admin" : "Admin";
  // Owner and Super Admins see the connected accounts; only the Owner changes them
  const canSeeAccounts = isOwner || admin?.role === "superadmin";
  const socials = {
    x: !!hub?.xAccount,
    discord: !!hub?.discordConnected,
    telegram: !!hub?.telegramConnected,
  };
  const linkedSocials = Object.values(socials).filter(Boolean).length;

  const steps = [
    { key: "email", done: !!admin?.email },
    { key: "project", done: !!hub?.name && !!hub?.description },
    { key: "socials", done: linkedSocials >= 2 },
    { key: "admin", done: adminCount > 1 },
    { key: "campaign", done: campaignCount > 0 },
  ];

  return { hub, admin, loading, reload, isOwner, canSeeAccounts, roleLabel, socials, linkedSocials, steps, setHub, setAdmin };
}

export type StudioProfile = ReturnType<typeof useStudioProfile>;
