import { boolean, customType, integer, jsonb, pgTable, real, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea", fromDriver: (value) => Buffer.isBuffer(value) ? value : Buffer.from(value as any) });

// Personal profile, look and feel, and display picture. Reviewed SQL
// migration: lib/db/migrations/20261123_profiles_and_appearance.sql.
export const userProfilesTable = pgTable("user_profiles", {
 userId: varchar("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
 displayName: varchar("display_name", { length: 60 }).notNull().default(""),
 pronouns: varchar("pronouns", { length: 30 }).notNull().default(""),
 bio: varchar("bio", { length: 280 }).notNull().default(""),
 avatarStyle: varchar("avatar_style", { length: 12 }).notNull().default("initials"),
 avatarColor: varchar("avatar_color", { length: 12 }).notNull().default("clay"),
 updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userAppearanceTable = pgTable("user_appearance", {
 userId: varchar("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
 theme: varchar("theme", { length: 8 }).notNull().default("system"),
 accent: varchar("accent", { length: 12 }).notNull().default("clay"),
 fontScale: real("font_scale").notNull().default(1),
 density: varchar("density", { length: 12 }).notNull().default("comfortable"),
 font: varchar("font", { length: 12 }).notNull().default("default"),
 highContrast: boolean("high_contrast").notNull().default(false),
 reduceMotion: boolean("reduce_motion").notNull().default(false),
 underlineLinks: boolean("underline_links").notNull().default(false),
 captionsDefault: boolean("captions_default").notNull().default(true),
 pinned: jsonb("pinned").$type<string[]>().notNull().default([]),
 updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Small images only (validated by magic bytes, at most 300 KB). Served through
// an opaque token so a picture URL never reveals an account id.
export const profilePhotosTable = pgTable("profile_photos", {
 userId: varchar("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
 token: uuid("token").notNull().unique(),
 contentType: varchar("content_type", { length: 16 }).notNull(),
 bytes: bytea("bytes").notNull(),
 sizeBytes: integer("size_bytes").notNull(),
 status: varchar("status", { length: 20 }).notNull(),
 decidedBy: varchar("decided_by").references(() => usersTable.id, { onDelete: "set null" }),
 decidedAt: timestamp("decided_at", { withTimezone: true }),
 note: text("note"),
 createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
