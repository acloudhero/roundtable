# RoundTable v0.11.0 Markdown Handoff Mode — Checkpoint G State

**Status:** Structured import commit wired end-to-end for `source_kind: model_response`, with per-slot Upload `.md` in ResponsesPanel. Both `mediator_synthesis` (Checkpoint E) and `model_response` (this checkpoint) are now commit-eligible. All other source kinds remain deferred. Build clean. 22/22 end-to-end assertions pass.

This document describes the exact state of the codebase at the moment this zip was produced. Read it before resuming.

## What changed in Checkpoint G

The structured-commit foundation (`commitModelResponse`) already existed from Checkpoint A. Checkpoint G:

1. Adds **per-slot Upload `.md`** affordance to ResponsesPanel (one per model row).
2. Wires the UI to the `model_response` branch with full target-resolution gates (project, round, model slot, lock, mismatch).
3. Adds four new warning codes covering the new safety gates.
4. Threads `state` through `commitStructured` → `commitModelResponse` so new slots can resolve `modelDisplayName` from the live roster.
5. Preserves existing reviewed/excluded status on overwrite (previously was force-set to `pasted`).

### Files created

None.

### Files modified (4)

- **`src/types/markdownArtifact.ts`** — added 4 new `ImportWarningCode` values (`EXISTING_RESPONSE_WILL_BE_OVERWRITTEN`, `MODEL_ID_MISMATCH_WITH_SLOT`, `MODEL_ID_NOT_IN_ROSTER`, `LOCKED_ROUND`) and a new `ImportPreviewContext` interface ({ expectedSourceKind?, expectedModelId? }).
- **`src/utils/artifactImport.ts`** — added third optional `context: ImportPreviewContext` parameter to `buildImportPreview`; added `analyzeModelResponseTarget(fm, state, warnings, context)` helper called from `buildImportPreview` when `source_kind === 'model_response'`; added an in-line source-kind expectation hard-mismatch check that emits `SOURCE_KIND_INVALID` (severity error) when context.expectedSourceKind differs from frontmatter.
- **`src/utils/importHistory.ts`** — threaded `state` through `commitStructured` to `commitModelResponse` to `upsertModelResponse`. `commitModelResponse` now produces a change description that records whether an existing body was overwritten and the preserved status. `upsertModelResponse` (the internal one) preserves the existing slot's status on overwrite (instead of forcing 'pasted'); new slots resolve `modelDisplayName` from `state.modelProfiles` instead of empty string.
- **`src/hooks/useMarkdownUpload.ts`** — options now accept `expectedSourceKind` and `expectedModelId`; forwards both to `buildImportPreview`; the deferred-reason gate recognizes `model_response` as commit-eligible (no errors + round_id resolves + round not locked + model_id resolves to slot/selected + per-slot mismatch absent); `onImport` re-checks all four gates defensively and routes commitStructured.
- **`src/components/ResponsesPanel.tsx`** — extracted the per-slot card from the inline `.map()` callback into a new `<ResponseSlotCard>` sub-component (added at the bottom of the file) so each slot can host its own `useMarkdownUpload` hook bound to `expectedSourceKind: 'model_response'` and `expectedModelId: model.id`. Each row renders an Upload `.md` button and mounts its own ImportPreviewModal.

### Files NOT modified

- `ImportPreviewModal.tsx` — unchanged. Its existing gating on `structuredImportDeferredReason` is the right contract for both source kinds.
- `commitGeneratedPrompt`, `commitMediatorPacket`, `commitMediatorSynthesis` — untouched.
- Foundation utilities (`markdownNormalize`, `markdownHash`, `markdownParse`, `mediatorExtract`, etc.) — untouched.
- `App.tsx`, `RoundBuilderPanel.tsx`, `MediatorPanel.tsx`, all other panels — untouched.
- `package.json` / lockfile / CSS — unchanged.

## How `model_response` structured import works

End-to-end flow when a user uploads a `model_response.md` either through the panel-level Upload `.md` button (top of ResponsesPanel) or a per-slot Upload `.md` button (each model row):

1. **File read.** `useMarkdownUpload.onFileInputChange` reads via `File.text()`.
2. **Preview build.** `buildImportPreview(text, state, { expectedSourceKind?, expectedModelId? })`:
   - Standard frontmatter parse + validation + hash recompute.
   - For `source_kind === 'model_response'`, calls `analyzeModelResponseTarget(fm, state, warnings, context)` which emits (in order):
     - `MODEL_ID_MISMATCH_WITH_SLOT` if `context.expectedModelId` differs from `fm.model_id`.
     - `LOCKED_ROUND` if the resolved round is locked.
     - `MODEL_ID_NOT_IN_ROSTER` if `fm.model_id` has no existing slot AND is not in the round's `selectedModelIds`.
     - `EXISTING_RESPONSE_WILL_BE_OVERWRITTEN` if the target slot already has a non-empty `responseText`.
   - If `context.expectedSourceKind` is set and differs from `fm.source_kind`, emits `SOURCE_KIND_INVALID` (severity error) which removes `commit` from `availableOutcomes`.
3. **Modal renders.** The hook's `deferredReason` memo evaluates source-kind-specific gates; for valid commit-eligible model_response previews it returns `undefined`, enabling the primary Import button.
4. **User clicks Import.** The hook's `onImport`:
   - Re-checks source_kind, round_id, round resolution, round.locked, model_id presence, slot/selectedModelIds resolution, expectedModelId match.
   - Projects post-write storage pressure (body bytes + round snapshot bytes + 4 KB overhead). At `hard` level surfaces a `window.confirm`.
   - Calls `commitStructured(preview, state)` → dispatches to `commitModelResponse(preview, fm, targetRound, state)`.
5. **`commitModelResponse`**:
   - Extracts the response text from the `## Response Text` fenced section (or whole body fallback).
   - Computes a change description that records whether overwriting (with body length + preserved status) or appending a new slot.
   - Builds the updated round via `upsertModelResponse(round, fm, text, state)` which: for existing slots, replaces body + refreshes `pastedAt` + PRESERVES the existing `status` field (so a `reviewed` or `excluded` judgment survives an import); for new slots, resolves `modelDisplayName` from `state.modelProfiles` (fallback to `fm.model_id`) and defaults `status` to `'pasted'`.
   - Constructs an `ImportTransaction` with `snapshotBefore: { round }` (the full pre-import round slice) and a `round_response_set` change entry.
6. **`onUpdate(result.updater)`** dispatches: round in `state.rounds` is replaced; transaction appended to `state.importHistory` (capped at 50).
7. **Modal closes.** Status notice confirms the import with the transaction id's last 12 chars + the model display name + the round number.

## How per-slot upload works

`ResponseSlotCard` is a new sub-component extracted from the inline `selectedModels.map()` callback in `ResponsesPanel`. Each row instantiates one independent `useMarkdownUpload(state, onUpdate, { expectedSourceKind: 'model_response', expectedModelId: model.id, panelLabel: 'into <Model> response slot' })`. Each row renders its own:
- Upload `.md` button (next to existing status / Download buttons).
- Hidden `<input type="file">` with its own ref.
- `<ImportPreviewModal>` mount (only one can be `open` at any time because the user can only trigger one picker per click).

The pre-bound `expectedModelId` flows into `buildImportPreview` via the context arg, where it drives:
- `MODEL_ID_MISMATCH_WITH_SLOT` warning emission if the file targets a different model.
- The deferred-reason gate that disables structured Import when there's a mismatch.

The pre-bound `expectedSourceKind: 'model_response'` ensures uploading a synthesis or any other artifact to a response slot fires `SOURCE_KIND_INVALID` (hard error), blocking structured commit but leaving Raw Notes available.

The panel-level Upload `.md` button (from Checkpoint D) remains in place at the top of ResponsesPanel. It still doesn't pass `expectedModelId`, so it routes by frontmatter without per-slot constraints — useful when the user wants to upload a file and let its declared model_id pick the slot.

## How target model slot resolution works

The four-level resolution sequence for `model_response`:

1. **`fm.model_id` present** — required. If missing, deferred-reason gate fires.
2. **Existing slot match** — `round.modelResponses.find((r) => r.modelProfileId === fm.model_id)`. If a slot exists, overwrite path applies. The existing slot's `status` (reviewed/excluded/pasted) is preserved; only `responseText` and `pastedAt` are refreshed.
3. **Selected for round** — if no existing slot, but `fm.model_id` is in `round.selectedModelIds`, append-new-slot is allowed. The new slot's `modelDisplayName` is resolved from `state.modelProfiles` (fallback to the raw id); `status` defaults to `'pasted'`.
4. **Otherwise** — neither slot nor selection → `MODEL_ID_NOT_IN_ROSTER` warning + deferred-reason gate blocks structured commit. Raw Notes remains available.

The selection check intentionally allows the orphan-but-selected case (user added the model to the round but never pasted a response, then receives a `.md` from that model later). It rejects the truly-orphan case (model_id from a different round / project / a model that was removed).

## How overwrite warnings are handled

When `analyzeModelResponseTarget` finds the target slot already has a non-empty `responseText`, it emits:

```
EXISTING_RESPONSE_WILL_BE_OVERWRITTEN (severity: warning)
"Round N already has a response from <displayName> (X chars, status: <status>).
 Importing will REPLACE the response body. The existing status (<status>) is
 preserved. Rollback restores both body and status if needed."
```

Severity is `'warning'`, not `'error'` — `commitAvailable` stays true, so the modal renders the Import button. Because there's a warning, the modal's existing two-step "Import anyway" gate forces deliberate confirmation: the button label flips to `⚠ Confirm Import` on first click; the actual commit only fires on second click.

Rollback restores both the body AND the status (the entire round slice is snapshotted as `snapshotBefore.round`).

## How locked-round protection works

When `analyzeModelResponseTarget` resolves the target round and finds `round.locked === true`, it emits:

```
LOCKED_ROUND (severity: warning)
"Round N is locked. Structured import is blocked to prevent mutation of
 completed work. Start a new round to add responses, or save this file as
 a Raw Note for later review."
```

The hook's deferred-reason gate elevates this to "structured commit disabled" — even though `commitAvailable` would otherwise be true. The modal's Import button is rendered disabled with the deferred reason as its tooltip. Import as Raw Notes remains available so no content is lost.

The `onImport` handler in the hook ALSO re-checks `round.locked` defensively. If a stale closure or future regression somehow bypasses the deferred-reason gate, the commit is still blocked with a clear error.

## How prompt_hash / model_id mismatch warnings are handled

- **`PROMPT_HASH_MISMATCH`** — already emitted by `checkPromptStaleness` (Checkpoint A foundation) when an async post-preview check runs. Surfaces in the modal's warnings list with severity `'warning'`. Does NOT block commit by itself; the two-step "Import anyway" gate forces deliberate confirmation. The user can also choose Raw Notes if they don't want to import against a stale prompt.

- **`MODEL_ID_MISMATCH_WITH_SLOT`** — emitted only when `useMarkdownUpload` was instantiated with `expectedModelId` (i.e. per-slot affordance), AND `fm.model_id` differs. Severity `'warning'` so it appears in the warnings list. The deferred-reason gate promotes it to a hard block: the Import button is disabled with explanation. Raw Notes still works. This prevents "I clicked Upload on the GPT slot but the file says Claude" from ever silently misrouting.

- **`MODEL_ID_NOT_IN_ROSTER`** — emitted when no slot exists AND not in selectedModelIds. Severity `'warning'` + deferred-reason hard block. Same Raw Notes fallback.

## How rollback is supported

Same machinery as `mediator_synthesis`:

- `commitModelResponse` builds an `ImportTransaction` with `snapshotBefore: { round }` capturing the FULL pre-import round slice (deep-cloned via the standard `makeTransaction` helper).
- `rollbackTransaction(transactionId, reason)` returns an `AppStateUpdater` that restores the snapshotted round into `state.rounds` at the correct index and marks the transaction `rolledBackAt`.
- Most-recent-only semantics (per the locked v0.11.0 design decision) enforced by `canRollback(state, transactionId)`.
- The existing `ImportHistoryPanel` (Checkpoint B) renders a Rollback button gated by `canRollback`. No changes needed.

Verified via the e2e test: an overwrite that mutated body + preserved status of an existing slot, after rollback, has BOTH the original body restored AND the original status restored.

## Build state

- `npx tsc --noEmit` → exit 0, no output.
- `npm run build` → exit 0:
  - `dist/index.html` 0.51 kB
  - `dist/assets/index-*.css` 27.38 kB (gzip 5.06 kB) — unchanged from F.
  - `dist/assets/index-*.js` 418.72 kB (gzip 122.38 kB) — up from 412.12 kB in F (+6.60 kB raw, +1.50 kB gzipped) for the analyzer, four new warning codes, the per-slot sub-component, and the expanded onImport handler.
  - 76 modules transformed (unchanged — no new files, only edits).
- End-to-end smoke test (`/tmp/g-verify.mjs`, bundled via esbuild + node 22): **22/22 assertions pass.**

## Known limitations

- **`POTENTIALLY_TRUNCATED` warning fires on every clean round-trip.** Discovered during smoke testing — this warning is emitted by `detectTruncationAndUnclosedFence` whenever the body doesn't end with one of the configured `TRUNCATION_TERMINATORS`. The synthesis exporter happens to end with content that doesn't match; the response exporter likely has the same characteristic. NOT a Checkpoint G regression — this has been present since Checkpoint A and was masked in earlier checkpoints by other false-positive warnings. Listed as a Checkpoint H candidate (the fix is likely a one-line adjustment to the terminator list or the writer's trailing line).
- **No batch/multi-file upload.** One file per click; the brief did not request batch.
- **`window.confirm` for the hard-pressure gate and overwrite two-step.** Functional but visually inconsistent. Inherited from Checkpoints D–F.
- **Status notice under per-slot Upload button does not auto-clear.** The notice persists until the next upload or page reload. Acceptable for v0.11.0; a self-dismissing toast would be nicer.
- **Per-slot Upload also shows when no response exists.** Per the brief: "If the target slot is empty, structured import may proceed if all required resolution checks pass." This is the desired behavior — the per-slot Upload is for importing INTO an empty slot too — but the existing status-row UI was gated on `hasResponse`. New CSS arrangement keeps the per-slot Upload always visible while unlocked.
- **No "diff" or "before/after preview" before overwrite.** The modal shows the imported body; the panel still shows the existing body in the textarea. The user can compare visually but there's no inline diff. Diff viewer is explicitly deferred to a future checkpoint.

## Deferred items for Checkpoint H

- **Structured commit for `generated_prompt`** (foundation exists in `commitGeneratedPrompt`).
- **Structured commit for `mediator_packet`** (foundation exists in `commitMediatorPacket`).
- **Fix `POTENTIALLY_TRUNCATED` false-positive** discovered during Checkpoint G smoke test.
- **Replace `window.confirm` storage gate** and overwrite-warning UX with in-style modal.
- **`docs/MARKDOWN_HANDOFF.md`** + updates to `PHASE_HISTORY`, `SCHEMA_EVOLUTION`, `DATA_MODEL`, `RELEASE_CHECKLIST`.
- **15-item acceptance criteria walk** (feasibility doc sec. 12).

## How to resume

1. `npm install` — no new deps.
2. `npx tsc --noEmit` → expect clean.
3. `npm run build` → expect clean.
4. Manual exercise:
   - Generate a round with 2+ models in Round Builder; paste a response into one slot; mark it `reviewed`.
   - Click `Download .md` on the reviewed response.
   - Click the per-slot `Upload .md` on the SAME row, pick the just-downloaded file.
   - Confirm preview shows `EXISTING_RESPONSE_WILL_BE_OVERWRITTEN` warning, Import button enabled with `⚠ Confirm Import` two-step flow.
   - Click Import twice → confirm body refreshed AND status still `reviewed`.
   - Open Import History tab → confirm new transaction visible with Rollback button.
   - Click Rollback → confirm body AND status both restored.
   - Try Upload `.md` on a DIFFERENT slot's row → confirm `MODEL_ID_MISMATCH_WITH_SLOT` warning fires and Import button is disabled with explanation; Raw Notes still works.
   - Lock the round (or start a new round and rewind to the now-historical one) → try Upload `.md` → confirm `LOCKED_ROUND` warning and Import blocked.
   - Upload the synthesis `.md` from MediatorPanel through a per-slot button → confirm `SOURCE_KIND_INVALID` hard error blocks commit, Raw Notes still works.
5. Begin Checkpoint H: structured commit for generated_prompt + mediator_packet, fix POTENTIALLY_TRUNCATED, docs pass, acceptance criteria walk.
