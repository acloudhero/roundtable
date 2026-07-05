# Model Roundtable Console — Phase 5.1 Gemini Review Packet

**Purpose:** Architecture/safety review packet for Gemini 3 Thinking. This is not the full repo. It summarizes the GPT-5.5 review and embeds the most relevant Phase 5.1 excerpts.

**GPT-5.5 Gate Status:** Phase 5.1 passes the targeted durability cleanup gate, with one minor non-blocking UI markup note.

## Phase 5.1 Cleanup Goals

1. Fix README stale version contradiction.
2. Add distinct Mediator Packet Markdown export.
3. Make Markdown fencing robust against nested triple-backtick code fences.
4. Harden import referential-integrity validation, especially orphaned round project IDs.
5. Surface repair warnings before import confirmation.
6. Preserve local-first/manual workflow boundaries.

## Build Verification

- `npm ci`: pass
- `npm run build`: pass
- TypeScript errors: 0
- `package.json`: 0.5.0
- `package-lock.json`: 0.5.0
- Schema: 0.5.0
- API/backend/auth/scraping/cloud sync: none found

## Known Minor Non-Blocking Note

`ExportImportPanel.tsx` contains a duplicated nested `<ul>` wrapper around warnings. It does not break build or the Phase 5.1 durability gate, but it should be cleaned in the next polish pass.

## Questions for Gemini

1. Does the validation firewall now properly reject orphaned rounds instead of importing corrupt references?
2. Is the dynamic tilde-fencing helper sufficient for durable Markdown exports?
3. Is the distinct Mediator Packet export adequate for Phase 5?
4. Is Recovery Mode adequate for the current phase, given that it offers raw download, backup import, reset, and manual recovery instructions?
5. Should the duplicated warning-list `<ul>` be treated as a Phase 5.2 cleanup item or simply rolled into Phase 6 documentation/maintainability polish?

---

## Excerpt — Dynamic Markdown fencing helper

```ts
// src/utils/markdownExport.ts
// Purpose: Human-readable Markdown exports for review, handoff, and archiving
// Phase 5: multiple export types, fenced code blocks for user/model content
// Owned by: this file
// Used by: ExportImportPanel
//
// FENCING RULE: Large user-authored or model-authored content is wrapped in
// ```markdown ... ``` fenced blocks so embedded headings do not break export structure.
// Apply to: canonical state, prompts, model responses, mediator response, synthesis fields.

import { AppState } from '../types/appState';
import { Round, MediatorSynthesis } from '../types/round';
import { Project } from '../types/project';
import { Decision } from '../types/decision';
import { nowIso, formatDisplay } from './dateTime';
import { SCHEMA_VERSION } from '../config/exportFormats';

// ── Utilities ─────────────────────────────────────────────────────────────────

// fence() uses dynamic tilde fencing to safely wrap content that may itself
// contain triple-backtick code fences. We count the longest existing tilde
// run in the content and use at least 4 or one more than that.
function fence(content: string, lang = 'markdown'): string {
  if (!content || !content.trim()) return '_None_';
  const trimmed = content.trim();
  // Find the longest run of tildes already in the content
  const runs = trimmed.match(/~+/g) ?? [];
  const maxRun = runs.reduce((m, r) => Math.max(m, r.length), 0);
  const fenceLen = Math.max(4, maxRun + 1);
  const fence = '~'.repeat(fenceLen);
  return `${fence}${lang}\n${trimmed}\n${fence}`;
}

function exportHeader(title: string, exportedAt: string): string {
  return `# ${title}\n\n_Exported: ${formatDisplay(exportedAt)}_  \n_Schema: ${SCHEMA_VERSION}_\n\n---\n\n`;
}

// ── 1. Full Project History ───────────────────────────────────────────────────

export function exportProjectHistory(state: AppState): string {
```

## Excerpt — Distinct Mediator Packet Markdown export

```ts
// ── 8. Mediator Packet ────────────────────────────────────────────────────────
// Distinct export of the exact mediator packet sent to GPT-5.5 Thinking.
// Separate from the Current Round export — focused on the packet itself.

export function exportMediatorPacket(state: AppState): string {
  const now = nowIso();
  const project = state.projects.find((p) => p.id === state.activeProjectId);

  if (!project) {
    return exportHeader('Mediator Packet', now) + '_No active project found._\n';
  }

  const round = state.rounds
    .filter((r) => r.projectId === project.id)
    .sort((a, b) => b.roundNumber - a.roundNumber)[0];

  if (!round) {
    return exportHeader('Mediator Packet', now) + '_No rounds found for this project._\n';
  }

  const selectedModels = state.modelProfiles.filter((m) =>
    round.selectedModelIds.includes(m.id)
  );

  const collectedCount = round.modelResponses.filter(
    (r) => r.status === 'pasted' || r.status === 'reviewed'
  ).length;

  const rosterLines = selectedModels.map((m) => {
    const response = round.modelResponses.find((r) => r.modelProfileId === m.id);
    const status = (response?.status === 'pasted' || response?.status === 'reviewed')
      ? '✓ Response collected'
      : '✗ Response not collected';
    return `- **${m.displayName}** — ${m.roleName} [${status}]`;
  }).join('\n');

  return exportHeader(`Mediator Packet — ${project.name} Round ${round.roundNumber}`, now)
    + `## Project\n\n**Name:** ${project.name}  \n`
    + `**Phase:** ${project.currentPhase}  \n`
    + `**Round:** ${round.roundNumber}  \n`
    + `**Round Status:** ${round.locked ? '🔒 Locked' : '✏️ Active'}\n\n---\n\n`
    + `## Round Instruction\n\n${fence(round.userInstruction)}\n\n---\n\n`
    + `## Canonical State\n\n${fence(project.canonicalState)}\n\n---\n\n`
    + `## Selected Models (${selectedModels.length})\n\n${rosterLines || '_None._'}\n\n`
    + `**Response collection:** ${collectedCount}/${selectedModels.length}\n\n---\n\n`
    + (round.mediatorPrompt
      ? `## Mediator Packet (Sent to GPT-5.5 Thinking)\n\n${fence(round.mediatorPrompt)}\n\n---\n\n`
      : `## Mediator Packet\n\n_No mediator packet has been generated for this round yet._\n\n---\n\n`)
    + `_End of mediator packet export._\n`;
}

export function mediatorPacketFilename(state: AppState): string {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const safeName = (project?.name ?? 'Project').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const round = state.rounds
    .filter((r) => r.projectId === project?.id)
    .sort((a, b) => b.roundNumber - a.roundNumber)[0];
  const roundNum = round?.roundNumber ?? 0;
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `MRC_MEDIATOR_PACKET_${safeName}_Round-${roundNum}_${dateStamp}.md`;
}
```

## Excerpt — Import validation firewall, strict orphaned round rejection

```ts
// src/utils/validation.ts
// Purpose: Import validation — the application's firewall before any state overwrite
// Phase 5: full structural validation, referential integrity, soft-repair normalization
// Owned by: this file
// Used by: ExportImportPanel, jsonExport.ts
//
// Validation pipeline:
//   1. parseImportJson()       — raw text → parsed object or error
//   2. validateImportedState() — structural checks, returns errors[] + warnings[]
//   3. normalizeImportedState() — safe repairs, returns corrected AppState
//
// NEVER silently mutate user data. Every repair is explicit and logged in warnings[].

import { AppState } from '../types/appState';
import { SCHEMA_VERSION } from '../config/exportFormats';
import { nowIso } from './dateTime';

// ── Result types ──────────────────────────────────────────────────────────────

export interface ImportSummary {
  projectCount: number;
  roundCount: number;
  decisionCount: number;
  modelProfileCount: number;
  compatibilityNoteCount: number;
  promptTemplateCount: number;
  schemaVersion: string;
  exportedAt: string | null;
  detectedProjectNames: string[];
  importedActiveProjectId: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  repaired: boolean;
  summary: ImportSummary | null;
}

// ── Step 1: Parse ─────────────────────────────────────────────────────────────

export interface ParseResult {
  ok: boolean;
  raw: unknown;
  error: string | null;
}

export function parseImportJson(text: string): ParseResult {
  try {
    const raw = JSON.parse(text);
    return { ok: true, raw, error: null };
  } catch (e) {
    return { ok: false, raw: null, error: `JSON parse error: ${(e as Error).message}` };
  }
}

// ── Step 2: Extract AppState from any supported envelope ─────────────────────

export function extractAppState(raw: unknown): { state: unknown; exportedAt: string | null; exportType: string | null } {
  if (!raw || typeof raw !== 'object') {
    return { state: null, exportedAt: null, exportType: null };
  }
  const r = raw as Record<string, unknown>;

  // Phase 5 format: { exportType, payload: { appState } }
  if (r.exportType && r.payload && typeof r.payload === 'object') {
    const p = r.payload as Record<string, unknown>;
    return {
      state: p.appState ?? null,
      exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : null,
      exportType: typeof r.exportType === 'string' ? r.exportType : null,
    };
  }

  // Phase 3/4 format: { schemaVersion, exportedAt, appState }
  if (r.appState) {
    return {
      state: r.appState,
      exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : null,
      exportType: 'legacy',
    };
  }

  // Raw AppState (direct copy of stored state)
  if (r.schemaVersion && r.projects) {
    return { state: r, exportedAt: null, exportType: 'raw-appstate' };
  }

  return { state: null, exportedAt: null, exportType: null };
}

// ── Step 3: Validate ──────────────────────────────────────────────────────────

export function validateImportedState(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { state, exportedAt, exportType } = extractAppState(raw);

  if (!state || typeof state !== 'object') {
    errors.push('Could not locate appState in the import file. Check the file format.');
    return { valid: false, errors, warnings, repaired: false, summary: null };
  }

  const s = state as Record<string, unknown>;

  // Required top-level fields
  if (!s.schemaVersion) {
    warnings.push('Missing schemaVersion. File may be from an older version.');
  } else if (typeof s.schemaVersion === 'string' && s.schemaVersion !== SCHEMA_VERSION) {
    warnings.push(`Schema version mismatch: file is "${s.schemaVersion}", app is "${SCHEMA_VERSION}". Normalization will be applied.`);
  }

  // Required arrays
  const requiredArrays: (keyof AppState)[] = [
    'projects', 'modelProfiles', 'promptTemplates', 'rounds', 'decisions', 'compatibilityNotes',
  ];
  for (const key of requiredArrays) {
    if (!(key in s)) {
      warnings.push(`Missing "${key}" array — will be created as empty.`);
    } else if (!Array.isArray(s[key])) {
      errors.push(`"${key}" is not an array. File may be corrupt.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, repaired: false, summary: null };
  }

  const projects = s.projects as unknown[];
  const rounds = s.rounds as unknown[];
  const decisions = s.decisions as unknown[];
  const modelProfiles = s.modelProfiles as unknown[];
  const compatibilityNotes = s.compatibilityNotes as unknown[];
  const promptTemplates = s.promptTemplates as unknown[];

  // Referential integrity: activeProjectId
  const activeId = s.activeProjectId as string | null;
  const projectIds = new Set(projects.map((p: unknown) => (p as Record<string, string>).id).filter(Boolean));

  if (activeId && !projectIds.has(activeId)) {
    warnings.push(`activeProjectId "${activeId}" does not match any project. Will be set to first project.`);
  }

  // Round referential integrity — STRICT: orphaned rounds are rejected as errors
  const roundIds = new Set<string>();
  for (const round of rounds) {
    const r = round as Record<string, unknown>;
    const rid = typeof r.id === 'string' ? r.id : null;
    if (rid) roundIds.add(rid);

    // Strict: invalid projectId is a hard error — orphaned rounds corrupt project history
    if (typeof r.projectId !== 'string' || !projectIds.has(r.projectId)) {
      errors.push(
        `Round "${rid ?? '?'}" references project "${String(r.projectId ?? 'missing')}" ` +
        `which does not exist in this export. Import rejected — include the project or remove this round.`
      );
    }
    // Field-level repair warnings (soft — normalization will fix these)
    if (typeof r.locked !== 'boolean') {
      warnings.push(`Round "${rid ?? '?'}" missing/invalid locked field — will default to false.`);
    }
    if (!Array.isArray(r.generatedPrompts)) {
      warnings.push(`Round "${rid ?? '?'}" generatedPrompts not an array — will be repaired to [].`);
    }
    if (!Array.isArray(r.modelResponses)) {
      warnings.push(`Round "${rid ?? '?'}" modelResponses not an array — will be repaired to [].`);
    }
    if (!Array.isArray(r.selectedModelIds)) {
      warnings.push(`Round "${rid ?? '?'}" selectedModelIds not an array — will be repaired to [].`);
    }
  }

  // Decision referential integrity
  for (const dec of decisions) {
    const d = dec as Record<string, unknown>;
    const did = typeof d.id === 'string' ? d.id : '?';
    // Strict: invalid projectId on a decision is a hard error
    if (typeof d.projectId === 'string' && !projectIds.has(d.projectId)) {
      errors.push(
        `Decision "${did}" references project "${String(d.projectId)}" which does not exist. Import rejected.`
      );
    }
    // Warning only: broken roundId (decision text may still be usable)
    if (typeof d.roundId === 'string' && !roundIds.has(d.roundId)) {
      warnings.push(
        `Decision "${did}" references round "${d.roundId}" not found in this export. ` +
        `Decision will import but its round link will be broken.`
      );
    }
  }

  // Re-check after strict referential validation
  if (errors.length > 0) {
    return { valid: false, errors, warnings, repaired: false, summary: null };
  }

  if (exportType === 'legacy') {
    warnings.push('File uses a legacy export format from Phase 3/4. Content should import correctly.');
  }

  const detectedNames = projects
    .map((p: unknown) => (p as Record<string, string>).name)
    .filter((n): n is string => typeof n === 'string');

  const summary: ImportSummary = {
    projectCount: projects.length,
    roundCount: rounds.length,
    decisionCount: decisions.length,
```

## Excerpt — Normalization and repair reporting

```ts
    decisionCount: decisions.length,
    modelProfileCount: modelProfiles.length,
    compatibilityNoteCount: compatibilityNotes.length,
    promptTemplateCount: promptTemplates.length,
    schemaVersion: typeof s.schemaVersion === 'string' ? s.schemaVersion : 'unknown',
    exportedAt: exportedAt,
    detectedProjectNames: detectedNames,
    importedActiveProjectId: typeof s.activeProjectId === 'string' ? s.activeProjectId : null,
  };

  // Run a dry-run normalization to surface what repairs will occur
  // so the user can see them in the import preview before confirming.
  if (errors.length === 0) {
    try {
      const { repairs } = normalizeImportedState(raw);
      if (repairs.length > 0) {
        warnings.push(...repairs.map((r) => `[Auto-repair] ${r}`));
      }
    } catch {
      warnings.push('[Auto-repair] Could not preview normalization repairs — proceed with caution.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    repaired: false,
    summary,
  };
}

// ── Step 4: Normalize (safe repairs) ─────────────────────────────────────────
//
// SAFE repairs only. Never fabricate substantive content.
// Every repair logged. Returns a clean AppState.

export function normalizeImportedState(raw: unknown): { state: AppState; repairs: string[] } {
  const repairs: string[] = [];
  const { state } = extractAppState(raw);
  const s = (state ?? {}) as Record<string, unknown>;

  const now = nowIso();

  // ── Projects ───────────────────────────────────────────────────────────────
  const projects = Array.isArray(s.projects) ? s.projects : [];
  if (!Array.isArray(s.projects)) repairs.push('Created empty projects array.');

  const normalizedProjects = projects.map((p: unknown, i: number) => {
    const proj = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const r: Record<string, unknown> = {
      id: proj.id ?? `recovered-proj-${i}`,
      name: proj.name ?? '(Recovered Project)',
      description: proj.description ?? '',
      currentPhase: proj.currentPhase ?? '',
      canonicalState: proj.canonicalState ?? '',
      createdAt: typeof proj.createdAt === 'string' ? proj.createdAt : now,
      updatedAt: typeof proj.updatedAt === 'string' ? proj.updatedAt : now,
    };
    return r;
  });

  const projectIdSet = new Set(normalizedProjects.map((p) => p.id as string));

  // ── Active project ─────────────────────────────────────────────────────────
  let activeProjectId = typeof s.activeProjectId === 'string' ? s.activeProjectId : null;
  if (activeProjectId && !projectIdSet.has(activeProjectId)) {
    const fallback = normalizedProjects[0]?.id ?? null;
    repairs.push(`activeProjectId "${activeProjectId}" not found — set to "${fallback}".`);
    activeProjectId = fallback as string | null;
  }

  // ── Rounds ─────────────────────────────────────────────────────────────────
  const rounds = Array.isArray(s.rounds) ? s.rounds : [];
  if (!Array.isArray(s.rounds)) repairs.push('Created empty rounds array.');

  const normalizedRounds = rounds.map((r: unknown) => {
    const round = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const generatedPrompts = Array.isArray(round.generatedPrompts)
      ? round.generatedPrompts.map((gp: unknown) => {
          const p = (gp && typeof gp === 'object' ? gp : {}) as Record<string, unknown>;
          return {
            id: p.id ?? `gp-${Math.random().toString(36).slice(2,7)}`,
            modelProfileId: p.modelProfileId ?? p.modelId ?? '',
            modelDisplayName: p.modelDisplayName ?? '',
            promptText: p.promptText ?? '',
            generatedAt: typeof p.generatedAt === 'string' ? p.generatedAt : now,
            copiedAt: typeof p.copiedAt === 'string' ? p.copiedAt : undefined,
            status: p.status ?? (p.copiedAt ? 'copied' : 'generated'),
          };
        })
      : [];

    const modelResponses = Array.isArray(round.modelResponses)
      ? round.modelResponses.map((mr: unknown) => {
          const resp = (mr && typeof mr === 'object' ? mr : {}) as Record<string, unknown>;
          const hasText = typeof resp.responseText === 'string' && (resp.responseText as string).trim().length > 0;
          return {
            id: resp.id ?? `mr-${Math.random().toString(36).slice(2,7)}`,
            modelProfileId: resp.modelProfileId ?? resp.modelId ?? '',
            modelDisplayName: resp.modelDisplayName ?? '',
            responseText: typeof resp.responseText === 'string' ? resp.responseText : '',
            pastedAt: typeof resp.pastedAt === 'string' ? resp.pastedAt : (hasText ? now : undefined),
            status: resp.status ?? (hasText ? 'pasted' : 'awaiting_response'),
          };
        })
      : [];

    // Normalize mediatorSynthesis
    let mediatorSynthesis: Record<string, unknown> | undefined = undefined;
    if (round.mediatorSynthesis && typeof round.mediatorSynthesis === 'object') {
      const ms = round.mediatorSynthesis as Record<string, unknown>;
      mediatorSynthesis = {
        executiveSummary: ms.executiveSummary ?? '',
        agreements: ms.agreements ?? '',
        disagreements: ms.disagreements ?? '',
        risks: ms.risks ?? '',
        openQuestions: ms.openQuestions ?? '',
        modelSpecificObservations: ms.modelSpecificObservations ?? '',
        recommendedDecision: ms.recommendedDecision ?? '',
        decisionRationale: ms.decisionRationale ?? '',
        proposedCanonicalStateUpdate: ms.proposedCanonicalStateUpdate ?? '',
        proposedNextActions: ms.proposedNextActions ?? '',
        proposedNextRoundPrompt: ms.proposedNextRoundPrompt ?? '',
        confidenceCaveats: ms.confidenceCaveats ?? '',
        updatedAt: typeof ms.updatedAt === 'string' ? ms.updatedAt : now,
      };
    }

    return {
      id: round.id ?? `recovered-round-${Math.random().toString(36).slice(2,7)}`,
      projectId: round.projectId ?? activeProjectId ?? '',
      roundNumber: typeof round.roundNumber === 'number' ? round.roundNumber : 0,
      phase: typeof round.phase === 'string' ? round.phase : '',
      userInstruction: typeof round.userInstruction === 'string' ? round.userInstruction : '',
      selectedModelIds: Array.isArray(round.selectedModelIds) ? round.selectedModelIds : [],
      generatedPrompts,
      modelResponses,
      mediatorPrompt: typeof round.mediatorPrompt === 'string' ? round.mediatorPrompt : '',
      mediatorResponse: typeof round.mediatorResponse === 'string' ? round.mediatorResponse : '',
      mediatorSynthesis,
      userDecision: typeof round.userDecision === 'string' ? round.userDecision : '',
      canonicalStateUpdate: typeof round.canonicalStateUpdate === 'string' ? round.canonicalStateUpdate : '',
      agreements: Array.isArray(round.agreements) ? round.agreements : [],
      disagreements: Array.isArray(round.disagreements) ? round.disagreements : [],
      risks: Array.isArray(round.risks) ? round.risks : [],
      openQuestions: Array.isArray(round.openQuestions) ? round.openQuestions : [],
      nextActions: Array.isArray(round.nextActions) ? round.nextActions : [],
      locked: typeof round.locked === 'boolean' ? round.locked : false,
      createdAt: typeof round.createdAt === 'string' ? round.createdAt : now,
      updatedAt: typeof round.updatedAt === 'string' ? round.updatedAt : now,
    };
  });

  // ── Decisions ──────────────────────────────────────────────────────────────
  const decisions = Array.isArray(s.decisions) ? s.decisions : [];
  if (!Array.isArray(s.decisions)) repairs.push('Created empty decisions array.');

  // ── Other arrays ───────────────────────────────────────────────────────────
  const modelProfiles = Array.isArray(s.modelProfiles) ? s.modelProfiles : [];
  const promptTemplates = Array.isArray(s.promptTemplates) ? s.promptTemplates : [];
  const compatibilityNotes = Array.isArray(s.compatibilityNotes) ? s.compatibilityNotes : [];
  if (!Array.isArray(s.modelProfiles)) repairs.push('Created empty modelProfiles array.');
  if (!Array.isArray(s.promptTemplates)) repairs.push('Created empty promptTemplates array.');
  if (!Array.isArray(s.compatibilityNotes)) repairs.push('Created empty compatibilityNotes array.');

  const normalizedState: AppState = {
    schemaVersion: SCHEMA_VERSION,
    activeProjectId,
    projects: normalizedProjects as unknown as AppState['projects'],
    modelProfiles: modelProfiles as AppState['modelProfiles'],
    promptTemplates: promptTemplates as AppState['promptTemplates'],
    rounds: normalizedRounds as AppState['rounds'],
    decisions: decisions as AppState['decisions'],
    compatibilityNotes: compatibilityNotes as AppState['compatibilityNotes'],
    updatedAt: now,
  };

  return { state: normalizedState, repairs };
}
```

## Excerpt — ExportImportPanel import/export flow setup

```tsx
// src/components/ExportImportPanel.tsx
// Purpose: Full export/import panel — Phase 5 "Zero Data Loss Cockpit"
// Phase 5: import preview/diff, backup-before-import, multiple Markdown exports
// Owned by: this file
// Used by: App.tsx

import { useState, useRef } from 'react';
import { AppState } from '../types/appState';
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
} from '../utils/markdownExport';
import {
  parseImportJson,
  validateImportedState,
  normalizeImportedState,
  ImportSummary,
  ValidationResult,
} from '../utils/validation';
import { nowIso, formatDisplay } from '../utils/dateTime';
import { INITIAL_APP_STATE } from '../data/initialAppState';
import { localStorageAdapter } from '../storage/localStorageAdapter';

interface Props {
  state: AppState;
  onUpdate: (updated: Partial<AppState>) => void;
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

  const project = state.projects.find((p) => p.id === state.activeProjectId);

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
      setValidationResult({ valid: false, errors: [error ?? 'Unknown parse error'], warnings: [], repaired: false, summary: null });
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
```

## Excerpt — Markdown export buttons including Mediator Packet

```tsx
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

          <div className="grid-2">
            {[
              { label: 'Full Project History', desc: 'All rounds, prompts, responses, decisions', fn: () => mdDownload(exportProjectHistory(state), historyFilename(state)) },
              { label: 'Project Summary', desc: 'Status, canonical state, open questions, risks', fn: () => mdDownload(exportProjectSummary(state), `MRC_SUMMARY_${dateStamp()}.md`) },
              { label: 'Current Round', desc: 'Latest round — prompts, responses, synthesis', fn: () => mdDownload(exportCurrentRound(state), `MRC_ROUND_current_${dateStamp()}.md`) },
              { label: 'Decision Log', desc: 'All decisions with rationale and canonical updates', fn: () => mdDownload(exportDecisionLog(state), decisionLogFilename(state)) },
              { label: 'Compatibility Notes', desc: 'All model compatibility notes by status', fn: () => mdDownload(exportCompatibilityNotes(state), `MRC_COMPATIBILITY_NOTES_${dateStamp()}.md`) },
              { label: 'Model Roster', desc: 'All model profiles with role prompts', fn: () => mdDownload(exportModelRoster(state), `MRC_MODEL_ROSTER_${dateStamp()}.md`) },
              { label: 'Prompt Library', desc: 'All prompt templates', fn: () => mdDownload(exportPromptLibrary(state), `MRC_PROMPT_LIBRARY_${dateStamp()}.md`) },
              { label: 'Mediator Packet', desc: 'Exact GPT-5.5 mediator packet for the latest/current round', fn: () => mdDownload(exportMediatorPacket(state), mediatorPacketFilename(state)) },
            ].map((item) => (
              <div className="card" key={item.label} style={{ marginBottom: 0 }}>
                <div className="card-title mb-4" style={{ fontSize: 11 }}>{item.label}</div>
                <p className="text-xs text-muted mb-8">{item.desc}</p>
                <button className="btn btn-secondary text-xs" onClick={item.fn} style={{ width: '100%', padding: '6px 10px' }}>
                  Download
                </button>
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
```

## Excerpt — Import preview, warnings, backup, confirm gate

```tsx
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

              {validationResult.errors.length > 0 && (
                <div className="notice danger mb-12">
                  <strong>Errors (must fix before import):</strong>
                  <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                    {validationResult.errors.map((e, i) => <li key={i} className="text-xs">{e}</li>)}
                  </ul>
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div className="notice mb-12">
                  <strong>Warnings:</strong>
                  <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                    {validationResult.warnings.map((w, i) => <li key={i} className="text-xs">{w}</li>)}
                  </ul>
                </div>
              )}

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
```

## Excerpt — Recovery Mode panel

```tsx
// src/components/RecoveryPanel.tsx
// Purpose: Recovery Mode — shown when localStorage contains malformed MRC data
// Phase 5: download raw corrupted data, reset to demo, import known good backup
// Owned by: this file
// Used by: App.tsx (shown instead of normal UI when recoveryMode is true)

import { useState } from 'react';
import { AppState } from '../types/appState';
import { INITIAL_APP_STATE } from '../data/initialAppState';
import { localStorageAdapter } from '../storage/localStorageAdapter';
import { downloadRawString } from '../utils/jsonExport';
import { parseImportJson, validateImportedState, normalizeImportedState } from '../utils/validation';

interface Props {
  corruptedRaw: string | null;
  error: string;
  onRestore: (state: AppState) => void;
}

export default function RecoveryPanel({ corruptedRaw, error, onRestore }: Props) {
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importOk, setImportOk] = useState<boolean | null>(null);

  const handleDownloadCorrupted = () => {
    if (!corruptedRaw) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadRawString(corruptedRaw, `mrc-corrupted-data-${ts}.txt`);
  };

  const handleReset = () => {
    if (!window.confirm('Reset to demo data? This will discard the corrupted data and load a fresh demo state.')) return;
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
          <div className="header-logo-mark" style={{ width: 48, height: 48, fontSize: 16, margin: '0 auto 12px' }}>MRC</div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--red)', marginBottom: 8 }}>
            Recovery Mode
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            MRC detected a problem loading your saved data.
          </p>
        </div>

        {/* Error detail */}
        <div className="notice danger mb-16">
          <strong>Error:</strong> {error}
        </div>

        {/* Actions */}
        <div className="card mb-16">
          <div className="card-title mb-12">Step 1 — Download Your Data</div>
          <p className="text-sm text-muted mb-12">
            Download the raw stored data before taking any action. Even if it appears corrupted,
            it may contain recoverable content.
          </p>
          <button
            className="btn btn-secondary"
            onClick={handleDownloadCorrupted}
            disabled={!corruptedRaw}
            style={{ width: '100%' }}
          >
            {corruptedRaw ? 'Download Raw Corrupted Data' : 'No raw data available'}
          </button>
        </div>

        <div className="card mb-16">
          <div className="card-title mb-12">Step 2 — Import a Known Good Backup</div>
          <p className="text-sm text-muted mb-12">
            Paste the contents of a previously exported MRC JSON backup.
          </p>
          <textarea
            className="form-textarea large"
            placeholder="Paste your MRC JSON backup here…"
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

        <div className="card mb-16">
          <div className="card-title mb-12">Step 3 — Reset to Demo Data</div>
          <p className="text-sm text-muted mb-12">
            Clears all stored data and loads a fresh demo project. Use only if you have no backup to restore.
          </p>
          <button className="btn btn-danger" onClick={handleReset} style={{ width: '100%' }}>
            Reset to Demo Data (Data Loss Warning)
          </button>
        </div>

        {/* Manual steps */}
        <div className="notice info text-xs">
          <strong>Manual recovery steps:</strong> Open browser DevTools → Application → Local Storage →
          find key <code>mrc.appState.v0</code> → copy the value → paste into Step 2 above after repairing
          any malformed JSON. Alternatively, clear the key and reload to start fresh.
        </div>
      </div>
    </div>
  );
}
```

## Excerpt — Storage adapter recovery methods

```ts
// src/storage/localStorageAdapter.ts
// Purpose: localStorage implementation of StorageAdapter + recovery utilities
// Phase 5: added loadRaw(), loadWithRecovery() for malformed-data detection
// Owned by: this file
// Used by: App.tsx
//
// To replace localStorage with IndexedDB:
//   Create indexedDbAdapter.ts implementing StorageAdapter, swap in App.tsx.
//   This file stays unchanged.

import { AppState } from '../types/appState';
import { StorageAdapter } from './storageAdapter';
import { STORAGE_KEY } from '../config/exportFormats';

export interface StorageLoadResult {
  state: AppState | null;
  rawValue: string | null;
  error: string | null;
  wasCorrupted: boolean;
}

export const localStorageAdapter: StorageAdapter & {
  loadRaw: () => string | null;
  loadWithRecovery: () => StorageLoadResult;
  preserveCorrupted: (raw: string) => void;
} = {
  load(): AppState | null {
    const result = this.loadWithRecovery();
    return result.state;
  },

  loadRaw(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },

  loadWithRecovery(): StorageLoadResult {
    let rawValue: string | null = null;
    try {
      rawValue = localStorage.getItem(STORAGE_KEY);
      if (!rawValue) {
        return { state: null, rawValue: null, error: null, wasCorrupted: false };
      }
      const parsed = JSON.parse(rawValue) as AppState;
      // Basic sanity check
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.projects)) {
        return {
          state: null,
          rawValue,
          error: 'Stored data failed sanity check (missing projects array).',
          wasCorrupted: true,
        };
      }
      return { state: parsed, rawValue, error: null, wasCorrupted: false };
    } catch (err) {
      return {
        state: null,
        rawValue,
        error: `Failed to parse stored data: ${(err as Error).message}`,
        wasCorrupted: true,
      };
    }
  },

  // Preserve the raw corrupted string under a separate key so the user can download it
  preserveCorrupted(raw: string): void {
    try {
      const key = `${STORAGE_KEY}.corrupted.${Date.now()}`;
      localStorage.setItem(key, raw);
    } catch { /* storage full — can't preserve */ }
  },

  save(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('[MRC] Failed to save state to localStorage:', err);
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('[MRC] Failed to clear localStorage:', err);
    }
  },
};
```

## Excerpt — README current version block

```md

---

## Version

`0.5.0` (Phase 5) · Schema: `0.5.0` · Storage key: `mrc.appState.v0`
```
