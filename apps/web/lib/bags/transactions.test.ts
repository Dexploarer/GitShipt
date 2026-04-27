import {
  Keypair,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, it } from "vitest";
import { normalizeBagsTransaction } from "./transactions";

const RECENT_BLOCKHASH = "11111111111111111111111111111111";

function legacyTransaction(): Transaction {
  const payer = Keypair.generate();
  return new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: RECENT_BLOCKHASH,
  }).add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: payer.publicKey,
      lamports: 1,
    }),
  );
}

function versionedTransaction(): VersionedTransaction {
  const payer = Keypair.generate();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: RECENT_BLOCKHASH,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: payer.publicKey,
        lamports: 1,
      }),
    ],
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

describe("normalizeBagsTransaction", () => {
  it("passes through legacy Transaction instances", async () => {
    const tx = legacyTransaction();

    await expect(normalizeBagsTransaction(tx)).resolves.toBe(tx);
  });

  it("passes through VersionedTransaction instances", async () => {
    const tx = versionedTransaction();

    await expect(normalizeBagsTransaction(tx)).resolves.toBe(tx);
  });

  it("normalizes base58 serialized transaction envelopes", async () => {
    const serialized = versionedTransaction().serialize();
    const normalized = await normalizeBagsTransaction({
      transaction: bs58.encode(serialized),
    });

    expect(normalized).toBeInstanceOf(VersionedTransaction);
    expect((normalized as VersionedTransaction).version).toBe(0);
  });

  it("normalizes base64 serialized claim tx envelopes", async () => {
    const legacy = legacyTransaction().serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const normalized = await normalizeBagsTransaction({
      tx: Buffer.from(legacy).toString("base64"),
    });

    expect(normalized).toBeInstanceOf(VersionedTransaction);
    expect((normalized as VersionedTransaction).version).toBe("legacy");
  });
});
