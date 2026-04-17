import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export type CatalogOverrideShape = {
  status?: "available" | "coming-soon" | "disabled";
  featured?: boolean;
  shortDescription?: string;
  longDescription?: string;
  tags?: string[];
};

export const catalogOverridesTable = pgTable("catalog_overrides", {
  productId: text("product_id").primaryKey(),
  overrides: jsonb("overrides").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CatalogOverride = typeof catalogOverridesTable.$inferSelect;
