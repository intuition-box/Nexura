"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Row, SmallButton, StatusPill, Value } from "./ProfileUI";
import type { StudioProfile } from "./useStudioProfile";
import { projectApiRequest } from "@/lib/projectApi";
import { beginStudioDiscordConnect } from "@/lib/studioDiscord";
import { useToast } from "@/hooks/use-toast";
import { PICTURE_ACCEPT, pictureProblem } from "../auth/AuthUI";
import { initialsLogo } from "../auth/initialsLogo";
import { STUDIO_X_RETURN_KEY, getAuthUrl } from "@/lib/generateXAuthUrl";
import CategoryPicker, { CategoryTags } from "../auth/CategoryPicker";
import { MAX_HUB_CATEGORIES } from "@/lib/hubCategories";

export type SetupTarget = "project" | "accounts" | "account";

type Availability = { state: "idle" | "checking" | "ok" | "bad"; reason?: string };

function UsernameRow({ p }: { p: StudioProfile }) {
  const { toast } = useToast();
  const name = p.admin?.name ?? "";
  const allowed = p.admin?.usernameChangesAllowed ?? 2;
  const left = Math.max(0, allowed - (p.admin?.usernameChanges ?? 0));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [avail, setAvail] = useState<Availability>({ state: "idle" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const value = draft.trim();
    if (!value || value.toLowerCase() === name.toLowerCase()) { setAvail({ state: "idle" }); return; }
    setAvail({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const res = await projectApiRequest<{ available: boolean; reason?: string | null }>({ method: "GET", endpoint: "/hub/username-available", params: { username: value } });
        setAvail(res.available ? { state: "ok" } : { state: "bad", reason: res.reason ?? "That username is taken." });
      } catch {
        setAvail({ state: "bad", reason: "Couldn't check right now. Try again." });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [draft, editing, name]);

  const save = async () => {
    if (avail.state !== "ok") return;
    setSaving(true);
    try {
      await projectApiRequest({ method: "PATCH", endpoint: "/hub/username", data: { username: draft.trim() } });
      await p.reload();
      setEditing(false);
      toast({ title: "Username updated", description: left - 1 > 0 ? `You can change it ${left - 1} more time.` : "That was your last username change." });
    } catch (e: any) {
      toast({ title: "Couldn't change username", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const hint = left > 0 ? `The name you sign in with. You can change it ${left} more time${left === 1 ? "" : "s"}.` : "The name you sign in with. You've used both changes.";

  return (
    <Row title="Username" text={hint} align={editing ? "start" : "center"}>
      {editing ? (
        <div className="flex w-full flex-col items-end gap-[8px] sm:w-[399px]">
          <input
            autoFocus value={draft} onChange={e => setDraft(e.target.value.replace(/\s/g, ""))} maxLength={30} aria-label="New username"
            onKeyDown={e => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }}
            className="h-[45.488px] w-full min-w-[240px] rounded-[12px] border-[1.25px] border-[#8a3ffc] bg-[#f4f1fc] px-[13px] py-[11px] text-[14px] leading-[21px] text-[#1c2533] shadow-[0px_0px_0px_3px_rgba(138,63,252,0.1)] outline-none"
          />
          <span aria-live="polite" className={`self-start text-[12.5px] leading-[19px] ${avail.state === "ok" ? "text-[#00a87c]" : avail.state === "bad" ? "text-[#e4545b]" : "text-[#69728a]"}`}>
            {avail.state === "checking" ? "Checking…" : avail.state === "ok" ? "Available" : avail.state === "bad" ? avail.reason : "3 to 30 letters, numbers, dots or underscores."}
          </span>
          <div className="flex gap-[8px]">
            <SmallButton onClick={save} disabled={saving || avail.state !== "ok"}>{saving ? "Saving…" : "Save"}</SmallButton>
            <SmallButton variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</SmallButton>
          </div>
        </div>
      ) : (
        <>
          <Value>{name ? `@${name}` : "Not set yet"}</Value>
          {left > 0 && (
            <SmallButton variant="outline" onClick={() => { setDraft(name); setAvail({ state: "idle" }); setEditing(true); }}>
              Edit <img src="/studio-profile/edit.svg" alt="" className="size-[12.988px]" />
            </SmallButton>
          )}
        </>
      )}
    </Row>
  );
}

export function MyProfilePanel({ p }: { p: StudioProfile }) {
  const name = p.admin?.name ?? "";
  const initial = (name || p.admin?.email || "N").trim()[0]?.toUpperCase();
  return (
    <Card title="My Profile">
      <div className="flex w-full items-center gap-[16px] border-b-[1.25px] border-[rgba(28,37,51,0.09)] pb-[18px] pt-[14px]">
        <span className="flex size-[60px] shrink-0 items-center justify-center rounded-[68px] text-[24px] font-bold leading-[37.2px] text-white" style={{ backgroundImage: "linear-gradient(135deg, #8a3ffc 0%, #6e2bd8 100%)" }}>
          {initial}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[18px] font-bold leading-[27.9px] text-[#1c2533]">{name ? `@${name}` : "Your account"}</span>
          <span className="truncate text-[14px] leading-[21.7px] text-[#1c2533]">{[p.roleLabel, p.hub?.name].filter(Boolean).join(" · ")}</span>
        </span>
      </div>
      <UsernameRow p={p} />

      <Row title="Email address" text="The email associated with your account.">
        <Value>{p.admin?.email ?? "No email on this account"}</Value>
        {p.admin?.email && <StatusPill tone="green">Verified</StatusPill>}
      </Row>
      <Row title="Role" text="Your access level in this studio." last>
        <StatusPill tone="purple">{p.roleLabel}</StatusPill>
      </Row>
    </Card>
  );
}

export function StudioSetupPanel({ p, go }: { p: StudioProfile; go: (t: SetupTarget) => void }) {
  const router = useRouter();
  const done = p.steps.filter(s => s.done).length;
  const pct = Math.round((done / p.steps.length) * 100);
  const isDone = (key: string) => p.steps.find(s => s.key === key)?.done;
  const action = (key: string, label: string, onClick: () => void) =>
    isDone(key) ? <StatusPill tone="green">Done</StatusPill> : <SmallButton onClick={onClick}>{label}</SmallButton>;

  return (
    <Card title="Studio setup">
      <div className="w-full border-b-[1.25px] border-[rgba(28,37,51,0.09)] pb-[20px] pt-[18px]">
        <div className="flex justify-between text-[13px] leading-[20.15px] text-[#1c2533]">
          <b className="font-bold">{done} of {p.steps.length} complete</b>
          <span>{pct}%</span>
        </div>
        <div className="mt-[8px] h-[7.988px] w-full overflow-hidden rounded-[20px] bg-[#efeafb]">
          <div className="h-full rounded-[20px] bg-[#8a3ffc] transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Row title="Verify your email" text="Needed for sign-in and account recovery.">
        {action("email", "Verify", () => go("account"))}
      </Row>
      <Row title="Add project details" text="Shown on your campaigns.">
        {action("project", "Set up", () => go("project"))}
      </Row>
      <Row title="Connect your socials" text={`${p.linkedSocials} of 3 linked. Link at least two.`}>
        {isDone("socials") || p.isOwner ? action("socials", "Set up", () => go("accounts")) : null}
      </Row>
      <Row title="Invite an admin" text="Add Super admins and admins to your studio.">
        {action("admin", "Add Admin", () => router.push("/studio-dashboard/admin-management"))}
      </Row>
      <Row title="Create your first campaign" text="Build and launch your first campaign." last>
        {action("campaign", "Set up", () => router.push("/studio-dashboard/create-new-campaign"))}
      </Row>
    </Card>
  );
}

export function ConnectedAccountsPanel({ p }: { p: StudioProfile }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const connectX = async () => {
    setBusy("x");
    try {
      localStorage.setItem(STUDIO_X_RETURN_KEY, "/studio-dashboard/hub-profile?tab=accounts");
      window.location.href = await getAuthUrl();
    } catch {
      try { localStorage.removeItem(STUDIO_X_RETURN_KEY); } catch { /* ignore */ }
      toast({ title: "Couldn't start X sign-in", description: "Sign in to the Nexura app with your wallet, then try again.", variant: "destructive" });
      setBusy(null);
    }
  };

  const connectTelegram = async () => {
    setBusy("telegram");
    try {
      const { url } = await projectApiRequest<{ url?: string }>({ method: "GET", endpoint: "/hub/telegram/connect" });
      if (!url) throw new Error("no link returned");
      window.location.href = url;
    } catch {
      toast({ title: "Not available yet", description: "Linking Telegram to your studio isn't switched on yet.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const disconnect = async (provider: "x" | "discord" | "telegram") => {
    setBusy(provider);
    try {
      if (provider === "x") {
        const fd = new FormData();
        fd.append("xAccount", "");
        await projectApiRequest({ method: "PATCH", endpoint: "/hub/update-hub", formData: fd });
      } else {
        await projectApiRequest({ method: "PATCH", endpoint: provider === "discord" ? "/hub/disconnect-discord" : "/hub/telegram/disconnect" });
      }
      await p.reload();
      toast({ title: "Disconnected" });
    } catch (e: any) {
      toast({ title: "Couldn't disconnect", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const rows = [
    { key: "x" as const, title: "Project X account", text: "Your project's X account, not your personal one. Used to verify X tasks.", connected: p.socials.x, handle: p.hub?.xAccount ? `@${p.hub.xAccount.replace(/^@/, "")}` : "", connect: connectX },
    { key: "discord" as const, title: "Project Discord server", text: "Your project's Discord server, not your personal account. Used to verify Discord tasks.", connected: p.socials.discord, handle: p.hub?.discordServer ?? "", connect: () => beginStudioDiscordConnect("/studio-dashboard/hub-profile?tab=accounts") },
    { key: "telegram" as const, title: "Project Telegram", text: "Your project's Telegram group or channel, not your personal account. Used to verify Telegram tasks.", connected: p.socials.telegram, handle: p.hub?.telegramHandle ?? "", connect: connectTelegram },
  ];

  return (
    <Card id="accounts" title="Connected accounts" text="Link your project's accounts, not your personal ones. Nexura uses them to verify the tasks participants complete.">
      <div className="w-full pt-[18px]">
        {rows.map((r, i) => (
          <Row key={r.key} title={r.title} text={r.text} last={i === rows.length - 1}>
            {r.connected ? (
              <>
                <img src="/studio-profile/verified.svg" alt="Verified" className="size-[24px]" />
                <Value>{r.handle || "Connected"}</Value>
                {p.isOwner && <SmallButton variant="outline" disabled={busy === r.key} onClick={() => disconnect(r.key)}>Disconnect</SmallButton>}
              </>
            ) : (
              <>
                <Value>Not connected</Value>
                {p.isOwner && <SmallButton disabled={busy === r.key} onClick={r.connect}>Connect</SmallButton>}
              </>
            )}
          </Row>
        ))}
      </div>
    </Card>
  );
}

type ProjectField = "name" | "website" | "description";

/** The project picture at the top of Project details: add or change it, or go back to the initials logo. */
function ProjectPictureRow({ p }: { p: StudioProfile }) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const logo = (p.hub?.logo as string | undefined) ?? "";

  const upload = async (file: Blob, filename: string, done: string) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("logo", file, filename);
      await projectApiRequest({ method: "PATCH", endpoint: "/hub/update-hub", formData: fd });
      await p.reload();
      toast({ title: done });
    } catch (e: any) {
      toast({ title: "Couldn't update the picture", description: e?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const pick = (f: File) => {
    const problem = pictureProblem(f);
    if (problem) return toast({ title: problem, variant: "destructive" });
    void upload(f, f.name, "Picture updated");
  };
  const remove = async () => upload(await initialsLogo(String(p.hub?.name ?? "")), "logo.png", "Picture removed");
  const open = () => input.current?.click();

  return (
    <div className="flex w-full flex-wrap items-center gap-[22px] pt-[18px]">
      <input ref={input} type="file" accept={PICTURE_ACCEPT} hidden onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
      <button
        type="button" onClick={open} disabled={busy} aria-label={logo ? "Change profile picture" : "Add profile picture"}
        className={`relative flex size-[103.984px] shrink-0 flex-col items-center justify-center gap-[4px] overflow-hidden rounded-[28px] border-[1.25px] bg-[#f4f1fc] ${logo ? "border-[rgba(28,37,51,0.09)]" : "border-dashed border-[rgba(138,63,252,0.32)]"}`}
      >
        {logo ? (
          <img src={logo} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <img src="/studio-profile/add-photo.svg" alt="" className="size-[21.992px]" />
            <span className="text-[12px] font-semibold leading-[18.6px] text-[#8a3ffc]">Add photo</span>
          </>
        )}
      </button>
      <div className="flex min-w-[220px] flex-1 flex-col items-start">
        <span className="text-[15px] font-bold leading-[23.25px] text-[#1c2533]">Profile picture</span>
        <p className="max-w-[380px] pt-[4px] text-[13px] leading-[19.5px] text-[#69728a]">Upload a square image of your project logo or brand mark. PNG, JPG or WebP, up to 5 MB.</p>
        <div className="flex gap-[8px] pt-[12px]">
          <SmallButton variant="outline" className="transition-colors hover:border-[#8a3ffc] hover:bg-[#8a3ffc] hover:text-white" onClick={open} disabled={busy}>{busy ? "Saving…" : logo ? "Change picture" : "Upload picture"}</SmallButton>
          {logo && <SmallButton variant="outline" className="transition-colors hover:border-[#8a3ffc] hover:bg-[#8a3ffc] hover:text-white" onClick={remove} disabled={busy}>Remove</SmallButton>}
        </div>
      </div>
    </div>
  );
}

function TagsRow({ p }: { p: StudioProfile }) {
  const { toast } = useToast();
  const current = p.hub?.categories ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft.length) return toast({ title: "Pick at least one tag", variant: "destructive" });
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("categories", JSON.stringify(draft));
      await projectApiRequest({ method: "PATCH", endpoint: "/hub/update-hub", formData: fd });
      await p.reload();
      setEditing(false);
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Row
      title="Tags" text={`Choose the tags that relate to what your project does. You can choose up to ${MAX_HUB_CATEGORIES}.`}
      below={editing ? (
        <div className="flex w-full flex-col items-end gap-[8px]">
          <CategoryPicker value={draft} onChange={setDraft} bare />
          <div className="flex items-center gap-[8px]">
            <span className="text-[12px] text-[#69728a]">{draft.length}/{MAX_HUB_CATEGORIES}</span>
            <SmallButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</SmallButton>
            <SmallButton variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</SmallButton>
          </div>
        </div>
      ) : current.length ? <CategoryTags tags={current} /> : "No tags yet"}
    >
      {!editing && (
        <SmallButton variant={current.length ? "outline" : "primary"} onClick={() => { setDraft(current); setEditing(true); }}>
          {current.length ? <>Edit <img src="/studio-profile/edit.svg" alt="" className="size-[12.988px]" /></> : "Add tags"}
        </SmallButton>
      )}
    </Row>
  );
}

const inputCls = "w-full rounded-[12px] border-[1.25px] border-[#8a3ffc] bg-[#f4f1fc] px-[13px] py-[11px] text-[14px] leading-[21px] text-[#1c2533] shadow-[0px_0px_0px_3px_rgba(138,63,252,0.1)] outline-none";

export function ProjectPanel({ p }: { p: StudioProfile }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<ProjectField | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const fields: { key: ProjectField; title: string; text: string; empty: string }[] = [
    { key: "name", title: "Project name", text: "How your project appears on every campaign.", empty: "No name yet" },
    { key: "website", title: "Website", text: "Where participants go to learn more about you.", empty: "No website yet" },
    { key: "description", title: "Description", text: "What your project does, in a sentence or two.", empty: "No description yet" },
  ];

  const save = async () => {
    if (!editing) return;
    const value = draft.trim();
    if (editing === "name" && !value) return toast({ title: "Add a project name", variant: "destructive" });
    if (editing === "website" && value && !/^https?:\/\/\S+$/i.test(value)) return toast({ title: "Use a full web address", description: "Start it with https://", variant: "destructive" });
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append(editing, value);
      await projectApiRequest({ method: "PATCH", endpoint: "/hub/update-hub", formData: fd });
      await p.reload();
      setEditing(null);
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const actions = (counter?: string) => (
    <div className="flex items-center gap-[8px]">
      {counter && <span className="text-[12px] text-[#69728a]">{counter}</span>}
      <SmallButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</SmallButton>
      <SmallButton variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</SmallButton>
    </div>
  );

  return (
    <Card id="project" title="Project details" text="Shown on your campaigns and public pages.">
      <ProjectPictureRow p={p} />
      <div className="w-full pt-[26px]">
        {fields.map(f => (
          <Fragment key={f.key}>
            {fieldRow(f)}
            {f.key === "name" && <TagsRow p={p} />}
          </Fragment>
        ))}
      </div>
    </Card>
  );

  function fieldRow(f: (typeof fields)[number]) {
    const current = (p.hub?.[f.key] as string | undefined) ?? "";
    const editButton = (
      <SmallButton variant="outline" onClick={() => { setDraft(current); setEditing(f.key); }}>
        Edit <img src="/studio-profile/edit.svg" alt="" className="size-[12.988px]" />
      </SmallButton>
    );
    if (f.key === "description") {
      return (
        <Row
          title={f.title} text={f.text} last
          below={editing !== f.key ? (current || f.empty) : (
            <div className="flex w-full flex-col items-end gap-[8px]">
              <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} rows={4} maxLength={300} className={`resize-none ${inputCls}`} />
              {actions(`${draft.length}/300`)}
            </div>
          )}
        >
          {editing !== f.key && editButton}
        </Row>
      );
    }
    if (editing !== f.key) {
      return (
        <Row title={f.title} text={f.text}>
          <Value>{current || f.empty}</Value>
          {editButton}
        </Row>
      );
    }
    return (
      <Row title={f.title} text={f.text} align="start">
        <div className="flex w-full flex-col items-end gap-[8px] sm:w-[399px]">
          <input
            autoFocus value={draft} onChange={e => setDraft(e.target.value)} type={f.key === "website" ? "url" : "text"}
            onKeyDown={e => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(null); }}
            className={`h-[45.488px] min-w-[240px] ${inputCls}`}
          />
          {actions()}
        </div>
      </Row>
    );
  }
}
