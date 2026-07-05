# Schema Evolution

RoundTable — schema lifecycle and import-compatibility guide.
(Formerly developed under the working name Model Roundtable Console / MRC.)

This document is the single source of truth for how RoundTable's data model has
evolved, how older exports are handled, and how to extend the schema
without breaking existing user data. **Read this before bumping
`SCHEMA_VERSION` or changing any field on `AppState`.**

---

## Current schema version

`0.11.0` — defined in `src/config/exportFormats.ts` as `SCHEMA_VERSION`.

(History: `0.10.0` was the Phase 9 RoundTable-rename version;
`0.10.1`–`0.10.5` were operational/workflow patches that kept the
AppState shape stable. `0.11.0` is the first AppState-shape change
since Phase 7B / `0.8.0` — it adds the `rawNotes` and `importHistory`
top-level arrays for Markdown Handoff Mode.)

The same string is stamped onto:

- New `AppState` objects (`src/data/initialAppState.ts`)
- Every JSON export (`src/utils/jsonExport.ts`)
- Every Markdown export header (`src/utils/markdownExport.ts`)
- Validation comparisons against incoming imports (`src/utils/validation.ts`)
- Migrated states' `schemaVersion` field (`src/utils/migration.ts`)

The application package version (`package.json`, `package-lock.json`) and
the in-app `APP_VERSION` (`src/config/exportFormats.ts`) move in lockstep with
`SCHEMA_VERSION` for now. They may decouple once RoundTable reaches `1.0.0`.

---

## What changed by version

### 0.4.0 → 0.5.0 (Phase 5 — Export, Import, Durable State, Recovery)

**Shape changes:** none. `AppState` keys are unchanged from 0.4.0.

**Pipeline changes:**

- New JSON export envelope:
  `{ exportType, schemaVersion, exportedAt, appName, appVersion, source, payload: { appState } }`.
  Older `{ schemaVersion, exportedAt, appState }` exports are still accepted
  on import as `legacy` and produce a `LEGACY_FORMAT_DETECTED` warning.
- New `validation.ts` import firewall: parse → extract → validate → normalize.
- New `localStorageAdapter.loadWithRecovery()` returning `{ state, rawValue,
  error, wasCorrupted }` so corrupted local state opens RecoveryPanel rather
  than crashing.
- New referential-integrity rules:
  - Orphaned `round.projectId` → hard error (rejected import).
  - Invalid `decision.projectId` → hard error.
  - Broken `decision.roundId` → warning only (decision text preserved).
- Backup-before-import gate added to the import flow.

### 0.5.0 → 0.6.0 (Phase 6 — Internal Documentation and Maintainability Pass)

**Shape changes:** none. `AppState` keys are unchanged from 0.5.0.
A `0.5.0` export will normalize cleanly into a `0.6.0` AppState with no
substantive differences.

**Pipeline changes:**

- Validation results now include a typed `issues: ValidationIssue[]`
  alongside the legacy `errors: string[]` / `warnings: string[]`. UI can
  render either; both views describe the same underlying issues.
- New `ValidationCode` enum-as-string-union for stable issue identity:
  `JSON_PARSE_FAILED`, `APP_STATE_MISSING`, `SCHEMA_MISSING`,
  `SCHEMA_MISMATCH`, `EXPORT_TYPE_UNKNOWN`, `LEGACY_FORMAT_DETECTED`,
  `REQUIRED_ARRAY_MISSING`, `REQUIRED_ARRAY_INVALID`, `ORPHANED_ROUND`,
  `ORPHANED_DECISION_PROJECT`, `BROKEN_DECISION_ROUND_LINK`,
  `ACTIVE_PROJECT_REPAIRED`, `FIELD_DEFAULTED`, `TIMESTAMP_DEFAULTED`,
  `AUTO_REPAIR_APPLIED`.
- `normalizeImportedState()` split into per-collection helpers
  (`normalizeProjects`, `normalizeActiveProjectId`, `normalizeRounds`,
  `normalizeDecisions`, `normalizeModelProfiles`,
  `normalizePromptTemplates`, `normalizeCompatibilityNotes`,
  plus `normalizeGeneratedPrompts`, `normalizeModelResponses`,
  `normalizeMediatorSynthesis`).
- Recovered/repaired IDs use `generateSafeId()` (Web Crypto + fallback)
  rather than ad-hoc `Math.random()` calls.

**Behavior preserved from 0.5.0:** every validation outcome (which imports
pass, which are rejected, which are normalized) is identical. Phase 6 is a
maintainability and observability pass, not a semantic change.

### 0.6.0 → 0.7.0 (Phase 7A — Schema Migration, Import Compatibility, Gemini Review Packet)

**Shape changes:** none. `AppState` keys are unchanged from 0.6.0.
A `0.6.0` export will migrate cleanly into a `0.7.0` AppState with no
substantive differences. The migration step exists, but for this version
gap it is a structural no-op that emits a `MIGRATION_STEP_APPLIED`
notice for observability.

**Pipeline changes:**

- New stage in the import pipeline: **migration** runs after
  envelope unwrap and before structural validation.
  Pipeline:
  `parseImportJson → extractAppState → migrateAppState → validateImportedState → normalizeImportedState`.
- New `src/utils/migration.ts` module with:
  - `MIGRATION_CODES` (frozen object): `SOURCE_VERSION_INFERRED`,
    `SOURCE_VERSION_UNKNOWN`, `ALREADY_CURRENT`,
    `SOURCE_NEWER_THAN_APP`, `MIGRATION_STEP_APPLIED`,
    `SCHEMA_STAMP_UPDATED`, `LEGACY_ENVELOPE_DETECTED`.
  - `MigrationNotice`, `MigrationResult` types.
  - `detectSourceVersion()`, `migrateAppState()` functions.
  - A `MIGRATION_CHAIN` registry of small per-version-up transforms.
- `VALIDATION_CODES` is now a frozen object (`as const`) with derived
  literal-union type `ValidationCode`. Same string values; richer
  runtime presence.
- `ValidationResult` carries a new `migrations: MigrationNotice[]`
  field. UI renders four distinct groups in the import preview:
  Errors / Migrations / Warnings / Auto-repairs.
- `ImportSummary` carries `sourceSchemaVersion` (best-effort detected
  source version).
- Path-aware `ValidationIssue.path` on every site that has an
  accurate dotted path. Paths are not invented when not known.

**Behavior preserved from 0.6.0:** Every validation outcome remains
identical for current-shape imports. Legacy imports (Phase 3/4
envelopes, raw AppState, schemaVersion-less files) now also flow
through the migration step and surface explicit migration notices
before the user confirms.

### 0.7.0 → 0.8.0 (Phase 7B — Model / Prompt / Vendor Compatibility Resilience)

**Shape changes:** YES. This is the first version-up step in the
chain that actually changes `AppState` shape.

**New top-level array:**

- `AppState.promptWrappers: PromptWrapper[]` — vendor-specific
  framing layer that wraps the Context Sandwich. Default
  population is `DEFAULT_PROMPT_WRAPPERS` from
  `src/config/promptWrappers.ts` (Generic, GPT-5.5 Mediator,
  Claude Implementer, Gemini Reviewer, Haiku Summary).

**New optional fields on existing types (additive, all optional):**

| Type | New fields |
|---|---|
| `ModelProfile` | `profileVersion`, `vendorUrl` (existed in 0.7.0; promoted to documented vendor-resilience surface), `contextWindowNotes`, `defaultPromptWrapperId`, `modelBehaviorNotes`, `formattingNotes`, `refusalRiskNotes`, `strengths`, `weaknesses`, `lastReviewedAt` |
| `PromptTemplate` | `createdAt`, `updatedAt`, `changelog`, `active`, `supersedesTemplateId` |
| `CompatibilityNote` | `severity` (`low|medium|high|workflow_breaking`), `impact`, `linkedModelProfileId`, `linkedPromptTemplateId`, `linkedPromptWrapperId`, `reviewedAt`. Status enum widened to include `'deprecated'`. |

**New supporting types (not in `AppState` itself):**

- `PromptWrapper` — `src/types/promptWrapper.ts`. Stored in
  `AppState.promptWrappers`.
- `CompatibilityTest` — `src/types/compatibilityTest.ts`. Lives in
  static config (`src/config/compatibilityTests.ts`); not stored
  in `AppState` because the user shouldn't be able to delete the
  test library by clearing local data.

**Migration step `0.7.0 → 0.8.0` (`migrate_0_7_to_0_8` in
`src/utils/migration.ts`):**

This is the first migration step in RoundTable's history that actually
performs structural defaulting. It:

1. Adds the `promptWrappers` array seeded from
   `DEFAULT_PROMPT_WRAPPERS` if it's missing. (`MIGRATION_STEP_APPLIED`
   notice with path `promptWrappers`.)
2. Defaults `defaultPromptWrapperId: GENERIC_WRAPPER_ID` on every
   ModelProfile that lacks one. (One `MIGRATION_STEP_APPLIED` notice
   listing the affected profile ids; path
   `modelProfiles[].defaultPromptWrapperId`.)
3. Defaults `severity: 'medium'` on every CompatibilityNote that
   lacks one. ('medium' is deliberately neutral.)
4. Defaults `active: true` on every PromptTemplate that lacks it.
   (Pre-Phase-7B templates predate the active flag; treating them
   as active preserves existing behavior.)

The `MigrationStep` API was extended with a `MigrationStepContext`
parameter so steps can push their own `MigrationNotice` entries.
The existing no-op steps (0.4→0.5, 0.5→0.6, 0.6→0.7) accept the
context but ignore it; they continue to compile and behave
identically.

**Substantive content is NOT fabricated:**

- No new descriptions, rationale, decision text, canonical state.
- Free-form `modelBehaviorNotes`, `formattingNotes`,
  `refusalRiskNotes`, `strengths`, `weaknesses`, `impact`, etc. stay
  missing on imports that didn't have them. Empty is the correct
  default for fields the user populates by observation.
- The `promptWrappers` array seeded by migration contains RoundTable's
  own shipped defaults — these are not invented model behavior.

**Future-schema rejection preserved:**
`UNSUPPORTED_SCHEMA_VERSION` (added in Phase 7A.1) still rejects
imports whose `schemaVersion` is newer than the running app, both
when migration emits `SOURCE_NEWER_THAN_APP` and as a defense-in-
depth check on post-migration `schemaVersion`.

**Behavior preserved from 0.7.0:** Pipeline shape unchanged.
Validation issue groups, dry-run repair preview, backup-before-
import, distinct Mediator Packet export, dynamic tilde fencing —
all intact. Legacy 0.4 / 0.5 / 0.6 / 0.7 imports continue to flow
through the chain and are stamped with `schemaVersion: '0.8.0'` at
the end.

### 0.8.0 → 0.9.0 (Phase 8 — UI Polish and Mobile Usability)

**Shape changes:** none. `AppState` keys and field meanings are unchanged from 0.8.0.

**Versioning change:** Phase 8 moves the app/schema version to `0.9.0` for release-tracking consistency while preserving the Phase 7B data shape. Existing `0.8.0` data remains compatible with `0.9.0`.

**Behavior preserved:** The Phase 7 migration chain, import preview grouping, future-schema rejection (`UNSUPPORTED_SCHEMA_VERSION`), dynamic Markdown fencing, Gemini Review Packet export, prompt wrapper behavior, and vendor-resilience fields are unchanged.

**Phase focus:** UI polish and mobile usability only — no new schema fields, no new migration complexity, and no new automation/API behavior.

---

## Migration engine

The migration engine (`src/utils/migration.ts`) is the place where
*structural version-up transforms* live. It is intentionally small and
explicit — there is no plugin system, no Strategy Pattern, no auto-
discovery — just a registry of named functions.

### Vocabulary

- **Migration** is a *version-aware structural transformation*. It
  converts an older known schema shape into the current schema shape.
  Migrations always belong to a known source/target version pair and
  emit `MigrationNotice` entries describing what changed.
- **Repair** is a *safe correction of missing/invalid structural
  fields* inside otherwise understandable data. Repairs are the job of
  `normalizeImportedState()` and surface as `AUTO_REPAIR_APPLIED`
  warnings.
- **Validation** is a *safety check* deciding whether the data is safe
  to import at all. Validation issues surface as `ValidationIssue`
  entries with severity `error` or `warning`.

The three are independent surfaces in the UI: migrations get their
own group, validation issues get severity-grouped, auto-repairs get
their own group.

### Source version detection

`detectSourceVersion(state, hint, envelopeWasLegacy)` tries, in order:

1. The state's own `schemaVersion` field if string-valued.
2. The supplied `sourceVersion` argument.
3. Heuristic from envelope shape: if `envelopeWasLegacy` (Phase 3/4
   envelope), assume `0.4.0` — that's when MediatorSynthesis was
   first introduced, and the chain from 0.4 to 0.7 is no-op for
   shape, so over-shooting is harmless.
4. Falls back to `0.0.0-unknown`. In that case migration is skipped
   and a `SOURCE_VERSION_UNKNOWN` warning is emitted.

### Chain semantics

- If source ≥ target: returns input unchanged with `ALREADY_CURRENT`
  (info) or `SOURCE_NEWER_THAN_APP` (warning in migration engine; triggers `UNSUPPORTED_SCHEMA_VERSION` **error** in validation — import rejected).
- If source < target: every chain step whose `from` is ≥ source's
  current declared version runs in order, each emitting a
  `MIGRATION_STEP_APPLIED` info notice. Final `schemaVersion` is
  stamped to `SCHEMA_VERSION`.
- If source is unknown: skip migration, let validation run on the
  input as-is.

### What migrations may NEVER do

- Fabricate `decisions[]`, `userInstruction`, `modelResponses`,
  `mediatorResponse`, `mediatorSynthesis` content, `canonicalState`,
  decision rationale, compatibility-note text, or project
  descriptions. Migrations are about shape, not substance.
- Discard fields they don't recognize. Forward-compatible behavior
  prefers passing unknown fields through.
- Throw exceptions out of the engine. Bad shapes become validation
  issues, not crashes.

### How to add a migration step when the schema changes

1. Bump `SCHEMA_VERSION` in `src/config/exportFormats.ts` and the
   matching app/package versions (see version-bump checklist below).
2. Write `migrate_X_Y_to_X_Z(state)` in `migration.ts`. Keep it as
   small as possible. If the schema didn't change between two versions,
   the function body is `return state`; it's still useful because the
   chain emits a visible notice.
3. Append the step to `MIGRATION_CHAIN` in version order.
4. Add a "What changed by version" subsection to this document
   describing the structural transform.
5. Update `docs/MAINTAINABILITY.md → How to add a migration step` if
   the recipe needs revising.
6. Verify: tsc clean, build passes, manual round-trip on a sample
   payload of the previous version.

---

## Legacy payload examples

These are illustrative inline samples so a future model knows what
older exports tend to look like in practice. They are not tests
(RoundTable has no test suite yet) — they are reading material.

### A 0.5.0 export envelope

```json
{
  "exportType": "mrc.fullProjectExport",
  "schemaVersion": "0.5.0",
  "exportedAt": "2026-04-01T12:00:00Z",
  "appName": "Model Roundtable Console",
  "appVersion": "0.5.0",
  "source": "local-browser",
  "payload": {
    "appState": {
      "schemaVersion": "0.5.0",
      "activeProjectId": "proj_demo_001",
      "projects": [{
        "id": "proj_demo_001",
        "name": "Demo",
        "description": "...",
        "currentPhase": "Phase 5",
        "canonicalState": "...",
        "createdAt": "2026-04-01T11:00:00Z",
        "updatedAt": "2026-04-01T12:00:00Z"
      }],
      "modelProfiles": [],
      "promptTemplates": [],
      "rounds": [],
      "decisions": [],
      "compatibilityNotes": [],
      "updatedAt": "2026-04-01T12:00:00Z"
    }
  }
}
```

Behavior on import in 0.7.0:
- Envelope unwrap succeeds (Phase 5+ shape).
- Migration step `0.5.0 → 0.6.0` and `0.6.0 → 0.7.0` both run as
  structural no-ops, each emitting `MIGRATION_STEP_APPLIED`.
- `SCHEMA_STAMP_UPDATED` notice marks the final version stamp.
- Validation passes (no referential issues).
- Normalization makes no substantive changes.

### A pre-Phase-5 (legacy envelope) export

```json
{
  "schemaVersion": "0.4.0",
  "exportedAt": "2026-03-15T10:00:00Z",
  "appState": {
    "schemaVersion": "0.4.0",
    "activeProjectId": "proj_demo_001",
    "projects": [...],
    "modelProfiles": [...],
    "promptTemplates": [...],
    "rounds": [...],
    "decisions": [...],
    "compatibilityNotes": [...],
    "updatedAt": "2026-03-15T10:00:00Z"
  }
}
```

Behavior on import in 0.7.0:
- `extractAppState` recognizes the legacy envelope and returns
  `exportType: 'legacy'`.
- Migration runs the full chain `0.4 → 0.5 → 0.6 → 0.7` (each a
  structural no-op for this shape) and emits notices including
  `LEGACY_ENVELOPE_DETECTED`.
- Validation emits a `LEGACY_FORMAT_DETECTED` warning so the user
  sees the envelope shape distinct from the migration trail.

### A schemaVersion-less raw paste

```json
{
  "activeProjectId": "p1",
  "projects": [{ "id": "p1", "name": "Untitled", "..." }],
  "rounds": [],
  "decisions": [],
  ...
}
```

Behavior on import in 0.7.0:
- `extractAppState` falls back to the raw-AppState branch.
- `detectSourceVersion` returns `0.0.0-unknown` (no schemaVersion,
  no envelope hint).
- Migration emits `SOURCE_VERSION_UNKNOWN` and skips transforms.
- Validation runs on the input as-is. If structure is otherwise
  intact, normalization fills defaults.

---

## How import validation handles older exports

`validateImportedState()` is liberal about envelope shape and conservative
about content:

| Envelope shape                                    | Behavior |
|--------------------------------------------------|----------|
| `{ exportType, payload: { appState } }`          | Phase 5+ — accepted as the canonical form. |
| `{ schemaVersion, exportedAt, appState }`        | Phase 3/4 legacy — accepted with `LEGACY_FORMAT_DETECTED` warning. |
| `{ schemaVersion, projects, ... }` (raw AppState)| Direct paste of stored state — accepted. |
| Anything else                                     | `APP_STATE_MISSING` error — import rejected. |

`schemaVersion` mismatches between the import file and the running app
produce `SCHEMA_MISMATCH` (warning), not an error. Normalization is the
mechanism that makes mismatched data safe.

---

## How normalization repairs missing fields

`normalizeImportedState()` only ever performs **safe** repairs. The full
list of permitted repairs is:

- Missing top-level array → empty array.
- Missing `locked` on a round → `false`.
- Missing `status` on a prompt → inferred from `copiedAt` presence
  (`copied` if a `copiedAt` exists, else `generated`).
- Missing `status` on a response → inferred from `responseText` presence
  (`pasted` if non-empty, else `awaiting_response`).
- Missing timestamp (`createdAt`, `updatedAt`, `generatedAt`, `pastedAt`,
  `MediatorSynthesis.updatedAt`) → `now`.
- Missing `id` on a recovered prompt/response/round → `generateSafeId()`
  with a `recovered-` prefix so the origin is greppable.
- `activeProjectId` pointing to a missing project → first project's id,
  or `null` if there are no projects.

Every repair is recorded in the `repairs[]` list returned by
`normalizeImportedState()` and surfaced in the import preview as
`[Auto-repair]` warnings carrying the `AUTO_REPAIR_APPLIED` code.

---

## What must NEVER be fabricated during repair

Normalization must not invent substantive content. Specifically:

- **Project content** — `description`, `currentPhase`, `canonicalState`
  default to empty string, not to plausible-looking text.
- **Decision content** — `decisionText`, `rationale` are passed through
  as-is. If a decision is malformed enough to be missing these fields,
  the empty/missing values stay empty.
- **Mediator output** — `mediatorPrompt`, `mediatorResponse`, and every
  field of `MediatorSynthesis` default to empty string.
- **Model responses** — `responseText` defaults to empty string. Status
  is inferred from the presence of text, but the text itself is never
  generated.
- **Compatibility notes / prompt templates / model profiles** — passed
  through; no field-level repair.

If you find yourself adding a fallback that contains user-facing prose,
stop. That belongs in `data/initialAppState.ts` or in user input, not in
normalization.

---

## When to reject an import vs warn

| Situation                                            | Severity |
|------------------------------------------------------|----------|
| JSON unparsable                                      | error    |
| `appState` cannot be located in the envelope         | error    |
| A required top-level array is present but not an array | error  |
| `round.projectId` does not match any project         | error    |
| `decision.projectId` does not match any project      | error    |
| `decision.roundId` does not match any round          | warning  |
| `activeProjectId` does not match any project         | warning (will be repaired) |
| Schema version differs from app                      | warning  |
| Required top-level array missing entirely            | warning (will be created empty) |
| Field-level defaults applied                         | warning  |
| Auto-repairs from dry-run normalization              | warning  (`AUTO_REPAIR_APPLIED`) |

Errors block confirmation. Warnings are visible in the import preview but
do not block the user from proceeding once they have backed up.

---

## How to add a new schema field safely

The schema follows an additive philosophy. Renaming or removing fields is
a breaking change; adding optional fields is not.

1. **Decide whether the field is optional or required.**
   - If you can write a sensible default value at normalization time
     without inventing user content, it can be required.
   - Otherwise, prefer optional (`fieldName?: T`).

2. **Add the field to the appropriate `src/types/*.ts` file.**
   Use `?` for optional. Add a comment describing the field's purpose
   and any invariants.

3. **Update normalization in `src/utils/validation.ts`.**
   - For required fields: extend the relevant `normalize<Collection>`
     helper to default the field. Push a `FIELD_DEFAULTED` issue if the
     default replaces a missing value, or a `TIMESTAMP_DEFAULTED` issue
     for date fields.
   - For optional fields: pass through as-is. No repair needed.

4. **Update validation in `src/utils/validation.ts` if the field has
   referential integrity constraints** (e.g. it points at another id).
   Add a new `ValidationCode` if appropriate.

5. **Bump `SCHEMA_VERSION`** in `src/config/exportFormats.ts` if the
   change is observable in exports. Bump only the patch component
   (`0.6.x`) for additive changes; bump minor (`0.x.0`) for changes that
   change the meaning of existing fields; reserve major (`x.0.0`) for
   breaking changes.

6. **Bump app/package versions in lockstep:**
   - `package.json` `version`
   - Run `npm install --package-lock-only` to refresh `package-lock.json`
   - `src/utils/jsonExport.ts` `APP_VERSION`

7. **Document the change in this file** under a new `## What changed by
   version` subsection, listing the new field, its type, and the
   default value normalization assigns.

8. **Update `docs/DATA_MODEL.md`** to reflect the new field.

---

## How to preserve backward compatibility

- Treat `extractAppState()` as the seam for envelope evolution. New
  envelope shapes go there, with a corresponding warning code if the
  shape is "legacy" relative to the current export format.
- Treat the per-collection `normalize*` helpers as the seam for field
  evolution. Defaults and inferences live there.
- Never mutate the raw input. Build new objects; the input may still be
  inspected later by validation.
- Never throw exceptions out of `validateImportedState` or
  `normalizeImportedState`. Both are called by UI surfaces (Export/Import
  panel, Recovery panel) that must not crash.

---

## How to update docs when schema changes

When `SCHEMA_VERSION` is bumped, update — in this order:

1. `docs/SCHEMA_EVOLUTION.md` (this file): add a subsection under
   "What changed by version" describing the change.
2. `docs/DATA_MODEL.md`: update the field listing and version reference.
3. `docs/PHASE_HISTORY.md`: add the phase entry that introduced the change.
4. `docs/MAINTAINABILITY.md`: only if the change adds a new safe/unsafe
   edit pattern.
5. `README.md`: bump the version line at the bottom; add a one-line
   summary of the phase if appropriate.

---

## Expected path to v1.0.0

`1.0.0` is reserved for the first public-stable release: the schema is
frozen, exports from `1.0.x` are guaranteed to import into all future
`1.x` versions without lossy normalization, and Phase 9
release-candidate hardening is complete.

Until `1.0.0`:

- Additive optional fields can land in patch versions (`0.6.x`).
- Renames and required-field changes require a minor bump (`0.7.0`,
  `0.8.0`) and a documented migration in this file.
- Storage key: current key is `roundtable.appState.v1` (renamed from
  `mrc.appState.v0` in Phase 9 — see 0.9.0 → 0.10.0 entry below).
  Future key changes will be documented here with migration guidance.

---

## Note for future AI implementation models

Schema changes that you cannot see in this document and in
`docs/PHASE_HISTORY.md` did not happen. Do not infer schema fields from
`AppState` usage in components, do not "round up" partial fields into
plausible-looking new fields, and do not assume a field's existence
from its name. When in doubt, leave it alone and ask the user.

---

## 0.9.0 → 0.10.0 (Phase 9)

**Phase:** Phase 9 — Release Candidate Hardening and RoundTable Rename

**AppState shape:** Unchanged. 0.10.0 uses the same AppState data model as 0.9.0.

**What changed:**

- User-facing app name: "Model Roundtable Console / MRC" → **RoundTable**
- Storage key: `mrc.appState.v0` → `roundtable.appState.v1`
- JSON export `exportType`: `mrc.fullProjectExport` → `roundtable.fullProjectExport`
- JSON export `appName`: `"Model Roundtable Console"` → `"RoundTable"`
- Export filename prefix: `MRC_` → `ROUNDTABLE_`
- Vite dependency upgraded to 6.4.2 (resolves esbuild advisory)
- No AppState field additions or removals

**Migration notes:**

No legacy localStorage migration was added because the app had not been used operationally. Any existing dev/test data saved under `mrc.appState.v0` will not be loaded by default. To recover old dev data:
1. Open browser DevTools → Application → Local Storage
2. Find key `mrc.appState.v0` → copy value
3. Save to a `.json` file
4. Use RoundTable's Import function to restore

**Backward import compatibility:**

- Old MRC JSON exports (`exportType: "mrc.fullProjectExport"`) still import correctly through `extractAppState()` — the envelope parser accepts any envelope with a valid `payload.appState` regardless of `exportType` string.
- Phase 7 migration engine (0.4.0 → 0.5.0 → 0.6.0 → 0.7.0 → 0.8.0 → 0.9.0 → 0.10.0) remains intact.
- Future-schema rejection (UNSUPPORTED_SCHEMA_VERSION) remains intact.

**Schema version check (SCHEMA_VERSION):** `0.10.0`

---

## 0.10.0 → 0.10.1 (v0.10.1 operational fix)

**Phase:** v0.10.1 — Project Lifecycle Operational Fix

**AppState shape:** Minimal change. Added two optional fields to `Project`.

**What changed:**

```typescript
// Project type — new optional fields (v0.10.1)
archived?: boolean;    // defaults to false for existing projects
archivedAt?: string | null;  // ISO timestamp or null
```

All other AppState fields unchanged.

**Normalization:** `normalizeImportedState()` in `validation.ts` defaults `archived: false, archivedAt: null` for projects that don't have these fields. Older exports remain fully importable.

**New utilities:** `src/utils/projectUtils.ts` — pure lifecycle functions (no new AppState top-level keys).

**Schema version check (SCHEMA_VERSION):** `0.10.1`

---

## 0.10.1 → 0.10.2 (v0.10.2 lifecycle gate fix)

**Phase:** v0.10.2 — Project Lifecycle Gate Cleanup

**AppState shape:** Unchanged from 0.10.1. No new fields added.

**What changed:**

Behavior fix in `src/utils/projectUtils.ts`:

`archiveProject()` and `deleteProject()` now guarantee that `activeProjectId` is **never left null** after the operation:

- If the archived/deleted project was the active project **and** another non-archived project exists → switch to that project.
- If the archived/deleted project was the active project **and** no other non-archived project exists → a blank fallback project ("Untitled Project") is automatically created and set as active.

This is a runtime-behavior fix. No AppState schema fields changed. Older exports import identically to v0.10.1.

**Schema version check (SCHEMA_VERSION):** `0.10.2`

---

## 0.10.5 → 0.11.0 (v0.11.0 Markdown Handoff Mode)

**Phase:** v0.11.0 — Markdown Handoff Mode (Checkpoints A–I).

**AppState shape:** **First structural change since Phase 7B / 0.8.0.**
Adds two new top-level arrays — both bounded ring buffers, both
defaulted to `[]` for older states.

```typescript
// AppState — new top-level fields in v0.11.0
interface AppState {
  // ... all 0.10.5 fields unchanged
  rawNotes: RawNote[];                  // NEW — fallback substrate
  importHistory: ImportTransaction[];   // NEW — commit log with rollback snapshots
}
```

**New supporting types (all in `src/types/markdownArtifact.ts`):**

- `MarkdownArtifactSourceKind` — `'generated_prompt' | 'model_response' | 'mediator_packet' | 'mediator_synthesis' | 'raw_notes'`.
- `MarkdownArtifactFrontmatter` — the frontmatter shape stamped on
  every Markdown handoff file. Field order is locked; serialization
  goes through `serializeFrontmatterYaml` in `markdownArtifact.ts`.
- `BuiltArtifact` — the return shape of `buildArtifact()`. Carries
  `frontmatter`, `body`, and `fullText`.
- `ImportPreview` — what `buildImportPreview()` returns; includes
  the warning list and `availableOutcomes` (`'commit' | 'import_as_raw' | 'cancel'`).
- `ImportTransaction` — one committed import with `snapshotBefore`,
  `changes`, and (when rolled back) `rolledBackAt` / `rollbackReason`.
- `RawNote` — one fallback-substrate entry. `rawBody` is preserved
  verbatim (NOT normalized).
- `ImportValidationWarning`, `ImportWarningCode`,
  `ImportWarningSeverity` — typed warning surface used by the
  preview modal.

**New artifact format:** `roundtable.markdown.v1`, defined as
`ARTIFACT_TYPE` in `src/config/exportFormats.ts`. Treat any change
to this string as a breaking format change. Readers reject unknown
`artifact_type` values; older-major artifacts (none exist yet)
would route through a future migration analogous to the AppState
migration engine.

**New optional field on `GeneratedPrompt`:** `canonicalStateHashAtGeneration?: string`.
Captured when the prompt is generated; used by Markdown Handoff
Mode to stamp matching artifact frontmatter so importers can
detect when a file was generated under different project state.
Missing on pre-v0.11.0 prompts; their stale-state badge silently
skips rather than emitting a false positive (per the "do not
invent substantive content" rule).

**Migration step:** `migrate_0_10_5_to_0_11_0` in
`src/utils/migration.ts`. Idempotent. Defaults `rawNotes` and
`importHistory` to `[]` when absent. Emits
`MIGRATION_STEP_APPLIED` notices for both additions.

**Backward import compatibility:**

- v0.10.5 JSON exports (no `rawNotes` / `importHistory`) migrate
  cleanly — both arrays default to `[]`.
- Older v0.10.x / v0.9.x / v0.8.x JSON exports follow the existing
  chain (0.7.0 → 0.8.0 → ... → 0.10.5 → 0.11.0). The Markdown
  Handoff migration is appended to the end of the chain.
- Future-schema rejection (`UNSUPPORTED_SCHEMA_VERSION`) remains
  intact for both JSON imports AND Markdown handoff imports — a
  `.md` file declaring `schema_version: 99.0.0` is rejected for
  structured commit but can still be saved as a Raw Note.

**Locked constants (must not move without a documented edit):**

- `ARTIFACT_TYPE = 'roundtable.markdown.v1'`
- `RAW_NOTES_DEFAULT_CAP = 200`
- `IMPORT_HISTORY_DEFAULT_CAP = 50`
- `STORAGE_WARN_BYTES = 3_500_000` (~3.34 MB)
- `STORAGE_HARD_BYTES = 4_250_000` (~4.05 MB)
- `MARKDOWN_FILE_ACCEPT = '.md,.markdown,text/markdown'`
- `TRUNCATION_TERMINATORS` — 13 characters (`. ! ? ) ] > ` ` " ' ” ’ 】 。`)

All seven are read-only by the rest of the codebase. The
acceptance walk (`scripts/acceptance-walk.ts`) asserts they
haven't moved.

**No network surfaces introduced.** v0.11.0 adds zero
`fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` /
`RTCPeerConnection` / `sendBeacon` call sites. The acceptance
walk's shell grep confirms `src/` contains no network primitives
beyond static config URLs in `modelProfiles.ts`.

**Schema version check (SCHEMA_VERSION):** `0.11.0`

See `docs/MARKDOWN_HANDOFF.md` for the operator-facing reference,
`docs/DATA_MODEL.md → v0.11.0 Markdown Handoff Fields` for the
typed-field reference, `docs/PHASE_HISTORY.md → v0.11.0` for the
delivery chronology, and `docs/RELEASE_CHECKLIST.md → v0.11.0
Acceptance Walk` for the operator manual-verification list.
