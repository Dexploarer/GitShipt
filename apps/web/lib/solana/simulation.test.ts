import {
  Keypair,
  SystemProgram,
  Transaction,
  type Connection,
} from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { assertTransactionSimulation } from "./simulation";

const RECENT_BLOCKHASH = "11111111111111111111111111111111";

function unsignedLegacyTransaction(): Transaction {
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

describe("assertTransactionSimulation", () => {
  it("returns simulation evidence when RPC simulation succeeds", async () => {
    const simulateTransaction = vi.fn().mockResolvedValue({
      value: { err: null, logs: ["Program success"], unitsConsumed: 410 },
    });
    const connection = { simulateTransaction } as unknown as Connection;

    await expect(
      assertTransactionSimulation(
        connection,
        unsignedLegacyTransaction(),
        "test transaction",
      ),
    ).resolves.toEqual({
      err: null,
      logs: ["Program success"],
      unitsConsumed: 410,
    });

    expect(simulateTransaction).toHaveBeenCalledTimes(1);
  });

  it("throws with captured logs when RPC simulation fails", async () => {
    const simulateTransaction = vi.fn().mockResolvedValue({
      value: {
        err: { InstructionError: [0, "Custom"] },
        logs: ["Program log: custom failure"],
        unitsConsumed: 99,
      },
    });
    const connection = { simulateTransaction } as unknown as Connection;

    await expect(
      assertTransactionSimulation(
        connection,
        unsignedLegacyTransaction(),
        "test transaction",
      ),
    ).rejects.toThrow(/Program log: custom failure/);
  });
});
