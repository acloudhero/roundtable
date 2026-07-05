// src/components/ExportImportPanel.tsx
// Purpose: Full export/import panel — Phase 5 "Zero Data Loss Cockpit",
//          carried forward and polished in Phase 6.
//
// What this panel owns (UI side of the import firewall):
//   - JSON full export
//   - 9 Markdown exports (history, summary, current round, decisions,
//     compatibility notes, model roster, prompt library, mediator packet)
//   - 4-stage import flow: load file → validate + preview → backup → confirm
//
// Phase 6 changes:
//   - Validation result is rendered from typed ValidationIssue[] when
//     available, grouped into Errors / Warnings / Auto-repairs as three
//     distinct sections, each with its own (non-nested) <ul>. This
//     replaces the previous flat warnings list and removes any duplicate-
//     nested <ul> markup risk.
//   - Inline ValidationResult constructions now include `issues: []` to
//     match the Phase 6 ValidationResult shape.
//
// Common safe edits:
//   - Tweaking copy, button labels, or layout.
//   - Adding new Markdown export buttons (wire to markdownExport.ts).
//
// Common unsafe edits:
//   - Skipping validateImportedState() in the import flow.
//   - Removing the backup-before-import gate.
//   - Enabling Confirm Import while errors are present.
//   - Removing the dynamic Markdown fencing (see markdownExport.ts).

import { useState, useRef } from 'react';
import { AppState, AppStateUpdater } from '../types/appState';
import {
  downloadJsonExport,
  downloadBackup,
  historyFilename,
  decisionLogFilename,
  downloadText,
} from '../utils/jsonExport';
import {
  exportProjectHistory,
  exportProjectSummary,
  exportCurrentRound,
  exportDecisionLog,
  exportCompatibilityNotes,
  exportModelRoster,
  exportPromptLibrary,
  exportMediatorPacket,
  mediatorPacketFilename,
  exportGeminiReviewPacket,
  geminiReviewPacketFilename,
} from '../utils/markdownExport';
import {
  parseImportJson,
  validateImportedState,
  normalizeImportedState,
  ImportSummary,
  ValidationResult,
  ValidationIssue,
  VALIDATION_CODES,
} from '../utils/validation';
import { MigrationNotice } from '../utils/migration';
import { formatDisplay } from '../utils/dateTime';

interface Props {
  state: AppState;
  onUpdate: (updated: AppStateUpdater) => void;
  onReset: () => void;
}

type ImportStage = 'idle' | 'validating' | 'preview' | 'backed-up' | 'confirmed';

export default function ExportImportPanel({ state, onUpdate, onReset }: Props) {
  const [activeSection, setActiveSection] = useState<'export' | 'import'>('export');

  // Import flow state
  const [importText, setImportText] = useState('');
  const [importStage, setImportStage] = useState<ImportStage>('idle');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Export helpers ──────────────────────────────────────────────────────────

  const mdDownload = (content: string, filename: string) =>
    downloadText(content, filename, 'text/markdown');

  const dateStamp = () => new Date().toISOString().slice(0, 10);

  // ── Import flow ─────────────────────────────────────────────────────────────

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText((ev.target?.result as string) ?? '');
      setImportStage('idle');
      setValidationResult(null);
      setBackedUp(false);
      setImportSuccess(false);
    };
    reader.readAsText(file);
  };

  const handleValidate = () => {
    if (!importText.trim()) return;
    const { ok, raw, error } = parseImportJson(importText);
    if (!ok) {
      const message = error ?? 'Unknown parse error';
      setValidationResult({
        valid: false,
        issues: [{ code: VALIDATION_CODES.JSON_PARSE_FAILED, severity: 'error', message }],
        migrations: [],
        errors: [message],
        warnings: [],
        repaired: false,
        summary: null,
      });
      setImportStage('preview');
      return;
    }
    const result = validateImportedState(raw);
    setValidationResult(result);
    setImportStage('preview');
  };

  const handleBackup = () => {
    downloadBackup(state);
    setBackedUp(true);
    setImportStage('backed-up');
  };

  const handleConfirmImport = () => {
    if (!validationResult?.valid || !importText.trim()) return;
    const { ok, raw } = parseImportJson(importText);
    if (!ok) return;
    const { state: normalized } = normalizeImportedState(raw);
    onUpdate({ ...normalized });
    setImportSuccess(true);
    setImportStage('confirmed');
    setImportText('');
    setValidationResult(null);
    setBackedUp(false);
  };

  const resetImport = () => {
    setImportText('');
    setImportStage('idle');
    setValidationResult(null);
    setBackedUp(false);
    setImportSuccess(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="panel-title">Export / Import</h1>
        <p className="panel-desc">Zero Data Loss Cockpit — export, back up, import, and recover project state.</p>
      </div>

      {/* Section toggle */}
      <div className="flex gap-8 mb-24">
        {(['export', 'import'] as const).map((s) => (
          <button
            key={s}
            className={`btn ${activeSection === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSection(s)}
            style={{ minWidth: 120 }}
          >
            {s === 'export' ? '↓ Export' : '↑ Import'}
          </button>
        ))}
      </div>

      {/* ── EXPORT SECTION ─────────────────────────────────────────────────── */}
      {activeSection === 'export' && (
        <>
          <div className="notice mb-16 info text-xs">
            ⚠️ All data is stored in your browser only. Export regularly. Clearing browser data will delete your project state.
          </div>

          <div className="export-section-title">JSON Backup</div>
          <div className="card mb-16">
            <div className="card-header">
              <span className="card-title">Full JSON Export</span>
              <span className="badge badge-green">Recommended</span>
            </div>
            <p className="text-sm text-muted mb-12">
              Complete app state. Use for backup, migration, and restoring the app on another machine.
              Preserves all rounds, responses, synthesis, decisions, and audit trail.
            </p>
            <button className="btn btn-primary" onClick={() => downloadJsonExport(state)} style={{ width: '100%' }}>
              Download JSON Backup
            </button>
          </div>

          {/* Markdown exports */}
          <div className="section-heading">Markdown Exports (Human-Readable)</div>
          <p className="text-xs text-muted mb-12">
            Markdown exports are for reading and sharing. Use JSON to restore the app.
          </p>

          <div className="export-grid">
            {[
              { label: 'Full Project History', desc: 'All rounds, prompts, responses, decisions', fn: () => mdDownload(exportProjectHistory(state), historyFilename(state)) },
              { label: 'Project Summary', desc: 'Status, canonical state, open questions, risks', fn: () => mdDownload(exportProjectSummary(state), `ROUNDTABLE_SUMMARY_${dateStamp()}.md`) },
              { label: 'Current Round', desc: 'Latest round — prompts, responses, synthesis', fn: () => mdDownload(exportCurrentRound(state), `ROUNDTABLE_ROUND_current_${dateStamp()}.md`) },
              { label: 'Decision Log', desc: 'All decisions with rationale and canonical updates', fn: () => mdDownload(exportDecisionLog(state), decisionLogFilename(state)) },
              { label: 'Compatibility Notes', desc: 'All model compatibility notes by status', fn: () => mdDownload(exportCompatibilityNotes(state), `ROUNDTABLE_COMPATIBILITY_NOTES_${dateStamp()}.md`) },
              { label: 'Model Roster', desc: 'All model profiles with role prompts', fn: () => mdDownload(exportModelRoster(state), `ROUNDTABLE_MODEL_ROSTER_${dateStamp()}.md`) },
              { label: 'Prompt Library', desc: 'All prompt templates', fn: () => mdDownload(exportPromptLibrary(state), `ROUNDTABLE_PROMPT_LIBRARY_${dateStamp()}.md`) },
              { label: 'Mediator Packet', desc: 'Exact GPT-5.5 mediator packet for current round', fn: () => mdDownload(exportMediatorPacket(state), mediatorPacketFilename(state)) },
              { label: 'Gemini Review Packet', desc: 'Curated review packet — local Markdown, no upload', fn: () => mdDownload(exportGeminiReviewPacket(state), geminiReviewPacketFilename(state)) },
            ].map((item) => (
              <div className="export-item" key={item.label}>
                <div className="export-item-label">{item.label}</div>
                <div className="export-item-desc">{item.desc}</div>
                <button className="btn btn-secondary btn-sm" onClick={item.fn}>↓ Download</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── IMPORT SECTION ─────────────────────────────────────────────────── */}
      {activeSection === 'import' && (
        <>
          {importSuccess && (
            <div className="notice mb-16 info">✓ Import successful. App state has been updated.</div>
          )}

          <div className="notice danger mb-16">
            ⚠️ Importing will overwrite your current app state. Always back up first.
          </div>

          {/* Step 1: Load file */}
          <div className="card mb-16">
            <div className="card-title mb-12">Step 1 — Load Import File</div>
            <div className="form-group">
              <label className="form-label">Select JSON file</label>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                onChange={handleFileRead}
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Or paste JSON directly</label>
              <textarea
                className="form-textarea large"
                placeholder="Paste RoundTable JSON export here…"
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportStage('idle'); }}
              />
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleValidate}
              disabled={!importText.trim()}
              style={{ width: '100%' }}
            >
              Validate Import File
            </button>
          </div>

          {/* Step 2: Preview */}
          {importStage !== 'idle' && validationResult && (
            <div className="card mb-16">
              <div className="card-header">
                <span className="card-title">Step 2 — Validation Preview</span>
                <span className={`badge ${validationResult.valid ? 'badge-green' : 'badge-red'}`}>
                  {validationResult.valid ? '✓ Valid' : '✗ Invalid'}
                </span>
              </div>

              <ValidationIssueGroups result={validationResult} />

              {validationResult.summary && (
                <ImportDiffTable current={state} incoming={validationResult.summary} />
              )}

              <button className="btn btn-ghost text-xs mt-8" onClick={resetImport}>
                ← Load Different File
              </button>
            </div>
          )}

          {/* Step 3: Backup */}
          {importStage !== 'idle' && validationResult?.valid && (
            <div className="card mb-16">
              <div className="card-header">
                <span className="card-title">Step 3 — Back Up Current State</span>
                {backedUp && <span className="badge badge-green">✓ Backed Up</span>}
              </div>
              <p className="text-sm text-muted mb-12">
                Download your current state before it is overwritten.
                The import will not proceed until you back up or explicitly skip.
              </p>
              <div className="flex gap-8">
                <button
                  className={`btn ${backedUp ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={handleBackup}
                  style={{ flex: 1 }}
                >
                  {backedUp ? '✓ Download Again' : 'Download Backup Now'}
                </button>
                {!backedUp && (
                  <button
                    className="btn btn-ghost text-xs"
                    onClick={() => { setBackedUp(true); setImportStage('backed-up'); }}
                  >
                    Skip (I accept data loss risk)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {(importStage === 'backed-up') && validationResult?.valid && (
            <div className="card mb-16">
              <div className="card-title mb-12">Step 4 — Confirm Import</div>
              <div className="notice danger mb-12 text-xs">
                This will overwrite your current app state with the imported data.
                {!backedUp && ' You chose to skip the backup — any current data will be lost.'}
              </div>
              <button
                className="btn btn-danger"
                onClick={handleConfirmImport}
                style={{ width: '100%' }}
              >
                Confirm — Import and Replace State
              </button>
            </div>
          )}

          <hr className="divider" />

          {/* Reset */}
          <div className="card">
            <div className="card-title mb-8">Reset to Demo Data</div>
            <p className="text-sm text-muted mb-12">Clears all state and loads a fresh demo project. Development use only.</p>
            <button className="btn btn-danger" onClick={onReset}>Reset to Demo Data</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Validation issue groups (Phase 7A) ────────────────────────────────────────
//
// Renders four independent groups, each with its own flat <ul>:
//   1. Errors          (block confirm)
//   2. Migrations      (version-up structural transforms applied)
//   3. Warnings        (review before confirming)
//   4. Auto-repairs    (will be applied during normalization)
//
// Each group renders only when it has items, and each <ul> appears at most
// once. There is no nested <ul> structure.
//
// Note on rendering order: errors come first because they block confirm;
// migrations come second because they describe what already happened to
// the import payload; warnings come third; auto-repairs come last because
// they describe what will happen on confirm. This sequence matches the
// import flow's mental model.

function ValidationIssueGroups({ result }: { result: ValidationResult }) {
  // Prefer the typed issues[] if present; fall back to legacy string arrays
  // so this component remains robust if some caller still constructs a
  // ValidationResult without `issues`.
  const issues: ValidationIssue[] =
    result.issues && result.issues.length > 0
      ? result.issues
      : [
          ...result.errors.map((m) => ({ code: VALIDATION_CODES.JSON_PARSE_FAILED, severity: 'error' as const, message: m })),
          ...result.warnings.map((m) => ({ code: VALIDATION_CODES.AUTO_REPAIR_APPLIED, severity: 'warning' as const, message: m })),
        ];

  const errors = issues.filter((i) => i.severity === 'error');
  const repairs = issues.filter(
    (i) => i.severity === 'warning' && i.code === VALIDATION_CODES.AUTO_REPAIR_APPLIED
  );
  const warnings = issues.filter(
    (i) => i.severity === 'warning' && i.code !== VALIDATION_CODES.AUTO_REPAIR_APPLIED
  );
  const migrations: MigrationNotice[] = result.migrations ?? [];

  return (
    <>
      {errors.length > 0 && (
        <div className="notice danger mb-12">
          <strong>Errors (must fix before import):</strong>
          <IssueList issues={errors} />
        </div>
      )}

      {migrations.length > 0 && (
        <div className="notice info mb-12">
          <strong>Migrations applied:</strong>
          <MigrationList notices={migrations} />
        </div>
      )}

      {warnings.length > 0 && (
        <div className="notice mb-12">
          <strong>Warnings (review before confirming):</strong>
          <IssueList issues={warnings} />
        </div>
      )}

      {repairs.length > 0 && (
        <div className="notice info mb-12">
          <strong>Auto-repairs that will be applied:</strong>
          <IssueList issues={repairs} />
        </div>
      )}
    </>
  );
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  return (
    <ul style={{ marginTop: 6, paddingLeft: 16 }}>
      {issues.map((issue, i) => (
        <li key={`${issue.code}-${i}`} className="text-xs">
          {issue.message}
          {issue.path && (
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
              ({issue.path})
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function MigrationList({ notices }: { notices: MigrationNotice[] }) {
  return (
    <ul style={{ marginTop: 6, paddingLeft: 16 }}>
      {notices.map((n, i) => (
        <li key={`${n.code}-${i}`} className="text-xs">
          <span style={{ fontFamily: 'var(--font-mono)', marginRight: 6, color: 'var(--text-muted)' }}>
            [{n.code}]
          </span>
          {n.message}
          {n.path && (
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
              ({n.path})
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Import diff table ─────────────────────────────────────────────────────────

function ImportDiffTable({ current, incoming }: { current: AppState; incoming: ImportSummary }) {
  const currentProject = current.projects.find((p) => p.id === current.activeProjectId);
  const rows: [string, string, string][] = [
    ['Project Names', currentProject?.name ?? '(none)', incoming.detectedProjectNames.join(', ') || '(none)'],
    ['Schema Version', current.schemaVersion, incoming.schemaVersion],
    ['Projects', String(current.projects.length), String(incoming.projectCount)],
    ['Rounds', String(current.rounds.length), String(incoming.roundCount)],
    ['Decisions', String(current.decisions.length), String(incoming.decisionCount)],
    ['Model Profiles', String(current.modelProfiles.length), String(incoming.modelProfileCount)],
    ['Compatibility Notes', String(current.compatibilityNotes.length), String(incoming.compatibilityNoteCount)],
    ['Export Date', '(current session)', incoming.exportedAt ? formatDisplay(incoming.exportedAt) : 'unknown'],
  ];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        <thead>
          <tr>
            {['Field', 'Current (will be replaced)', 'Incoming'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, cur, inc]) => (
            <tr key={label}>
              <td style={{ padding: '5px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{label}</td>
              <td style={{ padding: '5px 10px', color: 'var(--red)', borderBottom: '1px solid var(--border)' }}>{cur}</td>
              <td style={{ padding: '5px 10px', color: 'var(--green)', borderBottom: '1px solid var(--border)' }}>{inc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
