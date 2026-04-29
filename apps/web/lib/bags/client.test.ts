import {
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RECENT_BLOCKHASH = "11111111111111111111111111111111";

function serializedVersionedTransaction(): string {
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
  return bs58.encode(new VersionedTransaction(message).serialize());
}

describe("bags.getClaimTransactions", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BAGS_API_KEY", "bags_test_key");
    vi.stubEnv("HELIUS_RPC_URL", undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("normalizes REST fallback tx wrappers into web3 transaction instances", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        response: [{ tx: serializedVersionedTransaction() }],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { bags } = await import("./client");
    const result = await bags.getClaimTransactions(
      "GitShipt1111111111111111111111111111111111111",
      "GShipt11111111111111111111111111111111111111",
    );

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toBeInstanceOf(VersionedTransaction);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "token-launch/claim-txs/v3",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });
});
