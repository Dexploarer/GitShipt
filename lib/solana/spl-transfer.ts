import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { solanaConnection } from "./connection";
import { payoutSigner } from "./signer";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/**
 * Build a Memo instruction. Optional, but useful for tracing payout transfers
 * back to the source snapshot/recipient row in block explorers.
 */
function buildMemoInstruction(memo: string): TransactionInstruction {
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });
}

export interface TransferResult {
  signature: string;
}

/**
 * Atomic native-SOL transfer with a single retry on transient failure.
 * Signed by `payoutSigner()`; `commitment: 'confirmed'` for finality before
 * we mark the recipient row sent.
 *
 * Lamports are passed as bigint to preserve precision over the wire; we
 * narrow to Number at instruction-build time because @solana/web3.js's
 * SystemProgram.transfer accepts `number | bigint` but the older typings in
 * v1.98 default the field to number. JS Number is safe here for any
 * realistic single-recipient lamport amount (<= 2^53 lamports = ~9e15 SOL).
 */
export async function transferSol(
  to: PublicKey,
  lamports: bigint,
  reasonMemo?: string,
): Promise<TransferResult> {
  if (lamports <= 0n) {
    throw new Error("transferSol: lamports must be > 0");
  }
  if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("transferSol: lamports exceed safe integer (split tx)");
  }
  const conn = solanaConnection("confirmed");
  const signer = payoutSigner();

  const buildTx = (): Transaction => {
    const tx = new Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: to,
        lamports: Number(lamports),
      }),
    );
    if (reasonMemo) tx.add(buildMemoInstruction(reasonMemo.slice(0, 200)));
    return tx;
  };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const tx = buildTx();
      const signature = await sendAndConfirmTransaction(conn, tx, [signer], {
        commitment: "confirmed",
        maxRetries: 3,
      });
      return { signature };
    } catch (err) {
      lastErr = err;
      // brief backoff before single retry
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`transferSol failed: ${String(lastErr)}`);
}
