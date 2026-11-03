import logger from "@/config/logger";
import { hub, hubAdmin } from "@/models/hub.model";
import { hubNotification } from "@/models/hubNotification.model";

/** Labels for the project settings fields, as the notice shows them. */
export const PROJECT_FIELD_LABELS: Record<string, string> = {
  name: "project name", description: "description", categories: "tags", website: "website", logo: "picture", document: "document",
  xAccount: "X account", discord: "Discord server", telegram: "Telegram",
};
const SOCIAL_FIELDS = new Set(["xAccount", "discord", "telegram"]);

export type ChangeDetail = { field: string; from?: string; to?: string };

const clip = (v: unknown) => String(v ?? "").slice(0, 300);

export async function notifyProjectChange(req: any, fields: string[], details: ChangeDetail[] = []) {
  try {
    const hubId = req.admin?.hub;
    if (!hubId || !fields.length || req.isPlatformAdmin) return;
    const [h, superAdmins] = await Promise.all([
      hub.findById(hubId).select("superAdmin").lean() as Promise<any>,
      hubAdmin.find({ hub: hubId, role: "superadmin" }).select("_id").lean(),
    ]);
    const ids = new Set([...superAdmins.map(a => String(a._id)), ...(h?.superAdmin ? [String(h.superAdmin)] : [])]);
    ids.delete(String(req.id));
    await hubNotification.create({
      hub: hubId, kind: "project", actor: req.id, actorName: String(req.admin?.name ?? ""),
      changes: [...new Set(fields.map(f => PROJECT_FIELD_LABELS[f] ?? f))],
      details: details.map(d => ({ field: d.field, from: clip(d.from), to: clip(d.to) })),
      tab: fields.every(f => SOCIAL_FIELDS.has(f)) ? "accounts" : "project",
      recipients: [...ids],
    });
  } catch (err) {
    logger.warn(`project change notice failed: ${(err as Error)?.message ?? err}`);
  }
}

export async function recordHubActivity(req: any, kind: "username" | "campaign", details: ChangeDetail[]) {
  try {
    const hubId = req.admin?.hub;
    if (!hubId || req.isPlatformAdmin) return;
    const recipients = kind === "campaign"
      ? (await hubAdmin.find({ hub: hubId, _id: { $ne: req.id } }).select("_id").lean()).map(a => a._id)
      : [];
    await hubNotification.create({
      hub: hubId, kind, actor: req.id, actorName: String(req.admin?.name ?? ""),
      changes: details.map(d => d.field), details: details.map(d => ({ field: d.field, from: clip(d.from), to: clip(d.to) })),
      recipients,
    });
  } catch (err) {
    logger.warn(`hub activity (${kind}) failed: ${(err as Error)?.message ?? err}`);
  }
}
