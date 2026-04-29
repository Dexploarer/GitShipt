-- Escrow expiry sanity constraint.
--
-- escrow_holdings.expires_at is the operator's grace-period signal for
-- liability review. It must lie strictly after the row's own creation
-- timestamp; otherwise the holding is born already expired, which would
-- cause expireEscrow to immediately treat real contributor rewards as
-- review candidates. We use created_at (immutable column) instead of
-- now() so the constraint is deterministic.
--
-- This is defensive: every code path that inserts into escrow_holdings
-- already passes a forward-dated `expires_at`, but a future migration or
-- a buggy direct INSERT could violate the invariant.

DO $$ BEGIN
  ALTER TABLE "escrow_holdings"
    ADD CONSTRAINT "escrow_expires_after_created"
    CHECK ("expires_at" > "created_at");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
