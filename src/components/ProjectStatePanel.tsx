// src/components/ProjectStatePanel.tsx
// Purpose: Edit active project metadata and canonical state
// Phase 3: prominent canonical state editor with clear "used in prompts" notice

import { useState, useEffect } from 'react';
import { AppState, AppStateUpdater } from '../types/appState';
import { Project } from '../types/project';
import { nowIso, formatDisplay } from '../utils/dateTime';

interface Props {
  state: AppState;
  onUpdate: (updated: AppStateUpdater) => void;
}

export default function ProjectStatePanel({ state, onUpdate }: Props) {
  const project = state.projects.find((p) => p.id === state.activeProjectId);

  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [currentPhase, setCurrentPhase] = useState(project?.currentPhase ?? '');
  const [canonicalState, setCanonicalState] = useState(project?.canonicalState ?? '');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description);
      setCurrentPhase(project.currentPhase);
      setCanonicalState(project.canonicalState);
    }
  }, [project?.id]);

  const handleSave = () => {
    if (!project) return;
    const updated: Project = {
      ...project,
      name,
      description,
      currentPhase,
      canonicalState,
      updatedAt: nowIso(),
    };
    onUpdate({
      projects: state.projects.map((p) => (p.id === project.id ? updated : p)),
    });
    setSavedAt(nowIso());
  };

  if (!project) {
    return (
      <div className="panel">
        <div className="empty-state">No active project found.</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex-between">
          <div>
            <h1 className="panel-title">Project State</h1>
            <p className="panel-desc">Edit the project's canonical state. Included in every model prompt.</p>
          </div>
        </div>
      </div>

      <div className="notice mb-24 info">
        <strong>Canonical State is the project's ground truth.</strong> Every Context Sandwich prompt starts with it.
        Keep it accurate and up to date after each round decision.
      </div>

      <div className="workbench">
        {/* LEFT: metadata */}
        <div>
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Current Phase</label>
            <input
              className="form-input"
              value={currentPhase}
              onChange={(e) => setCurrentPhase(e.target.value)}
              placeholder="e.g. Phase 3 — Core Round Workflow"
            />
            <p className="text-xs text-muted mt-4">Copied into new rounds automatically.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
          </div>
          <div className="text-xs text-muted mb-8">
            Last updated: {project.updatedAt ? formatDisplay(project.updatedAt) : 'unknown'}
          </div>
          {savedAt && (
            <div className="text-xs text-green mb-8">✓ Saved {formatDisplay(savedAt)}</div>
          )}
          <button className="btn btn-primary" onClick={handleSave}>
            Save Project State
          </button>
        </div>

        {/* RIGHT: canonical state — large and prominent */}
        <div>
          <div className="form-group">
            <label className="form-label">Canonical State</label>
            <p className="text-xs text-muted mb-8">
              This is included at the top of every generated model prompt.
              After each round, paste the mediator's "Proposed Canonical State Update" here (or use the Decision Log to append it automatically).
            </p>
            <textarea
              className="form-textarea canonical-state-editor"
              value={canonicalState}
              onChange={(e) => setCanonicalState(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%' }}>
            Save Canonical State
          </button>
          <p className="text-xs text-muted mt-8 text-center">
            Changes take effect in the next round's generated prompts.
          </p>
        </div>
      </div>
    </div>
  );
}
