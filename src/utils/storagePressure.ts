// src/utils/storagePressure.ts
// Purpose: localStorage byte-size pressure guard for AppState saves.
//          Gemini amendment (v0.11.0): Raw Notes and Import History snapshots
//          can grow large quickly. Without explicit pressure tracking, a
//          single malformed import could push AppState past the browser's
//          localStorage quota and corrupt persistence.
//
// Owned by:  this file
// Used by:   storage/localStorageAdapter (every save), utils/artifactImport
//            (commit gate guard), UI components (banner display).
//
// Pressure model (locked v0.11.0):
//
//   - WARN: serialized AppState >= STORAGE_WARN_BYTES → cosmetic banner.
//   - HARD: serialized AppState >= STORAGE_HARD_BYTES → block growing
//           operations until the user prunes or accepts.
//
// "Never silently fail a save":
//   - Saves are attempted regardless of warning state. The warning is
//     informational, not a block on saves of *existing* state.
//   - The HARD threshold blocks operations that *grow* state (new Raw
//     Notes, new Import Transactions). The user has explicit agency:
//     prune the old data, download the raw content of the failing import,
//     or override.
//   - If localStorage.setItem throws QuotaExceededError, the adapter
//     surfaces a recoverable failure to the UI rather than crashing.
//
// All functions are pure (no side effects) except where the adapter
// integration explicitly performs storage operations.

import { AppState } from '../types/appState';
import { STORAGE_WARN_BYTES, STORAGE_HARD_BYTES } from '../config/markdownHandoff';

// ── Public types ─────────────────────────────────────────────────────────────

export type StoragePressureLevel = 'ok' | 'warn' | 'hard';

export interface StoragePressureReport {
  level: StoragePressureLevel;
  /** Byte length of JSON.stringify(state). */
  bytes: number;
  /** Same value, formatted for UI display. */
  bytesHuman: string;
  /** True when level is 'hard' — growing operations are blocked. */
  blockGrowingOps: boolean;
  /** Per-collection size breakdown to help the user choose what to prune. */
  breakdown: {
    rawNotesBytes: number;
    importHistoryBytes: number;
    roundsBytes: number;
    otherBytes: number;
  };
  /** Human-readable headline message. Empty for 'ok'. */
  message: string;
}

// ── Estimation ───────────────────────────────────────────────────────────────

/**
 * Compute a storage-pressure report for the given AppState.
 *
 * The byte-size estimate uses TextEncoder against JSON.stringify(state),
 * which is what localStorageAdapter actually writes — so the estimate
 * matches the on-disk cost within a few bytes.
 *
 * NOTE: This is a *projection*, not a measurement of localStorage usage.
 * Other origins, other keys, or the browser's own overhead may add to the
 * real footprint. The two thresholds are picked conservatively for that
 * reason.
 */
export function reportStoragePressure(state: AppState): StoragePressureReport {
  // Serialize once for the headline number.
  const fullJson = safeStringify(state);
  const bytes = byteLength(fullJson);

  // Per-collection breakdown — separately stringify the parts the user can
  // prune. Stringifying a few arrays is cheap and gives them an actionable
  // breakdown when they hit the warning.
  const rawNotesBytes = byteLength(safeStringify(state.rawNotes ?? []));
  const importHistoryBytes = byteLength(safeStringify(state.importHistory ?? []));
  const roundsBytes = byteLength(safeStringify(state.rounds ?? []));
  const otherBytes = Math.max(0, bytes - rawNotesBytes - importHistoryBytes - roundsBytes);

  let level: StoragePressureLevel = 'ok';
  if (bytes >= STORAGE_HARD_BYTES) level = 'hard';
  else if (bytes >= STORAGE_WARN_BYTES) level = 'warn';

  let message = '';
  if (level === 'warn') {
    message =
      `Storage size is approaching the safe limit (${formatBytes(bytes)} of ~${formatBytes(STORAGE_HARD_BYTES)}). ` +
      `Consider pruning old Raw Notes (${formatBytes(rawNotesBytes)}) or Import History (${formatBytes(importHistoryBytes)}).`;
  } else if (level === 'hard') {
    message =
      `Storage size has exceeded the safe limit (${formatBytes(bytes)}). New imports that would grow state are paused. ` +
      `Prune Raw Notes (${formatBytes(rawNotesBytes)}) or Import History (${formatBytes(importHistoryBytes)}), download pending content for safekeeping, then retry.`;
  }

  return {
    level,
    bytes,
    bytesHuman: formatBytes(bytes),
    blockGrowingOps: level === 'hard',
    breakdown: { rawNotesBytes, importHistoryBytes, roundsBytes, otherBytes },
    message,
  };
}

/**
 * Predict the post-write pressure for an arbitrary delta added to AppState
 * by an import. Used at the commit gate so the user can see *before*
 * pressing Import whether the operation will trigger the hard threshold.
 *
 * `extraBytes` should be a conservative estimate (use byteLength()
 * against the JSON.stringify of the proposed delta).
 */
export function projectPostWritePressure(
  state: AppState,
  extraBytes: number
): StoragePressureReport {
  // Cheap projection: stringify once, add extraBytes to the headline,
  // recompute level. The breakdown is the current breakdown; the projected
  // headline tells the user "if you commit this, here's the result".
  const current = reportStoragePressure(state);
  const projectedBytes = current.bytes + Math.max(0, extraBytes);

  let level: StoragePressureLevel = 'ok';
  if (projectedBytes >= STORAGE_HARD_BYTES) level = 'hard';
  else if (projectedBytes >= STORAGE_WARN_BYTES) level = 'warn';

  let message = '';
  if (level === 'warn') {
    message =
      `Committing this would push storage to ${formatBytes(projectedBytes)} ` +
      `(warning at ${formatBytes(STORAGE_WARN_BYTES)}, hard limit ${formatBytes(STORAGE_HARD_BYTES)}).`;
  } else if (level === 'hard') {
    message =
      `Committing this would push storage to ${formatBytes(projectedBytes)} — past the hard limit ` +
      `(${formatBytes(STORAGE_HARD_BYTES)}). The commit is paused. Either prune existing data, download the import body ` +
      `for safekeeping, or choose Import as Raw Notes (smaller footprint than a full snapshot).`;
  }

  return {
    ...current,
    bytes: projectedBytes,
    bytesHuman: formatBytes(projectedBytes),
    level,
    blockGrowingOps: level === 'hard',
    message,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function byteLength(s: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(s).length;
  }
  // Fallback approximate — not expected in modern browsers.
  return s.length * 2;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}
