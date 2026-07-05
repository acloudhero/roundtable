// src/utils/jsonExport.ts
// Purpose: JSON export/import utilities — Phase 5 envelope format
// Phase 5: standardized export envelope, backup-before-import, safe filenames
// Owned by: this file
// Used by: ExportImportPanel

import { AppState } from '../types/appState';
import { SCHEMA_VERSION, APP_VERSION } from '../config/exportFormats';
import { nowIso } from './dateTime';

const APP_NAME = 'RoundTable';
// APP_VERSION imported from exportFormats.ts

// ── Export envelope ───────────────────────────────────────────────────────────

export interface MrcExportEnvelope {
  exportType: 'roundtable.fullProjectExport';
  schemaVersion: string;
  exportedAt: string;
  appName: string;
  appVersion: string;
  source: 'local-browser';
  payload: {
    appState: AppState;
  };
}

export function createFullJsonExport(state: AppState): MrcExportEnvelope {
  return {
    exportType: 'roundtable.fullProjectExport',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    appName: APP_NAME,
    appVersion: APP_VERSION,
    source: 'local-browser',
    payload: { appState: state },
  };
}

export function serializeExport(envelope: MrcExportEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

// ── Filenames ─────────────────────────────────────────────────────────────────

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportFilename(state: AppState): string {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const name = project ? safeName(project.name) : 'Project';
  return `ROUNDTABLE_PROJECT_${name}_${dateStamp()}.json`;
}

export function backupFilename(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `roundtable-backup-before-import-${ts}.json`;
}

export function roundExportFilename(state: AppState, roundNumber: number): string {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const name = project ? safeName(project.name) : 'Project';
  return `ROUNDTABLE_ROUND_${name}_Round-${roundNumber}_${dateStamp()}.md`;
}

export function decisionLogFilename(state: AppState): string {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const name = project ? safeName(project.name) : 'Project';
  return `ROUNDTABLE_DECISIONS_${name}_${dateStamp()}.md`;
}

export function historyFilename(state: AppState): string {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const name = project ? safeName(project.name) : 'Project';
  return `ROUNDTABLE_HISTORY_${name}_${dateStamp()}.md`;
}

// ── Download helpers ──────────────────────────────────────────────────────────

export function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJsonExport(state: AppState): void {
  const envelope = createFullJsonExport(state);
  downloadText(serializeExport(envelope), exportFilename(state), 'application/json');
}

export function downloadBackup(state: AppState): void {
  const envelope = createFullJsonExport(state);
  downloadText(serializeExport(envelope), backupFilename(), 'application/json');
}

export function downloadRawString(raw: string, filename: string): void {
  downloadText(raw, filename, 'application/octet-stream');
}

// ── Legacy compat ─────────────────────────────────────────────────────────────
// Keep the old export function signature so existing callers don't break
export function exportAppStateJson(state: AppState): string {
  return serializeExport(createFullJsonExport(state));
}
