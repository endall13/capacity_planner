# Capacity Planning Application — Product Requirements Document

**Version:** 0.2 (Draft)
**Date:** 2026-06-19
**Author:** Engineering (collaborative draft)
**Status:** In Review

---

## 1. Overview

This document defines the requirements for a web-based **Capacity Planning** application built to help engineering managers forecast project completion dates based on team velocity and available capacity. The application is not a project management tool — it supports two modes: **integrated mode**, where work item data is synced from an external system (Jira, ADO, or others), and **manual mode**, where the EM defines project scope directly in the tool using a feature-level story count model. In both modes, the forecasting engine is identical.

---

## 2. Goals & Non-Goals

### Goals
- Provide engineering managers with an accurate project forecast based on story points and team velocity
- Support **manual mode** — EM defines scope directly in the tool using a feature-level story count model; no external system required
- Support **integrated mode** — connect to any supported work item provider (Jira, ADO, others) via a pluggable provider architecture; no single provider is assumed or preferred
- Model individual engineer velocity adjusted for PTO, sick days, and holidays to produce reliable sprint-level capacity projections
- Surface project health through burndown charts, projected completion dates, and velocity trend analysis
- Flag planning health issues (over-sized stories) automatically in integrated mode
- Support multiple managers, teams, and concurrent projects within a single application instance
- Deliver role-appropriate views for engineering managers, product managers, and executive stakeholders

### Non-Goals
- Creating or managing work items in external systems — the tool reads from them, never writes back
- Tracking time or acting as a time-sheet system
- Replacing Jira, ADO, or any project management tool
- HR or PTO system integration (manual entry only, in this version)
- Real-time collaborative planning board (deferred to Phase 2)

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React / Next.js (App Router) |
| Backend / API | Next.js API Routes |
| Database | MongoDB |
| Auth | NextAuth.js — Azure AD SSO (primary) + local credentials (dev/fallback) |
| External Integration | Pluggable provider interface — Jira, ADO, and others as equal implementations |
| Charting | To be determined (recommend Recharts or Chart.js) |
| Hosting | To be determined |

---

## 4. Roles & Permissions

### 4.1 Role Definitions

| Role | Description |
|---|---|
| **Admin** | Configures the application: manages ADO integration, user accounts, global settings, and company holiday calendars |
| **Engineering Manager (EM)** | Primary operator. Manages teams, engineer rosters, sprint calendars, PTO entry, and project forecasting |
| **Product Manager (PM)** | Read-only. Views project dashboards, feature status, and forecast reports. Does not enter data in this tool |
| **Director** | Read-only. Views project and team dashboards. Phase 2: access to global portfolio rollup view |
| **VP** | Read-only. Phase 2: global portfolio view showing all projects and health status across the organization |

### 4.2 Permission Matrix

| Capability | Admin | EM | PM | Director | VP |
|---|:---:|:---:|:---:|:---:|:---:|
| Manage ADO integration | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage users & roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configure holiday calendar | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create / manage teams | ✅ | ✅ | ❌ | ❌ | ❌ |
| Add / remove engineers | ✅ | ✅ | ❌ | ❌ | ❌ |
| Set engineer base velocity | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configure sprints | ✅ | ✅ | ❌ | ❌ | ❌ |
| Enter PTO / days off | ✅ | ✅ | ❌ | ❌ | ❌ |
| Link ADO project to forecast | ✅ | ✅ | ❌ | ❌ | ❌ |
| View project dashboards | ✅ | ✅ | ✅ | ✅ | ✅ |
| View velocity health reports | ✅ | ✅ | ✅ | ✅ | ✅ |
| View global portfolio (Phase 2) | ✅ | ❌ | ❌ | ✅ | ✅ |

---

## 5. Core Data Model

### 5.1 Key Entities

**Organization**
The top-level tenant. All data is scoped to an organization. Supports multi-team usage within a single deployment.

**ADO Integration Config**
Stores connection details for the ADO provider: organization URL, personal access token (PAT) or OAuth credentials, and a mapping of ADO projects to application projects. The integration layer is designed as a **provider abstraction**, allowing future connectors (Jira, etc.) to be added without changes to the core forecasting engine.

**Project**
A forecast unit within the application. A project maps to one or more ADO Epics within an ADO Project (e.g., "Apps RMP"). Each project is assigned to a team and has an associated sprint schedule.

**Team**
A named group of engineers managed by one or more Engineering Managers. Team composition is dynamic — engineers can be added or removed at any time. Changes to team composition take effect from the next sprint.

**Engineer**
An individual contributor with a configured **base velocity** expressed in story points per sprint. Engineers belong to one team. Each engineer maintains a history of sprint velocity (planned vs. actual) used to power velocity health reporting.

**Sprint**
A defined time-box (default: 2 weeks / 10 working days) associated with a team. Sprints have a start date, end date, and a computed number of available working days (accounting for company holidays). Sprints are configured per team within the application.

**Sprint Capacity Entry**
A per-sprint, per-engineer record capturing: days off (PTO, sick days), and optionally a sprint join date or leave date for engineers who are added or removed mid-sprint. Used as input to the adjusted velocity calculation. All three variables feed into the effective available days computation for that sprint.

**Work Item (synced from ADO)**
Story, Bug, or Spike records synced from ADO. Each item carries: ADO ID, type, title, parent feature, parent epic, story points, and current state. Work items are not edited within this application.

**Feature (synced from ADO)**
ADO Features, each belonging to an Epic. Features aggregate the story points of their child work items and carry a computed status based on child item states.

**Epic (synced from ADO)**
Top-level scope containers synced from ADO. Epics aggregate story points across all child features and work items and represent the broadest scope of a project forecast.

---

## 6. Capacity & Forecasting Engine

### 6.1 Velocity Model

Each engineer's sprint contribution is calculated as follows:

```
engineer_daily_rate      = base_velocity / sprint_working_days
available_days           = sprint_working_days - days_off - missed_days_if_joined_late - missed_days_if_left_early
planned_velocity         = engineer_daily_rate × available_days
effective_velocity       = planned_velocity - injectionPoints
team_sprint_velocity     = Σ (all engineers' effective_velocity)
```

**Standard example (PTO only):**
- Base velocity: 20 sp/sprint
- Sprint working days: 10
- Days off (PTO): 2
- Daily rate: 20 / 10 = 2 pts/day
- Adjusted velocity: 2 × (10 - 2) = **16 sp for that sprint**

**Mid-sprint join example:**
- Engineer joins on day 4 of a 10-day sprint (6 days remaining)
- Base velocity: 20 sp/sprint → daily rate: 2 pts/day
- Adjusted velocity: 2 × 6 = **12 sp for that sprint**

**Mid-sprint removal example:**
- Engineer exits on day 3 of a 10-day sprint (3 days contributed)
- Base velocity: 20 sp/sprint → daily rate: 2 pts/day
- Adjusted velocity: 2 × 3 = **6 sp for that sprint**

### 6.2 Forecast Calculation

**Integrated mode:**
```
remaining_story_points  = total scoped points - completed points (from provider sync)
sprints_to_complete     = remaining_story_points / team_sprint_velocity
projected_complete_date = end of (current sprint + sprints_to_complete)
```

**Manual mode:**
```
remaining_story_points  = (total stories - completed stories) × avg_story_points
sprints_to_complete     = remaining_story_points / team_sprint_velocity
projected_complete_date = end of (current sprint + sprints_to_complete)
```

The forecast engine is identical in both modes. The only difference is the source of `remaining_story_points`. The forecast is recalculated on each provider sync (integrated) or each manual update (manual), and whenever capacity data changes.

### 6.3 Trendline

The burndown trendline is computed using a linear regression over actual completed story points per sprint. This allows the forecast to reflect real team performance rather than relying solely on the configured base velocity, and surfaces drift early when actuals deviate from plan.

---

## 7. Work Item Integrations

### 7.1 Project Modes

A project operates in one of two modes, selected at creation time:

**Manual mode** — No external system required. The EM defines scope directly in the tool: creates epics and features, enters a story count per feature, and updates progress sprint-by-sprint. Points are calculated as `storyCount × avgStoryPoints`. The sync worker is not involved.

**Integrated mode** — Work item data is synced from an external provider (Jira, ADO, or others). The tool reads story points and completion state from the provider automatically. The EM does not enter scope manually.

### 7.2 Provider Architecture

The integration layer is built as a **pluggable provider interface**. No provider is assumed or preferred — all are equal implementations of the same contract:

- `getProjects()` — list available projects/workspaces
- `getEpics(projectId)` — list epics within a project
- `getFeatures(epicId)` — list features under an epic
- `getWorkItems(featureId)` — list stories/bugs/spikes with story points and state
- `syncAll(projectId)` — full incremental sync for a project

Supported providers are configured by Admin. The Phase 1 release ships with whichever provider(s) the team needs. Additional providers are added as implementations of the same interface with no changes to the forecasting engine.

### 7.3 Work Item Hierarchy

All providers map to the same internal hierarchy:

```
Provider Project
  └── Epic
        └── Feature
              └── Work Item (Story | Bug | Spike)  ← story points live here
```

### 7.4 Sync Strategy

- **Scheduled sync:** Background job runs at a configurable interval (default: every 15 minutes)
- **Manual sync:** EM or Admin can trigger an on-demand sync from the project settings UI
- **Sync log:** Each sync records timestamp, items updated, and any errors, visible to Admin and EM
- **Data ownership:** The external provider is the system of record. The application stores a local copy in MongoDB and never writes back to the provider

### 7.5 Provider Authentication

Each provider uses its own authentication mechanism configured by Admin:

| Provider | Auth Method |
|---|---|
| Jira | OAuth 2.0 or API Token |
| ADO | Personal Access Token (PAT), encrypted at rest |
| Others | Defined per provider implementation |

> **Application login** uses Azure AD SSO (primary) with local username/password as a dev/fallback option. Local login can be disabled by Admin in production.

---

## 8. Feature Specifications

### 8.1 Project Dashboard

The primary view for Engineering Managers, Product Managers, and stakeholders. Each project has its own dashboard.

**Projected Completion Date**
A prominently displayed date showing when the current scope of work is expected to be complete based on the forecast engine. Displays the underlying assumptions (remaining points, current team velocity) in a tooltip or expand panel.

**Project Burndown Chart**
A sprint-by-sprint area or line chart showing:
- Planned burndown (ideal straight-line from total points to zero)
- Actual burndown (completed points per sprint, updated on each sync)
- Forecast trendline (linear regression over actuals, projecting to zero)
- Projected completion sprint/date marked on the chart

**Feature Status List**
A tabular listing of all features scoped to the project, showing:
- Feature name
- Total story points (integrated: from provider; manual: storyCount × avgStoryPoints)
- Completed story points
- Remaining story points
- Percentage complete
- Status (Not Started / In Progress / Complete)

Features are sortable and filterable by status. In manual mode, the EM can update completed story counts directly from this view.

### 8.2 Velocity Health Report

Accessible as a drill-down from the project dashboard. Provides per-engineer and team-level velocity analysis to help managers gauge forecast reliability.

**Engineer Velocity Over Time**
A chart (line or bar) showing each engineer's planned vs. actual velocity per sprint over the project history. Helps identify:
- Consistent performers vs. high-variance engineers
- Impact of PTO and unplanned absence on actuals
- Engineers whose base velocity may need recalibration

**Team Velocity Trend**
Aggregate team velocity (planned vs. actual) per sprint with a trendline. A flat or declining trend is an early warning that the forecast completion date may slip.

**Variance Indicator**
A simple health signal per engineer: Green (actuals within 10% of planned), Amber (10–25% variance), Red (>25% variance). Helps managers quickly identify where the forecast risk is concentrated.

**Planning Health Rules (Integrated Mode)**
During each provider sync, work items are inspected against the following rules and flagged in the velocity health report:

| Rule | Threshold | Indicator | Meaning |
|---|---|---|---|
| Needs decomposition | Story points ≥ 13 | 🔴 | Story not understood well enough or not broken down sufficiently |
| Review for risk | Story points = 8 | 🟡 | Substantial risk in a 2-week sprint; EM should question and consider splitting |
| Healthy | Story points ≤ 5 | ✅ | Within expected Fibonacci range |

These are advisory flags — they do not block the forecast. They are surfaced per work item and summarized at the feature and project level. Valid point values for a healthy backlog: **1, 2, 3, 5** (and 8 with caution).

**Out-of-Scope Injection Rate (Scenario B)**
A per-engineer, per-sprint chart showing points diverted to work outside the project. Distinct from in-scope injection — this signal answers "how often is this team getting pulled away from project work?" Displayed as points and as a percentage of planned velocity. High or recurring injection (Scenario B) from specific engineers is a signal for the EM to address at an organizational or prioritization level — not an individual performance judgement.

**Scope Injection History**
A per-sprint chart and table showing how much unplanned scope was added to the project during each sprint. Injection is detected automatically by comparing the project's remaining story points at sprint start vs. sprint end (after accounting for completed work) — no manual entry required.

Displays:
- Injected points per sprint over the project lifetime
- Injection rate per sprint (`injected_points / remaining_points_at_sprint_start`)
- Cumulative injection trend line (is planning discipline improving or degrading over time?)
- Count of net new work items added per sprint

This view is intentionally framed as a **planning health signal**, not an individual performance metric. It helps Engineering Managers and Product Managers identify whether scope is being adequately defined before sprints begin and whether the estimation/planning process is maturing over the course of the project.

### 8.3 Team Management

Engineering Managers can:
- Create and name teams
- Set the team's **average story points** (`avgStoryPoints`) — the historical average story point value per work item for this team. Default: **5**. Used as the multiplier in manual mode forecasting (`storyCount × avgStoryPoints = total points`). Should be updated over time as the team's actual average matures
- Add engineers to a team with a configured base velocity (story points per sprint)
- Edit an engineer's base velocity (takes effect from the next sprint; historical values are preserved)
- Remove engineers from a team
- Add or remove engineers **mid-sprint**, specifying the effective date — the system automatically pro-rates that engineer's capacity contribution for the affected sprint based on available working days
- View team composition history, including mid-sprint changes and their capacity impact

> Engineers do not have application accounts. They are data records created and managed entirely by Engineering Managers. Only Admin and EM roles log into the application.

### 8.4 Sprint Configuration

Sprint configuration is managed at the **organization level** by an Admin, ensuring all teams operate on a consistent cadence:

- Admin sets the organization-wide sprint start date (the anchor date from which all sprint windows are calculated)
- All sprints are fixed at **2 weeks (10 working days)**; this is not configurable per team
- All teams share the same sprint cadence — sprints are aligned org-wide
- Sprint names are **auto-generated** by the system using the format `YYYY-Q{Q}-{N}`, where `Q` is the calendar quarter (1–4) and `N` is the sprint index within that quarter (e.g., `2026-Q1-1`, `2026-Q1-2`, `2026-Q2-1`)
- A quarter contains 6 sprints (with occasional 7-sprint quarters depending on calendar alignment); the system handles this automatically
- **Sprint boundary rule:** When a sprint window straddles a quarter boundary, it belongs to the quarter containing its **start date** (e.g., a sprint starting March 30 is `2026-Q1-6`, not `2026-Q2-1`). This ensures sprint names are deterministic and assigned at sprint creation time, never retroactively changed
- Company-wide holidays are configured by Admin and applied globally to all sprint working day calculations
- EMs can view the full generated sprint schedule and each sprint's available working days

### 8.5 PTO & Capacity Entry

For each sprint, Engineering Managers can:
- Enter days off per engineer (PTO, sick days, leave)
- Enter **injection points** per engineer — story points consumed by work entirely outside the project's ADO scope (e.g., production hotfixes, ad-hoc cross-team requests, unplanned support work). An optional note field allows the EM to record brief context. Defaults to zero if not entered
- View the planned velocity and effective velocity for each engineer, and the resulting team sprint velocity
- See the real-time impact of all capacity entries on the projected completion date

> **Scenario A vs. Scenario B injection:** In-scope scope growth (new stories added to the project's backlog mid-sprint) is tracked automatically via sprint snapshots and requires no manual entry. Out-of-scope capacity diversion is invisible to the provider sync and must be entered manually by the EM. Both are surfaced separately in the velocity health report.

### 8.6 Manual Mode — Project Setup & Progress Tracking

When a project is created in manual mode, the EM defines the full scope inside the tool:

**Project setup:**
- Create one or more Epics
- Under each Epic, create Features with a name and an initial story count (the output of a planning session)
- Points are auto-calculated: `storyCount × team.avgStoryPoints`
- Total project points and forecast are calculated immediately on save

**Sprint progress tracking:**
- After each sprint, the EM updates the completed story count per feature
- The burndown and forecast recalculate automatically
- No individual story records are needed — feature-level tracking is the granularity

**Editing scope:**
- Features and story counts can be updated at any time to reflect scope changes
- Any increase in story count is recorded as injected scope for planning health tracking

### 8.7 Integration Project Setup

For integrated mode projects, Engineering Managers can:
- Select a configured provider and browse its available projects
- Select one or more Epics to scope the forecast
- Trigger a manual sync at any time
- View sync status and history
- Update the scoped epics as project scope evolves

---

## 9. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Provider sync latency | < 30 seconds for full project sync (up to 500 work items) |
| Dashboard load time | < 2 seconds on a standard broadband connection |
| Team size | 2–5 engineers per team; standard MongoDB indexing is sufficient at this scale |
| Concurrent users | Support at least 50 concurrent users without degradation |
| Data freshness | Forecast reflects provider state within 15 minutes (configurable sync interval) |
| Security | Provider tokens encrypted at rest; HTTPS enforced; role-based access enforced server-side |
| Availability | 99.5% uptime target |
| Browser support | Latest 2 versions of Chrome, Firefox, Edge, Safari |

---

## 10. Phased Roadmap

### Phase 1 — Core (Current Scope)
- Provider-agnostic integration architecture (pluggable interface; ship with provider(s) needed)
- **Manual mode** — feature-level scope entry, story count × avgStoryPoints, sprint progress tracking
- Team and engineer management with base velocity and avgStoryPoints configuration
- Sprint calendar with holiday support
- Per-sprint PTO / capacity entry (PTO, injection (Scenario B))
- Forecast engine (day-rate adjusted velocity rollup, identical for manual and integrated modes)
- Project dashboard (completion date, burndown chart, feature status list)
- Velocity health report (per-engineer trend, variance indicator, planning health rules, injection signals)
- Roles: Admin, Engineering Manager (read-write), Product Manager / Director / VP (read-only)

### Phase 2 — Collaboration & Executive Visibility
- **Remote collaborative planning board** — sticky note style session for distributed teams; multi-user real-time feature/story breakdown that feeds directly into a manual mode project
- Global portfolio dashboard for Director / VP roles (RAG status, completion dates across all projects)
- Provider OAuth 2.0 support where applicable
- Configurable sync intervals per project
- avgStoryPoints auto-calibration suggestion based on historical actuals

### Phase 3 — Extended Integrations & Intelligence
- Jira integration (first alternative provider implementation)
- Automated velocity recalibration suggestions based on historical actuals
- Email / Slack notifications for forecast drift beyond a configurable threshold
- Export: PDF / Excel report generation for project dashboards
- Audit log for capacity and forecast changes

---

## 11. Open Questions

| # | Question | Owner | Status | Notes |
|---|---|---|---|---|
| 1 | Authentication provider — SSO (Azure AD / Google) or username/password? | Admin / Stakeholder | ✅ Resolved | Azure AD SSO as primary auth. Local username/password login also supported for development and fallback. Admin can disable local login in production |
| 2 | Is a single ADO PAT scoped org-wide, or does each ADO Project require its own credential? | Admin | ✅ Resolved | One PAT per ADO organization; scoped to cover all projects within that org |
| 3 | Should engineers have login access, or are they data records managed entirely by EMs? | EM / Stakeholder | ✅ Resolved | Engineers are data records only — no application accounts. EMs manage all engineer data |
| 4 | How should the app handle mid-sprint team composition changes (engineer joins or leaves)? | EM | ✅ Resolved | Mid-sprint add/remove is fully supported with pro-rated capacity based on effective date. See Section 6.1 |
| 5 | Should velocity health variance thresholds (10% / 25%) be configurable per org? | EM | ✅ Resolved | Hardcoded in Phase 1. Configurable thresholds deferred to Phase 2 |
| 6 | What is the expected maximum number of engineers per team? Projects per org? | EM | ✅ Resolved | Engineers per team: min 2, max 5. Projects per org: TBD — scale is small enough that no performance concerns exist at the team level; standard indexing strategy is sufficient |
| 7 | Should sprint schedules be shared across teams or defined independently per team? | EM | ✅ Resolved | Org-wide shared cadence. Admin sets sprint start date. All sprints are 2 weeks. Auto-generated names use format `YYYY-Q{Q}-{N}` (e.g., `2026-Q1-1`). See Section 8.4 |

---

## 12. Glossary

| Term | Definition |
|---|---|
| **ADO** | Azure DevOps — the external project management system used as the primary work item source |
| **Base Velocity** | An engineer's expected story points per full sprint, before capacity adjustments |
| **Daily Rate** | Base velocity divided by sprint working days; used to compute adjusted velocity |
| **Adjusted Velocity** | An engineer's effective story points for a given sprint after subtracting days off |
| **Team Sprint Velocity** | The sum of all engineers' adjusted velocities for a given sprint |
| **Story Points** | A relative unit of effort assigned to work items (stories, bugs, spikes) in ADO |
| **Burndown** | A chart tracking remaining story points over time against planned completion pace |
| **Trendline** | A linear regression over actual sprint completions used to project future velocity |
| **Scenario A Injection** | In-scope scope growth — new work items added to the project's ADO backlog mid-sprint; detected automatically via sprint snapshots; no manual entry required |
| **Scenario B Injection** | Out-of-scope capacity diversion — engineer time consumed by work entirely outside the project; invisible to ADO sync; entered manually by the EM per sprint per engineer |
| **Injected Scope** | Story points added to a project's ADO backlog after a sprint has started; detected automatically by comparing sprint-start and sprint-end point totals |
| **Injection Rate** | Injected points divided by remaining points at sprint start; expressed as a percentage; used to measure planning discipline over time |
| **Effective Velocity** | An engineer's planned velocity minus injection points; the actual contribution applied to the project forecast |
| **RAG Status** | Red / Amber / Green health indicator used in executive dashboard views |
| **Provider** | An abstraction representing a work item source (ADO, Jira, etc.) |
| **Sprint** | A fixed-length iteration (default 2 weeks / 10 working days) used as the unit of capacity planning |

---

## 13. Future Considerations — Backlog

### 13.1 SaaS / Multi-Tenancy

**Question:** When this product is sold to multiple customers, how is it architected to support them independently?

**Short answer:** The foundation is already in place. Every collection has `organizationId` as the first field on every document, and every query filters on it. Data is fully isolated by org today — it's a single-tenant deployment of a multi-tenant-ready model.

**What's needed to go SaaS:**
- Organization signup and onboarding flow (create org, first admin user)
- Billing layer (subscription management, plan limits — e.g., max engineers, max projects)
- Subdomain or path-based tenant routing (e.g., `acme.capacityplanner.io` or `/org/acme`)
- Option to move to per-tenant MongoDB databases for customers requiring strict data isolation (enterprise tier)
- Rate limiting and usage metering per org

**What does NOT need to change:**
- The data model (already scoped by `organizationId`)
- The API (already enforces org scoping via session)
- The auth model (NextAuth with Azure AD supports multiple tenants via multi-tenant app registration)

**Priority:** Phase 3 or later. Revisit when product is validated and customer pipeline exists.
