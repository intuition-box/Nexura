import { useMemo, useState, type ReactNode } from "react";
import { NexuraScoreInfoButton } from "@/components/studio/NexuraScoreExplainer";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Flag,
  Gift,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  CATALOG,
  MAX_ACTIVITIES,
  MAX_STAGES,
  MIN_PER_STAGE,
  OPENING_FEE,
  TEMPLATES,
  addDays,
  addMonths,
  blankStage,
  catalogMeta,
  durationBreakdown,
  existingPct,
  feeRows,
  formatChip,
  formatField,
  isoDate,
  money,
  parseIso,
  stagesFromTemplate,
  timingLabel,
  timingMenuLabel,
  timingShort,
  uid,
  type Activity,
  type ActivityCategory,
  type ActivityKind,
  type Details,
  type RetentionDraft,
  type Stage,
  type Template,
  type Timing,
  type Unit,
} from "./model";
import { useRetentionAutosave } from "@/lib/retentionDraft";

type StepId = "templates" | "details" | "journey" | "rewards" | "review";

const STEPS: { id: StepId; title: string; hint: string }[] = [
  { id: "templates", title: "Template", hint: "Starting point" },
  { id: "details", title: "Details", hint: "Name, duration.." },
  { id: "journey", title: "Journey", hint: "Stages & tasks" },
  { id: "rewards", title: "Rewards & Funding", hint: "Budget & payment" },
  { id: "review", title: "Review & Fund", hint: "Summary & Publish" },
];

const FILTERS: ActivityCategory[] = ["All", "Social", "On-chain", "Product", "Feedback", "Community", "Custom"];

const PRESETS: Timing[] = [
  { mode: "immediate", amount: 0, unit: "Days" },
  { mode: "after", amount: 3, unit: "Days" },
  { mode: "after", amount: 7, unit: "Days" },
  { mode: "after", amount: 14, unit: "Days" },
  { mode: "after", amount: 1, unit: "Months" },
];

type Modal =
  | null
  | { type: "picker"; stageId: string; replaceId?: string }
  | { type: "config"; stageId: string; kind: ActivityKind; replaceId?: string }
  | { type: "publish" }
  | { type: "preview" };

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function emptyDetails(months = 3): Details {
  const start = addDays(today(), 7);
  return {
    name: "",
    description: "",
    coverName: "",
    coverUrl: "",
    start: isoDate(start),
    end: isoDate(addMonths(start, months)),
  };
}

function sampleActivity(name: string): Activity {
  const kind: ActivityKind = name.includes("On-chain")
    ? "trust-name"
    : name.includes("Product")
      ? "product"
      : name.includes("Feedback")
        ? "feedback"
        : name.includes("Custom")
          ? "custom"
          : "x-follow";
  const meta = catalogMeta(kind);
  return {
    id: uid(),
    kind,
    title: meta.description,
    description: meta.description,
    url: meta.urlPlaceholder && meta.urlPlaceholder !== "https://" ? meta.urlPlaceholder : "",
    validation: meta.validationOptions?.[0] ?? "",
  };
}

function equalSplits(count: number) {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const splits = Array(count).fill(base);
  splits[count - 1] += 100 - base * count;
  return splits;
}

export default function CampaignStudio() {
  const [step, setStepState] = useState<StepId>("templates");
  const [rewardsOn, setRewardsOn] = useState(true);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>(() => emptyDetails());
  const [detailError, setDetailError] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stageError, setStageError] = useState("");
  const [budget, setBudget] = useState(20000);
  const [validationOn, setValidationOn] = useState(false);
  const [curatorOn, setCuratorOn] = useState(false);
  const [splits, setSplits] = useState<number[]>([]);
  const [recipients, setRecipients] = useState(500);
  const [retentionReq, setRetentionReq] = useState(75);
  const [paid, setPaid] = useState(false);
  const [published, setPublished] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  const draft = useMemo<RetentionDraft>(
    () => ({
      step,
      rewardsOn,
      templateId,
      details,
      stages,
      budget,
      validationOn,
      curatorOn,
      splits,
      recipients,
      retentionReq,
      paid,
      published,
    }),
    [step, rewardsOn, templateId, details, stages, budget, validationOn, curatorOn, splits, recipients, retentionReq, paid, published],
  );

  function restoreDraft(next: RetentionDraft) {
    setStepState(next.rewardsOn || next.step !== "rewards" ? next.step : "review");
    setRewardsOn(next.rewardsOn);
    setTemplateId(next.templateId);
    setDetails(next.details);
    setStages(next.stages);
    setBudget(next.budget);
    setValidationOn(next.validationOn);
    setCuratorOn(next.curatorOn);
    setSplits(next.splits);
    setRecipients(next.recipients);
    setRetentionReq(next.retentionReq);
    setPaid(next.paid);
    setPublished(next.published);
  }

  const { hydrated, status } = useRetentionAutosave(draft, restoreDraft);

  const template = TEMPLATES.find((t) => t.id === templateId) ?? null;
  const visibleSteps = rewardsOn ? STEPS : STEPS.filter((s) => s.id !== "rewards");
  const poolPct = existingPct(validationOn, curatorOn);
  const participantPool = (budget * poolPct) / 100;
  const perPerson = recipients > 0 ? participantPool / recipients : 0;
  const splitSum = splits.reduce((a, b) => a + b, 0);
  const stageEstimates = stages.map((stage, i) => (perPerson * (splits[i] ?? 0)) / 100);
  const underfunded = stageEstimates.some((n) => stages.length > 0 && n < MIN_PER_STAGE);
  const allocOk = stages.length > 0 && splitSum === 100 && !underfunded && recipients > 0 && budget > 0;
  const minSplit = Math.min(...(splits.length ? splits : [100]));
  const capacity = minSplit > 0 ? Math.floor(participantPool * (minSplit / 100) / MIN_PER_STAGE) : 0;
  const journeyReady = stages.length > 0 && stages.every((s) => s.activities.length > 0) && !editingId;
  const totalActivities = stages.reduce((n, s) => n + s.activities.length, 0);

  const rewardIssues = useMemo(() => {
    const issues: string[] = [];
    if (splitSum !== 100) issues.push(`Stage split is ${splitSum}%. It has to equal 100%.`);
    if (underfunded) issues.push(`Each rewarded stage has to pay at least ${money(MIN_PER_STAGE)} per recipient.`);
    if (recipients > capacity && capacity >= 0 && stages.length > 0) {
      issues.push(`This pool can reward ${capacity.toLocaleString("en-US")} people at the $2 minimum, not ${recipients.toLocaleString("en-US")}.`);
    }
    return issues;
  }, [splitSum, underfunded, recipients, capacity, stages.length]);

  function go(next: StepId) {
    if (next !== "review") setPublished(false);
    setStepState(next);
  }

  function applyTemplate(t: Template) {
    setTemplateId(t.id);
    setStages(stagesFromTemplate(t).map((stage) => ({ ...stage, activities: [sampleActivity(stage.name)] })));
    setSplits([...t.splits]);
    setRetentionReq(t.retention);
    setEditingId(null);
    setDetails((d) => {
      const start = parseIso(d.start) ?? addDays(today(), 7);
      return { ...d, end: isoDate(addMonths(start, t.months)) };
    });
  }

  function goDetails(scratch: boolean) {
    if (scratch) {
      setTemplateId(null);
      setStages([]);
      setSplits([]);
      setEditingId(null);
      setRetentionReq(75);
      setDetails(emptyDetails(3));
    } else if (template) {
      applyTemplate(template);
    }
    setDetailError("");
    go("details");
  }

  function continueDetails() {
    const start = parseIso(details.start);
    const end = parseIso(details.end);
    const min = addDays(today(), 7);
    if (!start || start < min) {
      setDetailError("Start at least 7 days after today, so there is a week to promote it.");
      return;
    }
    if (!end || end <= start) {
      setDetailError("End date has to be after the start date.");
      return;
    }
    setDetailError("");
    go("journey");
  }

  function openFirstStage() {
    const stage = blankStage(0);
    setStages([stage]);
    setEditingId(stage.id);
    setSplits(template?.splits.length === 1 ? [...template.splits] : [100]);
    setStageError("");
  }

  function useJourneyTemplate() {
    const t = template ?? TEMPLATES[0];
    applyTemplate(t);
    go("journey");
  }

  function patchStage(id: string, patch: Partial<Stage>) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function finishStage(id: string) {
    const stage = stages.find((s) => s.id === id);
    if (!stage || stage.activities.length === 0) {
      setStageError("Add at least one task before marking the stage done.");
      return;
    }
    setStageError("");
    setEditingId(null);
  }

  function addNextStage() {
    if (stages.length >= MAX_STAGES) return;
    if (editingId) {
      const open = stages.find((s) => s.id === editingId);
      if (open && open.activities.length === 0) {
        setStageError("Save the open stage before adding another.");
        return;
      }
    }
    const stage = blankStage(stages.length);
    setStages((prev) => [...prev, stage]);
    setEditingId(stage.id);
    setSplits((prev) => {
      const nextCount = stages.length + 1;
      if (template && template.splits.length === nextCount) return [...template.splits];
      return equalSplits(nextCount);
    });
    setStageError("");
  }

  function deleteStage(id: string) {
    setStages((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setSplits(template && template.splits.length === next.length ? [...template.splits] : equalSplits(next.length));
      return next;
    });
    if (editingId === id) setEditingId(null);
  }

  function duplicateStage(id: string) {
    if (stages.length >= MAX_STAGES) return;
    setStages((prev) => {
      const source = prev.find((s) => s.id === id);
      if (!source) return prev;
      const copy: Stage = {
        ...source,
        id: uid(),
        activities: source.activities.map((a) => ({ ...a, id: uid() })),
      };
      const idx = prev.findIndex((s) => s.id === id);
      const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
      setSplits(equalSplits(next.length));
      return next;
    });
  }

  function upsertActivity(stageId: string, activity: Activity, replaceId?: string) {
    setStages((prev) =>
      prev.map((stage) => {
        if (stage.id !== stageId) return stage;
        if (replaceId) {
          return { ...stage, activities: stage.activities.map((a) => (a.id === replaceId ? { ...activity, id: replaceId } : a)) };
        }
        if (stage.activities.length >= MAX_ACTIVITIES) return stage;
        return { ...stage, activities: [...stage.activities, activity] };
      }),
    );
    setStageError("");
  }

  function removeActivity(stageId: string, activityId: string) {
    setStages((prev) =>
      prev.map((stage) =>
        stage.id === stageId ? { ...stage, activities: stage.activities.filter((a) => a.id !== activityId) } : stage,
      ),
    );
  }

  function continueJourney() {
    if (!journeyReady) return;
    if (rewardsOn) {
      setSplits((prev) => {
        if (prev.length === stages.length) return prev;
        if (template && template.splits.length === stages.length) return [...template.splits];
        return equalSplits(stages.length);
      });
      go("rewards");
    } else {
      go("review");
    }
  }

  const displayName = details.name.trim() || "Untitled campaign";
  const breakdown = durationBreakdown(details.start, details.end);

  if (!hydrated) {
    return (
      <div className="min-h-full bg-[#F7F5FF] px-8 py-16 font-sans text-[14px] text-[#667085]">
        Restoring your draft…
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F7F5FF] font-sans text-[#1C2533]">
      <div className="mx-auto w-full max-w-[1120px] px-4 py-5 md:px-8 md:py-6">
        {status !== "idle" && (
          <div className="mb-3 flex justify-end">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium ${
                status === "error"
                  ? "border-[#F3C1C4] bg-[#FFF6F6] text-[#E4545B]"
                  : "border-[#B7E7D4] bg-[#F3FBF7] text-[#0F9F6E]"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              {status === "saving" ? "Saving…" : status === "saved" ? "Saved just now" : "Couldn’t save"}
            </span>
          </div>
        )}
        {step !== "templates" && (
              <Stepper
                steps={visibleSteps}
                current={step}
                onJump={(id) => {
                  const order = visibleSteps.map((s) => s.id);
                  if (order.indexOf(id) <= order.indexOf(step)) go(id);
                }}
              />
            )}
            {step !== "templates" && step !== "review" && (
              <RewardsBanner
                on={rewardsOn}
                onToggle={(value) => {
                  setRewardsOn(value);
                  if (!value && step === "rewards") go("review");
                }}
              />
            )}

            {step === "templates" && (
              <Templates
                rewardsOn={rewardsOn}
                onToggle={setRewardsOn}
                onUse={(t) => {
                  applyTemplate(t);
                  go("details");
                }}
                onScratch={() => goDetails(true)}
              />
            )}

            {step === "details" && (
              <DetailsStep
                details={details}
                error={detailError}
                onChange={setDetails}
                onBack={() => go("templates")}
                onNext={continueDetails}
              />
            )}

            {step === "journey" && (
              <JourneyStep
                stages={stages}
                editingId={editingId}
                error={stageError}
                monthsLabel={breakdown?.headline ?? "—"}
                ready={journeyReady}
                rewardsOn={rewardsOn}
                onAddFirst={openFirstStage}
                onUseTemplate={useJourneyTemplate}
                onEdit={setEditingId}
                onPatch={patchStage}
                onFinish={finishStage}
                onAddNext={addNextStage}
                onDelete={deleteStage}
                onDuplicate={duplicateStage}
                onAddTask={(stageId) => setModal({ type: "picker", stageId })}
                onEditTask={(stageId, activity) => setModal({ type: "config", stageId, kind: activity.kind, replaceId: activity.id })}
                onRemoveTask={removeActivity}
                onPreview={() => setModal({ type: "preview" })}
                onBack={() => go("details")}
                onNext={continueJourney}
              />
            )}

            {step === "rewards" && rewardsOn && (
              <RewardsStep
                stages={stages}
                budget={budget}
                validationOn={validationOn}
                curatorOn={curatorOn}
                splits={splits}
                recipients={recipients}
                retentionReq={retentionReq}
                participantPool={participantPool}
                perPerson={perPerson}
                estimates={stageEstimates}
                splitSum={splitSum}
                capacity={capacity}
                paid={paid}
                issues={rewardIssues}
                canContinue={allocOk && paid}
                onBudget={(n) => {
                  setBudget(n);
                  setPaid(false);
                }}
                onValidation={(v) => {
                  setValidationOn(v);
                  setPaid(false);
                }}
                onCurator={(v) => {
                  setCuratorOn(v);
                  setPaid(false);
                }}
                onSplit={(i, value) => {
                  setSplits((prev) => prev.map((n, idx) => (idx === i ? value : n)));
                  setPaid(false);
                }}
                onRecipients={(n) => {
                  setRecipients(n);
                  setPaid(false);
                }}
                onRetention={setRetentionReq}
                onEven={() => setSplits(equalSplits(stages.length))}
                onReset={() => setSplits(template && template.splits.length === stages.length ? [...template.splits] : equalSplits(stages.length))}
                onUseCapacity={() => setRecipients(Math.max(1, capacity))}
                onAddBudget={() => {
                  if (minSplit <= 0 || recipients <= 0) return;
                  const poolNeeded = (MIN_PER_STAGE * recipients) / (minSplit / 100);
                  const budgetNeeded = Math.ceil(poolNeeded / (poolPct / 100));
                  setBudget(Math.max(budget, budgetNeeded));
                  setPaid(false);
                }}
                onPay={() => {
                  if (!allocOk) return;
                  setPaid(true);
                }}
                onBack={() => go("journey")}
                onNext={() => {
                  if (!(allocOk && paid)) return;
                  go("review");
                }}
              />
            )}

            {step === "review" && (
              <ReviewStep
                details={details}
                name={displayName}
                rewardsOn={rewardsOn}
                stages={stages}
                splits={splits}
                pool={participantPool}
                perPerson={perPerson}
                retentionReq={retentionReq}
                published={published}
                onEdit={(id) => go(id === "rewards" && !rewardsOn ? "journey" : id)}
                onPreview={() => setModal({ type: "preview" })}
                onBack={() => go(rewardsOn ? "rewards" : "journey")}
                onPublish={() => {
                  if (rewardsOn && !paid) {
                    go("rewards");
                    return;
                  }
                  setModal({ type: "publish" });
                }}
              />
            )}
      </div>

      {modal?.type === "picker" && (
        <PickerModal
          onClose={() => setModal(null)}
          onPick={(kind) => setModal({ type: "config", stageId: modal.stageId, kind, replaceId: modal.replaceId })}
        />
      )}
      {modal?.type === "config" && (
        <ConfigModal
          kind={modal.kind}
          initial={stages.find((s) => s.id === modal.stageId)?.activities.find((a) => a.id === modal.replaceId)}
          onClose={() => setModal(null)}
          onChange={() => setModal({ type: "picker", stageId: modal.stageId, replaceId: modal.replaceId })}
          onSave={(activity) => {
            upsertActivity(modal.stageId, activity, modal.replaceId);
            setModal(null);
          }}
        />
      )}
      {modal?.type === "publish" && (
        <PublishModal
          name={displayName}
          start={details.start}
          end={details.end}
          onClose={() => setModal(null)}
          onConfirm={() => {
            setPublished(true);
            setModal(null);
          }}
        />
      )}
      {modal?.type === "preview" && <PreviewModal stages={stages} onClose={() => setModal(null)} />}
    </div>
  );
}

function Stepper({ steps, current, onJump }: { steps: typeof STEPS; current: StepId; onJump: (id: StepId) => void }) {
  const index = steps.findIndex((s) => s.id === current);
  return (
    <div className="mb-4 overflow-x-auto">
      <ol className="flex min-w-[720px] items-center rounded-full bg-white px-2 py-2 shadow-[0_1px_0_rgba(20,16,40,0.04)]">
        {steps.map((s, i) => {
          const done = i < index;
          const on = i === index;
          return (
            <li key={s.id} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => onJump(s.id)}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-full px-2 py-1.5 text-left ${on ? "bg-[#F3EEFF]" : ""}`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${done || on ? "bg-[#8A3FFC] text-white" : "bg-[#EEF0F6] text-[#8B90A3]"}`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-[13px] font-semibold ${on ? "text-[#1C2533]" : "text-[#3C4254]"}`}>{s.title}</span>
                  <span className="block truncate text-[11px] text-[#8B90A3]">{s.hint}</span>
                </span>
              </button>
              {i < steps.length - 1 && <span className="mx-1 h-px w-4 shrink-0 bg-[#E4E0EE] sm:w-8" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RewardsBanner({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="relative mb-5 flex items-center gap-4 overflow-hidden rounded-[28px] border border-white bg-white px-4 py-4 shadow-[0_8px_30px_rgba(88,60,160,0.04)] md:px-5">
      <span className="pointer-events-none absolute -left-6 top-1/2 h-24 w-16 -translate-y-1/2 rounded-full border-[10px] border-[#EDE4FF]" />
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#F4EEFF] text-[#8A3FFC]">
        <Gift className="h-5 w-5" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">Will this campaign offer rewards?</span>
        <span className="mt-0.5 block text-[13px] leading-5 text-[#6B728A]">
          {on
            ? "Rewards on · Participants can earn rewards. You set the budget and how it is split on the Rewards & Funding step."
            : "Rewards off · Activities only. Participants complete the journey without a reward pool."}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-label="Offer rewards"
        aria-checked={on}
        onClick={() => onToggle(!on)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-[#8A3FFC]" : "bg-[#D9D6E5]"}`}
      >
        <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition ${on ? "left-[23px]" : "left-[3px]"}`} />
      </button>
    </div>
  );
}

function Templates({ rewardsOn, onToggle, onUse, onScratch }: { rewardsOn: boolean; onToggle: (v: boolean) => void; onUse: (t: Template) => void; onScratch: () => void }) {
  return (
    <div>
      <button type="button" className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-[#3C4254]">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </button>
      <h1 className="text-[32px] font-semibold tracking-[-0.03em]">Create a retention campaign</h1>
      <p className="mt-2 max-w-[640px] text-[15px] leading-6 text-[#667085]">
        Choose whether participants can earn rewards, then pick a template or start from scratch. You can fully edit everything next.
      </p>
      <div className="mt-5">
        <RewardsBanner on={rewardsOn} onToggle={onToggle} />
      </div>
      <div className="mt-2 grid gap-4 lg:grid-cols-3">
        {TEMPLATES.map((t) => (
          <TemplateCard key={t.id} template={t} showRewards={rewardsOn} onUse={() => onUse(t)} />
        ))}
      </div>
      <div className="my-8 flex items-center gap-4">
        <div className="h-px flex-1 bg-[#E6E1F0]" />
        <p className="max-w-[460px] text-center text-[13px] leading-5 text-[#667085]">
          OR begin with an empty journey and define every checkpoint, timing rule and reward yourself. Nothing is pre-filled.
        </p>
        <div className="hidden h-px flex-1 bg-[#E6E1F0] sm:block" />
      </div>
      <div className="mt-10 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#E4E0EE] bg-white px-5 text-[14px] font-medium">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" onClick={onScratch} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#8A3FFC] px-6 text-[15px] font-semibold text-white">
          Start from scratch <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TemplateCard({ template, showRewards, onUse }: { template: Template; showRewards: boolean; onUse: () => void }) {
  const colors = ["#5B21B6", "#7C3AED", "#8B5CF6", "#C4B5FD", "#34D399"];
  return (
    <article className="flex flex-col rounded-[24px] border border-[#F0ECF8] bg-white p-5 shadow-[0_10px_30px_rgba(80,60,140,0.04)]">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">{template.name}</h2>
        <span className="rounded-full bg-[#F3EEFF] px-3 py-1 text-[12px] font-medium text-[#7C3AED]">Retention</span>
      </div>
      <dl className="mt-4 space-y-3 border-b border-[#F1EEF7] pb-4 text-[14px]">
        <Row k="Duration" v={`${template.months} months`} />
        <Row k="Stages" v={`${template.splits.length} stages`} />
        <Row k="Retention rate" v={`${template.retention}%`} />
      </dl>
      {showRewards && (
        <div className="mt-4">
          <p className="text-[13px] font-medium text-[#3C4254]">Reward structure - {template.splits.length} Stages</p>
          <div className="mt-3 flex gap-1">
            {template.splits.map((n, i) => (
              <div key={i} className="flex min-w-0 flex-col items-center" style={{ flex: `${n} 1 0` }}>
                <div className="h-2.5 w-full rounded-full" style={{ background: colors[i] ?? colors[0] }} />
                <span className="mt-2 text-center text-[11px] leading-none text-[#4B5168]">{n}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button type="button" onClick={onUse} className="mt-5 h-11 rounded-full bg-[#8A3FFC] text-[14px] font-semibold text-white">
        Use template
      </button>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[#98A0B3]">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

function DetailsStep({
  details, error, onChange, onBack, onNext,
}: {
  details: Details;
  error: string;
  onChange: (d: Details) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const span = durationBreakdown(details.start, details.end);
  function set<K extends keyof Details>(key: K, value: Details[K]) {
    onChange({ ...details, [key]: value });
  }
  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-medium">
        <ArrowLeft className="h-4 w-4" /> Back to type
      </button>
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Campaign details</h1>
      <p className="mt-1 text-[14px] text-[#667085]">Provide the essential information users need to understand your campaign before they participate.</p>

      <section className="mt-5 rounded-[28px] bg-white p-5 shadow-[0_8px_30px_rgba(88,60,160,0.04)] md:p-6">
        <SectionTitle n="●" title="Basics" sub="How the campaign is identified" />
        <label className="mt-5 block text-[13px] font-medium">Campaign name</label>
        <input
          value={details.name}
          placeholder="Untitled campaign"
          onChange={(e) => set("name", e.target.value)}
          className="mt-2 h-12 w-full rounded-full bg-[#F4F1FC] px-5 text-[14px] outline-none placeholder:text-[#A3A8BA]"
        />
        <p className="mt-2 text-[12px] text-[#98A0B3]">Visible to all participants</p>
        <label className="mt-4 block text-[13px] font-medium">Campaign description</label>
        <textarea
          value={details.description}
          placeholder="Untitled campaign"
          maxLength={150}
          onChange={(e) => set("description", e.target.value)}
          className="mt-2 h-28 w-full resize-none rounded-[24px] bg-[#F4F1FC] px-5 py-4 text-[14px] outline-none placeholder:text-[#A3A8BA]"
        />
        <p className="mt-2 text-[12px] text-[#98A0B3]">Keep it clear and practical. {details.description.length}/150</p>
        <p className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium"><span className="text-[#98A0B3]">▣</span> Cover Image</p>
        <label className="mt-3 flex h-44 cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-[#D9D3EA] bg-[#F7F5FF] text-center">
          {details.coverUrl ? (
            <img src={details.coverUrl} alt="" className="h-full w-full rounded-[24px] object-cover" />
          ) : (
            <>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#8A3FFC] text-white"><Upload className="h-5 w-5" /></span>
              <span className="mt-3 text-[14px]"><span className="font-semibold text-[#8A3FFC]">Click to upload</span> OR you can drag and drop</span>
              <span className="mt-1 text-[12px] text-[#98A0B3]">SVG, PNG, JPG or GIF (max. 10MB)</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const url = typeof reader.result === "string" ? reader.result : "";
                onChange({ ...details, coverUrl: url, coverName: file.name });
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
      </section>

      <section className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_8px_30px_rgba(88,60,160,0.04)] md:p-6">
        <SectionTitle n="●" title="Duration" sub="When the campaign runs in UTC" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <DateField label="Start date" hint="At least 7 days after today, so participants get time for marketing and promotion. Starts 09:00 UTC." value={details.start} onChange={(v) => set("start", v)} />
          <DateField label="End date" hint="The last day participants can join, complete tasks and claim rewards." value={details.end} onChange={(v) => set("end", v)} />
        </div>
        <p className="mt-4 text-[13px] font-medium">Campaign duration</p>
        <div className="mt-2 rounded-[20px] bg-[#F4F1FC] px-5 py-3">
          <p className="text-[16px] font-semibold">{span?.headline ?? "—"}</p>
          <p className="text-[12px] text-[#8B90A3]">{span?.detail ?? "Pick a start and end date."}</p>
        </div>
        <p className="mt-2 text-[12px] text-[#98A0B3]">Calculated from the start and end dates in days, weeks and months.</p>
        <div className="mt-4 flex gap-2 rounded-full bg-[#F4EEFF] px-4 py-3 text-[13px] text-[#5B4B86]">
          <span className="text-[#8A3FFC]">ⓘ</span>
          <span>Starts 7 days after you publish. That gives you a week to promote the campaign. Participants can join from the start date until the campaign ends.</span>
        </div>
        {error && <p className="mt-3 text-[13px] font-medium text-[#E4545B]">{error}</p>}
      </section>

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onNext} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#8A3FFC] px-6 text-[15px] font-semibold text-white">
          Continue to journey <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ title, sub }: { n?: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 h-3 w-3 rounded-full bg-[#8A3FFC]" />
      <span>
        <span className="block text-[16px] font-semibold">{title}</span>
        <span className="block text-[13px] text-[#8B90A3]">{sub}</span>
      </span>
    </div>
  );
}

function DateField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium">{label}</span>
      <span className="relative mt-2 flex h-12 items-center gap-2 rounded-full bg-[#F4F1FC] px-4">
        <Calendar className="h-4 w-4 text-[#8B90A3]" />
        <span className="text-[14px]">{formatField(value)}</span>
        <input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </span>
      <span className="mt-2 block text-[12px] leading-5 text-[#98A0B3]">{hint}</span>
    </label>
  );
}

function JourneyStep(props: {
  stages: Stage[];
  editingId: string | null;
  error: string;
  monthsLabel: string;
  ready: boolean;
  rewardsOn: boolean;
  onAddFirst: () => void;
  onUseTemplate: () => void;
  onEdit: (id: string) => void;
  onPatch: (id: string, patch: Partial<Stage>) => void;
  onFinish: (id: string) => void;
  onAddNext: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddTask: (stageId: string) => void;
  onEditTask: (stageId: string, activity: Activity) => void;
  onRemoveTask: (stageId: string, activityId: string) => void;
  onPreview: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const activities = props.stages.reduce((n, s) => n + s.activities.length, 0);
  return (
    <div>
      <button type="button" onClick={props.onBack} className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-medium">
        <ArrowLeft className="h-4 w-4" /> Back to details
      </button>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.03em]">
            Build the retention <span className="font-serif text-[32px] italic text-[#8A3FFC]">journey</span>
          </h1>
          <p className="mt-1 max-w-[520px] text-[14px] leading-6 text-[#667085]">
            Choose when participants return and what they do at each stage. Everything is set up right here on this page.
          </p>
        </div>
        <button type="button" onClick={props.onPreview} className="inline-flex h-10 items-center gap-2 self-start rounded-full border border-[#E4E0EE] bg-white px-4 text-[13px] font-medium">
          <Eye className="h-4 w-4" /> Preview participant journey
        </button>
      </div>

      {props.stages.length > 0 && (
        <div className="mt-5 rounded-[24px] bg-white p-5 shadow-[0_8px_30px_rgba(88,60,160,0.04)]">
          <p className="inline-flex items-center gap-2 text-[14px] font-semibold"><Sparkles className="h-4 w-4 text-[#8A3FFC]" /> Journey summary</p>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat k="Stages" v={`${props.stages.length} of ${MAX_STAGES}`} />
            <Stat k="Total activities" v={String(activities)} />
            <Stat k="Journey duration" v={props.monthsLabel} />
            <Stat k="Status" v={props.ready ? "Ready" : "Not ready"} tone={props.ready ? "good" : "warn"} />
          </div>
          <div className={`mt-4 rounded-full px-4 py-2.5 text-[13px] ${props.ready ? "bg-[#E9FBF3] text-[#0F9F6E]" : "bg-[#FFF6E8] text-[#C47B12]"}`}>
            {props.ready
              ? "This journey is ready."
              : props.stages.some((s) => s.activities.length === 0)
                ? "Every stage needs at least one task."
                : "Finish the open stage to continue."}
          </div>
        </div>
      )}

      {props.stages.length === 0 ? (
        <div className="mt-5 flex min-h-[340px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#D5C9F5] bg-white px-6 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-[#8A3FFC] text-white"><Upload className="h-6 w-6" /></span>
          <h2 className="mt-4 text-[18px] font-semibold">Build your retention journey</h2>
          <p className="mt-2 max-w-[420px] text-[14px] leading-6 text-[#667085]">Create stages that bring participants back over time and guide them toward the campaign outcome.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={props.onAddFirst} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#8A3FFC] px-5 text-[14px] font-semibold text-white">
              <Plus className="h-4 w-4" /> Add first stage
            </button>
            <button type="button" onClick={props.onUseTemplate} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#E4E0EE] bg-white px-5 text-[14px] font-medium">
              Use a journey template
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mt-6 pl-12">
          <div className="absolute bottom-6 left-[18px] top-3 w-px bg-[#E3DDF3]" />
          <RailNode title="Campaign start" sub="Participants join and the journey begins" />
          {props.stages.map((stage, index) =>
            props.editingId === stage.id ? (
              <StageEditor
                key={stage.id}
                index={index}
                stage={stage}
                error={props.error}
                onPatch={(patch) => props.onPatch(stage.id, patch)}
                onFinish={() => props.onFinish(stage.id)}
                onDelete={() => props.onDelete(stage.id)}
                onDuplicate={() => props.onDuplicate(stage.id)}
                onAddTask={() => props.onAddTask(stage.id)}
                onEditTask={(activity) => props.onEditTask(stage.id, activity)}
                onRemoveTask={(id) => props.onRemoveTask(stage.id, id)}
              />
            ) : (
              <SavedStage
                key={stage.id}
                index={index}
                stage={stage}
                onEdit={() => props.onEdit(stage.id)}
                onAddTask={() => {
                  props.onEdit(stage.id);
                  props.onAddTask(stage.id);
                }}
                onDelete={() => props.onDelete(stage.id)}
              />
            ),
          )}
          {props.stages.length < MAX_STAGES && props.editingId === null && (
            <button type="button" onClick={props.onAddNext} className="relative mb-4 inline-flex h-10 items-center gap-2 rounded-full border border-[#E4E0EE] bg-white px-4 text-[13px] font-medium">
              <Plus className="h-4 w-4" /> Add Next Stage
            </button>
          )}
          <RailNode title="Campaign complete" sub="Participants have finished the journey" />
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          disabled={!props.ready}
          onClick={props.onNext}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-[#8A3FFC] px-6 text-[15px] font-semibold text-white disabled:bg-[#DDD6FE] disabled:text-white"
        >
          {props.rewardsOn ? "Continue to rewards and funding" : "Continue to review"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "good" | "warn" }) {
  const color = tone === "good" ? "text-[#0F9F6E]" : tone === "warn" ? "text-[#E39A2B]" : "text-[#1C2533]";
  return (
    <div>
      <p className="text-[12px] text-[#98A0B3]">{k}</p>
      <p className={`mt-1 text-[18px] font-semibold ${color}`}>{v}</p>
    </div>
  );
}

function RailNode({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="relative mb-4">
      <span className="absolute -left-11 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#8A3FFC]" />
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="text-[12px] text-[#8B90A3]">{sub}</p>
    </div>
  );
}

function StageEditor({
  index, stage, error, onPatch, onFinish, onDelete, onDuplicate, onAddTask, onEditTask, onRemoveTask,
}: {
  index: number;
  stage: Stage;
  error: string;
  onPatch: (patch: Partial<Stage>) => void;
  onFinish: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddTask: () => void;
  onEditTask: (activity: Activity) => void;
  onRemoveTask: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState(stage.timing.amount || 1);
  const [unit, setUnit] = useState<Unit>(stage.timing.unit);
  const preset = timingMenuLabel(stage.timing);

  return (
    <div className="relative mb-4 rounded-[24px] border border-[#C4B5FD] bg-white p-4 shadow-[0_8px_24px_rgba(138,63,252,0.08)] md:p-5">
      <span className="absolute -left-12 top-6 grid h-7 w-7 place-items-center rounded-full bg-[#8A3FFC] text-[12px] font-semibold text-white ring-4 ring-[#EDE4FF]">{index + 1}</span>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[#8A3FFC]">STAGE {index + 1}</p>
          <label className="mt-2 flex h-11 items-center gap-2 rounded-full bg-[#F6F4FB] px-4">
            <input
              value={stage.name}
              onChange={(e) => onPatch({ name: e.target.value })}
              className="w-full bg-transparent text-[15px] font-semibold outline-none"
            />
            <Pencil className="h-4 w-4 text-[#8B90A3]" />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onDuplicate} className="grid h-9 w-9 place-items-center rounded-xl border border-[#E7E1F4] text-[#667085]" aria-label="Duplicate stage"><Copy className="h-4 w-4" /></button>
          <button type="button" onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-xl border border-[#E7E1F4] text-[#667085]" aria-label="Delete stage"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="relative mt-4 rounded-[20px] bg-gradient-to-r from-[#F7F4FF] to-white p-4">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#8A3FFC]">RETENTION PERIOD</p>
        <div className="mt-2 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-[26px] font-semibold tracking-[-0.03em]">{timingShort(stage.timing)}</p>
            <p className="text-[13px] text-[#667085]">
              {stage.timing.mode === "immediate" ? "Participants can start immediately after joining." : `Participants can start ${timingLabel(stage.timing)} after the previous stage.`}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <button type="button" onClick={() => { setOpen((v) => !v); setCustom(false); }} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#F4F1FC] px-4 text-[13px] font-medium">
              {preset} <ChevronDown className="h-4 w-4 text-[#8B90A3]" />
            </button>
            <button type="button" onClick={() => { setOpen(true); setCustom(true); }} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#8A3FFC] px-4 text-[13px] font-semibold text-white">
              <Pencil className="h-3.5 w-3.5" /> Customise
            </button>
          </div>
        </div>
        {open && (
          <div className="absolute right-4 top-full z-10 mt-2 w-[260px] rounded-2xl border border-[#EFEAF8] bg-white p-2 shadow-xl">
            {!custom ? (
              <>
                {PRESETS.map((presetTiming) => (
                  <button
                    key={timingMenuLabel(presetTiming)}
                    type="button"
                    onClick={() => {
                      onPatch({ timing: presetTiming });
                      setOpen(false);
                    }}
                    className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[13px] hover:bg-[#F7F5FF]"
                  >
                    {timingMenuLabel(presetTiming)}
                  </button>
                ))}
                <button type="button" onClick={() => setCustom(true)} className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-[#6D28D9] hover:bg-[#F7F5FF]">
                  Custom
                </button>
              </>
            ) : (
              <div className="p-2">
                <label className="text-[12px] text-[#667085]" htmlFor="stage-duration">Duration</label>
                <input id="stage-duration" aria-label="Duration" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl bg-[#F4F1FC] px-3 outline-none" />
                <label className="mt-2 block text-[12px] text-[#667085]" htmlFor="stage-unit">Unit</label>
                <select id="stage-unit" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="mt-1 h-10 w-full rounded-xl bg-[#F4F1FC] px-3 outline-none">
                  {(["Hours", "Days", "Weeks", "Months"] as Unit[]).map((u) => <option key={u}>{u}</option>)}
                </select>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-full px-3 text-[13px]">Cancel</button>
                  <button
                    type="button"
                    onClick={() => {
                      onPatch({ timing: { mode: "after", amount: Math.max(1, amount), unit } });
                      setOpen(false);
                    }}
                    className="h-9 rounded-full bg-[#8A3FFC] px-4 text-[13px] font-semibold text-white"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-[20px] border border-[#F0ECF7] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold">Tasks</p>
          <p className="text-[12px] text-[#98A0B3]">{stage.activities.length} of {MAX_ACTIVITIES}</p>
        </div>
        {stage.activities.length === 0 ? (
          <div className="py-8 text-center">
            <Search className="mx-auto h-5 w-5 text-[#C5C8D4]" />
            <p className="mt-3 text-[13px] leading-5 text-[#98A0B3]">No task yet. Add at least one for participants to complete.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {stage.activities.map((activity, i) => (
              <li key={activity.id} className="flex items-center gap-3 rounded-2xl bg-[#F8F6FC] px-3 py-2.5">
                <span className="text-[12px] text-[#98A0B3]">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{activity.title}</span>
                  <span className="text-[11px] text-[#8B90A3]">{catalogMeta(activity.kind).category}</span>
                </span>
                <button type="button" onClick={() => onEditTask(activity)} className="text-[12px] font-semibold text-[#6D28D9]">Edit</button>
                <button type="button" onClick={() => onRemoveTask(activity.id)} aria-label="Remove task" className="text-[#98A0B3]"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          disabled={stage.activities.length >= MAX_ACTIVITIES}
          onClick={onAddTask}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#E7E1F4] text-[14px] font-medium disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Add Task
        </button>
      </div>
      {error && <p className="mt-3 text-[13px] font-medium text-[#E4545B]">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onFinish} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#8A3FFC] px-5 text-[13px] font-semibold text-white">
          <Check className="h-4 w-4" /> Done
        </button>
      </div>
    </div>
  );
}

function SavedStage({ index, stage, onEdit, onAddTask, onDelete }: { index: number; stage: Stage; onEdit: () => void; onAddTask: () => void; onDelete: () => void }) {
  const preview = stage.activities.slice(0, 3);
  const extra = stage.activities.length - preview.length;
  return (
    <div className="relative mb-3 rounded-[24px] border border-[#EFEAF8] bg-white p-4">
      <span className="absolute -left-12 top-5 grid h-7 w-7 place-items-center rounded-full border border-[#E4DDF5] bg-white text-[12px] font-semibold text-[#8A3FFC]">{index + 1}</span>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] text-[#8B90A3]">Stage {index + 1}</p>
          <p className="text-[16px] font-semibold">{stage.name}</p>
          <p className="mt-1 text-[13px] text-[#667085]">
            Retention: {stage.timing.mode === "immediate" ? "Immediately the campaign starts" : timingLabel(stage.timing) + " after previous stage"} · {stage.activities.length} Task{stage.activities.length === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" onClick={onDelete} className="text-[#98A0B3]" aria-label="Delete stage"><Trash2 className="h-4 w-4" /></button>
      </div>
      <ul className="mt-3 space-y-1 text-[13px] text-[#3C4254]">
        {preview.map((a) => <li key={a.id}>{a.title}</li>)}
        {extra > 0 && <li className="text-[#8B90A3]">+{extra} more</li>}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onAddTask} className="h-9 rounded-full border border-[#E7E1F4] px-4 text-[13px] font-medium">Add Task</button>
        <button type="button" onClick={onEdit} className="h-9 rounded-full border border-[#E7E1F4] px-4 text-[13px] font-medium">Edit Stage</button>
      </div>
    </div>
  );
}

function RewardsStep(props: {
  stages: Stage[];
  budget: number;
  validationOn: boolean;
  curatorOn: boolean;
  splits: number[];
  recipients: number;
  retentionReq: number;
  participantPool: number;
  perPerson: number;
  estimates: number[];
  splitSum: number;
  capacity: number;
  paid: boolean;
  issues: string[];
  canContinue: boolean;
  onBudget: (n: number) => void;
  onValidation: (v: boolean) => void;
  onCurator: (v: boolean) => void;
  onSplit: (i: number, n: number) => void;
  onRecipients: (n: number) => void;
  onRetention: (n: number) => void;
  onEven: () => void;
  onReset: () => void;
  onUseCapacity: () => void;
  onAddBudget: () => void;
  onPay: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const rows = feeRows(props.budget, props.validationOn, props.curatorOn);
  const totalDue = props.budget + OPENING_FEE;
  const short = props.recipients > props.capacity;
  const needPerPerson = props.stages.length * MIN_PER_STAGE;
  const needPool = props.recipients * needPerPerson;
  return (
    <div>
      <button type="button" onClick={props.onBack} className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-medium">
        <ArrowLeft className="h-4 w-4" /> Back to journey
      </button>
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Reward pool & eligibility</h1>
      <p className="mt-1 max-w-[640px] text-[14px] text-[#667085]">Split your reward pool across the retention periods you created in the journey.</p>

      <section className="mt-5 rounded-[28px] bg-white p-5 md:p-6">
        <p className="text-[15px] font-semibold"><span className="mr-2 text-[#8A3FFC]">1</span>Campaign Reward Budget & Allocation</p>
        <p className="mt-1 text-[13px] text-[#8B90A3]">Set the budget. Fees come out first, and what is left is the pool for rewarding participants.</p>
        <label className="mt-4 block text-[13px] font-medium">Campaign Reward Budget</label>
        <div className="mt-2 flex h-12 overflow-hidden rounded-full bg-[#F4F1FC]">
          <input
            type="number"
            min={0}
            value={props.budget}
            onChange={(e) => props.onBudget(Number(e.target.value))}
            className="min-w-0 flex-1 bg-transparent px-5 font-mono text-[15px] outline-none"
          />
          <span className="flex items-center px-4 text-[13px] font-semibold text-[#667085]">USDT</span>
        </div>
        <p className="mt-2 text-[12px] text-[#98A0B3]">Gross budget. The Nexura Service Fee is included in the reward budget.</p>
        <ToggleCard title="Validation Rewards" body="Pays the validators who manually review submissions and ratings (2% of the budget)." on={props.validationOn} onChange={props.onValidation} />
        <ToggleCard title="Project Curator" body="Rewards the project curator (1% of the budget)." on={props.curatorOn} onChange={props.onCurator} />
        <div className="mt-5 overflow-x-auto">
          <div className="grid min-w-[520px] grid-cols-[1fr_90px_120px] px-2 text-[11px] font-semibold tracking-[0.12em] text-[#98A0B3]">
            <span>ALLOCATION BREAKDOWN</span><span className="text-right">%</span><span className="text-right">AMOUNT</span>
          </div>
          {rows.map((row) => (
            <div key={row.label} className="grid min-w-[520px] grid-cols-[1fr_90px_120px] items-center border-b border-[#F4F1F8] px-2 py-3 text-[14px]">
              <span>{row.label}</span>
              <span className="text-right font-medium text-[#667085]">{row.off ? "Off" : `${row.pct}%`}</span>
              <span className="text-right font-mono">{money(row.amount)}</span>
            </div>
          ))}
          <div className="mt-2 grid min-w-[520px] grid-cols-[1fr_120px] items-center rounded-2xl bg-[#F4EEFF] px-4 py-3 text-[14px]">
            <span>Campaign Opening Fee (flat, non-refundable)</span>
            <span className="text-right font-mono font-semibold">{money(OPENING_FEE)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between px-2 text-[15px] font-semibold">
            <span>Total Payment Due</span>
            <span className="font-mono">{money(totalDue)}</span>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-[#667085]">The pool for participants is {money(props.participantPool)}, decide how many people you can reward below.</p>
      </section>

      <section className="mt-4 rounded-[28px] bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold"><span className="mr-2 text-[#8A3FFC]">2</span>Reward Configuration</p>
            <p className="mt-1 text-[13px] text-[#8B90A3]">Recipients are limited by the pool left after fees</p>
          </div>
          <div className="text-right text-[13px]">
            <p className="text-[#8B90A3]">Pool available for participants</p>
            <p className="font-mono text-[16px] font-semibold">{money(props.participantPool)}</p>
            <p className="text-[#8B90A3]">Max reward per participant <span className="font-mono text-[#1C2533]">{money(props.perPerson)}</span></p>
          </div>
        </div>
        <label className="mt-4 block text-[13px] font-medium">Reward Recipients</label>
        <div className="mt-2 flex h-12 overflow-hidden rounded-full bg-[#F4F1FC]">
          <input type="number" min={1} value={props.recipients} onChange={(e) => props.onRecipients(Number(e.target.value))} className="min-w-0 flex-1 bg-transparent px-5 outline-none" />
          <span className="flex items-center px-4 text-[13px] text-[#667085]">participants</span>
        </div>
        <p className="mt-2 text-[12px] leading-5 text-[#98A0B3]">How many qualifying participants the pool rewards. More people can still join without a reward. Each recipient needs at least $2 per rewarded stage.</p>
        {short ? (
          <div className="mt-4 rounded-2xl border border-[#F6C9CC] bg-[#FFF6F6] p-4 text-[13px] leading-6 text-[#9F3A40]">
            <p className="font-semibold">Your available reward pool can’t cover {props.recipients.toLocaleString("en-US")} recipients.</p>
            <p className="mt-1">Every rewarded stage pays each recipient at least $2, and this journey has {props.stages.length} rewarded stages. Each recipient needs {money(needPerPerson)}, and {props.recipients.toLocaleString("en-US")} recipients need {money(needPool)}.</p>
            <p>Your existing-user pool is {money(props.participantPool)}, which is {money(Math.max(0, needPool - props.participantPool))} short. Or lower the recipient count to {props.capacity.toLocaleString("en-US")}.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={props.onAddBudget} className="h-9 rounded-full bg-[#8A3FFC] px-4 text-[13px] font-semibold text-white">Raise the budget</button>
              <button type="button" onClick={props.onUseCapacity} className="h-9 rounded-full border border-[#E7B4B8] bg-white px-4 text-[13px] font-medium">Use {props.capacity.toLocaleString("en-US")} recipients</button>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-full bg-[#E9FBF3] px-4 py-2 text-[13px] text-[#0F9F6E]">Your reward pool of {money(props.participantPool)} can serve up to {props.capacity.toLocaleString("en-US")} recipients at the $2 per stage minimum.</p>
        )}
        <div className="mt-4 flex items-center gap-[6px]"><label className="block text-[13px] font-medium">Nexura Score Requirement</label><NexuraScoreInfoButton /></div>
        <div className="mt-2 flex h-12 max-w-[180px] items-center rounded-full bg-[#F4F1FC] px-4">
          <input type="number" min={0} max={100} value={props.retentionReq} onChange={(e) => props.onRetention(Number(e.target.value))} className="w-full bg-transparent outline-none" />
          <span>%</span>
        </div>
        <p className="mt-2 text-[12px] text-[#98A0B3]">The Nexura score a participant needs to be reward-eligible.</p>
      </section>

      <section className="mt-4 rounded-[28px] bg-white p-5 md:p-6">
        <p className="text-[15px] font-semibold"><span className="mr-2 text-[#8A3FFC]">3</span>Reward allocation by retention period</p>
        <p className="mt-1 text-[13px] text-[#8B90A3]">Split 100% of the campaign reward pool across the return periods</p>
        <div className={`mt-3 rounded-full px-4 py-2 text-[13px] ${props.splitSum === 100 ? "bg-[#E9FBF3] text-[#0F9F6E]" : "bg-[#FFF6F6] text-[#E4545B]"}`}>
          Total allocated: {props.splitSum}% · Remaining: {100 - props.splitSum}%
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={props.onEven} className="h-9 rounded-full border border-[#E7E1F4] px-4 text-[13px]">Split evenly across stages</button>
          <button type="button" onClick={props.onReset} className="h-9 rounded-full border border-[#E7E1F4] px-4 text-[13px]">Reset to template split, adjusted to the $2 minimum</button>
        </div>
        <div className="mt-4 space-y-3">
          {props.stages.map((stage, i) => {
            const estimate = props.estimates[i] ?? 0;
            const bad = estimate < MIN_PER_STAGE;
            return (
              <div key={stage.id} className={`rounded-2xl border p-4 ${bad ? "border-[#F3C1C4]" : "border-[#F0ECF7]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{stage.timing.mode === "immediate" ? "At join" : timingShort(stage.timing)}</p>
                    <p className="text-[12px] text-[#8B90A3]">{stage.name} · {stage.activities.length} assigned tasks</p>
                    <p className={`mt-1 text-[13px] ${bad ? "text-[#E4545B]" : "text-[#667085]"}`}>
                      Estimated {money(estimate)} per participant ({props.splits[i] ?? 0}% of {money(props.perPerson)})
                    </p>
                    {bad && <p className="text-[12px] text-[#E4545B]">Below the $2 minimum. Raise this share or lower recipients.</p>}
                  </div>
                  <label className="flex h-10 items-center gap-1 rounded-full border border-[#E7E1F4] px-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={props.splits[i] ?? 0}
                      onChange={(e) => props.onSplit(i, Number(e.target.value))}
                      className="w-12 bg-transparent text-right outline-none"
                    />
                    <span className="text-[13px]">%</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        {props.issues.length > 0 && (
          <ul className="mt-3 space-y-1 text-[13px] text-[#E4545B]">
            {props.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-[28px] bg-white p-5 md:p-6">
        <p className="text-[15px] font-semibold"><span className="mr-2 text-[#8A3FFC]">4</span>Unused Rewards</p>
        <p className="mt-1 text-[13px] text-[#8B90A3]">What happens to rewards that are not claimed</p>
        <p className="mt-3 text-[14px] leading-6 text-[#3C4254]">Leftover rewards can be withdrawn after the campaign ends. Whatever remains in the Campaign Reward Pool once the campaign is over can be withdrawn by the Owner or a Super Admin.</p>
      </section>

      <section className="mt-4 rounded-[28px] bg-white p-5 md:p-6">
        <p className="text-[15px] font-semibold"><span className="mr-2 text-[#8A3FFC]">5</span>Payment Summary</p>
        <p className="mt-1 text-[13px] text-[#8B90A3]">One combined payment, never split into separate charges</p>
        <div className="mt-4 space-y-3 text-[14px]">
          <PayRow k="Campaign Reward Budget" v={money(props.budget)} />
          <PayRow k="Campaign Opening Fee" v={money(OPENING_FEE)} />
          <PayRow k="Total Payment Due" v={money(totalDue)} strong />
        </div>
        <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-[#F1EEF7] pt-4 sm:flex-row sm:items-center">
          <p className="text-[13px] text-[#667085]">Campaign payment (opening fee + reward budget). Every allocation above is funded from this one transaction.</p>
          {props.paid ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E9FBF3] px-3 py-1.5 text-[13px] font-semibold text-[#0F9F6E]"><Check className="h-4 w-4" /> Confirmed</span>
          ) : (
            <button type="button" disabled={!props.issues.length ? false : true} onClick={props.onPay} className="h-10 shrink-0 rounded-full bg-[#8A3FFC] px-4 text-[13px] font-semibold text-white disabled:bg-[#DDD6FE]">
              {props.issues.length ? "Not paid" : "Pay campaign total"}
            </button>
          )}
        </div>
      </section>

      <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={props.onBack} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#E4E0EE] bg-white px-5 text-[14px] font-medium">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" disabled={!props.canContinue} onClick={props.onNext} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#8A3FFC] px-6 text-[15px] font-semibold text-white disabled:bg-[#DDD6FE]">
          Continue to review <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PayRow({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "font-semibold" : ""}`}>
      <span>{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}

function ToggleCard({ title, body, on, onChange }: { title: string; body: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mt-3 flex items-center gap-4 rounded-2xl border border-[#F0ECF7] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="text-[12px] text-[#8B90A3]">{body}</p>
      </div>
      <button type="button" role="switch" aria-label={title} aria-checked={on} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full ${on ? "bg-[#8A3FFC]" : "bg-[#D9D6E5]"}`}>
        <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition ${on ? "left-[23px]" : "left-[3px]"}`} />
      </button>
    </div>
  );
}

function ReviewStep({
  details, name, rewardsOn, stages, splits, pool, perPerson, retentionReq, published, onEdit, onPreview, onBack, onPublish,
}: {
  details: Details;
  name: string;
  rewardsOn: boolean;
  stages: Stage[];
  splits: number[];
  pool: number;
  perPerson: number;
  retentionReq: number;
  published: boolean;
  onEdit: (id: StepId) => void;
  onPreview: () => void;
  onBack: () => void;
  onPublish: () => void;
}) {
  const span = durationBreakdown(details.start, details.end);
  const activities = stages.reduce((n, s) => n + s.activities.length, 0);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[14px] font-medium">
          <ArrowLeft className="h-4 w-4" /> {rewardsOn ? "Back to rewards" : "Back to journey"}
        </button>
        <button type="button" onClick={onPreview} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#E4E0EE] bg-white px-4 text-[13px] font-medium">
          <Eye className="h-4 w-4" /> Preview participant journey
        </button>
      </div>
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Review</h1>
      <p className="mt-1 text-[14px] text-[#667085]">Everything below reflects how your campaign is configured. Edit any stage, task or section, then publish.</p>

      {published && (
        <div className="mt-4 rounded-full bg-[#E9FBF3] px-4 py-3 text-[14px] font-medium text-[#0F9F6E]">
          Upcoming. {name} is on the public page. Participants can join from {formatChip(details.start)}.
        </div>
      )}

      <section className="mt-5 rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(80,60,140,0.05)] md:p-6">
        <div className="flex gap-4">
          {details.coverUrl ? (
            <img src={details.coverUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#34D399] text-white">
              <Flag className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{name}</h2>
            <p className="mt-1 text-[14px] text-[#667085]">{details.description || "Re-engage participants across the campaign window."}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <DateChip k="STARTS" v={formatChip(details.start)} />
              <ArrowRight className="h-4 w-4 text-[#C5C8D4]" />
              <DateChip k="ENDS" v={formatChip(details.end)} />
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#F1EEF7] pt-4 md:grid-cols-5">
          <Metric k="REWARD POOL" v={rewardsOn ? money(pool) : "—"} sub={rewardsOn ? "Funded via the deposit above" : "Rewards off"} accent={rewardsOn} />
          <Metric k="REWARD / PARTICIPANT" v={rewardsOn ? money(perPerson) : "—"} />
          <Metric k="DURATION" v={span ? `${span.days} Days` : "—"} />
          <Metric k="STAGES" v={String(stages.length)} sub={`${activities} activities total`} />
          <Metric k="RETENTION RATE" v={`${retentionReq}%`} />
        </div>
      </section>

      <h3 className="mb-3 mt-6 text-[16px] font-semibold">Stage Overview</h3>
      <div className="space-y-2">
        {stages.map((stage, i) => (
          <div key={stage.id}>
            <div className="flex items-center gap-3 rounded-full bg-white px-3 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#8A3FFC] text-[13px] font-semibold text-white">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px]"><span className="text-[#0F9F6E]">Stage {i + 1}</span> {stage.name}</span>
                <span className="block truncate text-[12px] text-[#8B90A3]">
                  {stage.timing.mode === "immediate" ? "Immediately" : timingLabel(stage.timing) + " after previous stage"} · {stage.activities.length} {stage.activities.length === 1 ? "activity" : "activities"}
                </span>
              </span>
              {rewardsOn && (
                <span className="hidden rounded-full bg-[#E9FBF3] px-3 py-1 font-mono text-[12px] font-semibold text-[#0F9F6E] sm:inline">
                  +{money(perPerson * ((splits[i] ?? 0) / 100))} {splits[i] ?? 0}%
                </span>
              )}
              <button type="button" onClick={() => onEdit("journey")} className="inline-flex h-8 items-center gap-1 rounded-full border border-[#E7E1F4] px-3 text-[12px] font-medium">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
            {i < stages.length - 1 && (
              <p className="py-1 pl-12 text-[12px] text-[#A78BFA]">↓ Return after {timingShort(stages[i + 1].timing).toLowerCase()}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-full bg-[#E7FBF4] px-4 py-3 text-[14px] text-[#0F9F6E]">
        {rewardsOn
          ? "Everything checks out. Payments are confirmed and the configuration is valid."
          : "Everything checks out. This campaign has no reward pool."}
      </div>

      <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row">
        <button type="button" onClick={() => onEdit("details")} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#E4E0EE] bg-white px-5 text-[14px] font-medium">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" disabled={published} onClick={onPublish} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#8A3FFC] px-6 text-[15px] font-semibold text-white disabled:bg-[#DDD6FE]">
          Publish <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DateChip({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-2xl bg-[#F6F4FB] px-3 py-2">
      <span className="block text-[10px] font-semibold tracking-[0.12em] text-[#98A0B3]">{k}</span>
      <span className="block text-[13px] font-semibold">{v}</span>
    </span>
  );
}

function Metric({ k, v, sub, accent }: { k: string; v: string; sub?: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#98A0B3]">{k}</p>
      <p className={`mt-1 text-[20px] font-semibold ${accent ? "text-[#12B981]" : ""}`}>{v}</p>
      {sub && <p className="text-[12px] text-[#98A0B3]">{sub}</p>}
    </div>
  );
}

function Overlay({ children, onClose, width = 560 }: { children: ReactNode; onClose: () => void; width?: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1C1433]/45 p-3 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl sm:p-6"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function PickerModal({ onPick, onClose }: { onPick: (kind: ActivityKind) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ActivityCategory>("All");
  const items = CATALOG.filter((item) => {
    const matchesFilter = filter === "All" || item.category === filter;
    const matchesQuery = item.title.toLowerCase().includes(query.trim().toLowerCase());
    return matchesFilter && matchesQuery;
  });
  return (
    <Overlay onClose={onClose} width={640}>
      <div className="flex items-start justify-between">
        <h2 className="text-[22px] font-semibold">Configure Tasks</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-[#667085]"><X className="h-5 w-5" /></button>
      </div>
      <label className="mt-4 flex h-12 items-center gap-2 rounded-full bg-[#F4F1FC] px-4">
        <Search className="h-4 w-4 text-[#98A0B3]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks..." className="w-full bg-transparent text-[14px] outline-none" />
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={`h-8 shrink-0 rounded-full border px-3 text-[13px] ${filter === item ? "border-[#8A3FFC] text-[#6D28D9]" : "border-[#E7E1F4] text-[#4B5168]"}`}>
            {item}
          </button>
        ))}
      </div>
      <p className="mt-4 text-[11px] font-semibold tracking-[0.14em] text-[#98A0B3]">{filter.toUpperCase()}</p>
      <ul className="mt-2 max-h-[360px] space-y-1 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.kind}>
            <button type="button" onClick={() => onPick(item.kind)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-[#F7F5FF]">
              <span className="min-w-0 flex-1 text-[14px]">{item.title}</span>
              <span className="text-[12px] text-[#98A0B3]">{item.category}</span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="py-8 text-center text-[13px] text-[#98A0B3]">No tasks match that search.</li>}
      </ul>
    </Overlay>
  );
}

function ConfigModal({
  kind, initial, onSave, onClose, onChange,
}: {
  kind: ActivityKind;
  initial?: Activity;
  onSave: (a: Activity) => void;
  onClose: () => void;
  onChange: () => void;
}) {
  const meta = catalogMeta(kind);
  const [description, setDescription] = useState(initial?.description || meta.description);
  const [url, setUrl] = useState(initial?.url || "");
  const [validation, setValidation] = useState(initial?.validation || meta.validationOptions?.[0] || "");
  const [error, setError] = useState("");

  function save() {
    if (!description.trim()) {
      setError("Add a short description participants will see.");
      return;
    }
    if (meta.urlLabel && !url.trim()) {
      setError(`${meta.urlLabel} is required.`);
      return;
    }
    onSave({
      id: initial?.id ?? uid(),
      kind,
      title: description.trim(),
      description: description.trim(),
      url: url.trim(),
      validation,
    });
  }

  return (
    <Overlay onClose={onClose} width={560}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[22px] font-semibold">Configure Tasks</h2>
          <p className="text-[13px] text-[#8B90A3]">Edit the details of your tasks</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-[#667085]"><X /></button>
      </div>
      <p className="mt-5 text-[12px] text-[#98A0B3]">Activity Type</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-[16px] font-semibold">{meta.title}</p>
        <button type="button" onClick={onChange} className="text-[13px] font-semibold text-[#6D28D9]">Change</button>
      </div>
      {meta.urlLabel && (
        <>
          <label className="mt-4 block text-[13px] font-medium">{meta.urlLabel}</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={meta.urlPlaceholder} className="mt-2 h-12 w-full rounded-full bg-[#F4F1FC] px-5 text-[14px] outline-none" />
        </>
      )}
      <p className="mt-3 text-[13px] leading-5 text-[#667085]">{meta.verify}</p>
      <label className="mt-4 block text-[13px] font-medium">Activity Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2 h-24 w-full resize-none rounded-[20px] bg-[#F4F1FC] px-4 py-3 text-[14px] outline-none" />
      {meta.validationOptions && (
        <>
          <label className="mt-4 block text-[13px] font-medium">Validation type</label>
          <select value={validation} onChange={(e) => setValidation(e.target.value)} className="mt-2 h-12 w-full rounded-full bg-[#F4F1FC] px-4 text-[14px] outline-none">
            {meta.validationOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </>
      )}
      {error && <p className="mt-3 text-[13px] text-[#E4545B]">{error}</p>}
      <div className="mt-6 flex items-center justify-between">
        <button type="button" onClick={onChange} className="inline-flex h-11 items-center gap-2 rounded-full border border-[#E4E0EE] px-5 text-[14px] font-medium">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" onClick={save} className="h-11 rounded-full bg-[#8A3FFC] px-5 text-[14px] font-semibold text-white">
          {initial ? "Save activity" : "Add activity"}
        </button>
      </div>
    </Overlay>
  );
}

function PublishModal({ name, start, end, onConfirm, onClose }: { name: string; start: string; end: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Overlay onClose={onClose} width={520}>
      <h2 className="text-[22px] font-semibold">Publish this campaign?</h2>
      <p className="mt-3 text-[14px] leading-6 text-[#4B5168]">
        Once published, {name} moves to Upcoming and appears on the public page, but participants cannot join until it starts. Reward amounts and reserved participant funds become locked.
      </p>
      <p className="mt-3 text-[14px] leading-6 text-[#4B5168]">
        Starts {formatChip(start)}. Use the week before it opens for marketing and promotion. Participants can join from the start date until {formatChip(end)}.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-11 rounded-full border border-[#E4E0EE] px-5 text-[14px] font-medium">Not yet</button>
        <button type="button" onClick={onConfirm} className="h-11 rounded-full bg-[#8A3FFC] px-5 text-[14px] font-semibold text-white">Publish</button>
      </div>
    </Overlay>
  );
}

function PreviewModal({ stages, onClose }: { stages: Stage[]; onClose: () => void }) {
  return (
    <Overlay onClose={onClose} width={480}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[20px] font-semibold">Participant journey</h2>
          <p className="text-[13px] text-[#8B90A3]">What someone sees after they join.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close"><X /></button>
      </div>
      {stages.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-[#8B90A3]">No stages yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {stages.map((stage, i) => (
            <li key={stage.id} className="rounded-2xl bg-[#F7F5FF] p-4">
              <p className="text-[12px] font-semibold text-[#8A3FFC]">Stage {i + 1} · {timingLabel(stage.timing)}</p>
              <p className="mt-1 font-semibold">{stage.name}</p>
              <ul className="mt-2 space-y-1 text-[13px] text-[#4B5168]">
                {stage.activities.map((a) => <li key={a.id}>{a.title}</li>)}
                {stage.activities.length === 0 && <li className="text-[#98A0B3]">No tasks yet</li>}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Overlay>
  );
}
