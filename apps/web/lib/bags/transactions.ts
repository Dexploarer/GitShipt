import type { Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

export type BagsTransaction = Transaction | VersionedTransaction;

type Web3Module = typeof import("@solana/web3.js");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function nestedTransactionCandidate(value: Record<string, unknown>): unknown {
  return (
    value.transaction ??
    value.tx ??
    value.swapTransaction ??
    value.serializedTransaction ??
    value.response
  );
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function deserializeBytes(
  bytes: Uint8Array,
  web3: Web3Module,
): BagsTransaction {
  const errors: string[] = [];

  try {
    return web3.VersionedTransaction.deserialize(bytes);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    return web3.Transaction.from(bytes);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error(
    `Bags returned an unsupported serialized transaction: ${errors.join("; ")}`,
  );
}

function deserializeString(
  value: string,
  web3: Web3Module,
): BagsTransaction {
  const trimmed = value.trim();
  const errors: string[] = [];

  for (const decode of [
    () => bs58.decode(trimmed),
    () => decodeBase64(trimmed),
  ]) {
    try {
      return deserializeBytes(decode(), web3);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    `Bags returned an unsupported serialized transaction string: ${errors.join("; ")}`,
  );
}

export async function normalizeBagsTransaction(
  transaction: unknown,
): Promise<BagsTransaction> {
  const web3 = await import("@solana/web3.js");

  if (
    transaction instanceof web3.VersionedTransaction ||
    transaction instanceof web3.Transaction
  ) {
    return transaction;
  }

  if (typeof transaction === "string") {
    return deserializeString(transaction, web3);
  }

  if (transaction instanceof Uint8Array || Buffer.isBuffer(transaction)) {
    return deserializeBytes(transaction, web3);
  }

  if (Array.isArray(transaction)) {
    return deserializeBytes(Uint8Array.from(transaction), web3);
  }

  if (isRecord(transaction)) {
    const candidate = nestedTransactionCandidate(transaction);
    if (candidate !== undefined && candidate !== transaction) {
      return normalizeBagsTransaction(candidate);
    }
  }

  throw new Error("Bags returned an unsupported transaction type.");
}
