# RoundTable v0.11.0 Markdown Handoff Mode — Checkpoint I State

**Status:** Release-candidate hardening complete. **15/15** acceptance
criteria pass on the automated walk. Clean type-check, clean
production build, zero new network surfaces. RC-ready.

This document describes the exact state of the codebase at the moment
this ZIP was produced. Read it before resuming.

## What changed in Checkpoint I

Checkpoint I is the release-candidate hardening pass over the
Checkpoint H base. It is documentation-heavy and code-light: no
functional defects were found during the acceptance walk, so the
code changes are limited to one small optional UI addition (Raw
Notes Delete button) and version-string alignment across docs.

### Files created (4)

- **`docs/MARKDOWN_HANDOFF.md`** — operator-facing reference for
  the entire v0.11.0 Markdown handoff workflow. Covers what the mode
  is, why it exists, the five supported source kinds, export flow,
  import flow (5-stage pipeline), Raw Notes fallback, Import History,
  rollback, storage pressure thresholds, eight known limitations,
  deferred v0.11.1+ items, local-first/security notes, the
  reaffirmation that no network or backend surface is introduced,
  and a code-pointer table for the implementation.

- **`scripts/acceptance-walk.ts`** — bundled smoke test that walks
  all 15 acceptance criteria from the v0.11.0 feasibility plan
  against the actual code. Runs under node22 with SubtleCrypto;
  uses in-memory AppState fixtures only (no localStorage, no
  filesystem writes). Reports PASS/FAIL/PARTIAL per criterion plus
  an ancillary Raw Notes ring-buffer sanity check.

- **`scripts/acceptance-walk-results.txt`** — preserved output of
  the most recent acceptance walk run. Ends with
  `Summary: 15 pass, 0 partial, 0 fail`.

- **`CHECKPOINT_STATE_I.md`** — this file.

### Files modified (7)

- **`README.md`** — version line `0.10.5` → `0.11.0`; new v0.11.0
  callout block referencing `docs/MARKDOWN_HANDOFF.md`; phase
  footer updated.

- **`docs/PHASE_HISTORY.md`** — phase table updated with v0.10.x and
  v0.11.0 rows; status line bumped from "Phase 9" to "v0.11.0"; full
  v0.11.0 entry (~200 lines) appended summarizing all 9 checkpoints
  A–I and the 15-criterion PASS table.

- **`docs/SCHEMA_EVOLUTION.md`** — current schema version line
  bumped from `0.10.0` to `0.11.0` with explanatory paragraph;
  full "0.10.5 → 0.11.0" section appended covering the two new
  top-level arrays, the new supporting types in
  `markdownArtifact.ts`, the new artifact format
  `roundtable.markdown.v1`, the optional
  `GeneratedPrompt.canonicalStateHashAtGeneration` field, the
  `migrate_0_10_5_to_0_11_0` migration step, backward
  compatibility, all seven locked constants, and the
  no-network-surfaces statement.

- **`docs/DATA_MODEL.md`** — header bumped from "Phase 9 Release
  Candidate" to "v0.11.0 (Markdown Handoff Mode)"; AppState shape
  diagram updated to 0.11.0 with new `rawNotes` and `importHistory`
  fields; shape-change paragraph rewritten to reference v0.11.0;
  schema version line `0.10.2` → `0.11.0`; full "v0.11.0 Markdown
  Handoff Fields" section appended with TypeScript signatures for
  `RawNote`, `ImportTransaction`, `ImportChange`,
  `ImportSnapshotSlice`, `MarkdownArtifactFrontmatter`, the new
  optional `canonicalStateHashAtGeneration` field, and the
  storage-pressure thresholds.

- **`docs/RELEASE_CHECKLIST.md`** — version line bumped to
  `0.11.0`; version-alignment checkboxes updated through; the
  one stray `schemaVersion: "0.10.5"` line fixed; full "v0.11.0
  Markdown Handoff Mode Acceptance Walk" section appended with the
  automated walk command and manual operator verification
  subsections for each of C1–C15, plus optional Raw Notes delete
  and storage pressure banner checklists.

- **`src/components/RawNotesPanel.tsx`** — optional Delete button
  added per the brief. The `removeRawNote` helper has existed in
  `importHistory.ts` since Checkpoint B; this wires it behind a
  two-step inline confirm gate (first click arms, second click
  within ~5s commits). The button only renders when
  `onUpdate` is passed by the parent; existing call sites that
  pass only `state` continue to work.

- **`src/App.tsx`** — single one-line change: pass `onUpdate` to
  `<RawNotesPanel />` so the new Delete button can dispatch state
  updates.

### Files NOT modified

- Foundation utilities (`markdownNormalize`, `markdownHash`,
  `markdownParse`, `mediatorExtract`) — untouched.
- Functional commit utilities (`commitStructured`,
  `commitMediatorSynthesis`, `commitModelResponse`,
  `commitGeneratedPrompt`, `commitMediatorPacket`,
  `commitAsRawNote`, `rollbackTransaction`, `addRawNote`,
  `removeRawNote`) — untouched. All passed the acceptance walk
  on the Checkpoint H base; no edits were warranted.
- `src/utils/artifactImport.ts` — untouched (the carve-out for
  closing fences and the four `analyze*Target` helpers all behave
  correctly per the walk).
- `src/hooks/useMarkdownUpload.ts` — untouched.
- `ImportPreviewModal.tsx`, `ImportHistoryPanel.tsx` — untouched.
- `src/utils/migration.ts` — untouched (the
  `migrate_0_10_5_to_0_11_0` step passed both the additive-fields
  and idempotency criteria).
- `package.json` / lockfile / CSS — unchanged.

## Acceptance walk result

Run command:

```bash
cd /home/claude/work
npx esbuild scripts/acceptance-walk.ts --bundle --platform=node \
  --target=node22 --format=cjs --outfile=/tmp/walk.cjs
node /tmp/walk.cjs
```

Result:

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

Plus the ancillary Raw Notes ring-buffer sanity check (200 cap,
oldest entries pruned, `removeRawNote` works).

Full output preserved in `scripts/acceptance-walk-results.txt`.

## Network-surface grep (authoritative)

```bash
grep -rEn "\bfetch\b\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon|RTCPeerConnection|new Worker|new SharedWorker|importScripts\b\(|window\.open\(|location\.href\s*=|location\.(assign|replace)\(" src/
```

Result: zero matches. The only HTTP-looking strings in `src/` are
static vendor URLs in `src/config/modelProfiles.ts` (`https://openai.com`,
`https://claude.ai`, `https://gemini.google.com`) and one
human-readable message about localhost in `src/utils/artifactImport.ts`.
No functional network primitives.

## Build verification

```bash
npm install         # 0 vulnerabilities
npx tsc --noEmit    # exit 0
npm run build       # dist/assets/index-DtFtPZM7.js 424.68 kB
                    # gzip 123.15 kB, 76 modules, ✓ built in ~2.5s
```

The bundle size went from 424.10 kB (Checkpoint H baseline) to
424.68 kB (+0.58 kB), accounted for entirely by the Raw Notes
Delete button code.

## Hardening fixes applied during the walk

The walk found **zero functional defects**. The hardening was
limited to documentation drift:

- README still said `Version: 0.10.5` even though `package.json`
  was already at `0.11.0` — corrected.
- `RELEASE_CHECKLIST.md` still said `0.10.5 (Phase 9 Release
  Candidate)` and listed `0.10.5` in the version-alignment
  checkboxes — corrected to `0.11.0`.
- `DATA_MODEL.md` declared `schema v0.10.2` in two places — corrected.
- `SCHEMA_EVOLUTION.md` declared current schema as `0.10.0` —
  corrected.
- `PHASE_HISTORY.md` table only listed phases through Phase 9 —
  added v0.10.x and v0.11.0 rows.

These are version-string alignment fixes; no code semantics
changed.

## Known limitations (carried from MARKDOWN_HANDOFF.md)

1. No per-prompt-slot Upload `.md` in RoundBuilderPanel
   (panel-level Upload `.md` covers it; per-slot is v0.11.1+).
2. No decision-log structured import path — Raw Notes only.
3. Most-recent-only rollback — cascading rollback deferred to
   v0.11.1.
4. Indented (4-space) code fences not tracked by the fence-aware
   walker.
5. Frontmatter must be exactly one block at the top of the file
   (modulo a leading BOM); multiple frontmatter blocks route to
   Raw Notes.
6. Storage-pressure hard-limit gate uses `window.confirm`
   (deferred for in-style modal upgrade).
7. Reviewed/excluded status preservation on import — a feature,
   not a bug. Rollback restores both body and status.
8. Pre-v0.11.0 prompts lack `canonicalStateHashAtGeneration`;
   their stale-state badge silently skips rather than emitting a
   false positive.

## Deferred to v0.11.1+

- Cascading rollback.
- Per-prompt-slot Upload `.md` in RoundBuilderPanel.
- Decision-log structured import.
- Multi-part stitching (frontmatter `part:` field is reserved,
  always emitted as `null` in v0.11.0).
- Sibling discovery (`RawNote.siblingIds` reserved).
- In-style modal replacing `window.confirm` for storage pressure.
- Raw Notes filter UI.

## Verdict

**v0.11.0 is release-candidate-ready.**

- 15/15 acceptance criteria PASS on the automated walk.
- Clean type-check, clean production build.
- Zero new network surfaces.
- All five source kinds round-trip cleanly.
- Migration is additive and idempotent.
- Existing v0.10.5 workflows are unaffected.
- Documentation pass complete: MARKDOWN_HANDOFF.md (new),
  PHASE_HISTORY.md (updated), SCHEMA_EVOLUTION.md (updated),
  DATA_MODEL.md (updated), RELEASE_CHECKLIST.md (updated),
  README.md (updated).

No further checkpoints are required before RC sign-off. The
remaining work for the v0.11.0 release is operator-side: the
manual verification list in `docs/RELEASE_CHECKLIST.md →
v0.11.0 Acceptance Walk` should be executed against the deployed
build before the release tag is cut.
