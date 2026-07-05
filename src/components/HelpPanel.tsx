// src/components/HelpPanel.tsx
// Purpose: Internal documentation, compatibility notes, and app guidance
// Owned by: this file
// Used by: App.tsx
// Safe edits: add help content, link to docs files
// Unsafe edits: do not add business logic here

import { AppState } from '../types/appState';
import { CompatibilityNote } from '../types/compatibilityNote';
import { formatDate } from '../utils/dateTime';

interface Props {
  state: AppState;
}

export default function HelpPanel({ state }: Props) {
  const activeNotes = state.compatibilityNotes.filter((n) => n.status === 'active');
  const watchingNotes = state.compatibilityNotes.filter((n) => n.status === 'watching');
  const resolvedNotes = state.compatibilityNotes.filter((n) => n.status === 'resolved');

  const NoteList = ({ notes }: { notes: CompatibilityNote[] }) => (
    <>
      {notes.map((note) => (
        <div className="card" key={note.id} style={{ marginBottom: 10 }}>
          <div className="card-header">
            <div>
              <span className="card-title">{note.modelName}</span>
              <span className="text-xs text-muted" style={{ marginLeft: 8 }}>{note.vendor}</span>
            </div>
            <span className={`badge ${note.status === 'active' ? 'badge-red' : note.status === 'watching' ? 'badge-amber' : 'badge-green'}`}>
              {note.status}
            </span>
          </div>
          <div className="text-sm mb-6" style={{ color: 'var(--text-primary)' }}><strong>Issue:</strong> {note.issue}</div>
          <div className="text-sm mb-4" style={{ color: 'var(--green)' }}><strong>Workaround:</strong> {note.workaround}</div>
          <div className="text-xs text-muted">Observed: {formatDate(note.dateObserved)}</div>
        </div>
      ))}
    </>
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="panel-title">Help / Internal Docs</h1>
        <p className="panel-desc">
          Compatibility notes, workflow guidance, and documentation links.
          Full docs are in the <code>docs/</code> folder.
        </p>
      </div>

      {/* What this app is */}
      <div className="card mb-24">
        <div className="card-title mb-12">What This App Is</div>
        <div className="workflow-steps">
          {[
            ['✓', 'A local-first browser app — no backend, no API calls'],
            ['✓', 'A manual copy/paste coordination cockpit for multi-model AI workflows'],
            ['✓', 'A prompt generator following the Context Sandwich pattern'],
            ['✓', 'A mediator packet generator for GPT-5.5 Thinking synthesis'],
            ['✓', 'A project state and decision logger with round history'],
            ['✗', 'NOT an API orchestration tool'],
            ['✗', 'NOT a browser automation or scraping tool'],
            ['✗', 'NOT connected to any AI model — you copy/paste manually'],
          ].map(([icon, text], i) => (
            <div className="workflow-step" key={i} style={{ paddingTop: 8, paddingBottom: 8 }}>
              <span className="workflow-step-num" style={{ fontSize: 14, color: icon === '✓' ? 'var(--green)' : 'var(--red)' }}>
                {icon}
              </span>
              <div className="workflow-step-text">
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compatibility Notes */}
      <div className="section-heading">Active Compatibility Issues ({activeNotes.length})</div>
      {activeNotes.length === 0 ? (
        <div className="empty-state mb-16">No active issues.</div>
      ) : (
        <div className="mb-24"><NoteList notes={activeNotes} /></div>
      )}

      <div className="section-heading">Watching ({watchingNotes.length})</div>
      {watchingNotes.length === 0 ? (
        <div className="empty-state mb-16">None.</div>
      ) : (
        <div className="mb-24"><NoteList notes={watchingNotes} /></div>
      )}

      <div className="section-heading">Resolved ({resolvedNotes.length})</div>
      {resolvedNotes.length === 0 ? (
        <div className="empty-state mb-16">None.</div>
      ) : (
        <div className="mb-24"><NoteList notes={resolvedNotes} /></div>
      )}

      {/* Docs links */}
      <div className="card">
        <div className="card-title mb-12">Documentation Files</div>
        <p className="text-sm text-muted mb-12">
          These files are in the <code>docs/</code> folder. Open them in any text editor.
        </p>
        {[
          ['ARCHITECTURE.md', 'Folder structure, data flow, component responsibilities'],
          ['DATA_MODEL.md', 'TypeScript types, AppState shape, versioning'],
          ['PROMPT_SYSTEM.md', 'Context Sandwich pattern, template variables, prompt generation'],
          ['MODEL_PROFILES.md', 'How to add/edit model profiles'],
          ['COMPATIBILITY_NOTES.md', 'How to add/update compatibility notes'],
          ['EDITING_GUIDE.md', 'Safe and unsafe edits by file category'],
          ['PHASE_HISTORY.md', 'Phase-by-phase build log'],
          ['PROJECT_STATE.md', 'Project state documentation format'],
        ].map(([file, desc]) => (
          <div key={file} className="flex-center gap-12" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <code style={{ minWidth: 180 }}>{file}</code>
            <span className="text-sm text-muted">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
