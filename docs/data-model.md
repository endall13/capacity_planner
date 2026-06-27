# Capacity Planning Application — MongoDB Data Model

**Version:** 0.3 (Draft)
**Date:** 2026-06-19
**Companion to:** `capacity-planning-requirements.md`
**Status:** In Review

---

## 1. Overview

This document defines the MongoDB collection schemas, field definitions, indexes, and inter-collection relationships for the Capacity Planning application. All collections are scoped to an `organizationId` to support future multi-tenancy. Field names use `camelCase` following JavaScript/MongoDB conventions.

---

## 2. Collection Summary

| Collection | Description |
|---|---|
| `organizations` | Top-level tenant; holds sprint anchor date, holiday calendar, global settings, and default avgStoryPoints |
| `users` | Application users (Admin, EM, PM, Director, VP) |
| `integrations` | Work item provider connection configs (ADO PAT, Jira token, etc.) |
| `engineers` | Org roster of individual contributors; assignment to a project is tracked here |
| `sprints` | Org-wide generated sprint schedule |
| `sprintCapacityEntries` | Per-sprint, per-engineer, per-project capacity record (PTO, sick days, join/leave, injection (Scenario B), adjusted velocity) |
| `projects` | Forecast units; the project IS the team — engineers are assigned directly to projects |
| `projectSprintSnapshots` | Per-sprint, per-project scope snapshot used to automatically detect and measure injected work |
| `epics` | Epics scoped to a project — synced from provider (integrated) or created by EM (manual) |
| `features` | Features within an epic — synced from provider (integrated) or created by EM (manual) |
| `workItems` | Stories, Bugs, and Spikes — integrated mode only, synced from provider |
| `syncLogs` | Audit trail of provider sync operations |

> **No `teams` collection.** The project is the team. Engineers belong to the org roster and are assigned to exactly one project at a time. See Section 5 for the design decision.

---

## 3. Collection Schemas

---

### 3.1 `organizations`

The top-level tenant record. One per deployment in Phase 1. Designed to be multi-tenant in Phase 2.

```js
{
  _id: ObjectId,

  name: String,                     // e.g. "Acme Corp Engineering"
  slug: String,                     // URL-safe identifier, unique

  // Sprint configuration
  sprintAnchorDate: Date,           // Admin-set start date for sprint generation
                                    // All sprint windows calculated from this anchor

  // Company holiday calendar
  holidays: [
    {
      date: Date,                   // Holiday date (time portion ignored)
      name: String                  // e.g. "Thanksgiving", "Christmas"
    }
  ],

  // Global settings
  settings: {
    localAuthEnabled: Boolean,      // Allow username/password login (dev/fallback)
    azureAdTenantId: String,        // Azure AD tenant ID for SSO
    syncIntervalMinutes: Number,    // Provider sync frequency, default: 15
    avgStoryPoints: Number,         // Org-wide default pts per story for manual mode (default: 5)
                                    // Empirically validated — Rick's team averaged 4.9 over 4 years
                                    // Overridable per project via projects.avgStoryPoints
  },

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ slug: 1 }  // unique
```

---

### 3.2 `users`

Application users. Engineers are NOT users — they are records in the `engineers` collection.

```js
{
  _id: ObjectId,
  organizationId: ObjectId,         // ref: organizations

  name: String,
  email: String,                    // unique within organization

  role: String,                     // enum: 'admin' | 'engineering_manager'
                                    //       | 'product_manager' | 'director' | 'vp'

  // Authentication
  authProvider: String,             // enum: 'azure_ad' | 'local'
  azureOid: String,                 // Azure AD object ID (null for local auth users)
  passwordHash: String,             // bcrypt hash (null for SSO users)

  // For engineering_manager role: projects they manage
  managedProjectIds: [ObjectId],    // ref: projects

  isActive: Boolean,
  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ organizationId: 1, email: 1 }     // unique
{ organizationId: 1, azureOid: 1 }  // sparse, for SSO lookups
{ organizationId: 1, role: 1 }
```

---

### 3.3 `integrations`

Work item provider connection configuration. Built as a provider-agnostic structure to support ADO now and Jira (or others) in future iterations without schema changes.

```js
{
  _id: ObjectId,
  organizationId: ObjectId,         // ref: organizations

  provider: String,                 // enum: 'jira' | 'ado' | others (no provider is preferred)
  displayName: String,              // e.g. "Jira - My Workspace"

  // Provider-specific config — flexible subdocument, shape varies by provider
  // Jira shape:
  // config: { siteUrl, apiTokenEncrypted, projectKeys: [String] }
  // ADO shape:
  // config: { organizationUrl, patEncrypted, adoProjectIds: [String] }
  // All tokens/secrets encrypted at rest, never returned to client
  config: Object,

  status: String,                   // enum: 'active' | 'error' | 'disconnected'
  lastSyncAt: Date,
  lastSyncStatus: String,           // enum: 'success' | 'error' | 'never'
  lastSyncError: String,            // error message if lastSyncStatus === 'error'

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ organizationId: 1, provider: 1 }
{ organizationId: 1, status: 1 }
```

---

### 3.4 `engineers`

Org roster of individual contributors. Engineers are NOT application users — they are managed by EMs. An engineer belongs to the org and is assigned to at most one project at a time. Unassigned engineers form the reserve pool.

```js
{
  _id: ObjectId,
  organizationId: ObjectId,         // ref: organizations

  name: String,

  // Project assignment — source of truth for who is on which project
  // null = available (in reserve pool)
  // set  = locked to this project; cannot be assigned elsewhere
  assignedProjectId: ObjectId | null,  // ref: projects

  // Current base velocity
  baseVelocity: Number,             // story points per full sprint (unadjusted)

  // Full velocity history — preserved when EM updates base velocity
  // Append-only: push old value here before writing new baseVelocity
  velocityHistory: [
    {
      baseVelocity: Number,
      effectiveFromSprintId: ObjectId,  // ref: sprints — which sprint this took effect
      setAt: Date,
      setByUserId: ObjectId             // ref: users
    }
  ],

  // Project assignment history — tracks all assignments over time
  projectHistory: [
    {
      projectId: ObjectId,          // ref: projects
      assignedAt: Date,
      releasedAt: Date              // null if current assignment
    }
  ],

  isActive: Boolean,                // false = engineer has left the org
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ organizationId: 1, assignedProjectId: 1 }  // roster queries: available pool + per-project team
{ organizationId: 1, isActive: 1 }
```

---

### 3.6 `sprints`

Org-wide sprint schedule, auto-generated from the organization's `sprintAnchorDate`. Sprints are created ahead of time (e.g., full year generated on setup, extended by Admin as needed).

```js
{
  _id: ObjectId,
  organizationId: ObjectId,         // ref: organizations

  name: String,                     // e.g. "2026-Q1-1" — system-generated, immutable
  year: Number,                     // e.g. 2026
  quarter: Number,                  // 1–4
  sprintIndexInQuarter: Number,     // 1-based index within the quarter

  startDate: Date,                  // sprint start (inclusive)
  endDate: Date,                    // sprint end (inclusive)

  // Computed at generation time, updated if holidays change
  totalWorkingDays: Number,         // calendar days minus weekends minus holidays
  holidays: [                       // holidays that fall within this sprint window
    {
      date: Date,
      name: String
    }
  ],

  isCurrent: Boolean,               // true for the active sprint (only one at a time)

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ organizationId: 1, name: 1 }      // unique — sprint names are immutable identifiers
{ organizationId: 1, startDate: 1 }
{ organizationId: 1, isCurrent: 1 }
```

---

### 3.7 `sprintCapacityEntries`

The core capacity record. One document per engineer per sprint. Stores planned capacity inputs and actual velocity output for historical reporting and velocity health analysis.

```js
{
  _id: ObjectId,
  organizationId: ObjectId,         // ref: organizations
  sprintId: ObjectId,               // ref: sprints
  engineerId: ObjectId,             // ref: engineers
  projectId: ObjectId,              // ref: projects (denormalized — the project this engineer is on)

  // --- Capacity Inputs: Planned absences (entered proactively, before or at sprint start) ---
  ptoDays: Number,                  // scheduled PTO / planned leave (default: 0)
                                    // entered by EM ahead of the sprint; feeds forecast immediately

  // --- Capacity Inputs: Unplanned absences (entered reactively, during or after sprint) ---
  sickDays: Number,                 // illness / emergency absences (default: 0)
                                    // entered after the fact; explains velocity variance post-sprint

  // Holidays are NOT tracked here — they are already excluded from sprint.totalWorkingDays

  // Mid-sprint join/leave (null if not applicable)
  sprintJoinDate: Date,             // engineer assigned to project mid-sprint on this date
  sprintLeaveDate: Date,            // engineer released from project mid-sprint on this date

  // --- Injection (Scenario B — manual entry by EM) ---
  // UI label: "Injection". Work consumed by the engineer that is completely outside
  // the project's scope. Invisible to the sync process — must be entered manually.
  // Examples: production hotfixes, ad-hoc stakeholder requests, cross-team work.
  // Distinct from Scenario A (scope grew): Scenario B = capacity diverted away from project.
  injectionPoints: Number,         // story points diverted (labelled "Injection" in UI, default: 0)
  injectionNote: String,           // optional context e.g. "prod hotfix", "security audit"

  // --- Computed Fields (recalculated on any input change) ---
  totalDaysOff: Number,             // ptoDays + sickDays (computed; used in velocity formula)
  availableDays: Number,            // sprint.totalWorkingDays - totalDaysOff
                                    //   - missedDaysJoiningLate - remainingDaysAfterLeaving
  plannedVelocity: Number,          // (baseVelocity / sprint.totalWorkingDays) × availableDays
  effectiveVelocity: Number,        // plannedVelocity - injectionPoints (actual forecast input)

  // --- Actuals (filled in post-sprint) ---
  actualVelocity: Number,           // story points actually completed this sprint
                                    // integrated: populated by provider sync post-sprint
                                    // manual: populated when EM updates completed story counts
                                    // null until sprint ends and data is available

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ sprintId: 1, engineerId: 1, projectId: 1 }   // unique — one entry per engineer per sprint per project
{ organizationId: 1, projectId: 1, sprintId: 1 } // project team capacity rollup queries
{ engineerId: 1, sprintId: 1 }                   // velocity health report per engineer
```

---

### 3.8 `projects`

A forecast unit within the application. Operates in either manual or integrated mode. Caches the current forecast output.

// The project IS the team. Engineers assigned to this project are the team.
// Query: engineers.find({ assignedProjectId: project._id }) → current team roster
// No teamId field — the assignment lives on the engineer, not the project.
```js
{
  _id: ObjectId,
  organizationId: ObjectId,         // ref: organizations

  name: String,                     // display name in the app

  // Project type — determines behavior in the app
  type: String,                     // enum: 'project' | 'sustaining'
                                    // 'project'   — has epics, features, forecast, RAG status
                                    // 'sustaining' — capacity bucket only (Tech Debt, Sustainment, etc.)
                                    //               no epics, no forecast, no end date
                                    //               appears in org capacity bar with Sustaining badge

  // Project mode — only applies when type === 'project'; null for sustaining
  mode: String,                     // enum: 'manual' | 'integrated' | null

  // Integrated mode only (null for manual projects)
  integrationId: ObjectId,          // ref: integrations (which provider connection)
  providerProjectId: String,        // provider's project identifier
  scopedEpicIds: [String],          // provider Epic IDs included in forecast scope

  // Manual mode only (null for integrated projects)
  // avgStoryPoints is inherited from team.avgStoryPoints at project creation
  // and can be overridden per-project if needed
  avgStoryPoints: Number,           // default: team.avgStoryPoints (typically 5)

  startSprintId: ObjectId,          // ref: sprints — when forecasting begins from

  // Project lifecycle status
  lifecycleStatus: String,          // enum: 'planned' | 'active' | 'completed'
                                    // 'planned'   — appears on Roadmap as a dashed bar; no sprints yet
                                    // 'active'    — in sprint planning; forecast engine running
                                    // 'completed' — all work done; shown in history only

  // Planned projects only — proposed window for Roadmap display
  proposedStartDate: Date,          // EM-entered; used for Roadmap bar start when lifecycleStatus = 'planned'
  proposedEndDate: Date,            // EM-entered; used for Roadmap bar end when lifecycleStatus = 'planned'
                                    // Both null when project is active (forecast.projectedCompleteDate used instead)

  // RAG health status (computed from forecast drift; active projects only)
  status: String,                   // enum: 'on_track' | 'at_risk' | 'off_track' | 'complete'

  // Cached forecast — recomputed on ADO sync or capacity change
  // Stored here to avoid recalculation on every dashboard load
  forecast: {
    totalPoints: Number,
    completedPoints: Number,
    remainingPoints: Number,
    currentTeamVelocity: Number,    // most recent sprint's team velocity
    projectedSprintsRemaining: Number,
    projectedCompleteSprintName: String,  // e.g. "2026-Q3-2"
    projectedCompleteDate: Date,
    lastCalculatedAt: Date
  },

  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ organizationId: 1, status: 1 }
{ organizationId: 1, isActive: 1 }
```

---

### 3.9 `projectSprintSnapshots`

A per-sprint, per-project record that enables automatic detection and historical tracking of injected (unplanned) scope. Created automatically at the start of each sprint via the sync process. Requires no manual input from the EM.

**How injection is calculated:**

```
injected_points = remaining_at_sprint_end - (remaining_at_sprint_start - completed_this_sprint)
```

A positive value means scope was added during the sprint. A value of zero means the plan held exactly. This is computed after each sprint ends and the ADO sync confirms final completed points.

```js
{
  _id: ObjectId,
  organizationId: ObjectId,          // ref: organizations
  projectId: ObjectId,               // ref: projects
  sprintId: ObjectId,                // ref: sprints

  // --- Captured at sprint START (before any work is done) ---
  remainingPointsAtStart: Number,    // total scoped remaining points when sprint began
  totalPointsAtStart: Number,        // total scoped points (including completed) at sprint start
  workItemCountAtStart: Number,      // number of in-scope work items at sprint start

  // --- Captured at sprint END (after ADO sync post-sprint) ---
  completedPointsThisSprint: Number, // points completed during this sprint
  remainingPointsAtEnd: Number,      // remaining points after sprint closed
  totalPointsAtEnd: Number,          // total scoped points at sprint end
  workItemCountAtEnd: Number,        // number of in-scope work items at sprint end

  // --- Computed injection metrics ---
  injectedPoints: Number,            // remaining_at_end - (remaining_at_start - completed_this_sprint)
                                     // positive = scope added, zero = plan held, negative = scope removed
  injectedWorkItemCount: Number,     // net new work items added during the sprint
  injectionRate: Number,             // injectedPoints / remainingPointsAtStart (as a decimal, e.g. 0.12 = 12%)

  // --- Snapshot status ---
  status: String,                    // enum: 'open' (sprint in progress) | 'closed' (sprint ended, metrics final)

  snapshotTakenAt: Date,             // when the sprint-start snapshot was captured
  closedAt: Date,                    // when the sprint-end metrics were finalized (null if open)
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ projectId: 1, sprintId: 1 }        // unique — one snapshot per project per sprint
{ organizationId: 1, projectId: 1, status: 1 }
{ sprintId: 1, status: 1 }           // for batch sprint-close processing
```

**Lifecycle:**
- `open` snapshot is created automatically when the sprint starts (integrated: first sync of sprint window; manual: when sprint begins)
- `closed` snapshot is finalized after the sprint ends and actuals are available
- Records are never deleted — they form the permanent injection history for the project

---

### 3.11 `epics`

Epics scoped to a project. In integrated mode, populated by provider sync (read-only). In manual mode, created and managed by the EM directly in the tool.

```js
{
  _id: ObjectId,
  organizationId: ObjectId,         // ref: organizations
  projectId: ObjectId,              // ref: projects

  source: String,                   // enum: 'manual' | 'jira' | 'ado' (no source is preferred)

  // Integrated mode fields (null for manual epics)
  integrationId: ObjectId,          // ref: integrations
  externalId: String,               // provider's work item ID
  providerProjectId: String,        // provider project identifier

  title: String,
  state: String,                    // provider state (integrated) or 'active'|'complete' (manual)

  // Aggregated from child features (recomputed on sync or manual update)
  totalPoints: Number,
  completedPoints: Number,

  lastSyncedAt: Date,               // null for manual epics
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ organizationId: 1, projectId: 1 }
{ organizationId: 1, externalId: 1, integrationId: 1 }  // sparse, integrated only
```

---

### 3.12 `features`

Features belonging to an Epic. In integrated mode, synced from the provider. In manual mode, created by the EM with a story count. This is the primary planning unit for manual projects.

```js
{
  _id: ObjectId,
  organizationId: ObjectId,         // ref: organizations
  epicId: ObjectId,                 // ref: epics
  projectId: ObjectId,              // ref: projects (denormalized for query performance)

  source: String,                   // enum: 'manual' | 'jira' | 'ado'

  // Integrated mode fields (null for manual features)
  integrationId: ObjectId,          // ref: integrations
  externalId: String,               // provider's work item ID

  title: String,
  state: String,                    // provider state (integrated) or derived (manual)

  // Manual mode fields (null for integrated features)
  storyCount: Number,               // total stories for this feature (from planning session)
  completedStoryCount: Number,      // stories completed to date (updated by EM post-sprint)

  // Points — computed differently by mode:
  // integrated: aggregated from child work items via provider sync
  // manual: storyCount × project.avgStoryPoints
  totalPoints: Number,
  completedPoints: Number,

  // Derived status for dashboard display (both modes)
  derivedStatus: String,            // enum: 'not_started' | 'in_progress' | 'complete'

  lastSyncedAt: Date,               // null for manual features
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ organizationId: 1, epicId: 1 }
{ organizationId: 1, projectId: 1 }
{ organizationId: 1, externalId: 1, integrationId: 1 }  // sparse, integrated only
```

---

### 3.13 `workItems`

Stories, Bugs, and Spikes. **Integrated mode only** — populated by provider sync, read-only in the app. Manual mode projects do not use this collection; story counts on features serve as the equivalent granularity.

```js
{
  _id: ObjectId,
  organizationId: ObjectId,         // ref: organizations
  integrationId: ObjectId,          // ref: integrations
  featureId: ObjectId,              // ref: features
  projectId: ObjectId,              // ref: projects (denormalized)

  source: String,                   // enum: 'jira' | 'ado' (never 'manual')
  externalId: String,               // provider's work item ID
  providerProjectId: String,

  type: String,                     // enum: 'story' | 'bug' | 'spike'
  title: String,
  state: String,                    // raw provider state

  // Planning health flags (evaluated on sync)
  planningHealth: String,           // enum: 'healthy' | 'at_risk' | 'needs_decomposition'
                                    // healthy: storyPoints ≤ 5
                                    // at_risk: storyPoints === 8
                                    // needs_decomposition: storyPoints >= 13
  storyPoints: Number,              // null if unestimated
  isComplete: Boolean,              // derived: true when provider state maps to a done state

  lastSyncedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ organizationId: 1, externalId: 1, integrationId: 1 }  // unique
{ organizationId: 1, featureId: 1 }
{ organizationId: 1, projectId: 1 }
{ integrationId: 1, isComplete: 1 }
{ organizationId: 1, planningHealth: 1 }  // for planning health report queries
```

---

### 3.14 `syncLogs`

Audit trail for all provider sync operations — both scheduled and manually triggered. Manual mode projects do not generate sync logs.

```js
{
  _id: ObjectId,
  organizationId: ObjectId,         // ref: organizations
  integrationId: ObjectId,          // ref: integrations

  triggeredBy: String,              // enum: 'scheduled' | 'manual'
  triggeredByUserId: ObjectId,      // ref: users (null for scheduled syncs)

  providerProjectId: String,        // which provider project was synced

  startedAt: Date,
  completedAt: Date,                // null while running

  status: String,                   // enum: 'running' | 'success' | 'error'

  summary: {
    epicsProcessed: Number,
    featuresProcessed: Number,
    workItemsProcessed: Number,
    itemsCreated: Number,
    itemsUpdated: Number,
    errors: Number
  },

  errorDetails: String              // error message or stack if status === 'error'
}
```

**Indexes:**
```js
{ organizationId: 1, integrationId: 1, startedAt: -1 }
{ organizationId: 1, status: 1 }
```

---

## 4. Collection Relationships

```
organizations
  │
  ├── users (organizationId)
  │
  ├── engineers (organizationId)              ← org roster
  │     assignedProjectId: null              ← available (reserve pool)
  │     assignedProjectId: <id>              ← locked to that project
  │
  ├── integrations (organizationId)           ← integrated mode only
  │     └── syncLogs (integrationId)
  │
  ├── sprints (organizationId)
  │
  ├── projects (organizationId)
  │     │
  │     │   "team" = engineers.find({ assignedProjectId: project._id })
  │     │
  │     ├── sprintCapacityEntries (projectId)
  │     │     ├── [sprintId → sprints]
  │     │     └── [engineerId → engineers]
  │     │
  │     ├── projectSprintSnapshots (projectId)
  │     │     └── [sprintId → sprints]
  │     │
  │     ├── mode: 'manual' ──► epics (projectId)
  │     │                           └── features (epicId) ← storyCount, completedStoryCount
  │     │
  │     └── mode: 'integrated' ──► epics (projectId, integrationId)
  │                                     └── features (epicId, integrationId)
  │                                           └── workItems (featureId, integrationId)
  │
  └── [integrations ← projects.integrationId]
```

---

## 5. Key Design Decisions

**The project is the team**
There is no `teams` collection. Engineers belong to the org roster and are assigned to exactly one project at a time via `engineer.assignedProjectId`. The "team" for any project is the live query `engineers.find({ assignedProjectId: project._id })`. When an engineer is unassigned (`assignedProjectId: null`), they appear in the reserve pool. This model enforces the one-engineer-one-project rule at the data layer and enables org-level capacity tracking: total org capacity = sum of all active engineer base velocities; assigned capacity = sum per project; reserve = difference.

**Planned vs. unplanned absences tracked separately**
`sprintCapacityEntries` splits absences into `ptoDays` (planned — entered proactively, feeds forward forecast) and `sickDays` (unplanned — entered reactively, explains velocity variance post-sprint). Holidays are not tracked here; they are pre-excluded from `sprint.totalWorkingDays` at generation time. `totalDaysOff = ptoDays + sickDays` is computed and stored for use in the velocity formula.

**`organizationId` on every collection**
Every document carries an `organizationId` as a first-class field. All queries filter on this first, ensuring clean data isolation and a clear path to multi-tenancy.

**Two distinct injection types**
The model tracks two fundamentally different injection scenarios. Scenario A (in-scope injection — new work added to the project backlog mid-sprint) is detected automatically via `projectSprintSnapshots` and requires no manual input. Scenario B (injection (Scenario B) — engineer capacity diverted to work entirely outside the project) is invisible to the sync process and is tracked via manual EM entry on `sprintCapacityEntries.injectionPoints`. Both are surfaced separately in the velocity health report so managers can distinguish between "the project grew" and "the team got pulled away."

**Computed fields stored in documents**
Fields like `plannedVelocity`, `effectiveVelocity`, `availableDays`, `forecast.*`, `totalPoints`, and `derivedStatus` are computed and stored rather than calculated at query time. This keeps dashboard reads fast at the cost of slightly more complex write logic. These fields must be recomputed whenever their inputs change.

**Provider data is append/update only**
`epics`, `features`, and `workItems` in integrated mode are written exclusively by the sync worker. No application code path updates them directly. On each sync, existing records are updated in place (matched on `externalId`) and new items are inserted. Items removed from the provider are soft-deleted (`isActive: false`) rather than hard-deleted, preserving historical forecast accuracy.

**Sprint names are immutable**
Once a sprint document is created, its `name` field is never changed. The sprint boundary rule (sprint belongs to the quarter of its start date) is applied at creation time. This prevents retroactive naming drift.

**Velocity history is append-only**
When an engineer's `baseVelocity` changes, the old value is pushed onto `velocityHistory` and the new value replaces `baseVelocity`. This preserves the historical record needed for velocity health reporting without requiring a separate audit collection.

**External IDs as strings, not ObjectIds**
Provider work item IDs (`externalId`) are stored as strings. This avoids transformation risk and keeps the values identical to what the provider returns, making debugging sync issues straightforward.

---

## 6. Forecast Recomputation Triggers

The `projects.forecast` subdocument must be recomputed whenever any of the following change:

| Trigger | Affected Fields |
|---|---|
| Provider sync completes | `remainingPoints`, `completedPoints`, `totalPoints`, `projectedCompleteDate` |
| Provider sync completes (sprint boundary crossed) | Creates / closes `projectSprintSnapshots`; computes `injectedPoints`, `injectionRate` |
| Engineer assigned to / released from project | `currentTeamVelocity`, `projectedSprintsRemaining`, `projectedCompleteDate` |
| Engineer base velocity updated | `currentTeamVelocity`, `projectedSprintsRemaining`, `projectedCompleteDate` |
| PTO days entered or changed (`ptoDays`) | `totalDaysOff`, `availableDays`, `plannedVelocity`, `effectiveVelocity` on entry; project forecast recomputed |
| Sick days entered or changed (`sickDays`) | `totalDaysOff`, `availableDays`, `plannedVelocity`, `effectiveVelocity` on entry; project forecast recomputed |
| Out-of-scope points entered or changed | `effectiveVelocity` on `sprintCapacityEntries`; project forecast recomputed |
| Mid-sprint join/leave date entered | `availableDays`, `plannedVelocity`, `effectiveVelocity` on entry; project forecast recomputed |
| Manual feature progress updated (`completedStoryCount`) | `feature.completedPoints`, `epic.completedPoints`, project `forecast.*` |
| Project scope (epics) changed | All forecast fields; new `projectSprintSnapshots` baseline captured |

Recomputation should be handled by a server-side service function invoked after any of these writes, ensuring the cached forecast is always consistent.
