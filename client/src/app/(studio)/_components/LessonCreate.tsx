"use client";
import StudioLoader from "@/components/studio/StudioLoader";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { projectApiRequest } from "@/lib/projectApi";
import { apiRequestV2 } from "@/lib/queryClient";
import { usePathname, useRouter } from "next/navigation";

import { BACKEND_URL, getLessonFeeContractProject } from "@/lib/constants";
import { getStoredAccessToken } from "@/lib/queryClient";
import { payStudioHubFee } from "@/lib/performOnchainAction";
import { resilientFetch } from "@/lib/resilientFetch";

const apiRequest = async <T = any>(args: any) => {
  const { method, endpoint, data, params } = args;
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += '?' + searchParams.toString();
  }
  
  const token = getStoredAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(data instanceof FormData)) headers["Content-Type"] = "application/json";

  const res = await resilientFetch(`${BACKEND_URL || ""}${url}`, {
    method,
    headers,
    body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = payload.error || payload.message || res.statusText;
    throw new ApiError(res.status, message);
  }
  
  return res.json() as Promise<T>;
};

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

import {
  BookOpen,
  ChevronLeft,
  FileQuestion,
  FileText,
  ImageIcon,
  MessageSquare,
  Play,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";

// ----- Types (mirror Lessons.tsx exactly so backend payloads stay identical) -----

interface Lesson {
  _id: string;
  title: string;
  description: string;
  reward: number;
  noOfQuestions: number;
  status?: "draft" | "published";
  coverImage?: string;
  profileImage?: string;
  disclaimer?: string;
  completionTrophy?: "bronze" | "silver" | "gold" | "";
  completionTitle?: string;
  completionMessage?: string;
  createdAt: string;
}

interface MiniLesson {
  _id: string;
  lesson: string;
  text: string;
  introHeader?: string;
  introBody?: string;
  introTrophy?: "bronze" | "silver" | "gold" | "";
  outroHeader?: string;
  outroBody?: string;
  outroTrophy?: "bronze" | "silver" | "gold" | "";
  order?: number;
  createdAt?: string;
}

interface LessonQuestion {
  _id: string;
  lesson: string;
  question: string;
  options: string[];
  solution: string;
  introHeader?: string;
  introBody?: string;
  introTrophy?: "bronze" | "silver" | "gold" | "";
  outroHeader?: string;
  outroBody?: string;
  outroTrophy?: "bronze" | "silver" | "gold" | "";
  order?: number;
  createdAt?: string;
}

interface VideoLesson {
  _id: string;
  lesson: string;
  url: string;
  introHeader?: string;
  introBody?: string;
  introTrophy?: "bronze" | "silver" | "gold" | "";
  outroHeader?: string;
  outroBody?: string;
  outroTrophy?: "bronze" | "silver" | "gold" | "";
  order?: number;
  createdAt?: string;
}

interface LessonDetailsResponse {
  miniLessons?: MiniLesson[];
  questions?: LessonQuestion[];
  videoLessons?: VideoLesson[];
}

interface LessonFormState {
  title: string;
  description: string;
  reward: string;
  disclaimer: string;
  showDisclaimer: boolean;
  coverImageFile: File | null;
  coverImagePreview: string;
  profileImageFile: File | null;
  profileImagePreview: string;
  completionTrophy: "bronze" | "silver" | "gold" | "";
  completionTitle: string;
  completionMessage: string;
}

const emptyLessonForm: LessonFormState = {
  title: "",
  description: "",
  reward: "",
  disclaimer: "",
  showDisclaimer: false,
  coverImageFile: null,
  coverImagePreview: "",
  profileImageFile: null,
  profileImagePreview: "",
  completionTrophy: "gold",
  completionTitle: "Congratulations!",
  completionMessage: "",
};

const standardIntroBody = (lessonTitle: string) =>
  `Take a quiz to see how much you understand ${lessonTitle.trim() || "this lesson"}`;

const standardOutroBody = (lessonTitle: string) =>
  `Great job — you finished the quiz on ${lessonTitle.trim() || "this lesson"}`;

const textareaClassName =
  "min-h-[120px] w-full rounded-md border border-[rgba(28,37,51,0.12)] bg-[#f4f1fc] px-3 py-2 text-sm text-[#1c2533] placeholder:text-[#98a0b4] focus:outline-none focus:ring-2 focus:ring-[#8a3ffc]";

const dedupeById = <T extends { _id: string }>(items: T[] | undefined) => {
  const seen = new Set<string>();
  return (items ?? []).filter((item) => {
    if (!item?._id || seen.has(item._id)) {
      return false;
    }
    seen.add(item._id);
    return true;
  });
};

const buildLessonFormData = (form: LessonFormState, lessonId?: string) => {
  const formData = new FormData();
  formData.append("title", form.title.trim());
  formData.append("description", form.description.trim());
  formData.append("reward", String(Number(form.reward)));
  formData.append("disclaimer", form.disclaimer.trim());
  formData.append("completionTrophy", "gold");
  formData.append("completionTitle", "Congratulations!");
  formData.append(
    "completionMessage",
    `You have mastered ${form.title.trim() || "this lesson"}`,
  );

  if (lessonId) {
    formData.append("lessonId", lessonId);
  }
  if (form.coverImageFile) {
    formData.append("coverImage", form.coverImageFile);
  }
  if (form.profileImageFile) {
    formData.append("profileImage", form.profileImageFile);
  }

  return formData;
};

interface CreateLessonProps {
  editId?: string | null;
  onBackToLessons?: () => void;
  onLessonSaved?: () => void;
}

type StepId = "details" | "content" | "preview";

const COMPLETION_SENTINEL = "__completion__";

type ContentItem =
  | { kind: "mini"; data: MiniLesson }
  | { kind: "question"; data: LessonQuestion }
  | { kind: "video"; data: VideoLesson };

export default function CreateLesson({
  editId: externalEditId,
  onBackToLessons,
  onLessonSaved,
}: CreateLessonProps) {
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  const isUserDashboard = pathname.startsWith("/user-dashboard");
  const apiBase = isUserDashboard ? "/user-hub" : "/hub";

  const effectiveEditId =
    externalEditId ?? new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("edit");

  const [activeTab, setActiveTab] = useState<StepId>("details");
  const [saving, setSaving] = useState(false);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Lesson form (step 1: details)
  const [lessonForm, setLessonForm] = useState<LessonFormState>(emptyLessonForm);

  // Lesson identity / status
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [lessonStatus, setLessonStatus] = useState<"draft" | "published">("draft");
  const isEditMode = !!effectiveEditId || !!lessonId;
  const isPublished = lessonStatus === "published";

  // Payment modal
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [paymentTxHash, setPaymentTxHash] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Lesson content (step 2)
  const [miniLessons, setMiniLessons] = useState<MiniLesson[]>([]);
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [videoLessons, setVideoLessons] = useState<VideoLesson[]>([]);

  // Inline editor state for the new content step
  const [activeContentId, setActiveContentId] = useState<string | null>(null);
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [deletingContentId, setDeletingContentId] = useState("");

  // Local draft state for the right-canvas editors. We keep a per-id buffer so
  // typing never has to wait on the network round-trip.
  const [paragraphDrafts, setParagraphDrafts] = useState<Record<string, string>>({});
  const [questionDrafts, setQuestionDrafts] = useState<
    Record<string, { question: string; options: string[]; solution: string }>
  >({});
  const [videoDrafts, setVideoDrafts] = useState<Record<string, string>>({});

  // Preview player walkthrough state. -1 = static lesson card (entry); 0..N = walking through the steps.
  const [previewPlayerStep, setPreviewPlayerStep] = useState<number>(-1);

  // Confirm dialog (delete prompts)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    confirmTone?: "danger" | "primary";
    onConfirm: () => void;
  } | null>(null);

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      options?: { confirmLabel?: string; confirmTone?: "danger" | "primary" },
    ) => {
      setConfirmDialog({
        title,
        message,
        confirmLabel: options?.confirmLabel ?? "Confirm",
        confirmTone: options?.confirmTone ?? "danger",
        onConfirm,
      });
    },
    [],
  );

  // ----- Pre-fill lesson when editing -----

  useEffect(() => {
    if (!effectiveEditId) return;
    let cancelled = false;

    (async () => {
      setLoadingLesson(true);
      try {
        const res = await projectApiRequest<{ lessons?: Lesson[] }>({
          method: "GET",
          endpoint: `${apiBase}/get-lessons`,
        });
        if (cancelled) return;
        const found = (res.lessons ?? []).find((entry) => entry._id === effectiveEditId);
        if (!found) {
          toast({
            title: "Lesson not found",
            description: "This lesson could not be loaded.",
            variant: "destructive",
          });
          return;
          }
          setLessonId(found._id);
          setLessonStatus(found.status === "published" ? "published" : "draft");
          const existingDisclaimer = found.disclaimer ?? "";
          setLessonForm({
          title: found.title ?? "",
          description: found.description ?? "",
          reward: String(found.reward ?? 0),
          disclaimer: existingDisclaimer,
          showDisclaimer: Boolean(existingDisclaimer.trim()),
          coverImageFile: null,
          coverImagePreview: found.coverImage ?? "",
          profileImageFile: null,
          profileImagePreview: found.profileImage ?? "",
          completionTrophy: "gold",
          completionTitle: "Congratulations!",
          completionMessage: "",
          });

          await refreshLessonContent(found._id);
          } catch (err) {
          if (!cancelled) {
          toast({
            variant: "destructive",
            title: "Error",
            description: err instanceof Error ? err.message : "Failed to load lesson.",
          });
          }
          } finally {
          if (!cancelled) setLoadingLesson(false);
          }
          })();

          return () => {
          cancelled = true;
          };
          // eslint-disable-next-line react-hooks/exhaustive-deps
          }, [effectiveEditId]);

          // Auto-migrate any quiz whose intro/outro doesn't match the locked default
          // (silver trophy, no header, standard body derived from the lesson title).
          useEffect(() => {
          const introBody = standardIntroBody(lessonForm.title);
          const outroBody = standardOutroBody(lessonForm.title);
          for (const q of questions) {
          const introNeedsMigration =
          (q.introTrophy ?? "") !== "silver" ||
          (q.introHeader ?? "") !== "" ||
          (q.introBody ?? "") !== introBody;
          if (introNeedsMigration) {
          void persistQuizIntroOutro(q, "intro", {
          trophy: "silver",
          header: "",
          body: introBody,
          });
          }
          const outroNeedsMigration =
          (q.outroTrophy ?? "") !== "silver" ||
          (q.outroHeader ?? "") !== "" ||
          (q.outroBody ?? "") !== outroBody;
          if (outroNeedsMigration) {
          void persistQuizIntroOutro(q, "outro", {
          trophy: "silver",
          header: "",
          body: outroBody,
          });
          }
          }
          // eslint-disable-next-line react-hooks/exhaustive-deps
          }, [questions]);

          // ----- API: lesson content -----

          const refreshLessonContent = async (id: string) => {
          try {
          const adminResponse = await projectApiRequest<LessonDetailsResponse>({
          method: "GET",
          endpoint: `${apiBase}/get-lesson-details?id=${id}`,
          });
          setMiniLessons(dedupeById(adminResponse.miniLessons));
          setQuestions(dedupeById(adminResponse.questions));
          setVideoLessons(dedupeById(adminResponse.videoLessons));
          } catch (err) {
          // Fall back to public endpoint if admin endpoint 404s (preserves Lessons.tsx behavior)
          if (err instanceof ApiError && err.status === 404) {
          try {
          const fallback = await apiRequest<LessonDetailsResponse>({
            method: "GET",
            endpoint: `/lesson/get-lesson-details?id=${id}`,
          });
          setMiniLessons(dedupeById(fallback.miniLessons));
          setQuestions(
            dedupeById(fallback.questions).map((entry) => ({
              ...entry,
              solution: entry.solution ?? "",
            })),
          );
          setVideoLessons(dedupeById(fallback.videoLessons));
          return;
          } catch (fallbackErr) {
          toast({
            variant: "destructive",
            title: "Error",
            description:
              fallbackErr instanceof Error
                ? fallbackErr.message
                : "Failed to load lesson content.",
          });
          return;
          }
          }
          toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to load lesson content.",
          });
          }
          };

          // ----- API: lesson save / update -----

          const saveOrUpdateLesson = async (): Promise<string | null> => {
          if (!lessonForm.title.trim() || !lessonForm.description.trim()) {
          toast({
          variant: "destructive",
          title: "Missing fields",
          description: "Lesson title and description are required.",
          });
          return null;
          }

          try {
          setSaving(true);
          if (lessonId) {
          await projectApiRequest({
          method: "PATCH",
          endpoint: `${apiBase}/update-lesson`,
          formData: buildLessonFormData(lessonForm, lessonId),
          });
          return lessonId;
          }

          const res = await projectApiRequest<{ lesson?: { _id: string }; _id?: string }>({
          method: "POST",
          endpoint: `${apiBase}/create-lesson`,
          formData: buildLessonFormData(lessonForm),
          });
          const newId = res.lesson?._id ?? res._id ?? null;
          if (newId) {
          setLessonId(newId);
          setLessonStatus("draft");
          }
          return newId;
          } catch (err) {
          toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to save lesson.",
          });
          return null;
          } finally {
          setSaving(false);
          }
          };

          const handleDetailsNext = async () => {
          console.log("[ACTION] LessonCreate.handleDetailsNext — details → content step");
          const id = await saveOrUpdateLesson();
          if (!id) return;
          await refreshLessonContent(id);
          setActiveTab("content");
          };

          // ----- Image upload helpers -----

          const updateLessonImage = (
          field: "coverImage" | "profileImage",
          file: File | null,
          ) => {
          setLessonForm((prev) => ({
          ...prev,
          ...(field === "coverImage"
          ? {
            coverImageFile: file,
            coverImagePreview: file ? URL.createObjectURL(file) : prev.coverImagePreview,
          }
          : {
            profileImageFile: file,
            profileImagePreview: file ? URL.createObjectURL(file) : prev.profileImagePreview,
          }),
          }));
          };

          // ----- API: mini lesson / question / video CRUD -----

          const ensureLessonId = (): string | null => {
          if (!lessonId) {
          toast({
          variant: "destructive",
          title: "Save lesson first",
          description: "Save the lesson details before adding content.",
          });
          return null;
          }
          return lessonId;
          };

          const addParagraph = async () => {
          const id = ensureLessonId();
          if (!id) return;
          try {
          setSaving(true);
          const res = await projectApiRequest<{
          miniLesson?: { _id: string };
          _id?: string;
          }>({
          method: "POST",
          endpoint: `${apiBase}/create-mini-lesson`,
          data: {
          text: "",
          lesson: id,
          introHeader: "",
          introBody: "",
          introTrophy: "",
          outroHeader: "",
          outroBody: "",
          outroTrophy: "",
          },
          });
          await refreshLessonContent(id);
          const newId = res.miniLesson?._id ?? res._id ?? null;
          if (newId) {
          setActiveContentId(newId);
          setParagraphDrafts((prev) => ({ ...prev, [newId]: "" }));
          }
          } catch (err) {
          toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to add paragraph.",
          });
          } finally {
          setSaving(false);
          }
          };

          const addQuiz = async () => {
          const id = ensureLessonId();
          if (!id) return;
          try {
          setSaving(true);
          const res = await projectApiRequest<{
          question?: { _id: string };
          _id?: string;
          }>({
          method: "POST",
          endpoint: `${apiBase}/create-question`,
          data: {
          question: "",
          options: ["", "", "", ""],
          solution: "",
          lesson: id,
          introHeader: "",
          introBody: standardIntroBody(lessonForm.title),
          introTrophy: "silver",
          outroHeader: "",
          outroBody: standardOutroBody(lessonForm.title),
          outroTrophy: "silver",
          },
          });
          await refreshLessonContent(id);
          const newId = res.question?._id ?? res._id ?? null;
          if (newId) {
          setActiveContentId(newId);
          setQuestionDrafts((prev) => ({
          ...prev,
          [newId]: { question: "", options: ["", "", "", ""], solution: "" },
          }));
          }
          } catch (err) {
          toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to add quiz.",
          });
          } finally {
          setSaving(false);
          }
          };

          const addVideo = async () => {
          const id = ensureLessonId();
          if (!id) return;
          try {
          setSaving(true);
          const res = await projectApiRequest<{
          videoLesson?: { _id: string };
          _id?: string;
          }>({
          method: "POST",
          endpoint: `${apiBase}/create-video-lesson`,
          data: {
          url: "",
          lesson: id,
          introHeader: "",
          introBody: "",
          introTrophy: "",
          outroHeader: "",
          outroBody: "",
          outroTrophy: "",
          },
          });
          await refreshLessonContent(id);
          const newId = res.videoLesson?._id ?? res._id ?? null;
          if (newId) {
          setActiveContentId(newId);
          setVideoDrafts((prev) => ({ ...prev, [newId]: "" }));
          }
          } catch (err) {
          toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to add video.",
          });
          } finally {
          setSaving(false);
          }
          };

          const persistParagraph = async (item: MiniLesson, nextText: string) => {
          if ((item.text ?? "") === nextText) return;
          try {
          await projectApiRequest({
          method: "PATCH",
          endpoint: `${apiBase}/update-mini-lesson`,
          data: {
          miniLessonId: item._id,
          text: nextText,
          introHeader: item.introHeader ?? "",
          introBody: item.introBody ?? "",
          introTrophy: item.introTrophy ?? "",
          outroHeader: item.outroHeader ?? "",
          outroBody: item.outroBody ?? "",
          outroTrophy: item.outroTrophy ?? "",
          },
          });
          setMiniLessons((prev) =>
          prev.map((entry) => (entry._id === item._id ? { ...entry, text: nextText } : entry)),
          );
          } catch (err) {
          toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to save paragraph.",
          });
          }
          };

          const persistQuestion = async (
          item: LessonQuestion,
          next: { question: string; options: string[]; solution: string },
          ) => {
          const sameQuestion = (item.question ?? "") === next.question;
          const sameOptions =
          JSON.stringify(item.options ?? []) === JSON.stringify(next.options);
          const sameSolution = (item.solution ?? "") === next.solution;
          if (sameQuestion && sameOptions && sameSolution) return;
          try {
          await projectApiRequest({
          method: "PATCH",
          endpoint: `${apiBase}/update-question`,
          data: {
          questionId: item._id,
          question: next.question,
          options: next.options,
          solution: next.solution,
          introHeader: item.introHeader ?? "",
          introBody: item.introBody ?? "",
          introTrophy: item.introTrophy ?? "",
          outroHeader: item.outroHeader ?? "",
          outroBody: item.outroBody ?? "",
          outroTrophy: item.outroTrophy ?? "",
          },
          });
          setQuestions((prev) =>
          prev.map((entry) =>
          entry._id === item._id
            ? {
                ...entry,
                question: next.question,
                options: next.options,
                solution: next.solution,
              }
            : entry,
          ),
          );
          } catch (err) {
          toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to save quiz.",
          });
          }
          };

          const persistQuizIntroOutro = async (
          quiz: LessonQuestion,
          side: "intro" | "outro",
          next: { trophy: "bronze" | "silver" | "gold" | ""; header: string; body: string },
          ) => {
          const headerKey = side === "intro" ? "introHeader" : "outroHeader";
          const bodyKey = side === "intro" ? "introBody" : "outroBody";
          const trophyKey = side === "intro" ? "introTrophy" : "outroTrophy";
          const sameHeader = (quiz[headerKey] ?? "") === next.header;
          const sameBody = (quiz[bodyKey] ?? "") === next.body;
          const sameTrophy = (quiz[trophyKey] ?? "") === next.trophy;
          if (sameHeader && sameBody && sameTrophy) return;
          try {
          await projectApiRequest({
          method: "PATCH",
          endpoint: `${apiBase}/update-question`,
          data: {
          questionId: quiz._id,
          question: quiz.question ?? "",
          options: quiz.options ?? [],
          solution: quiz.solution ?? "",
          introHeader: side === "intro" ? next.header : quiz.introHeader ?? "",
          introBody: side === "intro" ? next.body : quiz.introBody ?? "",
          introTrophy: side === "intro" ? next.trophy : quiz.introTrophy ?? "",
          outroHeader: side === "outro" ? next.header : quiz.outroHeader ?? "",
          outroBody: side === "outro" ? next.body : quiz.outroBody ?? "",
          outroTrophy: side === "outro" ? next.trophy : quiz.outroTrophy ?? "",
          },
          });
          setQuestions((prev) =>
          prev.map((entry) =>
          entry._id === quiz._id
            ? {
                ...entry,
                [headerKey]: next.header,
                [bodyKey]: next.body,
                [trophyKey]: next.trophy,
              }
            : entry,
          ),
          );
          } catch (err) {
          toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : `Failed to save ${side}.`,
          });
          }
          };

          const persistVideo = async (item: VideoLesson, nextUrl: string) => {
          if ((item.url ?? "") === nextUrl) return;
          try {
          await projectApiRequest({
          method: "PATCH",
          endpoint: `${apiBase}/update-video-lesson`,
          data: {
          videoLessonId: item._id,
          url: nextUrl,
          introHeader: item.introHeader ?? "",
          introBody: item.introBody ?? "",
          introTrophy: item.introTrophy ?? "",
          outroHeader: item.outroHeader ?? "",
          outroBody: item.outroBody ?? "",
          outroTrophy: item.outroTrophy ?? "",
          },
          });
          setVideoLessons((prev) =>
          prev.map((entry) => (entry._id === item._id ? { ...entry, url: nextUrl } : entry)),
          );
          } catch (err) {
          toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to save video.",
          });
          }
          };

          const deleteContent = (kind: "mini" | "question" | "video", id: string) => {
          const lessonRef = ensureLessonId();
          if (!lessonRef) return;
          const label = kind === "mini" ? "paragraph" : kind === "video" ? "video" : "quiz";
          showConfirm(
          `Delete ${label}?`,
          `Delete this ${label}? This cannot be undone.`,
          async () => {
          const endpoint =
          kind === "mini"
            ? `${apiBase}/delete-mini-lesson?id=${id}`
            : kind === "video"
            ? `${apiBase}/delete-video-lesson?id=${id}`
            : `${apiBase}/delete-question?id=${id}`;
          try {
          setDeletingContentId(id);
          await projectApiRequest({ method: "DELETE", endpoint });
          await refreshLessonContent(lessonRef);
          if (activeContentId === id) {
            setActiveContentId(null);
          }
          toast({
            title: `${label.charAt(0).toUpperCase() + label.slice(1)} deleted`,
          });
          } catch (err) {
          toast({
            variant: "destructive",
            title: "Error",
            description: err instanceof Error ? err.message : "Failed to delete.",
          });
          } finally {
          setDeletingContentId("");
          }
          },
          { confirmLabel: "Delete", confirmTone: "danger" },
          );
          };
  // ----- Combined content list -----

  const combinedContent: ContentItem[] = useMemo(() => {
    const items: ContentItem[] = [
      ...miniLessons.map((d) => ({ kind: "mini" as const, data: d })),
      ...questions.map((d) => ({ kind: "question" as const, data: d })),
      ...videoLessons.map((d) => ({ kind: "video" as const, data: d })),
    ];
    return items.sort(
      (a, b) =>
        (a.data.order ?? 0) - (b.data.order ?? 0) ||
        (a.data.createdAt ?? "").localeCompare(b.data.createdAt ?? ""),
    );
  }, [miniLessons, questions, videoLessons]);

  // Sequential numbering within each kind ("Paragraph 1", "Paragraph 2", ...)
  const numberingByKind = useMemo(() => {
    const map = new Map<string, number>();
    let mIdx = 0;
    let qIdx = 0;
    let vIdx = 0;
    for (const item of combinedContent) {
      if (item.kind === "mini") {
        mIdx += 1;
        map.set(item.data._id, mIdx);
      } else if (item.kind === "question") {
        qIdx += 1;
        map.set(item.data._id, qIdx);
      } else {
        vIdx += 1;
        map.set(item.data._id, vIdx);
      }
    }
    return map;
  }, [combinedContent]);

  // Sidebar entries — augments combinedContent with auto-injected intro/outro
  // virtual items around quiz groups. Rule:
  //   - prepend "intro-<quizId>" before the first quiz in a contiguous group
  //     (i.e. when previous item is not a quiz, or there is no previous item)
  //   - append "outro-<quizId>" after the last quiz in a contiguous group
  //     (i.e. when next item is not a quiz, or there is no next item)
  // The virtual items are non-deletable and edit the parent quiz's
  // introHeader/introBody/introTrophy or outroHeader/outroBody/outroTrophy
  // fields via dynamic apiBase.
  type SidebarEntry =
    | { kind: "content"; item: ContentItem }
    | { kind: "intro" | "outro"; quizId: string };

  const sidebarItems = useMemo<SidebarEntry[]>(() => {
    const out: SidebarEntry[] = [];
    for (let i = 0; i < combinedContent.length; i++) {
      const cur = combinedContent[i];
      const prev = combinedContent[i - 1];
      const next = combinedContent[i + 1];
      if (cur.kind === "question" && (!prev || prev.kind !== "question")) {
        out.push({ kind: "intro", quizId: cur.data._id });
      }
      out.push({ kind: "content", item: cur });
      if (cur.kind === "question" && (!next || next.kind !== "question")) {
        out.push({ kind: "outro", quizId: (cur.data as LessonQuestion)._id });
      }
    }
    return out;
  }, [combinedContent]);

  const sidebarEntryId = (entry: SidebarEntry) =>
    entry.kind === "content"
      ? entry.item.data._id
      : entry.kind === "intro"
      ? `intro-${entry.quizId}`
      : `outro-${entry.quizId}`;

  // Linear navigation order for Previous Step / Next Step (sidebar items first,
  // then the always-present Completion sentinel).
  const navigationOrder: string[] = useMemo(() => {
    return [...sidebarItems.map(sidebarEntryId), COMPLETION_SENTINEL];
  }, [sidebarItems]);

  // ----- Preview player steps (mirrors user-facing LessonPage.tsx logic) -----
  type PlayerStep =
    | { kind: "intro" | "outro"; key: string; header: string; body: string; trophy: "bronze" | "silver" | "gold" | "" }
    | { kind: "mini"; key: string; text: string }
    | { kind: "question"; key: string; question: LessonQuestion }
    | { kind: "video"; key: string; url: string }
    | { kind: "claim"; key: string };

  const previewPlayerSteps = useMemo<PlayerStep[]>(() => {
    const sanitize = (v: unknown) =>
      typeof v === "string" ? v.replace(/[\u200B-\u200D\uFEFF]/g, "").trim() : "";
    const isTrophy = (v: unknown): v is "bronze" | "silver" | "gold" =>
      typeof v === "string" && ["bronze", "silver", "gold"].includes(v);
    const out: PlayerStep[] = [];
    for (const item of combinedContent) {
      const introHeader = sanitize(item.data.introHeader);
      const introBody = sanitize(item.data.introBody);
      const introTrophy = isTrophy(item.data.introTrophy) ? item.data.introTrophy : "";
      const outroHeader = sanitize(item.data.outroHeader);
      const outroBody = sanitize(item.data.outroBody);
      const outroTrophy = isTrophy(item.data.outroTrophy) ? item.data.outroTrophy : "";
      if (introHeader || introBody || introTrophy) {
        out.push({ kind: "intro", key: `intro-${item.data._id}`, header: introHeader, body: introBody, trophy: introTrophy });
      }
      if (item.kind === "mini") {
        out.push({ kind: "mini", key: `mini-${item.data._id}`, text: item.data.text });
      } else if (item.kind === "video") {
        out.push({ kind: "video", key: `video-${item.data._id}`, url: item.data.url });
      } else {
        out.push({ kind: "question", key: `question-${item.data._id}`, question: item.data });
      }
      if (outroHeader || outroBody || outroTrophy) {
        out.push({ kind: "outro", key: `outro-${item.data._id}`, header: outroHeader, body: outroBody, trophy: outroTrophy });
      }
    }
    out.push({ kind: "claim", key: "claim" });
    return out;
  }, [combinedContent]);

  const youtubeEmbedUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      let videoId = "";
      if (parsed.hostname.includes("youtu.be")) videoId = parsed.pathname.slice(1);
      else videoId = parsed.searchParams.get("v") || "";
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    } catch {
      return url;
    }
  };

  const trophyColorClass = (trophy: "bronze" | "silver" | "gold" | "") =>
    trophy === "bronze"
      ? "text-amber-700"
      : trophy === "silver"
      ? "text-[#3d485c]"
      : trophy === "gold"
      ? "text-[#c27c00]"
      : "text-[#69728a]";

  const activeItem = useMemo(() => {
    if (!activeContentId || activeContentId === COMPLETION_SENTINEL) return null;
    return combinedContent.find((item) => item.data._id === activeContentId) ?? null;
  }, [activeContentId, combinedContent]);

  const isCompletionActive = activeContentId === COMPLETION_SENTINEL;

  const goToPreviousStep = () => {
    if (!activeContentId) return;
    const idx = navigationOrder.indexOf(activeContentId);
    if (idx <= 0) return;
    setActiveContentId(navigationOrder[idx - 1]);
  };

  const goToNextStep = () => {
    if (!activeContentId) {
      if (navigationOrder.length > 0) setActiveContentId(navigationOrder[0]);
      return;
    }
    const idx = navigationOrder.indexOf(activeContentId);
    if (idx === -1 || idx >= navigationOrder.length - 1) return;
    setActiveContentId(navigationOrder[idx + 1]);
  };

  const previousDisabled = !activeContentId || navigationOrder.indexOf(activeContentId) <= 0;
  const nextDisabled =
    !activeContentId ||
    navigationOrder.indexOf(activeContentId) >= navigationOrder.length - 1;

  // ----- Publish / unpublish from review step -----

  const handlePublishToggle = async (target: "published" | "draft") => {
    console.log("[ACTION] LessonCreate.handlePublishToggle →", target);
    const id = ensureLessonId();
    if (!id) return;
    const endpoint =
      target === "published" ? `${apiBase}/publish-lesson` : `${apiBase}/unpublish-lesson`;
    try {
      setPublishing(true);
      // Persist any in-flight edits to the lesson form before flipping status
      // so users don't lose changes made on the details step.
      await projectApiRequest({
        method: "PATCH",
        endpoint: `${apiBase}/update-lesson`,
        formData: buildLessonFormData(lessonForm, id),
      });
      await projectApiRequest({
        method: "PATCH",
        endpoint,
        data: { lessonId: id },
      });
      setLessonStatus(target);
      toast({
        title: target === "published" ? "Lesson published" : "Lesson unpublished",
        description:
          target === "published"
            ? "Your lesson is now live."
            : "Your lesson is back in drafts.",
      });
      onLessonSaved?.();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update lesson status.",
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveCompletion = async () => {
    console.log("[ACTION] LessonCreate.handleSaveCompletion — save completion criteria");
    const id = ensureLessonId();
    if (!id) return;
    try {
      setSaving(true);
      await projectApiRequest({
        method: "PATCH",
        endpoint: `${apiBase}/update-lesson`,
        formData: buildLessonFormData(lessonForm, id),
      });
      toast({
        title: "Saved",
        description: "Completion settings saved.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save completion.",
      });
    } finally {
      setSaving(false);
    }
  };

  // ----- Step strip (mirrors CreateCampaign 3-step indicator) -----

  const stepStrip = (
    <div className="flex gap-8 border-b border-[rgba(28,37,51,0.12)]">
      <button
        onClick={() => setActiveTab("details")}
        className="flex flex-1 flex-col items-start justify-start gap-2 py-5 text-lg font-semibold transition"
      >
        <span
          className={`block h-[4px] w-full rounded-full transition-colors ${
            activeTab === "details" ? "bg-[#8B3EFE]" : "bg-[#efeafb]"
          }`}
        />
        <div className="flex items-center gap-2 text-[#3d485c] hover:text-[#1c2533]">
          <BookOpen className="h-5 w-5" />
          <span className={activeTab === "details" ? "text-[#8a3ffc]" : ""}>Details</span>
        </div>
      </button>

      <button
        onClick={() => {
          if (!lessonId) {
            toast({
              variant: "destructive",
              title: "Save details first",
              description: "Save the lesson details before adding content.",
            });
            return;
          }
          setActiveTab("content");
        }}
        className="flex flex-1 flex-col items-start justify-start gap-2 py-5 text-lg font-semibold transition"
      >
        <span
          className={`block h-[4px] w-full rounded-full transition-colors ${
            activeTab === "content" ? "bg-[#8B3EFE]" : "bg-[#efeafb]"
          }`}
        />
        <div className="flex items-center gap-2 text-[#3d485c] hover:text-[#1c2533]">
          <MessageSquare className="h-5 w-5" />
          <span className={activeTab === "content" ? "text-[#8a3ffc]" : ""}>Content</span>
        </div>
      </button>

      <button
        onClick={() => {
          if (!lessonId) {
            toast({
              variant: "destructive",
              title: "Save details first",
              description: "Save the lesson details before previewing.",
            });
            return;
          }
          setActiveTab("preview");
        }}
        className="flex flex-1 flex-col items-start justify-start gap-2 py-5 text-lg font-semibold transition"
      >
        <span
          className={`block h-[4px] w-full rounded-full transition-colors ${
            activeTab === "preview" ? "bg-[#8B3EFE]" : "bg-[#efeafb]"
          }`}
        />
        <div className="flex items-center gap-2 text-[#3d485c] hover:text-[#1c2533]">
          <Send className="h-5 w-5" />
          <span className={activeTab === "preview" ? "text-[#8a3ffc]" : ""}>Preview</span>
        </div>
      </button>
    </div>
  );

  // ----- Render content step pieces -----

  const renderSidebarItem = (item: ContentItem) => {
    const isActive = activeContentId === item.data._id;
    const number = numberingByKind.get(item.data._id) ?? 0;
    const label =
      item.kind === "mini"
        ? `Paragraph ${number}`
        : item.kind === "question"
        ? `Quiz ${number}`
        : `Video ${number}`;
    const Icon =
      item.kind === "mini" ? FileText : item.kind === "question" ? FileQuestion : Play;
    const apiKind = item.kind;

    return (
      <button
        key={item.data._id}
        type="button"
        onClick={() => setActiveContentId(item.data._id)}
        className={`flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-sm transition-colors ${
          isActive
            ? "bg-[#8B3EFE] text-white"
            : "border border-[rgba(139,62,254,0.2)] bg-white text-[#3d485c] hover:bg-[#f4f1fc]"
        }`}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="truncate">{label}</span>
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            deleteContent(apiKind, item.data._id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              deleteContent(apiKind, item.data._id);
            }
          }}
          className={`shrink-0 rounded-md p-1 transition-colors ${
            isActive
              ? "text-[#3d485c] hover:bg-[rgba(138,63,252,0.06)] hover:text-[#1c2533]"
              : "text-[#69728a] hover:bg-[rgba(138,63,252,0.06)] hover:text-[#1c2533]"
          } ${deletingContentId === item.data._id ? "opacity-40" : ""}`}
          aria-label={`Delete ${label}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </span>
      </button>
    );
  };

  const renderEmptyCanvas = () => (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-12 text-center">
      <div className="flex h-[146px] w-[146px] items-center justify-center rounded-full bg-[rgba(139,62,254,0.2)]">
        <BookOpen className="h-16 w-16 text-[#8B3EFE]" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-[#1c2533]">No Lesson content yet</p>
        <p className="text-xs text-[#3d485c]">
          Start by adding your first step, quiz or video.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void addParagraph()}
        disabled={saving}
        className="rounded-[10px] bg-[#8B3EFE] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7b35e6] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add First Paragraph
      </button>
    </div>
  );

  const renderParagraphEditor = (item: MiniLesson) => {
    const draftValue = paragraphDrafts[item._id] ?? item.text ?? "";
    return (
      <div className="flex flex-1 flex-col gap-3">
        <h3 className="text-base font-semibold text-[#1c2533]">Paragraph Content</h3>
        <textarea
          value={draftValue}
          onChange={(e) =>
            setParagraphDrafts((prev) => ({ ...prev, [item._id]: e.target.value }))
          }
          onBlur={() => void persistParagraph(item, draftValue)}
          placeholder="Write the paragraph content..."
          className="min-h-[280px] w-full rounded-[8px] border border-[rgba(139,62,254,0.3)] bg-white p-3 text-sm leading-6 text-[#1c2533] placeholder:text-[#98a0b4] focus:outline-none focus:ring-2 focus:ring-[#8B3EFE]"
        />
      </div>
    );
  };

  const renderQuestionEditor = (item: LessonQuestion) => {
    const padded: string[] = [...(item.options ?? [])];
    while (padded.length < 4) padded.push("");
    const draftValue =
      questionDrafts[item._id] ?? {
        question: item.question ?? "",
        options: padded.slice(0, 4),
        solution: item.solution ?? "",
      };

    const updateDraft = (
      next: Partial<{ question: string; options: string[]; solution: string }>,
    ) => {
      setQuestionDrafts((prev) => {
        const current =
          prev[item._id] ?? {
            question: item.question ?? "",
            options: padded.slice(0, 4),
            solution: item.solution ?? "",
          };
        return { ...prev, [item._id]: { ...current, ...next } };
      });
    };

    const commit = () => void persistQuestion(item, draftValue);

    const visibleOptions = [
      draftValue.options[0] ?? "",
      draftValue.options[1] ?? "",
      draftValue.options[2] ?? "",
      draftValue.options[3] ?? "",
    ];

    return (
      <div className="flex flex-1 flex-col gap-5">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-[#1c2533]">Question</h3>
          <textarea
            value={draftValue.question}
            onChange={(e) => updateDraft({ question: e.target.value })}
            onBlur={commit}
            placeholder="Enter the question..."
            className="min-h-[88px] w-full rounded-[8px] border border-[rgba(139,62,254,0.3)] bg-white p-3 text-sm leading-6 text-[#1c2533] placeholder:text-[#98a0b4] focus:outline-none focus:ring-2 focus:ring-[#8B3EFE]"
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-base font-semibold text-[#1c2533]">Options</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {visibleOptions.map((option, idx) => (
              <input
                key={`${item._id}-option-${idx}`}
                type="text"
                value={option}
                onChange={(e) => {
                  const nextOptions = [...visibleOptions];
                  nextOptions[idx] = e.target.value;
                  updateDraft({ options: nextOptions });
                }}
                onBlur={commit}
                placeholder={`Option ${idx + 1}`}
                className="h-10 w-full rounded-[8px] border border-[rgba(139,62,254,0.3)] bg-white px-3 text-sm text-[#1c2533] placeholder:text-[#98a0b4] focus:outline-none focus:ring-2 focus:ring-[#8B3EFE]"
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-base font-semibold text-[#1c2533]">Correct Answer</h3>
          <select
            value={draftValue.solution}
            onChange={(e) => updateDraft({ solution: e.target.value })}
            onBlur={commit}
            className="h-10 w-full rounded-[8px] border border-[rgba(139,62,254,0.3)] bg-white px-3 text-sm text-[#1c2533] focus:outline-none focus:ring-2 focus:ring-[#8B3EFE]"
          >
            <option value="">Select the correct option</option>
            {visibleOptions
              .map((option) => option.trim())
              .filter(Boolean)
              .map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
          </select>
        </div>
      </div>
    );
  };

  const renderVideoEditor = (item: VideoLesson) => {
    const draftValue = videoDrafts[item._id] ?? item.url ?? "";
    return (
      <div className="flex flex-1 flex-col gap-3">
        <h3 className="text-base font-semibold text-[#1c2533]">Upload Youtube URL</h3>
        <input
          type="url"
          value={draftValue}
          onChange={(e) =>
            setVideoDrafts((prev) => ({ ...prev, [item._id]: e.target.value }))
          }
          onBlur={() => void persistVideo(item, draftValue)}
          placeholder="Paste URL here"
          className="h-10 w-full rounded-[8px] border border-[rgba(139,62,254,0.3)] bg-white px-3 text-sm text-[#1c2533] placeholder:text-[#98a0b4] focus:outline-none focus:ring-2 focus:ring-[#8B3EFE]"
        />
        <div className="flex items-start gap-2 rounded-[8px] border border-[rgba(139,62,254,0.4)] bg-[rgba(139,62,254,0.1)] p-3">
          <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B3EFE]" />
          <p className="text-xs leading-5 text-[#3d485c]">
            Only Standard Youtube video links are supported. Youtube Shorts or other
            platforms are not supported.
          </p>
        </div>
      </div>
    );
  };

  const renderCompletionEditor = () => {
    const lessonTitle = lessonForm.title.trim() || "this lesson";
    return (
      <div className="flex flex-1 flex-col gap-5">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-[#1c2533]">Completion Card</h3>
          <p className="text-xs text-[#69728a]">
            Auto-filled from the lesson title. Shown to learners when they finish.
          </p>
        </div>

        <div className="rounded-[12px] border border-[rgba(139,62,254,0.3)] bg-white p-5">
          <div className="flex flex-col items-start gap-3">
            <span className="text-[11px] uppercase tracking-wide text-[#69728a]">Preview</span>
            <p className="text-xl font-semibold text-[#1c2533]">Congratulations!</p>
            <p className="text-sm leading-relaxed text-[#3d485c]">
              You have mastered {lessonTitle}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderIntroOutroEditor = (_quiz: LessonQuestion, side: "intro" | "outro") => {
    const lessonTitle = lessonForm.title.trim() || "this lesson";
    const heading = side === "intro" ? "Intro Card" : "Outro Card";
    const sub =
      side === "intro"
        ? "Auto-filled from the lesson title. Shown right before this quiz."
        : "Auto-filled from the lesson title. Shown right after this quiz.";
    const body =
      side === "intro"
        ? `Take a quiz to see how much you understand ${lessonTitle}`
        : `Great job — you finished the quiz on ${lessonTitle}`;
    return (
      <div className="flex flex-1 flex-col gap-5">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-[#1c2533]">{heading}</h3>
          <p className="text-xs text-[#69728a]">{sub}</p>
        </div>

        <div className="rounded-[12px] border border-[rgba(139,62,254,0.3)] bg-white p-5">
          <div className="flex flex-col items-start gap-3">
            <span className="text-[11px] uppercase tracking-wide text-[#69728a]">Preview</span>
            <Trophy className="h-10 w-10 text-[#3d485c]" />
            <p className="text-sm leading-relaxed text-[#3d485c]">{body}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderRightCanvasBody = () => {
    if (isCompletionActive) return renderCompletionEditor();

    // Auto-injected intro/outro virtual items
    if (activeContentId?.startsWith("intro-")) {
      const quizId = activeContentId.slice("intro-".length);
      const quiz = questions.find((q) => q._id === quizId);
      if (quiz) return renderIntroOutroEditor(quiz, "intro");
    }
    if (activeContentId?.startsWith("outro-")) {
      const quizId = activeContentId.slice("outro-".length);
      const quiz = questions.find((q) => q._id === quizId);
      if (quiz) return renderIntroOutroEditor(quiz, "outro");
    }

    if (!activeItem) {
      if (combinedContent.length === 0) return renderEmptyCanvas();
      // Fall back to nothing selected — show a soft prompt.
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-[#3d485c]">Select an item from the left to edit it.</p>
        </div>
      );
    }
    if (activeItem.kind === "mini") return renderParagraphEditor(activeItem.data);
    if (activeItem.kind === "question") return renderQuestionEditor(activeItem.data);
    return renderVideoEditor(activeItem.data);
  };

  // ----- Render -----

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 md:pt-8 pb-24 md:pb-8 text-[#1c2533]">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {isEditMode ? "Edit Lesson" : "Create New Lesson"}
            </h1>
            <p className="text-[#69728a] mt-2 text-sm">
              {isEditMode
                ? "Update your lesson, manage its content blocks, and republish when you're ready."
                : "Build a new lesson with mini lessons, questions, and videos for your learners."}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(pathname.startsWith("/user-dashboard") ? "/user-dashboard/lessons-tab" : "/studio-dashboard/lessons-tab")}
            className="border-[rgba(28,37,51,0.12)] text-[#1c2533] hover:bg-[rgba(138,63,252,0.06)] gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Lessons
          </Button>
        </div>

        {stepStrip}

        {/* DETAILS STEP */}
        {activeTab === "details" && (
          <>
            <h2 className="text-xl font-semibold">Lesson Details</h2>
            <Card className="bg-purple/10 backdrop-blur-md p-8 space-y-8">
              {loadingLesson ? (
                <StudioLoader compact message="Loading lesson…" />
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleDetailsNext();
                  }}
                  className="space-y-8"
                >
                  <div>
                    <Label className="block mb-2 text-sm font-medium">Lesson Title</Label>
                    <Input
                      placeholder="Enter lesson title..."
                      className="bg-[#f4f1fc] border-[rgba(28,37,51,0.12)]"
                      required
                      value={lessonForm.title}
                      onChange={(e) =>
                        setLessonForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label className="block mb-2 text-sm font-medium">Lesson Description</Label>
                    <textarea
                      placeholder="Describe what learners will get out of this lesson..."
                      className={textareaClassName}
                      required
                      value={lessonForm.description}
                      onChange={(e) =>
                        setLessonForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                    />
                    <p className="text-xs text-[#69728a] mt-2">
                      Keep it clear and practical.
                    </p>
                  </div>

                  <div>
                    <Label className="block mb-2 text-sm font-medium">Reward (XP)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="bg-[#f4f1fc] border-[rgba(28,37,51,0.12)]"
                      required
                      value={lessonForm.reward}
                      onChange={(e) =>
                        setLessonForm((prev) => ({ ...prev, reward: e.target.value }))
                      }
                    />
                    <p className="text-xs text-[#69728a] mt-2">
                      Amount of XP awarded to each learner who completes the lesson.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <Label className="flex items-center gap-2 text-sm mb-3">
                        <ImageIcon className="w-4 h-4" />
                        Cover Image
                      </Label>
                      <label className="block w-full border-2 border-dashed border-purple-500 rounded-2xl p-6 bg-white transition cursor-pointer hover:border-[#8B3EFE]">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            updateLessonImage("coverImage", e.target.files?.[0] ?? null)
                          }
                          className="hidden"
                        />
                        {lessonForm.coverImagePreview ? (
                          <div className="flex flex-col items-center gap-3">
                            <img
                              src={lessonForm.coverImagePreview}
                              alt="Cover preview"
                              className="h-32 w-full object-cover rounded-xl"
                            />
                            <p className="text-sm text-[#69728a]">Click to change</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center gap-2">
                            <ImageIcon className="h-10 w-10 text-[#8a3ffc]" />
                            <p className="font-medium text-[#1c2533]">Upload cover image</p>
                            <p className="text-sm text-[#69728a]">SVG, PNG, JPG or GIF</p>
                          </div>
                        )}
                      </label>
                    </div>

                    <div>
                      <Label className="flex items-center gap-2 text-sm mb-3">
                        <ImageIcon className="w-4 h-4" />
                        Profile Image
                      </Label>
                      <label className="block w-full border-2 border-dashed border-purple-500 rounded-2xl p-6 bg-white transition cursor-pointer hover:border-[#8B3EFE]">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            updateLessonImage("profileImage", e.target.files?.[0] ?? null)
                          }
                          className="hidden"
                        />
                        {lessonForm.profileImagePreview ? (
                          <div className="flex flex-col items-center gap-3">
                            <img
                              src={lessonForm.profileImagePreview}
                              alt="Profile preview"
                              className="h-24 w-24 rounded-2xl object-cover border border-[rgba(28,37,51,0.12)]"
                            />
                            <p className="text-sm text-[#69728a]">Click to change</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center gap-2">
                            <ImageIcon className="h-10 w-10 text-[#8a3ffc]" />
                            <p className="font-medium text-[#1c2533]">Upload profile photo</p>
                            <p className="text-sm text-[#69728a]">Square images work best</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-[rgba(28,37,51,0.12)] bg-[#f4f1fc] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#1c2533]">Show disclaimer</p>
                        <p className="text-xs text-[#69728a]">
                          Add a disclaimer that's shown on the final congratulations card.
                        </p>
                      </div>
                      <Switch
                        checked={lessonForm.showDisclaimer}
                        onCheckedChange={(checked) =>
                          setLessonForm((prev) => ({
                            ...prev,
                            showDisclaimer: checked,
                            disclaimer: checked ? prev.disclaimer : "",
                          }))
                        }
                        className="data-[state=checked]:bg-[#8B3EFE]"
                      />
                    </div>
                    {lessonForm.showDisclaimer && (
                      <textarea
                        value={lessonForm.disclaimer}
                        onChange={(e) =>
                          setLessonForm((prev) => ({ ...prev, disclaimer: e.target.value }))
                        }
                        placeholder="e.g. attribution, credits, legal notice."
                        className={textareaClassName}
                      />
                    )}
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-[#69728a] hover:text-[#1c2533]"
                      onClick={() => onBackToLessons?.()}
                    >
                      ← Back
                    </Button>
                    <Button
                      type="submit"
                      className="bg-[#8B3EFE] hover:bg-[#7b35e6]"
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Next →"}
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          </>
        )}

        {/* CONTENT STEP */}
        {activeTab === "content" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Lesson Content</h2>
              <p className="text-[#69728a] text-sm mt-1">
                Add paragraphs, quizzes, and videos. Select an item on the left to edit it.
              </p>
            </div>

            <div className="flex flex-col gap-6 md:flex-row">
              {/* Left sidebar */}
              <div className="relative w-full md:w-[211px]">
                <div className="flex min-h-[521px] flex-col gap-2 rounded-[8px] border border-[rgba(139,62,254,0.3)] bg-white p-[11px]">
                  {sidebarItems.map((entry) => {
                    if (entry.kind === "content") return renderSidebarItem(entry.item);
                    const id = sidebarEntryId(entry);
                    const isActive = activeContentId === id;
                    const label = entry.kind === "intro" ? "Intro" : "Outro";
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveContentId(id)}
                        className={`flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-xs italic transition-colors ${
                          isActive
                            ? "bg-[#8B3EFE] text-white"
                            : "border border-dashed border-[rgba(139,62,254,0.35)] bg-white text-[#3d485c] hover:bg-[#f4f1fc]"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span className="truncate">{label}</span>
                        </span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            isActive ? "bg-[#f4f1fc] text-[#3d485c]" : "bg-[#f4f1fc] text-[#69728a]"
                          }`}
                        >
                          Auto
                        </span>
                      </button>
                    );
                  })}

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAddPopover((s) => !s)}
                      className="flex h-10 w-full items-center justify-center rounded-[8px] border border-[rgba(139,62,254,0.2)] bg-white text-[#3d485c] transition-colors hover:bg-[#f4f1fc]"
                      aria-label="Add content"
                      aria-expanded={showAddPopover}
                    >
                      <Plus className="h-4 w-4" />
                    </button>

                    {/* Popover anchored just below the + button */}
                    {showAddPopover && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-2 flex flex-col gap-1 rounded-[8px] border border-[rgba(139,62,254,0.4)] bg-white p-2 shadow-lg">
                        <button
                          type="button"
                          onClick={async () => {
                            setShowAddPopover(false);
                            await addParagraph();
                          }}
                          className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-[#3d485c] transition-colors hover:bg-[rgba(138,63,252,0.06)]"
                        >
                          <FileText className="h-4 w-4" />
                          <span>+ Add Paragraph</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setShowAddPopover(false);
                            await addQuiz();
                          }}
                          className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-[#3d485c] transition-colors hover:bg-[rgba(138,63,252,0.06)]"
                        >
                          <FileQuestion className="h-4 w-4" />
                          <span>+ Add Quiz</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setShowAddPopover(false);
                            await addVideo();
                          }}
                          className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-[#3d485c] transition-colors hover:bg-[rgba(138,63,252,0.06)]"
                        >
                          <Play className="h-4 w-4" />
                          <span>+ Add Video</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveContentId(COMPLETION_SENTINEL);
                        setShowAddPopover(false);
                      }}
                      className={`flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-sm transition-colors ${
                        isCompletionActive
                          ? "bg-[#8B3EFE] text-white"
                          : "border border-[rgba(139,62,254,0.2)] bg-white text-[#3d485c] hover:bg-[#f4f1fc]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        <span>Completion</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right canvas */}
              <div className="flex min-h-[521px] flex-1 flex-col rounded-[8px] border border-[rgba(139,62,254,0.4)] bg-white p-6">
                <div className="flex flex-1 flex-col">{renderRightCanvasBody()}</div>

                {/* Footer navigation */}
                {(activeItem ||
                  isCompletionActive ||
                  activeContentId?.startsWith("intro-") ||
                  activeContentId?.startsWith("outro-")) && (
                  <div className="mt-6 flex items-center justify-between gap-3 pt-6 border-t border-[rgba(28,37,51,0.12)]">
                    <button
                      type="button"
                      onClick={goToPreviousStep}
                      disabled={previousDisabled}
                      className="h-10 rounded-[10px] border border-[rgba(139,62,254,0.5)] bg-transparent px-5 text-sm font-semibold text-[#3d485c] transition-colors hover:bg-[rgba(138,63,252,0.06)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous Step
                    </button>
                    {isCompletionActive ? (
                      <button
                        type="button"
                        onClick={() => void handleSaveCompletion()}
                        disabled={saving}
                        className="h-10 rounded-[10px] bg-[#8B3EFE] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#7b35e6] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={goToNextStep}
                        disabled={nextDisabled}
                        className="h-10 rounded-[10px] bg-[#8B3EFE] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#7b35e6] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next Step
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                className="px-4 py-2 bg-[#efeafb] text-[#1c2533] rounded-lg text-sm hover:bg-[#e6dffa] transition"
                onClick={() => setActiveTab("details")}
              >
                ← Back
              </button>
              <button
                className="px-6 py-2 bg-[#8B3EFE] text-white rounded-lg text-sm font-semibold hover:bg-[#7b35e6] transition flex items-center gap-2 disabled:opacity-60"
                onClick={() => setActiveTab("preview")}
                disabled={saving}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* PREVIEW STEP — renders the lesson the way it appears in the user-facing Learn tab */}
        {activeTab === "preview" && (
          <div className="space-y-8">
            {/* Top bar: Back to Builder | Preview Mode | Publish */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setActiveTab("content")}
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(28,37,51,0.12)] bg-white px-4 py-2 text-sm text-[#3d485c] transition hover:border-[rgba(28,37,51,0.25)] hover:text-[#1c2533]"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Builder
              </button>
              <h2 className="text-base font-semibold uppercase tracking-[0.2em] text-[#3d485c]">
                Preview Mode
              </h2>
              <div className="flex items-center gap-2">
                {isPublished && (
                  <button
                    onClick={() => void handlePublishToggle("draft")}
                    disabled={publishing}
                    className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-[#c27c00] transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {publishing ? "Saving..." : "Unpublish"}
                  </button>
                )}
                <button
                  onClick={() => setShowPublishModal(true)}
                  disabled={publishing || combinedContent.length === 0}
                  className="rounded-full bg-[#8B3EFE] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#7b35e6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishing
                    ? "Publishing..."
                    : isPublished
                    ? "Save & Republish"
                    : "Publish"}
                </button>
              </div>
            </div>

            {/* Either the lesson card (entry) or the walkthrough player */}
            {previewPlayerStep < 0 ? (
              <>
                {/* Entry: centered lesson card. Click "Start →" to begin walkthrough. */}
                <div className="flex justify-center pt-6">
                  <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[rgba(28,37,51,0.12)] bg-white shadow-[0_30px_80px_-30px_rgba(138,63,252,0.45)]">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      {lessonForm.coverImagePreview ? (
                        <img
                          src={lessonForm.coverImagePreview}
                          alt="Lesson cover"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[rgba(138,63,252,0.12)] to-[#f7f5ff] text-sm text-[#98a0b4]">
                          Add a cover image to preview
                        </div>
                      )}
                      <span className="absolute right-4 top-4 inline-flex items-center rounded-md bg-cyan-500/25 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-200 ring-1 ring-inset ring-cyan-300/40 backdrop-blur">
                        Not started
                      </span>
                    </div>
                    <div className="space-y-4 p-6">
                      <h3 className="text-xl font-bold leading-tight text-[#1c2533]">
                        {lessonForm.title || "Untitled Lesson"}
                      </h3>
                      <p className="text-sm leading-relaxed text-[#3d485c]">
                        {lessonForm.description || "No description provided."}
                      </p>
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#69728a]">
                          <span>Progress</span>
                          <span>0/{combinedContent.length || 0} Lessons</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-[#f4f1fc]">
                          <div className="h-full w-0 rounded-full bg-[#8B3EFE]" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <span className="inline-flex items-center rounded-full bg-[#8B3EFE]/25 px-3 py-1 text-sm font-semibold text-[#bd92ff] ring-1 ring-inset ring-[#8B3EFE]/40">
                          +{Number(lessonForm.reward) || 0} XP
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewPlayerStep(0)}
                          disabled={combinedContent.length === 0}
                          className="rounded-full bg-[#8B3EFE] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7b35e6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Start →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {combinedContent.length === 0 && (
                  <p className="text-center text-xs text-[#c27c00]">
                    Add at least one content block in the Content step before publishing.
                  </p>
                )}
              </>
            ) : (
              <>
                {/* Walkthrough player — same UX a learner sees in /learn */}
                {(() => {
                  const total = previewPlayerSteps.length;
                  const idx = Math.min(Math.max(previewPlayerStep, 0), total - 1);
                  const step = previewPlayerSteps[idx];
                  const progress = total ? ((idx + 1) / total) * 100 : 0;
                  const goPrev = () => setPreviewPlayerStep(Math.max(0, idx - 1));
                  const goNext = () => setPreviewPlayerStep(Math.min(total - 1, idx + 1));
                  const exit = () => setPreviewPlayerStep(-1);

                  return (
                    <div className="flex justify-center pt-2">
                      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[rgba(28,37,51,0.12)] bg-white shadow-[0_30px_80px_-30px_rgba(138,63,252,0.45)]">
                        {/* Player header: lesson eyebrow + step indicator + close */}
                        <div className="flex items-center justify-between gap-3 border-b border-[rgba(28,37,51,0.12)] px-6 py-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a3ffc]">
                              Learn · {(lessonForm.title || "Untitled Lesson").toUpperCase()}
                            </p>
                            <p className="mt-1 text-base font-semibold text-[#1c2533]">
                              {lessonForm.title || "Untitled Lesson"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#69728a]">
                              Step {idx + 1}/{total}
                            </span>
                            <button
                              type="button"
                              onClick={exit}
                              className="rounded-full border border-[rgba(28,37,51,0.12)] bg-[#f4f1fc] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#3d485c] transition-colors hover:bg-[rgba(138,63,252,0.06)]"
                            >
                              Close
                            </button>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1 overflow-hidden bg-[#f4f1fc]">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-300 to-[#8B3EFE] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        {/* Step content — purple-tinted card with chevrons on sides */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={goPrev}
                            disabled={idx === 0}
                            aria-label="Previous step"
                            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-[rgba(28,37,51,0.12)] bg-white p-2 text-[#3d485c] transition-colors hover:bg-[#f4f1fc] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={goNext}
                            disabled={idx === total - 1}
                            aria-label="Next step"
                            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-[rgba(28,37,51,0.12)] bg-white p-2 text-[#3d485c] transition-colors hover:bg-[#f4f1fc] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronLeft className="h-5 w-5 rotate-180" />
                          </button>

                          <div className="bg-gradient-to-br from-[#7B35E6] via-[#8B3EFE] to-[#5b1ec5] p-10 sm:p-12">
                            <div className="mx-auto flex min-h-[280px] max-w-xl items-center justify-center text-center">
                              {/* Intro / Outro */}
                              {(step.kind === "intro" || step.kind === "outro") && (
                                <div className="flex flex-col items-center gap-5">
                                  {step.trophy && (
                                    <Trophy className={`h-16 w-16 ${trophyColorClass(step.trophy)}`} />
                                  )}
                                  {step.header && (
                                    <p className="text-lg font-bold leading-snug text-[#1c2533]">
                                      {step.header}
                                    </p>
                                  )}
                                  {step.body && (
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#3d485c]">
                                      {step.body}
                                    </p>
                                  )}
                                  {!step.trophy && !step.header && !step.body && (
                                    <p className="text-sm text-[#69728a]">
                                      {step.kind === "intro" ? "Intro card" : "Outro card"} (empty — fill it in on the Content step)
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Mini lesson (paragraph) */}
                              {step.kind === "mini" && (
                                <p className="whitespace-pre-wrap text-base leading-relaxed text-[#1c2533]">
                                  {step.text || "(empty paragraph — fill it in on the Content step)"}
                                </p>
                              )}

                              {/* Video */}
                              {step.kind === "video" && (
                                <div className="w-full">
                                  {step.url ? (
                                    <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "16 / 9" }}>
                                      <iframe
                                        className="absolute inset-0 h-full w-full"
                                        src={youtubeEmbedUrl(step.url)}
                                        title="Video lesson"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      />
                                    </div>
                                  ) : (
                                    <p className="text-sm text-[#3d485c]">(no video URL set yet)</p>
                                  )}
                                </div>
                              )}

                              {/* Quiz — show options with correct one pre-highlighted */}
                              {step.kind === "question" && (
                                <div className="flex w-full flex-col gap-4 text-left">
                                  <h3 className="text-center text-base font-bold uppercase tracking-wide text-[#1c2533]">
                                    {step.question.question || "(empty question)"}
                                  </h3>
                                  <div className="flex flex-col gap-2">
                                    {(step.question.options ?? []).filter((o) => (o ?? "").trim() !== "").map((option, i) => {
                                      const isCorrect = option === step.question.solution;
                                      const base = "flex items-center justify-between rounded-lg border px-3 py-2 transition-colors";
                                      const variant = isCorrect
                                        ? "border-[#00E1A2CC] bg-[#00E1A220] text-[#1c2533]"
                                        : "border-[rgba(28,37,51,0.12)] bg-[#f4f1fc] text-[#3d485c]";
                                      return (
                                        <div key={`${step.question._id}-${i}`} className={`${base} ${variant}`}>
                                          <span className="flex items-center gap-2 min-w-0">
                                            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded bg-[#f4f1fc] text-[10px] font-bold text-[#1c2533]">
                                              {String.fromCharCode(65 + i)}
                                            </span>
                                            <span className="break-words text-sm leading-snug capitalize">
                                              {option}
                                            </span>
                                          </span>
                                          {isCorrect && (
                                            <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00E1A2] text-[10px] font-bold text-black">
                                              ✓
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <p className="text-center text-[11px] text-[#69728a]">
                                    Preview shows the correct answer pre-revealed. Learners tap to answer.
                                  </p>
                                </div>
                              )}

                              {/* Claim / Completion */}
                              {step.kind === "claim" && (
                                <div className="flex flex-col items-center gap-4">
                                  <Trophy
                                    className={`h-16 w-16 ${trophyColorClass(
                                      lessonForm.completionTrophy || "gold",
                                    )}`}
                                  />
                                  <p className="text-2xl font-bold text-[#1c2533]">Congratulations!</p>
                                  <p className="max-w-md whitespace-pre-wrap text-sm leading-relaxed text-[#3d485c]">
                                    You have mastered {lessonForm.title.trim() || "this lesson"}
                                  </p>
                                  <span className="mt-2 inline-flex items-center rounded-full bg-[#f4f1fc] px-4 py-1.5 text-sm font-semibold text-[#1c2533]">
                                    +{Number(lessonForm.reward) || 0} XP
                                  </span>
                                  <button
                                    type="button"
                                    disabled
                                    aria-disabled
                                    className="mt-3 rounded-full bg-white px-6 py-2 text-sm font-semibold text-[#5b1ec5] opacity-95"
                                  >
                                    Claim XP
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Player footer: dots + Continue button */}
                        <div className="flex items-center justify-between gap-3 px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            {previewPlayerSteps.slice(0, Math.min(total, 12)).map((_, i) => (
                              <span
                                key={i}
                                className={`h-1.5 rounded-full transition-all ${
                                  i === idx
                                    ? "w-6 bg-[#8B3EFE]"
                                    : i < idx
                                    ? "w-1.5 bg-[#f4f1fc]"
                                    : "w-1.5 bg-[#f4f1fc]"
                                }`}
                              />
                            ))}
                            {total > 12 && (
                              <span className="ml-1 text-[10px] font-mono text-[#69728a]">+{total - 12}</span>
                            )}
                          </div>
                          {idx < total - 1 ? (
                            <button
                              type="button"
                              onClick={goNext}
                              className="rounded-full bg-[#8B3EFE] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7b35e6]"
                            >
                              Continue
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPreviewPlayerStep(-1)}
                              className="rounded-full bg-[#8B3EFE] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7b35e6]"
                            >
                              Finish
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>

      {/* Confirm dialog (delete prompts) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[rgba(28,37,51,0.12)] bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold text-[#1c2533]">{confirmDialog.title}</h3>
            <p className="mb-6 text-sm leading-relaxed text-[#3d485c]">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="rounded-lg bg-[#f4f1fc] px-4 py-2 text-sm text-[#3d485c] transition-colors hover:bg-[rgba(138,63,252,0.06)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  void (fn as () => void | Promise<void>)();
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-[#1c2533] transition-colors ${
                  confirmDialog.confirmTone === "primary"
                    ? "bg-[#8a3ffc] hover:bg-[#7a2feb]"
                    : "bg-red-600/80 hover:bg-red-600"
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* Publish Payment Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md border border-purple-500/20 p-6 rounded-2xl relative shadow-[0_0_60px_rgba(131,58,253,0.2)] animate-modal-pop">

            <button
              onClick={() => { setShowPublishModal(false); setPaymentTxHash(""); }}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#f4f1fc] hover:bg-[rgba(138,63,252,0.06)] text-[#69728a] hover:text-[#1c2533] transition-all text-lg leading-none"
            >
              ×
            </button>

            <div className="flex justify-center mb-4">
              <img
                src="/activate-studio.png"
                alt=""
                className="w-48 h-40"
              />
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-[#1c2533]">
                Lesson Launch Fee
              </h2>
              <p className="text-[#3d485c] mt-2">
                Pay the lesson launch fee to publish this lesson and make it available for participants.
              </p>
            </div>

            <div className="bg-[#f4f1fc] border border-[rgba(28,37,51,0.12)] rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#1c2533] font-semibold text-sm">Lesson Launch Fee</span>
                <span className="text-[#8a3ffc] font-bold text-sm">1 $TRUST</span>
              </div>
              <p className="text-[#69728a] text-xs mb-3">
                A one-time fee of 1 $TRUST is required to launch and publish this lesson.
              </p>

              {paymentTxHash ? (
                <div className="flex items-center gap-2 bg-green-900/40 border border-green-600/50 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-[#00a87c] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[#00a87c] text-xs font-semibold">Payment confirmed</p>
                    <p className="text-[#69728a] text-[10px] truncate">{paymentTxHash}</p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={paymentLoading}
                  onClick={async () => {
                    setPaymentLoading(true);
                    try {
                      const hash = await payStudioHubFee(1, getLessonFeeContractProject());
                      setPaymentTxHash(hash);
                      await projectApiRequest({
                        method: "PATCH",
                        endpoint: `${apiBase}/save-payment-hash`,
                        data: { txHash: hash },
                      });
                      toast({ title: "Payment successful", description: "1 $TRUST sent. You can now publish your lesson." });
                    } catch (err: any) {
                      toast({ title: "Payment failed", description: err?.message || "Insufficient funds.", variant: "destructive" });
                    } finally {
                      setPaymentLoading(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-[#8B3EFE] hover:bg-[#7b35e6] disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2 transition"
                >
                  {paymentLoading ? (
                    <><span className="inline-block w-4 h-4 border-2 border-[rgba(28,37,51,0.12)] border-t-white rounded-full animate-spin" />Waiting for wallet…</>
                  ) : (
                    <>Pay 1 $TRUST</>
                  )}
                </button>
              )}
            </div>

            <button
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-[#8B3EFE] text-white text-sm font-semibold hover:opacity-90 hover:shadow-[0_0_20px_rgba(131,58,253,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
              onClick={async () => {
                if (!paymentTxHash.trim()) {
                  toast({ title: "Payment required", description: "Please complete the 1 $TRUST payment before publishing.", variant: "destructive" });
                  return;
                }
                toast({ title: "Publishing lesson...", description: "Your lesson is being published." });
                await handlePublishToggle("published");
                setShowPublishModal(false);
                setPaymentTxHash("");
              }}
              disabled={!paymentTxHash}
            >
              Publish
            </button>

            <button
              onClick={() => { setShowPublishModal(false); setPaymentTxHash(""); }}
              className="mt-2 w-full py-2.5 px-4 rounded-xl bg-[#f4f1fc] hover:bg-[rgba(138,63,252,0.06)] border border-[rgba(28,37,51,0.12)] text-[#3d485c] hover:text-[#1c2533] text-sm font-medium transition-all"
            >
              Cancel
            </button>

          </div>
        </div>
      )}</main>
  );
}
