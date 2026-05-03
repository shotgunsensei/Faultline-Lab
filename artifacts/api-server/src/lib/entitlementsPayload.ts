import { db } from "@workspace/db";
import { userEntitlementsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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

export interface EntitlementsPayload {
  ownedProductIds: string[];
  activeSubscription: string | null;
  isProUser: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

/**
 * Builds the `/api/entitlements` payload for a given app-user id (NOT a
 * Clerk id). Mirrors the client-side `EntitlementState` shape so the server
 * remains the source of truth for entitlement membership.
 *
 * Bundle expansion happens here so the client doesn't have to know about
 * the catalog topology — owning a bundle implicitly owns each child.
 */
export async function computeEntitlementsPayload(
  userId: string,
): Promise<EntitlementsPayload> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const entitlements = await db
    .select()
    .from(userEntitlementsTable)
    .where(eq(userEntitlementsTable.userId, userId));

  const active = entitlements.filter((e) => e.isActive && !e.revokedAt);
  const directIds = active.map((e) => e.productId);

  const expanded = new Set<string>(directIds);
  for (const id of directIds) {
    const children = BUNDLE_CONTENTS[id];
    if (children) for (const c of children) expanded.add(c);
  }

  const ownedProductIds = ["base-free", ...Array.from(expanded)];
  const activeSubscription =
    active.find((e) => e.entitlementType === "subscription")?.productId ||
    (expanded.has("pro-subscription") ? "pro-subscription" : null);
  const isProUser = expanded.has("pro-subscription");

  return {
    ownedProductIds,
    activeSubscription,
    isProUser,
    isAdmin: !!user?.isAdmin,
    isSuperAdmin: !!user?.isSuperAdmin,
  };
}
