import crypto from "crypto";
import { db, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";

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
    console.warn("clerkClient.users.getUser failed:", (err as Error)?.message);
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
          console.log(
            `Bootstrapped super admin on email backfill: ${fetched.email} (clerkId=${clerkId})`,
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
    console.log(
      `Bootstrapped super admin on first sign-in: ${fetched.email} (clerkId=${clerkId})`,
    );
  }
  const inserted = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);
  return inserted[0];
}
