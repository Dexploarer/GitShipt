import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RECENT_BLOCKHASH = "11111111111111111111111111111111";
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

describe("transferSol", () => {
  const signer = Keypair.generate();
  const sendRawTransaction = vi.fn();
  const confirmTransaction = vi.fn();
  const getLatestBlockhash = vi.fn();
  const assertTransactionSimulation = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getLatestBlockhash.mockResolvedValue({
      blockhash: RECENT_BLOCKHASH,
      lastValidBlockHeight: 123,
    });
    sendRawTransaction.mockResolvedValue("sig-1");
    confirmTransaction.mockResolvedValue({ value: { err: null } });
    assertTransactionSimulation.mockResolvedValue({
      err: null,
      logs: [],
      unitsConsumed: 1,
    });

    vi.doMock("./connection", () => ({
      solanaConnection: vi.fn(() => ({
        getLatestBlockhash,
        sendRawTransaction,
        confirmTransaction,
      })),
    }));
    vi.doMock("./signer", () => ({
      payoutSigner: vi.fn(() => signer),
    }));
    vi.doMock("./simulation", () => ({
      assertTransactionSimulation,
    }));
  });

  afterEach(() => {
    vi.doUnmock("./connection");
    vi.doUnmock("./signer");
    vi.doUnmock("./simulation");
  });

  it("rejects invalid lamport amounts before building or sending a transaction", async () => {
    const { transferSol } = await import("./spl-transfer");
    const recipient = Keypair.generate().publicKey;

    await expect(transferSol(recipient, 0n)).rejects.toThrow(/must be > 0/);
    await expect(
      transferSol(recipient, BigInt(Number.MAX_SAFE_INTEGER) + 1n),
    ).rejects.toThrow(/exceed safe integer/);

    expect(getLatestBlockhash).not.toHaveBeenCalled();
    expect(sendRawTransaction).not.toHaveBeenCalled();
  });

  it("simulates, broadcasts, and confirms a native SOL transfer with a bounded memo", async () => {
    const { transferSol } = await import("./spl-transfer");
    const recipient = Keypair.generate().publicKey;
    const longMemo = "x".repeat(250);

    await expect(transferSol(recipient, 42n, longMemo)).resolves.toEqual({
      signature: "sig-1",
    });

    expect(assertTransactionSimulation).toHaveBeenCalledTimes(1);
    expect(sendRawTransaction).toHaveBeenCalledTimes(1);
    expect(confirmTransaction).toHaveBeenCalledWith(
      { signature: "sig-1", blockhash: RECENT_BLOCKHASH, lastValidBlockHeight: 123 },
      "confirmed",
    );

    const raw = sendRawTransaction.mock.calls[0]?.[0] as Buffer | Uint8Array;
    const tx = Transaction.from(Buffer.from(raw));
    const memoIx = tx.instructions.find((ix) =>
      ix.programId.equals(new PublicKey(MEMO_PROGRAM_ID)),
    );

    expect(memoIx?.data.toString("utf8")).toHaveLength(200);
  });
});
