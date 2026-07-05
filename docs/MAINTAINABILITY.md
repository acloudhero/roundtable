# Maintainability Guide

RoundTable — practical orientation for anyone editing the
codebase. Written for:

- future AI implementation models
- nontraditional developers
- the product owner returning after time away

This document is deliberately practical. It tells you where things live,
which edits are safe, which edits are risky, and how to test changes
without breaking the local-first guarantees that make RoundTable trustworthy.

If a thing isn't documented here, it isn't an established pattern.
Don't invent one.

---

## What RoundTable is, in two sentences

RoundTable is a local-first, browser-based cockpit for coordinating multiple
consumer AI models via **manual copy/paste** workflows. It has no
backend, no API keys, no scraping, no browser automation, and no cloud
sync — and it must stay that way.

---

## Map of the codebase

```
src/
  components/    UI panels, one per top-level tab
  config/        Static configuration: model profiles, prompts, notes
  data/          Demo data and INITIAL_APP_STATE
  storage/       StorageAdapter interface + localStorage implementation
  styles/        app.css (single stylesheet, no framework)
  types/         TypeScript interfaces (AppState, Round, Project, ...)
  utils/         Pure utilities (validation, exports, prompts, mediator)

docs/            Internal documentation (you are here)
```

The app entry point is `src/main.tsx` → `src/App.tsx`. App.tsx wires
state, recovery mode, and the panel switcher.

---

## Major code areas at a glance

| Area | File(s) | Owns |
|---|---|---|
| Top-level state | `src/App.tsx` | Single `AppState`, recovery-mode gate, tab routing |
| Storage | `src/storage/localStorageAdapter.ts` | `load`, `save`, `clear`, `loadWithRecovery`, `loadRaw`, `preserveCorrupted` |
| Storage seam | `src/storage/storageAdapter.ts` | The `StorageAdapter` interface — swap localStorage for IndexedDB later without changing UI |
| Schema | `src/types/*.ts`, `src/config/exportFormats.ts` | TypeScript shape + `SCHEMA_VERSION` |
| Initial state | `src/data/initialAppState.ts` | Demo data shipped with a fresh install |
| Prompt generation | `src/utils/promptGeneration.ts` | Context Sandwich + Phase 7B wrapper layer (one place, no scattering) |
| Prompt wrappers (Phase 7B) | `src/types/promptWrapper.ts`, `src/config/promptWrappers.ts` | Vendor-specific framing layer; `GENERIC_WRAPPER_ID` is the canonical fallback |
| Compatibility tests (Phase 7B) | `src/types/compatibilityTest.ts`, `src/config/compatibilityTests.ts` | Manual paste-into-model behavior tests |
| Mediator packet | `src/utils/mediatorPacket.ts` | The exact packet sent to GPT-5.5 |
| Mediator extraction | `src/utils/mediatorExtract.ts` | Parses GPT-5.5 response into `MediatorSynthesis` fields |
| Round transitions | `src/utils/roundUtils.ts` | Pure state-transition functions (`createRound`, `markPromptCopied`, ...) |
| Validation firewall | `src/utils/validation.ts` | Parse / extract / validate / normalize import payloads; `VALIDATION_CODES` |
| Migration engine | `src/utils/migration.ts` | Version-aware structural transforms; `MIGRATION_CODES` |
| JSON export | `src/utils/jsonExport.ts` | Envelope, filenames, `downloadText`, `downloadBackup` |
| Markdown export | `src/utils/markdownExport.ts` | 9 Markdown export shapes with dynamic tilde fencing (incl. Gemini Review Packet) |
| ID generation | `src/utils/id.ts` | `generateSafeId` / `generateId` (Web Crypto + fallback) |
| Recovery UX | `src/components/RecoveryPanel.tsx` | Shown when localStorage is malformed |
| Export/Import UX | `src/components/ExportImportPanel.tsx` | Two-section panel: exports + 4-stage import flow |

---

## Safe edit zones

Edits in these areas are routine and rarely break invariants:

### Configuration (`src/config/`)

- `modelProfiles.ts` — add/edit/remove model profiles. They flow to the
  Model Roster automatically.
- `promptTemplates.ts` — add/edit prompt templates. They appear in the
  Prompt Library automatically.
- `compatibilityNotes.ts` — add notes. `active` notes are auto-included
  in generated prompts for matching models.

### Demo data (`src/data/`)

- `demoProject.ts`, `demoRounds.ts`, `initialAppState.ts` — change demo
  fixtures freely. They only affect first-load and "Reset to Demo Data".

### Markdown export shapes (`src/utils/markdownExport.ts`)

- Adjusting wording, section ordering, or adding new export types.
- Wire any new export type through `ExportImportPanel.tsx`.

### Mediator extraction map (`src/utils/mediatorExtract.ts`)

- Add heading aliases to support alternate `### ` heading spellings.

### Documentation (`docs/`)

- All documentation is editable. Keep version references consistent
  (see SCHEMA_EVOLUTION.md for the propagation order).

### Styling (`src/styles/app.css`)

- Single stylesheet, no preprocessor. Add classes; avoid removing ones
  that are referenced by component code.

---

## Risky edit zones

These areas concentrate invariants. Touch carefully and read the file
header comment first.

### `src/utils/validation.ts`

Risk: this file is the import firewall. Mistakes here can silently
overwrite local state. Specific danger zones:

- The referential-integrity checks for `round.projectId` and
  `decision.projectId` (must remain hard errors).
- The dry-run normalization that surfaces `[Auto-repair]` warnings to
  the import preview (must run before the user confirms).
- The `extractAppState` envelope handling (must continue to accept the
  three legacy/raw/Phase 5+ shapes).
- Normalization helpers (must not fabricate substantive content — see
  SCHEMA_EVOLUTION.md).

### `src/storage/localStorageAdapter.ts`

Risk: corrupted state should open RecoveryPanel, not crash. Don't change
`loadWithRecovery` to throw. Don't silently clear corrupted data.

### `src/components/ExportImportPanel.tsx`

Risk: the 4-stage import flow exists to make accidental data loss
nearly impossible. Don't merge stages. Don't enable Confirm while
errors are present. Don't bypass the backup gate.

### `src/components/RecoveryPanel.tsx`

Risk: if Recovery Mode mishandles the corrupted blob, the user loses
data. The panel must always offer at least one rescue path that does
not require DevTools (today: download + clipboard copy).

### `src/utils/markdownExport.ts`

Risk: user-authored and model-authored content is wrapped in dynamic
tilde fences (`fence()`) so embedded triple-backticks do not break the
export. Don't replace `fence()` with naive triple-backtick fencing.

### `src/utils/roundUtils.ts`

Risk: pure state transitions only. Don't call `localStorageAdapter`
from here. Don't call `onUpdate`. Return new objects; let the caller
persist.

### `src/utils/mediatorPacket.ts`

Risk: the packet format is the contract with GPT-5.5. Reordering or
removing the 12 required output sections will silently break
`mediatorExtract.ts`.

### Schema (`src/types/*.ts`, `src/config/exportFormats.ts`)

Risk: renaming or removing fields breaks stored localStorage state and
existing JSON exports. See SCHEMA_EVOLUTION.md.

---

## Where prompt logic lives

There is exactly one place per concern. Resist scattering.

| Concern | File |
|---|---|
| Per-model Context Sandwich prompt | `src/utils/promptGeneration.ts` |
| Vendor-specific wrapper layer (Phase 7B) | `src/utils/promptGeneration.ts` (resolution) + `src/config/promptWrappers.ts` (defaults) |
| Mediator packet sent to GPT-5.5 | `src/utils/mediatorPacket.ts` |
| Parsing GPT-5.5 response into structured fields | `src/utils/mediatorExtract.ts` |
| Prompt template definitions | `src/config/promptTemplates.ts` |
| Manual compatibility test prompts (Phase 7B) | `src/config/compatibilityTests.ts` |

---

## Where vendor-resilience surfaces live (Phase 7B)

When ChatGPT, Claude, Gemini, or another model changes its behavior,
the operator's manual is `docs/VENDOR_RESILIENCE.md`. The short form:

| If a model changed... | Edit |
|---|---|
| Its name, vendor, context window | `ModelProfile` field in `src/config/modelProfiles.ts` |
| Its formatting / output habits | `PromptWrapper.outputInstructions` in `src/config/promptWrappers.ts` |
| Its preferred prompt framing | `PromptWrapper.wrapperText` |
| A specific quirk worth tracking | `CompatibilityNote` in `src/config/compatibilityNotes.ts` (or AppState) |
| You need a regression test | New `CompatibilityTest` in `src/config/compatibilityTests.ts` |

The `wrapper-generic` id (exported as `GENERIC_WRAPPER_ID` from
`src/config/promptWrappers.ts`) is the safe fallback used by the
migration step (when defaulting `defaultPromptWrapperId`) and the
prompt generator (when no wrapper resolves). **Do not rename or
remove it.**

---

## Where model profiles live

`src/config/modelProfiles.ts`. The `ModelProfile` type is in
`src/types/modelProfile.ts`. Profiles are picked up automatically by
the Model Roster and prompt generation; no other files need editing
when you add a model.

---

## Where mediator packet logic lives

`src/utils/mediatorPacket.ts` builds the packet. The 12 required output
sections are baked in there. The mediator UX (paste response, extract
fields, edit) lives in `src/components/MediatorPanel.tsx`. The field
extractor is `src/utils/mediatorExtract.ts`.

---

## Where export/import logic lives

| Concern | File |
|---|---|
| JSON envelope, filenames, download helpers | `src/utils/jsonExport.ts` |
| Markdown export shapes (8 of them) | `src/utils/markdownExport.ts` |
| Dynamic tilde fencing | `fence()` in `markdownExport.ts` |
| Import parse/validate/normalize | `src/utils/validation.ts` |
| Import UI flow | `src/components/ExportImportPanel.tsx` |
| Recovery UI flow | `src/components/RecoveryPanel.tsx` |

---

## Where validation logic lives

`src/utils/validation.ts`. **All** import paths go through it. There
is no "fast path" import that bypasses validation, and there must
not be one.

The pipeline is (Phase 7A):

```
parseImportJson(text)
  → extractAppState(raw)            // envelope-aware unwrap
  → migrateAppState(state)          // version-up structural transforms
  → validateImportedState(raw)      // structural + referential checks
  → normalizeImportedState(raw)     // safe field-level defaults
```

UI flows that import state must call validation **before** writing
anything to storage. `validateImportedState` returns
`{ valid, issues, migrations, errors, warnings, summary }`; the UI
renders four groups in the import preview (Errors / Migrations /
Warnings / Auto-repairs).

`VALIDATION_CODES` is a frozen object exported from this file.
Consumers should reference codes via the object (e.g.
`VALIDATION_CODES.ORPHANED_ROUND`) rather than hardcoding strings —
the string literals are the same, but the object form makes
references greppable and survives renames.

---

## Where migration logic lives

`src/utils/migration.ts`. This file owns:

- `MIGRATION_CODES` (frozen object)
- `MigrationNotice`, `MigrationResult` types
- `detectSourceVersion()` heuristics
- `migrateAppState()` — the engine
- `MIGRATION_CHAIN` — the registry of per-version-up transforms

Migrations are the *first* transform in the import pipeline (after
envelope unwrap, before structural validation). The output of
migration is still raw/untyped — validation is the typed seam.

Migration vs repair vs validation:

- **Migration** is a version-aware structural transform. Belongs to a
  known source/target version pair. Emits `MigrationNotice`.
- **Repair** is a safe field-level default. Lives in
  `normalizeImportedState()`. Emits `AUTO_REPAIR_APPLIED` warnings.
- **Validation** is a safety check. Lives in
  `validateImportedState()`. Emits `ValidationIssue` with severity
  `error` or `warning`.

To add a migration step when the schema changes, see
`docs/SCHEMA_EVOLUTION.md → Migration engine → How to add a migration step`.

Migrations must NEVER fabricate substantive content. Same rule as
normalization. Migrations are about shape, not substance.

---

## Where recovery logic lives

| Concern | File |
|---|---|
| Detecting malformed local state | `localStorageAdapter.loadWithRecovery()` |
| Routing to Recovery Mode | `src/App.tsx` |
| Offering rescue actions to the user | `src/components/RecoveryPanel.tsx` |

The four rescue actions in Recovery Mode are: download raw corrupted
data, copy raw corrupted data, import known-good backup, reset to demo.
None of them require DevTools. None of them silently clear state.

---

## How to add a new model

1. Open `src/config/modelProfiles.ts`.
2. Append a new `ModelProfile` object. Required fields: `id`,
   `displayName`, `vendor`, `modelName`, `roleName`, `rolePrompt`,
   `promptStyleNotes`, `contextLimitNotes`, `compatibilityNotes`,
   `active`.
3. (Optional) Add an entry to `src/config/compatibilityNotes.ts` if you
   know of model-specific quirks.
4. Reload the app — the model appears in Model Roster and round-builder
   model picker automatically.

No other files need editing. See `docs/MODEL_PROFILES.md` for the
historical reasoning.

---

## How to add a new export type

### Markdown export

1. In `src/utils/markdownExport.ts`, add a new `export function
   exportSomething(state: AppState): string` that returns a Markdown
   string. Wrap any user/model content with `fence(content)`.
2. (Optional) Add a `somethingFilename(state)` helper in the same
   file or in `src/utils/jsonExport.ts`.
3. In `src/components/ExportImportPanel.tsx`, add a new entry to the
   Markdown exports grid wiring `mdDownload(exportSomething(state),
   filename)`.

### JSON export

There is one canonical full-JSON export. Don't add competing JSON
export shapes; they fragment the import path.

---

## Where Gemini Review Packet logic lives

`src/utils/markdownExport.ts` — `exportGeminiReviewPacket(state)` and
`geminiReviewPacketFilename(state)`. The button is wired in
`src/components/ExportImportPanel.tsx` as the 9th entry in the
Markdown exports grid.

The packet is **local Markdown only**. RoundTable does not call Gemini, does
not upload to Gemini, and does not automate any reviewer interaction.
The user downloads the file, edits the placeholder fields (especially
"GPT-5.5 Mediator Gate Status" and "Specific Questions for Gemini"),
and pastes the contents into Gemini themselves.

Sections in the packet (in order):

1. Review context — what we're asking Gemini to do.
2. Project metadata — name, phase, app version, schema version,
   exportedAt, GPT-5.5 mediator gate placeholder.
3. Project overview — fenced description.
4. Canonical state — fenced.
5. Latest round summary — instruction, models, response collection.
6. Mediator synthesis summary — per-field, fenced.
7. Decision status.
8. Locked status.
9. Current risks.
10. Current open questions.
11. Compatibility notes summary — counts + active list.
12. Validation/migration summary placeholder.
13. Specific questions for Gemini — user-editable defaults.
14. Known limitations.

All large user/model content uses dynamic tilde fencing via the
existing `fence()` helper.

If you want to change the questions, edit the strings in
`exportGeminiReviewPacket()` directly. Don't move them to a config
file — keeping them inline is the same pattern as the mediator packet
and keeps reviewer-facing content greppable.

---

## How to add a migration step

When the AppState shape actually changes (not the case for any 0.4 →
0.7 step, which are no-ops):

1. Bump `SCHEMA_VERSION` and the matching app/package versions
   following the version-bump checklist below.
2. In `src/utils/migration.ts`, write a small
   `migrate_X_Y_to_X_Z(state: Record<string, unknown>): Record<string, unknown>`
   function. Keep it minimal. If the schema didn't change between
   adjacent versions, just `return state` — the chain still emits a
   `MIGRATION_STEP_APPLIED` notice for observability.
3. Append the step to `MIGRATION_CHAIN` in version order.
4. If the transform introduces a new field that the rest of the
   pipeline needs to default, also add a branch in the relevant
   `normalize<Collection>` helper in `src/utils/validation.ts`.
5. Document the change in `docs/SCHEMA_EVOLUTION.md → What changed
   by version`.
6. Migrations must never fabricate substantive content (same rule as
   normalization). Migrations are about shape, not substance.

---

## How to add a new schema field

See **`docs/SCHEMA_EVOLUTION.md` → How to add a new schema field
safely** for the full checklist. Short version: prefer optional
fields, update the relevant `normalize<Collection>` helper, add a
migration step if the transform isn't already a no-op, bump
`SCHEMA_VERSION`, document the change.

---

## How to update validation when adding fields

In `src/utils/validation.ts`:

- For a field with no integrity constraints: extend the relevant
  `normalize<Collection>` helper to default it. No new validation logic
  needed.
- For a field that points to another id: add a referential check in
  `validateImportedState` that pushes a new typed `ValidationIssue`
  with an appropriate `ValidationCode`. Decide error vs warning using
  the rules in SCHEMA_EVOLUTION.md.
- For a field with type constraints (must be array, must be one of a
  set of strings, etc.): add a structural check in
  `validateImportedState` and a defaulting branch in the corresponding
  normalizer.

Always add a `ValidationCode` for new issue types. Keep messages
user-friendly; the `code` is for tooling, the `message` is for humans.

---

## How to test import/export manually

There is no automated test suite yet (deferred to Phase 9). Manual
testing checklist:

### Round-trip JSON

1. Fresh demo data → Export / Import → Download JSON Backup.
2. Reset to Demo Data.
3. Export / Import → Import → paste the file → validate.
4. Confirm import.
5. Verify all rounds, decisions, canonical state, model roster, and
   compatibility notes match the original.

### Validation rejects malformed input

Try each of the following and confirm the import preview shows a
specific error:

- Empty string → JSON parse error.
- `"hello"` → APP_STATE_MISSING.
- A valid JSON envelope where `appState.projects` is `"foo"` instead
  of an array → REQUIRED_ARRAY_INVALID.
- An export where one of `state.rounds` references a `projectId` that
  isn't in `state.projects` → ORPHANED_ROUND error.

### Validation surfaces auto-repairs

Take a valid export and corrupt one round's `locked` field to a
string. Validate. Confirm the preview shows an `[Auto-repair]` warning.

### Recovery Mode

In DevTools → Application → Local Storage, set `roundtable.appState.v1` to
`{not json`. Reload. Confirm Recovery Mode appears with all four
rescue actions (download, copy, import, reset).

### Markdown fencing

Paste a model response that contains literal triple-backticks (```` ``` ````)
into a round. Export Project History. Open the exported `.md` file.
Confirm the response is wrapped in `~~~~` fences (4+ tildes) and that
the embedded triple-backticks render literally — not as a runaway
fence that breaks the rest of the document.

---

## What NOT to automate

RoundTable's design is **explicit user agency**. The following must remain
manual:

- Copying generated prompts to the clipboard (user clicks).
- Pasting model responses (user pastes; `pastedAt` is recorded).
- Generating the mediator packet (user clicks; user pastes into GPT-5.5).
- Pasting the mediator response back (user pastes).
- Editing extracted synthesis fields (user reviews and edits).
- Recording a decision (user types or uses a draft-transfer).
- Updating canonical state (user explicitly checks "Apply" and
  confirms).
- Locking a round (two-click confirmation).

Do not add a button or shortcut that performs more than one of these
in a single click. The audit trail and the user's confidence both
depend on the explicitness of these steps.

Do not add API calls, scraping, browser automation, login automation,
backend services, cloud sync, or AI-provider integrations. These are
explicitly out of scope and any future Phase that proposes them must
state so on the front page of its plan.

---

## Versioning checklist when bumping the version

Whenever you change `SCHEMA_VERSION` (or do a phase release):

- [ ] `package.json` `version`
- [ ] `src/config/exportFormats.ts` `SCHEMA_VERSION`
- [ ] `src/utils/jsonExport.ts` `APP_VERSION`
- [ ] Run `npm install --package-lock-only` to refresh `package-lock.json`
- [ ] `README.md` version line at the bottom
- [ ] `docs/PHASE_HISTORY.md` add the phase entry; flip the previous
      `(Current)` to `(Completed)`
- [ ] `docs/SCHEMA_EVOLUTION.md` add a "What changed by version"
      subsection if shape or pipeline changed
- [ ] `docs/DATA_MODEL.md` if any field shape changed
- [ ] If the AppState shape changed, add a migration step in
      `src/utils/migration.ts` (`MIGRATION_CHAIN`) and document it
      in `docs/SCHEMA_EVOLUTION.md → Migration engine`
- [ ] If model/vendor/wrapper/template/test/note types changed,
      update `docs/VENDOR_RESILIENCE.md` so future operators know
      where the new field lives
- [ ] Run `npm run build` and confirm 0 TS errors

---

## When in doubt

- Read the file header comment of the file you're editing. They are
  written to be read in isolation.
- If a feature would weaken any of the local-first guarantees, stop
  and ask the product owner.
- If a refactor proposes a "framework", "abstraction", "registry", or
  "strategy pattern" that does not exist yet, ask whether a few
  helper functions would do the job instead. The Phase 6 pass
  deliberately preferred helpers over abstractions.

---

## Phase 8 Maintainability Notes

### Mobile workflow

RoundTable is designed for use on a phone while switching between RoundTable and external model interfaces (ChatGPT, Claude.ai, Gemini). The mobile workflow is:

1. Open RoundTable on your phone browser (localhost, or serve via LAN).
2. Go to Round Builder → generate prompts.
3. Switch to your model interface app/browser tab.
4. Paste the prompt. Get the response.
5. Switch back to RoundTable → Responses tab → paste response.
6. Repeat for each model.
7. Go to Mediator → generate packet → copy → paste into GPT-5.5.
8. Paste mediator response back → extract synthesis.
9. Decision Log → review → record decision.
10. Export / Import → download JSON backup (critical on mobile — no second copy).

### CSS architecture (Phase 8)

Phase 8 added ~630 lines of CSS to app.css without changing the original classes. The pattern:
- Original Phase 2–7 classes at the top
- Phase 8 additions at the bottom, clearly marked
- No CSS framework — vanilla CSS only
- Responsive breakpoints: 700px (workbench), 640px (nav), 480px (forms)

To add new Phase 9 CSS: append to the Phase 8 section or add a new Phase 9 block at the bottom.

### Copy feedback pattern (Gemini recommendation)

Phase 8 uses the `copy-confirm` class for copy/save feedback badges, placed in card headers rather than mutating button labels. This prevents layout shift under the user's thumb on mobile. Do not change this pattern to button-label mutation.

### Known limitations (deferred to Phase 9)

- Vite/esbuild dev-server audit advisories (carried since Phase 3.1)
- Full model profile editing UI (display only in Phase 8)
- Full prompt template editing UI (display only in Phase 8)
- Accessibility audit (basics addressed in Phase 8; full WCAG audit deferred)

---

## Phase 9 Maintainability Notes

### App name

The user-facing app name is **RoundTable**. The app was developed under the working name "Model Roundtable Console / MRC". Historical references to MRC in phase history docs are intentional.

### Storage key

`roundtable.appState.v1`

Changed in Phase 9 from `mrc.appState.v0`. Centralized in `src/config/exportFormats.ts`. All storage operations go through `localStorageAdapter.ts` — never call `localStorage` directly from components.

### Dependency advisory

The Vite/esbuild moderate advisory (GHSA-67mh-4wv8-2f99) was resolved in Phase 9 by upgrading to Vite 6.4.2. `npm audit` reports 0 vulnerabilities.

Future dependency changes: follow the same pattern — test `npm run build` after any update before committing.

### Version bump procedure

1. Update `SCHEMA_VERSION` and `APP_VERSION` in `src/config/exportFormats.ts`
2. Update `package.json` version
3. Run `npm install --package-lock-only` to align `package-lock.json`
4. Update `README.md` version line
5. Update `docs/PHASE_HISTORY.md`
6. Update `docs/SCHEMA_EVOLUTION.md` if AppState shape changed

### First operational use

Before using RoundTable for a real project:
1. Export JSON from Export / Import to confirm export works
2. Import that JSON back to confirm round-trip
3. Keep regular JSON backups during use
4. Use browser DevTools → Application → Local Storage to inspect `roundtable.appState.v1` if needed

### Known limitations (Phase 9)

- Model profile editing UI: display-only (Phase 8+). Full editing requires updating `src/config/modelProfiles.ts`.
- Prompt template editing UI: display-only. Full editing requires `src/config/promptTemplates.ts`.
- Full WCAG accessibility audit: deferred to Phase 10
- Performance profiling for large histories (many rounds): deferred to Phase 10
