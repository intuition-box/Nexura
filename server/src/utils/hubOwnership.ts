import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import { hub } from "@/models/hub.model";
import { campaign } from "@/models/campaign.model";
import { campaignQuest, quest, miniQuest } from "@/models/quests.model";
import { lesson, miniLesson, question, videoLesson } from "@/models/lesson.model";
import { submission } from "@/models/submission.model";
import { NOT_FOUND, BAD_REQUEST } from "@/utils/status.utils";
import { ADMIN_CAMPAIGN_SYSTEM_KEY } from "@/utils/adminCampaignHub";

/**
 * Tenant isolation for Studio routes: every record an admin reads or changes by id must belong to
 * the hub on their session (req.admin.hub). Platform admins, and the Nexura system hub they work in,
 * may reach every hub. Anything else answers "not found", so ids from other hubs reveal nothing.
 */

const sameId = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b);
const validId = (id: unknown): id is string => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

/** Whether this request may reach every hub (platform admin, or acting as the Nexura system hub). */
export async function reachesAllHubs(req: any): Promise<boolean> {
  if (req.isPlatformAdmin) return true;
  if (!req.admin?.hub) return false;
  const h = await hub.findById(req.admin.hub).select("systemKey").lean() as any;
  return h?.systemKey === ADMIN_CAMPAIGN_SYSTEM_KEY;
}

/** Whether the signed-in admin is their hub's Owner (hub.superAdmin). Platform admins count as owners. */
export async function isHubOwner(req: any): Promise<boolean> {
  if (req.isPlatformAdmin) return true;
  if (!req.admin?.hub || !req.id) return false;
  const h = await hub.findById(req.admin.hub).select("superAdmin").lean() as any;
  return sameId(h?.superAdmin, req.id);
}

/** True when the hub id (from a record) is the request's hub, or the request reaches every hub. */
export async function ownsHubRecord(req: any, recordHub: unknown): Promise<boolean> {
  if (req.admin?.hub && sameId(recordHub, req.admin.hub)) return true;
  return reachesAllHubs(req);
}

export async function campaignInHub(req: any, campaignId: unknown): Promise<boolean> {
  if (!validId(campaignId)) return false;
  const c = await campaign.findById(campaignId).select("hub").lean() as any;
  return !!c && ownsHubRecord(req, c.hub);
}

export async function campaignQuestInHub(req: any, questId: unknown): Promise<boolean> {
  if (!validId(questId)) return false;
  const q = await campaignQuest.findById(questId).select("campaign").lean() as any;
  return !!q && campaignInHub(req, String(q.campaign));
}

export async function questInHub(req: any, questId: unknown): Promise<boolean> {
  if (!validId(questId)) return false;
  const q = await quest.findById(questId).select("hub creator").lean() as any;
  return !!q && (await ownsHubRecord(req, q.hub ?? q.creator));
}

export async function miniQuestInHub(req: any, miniQuestId: unknown): Promise<boolean> {
  if (!validId(miniQuestId)) return false;
  const m = await miniQuest.findById(miniQuestId).select("quest").lean() as any;
  return !!m && questInHub(req, String(m.quest));
}

export async function lessonInHub(req: any, lessonId: unknown): Promise<boolean> {
  if (!validId(lessonId)) return false;
  const l = await lesson.findById(lessonId).select("creator").lean() as any;
  if (!l) return false;
  // Older lessons may name the admin who made them rather than the hub
  if (sameId(l.creator, req.id)) return true;
  return ownsHubRecord(req, l.creator);
}

const lessonChildInHub = (model: mongoose.Model<any>) => async (req: any, childId: unknown): Promise<boolean> => {
  if (!validId(childId)) return false;
  const child = await model.findById(childId).select("lesson").lean() as any;
  return !!child && lessonInHub(req, String(child.lesson));
};
export const miniLessonInHub = lessonChildInHub(miniLesson);
export const questionInHub = lessonChildInHub(question);
export const videoLessonInHub = lessonChildInHub(videoLesson);

/**
 * A submission belongs to the hub when it's tagged with the hub, or when the campaign it was made on
 * is the hub's (older submissions may only have the campaign link).
 */
export async function submissionInHub(req: any, submissionId: unknown): Promise<boolean> {
  if (!validId(submissionId)) return false;
  const s = await submission.findById(submissionId).select("hub page miniQuestId").lean() as any;
  if (!s) return false;
  if (s.page === "campaign") return validId(s.miniQuestId) && campaignQuestInHub(req, s.miniQuestId);
  if (s.page === "quest" || s.page === "user") return validId(s.miniQuestId) && miniQuestInHub(req, s.miniQuestId);
  if (req.admin?.hub && sameId(s.hub, req.admin.hub)) return true;
  return reachesAllHubs(req);
}

type Check = (req: any, id: unknown) => Promise<boolean>;
type Pick = (req: Request) => unknown;

/**
 * Route guard: answers 404 unless the record whose id `pick` returns belongs to the admin's hub.
 * With `optional`, a missing id passes (e.g. "save" creating a new record instead of updating one).
 */
export const requireInHub = (check: Check, pick: Pick, what: string, { optional = false } = {}) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = pick(req);
      if (id === undefined || id === null || id === "") {
        if (optional) { next(); return; }
        res.status(BAD_REQUEST).json({ error: `send the ${what} id` });
        return;
      }
      if (!(await check(req, String(id)))) {
        res.status(NOT_FOUND).json({ error: `${what} not found in your hub` });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };

/** Common id locations. */
export const fromQuery = (key = "id"): Pick => req => (req.query as any)?.[key];
export const fromBody = (key: string): Pick => req => (req.body as any)?.[key];
/** The first id found among query/body keys (some handlers accept several spellings). */
export const fromAny = (...keys: string[]): Pick => req => {
  for (const k of keys) {
    const v = (req.query as any)?.[k] ?? (req.body as any)?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};
