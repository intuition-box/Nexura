import { retentionDraft } from "@/models/retentionDraft.model";

const MAX_DRAFT_CHARS = 1_500_000;

export const getRetentionDraft = async (req: GlobalRequest, res: GlobalResponse) => {
  const row = await retentionDraft.findOne({ adminId: req.id }).lean();
  res.json({
    draft: row?.draft ?? null,
    savedAt: row?.updatedAt ?? null,
  });
};

export const saveRetentionDraft = async (req: GlobalRequest, res: GlobalResponse) => {
  const draft = req.body?.draft;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    res.status(400).json({ error: "draft is required" });
    return;
  }
  if (JSON.stringify(draft).length > MAX_DRAFT_CHARS) {
    res.status(413).json({ error: "draft is too large" });
    return;
  }
  const row = await retentionDraft.findOneAndUpdate(
    { adminId: req.id },
    { draft, updatedAt: new Date() },
    { upsert: true, new: true },
  );
  res.json({ ok: true, savedAt: row?.updatedAt ?? new Date().toISOString() });
};
