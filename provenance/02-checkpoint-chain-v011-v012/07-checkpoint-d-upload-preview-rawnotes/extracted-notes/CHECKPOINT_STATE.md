# RoundTable v0.11.0 Markdown Handoff Mode — Checkpoint D State

**Status:** Upload `.md` + ImportPreviewModal + Raw Notes fallback wired into the three primary panels. Build clean. Structured import commit (replace-or-append into rounds) NOT yet wired — that is Checkpoint E.

This document describes the exact state of the codebase at the moment this zip was produced. Read it before resuming.

## What changed in Checkpoint D

One new file (the upload hook), one extended foundation component (the modal gained an optional deferred-import prop), three new Upload `.md` affordances across the workflow panels.

### Files created (1)

- `src/hooks/useMarkdownUpload.ts` (≈220 lines) — custom React hook encapsulating the entire `Upload .md → buildImportPreview → ImportPreviewModal → commitAsRawNote` flow. Returns a `MarkdownUploadHandle` with `{ fileInputRef, triggerUpload, onFileInputChange, loading, error, status, modalProps, acceptString }`. The hook owns:
  - The hidden file-input ref + a `triggerUpload()` programmatic click.
  - The `File.text()` read + a `try`/`catch` rail that exposes user-facing errors.
  - The preview state + modal `open` / `preview` lifecycle.
  - Pre-dispatch storage-pressure projection (via `projectPostWritePressure`) — at the `hard` level we surface a `window.confirm` so the user has explicit agency before pushing localStorage closer to its quota.
  - The Raw Notes commit dispatch (via `commitAsRawNote` from `utils/importHistory.ts`), wrapped in a `try`/`catch` so a failed dispatch surfaces an error instead of silently dropping content.
  - A `structuredImportDeferredReason` string baked into `modalProps` — the modal renders the primary Import button DISABLED with this as both tooltip and visible note.

### Files modified (4)

- `src/components/ImportPreviewModal.tsx` — added an optional `structuredImportDeferredReason?: string` prop. When set:
  - A status notice (`notice info`) is rendered above the action row with the explanatory string.
  - The structured Import button still renders (so the affordance is visible) but is `disabled` and labelled `Import (deferred)` with the deferred-reason as its `title` tooltip.
  - The Import as Raw Notes button gets promoted to `btn-primary` styling when structured Import is deferred — Raw Notes is the de-facto primary affordance in Checkpoint D.
  - When Errors are present the existing hard-error notice still takes precedence; the deferred notice only appears when validation passed but structured commit is off.
- `src/components/RoundBuilderPanel.tsx` — instantiated `useMarkdownUpload`, added an `Upload .md` button next to `+ New Round`, mounted the hidden file input, error/status notices, and an `ImportPreviewModal` at the end of the panel return. Panel-level (not per-prompt) upload — every uploaded file passes through the same preview gate.
- `src/components/ResponsesPanel.tsx` — instantiated `useMarkdownUpload`, added a panel-level `Upload .md` button (with explanatory caption noting that structured response routing arrives in a future checkpoint), hidden input, notices, and modal mount. Button is hidden when the active round is locked. Per-slot routing is intentionally NOT wired — it requires `commitStructured`, which is Checkpoint E.
- `src/components/MediatorPanel.tsx` — instantiated `useMarkdownUpload`, added an `Upload .md` button beside the existing Copy / Download .md buttons in the packet section, hidden input, notices, and modal mount. The hook detects whether the uploaded file is a mediator packet, mediator synthesis, or something else (frontmatter-driven); for Checkpoint D, all routes terminate at Raw Notes.

### Files NOT modified

- All foundation utilities, types, configs, storage adapters — untouched. `buildImportPreview` and `commitAsRawNote` are the existing exports; the hook is a consumer.
- `App.tsx` — untouched. Each panel mounts its own modal instance via the hook; no app-level coordination is required.
- `CSS` — no new styles. The new buttons reuse existing `.btn`, `.btn-secondary`, `.notice danger`, `.notice info` classes. The modal already had its own dedicated styles from Checkpoint B.
- `package.json` / `package-lock.json` — no new dependencies.
- `RawNotesPanel`, `ImportHistoryPanel` — untouched. The user can already see the new raw notes that imports produce.

## Which panels now have Upload `.md` controls

Three:

- **RoundBuilderPanel** — Upload `.md` button in the panel header (next to `+ New Round`). Accepts any handoff artifact; routes everything through preview. Body-only files and malformed YAML open the modal with appropriate warnings.
- **ResponsesPanel** — panel-level Upload `.md` button below the active round banner. Hidden when the round is locked. An adjacent caption explains that structured per-slot routing arrives later.
- **MediatorPanel** — Upload `.md` button beside the Copy → GPT-5.5 / Download `.md` row. Accepts mediator packets, syntheses, or anything else; all paths preserve as Raw Notes for now.

DecisionLogPanel does NOT have an Upload `.md` button — same reason as Checkpoint C's no-Download decision: there is no v0.11.0 source kind that maps to a "decision" artifact.

## How ImportPreviewModal is wired

Each panel:
1. Calls `useMarkdownUpload(state, onUpdate, { panelLabel })` once, near the top of the component body. The label is folded into error messages so the user knows which panel triggered the modal.
2. Renders an `Upload .md` button whose `onClick={mdUpload.triggerUpload}` programmatically clicks the hidden file input.
3. Renders a hidden `<input type="file" ref={mdUpload.fileInputRef} accept={mdUpload.acceptString} onChange={mdUpload.onFileInputChange} />`.
4. Renders inline `notice danger` / `notice info` blocks bound to `mdUpload.error` and `mdUpload.status` so transient upload feedback is visible.
5. Mounts `<ImportPreviewModal {...mdUpload.modalProps} />` once at the end of the panel return.

The hook ensures every modal mount receives the same `structuredImportDeferredReason` string, so the disabled-Import behavior is uniform across panels.

## How Import as Raw Notes works

When the user clicks "Import as Raw Notes" in the modal:

1. The hook's `onImportAsRaw` callback projects storage pressure: `projectPostWritePressure(state, byteLength(preview.rawText) + 4096)`. The 4 KB cushion covers the `ImportTransaction` overhead.
2. If projected level is `hard`, a `window.confirm` dialog shows the projected and threshold sizes plus a recommendation to export/prune first. The user can cancel or proceed.
3. If they proceed (or pressure is `ok` / `warn`), the hook calls `commitAsRawNote(preview)` from `utils/importHistory.ts`. This returns a `CommitResult` with:
   - `updater: AppStateUpdater` — appends the new `RawNote` to `state.rawNotes` (bounded by `RAW_NOTES_DEFAULT_CAP = 200`) AND appends an `ImportTransaction` to `state.importHistory` (bounded by `IMPORT_HISTORY_DEFAULT_CAP = 50`).
   - `transaction: ImportTransaction` — recorded with `snapshotBefore.rawNoteId` so the existing rollback flow can delete the note if the user chooses to undo.
4. The hook dispatches the updater through `onUpdate`. The modal closes. A confirmation status appears under the Upload button.
5. The user can review the note in the Raw Notes tab and the transaction in the Import History tab.

The `RawNote` is constructed by `rawNoteFromPreview(preview)` (existing helper from Checkpoint A foundation). It preserves:
- `rawBody` — the original file contents, verbatim, never normalized.
- `parsedFrontmatter` — best-effort YAML parse result (may be partial or empty).
- `validationWarnings` — every warning emitted by the preview pipeline.
- `sourceKind`, `projectId`, `roundId`, `originModel`, `artifactType` — whatever the frontmatter declared.
- `importStatus` — one of `malformed | unmatched | duplicate | partial | unparseable | manual_save`, computed from the preview warnings.

No data is silently discarded. Even a body-only file with no frontmatter lands intact in `rawBody` for manual recovery later.

## How body-only and malformed files are handled

- **Body-only Markdown files** (no `---` frontmatter): `buildImportPreview` emits a `NO_FRONTMATTER` warning. The preview opens normally with the body in the `<pre>` viewer. `availableOutcomes` includes only `cancel` and `import_as_raw`; structured commit is not offered. Importing as Raw Notes preserves the entire file verbatim under `rawBody`.
- **Malformed YAML frontmatter** (delimiter present but YAML parse fails): `buildImportPreview` emits a `FRONTMATTER_PARSE_FAILED` warning. The preview shows the warning, displays the body, and offers Raw Notes. No crash.
- **Unmatched references** (declared `project_id` / `round_id` not present in the live AppState): preview emits `PROJECT_NOT_FOUND` / `ROUND_NOT_FOUND` warnings. Modal opens; user picks Cancel or Raw Notes.
- **Stale content hash mismatch**: preview emits `CONTENT_HASH_MISMATCH`. Same handling.

In Checkpoint D the only commit path is Raw Notes regardless of the warning severity, so even hard-error cases (newer-major schema, invalid source_kind, etc.) preserve content rather than discarding it.

## Code-fence-aware parsing is preserved

The mediator extractor's fence-aware walker (from Checkpoint A's `mediatorExtract.ts` rewrite) is unchanged. Headings inside `~~~` / ` ``` ` fences are still ignored by the structured-section extractor. The upload path does NOT invoke `extractMediatorSections` in Checkpoint D — that's structured-commit work for Checkpoint E.

## Storage-pressure handling

Three coordinated layers:

1. **Pre-dispatch projection** in the hook (`onImportAsRaw`): if the projected post-write level is `hard`, `window.confirm` warns the user with projected size and threshold. They can cancel.
2. **Save effect in `App.tsx`** (Checkpoint C.5): calls `localStorageAdapter.saveWithReport(state)` on every state change. The pressure level and any `QuotaExceededError` flow into the `StoragePressureBanner` rendered between the tab nav and the active panel.
3. **Commit failure preservation**: if `commitAsRawNote` itself throws (extremely unlikely — the dispatch is a synchronous functional updater build), the hook catches it, surfaces an error notice, AND keeps the modal open so the user can copy out content via the existing copy-body button in the modal. The note is NOT lost from the modal's preview.

Storage saves themselves never fail silently. `saveWithReport` always attempts `setItem`; failures surface as a banner. The banner stays until the next successful save (e.g. after the user prunes Raw Notes / Import History).

## Build state

- `npx tsc --noEmit` → exit 0, no output.
- `npm run build` → exit 0:
  - `dist/index.html` 0.51 kB
  - `dist/assets/index-*.css` 27.38 kB (gzip 5.06 kB) — unchanged from C.5 (no new CSS).
  - `dist/assets/index-*.js` 403.53 kB (gzip 119.07 kB) — up from 353.77 kB (+49.76 kB raw, +16.15 kB gzipped). The increase reflects the import pipeline (`artifactImport`, `importHistory`, `commitAsRawNote`, the YAML parser via `js-yaml`, and the `ImportPreviewModal` render path) entering the call graph for the first time. The modal was code-split-eligible before; mounting it in three panels now pins it into the main chunk.
  - 76 modules transformed (was 74 — `useMarkdownUpload` plus the modal joining the active set).
- Bundle verification: 3 × `Upload .md` labels (one per panel), 5 × `Import as Raw Notes` references (one per modal render path), 1 × `Import (deferred)` for the disabled structured Import button.

## Known limitations

- **Structured commit is deferred.** Even when the preview validates cleanly, Checkpoint D users cannot replace-or-append a prompt / response / packet / synthesis from an uploaded `.md`. The "Import (deferred)" button surfaces the affordance with a tooltip explanation but the action is disabled.
- **Per-slot routing in ResponsesPanel is not yet wired.** All uploads go through the panel-level button and land in Raw Notes. Slot routing requires `commitStructured`, which is Checkpoint E.
- **The modal's preview shows the parsed body in a plain `<pre>` (no Markdown rendering).** Per Q11 of the locked decisions in the feasibility doc.
- **No drag-and-drop.** File picker only. Listed as a v0.11.x follow-up.
- **The hook's `loading` flag is binary** (true during file read + preview build). There is no progress indicator — file reads for Markdown artifacts are sub-millisecond in practice. If users start uploading multi-megabyte files this might warrant a spinner; for now the button label flips to `…Loading`.
- **No upload from Recovery / ExportImportPanel / RawNotesPanel** — only the three workflow panels. The Recovery panel already has its own JSON-import affordance; the Raw Notes panel is the destination, not a source.
- **`window.confirm` for hard-pressure gate.** Functional, but visually inconsistent with the rest of the app. A custom in-style dialog could replace it in a follow-up — out of Checkpoint D scope.
- **`window.prompt` for rollback reason (Checkpoint B carryover).** Same.

## Deferred (Checkpoint E candidates)

- **Structured import commit.** Replace the modal's `Import (deferred)` placeholder with a real wiring through `commitStructured(preview, state)` from `utils/importHistory.ts`. The function already exists and dispatches per-source-kind:
  - `generated_prompt` → replace-or-append the prompt slot on the round.
  - `model_response` → replace-or-append the response slot on the round.
  - `mediator_packet` → set `round.mediatorPrompt`.
  - `mediator_synthesis` → run `extractMediatorSections`, set `round.mediatorSynthesis`.
  Each commits a snapshotBefore for rollback.
- **Per-slot upload in ResponsesPanel** — once structured commit lands, expose Upload `.md` per model row so the resolved target is unambiguous.
- **The v0.10.3 prefix-heuristic stale-packet check** in MediatorPanel — replace with hash-based comparison (Q14 #15: coexist for one release, remove in v0.11.1).
- **`docs/MARKDOWN_HANDOFF.md`** + updates to `PHASE_HISTORY`, `SCHEMA_EVOLUTION`, `DATA_MODEL`, `RELEASE_CHECKLIST`.
- **15-item acceptance walk** (feasibility doc sec. 12).
- **`RawNotesPanel` delete button** — `removeRawNote` helper exists; wire a button.

## How to resume

1. `npm install` — lockfile pins `js-yaml`, `@types/js-yaml`. No new deps in D.
2. `npx tsc --noEmit` → expect clean.
3. `npm run build` → expect clean.
4. Manual exercise:
   - **Body-only**: paste any prose into a `.md` file, upload via RoundBuilder → confirm modal opens with `NO_FRONTMATTER` warning, `Import as Raw Notes` works, note appears in Raw Notes tab.
   - **Malformed YAML**: build a file with `---\nbroken: : : ---\nbody\n`, upload → confirm `FRONTMATTER_PARSE_FAILED` warning surfaces, no crash, Raw Notes commit works.
   - **Valid handoff**: Download a generated prompt's `.md` via Round Builder, then re-upload it → confirm modal shows correct source kind, target round/project/model, low warning count, `Import (deferred)` shown disabled, `Import as Raw Notes` works.
   - **Storage pressure**: upload increasingly large files until the projected post-write byte count would breach `STORAGE_HARD_BYTES` (~4.25 MB) → confirm `window.confirm` dialog appears before dispatch.
5. Begin Checkpoint E: wire `commitStructured` through the modal's primary Import button. The hook's `onImport` callback (currently a no-op error nudge) is the call site.
