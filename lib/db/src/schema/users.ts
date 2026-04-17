import { pgTable, text, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  clerkId: text("clerk_id").unique(),
  email: text("email"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  profileData: jsonb("profile_data").notNull().$type<{
    name: string;
    casesSolved: number;
    bestScores: Record<string, number>;
    totalScore: number;
    streakCurrent: number;
    streakBest: number;
    achievementsUnlocked: string[];
    solvedCaseIds: string[];
    createdAt: number;
    lastActiveAt: number;
  }>(),
  caseStates: jsonb("case_states").notNull().$type<Record<string, unknown>>().default({}),
  settings: jsonb("settings").notNull().$type<{
    soundEnabled: boolean;
    animationsEnabled: boolean;
    terminalFontSize: number;
  }>().default({ soundEnabled: false, animationsEnabled: true, terminalFontSize: 14 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userEntitlementsTable = pgTable("user_entitlements", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  entitlementType: text("entitlement_type").notNull(),
  productId: text("product_id").notNull(),
  source: text("source").notNull(),
  stripePaymentId: text("stripe_payment_id"),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const purchasesTable = pgTable("purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amount: integer("amount"),
  currency: text("currency").default("usd"),
  status: text("status").notNull().default("pending"),
  fulfilledAt: timestamp("fulfilled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export type UserProfile = typeof userProfilesTable.$inferSelect;
export type UserEntitlement = typeof userEntitlementsTable.$inferSelect;
export type Purchase = typeof purchasesTable.$inferSelect;
