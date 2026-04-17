import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { usersTable, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import {
  getCatalogOverridesVersion,
  loadCatalogOverridesPayload,
  onCatalogOverridesChanged,
} from "../lib/catalogEvents";

const router = Router();

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;

    const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
    if (user.length === 0) {
      return res.json({ profile: null, settings: null, caseStates: null });
    }

    const profile = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, user[0].id)).limit(1);
    if (profile.length === 0) {
      return res.json({ profile: null, settings: null, caseStates: null });
    }

    return res.json({
      profile: profile[0].profileData,
      settings: profile[0].settings,
      caseStates: profile[0].caseStates,
    });
  } catch (err) {
    console.error("Failed to load profile:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/profile", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).userId as string;
    const { profile, settings, caseStates } = req.body;

    let user = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
    if (user.length === 0) {
      const id = crypto.randomUUID();
      await db.insert(usersTable).values({
        id,
        clerkId,
        email: null,
        displayName: profile?.name || "Investigator",
      });
      user = [{ id, clerkId, email: null, displayName: profile?.name || "Investigator", avatarUrl: null, stripeCustomerId: null, stripeSubscriptionId: null, isAdmin: false, createdAt: new Date(), updatedAt: new Date() }];
    }

    const existing = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, user[0].id)).limit(1);

    if (existing.length === 0) {
      await db.insert(userProfilesTable).values({
        userId: user[0].id,
        profileData: profile,
        caseStates: caseStates || {},
        settings: settings || { soundEnabled: false, animationsEnabled: true, terminalFontSize: 14 },
      });
    } else {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (profile) updates.profileData = profile;
      if (settings) updates.settings = settings;
      if (caseStates) updates.caseStates = caseStates;

      await db.update(userProfilesTable)
        .set(updates)
        .where(eq(userProfilesTable.userId, user[0].id));
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Failed to save profile:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/entitlements", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).userId as string;

    const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
    if (user.length === 0) {
      return res.json({ ownedProductIds: ["base-free"], activeSubscription: null, isProUser: false, isAdmin: false });
    }

    const { userEntitlementsTable } = await import("@workspace/db");
    const entitlements = await db.select()
      .from(userEntitlementsTable)
      .where(eq(userEntitlementsTable.userId, user[0].id));

    const activeEntitlements = entitlements.filter(e => e.isActive && !e.revokedAt);
    const directIds = activeEntitlements.map(e => e.productId);

    const BUNDLE_CONTENTS: Record<string, string[]> = {
      "bundle-master-investigator": [
        "pro-subscription",
        "pack-network-ops",
        "pack-server-graveyard",
        "pack-garage-diagnostics",
        "pack-sensor-mesh",
        "pack-mixed-cascades",
        "upgrade-advanced-tools",
        "upgrade-chaos-mode",
        "upgrade-deep-telemetry",
        "upgrade-sandbox-pro",
        "upgrade-pro-analytics",
      ],
      "bundle-clinical-systems": [
        "pack-healthcare-imaging",
        "upgrade-advanced-tools",
        "upgrade-deep-telemetry",
      ],
    };

    const expanded = new Set<string>(directIds);
    for (const id of directIds) {
      const children = BUNDLE_CONTENTS[id];
      if (children) for (const c of children) expanded.add(c);
    }

    const ownedProductIds = ["base-free", ...Array.from(expanded)];
    const activeSubscription =
      activeEntitlements.find(e => e.entitlementType === "subscription")?.productId ||
      (expanded.has("pro-subscription") ? "pro-subscription" : null);
    const isProUser = expanded.has("pro-subscription");
    const isAdmin = !!user[0].isAdmin;

    return res.json({ ownedProductIds, activeSubscription, isProUser, isAdmin });
  } catch (err) {
    console.error("Failed to load entitlements:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/catalog/overrides", async (_req, res) => {
  try {
    const payload = await loadCatalogOverridesPayload();
    return res.json(payload);
  } catch (err) {
    console.error("Failed to load public catalog overrides:", err);
    return res.json({ overrides: [], version: getCatalogOverridesVersion() });
  }
});

router.get("/catalog/overrides/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const write = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  res.write("retry: 5000\n\n");

  try {
    const initial = await loadCatalogOverridesPayload();
    write("overrides", initial);
  } catch (err) {
    console.warn("SSE initial overrides load failed:", err);
  }

  let lastSentVersion = getCatalogOverridesVersion();
  const unsubscribe = onCatalogOverridesChanged(async (version) => {
    if (version === lastSentVersion) return;
    try {
      const payload = await loadCatalogOverridesPayload();
      lastSentVersion = payload.version;
      write("overrides", payload);
    } catch (err) {
      console.warn("SSE overrides push failed:", err);
    }
  });

  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
    try {
      res.end();
    } catch {}
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
});

export default router;
