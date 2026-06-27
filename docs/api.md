# Capacity Planning Application — API Contract

**Version:** 0.2 (Draft)
**Date:** 2026-06-19
**Companion to:** `capacity-planning-requirements.md`, `capacity-planning-data-model.md`, `capacity-planning-architecture.md`
**Status:** In Review

---

## 1. Conventions

### Base URL
```
/api
```

### Authentication
Every request (except `/api/auth/*`) requires a valid session. Session is validated server-side via NextAuth.js. Requests without a valid session return `401 Unauthorized`.

### Role Enforcement
Each endpoint declares the minimum role(s) permitted to call it. Role is read from the signed JWT session token. Violations return `403 Forbidden`.

Role hierarchy for reference:
```
admin > engineering_manager > product_manager / director / vp
```

### Response Envelope
All responses follow a consistent shape:

```json
// Success
{ "data": { ... }, "meta": { ... } }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Human readable message" } }
```

### Common Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Valid session but insufficient role |
| `NOT_FOUND` | 404 | Resource does not exist or is not accessible |
| `VALIDATION_ERROR` | 422 | Request body failed validation |
| `CONFLICT` | 409 | Unique constraint or state conflict |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Pagination
List endpoints that may return large result sets accept:
```
?page=1&limit=25
```
And return a `meta` block:
```json
"meta": { "page": 1, "limit": 25, "total": 143 }
```

---

## 2. Resource Groups

| Group | Base Path | Description |
|---|---|---|
| Auth | `/api/auth` | NextAuth.js session management |
| Projects | `/api/projects` | Forecast project CRUD and dashboard data |
| Teams | `/api/teams` | Team management |
| Engineers | `/api/engineers` | Engineer records and velocity |
| Sprints | `/api/sprints` | Sprint schedule and generation |
| Capacity | `/api/capacity` | Per-sprint capacity entries (PTO, injection) |
| Velocity | `/api/velocity` | Velocity health report data |
| Manual | `/api/manual` | CRUD for epics, features, and progress tracking (manual mode only) |
| Sync | `/api/sync` | Provider sync triggers and logs (integrated mode only) |
| Providers | `/api/providers` | Browse provider projects and epics for linking |
| Admin | `/api/admin` | Org settings, integrations, users |

---

## 3. Auth

Handled by NextAuth.js. These routes are managed by the `[...nextauth]` catch-all handler.

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/auth/[...nextauth]` | NextAuth.js — handles SSO callback, local login, session, signout |

**Local login request body:**
```json
{ "email": "user@company.com", "password": "..." }
```

**Session response (available client-side via `useSession`):**
```json
{
  "user": {
    "id": "abc123",
    "name": "Rick McClure",
    "email": "rick@company.com",
    "role": "engineering_manager",
    "organizationId": "org_xyz"
  },
  "expires": "2026-04-14T00:00:00.000Z"
}
```

---

## 4. Projects

### `GET /api/projects`
List all projects accessible to the authenticated user.

**Roles:** all

**Query params:**
```
?status=on_track|at_risk|off_track|complete   (optional filter)
?teamId=<id>                                   (optional filter; EM sees own teams by default)
```

**Response:**
```json
{
  "data": [
    {
      "id": "proj_1",
      "name": "Payments Redesign",
      "teamId": "team_1",
      "teamName": "Platform Team",
      "status": "on_track",
      "forecast": {
        "remainingPoints": 142,
        "projectedCompleteDate": "2026-09-12",
        "projectedCompleteSprintName": "2026-Q3-2",
        "lastCalculatedAt": "2026-03-14T10:00:00Z"
      }
    }
  ],
  "meta": { "page": 1, "limit": 25, "total": 4 }
}
```

---

### `POST /api/projects`
Create a new project.

**Roles:** `admin`, `engineering_manager`

**Request body:**
```json
{
  "name": "Payments Redesign",
  "teamId": "team_1",
  "integrationId": "integration_1",
  "adoProjectId": "Apps RMP",
  "scopedEpicAdoIds": ["12345", "12346"],
  "startSprintId": "sprint_2026_q1_1"
}
```

**Response:** `201 Created`
```json
{ "data": { "id": "proj_2", "name": "Payments Redesign", ... } }
```

---

### `GET /api/projects/:id`
Get full project record.

**Roles:** all

**Response:**
```json
{
  "data": {
    "id": "proj_1",
    "name": "Payments Redesign",
    "teamId": "team_1",
    "integrationId": "integration_1",
    "adoProjectId": "Apps RMP",
    "scopedEpicAdoIds": ["12345"],
    "status": "on_track",
    "forecast": { ... },
    "createdAt": "2026-01-06T09:00:00Z"
  }
}
```

---

### `PUT /api/projects/:id`
Update project name, scope (epics), or team assignment.

**Roles:** `admin`, `engineering_manager`

**Request body:** (all fields optional — partial update)
```json
{
  "name": "Payments Redesign v2",
  "scopedEpicAdoIds": ["12345", "12347"]
}
```

> Changing `scopedEpicAdoIds` triggers a forecast recomputation and a new sprint snapshot baseline.

**Response:** `200 OK` — updated project record

---

### `DELETE /api/projects/:id`
Soft-delete a project (`isActive: false`). Does not delete ADO data.

**Roles:** `admin`, `engineering_manager`

**Response:** `204 No Content`

---

### `GET /api/projects/:id/dashboard`
Returns all data needed to render the project dashboard in a single request.

**Roles:** all

**Response:**
```json
{
  "data": {
    "project": {
      "id": "proj_1",
      "name": "Payments Redesign",
      "status": "on_track"
    },
    "forecast": {
      "totalPoints": 340,
      "completedPoints": 198,
      "remainingPoints": 142,
      "currentTeamVelocity": 38,
      "projectedSprintsRemaining": 3.7,
      "projectedCompleteSprintName": "2026-Q3-2",
      "projectedCompleteDate": "2026-09-12",
      "lastCalculatedAt": "2026-03-14T10:00:00Z"
    },
    "burndown": [
      {
        "sprintName": "2026-Q1-1",
        "plannedRemaining": 340,
        "actualRemaining": 340,
        "completedThisSprint": 0
      },
      {
        "sprintName": "2026-Q1-2",
        "plannedRemaining": 302,
        "actualRemaining": 308,
        "completedThisSprint": 32
      }
      // ... one entry per completed sprint + future projected entries
    ],
    "features": [
      {
        "adoId": "67890",
        "title": "Checkout Flow",
        "totalPoints": 55,
        "completedPoints": 55,
        "derivedStatus": "complete"
      },
      {
        "adoId": "67891",
        "title": "Payment Methods",
        "totalPoints": 89,
        "completedPoints": 43,
        "derivedStatus": "in_progress"
      }
    ]
  }
}
```

---

### `GET /api/projects/:id/snapshots`
Returns the full scope injection history for a project (Scenario A).

**Roles:** all

**Response:**
```json
{
  "data": [
    {
      "sprintName": "2026-Q1-2",
      "remainingPointsAtStart": 308,
      "completedPointsThisSprint": 32,
      "remainingPointsAtEnd": 290,
      "injectedPoints": 14,
      "injectedWorkItemCount": 3,
      "injectionRate": 0.045,
      "status": "closed"
    }
  ]
}
```

---

## 5. Teams

### `GET /api/teams`
List all teams.

**Roles:** all (EMs see their own teams; Admin sees all)

**Response:**
```json
{
  "data": [
    {
      "id": "team_1",
      "name": "Platform Team",
      "engineerCount": 5,
      "managerIds": ["user_1"]
    }
  ]
}
```

---

### `POST /api/teams`
Create a new team.

**Roles:** `admin`, `engineering_manager`

**Request body:**
```json
{ "name": "Platform Team" }
```

**Response:** `201 Created`

---

### `GET /api/teams/:id`
Get team detail with current engineer roster.

**Roles:** all

**Response:**
```json
{
  "data": {
    "id": "team_1",
    "name": "Platform Team",
    "managerIds": ["user_1"],
    "engineers": [
      {
        "id": "eng_1",
        "name": "Alice Chen",
        "baseVelocity": 20,
        "isActive": true
      }
    ]
  }
}
```

---

### `PUT /api/teams/:id`
Update team name or manager assignments.

**Roles:** `admin`, `engineering_manager`

**Request body:** (partial update)
```json
{ "name": "Core Platform Team" }
```

**Response:** `200 OK`

---

## 6. Engineers

### `POST /api/teams/:teamId/engineers`
Add an engineer to a team.

**Roles:** `admin`, `engineering_manager`

**Request body:**
```json
{
  "name": "Alice Chen",
  "baseVelocity": 20,
  "joinDate": "2026-01-06"
}
```

> If `joinDate` falls within the current sprint, the system automatically creates a pro-rated `sprintCapacityEntry` for that sprint.

**Response:** `201 Created`
```json
{ "data": { "id": "eng_1", "name": "Alice Chen", "baseVelocity": 20 } }
```

---

### `GET /api/engineers/:id`
Get engineer detail including velocity history.

**Roles:** `admin`, `engineering_manager`

**Response:**
```json
{
  "data": {
    "id": "eng_1",
    "name": "Alice Chen",
    "teamId": "team_1",
    "baseVelocity": 20,
    "velocityHistory": [
      { "baseVelocity": 18, "effectiveFromSprintName": "2026-Q1-1", "setAt": "2026-01-06T09:00:00Z" },
      { "baseVelocity": 20, "effectiveFromSprintName": "2026-Q2-1", "setAt": "2026-04-01T09:00:00Z" }
    ],
    "isActive": true,
    "createdAt": "2026-01-06T09:00:00Z"
  }
}
```

---

### `PUT /api/engineers/:id`
Update engineer name or base velocity.

**Roles:** `admin`, `engineering_manager`

**Request body:** (partial update)
```json
{ "baseVelocity": 22 }
```

> A velocity change is always applied from the **next sprint** forward. The previous value is appended to `velocityHistory`. Changing velocity never retroactively alters closed `sprintCapacityEntries`.

**Response:** `200 OK`

---

### `DELETE /api/engineers/:id`
Remove an engineer from their team. Requires an effective date.

**Roles:** `admin`, `engineering_manager`

**Request body:**
```json
{ "leaveDate": "2026-03-20" }
```

> If `leaveDate` falls within the current sprint, the system automatically pro-rates the engineer's `sprintCapacityEntry` for that sprint. Historical entries are preserved.

**Response:** `204 No Content`

---

## 7. Sprints

### `GET /api/sprints`
List generated sprints.

**Roles:** all

**Query params:**
```
?year=2026
?quarter=1
?includeCompleted=true   (default: true)
```

**Response:**
```json
{
  "data": [
    {
      "id": "sprint_1",
      "name": "2026-Q1-1",
      "year": 2026,
      "quarter": 1,
      "sprintIndexInQuarter": 1,
      "startDate": "2026-01-06",
      "endDate": "2026-01-17",
      "totalWorkingDays": 10,
      "holidays": [],
      "isCurrent": false
    }
  ]
}
```

---

### `POST /api/sprints/generate`
Generate the org-wide sprint schedule for a given date range. Idempotent — existing sprints are not duplicated.

**Roles:** `admin`

**Request body:**
```json
{
  "fromDate": "2026-01-01",
  "toDate": "2026-12-31"
}
```

> Uses the `organization.sprintAnchorDate` as the starting cadence reference. Applies all configured holidays automatically.

**Response:** `201 Created`
```json
{ "data": { "sprintsGenerated": 26, "sprintsSkipped": 0 } }
```

---

### `GET /api/sprints/current`
Get the currently active sprint.

**Roles:** all

**Response:** Single sprint object (same shape as list item above)

---

### `GET /api/sprints/:id`
Get a specific sprint with its full holiday list and working day calculation.

**Roles:** all

**Response:** Single sprint object

---

## 8. Capacity

### `GET /api/capacity`
Get all capacity entries for a given sprint and team. Returns planned and effective velocity per engineer.

**Roles:** `admin`, `engineering_manager`

**Query params:**
```
?sprintId=<id>    (required)
?teamId=<id>      (required)
```

**Response:**
```json
{
  "data": {
    "sprintId": "sprint_5",
    "sprintName": "2026-Q1-5",
    "teamId": "team_1",
    "totalWorkingDays": 10,
    "teamPlannedVelocity": 88,
    "teamEffectiveVelocity": 74,
    "entries": [
      {
        "engineerId": "eng_1",
        "engineerName": "Alice Chen",
        "baseVelocity": 20,
        "dailyRate": 2.0,
        "daysOff": 2,
        "sprintJoinDate": null,
        "sprintLeaveDate": null,
        "injectionPoints": 4,
        "injectionNote": "prod hotfix",
        "availableDays": 8,
        "plannedVelocity": 16,
        "effectiveVelocity": 12,
        "actualVelocity": null
      }
    ]
  }
}
```

---

### `PUT /api/capacity/:engineerId/:sprintId`
Create or update a capacity entry for a specific engineer and sprint. This is the primary write endpoint for PTO and injection (Scenario B).

**Roles:** `admin`, `engineering_manager`

**Request body:** (all fields optional — partial update)
```json
{
  "daysOff": 2,
  "injectionPoints": 4,
  "injectionNote": "prod hotfix",
  "sprintJoinDate": null,
  "sprintLeaveDate": null
}
```

> After any write, `availableDays`, `plannedVelocity`, and `effectiveVelocity` are recomputed server-side. The project forecast is then recomputed asynchronously. The response includes the updated computed values.

**Response:** `200 OK`
```json
{
  "data": {
    "engineerId": "eng_1",
    "sprintId": "sprint_5",
    "daysOff": 2,
    "injectionPoints": 4,
    "injectionNote": "prod hotfix",
    "availableDays": 8,
    "plannedVelocity": 16,
    "effectiveVelocity": 12
  }
}
```

---

## 9. Velocity

### `GET /api/velocity/health`
Returns per-engineer velocity history for the velocity health report. Covers all sprints from project start through the most recent closed sprint.

**Roles:** all

**Query params:**
```
?projectId=<id>   (required)
?engineerId=<id>  (optional — filter to single engineer)
```

**Response:**
```json
{
  "data": {
    "projectId": "proj_1",
    "sprints": ["2026-Q1-1", "2026-Q1-2", "2026-Q1-3"],
    "teamSummary": [
      {
        "sprintName": "2026-Q1-1",
        "teamPlannedVelocity": 90,
        "teamEffectiveVelocity": 82,
        "teamActualVelocity": 79,
        "teamOutOfScopePoints": 8
      }
    ],
    "engineers": [
      {
        "engineerId": "eng_1",
        "engineerName": "Alice Chen",
        "sprints": [
          {
            "sprintName": "2026-Q1-1",
            "plannedVelocity": 20,
            "effectiveVelocity": 16,
            "actualVelocity": 15,
            "daysOff": 2,
            "injectionPoints": 4,
            "variancePercent": -6.25,
            "healthStatus": "green"
          }
        ],
        "overallHealthStatus": "green"
      }
    ]
  }
}
```

---

## 10. Sync

### `POST /api/sync`
Trigger a manual provider sync for an integrated project.

> **Integrated mode only.** Manual mode projects do not have a sync — use `PUT /api/manual/features/:id` to update progress instead.

**Roles:** `admin`, `engineering_manager`

**Request body:**
```json
{
  "integrationId": "integration_1",
  "providerProjectId": "my-project-key"
}
```

**Response:** `202 Accepted` (sync runs asynchronously)
```json
{ "data": { "syncLogId": "log_99", "message": "Sync started" } }
```

---

### `GET /api/sync/logs`
List sync log entries for a given integration.

**Roles:** `admin`, `engineering_manager`

**Query params:**
```
?integrationId=<id>   (required)
?status=running|success|error
?page=1&limit=25
```

**Response:**
```json
{
  "data": [
    {
      "id": "log_99",
      "integrationId": "integration_1",
      "adoProjectId": "Apps RMP",
      "triggeredBy": "manual",
      "startedAt": "2026-03-14T10:00:00Z",
      "completedAt": "2026-03-14T10:00:22Z",
      "status": "success",
      "summary": {
        "epicsProcessed": 3,
        "featuresProcessed": 18,
        "workItemsProcessed": 124,
        "itemsCreated": 2,
        "itemsUpdated": 11,
        "errors": 0
      }
    }
  ]
}
```

---

### `GET /api/sync/logs/:id`
Get a specific sync log entry including error details.

**Roles:** `admin`, `engineering_manager`

**Response:** Single sync log object (same shape as above, with `errorDetails` field included)

---

## 11. Manual Mode

These endpoints support full CRUD for projects running in manual mode. Integrated mode projects use the sync worker instead and do not use these routes.

### `POST /api/manual/epics`
Create an Epic under a manual project.

**Roles:** `admin`, `engineering_manager`

**Request body:**
```json
{ "projectId": "proj_1", "title": "Checkout Redesign" }
```

**Response:** `201 Created`
```json
{ "data": { "id": "epic_1", "title": "Checkout Redesign", "totalPoints": 0 } }
```

---

### `PUT /api/manual/epics/:id`
Update an Epic title or state.

**Roles:** `admin`, `engineering_manager`

**Request body:** (partial update)
```json
{ "title": "Checkout Redesign v2", "state": "complete" }
```

**Response:** `200 OK`

---

### `POST /api/manual/features`
Create a Feature under a manual Epic, with an initial story count from a planning session.

**Roles:** `admin`, `engineering_manager`

**Request body:**
```json
{
  "epicId": "epic_1",
  "title": "Payment Methods",
  "storyCount": 12
}
```

> `totalPoints` is auto-calculated: `storyCount × project.avgStoryPoints`. Forecast is recomputed immediately.

**Response:** `201 Created`
```json
{
  "data": {
    "id": "feat_1",
    "title": "Payment Methods",
    "storyCount": 12,
    "completedStoryCount": 0,
    "totalPoints": 60,
    "completedPoints": 0,
    "derivedStatus": "not_started"
  }
}
```

---

### `PUT /api/manual/features/:id`
Update a feature's story count or completed story count. The primary post-sprint progress update endpoint for manual projects.

**Roles:** `admin`, `engineering_manager`

**Request body:** (partial update)
```json
{
  "storyCount": 14,
  "completedStoryCount": 6
}
```

> Any increase to `storyCount` is recorded as injected scope on the active `projectSprintSnapshot`. Points and forecast are recomputed immediately after the write.

**Response:** `200 OK`
```json
{
  "data": {
    "id": "feat_1",
    "storyCount": 14,
    "completedStoryCount": 6,
    "totalPoints": 70,
    "completedPoints": 30,
    "derivedStatus": "in_progress"
  }
}
```

---

### `DELETE /api/manual/features/:id`
Remove a feature from a manual project. Recalculates project totals and forecast.

**Roles:** `admin`, `engineering_manager`

**Response:** `204 No Content`

---

## 12. Providers

These endpoints proxy browse requests to the configured provider so the frontend can let EMs link projects without leaving the app. Integrated mode only.

### `GET /api/providers/projects`
List projects available under a configured integration.

**Roles:** `admin`, `engineering_manager`

**Query params:**
```
?integrationId=<id>   (required)
```

**Response:**
```json
{
  "data": [
    { "providerProjectId": "PRJ", "name": "My Jira Project" },
    { "providerProjectId": "PLAT", "name": "Platform" }
  ]
}
```

---

### `GET /api/providers/epics`
List Epics within a provider project.

**Roles:** `admin`, `engineering_manager`

**Query params:**
```
?integrationId=<id>          (required)
?providerProjectId=<string>  (required)
```

**Response:**
```json
{
  "data": [
    {
      "externalId": "12345",
      "title": "Checkout Redesign",
      "state": "Active",
      "totalPoints": 280
    }
  ]
}
```

---

## 13. Admin

### `GET /api/admin/organization`
Get organization settings.

**Roles:** `admin`

**Response:**
```json
{
  "data": {
    "id": "org_1",
    "name": "Acme Corp Engineering",
    "sprintAnchorDate": "2026-01-06",
    "holidays": [
      { "date": "2026-07-04", "name": "Independence Day" },
      { "date": "2026-11-26", "name": "Thanksgiving" }
    ],
    "settings": {
      "localAuthEnabled": true,
      "azureAdTenantId": "tenant-guid",
      "syncIntervalMinutes": 15
    }
  }
}
```

---

### `PUT /api/admin/organization`
Update organization settings and holiday calendar.

**Roles:** `admin`

**Request body:** (partial update)
```json
{
  "sprintAnchorDate": "2026-01-06",
  "holidays": [
    { "date": "2026-07-04", "name": "Independence Day" }
  ],
  "settings": {
    "localAuthEnabled": false
  }
}
```

> Changing `sprintAnchorDate` should only be done before sprint generation. Changing holidays triggers a recomputation of `totalWorkingDays` for all affected sprints.

**Response:** `200 OK`

---

### `GET /api/admin/integrations`
List configured work item provider integrations.

**Roles:** `admin`

**Response:**
```json
{
  "data": [
    {
      "id": "integration_1",
      "provider": "ado",
      "displayName": "ADO - Apps RMP",
      "status": "active",
      "lastSyncAt": "2026-03-14T10:00:22Z",
      "lastSyncStatus": "success"
    }
  ]
}
```

> The PAT (`config.patEncrypted`) is never returned in any response.

---

### `POST /api/admin/integrations`
Create a new integration. Validates the connection before saving.

**Roles:** `admin`

**Request body:**
```json
{
  "provider": "ado",
  "displayName": "ADO - Apps RMP",
  "config": {
    "organizationUrl": "https://dev.azure.com/myorg",
    "pat": "raw-pat-value",
    "adoProjectIds": ["Apps RMP"]
  }
}
```

> The raw PAT is encrypted server-side before storage. It is never persisted in plaintext or returned in any response.

**Response:** `201 Created` — integration record (without PAT)

---

### `PUT /api/admin/integrations/:id`
Update integration display name, ADO project list, or rotate the PAT.

**Roles:** `admin`

**Request body:** (partial update)
```json
{
  "displayName": "ADO - Main",
  "config": {
    "pat": "new-pat-value"
  }
}
```

**Response:** `200 OK`

---

### `DELETE /api/admin/integrations/:id`
Deactivate an integration. Does not delete synced ADO data.

**Roles:** `admin`

**Response:** `204 No Content`

---

### `GET /api/admin/users`
List application users.

**Roles:** `admin`

**Response:**
```json
{
  "data": [
    {
      "id": "user_1",
      "name": "Rick McClure",
      "email": "rick@company.com",
      "role": "engineering_manager",
      "authProvider": "azure_ad",
      "isActive": true,
      "lastLoginAt": "2026-03-14T08:45:00Z"
    }
  ]
}
```

---

### `POST /api/admin/users`
Create a local-auth user (dev/fallback only). SSO users are created automatically on first login.

**Roles:** `admin`

**Request body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@company.com",
  "role": "product_manager",
  "password": "initial-password"
}
```

**Response:** `201 Created`

---

### `PUT /api/admin/users/:id`
Update a user's role or active status.

**Roles:** `admin`

**Request body:** (partial update)
```json
{ "role": "director", "isActive": true }
```

**Response:** `200 OK`

---

## 14. Summary: Role × Endpoint Access

| Endpoint Group | Admin | EM | PM | Director | VP |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET /api/projects` | ✅ | ✅ own teams | ✅ | ✅ | ✅ |
| `POST/PUT/DELETE /api/projects` | ✅ | ✅ own teams | ❌ | ❌ | ❌ |
| `GET /api/projects/:id/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/projects/:id/snapshots` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/teams` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST/PUT /api/teams` | ✅ | ✅ own | ❌ | ❌ | ❌ |
| `POST /api/teams/:id/engineers` | ✅ | ✅ own | ❌ | ❌ | ❌ |
| `PUT/DELETE /api/engineers/:id` | ✅ | ✅ own | ❌ | ❌ | ❌ |
| `GET /api/sprints` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /api/sprints/generate` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/capacity` | ✅ | ✅ own | ❌ | ❌ | ❌ |
| `PUT /api/capacity/:eng/:sprint` | ✅ | ✅ own | ❌ | ❌ | ❌ |
| `GET /api/velocity/health` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /api/sync` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `GET /api/sync/logs` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `* /api/manual` | ✅ | ✅ own | ❌ | ❌ | ❌ |
| `GET /api/providers/*` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `GET/PUT /api/admin/organization` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `* /api/admin/integrations` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `* /api/admin/users` | ✅ | ❌ | ❌ | ❌ | ❌ |
