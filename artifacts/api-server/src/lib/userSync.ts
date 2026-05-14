import crypto from "crypto";
import { db, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { logger } from "./logger";
import type { VerifiedSsoToken } from "./operatorOsSso";

const BOOTSTRAP_SUPER_ADMIN_EMAILS: ReadonlySet<string> = new Set(
  ["john@shotgunninjas.com"].map((e) => e.toLowerCase()),
);

function isBootstrapEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return BOOTSTRAP_SUPER_ADMIN_EMAILS.has(email.toLowerCase());
}

async function fetchClerkProfile(
  clerkId: string,
): Promise<{ email: string | null; displayName: string | null; avatarUrl: string | null }> {
  try {
    const u: any = await (clerkClient as any).users.getUser(clerkId);
    const primaryId = u?.primaryEmailAddressId;
    const emails: any[] = u?.emailAddresses || [];
    const primary = emails.find((e) => e?.id === primaryId) || emails[0];
    const email: string | null = primary?.emailAddress || null;
    const first = u?.firstName || "";
    const last = u?.lastName || "";
    const displayName: string | null =
      [first, last].filter(Boolean).join(" ").trim() ||
      u?.username ||
      email ||
      null;
    const avatarUrl: string | null = u?.imageUrl || null;
    return { email, displayName, avatarUrl };
  } catch (err) {
    logger.warn({ err }, "clerkClient.users.getUser failed");
    return { email: null, displayName: null, avatarUrl: null };
  }
}

/**
 * Ensure a users row exists for this Clerk session. Backfills email from Clerk
 * if missing. Bootstrap super-admin promotion happens ONLY on row creation
 * (or one-time backfill if an existing row's email becomes known for the first
 * time), so a super admin can later demote the bootstrap account without it
 * being re-promoted on the next request.
 */
export async function ensureUserRow(clerkId: string): Promise<User> {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (existing.length > 0) {
    let user = existing[0];
    if (!user.email) {
      const fetched = await fetchClerkProfile(clerkId);
      if (fetched.email) {
        const updates: Partial<User> = {
          email: fetched.email,
          updatedAt: new Date(),
        };
        if (!user.displayName && fetched.displayName) {
          updates.displayName = fetched.displayName;
        }
        if (!user.avatarUrl && fetched.avatarUrl) {
          updates.avatarUrl = fetched.avatarUrl;
        }
        // One-time bootstrap on the same call where we first learn the email,
        // but ONLY if the user has never been promoted before. This prevents
        // a manual demotion from being silently undone.
        if (
          isBootstrapEmail(fetched.email) &&
          !user.isAdmin &&
          !user.isSuperAdmin
        ) {
          updates.isAdmin = true;
          updates.isSuperAdmin = true;
          logger.info(
            { email: fetched.email, clerkId },
            "Bootstrapped super admin on email backfill",
          );
        }
        await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
        user = { ...user, ...updates } as User;
      }
    }
    return user;
  }

  // Race-safe insert: fetch identity, attempt insert ignoring duplicates on
  // clerk_id, then re-select. This handles the "two parallel requests for a
  // brand-new user" case without producing duplicate rows.
  const fetched = await fetchClerkProfile(clerkId);
  const id = crypto.randomUUID();
  const isBoot = isBootstrapEmail(fetched.email);
  await db
    .insert(usersTable)
    .values({
      id,
      clerkId,
      email: fetched.email,
      displayName: fetched.displayName || "Investigator",
      avatarUrl: fetched.avatarUrl,
      isAdmin: isBoot,
      isSuperAdmin: isBoot,
    })
    .onConflictDoNothing({ target: usersTable.clerkId });
  if (isBoot) {
    logger.info(
      { email: fetched.email, clerkId },
      "Bootstrapped super admin on first sign-in",
    );
  }
  const inserted = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);
  return inserted[0];
}

/**
 * Upsert a users row from a successfully verified + consumed OperatorOS SSO
 * token. Keyed on `operator_identity_id` (the JWT `sub`), which is unique.
 *
 * On every launch we refresh the descriptive fields (email, name, avatar,
 * plan/org/role, last launch time) so OperatorOS remains the source of truth
 * for identity. We do NOT touch Clerk fields — accounts that arrived via
 * Clerk and accounts that arrived via OperatorOS are independent rows; a
 * single human with both auth methods will today have two rows. Linking them
 * is intentionally left for a future "claim account" flow.
 *
 * Bootstrap super-admin promotion runs once on row creation, or once on the
 * first launch where we learn an email, mirroring `ensureUserRow`.
 */
export async function ensureOperatorOsUserRow(token: VerifiedSsoToken): Promise<User> {
  const now = new Date();
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.operatorIdentityId, token.sub))
    .limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    const updates: Partial<User> = {
      operatorPlanSlug: token.planSlug ?? user.operatorPlanSlug ?? null,
      operatorOrganizationId: token.organizationId ?? user.operatorOrganizationId ?? null,
      operatorRole: token.role ?? user.operatorRole ?? null,
      operatorLastLaunchAt: now,
      updatedAt: now,
    };
    if (token.email && token.email !== user.email) updates.email = token.email;
    if (token.name && !user.displayName) updates.displayName = token.name;
    if (token.avatarUrl && !user.avatarUrl) updates.avatarUrl = token.avatarUrl;
    if (
      !user.isAdmin &&
      !user.isSuperAdmin &&
      isBootstrapEmail(updates.email ?? user.email)
    ) {
      updates.isAdmin = true;
      updates.isSuperAdmin = true;
      logger.info(
        { email: updates.email ?? user.email, operatorIdentityId: token.sub },
        "Bootstrapped super admin on OperatorOS launch",
      );
    }
    await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
    return { ...user, ...updates } as User;
  }

  const id = crypto.randomUUID();
  const isBoot = isBootstrapEmail(token.email);
  await db
    .insert(usersTable)
    .values({
      id,
      operatorIdentityId: token.sub,
      email: token.email ?? null,
      displayName: token.name || token.email || "Investigator",
      avatarUrl: token.avatarUrl ?? null,
      operatorPlanSlug: token.planSlug ?? null,
      operatorOrganizationId: token.organizationId ?? null,
      operatorRole: token.role ?? null,
      operatorLastLaunchAt: now,
      isAdmin: isBoot,
      isSuperAdmin: isBoot,
    })
    .onConflictDoNothing({ target: usersTable.operatorIdentityId });
  if (isBoot) {
    logger.info(
      { email: token.email, operatorIdentityId: token.sub },
      "Bootstrapped super admin on first OperatorOS launch",
    );
  }
  const inserted = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.operatorIdentityId, token.sub))
    .limit(1);
  return inserted[0];
}
