import {
  Transaction,
  VersionedTransaction,
  type Connection,
} from "@solana/web3.js";

export interface TransactionSimulationEvidence {
  err: unknown | null;
  logs: string[];
  unitsConsumed: number | null;
}

function serializeSimulationError(err: unknown): string {
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function formatSimulationFailure(
  context: string,
  evidence: TransactionSimulationEvidence,
): string {
  const details = [
    `${context} simulation failed: ${serializeSimulationError(evidence.err)}`,
  ];
  if (evidence.unitsConsumed !== null) {
    details.push(`Units consumed: ${evidence.unitsConsumed}`);
  }
  if (evidence.logs.length > 0) {
    details.push(`Solana simulation logs:\n${evidence.logs.join("\n")}`);
  }
  return details.join("\n");
}

export async function simulateTransactionForBroadcast(
  connection: Connection,
  transaction: Transaction | VersionedTransaction,
): Promise<TransactionSimulationEvidence> {
  const result =
    transaction instanceof VersionedTransaction
      ? await connection.simulateTransaction(transaction, {
          replaceRecentBlockhash: false,
          sigVerify: false,
        })
      : await connection.simulateTransaction(transaction, undefined, false);

  return {
    err: result.value.err ?? null,
    logs: result.value.logs ?? [],
    unitsConsumed: result.value.unitsConsumed ?? null,
  };
}

export async function assertTransactionSimulation(
  connection: Connection,
  transaction: Transaction | VersionedTransaction,
  context: string,
): Promise<TransactionSimulationEvidence> {
  const evidence = await simulateTransactionForBroadcast(
    connection,
    transaction,
  );
  if (evidence.err !== null) {
    throw new Error(formatSimulationFailure(context, evidence));
  }
  return evidence;
}
