# Improve Codebase Architecture

**Type:** Model-invoked (auto-run when appropriate)  
**Scope:** Local to Capacity Planner  
**Purpose:** Systematically review code quality, architectural fitness, and identify refactoring opportunities post-Phase-1.

---

## When to Invoke

Auto-trigger when:
- You've completed a milestone and want an architecture health check
- Code feels "tangled" or coupling is increasing
- You're about to add a major feature and concerned about foundation
- You want to assess technical debt before Phase 2
- You're reviewing pull requests and spot patterns that should be extracted

Do NOT invoke if:
- You're in active feature development (focus first, refactor after)
- The codebase is < 500 lines (too early for this analysis)
- There's no build-plan or CONTEXT.md to reference

---

## The Review: Fitness → Debt → Opportunities

### Phase 1: Assess Fitness Against Build-Plan

Read the build-plan (docs/build-plan.md) and CONTEXT.md. Ask:

**Architecture:**
- Does the code structure match the architecture.md? (Components, layers, responsibilities)
- Are boundaries clear? (UI layer, service layer, data layer separated?)
- Is the data model correctly reflected in code? (Schema matches Mongoose models?)

**Coupling & Cohesion:**
- Can you remove a feature without breaking others?
- Are services independent or tangled?
- Do API routes know about implementation details they shouldn't?

**Testing:**
- Are the unit tests from the build-plan actually passing?
- What's untested? (Services, edge cases, error paths)
- Is test code maintainable or brittle?

**Naming & Clarity:**
- Function names say what they do?
- Variable names are domain-aware (incident, engineer, sprint)?
- Comments explain *why*, not *what*?

### Phase 2: Identify Debt & Complexity

Read the code. Flag:

| Issue | Impact | Example |
|-------|--------|---------|
| **Tangled Service** | Hard to test, hard to extend | `incident.service.ts` does assignments, validations, notifications |
| **Magic Numbers** | Unclear business logic | `if (velocity > 85)` — why 85? Should be a constant |
| **Repeated Logic** | Maintenance burden | Same validation code in 3 API routes |
| **God Object** | Tight coupling | `Project` model has 40 fields; some unused in half the code |
| **Missing Abstraction** | Fragile to change | Database query directly in route handler instead of a DAO |
| **Incomplete Error Handling** | Silent failures | Async functions that catch but don't log |

### Phase 3: Propose Refactoring

For each debt item, suggest:

1. **What to extract:** "The `validateIncidentAssignment` logic appears in 3 places; extract to `lib/validators/incident.ts`"
2. **Why it matters:** "Consolidates business logic; single source of truth for rules"
3. **Effort:** "1–2 hours; low risk if tests pass"
4. **Order:** "Do this first—unblocks other refactorings"

---

## Output: Architecture Review Document

At the end, produce a `ARCHITECTURE_REVIEW.md` in the project docs folder with:
- Fitness assessment (what's good, what needs attention)
- Identified debt (location, impact, refactoring approach)
- Testing gaps
- Recommended refactoring order
- Architectural fitness verdict

---

## Your Behavior

1. Read the build-plan and CONTEXT.md (grounding)
2. Read the code systematically (architecture first, then details)
3. Flag issues with specific locations (file, line, function name)
4. Distinguish: debt (refactor) vs. design mismatch (rework) vs. missing tests (add coverage)
5. Propose refactoring order (what unblocks what)
6. Estimate effort honestly
7. Produce ARCHITECTURE_REVIEW.md

---

## Version

- **v1.0** — Locked (2026-06-27)
