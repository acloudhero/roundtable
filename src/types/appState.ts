// src/types/appState.ts
// Purpose: Top-level AppState shape — single object for storage, export, and import
// Owned by: this file
// Used by: storageAdapter, App.tsx, all panels (via context or props)
//
// Phase 7B note: `promptWrappers` is a new top-level array introduced
// in schema 0.8.0. Older 0.7.0 imports default it to the canonical
// PromptWrapper set during migration (surfaced as a MigrationNotice).
//
// v0.11.0 note (Markdown Handoff Mode): `rawNotes` and `importHistory`
// are new top-level arrays. They are bounded ring buffers (caps in
// src/config/markdownHandoff.ts). Migration migrate_0_10_5_to_0_11_0
// defaults both to [].
//
// Safe edits: add new optional top-level arrays; bump SCHEMA_VERSION.
// Unsafe edits: restructuring or renaming top-level keys breaks
//               existing localStorage data.

import { Project } from './project';
import { ModelProfile } from './modelProfile';
import { PromptTemplate } from './promptTemplate';
import { PromptWrapper } from './promptWrapper';
import { Round } from './round';
import { Decision } from './decision';
import { CompatibilityNote } from './compatibilityNote';
import { RawNote, ImportTransaction } from './markdownArtifact';

export interface AppState {
  schemaVersion: string;
  activeProjectId: string | null;
  projects: Project[];
  modelProfiles: ModelProfile[];
  promptTemplates: PromptTemplate[];
  /** Phase 7B: vendor-specific framing layer. */
  promptWrappers: PromptWrapper[];
  rounds: Round[];
  decisions: Decision[];
  compatibilityNotes: CompatibilityNote[];
  /** v0.11.0: Markdown Handoff Mode fallback substrate.
   *  Any import that can't safely commit lands here verbatim. Bounded
   *  ring buffer; oldest entries pruned with a banner. */
  rawNotes: RawNote[];
  /** v0.11.0: Markdown Handoff Mode commit log.
   *  Each entry records a pre-import snapshot of the affected AppState
   *  slice so the most-recent un-rolled-back commit can be undone.
   *  Bounded ring buffer. */
  importHistory: ImportTransaction[];
  updatedAt: string;
}

/**
 * Argument accepted by the App-level `onUpdate` callback.
 *
 * - `Partial<AppState>`: legacy form. Suitable when the update does not
 *   need to read the latest state (e.g. setting `activeProjectId`).
 * - Functional form `(prev: AppState) => Partial<AppState>`: required
 *   when the update is computed from the round/responses/etc. that may
 *   have just been updated by a sibling dispatch in the same React
 *   batch (v0.10.4: fixes the textarea-onBlur + status-button-onClick
 *   race where two dispatches in the same gesture overwrote each
 *   other's `rounds` slice).
 *
 * Both forms are merged into prev via `{ ...prev, ...partial }` in
 * App.tsx's onUpdate. Components that compose round mutations should
 * prefer the functional form via the helpers in `utils/roundUtils.ts`
 * (e.g. `updateRoundFunctional`).
 */
export type AppStateUpdater =
  | Partial<AppState>
  | ((prev: AppState) => Partial<AppState>);
