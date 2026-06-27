# Capacity Planning Application — Architecture Document

**Version:** 0.2 (Draft)
**Date:** 2026-06-19
**Companion to:** `capacity-planning-requirements.md`, `capacity-planning-data-model.md`
**Status:** In Review

---

## 1. Overview

The application is a server-rendered full-stack web app built on **Next.js**, backed by **MongoDB**, with two project modes: **manual** (EM defines scope directly in the tool) and **integrated** (scope synced from an external provider via a pluggable interface). No provider is assumed or preferred. It is organized into four distinct concerns: the client UI, the API layer, a set of internal services, and a background sync worker. The forecasting engine is identical for both modes.

---

## 2. Layer Breakdown

### 2.1 Client — React / Next.js Frontend

The frontend is a React application rendered via Next.js App Router. It communicates exclusively with the application's own API routes — it never calls ADO or MongoDB directly.

**Primary views:**
- Project Dashboard (burndown, completion date, feature status)
- Velocity Health Report (per-engineer trend, injection signals)
- Team & Engineer Management
- Sprint Calendar & PTO / Capacity Entry
- Admin Settings (provider integrations, holidays, user management)
- Manual Project Setup (epic/feature entry, story counts, progress tracking)

All views are role-gated. Component-level rendering decisions are driven by the authenticated user's role returned from the session.

### 2.2 Application Server — Next.js API Routes

The API layer is implemented as Next.js Route Handlers (`/app/api/...`). Every request passes through a shared auth middleware that validates the session and enforces role-based access before any business logic runs.

**Key route groups:**

| Route Group | Responsibility |
|---|---|
| `/api/auth/[...nextauth]` | NextAuth.js — handles SSO and local login flows |
| `/api/projects` | Project CRUD, forecast retrieval, engineer assignment |
| `/api/engineers` | Org roster management, assignment to/from projects |
| `/api/sprints` | Sprint schedule, capacity entry |
| `/api/capacity` | PTO, sick days, injection points, effective velocity |
| `/api/sync` | Manual sync trigger, sync log retrieval (integrated mode only) |
| `/api/manual` | CRUD for epics, features, and progress updates (manual mode only) |
| `/api/providers` | Browse available provider projects and epics for linking |
| `/api/admin` | Integration config, holiday calendar, user management |

The API layer is thin — it validates input, enforces auth, delegates to a service, and returns the result. No business logic lives in route handlers.

### 2.3 Service Layer

Four focused services encapsulate all business logic. Services are plain TypeScript modules — no framework dependency — making them independently testable.

**Forecast Engine**
Consumes `sprintCapacityEntries` and project scope data from MongoDB to compute the project forecast. Works identically for manual and integrated projects — the input is always `remainingPoints` and `teamVelocity` regardless of source. Outputs: `remainingPoints`, `projectedSprintsRemaining`, `projectedCompleteDate`, and RAG status. Called after every provider sync (integrated), every manual progress update (manual), and every capacity data write.

**Capacity Calculator**
Implements the velocity formula chain:
```
daily_rate         = base_velocity / sprint_working_days
planned_velocity   = daily_rate × available_days
effective_velocity = planned_velocity − injectionPoints
team_velocity      = Σ effective_velocity (all engineers)
```
Handles mid-sprint pro-rating when join/leave dates are present. Called whenever a `sprintCapacityEntry` is created or updated.

**Sprint Generator**
Takes the organization's `sprintAnchorDate` and a target date range and generates the full sprint schedule. Applies holiday exclusions, computes `totalWorkingDays` per sprint, assigns names using the `YYYY-Q{Q}-{N}` format, and enforces the sprint boundary rule (sprint belongs to quarter of its start date).

**Work Item Provider (Interface)**
Defines the contract that any work item source must fulfill:

```typescript
interface WorkItemProvider {
  getProjects(): Promise<Project[]>
  getEpics(projectId: string): Promise<Epic[]>
  getFeatures(epicId: string): Promise<Feature[]>
  getWorkItems(featureId: string): Promise<WorkItem[]>
  syncAll(projectId: string): Promise<SyncResult>
}
```

ADO is the Phase 1 implementation. Jira is a future implementation of the same interface. The sync worker and all other services reference only the interface — never the concrete implementation directly.

### 2.4 Background Sync Worker

A scheduled job that runs every 15 minutes (configurable) and can also be triggered on-demand by an EM or Admin. It is the only process that writes to the `epics`, `features`, `workItems`, and `syncLogs` collections.

**Responsibilities per sync run:**
1. Call `provider.syncAll(projectId)` for each active integration
2. Upsert epics, features, and work items (match on `externalId`)
3. Soft-delete items no longer present in provider (`isActive: false`)
4. Flag work items with `planningHealth` based on story points
5. Detect sprint boundary transitions — open new `projectSprintSnapshot`, close completed ones
6. Compute Scenario A injection metrics on closed snapshots
7. Trigger the Forecast Engine to recompute all affected projects
8. Write a `syncLog` entry with summary and status

The worker runs in a **separate Node.js process** (or serverless function, depending on deployment). It is decoupled from the API request lifecycle so a slow provider response never affects UI performance. **Manual mode projects do not involve the sync worker** — all data flows through the API layer directly.

### 2.5 Authentication — NextAuth.js

Two authentication modes are supported simultaneously:

**Azure AD SSO (primary)**
Users authenticate via Microsoft OAuth 2.0. On first login, a `user` document is created in MongoDB keyed by the Azure AD Object ID (`azureOid`). Subsequent logins look up the existing user by `azureOid`. Role assignment is managed within the application — not inherited from Azure AD groups (in Phase 1).

**Local Login (dev / fallback)**
Username and bcrypt-hashed password stored in the `users` collection. Enabled by default; can be disabled by Admin in production once SSO is verified. Provides a clean development experience without SSO configuration.

Sessions are JWT-based, with the user's `_id`, `role`, and `organizationId` encoded in the token to avoid a database roundtrip on every request.

---

## 3. Key Data Flows

### 3.1 Integrated Mode — Provider Sync Flow

```
Scheduler / Manual Trigger
        │
        ▼
  Sync Worker starts
        │
        ├─── Call Provider Interface → syncAll(projectId)
        │         │
        │         ▼
        │    Provider REST API (Jira / ADO / other)
        │    (provider-specific auth)
        │         │
        │         ▼
        │    Epics → Features → WorkItems
        │
        ├─── Upsert epics / features / workItems in MongoDB
        │    (match on externalId, preserve history)
        │    Flag workItems with planningHealth ('needs_decomposition' if ≥13pts,
        │    'at_risk' if 8pts, 'healthy' otherwise)
        │
        ├─── Sprint boundary check
        │    ├── New sprint started? → create projectSprintSnapshot (status: open)
        │    └── Sprint ended?       → close snapshot, compute injectedPoints
        │
        ├─── Trigger Forecast Engine → recompute projects.forecast
        │
        └─── Write syncLog (success / error + summary)
```

### 3.1b Manual Mode — Progress Update Flow

```
EM updates completed story count on a feature
        │
        ▼
  PUT /api/manual/features/:id
        │
        ├─── Update feature.completedStoryCount in MongoDB
        ├─── Recompute feature.completedPoints = completedStoryCount × avgStoryPoints
        ├─── Recompute epic.completedPoints (aggregate)
        ├─── Update projectSprintSnapshot if sprint is active
        │
        └─── Trigger Forecast Engine → recompute projects.forecast
             (same engine, same logic as integrated mode)
```

### 3.2 Forecast Recomputation Flow

```
Trigger (sync complete OR capacity data changed)
        │
        ▼
  Forecast Engine
        │
        ├─── Load sprintCapacityEntries for team (current + future sprints)
        │    via Capacity Calculator → effectiveVelocity per engineer per sprint
        │
        ├─── Sum → team_sprint_velocity (per sprint)
        │
        ├─── Load remaining story points
        │    integrated: from workItems (isComplete: false, scoped to project epicIds)
        │    manual: from features ((storyCount - completedStoryCount) × avgStoryPoints)
        │
        ├─── Compute sprints_to_complete = remainingPoints / avg team velocity
        │
        ├─── Map to projected completion sprint name + date
        │
        ├─── Compute RAG status (on_track / at_risk / off_track)
        │    based on drift between original baseline and current projection
        │
        └─── Write updated forecast back to projects.forecast
```

### 3.3 Dashboard Load Flow

```
User opens Project Dashboard
        │
        ▼
  GET /api/projects/:id/dashboard
        │
        ├─── Auth middleware (validate session, check role)
        │
        ├─── Read projects.forecast (cached — no recompute on read)
        │
        ├─── Read features (grouped by derivedStatus, sorted)
        │
        ├─── Read projectSprintSnapshots (injection history)
        │
        └─── Return composed response → frontend renders charts
```

All reads hit pre-computed cached fields. No live calculation on dashboard load. The result is fast, consistent reads regardless of project scale.

### 3.4 Authentication Flow

```
User visits app
        │
        ├── Has valid session? ──YES──► Load app, role-gated UI
        │
        NO
        │
        ▼
  Login page
        │
        ├── "Sign in with Microsoft" ──► Azure AD OAuth flow
        │                                       │
        │                                       ▼
        │                               NextAuth callback
        │                               upsert user by azureOid
        │                               set session (id, role, orgId)
        │
        └── Local login form ──► NextAuth credentials provider
                                 bcrypt verify
                                 set session (id, role, orgId)
```

---

## 4. Provider Abstraction Pattern

The integration layer is the key extensibility point of the system. The `WorkItemProvider` interface isolates all external API communication behind a clean contract. No provider is assumed or preferred — all are equal implementations. The sync worker, services, and API routes reference only this interface, never a concrete implementation.

```
┌─────────────────────────────────────────┐
│           WorkItemProvider              │
│           « interface »                 │
│  getProjects() → Project[]              │
│  getEpics(projectId) → Epic[]           │
│  getFeatures(epicId) → Feature[]        │
│  getWorkItems(featureId) → WorkItem[]   │
│  syncAll(projectId) → SyncResult        │
└───────────────┬─────────────────────────┘
                │ implements
    ┌───────────┴────────────┐
    │                        │
┌───▼──────────┐    ┌────────▼──────────┐
│ Jira Provider│    │  ADO Provider     │
│              │    │                   │
│              │    │                   │
│ PAT auth     │    │ OAuth 2.0         │
│ ADO v7 API   │    │ Jira REST API     │
└──────────────┘    └───────────────────┘
```

Adding a new provider in Phase 3 requires: implementing the interface, registering the provider with a `provider` enum value in the `integrations` collection, and writing the OAuth/auth setup UI. Zero changes to the Forecast Engine, Capacity Calculator, or Sprint Generator.

---

## 5. Deployment Considerations

### 5.1 Process Model

| Process | Runtime | Notes |
|---|---|---|
| Next.js App Server | Node.js / Vercel / Docker | Serves UI and API routes |
| Sync Worker | Separate Node.js process or cron-triggered serverless function | Decoupled from API — slow ADO calls never affect UI |
| MongoDB | MongoDB Atlas (recommended) or self-hosted | Replica set required for change streams (future use) |

### 5.2 Environment Variables

```
# MongoDB
MONGODB_URI=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Azure AD SSO
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=

# ADO Integration (encryption key for PAT storage)
ADO_PAT_ENCRYPTION_KEY=

# Sync Worker
SYNC_INTERVAL_MINUTES=15
```

### 5.3 Security Notes

- ADO PATs are AES-256 encrypted at rest using `ADO_PAT_ENCRYPTION_KEY`; the raw PAT is never returned to the client
- All API routes enforce role-based access server-side — role checks are not client-side only
- JWT session tokens are signed with `NEXTAUTH_SECRET`; tokens include `role` and `organizationId` to avoid per-request DB lookups
- HTTPS enforced in all environments; local dev uses HTTP only

---

## 6. Phase Delivery Map

```
Phase 1 (Core)
├── Next.js app with Azure AD SSO + local auth
├── Org engineer roster with project assignment (no teams collection)
├── Provider abstraction: ADO + Jira as equal Phase 1 implementations
├── Sprint Generator service
├── Capacity Calculator service (ptoDays + sickDays split)
├── Forecast Engine service (identical for manual and integrated)
├── Background sync worker (integrated mode; bypassed for manual)
├── Scenario A injection (automatic, snapshot-based)
├── Scenario B injection (manual, sprintCapacityEntries)
├── Project Dashboard (burndown, completion date, feature list)
└── Velocity Health Report (per-engineer, injection signals)

Phase 2 (Executive Visibility)
├── Director / VP global portfolio dashboard
├── RAG rollup view across all projects
└── ADO OAuth 2.0 (replace PAT)

Phase 3 (Extended)
├── Jira Provider (implements WorkItemProvider interface)
├── Notification service (email / Slack on forecast drift)
└── PDF / Excel export
```
