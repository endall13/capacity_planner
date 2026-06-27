# Capacity Planning Application — UX Design Decisions

**Version:** 0.1
**Date:** 2026-06-19
**Companion to:** `requirements.md`, `architecture.md`
**Status:** In Review

---

## 1. Design Principles

**Enterprise-grade, not flashy.** The UI should feel sharp, tight, and data-dense without being overwhelming. Think of a well-designed BI tool — information is immediately readable, nothing decorative gets in the way.

**Keyboard-first for data entry.** EMs are busy. Any workflow that requires repeated data entry (capacity updates, manual mode setup) must support tab-through navigation so hands never leave the keyboard.

**Two actors, one UI.** The EM and visibility users (PM, Director, VP) share the same screens. Role determines what's editable, not which screens are visible. A PM lands on the same Portfolio dashboard as the EM — they just can't click "Update Sprint."

---

## 2. Navigation Model

**Left sidebar — persistent, always visible.**

```
┌─────────────────────┐
│ CapacityPlanner     │  ← app name + org name
│ Acme Corp Eng       │
├─────────────────────┤
│ WORKSPACE           │
│  📊 Portfolio    [3]│  ← active project count badge
│  🗓️  Sprints        │
│  🗺️  Roadmap        │
│  👥 Engineers       │
├─────────────────────┤
│ ADMIN               │
│  🔗 Integrations    │
│  ⚙️  Settings       │
├─────────────────────┤
│ [RM] Rick McClure   │  ← avatar + name + role
│      EM · Admin     │
└─────────────────────┘
```

Admin section is visible only to users with `admin` or `engineering_manager` roles. PM, Director, VP see Workspace items only. Roadmap is visible to all roles — it is a read-only planning horizon view for visibility users and an active planning tool for EMs.

---

## 3. Screen Inventory

| Screen | Route | Roles | Description |
|---|---|---|---|
| Portfolio Dashboard | `/` | All | Landing screen — all projects, org capacity, sustaining buckets |
| Project Dashboard | `/projects/:id` | All | Burndown, completion date, feature list, sprint history, team panel |
| Velocity Health | `/projects/:id/velocity` | EM only | Per-engineer velocity trends, injection history, planning health |
| Sprint Calendar | `/sprints` | EM, Admin | Sprint schedule — dates, working days, holidays. Sprint-scoped only. |
| Sprint Capacity Wizard | `/sprints/:id/capacity` | EM | Per-engineer PTO/sick entry, injection flags |
| Roadmap | `/roadmap` | All | 12-month rolling Gantt — active projects (forecasted) + planned projects (proposed) |
| Engineer Roster | `/engineers` | EM, Admin | Org roster, availability, project assignments, org capacity bar |
| Project Setup — Manual | `/projects/new?mode=manual` | EM, Admin | Epic/feature bulk entry for manual mode |
| Project Setup — Integrated | `/projects/new?mode=integrated` | EM, Admin | Provider linking, epic scoping |
| Admin — Integrations | `/admin/integrations` | Admin | Provider connection config |
| Admin — Settings | `/admin/settings` | Admin | Org settings, holidays, auth |

---

## 4. Portfolio Dashboard

**This is the landing screen for all users.** The EM sees it as a command center; visibility users see it as a read-only status board.

### 4.1 Layout

```
┌─────────────────────────────────────────────────────┐
│ Portfolio                    [Current: 2026-Q2-3]  [+ New Project] │
├─────────────────────────────────────────────────────┤
│ ORG CAPACITY — CURRENT SPRINT                       │
│ 10 engineers · 190 pts total                        │
│ [████████ Alpha 80pt][████ Nova 42pt][░░░ Reserve 68pt] │
│ ● Project Alpha — 80 pts (4 eng)                    │
│ ● Project Nova  — 42 pts (2 eng)                    │
│ ○ Reserve       — 68 pts (4 engineers available)    │
├──────────────────┬──────────────────────────────────┤
│ PROJECT CARD     │ PROJECT CARD                     │
│ Project Alpha    │ Project Nova                     │
│ Integrated · ADO │ Manual                           │
│ ██████████ 62%   │ ███████░░░ 38%                   │
│ ON TRACK   🟢    │ AT RISK    🟡                    │
│                  │                                  │
│ Completes Sep 12 │ Completes Nov 6                  │
│ Velocity  78 pts │ Velocity  40 pts                 │
│ Injection +12 pts│ Drift    +3 wks                  │
│                  │                                  │
│ [AC][BL][KJ][MR] │ [DW][PL]  [↻ Update Sprint]     │
├──────────────────┴──────────────────────────────────┤
│ 👤 Reserve Pool — 4 engineers available             │
│ J. Torres · A. Kim · R. Patel · C. Nguyen           │
│                              [Assign Engineers →]   │
└─────────────────────────────────────────────────────┘
```

### 4.2 Org Capacity Bar

- Sits at the top of every Portfolio view; always visible
- Segments: one per active project (color-coded) + reserve (grey)
- Shows sprint-adjusted velocity (accounts for current sprint PTO/absences already entered)
- Reserve near zero = warning signal; reserve at zero = no buffer, consider surfacing an alert

### 4.3 Project Cards

Each card shows at a glance everything an EM or stakeholder needs:

| Field | Source | Notes |
|---|---|---|
| Project name | `projects.name` | |
| Mode badge | `projects.mode` | "Manual" or provider name (e.g., "Integrated · ADO") |
| RAG status | `projects.status` | ON TRACK / AT RISK / OFF TRACK — color-coded |
| Progress bar | `forecast.completedPoints / forecast.totalPoints` | |
| Completion date | `forecast.projectedCompleteDate` | Sprint name + calendar date |
| Velocity | `forecast.currentTeamVelocity` | Current sprint's team effective velocity |
| Injection / Drift | Latest `projectSprintSnapshot.injectedPoints` or baseline drift | Context-sensitive: injection for integrated, drift for manual |
| Engineer avatars | `engineers.find({ assignedProjectId })` | Initials only; 2–5 dots |
| CTA | — | "Update Sprint" if current sprint capacity is incomplete; "✓ up to date" if done |

### 4.4 Sustaining Work

Engineers who aren't on a project are never truly idle — they're burning down tech debt, handling sustainment, running on-call rotations, or doing innovation work. These are **Sustaining** buckets: named capacity allocations with no end date, no forecast, and no RAG status.

- Sustaining buckets appear in the org capacity bar alongside projects, differentiated by a **Sustaining** badge
- Examples: "Tech Debt", "Sustainment", "On-Call", "Innovation Time" — the EM names them
- Engineers are assigned to sustaining buckets the same way as projects (`assignedProjectId`)
- No epics, features, burndown, or forecast — just a name, a color, and assigned engineers
- Any remaining unallocated capacity (no assignment at all) shows as "Unallocated" at the far right of the bar — this should be rare and is a signal to the EM

---

## 5. Sprint Lifecycle — Automatic

**Sprints open and close automatically based on their calendar dates.** The EM never manually opens or closes a sprint. The sprint schedule is generated upfront; the system flips `sprint.isCurrent` at midnight on the sprint start date.

**What the EM does do:** prepare capacity for the new sprint.

When a sprint opens, a prompt appears on the Portfolio Dashboard and on affected project cards:

> *"Sprint 2026-Q2-3 started Monday. Update your team's capacity."*
> → **[↻ Update Sprint]** button on each project card that needs attention.

### 5.1 Sprint Capacity Wizard

A lightweight 3-step wizard, accessible from the card CTA or from `/sprints/:id/capacity`.

**Step 1 — Review Team**
- Shows the engineers currently assigned to this project
- Read-only roster confirmation; links to reassign if needed

**Step 2 — Absences**
- Tabular, keyboard-navigable grid: one row per engineer
- Columns: Engineer name | PTO Days | Sick Days | Notes
- Tab moves across columns, Enter or Tab-to-next-row advances
- PTO Days: entered proactively (planned leave) — feeds forecast immediately
- Sick Days: entered retroactively (unplanned illness) — explains variance post-sprint
- Holidays pre-populated from org calendar; shown as read-only for awareness

**Step 3 — Injection**
- Optional. "Did any engineers get pulled to work outside this project this sprint?"
- Same tabular grid: Engineer | Injection pts | Note (e.g., "prod hotfix", "security audit")
- Maps to `sprintCapacityEntries.injectionPoints` — reduces effective velocity
- UI label is **Injection** throughout. Distinct from Scenario A (scope grew): Scenario B = capacity was diverted away

**Confirmation**
- Summary: team velocity for this sprint (adjusted for all entries)
- "Save & Close" → forecast recomputes immediately, card CTA clears

---

## 6. Manual Mode Project Setup

### 6.1 Project Creation Flow

1. EM clicks **+ New Project** on Portfolio
2. Selects mode: **Manual** or **Integrated**
3. Names the project, sets `avgStoryPoints` (default from org settings, overridable)
4. Assigns engineers from reserve pool
5. Proceeds to scope entry (manual) or provider linking (integrated)

### 6.2 Scope Entry — Tabular Bulk Entry

Manual mode scope is entered in a spreadsheet-style table — **no modals, no page-per-feature.** The EM types directly into the grid.

```
Epic: [Checkout Redesign              ]

  Feature Name                    | Stories | Pts (auto)
  ──────────────────────────────────────────────────────
  Payment methods                 |    12   |    60
  Order confirmation page         |     8   |    40
  Address book management         |     6   |    30
  Guest checkout flow             |    10   |    50
  [+ Add feature — press Tab]     |         |
```

**Interaction rules:**
- Tab moves right across columns, then to the next row
- Enter on last column creates a new row automatically
- Pts column is read-only and auto-calculated: `stories × project.avgStoryPoints`
- Rows can be reordered via drag handle (optional Phase 1.5)
- Multiple epics supported — "Add Epic" button above the table creates a new section

**Paste Import (Phase 1.5):**
- "Paste from spreadsheet" button opens a text area
- EM pastes two-column data (feature name, story count) from MetroRetro export, Excel, or any tool
- System parses and populates the table; EM reviews and confirms
- Format: tab-separated or comma-separated, one feature per line

### 6.3 Progress Updates (Post-Sprint)

After each sprint, the EM updates completed story counts per feature. This is the recurring manual mode update — equivalent to the sync worker's role in integrated mode.

Entry point: **Project Dashboard → Feature List → Edit completed count**

Same tabular pattern:
```
  Feature Name                    | Total | Done | Remaining | Status
  Checkout redesign               |  12   |  6   |     6     | In Progress
  Payment methods                 |   8   |  8   |     0     | ✓ Complete
  Order confirmation              |   6   |  0   |     6     | Not Started
```

Editing `Done` column inline triggers immediate forecast recompute.

---

## 7. Color System — RAG + UI

| Element | Color | Hex |
|---|---|---|
| Primary action / highlight | Blue | `#4F8EF7` |
| Sidebar background | Dark navy | `#1A1F2E` |
| Page background | Light grey | `#F0F2F5` |
| Cards / panels | White | `#FFFFFF` |
| Borders | Light | `#E5E9F0` |
| ON TRACK (RAG green) | Green bg / text | `#E6F7EE` / `#1A7F4B` |
| AT RISK (RAG amber) | Amber bg / text | `#FFF8E6` / `#B35C00` |
| OFF TRACK (RAG red) | Red bg / text | `#FDE8E8` / `#B01C1C` |
| Secondary text | Medium grey | `#8896B3` |
| Disabled / labels | Light grey | `#B0BAC9` |

---

## 8. Project Dashboard

**Route:** `/projects/:id`
**Role:** All (EM sees Team — Current Sprint panel; PM/Director/VP do not)

The drill-down from a Portfolio project card. The EM uses it as a command center for the project; visibility users use it as a read-only status board.

### 8.1 Top Bar

`← Portfolio` breadcrumb | project name | mode badge (e.g., "Integrated · ADO") | RAG badge (ON TRACK / AT RISK / OFF TRACK)

Right side: sprint name label | **↻ Sync** button (integrated only) | **↻ Update Sprint** CTA (if capacity incomplete) | **Health →** link to Velocity Health screen

### 8.2 Stat Row (5 cards across the top)

| Card | Value | Source |
|---|---|---|
| Progress | % complete + progress bar | `forecast.completedPoints / forecast.totalPoints` |
| Completes | Calendar date + sprint name | `forecast.projectedCompleteDate` |
| Team Velocity | pts this sprint | `forecast.currentTeamVelocity` |
| Remaining | pts + sprint count estimate | `forecast.remainingPoints` |
| Injection (this sprint) | pts, broken out A vs B | `projectSprintSnapshot.injectedPoints` + `Σ sprintCapacityEntries.injectionPoints` |

### 8.3 Burndown Chart

Left panel, top. Shows remaining story points per completed sprint.

| Element | Detail |
|---|---|
| X axis | Sprint names; current sprint label is blue |
| Y axis | Remaining story points |
| Actual line | Blue solid — the real burndown |
| Ideal line | Grey dashed — straight line from start to projected end |
| Current sprint region | Light blue shaded column + **▶ Current Sprint** pill label; current sprint data point is larger with white ring |
| Injection markers | Amber dashed vertical line at the sprint where injection occurred; circled **A** for Scope, callout tooltip shows `+N pts` |

### 8.4 Scope — Epics & Features

Left panel, below burndown. Collapsible epic groups.

- **Epic row:** chevron (expand/collapse) | epic name | feature count | RAG badge
- **Feature rows (expanded):** feature name | total pts | done pts | status pill
- Status pills: ✓ Done (green) / In Progress (blue) / Not Started (grey)
- **+ Add Epic** action in card header (EM only; read-only for visibility roles)
- For manual mode: Done column is inline-editable by EM — clicking triggers `PUT /api/manual/features/:id` and immediate forecast recompute

### 8.5 Sprint History

Right panel, top. One row per completed sprint + current sprint.

- Columns: sprint name | horizontal bar (delivered pts relative to base) | pt value
- Current sprint row is highlighted in blue (`#EEF2FF` background, blue dot, muted partial bar, `44⁺` value indicating in-progress)

### 8.6 Team — Current Sprint *(EM only)*

Right panel, below Sprint History. Role-gated — not rendered for PM / Director / VP.

- Columns: avatar | engineer name + mini capacity bar | Base pts | PTO | Inject | Effective
- Mini capacity bar: color-coded segments — blue (project contribution) / amber (PTO loss) / red (injection loss) / grey (remaining base)
- Footer row: "Team total: N / N pts effective"
- This panel shows **capacity** (entries the EM made), not performance output — it is a planning view, not a scorecard

---

## 9. Velocity Health Screen

**Route:** `/projects/:id/velocity`
**Role:** EM only (role-gated — not visible to PM / Director / VP)

This is the drill-down from the Project Dashboard "Health →" link. It answers the question: *why is this project's velocity trending the way it is, and where are the signals I need to act on?*

### 8.1 Layout

Three panels stacked vertically, spanning the full content area.

**Top bar:** "← Project Nova" breadcrumb | "Velocity Health" title | **EM Only** badge | Sprint range picker (Last 3 / Last 6 / All)

---

### 8.2 Panel 1 — Engineer Velocity Trend (line chart)

A multi-line chart showing each engineer's **effective velocity per sprint**, plotted over the selected range.

| Element | Detail |
|---|---|
| X axis | Sprint names (YYYY-Q{Q}-{N}) |
| Y axis | Effective velocity (pts) |
| Lines | One per engineer, color-coded by engineer, labeled in legend |
| Dashed reference line | Org/project `baseVelocity` — grey dashed, labeled "Base velocity" |
| Data points | Dots on each sprint; current sprint dot is larger with white ring |
| Annotations | Auto-flagged if an engineer is trending down 3+ consecutive sprints — tooltip explains: "sick days + injection pattern" |

**What the EM reads from this panel:** who is consistently below baseline and why (PTO + sick + injection all reduce effective velocity — the chart captures the combined effect).

---

### 8.3 Panel 2 — Sprint Injection History (table + stacked bar)

Two-column layout: left = data table, right = a color-keyed legend.

**Columns:**

| Column | Source | Notes |
|---|---|---|
| Sprint | `sprint.name` | Current sprint highlighted with "NOW" chip |
| Capacity breakdown | Stacked bar | Visual ratio: project pts vs. Scope (A) vs. Injection (B) |
| Scope (A) | `projectSprintSnapshot.injectedPoints` | Backlog grew; detected automatically; shown in amber |
| Injection (B) | `Σ sprintCapacityEntries.injectionPoints` | Capacity diverted; entered by EM; shown in red |
| Lost | Sum of A + B | Total capacity impact that sprint |

**Bar segment colors:**
- Blue `#4F8EF7` — pts delivered to project
- Amber `#F5A623` — scope grew (Scenario A)
- Red `#E84545` — pulled away (Scenario B)

A sprint with no injection has a fully blue bar and `—` in the Scope and Injection columns.

---

### 8.4 Panel 3 — Planning Health (integrated mode only)

Not shown for manual mode projects. For integrated projects, this panel surfaces work item estimation signals from the current sprint.

**Summary row (3 cells):**

| Status | Rule | Color |
|---|---|---|
| ✓ Healthy | ≤ 5 pts | Green `#1A7F4B` |
| ⚠ At Risk | 8 pts | Amber `#B35C00` |
| ✕ Decompose | ≥ 13 pts | Red `#B01C1C` |

**Item list below summary:** shows only At Risk and Decompose items — the ones needing EM action. Columns: item name | story points | badge. Healthy items are counted in the summary but not listed individually (no noise).

The EM's action: take the "Decompose" items back to the engineer and break them down before they enter a sprint. "At Risk" items are flagged as a heads-up — not blocking but worth watching.

---

### 8.5 Role-Gating Rationale

This screen shows per-engineer effective velocity over time. The EM entered all the underlying data (absences, injection) — they already know what it means. It is a **planning tool**, not a scorecard. PM / Director / VP see aggregate team velocity on the Project Dashboard; they do not need or see individual engineer breakdown.

---

## 10. Engineer Roster

**Route:** `/engineers`
**Role:** EM, Admin

The org-wide view of all engineers — assignments, base velocity, and availability. The EM uses this to assign and reassign engineers across projects, sustaining buckets, and reserve.

### 10.1 Top Bar

"Engineers" title + total count | Search input (filters roster inline) | **+ Add Engineer** button

### 10.2 Summary Bar

Five items across, always visible below the top bar:

| Item | Value |
|---|---|
| Total engineers | Count of all `engineers` documents |
| On projects | Count where `assignedProjectId` points to a `project` type |
| Sustaining | Count where `assignedProjectId` points to a `sustaining` type |
| Reserve | Count where `assignedProjectId: null` |
| Org capacity bar | Same bar as Portfolio — segments per project + sustaining + reserve, color-coded, with legend |

The org capacity bar here reflects current sprint effective velocity per bucket, giving the EM a capacity read before making reassignment decisions.

### 10.3 Roster Table

Engineers grouped into sections by assignment: one section per active project, one Sustaining section, one Reserve section. Within each section, rows are sorted by base velocity descending.

**Columns:**

| Column | Source | Notes |
|---|---|---|
| Avatar | Initials from `engineer.name` | Color-coded by assignment |
| Engineer | Name + title | `engineer.name`, `engineer.title` |
| Assignment | Project/sustaining chip | `assignedProjectId` → project name; null → "Unassigned" |
| Base velocity | pts per sprint | `engineer.baseVelocity` |
| Status | Active / Reserve | Active = assigned; Reserve = `assignedProjectId: null` |
| Since | Assignment start date | `engineer.projectHistory[last].assignedAt` |
| Action | Context-sensitive link | "Reassign" (on project) · "Assign to project" (sustaining) · "Assign" (reserve) |

**Section dividers:** thin grey rows labeling each group — "Project Alpha", "Project Nova", "Sustaining", "Reserve". Makes the assignment structure scannable at a glance without needing to read every row.

**Assignment chip colors:** each project gets a color consistent with its color in the org capacity bar; Sustaining chips are amber; Reserve chips are grey.

### 10.4 Reassign Flow

Clicking "Reassign" or "Assign" opens a lightweight inline dropdown (not a modal) on the row — a list of available targets: active projects, sustaining buckets, or "Release to reserve." Selecting one writes `engineer.assignedProjectId`, updates `engineer.projectHistory`, and refreshes the roster grouping immediately. Forecast recompute triggers for affected projects.

---

## 11. Sprint Calendar

**Route:** `/sprints`
**Role:** EM, Admin

Focused entirely on sprint scheduling — dates, working days, and holidays. Capacity entry is handled in the Sprint Capacity Wizard (`/sprints/:id/capacity`), not here.

### 11.1 Top Bar

"Sprint Calendar" title + year navigator (‹ 2026 ›) | **⚙ Adjust Anchor Date** button (rare admin action — regenerates the full sprint schedule from a new anchor)

### 11.2 Layout

Sprints grouped by quarter. Each quarter is a collapsible card with a header showing quarter label, date range, and status (Complete / In Progress / Upcoming).

**Column headers:** Sprint | Start | End | Working Days | Projects | Capacity

**Row states:**
- **Past** — muted opacity, Capacity column shows "✓ Done"
- **Current** — highlighted with left blue border + **NOW** chip on sprint name; Capacity column shows "↻ Update capacity" CTA
- **Future** — normal weight; Capacity column shows "—"

**Working days** — auto-computed by Sprint Generator; holidays reduce the count and are flagged inline (e.g., "⚠ Memorial Day — 8d")

**Projects column** — color-coded chips showing which projects are active that sprint. Read-only; reflects current engineer assignments.

### 11.3 What This Screen Is Not

The Sprint Calendar does not show capacity entries, velocity, injection, or burndown. Those live on the Project Dashboard and Velocity Health screens. This screen answers one question: *what is the sprint schedule, and are there any working-day anomalies to be aware of?*

---

## 12. Roadmap

**Route:** `/roadmap`
**Role:** All — read-only for PM/Director/VP; EM can add and edit planned projects

A 12-month rolling horizontal Gantt showing every active and planned project on a shared timeline. The primary tool for portfolio-level planning and leadership visibility.

### 12.1 Top Bar

"Roadmap" title + rolling window label (e.g., "Jan 2026 – Dec 2026") | Window toggles: **6mo / 12mo / 18mo** | **+ Plan Project** button (EM only)

### 12.2 Timeline Grid

- **X axis:** months, grouped by quarter; quarter headers alternate background for visual separation
- **Current month** highlighted in the header; **today** marked with a solid blue vertical line across all rows
- **Sprint boundaries** shown as faint vertical lines — enough to read sprint alignment without cluttering the view
- **Scrollable** left (history) and right (future) — the window toggle controls default zoom, not a hard limit

### 12.3 Row Sections

**Active Projects section** — one row per `projects.status: 'active'` project

| Bar element | Detail |
|---|---|
| Bar color | RAG status — green (ON TRACK) / amber (AT RISK) / red (OFF TRACK) |
| Bar span | `project.startDate` → `forecast.projectedCompleteDate` |
| Progress fill | Subtle darker overlay showing % complete within the bar |
| End marker | Vertical tick at projected end date |
| Baseline marker | Dashed white vertical tick at original baseline end date — visible when project has slipped |
| Label | Project name + forecasted end date |
| Engineer count chip | `N eng` on the row label |

**Sustaining row** — a single faint amber bar spanning the full visible range, fading out at the right edge (no end date). Labeled "Ongoing — no end date."

**Planned Projects section** — one row per `projects.status: 'planned'` project

| Bar element | Detail |
|---|---|
| Bar style | Dashed outline, no fill — visually distinct from active commitments |
| Bar span | `project.proposedStartDate` → `project.proposedEndDate` |
| Label | Project name + proposed window |
| Engineer count | "TBD" if not yet assigned |

### 12.4 Planning a Project

**+ Plan Project** opens a lightweight form (inline panel, not a modal): project name, proposed start date, proposed end date, tentative engineer count. Saves a `projects` document with `status: 'planned'`, `proposedStartDate`, `proposedEndDate`. No epics, features, or mode selection required at this stage — those are configured when the project is activated.

When a planned project is activated (EM triggers "Start Project"), the dashed bar converts to a solid RAG-colored bar and the project enters normal sprint planning.

### 12.5 Data Model Additions

Two fields added to `projects` to support the Roadmap:

```js
status: String,            // 'active' | 'planned' | 'completed'  (was implied, now explicit)
proposedStartDate: Date,   // planned projects only
proposedEndDate: Date,     // planned projects only
```

Active projects derive their end date from `forecast.projectedCompleteDate` — no manual entry needed.

---

## 13. Phase Scoping

| Feature | Phase |
|---|---|
| Sidebar nav, Portfolio dashboard | 1 |
| Project cards with RAG + metrics | 1 |
| Org capacity bar (projects + sustaining + unallocated) | 1 |
| Sustaining work buckets (Tech Debt, Sustainment, etc.) | 1 |
| Auto sprint lifecycle | 1 |
| Sprint Calendar (schedule view, holiday flags) | 1 |
| Sprint Capacity Wizard (3-step) | 1 |
| Manual mode tabular bulk entry | 1 |
| Manual mode progress update (inline) | 1 |
| Project Dashboard (burndown, features, sprint history, team panel) | 1 |
| Velocity Health (engineer trends + injection history + planning health) | 1 |
| Engineer Roster (org capacity bar, assignment management) | 1 |
| Roadmap (12-month Gantt, active + planned projects) | 1 |
| Paste import for manual mode setup | 1.5 |
| Collaborative remote planning board | 2 |
| Director / VP read-only access (all screens already role-gated) | 2 |
