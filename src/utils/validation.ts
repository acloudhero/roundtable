// src/utils/validation.ts
// Purpose: Import validation pipeline — the application's firewall before any
//          state overwrite. This is the single chokepoint that protects local
//          state from malformed or hostile import payloads.
//
// What this file owns:
//   - VALIDATION_CODES (frozen object, Phase 7A)
//   - ValidationIssue / ValidationSeverity / ValidationResult types
//   - parseImportJson()        — raw text → parsed object or error
//   - extractAppState()        — locate the AppState inside any envelope shape
//   - validateImportedState()  — structural + referential checks
//   - normalizeImportedState() — safe repairs, returns clean AppState
//
// Pipeline (Phase 7A):
//   parseImportJson(text)
//     → extractAppState(raw)            // envelope-aware unwrap
//     → migrateAppState(state)          // version-up structural transforms
//     → validateImportedState           // structural + referential checks
//     → normalizeImportedState          // safe field-level defaults
//
// Phase 7A changes:
//   - VALIDATION_CODES is now a frozen object (`as const`) so codes have
//     runtime presence and a stable identity for tooling. ValidationCode
//     is derived from it as a literal union; existing string-literal
//     comparisons keep working.
//   - ValidationResult carries a new `migrations: MigrationNotice[]`
//     field separate from `issues[]`. Migrations are surfaced in the
//     import preview as their own group, distinct from validation
//     issues and auto-repairs.
//   - validateImportedState calls migrateAppState before structural
//     checks, so version-aware structural transforms run before
//     referential integrity is evaluated. The post-migration state is
//     what every subsequent check sees.
//   - normalizeImportedState also calls migrateAppState before
//     per-collection normalization, so the dry-run repair preview
//     reflects what will actually happen on confirm.
//   - Path-aware ValidationIssue: every site that has an accurate
//     dotted path supplies one (`rounds[3].projectId`, etc.). Paths
//     are not invented when they are not known.
//
// Phase 6 / 5.1 guarantees that MUST be preserved here:
//   1. Malformed JSON cannot crash the app (parseImportJson returns errors).
//   2. Malformed JSON cannot overwrite local state (UI gates on .valid).
//   3. Missing required arrays are caught or safely normalized.
//   4. Orphaned round.projectId references are HARD ERRORS.
//   5. Invalid decision.projectId references are HARD ERRORS.
//   6. Broken decision.roundId references are WARNINGS only.
//   7. Auto-repairs are surfaced as `[Auto-repair]` warnings before confirmation.
//   8. Normalization NEVER fabricates substantive content (decisions,
//      responses, mediator output, canonical state, descriptions).
//
// Common safe edits:
//   - Adding new VALIDATION_CODES entries for clearer messaging.
//   - Adding new normalize* helpers for new collections.
//   - Tightening field-level defaults in normalizers.
//
// Common unsafe edits:
//   - Removing the dry-run normalization preview from validate().
//   - Weakening referential integrity checks (rounds, decisions).
//   - Adding side effects (storage writes, network calls) — this file is pure.
//   - Inventing project content during repair.
//   - Skipping migration before validation/normalization.
//
// See also:
//   - docs/SCHEMA_EVOLUTION.md — when to bump SCHEMA_VERSION.
//   - docs/MAINTAINABILITY.md  — how this file fits into the import flow.
//   - src/utils/migration.ts   — how migrations are registered and chained.

import { AppState } from '../types/appState';
import { Project } from '../types/project';
import { Round, GeneratedPrompt, ModelResponse, MediatorSynthesis } from '../types/round';
import { Decision } from '../types/decision';
import { ModelProfile } from '../types/modelProfile';
import { PromptTemplate } from '../types/promptTemplate';
import { PromptWrapper } from '../types/promptWrapper';
import { CompatibilityNote } from '../types/compatibilityNote';
import { RawNote, ImportTransaction } from '../types/markdownArtifact';
import { SCHEMA_VERSION } from '../config/exportFormats';
import { nowIso } from './dateTime';
import { generateSafeId } from './id';
import { migrateAppState, MigrationNotice } from './migration';

// ── Issue typing (Phase 6) ───────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Stable codes for validation issues (Phase 7A: frozen-object form).
 *
 * Why frozen object instead of a plain string union:
 *   - Runtime presence: tooling can iterate codes, log them, group on
 *     them, or build maps keyed by code without re-declaring values.
 *   - Type-safety: `as const` keeps each value as a literal type, so
 *     ValidationCode below is still a strict union of those literals.
 *   - Stable identity: external consumers can import a single object
 *     instead of relying on string spelling.
 *
 * Adding new codes is safe. Renaming or removing existing codes is a
 * breaking change for any UI or tooling that filters on them. New
 * codes follow UPPER_SNAKE_CASE and are documented in
 * docs/SCHEMA_EVOLUTION.md.
 */
export const VALIDATION_CODES = {
  // Structural
  JSON_PARSE_FAILED: 'JSON_PARSE_FAILED',
  APP_STATE_MISSING: 'APP_STATE_MISSING',
  SCHEMA_MISSING: 'SCHEMA_MISSING',
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  // Raised when the import file declares a schemaVersion NEWER than this
  // app's SCHEMA_VERSION. Importing a future schema could silently discard
  // fields this version does not understand. Import must be rejected.
  UNSUPPORTED_SCHEMA_VERSION: 'UNSUPPORTED_SCHEMA_VERSION',
  EXPORT_TYPE_UNKNOWN: 'EXPORT_TYPE_UNKNOWN',
  LEGACY_FORMAT_DETECTED: 'LEGACY_FORMAT_DETECTED',
  REQUIRED_ARRAY_MISSING: 'REQUIRED_ARRAY_MISSING',
  REQUIRED_ARRAY_INVALID: 'REQUIRED_ARRAY_INVALID',
  // Referential integrity
  ORPHANED_ROUND: 'ORPHANED_ROUND',
  ORPHANED_DECISION_PROJECT: 'ORPHANED_DECISION_PROJECT',
  BROKEN_DECISION_ROUND_LINK: 'BROKEN_DECISION_ROUND_LINK',
  ACTIVE_PROJECT_REPAIRED: 'ACTIVE_PROJECT_REPAIRED',
  // Field-level repairs
  FIELD_DEFAULTED: 'FIELD_DEFAULTED',
  TIMESTAMP_DEFAULTED: 'TIMESTAMP_DEFAULTED',
  AUTO_REPAIR_APPLIED: 'AUTO_REPAIR_APPLIED',
} as const;

export type ValidationCode =
  typeof VALIDATION_CODES[keyof typeof VALIDATION_CODES];

export interface ValidationIssue {
  code: ValidationCode;
  severity: ValidationSeverity;
  message: string;
  /** Dotted path to the offending field, e.g. `rounds[3].projectId`.
   *  Only set when an accurate path is known — never invented. */
  path?: string;
}

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
  /** Phase 7A: source schemaVersion as detected during migration. */
  sourceSchemaVersion?: string;
}

/**
 * Validation result.
 *
 * Phase 6 transitional shape: `issues[]` is the typed surface,
 * while `errors[]` and `warnings[]` remain populated for backward
 * compatibility. Both views describe the same underlying issues.
 *
 * Phase 7A adds `migrations[]`: a separate stream of migration
 * notices produced by the migration engine before validation runs.
 * Migrations are NOT validation issues — they are version-up
 * structural transformations — and are rendered as their own group
 * in the import preview.
 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  migrations: MigrationNotice[];
  errors: string[];
  warnings: string[];
  repaired: boolean;
  summary: ImportSummary | null;
}

// ── Issue helpers ────────────────────────────────────────────────────────────

function pushIssue(
  issues: ValidationIssue[],
  code: ValidationCode,
  severity: ValidationSeverity,
  message: string,
  path?: string
): void {
  issues.push({ code, severity, message, path });
}

/**
 * Derive legacy errors[]/warnings[] string arrays from the typed issue list.
 * Kept so existing UI keeps working while we migrate to issue-level rendering.
 */
function splitIssues(issues: ValidationIssue[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const issue of issues) {
    if (issue.severity === 'error') errors.push(issue.message);
    else warnings.push(issue.message);
  }
  return { errors, warnings };
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

export function extractAppState(raw: unknown): {
  state: unknown;
  exportedAt: string | null;
  exportType: string | null;
} {
  if (!raw || typeof raw !== 'object') {
    return { state: null, exportedAt: null, exportType: null };
  }
  const r = raw as Record<string, unknown>;

  // Phase 5+ format: { exportType, payload: { appState } }
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
  const issues: ValidationIssue[] = [];

  const { state: extractedState, exportedAt, exportType } = extractAppState(raw);

  if (!extractedState || typeof extractedState !== 'object') {
    pushIssue(
      issues,
      VALIDATION_CODES.APP_STATE_MISSING,
      'error',
      'Could not locate appState in the import file. Check the file format.'
    );
    const split = splitIssues(issues);
    return {
      valid: false,
      issues,
      migrations: [],
      errors: split.errors,
      warnings: split.warnings,
      repaired: false,
      summary: null,
    };
  }

  // Phase 7A: migration runs before structural validation. The migration
  // engine emits its own MigrationNotice[] which we propagate into the
  // final ValidationResult separately from validation issues. The
  // migrated state is what the rest of validation works on.
  const envelopeWasLegacy = exportType === 'legacy';
  const migration = migrateAppState(extractedState, undefined, { envelopeWasLegacy });
  const migrations: MigrationNotice[] = migration.migrationsApplied;

  const s = (migration.state ?? {}) as Record<string, unknown>;
  const sourceSchemaVersion = migration.sourceVersion;

  // ── Newer-schema guard (HARD ERROR) ───────────────────────────────────────
  //
  // If the migration engine flagged SOURCE_NEWER_THAN_APP, the import file
  // declares a schemaVersion this app does not understand. Importing could
  // silently discard or corrupt fields that are meaningful to the newer
  // schema. Reject immediately with a HARD ERROR regardless of what the
  // structural checks might otherwise say.
  //
  // We check BOTH:
  //   (a) the migration notice — this is the migration engine's explicit flag
  //   (b) the post-migration schemaVersion — defense-in-depth for any path
  //       where the migration engine ran but notices were not produced
  const hasNewerNotice = migrations.some(
    (n) => n.code === 'SOURCE_NEWER_THAN_APP'
  );
  const postMigrationVersion = typeof s.schemaVersion === 'string' ? s.schemaVersion : null;
  const isNewerThanApp = (() => {
    if (!postMigrationVersion) return false;
    // Parse both versions and compare — reuse the same semver logic as migration.ts
    const parseV = (v: string) => { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v); return m ? [+m[1],+m[2],+m[3]] as [number,number,number] : null; };
    const src = parseV(postMigrationVersion);
    const tgt = parseV(SCHEMA_VERSION);
    if (!src || !tgt) return false;
    if (src[0] !== tgt[0]) return src[0] > tgt[0];
    if (src[1] !== tgt[1]) return src[1] > tgt[1];
    return src[2] > tgt[2];
  })();

  if (hasNewerNotice || isNewerThanApp) {
    const srcVer = postMigrationVersion ?? sourceSchemaVersion ?? 'unknown';
    pushIssue(
      issues,
      VALIDATION_CODES.UNSUPPORTED_SCHEMA_VERSION,
      'error',
      `This export uses schemaVersion "${srcVer}", which is newer than this app's supported version "${SCHEMA_VERSION}". ` +
        `Update RoundTable before importing this file.`,
      'schemaVersion'
    );
    // Surface error immediately — nothing further is safe to evaluate.
    const split = splitIssues(issues);
    return {
      valid: false,
      issues,
      migrations,
      errors: split.errors,
      warnings: split.warnings,
      repaired: false,
      summary: null,
    };
  }

  // Schema version check on the *post-migration* state (mismatch remains a
  // warning for same-or-older versions that couldn't be fully stamped).
  if (!s.schemaVersion) {
    pushIssue(
      issues,
      VALIDATION_CODES.SCHEMA_MISSING,
      'warning',
      'Missing schemaVersion after migration.',
      'schemaVersion'
    );
  } else if (typeof s.schemaVersion === 'string' && s.schemaVersion !== SCHEMA_VERSION) {
    pushIssue(
      issues,
      VALIDATION_CODES.SCHEMA_MISMATCH,
      'warning',
      `Schema version mismatch after migration: file is "${s.schemaVersion}", app is "${SCHEMA_VERSION}".`,
      'schemaVersion'
    );
  }

  // Required arrays
  const requiredArrays: (keyof AppState)[] = [
    'projects', 'modelProfiles', 'promptTemplates', 'promptWrappers', 'rounds', 'decisions', 'compatibilityNotes',
    // v0.11.0 — Markdown Handoff Mode. Both default to [] via the migration
    // step migrate_0_10_5_to_0_11_0 and via normalizers in this file.
    'rawNotes', 'importHistory',
  ];
  for (const key of requiredArrays) {
    if (!(key in s)) {
      pushIssue(
        issues,
        VALIDATION_CODES.REQUIRED_ARRAY_MISSING,
        'warning',
        `Missing "${key}" array — will be created as empty.`,
        String(key)
      );
    } else if (!Array.isArray(s[key])) {
      pushIssue(
        issues,
        VALIDATION_CODES.REQUIRED_ARRAY_INVALID,
        'error',
        `"${key}" is not an array. File may be corrupt.`,
        String(key)
      );
    }
  }

  // Bail early if structural errors exist — nothing further is meaningful.
  if (issues.some((i) => i.severity === 'error')) {
    const split = splitIssues(issues);
    return {
      valid: false,
      issues,
      migrations,
      errors: split.errors,
      warnings: split.warnings,
      repaired: false,
      summary: null,
    };
  }

  const projects = (s.projects as unknown[]) ?? [];
  const rounds = (s.rounds as unknown[]) ?? [];
  const decisions = (s.decisions as unknown[]) ?? [];
  const modelProfiles = (s.modelProfiles as unknown[]) ?? [];
  const compatibilityNotes = (s.compatibilityNotes as unknown[]) ?? [];
  const promptTemplates = (s.promptTemplates as unknown[]) ?? [];

  // Active project pointer
  const activeId = s.activeProjectId as string | null;
  const projectIds = new Set(
    projects.map((p: unknown) => (p as Record<string, string>).id).filter(Boolean)
  );

  if (activeId && !projectIds.has(activeId)) {
    pushIssue(
      issues,
      VALIDATION_CODES.ACTIVE_PROJECT_REPAIRED,
      'warning',
      `activeProjectId "${activeId}" does not match any project. Will be set to first project.`,
      'activeProjectId'
    );
  }

  // Round referential integrity — STRICT
  const roundIds = new Set<string>();
  rounds.forEach((round, idx) => {
    const r = round as Record<string, unknown>;
    const rid = typeof r.id === 'string' ? r.id : null;
    if (rid) roundIds.add(rid);

    if (typeof r.projectId !== 'string' || !projectIds.has(r.projectId)) {
      pushIssue(
        issues,
        VALIDATION_CODES.ORPHANED_ROUND,
        'error',
        `Round "${rid ?? '?'}" references project "${String(r.projectId ?? 'missing')}" ` +
          `which does not exist in this export. Import rejected — include the project or remove this round.`,
        `rounds[${idx}].projectId`
      );
    }

    // Field-level soft repairs — informational warnings; normalization handles them.
    if (typeof r.locked !== 'boolean') {
      pushIssue(
        issues,
        VALIDATION_CODES.FIELD_DEFAULTED,
        'warning',
        `Round "${rid ?? '?'}" missing/invalid locked field — will default to false.`,
        `rounds[${idx}].locked`
      );
    }
    if (!Array.isArray(r.generatedPrompts)) {
      pushIssue(
        issues,
        VALIDATION_CODES.FIELD_DEFAULTED,
        'warning',
        `Round "${rid ?? '?'}" generatedPrompts not an array — will be repaired to [].`,
        `rounds[${idx}].generatedPrompts`
      );
    }
    if (!Array.isArray(r.modelResponses)) {
      pushIssue(
        issues,
        VALIDATION_CODES.FIELD_DEFAULTED,
        'warning',
        `Round "${rid ?? '?'}" modelResponses not an array — will be repaired to [].`,
        `rounds[${idx}].modelResponses`
      );
    }
    if (!Array.isArray(r.selectedModelIds)) {
      pushIssue(
        issues,
        VALIDATION_CODES.FIELD_DEFAULTED,
        'warning',
        `Round "${rid ?? '?'}" selectedModelIds not an array — will be repaired to [].`,
        `rounds[${idx}].selectedModelIds`
      );
    }
  });

  // Decision referential integrity
  decisions.forEach((dec, idx) => {
    const d = dec as Record<string, unknown>;
    const did = typeof d.id === 'string' ? d.id : '?';

    // Strict: invalid projectId on a decision is a hard error.
    if (typeof d.projectId === 'string' && !projectIds.has(d.projectId)) {
      pushIssue(
        issues,
        VALIDATION_CODES.ORPHANED_DECISION_PROJECT,
        'error',
        `Decision "${did}" references project "${String(d.projectId)}" which does not exist. Import rejected.`,
        `decisions[${idx}].projectId`
      );
    }

    // Soft: broken roundId — decision text may still be usable.
    if (typeof d.roundId === 'string' && !roundIds.has(d.roundId)) {
      pushIssue(
        issues,
        VALIDATION_CODES.BROKEN_DECISION_ROUND_LINK,
        'warning',
        `Decision "${did}" references round "${d.roundId}" not found in this export. ` +
          `Decision will import but its round link will be broken.`,
        `decisions[${idx}].roundId`
      );
    }
  });

  // Re-check after referential validation
  if (issues.some((i) => i.severity === 'error')) {
    const split = splitIssues(issues);
    return {
      valid: false,
      issues,
      migrations,
      errors: split.errors,
      warnings: split.warnings,
      repaired: false,
      summary: null,
    };
  }

  if (exportType === 'legacy') {
    pushIssue(
      issues,
      VALIDATION_CODES.LEGACY_FORMAT_DETECTED,
      'warning',
      'File uses a legacy export format from Phase 3/4. Content should import correctly.'
    );
  }

  const detectedNames = projects
    .map((p: unknown) => (p as Record<string, string>).name)
    .filter((n): n is string => typeof n === 'string');

  const summary: ImportSummary = {
    projectCount: projects.length,
    roundCount: rounds.length,
    decisionCount: decisions.length,
    modelProfileCount: modelProfiles.length,
    compatibilityNoteCount: compatibilityNotes.length,
    promptTemplateCount: promptTemplates.length,
    schemaVersion: typeof s.schemaVersion === 'string' ? s.schemaVersion : 'unknown',
    exportedAt: exportedAt,
    detectedProjectNames: detectedNames,
    importedActiveProjectId: typeof s.activeProjectId === 'string' ? s.activeProjectId : null,
    sourceSchemaVersion,
  };

  // Dry-run normalization so the user sees repairs in the import preview
  // BEFORE confirming. This is part of the Phase 5.1 import-firewall contract.
  if (!issues.some((i) => i.severity === 'error')) {
    try {
      const { repairs } = normalizeImportedState(raw);
      for (const r of repairs) {
        pushIssue(issues, VALIDATION_CODES.AUTO_REPAIR_APPLIED, 'warning', `[Auto-repair] ${r}`);
      }
    } catch {
      pushIssue(
        issues,
        VALIDATION_CODES.AUTO_REPAIR_APPLIED,
        'warning',
        '[Auto-repair] Could not preview normalization repairs — proceed with caution.'
      );
    }
  }

  const split = splitIssues(issues);
  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
    migrations,
    errors: split.errors,
    warnings: split.warnings,
    repaired: false,
    summary,
  };
}

// ── Step 4: Normalize (safe repairs) ─────────────────────────────────────────
//
// Phase 6 split this into per-collection helpers. Behavior is preserved:
// SAFE repairs only, never fabricate substantive content, every repair logged.

interface NormalizeContext {
  repairs: string[];
  now: string;
}

function makeContext(): NormalizeContext {
  return { repairs: [], now: nowIso() };
}

// ── Projects ─────────────────────────────────────────────────────────────────

function normalizeProjects(s: Record<string, unknown>, ctx: NormalizeContext): Project[] {
  const raw = s.projects;
  const list = Array.isArray(raw) ? raw : [];
  if (!Array.isArray(raw)) ctx.repairs.push('Created empty projects array.');

  return list.map((p, i) => {
    const proj = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;

    // Recovered project IDs go through the central safe-ID utility (Phase 6.1)
    // so the same Web Crypto + fallback path used by prompts/responses/rounds
    // also covers projects. The repair is surfaced so the user sees that an
    // ID was minted on import — no project content is fabricated.
    let id: string;
    if (typeof proj.id === 'string' && proj.id.length > 0) {
      id = proj.id;
    } else {
      id = generateSafeId('recovered-proj');
      ctx.repairs.push(
        `Recovered missing project id at projects[${i}] using generateSafeId('recovered-proj').`
      );
    }

    return {
      id,
      name: (proj.name as string) ?? '(Recovered Project)',
      description: (proj.description as string) ?? '',
      currentPhase: (proj.currentPhase as string) ?? '',
      canonicalState: (proj.canonicalState as string) ?? '',
      createdAt: typeof proj.createdAt === 'string' ? (proj.createdAt as string) : ctx.now,
      updatedAt: typeof proj.updatedAt === 'string' ? (proj.updatedAt as string) : ctx.now,
      // v0.10.1 lifecycle fields — default for older exports
      archived: typeof proj.archived === 'boolean' ? (proj.archived as boolean) : false,
      archivedAt: typeof proj.archivedAt === 'string' ? (proj.archivedAt as string) : null,
    };
  });
}

// ── Active project pointer ───────────────────────────────────────────────────

function normalizeActiveProjectId(
  s: Record<string, unknown>,
  projects: Project[],
  ctx: NormalizeContext
): string | null {
  const projectIdSet = new Set(projects.map((p) => p.id));
  let activeProjectId = typeof s.activeProjectId === 'string' ? s.activeProjectId : null;

  if (activeProjectId && !projectIdSet.has(activeProjectId)) {
    const fallback = projects[0]?.id ?? null;
    ctx.repairs.push(`activeProjectId "${activeProjectId}" not found — set to "${fallback}".`);
    activeProjectId = fallback;
  }

  return activeProjectId;
}

// ── Rounds ───────────────────────────────────────────────────────────────────

function normalizeGeneratedPrompts(
  raw: unknown,
  ctx: NormalizeContext
): GeneratedPrompt[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((gp) => {
    const p = (gp && typeof gp === 'object' ? gp : {}) as Record<string, unknown>;
    return {
      id: (p.id as string) ?? generateSafeId('recovered-prompt'),
      modelProfileId: (p.modelProfileId as string) ?? (p.modelId as string) ?? '',
      modelDisplayName: (p.modelDisplayName as string) ?? '',
      promptText: (p.promptText as string) ?? '',
      generatedAt: typeof p.generatedAt === 'string' ? (p.generatedAt as string) : ctx.now,
      copiedAt: typeof p.copiedAt === 'string' ? (p.copiedAt as string) : undefined,
      status: ((p.status as GeneratedPrompt['status']) ??
        (p.copiedAt ? 'copied' : 'generated')) as GeneratedPrompt['status'],
    };
  });
}

function normalizeModelResponses(
  raw: unknown,
  ctx: NormalizeContext
): ModelResponse[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((mr) => {
    const resp = (mr && typeof mr === 'object' ? mr : {}) as Record<string, unknown>;
    const text = typeof resp.responseText === 'string' ? (resp.responseText as string) : '';
    const hasText = text.trim().length > 0;
    return {
      id: (resp.id as string) ?? generateSafeId('recovered-resp'),
      modelProfileId: (resp.modelProfileId as string) ?? (resp.modelId as string) ?? '',
      modelDisplayName: (resp.modelDisplayName as string) ?? '',
      responseText: text,
      pastedAt:
        typeof resp.pastedAt === 'string'
          ? (resp.pastedAt as string)
          : hasText
          ? ctx.now
          : undefined,
      status: ((resp.status as ModelResponse['status']) ??
        (hasText ? 'pasted' : 'awaiting_response')) as ModelResponse['status'],
    };
  });
}

function normalizeMediatorSynthesis(
  raw: unknown,
  ctx: NormalizeContext
): MediatorSynthesis | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ms = raw as Record<string, unknown>;
  return {
    executiveSummary: (ms.executiveSummary as string) ?? '',
    agreements: (ms.agreements as string) ?? '',
    disagreements: (ms.disagreements as string) ?? '',
    risks: (ms.risks as string) ?? '',
    openQuestions: (ms.openQuestions as string) ?? '',
    modelSpecificObservations: (ms.modelSpecificObservations as string) ?? '',
    recommendedDecision: (ms.recommendedDecision as string) ?? '',
    decisionRationale: (ms.decisionRationale as string) ?? '',
    proposedCanonicalStateUpdate: (ms.proposedCanonicalStateUpdate as string) ?? '',
    proposedNextActions: (ms.proposedNextActions as string) ?? '',
    proposedNextRoundPrompt: (ms.proposedNextRoundPrompt as string) ?? '',
    confidenceCaveats: (ms.confidenceCaveats as string) ?? '',
    updatedAt: typeof ms.updatedAt === 'string' ? (ms.updatedAt as string) : ctx.now,
  };
}

function normalizeRounds(
  s: Record<string, unknown>,
  activeProjectId: string | null,
  ctx: NormalizeContext
): Round[] {
  const raw = s.rounds;
  const list = Array.isArray(raw) ? raw : [];
  if (!Array.isArray(raw)) ctx.repairs.push('Created empty rounds array.');

  return list.map((r) => {
    const round = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    return {
      id: (round.id as string) ?? generateSafeId('recovered-round'),
      projectId: (round.projectId as string) ?? activeProjectId ?? '',
      roundNumber: typeof round.roundNumber === 'number' ? (round.roundNumber as number) : 0,
      phase: typeof round.phase === 'string' ? (round.phase as string) : '',
      userInstruction:
        typeof round.userInstruction === 'string' ? (round.userInstruction as string) : '',
      selectedModelIds: Array.isArray(round.selectedModelIds)
        ? (round.selectedModelIds as string[])
        : [],
      generatedPrompts: normalizeGeneratedPrompts(round.generatedPrompts, ctx),
      modelResponses: normalizeModelResponses(round.modelResponses, ctx),
      mediatorPrompt:
        typeof round.mediatorPrompt === 'string' ? (round.mediatorPrompt as string) : '',
      mediatorResponse:
        typeof round.mediatorResponse === 'string' ? (round.mediatorResponse as string) : '',
      mediatorSynthesis: normalizeMediatorSynthesis(round.mediatorSynthesis, ctx),
      userDecision: typeof round.userDecision === 'string' ? (round.userDecision as string) : '',
      canonicalStateUpdate:
        typeof round.canonicalStateUpdate === 'string'
          ? (round.canonicalStateUpdate as string)
          : '',
      agreements: Array.isArray(round.agreements) ? (round.agreements as string[]) : [],
      disagreements: Array.isArray(round.disagreements) ? (round.disagreements as string[]) : [],
      risks: Array.isArray(round.risks) ? (round.risks as string[]) : [],
      openQuestions: Array.isArray(round.openQuestions) ? (round.openQuestions as string[]) : [],
      nextActions: Array.isArray(round.nextActions) ? (round.nextActions as string[]) : [],
      locked: typeof round.locked === 'boolean' ? (round.locked as boolean) : false,
      createdAt: typeof round.createdAt === 'string' ? (round.createdAt as string) : ctx.now,
      updatedAt: typeof round.updatedAt === 'string' ? (round.updatedAt as string) : ctx.now,
    };
  });
}

// ── Decisions ────────────────────────────────────────────────────────────────

function normalizeDecisions(
  s: Record<string, unknown>,
  ctx: NormalizeContext
): Decision[] {
  const raw = s.decisions;
  const list = Array.isArray(raw) ? raw : [];
  if (!Array.isArray(raw)) ctx.repairs.push('Created empty decisions array.');
  // Decisions are not deeply normalized: their content is user-authored
  // substance and we don't fabricate it. We pass through as-is so existing
  // shape (id, projectId, roundId, decisionText, rationale, ...) is retained.
  return list as Decision[];
}

// ── Other arrays (pass-through with empty default) ───────────────────────────

function normalizeModelProfiles(
  s: Record<string, unknown>,
  ctx: NormalizeContext
): ModelProfile[] {
  const raw = s.modelProfiles;
  if (!Array.isArray(raw)) {
    ctx.repairs.push('Created empty modelProfiles array.');
    return [];
  }
  return raw as ModelProfile[];
}

function normalizePromptTemplates(
  s: Record<string, unknown>,
  ctx: NormalizeContext
): PromptTemplate[] {
  const raw = s.promptTemplates;
  if (!Array.isArray(raw)) {
    ctx.repairs.push('Created empty promptTemplates array.');
    return [];
  }
  return raw as PromptTemplate[];
}

function normalizePromptWrappers(
  s: Record<string, unknown>,
  ctx: NormalizeContext
): PromptWrapper[] {
  const raw = s.promptWrappers;
  if (!Array.isArray(raw)) {
    // The migration step from 0.7.0 → 0.8.0 should have already
    // populated this array. If we still arrive here without it (a
    // raw-paste 0.8.0 import that omits the field, say), fall back
    // to an empty array — promptGeneration handles a missing wrapper
    // by using the Generic fallback.
    ctx.repairs.push(
      'Created empty promptWrappers array. New in 0.8.0; migration should normally populate this from defaults.'
    );
    return [];
  }
  return raw as PromptWrapper[];
}

function normalizeCompatibilityNotes(
  s: Record<string, unknown>,
  ctx: NormalizeContext
): CompatibilityNote[] {
  const raw = s.compatibilityNotes;
  if (!Array.isArray(raw)) {
    ctx.repairs.push('Created empty compatibilityNotes array.');
    return [];
  }
  return raw as CompatibilityNote[];
}

// ── v0.11.0: Markdown Handoff Mode arrays ────────────────────────────────────
//
// rawNotes and importHistory are pass-through with structural guards. Like
// decisions, the entries contain user/import substantive data that we don't
// fabricate; we just guarantee the top-level shape is correct.

function normalizeRawNotes(
  s: Record<string, unknown>,
  ctx: NormalizeContext
): RawNote[] {
  const raw = s.rawNotes;
  if (!Array.isArray(raw)) {
    // The migration step from 0.10.5 → 0.11.0 should have already created
    // this. If we still arrive without it (e.g. a raw paste of an older
    // export), fall back to []. No substantive content is fabricated.
    ctx.repairs.push(
      'Created empty rawNotes array. New in 0.11.0; migration should normally populate this as [].'
    );
    return [];
  }
  return raw as RawNote[];
}

function normalizeImportHistory(
  s: Record<string, unknown>,
  ctx: NormalizeContext
): ImportTransaction[] {
  const raw = s.importHistory;
  if (!Array.isArray(raw)) {
    ctx.repairs.push(
      'Created empty importHistory array. New in 0.11.0; migration should normally populate this as [].'
    );
    return [];
  }
  return raw as ImportTransaction[];
}

// ── normalizeImportedState — orchestrator ────────────────────────────────────

/**
 * Apply safe normalization to raw import data and return a clean AppState
 * plus the list of human-readable repair messages. The repair list is
 * surfaced in the import preview as `[Auto-repair]` warnings so the user
 * sees every change before confirming.
 *
 * Never fabricates substantive content. Empty fields stay empty; missing
 * arrays become empty arrays; missing timestamps become `now`. That's it.
 */
export function normalizeImportedState(raw: unknown): { state: AppState; repairs: string[] } {
  const ctx = makeContext();
  const { state, exportType } = extractAppState(raw);

  // Phase 7A: run migration before normalization so the per-collection
  // helpers operate on a current-shape state. The migration engine emits
  // its own MigrationNotice[] which is captured by validateImportedState
  // for the import preview; this entry point intentionally does not
  // surface them again to keep its return shape stable.
  const migrated = migrateAppState(state ?? {}, undefined, {
    envelopeWasLegacy: exportType === 'legacy',
  });
  const s = (migrated.state ?? {}) as Record<string, unknown>;

  const projects = normalizeProjects(s, ctx);
  const activeProjectId = normalizeActiveProjectId(s, projects, ctx);
  const rounds = normalizeRounds(s, activeProjectId, ctx);
  const decisions = normalizeDecisions(s, ctx);
  const modelProfiles = normalizeModelProfiles(s, ctx);
  const promptTemplates = normalizePromptTemplates(s, ctx);
  const promptWrappers = normalizePromptWrappers(s, ctx);
  const compatibilityNotes = normalizeCompatibilityNotes(s, ctx);
  // v0.11.0: Markdown Handoff Mode arrays.
  const rawNotes = normalizeRawNotes(s, ctx);
  const importHistory = normalizeImportHistory(s, ctx);

  const normalizedState: AppState = {
    schemaVersion: SCHEMA_VERSION,
    activeProjectId,
    projects,
    modelProfiles,
    promptTemplates,
    promptWrappers,
    rounds,
    decisions,
    compatibilityNotes,
    rawNotes,
    importHistory,
    updatedAt: ctx.now,
  };

  return { state: normalizedState, repairs: ctx.repairs };
}
