# Faultline Lab

## Overview

Faultline Lab is a cinematic browser-based troubleshooting simulator for technical minds. Users investigate broken systems across IT infrastructure, networking, automotive diagnostics, and smart electronics. The app is a fully interactive simulation — not a quiz or static dashboard.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS v4
- **State management**: Zustand
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Persistence**: localStorage (no backend database needed for this app)
- **API framework**: Express 5 (api-server exists but not used by Faultline Lab)

## Architecture

### Frontend-only app
Faultline Lab is entirely client-side. No backend API calls are needed. All case logic, simulation, scoring, and persistence run in the browser.

### Key Directories
- `artifacts/faultline-lab/src/types/` — TypeScript domain model (CaseDefinition, CaseState, Evidence, etc.)
- `artifacts/faultline-lab/src/data/cases/` — Handcrafted case definitions (4 MVP cases)
- `artifacts/faultline-lab/src/lib/simulation.ts` — Simulation engine (command processing, evidence unlocking, scoring, debrief)
- `artifacts/faultline-lab/src/lib/persistence.ts` — localStorage persistence layer
- `artifacts/faultline-lab/src/stores/useAppStore.ts` — Zustand store managing all app state
- `artifacts/faultline-lab/src/components/` — UI components (boot screen, incident board, investigation workspace, debrief, etc.)

### Case Structure
Each case has:
- Terminal commands with realistic outputs that unlock evidence
- Event logs with expandable details that unlock evidence on expand
- Ticket history with user statements and technician notes that unlock evidence on click
- Evidence items unlocked through tool interactions (terminal, event logs, ticket history)
- 4-tier hint system with score penalties (hints persist across session resume)
- Root cause evaluation with natural language matching
- Score breakdown (diagnosis accuracy, evidence quality, remediation quality, efficiency)
- Full debrief with actual root cause, red herrings, preventative measures
- Case briefing modal shown at investigation start with a re-open button
- Replay support for solved cases (profile scores/achievements preserved)

### MVP Cases
1. **Domain Authentication Failure** (Windows/AD) — Kerberos time skew
2. **Phantom VPN Tunnel** (Networking) — Phase 2 proxy ID mismatch
3. **Unstable Idle Ghost** (Automotive) — Failing alternator voltage regulator
4. **Mesh Network Phantom** (Electronics) — Firmware bug + degraded capacitor

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/faultline-lab run dev` — run Faultline Lab dev server
