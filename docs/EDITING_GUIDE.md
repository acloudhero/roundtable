# Editing Guide

RoundTable — Phase 7B

This is the quick safe/unsafe-edit checklist. For deeper orientation,
see `docs/MAINTAINABILITY.md`.

## Safe Edits

### Configuration (`src/config/`)

Add model profiles, prompt templates, prompt wrappers (Phase 7B),
compatibility notes, compatibility tests (Phase 7B) — all auto-
propagate to the relevant panels and prompt generation.

### `src/config/promptWrappers.ts` (Phase 7B)

- Add new wrappers; edit existing ones.
- Bump a wrapper's `version` when its behavior changes materially.
- Set `active: false` to retire a wrapper without deleting it
  (existing rounds may still reference it indirectly via
  `ModelProfile.defaultPromptWrapperId`).

Never:
- Rename or remove `wrapper-generic` (`GENERIC_WRAPPER_ID`). It is
  referenced as the safe fallback by `migration.ts` and
  `promptGeneration.ts`. If you really must rename it, update both
  files in the same change.

### `src/config/compatibilityTests.ts` (Phase 7B)

- Add new tests; edit existing ones.
- Keep tests focused on a single behavior; reproducible; brief.

Never:
- Add execution / submission / network behavior. These are paste-
  only prompts.

### `src/utils/mediatorExtract.ts`

- Add entries to HEADING_MAP to support alternate heading spellings.
- Add new field labels to SYNTHESIS_FIELD_LABELS.

### `src/utils/mediatorPacket.ts`

- Update section wording.
- Add new context sections (known risks and open questions are already
  included).

### `src/utils/roundUtils.ts`

- Add new pure utility functions.
- Extend RoundProgress fields.
- Never call StorageAdapter here — return new objects only.

### `src/utils/id.ts`

- Add new helpers built on `generateSafeId` if a specific entity needs
  a more constrained ID format. Don't add a UUID dependency — Web
  Crypto plus the existing fallback covers every browser RoundTable supports.

### `src/utils/migration.ts` (Phase 7A)

- Add a new step to `MIGRATION_CHAIN` when the AppState shape changes.
  Each step is a small `migrate_X_Y_to_X_Z(state)` function. If the
  shape did not change between adjacent versions, just `return state` —
  the chain still emits a `MIGRATION_STEP_APPLIED` notice for
  observability.
- Add new `MIGRATION_CODES` entries for new notice categories.
- Tighten heuristics in `detectSourceVersion()` if a new envelope
  shape needs detection.

Never:
- Fabricate substantive content (decisions, rationale, model
  responses, mediator output, canonical state, descriptions,
  compatibility-note text). Migrations are about shape, not substance.
- Throw exceptions out of `migrateAppState()`. Bad shapes become
  validation issues, not crashes.
- Discard fields you don't recognize. Pass them through; let
  validation decide.

### `src/utils/validation.ts` (additive only)

- Add new entries to `VALIDATION_CODES` for new issue types. Use
  UPPER_SNAKE_CASE. Reference codes via `VALIDATION_CODES.X` rather
  than hardcoded strings — same value, but greppable and rename-safe.
- Extend a `normalize<Collection>` helper to default a new optional
  field. Push a `FIELD_DEFAULTED` (or `TIMESTAMP_DEFAULTED`) issue if
  the default replaces a missing value.
- Behavior-equivalent refactors of helpers.

### `src/utils/markdownExport.ts` — Gemini Review Packet (Phase 7A)

- Edit the inline questions in `exportGeminiReviewPacket()` to refine
  default reviewer prompts. Keep them inline rather than moving them
  to a config file — it's the same pattern as the mediator packet and
  keeps reviewer-facing content greppable.
- Adjust the packet's section ordering or wording for clarity.
- Wrap any new user/model content with `fence()` for dynamic tilde
  fencing.

Never:
- Add a "send to Gemini" button or any network call. The packet is
  always a local Markdown file. The user carries it to the reviewer
  manually.
- Replace `fence()` with naive triple-backtick fencing. That is the
  exact regression Phase 5.1 fixed.

### Demo data / Docs / Styles

Edit freely. Keep version references consistent.

## Unsafe Edits

### MediatorSynthesis field renames

Renaming fields breaks stored synthesis data. Add new optional fields
instead.

### Auto-applying canonical state

Never update `Project.canonicalState` without explicit user
confirmation. The only authorized path is `applyCanonicalStateUpdate()`
called from DecisionLogPanel.

### Scattering prompt logic

- Prompt generation: `src/utils/promptGeneration.ts` only.
- Mediator packet: `src/utils/mediatorPacket.ts` only.
- Synthesis extraction: `src/utils/mediatorExtract.ts` only.

### Draft-transfer buttons

"Use as draft" buttons must only fill editable fields. They must never:

- Lock a round.
- Call onUpdate with a state change.
- Apply canonical state.

These actions require explicit user confirmation.

### Validation firewall

- Never bypass `parseImportJson` → `extractAppState` →
  `migrateAppState` → `validateImportedState` →
  `normalizeImportedState`.
- Never weaken `ORPHANED_ROUND` or `ORPHANED_DECISION_PROJECT` to a
  warning.
- Never remove the dry-run normalization that surfaces auto-repairs in
  the import preview.
- Never throw exceptions out of validation or migration — the UI must
  not crash.
- Never collapse the four import-preview groups
  (Errors / Migrations / Warnings / Auto-repairs) into a single list.
  Each group answers a different question: what blocks confirm, what
  already happened to the payload, what needs review, what will
  happen on confirm.

### Recovery panel

- Never silently clear corrupted state on entry.
- Never remove either of the two no-DevTools rescue actions
  (download, copy).
- Never skip validation in the "Validate & Restore from Backup" path —
  recovery imports flow through the same migration + validation
  pipeline as regular imports.

### Markdown export fencing

`fence()` in `src/utils/markdownExport.ts` uses dynamic tilde fencing
specifically so that user/model content containing triple-backticks
does not break the export. Don't replace it with naive
triple-backticks.

### Schema fields

Adding optional fields is safe. Renaming or removing fields is a
breaking change. See `docs/SCHEMA_EVOLUTION.md` and add a migration
step per `docs/MAINTAINABILITY.md → How to add a migration step`.

### Gemini Review Packet — local-only boundary

The review packet is **local Markdown only**. Never:

- Add network behavior of any kind to its export path.
- Add an "auto-send" or "auto-upload" affordance.
- Embed credentials or session info in the packet.
- Bypass the dynamic tilde fencing for user/model content.

## How to Reset Local Data

Browser DevTools → Application → Local Storage → delete
`roundtable.appState.v1`. Or, from inside the app: Export / Import tab →
Reset to Demo Data. (Recovery Mode also exposes the same path.)

## Dependency Audit Advisory

`npm audit` reports moderate Vite/esbuild dev-server advisories.
Do not run `npm audit fix --force` — may break Vite. Deferred to
Phase 9 release-candidate hardening.

## Import/Export Safety Rules

### Never call onUpdate() during import without validation

- Always run `parseImportJson()` → `validateImportedState()` →
  `normalizeImportedState()` first. Migration runs automatically
  inside both validation and normalization since Phase 7A.
- Never silently overwrite AppState from raw file content.

### validation.ts is the firewall

- All import logic goes through `validation.ts` before touching state.
- Do not add "fast path" imports that bypass validation.
- Phase 7A: read `result.issues` (typed) and `result.migrations`
  (typed) for new UI work; the legacy `result.errors` /
  `result.warnings` strings remain for backward compatibility.

### Backup-before-import is required

- The UI enforces a backup step before confirming import.
- Do not remove or weaken this step.

### ID generation

- New code: use `generateSafeId(prefix)` from `src/utils/id.ts`.
- Avoid inline `Math.random().toString(36)` patterns. The whole point
  of centralizing ID generation is so future browsers / fallbacks /
  safety improvements only have to be made in one place.

## How to Add a Future Migration (Phase 7A)

When the AppState shape actually changes:

1. Bump `SCHEMA_VERSION` in `src/config/exportFormats.ts` and the
   matching app/package versions following the version-bump checklist
   in `docs/MAINTAINABILITY.md`.
2. In `src/utils/migration.ts`, write a small
   `migrate_X_Y_to_X_Z(state: Record<string, unknown>): Record<string, unknown>`
   function. Keep it minimal. If the schema didn't change between
   adjacent versions, just `return state` — the chain still emits a
   notice.
3. Append the step to `MIGRATION_CHAIN` in version order.
4. If the transform introduces a new field that the rest of the
   pipeline needs to default, also add a branch in the relevant
   `normalize<Collection>` helper in `src/utils/validation.ts`.
5. Document the change in `docs/SCHEMA_EVOLUTION.md → What changed
   by version`.
6. Migrations must never fabricate substantive content (same rule as
   normalization). Migrations are about shape, not substance.

## How to Update ValidationCode Safely

`VALIDATION_CODES` is a frozen object exported from
`src/utils/validation.ts`. The derived `ValidationCode` type is a
literal union of its values.

- **Adding a code** is safe. Append a new entry to the object,
  document its meaning in the file's header comment block, and use
  it via `VALIDATION_CODES.YOUR_NEW_CODE`.
- **Renaming a code** is a breaking change for any UI or tooling
  that filters on it. Avoid unless versioning the change.
- **Removing a code** is a breaking change. Don't.
- **Reusing a code value with new meaning** is the worst option.
  Don't.

The same rules apply to `MIGRATION_CODES` in `src/utils/migration.ts`.

---

## Phase 8 CSS Guide

New CSS classes added in Phase 8 (src/styles/app.css):

**Status / State:**
- `.workflow-chip.locked/.active/.prompted/.collecting/.synthesizing/.decided` — inline round status
- `.round-locked-banner` — prominent locked round indicator
- `.round-active-banner` — active round indicator
- `.copy-confirm` — inline badge for copy/save feedback (animates in, no layout shift)
- `.next-step-cue` — clickable contextual next-step prompt

**Workflow:**
- `.step-label` / `.step-number` — numbered step headers
- `.progress-bar-wrap` / `.progress-bar-fill.complete/.partial` — progress bars
- `.compat-warning.severity-high/.severity-medium/.severity-low` — expandable compat warnings

**Model / Template display:**
- `.model-profile-card` / `.model-profile-header` / `.model-profile-meta` / `.model-profile-body` — profile layout
- `.wrapper-tag` — prompt wrapper ID badge
- `.template-card` / `.template-header` / `.template-meta` / `.template-body` / `.template-changelog` — template layout
- `.compat-test-item` / `.compat-test-header` — compatibility test display

**Export / Import:**
- `.export-grid` / `.export-item` / `.export-item-label` / `.export-item-desc` — Markdown export grid
- `.export-section-title` — section header within export panel
- `.import-diff-table` — import preview diff table

**Empty states:**
- `.empty-state` / `.empty-state-icon` / `.empty-state-title` / `.empty-state-desc` — consistent empty state layout

**Mobile:**
- All button heights are min 44px (Apple HIG touch target).
- Form inputs use 16px font on mobile to prevent iOS auto-zoom.
- Workbench/grid goes single-column at ≤700px.
- Tab nav uses smaller font and padding at ≤640px.
