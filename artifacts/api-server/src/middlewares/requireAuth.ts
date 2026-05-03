import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

// Test-only auth bypass for the scripted Stripe purchase E2E
// (`scripts/src/test-stripe-flow.ts`). DISABLED in production deployments.
// To opt in, the caller must:
//   1. Run in a non-production workspace (REPLIT_DEPLOYMENT !== "1").
//   2. Send the workspace's SESSION_SECRET in the `x-e2e-test-token` header.
//   3. Send the desired clerk id in the `x-e2e-clerk-id` header.
// We reuse SESSION_SECRET so no extra secret needs to be managed; in dev it
// only ever exists inside the same workspace as the script.
function tryE2ETestBypass(req: Request): string | null {
  if (process.env.REPLIT_DEPLOYMENT === "1") return null;
  const expected = process.env.SESSION_SECRET;
  if (!expected) return null;
  const provided = req.headers["x-e2e-test-token"];
  if (typeof provided !== "string" || provided !== expected) return null;
  const clerkId = req.headers["x-e2e-clerk-id"];
  if (typeof clerkId !== "string" || !clerkId) return null;
  return clerkId;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const bypassClerkId = tryE2ETestBypass(req);
  if (bypassClerkId) {
    (req as any).userId = bypassClerkId;
    next();
    return;
  }
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const bypassClerkId = tryE2ETestBypass(req);
  if (bypassClerkId) {
    (req as any).userId = bypassClerkId;
    next();
    return;
  }
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  (req as any).userId = userId || null;
  next();
}
