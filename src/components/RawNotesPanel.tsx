// src/components/RawNotesPanel.tsx
// Purpose: v0.11.0 Markdown Handoff Mode — display the AppState.rawNotes
//          fallback substrate. Raw Notes is the universal fallback for
//          imports that cannot safely commit as authoritative artifacts.
//
// Checkpoint B scope (UI shell):
//   - Read-only list view of state.rawNotes.
//   - Expandable rows show the verbatim body in a plain <pre> and the
//     validation warnings captured when the note was saved.
//   - "Copy body" button per row (uses existing clipboard utility).
//   - No re-import affordance (Raw Notes are not re-importable by
//     design — locked Q14 decision; see feasibility doc).
//
// Checkpoint I addition:
//   - "Delete" affordance per row. The removeRawNote helper has
//     existed in utils/importHistory.ts since Checkpoint B; wiring
//     it here is a small, localized change behind a confirm gate.
//     Does NOT affect import behavior. No batch delete (a future
//     checkpoint can layer one on if usage indicates the need).
//
// Design rules carried over from the v0.11.0 feasibility doc:
//   - Bounded ring buffer (RAW_NOTES_DEFAULT_CAP = 200). Display the
//     count next to the panel title so the user always knows how full
//     the buffer is.
//   - Filter affordance is OUT of scope — it's listed as a v0.11.x
//     follow-up. For now, the list is reverse-chronological
//     (newest at the top).
//   - Status badge color follows the locked severity convention:
//       malformed   → red
//       unmatched   → amber
//       duplicate   → muted
//       partial     → amber
//       unparseable → red
//
// Owned by: this file
// Used by:  App.tsx (registered as the 'raw-notes' tab in Checkpoint B).

import { useState } from 'react';
import { AppState, AppStateUpdater } from '../types/appState';
import {
  RawNote,
  RawNoteImportStatus,
  ImportValidationWarning,
} from '../types/markdownArtifact';
import { copyToClipboard } from '../utils/clipboard';
import { formatDisplay } from '../utils/dateTime';
import { RAW_NOTES_DEFAULT_CAP } from '../config/markdownHandoff';
import { removeRawNote } from '../utils/importHistory';

interface Props {
  state: AppState;
  // v0.11.0 Checkpoint I — optional delete affordance. Optional so
  // existing call sites that pass only `state` continue to type-check
  // (the delete button silently hides when onUpdate is not supplied).
  // App.tsx threads onUpdate through normally.
  onUpdate?: (updater: AppStateUpdater) => void;
}

// Map RawNote.importStatus to one of the existing badge color classes.
// Falls back to badge-muted for any future status code we don't know yet.
const STATUS_BADGE_CLASS: Record<RawNoteImportStatus, string> = {
  malformed:   'badge-red',
  unmatched:   'badge-amber',
  duplicate:   'badge-muted',
  partial:     'badge-amber',
  unparseable: 'badge-red',
};

const STATUS_LABEL: Record<RawNoteImportStatus, string> = {
  malformed:   'malformed',
  unmatched:   'unmatched',
  duplicate:   'duplicate',
  partial:     'partial',
  unparseable: 'unparseable',
};

export default function RawNotesPanel({ state, onUpdate }: Props) {
  const notes = state.rawNotes ?? [];

  // Display newest first. We use `slice().reverse()` so we don't
  // mutate the original array. AppState is immutable elsewhere; we
  // honor that here too.
  const ordered = notes.slice().reverse();

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex-between">
          <div>
            <h1 className="panel-title">Raw Notes</h1>
            <p className="panel-desc">
              Fallback substrate for Markdown handoff imports that could not commit
              as authoritative artifacts. Bodies are preserved verbatim for manual review.
            </p>
          </div>
          <div className="flex gap-8 flex-center">
            <span className={`badge ${notes.length === 0 ? 'badge-muted' : 'badge-amber'}`}>
              {notes.length}/{RAW_NOTES_DEFAULT_CAP}
            </span>
          </div>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <div className="empty-state-title">No raw notes yet</div>
          <div className="empty-state-desc">
            Files that can't be imported authoritatively (malformed YAML, unknown round/project,
            truncation suspected, etc.) will land here. Re-import is intentionally not supported
            — this is a manual-review space.
          </div>
        </div>
      ) : (
        <>
          <div className="notice info mb-16 text-xs">
            Raw Notes are not re-importable by design. Inspect, copy out the relevant content,
            and re-enter it manually in the appropriate panel. The buffer is capped at{' '}
            {RAW_NOTES_DEFAULT_CAP} entries; older notes are pruned automatically when the
            cap is reached.
          </div>

          {ordered.map((note) => (
            <RawNoteCard key={note.id} note={note} onUpdate={onUpdate} />
          ))}
        </>
      )}
    </div>
  );
}

// ── Per-note card ───────────────────────────────────────────────────────────

function RawNoteCard({
  note,
  onUpdate,
}: {
  note: RawNote;
  onUpdate?: (updater: AppStateUpdater) => void;
}) {
  const [bodyOpen, setBodyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // v0.11.0 Checkpoint I — two-step delete gate. The first click on
  // Delete flips the button label and arms the confirm; the second
  // click within ~5s actually removes. Inline two-step is simpler
  // than a portal-based modal and matches the affordance density of
  // the rest of the panel.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const statusClass = STATUS_BADGE_CLASS[note.importStatus] ?? 'badge-muted';
  const statusLabel = STATUS_LABEL[note.importStatus] ?? String(note.importStatus);

  const handleCopy = async () => {
    const ok = await copyToClipboard(note.rawBody);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // v0.11.0 Checkpoint I — delete handler. Idempotent: dispatching
  // removeRawNote for a note that no longer exists is a no-op (the
  // filter() in removeRawNote leaves the array unchanged), so even
  // if React batches two clicks together we don't get a crash.
  const handleDelete = () => {
    if (!onUpdate) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      // Auto-reset the confirm state after 5s so a stray first click
      // doesn't stay armed indefinitely.
      setTimeout(() => setConfirmingDelete(false), 5000);
      return;
    }
    onUpdate(removeRawNote(note.id));
    // No need to reset confirmingDelete — the row will unmount.
  };

  const warningCount = note.validationWarnings.length;
  const errorCount = note.validationWarnings.filter((w) => w.severity === 'error').length;

  return (
    <div className="card raw-note-card" style={{ marginBottom: 12 }}>
      <div className="card-header">
        <div>
          <span className="card-title">
            {note.sourceKind ? note.sourceKind.replace(/_/g, ' ') : 'no frontmatter'}
          </span>
          <div className="text-xs text-muted mt-4">
            {formatDisplay(note.createdAt)} · id <code>{note.id.slice(-12)}</code>
          </div>
        </div>
        <div className="flex gap-8 flex-center">
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>

      {/* Compact metadata grid: project / round / model / sibling-count */}
      <div className="raw-note-meta">
        <MetaCell label="Project" value={note.projectId} />
        <MetaCell label="Round"   value={note.roundId}   />
        <MetaCell label="Model"   value={note.originModel} />
        <MetaCell
          label="Body"
          value={`${note.rawBody.length.toLocaleString()} chars`}
        />
      </div>

      {/* Warnings */}
      {warningCount > 0 && (
        <div
          className={`notice ${errorCount > 0 ? 'danger' : ''} mt-8 text-xs`}
          style={{ padding: '8px 12px' }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Captured warnings ({warningCount}{errorCount > 0 ? ` — ${errorCount} errors` : ''})
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {note.validationWarnings.slice(0, 5).map((w, i) => (
              <li key={i}>
                <code style={{ marginRight: 6 }}>{w.code}</code>
                {w.message}
              </li>
            ))}
            {note.validationWarnings.length > 5 && (
              <li className="text-muted">
                …and {note.validationWarnings.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex gap-8 mt-12">
        <button
          className="btn btn-secondary text-xs"
          onClick={() => setBodyOpen((v) => !v)}
          style={{ minHeight: 32, padding: '6px 12px' }}
        >
          {bodyOpen ? 'Hide body' : 'View body'}
        </button>
        <button
          className="btn btn-ghost text-xs"
          onClick={handleCopy}
          style={{ minHeight: 32, padding: '6px 12px' }}
        >
          {copied ? '✓ Copied' : 'Copy body'}
        </button>
        {/* v0.11.0 Checkpoint I — optional Delete button. Hidden when
            onUpdate is not supplied. Two-step inline confirm. */}
        {onUpdate && (
          <button
            className="btn btn-ghost text-xs"
            onClick={handleDelete}
            title={
              confirmingDelete
                ? 'Click again within 5s to confirm deletion'
                : 'Delete this raw note'
            }
            style={{
              minHeight: 32,
              padding: '6px 12px',
              marginLeft: 'auto',
              color: confirmingDelete ? 'var(--color-danger, #c0392b)' : undefined,
              fontWeight: confirmingDelete ? 600 : undefined,
            }}
            aria-label={
              confirmingDelete
                ? 'Confirm delete (click again)'
                : 'Delete raw note'
            }
          >
            {confirmingDelete ? '⚠ Confirm Delete' : 'Delete'}
          </button>
        )}
      </div>

      {bodyOpen && (
        <pre className="raw-note-body mt-8">
          {note.rawBody || '(empty)'}
        </pre>
      )}
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="raw-note-meta-cell">
      <div className="raw-note-meta-label">{label}</div>
      <div className="raw-note-meta-value">
        {value ? <code>{value}</code> : <span className="text-muted">—</span>}
      </div>
    </div>
  );
}

// Note: type ImportValidationWarning is re-exported only via JSX usage above
// for documentation — TypeScript will tree-shake the unused import. We keep
// the import in the type-imports block to make the intent visible.
type _Used = ImportValidationWarning;
