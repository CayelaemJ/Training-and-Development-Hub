import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Store only SHA-256 hashes of one-time codes. Never store the raw redirect code.
export const nativeAuthCodesTable = pgTable("native_auth_codes", {
  codeHash: varchar("code_hash", { length: 64 }).primaryKey(),
  clientId: varchar("client_id", { length: 64 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  challenge: varchar("challenge", { length: 43 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("idx_native_auth_codes_expires").on(t.expiresAt)]);
