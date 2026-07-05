# RoundTable v0.11.0 Markdown Handoff Mode — Checkpoint C State

**Status:** Download `.md` export controls wired into the four primary panels. Build clean. Import side (Upload `.md` + `ImportPreviewModal` wiring + Raw Notes creation) NOT yet started.

This document describes the exact state of the codebase at the moment this zip was produced. Read it before resuming.

## What changed in Checkpoint C

Four `Download .md` buttons added across three panels, plus a shared download helper. No new file-system or storage primitives. No foundation files modified. ImportPreviewModal exists but is still unused.

### Files created

- `src/utils/markdownArtifactDownload.ts` (≈40 lines) — single `downloadMarkdownArtifact(input)` helper that wraps `buildArtifact` + `filenameFor` + `downloadText`. Every Download `.md` affordance dispatches through this one function. Established as the only allowed `.md` save path in v0.11.0 to preserve the single-source-of-truth contract.

### Files modified

- `src/components/RoundBuilderPanel.tsx` — added per-prompt `Download .md` button beside the existing Copy control. `PromptCard` extended with three new props (`onDownload`, `downloading`, `downloadFailed`). When a prompt carries `canonicalStateHashAtGeneration` it is passed through to `buildArtifact` via `ctx.canonicalStateHash`; otherwise the builder computes the current canonical-state hash. Read-only (locked-round) display passes no-op props. ~70 lines added.
- `src/components/ResponsesPanel.tsx` — added per-response `Download .md` button alongside the status (pasted/reviewed/excluded) buttons. The handler captures the current local-draft text and:
  1. dispatches an `upsertModelResponse` update so persisted state matches the exported artifact,
  2. builds an in-memory "ephemeral round" through the same helper for `buildArtifact`,
  3. invokes `downloadMarkdownArtifact` with `source_kind: model_response`.
  This dual-commit closes the same-tick race where a user could otherwise download a stale-by-one-blur artifact. ~60 lines added.
- `src/components/MediatorPanel.tsx` — added two new `Download .md` buttons:
  1. **Mediator packet** beside the existing "Copy → GPT-5.5 Thinking" button. Body wraps `round.mediatorPrompt` verbatim inside the structured frontmatter frame.
  2. **Synthesis** beside the "Save Structured Synthesis" button. Rendered only when `round.mediatorSynthesis` exists — in-progress (unsaved) edits in the textareas are intentionally NOT exported; the artifact reflects the committed synthesis. ~70 lines added.

### Files NOT modified

- `DecisionLogPanel.tsx` — see "Deferred" below.
- All foundation utilities, types, configs, and storage adapters — untouched from Checkpoint B.
- `App.tsx`, `RawNotesPanel.tsx`, `ImportHistoryPanel.tsx`, `ImportPreviewModal.tsx` — untouched.
- CSS — no new styles needed; the new buttons reuse existing `.btn`, `.btn-secondary`, `.btn-copy`, `.notice danger`, `.flex gap-8` classes.

## Build state

- `npx tsc --noEmit` → exit 0, no output.
- `npm run build` → exit 0. Output:
  - `dist/index.html` 0.51 kB
  - `dist/assets/index-*.css` 26.11 kB (gzip 4.87 kB)
  - `dist/assets/index-*.js` 351.32 kB (gzip 102.17 kB) — up from 341.82 kB in Checkpoint B (+9.5 kB raw, ~+2 kB gzipped, for the artifact builder reaching the bundle's call graph plus the four button handlers).
- 74 modules transformed (was 73 in Checkpoint B — `markdownArtifactDownload.ts` is the additional module).
- End-to-end smoke test (run via esbuild + node 22): `buildArtifact` produces valid `fullText` starting with `---\n`, declaring `artifact_type: "roundtable.markdown.v1"` and the correct `source_kind`, with a `.md` filename that includes the per-kind prefix and a short artifact id suffix.

## Same-source-string verification

The v0.11.0 single-source-of-truth contract (feasibility doc sec. 12, acceptance criterion #1) requires that for every artifact source kind, the body text used by Copy is byte-identical to the body wrapped inside the `.md` artifact. Status per source kind:

- **generated_prompt** — ✅ Copy puts `prompt.promptText` on the clipboard; `buildGeneratedPromptBody` wraps that same `prompt.promptText` inside a `~~~markdown` fence under a `## Prompt Text` heading. Round-trip-safe; the inner body extracts cleanly via `extractFencedSection(/^##\s+Prompt Text\s*$/)`.
- **model_response** — ✅ No Copy affordance in `ResponsesPanel` (responses are pasted IN, not copied OUT). The download path uses `r.responseText` (committed via `upsertModelResponse`) inside a `## Response Text` fenced block.
- **mediator_packet** — ✅ Copy puts `generatedPacket` (= `round.mediatorPrompt`) on the clipboard. The artifact body is a `# Mediator Packet — Round N` heading plus an italic provenance line plus `round.mediatorPrompt` verbatim. The packet text itself is byte-identical.
- **mediator_synthesis** — ✅ No Copy affordance for the synthesis. The artifact body emits each populated synthesis field under its `### {label}` heading using the same `SYNTHESIS_FIELD_LABELS` mapping the panel uses for display.

## Foundation layer (carried forward, unchanged from Checkpoint A/B)

All foundation files compile-clean and unchanged from prior checkpoints:

- Types: `markdownArtifact.ts`, `appState.ts` (with rawNotes/importHistory), `round.ts` (with canonicalStateHashAtGeneration).
- Config: `exportFormats.ts` (0.11.0, ARTIFACT_TYPE), `markdownHandoff.ts` (caps, thresholds, file accept).
- Utilities: `markdownNormalize`, `markdownHash`, `markdownParse`, `markdownArtifact`, `mediatorExtract` (fence-aware), `storagePressure`, `migration` (0.10.5→0.11.0 step), `validation`, `roundUtils`, `artifactImport` (parse side), `importHistory` (commit/rollback side).
- Storage: `localStorageAdapter.saveWithReport`.
- Data: initial state with `rawNotes: []`, `importHistory: []`.
- Components: `ImportPreviewModal`, `RawNotesPanel`, `ImportHistoryPanel` (Checkpoint B — all compile, the modal is still unused).
- App.tsx: routes `raw-notes` and `import-history` tabs.

## Deferred

### DecisionLogPanel `.md` export — deferred with reason

The brief asks for a `Download .md` "only if there is a clear existing source string." `DecisionLogPanel` does NOT expose a self-contained source string that maps to a v0.11.0 `source_kind`:

- The five recognized source kinds are `generated_prompt`, `model_response`, `mediator_packet`, `mediator_synthesis`, `raw_notes`.
- The panel composes a decision from the mediator synthesis (via `useDraftDecision` / `useDraftCanonicalUpdate`) plus user-typed decision text, rationale, next-action, and canonical-state update. None of these is a stand-alone v0.11.0 artifact kind.
- The synthesis it draws from already exports cleanly from `MediatorPanel` via the new `Download Synthesis .md` button (covers the same logical content).
- Adding a "decision" source kind would expand the schema beyond v0.11.0's locked five — out of scope per the task instructions.

If the operator needs a decision export, the existing `exportDecisionLog` / `exportProjectSummary` Markdown exporters in `utils/markdownExport.ts` remain available through the Export / Import panel. A future `source_kind: decision` could be added in v0.11.x without breaking v0.11.0 readers (readers reject unknown source kinds, route to Raw Notes).

### `canonicalStateHashAtGeneration` capture at generation time

`roundUtils.generatePromptsForRound` accepts the parameter (Checkpoint A), but `RoundBuilderPanel.handleGenerate` does not yet compute and pass the hash at generation time. Until that lands, downloads pass `prompt.canonicalStateHashAtGeneration` when present (always undefined currently for newly generated prompts) and fall back to the current canonical state hash. The artifact still includes a valid `canonical_state_hash` — just one that reflects state-at-export rather than state-at-generation. The import-side `CANONICAL_STATE_HASH_MISMATCH` warning will work in either case; the distinction matters only for forensic accuracy on imports that arrive after the project state has evolved further.

This is a Checkpoint D candidate (it's part of "wire generation provenance").

### Upload / import side

Out of scope for Checkpoint C. The import-side foundation (`buildImportPreview`, `commitStructured`, `commitAsRawNote`, `rollbackTransaction`) all exist and compile. `ImportPreviewModal` is ready as a presentational consumer. The wiring is one panel-handler-and-file-input per affordance.

## How to resume (Checkpoint D candidate work)

1. `npm install` (lockfile already pins `js-yaml`, `@types/js-yaml`).
2. `npx tsc --noEmit` → expect clean.
3. `npm run build` → expect clean.
4. Optionally `npm run dev` and exercise the four Download `.md` buttons against a project with a round, prompts, responses, packet, and synthesis. Verify the downloaded files start with `---\nartifact_type: "roundtable.markdown.v1"` and round-trip through the `splitFrontmatter` parser cleanly (the import path is built but not yet wired into UI — manual round-trip is via a temporary script if needed).
5. Begin the import side: per-panel Upload `.md` file picker → `await buildImportPreview(text, state)` → render `<ImportPreviewModal preview={preview} onImport={...} onImportAsRaw={...} onCancel={...} />` → dispatch the `CommitResult.updater` from `commitStructured(preview, state)` or `commitAsRawNote(preview)` through `onUpdate`.
6. Wire `canonicalStateHashAtGeneration` capture into `RoundBuilderPanel.handleGenerate` so newly generated prompts carry the hash for downstream stale-state detection.
7. (Optional) Replace the v0.10.3 60-char prefix-heuristic stale-packet check in MediatorPanel with the hash-based equivalent (Q14 #15: coexist for one release, remove in v0.11.1).
8. Storage-pressure banner: surface `saveWithReport()`'s `pressure.level === 'warn' | 'hard'` somewhere visible (likely Dashboard or in-app header).
9. Documentation: write `docs/MARKDOWN_HANDOFF.md`; update `PHASE_HISTORY`, `SCHEMA_EVOLUTION`, `DATA_MODEL`, `RELEASE_CHECKLIST`.

## Known limitations

- **`canonicalStateHashAtGeneration` not yet captured at prompt-generation time.** Prompts created in this build do not carry the field; downloads use `ctx.project.canonicalState` directly (state-at-export). Listed under Deferred above.
- **No reflective use of the artifact's exported text yet.** The download path was tested with esbuild+node end-to-end; the in-browser path uses the same `buildArtifact` → `filenameFor` → `downloadText` chain. The browser-specific behavior of `URL.createObjectURL` and the anchor-click trick is exercised by existing JSON/markdown export buttons and is reused unchanged.
- **`MediatorPanel.buildMediatorPacketBody` fallback path (when `round.mediatorPrompt` is empty) passes `selectedModels: []` to the packet generator.** This is a structural minor wart inherited from Checkpoint A — does not affect Checkpoint C since the Download `.md` button is only rendered when `generatedPacket` (= `round.mediatorPrompt`) is non-empty.
- **No CSS additions in Checkpoint C.** All new buttons reuse existing classes. If the layout looks slightly cramped at small viewport widths, that's because the existing `.flex gap-8` row in `ResponsesPanel` now hosts four buttons (3 status + 1 download). A `flexWrap: 'wrap'` was added to keep this responsive without new CSS.
- **No DecisionLog `.md` export.** Documented above with rationale.
- **Storage-pressure surfacing not yet in UI.** The adapter reports it; no visible banner yet.

## Quick reference — what a Download .md button does

```ts
// Every Download .md button is essentially:
await downloadMarkdownArtifact({
  kind: '<source_kind>',
  ctx: { project /* + optional canonicalStateHash */ },
  round,
  /* + kind-specific fields: promptId | modelProfileId */
});
```

The helper:
1. Calls `buildArtifact(input)` → `{ frontmatter, body, fullText, artifactId }`
2. Calls `filenameFor(built)` → e.g. `RT_MEDIATOR_PACKET_<Project>_Round-7_20260520_<short-id>.md`
3. Calls `downloadText(fullText, filename, 'text/markdown')` to trigger the browser download.

No mutation, no localStorage write, no network. Async only because SHA-256 hashing is async.
