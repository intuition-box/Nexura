import { hubGovernance } from "@/models/governance.model";
import { campaign } from "@/models/campaign.model";
import { hubAdmin } from "@/models/hub.model";

/**
 * The wallet tied to a Studio admin by something they did in their hub: the wallet stored on the
 * admin, the wallet that signed their governance actions, or the wallet that signed a campaign they
 * published. Null until one of those happens. Once found it is stored on the admin and never changes.
 */
export async function linkedHubWallet(admin: { _id: unknown; hub?: unknown; linkedWallet?: string | null }): Promise<string | null> {
  if (admin.linkedWallet) return admin.linkedWallet;
  const adminId = String(admin._id);

  let found: string | null = null;
  if (admin.hub) {
    const gov = await hubGovernance.findOne({ hub: admin.hub }).select("signerWallets").lean() as any;
    const wallets = gov?.signerWallets as Record<string, string> | undefined;
    found = wallets?.[adminId] ?? null;
  }
  if (!found) {
    const published = await campaign.findOne({ "publishSignature.adminId": adminId, "publishSignature.address": { $exists: true } })
      .sort({ "publishSignature.signedAt": 1 }).select("publishSignature.address").lean() as any;
    found = published?.publishSignature?.address ?? null;
  }
  if (found) {
    await hubAdmin.updateOne({ _id: admin._id, $or: [{ linkedWallet: null }, { linkedWallet: { $exists: false } }] }, { $set: { linkedWallet: found } });
  }
  return found;
}
