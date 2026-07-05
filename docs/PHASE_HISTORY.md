# Phase History

RoundTable — chronological record of completed and future phases.
(Formerly developed under the working name Model Roundtable Console / MRC.)
Status reflects the state of the project as of v0.11.0.

| # | Phase | Status |
|---|---|---|
| 0 | Project Charter and Scope Lock | Completed |
| 1 | Architecture and UX Blueprint | Completed |
| 2 | Lightweight Repo Scaffold | Completed |
| 3 | Core Round Workflow | Completed |
| 3.1 | Cleanup Patch | Completed |
| 4 | Mediator Packet and Decision Loop Refinement | Completed |
| 5 | Export, Import, Durable State, and Recovery | Completed |
| 5.1 | Durability Gate Cleanup | Completed |
| 6 | Internal Documentation and Maintainability Pass | Completed |
| 6.1 | Maintainability Gate Cleanup | Completed |
| 7A | Schema Migration, Import Compatibility, and Gemini Review Packet | Completed |
| 7A.1 | Migration Safety Cleanup | Completed |
| 7B | Model / Prompt / Vendor Compatibility Resilience | Completed |
| 7B.1 | Vendor Resilience Gate Cleanup | Completed |
| 8 | UI Polish and Mobile Usability | Completed |
| 8.1 | UI Polish Gate Cleanup | Completed |
| 9 | Release Candidate Hardening and RoundTable Rename | Completed |
| v0.10.x | Workflow + Persistence Hardening | Completed |
| v0.11.0 | Markdown Handoff Mode | Current (Checkpoint I — RC) |
| 10 | Operational Trial and 1.0.0 | Future / Optional |

---

## Phase 0 — Project Charter and Scope Lock (Completed)

**Outcome:** Locked the local-first, manual copy/paste, no-API,
no-scraping, no-automation, no-backend, no-cloud-sync,
no-model-provider-integration boundary that all subsequent phases must
honor. Established the user as the final decision-maker and GPT-5.5
Thinking as the mediator/architect/reviewer.

---

## Phase 1 — Architecture and UX Blueprint (Completed)

**Outcome:** Data model defined. AppState as a single top-level object.
Storage adapter interface. Context Sandwich prompt pattern. Round
immutability via `locked` field.

**Key decisions:** Single AppState, storage adapter, Context Sandwich,
`locked: boolean` on `Round`.

**Attribution:** Gemini 3 Thinking contributed: Context Sandwich,
storage adapter interface, round immutability rationale, glass box UI
principle, rich prompt/response arrays.

---

## Phase 2 — Lightweight Repo Scaffold (Completed)

**Outcome:** All 10 screens, demo data, storage adapter wired, Context
Sandwich utility, mediator packet utility, placeholder export,
industrial terminal aesthetic.

**Delivered:** 49 files, zero TypeScript errors, clean build.

---

## Phase 3 — Core Round Workflow (Completed)

**Version:** 0.3.0 · **Schema:** 0.3.0

**Objective:** Transform the Phase 2 scaffold into a functional local
workflow engine.

**Key changes:**

- Rich `GeneratedPrompt[]` schema with `id`, `modelProfileId`,
  `generatedAt`, `copiedAt`, `status`.
- Rich `ModelResponse[]` schema with `id`, `modelProfileId`,
  `pastedAt`, `status`.
- `canonicalStateUpdate` field on `Round` (user-approved, never
  auto-applied).
- `roundUtils.ts`: pure state-transition functions (`createRound`,
  `generatePromptsForRound`, `markPromptCopied`, `upsertModelResponse`,
  `recordDecisionForRound`, `applyCanonicalStateUpdate`,
  `getRoundProgress`, `isRoundMediatorReady`).
- Dashboard real-time workflow progress bars and chain-of-custody
  status dots.
- RoundBuilderPanel: new round creation with incomplete-round warning,
  copy tracking with `copiedAt`.
- ResponsesPanel: `pastedAt` timestamps, response status toggles.
- MediatorPanel: partial-response warning, mediator response storage.
- DecisionLogPanel: explicit `canonicalStateUpdate` textarea, apply
  checkbox, confirmation step.
- ProjectStatePanel: prominent canonical state editor.
- Markdown export updated for the rich array schema.

**Rule established:** Canonical state may only be updated through
explicit user action. The app never silently overwrites
`Project.canonicalState`.

**Attribution:** Gemini 3 Thinking endorsed the richer schema and
chain-of-custody tracking. GPT-5.5 Thinking added the clarification:
no silent canonical state rewrites.

---

## Phase 3.1 — Cleanup Patch (Completed)

**Version:** 0.3.1

**Fixes applied:**

1. **Locked round visibility** — Added `getCurrentRound()` to
   `roundUtils.ts`. RoundBuilderPanel, ResponsesPanel, and MediatorPanel
   use `getCurrentRound()` for read-only display when the latest round
   is locked. `getActiveRound()` continues to guard editable workflow
   logic.

2. **External font import removed** — Removed Google Fonts `@import`
   from `app.css`. System font stack now used. No external network
   dependency at load time.

3. **Package version aligned** — `package.json` bumped to `0.3.1`.

4. **Canonical State Editor** — Added `.canonical-state-editor` CSS
   with generous `min-height` (480px desktop, 600px tall screens, 260px
   mobile). Canonical state is the project's long-term Ground Truth
   ledger and must not be cramped.

5. **Vite/esbuild audit advisory** — `npm audit` may report a moderate
   advisory in the Vite/esbuild dev-server dependency chain. This
   affects the local development server only — it is not a production
   backend exposure. Do not run `npm audit fix --force`; an automatic
   upgrade may jump to a breaking Vite major version. Deferred to
   Phase 9 release-candidate hardening.

---

## Phase 4 — Mediator Packet and Decision Loop Refinement (Completed)

**Version:** 0.4.0 · **Schema:** 0.4.0

**Objective:** Refine the mediator packet and decision loop into a
structured, glass-box decision cockpit.

**Key changes:**

- **`MediatorSynthesis` type** — New nested object on `Round` with 12
  structured fields: `executiveSummary`, `agreements`, `disagreements`,
  `risks`, `openQuestions`, `modelSpecificObservations`,
  `recommendedDecision`, `decisionRationale`,
  `proposedCanonicalStateUpdate`, `proposedNextActions`,
  `proposedNextRoundPrompt`, `confidenceCaveats`.

- **`mediatorExtract.ts`** — New utility. Simple `###` heading-based
  section extractor. Falls back gracefully to empty fields if headings
  are not found. Nothing auto-applied.

- **`mediatorPacket.ts`** — Refined 12-section required output format.
  Explicit "user is the final decision-maker" instruction. Model
  response status shown. Known risks and open questions included.
  Missing-response warning.

- **MediatorPanel** — 3-step workflow: generate packet → paste full
  response → extract + edit structured fields. Extraction is
  transparent and user-reviewed. `proposedCanonicalStateUpdate`
  labeled "Not auto-applied".

- **DecisionLogPanel** — Mediator synthesis reference section with
  draft-transfer buttons ("Use as draft →"). Proposed next-round
  prompt card with "Copy" and "Start Next Round From This Prompt →".
  Two-click lock confirmation. Canonical state update requires
  explicit checkbox + confirm.

- **Dashboard** — New "Synthesis Ready" workflow status. "Synthesis
  Extracted" status dot.

- **Markdown export** — Includes mediator synthesis summary, round
  details per locked round, proposed next-round prompt.

- **`createRoundFromPrompt()`** — New `roundUtils` helper. Creates a
  new round with a proposed instruction as `userInstruction`.

**Safety rules maintained:**

- `Project.canonicalState` only updated by explicit user checkbox +
  confirmation.
- Draft-transfer buttons only fill editable fields — they do not lock
  or mutate state.
- No API calls, scraping, automation, or backend introduced.

---

## Phase 5 — Export, Import, Durable State, and Recovery (Completed)

**Version:** 0.5.0 · **Schema:** 0.5.0

**Objective:** Zero Data Loss Cockpit. Users can migrate, back up,
inspect, recover, and repair project data without fear of silent
corruption or accidental overwrite.

**Key changes:**

- **Phase 5 JSON export envelope** —
  `{ exportType, schemaVersion, exportedAt, appName, appVersion, source, payload: { appState } }`.
  Readable JSON, filesystem-safe filenames
  (`MRC_PROJECT_Name_YYYY-MM-DD.json`).

- **`validation.ts`** — Full validation pipeline: parse → extract →
  validate → normalize. Checks structural integrity, referential
  integrity (`activeProjectId`, `round.projectId`, `decision.roundId`),
  array types, required fields. Returns
  `{ valid, errors[], warnings[], summary }`. Never throws into UI.

- **`normalizeImportedState()`** — Safe soft repair: missing arrays →
  empty, missing `locked` → `false`, missing statuses inferred from
  content, missing timestamps → `now`. Never fabricates substantive
  content (decisions, responses, canonical state, descriptions).

- **Import flow** — 4-stage staged UI: load file → validate + preview
  diff table → download backup → confirm. Import does not proceed
  until the user passes through all stages. Diff table shows current
  vs. incoming counts and schema versions side by side.

- **Backup-before-import** — Required step in import flow. Downloads
  current state as `mrc-backup-before-import-TIMESTAMP.json`. Can be
  explicitly skipped with "I accept data loss risk" warning.

- **`localStorageAdapter`** — Added `loadWithRecovery()` returning
  `{ state, rawValue, error, wasCorrupted }`. Added `loadRaw()` and
  `preserveCorrupted()`.

- **RecoveryPanel** — Shown when `wasCorrupted: true` on app load.
  Three recovery options: download raw corrupted data, import known
  good backup, reset to demo. Manual recovery instructions included.

- **`markdownExport.ts`** — 7 export shapes: Project History, Project
  Summary, Current Round, Decision Log, Compatibility Notes, Model
  Roster, Prompt Library. All user/model content wrapped in fenced
  code blocks to prevent heading collision.

- **ExportImportPanel** — Two-section UI (Export / Import). Export
  section offers JSON backup + all 7 Markdown exports. Import section
  is the 4-stage staged flow.

- **README/docs** — All stale version references fixed. Phase 5
  documented.

**Vite/esbuild audit advisory** — Unchanged from Phase 3.1. Deferred
to Phase 9.

---

## Phase 5.1 — Durability Gate Cleanup (Completed)

**Version:** 0.5.0 (patch) · **Schema:** 0.5.0

**Fixes applied:**

1. **README stale version removed** — Removed contradictory
   `Current: 0.3.0` Schema Version section. README now consistently
   states 0.5.0/0.5.0 throughout.

2. **Mediator Packet Markdown export** — Added `exportMediatorPacket()`
   and `mediatorPacketFilename()` to `markdownExport.ts`.
   ExportImportPanel exposes a distinct "Mediator Packet" export
   button. Filename: `MRC_MEDIATOR_PACKET_Name_Round-N_Date.md`. This
   brings the Markdown export count to 8.

3. **Robust Markdown fencing** — Replaced triple-backtick `fence()`
   with dynamic 4-tilde fencing. Function counts the longest tilde run
   in content and uses at least 4 tildes or one more than the longest
   run. Prevents embedded code fences from breaking export structure.

4. **Strict referential integrity** — `validateImportedState()` now
   rejects (hard error) any round whose `projectId` does not exist in
   the import. Also rejects decisions with invalid `projectId`.
   Decisions with broken `roundId` produce warnings (decision text
   preserved). Orphaned rounds can no longer silently corrupt project
   history.

5. **Repairs surfaced before confirmation** —
   `validateImportedState()` runs a dry-run of
   `normalizeImportedState()` and adds repair messages as
   `[Auto-repair]` warnings. Users see exactly what will be repaired
   in the import preview before clicking Confirm.

---

## Phase 6 — Internal Documentation and Maintainability Pass (Completed)

**Version:** 0.6.0 · **Schema:** 0.6.0

**Objective:** Make the Phase 5.1 codebase easier to inspect, repair,
document, and evolve. No new product features; no new dependencies; no
relaxation of local-first guarantees.

**Spirit of the phase:** *Fewer clever abstractions, more clear
structure.*

**Code changes:**

1. **Typed validation issues** — `src/utils/validation.ts` produces a
   typed `ValidationIssue[]` alongside the legacy `errors: string[]` /
   `warnings: string[]`. New `ValidationCode` union covers:
   `JSON_PARSE_FAILED`, `APP_STATE_MISSING`, `SCHEMA_MISSING`,
   `SCHEMA_MISMATCH`, `EXPORT_TYPE_UNKNOWN`, `LEGACY_FORMAT_DETECTED`,
   `REQUIRED_ARRAY_MISSING`, `REQUIRED_ARRAY_INVALID`,
   `ORPHANED_ROUND`, `ORPHANED_DECISION_PROJECT`,
   `BROKEN_DECISION_ROUND_LINK`, `ACTIVE_PROJECT_REPAIRED`,
   `FIELD_DEFAULTED`, `TIMESTAMP_DEFAULTED`, `AUTO_REPAIR_APPLIED`. UI
   consumes both views; legacy strings preserved.

2. **Normalization split into helpers** — `normalizeImportedState()`
   decomposed into per-collection helpers: `normalizeProjects`,
   `normalizeActiveProjectId`, `normalizeRounds` (with
   `normalizeGeneratedPrompts` / `normalizeModelResponses` /
   `normalizeMediatorSynthesis` sub-helpers), `normalizeDecisions`,
   `normalizeModelProfiles`, `normalizePromptTemplates`,
   `normalizeCompatibilityNotes`. Behavior is equivalent. No Strategy
   Pattern — just direct helper functions.

3. **Safer ID generation** — `src/utils/id.ts` exports
   `generateSafeId(prefix)` using `crypto.randomUUID()` with a
   `${Date.now()}-${random}` fallback. Legacy `generateId` retained as
   an alias. Ad-hoc `Math.random().toString(36)` fallbacks in
   normalization replaced with `generateSafeId('recovered-...')`.

4. **Recovery UX polish** — `RecoveryPanel` adds a
   **Copy Raw Corrupted Data to Clipboard** button alongside the
   existing download button, with `✓ Copied!` / `✗ Copy failed`
   feedback that auto-clears. Reset confirmation rewritten as an
   explicit destructive-action warning. Manual DevTools steps demoted
   to advanced/optional — none of the four rescue actions
   (download / copy / import backup / reset) require DevTools.

5. **Validation issue groups in import UI** — `ExportImportPanel`
   renders the validation result as three independent groups
   (Errors / Warnings / Auto-repairs), each with its own flat `<ul>`.
   No nested `<ul>` markup. Auto-repair messages (issue code
   `AUTO_REPAIR_APPLIED`) get their own clearly-labeled section.

6. **Header comments** — `validation.ts`, `id.ts`, `RecoveryPanel.tsx`,
   `ExportImportPanel.tsx`, `exportFormats.ts` carry expanded
   purpose / data-ownership / safe-edit / unsafe-edit comments
   oriented toward future maintainers.

**New documentation:**

- **`docs/SCHEMA_EVOLUTION.md`** — schema versioning lifecycle, what
  changed by version, how import handles older exports, rules for safe
  normalization, what must never be fabricated, error-vs-warning
  rules, additive-field workflow, expected path to v1.0.0.
- **`docs/MAINTAINABILITY.md`** — practical orientation for future AI
  models, nontraditional developers, and the product owner returning
  after time away.

**Updated documentation:** README, PHASE_HISTORY (this file),
DATA_MODEL, EDITING_GUIDE, PROJECT_STATE, COMPATIBILITY_NOTES,
PROMPT_SYSTEM, ARCHITECTURE.

**Behavior preserved (Phase 5.1 firewall):** Malformed JSON cannot
crash or overwrite state. `round.projectId` / `decision.projectId`
referential integrity remain hard errors. `decision.roundId`
referential integrity remains a warning only. Auto-repairs surfaced
before confirmation. Backup-before-import gate intact. Markdown dynamic
tilde fencing intact. Distinct Mediator Packet Markdown export intact.
Normalization never fabricates substantive content.

**Vite/esbuild audit advisory** — Unchanged. Deferred to Phase 9.

---

## Phase 6.1 — Maintainability Gate Cleanup (Completed)

**Version:** 0.6.0 (patch) · **Schema:** 0.6.0

**Fixes applied:**

1. **PHASE_HISTORY rewritten chronologically** — This file. Previous
   revisions accumulated stale "Current" labels on Phases 3, 3.1, 4,
   and 5 simultaneously, plus duplicate "Planned" sections for Phases
   4 and 5 even though those phases had completed. Replaced with a
   single chronological history with accurate completion status per
   phase, an index table at the top, and the Vite/esbuild deferral to
   Phase 9 preserved.

2. **Recovered project IDs use `generateSafeId()`** —
   `normalizeProjects()` in `src/utils/validation.ts` previously
   generated recovered project IDs with the inline pattern
   `recovered-proj-${i}`. Replaced with
   `generateSafeId('recovered-proj')` to centralize ID safety on the
   same utility used for prompts, responses, and rounds. No new
   dependency.

3. **Project ID recovery surfaced in repair warnings** — When
   `normalizeProjects()` mints a new ID for a project that arrived
   without one, it now pushes a repair message into `ctx.repairs` of
   the form *"Recovered missing project id at projects[N] using
   generateSafeId('recovered-proj')."* That message flows through the
   existing `AUTO_REPAIR_APPLIED` path and appears in the import
   preview so users see the change before confirmation. No fabricated
   project content.

4. **`markdownExport.ts` header comment corrected** — The header
   comment incorrectly described triple-backtick fencing even though
   the implementation uses dynamic tilde fencing (in place since Phase
   5.1). Comment rewritten to match the implementation. The fencing
   logic itself is unchanged.

**Behavior preserved:** No change to validation outcomes, normalization
behavior beyond the ID source, Markdown export contents, or any UI
flow. Phase 5.1 firewall guarantees and Phase 6 maintainability
guarantees remain intact.

**Vite/esbuild audit advisory** — Unchanged. Deferred to Phase 9.


---

## Phase 7A.1 — Migration Safety Cleanup (Completed)

**Version:** 0.7.0 (patch) · **Schema:** 0.7.0

**Objective:** Satisfy the Phase 7A migration safety gate — reject newer/future schema imports as hard errors.

**Fixes applied:**

1. **Newer schema imports rejected (HARD ERROR)** — Added `UNSUPPORTED_SCHEMA_VERSION` to `VALIDATION_CODES`. In `validateImportedState()`, after `migrateAppState()` runs, two independent checks detect a future-schema import:
   - (a) Migration notices: if `SOURCE_NEWER_THAN_APP` is present, the import is rejected immediately.
   - (b) Post-migration schemaVersion: if `s.schemaVersion` is still semver-greater than `SCHEMA_VERSION` (defense-in-depth for any path where the migration engine ran but notices were incomplete), the import is rejected.
   
   Error message: `"This export uses schemaVersion X, which is newer than this app's supported version Y. Update RoundTable before importing this file."`
   
   `valid: false` is returned, disabling Confirm Import.
   
   Older supported versions (0.4.0, 0.5.0, 0.6.0) still migrate forward as before.

2. **ExportImportPanel comment** — Updated header comment from "8 Markdown exports" to "9 Markdown exports".

3. **Gemini Review Packet duplicate** — Removed the duplicate `Exported At` line from `Project Metadata` in `exportGeminiReviewPacket()`. The timestamp is already emitted by `exportHeader()`.

4. **SCHEMA_EVOLUTION.md** — Updated to note that `SOURCE_NEWER_THAN_APP` (migration warning) now triggers `UNSUPPORTED_SCHEMA_VERSION` (validation error).

---

## Phase 7B — Model / Prompt / Vendor Compatibility Resilience (Completed)

**Version:** 0.8.0 · **Schema:** 0.8.0

**Objective:** Make RoundTable resilient to vendor/model behavior changes by
moving model-specific behavior into editable configuration and durable
local state. The user should be able to adapt RoundTable when ChatGPT,
Claude, Gemini, or another model changes its name, context limits,
formatting habits, refusal tendencies, or preferred prompt structure
**without touching core app logic**.

**This is not an automation phase.** Phase 7B reaffirms the
local-first, manual-copy/paste boundary: no API calls, no scraping,
no browser automation, no upload to Gemini/Claude/ChatGPT, no model-
provider integrations.

**Phase split note (carried from 7A):** Phase 7 was split into 7A and
7B. 7A delivered schema migration, import compatibility hardening,
and the Gemini Review Packet. 7B delivers vendor resilience.

**Code changes:**

1. **Expanded `ModelProfile`** — Added optional fields:
   `profileVersion`, `vendorUrl`, `contextWindowNotes`,
   `defaultPromptWrapperId`, `modelBehaviorNotes`, `formattingNotes`,
   `refusalRiskNotes`, `strengths`, `weaknesses`, `lastReviewedAt`.
   All optional → 0.7.0 imports unchanged. `ModelRosterPanel`
   surfaces every populated field as a read-only block; full editing
   UI deferred to Phase 8.

2. **Versioned `PromptTemplate`** — Added `createdAt`, `updatedAt`,
   `changelog`, `active`, `supersedesTemplateId`. Templates that
   supersede an older template can be tracked without losing the
   historical id (kept `active: false` rather than deleted, so old
   rounds still render). `PromptLibraryPanel` surfaces version
   metadata.

3. **Hardened `CompatibilityNote`** — Added `severity`
   (`low|medium|high|workflow_breaking`), `impact`,
   `linkedModelProfileId`, `linkedPromptTemplateId`,
   `linkedPromptWrapperId`, `reviewedAt`. Status enum widened to
   include `'deprecated'`. Round Builder warning panel sorts by
   severity. `promptGeneration.ts` filter prefers
   `linkedModelProfileId` when present, falls back to the legacy
   vendor/modelName match so older notes still apply.

4. **New `PromptWrapper` type + config** —
   `src/types/promptWrapper.ts` and `src/config/promptWrappers.ts`.
   Wrappers act as the vendor-specific "bread" around the Context
   Sandwich. Five defaults shipped: Generic (the safe fallback id
   `wrapper-generic`), GPT-5.5 Mediator, Claude Implementer, Gemini
   Reviewer, Haiku Summary. AppState gains a top-level
   `promptWrappers: PromptWrapper[]` array.

5. **New `CompatibilityTest` type + config** —
   `src/types/compatibilityTest.ts` and
   `src/config/compatibilityTests.ts`. Six default manual paste-into-
   model tests: Structured Output Compliance, Markdown Formatting,
   Implementation Report Shape, Architecture Critique Shape,
   Mediator Synthesis Shape, Summary + Checklist Shape. Tests are
   paste-only — RoundTable does not run them. `PromptLibraryPanel` surfaces
   them with a per-test Copy button.

6. **Wrapper-aware prompt generation** — `promptGeneration.ts`
   wraps the Context Sandwich with `wrapper.wrapperText` (header)
   and `wrapper.outputInstructions` (footer). The Sandwich shape is
   unchanged. Resolution order: explicit wrapper arg → model's
   `defaultPromptWrapperId` → `GENERIC_WRAPPER_ID` → no wrapper
   (legacy Phase 5/6/7A shape). New ModelProfile fields
   (`formattingNotes`, `refusalRiskNotes`) are included in the
   per-prompt Model-Specific Notes section. `generatePromptsForRound`
   accepts an optional `promptWrappers?` argument; back-compat
   preserved.

7. **Round Builder compatibility warnings** — New
   `CompatibilityWarnings` sub-component below the model selector.
   Sources warnings from active `CompatibilityNote` entries
   (preferring `linkedModelProfileId` match) plus
   `ModelProfile.modelBehaviorNotes` and
   `ModelProfile.refusalRiskNotes`. Sorted by severity; expandable;
   no hardcoded vendor strings in the panel — warning text comes
   from configuration.

8. **Migration step `0.7.0 → 0.8.0`** — First chain step that
   actually changes shape. `MigrationStep` API extended with a
   `MigrationStepContext` so steps can push their own
   `MigrationNotice` entries. The 0.7→0.8 step:
   - Adds top-level `promptWrappers` array seeded with
     `DEFAULT_PROMPT_WRAPPERS` if missing.
   - Defaults `defaultPromptWrapperId` on every ModelProfile that
     lacks one to `GENERIC_WRAPPER_ID`.
   - Defaults `severity: 'medium'` on every CompatibilityNote that
     lacks one.
   - Defaults `active: true` on every PromptTemplate that lacks it.
   - Each defaulting bucket emits its own `MIGRATION_STEP_APPLIED`
     notice with an accurate `path` so the import preview lists
     exactly which records changed.

9. **Validation extended** — `promptWrappers` added to
   `requiredArrays`. New `normalizePromptWrappers` helper. Pipeline
   shape is unchanged; the dry-run repair preview flows through
   migration → validation → normalization as in Phase 7A.

10. **Markdown export updates** —
    - `exportCompatibilityNotes` now displays severity, impact,
      linked ids, and reviewedAt; adds a `Deprecated` bucket.
    - `exportGeminiReviewPacket` adds Phase 7B sections: Model
      Profile Summary, Prompt Wrapper Summary, Prompt Template
      Versions, Compatibility Test Prompt Library (names + purpose
      only — full prompts live in config to keep the packet
      reviewer-friendly).
    - All other Markdown exports preserved (8 from Phase 5+, plus
      the Gemini Review Packet from 7A = 9 total).
    - Dynamic tilde fencing preserved everywhere.

**Documentation:**

- **New: `docs/VENDOR_RESILIENCE.md`** — Phase 7B operator's manual:
  decision tree for "a model changed", how to edit each surface
  (ModelProfile, PromptWrapper, PromptTemplate, CompatibilityNote,
  CompatibilityTest), worked examples of vendor changes and how to
  respond, what not to automate, and a where-the-architecture-lives
  table.
- Updated: `README.md`, this file, `SCHEMA_EVOLUTION.md`,
  `MAINTAINABILITY.md`, `DATA_MODEL.md`, `PROMPT_SYSTEM.md`,
  `MODEL_PROFILES.md`, `COMPATIBILITY_NOTES.md`, `EDITING_GUIDE.md`.

**Behavior preserved (Phase 7A / 7A.1 firewall):**

- Migration engine, future-schema rejection (`UNSUPPORTED_SCHEMA_VERSION`),
  typed validation issues, `VALIDATION_CODES`, dynamic Markdown
  fencing, Gemini Review Packet (extended, not regressed), distinct
  Mediator Packet export, four-group import preview, backup-before-
  import, recovery mode, local-only/no-network boundary — all intact.

**Out of scope (deferred):**

- Full in-app editing UI for ModelProfile / PromptWrapper /
  PromptTemplate / CompatibilityNote → Phase 8 or a 7B.1 cleanup.
- API calls, scraping, browser automation, login automation, backend
  services, cloud sync, authentication, model-provider integrations,
  database servers, browser extensions, SaaS features — explicitly
  out of scope for all phases.
- Vite/esbuild dev-server audit advisory — still deferred to Phase 9
  (carried since Phase 3.1).

**No new dependencies. No API/scraping/automation/backend/auth/cloud-
sync/model-provider integrations introduced.**

---

## Phase 7B.1 — Vendor Resilience Gate Cleanup (Completed)

**Version:** 0.8.0 (patch) · **Schema:** 0.8.0

**Fixes applied:**

1. **Default model profiles wired to prompt wrappers** — Added `defaultPromptWrapperId` and `profileVersion: "0.8.0"` to all five shipped default profiles in `src/config/modelProfiles.ts`:
   - `gpt55_thinking` → `wrapper-gpt55-mediator`
   - `claude_opus_47` → `wrapper-claude-implementer`
   - `claude_sonnet_46` → `wrapper-claude-implementer`
   - `claude_haiku_45` → `wrapper-haiku-summary`
   - `gemini3_thinking` → `wrapper-gemini-reviewer`
   
   The 0.7.0 migration path in `migration.ts` (defaulting old imports to `wrapper-generic`) is unchanged — this fix applies only to newly shipped default profiles.

2. **APP_VERSION centralized** — Added `export const APP_VERSION = '0.8.0'` to `src/config/exportFormats.ts` alongside `SCHEMA_VERSION`. Both `src/utils/jsonExport.ts` and `src/utils/markdownExport.ts` now import `APP_VERSION` from `exportFormats.ts`. The hardcoded `0.7.0` in `exportGeminiReviewPacket()` is replaced with `${APP_VERSION}`. Future version bumps require updating only `exportFormats.ts`.

3. **Prompt wrapper resolution** — Confirmed unchanged. `promptGeneration.ts` already resolves in order: explicit wrapper → `model.defaultPromptWrapperId` → `wrapper-generic` → no wrapper. No code change needed.

---

## Phase 8 — UI Polish and Mobile Usability (Completed)

**Version:** 0.9.0 · **Schema:** 0.9.0

**Objective:** Make RoundTable comfortable to operate as a real workflow cockpit, especially from a mobile browser.

**Key principle:** The user manually copies prompts to external model interfaces and pastes responses back. Phase 8 makes that motion — generate → copy → paste → save → mediate → decide — faster and clearer on both desktop and phone.

**Changes:**

1. **Version bumps** — package.json, exportFormats.ts (SCHEMA_VERSION, APP_VERSION), README all updated to 0.9.0.

2. **CSS overhaul (app.css +630 lines)** — Phase 8 adds comprehensive mobile-first CSS:
   - Dynamic media queries at 700px and 640px/480px (workbench single-column, larger tap targets, font-size 16px on mobile inputs to prevent iOS zoom)
   - `workflow-chip` — inline status chip (locked, active, prompted, collecting, synthesizing, decided)
   - `round-locked-banner` / `round-active-banner` — highly visible locked state indicators
   - `copy-confirm` — inline badge for copy feedback that does not shift layout under the user's thumb
   - `next-step-cue` — contextual action prompt guiding the user to the next workflow step
   - `step-label` / `step-number` — numbered step labels for multi-step panels
   - `compat-warning` with severity subclasses — expandable compatibility warning cards
   - `model-profile-card` with `model-profile-meta` grid — structured expanded profile display
   - `template-card` with `template-meta` — structured template display with version metadata
   - `compat-test-item` — compatibility test prompt display
   - `export-grid` / `export-item` — responsive grid for Markdown export buttons
   - `empty-state` with icon, title, desc — consistent empty states across all panels
   - `progress-bar-wrap` / `progress-bar-fill` — round progress bars
   - `wrapper-tag` — inline prompt wrapper ID badge

3. **Dashboard** — workflow chips, progress bars (prompts copied, responses collected), status dots, contextual `next-step-cue` guiding to the right panel.

4. **RoundBuilderPanel** — `round-locked-banner` for locked display, `step-label` for numbered workflow steps, `copy-confirm` badge in prompt card header (no layout shift), `compat-warning` CSS for compatibility warnings, `next-step-cue` after prompts copied, improved empty states.

5. **ResponsesPanel** — improved empty states, `workflow-chip` status, `next-step-cue` for mediator navigation, `round-locked-banner`.

6. **MediatorPanel** — `step-label` for 3-step workflow, `copy-confirm` for copy/save feedback, `round-locked-banner`, `next-step-cue` after synthesis saved.

7. **DecisionLogPanel** — `workflow-chip active` for active round, `round-locked-banner`, improved empty decision state.

8. **ModelRosterPanel** — rewritten using `model-profile-card`, `model-profile-meta` grid, `wrapper-tag` for defaultPromptWrapperId, all Phase 7B expanded fields displayed (strengths, weaknesses, formattingNotes, refusalRiskNotes, modelBehaviorNotes, contextWindowNotes), mobile-friendly layout.

9. **PromptLibraryPanel** — `template-card` with `template-meta` for version/changelog/supersedes, `compat-test-item` with `copy-confirm` badge, consistent empty states.

10. **ExportImportPanel** — `export-grid` / `export-item` for responsive Markdown download grid, section titles for JSON/Markdown/Gemini, improved button labels.

**Preserved from Phase 7:**
- Future-schema rejection (UNSUPPORTED_SCHEMA_VERSION)
- Migration/import preview grouping
- Backup-before-import
- Recovery mode
- Dynamic Markdown fencing
- Gemini Review Packet export (local Markdown only)
- Distinct Mediator Packet export
- Prompt wrapper behavior
- Compatibility notes/test prompts
- Local-first/manual-copy-paste boundary

**No new dependencies. No API/scraping/automation/backend/auth/cloud sync.**


---

## Phase 9 — Release Candidate Hardening and RoundTable Rename (Current)

**Version:** 0.10.0 · **Schema:** 0.10.0 · **App name:** RoundTable

**Objective:** Release-candidate hardening. Make the app ready for a first real operational workflow loop.

**Key changes:**

1. **RoundTable rename** — User-facing app name changed from "Model Roundtable Console / MRC" to **RoundTable** throughout:
   - UI header and title (`<title>RoundTable</title>`)
   - Markdown export headings and file prefixes (`ROUNDTABLE_PROJECT_...`, etc.)
   - JSON export `appName` and `exportType` fields
   - Gemini Review Packet headers and descriptions
   - Prompt template headers (`# RoundTable Prompt`)
   - Mediator packet headers
   - Recovery panel messages
   - Demo data and initial state
   - All source file user-facing strings
   - README (fully rewritten)
   - Docs updated with "formerly Model Roundtable Console / MRC"
   - Historical phase history entries preserved as-is

2. **localStorage key rename** — Storage key changed from `mrc.appState.v0` to `roundtable.appState.v1`.
   No legacy migration was added because the app had not been used operationally. Existing dev/test exports can be restored via JSON import.

3. **Version bump** — All version references updated to `0.10.0` (package.json, package-lock.json, SCHEMA_VERSION, APP_VERSION).

4. **Dependency advisory resolved** — Vite upgraded from `^5.2.0` to `6.4.2`. This resolves the long-deferred moderate esbuild dev-server advisory (GHSA-67mh-4wv8-2f99) that had been carried since Phase 3.1. `npm audit` now reports 0 vulnerabilities.

5. **Dashboard onboarding** — Empty state when no project is loaded now shows a "Ready to start?" onboarding card with direct links to Import Backup, Set Up Project, Configure Models, and Start a Round.

6. **AppState shape** — Unchanged. 0.10.0 uses the same AppState shape as 0.9.0. Phase 7 migration engine remains intact. Future-schema rejection remains intact.

**Phase 7 safety preserved:**
- Future-schema rejection (UNSUPPORTED_SCHEMA_VERSION) ✓
- Migration/import preview grouping ✓
- Backup-before-import ✓
- Recovery mode ✓
- Dynamic Markdown fencing ✓
- Gemini Review Packet (local Markdown only) ✓
- Distinct Mediator Packet export ✓
- Prompt wrapper behavior ✓
- Compatibility notes and test prompts ✓
- Local-first/manual-copy-paste boundary ✓

**No new dependencies introduced beyond Vite 6.4.2 (which resolves the existing advisory).**

---

## Phase 10 — Operational Trial and 1.0.0 (Future / Optional)

**Planned:**
- Complete one full real operational workflow loop using RoundTable
- Document any workflow friction discovered
- Fix any critical bugs found in operational use
- If the app survives the operational trial without critical issues → 1.0.0
- Full WCAG accessibility audit
- Performance profiling for large round histories

---

## v0.10.1 — Project Lifecycle Operational Fix (Completed)

**Version:** 0.10.1 · **Schema:** 0.10.1

**Reason:** The first operational trial of v0.10.0 RC immediately exposed a blocker: the app had no UI for creating, switching, duplicating, archiving, or deleting projects. Users were trapped in the demo/old project state with no clean escape.

**Changes:**

1. **Project type** — Added optional `archived?: boolean` and `archivedAt?: string | null` fields to support lifecycle management without breaking existing data.

2. **projectUtils.ts** — New pure utility module:
   - `createNewProject()` — creates a clean project with 0 rounds, 0 decisions
   - `duplicateProject()` — deep-copies a project with full round/decision remapping (no orphaned IDs)
   - `archiveProject()` / `unarchiveProject()` — toggles archived state; auto-switches active project if needed
   - `deleteProject()` — removes project + all its rounds + all its decisions; prevents orphaned data
   - `switchActiveProject()` — switches activeProjectId
   - `getActiveProjects()` / `getArchivedProjects()` — filtered selectors

3. **ProjectManagerPanel.tsx** — New tab ("Projects") providing:
   - Project selector list (active + archived toggle)
   - Active project indicator
   - Create New Project (with name input)
   - Start From Blank Project
   - Per-project: Switch, Duplicate, Archive, Delete
   - Archive confirmation with explanation
   - Delete confirmation requiring user to type project name
   - Unarchive action for archived projects

4. **Dashboard** — Added "Manage Projects →" to empty-state and workflow guide.

5. **validation.ts** — `normalizeImportedState()` now defaults `archived: false, archivedAt: null` for older exports that don't have these fields.

6. **App.tsx** — "Projects" tab wired between existing tabs.

**No schema architecture changes beyond the two optional Project fields.**
Model profiles, prompt templates, prompt wrappers, and compatibility notes remain global across all projects.
Import/export safety, future-schema rejection, and older-schema migration are all preserved.

---

## v0.10.2 — Project Lifecycle Gate Cleanup (Completed)

**Version:** 0.10.2 · **Schema:** 0.10.2

**Reason:** v0.10.1 passed the build gate but did not pass the project lifecycle acceptance gate because `archiveProject()` and `deleteProject()` could leave `activeProjectId = null` when the last active project was removed.

**Fix:**

Added internal `resolveActiveId()` helper in `src/utils/projectUtils.ts`. After any archive or delete operation:

1. If the active project is **not** the one being archived/deleted → `activeProjectId` is unchanged.
2. If the active project **is** being archived/deleted and another non-archived project exists → switch to that project.
3. If the active project **is** being archived/deleted and **no** other non-archived project remains → automatically create a blank "Untitled Project" fallback and set it as active.

`activeProjectId` is now guaranteed to always point to a valid, non-archived project after archive/delete operations.

No AppState schema fields changed from v0.10.1. All import/export safety, future-schema rejection, and older-schema migration are preserved.

---

## v0.10.3 — Mediator Packet Response Inclusion Fix (Completed)

**Version:** 0.10.3 · **Schema:** 0.10.3

**Reason:** A blocking workflow bug surfaced during the v0.10.2 operational
trial. The Responses panel correctly showed model responses as
collected/reviewed, but the generated Mediator Packet often did **not**
include the actual response body text from each model. GPT-5.5 received
context and roster status but no synthesizable content, making the
mediator workflow unusable.

**Root cause (two interacting bugs):**

1. **Race condition in `ResponsesPanel.handleStatusChange`.** The
   handler operated on `activeRound.modelResponses` from a closure
   captured before the textarea's `onBlur` save had propagated. When
   the user pasted text and immediately clicked "reviewed", the
   click's `onUpdate` overwrote the just-saved blur update — leaving
   the persisted state with `status: 'reviewed'` but `responseText: ''`.
   Invisible in the Responses panel (which renders local textarea
   state), visible in the Mediator packet (which reads persisted
   state and saw the empty body).

2. **Status reset in `upsertModelResponse`.** Every textarea blur
   reset status to `'pasted'`, silently demoting any prior `'reviewed'`
   or `'excluded'` decision when the user edited a response. Combined
   with #1, this also wiped the body in some sequences.

**Fixes:**

1. **`upsertModelResponse` (`src/utils/roundUtils.ts`)** — preserves
   any prior `'reviewed'` or `'excluded'` status when re-saving the
   body. Only initializes status from text-presence on the first
   paste.

2. **`ResponsesPanel.handleStatusChange`** — race-safe rewrite. The
   handler now upserts the current local text first (atomic with the
   status change), eliminating the stale-closure overwrite of just-
   typed responseText.

3. **`generateMediatorPacket` (`src/utils/mediatorPacket.ts`)** — adds
   a dedicated `# Model Responses for This Round` section containing
   each included model's display name, role, vendor/model, status,
   pastedAt, and full response body. Bodies are wrapped using the
   shared `fence()` helper (now exported from `markdownExport.ts`)
   for safe dynamic-tilde fencing — model output containing nested
   triple-backticks, JSON, terminal output, etc. cannot break the
   packet structure. Excluded responses now go into a separate
   `# Excluded Responses` section listed for transparency but
   explicitly excluded from synthesis. Missing bodies are flagged
   with a clear `[Missing response body]` marker.

4. **`MediatorPanel`** — adds a per-model response inclusion summary
   near the packet controls (e.g. "GPT-5.5 Thinking — included —
   2,140 chars"). Also adds a stale-packet detector: when the saved
   `mediatorPrompt` doesn't appear to contain a current response
   body's prefix, a banner prompts the user to click Regenerate
   before copying.

5. **`fence()` helper** — promoted from file-private in
   `markdownExport.ts` to a named export so other Markdown
   generators (now `mediatorPacket.ts`, future generators) can reuse
   the same dynamic-tilde fencing without duplication.

**Behavior preserved (no regressions):**

- All existing mediator packet structure intact: Project / Canonical
  State / Round Instruction / Participating Models / completion
  banner / Known Risks / Open Questions / Required Structured
  Output sections (12 mandatory headings) — unchanged.
- Dynamic Markdown fencing preserved across all exports.
- Gemini Review Packet export preserved (still local-only).
- RoundTable naming, storage key `roundtable.appState.v1`, project
  lifecycle controls from v0.10.2, import/export validation,
  future-schema rejection, older-schema migration — all intact.
- No new dependencies. No API/scraping/automation/backend/auth/
  cloud-sync surfaces introduced.

**No AppState shape change.** Schema version bumped to 0.10.3 only
to keep package/app/schema versions aligned. The `Round` and
`ModelResponse` types are byte-identical to v0.10.2; v0.10.2 exports
import into v0.10.3 with no migration step required (the chain step
0.10.2 → 0.10.3 is a structural no-op — same pattern as the 0.4 →
0.7 chain).

**Operator note:** After editing/saving responses, click
**Regenerate Packet** before copying. The Mediator panel will warn
when the saved packet looks stale, but the warning is heuristic —
when in doubt, regenerate.

---

## v0.10.4 — Response Persistence / Aggregation Hardening (Completed)

**Version:** 0.10.4 · **Schema:** 0.10.4

**Reason:** Gemini's review of v0.10.3 identified residual risk in the
response persistence path: even after the textarea-blur + status-click
race was fixed inside `ResponsesPanel`, the underlying `onUpdate`
contract still allowed two dispatches in the same React batch to
overwrite each other at the `rounds` array slice. The v0.10.3 fix
worked only because the second dispatch's array happened to include
the text from `localResponses`. That was fragile.

The v0.10.4 brief framed this as **"Total Serialization"**: no
workflow transition is allowed to rely on text that exists only in a
transient component-local draft. Before any status change, review
action, aggregation, mediator generation, or round transition, the
current response text must be committed to the durable round state.

**Root cause this patch addresses:**

`onUpdate(partial)` produced `partial.rounds = [whole new array]`
computed from the handler's closure-captured `state`. App.tsx's
`setState((prev) => ({ ...prev, ...partial }))` used a functional
updater for the *merge*, but `partial.rounds` itself was a pre-
computed whole array. Two dispatches in the same React batch raced at
the array level: the second's pre-computed array overwrote the first's
at the slice level, and the second's array was computed from state
that didn't see the first's update.

**Fix architecture:**

1. **`AppStateUpdater` type** (`src/types/appState.ts`) — `onUpdate`
   now accepts either a `Partial<AppState>` (legacy callers) or a
   functional `(prev: AppState) => Partial<AppState>` (new callers
   that need to compose against the latest state).

2. **`onUpdate` in App.tsx** — resolves the argument inside the
   `setState` updater. Functional form receives the latest state,
   so dispatches compose correctly even within a single React batch.

3. **`updateRoundFunctional(roundId, recipe)`** (`src/utils/roundUtils.ts`)
   — new helper that returns a functional updater. The `recipe`
   callback receives the *latest* version of the round (so any
   concurrently-dispatched commits are already applied) and returns
   the next version. This is the recommended pattern for any
   workflow transition that touches a round.

4. **`upsertModelResponse` displayName preservation** — when caller
   passes empty string, the existing record's `modelDisplayName` is
   kept. Defensive fallback for the unmount-flush path.

5. **`ResponsesPanel` handlers rewritten** to use
   `updateRoundFunctional`:
   - `handleBlur` — race-free commit of current local text.
   - `handleStatusChange` — recipe applies status atop a fresh
     upsert of current local text, all against the latest round.

6. **`ResponsesPanel` unmount flush** — on panel unmount (tab
   navigation away), a useEffect cleanup composes a single functional
   updater that flushes every dirty local draft. This is the cross-
   panel half of Total Serialization: MediatorPanel mounts against a
   round that includes every draft the user typed, regardless of
   whether they ever blurred the textarea.

7. **`flushAllDraftsAndNavigate` helper** — wired to the "Generate
   Mediator Packet Anyway →" navigation button. Explicit flush before
   navigation, belt-and-suspenders with the unmount cleanup.

8. **`MediatorPanel.handleGenerate` rewrite** — reads the round from
   the latest `prev` inside the functional updater, never from the
   component closure. Defensive against any draft commit that lands
   in the same React batch as the Generate click. Generation always
   operates on canonical saved responses.

9. **Status-only updates preserve all fields.** v0.10.3's preservation
   of `responseText`, `pastedAt`, `id`, `modelProfileId` on status
   change is reaffirmed and now operates against the latest round
   resolved by the functional updater rather than a stale closure.

**Behavior preserved (no regressions):**

- All v0.10.3 mediator packet behavior intact: dedicated
  `# Model Responses for This Round` section with dynamic-tilde-
  fenced bodies, `# Excluded Responses` section, per-model inclusion
  summary in the Mediator UI, stale-packet detector and banner.
- Dynamic Markdown fencing preserved everywhere.
- Gemini Review Packet export preserved (still local-only).
- RoundTable naming, storage key `roundtable.appState.v1`, project
  lifecycle controls from v0.10.2, import/export validation,
  future-schema rejection, older-schema migration — all intact.
- No new dependencies. No API/scraping/automation/backend/auth/
  cloud-sync surfaces introduced.

**No AppState shape change.** Schema version bumped to 0.10.4 only
to keep package/app/schema versions aligned. `Round` and
`ModelResponse` types are byte-identical to v0.10.3. The migration
engine handles 0.10.3 → 0.10.4 via the `SCHEMA_STAMP_UPDATED` path
(no chain step required — same pattern as 0.8.0 → 0.10.x).

**Files changed:**

| File | Change |
|---|---|
| `src/types/appState.ts` | Added `AppStateUpdater` type |
| `src/App.tsx` | `onUpdate` accepts `AppStateUpdater` |
| `src/utils/roundUtils.ts` | Added `updateRoundFunctional`; defensive displayName preservation in `upsertModelResponse` |
| `src/components/ResponsesPanel.tsx` | Functional updater everywhere; unmount flush; `flushAllDraftsAndNavigate` helper; race-safe `handleStatusChange` |
| `src/components/MediatorPanel.tsx` | `handleGenerate` uses functional updater |
| `src/components/ModelRosterPanel.tsx`, `ExportImportPanel.tsx`, `ProjectManagerPanel.tsx`, `RoundBuilderPanel.tsx`, `DecisionLogPanel.tsx`, `ProjectStatePanel.tsx` | Prop signature widened to `AppStateUpdater` (backward-compatible — existing `Partial<AppState>` callers still type-check) |
| `package.json`, `package-lock.json`, `src/config/exportFormats.ts` | Version → 0.10.4 |
| `README.md`, `docs/PHASE_HISTORY.md` | Changelog |

**Regression test scenario (per the brief):**

1. Start a round with 4 models (GPT-5.5 Thinking, Claude Opus, Claude
   Sonnet, Gemini).
2. Generate prompts.
3. Paste a distinct response for each model.
4. Without clicking outside the textarea, immediately click Reviewed.
   → handleStatusChange dispatches a functional updater that
   commits the current local text in the same atomic update as the
   status change. No race, no overwrite.
5. Generate mediator.
   → handleGenerate reads the round from `prev` inside the updater.
   The ResponsesPanel unmount cleanup has already flushed any
   dirty drafts. Packet includes all 4 bodies.
6. Refresh the page.
   → App.tsx's `useEffect(..., [state])` persists state to
   `localStorage` after every commit. On refresh,
   `localStorageAdapter.loadWithRecovery()` restores it. All 4
   responses present.
7. Re-generate mediator.
   → Reads from restored state. Packet again includes all 4.


---

## v0.10.5 — Mediator Extraction Tolerance + State Mutation Cleanup (Current)

**Version:** 0.10.5 · **Schema:** 0.10.5

**Reason:** GPT-5.5 and Gemini approved v0.10.4 with two non-blocking
follow-ups: (1) mediator synthesis extraction was too brittle around
`###` headings — real mediator output uses many variants — and (2)
`MediatorPanel.handleGenerate` called a local React state setter
(`setGeneratedPacket`) inside an `onUpdate((prev) => ...)` functional
updater, a React purity violation that the docs explicitly warn
against. v0.10.5 fixes both, migrates the remaining safe
`replaceRound` call sites to `updateRoundFunctional`, and refreshes
UI copy that still described pre-v0.10.4 save behavior.

**Fixes implemented:**

1. **Mediator extraction tolerance** (`src/utils/mediatorExtract.ts`).
   Replaced the brittle `split(/^###\s+/m)` parser with a line-based
   parser. Two helper functions exported for unit-test reuse:
   `isHeadingShaped(line)` and `detectMediatorHeading(line)`.
   Heading detection now handles:
   - Any Markdown level (`#` through `######`)
   - Numbered prefixes (`1.`, `1)`, `01.`, `1:`)
   - Bracketed labels (`[EXECUTIVE SUMMARY]`)
   - Trailing colons (ASCII `:` and full-width `：`)
   - Mixed case
   - Dash-suffix variants (`Executive Summary — Notes`)

   The colon-suffix form is only treated as a heading when the prefix
   (after stripping number/colon) maps to a known
   `MediatorSynthesis` field. This prevents splitting on every
   `Note:` or `Risk: high` line in body content.

   Unknown heading-shaped lines flush the previous section, set the
   current key to `null`, and discard their body until the next
   known heading. Known content is never overwritten.

   Manual fallback remains: when extraction is incomplete, fields
   stay empty for the user to fill in.

2. **`MediatorPanel.handleGenerate` purity**
   (`src/components/MediatorPanel.tsx`). The `generatedPacket`
   React-local state was removed; the display value is now derived
   directly from `round.mediatorPrompt`. With this, `handleGenerate`
   is a pure functional updater dispatched via `updateRoundFunctional`
   — no `setState`-inside-updater anti-pattern. The recipe still
   resolves the round inside the React updater, so v0.10.4's
   latest-state-read property is preserved.

3. **Remaining `replaceRound` call sites migrated**:
   - `MediatorPanel.handleSaveResponse` → `updateRoundFunctional`
   - `MediatorPanel.handleSaveSynthesis` → `updateRoundFunctional`
   - `RoundBuilderPanel.handleSaveInstruction` → `updateRoundFunctional`
   - `RoundBuilderPanel.handleGenerate` → `updateRoundFunctional`
   - `RoundBuilderPanel.handleCopy` → `updateRoundFunctional`
   - `DecisionLogPanel` had an unused `replaceRound` import — removed.

   `replaceRound` itself is now `@deprecated` in `roundUtils.ts`. It
   is no longer called by any in-app code path. It is kept exported
   only for backward compatibility with any external tests or
   downstream code; removal scheduled for a future major-version
   release.

4. **UI copy refresh** (`src/components/ResponsesPanel.tsx`). The
   panel description "Changes save on focus-out" was misleading
   after v0.10.4 — it suggested blur was the only save path.
   Updated to "Drafts are committed automatically on blur, on
   status change, and before mediator navigation."

**Behavior preserved (no regressions):**

- v0.10.4 Total Serialization intact. All paths that mutate the
  active round now go through `updateRoundFunctional`, which
  resolves the latest round inside the React `setState` updater
  (eliminating stale-closure overwrites entirely).
- v0.10.3 mediator packet structure intact: dedicated
  `# Model Responses for This Round` section with dynamic-tilde-
  fenced bodies, `# Excluded Responses` section, per-model
  inclusion summary, stale-packet detector.
- Dynamic Markdown fencing preserved.
- Gemini Review Packet export preserved (still local-only).
- RoundTable naming, storage key `roundtable.appState.v1`, project
  lifecycle controls, import/export validation, future-schema
  rejection, older-schema migration — all intact.
- No new dependencies. No API/scraping/automation/backend/auth/
  cloud-sync surfaces introduced.

**No AppState shape change.** Schema version bumped to 0.10.5 only
to keep package/app/schema versions aligned. The migration engine
handles 0.10.4 → 0.10.5 via the `SCHEMA_STAMP_UPDATED` path.

**Extraction test results** (10 cases verified via bundled-test
run, including all 6 cases from the v0.10.5 brief + edge cases):

| Case | Input | Result |
|---|---|---|
| 1: canonical `###` | `### Executive Summary` | ✓ extracted |
| 2: numbered `###` | `### 1. Executive Summary` | ✓ extracted |
| 3: `##` heading | `## Executive Summary` | ✓ extracted |
| 4: `[BRACKET]` label | `[EXECUTIVE SUMMARY]` | ✓ extracted |
| 5: colon label | `Executive Summary:` | ✓ extracted |
| 6: unknown intermixed | `### Random Internal Note` between known | ✓ known content preserved, unknown body discarded |
| 7: empty input | `""` | ✓ no crash, 0 extracted |
| 8: no headings | manual fallback | ✓ no crash, 0 extracted, fields empty for manual fill |
| 9: `1)` parenthesis number | `#### 1) Executive Summary` | ✓ extracted |
| 10: dash-suffix | `### Executive Summary — Notes` | ✓ extracted |
| 11: colon in body | `Note: the team agreed` not treated as heading | ✓ stays in body |
| 12: full-width colon | `Executive Summary：` | ✓ extracted |

**Files changed:**

| File | Change |
|---|---|
| `src/utils/mediatorExtract.ts` | Rewritten as line-based parser; exports `isHeadingShaped`, `detectMediatorHeading`, `normalizeMediatorHeading` |
| `src/components/MediatorPanel.tsx` | `generatedPacket` derived from round; `handleGenerate`/`handleSaveResponse`/`handleSaveSynthesis` migrated to `updateRoundFunctional` |
| `src/components/RoundBuilderPanel.tsx` | `handleSaveInstruction`/`handleGenerate`/`handleCopy` migrated to `updateRoundFunctional` |
| `src/components/DecisionLogPanel.tsx` | Dropped unused `replaceRound` import |
| `src/components/ResponsesPanel.tsx` | UI copy: "Changes save on focus-out" → "Drafts are committed automatically on blur, on status change, and before mediator navigation." |
| `src/utils/roundUtils.ts` | `replaceRound` marked `@deprecated` |
| `package.json`, `package-lock.json`, `src/config/exportFormats.ts` | Version → 0.10.5 |
| `README.md`, `docs/PHASE_HISTORY.md`, `docs/RELEASE_CHECKLIST.md` | Changelog |


---

## v0.11.0 — Markdown Handoff Mode (Current — Checkpoint I, RC)

**Version:** 0.11.0 · **Schema:** 0.11.0

**Objective:** Add a parallel, file-mediated substrate to the v0.10.x
clipboard workflow so operators can save, share, archive, and re-import
RoundTable artifacts without ever touching an API, a backend, or a
network surface. Preserve every Phase 0 boundary: local-first, manual
copy-paste / file-handoff, no automation, no backend, no cloud sync,
no model-provider integration.

**Delivered across Checkpoints A–I:**

### Foundations (Checkpoints A–C)

- **A — Markdown artifact foundations.** New types
  (`MarkdownArtifactFrontmatter`, `BuiltArtifact`, `BuildArtifactInput`),
  locked constants in `src/config/markdownHandoff.ts`, the locked
  normalization spec in `markdownNormalize.ts`, SHA-256 hashing in
  `markdownHash.ts`, the frontmatter splitter + code-fence-aware
  walker in `markdownParse.ts`, and the single-source-of-truth
  `buildArtifact()` in `markdownArtifact.ts` covering all five
  source kinds (`generated_prompt`, `model_response`, `mediator_packet`,
  `mediator_synthesis`, `raw_notes`).

- **B — Raw Notes panel + Import History panel (UI shells).** New
  AppState fields `rawNotes: RawNote[]` and
  `importHistory: ImportTransaction[]` (both bounded ring buffers).
  Migration step `migrate_0_10_5_to_0_11_0` defaults both to `[]`
  for older states. Read-only panels render the substrates.

- **C — Download .md export controls.** Every workflow surface that
  has a Copy button gained a parallel Download `.md` button.
  Filenames follow the locked `RT_<KIND>_<PROJECT>_Round-<N>_<MODEL>_<DATE>_<ID>.md`
  pattern. The download path consumes `buildArtifact().fullText`
  exclusively — the same-source guarantee is enforced.

- **C.5 — Storage pressure surfacing.** New `saveWithReport()` on
  `localStorageAdapter` returns a pressure report alongside every
  save. The app shell renders a `StoragePressureBanner` at the
  `warn`, `hard`, and `error` levels, pointing operators at Raw
  Notes, Import History, and Export/Import for pruning.

### Import pipeline (Checkpoints D–H)

- **D — Upload .md controls + ImportPreviewModal + useMarkdownUpload hook.**
  Panel-level Upload `.md` affordances on Round Builder, Responses,
  Mediator, Decision Log, Export/Import. The hook encapsulates the
  read → preview → commit state machine. The modal renders the
  preview with warnings grouped by severity and offers Import,
  Import as Raw Notes, and Cancel.

- **D — Import as Raw Notes.** Universal fallback. Any file the
  importer can't safely commit can be saved verbatim as a Raw
  Note. Snapshot-rollback removes the note.

- **E — Structured `mediator_synthesis` commit.** First structured
  commit path. `commitMediatorSynthesis` parses the body via the
  fence-aware extractor and populates `round.mediatorSynthesis`
  while preserving the raw body on `round.mediatorResponse`. The
  body parser emits `REQUIRED_SECTION_MISSING`, `DUPLICATE_HEADING`,
  and `UNMATCHED_HEADING` warnings as appropriate.

- **F — Round-trip hash correctness.** `splitFrontmatter` was
  consuming the conventional `---\n\n` separator's blank line as
  the body's leading `\n`, causing every clean round-trip to fire
  `CONTENT_HASH_MISMATCH`. Fixed by recognizing the single
  conventional blank line as separator and skipping it. Genuine
  double-blank-line bodies still hash differently — a real edit
  signal, not noise.

- **G — Structured `model_response` commit + per-slot Upload .md.**
  `commitModelResponse` upserts a response slot, preserving the
  existing slot's reviewed/excluded status (a `reviewed` slot
  stays `reviewed` when the body is replaced). The ResponsesPanel
  per-slot Upload `.md` button passes `expectedModelId` so a
  mismatch surfaces `MODEL_ID_MISMATCH_WITH_SLOT` and hard-blocks
  structured commit (Raw Notes remains available).

- **H — Structured `generated_prompt` and `mediator_packet`
  commits.** The remaining two source kinds. `commitGeneratedPrompt`
  mirrors `commitModelResponse`'s status-preservation pattern;
  `commitMediatorPacket` touches only `round.mediatorPrompt`,
  preserving `mediatorSynthesis` and `modelResponses`. Locked-
  round + overwrite + model-not-in-roster gates are wired for
  both.

- **H — POTENTIALLY_TRUNCATED false-positive fix.** The truncation
  heuristic in `detectTruncationAndUnclosedFence` checked the last
  non-blank line's last character against a terminator list.
  Because RoundTable-generated prompt and response artifacts end
  with a closing tilde fence (`~~~~`), every clean round-trip
  fired `POTENTIALLY_TRUNCATED`. Fixed by recognizing a line of
  only fence characters as a clean end-of-body marker. Genuine
  truncation (open fence with no close) is still caught by the
  separate `UNCLOSED_CODE_FENCE` walker.

### Release-candidate hardening (Checkpoint I — this checkpoint)

- **`docs/MARKDOWN_HANDOFF.md`** (NEW) — operator reference covering
  what the mode is, why it exists, source kinds, export flow,
  import flow, Raw Notes fallback, Import History, rollback,
  storage pressure, known limitations, deferred items, and the
  reaffirmation that v0.11.0 introduces no network or backend
  surface.

- **`scripts/acceptance-walk.ts`** (NEW) — bundled smoke test that
  walks all 15 acceptance criteria from the feasibility plan
  against the actual code. Currently reports **15/15 PASS** on
  a clean Checkpoint H base.

- **`docs/PHASE_HISTORY.md`** — this entry.
- **`docs/SCHEMA_EVOLUTION.md`** — new `0.10.5 → 0.11.0` section.
- **`docs/DATA_MODEL.md`** — new "v0.11.0 Markdown Handoff Fields"
  section covering `rawNotes`, `importHistory`, and the artifact
  type aliases.
- **`docs/RELEASE_CHECKLIST.md`** — new "v0.11.0 Acceptance Walk"
  section with the operator's manual verification list for the
  Markdown handoff flow.

- **Raw Notes delete button** — optional Checkpoint I item.
  Implemented because `removeRawNote` already exists in
  `importHistory.ts` and the UI change is small. Confirms before
  delete; no batch delete; no import-behavior change.

- **Version-string alignment** — `README.md`, `docs/DATA_MODEL.md`,
  `docs/SCHEMA_EVOLUTION.md`, and `docs/RELEASE_CHECKLIST.md`
  updated to declare `0.11.0` where they previously declared
  `0.10.x`.

**Acceptance walk result (Checkpoint I, run against Checkpoint H
base):**

| #  | Criterion                                            | Verdict |
|----|------------------------------------------------------|---------|
| 1  | Same-source guarantee                                | PASS    |
| 2  | Round-trip integrity for all 5 source kinds          | PASS    |
| 3  | Stale canonical-state detection                      | PASS    |
| 4  | Stale prompt detection                               | PASS    |
| 5  | Post-export edit detection                           | PASS    |
| 6  | Malformed YAML → Raw Notes                           | PASS    |
| 7  | Truncated body → Raw Notes / partial warning         | PASS    |
| 8  | Code-fence-aware extraction                          | PASS    |
| 9  | CRLF/LF stability + leading BOM                      | PASS    |
| 10 | Rollback restores state (body + status)              | PASS    |
| 11 | No silent data loss                                  | PASS    |
| 12 | Forward-schema rejection preserved                   | PASS    |
| 13 | Migration safety + idempotency                       | PASS    |
| 14 | No new network surfaces                              | PASS    |
| 15 | Existing v0.10.5 workflows unaffected                | PASS    |

**Behavior preserved from v0.10.5 and earlier:**

- v0.10.5 Mediator extraction tolerance intact (numbered headings,
  bracket labels, colon labels, mixed case).
- v0.10.4 Total Serialization intact — every round mutation still
  dispatches via `updateRoundFunctional`.
- v0.10.3 mediator packet structure intact — `# Model Responses
  for This Round` section, dynamic-tilde fencing.
- Phase 9 RoundTable rename intact — `roundtable.appState.v1`
  storage key, `ROUNDTABLE_` filename prefix for legacy exports.
- Phase 7B vendor resilience intact — all `promptWrappers`,
  `compatibilityNotes` behaviors unchanged.
- Phase 7A migration engine intact — future-schema rejection
  (`UNSUPPORTED_SCHEMA_VERSION`) still hard-blocks; older-schema
  imports still migrate with notices.

**No new dependencies, no new network surfaces, no new backend.**

**Files added (Checkpoint I):**

| File | Purpose |
|---|---|
| `docs/MARKDOWN_HANDOFF.md` | Operator reference for Markdown Handoff Mode |
| `scripts/acceptance-walk.ts` | 15-criterion acceptance walk smoke test |

**Files modified (Checkpoint I):**

| File | Change |
|---|---|
| `README.md` | Version line → 0.11.0; v0.11.0 callout; reference to MARKDOWN_HANDOFF.md |
| `docs/PHASE_HISTORY.md` | This v0.11.0 entry; phase table updated |
| `docs/SCHEMA_EVOLUTION.md` | New `0.10.5 → 0.11.0` section; current schema version → 0.11.0 |
| `docs/DATA_MODEL.md` | New "v0.11.0 Markdown Handoff Fields" section; current schema → 0.11.0 |
| `docs/RELEASE_CHECKLIST.md` | New v0.11.0 acceptance walk + version-alignment update |
| `src/components/RawNotesPanel.tsx` | Optional delete button (confirm-before-delete); panel now takes `onUpdate` |
| `src/App.tsx` | Pass `onUpdate` to RawNotesPanel |

**Schema version:** `0.11.0`. AppState adds two top-level arrays
(`rawNotes`, `importHistory`), both bounded ring buffers, both
defaulted to `[]` by the migration. No other shape change.
