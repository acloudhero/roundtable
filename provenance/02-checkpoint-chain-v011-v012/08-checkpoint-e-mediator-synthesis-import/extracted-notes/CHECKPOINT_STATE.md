# RoundTable v0.11.0 Markdown Handoff Mode — Checkpoint E State

**Status:** Structured import commit wired end-to-end for `source_kind: mediator_synthesis` only. All other source kinds keep their disabled-Import deferred affordance. Build clean. Rollback verified via end-to-end smoke test.

This document describes the exact state of the codebase at the moment this zip was produced. Read it before resuming.

## What changed in Checkpoint E

One round of narrow type / utility / hook changes; no new files. The structured-commit foundation (`commitStructured` and per-source-kind dispatchers including `commitMediatorSynthesis`) already existed from Checkpoint A — Checkpoint E *wires the UI to the synthesis branch* and adds the preview-time warning surface for missing/duplicate/unmatched headings.

### Files created

None. (`commitStructured`, `commitMediatorSynthesis`, `rollbackTransaction`, `canRollback` all pre-existed.)

### Files modified

- **`src/types/markdownArtifact.ts`** — added 3 new `ImportWarningCode` values:
  - `REQUIRED_SECTION_MISSING` (severity: warning)
  - `DUPLICATE_HEADING` (severity: warning)
  - `UNMATCHED_HEADING` (severity: info)
- **`src/utils/mediatorExtract.ts`** — exported `SynthesisKey` so `artifactImport.ts` can type its synthesis-structure helper. Extended `extractMediatorSections` to ALSO return `presentKeys`, `duplicateKeys`, `unmatchedHeadings`. Backward-compatible: existing call sites destructure only `{ synthesis, extractedCount, unclosedFence }` and TypeScript tolerates the extra fields.
- **`src/utils/artifactImport.ts`** — added `analyzeSynthesisStructure(body, warnings)` helper. Called from `buildImportPreview` when `source_kind === 'mediator_synthesis'`. Emits:
  - one batched `REQUIRED_SECTION_MISSING` warning listing every absent required heading by human-readable label;
  - one `DUPLICATE_HEADING` warning per duplicated key (the extractor concatenates duplicates rather than dropping them);
  - up to 6 `UNMATCHED_HEADING` info notices for heading-shaped lines not in `HEADING_MAP`, plus an overflow "…plus N more" entry;
  - one `UNCLOSED_CODE_FENCE` warning when the fence-aware walker reached EOF inside a fence.
  None of these block commit — they're advisory. The raw body is always preserved on `round.mediatorResponse`, so even unmatched content survives the import.
- **`src/hooks/useMarkdownUpload.ts`** — two changes:
  1. **`onImport` no longer a defensive no-op.** Now performs a defensive eligibility re-check (source_kind === 'mediator_synthesis', round_id present, target round resolves), then projects post-write storage pressure (Round snapshot + body bytes + 4 KB overhead). At the `hard` level it surfaces a `window.confirm` so the user has explicit agency. On confirm, calls `commitStructured(preview, state)` and dispatches the returned updater through `onUpdate`. On failure, surfaces an error but keeps the modal open so the user can fall back to Raw Notes.
  2. **`structuredImportDeferredReason` is now conditional.** Computed via `useMemo` from the active preview:
     - `undefined` (button enabled) when `source_kind === 'mediator_synthesis'` AND no hard errors AND `round_id` resolves.
     - Set with a specific explanatory message for synthesis-but-blocked cases (errors present, no round_id, round_id doesn't resolve).
     - Set with the generic "structured import for this source kind arrives in a later checkpoint" message for all other source kinds.

### Files NOT modified

- `src/components/ImportPreviewModal.tsx` — its existing logic correctly enables/disables the structured Import button based on `structuredImportDeferredReason`. No changes needed.
- `src/utils/importHistory.ts` — `commitStructured`, `commitMediatorSynthesis`, `rollbackTransaction`, `canRollback` all pre-existed and were the design intent for this checkpoint. They are invoked unchanged.
- All other panels and components — untouched.
- `package.json` / `package-lock.json` — no new deps.
- CSS — no new styles. Modal already shipped with everything needed.

## How mediator_synthesis structured import works

End-to-end flow when a user uploads a `mediator_synthesis.md` file through the Mediator panel:

1. **File read.** `useMarkdownUpload.onFileInputChange` reads the file via `File.text()`.
2. **Preview build.** `buildImportPreview(text, state)`:
   - Strips BOM, splits frontmatter, parses YAML via `js-yaml`.
   - Validates `artifact_type === 'roundtable.markdown.v1'`, `source_kind` is valid, `schema_version` is supported.
   - Resolves `project_id` and `round_id` against live state.
   - Recomputes `content_hash` from the normalized body, compares to frontmatter.
   - Calls `analyzeSynthesisStructure(normalized, warnings)` — emits the missing/duplicate/unmatched warnings.
   - Computes `availableOutcomes` (= `['commit', 'import_as_raw', 'cancel']` when no errors and source_kind isn't `raw_notes`).
3. **Modal renders.** `ImportPreviewModal` reads `structuredImportDeferredReason`. For commit-eligible synthesis previews, the reason is `undefined` and the primary Import button is enabled with a dynamic label (`Import` / `Import anyway` / `⚠ Confirm Import` via the existing two-step warning gate).
4. **User clicks Import.** The hook's `onImport`:
   - Defensive re-check (source_kind, round_id, round resolution).
   - Storage pressure projection — for synthesis the projection includes the round-snapshot bytes too (rollback carries the full round). `hard` level triggers a `window.confirm`.
   - Calls `commitStructured(preview, state)`.
5. **`commitStructured` dispatches to `commitMediatorSynthesis`**, which:
   - Runs `extractMediatorSections(preview.body)` (fence-aware walker — headings inside `~~~`/```` ``` ```` are ignored).
   - Builds the updated round: `mediatorSynthesis` populated from extracted fields, `mediatorResponse` set to the full body verbatim, `updatedAt: nowIso()`.
   - Constructs an `ImportTransaction` with `snapshotBefore: { round }` (the full pre-import round slice) and two `ImportChange` entries (`round_synthesis_set`, `round_field_set`).
   - Returns a `CommitResult { updater, transaction }`.
6. **`onUpdate(result.updater)`** dispatches: target round in `state.rounds` is replaced; the transaction is appended to `state.importHistory` (capped at `IMPORT_HISTORY_DEFAULT_CAP = 50`).
7. **Modal closes.** Status notice under the Upload button confirms the import with the new transaction id's last 12 chars so the user can locate it in Import History.

Smoke-tested end-to-end via esbuild + node 22 — verified that a freshly-exported synthesis re-imports cleanly:
- `presentKeys` enumerates the 9 populated fields (test synthesis intentionally had 3 empty fields).
- `availableOutcomes` includes `'commit'`.
- Post-commit: `round.mediatorSynthesis.executiveSummary` populated, `round.mediatorSynthesis.recommendedDecision` populated, `round.mediatorResponse` populated, history length = 1.
- `canRollback(state, txId)` returns `true`.
- Post-rollback: `round.mediatorSynthesis` cleared, `round.mediatorResponse` cleared, transaction marked `rolledBackAt`.

## How warnings / missing headings are handled

- **Missing required headings** → one batched `REQUIRED_SECTION_MISSING` warning listing every absent label. Does NOT block commit; the resulting synthesis fields are simply empty (matching `emptyMediatorSynthesis()`). The user sees exactly which headings to add upstream.
- **Duplicate headings** → one `DUPLICATE_HEADING` warning per duplicated key. The extractor CONCATENATES content from all occurrences (separated by blank lines) rather than overwriting or dropping — no data loss.
- **Unmatched headings** → up to 6 `UNMATCHED_HEADING` info notices (capped to avoid flooding). Body following an unmatched heading is NOT structurally mapped, but the full raw body is preserved on `round.mediatorResponse` so the user can recover any content the extractor couldn't categorize. An overflow notice tells the user how many additional unmatched headings exist.
- **Unclosed code fence** → `UNCLOSED_CODE_FENCE` warning. Section detection may have terminated early; the user is advised to verify the imported fields against the raw body.
- **Code fences containing heading-shaped lines** → not warned about, by design. The fence-aware walker treats them as body, exactly as required by the Checkpoint E brief.

## How rollback is supported

- The `ImportTransaction` produced by `commitMediatorSynthesis` carries `snapshotBefore.round` — the entire pre-import round slice (deep-cloned through the standard `makeTransaction` helper).
- `rollbackTransaction(transactionId, reason)` in `utils/importHistory.ts` returns an `AppStateUpdater` that:
  - Locates the transaction by id.
  - Confirms it's the most-recent un-rolled-back transaction (most-recent-only rollback per the locked v0.11.0 Q14 decision).
  - Restores `snapshotBefore.round` into `state.rounds` at the correct index.
  - Marks the transaction `rolledBackAt: nowIso()` and stores the `rollbackReason`.
- The existing `ImportHistoryPanel` (Checkpoint B) already renders a Rollback button gated by `canRollback(state, txId)`. The button shows a `window.prompt` for the rollback reason. No changes needed to that panel.

Verified via the end-to-end smoke test: `mediatorSynthesis` and `mediatorResponse` are both cleared on rollback, and the transaction's `rolledBackAt` is set.

## Conflict handling

- **Invalid `artifact_type` / `source_kind` / unsupported `schema_version`** → emits `'error'`-severity warnings. `commitAvailable` becomes false. Modal renders only Cancel + Import as Raw Notes; the structured Import button is hidden (`canCommit = false`).
- **`PROJECT_NOT_FOUND` / `ROUND_NOT_FOUND`** → warning-severity (not error). The hook layers an ADDITIONAL gate that surfaces these as the `structuredImportDeferredReason` for synthesis previews, so the Import button is disabled with a specific explanation even though the underlying `availableOutcomes` would have allowed commit. Cancel and Import as Raw Notes remain available.
- **Non-synthesis source kinds** (generated_prompt, model_response, mediator_packet) — modal Import button stays disabled with the generic "structured import for this source kind arrives in a later checkpoint" message. Import as Raw Notes works for every source kind.

## Build state

- `npx tsc --noEmit` → exit 0, no output.
- `npm run build` → exit 0:
  - `dist/index.html` 0.51 kB
  - `dist/assets/index-*.css` 27.38 kB (gzip 5.06 kB) — unchanged from D.
  - `dist/assets/index-*.js` 412.09 kB (gzip 120.87 kB) — up from 403.53 kB in D (+8.56 kB raw, +1.80 kB gzipped) for the synthesis analysis helper, the conditional deferred-reason logic, and the commitStructured call site reaching the hot path.
  - 76 modules transformed (unchanged — no new files, only edits).
- Bundle verification: `REQUIRED_SECTION_MISSING`, `DUPLICATE_HEADING`, `UNMATCHED_HEADING` warning codes all present.
- End-to-end smoke test (esbuild + node 22): every step passes (artifact build → preview → commit → state inspection → rollback → state inspection).

## Known limitations

- **`CONTENT_HASH_MISMATCH` false positive on clean round-trips.** Confirmed via the e2e smoke test: a freshly-exported synthesis re-imported reports `CONTENT_HASH_MISMATCH`. Root cause: `buildArtifact` writes the artifact as `---\n<yaml>---\n\n<body>` and hashes `<body>` without the leading separator newline; `splitFrontmatter` returns the body including the leading blank line that follows the closing `---`. The two normalized hashes therefore differ by exactly one leading `\n`. This is a foundation discrepancy worth fixing in a follow-up but does NOT block Checkpoint E:
  - It's a warning, not an error — commit proceeds.
  - The downstream synthesis import works correctly (verified end-to-end).
  - Fixing it requires editing either `splitFrontmatter` (strip leading blank line) or `buildArtifact` (include leading newline in body before hashing). Out of Checkpoint E scope per the "do not refactor unrelated code" rule.
- **H1 in the synthesis artifact body triggers `UNMATCHED_HEADING`.** The `buildMediatorSynthesisBody` writer emits `# Mediator Synthesis — Round N` as an H1 at the top. The fence-aware walker correctly sees this as heading-shaped, looks it up in `HEADING_MAP` (which only contains the 12 `###` section labels), finds nothing, and emits one `UNMATCHED_HEADING` info notice. The body under the H1 (the italic provenance line) is preserved on `mediatorResponse`. This is technically correct behavior but produces a chatty warning. A follow-up could add a heading-level filter (only ### headings are eligible to match `HEADING_MAP`).
- **Structured commit only wired for `mediator_synthesis`.** Generated_prompt, model_response, mediator_packet, raw_notes commits remain deferred to Checkpoints F+.
- **Most-recent-only rollback.** Cascading rollback (rolling back transaction N when transactions N+1..M came after) deferred to v0.11.1 per the locked Q14 decision.
- **No in-panel summary of what got imported.** The status notice under the Upload button says "Imported mediator synthesis into Round N. Transaction id: …". A summary of WHICH fields got populated and which remain empty is not shown — but the Mediator panel itself will reflect the new fields the next render.
- **`window.confirm` for storage-pressure gate.** Functional but visually inconsistent. Inherited from Checkpoint D.
- **No CSS additions.** The disabled-Import button already had appropriate styling from Checkpoint D.

## Deferred items for Checkpoint F

- **Structured commit for `generated_prompt`.** Body extraction already in `commitGeneratedPrompt` (existing); needs:
  - Hook `onImport` to allow generated_prompt source_kind.
  - Conditional `structuredImportDeferredReason` to allow generated_prompt previews.
- **Structured commit for `model_response`.** Same shape as generated_prompt; uses `commitModelResponse`.
- **Structured commit for `mediator_packet`.** Sets `round.mediatorPrompt`; uses `commitMediatorPacket`.
- **Per-slot Upload `.md`** in ResponsesPanel once structured commit lands for model_response.
- **Fix `CONTENT_HASH_MISMATCH` false positive** — small splitFrontmatter or buildArtifact tweak.
- **Filter `HEADING_MAP` lookup to `###` headings only** to suppress the H1 `UNMATCHED_HEADING` noise.
- **Replace `window.confirm` storage gate** with an in-style modal.
- **`docs/MARKDOWN_HANDOFF.md`** + updates to `PHASE_HISTORY`, `SCHEMA_EVOLUTION`, `DATA_MODEL`, `RELEASE_CHECKLIST`.
- **15-item acceptance criteria walk** (feasibility doc sec. 12).

## How to resume

1. `npm install` — lockfile pins `js-yaml`, `@types/js-yaml`. No new deps in E.
2. `npx tsc --noEmit` → expect clean.
3. `npm run build` → expect clean.
4. Manual exercise:
   - Generate a round, populate synthesis via the existing Mediator panel, click `Download Synthesis .md`.
   - Click `Upload .md` (Mediator panel), pick the just-downloaded file.
   - Confirm preview shows `source_kind: mediator_synthesis`, `availableOutcomes` includes `commit`, `Import` button is ENABLED.
   - (Expect `CONTENT_HASH_MISMATCH` warning — see Known Limitations.)
   - Click Import → modal closes → status notice confirms import → check the Mediator panel's synthesis fields are populated and `mediatorResponse` is set.
   - Check Import History tab → new transaction visible with "most recent" badge and active Rollback button.
   - Click Rollback → provide a reason → confirm synthesis cleared, `rolledBackAt` populated, badge changes to "rolled back".
5. Try edge cases:
   - Upload a `.md` with no frontmatter → preview opens, Import disabled with deferred reason, Import as Raw Notes works.
   - Upload a synthesis where `round_id` doesn't match any local round → preview opens, Import disabled with synthesis-specific deferred reason citing the missing round.
   - Upload a synthesis with a `### Risks` heading inside a code fence → confirm the fence content stays in the previous section (Executive Summary or whichever) and does not open a new section.
6. Begin Checkpoint F: extend the hook + deferred-reason logic to the other three source kinds.
