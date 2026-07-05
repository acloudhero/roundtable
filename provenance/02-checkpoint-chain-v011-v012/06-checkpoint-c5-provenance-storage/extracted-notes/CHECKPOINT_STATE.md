# RoundTable v0.11.0 Markdown Handoff Mode — Checkpoint C.5 State

**Status:** Provenance gap closed; storage-pressure surfacing wired into the app shell. Build clean. Import side (Upload `.md`, modal wiring, raw-note creation from imports) still NOT started.

This document describes the exact state of the codebase at the moment this zip was produced. Read it before resuming.

## What changed in Checkpoint C.5

Two narrowly scoped changes, no new files:

1. **Capture `canonicalStateHashAtGeneration` at prompt generation time** so generated-prompt Markdown handoff artifacts stamp the state-at-generation hash rather than the state-at-export hash.
2. **Surface storage pressure** as a banner under the tab nav whenever `localStorageAdapter.saveWithReport()` reports `warn` / `hard` levels or an actual save failure (`QuotaExceededError`).

No foundation utilities, no types, no configs, no migrations, no storage adapters were modified. No new files. No new dependencies.

### Files modified (3)

- `src/components/RoundBuilderPanel.tsx` — `handleGenerate` is now async; calls `await hashProjectCanonicalState(project)` before dispatching, and passes the result through to `roundUtils.generatePromptsForRound` (which stamps it onto each new `GeneratedPrompt.canonicalStateHashAtGeneration`). Graceful degradation: a hash failure (SubtleCrypto unavailable on `file://`, etc.) yields `null` which is silently omitted from the prompt rather than blocking generation. Diff: +41 / -2 lines.
- `src/App.tsx` — switched the save effect from `localStorageAdapter.save()` to `localStorageAdapter.saveWithReport()`; captures `pressure.level`, `pressure.message`, and any `QuotaExceededError` into React state. Renders a new `StoragePressureBanner` component (defined inline at the bottom of the file) whenever the level is `warn`/`hard` or the last save failed. Banner has three quick-jump buttons to Raw Notes, Import History, and Export / Import — these are the cleanup surfaces. The banner does NOT auto-prune; cleanup is the user's choice. Diff: +164 / -1 lines (the StoragePressureBanner component is ~100 lines; the rest is state hooks and effect updates).
- `src/styles/app.css` — appended a 75-line section "v0.11.0 Checkpoint C.5 — StoragePressureBanner" with nine new classes (`.storage-pressure-banner` + level variants `-warn` / `-hard` / `-error`, plus `-headline`, `-message`, `-body`, `-actions`). Uses existing design tokens only (no new colors); the variants compose existing amber/red palette. Includes a `@media (max-width: 720px)` rule that stacks the actions row on narrow viewports.

### Files NOT modified

- All foundation utilities, types, configs, storage adapters — untouched from Checkpoint C.
- `package.json` / `package-lock.json` — no new dependencies.
- `ResponsesPanel`, `MediatorPanel`, `DecisionLogPanel`, `RawNotesPanel`, `ImportHistoryPanel`, `ImportPreviewModal`, and every other panel — untouched.
- `roundUtils.generatePromptsForRound` — already accepted the optional `canonicalStateHashAtGeneration` parameter (Checkpoint A foundation); this checkpoint only wires the caller, not the helper.

## How `canonicalStateHashAtGeneration` is captured

The capture happens in `RoundBuilderPanel.handleGenerate`. The new sequence:

```ts
const capturedProject = project;
// ... other captured-into-closure values ...

let capturedHash: string | null = null;
try {
  capturedHash = await hashProjectCanonicalState(capturedProject);
} catch (err) {
  console.warn('[RoundTable] Could not hash project canonical state at prompt generation. ' +
               'Continuing without canonicalStateHashAtGeneration provenance.', err);
  capturedHash = null;
}

onUpdate(updateRoundFunctional(activeRound.id, (liveRound) =>
  generatePromptsForRound(
    { ...liveRound, userInstruction: capturedInstruction, selectedModelIds: capturedSelectedIds, updatedAt: nowIso() },
    capturedProject,
    capturedProfiles,
    capturedCompat,
    capturedWrappers,
    capturedHash   // ← new: stamped onto every new GeneratedPrompt
  )
));
```

Properties of this design:

- **The hash represents the canonical state at *generation* time, not export time.** It is computed *before* the functional dispatch — the `capturedProject` snapshot is the project as it was when the user clicked "Generate Prompts". The Promise resolves on the same event-loop tick before the React state update is dispatched.
- **No race.** Even if `onUpdate` dispatches concurrent commits, the functional updater closure receives `capturedHash` (which was bound when the handler ran), so the hash always matches the canonical state the user saw.
- **Generation never fails on hash failure.** SubtleCrypto unavailability (e.g. `file://` origin) returns `null` from `hashProjectCanonicalState`; the `try` / `catch` covers any further surprise throw. `null` is preserved through to `generatePromptsForRound`, which simply does NOT stamp the field — the resulting prompt is shape-identical to a pre-v0.11.0 prompt. The Markdown Handoff downstream code already treats missing `canonicalStateHashAtGeneration` as a non-event.
- **Existing prompts remain valid.** Prompts in pre-existing rounds have no `canonicalStateHashAtGeneration` — they predate this capture. Their Download `.md` path falls back to computing the *current* canonical state hash inside `buildArtifact`. Same behavior as Checkpoint C — they're not retroactively re-stamped.
- **Existing copy/paste workflow is preserved.** `handleCopy` is unchanged. The Copy button still copies `prompt.promptText` to the clipboard exactly as before.

## Does Download `.md` use the generation-time hash?

Yes — this was already wired in Checkpoint C. Confirming:

`RoundBuilderPanel.handleDownload` (lines 167-178) passes `prompt.canonicalStateHashAtGeneration` into the artifact build's `ctx.canonicalStateHash`. The `buildArtifact` core (`src/utils/markdownArtifact.ts` lines 115-118) prefers that pre-supplied hash when present and falls back to `await computeContentHash(normalizeForHash(project.canonicalState))` only when the field is `undefined`.

After Checkpoint C.5, prompts generated through `handleGenerate` carry the field, so freshly downloaded prompt artifacts reflect state-at-generation. Older prompts (pre-C.5) gracefully fall back to state-at-export, with no UI difference visible to the user.

## How storage pressure is surfaced

The save effect in `App.tsx` previously called `localStorageAdapter.save(state)` (void return). Now it calls `localStorageAdapter.saveWithReport(state)` which returns:

```ts
interface StorageSaveResult {
  ok: boolean;                                  // setItem actually succeeded
  error?: 'quota_exceeded' | 'unknown';         // populated when !ok
  pressure: StoragePressureReport;              // always populated
  serializedJson?: string;                      // for export-then-prune flow
}
```

The component captures `pressure.level` (one of `'ok' | 'warn' | 'hard'`), `pressure.message`, and (separately) any save failure into React state. When the level is `'warn'`, `'hard'`, or a save failure occurred, the `StoragePressureBanner` renders:

- **warn** (`~3.5 MB` serialized AppState): amber banner. "Storage usage approaching the safe threshold." Cosmetic; cleanup is recommended but not blocking.
- **hard** (`~4.25 MB` serialized AppState): red banner. "Storage usage past the safe threshold." New imports that grow state may push past the quota; the user should prune.
- **error** (the most recent save call returned `ok: false`): red banner with a 2-px top/bottom border to visually distinguish it from a pressure threshold. "Storage save failed." The in-memory state is ahead of what's persisted; the user MUST act before the next reload, or unsaved changes will be lost. The message specifically mentions quota-exceeded vs. unknown.

Each banner offers three quick-jump buttons:
- **Raw Notes** → navigates to the existing Raw Notes tab (where the user can review and delete fallback notes — actually, Checkpoint B did not include delete; the buttons still navigate but pruning is currently manual via export+reset).
- **Import History** → navigates to the Import History tab.
- **Export / Import** → navigates to the existing JSON export panel, which is the safe-rollback path: export current state, then clear and re-import a slimmer version if needed.

The banner sits between the tab nav and the main panel, so it's visible regardless of which tab is active. It auto-clears when a subsequent save succeeds (`saveError` is reset in the same effect).

The banner does NOT auto-prune, does NOT migrate storage, and does NOT introduce a cleanup wizard. Per the C.5 brief, those are out of scope.

## Build state

- `npx tsc --noEmit` → exit 0, no output.
- `npm run build` → exit 0:
  - `dist/index.html` 0.51 kB
  - `dist/assets/index-*.css` 27.38 kB (gzip 5.06 kB) — up from 26.11 kB (+1.27 kB raw, +0.19 kB gzipped, for the banner styles).
  - `dist/assets/index-*.js` 353.77 kB (gzip 102.92 kB) — up from 351.32 kB (+2.45 kB raw, +0.75 kB gzipped, for the banner component + state hooks).
  - 74 modules transformed (unchanged — no new modules, only edits to existing ones).

## Known limitations

- **Older prompts still fall back to state-at-export hashing on Download.** Prompts generated before this checkpoint do not carry `canonicalStateHashAtGeneration` and never will retroactively. Their downloaded artifacts use the current canonical state hash instead. This is the documented graceful-degradation behavior, not a bug; the import side already handles both shapes.
- **The Raw Notes tab does not yet expose a delete affordance.** The banner's "Raw Notes" quick-jump navigates to the panel where the user can inspect notes; the existing `removeRawNote` helper in `utils/importHistory.ts` is wired-ready but no UI calls it. Adding a delete button is a Checkpoint D candidate.
- **Pressure thresholds (`~3.5 MB` warn, `~4.25 MB` hard) are documented constants.** They are a conservative estimate relative to typical browser localStorage quotas (usually 5–10 MB). If a user's browser has an aggressive 2.5 MB limit, the hard banner will surface only after a `QuotaExceededError` — at which point the `error` banner takes over.
- **Single-tab assumption preserved.** Multi-tab concurrent writes still last-write-wins through localStorage (unchanged from v0.10.5). The pressure banner only reflects what *this tab* most recently wrote.
- **No telemetry, no auto-export.** A failed save raises a banner; the user must click Export / Import to download the in-memory state. We do not auto-trigger a download — that could be unwanted on every quota-exceeded blink.

## Deferred (Checkpoint D candidates)

- Upload `.md` per panel + `ImportPreviewModal` wiring.
- Raw-note creation from import flows.
- Storage-cleanup affordances (delete button on RawNotesPanel rows; bulk prune of import history; one-click "export & reset").
- Documentation: `docs/MARKDOWN_HANDOFF.md`; updates to `PHASE_HISTORY`, `SCHEMA_EVOLUTION`, `DATA_MODEL`, `RELEASE_CHECKLIST`.
- Replace v0.10.3 prefix-heuristic stale-packet check in `MediatorPanel` with hash-based check (Q14 #15: coexist for one release, remove in v0.11.1).
- Acceptance-criteria walk (feasibility doc sec. 12, 15 items).

## How to resume

1. `npm install` (lockfile still pins `js-yaml`, `@types/js-yaml` — no new deps).
2. `npx tsc --noEmit` → expect clean.
3. `npm run build` → expect clean.
4. To exercise the C.5 changes manually:
   - Generate prompts in Round Builder, then download one as `.md` and confirm the `canonical_state_hash` frontmatter field matches `sha256:<hex of NFC-normalized canonical state>`. Change the project's canonical state, generate a *new* round, download — confirm the hash differs.
   - Hit the storage threshold by importing or pasting enough content to push serialized AppState past the warn threshold; the amber banner should appear under the tab nav.
5. Begin Checkpoint D: import side wiring per the Checkpoint C state doc, plus the deferred items above.
