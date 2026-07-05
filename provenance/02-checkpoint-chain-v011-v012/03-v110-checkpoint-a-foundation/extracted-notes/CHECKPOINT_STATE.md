# RoundTable v0.11.0 Markdown Handoff Mode — Checkpoint State

**Status:** in-progress, build clean, UI wiring not yet started.

This document describes the exact state of the codebase at the moment this zip was produced. Read it before resuming.

## Build state

Last verified `npx tsc --noEmit` produced no output (clean compile).
`node_modules` is not bundled in this archive — run `npm install` after extracting.
Dependencies declared: `react`, `react-dom`, `js-yaml`, plus the v0.10.5 dev set and `@types/js-yaml`.

## What is complete (v0.11.0 foundation layer)

All of the following compile and form a working, *unused-by-UI* foundation. None of them have UI surface yet.

### Types
- `src/types/markdownArtifact.ts` — every new type for v0.11.0 (frontmatter, source-kind discriminator, BuiltArtifact, RawNote, ImportPreview, ImportTransaction, ImportSnapshotSlice, ImportChange, ImportValidationWarning, ImportOutcome, etc.).
- `src/types/appState.ts` — `rawNotes: RawNote[]` and `importHistory: ImportTransaction[]` added.
- `src/types/round.ts` — optional `canonicalStateHashAtGeneration?: string` added to `GeneratedPrompt`.

### Config
- `src/config/exportFormats.ts` — `SCHEMA_VERSION = '0.11.0'`, `APP_VERSION = '0.11.0'`, new `ARTIFACT_TYPE = 'roundtable.markdown.v1'`.
- `src/config/markdownHandoff.ts` — all locked constants (`RAW_NOTES_DEFAULT_CAP = 200`, `IMPORT_HISTORY_DEFAULT_CAP = 50`, `STORAGE_WARN_BYTES`, `STORAGE_HARD_BYTES`, `MARKDOWN_FILE_ACCEPT`, `TRUNCATION_TERMINATORS`, `FILENAME_PREFIXES`).

### Pipeline (pure utilities, no UI hooks)
- `src/utils/markdownNormalize.ts` — BOM-strip, NFC, CRLF→LF, single trailing LF. Locked spec.
- `src/utils/markdownHash.ts` — SHA-256 via SubtleCrypto, `sha256:<hex>` namespace, `isHashingAvailable()` graceful-degrade check.
- `src/utils/markdownParse.ts` — strict frontmatter splitter + code-fence-aware line walker (`walkFenceAware`, `iterateFenceAwareSections`).
- `src/utils/markdownArtifact.ts` — **single source of truth** `buildArtifact(input): BuiltArtifact`. Five source kinds dispatched; hand-rolled YAML frontmatter serializer with locked field order. `filenameFor()` helper. `hashProjectCanonicalState()` / `hashPromptText()` helpers.
- `src/utils/mediatorExtract.ts` — extended with `walkFenceAware`. Synthesis parser now ignores heading-shaped lines inside `~~~` / ` ``` ` fences. Returns `unclosedFence: boolean` for caller to surface as `UNCLOSED_CODE_FENCE`.
- `src/utils/artifactImport.ts` — **parse + preview side** of the import pipeline. Exports: `buildImportPreview(rawText, state)`, `checkCanonicalStateStaleness`, `checkPromptStaleness`, `rawNoteFromPreview`, `roundTripPreview`. Pure; no AppState mutation.
- `src/utils/importHistory.ts` — **commit + rollback side**. Exports: `commitAsRawNote(preview)`, `commitStructured(preview, state)`, `rollbackTransaction(transactionId, reason)`, `canRollback(state, transactionId)`, `addRawNote`, `removeRawNote`. Pure; returns `AppStateUpdater` for caller to dispatch.
- `src/utils/storagePressure.ts` — Gemini amendment: `reportStoragePressure(state)`, `projectPostWritePressure(state, extraBytes)`, `byteLength`, `formatBytes`. Tracks `'ok' | 'warn' | 'hard'` levels against the locked thresholds.
- `src/utils/migration.ts` — new step `migrate_0_10_5_to_0_11_0` appended to `MIGRATION_CHAIN`. Defaults `rawNotes: []` and `importHistory: []`; idempotent.
- `src/utils/validation.ts` — added `rawNotes` / `importHistory` to required-arrays list; added `normalizeRawNotes` and `normalizeImportHistory` pass-through normalizers.
- `src/utils/roundUtils.ts` — `generatePromptsForRound` gains an optional `canonicalStateHashAtGeneration` parameter; when provided it is stamped onto each `GeneratedPrompt`.

### Storage / data
- `src/data/initialAppState.ts` — both new arrays defaulted to `[]`.
- `src/storage/localStorageAdapter.ts` — `saveWithReport(state): StorageSaveResult` added. `save()` preserved as backward-compatible void wrapper that internally calls `saveWithReport`. Recognizes `QuotaExceededError`, returns structured failure rather than crashing. Logs WARN / HARD pressure levels to console.

### Package
- `package.json` — version bumped to `0.11.0`; `js-yaml ^4.1.0` added to deps; `@types/js-yaml ^4.0.9` added to devDeps.
- `package-lock.json` — refreshed (js-yaml + argparse + @types/js-yaml present).

## What is NOT done

### Components — none of these exist yet
- `src/components/ImportPreviewModal.tsx` — the parse/validate/commit gate.
- `src/components/RawNotesPanel.tsx` — list view of fallback notes with filters.
- `src/components/ImportHistoryPanel.tsx` — list view of transactions with rollback button on the most-recent un-rolled-back entry.

### Existing panels — unchanged from v0.10.5
- `src/components/RoundBuilderPanel.tsx` — needs Download .md per prompt, Upload .md picker, stale-canonical-state badge, capture of canonical-state hash at generation time.
- `src/components/ResponsesPanel.tsx` — needs Download .md per response, Upload .md picker per slot.
- `src/components/MediatorPanel.tsx` — needs Download .md beside "Copy → GPT-5.5", Upload .md for synthesis import, hash-based stale-packet indicator (replace v0.10.3 prefix heuristic, both coexist for one release).
- `src/components/DecisionLogPanel.tsx` — needs Upload .md for synthesis-as-decision-source.
- `src/components/ExportImportPanel.tsx` — unchanged; could optionally surface storage-pressure banner.

### App shell
- `src/App.tsx` — unchanged from v0.10.5. Two new tabs need adding:
  - `{ id: 'raw-notes', label: 'Raw Notes' }`
  - `{ id: 'import-history', label: 'Import History' }`
  - Update `TABS` const, add cases in `renderPanel()`.
  - Optional: surface storage-pressure banner via `saveWithReport()` result.

### CSS
- `src/styles/app.css` — unchanged. The new UI elements (modal, raw-notes list rows, history rows, stale-state badges, pressure banners) need styles. The existing design tokens (amber/green/red/blue) cover most use cases.

### Documentation
- `docs/MARKDOWN_HANDOFF.md` — does not exist yet. The operator's manual / acceptance criteria reference.
- `docs/PHASE_HISTORY.md` — needs a v0.11.0 entry.
- `docs/SCHEMA_EVOLUTION.md` — needs the 0.10.5 → 0.11.0 migration entry.
- `docs/DATA_MODEL.md` — needs `RawNote`, `ImportTransaction`, `canonicalStateHashAtGeneration` documented.
- `docs/RELEASE_CHECKLIST.md` — needs the 15 acceptance criteria from the feasibility doc.

## Design assumptions baked in

### Single-source-of-truth contract
Every UI surface (download, copy-as-md, preview render) must consume `BuiltArtifact.fullText`. There is no other path. The hand-rolled YAML serializer in `markdownArtifact.ts` emits a locked field order so byte-identical input produces byte-identical output. Tests should assert this.

### Same `buildArtifact()` signature for every kind
`buildArtifact(input: BuildArtifactInput): Promise<BuiltArtifact>` — async because hashing is async. The `input` is a discriminated union on `.kind`. Callers always `await` and consume `result.fullText`.

### Import pipeline split
- Parse/preview lives in `artifactImport.ts`. Pure; no AppState mutation.
- Commit lives in `importHistory.ts`. Pure; returns `AppStateUpdater` functions.
- The modal calls `buildImportPreview()` first, displays the result, then on user confirm calls `commitAsRawNote()` or `commitStructured()` and dispatches the returned updater through `App.tsx`'s `onUpdate`.
- Rollback uses `rollbackTransaction(id, reason)` from `importHistory.ts`; the History UI must check `canRollback()` first to grey the button on older transactions.

### Storage pressure
Every save runs through `saveWithReport()`. Levels: `ok`, `warn` (cosmetic banner), `hard` (block growing operations). The commit-gate in `buildImportPreview` already includes a `STORAGE_NEAR_LIMIT` warning via `projectPostWritePressure()`. The UI must respect the `hard` level and offer download/prune affordances.

### Raw Notes is the universal fallback
Every path that cannot safely commit produces a `RawNote` with the verbatim body and every parsed-or-detected hint preserved. No silent data loss. Raw Notes is *not re-importable*.

### Most-recent-only rollback
Locked for v0.11.0. The history UI must grey the rollback button on all but the most recent un-rolled-back transaction (`canRollback(state, txId)`).

### Hash format
`sha256:<lowercase-hex>` with the algorithm prefix as a namespace. Readers reject unknown algorithm prefixes via `parseContentHash` rather than guessing.

### Normalization
BOM strip + NFC + CRLF→LF + single trailing LF. **Per-line whitespace is preserved.** Editor whitespace mutation is a documented source of false `CONTENT_HASH_MISMATCH` warnings; the import preview surfaces them and lets the user import anyway.

## How to resume

1. Run `npm install` (the lockfile lists `js-yaml` and `@types/js-yaml`).
2. Run `npx tsc --noEmit` and confirm clean build.
3. Build the three new components in this order (each depends on the previous):
   - `ImportPreviewModal.tsx` — invoked from every Upload .md affordance.
   - `RawNotesPanel.tsx` — list of raw notes with filters.
   - `ImportHistoryPanel.tsx` — list of transactions with rollback.
4. Update `App.tsx` to register the two new tabs and route them.
5. Wire Download/Upload .md buttons into the four existing panels (RoundBuilder, Responses, Mediator, DecisionLog). Every Download path calls `await buildArtifact(input)` and consumes `result.fullText`.
6. Add CSS for the new elements.
7. Write `docs/MARKDOWN_HANDOFF.md` and update `PHASE_HISTORY` / `SCHEMA_EVOLUTION` / `DATA_MODEL` / `RELEASE_CHECKLIST`.
8. Run through the 15 acceptance criteria from the feasibility doc (`v0.11.0-markdown-handoff-feasibility.md`, sec. 12).

## Caveats and known minor issues

- `src/utils/markdownArtifact.ts` `buildMediatorPacketBody()` has a fallback path when `round.mediatorPrompt` is empty that calls `generateMediatorPacket` with `selectedModels: []`. In practice the UI only shows the Download .md button when a packet exists, so this fallback should be rare; consider refactoring the signature to accept `modelProfiles` if exercising the fallback becomes common.
- The v0.10.3 60-char prefix-heuristic stale-packet check in `MediatorPanel.tsx` is still in place — it should *coexist* with the hash-based check for one release per the locked Q14 decision, and be removed in v0.11.1.
- `artifactImport.ts` and `importHistory.ts` were authored in a prior session that this assistant did not see in conversation history. They form a coherent split (parse-side vs commit-side) and the build is clean, but the design has not been independently re-reviewed in this session.
- `rt-v105/` exists at the top level inside the working tree as a side effect of an earlier `cp -r` (a snapshot of the v0.10.5 baseline). It is NOT included in this zip.
