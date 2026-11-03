import logger from "@/config/logger";
import { hub, userHub } from "@/models/hub.model";
import { hubAdmin } from "@/models/hub.model";
import { spentPayment } from "@/models/spentPayment.model";
import { BAD_REQUEST, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK } from "@/utils/status.utils";
import { STUDIO_CAMPAIGN_FEE, STUDIO_FEE_CONTRACT, STUDIO_PAYMENTS_ENABLED } from "@/utils/env.utils";
import { getAmountPaid } from "@/utils/utils";

/**
 * Studio Payment controller — handles the launch fee required
 * for hub owners to publish campaigns/quests from Nexura Studio.
 *
 * COMPARED TO:
 *   - Admin dashboard: /api/admin/publish-campaign → NO fee (free admin override)
 *   - Studio hub:     /api/hub/publish-campaign   → Requires payment here
 */

export const PAYMENTS_DISABLED_HASH = "PAYMENTS_DISABLED";
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
const PAYMENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function launchFeeProblem(txHash: unknown): Promise<string | null> {
  if (typeof txHash !== "string" || !TX_HASH.test(txHash)) return "send a valid payment transaction hash";
  if (await spentPayment.exists({ txHash: txHash.toLowerCase() })) return "this payment was already used for another launch; pay the launch fee again";
  const tx = await getAmountPaid(txHash).catch(() => null);
  if (!tx || !tx.success) return "that payment wasn't found or didn't go through";
  if (tx.to.toLowerCase() !== STUDIO_FEE_CONTRACT.toLowerCase()) return "that transaction wasn't sent to the Nexura fee contract";
  if (Number(tx.value) < Number(STUDIO_CAMPAIGN_FEE)) return `the launch fee is ${STUDIO_CAMPAIGN_FEE} $TRUST`;
  if (Date.now() - tx.blockTime > PAYMENT_MAX_AGE_MS) return "that payment is too old; pay the launch fee again";
  return null;
}

/** Middleware: validates hub has paid before allowing publish */
export const requireStudioPayment = async (req: GlobalRequest, res: GlobalResponse, next: GlobalNextFunction) => {
  try {
    const hubId = req.admin?.hub;
    if (!hubId) {
      res.status(BAD_REQUEST).json({ error: "no hub associated with this admin" });
      return;
    }

    const [hubDoc, userHubDoc] = await Promise.all([
      hub.findById(hubId).select("pendingTxHash").lean(),
      userHub.findById(hubId).select("pendingTxHash").lean(),
    ]);

    const finalDoc = hubDoc || userHubDoc;
    if (!finalDoc) {
      res.status(NOT_FOUND).json({ error: "hub not found" });
      return;
    }

    if ((req.body as any)?.status === "Ended") {
      next();
      return;
    }

    if (!STUDIO_PAYMENTS_ENABLED) {
      req.paymentTxHash = PAYMENTS_DISABLED_HASH;
      next();
      return;
    }

    const storedHash = (finalDoc as any).pendingTxHash;
    const problem = await launchFeeProblem(storedHash);
    if (problem) {
      res.status(FORBIDDEN).json({ error: storedHash ? problem : `No confirmed payment found. Please complete the ${STUDIO_CAMPAIGN_FEE} $TRUST launch fee first.` });
      return;
    }

    req.paymentTxHash = storedHash;
    next();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error validating studio payment" });
  }
};

/** Saves an on-chain payment tx hash for a studio hub */
export const savePaymentHash = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { txHash } = req.body;
    if (txHash && STUDIO_PAYMENTS_ENABLED) {
      const problem = await launchFeeProblem(txHash);
      if (problem) {
        res.status(BAD_REQUEST).json({ error: problem });
        return;
      }
    }
    const hubId = req.admin.hub;
    if (hubId) {
      if (txHash) {
        await Promise.all([
          hub.findByIdAndUpdate(hubId, { pendingTxHash: txHash, $inc: { noOfPayments: 1 } }),
          userHub.findByIdAndUpdate(hubId, { pendingTxHash: txHash, $inc: { noOfPayments: 1 } }),
        ]);
      } else {
        await Promise.all([
          hub.findByIdAndUpdate(hubId, { pendingTxHash: null }),
          userHub.findByIdAndUpdate(hubId, { pendingTxHash: null }),
        ]);
      }
    } else {
      await hubAdmin.findByIdAndUpdate(req.id, { pendingTxHash: txHash ?? null });
    }
    res.status(OK).json({ message: "payment hash saved" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error saving payment hash" });
  }
};

/** Clears the hub's pending payment hash after publish (called internally) */
export const consumePaymentHash = async (hubId: string) => {
  if (!hubId) return;
  await Promise.all([
    hub.findByIdAndUpdate(hubId, { pendingTxHash: null }),
    userHub.findByIdAndUpdate(hubId, { pendingTxHash: null }),
  ]);
};
