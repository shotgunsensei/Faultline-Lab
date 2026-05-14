import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, crossPromoClicksTable, usersTable } from "@workspace/db";
import { optionalAuth } from "../middlewares/requireAuth";

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

export default router;
