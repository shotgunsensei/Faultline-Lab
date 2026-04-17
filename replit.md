# Faultline Lab

## Overview

Faultline Lab is a cinematic browser-based troubleshooting simulator for technical minds. Users investigate broken systems across IT infrastructure, networking, automotive diagnostics, and smart electronics. The app is a fully interactive simulation with optional authentication, cloud sync, and purchasable content packs.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS v4
- **State management**: Zustand
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Persistence**: localStorage (guest mode) + PostgreSQL cloud sync (signed-in users)
- **Auth**: Clerk (optional, gated by `VITE_CLERK_PUBLISHABLE_KEY`)
- **API framework**: Express 5 (api-server handles profile sync, entitlements, Stripe)
- **Payments**: Stripe (via Replit connector + stripe-replit-sync)
- **Icons**: Lucide React
- **Toasts**: Sonner
- **PWA**: Service worker + manifest.json (prod-only registration)

## Architecture

### Dual-mode operation
- **Guest mode**: Full game logic runs client-side with localStorage persistence. No auth required.
- **Signed-in mode**: Clerk auth enables cloud sync (profile, settings, case states), entitlement management, and Stripe purchases.

### Key Directories
- `artifacts/faultline-lab/src/types/` — TypeScript domain model
- `artifacts/faultline-lab/src/data/cases/` — Case definitions (4 MVP cases, all authored via the framework) + typed `registry.ts` (`CASE_DEFINITIONS` map)
- `artifacts/faultline-lab/src/data/cases/authoring/` — Case Authoring Framework (schema, helpers, validation, per-domain templates)
- `artifacts/faultline-lab/src/data/caseCatalog/` — Catalog spine: 56 entries with status/access/source-product mapping, validation, and selectors
- `artifacts/faultline-lab/src/data/catalog.ts` — Product catalog (14 products: tiers, packs, upgrades, bundles)
- `artifacts/faultline-lab/src/lib/simulation.ts` — Simulation engine
- `artifacts/faultline-lab/src/lib/persistence.ts` — localStorage persistence layer
- `artifacts/faultline-lab/src/lib/entitlements.ts` — Entitlement engine (isCaseAccessible, hasFeature, hasEntitlement)
- `artifacts/faultline-lab/src/lib/api.ts` — API client for cloud sync/entitlements
- `artifacts/faultline-lab/src/stores/useAppStore.ts` — Zustand store
- `artifacts/faultline-lab/src/components/` — UI components
- `artifacts/faultline-lab/src/components/CloudSyncProvider.tsx` — Cloud sync with debounced saves and caseState merge
- `artifacts/api-server/src/` — Express API server
- `artifacts/api-server/src/routes/profile.ts` — Profile CRUD + entitlements endpoint
- `artifacts/api-server/src/routes/stripe.ts` — Stripe checkout, products, subscription endpoints
- `artifacts/api-server/src/stripeClient.ts` — Stripe client via Replit connector
- `artifacts/api-server/src/stripeStorage.ts` — Stripe data queries from stripe-replit-sync schema
- `artifacts/api-server/src/webhookHandlers.ts` — Stripe webhook processing
- `lib/db/` — Shared Drizzle ORM package (@workspace/db)
- `lib/db/src/schema/users.ts` — Users, profiles, entitlements, purchases tables
- `scripts/src/seed-products.ts` — Script to create Stripe products from catalog

### Entitlement System
- `FREE_CASE_IDS`: the four built-in starter case IDs (`case-windows-ad-001`,
  `case-networking-vpn-001`, `case-automotive-001`, `case-electronics-001`).
  As real pack-exclusive cases are authored, they go into the corresponding
  pack's `includedCaseIds` instead of this list.
- `base-free` product owned by all users
- Pro subscription ($8.99/mo, $79/yr) grants every case + Pro features
- Content packs, feature upgrades, and bundles are `coming-soon` in catalog
- `isCaseAccessible()` is **fail-closed**: a case is accessible only if it's
  in `FREE_CASE_IDS`, the user has Pro, or it's listed in `includedCaseIds`
  on a product the user owns (directly or via bundle). Unknown / unmapped
  cases are locked.
- `getReadyCaseCount(product)` and `getCaseCountLabel(product)` derive
  case-count copy from the actual `includedCaseIds.length`. Storefront shows
  honest copy like "1 of 5 ready" or "5 cases planned" instead of advertising
  inventory that doesn't exist.
- Locked cases show Lock icon with amber styling on IncidentBoard, redirect to Store
- **Mock billing**: the dev-mode local-grant fallback in `StoreScreen` only
  fires when both `import.meta.env.DEV` *and* `VITE_MOCK_BILLING=1`. It never
  runs in production builds, and it no longer fires on transient checkout
  errors when Stripe is genuinely configured.

### Admin & Super Admin
- Two roles on the `users` table: `is_admin` (catalog overrides + entitlement
  grants/revokes) and `is_super_admin` (everything admin can do, plus
  promote/demote other users and delete users).
- Bootstrap: emails listed in `BOOTSTRAP_SUPER_ADMIN_EMAILS` (hardcoded in
  `artifacts/api-server/src/lib/userSync.ts`) are auto-promoted to super admin
  on row creation OR on the first request where their email becomes known
  (Clerk lookup) AND they have never been promoted before. After that the
  role is fully mutable — a super admin can demote a bootstrap account and
  the demotion will stick. To add another bootstrap email, edit that constant
  and redeploy. Existing super admins can also promote others through the UI
  with no code change.
- The user row + email + role bootstrap runs lazily inside `ensureUserRow()`
  on every `/api/profile` PUT and `/api/entitlements` GET. Email is fetched
  from Clerk via `clerkClient.users.getUser`. If the Clerk lookup fails the
  request still succeeds (with email still null) — bootstrap retries on the
  next request.
- Self-protection: a super admin cannot demote or delete themselves. They can
  demote/delete any other user. Admin demotion automatically revokes super
  admin (you can't be super without being admin).
- Routes: `PATCH /api/admin/users/:id/role { isAdmin?, isSuperAdmin? }` and
  `DELETE /api/admin/users/:id`, both gated by `requireSuperAdmin`. Deletes
  cascade to user_profiles, user_entitlements, and purchases via FK.

### Cloud Sync
- CloudSyncProvider wraps app content when Clerk is available
- On sign-in: fetches profile, settings, caseStates from cloud; merges with local (newer wins by lastActiveAt)
- On changes: debounced 2s save to cloud
- On sign-out: resets entitlements to free defaults

### Case Structure
Each case has terminal commands, event logs, ticket history, evidence items, 4-tier hints, root cause evaluation, score breakdown, and full debrief.

### Case Catalog
- `data/caseCatalog/entries.ts` is the single source of truth for every case the app advertises (56 entries: 4 playable, 52 planned).
- Each `CaseCatalogEntry` carries `sourceProductId`, `requiredEntitlements`, `status` (`playable` / `planned`), `accessModel`, and preview metadata used by IncidentBoard, StoreScreen, and ProfileScreen.
- `data/caseCatalog/validation.ts` runs at app boot (via `App.tsx`) and asserts FREE_CASE_IDS ↔ `isStarter` sync, product-case derivation invariants, and that every playable entry resolves to a `CaseDefinition`.
- `data/cases/registry.ts` exports `CASE_DEFINITIONS`, the typed map keyed by case id that resolves catalog entries to runnable game logic.

### Case Authoring Framework
The framework lives at `data/cases/authoring/` and is the supported way to add new cases.

- `schema.ts` defines `CaseDraft` (author-facing shape — like `CaseDefinition` but with author-time defaults) and `AuthoringIssue` / `AuthoringResult` (validator output).
- `helpers.ts` exports composition helpers (`symptom`, `rootCause`, `evidence`, `command`, `eventLog`, `ticket`, `hintLadder`) plus `composeCase(draft)` which validates and lifts a draft into a `CaseDefinition` (or throws with actionable issues).
- `validate.ts` enforces: required identity fields, ≥2 symptoms, ≥4 evidence items, exactly 4 hint tiers with strictly increasing penalties, all `revealsEvidence` ids point at real evidence, every clue/critical evidence is reachable from at least one command/event/ticket, tool variety on advanced/expert cases, `maxScore === 100`.
- `templates.ts` exports `createTemplate(domain, opts)` for seven domains: `windows-ad`, `networking`, `servers`, `automotive`, `electronics`, `mixed`, `healthcare-imaging`. Each template returns a draft that already passes the validator with placeholder content so authors get green-on-load.

#### Reference case
All four MVP cases (`windows-ad-case.ts`, `networking-vpn-case.ts`, `automotive-case.ts`, `electronics-sensor-case.ts`) are authored through `createTemplate` + `composeCase` — no raw `CaseDefinition` literals remain in the repo. **`windows-ad-case.ts` is the canonical reference**: it shows the spread-and-override pattern, full evidence/command/event/ticket cross-referencing, and a 4-tier hint ladder. Copy it verbatim when bootstrapping a new case.

#### How to add a new case
1. Pick a catalog entry from `data/caseCatalog/entries.ts` (or add one) and note its `id` and `sourceProductId`.
2. Create a new file under `data/cases/`, e.g. `data/cases/networking-bgp-flap-case.ts`.
3. Start from a template:
   ```ts
   import { composeCase, createTemplate } from './authoring';

   const draft = createTemplate('networking', {
     id: 'case-networking-bgp-flap-001',
     slug: 'bgp-flap',
     title: 'Phantom BGP Flap',
     difficulty: 'advanced',
   });
   // Replace placeholder content on draft.symptoms / evidence / commands / etc.
   export const bgpFlapCase = composeCase(draft);
   ```
4. Register the case in `data/cases/registry.ts` so the engine can resolve it.
5. Update the catalog entry's `status` from `planned` → `playable` and set `implementationRef` to the case id.
6. The boot-time validator in `App.tsx` will fail loudly if anything is misaligned.

### MVP Cases
1. **Domain Authentication Failure** (Windows/AD) — Kerberos time skew
2. **Phantom VPN Tunnel** (Networking) — Phase 2 proxy ID mismatch
3. **Unstable Idle Ghost** (Automotive) — Failing alternator voltage regulator
4. **Mesh Network Phantom** (Electronics) — Firmware bug + degraded capacitor

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/faultline-lab run dev` — run Faultline Lab dev server
- `pnpm --filter @workspace/api-server run dev` — run API server
- `pnpm --filter @workspace/db run push` — push DB schema changes

## Design System
- Dark background: `#0a0e14`
- Accent: cyan-400 (`#22d3ee`)
- Font: JetBrains Mono (monospace terminal aesthetic)
- No emojis in UI
- Mobile-first responsive (breakpoints: sm, lg for sidebar collapse)
- Minimum 40x40px touch targets on mobile
- Terminal font default: 16px (prevents iOS auto-zoom)
