// src/components/RecoveryPanel.tsx
// Purpose: Recovery Mode — shown when localStorage contains malformed RoundTable data.
//
// What this panel offers (Phase 6 Recovery UX):
//   1. Download raw corrupted data (file).
//   2. Copy raw corrupted data to clipboard.
//   3. Import a known-good JSON backup.
//   4. Reset to a clean demo state (with explicit destructive-action warning).
//
// Why all four:
//   Different rescue paths fit different users. A non-technical user can
//   copy and paste their corrupted blob into a chat or rescue workflow
//   without ever opening DevTools. A technical user can download the file
//   directly. Either way, the user sees that the data is not gone.
//
// Phase 5 -> Phase 6 changes:
//   - Added "Copy raw corrupted data" button with immediate success/failure
//     feedback. Button text and a small status line confirm the action.
//   - DevTools-only manual recovery is no longer the only fallback; manual
//     instructions remain for advanced users but are no longer required.
//   - Reset shows a very explicit data-loss warning.
//
// Common safe edits:
//   - Tweaking copy, button labels, or layout.
//   - Adding a third "open in raw view" affordance later.
//
// Common unsafe edits:
//   - Silently clearing corrupted state on entry — DO NOT. The user must
//     get a chance to download or copy first.
//   - Skipping validation in the import-backup path — the validation.ts
//     firewall must still gate any state restoration.

import { useState } from 'react';
import { AppState } from '../types/appState';
import { INITIAL_APP_STATE } from '../data/initialAppState';
import { localStorageAdapter } from '../storage/localStorageAdapter';
import { downloadRawString } from '../utils/jsonExport';
import { parseImportJson, validateImportedState, normalizeImportedState } from '../utils/validation';
import { copyToClipboard } from '../utils/clipboard';
// v0.12.0 Checkpoint J — Modal System Replacement.
import { useModal } from './Modal';

interface Props {
  corruptedRaw: string | null;
  error: string;
  onRestore: (state: AppState) => void;
}

type CopyStatus = 'idle' | 'copied' | 'failed';

export default function RecoveryPanel({ corruptedRaw, error, onRestore }: Props) {
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importOk, setImportOk] = useState<boolean | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  // v0.12.0 Checkpoint J — Modal System Replacement.
  const modal = useModal();

  const handleDownloadCorrupted = () => {
    if (!corruptedRaw) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadRawString(corruptedRaw, `roundtable-corrupted-data-${ts}.txt`);
  };

  const handleCopyCorrupted = async () => {
    if (!corruptedRaw) return;
    const ok = await copyToClipboard(corruptedRaw);
    setCopyStatus(ok ? 'copied' : 'failed');
    // Auto-clear the status after a few seconds so the button is reusable.
    window.setTimeout(() => setCopyStatus('idle'), 3000);
  };

  const handleReset = async () => {
    // v0.12.0 Checkpoint J — Modal System Replacement.
    // Replaces window.confirm. Same warning text, theme-styled
    // destructive confirm. Still guards the destructive action.
    const ok = await modal.confirm({
      title: 'Reset to demo data?',
      message:
        'This will permanently delete the corrupted data and load a ' +
        'fresh demo state.\n\n' +
        'If you have not downloaded or copied the corrupted data yet, ' +
        'do that first.',
      confirmLabel: 'Reset to demo',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    localStorageAdapter.clear();
    onRestore(INITIAL_APP_STATE);
  };

  const handleImport = () => {
    setImportMsg('');
    setImportOk(null);
    const { ok, raw, error: parseError } = parseImportJson(importText);
    if (!ok) {
      setImportMsg(`Parse error: ${parseError}`);
      setImportOk(false);
      return;
    }
    const result = validateImportedState(raw);
    if (!result.valid) {
      setImportMsg(`Validation failed: ${result.errors.join('; ')}`);
      setImportOk(false);
      return;
    }
    const { state } = normalizeImportedState(raw);
    localStorageAdapter.save(state);
    onRestore(state);
  };

  const copyButtonLabel =
    copyStatus === 'copied' ? '✓ Copied!' :
    copyStatus === 'failed' ? '✗ Copy failed — use Download instead' :
    'Copy Raw Corrupted Data to Clipboard';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div className="header-logo-mark" style={{ width: 48, height: 48, fontSize: 16, margin: '0 auto 12px' }}>RT</div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--red)', marginBottom: 8 }}>
            Recovery Mode
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            RoundTable detected a problem loading your saved data. Your data is not gone — it just couldn't be parsed.
          </p>
        </div>

        {/* Error detail */}
        <div className="notice danger mb-16">
          <strong>Error:</strong> {error}
        </div>

        {/* Step 1 — rescue raw data */}
        <div className="card mb-16">
          <div className="card-title mb-12">Step 1 — Rescue Your Raw Data</div>
          <p className="text-sm text-muted mb-12">
            Save the raw stored data <strong>before</strong> taking any other action. Even if it appears
            corrupted, it may contain recoverable content. Either save the file or copy it to your clipboard.
          </p>
          <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={handleDownloadCorrupted}
              disabled={!corruptedRaw}
              style={{ flex: '1 1 240px' }}
            >
              {corruptedRaw ? 'Download Raw Corrupted Data' : 'No raw data available'}
            </button>
            <button
              className={`btn ${copyStatus === 'failed' ? 'btn-danger' : 'btn-secondary'}`}
              onClick={handleCopyCorrupted}
              disabled={!corruptedRaw}
              style={{ flex: '1 1 240px' }}
            >
              {copyButtonLabel}
            </button>
          </div>
          {copyStatus === 'failed' && (
            <div className="notice danger mt-8 text-xs">
              Clipboard copy failed. This can happen on insecure (file://) origins or restrictive browsers.
              Use the Download button instead — it works in every browser RoundTable supports.
            </div>
          )}
          {copyStatus === 'copied' && (
            <div className="notice info mt-8 text-xs">
              Copied to clipboard. Paste somewhere safe (text editor, notes app, or back into Step 2 below
              after you have repaired the JSON).
            </div>
          )}
        </div>

        {/* Step 2 — import backup */}
        <div className="card mb-16">
          <div className="card-title mb-12">Step 2 — Import a Known-Good Backup</div>
          <p className="text-sm text-muted mb-12">
            Paste the contents of a previously exported RoundTable JSON backup. The import goes through the same
            validation firewall as the regular Import tab — nothing unsafe will overwrite your state.
          </p>
          <textarea
            className="form-textarea large"
            placeholder="Paste your RoundTable JSON backup here…"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          {importMsg && (
            <div className={`notice mt-8 ${importOk ? 'info' : 'danger'} text-xs`}>{importMsg}</div>
          )}
          <button
            className="btn btn-primary mt-12"
            onClick={handleImport}
            disabled={!importText.trim()}
            style={{ width: '100%' }}
          >
            Validate &amp; Restore from Backup
          </button>
        </div>

        {/* Step 3 — reset (destructive) */}
        <div className="card mb-16">
          <div className="card-title mb-12">Step 3 — Reset to Demo Data</div>
          <p className="text-sm text-muted mb-12">
            <strong style={{ color: 'var(--red)' }}>Destructive.</strong> Clears all stored RoundTable data
            from this browser and loads a fresh demo project. Use only after you have downloaded or
            copied the corrupted data, or if you have no backup at all.
          </p>
          <button className="btn btn-danger" onClick={handleReset} style={{ width: '100%' }}>
            Reset to Demo Data (Data Loss Warning)
          </button>
        </div>

        {/* Manual / advanced */}
        <div className="notice info text-xs">
          <strong>Advanced manual recovery (optional):</strong> If the buttons above are not enough, open
          browser DevTools → Application → Local Storage → key <code>roundtable.appState.v1</code>. Copy the value,
          repair any malformed JSON in a text editor, then paste it back into Step 2. None of the buttons
          above require DevTools.
        </div>
      </div>
    </div>
  );
}
