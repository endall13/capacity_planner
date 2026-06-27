# Capacity Planning Application — Claude Code Project Brief

This file is the authoritative context document for this project. Read it fully before writing any code. All design decisions have been finalized — do not deviate from the patterns defined here without flagging the change first.

---

## Project Summary

A web-based **Capacity Planning** application that helps engineering managers forecast project completion dates. It is NOT a project management tool. It does not create or manage work items. It supports two modes:

- **Manual mode** — the EM defines scope directly in the tool using a feature-level story count model (Epic → Features → story count per feature). No external integration required. This is a first-class mode, not a fallback.
- **Integrated mode** — scope is synced from an external work item provider (Jira, ADO, or any future provider) via a pluggable provider interface. No provider is assumed or preferred.

**The core value proposition:**
- Model each engineer's velocity adjusted for PTO, holidays, mid-sprint joins/leaves, and injection work (Scenario B)
- Project a completion date with a burndown chart and trendline
- Track scope injection (both automatic in-scope detection and manual injection entry (Scenario B)) over the history of a project

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Frontend | React |
| Backend | Next.js API Route Handlers |
| Database | MongoDB (via Mongoose or native driver) |
| Auth | NextAuth.js — Azure AD SSO (primary) + local credentials (dev/fallback) |
| Provider Integration | Pluggable `WorkItemProvider` interface (Jira and ADO as Phase 1 implementations) |
| Charting | Recharts |
| Language | TypeScript throughout |

---

## Design Documents

All design decisions are documented in the `/docs` folder. Read these before building any feature.

| File | Contents |
|---|---|
| `docs/requirements.md` | Full product requirements — goals, roles, feature specs, phased roadmap |
| `docs/data-model.md` | MongoDB collection schemas, indexes, relationships, design decisions |
| `docs/architecture.md` | System architecture, layer breakdown, key data flows, deployment notes |
| `docs/architecture.mermaid` | Visual architecture diagram |
| `docs/api.md` | Full API contract — all endpoints, request/response shapes, role access matrix |
| `docs/ux.md` | UX design — navigation model, all 11 screens, color system, phase scoping |
| `docs/build-plan.md` | Build plan — 7 milestones, 39 steps, acceptance criteria, risks |

---

## Repository Structure

```
/
├── CLAUDE.md                        ← you are here
├── docs/                            ← all design documents (read-only reference)
├── .env.local                       ← environment variables (never commit)
│
├── app/                             ← Next.js App Router
│   ├── (auth)/                      ← login page
│   ├── (app)/                       ← protected routes (require session)
│   │   ├── page.tsx                 ← Portfolio Dashboard (/)
│   │   ├── projects/
│   │   │   ├── new/                 ← Project Setup (manual + integrated)
│   │   │   └── [id]/
│   │   │       ├── page.tsx         ← Project Dashboard
│   │   │       └── velocity/        ← Velocity Health (EM only)
│   │   ├── roadmap/                 ← Roadmap — 12-month Gantt (all roles)
│   │   ├── engineers/               ← Engineer Roster (EM, Admin)
│   │   ├── sprints/                 ← Sprint Calendar + Capacity Wizard
│   │   └── admin/                   ← Admin Settings
│   ├── api/                         ← API route handlers
│   │   ├── auth/[...nextauth]/
│   │   ├── projects/
│   │   ├── teams/
│   │   ├── engineers/
│   │   ├── sprints/
│   │   ├── capacity/
│   │   ├── velocity/
│   │   ├── sync/
│   │   ├── manual/                  ← manual mode CRUD (epics, features, progress)
│   │   ├── providers/               ← browse provider projects/epics for linking
│   │   └── admin/
│   ├── layout.tsx
│   └── globals.css
│
├── lib/                             ← shared utilities and service layer
│   ├── db/                          ← MongoDB connection and models
│   │   ├── connection.ts            ← singleton MongoDB client
│   │   └── models/                  ← one file per collection
│   │       ├── Organization.ts
│   │       ├── User.ts
│   │       ├── Integration.ts
│   │       ├── Engineer.ts          ← org roster; assignedProjectId tracks assignment
│   │       ├── Sprint.ts
│   │       ├── SprintCapacityEntry.ts
│   │       ├── Project.ts           ← project IS the team
│   │       ├── ProjectSprintSnapshot.ts
│   │       ├── Epic.ts
│   │       ├── Feature.ts
│   │       ├── WorkItem.ts
│   │       └── SyncLog.ts
│   │
│   ├── services/                    ← business logic (no framework dependency)
│   │   ├── forecast.service.ts      ← forecast engine (works for both modes)
│   │   ├── capacity.service.ts      ← velocity calculations
│   │   ├── sprint.service.ts        ← sprint generation
│   │   ├── manual.service.ts        ← manual mode point aggregation + forecast trigger
│   │   └── sync.service.ts          ← orchestrates provider sync worker
│   │
│   ├── providers/                   ← work item provider abstraction
│   │   ├── types.ts                 ← WorkItemProvider interface
│   │   ├── ado/                     ← ADO implementation
│   │   │   ├── ado.provider.ts
│   │   │   ├── ado.client.ts        ← raw ADO REST API calls
│   │   │   └── ado.mapper.ts        ← maps ADO response → app types
│   │   └── jira/                    ← Jira implementation (Phase 1)
│   │       ├── jira.provider.ts
│   │       ├── jira.client.ts
│   │       └── jira.mapper.ts
│   │
│   ├── auth/                        ← NextAuth config
│   │   └── auth.config.ts
│   │
│   └── utils/                       ← shared helpers
│       ├── encryption.ts            ← AES-256 for credential storage
│       ├── dates.ts                 ← working day calculations, holiday helpers
│       └── api.ts                   ← response envelope helpers
│
├── components/                      ← React components
│   ├── ui/                          ← base UI components (buttons, inputs, etc.)
│   ├── charts/                      ← Recharts wrappers (burndown, velocity trend)
│   ├── projects/                    ← project dashboard components
│   ├── manual/                      ← manual mode setup and progress components
│   ├── teams/                       ← team management components
│   ├── sprints/                     ← sprint calendar components
│   └── capacity/                    ← PTO & capacity entry components
│
├── worker/                          ← background sync worker (separate process)
│   └── sync.worker.ts               ← integrated mode only; bypassed for manual projects
│
└── types/                           ← shared TypeScript types
    └── index.ts
```

---

## Data Model — Key Rules

See `docs/data-model.md` for full schemas. Critical rules to follow:

1. **Every document has `organizationId`** — always include it as the first field in every MongoDB query
2. **Computed fields are stored, not calculated at query time** — `plannedVelocity`, `effectiveVelocity`, `availableDays`, `forecast.*`, `totalPoints`, `derivedStatus` are all pre-computed and written to the DB. Recompute them after writes, never on reads
3. **Manual mode fields on Feature** — `storyCount` (total from planning session), `completedStoryCount` (updated by EM each sprint). `totalPoints = storyCount × project.avgStoryPoints`
4. **Integrated mode data is read-only from the API** — only the sync worker writes to `epics`, `features`, `workItems`. No API route touches these collections directly for integrated projects
5. **Sprint names are immutable** — once created, `sprint.name` is never changed
6. **Velocity history is append-only** — when base velocity changes, push old value to `velocityHistory`, never overwrite
7. **Credentials are never returned to the client** — strip `config.patEncrypted` (or equivalent) from all integration responses
8. **`project.mode`** is `'manual'` or `'integrated'` — gate all logic branches on this field
9. **No `teams` collection — the project is the team** — engineers belong to the org roster (`assignedProjectId: null`) and are assigned to exactly one project. Team for a project = `engineers.find({ assignedProjectId: projectId })`
10. **Absences are split into `ptoDays` and `sickDays`** on `sprintCapacityEntries` — planned absences feed forecast proactively; unplanned absences explain variance retroactively. Both feed `totalDaysOff` in the velocity formula

---

## Core Velocity Formula

This is the engine everything else is built on. Implement in `lib/services/capacity.service.ts`:

```typescript
// Step 1 — Daily rate
const dailyRate = engineer.baseVelocity / sprint.totalWorkingDays

// Step 2 — Available days (accounts for PTO + mid-sprint join/leave)
const missedDaysJoiningLate = sprintJoinDate
  ? workingDaysBefore(sprintJoinDate, sprint.startDate)
  : 0
const missedDaysLeavingEarly = sprintLeaveDate
  ? workingDaysAfter(sprintLeaveDate, sprint.endDate)
  : 0
const availableDays = sprint.totalWorkingDays - daysOff - missedDaysJoiningLate - missedDaysLeavingEarly

// Step 3 — Planned velocity
const plannedVelocity = dailyRate * availableDays

// Step 4 — Effective velocity (subtract injection — Scenario B)
const effectiveVelocity = plannedVelocity - (injectionPoints ?? 0)

// Step 5 — Team velocity = sum of all engineers' effectiveVelocity for the sprint
```

---

## Forecast Engine

Implement in `lib/services/forecast.service.ts`. The engine is **identical for both modes** — the input is always `remainingPoints` and `teamVelocity`. The mode only affects how `remainingPoints` is derived.

Called after:
- Every provider sync (integrated mode)
- Every `PUT /api/manual/features/:id` progress update (manual mode)
- Every capacity data write (both modes)

```typescript
// 1. Load all sprintCapacityEntries for team (current + future sprints)
// 2. Calculate effectiveVelocity per engineer per sprint via capacity.service
// 3. Sum to get team velocity per sprint

// 4. Load remaining points — MODE DEPENDENT:
//    integrated: sum storyPoints on workItems where isComplete: false, scoped to project epicIds
//    manual: sum (feature.storyCount - feature.completedStoryCount) × project.avgStoryPoints
//            for all features under the project's epics

// 5. Project sprint-by-sprint burn: deduct team velocity each sprint until remainingPoints <= 0
// 6. projectedCompleteDate = end date of the sprint where points reach zero
// 7. Write result back to projects.forecast
// 8. Compute RAG status based on drift from original baseline
```

---

## Manual Mode — avgStoryPoints

Manual mode uses a multiplier to convert story count → story points:

- Stored at **team level** (`teams.avgStoryPoints`, default: `5`)
- Overridable at **project level** (`projects.avgStoryPoints`)
- Empirically validated: Rick's team averaged **4.9 pts/story over 4 years** — default of 5 is well-grounded

```typescript
// Manual mode remaining points formula
const remainingStoryPoints = features
  .filter(f => f.derivedStatus !== 'complete')
  .reduce((sum, f) => sum + (f.storyCount - f.completedStoryCount) * project.avgStoryPoints, 0)
```

---

## Planning Health Rules (Integrated Mode)

Applied by the sync worker when processing work items. These are **advisory signals only** — they do not block sync or forecast.

| Story Points | `planningHealth` | Signal |
|:---:|---|---|
| ≥ 13 | `needs_decomposition` | 🔴 Story too large — needs breakdown |
| 8 | `at_risk` | 🟡 High risk in a 2-week sprint — question it |
| ≤ 5 | `healthy` | ✅ Well-estimated |

```typescript
function derivePlanningHealth(storyPoints: number): PlanningHealth {
  if (storyPoints >= 13) return 'needs_decomposition'
  if (storyPoints === 8) return 'at_risk'
  return 'healthy'
}
```

---

## Provider Interface

All work item integrations must implement this interface (`lib/providers/types.ts`). The rest of the system only references this interface — never a concrete implementation:

```typescript
interface WorkItemProvider {
  getProjects(): Promise<ProviderProject[]>
  getEpics(projectId: string): Promise<Epic[]>
  getFeatures(epicId: string): Promise<Feature[]>
  getWorkItems(featureId: string): Promise<WorkItem[]>
  syncAll(projectId: string): Promise<SyncResult>
}
```

Both Jira and ADO are equal Phase 1 implementations. Adding a new provider requires: implementing the interface, adding a `provider` enum value to `integrations`, and building the auth setup UI. Zero changes to Forecast Engine, Capacity Calculator, or Sprint Generator.

---

## Scope Injection Tracking

Two types — both are tracked, both appear in the velocity health report:

**Scenario A — In-scope (automatic)**
- Detected by the sync worker at sprint boundaries via `projectSprintSnapshots`
- Formula: `injectedPoints = remainingAtEnd - (remainingAtStart - completedThisSprint)`
- No manual entry — fully automated
- Create snapshot on sprint start, close and compute on sprint end

**Scenario B — Out-of-scope (manual)**
- Stored on `sprintCapacityEntries.injectionPoints` per engineer per sprint
- Entered by EM in the capacity entry UI alongside PTO
- Reduces `effectiveVelocity`: `effectiveVelocity = plannedVelocity - injectionPoints`
- Field names in code: `injectionPoints`, `injectionNote`
- Framing in UI: planning health signal, NOT a performance metric

---

## Authentication

Two modes — both active simultaneously in Phase 1:

**Azure AD SSO (primary)**
- NextAuth.js Azure AD provider
- On first login: create user record keyed by `azureOid`
- On subsequent logins: look up by `azureOid`, never by email

**Local (dev/fallback)**
- NextAuth.js credentials provider
- bcrypt password hashing
- Can be disabled by Admin via `organization.settings.localAuthEnabled: false`

Session JWT encodes `{ userId, role, organizationId }` — do not hit the DB on every request to fetch role.

---

## API Conventions

See `docs/api.md` for full endpoint specs. Key rules:

- All responses use the envelope: `{ data: ..., meta: ... }` for success, `{ error: { code, message } }` for errors
- Role enforcement happens in shared middleware — never inline in route handlers
- Route handlers are thin: validate → auth check → call service → return result
- `PUT /api/capacity/:engineerId/:sprintId` is an **upsert** — handles both create and update
- `POST /api/sync` returns `202 Accepted` immediately — sync is async
- Pagination: `?page=1&limit=25` on all list endpoints

---

## Roles

| Role | Key Capabilities |
|---|---|
| `admin` | Everything — integrations, users, org settings, sprint generation |
| `engineering_manager` | Teams, engineers, PTO entry, capacity, project linking, manual sync, manual mode CRUD |
| `product_manager` | Read-only — dashboards, forecasts, velocity health |
| `director` | Read-only — same as PM (Phase 2: global portfolio view) |
| `vp` | Read-only — same as Director (Phase 2: global portfolio view) |

---

## Sprint Naming

Sprints are auto-generated from `organization.sprintAnchorDate`. Do not allow manual naming.

- Format: `YYYY-Q{Q}-{N}` (e.g., `2026-Q1-1`, `2026-Q2-3`)
- Sprint belongs to the **quarter containing its start date** (boundary rule)
- All sprints are exactly 2 weeks (10 working days minus holidays)
- Generation is idempotent — safe to run multiple times

---

## Security Requirements

- Provider credentials (PATs, tokens) are AES-256 encrypted at rest using `process.env.CREDENTIAL_ENCRYPTION_KEY` — implement in `lib/utils/encryption.ts`
- Credentials are never returned in any API response — strip before returning integration records
- All role checks are server-side — session role is from signed JWT, never from client input
- HTTPS only in production

---

## Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb+srv://...

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Azure AD SSO
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=

# Credential encryption (for PATs, tokens)
CREDENTIAL_ENCRYPTION_KEY=   # 32-byte hex key

# Sync worker
SYNC_INTERVAL_MINUTES=15
```

---

## Build Order (Recommended)

Follow this sequence to build incrementally on a working foundation at each step.
See `docs/build-plan.md` for full milestone specs and acceptance criteria.

**Milestone 1 — Foundation**
1. Next.js project init with TypeScript, Tailwind, ESLint
2. MongoDB connection singleton (`lib/db/connection.ts`)
3. All Mongoose models (`lib/db/models/`) — including `lifecycleStatus`, `proposedStartDate`, `proposedEndDate` on Project
4. NextAuth setup — local credentials first, Azure AD second
5. Shared middleware (auth guard, role enforcement, org scoping, response envelope)

**Milestone 2 — Core Services**
6. `capacity.service.ts` — velocity formula (dailyRate → plannedVelocity → effectiveVelocity), unit tested
7. `sprint.service.ts` — generation, naming (`YYYY-Q{Q}-{N}`), boundary rule, holiday exclusions
8. Provider abstraction: `WorkItemProvider` interface + ADO implementation (client, mapper)
9. Jira provider implementation (same interface, Phase 1 equal to ADO)
10. `forecast.service.ts` — handles both modes; writes result to `projects.forecast`
11. `manual.service.ts` — point aggregation for manual mode, triggers forecast on update

**Milestone 3 — API Layer**
12. Admin routes (`/api/admin`) — org settings, holidays, user management
13. Engineer routes (`/api/engineers`) — org roster CRUD, assignment management
14. Sprint routes (`/api/sprints`) — schedule retrieval, current sprint
15. Capacity routes (`/api/capacity`) — upsert `sprintCapacityEntries`, triggers recompute
16. Project routes (`/api/projects`) — CRUD + dashboard aggregation endpoint
17. Velocity health endpoint (`/api/projects/:id/velocity`)
18. Roadmap endpoint (`/api/projects/roadmap`) — active + planned projects with forecast dates
19. Sync trigger + log routes (`/api/sync`) — integrated mode only
20. Manual mode routes (`/api/manual/epics`, `/api/manual/features`)
21. Provider browser routes (`/api/providers/projects`, `/api/providers/epics`)
22. Integration config routes (`/api/admin/integrations`)

**Milestone 4 — Frontend: Auth + Shell**
23. Auth pages — login form (local) + "Sign in with Microsoft" (Azure AD SSO)
24. App shell — sidebar nav, route groups, session provider, role-gated rendering

**Milestone 5 — Frontend: Core Screens**
25. Portfolio Dashboard — org capacity bar, project cards (RAG, progress, CTA), sustaining section
26. Project Dashboard — stat row, burndown chart, feature list (collapsible epics), sprint history, team panel (EM-only)
27. Sprint Capacity Wizard — 3-step (roster review → absences grid → injection grid)
28. Manual mode: Project Setup — tabular epic/feature entry, tab navigation, auto-pts calculation
29. Manual mode: Progress Update — inline `completedStoryCount` editing per feature

**Milestone 6 — Frontend: Extended Screens**
30. Engineer Roster — org capacity bar, grouped table, inline reassign dropdown
31. Sprint Calendar — quarterly groups, working day counts, holiday flags, capacity CTA
32. Roadmap — 12-month Gantt, active bars (RAG + baseline drift), planned bars (dashed), sustaining row, today line, sprint ticks
33. Velocity Health — engineer trend chart, injection history table, planning health panel (integrated only)
34. Project Setup — Integrated mode (provider link, epic scope selection)
35. Admin Settings — integrations config, holiday calendar, user management

**Milestone 7 — Background Worker**
36. Sync worker process — `syncAll()` per active integrated project
37. Sprint boundary detection — open/close `projectSprintSnapshots`, compute Scenario A injection
38. Planning health flagging on work items
39. Scheduled execution (cron, configurable interval)

---

## Phase Roadmap

```
Phase 1 (Core — this build)
├── Both project modes: manual and integrated
├── Provider abstraction: ADO + Jira as equal implementations
├── Sprint Generator service
├── Capacity Calculator service
├── Forecast Engine (identical for both modes)
├── Background sync worker (integrated mode; bypassed for manual)
├── Scope injection tracking (Scenario A + B)
├── Planning health signals (integrated mode)
├── Project Dashboard (burndown, completion date, feature list)
└── Velocity Health Report (per-engineer, injection signals)

Phase 2 (Executive Visibility)
├── Director / VP global portfolio dashboard
├── RAG rollup view across all projects
├── OAuth 2.0 upgrade for provider auth (replace PATs)
└── Collaborative remote planning board (manual mode setup via shared session)

Phase 3 (Extended)
├── Additional provider implementations (beyond ADO + Jira)
├── Notification service (email / Slack on forecast drift)
└── PDF / Excel export
```

---

## Key Libraries

```bash
npm install next react react-dom typescript
npm install mongoose                          # MongoDB ODM
npm install next-auth                         # Auth
npm install recharts                          # Charts
npm install bcryptjs                          # Password hashing
npm install zod                               # Request validation
npm install date-fns                          # Date calculations (working days, etc.)
npm install node-cron                         # Sync worker scheduling
```

---

## Non-Functional Targets

| Metric | Target |
|---|---|
| Provider sync (500 work items) | < 30 seconds |
| Dashboard load time | < 2 seconds |
| Team size | 2–5 engineers (small scale — no complex aggregation needed) |
| Concurrent users | 50+ |
| Data freshness | ≤ 15 minutes (configurable sync interval) |
| Uptime | 99.5% |
