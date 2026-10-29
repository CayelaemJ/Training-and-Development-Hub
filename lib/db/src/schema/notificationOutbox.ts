import { index, integer, pgTable, serial, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Private, opt-in notification queue. Never put recipient email or learner
 * details in its identifying columns or any public API response.
 */
export const notificationOutboxTable = pgTable("notification_outbox", {
  id: serial("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  organizationId: integer("organization_id"),
  recipientUserId: varchar("recipient_user_id", {length:128}).notNull(),
  recipientCiphertext: text("recipient_ciphertext").notNull(),
  kind: varchar("kind", {length:40}).notNull(),
  status: varchar("status", {length:24}).notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  leaseToken: uuid("lease_token"),
  leaseUntil: timestamp("lease_until", {withTimezone:true}),
  errorCode: varchar("error_code", {length:40}),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone:true}).notNull().defaultNow(),
  sentAt: timestamp("sent_at", {withTimezone:true}),
}, t => [
  uniqueIndex("notification_outbox_event_unique").on(t.eventId),
  index("notification_outbox_pending_idx").on(t.status,t.createdAt),
  index("notification_outbox_user_idx").on(t.recipientUserId,t.createdAt),
]);
