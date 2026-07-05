# Markdown Handoff Mode

RoundTable — v0.11.0 operator reference for the Markdown handoff workflow.

This document covers what Markdown Handoff Mode is, what it isn't,
how the export and import flows are gated, how the Raw Notes fallback
preserves data when something doesn't fit, and how rollback restores
state when an import lands incorrectly. It is the single source of
truth for the v0.11.0 feature; the feasibility plan and code comments
remain authoritative on implementation details.

---

## What Markdown Handoff Mode is

A local-first, manual, file-mediated handoff for the four RoundTable
artifact shapes that operators already copy/paste today:

- **Generated prompts** (`generated_prompt`) — the Context Sandwich
  prompt RoundTable produced for a particular model on a particular
  round.
- **Model responses** (`model_response`) — what a model returned for
  that prompt, captured verbatim.
- **Mediator packets** (`mediator_packet`) — the synthesis prompt
  RoundTable sent to GPT-5.5 Thinking for a round.
- **Mediator synthesis** (`mediator_synthesis`) — the 12-field
  structured synthesis the mediator returned (executive summary,
  agreements, disagreements, risks, etc.).

A fifth source kind, `raw_notes`, is the universal fallback — any
file that can't be safely routed lands here verbatim for manual
review.

Every produced file is a single `.md` document with a fixed YAML
frontmatter block followed by a Markdown body. Frontmatter declares
provenance (`project_id`, `round_id`, `model_id`), version stamps
(`schema_version`, `app_version`, `artifact_type`), integrity hashes
(`canonical_state_hash`, `prompt_hash`, `content_hash`), and a trust
anchor (`generated_by: roundtable`). Body content is whatever that
source kind needs — typically a single fenced code block for prompts
and responses, or a flat sequence of `###`-prefixed sections for
synthesis.

## Why it exists

The Phase 9 v0.10.x design was clipboard-only: operators copied
prompts to model webchats, copied responses back into RoundTable,
and a copy-paste failure (browser crash, accidental window close,
midnight cleanup of unsaved drafts) silently lost work. v0.11.0
adds a parallel substrate — `.md` files on disk — that operators
can save, share, archive, and re-import without ever touching an
API, a backend, or a network surface.

The design honors three locked constraints from the feasibility
plan:

1. **Local-first and manual.** No fetch, no upload, no sync. Every
   file moves via the operator's local filesystem and the OS file
   picker. The "no API / no automation / no cloud sync" line from
   Phase 0 is enforced.
2. **Same-source guarantee.** Every UI path that produces an
   artifact — Download `.md`, Copy as `.md`, Preview — consumes
   the exact same `fullText` string returned by `buildArtifact()`
   in `src/utils/markdownArtifact.ts`. Code review rejects any
   inline reconstruction.
3. **No silent data loss.** Any file the importer cannot route to
   a structured commit is offered as a Raw Note, with the body
   preserved verbatim and warnings captured for review. The Raw
   Notes path is always available except for files declaring a
   schema_version newer than this app supports — and even those
   can still be Raw-Note-saved.

---

## Supported source kinds

| `source_kind`        | Round-scoped? | Per-slot Upload `.md`? | Panel-level Upload `.md`? | Structured commit? |
|----------------------|---------------|------------------------|---------------------------|--------------------|
| `generated_prompt`   | Yes           | No (v0.11.1+)          | Yes (any panel)           | Yes                |
| `model_response`     | Yes           | Yes (ResponsesPanel)   | Yes (any panel)           | Yes                |
| `mediator_packet`    | Yes           | n/a (round-scoped)     | Yes (MediatorPanel)       | Yes                |
| `mediator_synthesis` | Yes           | n/a (round-scoped)     | Yes (MediatorPanel)       | Yes                |
| `raw_notes`          | Optional      | n/a                    | n/a                       | n/a — fallback only |

"Structured commit" means: applies to the named round field
(`generatedPrompts[i].promptText`, `modelResponses[i].responseText`,
`mediatorPrompt`, `mediatorSynthesis`) and pushes a rollback-able
`ImportTransaction` onto `state.importHistory`. The alternative —
"Import as Raw Notes" — preserves the body verbatim under
`state.rawNotes` with no round mutation.

Raw notes can be exported via Download `.md` from the Raw Notes
panel (handy for archiving) but are **not re-importable as
structured artifacts** by design. Re-import would require choosing
a target round, which negates the "I couldn't route this safely
before" reason the note existed in the first place. Operators
inspect Raw Notes, copy the relevant content, and re-enter it
manually in the appropriate panel.

---

## Export flow

1. The operator clicks **Download `.md`** on a workflow surface —
   a generated-prompt card, a response card, the Mediator panel,
   or the Decision Log.
2. RoundTable calls `buildArtifact(input)` once and writes the
   returned `fullText` to disk via the existing `markdownArtifactDownload`
   helper. The filename follows the locked prefix in
   `src/config/markdownHandoff.ts`:

   | source_kind          | prefix                     |
   |----------------------|----------------------------|
   | `generated_prompt`   | `RT_PROMPT_*.md`           |
   | `model_response`     | `RT_RESPONSE_*.md`         |
   | `mediator_packet`    | `RT_MEDIATOR_PACKET_*.md`  |
   | `mediator_synthesis` | `RT_MEDIATOR_SYNTHESIS_*.md` |
   | `raw_notes`          | `RT_RAW_NOTES_*.md`        |
3. The file is byte-stable: byte-identical inputs produce
   byte-identical files. Two consecutive Download `.md` clicks on
   the same source produce identical fullText (modulo `artifact_id`
   and `exported_at`, which are intrinsic to each export instance).
4. The file is portable: it opens in any text editor, renders in
   any Markdown viewer, and contains everything an operator needs
   to re-import it later.

The only constraint on the export side is that `SubtleCrypto` must
be available for `content_hash` / `canonical_state_hash` /
`prompt_hash` to be populated. RoundTable served from `http://localhost`
or HTTPS satisfies this; a plain `file://` origin does not. When
hashing is unavailable, the export still succeeds — the affected
hash fields are emitted as `null` and a banner suggests serving from
localhost or HTTPS.

**iOS PWA note (v0.12.0 Checkpoint K):** when the operator
downloads a Markdown artifact from an installed iOS PWA, the file
save goes through the iOS Share Sheet — the operator taps "Save to
Files," picks a location, and confirms. This is one extra tap
compared to the desktop browser experience but is not a regression
introduced by Markdown Handoff Mode; it is how iOS handles all
`<a download>` actions in installed standalone mode. The desktop
experience (quiet save to Downloads) and Android Chrome experience
are unchanged.

---

## Import flow

1. The operator clicks **Upload `.md`** in any panel that supports
   it (Round Builder, Responses, Mediator, Decision Log,
   Export/Import). The OS file picker opens with the locked accept
   list `.md,.markdown,text/markdown`.
2. The chosen file is read via the standard `File.text()` API
   (UTF-8). No drag-and-drop, no chunked reads, no encoding
   negotiation — single-read, fail-fast.
3. `buildImportPreview(text, state, context?)` runs in five
   stages, all pure:
   1. `splitFrontmatter()` — find the `---` delimiters; if absent
      or malformed, route to Raw Notes.
   2. `validateFrontmatter()` — every required field is the right
      type; `artifact_type` matches the locked namespace; `source_kind`
      is one of the five known values.
   3. `resolveTargetSummary()` — look up the project, round, and
      model in the current AppState. Missing references emit
      `PROJECT_NOT_FOUND` / `ROUND_NOT_FOUND` warnings.
   4. `compareHashes()` — recompute the body's SHA-256 and compare
      to the file's stamped `content_hash`. Mismatch emits
      `CONTENT_HASH_MISMATCH` (file was edited after export). Also
      kicks off async `checkCanonicalStateStaleness` and
      `checkPromptStaleness` for stale-state detection.
   5. Per-source-kind target analysis — `analyzeSynthesisStructure`,
      `analyzeModelResponseTarget`, `analyzeGeneratedPromptTarget`,
      and `analyzeMediatorPacketTarget` each layer their own
      checks on top (locked round? overwrite? model not in roster?).
4. The `ImportPreviewModal` renders the preview. The operator sees:
   - the target description ("Mediator packet for Round 7 of
     project X"),
   - every warning grouped by severity,
   - an Import button (structured commit), an Import as Raw Notes
     button (always present), and a Cancel button.
5. The Import button is **disabled** with a tooltip explaining why
   when any of:
   - the file declares a schema version newer than this app,
   - the artifact_type is unknown,
   - the source_kind is unknown,
   - the target round is locked (`LOCKED_ROUND`),
   - the declared model_id has no slot and isn't selected for the
     round (`MODEL_ID_NOT_IN_ROSTER`),
   - the per-slot Upload `.md` affordance was triggered for a
     mismatched model id (`MODEL_ID_MISMATCH_WITH_SLOT`),
   - the affordance expected one source_kind but the file declares
     another (`SOURCE_KIND_INVALID`).
6. The Import button shows a **two-step "Import anyway"** gate when
   the import would overwrite existing data — `EXISTING_RESPONSE_WILL_BE_OVERWRITTEN`,
   `EXISTING_PROMPT_WILL_BE_OVERWRITTEN`, or `EXISTING_PACKET_WILL_BE_OVERWRITTEN`.
   The first click flips the label to "⚠ Confirm Import"; only the
   second click commits.
7. On commit, `commitStructured(preview, state)` dispatches to the
   right `commit<SourceKind>` handler in `src/utils/importHistory.ts`,
   which:
   - mutates only the named slice (the affected round; one specific
     prompt slot or response slot),
   - preserves the existing response status (a `reviewed` slot
     stays `reviewed`),
   - snapshots the entire pre-import round in `snapshotBefore.round`,
   - appends an `ImportTransaction` to `state.importHistory`,
   - status notice confirms the import with the transaction id tail.

Pre-write storage pressure is projected before commit (see "Storage
pressure" below). At the hard threshold, a `window.confirm` gate
forces explicit operator agency before the commit grows state past
the safe limit.

---

## Raw Notes fallback

The Raw Notes substrate is the universal fallback for any file the
importer can't safely commit:

- **Malformed YAML** (`FRONTMATTER_PARSE_FAILED`) — frontmatter
  delimiters present but YAML inside fails to parse.
- **No frontmatter** (`NO_FRONTMATTER`) — file doesn't start with
  `---\n`.
- **Unknown artifact_type** (`ARTIFACT_TYPE_UNKNOWN`) — frontmatter
  declares a namespace this app doesn't speak.
- **Future schema** (`UNSUPPORTED_SCHEMA_VERSION`) — file declares
  a schema_version newer than this app.
- **Project/round not found** (`PROJECT_NOT_FOUND` / `ROUND_NOT_FOUND`)
  — the file is well-formed but its target IDs don't exist in this
  AppState.
- **Locked round** — the operator can save the body for later
  rather than blocking entirely.
- **Operator choice** — even on a clean import the operator can
  choose Import as Raw Notes instead of structured commit.

Raw Notes are stored as `RawNote` records in `state.rawNotes`:

```ts
RawNote {
  id, createdAt,
  sourceKind?, projectId?, roundId?, originModel?, artifactType?,
  importStatus: 'malformed' | 'unmatched' | 'duplicate' | 'partial' | 'unparseable',
  validationWarnings: ImportValidationWarning[],
  rawBody: string,            // VERBATIM — not normalized
  parsedFrontmatter?: Partial<MarkdownArtifactFrontmatter>,
  siblingIds?: string[],      // reserved for v0.11.1 stitching
}
```

The Raw Notes panel renders them newest-first, expandable, with a
"Copy body" affordance, a "Delete" affordance (with confirmation),
and an inline summary of captured warnings. The buffer is bounded
(see "Storage pressure"). Raw notes are NOT re-importable as
structured artifacts.

---

## Import History

Every structured commit lands an `ImportTransaction` in
`state.importHistory`:

```ts
ImportTransaction {
  id, timestamp,
  sourceArtifactType: MarkdownArtifactSourceKind,
  sourceArtifactId?,    // from frontmatter
  projectId?, roundId?,
  snapshotBefore: {     // the slice we can restore on rollback
    round?, project?, decisions?, rawNoteId?
  },
  changes: ImportChange[],
  rolledBackAt?, rollbackReason?,
}
```

The Import History panel renders the log reverse-chronologically.
Each entry shows the timestamp, source kind, target (project/round),
and a one-line description per change. The rollback button is
enabled only on the **most-recent un-rolled-back transaction**;
older entries' rollback buttons are greyed (cascading rollback is
a v0.11.1 feature — see below).

Rolled-back entries remain visible with a `Rolled back at <time>`
badge. The import history buffer is bounded (50 entries by
default); older entries fall out the back of the ring buffer but
their effects on AppState remain.

---

## Rollback

Most-recent-only, snapshot-based, fully reversible for the slice
that was touched.

When the operator clicks Rollback on the most recent transaction:

1. `rollbackTransaction(transactionId, reason)` runs.
2. The transaction's `snapshotBefore.round` (if any) is restored
   in place of the current round at the same `round.id`. If the
   import added a `RawNote` (`snapshotBefore.rawNoteId`), that
   note is removed. If the import touched a project or decisions,
   those are restored too.
3. The transaction is marked `rolledBackAt: <iso>` and `rollbackReason: <text>`.
4. The Import History panel re-renders with the badge.

The snapshot scope is intentionally narrow — a slice, not the
whole AppState. This keeps `importHistory` small enough to survive
inside `localStorage` even with 50 entries. A full-AppState
snapshot per import would balloon storage and was rejected in the
feasibility plan.

The pre-import body is preserved exactly. So is the pre-import
status (`reviewed`, `excluded`, `copied`). Rolling back an
`EXISTING_RESPONSE_WILL_BE_OVERWRITTEN` import that landed over a
`reviewed` slot restores BOTH the original body AND the `reviewed`
status — the user's prior review judgment isn't lost just because
the body briefly changed.

---

## Storage pressure warning behavior

Locked thresholds in `src/config/markdownHandoff.ts`:

| Threshold              | Value          | Behavior                                                         |
|------------------------|----------------|------------------------------------------------------------------|
| `RAW_NOTES_DEFAULT_CAP`     | 200       | Raw Notes ring buffer cap; older entries pruned on add.          |
| `IMPORT_HISTORY_DEFAULT_CAP`| 50        | Import History ring buffer cap; older entries are non-rollback-able. |
| `STORAGE_WARN_BYTES`        | 3,500,000 | Cosmetic banner — serialized AppState approaches the safe limit. |
| `STORAGE_HARD_BYTES`        | 4,250,000 | Growing operations gated behind explicit `window.confirm`.       |

All four are read-only by the rest of the codebase. Changing any
of them is a deliberate, documented edit; the
`acceptance-walk.ts` smoke test asserts they haven't moved.

The app-shell `StoragePressureBanner` (introduced in Checkpoint
C.5) renders in three levels:

- **warn** — cosmetic; suggests pruning Raw Notes or Import
  History.
- **hard** — past the safe threshold; the same suggestions, more
  urgent tone.
- **error** — the most recent save actually failed
  (`QuotaExceededError`). The in-memory state is ahead of what
  was persisted; the operator should export JSON before reloading.

The pre-commit storage projection (`projectPostWritePressure`) is
called by the upload hook before every structured commit. At the
`hard` level a `window.confirm` is raised; the operator must
explicitly accept the projected pressure, prune state, or cancel
the import. This is the only `window.confirm` in the v0.11.0
import path — the entire surface is otherwise modal-driven.

---

## Known limitations

These are documented behaviors of v0.11.0, not bugs:

1. **No per-prompt-slot Upload `.md`** in RoundBuilderPanel. The
   panel-level Upload `.md` covers prompt imports cleanly because
   frontmatter declares `model_id`. Per-slot affordance is
   deferred (see below).

2. **No decision-log structured import path.** Decision Markdown
   imports route to Raw Notes by design. The Decision Log shape
   (`Decision` records with project/round refs) doesn't currently
   have a corresponding `source_kind`. Deferred.

3. **Most-recent-only rollback.** Cascading rollback (un-doing
   transaction N when N+1..M reference it) requires dependency
   analysis we don't want to ship without rigorous testing.
   Deferred to v0.11.1.

4. **Indented code fences not tracked.** The fence-aware walker
   recognizes only the canonical ` ``` ` and `~~~` (length ≥ 3) at
   the start of a line. A 4-space-indented fenced block is treated
   as plain prose. Rare in practice in mediator output; documented
   in `markdownParse.ts`.

5. **Frontmatter is exactly one block at the top of the file.**
   Multiple frontmatter blocks, or a frontmatter that begins after
   leading whitespace beyond a single BOM, are treated as "no
   frontmatter" and routed to Raw Notes. Aggressive by design —
   tolerant parsers misroute files.

6. **`window.confirm` storage-pressure gate.** **RESOLVED in v0.12.0
   Checkpoint J** — replaced by an in-app `modal.confirm` (see
   `src/components/Modal.tsx`). The gate semantics are unchanged: at
   the hard storage threshold, structured commit and raw-note commit
   both still require explicit operator approval. Only the rendering
   layer changed.

7. **Reviewed/excluded status preservation on import.** This is a
   *feature* per the feasibility plan — a `reviewed` response slot
   stays `reviewed` even when the body is replaced by import. Same
   rule applies to `copied` generated prompts. Rollback restores
   both body and status.

8. **Prompt slots without `canonicalStateHashAtGeneration`.** Pre-
   v0.11.0 prompts (from older AppState data, pre-migration) lack
   the optional `canonicalStateHashAtGeneration` field. Their
   stale-state badge silently skips rather than emitting a false
   positive. The migration does not fabricate the field (per the
   "do not invent substantive content" rule).

---

## Deferred to v0.11.1 and beyond

Not in v0.11.0, candidates for the next minor:

- **Cascading rollback** — un-do transaction N when subsequent
  transactions depend on it.
- **Per-prompt-slot Upload `.md`** in RoundBuilderPanel, mirroring
  the ResponsesPanel per-slot pattern.
- **Decision-log structured import** — currently Raw-Notes-only.
- **Multi-part stitching** — the `part: { index, total }`
  frontmatter field is reserved in v0.11.0 but always emitted as
  `null`. v0.11.1 may stitch large mediator packets that are
  split across multiple files.
- **Sibling discovery** — `RawNote.siblingIds` is a reserved field
  for surfacing notes likely to belong together (same project, same
  round, within ~60s of each other).
- ~~In-style modal to replace the `window.confirm` storage-pressure
  gate.~~ **Delivered in v0.12.0 Checkpoint J.**
- **Raw Notes filter UI** — currently the panel is reverse-
  chronological without filter; a filter by `importStatus` /
  `projectId` / `roundId` is a natural follow-up.

---

## Local-first / security notes

- **No network surfaces introduced.** v0.11.0 adds zero
  `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` /
  `RTCPeerConnection` / `sendBeacon` call sites. The acceptance
  walk's shell grep confirms this; the smoke test reruns the
  ring-buffer and rollback semantics in-process.
- **No backend.** Every artifact is read from and written to the
  operator's local filesystem via the OS file picker. The "no
  backend / no auth / no cloud sync" Phase 0 boundary is intact.
- **`SubtleCrypto` SHA-256 only.** Hashes are computed locally via
  `window.crypto.subtle.digest`. When the context isn't secure
  (`file://`), hashing falls back to `null` and the affected
  staleness checks are silently skipped — the rest of the
  workflow continues to function.
- **YAML is decoded with `js-yaml`'s JSON_SCHEMA.** This is the
  strictest of `js-yaml`'s built-in schemas; it rejects tags,
  custom constructors, and arbitrary scalar coercions.
  `frontmatter.artifact_type` must match the exact locked
  namespace literal; unknown types are routed to Raw Notes.
- **No HTML / JavaScript is executed from imported files.** Bodies
  are stored as strings and rendered only inside `<pre>` blocks or
  the round's textareas. No `dangerouslySetInnerHTML` was added in
  v0.11.0.
- **`generated_by: roundtable` is a trust anchor.** The importer
  doesn't trust unsigned files for anything beyond Raw Notes;
  structured commit requires the locked frontmatter shape AND a
  matching schema_version. Operators can hand-edit a frontmatter
  to change targets, but doing so will trip hash mismatches that
  surface in the preview.

---

## No backend or sync introduced by v0.11.0

This is worth saying twice. v0.11.0 ships:

- A new file-shape contract (`roundtable.markdown.v1`).
- New AppState ring buffers (`rawNotes`, `importHistory`).
- A new migration step (`migrate_0_10_5_to_0_11_0`).
- New UI panels (Raw Notes, Import History) and modal
  (ImportPreviewModal).
- A new upload hook (`useMarkdownUpload`).

It does NOT ship:

- Any new network call site.
- Any new persistence destination beyond `localStorage`.
- Any sync / share / publish surface.
- Any automation hook.
- Any "send to model" path.

Every file moves via the operator's hand. The clipboard workflow
from v0.10.x continues to work unchanged.

---

## Where to read the code

| File                                       | Role                                                |
|--------------------------------------------|-----------------------------------------------------|
| `src/types/markdownArtifact.ts`            | Type definitions (`MarkdownArtifactFrontmatter`, `ImportPreview`, `ImportTransaction`, `RawNote`, all warning codes). |
| `src/config/markdownHandoff.ts`            | Locked constants — caps, thresholds, terminator list, filename prefixes. |
| `src/config/exportFormats.ts`              | `ARTIFACT_TYPE`, `SCHEMA_VERSION`, `APP_VERSION`. |
| `src/utils/markdownNormalize.ts`           | Locked normalization spec (NFC + LF + single trailing newline). |
| `src/utils/markdownHash.ts`                | SHA-256 hashing with `sha256:` prefix; `isHashingAvailable` and `hashesEqual`. |
| `src/utils/markdownParse.ts`               | Frontmatter splitter; code-fence-aware line walker. |
| `src/utils/markdownArtifact.ts`            | `buildArtifact` — the single source of truth for produced files. |
| `src/utils/artifactImport.ts`              | `buildImportPreview` and target analyzers (locked-round, overwrite, model-roster, etc.). |
| `src/utils/importHistory.ts`               | `commitStructured`, `commitAsRawNote`, `rollbackTransaction`, ring-buffer helpers. |
| `src/hooks/useMarkdownUpload.ts`           | The Upload `.md` → preview → commit hook used by every panel that accepts uploads. |
| `src/components/ImportPreviewModal.tsx`    | The modal the operator reviews before commit. |
| `src/components/RawNotesPanel.tsx`         | Raw Notes UI. |
| `src/components/ImportHistoryPanel.tsx`    | Import History + rollback UI. |
| `src/utils/migration.ts`                   | `migrate_0_10_5_to_0_11_0` — defaults `rawNotes` and `importHistory` to `[]` for older states. |
| `scripts/acceptance-walk.ts`               | The 15-criterion acceptance walk smoke test (Checkpoint I). |

For the schema field-by-field reference, see
`docs/SCHEMA_EVOLUTION.md → 0.10.5 → 0.11.0`. For the AppState
shape additions, see `docs/DATA_MODEL.md → v0.11.0 Markdown
Handoff Fields`. For the phase summary, see
`docs/PHASE_HISTORY.md → v0.11.0`. For acceptance criteria, see
`docs/RELEASE_CHECKLIST.md → v0.11.0 Acceptance Walk`.
