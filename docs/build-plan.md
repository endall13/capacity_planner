# Capacity Planning Application — Build Plan

**Version:** 1.0
**Date:** 2026-06-19
**Status:** Ready to Build

---

## Overview

7 milestones, built in strict dependency order. Each milestone produces a working, deployable state — no milestone ends with broken or half-wired code. The acceptance criteria define "done" for each step; nothing advances until the criteria are met.

**Total steps: 39**

---

## Pre-Build: Dev Environment Checklist

Before writing any code:

- [ ] Node.js 20+ installed
- [ ] MongoDB Atlas cluster created (free tier is fine for dev); connection string in hand
- [ ] Azure AD app registration created (for SSO); Client ID, Secret, Tenant ID in hand
- [ ] `.env.local` created from the template in `CLAUDE.md`
- [ ] `CREDENTIAL_ENCRYPTION_KEY` generated: `openssl rand -hex 32`
- [ ] ADO PAT created with read access to target project (if testing integrated mode)
- [ ] Git repo initialized

---

## Milestone 1 — Foundation

**Goal:** Running Next.js app with database connection, all models, auth working, and shared middleware in place. Every subsequent milestone builds on this — get it right.

### Steps

**Step 1 — Project Init**
```bash
npx create-next-app@latest capacity-planner --typescript --tailwind --eslint --app
npm install mongoose next-auth bcryptjs zod date-fns node-cron recharts
npm install -D @types/bcryptjs
```

**Step 2 — MongoDB Connection**
- `lib/db/connection.ts` — singleton client, cached across hot reloads in dev
- Test: connect and log success on startup

**Step 3 — Mongoose Models**
Create one file per collection in `lib/db/models/`. Follow schemas in `docs/data-model.md` exactly.

Priority order (dependency-safe):
1. `Organization.ts`
2. `User.ts`
3. `Integration.ts`
4. `Engineer.ts`
5. `Sprint.ts`
6. `Project.ts` — include `lifecycleStatus`, `proposedStartDate`, `proposedEndDate`
7. `SprintCapacityEntry.ts`
8. `ProjectSprintSnapshot.ts`
9. `Epic.ts`
10. `Feature.ts`
11. `WorkItem.ts`
12. `SyncLog.ts`

**Step 4 — NextAuth Setup**
- `lib/auth/auth.config.ts`
- Credentials provider (local auth) first — get login working before touching Azure AD
- Azure AD provider second
- Session JWT: encode `{ userId, role, organizationId }` — no DB hit per request
- `app/api/auth/[...nextauth]/route.ts`

**Step 5 — Shared Middleware**
- `lib/middleware/auth.ts` — session validation, org scoping
- `lib/middleware/roles.ts` — role enforcement (`requireRole(role)` wrapper)
- `lib/utils/api.ts` — response envelope: `{ data, meta }` success / `{ error: { code, message } }` failure
- Apply to all API routes — no route handler does its own auth

### Done When
- [ ] `npm run dev` starts without errors
- [ ] Login page loads; local credentials auth works; session returns `role` and `organizationId`
- [ ] Azure AD SSO flow completes; user document created on first login
- [ ] All models importable without errors; MongoDB connection verified
- [ ] A test API route protected by middleware returns 401 without a session, 200 with one

---

## Milestone 2 — Core Services

**Goal:** The three computation engines (capacity, sprint, forecast) and provider abstraction are built and unit tested. These are the heart of the app — test them thoroughly before building the API on top.

### Steps

**Step 6 — Capacity Service** (`lib/services/capacity.service.ts`)

Implement the full velocity formula chain:
```
dailyRate = baseVelocity / sprint.totalWorkingDays
availableDays = totalWorkingDays - totalDaysOff - missedDaysJoiningLate - missedDaysLeavingEarly
plannedVelocity = dailyRate × availableDays
effectiveVelocity = plannedVelocity - (injectionPoints ?? 0)
```
Write unit tests covering: full sprint, partial sprint (join/leave mid-sprint), PTO, sick days, injection, combined scenarios.

**Step 7 — Sprint Service** (`lib/services/sprint.service.ts`)

- `generateSprintSchedule(anchorDate, targetYear)` — produces full year of sprints
- Sprint naming: `YYYY-Q{Q}-{N}` with boundary rule (sprint belongs to quarter of its start date)
- Holiday exclusion: reduce `totalWorkingDays` per sprint
- Idempotent: safe to regenerate — match on name, upsert
- `workingDaysBefore(date, sprintStart)` and `workingDaysAfter(date, sprintEnd)` helpers (used by capacity service)

**Step 8 — Provider Interface + ADO Implementation**

- `lib/providers/types.ts` — `WorkItemProvider` interface (see `CLAUDE.md`)
- `lib/providers/ado/ado.client.ts` — raw ADO REST API v7 calls, PAT auth (decrypt from DB)
- `lib/providers/ado/ado.mapper.ts` — ADO response → app types
- `lib/providers/ado/ado.provider.ts` — implements `WorkItemProvider`

**Step 9 — Jira Provider Implementation**

- `lib/providers/jira/jira.client.ts` — Jira REST API, OAuth 2.0
- `lib/providers/jira/jira.mapper.ts`
- `lib/providers/jira/jira.provider.ts` — implements same `WorkItemProvider` interface

**Step 10 — Forecast Service** (`lib/services/forecast.service.ts`)

```
1. Load sprintCapacityEntries → effectiveVelocity per engineer per sprint
2. Sum → teamVelocity per sprint
3. Load remainingPoints:
   - integrated: workItems where isComplete: false, storyPoints sum
   - manual: Σ (storyCount - completedStoryCount) × project.avgStoryPoints
4. Sprint-by-sprint burn until remainingPoints ≤ 0
5. projectedCompleteDate = end date of that sprint
6. RAG status from drift vs. baseline
7. Write to projects.forecast
```
Test with both manual and integrated inputs. Test RAG thresholds.

**Step 11 — Manual Service** (`lib/services/manual.service.ts`)

- `updateFeatureProgress(featureId, completedStoryCount)` — updates feature, recomputes epic totals, triggers forecast
- `createEpic(projectId, title)` / `updateEpic` / `createFeature(epicId, data)` / `updateFeature` / `deleteFeature`
- All writes trigger forecast recompute via `forecast.service`

### Done When
- [ ] `capacity.service` unit tests pass for all scenarios including edge cases
- [ ] `sprint.service` generates correct 2026 schedule; holiday exclusions reduce `totalWorkingDays`; names follow `YYYY-Q{Q}-{N}`
- [ ] ADO provider connects to a real ADO project and returns epics/features (integration test)
- [ ] Jira provider connects and returns epics/features
- [ ] `forecast.service` produces correct `projectedCompleteDate` for both modes; RAG status correct
- [ ] `manual.service` updates propagate to forecast immediately

---

## Milestone 3 — API Layer

**Goal:** All API routes built, role-gated, and returning correct data shapes per `docs/api.md`. No frontend yet — test with curl or Postman.

### Steps

**Step 12 — Admin Routes** (`/api/admin`)
- `GET/PUT /api/admin/settings` — org settings (avgStoryPoints, sprint anchor, holidays)
- `GET/POST/DELETE /api/admin/users` — user management
- Role: Admin only

**Step 13 — Engineer Routes** (`/api/engineers`)
- `GET /api/engineers` — org roster; supports `?assignedTo=projectId` filter
- `POST /api/engineers` — add engineer
- `PUT /api/engineers/:id` — update (name, title, baseVelocity, assignedProjectId)
- `DELETE /api/engineers/:id` — soft delete (`isActive: false`)
- Role: EM, Admin

**Step 14 — Sprint Routes** (`/api/sprints`)
- `GET /api/sprints` — full schedule for org
- `GET /api/sprints/current` — current sprint for org
- `POST /api/sprints/generate` — (re)generate sprint schedule from anchor date; Admin only

**Step 15 — Capacity Routes** (`/api/capacity`)
- `PUT /api/capacity/:engineerId/:sprintId` — upsert `sprintCapacityEntry`; triggers capacity + forecast recompute
- `GET /api/capacity/:projectId/:sprintId` — all entries for a project/sprint
- Role: EM only for writes

**Step 16 — Project Routes** (`/api/projects`)
- `GET /api/projects` — all active + planned projects for org
- `POST /api/projects` — create project (manual or planned)
- `GET /api/projects/:id` — project detail + forecast
- `PUT /api/projects/:id` — update (name, lifecycleStatus, proposedDates, avgStoryPoints)
- `DELETE /api/projects/:id` — archive
- `GET /api/projects/:id/dashboard` — aggregated dashboard payload (forecast + features + sprint history)
- `GET /api/projects/:id/engineers` — engineers assigned to this project

**Step 17 — Velocity Health Endpoint** (`/api/projects/:id/velocity`)
- Per-engineer velocity per sprint (last N sprints)
- Sprint injection history (Scenario A from snapshots, Scenario B from capacity entries)
- Planning health summary (integrated mode only)
- Role: EM only

**Step 18 — Roadmap Endpoint** (`/api/projects/roadmap`)
- All active projects with `forecast.projectedCompleteDate`, RAG, engineer count, baseline date
- All planned projects with `proposedStartDate`, `proposedEndDate`
- Sustaining buckets
- Role: All

**Step 19 — Sync Routes** (`/api/sync`)
- `POST /api/sync` — trigger manual sync for a project; returns `202 Accepted`
- `GET /api/sync/logs` — recent sync log entries
- Role: EM, Admin

**Step 20 — Manual Mode Routes** (`/api/manual`)
- `POST /api/manual/epics` / `PUT /api/manual/epics/:id`
- `POST /api/manual/features` / `PUT /api/manual/features/:id` / `DELETE /api/manual/features/:id`
- All writes call `manual.service` which triggers forecast

**Step 21 — Provider Browser Routes** (`/api/providers`)
- `GET /api/providers/projects` — list provider projects for org's integration
- `GET /api/providers/epics?projectId=` — list epics for a provider project

**Step 22 — Integration Config Routes** (`/api/admin/integrations`)
- `GET/POST/PUT/DELETE /api/admin/integrations`
- Credential encryption on write; strip credentials on read

### Done When
- [ ] All routes return correct shapes per `docs/api.md`
- [ ] Role enforcement verified: unauthenticated → 401, wrong role → 403, correct role → 200
- [ ] `organizationId` scoping verified: user from Org A cannot retrieve Org B data
- [ ] Capacity upsert triggers forecast recompute; `projects.forecast` updated in DB
- [ ] Manual feature update triggers forecast recompute
- [ ] Roadmap endpoint returns both active (with forecast dates) and planned (with proposed dates) projects

---

## Milestone 4 — Frontend: Auth + Shell

**Goal:** The app shell is in place — users can log in, the sidebar renders, routes are protected, and role-gated UI components work. All subsequent screens drop into this shell.

### Steps

**Step 23 — Auth Pages**
- `app/(auth)/login/page.tsx` — local credentials form + "Sign in with Microsoft" button
- Error states: wrong password, account not found, SSO failure
- Redirect to `/` after successful login

**Step 24 — App Shell**
- `app/(app)/layout.tsx` — session check, redirect to login if unauthenticated
- `components/ui/Sidebar.tsx` — nav items, active state, role-gated Admin section, user footer
- Base UI component library (`components/ui/`) — Button, Input, Card, Badge, Pill, Table, Modal shell
- Role hook: `useRole()` — returns current user's role from session; used throughout for conditional rendering

### Done When
- [ ] Login → redirect to Portfolio route
- [ ] Sidebar renders with correct nav items for EM role and for PM role (Admin section hidden for PM)
- [ ] Navigating to a protected route without a session redirects to login
- [ ] Base UI components render correctly in both states (default + active/hover)

---

## Milestone 5 — Frontend: Core Screens

**Goal:** The screens an EM uses every sprint are fully functional end-to-end. A real user can run a sprint cycle — create a project, enter scope, update capacity, and read the forecast.

### Steps

**Step 25 — Portfolio Dashboard** (`app/(app)/page.tsx`)
- Org capacity bar — segments per project + sustaining + reserve
- Project cards — RAG badge, progress bar, completion date, velocity, injection, engineer avatars, CTA
- Sustaining section
- "↻ Update Sprint" CTA links to Sprint Capacity Wizard
- "+ New Project" button

**Step 26 — Project Dashboard** (`app/(app)/projects/[id]/page.tsx`)
- Stat row (5 cards)
- Burndown chart (Recharts `LineChart`) — actual line, ideal line, current sprint shaded region, injection event markers
- Feature list — collapsible epic groups, status pills, inline edit for manual mode `completedStoryCount`
- Sprint history (right panel)
- Team — Current Sprint panel (EM only, role-gated)

**Step 27 — Sprint Capacity Wizard** (`app/(app)/sprints/[id]/capacity/page.tsx`)
- Step 1: roster review
- Step 2: absences grid — keyboard-navigable, tab-through, PTO Days + Sick Days per engineer
- Step 3: injection grid — injection pts + note per engineer
- Confirmation: summary + "Save & Close"
- On save: `PUT /api/capacity/:engineerId/:sprintId` for each row; forecast recomputes

**Step 28 — Manual Mode Project Setup** (`app/(app)/projects/new/page.tsx` with `?mode=manual`)
- Mode selection screen (Manual vs. Integrated)
- Manual: project name, `avgStoryPoints` override, engineer assignment
- Tabular epic/feature entry — tab navigation, auto-pts column, "Add Epic" / "Add Feature" row
- Submit → `POST /api/manual/epics` + `POST /api/manual/features` per row

**Step 29 — Manual Mode Progress Update**
- Entry point: Project Dashboard → Feature List → click Done count cell
- Inline edit of `completedStoryCount` per feature
- On blur/Enter: `PUT /api/manual/features/:id` → forecast recomputes → UI updates

### Done When
- [ ] EM can create a manual project end-to-end: new project → enter scope → view dashboard with forecast
- [ ] Capacity wizard saves entries; project dashboard shows updated team velocity and adjusted forecast
- [ ] Manual progress update reflects immediately in burndown and completion date
- [ ] Portfolio dashboard shows all projects with correct RAG; org capacity bar sums correctly
- [ ] Team panel on project dashboard is hidden for PM role, visible for EM

---

## Milestone 6 — Frontend: Extended Screens

**Goal:** All remaining screens fully functional. The full UX is complete.

### Steps

**Step 30 — Engineer Roster** (`app/(app)/engineers/page.tsx`)
- Summary bar with org capacity bar
- Grouped table: section per project + Sustaining + Reserve
- Inline reassign dropdown on each row
- Reassign writes `engineer.assignedProjectId`; triggers forecast recompute for affected projects

**Step 31 — Sprint Calendar** (`app/(app)/sprints/page.tsx`)
- Quarterly groups; sprint rows with dates, working days, holiday flags
- Current sprint highlighted with NOW chip + left blue border
- Capacity column: "✓ Done" / "↻ Update capacity" CTA / "—"
- Adjust Anchor Date: Admin only; regenerates schedule

**Step 32 — Roadmap** (`app/(app)/roadmap/page.tsx`)
- 12-month horizontal Gantt (`components/charts/RoadmapChart.tsx`)
- X axis: months + quarter headers
- Today line, sprint boundary ticks
- Active project bars: RAG color, progress fill, baseline drift marker
- Planned project bars: dashed outline
- Sustaining row: fading amber bar
- Window toggle: 6mo / 12mo / 18mo
- "+ Plan Project" panel: name, proposed dates, tentative engineer count

**Step 33 — Velocity Health** (`app/(app)/projects/[id]/velocity/page.tsx`)
- Engineer velocity trend chart (Recharts `LineChart`, one line per engineer, dashed baseline)
- Sprint injection history table with stacked bars
- Planning health panel (integrated mode only): summary counts + at-risk item list
- EM-only gate: redirect non-EM roles to `/projects/:id`

**Step 34 — Integrated Mode Project Setup**
- Provider link: select integration, browse provider projects, select epics to scope
- `POST /api/projects` with `mode: 'integrated'`; stores `providerProjectId` and `scopedEpicIds`
- Triggers initial sync on creation

**Step 35 — Admin Settings** (`app/(app)/admin/`)
- Integrations: add/edit/delete ADO + Jira connections (credential entry, connection test)
- Holiday calendar: add/remove org holidays; sprint schedule regenerates on save
- User management: invite users, assign roles
- Org settings: `avgStoryPoints` default, sprint anchor date

### Done When
- [ ] Engineer can be reassigned from the Roster; affected project forecasts update
- [ ] Sprint Calendar shows correct schedule with holiday flags; Capacity CTA works
- [ ] Roadmap renders all active and planned projects; today line correct; baseline drift visible on slipped projects
- [ ] Velocity Health trend chart accurate against DB data; injection history matches capacity entries + snapshots
- [ ] Admin can add an ADO integration; connection test succeeds; PAT stored encrypted, never returned
- [ ] Full role matrix verified: PM can view all screens, cannot write; EM can write; Admin can configure

---

## Milestone 7 — Background Worker

**Goal:** Integrated mode projects sync automatically. Sprint boundaries are detected. Scenario A injection is computed. Forecast stays fresh without manual trigger.

### Steps

**Step 36 — Sync Worker Process** (`worker/sync.worker.ts`)
- Loads all active integrated projects for all orgs
- Calls `provider.syncAll(projectId)` per project (via `WorkItemProvider` interface)
- Upsert epics, features, workItems (match on `externalId`)
- Soft-delete removed items (`isActive: false`)

**Step 37 — Sprint Boundary Detection**
- On each sync: compare current date to sprint schedule
- New sprint started → create `projectSprintSnapshot` (`status: 'open'`, capture current `remainingPoints`)
- Sprint ended → close snapshot, compute `injectedPoints = remainingAtEnd - (remainingAtStart - completedThisSprint)`
- Trigger forecast recompute after snapshot close

**Step 38 — Planning Health Flagging**
- On each work item upsert: compute `planningHealth` from `storyPoints`
  - `≥ 13` → `needs_decomposition`
  - `8` → `at_risk`
  - `≤ 5` → `healthy`
- Write `syncLog` entry with summary stats

**Step 39 — Scheduled Execution**
- `node-cron` scheduler in worker process: runs every `SYNC_INTERVAL_MINUTES` (default 15)
- Manual trigger: `POST /api/sync` enqueues an immediate run
- Worker process decoupled from API — slow provider calls never affect UI response time
- Deploy as separate process (or serverless cron function on Vercel)

### Done When
- [ ] Worker runs on schedule; `syncLogs` collection populated with results
- [ ] Work items updated in DB after sync; soft-deletes working
- [ ] Sprint snapshot created on sprint open; closed and `injectedPoints` computed on sprint end
- [ ] Planning health flags set correctly on all work items
- [ ] Manual trigger (`POST /api/sync`) initiates immediate run; response is `202 Accepted`
- [ ] Project dashboard reflects synced data within 15 minutes without manual refresh

---

## Phase 1 Complete — Definition of Done

All 39 steps complete and:

- [ ] An EM can run a full sprint cycle for a **manual** project: create → scope → sprint capacity → progress update → forecast updated
- [ ] An EM can run a full sprint cycle for an **integrated** project: link provider → sync → capacity entry → forecast updated automatically
- [ ] Portfolio Dashboard shows all projects with correct RAG, capacity bar accurate
- [ ] Roadmap shows 12-month view with active projects (forecasted) and planned projects (proposed)
- [ ] Velocity Health shows per-engineer trend and injection history
- [ ] All role restrictions verified across all screens
- [ ] `organizationId` data isolation verified — no cross-org data leakage
- [ ] Provider credentials encrypted at rest, never returned in API responses
- [ ] Non-functional targets met: dashboard load < 2s, sync < 30s for 500 work items

---

## Phase 2 Preview (Not in scope for this build)

- Director / VP global portfolio view (RAG rollup across all projects)
- OAuth 2.0 for provider auth (replace PATs)
- Collaborative remote planning board for manual mode setup
- Paste import for manual mode (MetroRetro / Excel paste → table)

---

## Key Dependencies & Risks

| Risk | Mitigation |
|---|---|
| Azure AD SSO config complexity | Build and verify local auth first; SSO is additive |
| ADO / Jira API rate limits during sync | Batch requests; write `syncLog` errors; retry with backoff |
| Forecast accuracy with sparse capacity data | Forecast engine falls back to `baseVelocity` when no capacity entries exist |
| Sprint boundary edge cases (holidays, quarter crossings) | Sprint service unit tests cover all boundary conditions before any API work |
| Credential encryption key rotation | Key is env var only; document rotation procedure before go-live |
