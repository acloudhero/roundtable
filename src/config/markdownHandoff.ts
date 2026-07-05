// src/config/markdownHandoff.ts
// Purpose: Locked v0.11.0 constants for Markdown Handoff Mode — ring-buffer
//          caps, storage-pressure thresholds, file-picker accept lists.
// Owned by:  this file
// Used by:   utils/storagePressure, utils/artifactImport, utils/importHistory,
//            UI components.
//
// These constants are *locked* for v0.11.0 — changing them must be a
// deliberate, documented edit, surfaced in CHANGELOG/SCHEMA_EVOLUTION. The
// design relies on the user being able to see exactly what was preserved
// and what was pruned at each boundary.

// ── Ring-buffer caps ─────────────────────────────────────────────────────────

/** Maximum number of Raw Notes kept in AppState. Older notes are pruned
 *  (with a banner in the UI before discard). Defaults match the Q14
 *  decision in the v0.11.0 feasibility doc. */
export const RAW_NOTES_DEFAULT_CAP = 200;

/** Maximum number of Import Transactions kept in AppState. Older
 *  transactions remain visible in the history but cannot be rolled back. */
export const IMPORT_HISTORY_DEFAULT_CAP = 50;

// ── Storage-pressure thresholds (Gemini amendment) ──────────────────────────
//
// localStorage limits are browser-dependent (typically 5 MB per origin).
// We measure the serialized AppState byte length and surface two thresholds:
//
//   - WARN: cosmetic banner; user has time to clean up.
//   - HARD: any operation that would *grow* state (Raw Notes / Import
//           History additions) is blocked behind explicit user agency:
//             - download the raw content from the failed import,
//             - prune Raw Notes / Import History,
//             - re-attempt the save.
//
// We never silently fail a write. localStorage.setItem throwing
// QuotaExceededError is the absolute worst case; we catch it and route to
// the same agency UI.

/** Soft warning threshold for serialized AppState size in bytes. Picked
 *  well below the typical 5 MB limit so the warning is actionable, not
 *  panic-inducing. */
export const STORAGE_WARN_BYTES = 3_500_000; // ~3.34 MB

/** Hard warning threshold. Operations that would grow state beyond this
 *  size must surface the cleanup UI; the user must explicitly take an
 *  action (prune, download, or accept) to proceed. */
export const STORAGE_HARD_BYTES = 4_250_000; // ~4.05 MB

// ── File picker ──────────────────────────────────────────────────────────────

/** The locked accept list for the upload-.md file picker. Includes both
 *  common extensions and the MIME type so OS file dialogs filter
 *  correctly on every major platform. */
export const MARKDOWN_FILE_ACCEPT = '.md,.markdown,text/markdown';

// ── Truncation heuristic ─────────────────────────────────────────────────────

/** When the last non-blank line of a body doesn't end with one of these
 *  characters, we suspect truncation. Tunable per the v0.11.0 feasibility
 *  doc; conservative by design. */
export const TRUNCATION_TERMINATORS = ['.', '!', '?', ')', ']', '>', '`', '"', "'", '”', '’', '】', '。'];

// ── Filename prefixes ────────────────────────────────────────────────────────

/** Stable filename prefix per source_kind. The full filename is composed
 *  by markdownArtifact.filenameFor(). */
export const FILENAME_PREFIXES: Record<string, string> = {
  generated_prompt:   'RT_PROMPT',
  model_response:     'RT_RESPONSE',
  mediator_packet:    'RT_MEDIATOR_PACKET',
  mediator_synthesis: 'RT_MEDIATOR_SYNTHESIS',
  raw_notes:          'RT_RAW_NOTES',
};
