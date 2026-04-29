import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createId } from "@repo/lib";
import { contributors } from "./contributors";
import { projects } from "./projects";

/**
 * Maintainer- or CI-issued penalties on a contributor for a project. Defined in
 * shipshape design doc §6.6. Active when expires_at > now() AND cleared_at IS
 * NULL. Enforced at compute (alignment) and dispatch (payout) time, never
 * stored on the score itself.
 *
 * Yellow: alignment ×0.5 for 30d.
 * Red: no earnings on this project for 90d; alignment forced to 0.
 * Black: permaban; only two-super-admin cosign can clear.
 */

export const contributorPenaltyLevelEnum = pgEnum("contributor_penalty_level", [
  "yellow",
  "red",
  "black",
]);

export const contributorPenaltyIssuedByEnum = pgEnum(
  "contributor_penalty_issued_by",
  ["human_maintainer", "ci_workflow"],
);

export const contributorPenalties = pgTable(
  "contributor_penalties",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    level: contributorPenaltyLevelEnum("level").notNull(),
    reason: text("reason").notNull(),
    /** PR URL where the offending behavior was detected (yellow/red/black). */
    evidencePrUrl: text("evidence_pr_url"),
    /** Required when issuedBy = ci_workflow — CI run URL. */
    evidenceUrl: text("evidence_url"),
    issuedBy: contributorPenaltyIssuedByEnum("issued_by").notNull(),
    /** GitHub user id of the issuing maintainer; null when issuedBy = ci_workflow. */
    issuedByUserId: text("issued_by_user_id"),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Computed at issue time: 30d for yellow, 90d for red, far future for black. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    /** GitHub user id of the maintainer who cleared the penalty. */
    clearedByUserId: text("cleared_by_user_id"),
  },
  (t) => ({
    activeIdx: index("contributor_penalties_active_idx").on(
      t.contributorId,
      t.projectId,
      t.expiresAt,
      t.clearedAt,
    ),
    projectLevelIdx: index("contributor_penalties_project_level_idx").on(
      t.projectId,
      t.level,
      t.expiresAt,
    ),
    // CI-issued penalties must include an evidence URL (CI run); human-issued
    // penalties may include one but it's not required. Mirror of the CHECK
    // constraint hand-written into 0020_shipshape_spine_v1.sql so future
    // db:generate runs don't try to drop it as drift.
    ciEvidenceRequired: check(
      "contributor_penalties_ci_evidence_required",
      sql`${t.issuedBy} <> 'ci_workflow' OR (${t.evidenceUrl} IS NOT NULL AND length(trim(${t.evidenceUrl})) > 0)`,
    ),
    issuerIdentityConsistency: check(
      "contributor_penalties_issuer_identity_consistency",
      sql`(${t.issuedBy} = 'human_maintainer' AND ${t.issuedByUserId} IS NOT NULL AND length(trim(${t.issuedByUserId})) > 0) OR (${t.issuedBy} = 'ci_workflow' AND ${t.issuedByUserId} IS NULL)`,
    ),
  }),
);
