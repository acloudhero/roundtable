// src/components/ImportHistoryPanel.tsx
// Purpose: v0.11.0 Markdown Handoff Mode — display AppState.importHistory
//          (the commit log) and offer rollback on the most-recent
//          un-rolled-back transaction.
//
// Checkpoint B scope (UI shell + rollback wiring):
//   - List view, newest first.
//   - Per-row: timestamp, source artifact type, project/round ids,
//     change summary lines, and a rollback button.
//   - Rollback is wired via utils/importHistory.ts::rollbackTransaction
//     and gated by canRollback() — the button is rendered as disabled
//     with an inline explanation for older transactions.
//   - Confirmation prompt before rollback (modal.prompt — see
//     src/components/Modal.tsx) so the user cannot fat-finger a
//     destructive undo. The prompt also captures a reason string —
//     stored on the transaction's rollbackReason field.
//
// Locked design decisions honored here:
//   - Most-recent-only rollback (Q14 #8). Cascading deferred to v0.11.1.
//   - Already-rolled-back transactions remain visible but their
//     button is replaced by a "↩ Rolled back" badge with reason.
//   - When IMPORT_HISTORY_DEFAULT_CAP is reached, older transactions
//     are pruned at commit time — the panel surfaces a count so the
//     operator can see how close they are to that boundary.
//
// Owned by: this file
// Used by:  App.tsx (registered as the 'import-history' tab in Checkpoint B).

import { useMemo, useState } from 'react';
import { AppState, AppStateUpdater } from '../types/appState';
import { ImportTransaction, ImportChange } from '../types/markdownArtifact';
import { canRollback, rollbackTransaction } from '../utils/importHistory';
import { formatDisplay } from '../utils/dateTime';
import { IMPORT_HISTORY_DEFAULT_CAP } from '../config/markdownHandoff';
// v0.12.0 Checkpoint J — Modal System Replacement.
import { useModal } from './Modal';

interface Props {
  state: AppState;
  onUpdate: (updater: AppStateUpdater) => void;
}

export default function ImportHistoryPanel({ state, onUpdate }: Props) {
  const history = state.importHistory ?? [];
  // v0.12.0 Checkpoint J — Modal System Replacement.
  const modal = useModal();

  // newest first
  const ordered = useMemo(() => history.slice().reverse(), [history]);

  // The id of the single transaction currently eligible for rollback —
  // computed once from the live history. We memoize so per-row checks
  // don't iterate the whole list (n^2 in the worst case).
  const rollbackEligibleId = useMemo<string | null>(() => {
    const live = history.filter((t) => !t.rolledBackAt);
    if (live.length === 0) return null;
    return live[live.length - 1].id;
  }, [history]);

  const handleRollback = async (tx: ImportTransaction) => {
    // Defensive double-check — canRollback uses live state, the
    // rollbackEligibleId memo could theoretically lag, so we re-verify
    // before issuing the updater.
    if (!canRollback(state, tx.id)) {
      // v0.12.0 Checkpoint J — replaces window.alert.
      await modal.alert({
        title: 'Cannot roll back',
        message:
          'Rollback is no longer available for this transaction. ' +
          'Only the most recent un-rolled-back commit can be undone ' +
          'in v0.11.0.',
        okLabel: 'OK',
      });
      return;
    }
    // v0.12.0 Checkpoint J — replaces window.prompt. Multi-line input
    // so operators can leave a substantive reason. Cancel resolves to
    // null and aborts; empty submission keeps the prior fallback of
    // recording "(no reason given)".
    const reason = await modal.prompt({
      title: 'Roll back this import?',
      message:
        `Source: ${tx.sourceArtifactType}\n` +
        `Project: ${tx.projectId ?? '(none)'}\n` +
        `Round: ${tx.roundId ?? '(none)'}\n` +
        `Time: ${formatDisplay(tx.timestamp)}\n\n` +
        'Rollback restores the snapshot captured before this import. ' +
        'Provide a short reason (saved on the transaction):',
      placeholder: 'Reason for rolling back…',
      confirmLabel: 'Roll back',
      cancelLabel: 'Cancel',
      multiline: true,
      destructive: true,
    });
    if (reason === null) return; // operator cancelled
    onUpdate(rollbackTransaction(tx.id, reason || '(no reason given)'));
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex-between">
          <div>
            <h1 className="panel-title">Import History</h1>
            <p className="panel-desc">
              Markdown handoff commits. Only the most-recent un-rolled-back transaction can be rolled back in v0.11.0.
            </p>
          </div>
          <div className="flex gap-8 flex-center">
            <span className={`badge ${history.length === 0 ? 'badge-muted' : 'badge-blue'}`}>
              {history.length}/{IMPORT_HISTORY_DEFAULT_CAP}
            </span>
          </div>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗂️</div>
          <div className="empty-state-title">No imports yet</div>
          <div className="empty-state-desc">
            Every Markdown handoff commit (authoritative or Raw Notes) will appear here with a
            pre-import snapshot the most-recent commit can restore.
          </div>
        </div>
      ) : (
        <>
          <div className="notice info mb-16 text-xs">
            Rollback granularity is most-recent-only. Older transactions remain visible but
            cannot be rolled back; cascading rollback is deferred to v0.11.1.
          </div>

          {ordered.map((tx) => (
            <ImportTransactionCard
              key={tx.id}
              tx={tx}
              isRollbackEligible={tx.id === rollbackEligibleId && !tx.rolledBackAt}
              onRollback={() => handleRollback(tx)}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ── Per-transaction card ────────────────────────────────────────────────────

function ImportTransactionCard({
  tx,
  isRollbackEligible,
  onRollback,
}: {
  tx: ImportTransaction;
  isRollbackEligible: boolean;
  onRollback: () => void;
}) {
  const rolledBack = Boolean(tx.rolledBackAt);

  return (
    <div className="card import-history-card" style={{ marginBottom: 12 }}>
      <div className="card-header">
        <div>
          <span className="card-title">
            {tx.sourceArtifactType.replace(/_/g, ' ')}
          </span>
          <div className="text-xs text-muted mt-4">
            {formatDisplay(tx.timestamp)} · id <code>{tx.id.slice(-12)}</code>
          </div>
        </div>
        <div className="flex gap-8 flex-center">
          {rolledBack ? (
            <span className="badge badge-muted">↩ rolled back</span>
          ) : isRollbackEligible ? (
            <span className="badge badge-amber">most recent</span>
          ) : (
            <span className="badge badge-muted">historical</span>
          )}
        </div>
      </div>

      <div className="import-history-meta">
        <MetaCell label="Project"     value={tx.projectId} />
        <MetaCell label="Round"       value={tx.roundId}   />
        <MetaCell label="Source id"   value={tx.sourceArtifactId} />
        <MetaCell label="Changes"     value={String(tx.changes.length)} />
      </div>

      {/* Change summary */}
      {tx.changes.length > 0 && (
        <div className="import-history-changes mt-8">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {tx.changes.map((c, i) => (
              <li key={i} className="text-xs" style={{ marginBottom: 4 }}>
                <code style={{ marginRight: 6 }}>{c.kind}</code>
                {c.description}
                {c.path && (
                  <span className="text-muted" style={{ marginLeft: 6 }}>
                    (<code>{c.path}</code>)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rolled-back banner: surface the reason if the user supplied one */}
      {rolledBack && (
        <div className="notice info mt-8 text-xs" style={{ padding: '8px 12px' }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            Rolled back at {tx.rolledBackAt ? formatDisplay(tx.rolledBackAt) : 'unknown'}
          </div>
          {tx.rollbackReason && (
            <div className="text-muted">Reason: {tx.rollbackReason}</div>
          )}
        </div>
      )}

      <div className="flex gap-8 mt-12">
        {!rolledBack && (
          <button
            className={`btn ${isRollbackEligible ? 'btn-danger' : 'btn-ghost'} text-xs`}
            onClick={onRollback}
            disabled={!isRollbackEligible}
            title={
              isRollbackEligible
                ? 'Restore the snapshot captured before this commit'
                : 'Only the most recent un-rolled-back transaction can be rolled back (cascading rollback deferred to v0.11.1)'
            }
            style={{ minHeight: 32, padding: '6px 12px' }}
          >
            {isRollbackEligible ? 'Rollback' : 'Rollback (unavailable)'}
          </button>
        )}
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="import-history-meta-cell">
      <div className="import-history-meta-label">{label}</div>
      <div className="import-history-meta-value">
        {value ? <code>{value}</code> : <span className="text-muted">—</span>}
      </div>
    </div>
  );
}

// Silence unused-import warnings for ImportChange (used implicitly via tx.changes typing).
type _Used = ImportChange;
