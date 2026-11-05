"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  MAX_BUDGET_USD, MAX_RECIPIENTS, MIN_BUDGET_USD, MIN_RECIPIENTS, SLIDER_STEPS,
  eligibleAt, fromSliderPos, nice, presetRecipients, sanitizeDecimal, sanitizeInt, simulate, toSliderPos,
  type ScoreStats,
} from "@/lib/campaignSimulator";

const PRESETS = [
  { label: "Broad reach", score: 0 },
  { label: "Balanced", score: 50 },
  { label: "Loyal users", score: 80 },
] as const;

const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n > 0 && n < 100 ? 2 : 0, maximumFractionDigits: n < 100 ? 2 : 0 })}`;

function Slider({ label, pos, onPos, disabled, children }: { label: string; pos: number; onPos: (p: number) => void; disabled?: boolean; children: ReactNode }) {
  const pct = (pos / SLIDER_STEPS) * 100;
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold leading-[20.15px] text-[#3d485c]">{label}</span>
        {children}
      </div>
      <input type="range" min={0} max={SLIDER_STEPS} value={pos} disabled={disabled} aria-label={label}
        onChange={e => onPos(Number(e.target.value))}
        style={{ background: `linear-gradient(to right, #8b3efe ${pct}%, #f1eefa ${pct}%)` }}
        className="h-[6px] w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-50
          [&::-webkit-slider-thumb]:size-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[rgba(28,37,51,0.12)] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(28,37,51,0.22)]
          [&::-moz-range-thumb]:size-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-[rgba(28,37,51,0.12)] [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_1px_4px_rgba(28,37,51,0.22)]" />
    </div>
  );
}

function NumberBox({ label, value, onChange, sanitize, prefix, suffix, disabled }: {
  label: string; value: string; onChange: (v: string) => void; sanitize: (raw: string) => string; prefix?: string; suffix?: string; disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <span className="flex items-center gap-[4px] rounded-full border-[1.25px] border-[rgba(28,37,51,0.12)] bg-[#f4f1fc] px-[12px] py-[2px] focus-within:border-[#8a3ffc]">
      {prefix && <span className="text-[13px] font-semibold text-[#69728a]">{prefix}</span>}
      <input inputMode="decimal" aria-label={label} value={draft} disabled={disabled}
        onChange={e => { const v = sanitize(e.target.value); setDraft(v); onChange(v); }}
        className="w-[88px] bg-transparent text-right text-[13.5px] font-semibold tabular-nums text-[#1c2533] outline-none disabled:opacity-60" />
      {suffix && <span className="text-[13px] font-semibold text-[#69728a]">{suffix}</span>}
    </span>
  );
}

function ScoreHistogram({ stats, score, onPick }: { stats: ScoreStats; score: number; onPick: (score: number) => void }) {
  const buckets = [...stats.buckets].sort((a, b) => a.fromPct - b.fromPct);
  const max = Math.max(...buckets.map(b => b.users), 1);
  return (
    <div className="flex h-[32px] items-end gap-[2px]">
      {buckets.map(b => (
        <button key={`${b.fromPct}-${b.toPct}`} type="button" onClick={() => onPick(b.fromPct)}
          aria-label={`Require a score of ${b.fromPct}%. ${fmtNum(b.users)} users score ${b.fromPct}–${b.toPct}%.`}
          title={`${fmtNum(b.users)} users with a score of ${b.fromPct}–${b.toPct}%`}
          className={cn("flex-1 rounded-t-[4px] transition", b.fromPct >= score ? "bg-[#8b3efe]" : b.toPct > score ? "bg-[#b896ff]" : "bg-[#e6e1f5]")}
          style={{ height: `${Math.max(6, (Math.max(0, b.users) / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export interface CampaignSimulatorProps {
  budget: string; setBudget: (v: string) => void; budgetLocked: boolean;
  recipients: string; setRecipients: (v: string) => void;
  score: string; setScore: (v: string) => void;
  token: string; isStable: boolean; tokenPriceUsd: number | null;
  participationPct: number; minPerStageUsd: number;
  stageNames: string[]; stageAlloc: number[];
  stats: ScoreStats | null;
  tokenPicker?: ReactNode;
}

export default function CampaignSimulator(p: CampaignSimulatorProps) {
  const price = p.tokenPriceUsd !== null && p.tokenPriceUsd > 0 ? p.tokenPriceUsd : null;
  const budget = Number(p.budget) || 0;
  const recipients = Number(p.recipients) || 0;
  const score = Math.min(100, Math.max(0, Number(p.score) || 0));
  const r = simulate({
    budget, recipients, score, tokenPriceUsd: price, participationPct: p.participationPct,
    minPerStageUsd: p.minPerStageUsd, stageAlloc: p.stageAlloc, stats: p.stats,
  });

  const budgetMin = price ? nice(MIN_BUDGET_USD / price) : MIN_BUDGET_USD;
  const budgetMax = price ? nice(MAX_BUDGET_USD / price) : MAX_BUDGET_USD;
  const scoreStep = SLIDER_STEPS / 100;

  const applyPreset = (preset: number) => {
    p.setScore(String(preset));
    const next = presetRecipients(r.capacity, p.stats ? eligibleAt(p.stats, preset) : null);
    if (next !== null) p.setRecipients(String(next));
  };

  const warnings = [
    r.overCapacity && r.capacity !== null ? `The pool covers up to ${fmtNum(r.capacity)} recipients at the ${fmtUsd(p.minPerStageUsd)} per stage minimum.` : null,
    r.overEligible && r.eligible !== null ? `Only ${fmtNum(r.eligible)} Nexura users have a Nexura score of ${score}% or higher.` : null,
  ].filter((w): w is string => !!w);

  const tiles = [
    { k: "Per recipient", v: r.perRecipientUsd !== null ? fmtUsd(r.perRecipientUsd) : price ? "Set recipients" : "Needs a token price" },
    { k: "Eligible Nexura users", v: r.eligible !== null ? fmtNum(r.eligible) : "No score data yet" },
    { k: "Pool can reward", v: r.capacity !== null ? fmtNum(r.capacity) : "Needs a token price" },
    { k: "Reward pool", v: r.poolUsd !== null ? fmtUsd(r.poolUsd) : `${fmtNum(budget * p.participationPct / 100)} ${p.token}` },
  ];

  return (
    <div className="flex flex-col gap-[16px] rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.09)] bg-white p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[16px] font-semibold leading-[18.4px] tracking-[-0.32px] text-[#1c2533]">Campaign Simulator</p>
        <div className="flex flex-wrap gap-[6px]">
          {PRESETS.map(pr => (
            <button key={pr.label} type="button" onClick={() => applyPreset(pr.score)} aria-pressed={score === pr.score}
              className={cn("rounded-full border-[1.25px] px-[10px] py-[3px] text-[12px] font-semibold transition",
                score === pr.score ? "border-[#8a3ffc] bg-[rgba(138,63,252,0.1)] text-[#6e2bd8]" : "border-[rgba(28,37,51,0.12)] bg-white text-[#3d485c] hover:bg-[#f7f4fe]")}>
              {pr.label}
            </button>
          ))}
        </div>
      </div>

      <Slider label="Reward budget" pos={toSliderPos(budget, budgetMin, budgetMax)} disabled={p.budgetLocked}
        onPos={pos => p.setBudget(String(fromSliderPos(pos, budgetMin, budgetMax)))}>
        <span className="flex items-center gap-[8px]">
          <NumberBox label="Reward budget" value={p.budget} onChange={p.setBudget} sanitize={sanitizeDecimal} disabled={p.budgetLocked}
            prefix={p.isStable ? "$" : undefined} suffix={p.isStable || p.tokenPicker ? undefined : p.token} />
          {p.tokenPicker}
        </span>
      </Slider>

      <Slider label="Reward recipients" pos={toSliderPos(recipients, MIN_RECIPIENTS, MAX_RECIPIENTS)}
        onPos={pos => p.setRecipients(String(fromSliderPos(pos, MIN_RECIPIENTS, MAX_RECIPIENTS)))}>
        <NumberBox label="Reward recipients" value={p.recipients} onChange={p.setRecipients} sanitize={sanitizeInt} />
      </Slider>

      <div className="flex flex-col gap-[8px]">
        <Slider label="Nexura Score requirement" pos={score * scoreStep} onPos={pos => p.setScore(String(Math.round(pos / scoreStep)))}>
          <NumberBox label="Nexura Score requirement" value={p.score} sanitize={sanitizeInt} suffix="%"
            onChange={v => p.setScore(v === "" ? "" : String(Math.min(100, Number(v))))} />
        </Slider>
        {p.stats && p.stats.buckets.length > 0 && <ScoreHistogram stats={p.stats} score={score} onPick={v => p.setScore(String(v))} />}
      </div>

      <div className="grid grid-cols-2 gap-[16px] border-t-[1.25px] border-[rgba(28,37,51,0.09)] pt-[14px] lg:grid-cols-4">
        {tiles.map(s => (
          <div key={s.k}>
            <p className="text-[11px] leading-[17.05px] text-[#98a0b4]">{s.k}</p>
            <p className="pt-[3px] text-[13.5px] font-semibold leading-[20.925px] tabular-nums text-[#3d485c]">{s.v}</p>
          </div>
        ))}
      </div>

      {r.perStageUsd && p.stageNames.length > 1 && (
        <div className="flex h-[22px] w-full overflow-hidden rounded-full bg-[#f1eefa]">
          {r.perStageUsd.map((usd, i) => usd > 0 && (
            <div key={i} title={`${p.stageNames[i]}: ${fmtUsd(usd)} per recipient`}
              className="flex min-w-0 items-center justify-center truncate border-r-2 border-white px-2 text-[11px] font-semibold text-white last:border-r-0"
              style={{ flexGrow: usd, background: `rgba(139,62,254,${0.45 + 0.55 * ((i + 1) / p.stageNames.length)})` }}>
              {fmtUsd(usd)}
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div role="status" className="flex flex-col gap-[4px] rounded-[24px] bg-[rgba(245,158,11,0.12)] px-[16px] py-[10px] text-[12.5px] leading-[18.75px] text-[#9a6200]">
          {warnings.map(w => <p key={w}>{w}</p>)}
        </div>
      )}
    </div>
  );
}
