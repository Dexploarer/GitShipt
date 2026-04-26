import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@repo/lib";

/**
 * Idempotency for inbound webhooks (GitHub, Bags). UNIQUE on (source, event_id)
 * lets us drop replays at insert time.
 */
export const webhooksInbox = pgTable(
  "webhooks_inbox",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    source: text("source").notNull(), // 'github' | 'bags'
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    signature: text("signature"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sourceEventUq: uniqueIndex("webhooks_source_event_uq").on(t.source, t.eventId),
    typeIdx: index("webhooks_type_idx").on(t.eventType),
    processedIdx: index("webhooks_processed_idx").on(t.processedAt),
  }),
);
