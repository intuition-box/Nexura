"use client";

import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, CircleHelp, ImagePlus, Loader2, X } from "lucide-react";
import { apiRequestV2 } from "@/lib/queryClient";
import { projectApiRequest } from "@/lib/projectApi";
import { APP_HELP, STUDIO_HELP, type HelpArticle } from "./helpTopics";

type Mode = "app" | "studio";
type Kind = "feature" | "bug" | "help";
type Reply = { from: "team" | "reporter"; name: string; message: string; at: string };
type Report = { _id: string; kind: Kind; status: "open" | "replied" | "closed"; title: string; details: string; attachments: string[]; createdAt: string; unread: boolean; replies: Reply[] };
type HelpView = { name: "home" } | { name: "ticket" } | { name: "report"; id: string };

// Same minimums as the server (feedback.controller.ts)
export const TITLE_MIN = 10;
export const DETAILS_MIN = 30;
const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const POLL_MS = 3 * 60 * 1000;

const FORMS: Record<Kind, { title: string; details: string; send: string }> = {
  feature: { title: "What would you like to see?", details: "What would this help you do?", send: "Send request" },
  bug: { title: "What went wrong?", details: "What were you doing when it happened?", send: "Send report" },
  help: { title: "Subject", details: "How can we help?", send: "Open ticket" },
};
const TABS: { id: Kind; label: string }[] = [{ id: "feature", label: "Feature" }, { id: "bug", label: "Bug report" }, { id: "help", label: "Get help" }];
const KIND_LABEL: Record<Kind, string> = { feature: "Feature", bug: "Bug", help: "Support" };
const STATUS_LABEL: Record<Report["status"], string> = { open: "Open", replied: "Replied", closed: "Closed" };

function request<T>(mode: Mode, method: string, path: string, body?: FormData | Record<string, unknown>): Promise<T> {
  if (mode === "studio") {
    return projectApiRequest<T>({ method, endpoint: `/hub${path}`, ...(body instanceof FormData ? { formData: body } : body ? { data: body } : {}) });
  }
  return apiRequestV2(method, `/api/user${path}`, body ?? null);
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const remaining = (value: string, min: number) => Math.max(0, min - value.trim().length);

/*
 * Each surface follows its own design language:
 * - app: the main app's dark cards (rounded-2xl, #080808/#170F1F, white/10 borders) and Explore's outlined pill filters
 * - studio: the Studio kit (40px panels and buttons, 24px cards, 12px inputs, gradient segmented tabs)
 */
const THEMES = {
  app: {
    font: "'Geist', 'Inter', sans-serif",
    fab: "rounded-full bg-[#8B3EFE] text-white shadow-[0_8px_24px_rgba(139,62,254,0.45)] hover:bg-[#7a2ff0]",
    panel: "rounded-2xl border border-white/10 bg-[#0B0712]/95 backdrop-blur-xl text-white shadow-[0_24px_64px_rgba(0,0,0,0.65)]",
    pad: "px-5",
    title: "text-base font-semibold",
    close: "size-8 rounded-full border border-white/10 text-white/70 hover:bg-white/5 hover:text-white",
    tabsWrap: "flex flex-wrap gap-2",
    tab: "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
    tabOn: "border-[#B65FC8] text-white",
    tabOff: "border-[#00E1A233] text-white/60 hover:border-[#00E1A266] hover:text-white",
    label: "text-xs font-medium text-white/70",
    input: "rounded-xl border border-white/10 bg-[#170F1F] text-sm text-white placeholder:text-white/30 focus:border-[#8B3EFE]",
    eyebrow: "flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B65FC8] before:size-1.5 before:rounded-full before:bg-[#B65FC8] before:content-['']",
    card: "overflow-hidden rounded-2xl border border-white/10 bg-[#080808]",
    divider: "border-white/10",
    row: "hover:bg-white/[0.04]",
    rowTitle: "text-sm font-medium",
    meta: "text-xs text-white/50",
    body: "text-sm leading-relaxed text-white/70",
    stepNum: "bg-[#8B3EFE]/20 text-[#c9a6ff]",
    muted: "text-white/50",
    faint: "text-white/35",
    primary: "h-10 rounded-full bg-[#8B3EFE] text-sm font-semibold text-white hover:bg-[#7a2ff0]",
    ghost: "h-9 rounded-full border border-white/10 px-4 text-xs font-medium text-white hover:bg-white/5",
    thumb: "rounded-xl border border-white/10",
    meBubble: "rounded-2xl border border-white/10 bg-[#170F1F]",
    teamBubble: "rounded-2xl border border-[#8B3EFE]/30 bg-[#8B3EFE]/10",
  },
  studio: {
    font: "'Geist', 'Inter', sans-serif",
    fab: "rounded-full bg-[#8b3efe] text-white drop-shadow-[0px_8px_11px_rgba(138,63,252,0.55)] hover:bg-[#7c2ff0]",
    panel: "rounded-[40px] border-[0.833px] border-solid border-[rgba(28,37,51,0.15)] bg-white text-[#1c2533] drop-shadow-[0px_22px_25px_rgba(28,37,51,0.28)]",
    pad: "px-6",
    title: "text-[16.38px] font-semibold tracking-[-0.33px]",
    close: "size-8 rounded-full border-[0.833px] border-solid border-[rgba(28,37,51,0.15)] bg-[#f7f4fe] text-[#3d485c] hover:bg-[#efeafb]",
    tabsWrap: "inline-flex gap-[2px] rounded-[40px] border-[0.833px] border-solid border-[rgba(28,37,51,0.19)] bg-[#f4f1fc] p-[3px]",
    tab: "rounded-[40px] px-[14px] py-[7px] text-[13px] font-semibold transition-colors",
    tabOn: "text-white bg-[linear-gradient(150deg,#9b7cff_0%,#7c5cfc_45%,#5aa8ff_100%)]",
    tabOff: "text-[#69728a] hover:text-[#1c2533]",
    label: "text-[13px] font-semibold text-[#1c2533]",
    input: "rounded-[12px] border-[0.833px] border-solid border-[rgba(28,37,51,0.15)] bg-[#f4f1fc] text-[14px] text-[#1c2533] placeholder:text-[#98a0b4] focus:border-[#8a3ffc] focus:shadow-[0_0_0_3px_rgba(138,63,252,0.1)]",
    eyebrow: "text-[10.5px] font-semibold uppercase tracking-[1.365px] text-[#8e8ba3]",
    card: "overflow-hidden rounded-[24px] border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] bg-white",
    divider: "border-[rgba(28,37,51,0.09)]",
    row: "hover:bg-[#fbfaff]",
    rowTitle: "text-[14px] font-medium",
    meta: "text-[12px] text-[#69728a]",
    body: "text-[13.5px] leading-[21px] text-[#3d485c]",
    stepNum: "bg-[rgba(138,63,252,0.1)] text-[#6e2bd8]",
    muted: "text-[#69728a]",
    faint: "text-[#98a0b4]",
    primary: "min-h-[40px] rounded-[40px] bg-[#8b3efe] text-[14px] font-semibold text-white hover:bg-[#7c2ff0]",
    ghost: "min-h-[36px] rounded-[40px] border-[0.833px] border-solid border-[rgba(28,37,51,0.15)] bg-[#f7f4fe] px-4 text-[13px] font-semibold text-[#1c2533] hover:bg-[#efeafb]",
    thumb: "rounded-[12px] border-[0.833px] border-solid border-[rgba(28,37,51,0.09)]",
    meBubble: "rounded-[20px] bg-[#f4f5f8]",
    teamBubble: "rounded-[20px] bg-[rgba(138,63,252,0.08)]",
  },
};
type Theme = typeof THEMES.app;

export default function SupportWidget({ mode }: { mode: Mode }) {
  const t = THEMES[mode];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Kind>("feature");
  const [helpView, setHelpView] = useState<HelpView>({ name: "home" });
  const [reports, setReports] = useState<Report[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await request<{ reports: Report[]; unread: number }>(mode, "GET", "/feedback");
      setReports(res.reports ?? []);
      setUnread(res.unread ?? 0);
    } catch { /* the button still works; the list loads next time */ }
  }, [mode]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (panelRef.current && !panelRef.current.contains(target) && !target.closest("[data-support-button]")) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
  }, [open, load]);

  // Opening a report clears the unread marks
  const openReport = (id: string) => {
    setHelpView({ name: "report", id });
    if (reports.some(r => r.unread)) {
      setReports(rs => rs.map(r => ({ ...r, unread: false })));
      setUnread(0);
      void request(mode, "POST", "/feedback/seen", {}).catch(() => {});
    }
  };

  const onSent = (report: Report) => setReports(rs => [report, ...rs.filter(r => r._id !== report._id)]);

  const bottom = mode === "studio" ? "bottom-24 md:bottom-6" : "bottom-5";
  const side = mode === "studio" ? "right-4 md:right-6" : "right-5";
  const panelPos = mode === "studio"
    ? "bottom-[156px] md:bottom-[84px] max-h-[min(660px,calc(100dvh-180px))] md:max-h-[min(660px,calc(100dvh-110px))]"
    : "bottom-[76px] max-h-[min(660px,calc(100dvh-100px))]";

  return (
    <>
      <button
        type="button"
        data-support-button
        aria-label="Support & feedback"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`fixed ${bottom} ${side} z-[60] flex size-[46px] items-center justify-center transition-colors ${t.fab}`}
      >
        {open ? <X className="size-5" /> : <CircleHelp className="size-[22px]" />}
        {!open && unread > 0 && <span className="absolute right-0 top-0 size-[11px] rounded-full border-2 border-white bg-[#ef4444]" />}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Support & feedback"
          className={`fixed ${side} ${panelPos} z-[60] flex w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden ${t.panel}`}
          style={{ fontFamily: t.font }}
        >
          <div className={`flex items-center justify-between ${t.pad} pb-4 pt-5`}>
            <h2 className={t.title}>Support &amp; feedback</h2>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className={`flex items-center justify-center ${t.close}`}>
              <X className="size-4" />
            </button>
          </div>

          <div className={t.pad}>
            <div className={t.tabsWrap} role="tablist">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => { setTab(id); if (id === "help") setHelpView({ name: "home" }); }}
                  className={`relative ${t.tab} ${tab === id ? t.tabOn : t.tabOff}`}
                >
                  {label}
                  {id === "help" && unread > 0 && tab !== "help" && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#ef4444]" />}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "feature" && <ReportForm key="feature" mode={mode} kind="feature" t={t} onSent={onSent} />}
            {tab === "bug" && <ReportForm key="bug" mode={mode} kind="bug" t={t} onSent={onSent} />}
            {tab === "help" && helpView.name === "home" && (
              <HelpHome mode={mode} t={t} reports={reports} onOpenReport={openReport} onNewTicket={() => setHelpView({ name: "ticket" })} />
            )}
            {tab === "help" && helpView.name === "ticket" && (
              <Back t={t} onBack={() => setHelpView({ name: "home" })}>
                <ReportForm key="help" mode={mode} kind="help" t={t} onSent={r => { onSent(r); setHelpView({ name: "report", id: r._id }); }} />
              </Back>
            )}
            {tab === "help" && helpView.name === "report" && (
              <Back t={t} onBack={() => setHelpView({ name: "home" })}>
                <ReportThread mode={mode} t={t} report={reports.find(r => r._id === helpView.id)} onUpdated={onSent} />
              </Back>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Back({ t, onBack, children }: { t: Theme; onBack: () => void; children: ReactNode }) {
  return (
    <div>
      <div className={`${t.pad} pt-4`}>
        <button type="button" onClick={onBack} className={`-ml-2 flex items-center gap-1.5 rounded-full px-2 py-1 ${t.meta} ${t.row}`}>
          <ArrowLeft className="size-3.5" />Back
        </button>
      </div>
      {children}
    </div>
  );
}

/** Live count under a field until it reaches its minimum. */
function MinHint({ t, value, min }: { t: Theme; value: string; min: number }) {
  const left = remaining(value, min);
  if (!value || !left) return null;
  return <span className={`text-xs ${t.faint}`}>{left} more character{left === 1 ? "" : "s"}</span>;
}

function ReportForm({ mode, kind, t, onSent }: { mode: Mode; kind: Kind; t: Theme; onSent: (r: Report) => void }) {
  const copy = FORMS[kind];
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const ready = !remaining(title, TITLE_MIN) && !remaining(details, DETAILS_MIN);

  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  const addFiles = (list: FileList | File[]) => {
    const images = Array.from(list).filter(f => f.type.startsWith("image/"));
    if (images.some(f => f.size > MAX_BYTES)) { setError("Each image can be up to 5 MB."); return; }
    setError("");
    setFiles(prev => [...prev, ...images].slice(0, MAX_FILES));
  };

  const onPaste = (e: ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData.files).filter(f => f.type.startsWith("image/"));
    if (pasted.length) { e.preventDefault(); addFiles(pasted); }
  };

  const submit = async () => {
    if (!ready) return;
    setSending(true);
    setError("");
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("title", title.trim());
      form.append("details", details.trim());
      form.append("page", window.location.pathname);
      files.forEach(f => form.append("attachments", f));
      const res = await request<{ report: Report }>(mode, "POST", "/feedback", form);
      onSent(res.report);
      if (kind !== "help") setSent(true);
    } catch (e) {
      setError(errorText(e, "Couldn't send. Try again."));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className={`flex flex-col items-center ${t.pad} py-10 text-center`}>
        <p className={t.title}>Thanks, it's with our team</p>
        <p className={`mt-1.5 ${t.meta}`}>Replies show up under Get help.</p>
        <button type="button" onClick={() => { setSent(false); setTitle(""); setDetails(""); setFiles([]); }} className={`mt-5 ${t.ghost}`}>
          Send another
        </button>
      </div>
    );
  }

  const inputCls = `w-full px-3 outline-none transition-colors ${t.input}`;
  return (
    <div className={`flex flex-col gap-4 ${t.pad} pb-6 pt-5`} onPaste={onPaste}>
      <label className="flex flex-col gap-1.5">
        <span className={t.label}>{copy.title}</span>
        <input value={title} onChange={e => setTitle(e.target.value)} className={`${inputCls} h-11`} />
        <MinHint t={t} value={title} min={TITLE_MIN} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={t.label}>{copy.details}</span>
        <textarea value={details} onChange={e => setDetails(e.target.value)} rows={5} className={`${inputCls} resize-y py-2.5`} />
        <MinHint t={t} value={details} min={DETAILS_MIN} />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {previews.map((src, i) => (
          <div key={src} className="relative">
            <img src={src} alt="" className={`size-14 object-cover ${t.thumb}`} />
            <button type="button" aria-label="Remove image" onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-[#1c2533] text-white">
              <X className="size-3" />
            </button>
          </div>
        ))}
        {files.length < MAX_FILES && (
          <button type="button" onClick={() => fileInput.current?.click()} className={`flex items-center gap-2 ${t.ghost}`}>
            <ImagePlus className="size-4" />Add screenshot
          </button>
        )}
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {error && <p className="text-xs font-medium text-[#ef4444]">{error}</p>}

      <div className="flex flex-col gap-2.5">
        <button type="button" disabled={sending || !ready} onClick={() => void submit()} className={`flex w-full items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${t.primary}`}>
          {sending && <Loader2 className="size-4 animate-spin" />}{sending ? "Sending…" : copy.send}
        </button>
        <p className={`text-center text-[11.5px] ${t.faint}`}>Your account ID and name are sent with this {kind === "help" ? "ticket" : "report"}.</p>
      </div>
    </div>
  );
}

function Article({ t, article, open, onToggle }: { t: Theme; article: HelpArticle; open: boolean; onToggle: () => void }) {
  return (
    <li>
      <button type="button" aria-expanded={open} onClick={onToggle} className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${t.rowTitle} ${t.row}`}>
        <span className={open ? "" : "font-normal"}>{article.title}</span>
        <ChevronRight className={`size-4 shrink-0 transition-transform ${open ? "rotate-90" : ""} ${t.faint}`} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className={t.body}>{article.intro}</p>
          <ol className="mt-3 flex flex-col gap-2.5">
            {article.steps.map((step, i) => (
              <li key={i} className={`flex gap-2.5 ${t.body}`}>
                <span className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${t.stepNum}`}>{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </li>
  );
}

function HelpHome({ mode, t, reports, onOpenReport, onNewTicket }: { mode: Mode; t: Theme; reports: Report[]; onOpenReport: (id: string) => void; onNewTicket: () => void }) {
  const topics = mode === "studio" ? STUDIO_HELP : APP_HELP;
  const [openTopic, setOpenTopic] = useState<string | null>(topics[0]?.title ?? null);
  const [openArticle, setOpenArticle] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      {reports.length > 0 && (
        <section className={`${t.pad} pt-5`}>
          <p className={`pb-2.5 ${t.eyebrow}`}>Your reports</p>
          <ul className={t.card}>
            {reports.map((r, i) => (
              <li key={r._id} className={i > 0 ? `border-t ${t.divider}` : ""}>
                <button type="button" onClick={() => onOpenReport(r._id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${t.row}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {r.unread && <span className="size-1.5 shrink-0 rounded-full bg-[#ef4444]" />}
                      <span className={`truncate ${t.rowTitle}`}>{r.title}</span>
                    </span>
                    <span className={`mt-0.5 block ${t.meta}`}>{KIND_LABEL[r.kind]} · {STATUS_LABEL[r.status]} · {when(r.createdAt)}</span>
                  </span>
                  <ChevronRight className={`size-4 shrink-0 ${t.faint}`} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${t.pad} pt-5`}>
        <p className={`pb-2.5 ${t.eyebrow}`}>Help center</p>
        <div className="flex flex-col gap-2.5">
          {topics.map(topic => {
            const isOpen = openTopic === topic.title;
            return (
              <div key={topic.title} className={t.card}>
                <button type="button" aria-expanded={isOpen} onClick={() => { setOpenTopic(isOpen ? null : topic.title); setOpenArticle(null); }} className={`flex w-full items-center justify-between px-4 py-3.5 text-left ${t.row}`}>
                  <span className="text-sm font-semibold">{topic.title}</span>
                  <ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""} ${t.faint}`} />
                </button>
                {isOpen && (
                  <ul className={`border-t py-1.5 ${t.divider}`}>
                    {topic.articles.map(a => (
                      <Article key={a.title} t={t} article={a} open={openArticle === a.title} onToggle={() => setOpenArticle(o => (o === a.title ? null : a.title))} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className={`mt-5 flex items-center justify-between gap-3 border-t ${t.divider} ${t.pad} py-4`}>
        <span className="text-sm font-semibold">Still need help?</span>
        <button type="button" onClick={onNewTicket} className={t.ghost}>Open a support ticket</button>
      </div>
    </div>
  );
}

function ReportThread({ mode, t, report, onUpdated }: { mode: Mode; t: Theme; report?: Report; onUpdated: (r: Report) => void }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!report) return <p className={`${t.pad} py-6 ${t.meta}`}>This report couldn't be found.</p>;

  const send = async () => {
    if (message.trim().length < 2) return;
    setSending(true);
    setError("");
    try {
      const res = await request<{ report: Report }>(mode, "POST", "/feedback/reply", { id: report._id, message: message.trim() });
      onUpdated(res.report);
      setMessage("");
    } catch (e) {
      setError(errorText(e, "Couldn't send. Try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${t.pad} pb-6 pt-3`}>
      <div>
        <p className={t.meta}>{KIND_LABEL[report.kind]} · {STATUS_LABEL[report.status]} · {when(report.createdAt)}</p>
        <h3 className="mt-0.5 text-base font-semibold leading-snug">{report.title}</h3>
      </div>
      <div className={`px-4 py-3 ${t.meBubble}`}>
        <p className={`whitespace-pre-wrap break-words ${t.body}`}>{report.details}</p>
        {report.attachments.length > 0 && (
          <div className="mt-3 flex gap-2">
            {report.attachments.map(src => (
              <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                <img src={src} alt="Attachment" className={`size-14 object-cover ${t.thumb}`} />
              </a>
            ))}
          </div>
        )}
      </div>
      {report.replies.map((r, i) => (
        <div key={i} className={`px-4 py-3 ${r.from === "team" ? t.teamBubble : t.meBubble}`}>
          <p className="text-xs font-semibold">{r.from === "team" ? "Nexura team" : "You"} <span className={`font-normal ${t.muted}`}>· {when(r.at)}</span></p>
          <p className={`mt-1 whitespace-pre-wrap break-words ${t.body}`}>{r.message}</p>
        </div>
      ))}
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} aria-label="Reply" className={`w-full resize-y px-3 py-2.5 outline-none ${t.input}`} />
      {error && <p className="text-xs font-medium text-[#ef4444]">{error}</p>}
      <button type="button" disabled={sending || message.trim().length < 2} onClick={() => void send()} className={`flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 ${t.primary}`}>
        {sending && <Loader2 className="size-4 animate-spin" />}Reply
      </button>
    </div>
  );
}
