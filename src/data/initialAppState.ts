// src/data/initialAppState.ts
// Purpose: Initial AppState used when no stored state is found
// Owned by: this file
// Used by: App.tsx via storageAdapter.load()
// Safe edits: update demo data, add demo decisions or compatibility notes
// Unsafe edits: changing schemaVersion here must match config/exportFormats.ts SCHEMA_VERSION

import { AppState } from '../types/appState';
import { Decision } from '../types/decision';
import { DEMO_PROJECT } from './demoProject';
import { DEMO_ROUNDS } from './demoRounds';
import { DEFAULT_MODEL_PROFILES } from '../config/modelProfiles';
import { DEFAULT_PROMPT_TEMPLATES } from '../config/promptTemplates';
import { DEFAULT_PROMPT_WRAPPERS } from '../config/promptWrappers';
import { DEFAULT_COMPATIBILITY_NOTES } from '../config/compatibilityNotes';
import { SCHEMA_VERSION } from '../config/exportFormats';

const DEMO_DECISIONS: Decision[] = [
  {
    id: 'dec_001',
    projectId: 'proj_demo_001',
    roundId: 'round_001',
    decisionText: 'Adopt single AppState object with storage adapter interface. Add locked field to Round type.',
    rationale: 'Simplifies JSON export/import. Storage adapter allows future IndexedDB upgrade. Locked field prevents accidental history rewrites.',
    createdAt: '2026-05-07T15:30:00Z',
    phase: 'Phase 1 — Architecture',
    nextAction: 'Build Phase 2 scaffold',
  },
];

export const INITIAL_APP_STATE: AppState = {
  schemaVersion: SCHEMA_VERSION,
  activeProjectId: DEMO_PROJECT.id,
  projects: [DEMO_PROJECT],
  modelProfiles: DEFAULT_MODEL_PROFILES,
  promptTemplates: DEFAULT_PROMPT_TEMPLATES,
  promptWrappers: DEFAULT_PROMPT_WRAPPERS,
  rounds: DEMO_ROUNDS,
  decisions: DEMO_DECISIONS,
  compatibilityNotes: DEFAULT_COMPATIBILITY_NOTES,
  // v0.11.0: Markdown Handoff Mode — both default to []. Pre-v0.11.0
  // localStorage states pass through migrate_0_10_5_to_0_11_0 which
  // performs the same defaulting.
  rawNotes: [],
  importHistory: [],
  updatedAt: new Date().toISOString(),
};
