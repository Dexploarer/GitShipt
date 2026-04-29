-- Pre-broadcast simulation evidence on payouts.
--
-- Pre-broadcast simulation is already enforced at every Solana send site
-- (see assertTransactionSimulation in lib/solana/simulation.ts), and the
-- structured event is emitted to the observability sink on every call.
-- This column adds a row-local copy of the most recent CLAIM simulation
-- digest so a postmortem on a specific payout doesn't have to grep the
-- log drain.
--
-- Schema is the bounded SimulationDigest shape:
--   { ok: boolean, err: string | null, unitsConsumed: number | null,
--     logCount: number, logSample: string[], at: ISO string }
--
-- Nullable: rows from before this migration carry NULL until their next
-- claim attempt overwrites it.

ALTER TABLE "payouts"
  ADD COLUMN IF NOT EXISTS "last_claim_simulation" jsonb;
