# Development Practices and Engineering Invariants

This document supplements the artifact chain with the *process* knowledge behind it, distilled from RoundTable's development-session records (May 2026 working sessions; consolidated July 5, 2026). Where the artifact bundles show *what* shipped at each gate, this records *how* the work was run and *which invariants* the codebase now depends on.

> Sourcing: reconstructed from development-session summaries and repository documentation. Where a claim is checkable against the code or an artifact in this chain, a pointer is given.

---

## 1. The multi-model development pipeline

RoundTable was built using the same kind of workflow it exists to coordinate — the tool is its own methodology, dogfooded:

| Role | Model | Responsibility |
|---|---|---|
| Mediator / Architect / Reviewer | GPT-5.5 Thinking | Phase plans, controlling documents, synthesis of review rounds, architectural rulings |
| Deep implementation | Claude Opus | Feature checkpoints, root-cause bug work |
| Implementation / cleanup | Claude Sonnet | Scoped cleanup gates, packaging passes |
| Independent review | Gemini | Adversarial review packets; "SAFE / SAFE WITH EDITS / do-not-lock" verdicts |
| Project architect | Eric Harris (operator) | Scope rulings, gate enforcement, final lock authority |

No model talks to another directly — every handoff is a human-mediated copy/paste with the artifact preserved. Era 1's Gemini review packets and Era 3's full prompt→critique→revision→lock loop are the primary evidence of this pipeline in operation.

The `.1` convention: when independent review returned findings, they were addressed in a dedicated cleanup gate (3.1, 5.1, 6.1, 7A.1, 7B.1, 8.1) rather than folded silently into the next feature phase. Review findings are visible in the record, not absorbed.

## 2. Session continuity discipline

Long implementation efforts ran across many sessions. Continuity was maintained by artifact, not by memory:

- Every checkpoint ends with a `CHECKPOINT_STATE.md` describing the exact codebase state, what changed, and what was deliberately deferred — written to be read cold at resume time.
- Deliverables follow the naming convention `roundtable-v{version}-{checkpoint-slug}.zip`.
- Each ZIP is re-verified end-to-end *from the archive* (extract → install → typecheck → build → acceptance walk) before delivery, so any session can restart from the last deliverable with confidence.

## 3. Engineering invariants (do-not-break list)

These are load-bearing decisions the codebase relies on. Several are enforced by the acceptance walk.

1. **Race-safe round mutations.** All round mutations go through `updateRoundFunctional`, which resolves the latest round *inside* React's `setState` updater. The closure-based `replaceRound` is `@deprecated` with zero in-app call sites. The `handleStatusChange` pattern must never be "simplified" back to mapping `activeRound.modelResponses` directly — that reintroduces the v0.10.3 same-batch race (see Era 1, stage 06).
2. **Status preservation on overwrite.** `upsertModelResponse` must not reset a `reviewed`/`excluded` status on re-paste; the preservation branch is a documented contract.
3. **Schema/app version decoupling.** `SCHEMA_VERSION` changes only when the `AppState` shape changes; `APP_VERSION` tracks releases. v0.12.0 ships on schema 0.11.0 for exactly this reason (see `docs/SCHEMA_EVOLUTION.md`).
4. **Future-schema imports are hard errors,** never warnings (`docs/COMPATIBILITY_NOTES.md`, validation layer).
5. **Locked constants.** `GENERIC_WRAPPER_ID` (`'wrapper-generic'`) is referenced by both `migration.ts` and `promptGeneration.ts`; renaming one side breaks migration.
6. **Project lifecycle safety.** `archiveProject()` / `deleteProject()` must never leave `activeProjectId` null.
7. **No app-owned network surfaces.** No `fetch`/XHR/model APIs/scraping/automation anywhere in application code; the only network artifact is the Workbox-generated service worker caching the app's own static shell. Every checkpoint gate includes a grep proving this.
8. **React purity.** No `setState` inside another updater (a real defect fixed in v0.10.5); derived UI values are derived, not duplicated into state.

## 4. Scope control

Scope discipline was treated as a feature. Standing out-of-scope list, re-asserted at every checkpoint and still in force: IndexedDB migration (unless Checkpoint O is ever triggered by field evidence), diff viewer, drag-and-drop, bulk export, any backend/API/auth/cloud-sync surface, and unrelated refactoring inside feature checkpoints. Documentation updates, by contrast, are first-class deliverables — `PHASE_HISTORY.md`, `SCHEMA_EVOLUTION.md`, `DATA_MODEL.md`, and `RELEASE_CHECKLIST.md` ship alongside the code they describe.

## 5. Verification as culture, then as CI

The gate sequence (typecheck → build → acceptance walk → network grep → state doc → ZIP e2e re-verification) predates the CI workflow and was executed manually at all 11 Era 2 checkpoints. `npm run verify` and `.github/workflows/ci.yml` are the codification of that habit, not its origin. The 15-criterion acceptance walk exercises the safety-critical import/handoff pipeline — hash round-trips, stale-state detection, malformed-YAML fallback, rollback restoration, forward-schema rejection, migration safety, and the no-new-network-surfaces check among them (`scripts/acceptance-walk.ts`).

## 6. Known open items at consolidation time

- Hosted Netlify PWA validation: **pending** (local `build`/`preview` verified only).
- Checkpoint N (PWA-aware documentation pass): remaining from the readiness plan.
- Checkpoint O (IndexedDB adapter): optional; triggered only by iOS quota evidence from field use.
- Podcast Pipeline: paused at Phase 2 (scaffold), with a documented resume bridge into the current build.
