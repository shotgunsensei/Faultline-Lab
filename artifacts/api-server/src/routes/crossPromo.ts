import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { desc, gte, sql } from "drizzle-orm";
import { db, crossPromoClicksTable } from "@workspace/db";
import { optionalAuth, requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const VALID_TIERS = new Set(["anonymous", "free", "pro"]);
const MAX_FIELD_LEN = 256;
const MAX_URL_LEN = 2048;

function isShortString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= MAX_FIELD_LEN;
}

router.post("/cross-promo/click", optionalAuth, async (req, res): Promise<void> => {
  const body = (req.body || {}) as Record<string, unknown>;
  const { placementId, targetProduct, targetUrl, route, userTier } = body;

  if (!isShortString(placementId)) {
    res.status(400).json({ error: "Invalid placementId" });
    return;
  }
  if (!isShortString(targetProduct)) {
    res.status(400).json({ error: "Invalid targetProduct" });
    return;
  }
  if (
    typeof targetUrl !== "string" ||
    targetUrl.length === 0 ||
    targetUrl.length > MAX_URL_LEN
  ) {
    res.status(400).json({ error: "Invalid targetUrl" });
    return;
  }
  if (route != null && (typeof route !== "string" || route.length > MAX_FIELD_LEN)) {
    res.status(400).json({ error: "Invalid route" });
    return;
  }
  const tier =
    typeof userTier === "string" && VALID_TIERS.has(userTier) ? userTier : null;
  if (!tier) {
    res.status(400).json({ error: "Invalid userTier" });
    return;
  }

  // requireAuth/optionalAuth resolves the local app user, exposed as
  // req.appUser. We pull both ids so analytics keeps the legacy `clerkId`
  // column populated for Clerk-backed sessions.
  const appUser = (req as any).appUser as { id: string; clerkId: string | null } | null;
  const userId: string | null = appUser?.id ?? null;
  const clerkId: string | null = appUser?.clerkId ?? null;

  try {
    await db.insert(crossPromoClicksTable).values({
      id: randomUUID(),
      placementId,
      targetProduct,
      targetUrl,
      route: typeof route === "string" ? route : null,
      userTier: tier,
      userId,
      clerkId,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to record cross-promo click");
    res.status(500).json({ error: "Failed to record click" });
    return;
  }

  res.status(202).json({ ok: true });
});

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminUser = (req as any).appUser as { id: string; isAdmin?: boolean } | undefined;
  if (!adminUser || !adminUser.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.get(
  "/admin/cross-promo/clicks",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const now = Date.now();
      const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

      const countCol = sql<number>`count(*)::int`;

      const [
        topPlacements7d,
        topPlacements30d,
        topTargets7d,
        topTargets30d,
        recentRows,
        totals,
      ] = await Promise.all([
        db
          .select({ placementId: crossPromoClicksTable.placementId, clicks: countCol })
          .from(crossPromoClicksTable)
          .where(gte(crossPromoClicksTable.createdAt, since7))
          .groupBy(crossPromoClicksTable.placementId)
          .orderBy(desc(countCol))
          .limit(20),
        db
          .select({ placementId: crossPromoClicksTable.placementId, clicks: countCol })
          .from(crossPromoClicksTable)
          .where(gte(crossPromoClicksTable.createdAt, since30))
          .groupBy(crossPromoClicksTable.placementId)
          .orderBy(desc(countCol))
          .limit(20),
        db
          .select({ targetProduct: crossPromoClicksTable.targetProduct, clicks: countCol })
          .from(crossPromoClicksTable)
          .where(gte(crossPromoClicksTable.createdAt, since7))
          .groupBy(crossPromoClicksTable.targetProduct)
          .orderBy(desc(countCol))
          .limit(20),
        db
          .select({ targetProduct: crossPromoClicksTable.targetProduct, clicks: countCol })
          .from(crossPromoClicksTable)
          .where(gte(crossPromoClicksTable.createdAt, since30))
          .groupBy(crossPromoClicksTable.targetProduct)
          .orderBy(desc(countCol))
          .limit(20),
        db
          .select({
            id: crossPromoClicksTable.id,
            placementId: crossPromoClicksTable.placementId,
            targetProduct: crossPromoClicksTable.targetProduct,
            targetUrl: crossPromoClicksTable.targetUrl,
            route: crossPromoClicksTable.route,
            userTier: crossPromoClicksTable.userTier,
            createdAt: crossPromoClicksTable.createdAt,
          })
          .from(crossPromoClicksTable)
          .orderBy(desc(crossPromoClicksTable.createdAt))
          .limit(50),
        db
          .select({
            total7d: sql<number>`count(*) filter (where ${crossPromoClicksTable.createdAt} >= ${since7})::int`,
            total30d: sql<number>`count(*) filter (where ${crossPromoClicksTable.createdAt} >= ${since30})::int`,
          })
          .from(crossPromoClicksTable),
      ]);

      res.json({
        totals: totals[0] ?? { total7d: 0, total30d: 0 },
        topPlacements7d,
        topPlacements30d,
        topTargets7d,
        topTargets30d,
        recent: recentRows.map((r) => ({
          ...r,
          createdAt: r.createdAt?.toISOString?.() ?? null,
        })),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to load cross-promo dashboard");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
