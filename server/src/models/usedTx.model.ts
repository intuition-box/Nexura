import mongoose from "mongoose";

/**
 * On-chain transactions already used for something that pays XP or counts toward stats
 * (a deposit's XP, a streak restore, a claim counter). One transaction counts once per purpose.
 */
const usedTxSchema = new mongoose.Schema({
  txHash: { type: String, required: true },
  purpose: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
}, { timestamps: true });

usedTxSchema.index({ txHash: 1, purpose: 1 }, { unique: true });

export const usedTx = mongoose.model("used-txs", usedTxSchema);

/** Records the transaction for this purpose. False when it was already used. */
export async function useTxOnce(txHash: string, purpose: string, user?: unknown): Promise<boolean> {
  try {
    await usedTx.create({ txHash: txHash.toLowerCase(), purpose, user });
    return true;
  } catch (err: any) {
    if (err?.code === 11000) return false;
    throw err;
  }
}

/** Gives the transaction back, for when the step it paid for failed afterwards. */
export async function releaseTx(txHash: string, purpose: string) {
  await usedTx.deleteOne({ txHash: txHash.toLowerCase(), purpose }).catch(() => {});
}
