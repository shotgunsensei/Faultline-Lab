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
- `artifacts/faultline-lab/src/data/cases/` — Handcrafted case definitions (4 MVP cases)
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

### Cloud Sync
- CloudSyncProvider wraps app content when Clerk is available
- On sign-in: fetches profile, settings, caseStates from cloud; merges with local (newer wins by lastActiveAt)
- On changes: debounced 2s save to cloud
- On sign-out: resets entitlements to free defaults

### Case Structure
Each case has terminal commands, event logs, ticket history, evidence items, 4-tier hints, root cause evaluation, score breakdown, and full debrief.

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
