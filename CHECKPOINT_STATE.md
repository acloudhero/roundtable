# RoundTable v0.11.0 Markdown Handoff Mode — Checkpoint H State

**Status:** All four core structured-import source kinds are now wired end-to-end (mediator_synthesis, model_response, generated_prompt, mediator_packet). POTENTIALLY_TRUNCATED false positive fixed. Build clean. **33/33** end-to-end assertions pass.

This document describes the exact state of the codebase at the moment this zip was produced. Read it before resuming.

## What changed in Checkpoint H

Three deliberately-scoped items:

1. **Fix POTENTIALLY_TRUNCATED false positive** on every clean round-trip.
2. **Wire structured commit for `generated_prompt`** (commitGeneratedPrompt foundation existed; added target analyzer + gate plumbing + state threading).
3. **Wire structured commit for `mediator_packet`** (commitMediatorPacket foundation existed; added target analyzer + gate plumbing).

No new files. Tight, surgical edits to four files.

### Files created

None.

### Files modified (4)

- **`src/types/markdownArtifact.ts`** — added 2 new `ImportWarningCode` values: `EXISTING_PROMPT_WILL_BE_OVERWRITTEN`, `EXISTING_PACKET_WILL_BE_OVERWRITTEN`.
- **`src/utils/artifactImport.ts`** — added the carve-out for closing code fences in `detectTruncationAndUnclosedFence`; added `analyzeGeneratedPromptTarget(fm, state, warnings)` and `analyzeMediatorPacketTarget(fm, state, warnings)` helpers; wired both into `buildImportPreview`'s per-source-kind branch.
- **`src/utils/importHistory.ts`** — threaded `state` through `commitStructured` to `commitGeneratedPrompt` to `upsertGeneratedPrompt`. Overwrite-aware change descriptions on both `commitGeneratedPrompt` and `commitMediatorPacket`. `upsertGeneratedPrompt` now preserves the existing slot's status via the `...p` spread (matches the model_response pattern) and resolves `modelDisplayName` from `state.modelProfiles` for new slots instead of empty string.
- **`src/hooks/useMarkdownUpload.ts`** — extended `STRUCTURED_KINDS` whitelist to include `generated_prompt` and `mediator_packet`; added defensive `onImport` re-checks for `generated_prompt` (model_id presence + slot/selected resolution); added per-source-kind status messages on success; extended the deferred-reason `useMemo` with full gate branches for both new source kinds.

### Files NOT modified

- `src/components/ImportPreviewModal.tsx` — unchanged. Existing gating on `structuredImportDeferredReason` is the right contract for all four source kinds.
- `commitMediatorSynthesis`, `commitModelResponse` — untouched.
- ResponsesPanel, MediatorPanel, RoundBuilderPanel — untouched. Existing panel-level Upload `.md` affordances and per-slot ResponsesPanel Upload `.md` cover the user paths for all four kinds; no new UI was needed for prompt or packet (a future Checkpoint can add per-prompt-slot Upload `.md` in RoundBuilderPanel if desired).
- Foundation utilities (`markdownNormalize`, `markdownHash`, `markdownParse`, `mediatorExtract`) — untouched.
- `package.json` / lockfile / CSS — unchanged.

## Exact fix for POTENTIALLY_TRUNCATED false positive

**Root cause:** the heuristic in `detectTruncationAndUnclosedFence` checked whether the body's last non-blank line's last char is in `TRUNCATION_TERMINATORS` (`.`, `!`, `?`, `)`, `]`, `>`, `` ` ``, `"`, `'`, `”`, `’`, `】`, `。`). RoundTable's `buildGeneratedPromptBody` and `buildModelResponseBody` always end with `${fence(text)}\n` where `fence()` wraps content in `~~~~markdown\n...\n~~~~`. So the body's last non-blank line is `~~~~`, whose last char `~` is NOT in the terminator list → every clean round-trip emitted POTENTIALLY_TRUNCATED.

**Fix site:** `detectTruncationAndUnclosedFence` in `src/utils/artifactImport.ts`.

**Change:** after computing `lastNonBlank`, add a carve-out that treats a line composed entirely of fence characters (`~{3,}` or `` `{3,} ``) as a clean structural end-of-body marker:

```ts
if (lastNonBlank.length > 0) {
  // v0.11.0 Checkpoint H — recognize a CLOSING code fence as a clean
  // end-of-body marker. A line composed entirely of fence characters
  // (~~~+ or ```+) indicates the file's final structural element is a
  // properly-closed fenced block — strong evidence the file was NOT
  // truncated.
  if (/^(~{3,}|`{3,})\s*$/.test(lastNonBlank)) {
    return;
  }
  const lastChar = lastNonBlank[lastNonBlank.length - 1];
  if (!TRUNCATION_TERMINATORS.includes(lastChar)) {
    warnings.push({ code: 'POTENTIALLY_TRUNCATED', ... });
  }
}
```

**Why this doesn't mask real truncation:**
- The `walkFenceAware` pre-check above this code emits `UNCLOSED_CODE_FENCE` for any file whose body opens a fence and never closes it. That's the only case where "ends with fence chars" would coincide with truncation — and it's caught by a separate, more reliable check.
- If a file is truncated mid-prose (no fence involved), the last non-blank line will not be fence-only, and the original terminator heuristic still fires.
- Files that end with bracket characters (`]`), like mediator_packet bodies whose `mediatorPrompt` ends with `…recommendation wrong?]`, were already passing the terminator check and continue to.

**Verification:** the e2e smoke test confirms clean round-trips of all three structured artifact types (generated_prompt, model_response, mediator_packet) produce zero POTENTIALLY_TRUNCATED warnings, while a deliberately-unclosed-fence file still emits UNCLOSED_CODE_FENCE.

## How generated_prompt structured import works

End-to-end flow when the user uploads a `generated_prompt.md` through any panel-level Upload `.md` affordance:

1. **File read** via `File.text()`.
2. **Preview build.** `buildImportPreview(text, state, context)`:
   - Standard frontmatter parse + validation + hash recompute.
   - For `source_kind === 'generated_prompt'`, calls `analyzeGeneratedPromptTarget(fm, state, warnings)` which emits (in order):
     - `LOCKED_ROUND` if the resolved round is locked → returns early.
     - `MODEL_ID_NOT_IN_ROSTER` if `fm.model_id` has no existing prompt slot AND is not in the round's `selectedModelIds` → returns early.
     - `EXISTING_PROMPT_WILL_BE_OVERWRITTEN` if the target slot already has a non-empty `promptText`.
3. **Modal renders.** The hook's `deferredReason` memo evaluates source-kind-specific gates: round_id present, round resolves, round not locked, model_id present, model resolves to slot OR selected list. If all pass, the primary Import button is enabled.
4. **User clicks Import.** The hook's `onImport`:
   - Re-checks STRUCTURED_KINDS whitelist (now includes `generated_prompt`).
   - Re-checks round_id, round resolution, round.locked.
   - Re-checks model_id presence and slot/selected resolution.
   - Projects post-write storage pressure → window.confirm gate at `hard` level.
   - Calls `commitStructured(preview, state)` → dispatches to `commitGeneratedPrompt(preview, fm, targetRound, state)`.
5. **`commitGeneratedPrompt`**:
   - Extracts prompt text from the `## Prompt Text` fenced section (or whole body fallback).
   - Computes overwrite-aware change description.
   - Builds updated round via `upsertGeneratedPrompt(round, fm, text, state)`:
     - **Existing slot:** replaces `promptText`, refreshes `generatedAt`, optionally updates `canonicalStateHashAtGeneration` from frontmatter. Status preserved via `...p` spread (matches model_response pattern — `'copied'` shouldn't be undone by an import).
     - **New slot:** resolves `modelDisplayName` from `state.modelProfiles` (fallback to `fm.model_id`); status defaults to `'generated'`.
   - Builds an `ImportTransaction` with `snapshotBefore: { round }` + `round_prompt_set` change entry.
6. **`onUpdate(result.updater)`** dispatches; transaction appended to `state.importHistory`. Status notice confirms the import with model display name + round number + transaction id tail.

## How mediator_packet structured import works

End-to-end flow when the user uploads a `mediator_packet.md` (MediatorPanel's panel-level Upload `.md`):

1. **File read** + **preview build** as above. For `source_kind === 'mediator_packet'`, calls `analyzeMediatorPacketTarget(fm, state, warnings)`:
   - `LOCKED_ROUND` if round is locked → returns early.
   - `EXISTING_PACKET_WILL_BE_OVERWRITTEN` if `round.mediatorPrompt` is non-empty.
2. **Deferred-reason gate** (round-scoped only — no model concerns):
   - round_id present, round resolves, round not locked.
   - If all pass → Import button enabled.
3. **User clicks Import.** The hook's `onImport` re-checks (no model branch); calls `commitStructured` → `commitMediatorPacket(preview, fm, targetRound)`.
4. **`commitMediatorPacket`**:
   - Strips the leading `# Mediator Packet — …` H1 from the body via `stripLeadingH1`.
   - Overwrites only `round.mediatorPrompt`. **`mediatorSynthesis` and `modelResponses` are preserved** — only the one field is touched in the round update.
   - Overwrite-aware change description.
   - `ImportTransaction` with `snapshotBefore: { round }` + `round_field_set` change entry.
5. **`onUpdate` + status notice** confirm import.

**Why mediatorSynthesis/modelResponses preservation is guaranteed:** the spread `{ ...round, mediatorPrompt: body, updatedAt }` only changes the named keys. Every other field on the round (including `mediatorSynthesis`, `modelResponses`, `userDecision`, `canonicalStateUpdate`, etc.) is copied verbatim from the input round. Verified explicitly in the e2e smoke test.

## How overwrite / locked-round / ambiguous-target cases are handled

### Overwrite
For all three new-or-extended source kinds the pattern is identical: target-analyzer emits an `EXISTING_*_WILL_BE_OVERWRITTEN` warning at severity `'warning'`. The modal renders the Import button enabled (overwrite is not a hard block), but the existing two-step "Import anyway" gate forces deliberate confirmation: button label flips to `⚠ Confirm Import` on first click, commit only fires on second click. The full round slice is snapshotted as `snapshotBefore.round` so rollback restores both body AND any per-slot status field (prompt's `status`, response's `status`).

### Locked round
`analyzeGeneratedPromptTarget` and `analyzeMediatorPacketTarget` both check `round.locked` early and emit `LOCKED_ROUND` (severity warning). The deferred-reason gate promotes this to a hard block: the Import button is rendered disabled with a tooltip explaining why. Raw Notes remains available. `onImport` defensively re-checks `round.locked` as belt-and-suspenders.

### Ambiguous target
- **No round_id / round_id doesn't resolve** → resolveTargetSummary emits `ROUND_NOT_FOUND` (already from foundation); deferred-reason gate fires.
- **No model_id (prompt only)** → deferred-reason gate fires.
- **model_id has no slot AND not in selectedModelIds** → `analyzeGeneratedPromptTarget` emits `MODEL_ID_NOT_IN_ROSTER`; deferred-reason gate hard-blocks. Raw Notes available.
- **Unsupported source_kind** → fell through to the generic "structured import for this source kind arrives in a later checkpoint" reason. After Checkpoint H this should fire only for `raw_notes` (which always routes via `import_as_raw`).

## How rollback is supported

Identical mechanism to mediator_synthesis (Checkpoint E) and model_response (Checkpoint G):

- Each commit (`commitGeneratedPrompt`, `commitMediatorPacket`) builds an `ImportTransaction` with `snapshotBefore: { round }` capturing the FULL pre-import round slice (deep-cloned via `makeTransaction`).
- `rollbackTransaction(transactionId, reason)` returns an `AppStateUpdater` that restores the snapshotted round and marks the transaction `rolledBackAt`.
- Most-recent-only semantics (per locked v0.11.0 design decision) enforced by `canRollback(state, transactionId)`.
- `ImportHistoryPanel` (Checkpoint B) renders the rollback button gated by `canRollback`. No changes needed.

Verified via e2e: prompt overwrite that mutated body + preserved status, after rollback, restores BOTH original body AND original status. Packet overwrite that mutated `mediatorPrompt`, after rollback, restores the original packet text AND keeps `modelResponses` intact.

## Build state

- `npx tsc --noEmit` → exit 0, no output.
- `npm run build` → exit 0:
  - `dist/index.html` 0.51 kB
  - `dist/assets/index-*.css` 27.38 kB (gzip 5.06 kB) — unchanged from G.
  - `dist/assets/index-*.js` 424.10 kB (gzip 122.97 kB) — up from 418.72 kB in G (+5.38 kB raw, +0.59 kB gzipped) for the two analyzers, two warning codes, state-threading on prompt commit, and the hook's expanded gate logic.
  - 76 modules transformed (unchanged — no new files).
- End-to-end smoke test (`/tmp/h-verify.mjs`, bundled via esbuild + node 22): **33/33 assertions pass** across all scenarios.

## Known limitations

- **No per-prompt-slot Upload `.md`** in `RoundBuilderPanel`. The brief did not require it, and the panel-level Upload `.md` already handles prompts cleanly because frontmatter declares `model_id`. A future checkpoint could extract a `<GeneratedPromptSlotCard>` mirroring the ResponsesPanel pattern from Checkpoint G; not in scope here.
- **No per-packet-slot affordance** — packets are round-scoped, not slot-scoped, so panel-level Upload `.md` is the right granularity. The MediatorPanel already has a panel-level Upload `.md` (Checkpoint D); it now activates for `mediator_packet` files too.
- **Prompt overwrite preserves status** — same as model_response. If a `'copied'` prompt is re-imported, the new body lands but the slot stays `'copied'`. This matches the brief's "preserve reviewed/excluded rules" intent extended to prompt-level human judgments.
- **`window.confirm` storage-pressure gate** still uses the browser-default modal. Inherited from prior checkpoints.
- **The fence-recognition carve-out matches lines whose only content is `~{3,}` or `` `{3,} `` (plus optional trailing whitespace).** Lines that end with `~~~` but have additional content before them (e.g., `text ~~~`) are NOT carved out — they're treated as ordinary text and hit the terminator heuristic. That's correct behavior (`text ~~~` is not a fence-closing line; it's prose ending with tildes).

## Deferred items for Checkpoint I

The v0.11.0 release-candidate hardening pass. Suggested scope:

- **`docs/MARKDOWN_HANDOFF.md`** — the user-facing reference for the Markdown Handoff Mode: source kinds, frontmatter schema, normalization rules, hash semantics, rollback behavior, storage pressure thresholds.
- **`docs/PHASE_HISTORY.md`** update — v0.11.0 entry summarizing what shipped across Checkpoints A–H.
- **`docs/SCHEMA_EVOLUTION.md`** update — the `roundtable.markdown.v1` artifact schema; new AppState fields (`rawNotes`, `importHistory`); migration notes for v0.10.5 → v0.11.0.
- **`docs/DATA_MODEL.md`** update — the new types (`MarkdownArtifactFrontmatter`, `ImportPreview`, `ImportTransaction`, `RawNote`, etc.).
- **`docs/RELEASE_CHECKLIST.md`** update — v0.11.0 acceptance criteria walk (the 15 items in feasibility doc sec. 12).
- **Replace `window.confirm` gates** with an in-style modal for storage-pressure and overwrite confirmations.
- **Optional: per-prompt-slot Upload `.md`** in `RoundBuilderPanel` (mirrors ResponsesPanel pattern).
- **Optional: decision-log import path** (currently routes to Raw Notes only).

## How to resume

1. `npm install` — no new deps.
2. `npx tsc --noEmit` → expect clean.
3. `npm run build` → expect clean.
4. Optional: re-bundle and run `/tmp/h-verify.mjs` to re-confirm all 33 assertions.
5. Manual exercise:
   - In RoundBuilderPanel: generate a prompt → click `Download .md` on the prompt → in any panel with an Upload `.md` affordance, upload that file → confirm preview is commit-eligible with no POTENTIALLY_TRUNCATED warning → Import → confirm prompt re-populated → roll back via Import History → confirm restored.
   - In MediatorPanel: generate a packet → click `Download .md` (packet) → upload back into the same panel → confirm overwrite warning + two-step gate → Import → confirm packet refreshed AND `modelResponses` + `mediatorSynthesis` preserved → roll back → confirm restored.
   - Lock the round, try uploading a prompt → confirm `LOCKED_ROUND` warning, Import disabled, Raw Notes still works.
   - Edit a downloaded `.md` to declare a `model_id` that's not in your roster and not selected for the round → confirm `MODEL_ID_NOT_IN_ROSTER` warning + Import blocked + Raw Notes available.
6. Begin Checkpoint I: docs pass + acceptance walk + RC hardening per feasibility doc sec. 12.
