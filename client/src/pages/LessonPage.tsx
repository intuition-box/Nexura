// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useParams } from "wouter";
import { Loader2 } from "lucide-react";
import Confetti from "react-confetti";
import { useAuth } from "../lib/auth";
import { apiRequestV2 } from "../lib/queryClient";
import { useWallet } from "../hooks/use-wallet";
import { createProofOfAction } from "../services/web3";
import ProofOfActionModal from "../components/ProofOfActionModal";

type LessonSummary = {
  _id: string;
  title: string;
  description: string;
  reward: number;
  noOfQuestions: number;
  done: boolean;
  disclaimer?: string;
};

type MiniLesson = {
  _id: string;
  text: string;
  lesson: string;
  order?: number;
  createdAt?: string;
  section?: 1 | 2;
  introHeader?: string;
  introBody?: string;
  introTrophy?: "bronze" | "silver" | "gold" | "";
  outroHeader?: string;
  outroBody?: string;
  outroTrophy?: "bronze" | "silver" | "gold" | "";
};

type LessonQuestion = {
  _id: string;
  question: string;
  options: string[];
  lesson: string;
  done: boolean;
  answer?: string;
  solution?: string;
  order?: number;
  createdAt?: string;
  section?: 1 | 2;
  introHeader?: string;
  introBody?: string;
  introTrophy?: "bronze" | "silver" | "gold" | "";
  outroHeader?: string;
  outroBody?: string;
  outroTrophy?: "bronze" | "silver" | "gold" | "";
};

type VideoLesson = {
  _id: string;
  url: string;
  lesson: string;
  order?: number;
  createdAt?: string;
  section?: 1 | 2;
  introHeader?: string;
  introBody?: string;
  introTrophy?: "bronze" | "silver" | "gold" | "";
  outroHeader?: string;
  outroBody?: string;
  outroTrophy?: "bronze" | "silver" | "gold" | "";
};

type LessonStep =
  | { kind: "intro"; key: string; header: string; body: string; trophy: "bronze" | "silver" | "gold" | "" }
  | { kind: "outro"; key: string; header: string; body: string; trophy: "bronze" | "silver" | "gold" | "" }
  | { kind: "mini"; key: string; text: string }
  | { kind: "question"; key: string; question: LessonQuestion }
  | { kind: "video"; key: string; url: string }
  | { kind: "claim"; key: string }
  | { kind: "section-header"; key: string; label: string };

const normalizeApiMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const getProgressStorageKey = (walletAddress?: string | null) =>
  `learn-progress-${walletAddress?.toLowerCase() || "guest"}`;

const OLD_LESSON_STEP_KEY = "tenor-lesson-steps";
const getLessonStepKey = (walletAddress?: string | null) =>
  `tenor-lesson-steps-${walletAddress?.toLowerCase() || "guest"}`;

export default function LessonPage() {
  const params = useParams<{ id: string }>();
  const lessonId = params.id;
  const [location, setLocation] = useLocation();
  const { isConnected, connectWallet, address } = useWallet();
  const { user, loading: authLoading } = useAuth();

  const storageKey = useMemo(() => getProgressStorageKey(address), [address]);
  const lessonStepKey = useMemo(() => getLessonStepKey(address), [address]);
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const isReview = searchParams.get("review") === "1";

  const [lesson, setLesson] = useState<LessonSummary | null>(null);
  const [miniLessons, setMiniLessons] = useState<MiniLesson[]>([]);
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [videoLessons, setVideoLessons] = useState<VideoLesson[]>([]);
  const [hasSection2, setHasSection2] = useState(false);
  const [section2Name, setSection2Name] = useState("");
  const [section2IntroBody, setSection2IntroBody] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>(() => {
    try {
      if (!lessonId) return {};
      // Try wallet-specific key first, fallback to old shared key for migration
      const walletKey = getLessonStepKey(address);
      const allSteps = JSON.parse(localStorage.getItem(walletKey) || "{}");
      if (allSteps[lessonId]?.selectedAnswers) return allSteps[lessonId].selectedAnswers;
      const oldSteps = JSON.parse(localStorage.getItem(OLD_LESSON_STEP_KEY) || "{}");
      return oldSteps[lessonId]?.selectedAnswers || {};
    } catch { return {}; }
  });
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      if (!lessonId || isReview) return 0;
      // Try wallet-specific key first, fallback to old shared key for migration
      const walletKey = getLessonStepKey(address);
      const allSteps = JSON.parse(localStorage.getItem(walletKey) || "{}");
      if (allSteps[lessonId]?.stepIndex != null) return Number(allSteps[lessonId].stepIndex);
      const oldSteps = JSON.parse(localStorage.getItem(OLD_LESSON_STEP_KEY) || "{}");
      return Number(oldSteps[lessonId]?.stepIndex || 0);
    } catch { return 0; }
  });
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [submittingQuestionId, setSubmittingQuestionId] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [showXPModal, setShowXPModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [pendingLessonCompleted, setPendingLessonCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [didInitStep, setDidInitStep] = useState(false);
  const didInitStepRef = useRef(false);
  const confettiFired = useRef(false);
  const isRedoing = useRef(false);
  const direction = useRef(1);

  const [wrongLockUntil, setWrongLockUntil] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  useEffect(() => {
    if (wrongLockUntil <= 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      if (now >= wrongLockUntil) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [wrongLockUntil]);

  const lessonSteps = useMemo<LessonStep[]>(() => {
    type AnyItem = { kind: "mini"; entry: MiniLesson } | { kind: "question"; entry: LessonQuestion } | { kind: "video"; entry: VideoLesson };
    const kindPriority = (k: string) => (k === "mini" ? 0 : k === "video" ? 1 : 2);
    const sanitize = (value: unknown): string => {
      if (typeof value !== "string") return "";
      return value.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    };

    const lessonTitle = sanitize(lesson?.title) || "this lesson";
    const introHeader = "Ready to test your knowledge?";
    const introBody = `Take a quiz to see how much you understand ${lessonTitle}`;
    const outroHeader = "Great job!";
    const outroBody = `You finished the quiz on ${lessonTitle}`;

    // Build steps for a single section from combined items
    const buildSectionSteps = (items: AnyItem[], omitLastOutro = false): LessonStep[] => {
      const sorted = [...items].sort((a, b) => {
        const pk = kindPriority(a.kind) - kindPriority(b.kind);
        if (pk !== 0) return pk;
        const orderDiff = (a.entry.order ?? 0) - (b.entry.order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return (a.entry.createdAt ?? "").localeCompare(b.entry.createdAt ?? "");
      });

      const steps: LessonStep[] = [];
      let i = 0;
      while (i < sorted.length) {
        const item = sorted[i];
        if (item.kind === "question") {
          steps.push({ kind: "intro", key: `intro-group-${item.entry._id}`, header: introHeader, body: introBody, trophy: "bronze" });
          while (i < sorted.length && sorted[i].kind === "question") {
            const qEntry = sorted[i].entry;
            steps.push({ kind: "question", key: `question-${qEntry._id}`, question: qEntry });
            i++;
          }
          // Skip outro if this is the last group and we're omitting it (section 1 → section 2 bridge)
          if (!omitLastOutro || i < sorted.length) {
            steps.push({ kind: "outro", key: `outro-group-${sorted[i - 1].entry._id}`, header: outroHeader, body: outroBody, trophy: "silver" });
          }
        } else {
          if (item.kind === "mini") {
            steps.push({ kind: "mini", key: `mini-${item.entry._id}`, text: item.entry.text });
          } else {
            steps.push({ kind: "video", key: `video-${item.entry._id}`, url: item.entry.url });
          }
          i++;
        }
      }
      return steps;
    };

    if (hasSection2) {
      const s1Items: AnyItem[] = [
        ...miniLessons.filter(m => (m.section || 1) === 1).map(e => ({ kind: "mini" as const, entry: e })),
        ...questions.filter(q => (q.section || 1) === 1).map(e => ({ kind: "question" as const, entry: e })),
        ...videoLessons.filter(v => (v.section || 1) === 1).map(e => ({ kind: "video" as const, entry: e })),
      ];
      const s2Items: AnyItem[] = [
        ...miniLessons.filter(m => m.section === 2).map(e => ({ kind: "mini" as const, entry: e })),
        ...questions.filter(q => q.section === 2).map(e => ({ kind: "question" as const, entry: e })),
        ...videoLessons.filter(v => v.section === 2).map(e => ({ kind: "video" as const, entry: e })),
      ];

      return [
        ...buildSectionSteps(s1Items, true),
        { kind: "section-header" as const, key: "section-2-header", label: section2IntroBody || `Excellent work!\nYou just completed section 1 of ${lessonTitle}. You can now proceed to section 2.` },
        ...buildSectionSteps(s2Items),
        { kind: "claim" as const, key: "claim" },
      ];
    }

    // No section 2 — flat flow (original behavior)
    const combined: AnyItem[] = [
      ...miniLessons.map((entry) => ({ kind: "mini" as const, entry })),
      ...questions.map((entry) => ({ kind: "question" as const, entry })),
      ...videoLessons.map((entry) => ({ kind: "video" as const, entry })),
    ];
    return [...buildSectionSteps(combined), { kind: "claim" as const, key: "claim" }];
  }, [miniLessons, questions, videoLessons, lesson?.title, hasSection2, section2Name, section2IntroBody]);

  const activeStep = lessonSteps[currentStep];
  const currentQuestion = activeStep?.kind === "question" ? activeStep.question : null;
  const currentSelection = currentQuestion
    ? selectedAnswers[currentQuestion._id] ?? (currentQuestion.done ? currentQuestion.answer : "") ?? ""
    : "";
  const completedQuestions = useMemo(() => questions.filter((question) => question.done).length, [questions]);
  const allQuestionsDone = questions.length > 0 && completedQuestions === questions.length;
  const progress = lessonSteps.length ? ((currentStep + 1) / lessonSteps.length) * 100 : 0;
  const currentStepLabel = lessonSteps.length ? `STEP ${currentStep + 1}/${lessonSteps.length}` : "STEP 0/0";

  useEffect(() => {
    const updateSize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const syncLocalProgress = (nextLesson: LessonSummary | null, nextQuestions: LessonQuestion[], skipStepIndex = false) => {
    if (!lessonId) return;

    const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const maxStepIndex = Math.max(lessonSteps.length - 1, nextQuestions.length + miniLessons.length, 0);
    const updates: Record<string, unknown> = {
      progress: nextLesson?.done ? nextQuestions.length : nextQuestions.filter((entry) => entry.done).length,
      totalQuestions: nextQuestions.length,
      quizCompleted: Boolean(nextLesson?.done),
      claimedReward: Number(nextLesson?.reward || 0),
    };
    if (!skipStepIndex) {
      updates.stepIndex = Math.min(currentStep, maxStepIndex);
    }
    data[lessonId] = {
      ...(data[lessonId] || {}),
      ...updates,
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
    window.dispatchEvent(new Event("progress-update"));
  };

  const loadLesson = async () => {
    if (!lessonId) return;

    setLoading(true);
    setPageError("");

    try {
      const [lessonsResponse, detailsResponse] = await Promise.all([
        apiRequestV2("GET", "/api/lesson/get-lessons"),
        apiRequestV2("GET", `/api/lesson/get-lesson-details?id=${lessonId}`),
      ]);

      const lessonMatch =
        (lessonsResponse.lessons || []).find((entry: LessonSummary) => entry._id === lessonId) || null;
      const nextMiniLessons = detailsResponse.miniLessons || [];
      const nextQuestions = detailsResponse.questions || [];
      const nextVideoLessons = detailsResponse.videoLessons || [];
      const nextSelectedAnswers = nextQuestions.reduce((acc: Record<string, string>, entry: LessonQuestion) => {
        if (entry.done && entry.answer) {
          acc[entry._id] = entry.answer;
        }
        return acc;
      }, {});

      setLesson(lessonMatch);
      setMiniLessons(nextMiniLessons);
      setQuestions(nextQuestions);
      setVideoLessons(nextVideoLessons);
      setHasSection2(detailsResponse.hasSection2 || false);
      setSection2Name(detailsResponse.section2?.name || "");
      setSection2IntroBody(detailsResponse.section2IntroBody || "");
      // Merge server answers (done questions) into existing state without overwriting local selections
      if (!isRedoing.current && !isReview) {
        setSelectedAnswers((current) => ({ ...current, ...nextSelectedAnswers }));
      }
      syncLocalProgress(lessonMatch, nextQuestions, !didInitStep);
    } catch (error) {
      setPageError(normalizeApiMessage(error, "Failed to load lesson"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      void loadLesson();
    }
  }, [authLoading, lessonId]);

  // Clamp currentStep to valid range once REAL lesson content is loaded (not just the claim step)
  useEffect(() => {
    if (lessonSteps.length <= 1 || didInitStepRef.current) return;
    didInitStepRef.current = true;
    const clamped = Math.min(currentStep, lessonSteps.length - 1);
    if (clamped !== currentStep) {
      setCurrentStep(clamped);
    }
    setDidInitStep(true);
  }, [lessonSteps.length]);

  // Re-read step from the correct wallet key when address becomes available
  useEffect(() => {
    if (!address || !lessonId || isReview) return;
    try {
      const allSteps = JSON.parse(localStorage.getItem(lessonStepKey) || "{}");
      const saved = allSteps[lessonId]?.stepIndex;
      if (saved != null && saved > 0) {
        setCurrentStep(Number(saved));
      }
    } catch {}
  }, [address, lessonId, lessonStepKey, isReview]);

  // Force step 0 when entering review/learn mode for completed lessons
  useEffect(() => {
    if (isReview) {
      setCurrentStep(0);
      setSelectedAnswers({});
    }
  }, [isReview, lessonId]);

  // Explicit save function — called directly from navigation and answer selection
  // Accept optional latestQuestions to avoid reading stale React state after submitAnswer
  const saveProgress = useCallback((step: number, answers: Record<string, string>, latestQuestions?: LessonQuestion[]) => {
    if (!lessonId) return;
    const qs = latestQuestions ?? questions;
    const allSteps = JSON.parse(localStorage.getItem(lessonStepKey) || "{}");
    allSteps[lessonId] = { stepIndex: step, selectedAnswers: answers };
    localStorage.setItem(lessonStepKey, JSON.stringify(allSteps));

    // Also flush question-based progress to the wallet-dependent key so Learn.tsx stays in sync
    const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const completedCount = qs.filter((entry) => entry.done).length;
    data[lessonId] = {
      ...(data[lessonId] || {}),
      progress: lesson?.done ? qs.length : completedCount,
      totalQuestions: qs.length,
      quizCompleted: Boolean(lesson?.done),
      stepIndex: step,
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
    window.dispatchEvent(new Event("progress-update"));
  }, [lessonId, lessonStepKey, storageKey, questions, lesson?.done]);

  useEffect(() => {
    if (!lessonId || !didInitStep) return;
    syncLocalProgress(lesson, questions, true);
  }, [didInitStep, lessonId, lesson?.done, lesson?.reward, questions]);

  useEffect(() => {
    if (!showXPModal && !(activeStep?.kind === "claim" && allQuestionsDone)) return;
    if (confettiFired.current || isReview) return;
    confettiFired.current = true;
    setShowConfetti(true);
    const timeout = window.setTimeout(() => setShowConfetti(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [showXPModal, activeStep?.kind, allQuestionsDone]);

  // Auto-show completion modal on subsequent completions (lesson already done) with 1s delay
  const autoModalFired = useRef(false);
  useEffect(() => {
    if (!lesson?.done || !allQuestionsDone || activeStep?.kind !== "claim") return;
    if (showXPModal || autoModalFired.current) return;
    autoModalFired.current = true;
    const timeout = window.setTimeout(() => setShowXPModal(true), 1000);
    return () => window.clearTimeout(timeout);
  }, [lesson?.done, allQuestionsDone, activeStep?.kind, showXPModal]);

  const ensureReadyForProtectedAction = async () => {
    if (!isConnected) {
      await connectWallet();
      return false;
    }

    if (!user) {
      setActionMessage("Sign in with your wallet before continuing this lesson.");
      return false;
    }

    return true;
  };

  const isCorrectAnswer = (question: LessonQuestion, answer: string) =>
    answer.trim().toLowerCase() === String(question.solution || "").trim().toLowerCase();

  const currentFeedback =
    currentQuestion && currentSelection
      ? isCorrectAnswer(currentQuestion, currentSelection)
        ? "correct"
        : "wrong"
      : null;

  const lockoutRemainingMs = Math.max(0, wrongLockUntil - nowTick);
  const lockoutRemainingSec = Math.ceil(lockoutRemainingMs / 1000);
  const isAnswerLocked = lockoutRemainingMs > 0;

  const startLesson = async () => {
    if (!lessonId) return false;

    const canContinue = await ensureReadyForProtectedAction();
    if (!canContinue) return false;

    setStarting(true);
    setActionMessage("");

    try {
      await apiRequestV2("POST", `/api/lesson/start-lesson?lessonId=${lessonId}`);
      return true;
    } catch (error) {
      const message = normalizeApiMessage(error, "Unable to start lesson");
      if (!message.toLowerCase().includes("already started") && !message.toLowerCase().includes("already completed")) {
        setActionMessage(message);
        return false;
      }
      return true;
    } finally {
      setStarting(false);
    }
  };

  const submitAnswer = async () => {
    if (!currentQuestion || !lessonId) return;
    const answer = currentSelection;
    if (!answer) return;
    const answerIsCorrect = isCorrectAnswer(currentQuestion, answer);
    if (!answerIsCorrect) {
      setActionMessage("Keep selecting until you find the correct answer.");
      return false;
    }

    const started = await startLesson();
    if (!started) return false;

    setSubmittingQuestionId(currentQuestion._id);
    setActionMessage("");

    try {
      const response = await apiRequestV2("POST", "/api/lesson/answer-question", {
        question: currentQuestion._id,
        lesson: lessonId,
        answer,
      });

      if (answerIsCorrect) {
        const updatedQuestions = questions.map((entry) =>
          entry._id === currentQuestion._id
            ? { ...entry, done: true, answer }
            : entry
        );
        setQuestions(updatedQuestions);
        // Immediately persist progress to localStorage so it survives navigation/reload
        syncLocalProgress(lesson, updatedQuestions, true);
        setActionMessage(response.message || "Correct answer saved.");
        return true;
      }
    } catch (error) {
      const message = normalizeApiMessage(error, "Unable to submit answer");
      setActionMessage(message);
    } finally {
      setSubmittingQuestionId(null);
    }

    return false;
  };

  const claimXp = async () => {
    if (!lessonId) return;

    const canContinue = await ensureReadyForProtectedAction();
    if (!canContinue) return;

    setShowProofModal(true);
  };

  const finalizeLessonXpClaim = async (txHash: string) => {
    if (!lessonId) return;

    setClaiming(true);
    setActionMessage("");

    try {
      await apiRequestV2("POST", "/api/user/update-claims-created", { txHash });

      const response = await apiRequestV2("POST", `/api/lesson/reward-lesson-xp?id=${lessonId}`);
      setActionMessage(response.message || "XP reward claimed.");
      // Reset saved step progress on completion
      const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (data[lessonId]) {
        data[lessonId].stepIndex = 0;
        delete data[lessonId].selectedAnswers;
        localStorage.setItem(storageKey, JSON.stringify(data));
      }
      // Also reset the wallet-namespaced step key
      const allSteps = JSON.parse(localStorage.getItem(lessonStepKey) || "{}");
      delete allSteps[lessonId];
      localStorage.setItem(lessonStepKey, JSON.stringify(allSteps));
      // Clean up old shared key if present (migration)
      try {
        const oldSteps = JSON.parse(localStorage.getItem(OLD_LESSON_STEP_KEY) || "{}");
        if (oldSteps[lessonId]) {
          delete oldSteps[lessonId];
          localStorage.setItem(OLD_LESSON_STEP_KEY, JSON.stringify(oldSteps));
        }
      } catch {}
      try { await loadLesson(); } catch {}  // don't block modal if reload fails
      // Re-reset stepIndex after loadLesson (it overwrites the cleanup above)
      try {
        const dataAfter = JSON.parse(localStorage.getItem(storageKey) || "{}");
        if (dataAfter[lessonId]) {
          dataAfter[lessonId].stepIndex = 0;
          localStorage.setItem(storageKey, JSON.stringify(dataAfter));
        }
      } catch {}
      setPendingLessonCompleted(true);
    } catch (error) {
      const message = normalizeApiMessage(error, "Unable to claim XP");
      setActionMessage(message);
      if (message.toLowerCase().includes("already")) {
        await loadLesson();
        setPendingLessonCompleted(true);
      }
    } finally {
      setClaiming(false);
    }
  };

  const goPrev = () => {
    if (currentStep <= 0) return;
    direction.current = -1;
    setActionMessage("");
    const nextStep = Math.max(currentStep - 1, 0);
    setCurrentStep(nextStep);
    saveProgress(nextStep, selectedAnswers);
  };

  const goNext = async () => {
    if (!activeStep) return;

    if (activeStep.kind === "question") {
      if (!activeStep.question.done || isRedoing.current) {
        if (isRedoing.current && activeStep.question.done) {
          // In redo mode for already-done question: just advance without API call
          if (!currentSelection) return;
          // Check answer locally
          if (!isCorrectAnswer(activeStep.question, currentSelection)) {
            return; // wrong answer, don't advance
          }
          // Correct — advance without API
          if (currentStep < lessonSteps.length - 1) {
            direction.current = 1;
            const nextStep = Math.min(currentStep + 1, lessonSteps.length - 1);
            setCurrentStep(nextStep);
            saveProgress(nextStep, selectedAnswers);
          }
          return;
        }
        // Normal flow: not done yet, submit to API
        if (!currentSelection) return;
        const saved = await submitAnswer();
        if (saved && currentStep < lessonSteps.length - 1) {
          const nextStep = Math.min(currentStep + 1, lessonSteps.length - 1);
          direction.current = 1;
          setCurrentStep(nextStep);
          // Pass updated questions so saveProgress uses the fresh done count (Bug 1 fix)
          const updatedQs = questions.map((entry) =>
            entry._id === activeStep.question._id ? { ...entry, done: true, answer: currentSelection } : entry
          );
          saveProgress(nextStep, selectedAnswers, updatedQs);
        }
        return;
      }

      if (currentStep < lessonSteps.length - 1) {
        setActionMessage("");
        direction.current = 1;
        const nextStep = Math.min(currentStep + 1, lessonSteps.length - 1);
        setCurrentStep(nextStep);
        saveProgress(nextStep, selectedAnswers);
      }
      return;
    }

    if (activeStep.kind === "claim") {
      if (!lesson?.done && allQuestionsDone) {
        isRedoing.current = false;
        await claimXp();
      }
      // Don't block navigation — user can still go back via prev button
      return;
    }

    if (currentStep < lessonSteps.length - 1) {
      setActionMessage("");
      direction.current = 1;
      const nextStep = Math.min(currentStep + 1, lessonSteps.length - 1);
      setCurrentStep(nextStep);
      saveProgress(nextStep, selectedAnswers);
    }
  };

  const resetLessonView = () => {
    setShowXPModal(false);
    confettiFired.current = false;
    autoModalFired.current = false;
    isRedoing.current = true;
    setCurrentStep(0);
    setSelectedAnswers({});
    saveProgress(0, {});
    window.scrollTo({ top: 0, behavior: "smooth" });
    void loadLesson();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-black p-4 sm:p-6 text-white">
        <div className="mx-auto max-w-3xl space-y-4">
          <button onClick={() => setLocation("/learn")} className="text-sm text-purple-300 hover:text-white">
            ← Back to lessons
          </button>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 sm:p-6">
            <p className="text-sm text-red-300">{pageError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center gap-3 px-3 sm:px-4 pt-4 sm:pt-6 pb-10">
      <Confetti
        width={windowSize.width}
        height={windowSize.height}
        numberOfPieces={showConfetti ? 180 : 0}
        recycle={false}
        gravity={0.15}
      />

      {/* Back link + breadcrumb */}
      <div className="w-full max-w-4xl space-y-1">
        <button onClick={() => setLocation("/learn")} className="text-sm text-purple-300 hover:text-white">
          ← Back to lessons
        </button>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-purple-400 text-xs font-semibold uppercase tracking-widest">Learn</span>
        </div>
      </div>

      {/* Lesson title */}
      <h1 className="w-full max-w-4xl text-2xl sm:text-4xl font-extrabold leading-tight bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
        {lesson?.title || "Lesson"}
      </h1>

      {/* Progress bar */}
      <div className="w-full max-w-4xl">
        <div className="w-full h-2 rounded-full overflow-hidden bg-white/20">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #94E2FF, #8A3FFC)" }}
          />
        </div>
        <div className="flex justify-between items-center mt-1.5 gap-2">
          <span
            className="text-[11px] font-medium truncate max-w-[60%] uppercase tracking-wide"
            style={{ color: "#94E2FF" }}
          >
            {lesson?.title || "Lesson"}
          </span>
          <span className="text-[11px] text-white/50 shrink-0 tabular-nums">{currentStepLabel}</span>
        </div>
      </div>

      {/* Card + XP widget */}
      <div className="w-full max-w-4xl flex flex-col gap-3">

        {/* Step card */}
        <div
          className={`rounded-3xl flex flex-col overflow-hidden relative ${activeStep?.kind === "video" ? "min-h-0" : "h-[320px] sm:h-[300px]"}`}
          style={{ background: activeStep?.kind === "video" ? "#000" : "linear-gradient(145deg, #8B3EFE, #4A1B8A)" }}
        >
          {/* Content row: prev | content | next */}
          <div className={`flex items-center justify-center gap-1 sm:gap-3 px-1 sm:px-2 pt-3 sm:pt-4 pb-1 ${activeStep?.kind === "video" ? "" : ""}`} style={activeStep?.kind === "video" ? {} : { height: "calc(100% - 70px)" }}>

            {/* Prev button */}
            <button
              onClick={goPrev}
              disabled={currentStep === 0}
              className="shrink-0 w-11 h-11 sm:w-auto sm:h-auto sm:p-2 flex items-center justify-center transition-opacity opacity-60 hover:opacity-90 disabled:opacity-20"
            >
              <img src="/prev-arrow.png" alt="Previous" className="w-6 h-8 sm:w-10 sm:h-14 object-contain" />
            </button>

            {/* Animated content */}
            <AnimatePresence mode="wait" initial={false} custom={direction.current}>
              <motion.div
                key={currentStep}
                custom={direction.current}
                variants={{
                  enter: (d) => ({ x: d * 50, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (d) => ({ x: d * -50, opacity: 0 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 340, damping: 30, mass: 0.8 }}
                className="flex-1 min-w-0 px-2 sm:px-4 text-center"
              >
                {/* Intro / Outro */}
                {(activeStep?.kind === "intro" || activeStep?.kind === "outro") ? (
                  (!activeStep.trophy && !activeStep.header?.trim() && !activeStep.body?.trim()) ? null : (
                  <div className="flex flex-col items-center w-full pt-4 sm:pt-6">
                    {activeStep.trophy && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0, rotate: -30 }}
                        animate={{ scale: [0, 1.15, 1], opacity: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0, duration: 0.8 }}
                        className="relative mt-3 sm:mt-4"
                      >
                        <motion.img
                          src={`/nexura-${activeStep.trophy}.png`}
                          alt={`${activeStep.trophy} trophy`}
                          className="w-20 h-20 sm:w-28 sm:h-28 object-contain relative z-10"
                          animate={{ y: [0, -3, 0] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        />
                        {/* Rotating sun rays — soft ethereal glow */}
                        <div
                          className="absolute inset-[-20%] z-0 rounded-full"
                          style={{
                            background: `conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.5) 5deg, transparent 15deg, transparent 45deg, rgba(255,255,255,0.4) 50deg, transparent 60deg, transparent 90deg, rgba(255,255,255,0.5) 95deg, transparent 105deg, transparent 135deg, rgba(255,255,255,0.4) 140deg, transparent 150deg, transparent 180deg, rgba(255,255,255,0.5) 185deg, transparent 195deg, transparent 225deg, rgba(255,255,255,0.4) 230deg, transparent 240deg, transparent 270deg, rgba(255,255,255,0.5) 275deg, transparent 285deg, transparent 315deg, rgba(255,255,255,0.4) 320deg, transparent 330deg)`,
                            animation: "spin 8s linear infinite",
                            filter: "blur(8px)",
                            opacity: 0.6,
                          }}
                        />
                        {/* Inner warm glow */}
                        <div
                          className="absolute inset-[-5%] z-0 rounded-full"
                          style={{
                            background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(139,62,254,0.1) 40%, transparent 70%)",
                            animation: "pulse 3s ease-in-out infinite",
                          }}
                        />
                      </motion.div>
                    )}
                    <div className="mt-4 sm:mt-5 space-y-1.5">
                      {activeStep.header && (
                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5, duration: 0.4 }}
                          className="text-base sm:text-lg font-bold leading-snug text-center"
                        >
                          {activeStep.header}
                        </motion.p>
                      )}
                      {activeStep.body && (
                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6, duration: 0.4 }}
                          className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap text-white/80 text-center"
                        >
                          {activeStep.body}
                        </motion.p>
                      )}
                    </div>
                  </div>
                  )

                /* Mini lesson */
                ) : activeStep?.kind === "mini" ? (
                  <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap py-2 text-center">
                    {activeStep.text}
                  </p>

                /* Section header */
                ) : activeStep?.kind === "section-header" ? (
                  <div className="flex flex-col items-center py-6 gap-3">
                    <div className="flex items-center gap-3 w-full max-w-xs">
                      <div className="flex-1 h-px bg-purple-400/30" />
                      <h2 className="text-lg sm:text-xl font-bold text-purple-300 uppercase tracking-wider">
                        {section2Name || "Section 2"}
                      </h2>
                      <div className="flex-1 h-px bg-purple-400/30" />
                    </div>
                    <p className="text-sm sm:text-base leading-relaxed text-white/70 text-center whitespace-pre-line">
                      {activeStep.label}
                    </p>
                  </div>

                /* Video */
                ) : activeStep?.kind === "video" ? (
                  <div className="w-full">
                    <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "16 / 9" }}>
                      <iframe
                        className="absolute inset-0 h-full w-full"
                        src={(() => {
                          const url = activeStep.url;
                          let videoId = "";
                          try {
                            const parsed = new URL(url);
                            if (parsed.hostname.includes("youtu.be")) {
                              videoId = parsed.pathname.slice(1);
                            } else {
                              videoId = parsed.searchParams.get("v") || "";
                            }
                          } catch {}
                          return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
                        })()}
                        title="Video lesson"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>

                /* Question */
                ) : activeStep?.kind === "question" ? (
                  <div className="flex flex-col gap-1.5 sm:gap-2 text-left">
                    <h2 className="text-sm sm:text-base font-bold text-center leading-snug uppercase tracking-wide">
                      {activeStep.question.question}
                    </h2>

                    <div className="flex flex-col gap-1.5">
                      {activeStep.question.options.map((option, index) => {
                        const isSelected = currentSelection === option;
                        const isCorrect = isSelected && currentFeedback === "correct";
                        const isWrong = isSelected && currentFeedback === "wrong";

                        const base = "flex items-center justify-between px-2 sm:px-2.5 py-1.5 rounded-md border transition-colors";
                        const cursorClass = isAnswerLocked ? "cursor-not-allowed" : "cursor-pointer";
                        const style = isCorrect
                          ? `${base} ${cursorClass} bg-[#00E1A220] border-[#00E1A2CC]`
                          : isWrong
                            ? `${base} ${cursorClass} bg-[#F43F5E20] border-[#F43F5E]`
                            : isAnswerLocked
                              ? `${base} ${cursorClass} bg-white/4 border-white/8 opacity-40`
                              : `${base} ${cursorClass} bg-white/8 border-white/12 active:bg-white/15`;

                        return (
                          <div
                            key={`${activeStep.question._id}-${option}`}
                            onClick={() => {
                              if (isAnswerLocked) return;
                              const newAnswers = { ...selectedAnswers, [activeStep.question._id]: option };
                              setSelectedAnswers(newAnswers);
                              setActionMessage("");
                              saveProgress(currentStep, newAnswers);
                              if (!isCorrectAnswer(activeStep.question, option)) {
                                setWrongLockUntil(Date.now() + 5000);
                                setNowTick(Date.now());
                              }
                            }}
                            className={style}
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="shrink-0 w-4 h-4 flex items-center justify-center rounded bg-white/15 text-[9px] font-bold">
                                {String.fromCharCode(65 + index)}
                              </span>
                              <span className="capitalize text-xs sm:text-sm break-words leading-snug">{option}</span>
                            </span>
                            {isCorrect ? (
                              <span className="shrink-0 ml-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-[#00E1A2] text-black font-bold text-[9px]">✓</span>
                            ) : isWrong ? (
                              <span className="shrink-0 ml-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-[#F43F5E] text-black font-bold text-[9px]">✕</span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {isAnswerLocked && (
                      <p className="text-center text-[11px] font-semibold text-[#F43F5E] mt-1">
                        Wrong answer — try again in {lockoutRemainingSec}s
                      </p>
                    )}
                    <p className="text-center text-[11px] text-white/45 mt-1">
                      Question {questions.findIndex((e) => e._id === activeStep.question._id) + 1} of {questions.length}
                    </p>
                  </div>

                /* Congratulations / Claim */
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-full gap-4 pt-8">
                    <motion.div
                      className="relative"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    >
                      <motion.img
                        src="/nexura-gold.png"
                        alt="Gold Trophy"
                        className="w-20 h-20 sm:w-28 sm:h-28 object-contain relative z-10"
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <div
                        className="absolute inset-[-10%] z-0 rounded-full"
                        style={{
                          background: `conic-gradient(from 0deg, transparent 0deg, rgba(255,215,0,0.4) 5deg, transparent 15deg, transparent 45deg, rgba(255,215,0,0.3) 50deg, transparent 60deg, transparent 90deg, rgba(255,215,0,0.4) 95deg, transparent 105deg, transparent 135deg, rgba(255,215,0,0.3) 140deg, transparent 150deg, transparent 180deg, rgba(255,215,0,0.4) 185deg, transparent 195deg, transparent 225deg, rgba(255,215,0,0.3) 230deg, transparent 240deg, transparent 270deg, rgba(255,215,0,0.4) 275deg, transparent 285deg, transparent 315deg, rgba(255,215,0,0.3) 320deg, transparent 330deg)`,
                          animation: "spin 8s linear infinite",
                          filter: "blur(6px)",
                          opacity: 0.5,
                        }}
                      />
                      <div
                        className="absolute inset-[-5%] z-0 rounded-full"
                        style={{
                          background: "radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 60%)",
                          animation: "pulse 3s ease-in-out infinite",
                        }}
                      />
                    </motion.div>
                    <div className="mt-2 space-y-2 text-center">
                      <motion.h2
                        className="text-sm sm:text-base font-extrabold text-white"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.4 }}
                      >
                        Congratulations!
                      </motion.h2>
                      <motion.p
                        className="text-[10px] sm:text-xs text-white/60 leading-relaxed max-w-[200px] sm:max-w-[240px] mx-auto"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.4 }}
                      >
                        {allQuestionsDone
                          ? `You've mastered ${lesson?.title ?? "this lesson"}. Claim your XP rewards.`
                          : "Finish every question to unlock your XP reward."}
                      </motion.p>
                    </div>
                    <motion.button
                      onClick={() => void claimXp()}
                      disabled={!allQuestionsDone || claiming || lesson?.done}
                      className={`mt-3 px-6 py-2 rounded-full font-bold text-sm text-white transition-all duration-200 ${
                        !allQuestionsDone || lesson?.done
                          ? "bg-white/20 cursor-not-allowed opacity-60"
                          : "bg-[#5B1BA0] hover:bg-[#4a1585] active:scale-95 shadow-[0_0_24px_rgba(91,27,160,0.4)]"
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7, duration: 0.4 }}
                    >
                      {lesson?.done ? "XP Claimed" : claiming ? "Claiming…" : "Claim XP"}
                    </motion.button>
                    {lesson?.disclaimer?.trim() && (
                      <div className="w-full mt-4 pt-3 border-t border-white/15">
                        <p className="text-[11px] text-white/40 text-center whitespace-pre-wrap">
                          {lesson.disclaimer.trim()}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Next button */}
            <button
              onClick={() => void goNext()}
              disabled={
                currentStep >= lessonSteps.length - 1 ||
                (activeStep?.kind === "question" && !activeStep.question.done && !currentSelection) ||
                submittingQuestionId === currentQuestion?._id ||
                claiming
              }
              className="shrink-0 w-11 h-11 sm:w-auto sm:h-auto sm:p-2 flex items-center justify-center transition-opacity opacity-60 hover:opacity-90 disabled:opacity-20"
            >
              <img src="/next-arrow.png" alt="Next" className="w-6 h-8 sm:w-10 sm:h-14 object-contain" />
            </button>
          </div>

          {/* Bottom bar: Continue button */}
          <div className="px-4 sm:px-5 pb-3 sm:pb-3 pt-2 flex items-center justify-end">
            {activeStep?.kind !== "claim" ? (
              <div className="flex shrink-0">
                <button
                  onClick={() => void goNext()}
                  disabled={
                    (activeStep?.kind === "question" &&
                      !activeStep.question.done &&
                      (!currentSelection || currentFeedback === "wrong")) ||
                    submittingQuestionId === currentQuestion?._id
                  }
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 ${
                    activeStep?.kind === "question" &&
                    !activeStep.question.done &&
                    (!currentSelection || currentFeedback === "wrong")
                      ? "bg-white/15 cursor-not-allowed opacity-50"
                      : "bg-[#8B3EFE] hover:bg-[#7A2FE0] active:scale-95"
                  }`}
                >
                  {activeStep?.kind === "question" && submittingQuestionId === activeStep.question._id
                    ? "Saving…"
                    : "Continue"}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* XP rewards badge */}
        <button
          className="flex items-center gap-2 px-4 py-3 rounded-lg border self-start"
          style={{
            background: "#1D182E80",
            borderColor: "#D4BBFF1A",
            borderWidth: "1px",
          }}
          type="button"
        >
          <img src="/xp-icon.png" alt="XP Icon" className="w-12 h-12 object-contain" />
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-bold" style={{ color: "#94E2FF" }}>
              XP REWARDS
            </span>
            <span className="text-xl font-bold text-white">{lesson?.reward ?? 0}</span>
          </div>
        </button>


      </div>

      <ProofOfActionModal
        open={showProofModal}
        onOpenChange={(next) => {
          setShowProofModal(next);
          if (!next && pendingLessonCompleted) {
            setPendingLessonCompleted(false);
            setShowXPModal(true);
          }
        }}
        object={lesson?.title || "this lesson"}
        xpReward={lesson?.reward}
        sourceLabel="Lesson"
        onSuccess={finalizeLessonXpClaim}
        alreadyClaimed={Boolean(lesson?.done)}
      />

      {/* Lesson Complete modal — matches Figma design */}
      {showXPModal ? (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/75 px-0 sm:px-4">
          <div
            className="w-full sm:max-w-[400px] rounded-t-[28px] sm:rounded-[28px] overflow-hidden relative text-center"
            style={{
              background: "radial-gradient(ellipse at center, rgba(139,62,254,1) 0%, rgba(111,50,203,0.94) 50%, rgba(83,37,152,0.88) 100%)",
              paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))",
            }}
          >
            {/* Decorative glows */}
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-xl bg-[#D4BBFF]/10 blur-[40px]" />
            <div className="absolute -bottom-36 -left-24 w-64 h-64 rounded-xl bg-[#94E2FF]/5 blur-[40px]" />

            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowXPModal(false)}
              aria-label="Close"
              className="absolute top-[14px] right-[14px] z-20 h-7 w-7 rounded-full bg-black/30 border border-white/30 flex items-center justify-center transition hover:bg-black/50 active:scale-[0.95]"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 stroke-white" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Drag handle (mobile) */}
            <div className="mx-auto w-10 h-1 rounded-full bg-white/20 mt-3 mb-4 sm:hidden" />

            <div className="relative px-4 sm:px-5 pt-3 sm:pt-5 pb-3 sm:pb-5 flex flex-col items-center">
              {/* Trophy icon in gradient card */}
              <div
                className="w-[58px] h-[54px] sm:w-[70px] sm:h-[66px] rounded-xl border border-white/40 overflow-hidden relative flex items-center justify-center shadow-[0_0_24px_rgba(255,255,255,0.2)]"
                style={{ background: "linear-gradient(to bottom, #946ecd, #311162)" }}
              >
                <div className="absolute -top-24 -right-24 w-64 h-64 rounded-xl bg-[#D4BBFF]/10 blur-[40px]" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-xl bg-[#94E2FF]/5 blur-[40px]" />
                <img src="/nexura-gold.png" alt="Gold Trophy" className="w-[30px] h-[36px] sm:w-[38px] sm:h-[46px] object-contain relative z-10 drop-shadow-[0_0_20px_rgba(138,63,252,0.4)]" />
              </div>

              {/* Lesson Complete heading */}
              <h2 className="mt-2 sm:mt-3 text-[16px] sm:text-[19px] font-semibold text-white" style={{ fontFamily: "'Geist', 'Inter', sans-serif" }}>
                Lesson Completed!
              </h2>

              {/* Description */}
              <p className="mt-1 text-[11px] sm:text-[12px] text-[#c3c6d3] leading-relaxed max-w-[260px] sm:max-w-[300px]" style={{ fontFamily: "'Inter', sans-serif" }}>
                You've successfully completed {lesson?.title ?? "this lesson"}
              </p>

              {/* XP amount */}
              <div className="mt-2 flex flex-col items-center gap-1">
                <span className="text-[20px] sm:text-[24px] font-bold text-white leading-tight" style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
                  +{lesson?.reward ?? 0} XP
                </span>
                <span
                  className="rounded-full border border-white/30 bg-[#44227b] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[3px] text-[#94e2ff]"
                >
                  Earned
                </span>
              </div>

              {/* Share on X button */}
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                  `I just completed the ${lesson?.title ?? "a lesson"} lesson on @NexuraXYZ ✅\n\n${lesson?.reward ?? 0} XP secured\n\nSign up here: ${window.location.origin}/ref/${user?.referral?.code ?? "nexura"} and check it out in the Learn tab.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full h-10 rounded-[12px] bg-black/30 border border-white/40 flex items-center justify-center gap-3 transition hover:bg-black/50 active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                <span className="text-[11px] sm:text-[13px] font-semibold uppercase tracking-[1.4px] text-[#bfe4f2]/90" style={{ fontFamily: "'Geist', 'Inter', sans-serif" }}>
                  Share your achievement to X
                </span>
              </a>

              {/* Action buttons row */}
              <div className="mt-2 flex flex-col sm:flex-row gap-2 w-full">
                <button
                  type="button"
                  onClick={resetLessonView}
                  className="flex-1 h-9 rounded-[12px] border border-white/60 bg-transparent flex items-center justify-center transition hover:bg-white/10 active:scale-[0.98]"
                >
                  <span className="text-[10px] sm:text-[12px] font-semibold uppercase tracking-[1.4px] text-[#bfe4f2]" style={{ fontFamily: "'Geist', 'Inter', sans-serif" }}>
                    Take lesson again
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocation("/learn")}
                  className="flex-1 h-9 rounded-[12px] bg-[#8b3efe] flex items-center justify-center transition hover:bg-[#7a2fe0] active:scale-[0.98] shadow-[0_0_20px_rgba(138,63,252,0.4)]"
                >
                  <span className="text-[10px] sm:text-[12px] font-bold uppercase tracking-[1.4px] text-white" style={{ fontFamily: "'Geist', 'Inter', sans-serif" }}>
                    Return to Lessons
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
