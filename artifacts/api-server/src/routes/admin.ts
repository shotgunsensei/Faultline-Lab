import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db, usersTable, userEntitlementsTable, catalogOverridesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { grantEntitlementFromCheckout } from "../lib/grantEntitlement";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const clerkId = (req as any).userId as string;
  const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (user.length === 0 || !user[0].isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  (req as any).adminUser = user[0];
  next();
}

function getParam(req: Request, key: string): string {
  const v = (req.params as any)[key];
  return Array.isArray(v) ? String(v[0]) : String(v);
}

router.get("/admin/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await db.select().from(usersTable).limit(500);
    return res.json({
      users: users.map((u) => ({
        id: u.id,
        clerkId: u.clerkId,
        email: u.email,
        displayName: u.displayName,
        isAdmin: !!u.isAdmin,
      })),
    });
  } catch (err) {
    console.error("Failed to list users:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/users/:userId/entitlements", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = getParam(req, "userId");
    const entitlements = await db
      .select()
      .from(userEntitlementsTable)
      .where(eq(userEntitlementsTable.userId, userId));
    return res.json({
      entitlements: entitlements.map((e) => ({
        id: e.id,
        productId: e.productId,
        entitlementType: e.entitlementType,
        source: e.source,
        isActive: !!e.isActive && !e.revokedAt,
        grantedAt: e.grantedAt?.toISOString?.() ?? null,
      })),
    });
  } catch (err) {
    console.error("Failed to load user entitlements:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const VALID_PRODUCT_IDS = new Set([
  "pro-subscription",
  "pack-network-ops",
  "pack-server-graveyard",
  "pack-garage-diagnostics",
  "pack-sensor-mesh",
  "pack-mixed-cascades",
  "pack-healthcare-imaging",
  "upgrade-advanced-tools",
  "upgrade-chaos-mode",
  "upgrade-deep-telemetry",
  "upgrade-sandbox-pro",
  "upgrade-pro-analytics",
  "bundle-clinical-systems",
  "bundle-master-investigator",
]);
const VALID_SOURCES = new Set(["admin-grant", "promo-grant", "comp", "beta", "stripe"]);

router.post("/admin/users/:userId/entitlements", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = getParam(req, "userId");
    const { productId, source = "admin-grant" } = req.body || {};
    if (!productId || typeof productId !== "string" || !VALID_PRODUCT_IDS.has(productId)) {
      return res.status(400).json({ error: "Invalid productId" });
    }
    if (typeof source !== "string" || !VALID_SOURCES.has(source)) {
      return res.status(400).json({ error: "Invalid source" });
    }

    const target = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (target.length === 0) return res.status(404).json({ error: "User not found" });

    const existing = await db
      .select()
      .from(userEntitlementsTable)
      .where(
        and(
          eq(userEntitlementsTable.userId, userId),
          eq(userEntitlementsTable.productId, productId),
          eq(userEntitlementsTable.isActive, true),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return res.json({ success: true, id: existing[0].id, alreadyActive: true });
    }

    const id = await grantEntitlementFromCheckout({
      userId,
      productId,
      source,
    });

    return res.json({ success: true, id });
  } catch (err) {
    console.error("Failed to grant entitlement:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete(
  "/admin/users/:userId/entitlements/:entitlementId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = getParam(req, "userId");
      const entitlementId = getParam(req, "entitlementId");
      await db
        .update(userEntitlementsTable)
        .set({ isActive: false, revokedAt: new Date() })
        .where(
          and(
            eq(userEntitlementsTable.id, entitlementId),
            eq(userEntitlementsTable.userId, userId)
          )
        );
      return res.json({ success: true });
    } catch (err) {
      console.error("Failed to revoke entitlement:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/admin/catalog/overrides", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        productId: catalogOverridesTable.productId,
        overrides: catalogOverridesTable.overrides,
        updatedAt: catalogOverridesTable.updatedAt,
        updatedByUserId: catalogOverridesTable.updatedByUserId,
        editorEmail: usersTable.email,
        editorDisplayName: usersTable.displayName,
      })
      .from(catalogOverridesTable)
      .leftJoin(usersTable, eq(usersTable.id, catalogOverridesTable.updatedByUserId));
    return res.json({
      overrides: rows.map((r) => ({
        productId: r.productId,
        ...((r.overrides as Record<string, unknown>) || {}),
        updatedAt: r.updatedAt?.toISOString?.() ?? null,
        updatedByUserId: r.updatedByUserId,
        editor: r.updatedByUserId
          ? {
              id: r.updatedByUserId,
              displayName: r.editorDisplayName,
              email: r.editorEmail,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error("Failed to load catalog overrides:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/catalog/overrides/:productId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const productId = getParam(req, "productId");
    const overrides = req.body || {};
    const adminUser = (req as any).adminUser as { id: string };
    const existing = await db
      .select()
      .from(catalogOverridesTable)
      .where(eq(catalogOverridesTable.productId, productId))
      .limit(1);
    const now = new Date();
    if (existing.length === 0) {
      await db.insert(catalogOverridesTable).values({
        productId,
        overrides,
        updatedAt: now,
        updatedByUserId: adminUser.id,
      });
    } else {
      await db
        .update(catalogOverridesTable)
        .set({ overrides, updatedAt: now, updatedByUserId: adminUser.id })
        .where(eq(catalogOverridesTable.productId, productId));
    }
    return res.json({
      success: true,
      updatedAt: now.toISOString(),
      updatedByUserId: adminUser.id,
    });
  } catch (err) {
    console.error("Failed to save catalog override:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete(
  "/admin/catalog/overrides/:productId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const productId = getParam(req, "productId");
      await db
        .delete(catalogOverridesTable)
        .where(eq(catalogOverridesTable.productId, productId));
      return res.json({ success: true });
    } catch (err) {
      console.error("Failed to revert catalog override:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
