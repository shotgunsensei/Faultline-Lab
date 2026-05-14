# OperatorOS SSO

Faultline Lab is launchable as a child app inside OperatorOS. OperatorOS issues
a short-lived HS256 JWT and redirects the user to:

```
GET <child_app_origin>/sso?token=<JWT>&returnTo=/some/path
```

The api-server owns the `/sso` path (see `artifacts/api-server/.replit-artifact/artifact.toml`,
`paths = ["/api", "/sso"]`). On success it sets a local HMAC-signed session
cookie (`fl_session`) and redirects to `?sso=ok`; on failure it redirects to
`?sso=error&reason=<code>`.

This auth path **coexists** with Clerk: Clerk users continue to sign in via
the existing widget; OperatorOS users arrive via `/sso` and never touch
Clerk. A single human with both auth methods will currently have two distinct
rows in `users` — linking is intentionally out of scope for this change.

## Required environment variables

| Variable | Purpose | Notes |
| --- | --- | --- |
| `MODULE_SSO_SECRET` | Shared HS256 signing secret with OperatorOS | **Hard-fail** in production if missing or `< 16` chars. |
| `OPERATOROS_BASE_URL` | Expected `iss` claim | Exact match. |
| `OPERATOROS_SSO_AUDIENCE` | Module slug, expected `aud` claim | Always lowercased; must equal `faultlinelab` for this app. |
| `OPERATOROS_SSO_ENV` | Expected `env` claim (`dev` / `staging` / `production`) | Tokens minted for a different env are rejected. |
| `OPERATOROS_API_URL` | Base URL for the OperatorOS API | We POST `${API}/v1/modules/sso/consume` to assert single-use. |
| `SESSION_SECRET` | Already present; signs the local `fl_session` cookie | Must remain stable across deploys or all sessions invalidate. |

## Verification pipeline (`artifacts/api-server/src/lib/operatorOsSso.ts`)

1. Decode header — reject anything other than `alg=HS256` (rejects `none`,
   `RS256`, etc. before any signature work).
2. `jwt.verify` with `MODULE_SSO_SECRET`, ±5s clock skew.
3. Claim assertions: `iss`, `aud` (lowercased), `module_slug` (lowercased,
   **must equal both `aud` and the configured audience**), `env`, `iat` not
   older than 90s and not more than 5s in the future, `exp` in the future,
   non-empty `jti` and `sub`. Failure codes:
   `wrong_issuer` / `wrong_audience` / `wrong_module` / `wrong_env` /
   `expired` / `invalid_token` (covers `iat_in_future`, missing claims,
   bad signature, alg mismatch).
4. Mandatory `POST {OPERATOROS_API_URL}/v1/modules/sso/consume` with
   `{ jti, aud, env }`. Upstream codes map to local failure reasons:

   | Upstream code | Local `reason=` |
   | --- | --- |
   | `TOKEN_UNKNOWN` / `TOKEN_REPLAYED` | `consume_failed` |
   | `TOKEN_EXPIRED` | `expired` |
   | `AUDIENCE_MISMATCH` | `wrong_audience` |
   | `ENV_MISMATCH` | `wrong_env` |
   | 5xx / network | `sso_consume_unavailable` (HTTP 502) |

5. `ensureOperatorOsUserRow` upserts on `users.operator_identity_id` (= `sub`)
   and refreshes `email`, `display_name`, `avatar_url`, `operator_plan_slug`,
   `operator_organization_id`, `operator_role`, `operator_last_launch_at`.
6. `mintSessionToken(userId, "operatoros")` — base64url-encoded payload
   `{ uid, iat, exp, src }` HMAC'd with `SESSION_SECRET`. We never reuse the
   OperatorOS JWT as a session cookie.
7. Cookie is set `HttpOnly; SameSite=Lax; Path=/; Secure` (in production).

## Logging & secrets

`req.log` only ever sees `{ jti, code }` on failures and `{ jti, userId, planSlug }`
on success. The raw token, claim payload, and shared secret are never
logged. The pino logger redacts `req.headers.authorization`,
`req.headers.cookie`, and `res.headers['set-cookie']` globally.

## Dual-session middleware

`requireAuth` / `optionalAuth` (`artifacts/api-server/src/middlewares/requireAuth.ts`)
resolve `req.appUser` from either the `fl_session` cookie or the Clerk
session, and set `req.userId` to the local `users.id`. All downstream routes
(`profile`, `entitlements`, `admin`, `stripe`, `crossPromo`) now query users
by their app id rather than by `clerk_id`.

## Client surface

- `GET /api/me` returns `{ user: { id, email, displayName, avatarUrl,
  isAdmin, isSuperAdmin, authSource, operator } }` for both auth modes.
- `POST /api/logout` clears `fl_session` (idempotent). It does not sign the
  user out of OperatorOS or Clerk.
- The SPA hydrates signed-in state from `/api/me` whenever Clerk reports no
  user (both with and without `VITE_CLERK_PUBLISHABLE_KEY`).
- `consumeSsoLandingParams` (`src/lib/ssoLanding.ts`) reads `?sso=ok|error`
  on the landing page, surfaces a Sonner toast, and strips the params from
  the URL so refreshing doesn't replay the toast.

## Tests

`artifacts/api-server/src/routes/sso.test.ts` exercises the endpoint end-to-end
with a stubbed `consumeSsoToken`. Coverage:

- valid token → 302 to `/?sso=ok`, cookie set, user row upserted with plan
- wrong-secret signature → `reason=invalid_token`, no cookie, no consume call
- `alg=none` token → rejected before any signature work
- expired `exp` / stale `iat` → `reason=expired`
- audience mismatch → `reason=wrong_audience`
- env mismatch → `reason=wrong_env`
- consume `TOKEN_REPLAYED` → `reason=consume_failed`
- consume 5xx → HTTP 502, `reason=sso_consume_unavailable`
- relaunch with same `sub` → single row, refreshed `plan_slug`
