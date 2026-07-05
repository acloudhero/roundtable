// src/utils/importHistory.ts
// Purpose: v0.11.0 commit/rollback substrate for Markdown handoff imports.
//
// Owned by:  this file
// Used by:   UI panels that issue imports (via the ImportPreviewModal),
//            ImportHistoryPanel (rollback UI).
//
// Pipeline place:
//   buildImportPreview → user confirms → commitImport (THIS FILE)
//   commitImport packages: pre-import snapshot of the affected slice,
//   the field-level changes, and pushes a new ImportTransaction onto
//   AppState.importHistory.
//
// Rollback granularity (v0.11.0 LOCKED):
//   Most-recent-only. Cascading rollback (rolling back tx N when txs
//   N+1..M reference it) is deferred to v0.11.1 because it requires
//   dependency analysis we don't want to ship without rigorous testing.
//
// Caps:
//   importHistory is a bounded ring buffer (default 50). Older entries
//   stay visible but their rollback button is disabled.
//   rawNotes is bounded too (default 200) — see addRawNote / pruning.
//
// Snapshot strategy:
//   We snapshot ONLY the slice we're about to modify: the affected round,
//   the affected project (if any), and any decision touched. This keeps
//   the importHistory footprint bounded. A full-AppState snapshot would
//   explode the localStorage size and was rejected in the feasibility
//   doc.
//
// This file produces pure functional updates suitable for onUpdate via
// the existing updateRoundFunctional pattern in roundUtils. Components
// dispatch the result; this file never writes to localStorage directly.

import { AppState, AppStateUpdater } from '../types/appState';
import {
  BuiltArtifact,
  ImportChange,
  ImportPreview,
  ImportSnapshotSlice,
  ImportTransaction,
  RawNote,
  MarkdownArtifactFrontmatter,
} from '../types/markdownArtifact';
import { Round, ModelResponse } from '../types/round';
import { Decision } from '../types/decision';
import {
  IMPORT_HISTORY_DEFAULT_CAP,
  RAW_NOTES_DEFAULT_CAP,
} from '../config/markdownHandoff';
import { generateSafeId } from './id';
import { nowIso } from './dateTime';
import { rawNoteFromPreview } from './artifactImport';
import { extractMediatorSections } from './mediatorExtract';

// ── Commit result type ──────────────────────────────────────────────────────

export interface CommitResult {
  /** Functional updater the caller passes to onUpdate. Always populated. */
  updater: AppStateUpdater;
  /** The transaction that was appended (the caller may want to surface it
   *  to the user as "import succeeded — undo available"). */
  transaction: ImportTransaction;
  /** True if the commit pruned older transactions from history. */
  prunedHistory: boolean;
  /** True if the commit pruned older raw notes from the buffer. */
  prunedRawNotes: boolean;
}

// ── Public: import-as-raw ───────────────────────────────────────────────────

/**
 * Commit a Raw Note path. Used when the user picks "Import as Raw Notes"
 * at the preview gate, OR when any other path falls through to this
 * fallback (malformed file, unsupported schema, etc).
 *
 * Produces an ImportTransaction whose `snapshotBefore.rawNoteId` is the
 * id of the new raw note — rollback removes it.
 */
export function commitAsRawNote(preview: ImportPreview): CommitResult {
  const note = rawNoteFromPreview(preview);
  const fm = preview.frontmatter ?? {};
  const tx: ImportTransaction = {
    id: generateSafeId('import'),
    timestamp: nowIso(),
    sourceArtifactType: fm.source_kind ?? 'raw_notes',
    sourceArtifactId: fm.artifact_id ?? undefined,
    projectId: fm.project_id ?? undefined,
    roundId: fm.round_id ?? undefined,
    snapshotBefore: {
      rawNoteId: note.id,
    },
    changes: [
      {
        kind: 'raw_note_added',
        description: `Saved as Raw Note (status: ${note.importStatus}).`,
        path: `rawNotes[${note.id}]`,
      },
    ],
  };

  const updater: AppStateUpdater = (prev) => {
    const nextRawNotes = pruneToCap([...prev.rawNotes, note], RAW_NOTES_DEFAULT_CAP);
    const nextHistory = pruneToCap([...prev.importHistory, tx], IMPORT_HISTORY_DEFAULT_CAP);
    return {
      rawNotes: nextRawNotes,
      importHistory: nextHistory,
    };
  };

  return {
    updater,
    transaction: tx,
    prunedHistory: false, // computed in the updater; we don't know here.
    prunedRawNotes: false,
  };
}

// ── Public: structured commit ───────────────────────────────────────────────

/**
 * Commit a structured Markdown handoff artifact (source_kind !=
 * raw_notes). The function selects the right commit strategy based on
 * source_kind. Returns a functional updater the caller passes to onUpdate.
 *
 * Behavior per source_kind:
 *   - generated_prompt    : replace-or-append the prompt slot on the round.
 *                           Snapshot the round before.
 *   - model_response      : replace-or-append the response slot for the
 *                           model on the round. Snapshot the round before.
 *   - mediator_packet     : set round.mediatorPrompt to the body.
 *                           Snapshot the round before.
 *   - mediator_synthesis  : run extractMediatorSections on the body, set
 *                           round.mediatorSynthesis. Snapshot the round
 *                           before.
 *   - raw_notes           : routed via commitAsRawNote (do not call this
 *                           function for raw_notes; we throw if it slips
 *                           through, since the preview gate would not
 *                           offer commit for raw_notes).
 *
 * Note: this function does NOT auto-apply the canonical state update or
 * lock a round. Canonical state updates remain an explicit user action
 * in DecisionLogPanel — Markdown Handoff Mode imports never bypass that
 * gate.
 */
export function commitStructured(
  preview: ImportPreview,
  state: AppState
): CommitResult {
  const fm = preview.frontmatter;
  if (!fm || !fm.source_kind) {
    // Defensive: should never happen — preview.commit isn't offered when
    // frontmatter is unusable. Route to Raw Notes.
    return commitAsRawNote(preview);
  }
  if (fm.source_kind === 'raw_notes') {
    // Same defensive fallback.
    return commitAsRawNote(preview);
  }

  const targetRound = fm.round_id
    ? state.rounds.find((r) => r.id === fm.round_id) ?? null
    : null;

  // If round is required but missing, route to Raw Notes. This shouldn't
  // happen — preview already routes to import_as_raw — but defensive.
  if (!targetRound) {
    return commitAsRawNote(preview);
  }

  switch (fm.source_kind) {
    case 'generated_prompt':
      // v0.11.0 Checkpoint H: state passed through so
      // commitGeneratedPrompt can resolve the model's display name
      // from state.modelProfiles when appending a brand-new slot,
      // and so the change description can reference the existing
      // slot for overwrite-aware messaging.
      return commitGeneratedPrompt(preview, fm, targetRound, state);
    case 'model_response':
      // v0.11.0 Checkpoint G: state passed through so commitModelResponse
      // can resolve the model's display name from state.modelProfiles
      // when appending a brand-new slot.
      return commitModelResponse(preview, fm, targetRound, state);
    case 'mediator_packet':
      return commitMediatorPacket(preview, fm, targetRound);
    case 'mediator_synthesis':
      return commitMediatorSynthesis(preview, fm, targetRound);
    default: {
      const _exhaust: never = fm.source_kind;
      throw new Error(`Unhandled commit source_kind: ${String(_exhaust)}`);
    }
  }
}

// ── Per-source-kind commit strategies ──────────────────────────────────────

function commitGeneratedPrompt(
  preview: ImportPreview,
  fm: Partial<MarkdownArtifactFrontmatter>,
  round: Round,
  // v0.11.0 Checkpoint H: state threaded through so upsertGeneratedPrompt
  // can resolve modelDisplayName from state.modelProfiles when appending
  // a brand-new slot.
  state: AppState
): CommitResult {
  // Generated prompt artifacts carry the prompt body in their Markdown
  // body. The exporter wraps the prompt text in dynamic-tilde fences and
  // a `## Prompt Text` heading. To round-trip cleanly, we look for the
  // fenced block following that heading. If not found, fall back to the
  // whole body.
  const extractedText = extractFencedSection(preview.body, /^##\s+Prompt Text\s*$/m) ?? preview.body.trim();

  // v0.11.0 Checkpoint H: overwrite-aware change description, matching
  // the pattern used by commitModelResponse.
  const modelId = fm.model_id ?? '';
  const existingSlot = round.generatedPrompts.find((p) => p.modelProfileId === modelId);
  const changeDescription = existingSlot
    ? `Imported generated prompt for ${existingSlot.modelDisplayName || modelId} ` +
      `(overwrote existing ${existingSlot.promptText.length.toLocaleString()}-char text, ` +
      `status ${existingSlot.status} preserved).`
    : `Imported new generated prompt for ${fm.model_id ?? 'model'}.`;

  const updated: Round = {
    ...round,
    generatedPrompts: upsertGeneratedPrompt(round, fm, extractedText, state),
    updatedAt: nowIso(),
  };

  const tx = makeTransaction(fm, {
    snapshotBefore: { round },
    changes: [{
      kind: 'round_prompt_set',
      description: changeDescription,
      path: `rounds[${round.id}].generatedPrompts`,
    }],
  });

  return makeCommit(tx, (prev) => {
    const idx = prev.rounds.findIndex((r) => r.id === round.id);
    if (idx === -1) {
      // Race: round was deleted between preview build and commit. Route to
      // Raw Notes via a fresh commit. Inline this as a no-op to keep the
      // outer flow happy; the caller should re-fetch.
      return { importHistory: appendCapped(prev.importHistory, tx, IMPORT_HISTORY_DEFAULT_CAP) };
    }
    const nextRounds = [...prev.rounds];
    nextRounds[idx] = updated;
    return {
      rounds: nextRounds,
      importHistory: appendCapped(prev.importHistory, tx, IMPORT_HISTORY_DEFAULT_CAP),
    };
  });
}

function commitModelResponse(
  preview: ImportPreview,
  fm: Partial<MarkdownArtifactFrontmatter>,
  round: Round,
  // v0.11.0 Checkpoint G: state is threaded through so we can resolve
  // the model's displayName from state.modelProfiles when appending a
  // brand-new response slot. Existing slots keep their stored
  // displayName regardless.
  state: AppState
): CommitResult {
  // Same shape as generated_prompt: a `## Response Text` heading wraps
  // the body. Fall back to the whole body if the heading is missing.
  const extractedText = extractFencedSection(preview.body, /^##\s+Response Text\s*$/m) ?? preview.body.trim();

  // v0.11.0 Checkpoint G: compute the change description with the
  // existing slot's status so the Import History entry says "overwrote
  // existing" rather than generic "imported response".
  const modelId = fm.model_id ?? '';
  const existingSlot = round.modelResponses.find((r) => r.modelProfileId === modelId);
  const changeDescription = existingSlot
    ? `Imported response from ${existingSlot.modelDisplayName || modelId} ` +
      `(overwrote existing ${existingSlot.responseText.length.toLocaleString()}-char body, ` +
      `status ${existingSlot.status} preserved).`
    : `Imported new response from ${fm.model_id ?? 'model'}.`;

  const updated: Round = {
    ...round,
    modelResponses: upsertModelResponse(round, fm, extractedText, state),
    updatedAt: nowIso(),
  };

  const tx = makeTransaction(fm, {
    snapshotBefore: { round },
    changes: [{
      kind: 'round_response_set',
      description: changeDescription,
      path: `rounds[${round.id}].modelResponses`,
    }],
  });

  return makeCommit(tx, (prev) => {
    const idx = prev.rounds.findIndex((r) => r.id === round.id);
    if (idx === -1) {
      return { importHistory: appendCapped(prev.importHistory, tx, IMPORT_HISTORY_DEFAULT_CAP) };
    }
    const nextRounds = [...prev.rounds];
    nextRounds[idx] = updated;
    return {
      rounds: nextRounds,
      importHistory: appendCapped(prev.importHistory, tx, IMPORT_HISTORY_DEFAULT_CAP),
    };
  });
}

function commitMediatorPacket(
  preview: ImportPreview,
  fm: Partial<MarkdownArtifactFrontmatter>,
  round: Round
): CommitResult {
  // The mediator packet body is the entire body content (minus the
  // exporter's `# Mediator Packet — ...` H1 wrapper). We use the body as-is
  // since downstream code consumes it as text. Strip the H1 if present.
  const body = stripLeadingH1(preview.body);

  // v0.11.0 Checkpoint H: overwrite-aware change description.
  const hadExistingPacket = round.mediatorPrompt && round.mediatorPrompt.trim().length > 0;
  const changeDescription = hadExistingPacket
    ? `Imported mediator packet into Round ${round.roundNumber} ` +
      `(overwrote existing ${round.mediatorPrompt.length.toLocaleString()}-char packet).`
    : `Imported mediator packet into Round ${round.roundNumber}.`;

  const updated: Round = {
    ...round,
    mediatorPrompt: body,
    updatedAt: nowIso(),
  };
  const tx = makeTransaction(fm, {
    snapshotBefore: { round },
    changes: [{
      kind: 'round_field_set',
      description: changeDescription,
      path: `rounds[${round.id}].mediatorPrompt`,
    }],
  });
  return makeCommit(tx, (prev) => {
    const idx = prev.rounds.findIndex((r) => r.id === round.id);
    if (idx === -1) {
      return { importHistory: appendCapped(prev.importHistory, tx, IMPORT_HISTORY_DEFAULT_CAP) };
    }
    const nextRounds = [...prev.rounds];
    nextRounds[idx] = updated;
    return {
      rounds: nextRounds,
      importHistory: appendCapped(prev.importHistory, tx, IMPORT_HISTORY_DEFAULT_CAP),
    };
  });
}

function commitMediatorSynthesis(
  preview: ImportPreview,
  fm: Partial<MarkdownArtifactFrontmatter>,
  round: Round
): CommitResult {
  // Run the fence-aware structured-synthesis parser. We save the raw body
  // to mediatorResponse so the user can still see/edit, AND populate the
  // structured fields. NEITHER auto-applies canonical state.
  const { synthesis } = extractMediatorSections(preview.body);
  const updated: Round = {
    ...round,
    mediatorResponse: preview.body,
    mediatorSynthesis: { ...synthesis, updatedAt: nowIso() },
    updatedAt: nowIso(),
  };
  const tx = makeTransaction(fm, {
    snapshotBefore: { round },
    changes: [
      {
        kind: 'round_synthesis_set',
        description: 'Imported mediator synthesis fields from artifact.',
        path: `rounds[${round.id}].mediatorSynthesis`,
      },
      {
        kind: 'round_field_set',
        description: 'Imported raw mediator body into round.mediatorResponse.',
        path: `rounds[${round.id}].mediatorResponse`,
      },
    ],
  });
  return makeCommit(tx, (prev) => {
    const idx = prev.rounds.findIndex((r) => r.id === round.id);
    if (idx === -1) {
      return { importHistory: appendCapped(prev.importHistory, tx, IMPORT_HISTORY_DEFAULT_CAP) };
    }
    const nextRounds = [...prev.rounds];
    nextRounds[idx] = updated;
    return {
      rounds: nextRounds,
      importHistory: appendCapped(prev.importHistory, tx, IMPORT_HISTORY_DEFAULT_CAP),
    };
  });
}

// ── Rollback ────────────────────────────────────────────────────────────────

/**
 * Rollback granularity for v0.11.0: most-recent-only. Returns a functional
 * updater that restores the pre-import slice from the snapshot and marks
 * the transaction `rolledBackAt`. Newer transactions cannot be rolled back
 * — the history UI greys their button.
 *
 * If the supplied transactionId is not the most recent un-rolled-back
 * transaction, this function returns a no-op updater. UI must check
 * `canRollback(state, transactionId)` before calling.
 */
export function rollbackTransaction(
  transactionId: string,
  reason: string
): AppStateUpdater {
  return (prev: AppState): Partial<AppState> => {
    if (!canRollback(prev, transactionId)) return {};

    const tx = prev.importHistory.find((t) => t.id === transactionId);
    if (!tx) return {};
    if (tx.rolledBackAt) return {};

    const snap = tx.snapshotBefore;

    let nextRounds = prev.rounds;
    if (snap.round) {
      // Restore the snapshotted round if it still exists, otherwise add it
      // back (the import may have created it — though v0.11.0 doesn't, this
      // is forward-proofing).
      const idx = prev.rounds.findIndex((r) => r.id === snap.round!.id);
      if (idx >= 0) {
        nextRounds = [...prev.rounds];
        nextRounds[idx] = snap.round;
      } else {
        nextRounds = [...prev.rounds, snap.round];
      }
    }

    let nextProjects = prev.projects;
    if (snap.project) {
      const idx = prev.projects.findIndex((p) => p.id === snap.project!.id);
      if (idx >= 0) {
        nextProjects = [...prev.projects];
        nextProjects[idx] = snap.project;
      }
    }

    let nextDecisions = prev.decisions;
    if (snap.decisions && snap.decisions.length > 0) {
      // Restore each snapshotted decision by id.
      const map = new Map(snap.decisions.map((d) => [d.id, d]));
      nextDecisions = prev.decisions.map((d) => map.get(d.id) ?? d);
      // Decisions present in the snapshot but absent now → re-add.
      for (const d of snap.decisions) {
        if (!nextDecisions.some((x) => x.id === d.id)) nextDecisions = [...nextDecisions, d];
      }
    }

    let nextRawNotes = prev.rawNotes;
    if (snap.rawNoteId) {
      nextRawNotes = prev.rawNotes.filter((n) => n.id !== snap.rawNoteId);
    }

    const nextHistory = prev.importHistory.map((t) =>
      t.id === transactionId
        ? { ...t, rolledBackAt: nowIso(), rollbackReason: reason }
        : t
    );

    return {
      rounds: nextRounds,
      projects: nextProjects,
      decisions: nextDecisions,
      rawNotes: nextRawNotes,
      importHistory: nextHistory,
    };
  };
}

/**
 * True iff the transaction is the most recent un-rolled-back transaction
 * in importHistory. Cascading rollback is a v0.11.1 feature.
 */
export function canRollback(state: AppState, transactionId: string): boolean {
  const liveTxs = state.importHistory.filter((t) => !t.rolledBackAt);
  if (liveTxs.length === 0) return false;
  const mostRecent = liveTxs[liveTxs.length - 1];
  return mostRecent.id === transactionId;
}

// ── Pruning ─────────────────────────────────────────────────────────────────

/** Prune a list to at most `cap` entries by dropping the oldest. */
function pruneToCap<T>(arr: T[], cap: number): T[] {
  if (arr.length <= cap) return arr;
  return arr.slice(arr.length - cap);
}

/** Append + prune. Centralized so commit handlers all share semantics. */
function appendCapped<T>(arr: T[], item: T, cap: number): T[] {
  return pruneToCap([...arr, item], cap);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTransaction(
  fm: Partial<MarkdownArtifactFrontmatter>,
  partial: { snapshotBefore: ImportSnapshotSlice; changes: ImportChange[] }
): ImportTransaction {
  return {
    id: generateSafeId('import'),
    timestamp: nowIso(),
    sourceArtifactType: fm.source_kind ?? 'raw_notes',
    sourceArtifactId: fm.artifact_id ?? undefined,
    projectId: fm.project_id ?? undefined,
    roundId: fm.round_id ?? undefined,
    snapshotBefore: partial.snapshotBefore,
    changes: partial.changes,
  };
}

function makeCommit(tx: ImportTransaction, updater: AppStateUpdater): CommitResult {
  return {
    updater,
    transaction: tx,
    prunedHistory: false,
    prunedRawNotes: false,
  };
}

// ── Helpers: prompt/response upsert ─────────────────────────────────────────

function upsertGeneratedPrompt(
  round: Round,
  fm: Partial<MarkdownArtifactFrontmatter>,
  promptText: string,
  // v0.11.0 Checkpoint H: used to resolve modelDisplayName when
  // appending a brand-new slot (existing slots keep their stored
  // displayName).
  state: AppState
) {
  const modelId = fm.model_id ?? '';
  const existing = round.generatedPrompts.find((p) => p.modelProfileId === modelId);
  if (existing) {
    return round.generatedPrompts.map((p) =>
      p.modelProfileId === modelId
        ? {
            ...p,
            promptText,
            generatedAt: nowIso(),
            // Status preserved by the spread (matches the model_response
            // pattern: human judgments like 'copied' shouldn't be undone
            // by an import). Hash-from-frontmatter is preserved when
            // present so the next export can re-stamp the same hash for
            // reproducible diffs.
            ...(fm.canonical_state_hash
              ? { canonicalStateHashAtGeneration: fm.canonical_state_hash }
              : {}),
          }
        : p
    );
  }
  // New slot: resolve display name from state.modelProfiles when
  // possible. Falls back to the raw model_id only when the model isn't
  // in the live roster. analyzeGeneratedPromptTarget already warned
  // about that case via MODEL_ID_NOT_IN_ROSTER and the deferred-reason
  // gate blocks the commit; but if a future code path bypasses the
  // gate, this fallback prevents an empty modelDisplayName from being
  // persisted.
  const profile = state.modelProfiles.find((m) => m.id === modelId);
  return [
    ...round.generatedPrompts,
    {
      id: generateSafeId('prompt-import'),
      modelProfileId: modelId,
      modelDisplayName: profile?.displayName ?? modelId,
      promptText,
      generatedAt: nowIso(),
      status: 'generated' as const,
      ...(fm.canonical_state_hash
        ? { canonicalStateHashAtGeneration: fm.canonical_state_hash }
        : {}),
    },
  ];
}

function upsertModelResponse(
  round: Round,
  fm: Partial<MarkdownArtifactFrontmatter>,
  responseText: string,
  // v0.11.0 Checkpoint G: used to resolve modelDisplayName when
  // appending a brand-new slot (existing slots keep their stored
  // displayName).
  state: AppState
): ModelResponse[] {
  const modelId = fm.model_id ?? '';
  const existing = round.modelResponses.find((r) => r.modelProfileId === modelId);
  if (existing) {
    return round.modelResponses.map((r) =>
      r.modelProfileId === modelId
        ? {
            ...r,
            responseText,
            pastedAt: nowIso(),
            // v0.11.0 Checkpoint G: preserve the user's existing
            // reviewed/excluded status. Markdown import refreshes the
            // body but should not undo a human review judgment that
            // was already on the slot. Brand-new slots default to
            // 'pasted' below.
            status: r.status,
          }
        : r
    );
  }
  // New slot: resolve display name from state.modelProfiles when
  // possible. Falls back to the raw model_id only when the model isn't
  // in the live roster (which the preview already warned about via
  // MODEL_ID_NOT_IN_ROSTER — but commitStructured allows it through
  // for the case where round.selectedModelIds included the id but no
  // response was ever pasted).
  const profile = state.modelProfiles.find((m) => m.id === modelId);
  return [
    ...round.modelResponses,
    {
      id: generateSafeId('resp-import'),
      modelProfileId: modelId,
      modelDisplayName: profile?.displayName ?? modelId,
      responseText,
      pastedAt: nowIso(),
      status: 'pasted' as const,
    },
  ];
}

// ── Body section extraction ─────────────────────────────────────────────────

/** Strip a leading `# ...` H1 line from a body if present. Used by
 *  mediator-packet commit so we don't double-wrap the persisted text. */
function stripLeadingH1(body: string): string {
  const lf = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = lf.split('\n');
  if (lines.length === 0) return body;
  if (/^#\s+/.test(lines[0])) {
    // Drop the H1 and any subsequent blank/italic-metadata line.
    let i = 1;
    while (i < lines.length && (lines[i].trim() === '' || /^_/.test(lines[i].trim()))) i++;
    return lines.slice(i).join('\n');
  }
  return body;
}

/**
 * Find a fenced block ( ``` or ~~~, length >= 3 ) immediately following a
 * line that matches `headingRe`. Returns the inner content (excluding the
 * opening and closing fence lines) or null if not found.
 *
 * Used to extract the prompt text from a generated_prompt artifact body
 * (which wraps with `## Prompt Text` + dynamic tilde fence).
 */
function extractFencedSection(body: string, headingRe: RegExp): string | null {
  const lf = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = lf.split('\n');
  let foundHeadingAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRe.test(lines[i])) {
      foundHeadingAt = i;
      break;
    }
  }
  if (foundHeadingAt === -1) return null;

  // Find the next fence opener.
  let openAt = -1;
  let fenceChar: '`' | '~' | null = null;
  let fenceLen = 0;
  for (let i = foundHeadingAt + 1; i < lines.length; i++) {
    const m = /^(`{3,}|~{3,})/.exec(lines[i].trim());
    if (m) {
      openAt = i;
      fenceChar = m[1][0] as '`' | '~';
      fenceLen = m[1].length;
      break;
    }
  }
  if (openAt === -1 || fenceChar === null) return null;

  const closingRe = new RegExp('^' + (fenceChar === '`' ? '`' : '~') + `{${fenceLen},}$`);
  let closeAt = -1;
  for (let i = openAt + 1; i < lines.length; i++) {
    if (closingRe.test(lines[i].trim())) {
      closeAt = i;
      break;
    }
  }
  if (closeAt === -1) {
    // Unclosed fence — return the rest of the body so we don't silently
    // truncate the prompt text. The UNCLOSED_CODE_FENCE warning is
    // emitted upstream.
    return lines.slice(openAt + 1).join('\n');
  }
  return lines.slice(openAt + 1, closeAt).join('\n');
}

// ── Public: add a raw note directly (for "Save as Raw Note" actions) ───────
//
// Used by the manual "Save current text as a raw note" flow if/when added.
// Not invoked by the import pipeline (which goes through commitAsRawNote).

export function addRawNote(note: RawNote): AppStateUpdater {
  return (prev: AppState): Partial<AppState> => ({
    rawNotes: pruneToCap([...prev.rawNotes, note], RAW_NOTES_DEFAULT_CAP),
  });
}

export function removeRawNote(noteId: string): AppStateUpdater {
  return (prev: AppState): Partial<AppState> => ({
    rawNotes: prev.rawNotes.filter((n) => n.id !== noteId),
  });
}
