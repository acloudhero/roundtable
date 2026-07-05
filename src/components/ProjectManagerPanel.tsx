// src/components/ProjectManagerPanel.tsx
// Purpose: Project lifecycle management — create, switch, duplicate, archive, delete
// Phase v0.10.1: first-class project lifecycle controls
// Owned by: this file
// Used by: App.tsx (tab routing)

import { useState } from 'react';
import { AppState, AppStateUpdater } from '../types/appState';
import { Project } from '../types/project';
import {
  createNewProject,
  duplicateProject,
  archiveProject,
  unarchiveProject,
  deleteProject,
  switchActiveProject,
  getActiveProjects,
  getArchivedProjects,
} from '../utils/projectUtils';
import { formatDisplay } from '../utils/dateTime';

interface Props {
  state: AppState;
  onUpdate: (updated: AppStateUpdater) => void;
  onNavigate: (tab: string) => void;
}

type ConfirmAction =
  | { type: 'archive'; project: Project }
  | { type: 'delete'; project: Project }
  | null;

export default function ProjectManagerPanel({ state, onUpdate, onNavigate }: Props) {
  const [newName, setNewName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [feedback, setFeedback] = useState('');

  const activeProjects   = getActiveProjects(state);
  const archivedProjects = getArchivedProjects(state);
  const currentProject   = state.projects.find((p) => p.id === state.activeProjectId);

  const flash = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3000);
  };

  // ── Create ────────────────────────────────────────────────────────────────

  const handleCreate = () => {
    const updates = createNewProject(newName, state);
    onUpdate(updates);
    setNewName('');
    flash('New project created and set as active.');
  };

  const handleStartBlank = () => {
    const updates = createNewProject('', state);
    onUpdate(updates);
    flash('Blank project created.');
  };

  // ── Switch ────────────────────────────────────────────────────────────────

  const handleSwitch = (id: string) => {
    onUpdate(switchActiveProject(id));
    flash('Active project switched.');
  };

  // ── Duplicate ─────────────────────────────────────────────────────────────

  const handleDuplicate = (id: string) => {
    onUpdate(duplicateProject(id, state));
    flash('Project duplicated (including rounds and decisions). New copy is now active.');
  };

  // ── Archive / Unarchive ───────────────────────────────────────────────────

  const handleArchiveConfirm = () => {
    if (!confirmAction || confirmAction.type !== 'archive') return;
    onUpdate(archiveProject(confirmAction.project.id, state));
    setConfirmAction(null);
    flash('Project archived.');
  };

  const handleUnarchive = (id: string) => {
    onUpdate(unarchiveProject(id, state));
    flash('Project unarchived.');
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteConfirm = () => {
    if (!confirmAction || confirmAction.type !== 'delete') return;
    if (deleteConfirmText.trim() !== confirmAction.project.name.trim()) return;
    onUpdate(deleteProject(confirmAction.project.id, state));
    setConfirmAction(null);
    setDeleteConfirmText('');
    flash('Project and all its rounds/decisions deleted.');
  };

  const cancelConfirm = () => {
    setConfirmAction(null);
    setDeleteConfirmText('');
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="panel-title">Project Manager</h1>
        <p className="panel-desc">
          Create, switch, duplicate, archive, or delete projects.
          Model profiles, prompt templates, and compatibility notes are shared across all projects.
        </p>
      </div>

      {feedback && <div className="notice mb-16 info text-xs">{feedback}</div>}

      {/* Active project indicator */}
      {currentProject && (
        <div className="round-active-banner mb-16">
          <span>✓</span>
          <div>
            <strong>Active project:</strong> {currentProject.name}
            <span className="text-muted" style={{ marginLeft: 10 }}>
              {currentProject.currentPhase || 'No phase set'}
            </span>
          </div>
        </div>
      )}

      {!currentProject && (
        <div className="notice danger mb-16">
          No active project. Create or select a project below.
        </div>
      )}

      {/* ── Confirm overlay ──────────────────────────────────────────────── */}
      {confirmAction && (
        <div className="card mb-16" style={{ border: '1px solid var(--red-dim)', background: 'rgba(224,80,80,0.05)' }}>
          {confirmAction.type === 'archive' && (
            <>
              <div className="card-title mb-8" style={{ color: 'var(--amber)' }}>
                Archive "{confirmAction.project.name}"?
              </div>
              <p className="text-sm text-muted mb-12">
                The project will be hidden from the active list. Its data stays in your JSON backup.
                You can unarchive it at any time.
              </p>
              <div className="flex gap-8">
                <button className="btn btn-danger" onClick={handleArchiveConfirm}>Archive Project</button>
                <button className="btn btn-secondary" onClick={cancelConfirm}>Cancel</button>
              </div>
            </>
          )}
          {confirmAction.type === 'delete' && (
            <>
              <div className="card-title mb-8" style={{ color: 'var(--red)' }}>
                Delete "{confirmAction.project.name}"?
              </div>
              <p className="text-sm mb-12" style={{ color: 'var(--red)' }}>
                This will permanently delete the project and <strong>all {
                  state.rounds.filter(r => r.projectId === confirmAction.project.id).length
                } rounds</strong> and <strong>{
                  state.decisions.filter(d => d.projectId === confirmAction.project.id).length
                } decisions</strong>. This cannot be undone unless you have a JSON backup.
              </p>
              <div className="form-group">
                <label className="form-label">
                  Type the project name to confirm: <strong>{confirmAction.project.name}</strong>
                </label>
                <input
                  className="form-input"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type project name exactly"
                  autoFocus
                />
              </div>
              <div className="flex gap-8 mt-8">
                <button
                  className="btn btn-danger"
                  onClick={handleDeleteConfirm}
                  disabled={deleteConfirmText.trim() !== confirmAction.project.name.trim()}
                >
                  Permanently Delete
                </button>
                <button className="btn btn-secondary" onClick={cancelConfirm}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Create new project ───────────────────────────────────────────── */}
      <div className="card mb-16">
        <div className="step-label mb-12">
          <span className="step-number">1</span>
          Create New Project
        </div>
        <div className="flex gap-8 mb-8" style={{ flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="Project name (or leave blank for 'Untitled Project')"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button className="btn btn-primary" onClick={handleCreate}>
            + New Project
          </button>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleStartBlank}>
          Start From Blank Project
        </button>
        <p className="text-xs text-muted mt-8">
          New projects start with 0 rounds and 0 decisions. Model profiles and templates are shared.
        </p>
      </div>

      {/* ── Active project list ──────────────────────────────────────────── */}
      <div className="section-heading">
        Active Projects ({activeProjects.length})
      </div>

      {activeProjects.length === 0 && (
        <div className="empty-state mb-16">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No active projects</div>
          <div className="empty-state-desc">Create one above or unarchive a project below.</div>
        </div>
      )}

      {activeProjects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          isActive={project.id === state.activeProjectId}
          roundCount={state.rounds.filter((r) => r.projectId === project.id).length}
          decisionCount={state.decisions.filter((d) => d.projectId === project.id).length}
          onSwitch={() => handleSwitch(project.id)}
          onDuplicate={() => handleDuplicate(project.id)}
          onArchive={() => setConfirmAction({ type: 'archive', project })}
          onDelete={() => { setConfirmAction({ type: 'delete', project }); setDeleteConfirmText(''); }}
          onNavigate={onNavigate}
        />
      ))}

      {/* ── Archived projects ────────────────────────────────────────────── */}
      {archivedProjects.length > 0 && (
        <>
          <div className="flex-between mt-16 mb-8">
            <div className="section-heading" style={{ marginBottom: 0 }}>
              Archived Projects ({archivedProjects.length})
            </div>
            <button
              className="btn btn-ghost btn-sm text-xs"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? 'Hide' : 'Show'}
            </button>
          </div>
          {showArchived && archivedProjects.map((project) => (
            <div key={project.id} className="model-profile-card" style={{ opacity: 0.7, marginBottom: 10 }}>
              <div className="model-profile-header">
                <div style={{ flex: 1 }}>
                  <div className="model-name">{project.name}</div>
                  <div className="text-xs text-muted">
                    {project.currentPhase || 'No phase'} ·
                    Archived {project.archivedAt ? formatDisplay(project.archivedAt) : ''}
                  </div>
                </div>
                <div className="flex gap-8">
                  <span className="badge badge-muted">Archived</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleUnarchive(project.id)}
                  >
                    Unarchive
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => { setConfirmAction({ type: 'delete', project }); setDeleteConfirmText(''); }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── ProjectCard ───────────────────────────────────────────────────────────

function ProjectCard({
  project, isActive, roundCount, decisionCount,
  onSwitch, onDuplicate, onArchive, onDelete, onNavigate,
}: {
  project: Project;
  isActive: boolean;
  roundCount: number;
  decisionCount: number;
  onSwitch: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onNavigate: (tab: string) => void;
}) {
  return (
    <div className="model-profile-card" style={{ marginBottom: 12 }}>
      <div className="model-profile-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="model-name truncate">{project.name}</div>
          <div className="text-xs text-muted mt-4">
            {project.currentPhase || 'No phase set'} ·
            {roundCount} round{roundCount !== 1 ? 's' : ''} ·
            {decisionCount} decision{decisionCount !== 1 ? 's' : ''}
          </div>
          <div className="text-xs text-muted">
            Updated {formatDisplay(project.updatedAt)}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {isActive ? (
            <span className="workflow-chip active">✓ Active</span>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={onSwitch}>
              Switch to This
            </button>
          )}
        </div>
      </div>

      {/* Action row */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {isActive && (
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('project-state')}>
            Edit State →
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onDuplicate} title="Duplicate project and all its rounds/decisions">
          Duplicate
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onArchive}>
          Archive
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <button
            className="btn btn-danger btn-sm"
            onClick={onDelete}
            style={{ fontSize: 11 }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
