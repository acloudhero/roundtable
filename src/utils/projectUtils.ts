// src/utils/projectUtils.ts
// Purpose: Pure project lifecycle utility functions — create, duplicate, archive, delete
// Owned by: this file
// Used by: ProjectManagerPanel, App.tsx
// Safe edits: add utility functions
// Unsafe edits: never call StorageAdapter here — return new AppState slices only
//
// All functions are pure: they receive AppState and return Partial<AppState>.
// Components call onUpdate() with the returned values.
//
// v0.10.2: archiveProject() and deleteProject() now guarantee activeProjectId
// is never left null. If the last active project is removed, a blank fallback
// project is created automatically.

import { AppState } from '../types/appState';
import { Project } from '../types/project';
import { Round } from '../types/round';
import { Decision } from '../types/decision';
import { generateId } from './id';
import { nowIso } from './dateTime';

// Shared blank canonical state for new / fallback projects
const BLANK_CANONICAL = `## Canonical Project State

**Stack:** (to be defined)

**What exists:**
- (none yet)

**Constraints:**
- Local-first, no API calls, manual copy/paste workflow

**Open Questions:**
- (none yet)
`;

// ── Internal: make a fresh blank project object ────────────────────────────

function makeBlankProject(name = 'Untitled Project'): Project {
  return {
    id: generateId('proj'),
    name,
    description: '',
    currentPhase: 'Planning',
    canonicalState: BLANK_CANONICAL,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    archived: false,
    archivedAt: null,
  };
}

// ── Internal: guarantee a valid non-archived activeProjectId ───────────────
// After a mutating operation (archive / delete), pick another active project
// or create a blank fallback. Never returns null.

function resolveActiveId(
  updatedProjects: Project[],
  preferredId: string | null,    // current activeProjectId before mutation
  excludeId: string,             // the project being archived/deleted
): { projects: Project[]; activeProjectId: string } {
  // 1. If preferred is already valid and not the excluded one, keep it
  if (preferredId && preferredId !== excludeId) {
    const still = updatedProjects.find((p) => p.id === preferredId && !p.archived);
    if (still) return { projects: updatedProjects, activeProjectId: preferredId };
  }
  // 2. Switch to any other non-archived project
  const next = updatedProjects.find((p) => !p.archived && p.id !== excludeId);
  if (next) return { projects: updatedProjects, activeProjectId: next.id };
  // 3. No active projects remain — create a blank fallback
  const fallback = makeBlankProject();
  return {
    projects: [...updatedProjects, fallback],
    activeProjectId: fallback.id,
  };
}

// ── Create New Project ─────────────────────────────────────────────────────

export function createNewProject(
  name: string,
  currentState: AppState
): Partial<AppState> {
  const project = makeBlankProject(name.trim() || 'Untitled Project');
  return {
    projects: [...currentState.projects, project],
    activeProjectId: project.id,
  };
}

// ── Duplicate Project ──────────────────────────────────────────────────────
// Deep-copies project + all its rounds + decisions with fresh IDs.
// No orphaned rounds or decisions are ever created.

export function duplicateProject(
  projectId: string,
  currentState: AppState
): Partial<AppState> {
  const source = currentState.projects.find((p) => p.id === projectId);
  if (!source) return {};

  const newProjectId = generateId('proj');
  const now = nowIso();

  const roundIdMap = new Map<string, string>();
  const sourceRounds = currentState.rounds.filter((r) => r.projectId === projectId);
  const newRounds: Round[] = sourceRounds.map((r) => {
    const newId = generateId('round');
    roundIdMap.set(r.id, newId);
    return { ...r, id: newId, projectId: newProjectId, createdAt: now, updatedAt: now };
  });

  const sourceDecisions = currentState.decisions.filter((d) => d.projectId === projectId);
  const newDecisions: Decision[] = sourceDecisions.map((d) => ({
    ...d,
    id: generateId('dec'),
    projectId: newProjectId,
    roundId: roundIdMap.get(d.roundId) ?? d.roundId,
    createdAt: now,
  }));

  const newProject: Project = {
    ...source,
    id: newProjectId,
    name: `${source.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
    archived: false,
    archivedAt: null,
  };

  return {
    projects: [...currentState.projects, newProject],
    rounds: [...currentState.rounds, ...newRounds],
    decisions: [...currentState.decisions, ...newDecisions],
    activeProjectId: newProjectId,
  };
}

// ── Archive / Unarchive ────────────────────────────────────────────────────
// v0.10.2: if the active project is the only active project, a blank fallback
// is created automatically — activeProjectId is never left null.

export function archiveProject(
  projectId: string,
  currentState: AppState
): Partial<AppState> {
  const now = nowIso();
  const updatedProjects = currentState.projects.map((p) =>
    p.id === projectId ? { ...p, archived: true, archivedAt: now, updatedAt: now } : p
  );

  if (currentState.activeProjectId !== projectId) {
    // Active project unchanged — no fallback needed
    return { projects: updatedProjects };
  }

  const { projects: finalProjects, activeProjectId } = resolveActiveId(
    updatedProjects,
    currentState.activeProjectId,
    projectId
  );

  return { projects: finalProjects, activeProjectId };
}

export function unarchiveProject(
  projectId: string,
  currentState: AppState
): Partial<AppState> {
  const updatedProjects = currentState.projects.map((p) =>
    p.id === projectId ? { ...p, archived: false, archivedAt: null, updatedAt: nowIso() } : p
  );
  return { projects: updatedProjects };
}

// ── Delete Project ─────────────────────────────────────────────────────────
// Deletes project + all its rounds + all its decisions.
// Global modelProfiles, promptTemplates, promptWrappers, compatibilityNotes are NOT touched.
// v0.10.2: if the deleted project was the only active project, a blank fallback
// is created automatically — activeProjectId is never left null.

export function deleteProject(
  projectId: string,
  currentState: AppState
): Partial<AppState> {
  const updatedProjects  = currentState.projects.filter((p)  => p.id !== projectId);
  const updatedRounds    = currentState.rounds.filter((r)    => r.projectId !== projectId);
  const updatedDecisions = currentState.decisions.filter((d) => d.projectId !== projectId);

  const { projects: finalProjects, activeProjectId } = resolveActiveId(
    updatedProjects,
    currentState.activeProjectId,
    projectId
  );

  return {
    projects:   finalProjects,
    rounds:     updatedRounds,
    decisions:  updatedDecisions,
    activeProjectId,
  };
}

// ── Switch Active Project ──────────────────────────────────────────────────

export function switchActiveProject(projectId: string): Partial<AppState> {
  return { activeProjectId: projectId };
}

// ── Filtered selectors ─────────────────────────────────────────────────────

export function getActiveProjects(state: AppState): Project[] {
  return state.projects.filter((p) => !p.archived);
}

export function getArchivedProjects(state: AppState): Project[] {
  return state.projects.filter((p) => p.archived);
}
