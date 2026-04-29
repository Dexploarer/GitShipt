import {
  Transaction,
  VersionedTransaction,
  type Connection,
} from "@solana/web3.js";

import { captureEvent, captureException } from "@/lib/observability";

export interface TransactionSimulationEvidence {
  err: unknown | null;
  logs: string[];
  unitsConsumed: number | null;
}

/**
 * Truncated, redacted shape suitable for persistence and structured logs.
 * Drops any oversized log buffer and stringifies the error so the envelope
 * is bounded.
 */
export interface SimulationDigest {
  ok: boolean;
  err: string | null;
  unitsConsumed: number | null;
  logCount: number;
  /** Last 12 log lines, each truncated to 200 chars. */
  logSample: string[];
  at: string;
}

const MAX_LOG_SAMPLE = 12;
const MAX_LOG_LINE = 200;

export function digestSimulation(
  evidence: TransactionSimulationEvidence,
): SimulationDigest {
  return {
    ok: evidence.err === null,
    err:
      evidence.err === null
        ? null
        : typeof evidence.err === "string"
          ? evidence.err
          : safeStringify(evidence.err),
    unitsConsumed: evidence.unitsConsumed,
    logCount: evidence.logs.length,
    logSample: evidence.logs
      .slice(-MAX_LOG_SAMPLE)
      .map((l) => l.slice(0, MAX_LOG_LINE)),
    at: new Date().toISOString(),
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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
  const digest = digestSimulation(evidence);
  if (evidence.err !== null) {
    captureException(new Error(formatSimulationFailure(context, evidence)), {
      area: "solana.simulate",
      severity: "error",
      tags: { context },
      extra: { digest },
    });
    throw new Error(formatSimulationFailure(context, evidence));
  }
  // Success path emits a structured event so postmortems can correlate
  // claim/payout signatures with the simulation that preceded them. This
  // is in addition to any persistence the caller chooses to do.
  captureEvent("solana.simulate.ok", {
    area: "solana.simulate",
    severity: "info",
    tags: { context },
    extra: { digest },
  });
  return evidence;
}
