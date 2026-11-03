import { useEffect, useRef, useState } from "react";
import { projectApiRequest } from "@/lib/projectApi";
import type { RetentionDraft } from "@/components/studio/campaign-flow/model";

function shrink(draft: RetentionDraft): RetentionDraft {
  if (JSON.stringify(draft).length <= 1_100_000) return draft;
  return { ...draft, details: { ...draft.details, coverUrl: "" } };
}

async function loadDraft(): Promise<RetentionDraft | null> {
  const json = await projectApiRequest<{ draft?: RetentionDraft | null }>({
    method: "GET",
    endpoint: "/hub/retention-draft",
  });
  return json.draft ?? null;
}

async function saveDraft(draft: RetentionDraft) {
  await projectApiRequest({
    method: "PUT",
    endpoint: "/hub/retention-draft",
    data: { draft: shrink(draft) },
  });
}

export function useRetentionAutosave(draft: RetentionDraft, restore: (draft: RetentionDraft) => void) {
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const serialized = JSON.stringify(draft);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const skip = useRef(true);
  const seq = useRef(0);

  useEffect(() => {
    let cancel = false;
    loadDraft()
      .then((loaded) => {
        if (cancel) return;
        if (loaded) {
          restoreRef.current(loaded);
          setStatus("saved");
        }
      })
      .catch(() => {
        if (!cancel) setStatus("error");
      })
      .finally(() => {
        if (!cancel) setHydrated(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    const ticket = ++seq.current;
    setStatus("saving");
    const timer = window.setTimeout(() => {
      saveDraft(JSON.parse(serialized) as RetentionDraft)
        .then(() => {
          if (ticket === seq.current) setStatus("saved");
        })
        .catch(() => {
          if (ticket === seq.current) setStatus("error");
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [hydrated, serialized]);

  return { hydrated, status };
}
