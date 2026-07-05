// src/utils/migration.ts
// Purpose: Schema migration engine for RoundTable imports (Phase 7A).
//
// What this file owns:
//   - MigrationCode / MigrationNotice / MigrationResult types
//   - detectSourceVersion()  — best-effort source-version inference
//   - migrateAppState()      — version-aware transformation pipeline
//
// Where this fits in the import pipeline (Phase 7A):
//
//   parseImportJson(text)
//     → extractAppState(raw)            // envelope-aware unwrap
//     → migrateAppState(state, version) // structural version-up transforms (Phase 7A)
//     → validateImportedState(...)      // structural + referential checks
//     → normalizeImportedState(...)     // safe field-level defaults
//
// Migration vs repair vs validation:
//
//   - Migration  is a *version-aware structural transformation*. It
//     converts an older known schema shape into the current schema shape.
//     Migrations always belong to a known source/target version pair and
//     emit MigrationNotice entries describing what changed.
//
//   - Repair     is a *safe correction of missing/invalid structural
//     fields* inside otherwise understandable data. Repairs are the job
//     of normalizeImportedState() and surface as `AUTO_REPAIR_APPLIED`
//     warnings.
//
//   - Validation is a *safety check* deciding whether the data is safe
//     to import at all. Validation issues surface as ValidationIssue
//     entries with severity `error` or `warning`.
//
// Migration philosophy:
//
//   - Migrations must NEVER fabricate substantive content (decisions,
//     user instructions, model responses, mediator output, canonical
//     state, rationale, descriptions, compatibility-note text). If a
//     legacy export is missing substantive content, it stays missing —
//     normalization handles structural defaults but does not invent
//     prose.
//
//   - Migrations operate on *raw, untyped state* (Record<string,
//     unknown>) because the input shape is by definition not the
//     current shape. They return raw, untyped state too — validation
//     and normalization are the typed seam.
//
//   - Migrations are chained: a 0.4.0 input runs 0.4→0.5, 0.5→0.6, and
//     0.6→0.7 in order. Each step is a small, isolated function. Even
//     when a step is a structural no-op (because the schema didn't
//     change between two versions), it still emits a notice so the
//     user sees that a version bump occurred.
//
// Where migrations run vs where they don't:
//
//   - Run during import (this file).
//   - DO NOT run on fresh INITIAL_APP_STATE (already current).
//   - DO NOT run on a successfully loaded current-schema localStorage
//     state (already current).
//   - The recovery flow imports through validation, which calls
//     migration — recovery imports get migration for free.
//
// How to add a new migration when the schema changes:
//
//   1. Write a small `migrateXtoY(state)` function in this file that
//      transforms a 0.X-shaped raw state into a 0.Y-shaped raw state.
//      It should be additive whenever possible (introduce defaults for
//      newly required fields; don't drop legacy fields you don't
//      understand).
//   2. Add a new MigrationCode for the step.
//   3. Append `migrateXtoY` to MIGRATION_CHAIN below in version order.
//   4. Document the change in docs/SCHEMA_EVOLUTION.md.

import { SCHEMA_VERSION } from '../config/exportFormats';
import { DEFAULT_PROMPT_WRAPPERS, GENERIC_WRAPPER_ID } from '../config/promptWrappers';

// ── MigrationCode (frozen object) ────────────────────────────────────────────

export const MIGRATION_CODES = {
  /** A version was inferred because the source did not declare one. */
  SOURCE_VERSION_INFERRED: 'SOURCE_VERSION_INFERRED',
  /** Source version could not be inferred and was treated as unknown. */
  SOURCE_VERSION_UNKNOWN: 'SOURCE_VERSION_UNKNOWN',
  /** Source version is the same as target version — no transforms run. */
  ALREADY_CURRENT: 'ALREADY_CURRENT',
  /** Source version is newer than this app — migration is skipped. */
  SOURCE_NEWER_THAN_APP: 'SOURCE_NEWER_THAN_APP',
  /** A version-up step ran. */
  MIGRATION_STEP_APPLIED: 'MIGRATION_STEP_APPLIED',
  /** Schema version stamp updated to current after all steps. */
  SCHEMA_STAMP_UPDATED: 'SCHEMA_STAMP_UPDATED',
  /** A legacy envelope was unwrapped before migration. */
  LEGACY_ENVELOPE_DETECTED: 'LEGACY_ENVELOPE_DETECTED',
} as const;

export type MigrationCode = typeof MIGRATION_CODES[keyof typeof MIGRATION_CODES];

// ── Public types ─────────────────────────────────────────────────────────────

export type MigrationSeverity = 'info' | 'warning';

export interface MigrationNotice {
  code: MigrationCode;
  severity: MigrationSeverity;
  message: string;
  /** Path of the change when meaningful (e.g. "schemaVersion"). */
  path?: string;
}

export interface MigrationResult {
  /** Migrated raw state. Still untyped — validation will check it. */
  state: unknown;
  /** Inferred or supplied source version (best effort). */
  sourceVersion: string;
  /** Always equals SCHEMA_VERSION at time of migration. */
  targetVersion: string;
  migrationsApplied: MigrationNotice[];
}

// ── Version detection ────────────────────────────────────────────────────────

/**
 * Best-effort source version detection.
 *
 * Order of attempts:
 *   1. The state's own `schemaVersion` field if present and string.
 *   2. The supplied `sourceVersion` argument.
 *   3. Heuristic from the envelope shape (caller passes envelope flag).
 *   4. Falls back to '0.0.0-unknown'.
 */
export function detectSourceVersion(
  state: unknown,
  hint?: string,
  envelopeWasLegacy?: boolean
): { version: string; inferred: boolean } {
  if (state && typeof state === 'object') {
    const declared = (state as Record<string, unknown>).schemaVersion;
    if (typeof declared === 'string' && declared.length > 0) {
      return { version: declared, inferred: false };
    }
  }
  if (hint && hint.length > 0) {
    return { version: hint, inferred: true };
  }
  if (envelopeWasLegacy) {
    // Phase 3/4 envelopes were the only place schemaVersion could be
    // missing-by-design. Treat as 0.4.0 for migration purposes — that
    // matches when MediatorSynthesis was first introduced. Worst case:
    // the user sees a "migrated 0.4.0 → 0.7.0" notice that overshoots
    // by a phase, with no functional impact since the chain is no-op
    // for shape between 0.4 and 0.7.
    return { version: '0.4.0', inferred: true };
  }
  return { version: '0.0.0-unknown', inferred: true };
}

// ── Version comparison helpers ───────────────────────────────────────────────

interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(v: string): SemverParts | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

// ── Migration steps ──────────────────────────────────────────────────────────
//
// Each step describes a pair of versions and a transform. When the chain
// runs, only steps whose `from` version is >= the source's known major.minor
// are applied, in order.
//
// Phase 7A reality: AppState shape has been stable since 0.4.0. The
// transforms below are intentionally minimal — most are structural no-ops
// that exist to (a) emit a visible MigrationNotice so the user can see
// what happened and (b) reserve a place for real transforms when the
// shape eventually changes. Future migrations will land here as full
// transforms.

interface MigrationStepContext {
  notices: MigrationNotice[];
}

interface MigrationStep {
  from: string;        // major.minor.patch — first version this step applies *from*
  to: string;          // major.minor.patch — version this step produces
  description: string; // human-readable summary of the transform
  apply: (state: Record<string, unknown>, ctx: MigrationStepContext) => Record<string, unknown>;
}

/**
 * 0.4.0 → 0.5.0
 *
 * Phase 5 changed the export envelope (which is unwrapped before this
 * runs, so it's not visible here) but did not change AppState shape.
 * No transform is required; we record the version step.
 */
function migrate_0_4_to_0_5(state: Record<string, unknown>): Record<string, unknown> {
  return state;
}

/**
 * 0.5.0 → 0.6.0
 *
 * Phase 6 added typed validation issues and split normalization helpers,
 * but did not change AppState shape. No transform required.
 */
function migrate_0_5_to_0_6(state: Record<string, unknown>): Record<string, unknown> {
  return state;
}

/**
 * 0.6.0 → 0.7.0
 *
 * Phase 7A introduces the migration engine itself plus the Gemini Review
 * Packet export, but does not change AppState shape. No transform required.
 */
function migrate_0_6_to_0_7(state: Record<string, unknown>): Record<string, unknown> {
  return state;
}

/**
 * 0.7.0 → 0.8.0  (Phase 7B — vendor resilience)
 *
 * First migration in the chain that actually changes AppState shape:
 *
 *   - Adds top-level `promptWrappers` array if missing. Seeded with the
 *     same DEFAULT_PROMPT_WRAPPERS the app ships with — these are RoundTable's
 *     own defaults, not fabricated model behavior.
 *
 *   - Defaults `defaultPromptWrapperId` on each ModelProfile that
 *     lacks one. The default is `GENERIC_WRAPPER_ID` (`wrapper-generic`),
 *     which is the safe minimal wrapper. Surfaced per-profile so the
 *     user can see which models got defaulted.
 *
 *   - Defaults `severity` to `'medium'` on each CompatibilityNote that
 *     lacks one. 'medium' is a deliberately neutral default so the
 *     Round Builder doesn't escalate or hide warnings unjustly.
 *
 *   - Defaults `active: true` on each PromptTemplate that lacks it.
 *     Pre-Phase-7B templates predate the active flag; treating them as
 *     active preserves existing behavior.
 *
 * Substantive content is NOT fabricated:
 *   - No new descriptions, rationale, decision text, or canonical state.
 *   - Free-form notes (modelBehaviorNotes, formattingNotes, etc.)
 *     stay missing on imports that didn't have them. Empty is the
 *     correct default for fields the user fills in by observation.
 */
function migrate_0_7_to_0_8(
  state: Record<string, unknown>,
  ctx: MigrationStepContext
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...state };

  // 1) Top-level promptWrappers array.
  if (!Array.isArray(next.promptWrappers)) {
    next.promptWrappers = DEFAULT_PROMPT_WRAPPERS;
    ctx.notices.push({
      code: MIGRATION_CODES.MIGRATION_STEP_APPLIED,
      severity: 'info',
      message:
        `Added top-level "promptWrappers" array (${DEFAULT_PROMPT_WRAPPERS.length} default wrappers seeded). ` +
        `Edit src/config/promptWrappers.ts or the AppState array to customize.`,
      path: 'promptWrappers',
    });
  }

  // 2) Default defaultPromptWrapperId on each ModelProfile.
  if (Array.isArray(next.modelProfiles)) {
    const profiles = next.modelProfiles as Array<Record<string, unknown>>;
    const defaulted: string[] = [];
    next.modelProfiles = profiles.map((p, idx) => {
      if (typeof p.defaultPromptWrapperId === 'string' && p.defaultPromptWrapperId.length > 0) {
        return p;
      }
      defaulted.push(typeof p.id === 'string' ? p.id : `modelProfiles[${idx}]`);
      return { ...p, defaultPromptWrapperId: GENERIC_WRAPPER_ID };
    });
    if (defaulted.length > 0) {
      ctx.notices.push({
        code: MIGRATION_CODES.MIGRATION_STEP_APPLIED,
        severity: 'info',
        message:
          `Defaulted modelProfile.defaultPromptWrapperId to "${GENERIC_WRAPPER_ID}" on ${defaulted.length} profile(s): ${defaulted.join(', ')}. ` +
          `You can change this per profile in Model Roster.`,
        path: 'modelProfiles[].defaultPromptWrapperId',
      });
    }
  }

  // 3) Default severity on CompatibilityNotes that lack it.
  if (Array.isArray(next.compatibilityNotes)) {
    const notes = next.compatibilityNotes as Array<Record<string, unknown>>;
    let defaultedCount = 0;
    next.compatibilityNotes = notes.map((n) => {
      if (typeof n.severity === 'string' && n.severity.length > 0) return n;
      defaultedCount += 1;
      return { ...n, severity: 'medium' };
    });
    if (defaultedCount > 0) {
      ctx.notices.push({
        code: MIGRATION_CODES.MIGRATION_STEP_APPLIED,
        severity: 'info',
        message:
          `Defaulted compatibilityNotes[].severity to "medium" on ${defaultedCount} note(s). ` +
          `Severity is shown in the Round Builder and Compatibility Notes panels.`,
        path: 'compatibilityNotes[].severity',
      });
    }
  }

  // 4) Default active=true on PromptTemplates that lack it.
  if (Array.isArray(next.promptTemplates)) {
    const tpls = next.promptTemplates as Array<Record<string, unknown>>;
    let defaultedCount = 0;
    next.promptTemplates = tpls.map((t) => {
      if (typeof t.active === 'boolean') return t;
      defaultedCount += 1;
      return { ...t, active: true };
    });
    if (defaultedCount > 0) {
      ctx.notices.push({
        code: MIGRATION_CODES.MIGRATION_STEP_APPLIED,
        severity: 'info',
        message:
          `Defaulted promptTemplates[].active to true on ${defaultedCount} template(s). ` +
          `Pre-Phase-7B templates predate the active flag.`,
        path: 'promptTemplates[].active',
      });
    }
  }

  return next;
}

/**
 * 0.10.5 → 0.11.0  (v0.11.0 — Markdown Handoff Mode)
 *
 * Second AppState shape change in the migration chain. Adds two top-level
 * arrays needed by Markdown Handoff Mode:
 *
 *   - `rawNotes`     : the fallback substrate for imports that can't safely
 *                      commit to AppState. Bounded ring buffer (default cap
 *                      RAW_NOTES_DEFAULT_CAP). Older entries are pruned at
 *                      write time with a UI banner.
 *
 *   - `importHistory`: commit log of Markdown handoff imports, each with a
 *                      pre-import snapshot slice for most-recent rollback.
 *                      Bounded ring buffer (default cap
 *                      IMPORT_HISTORY_DEFAULT_CAP).
 *
 * Both arrays are defaulted to [] when absent. No other AppState shape
 * changes in this migration. The GeneratedPrompt schema gained an OPTIONAL
 * `canonicalStateHashAtGeneration` field; missing values are preserved as
 * missing rather than fabricated (per the "do not invent substantive
 * content" rule). Stale-state detection silently skips prompts without
 * the hash.
 *
 * Idempotent: running on a state that already has both arrays is a no-op.
 * Safe to run on older states (0.7.0, 0.8.0) — the additions are
 * structurally compatible.
 */
function migrate_0_10_5_to_0_11_0(
  state: Record<string, unknown>,
  ctx: MigrationStepContext
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...state };

  if (!Array.isArray(next.rawNotes)) {
    next.rawNotes = [];
    ctx.notices.push({
      code: MIGRATION_CODES.MIGRATION_STEP_APPLIED,
      severity: 'info',
      message:
        'Added top-level "rawNotes" array (empty) — v0.11.0 Markdown Handoff fallback substrate.',
      path: 'rawNotes',
    });
  }

  if (!Array.isArray(next.importHistory)) {
    next.importHistory = [];
    ctx.notices.push({
      code: MIGRATION_CODES.MIGRATION_STEP_APPLIED,
      severity: 'info',
      message:
        'Added top-level "importHistory" array (empty) — v0.11.0 Markdown Handoff commit log.',
      path: 'importHistory',
    });
  }

  return next;
}

const MIGRATION_CHAIN: MigrationStep[] = [
  {
    from: '0.4.0',
    to: '0.5.0',
    description: 'Phase 5 envelope/recovery additions; AppState shape unchanged.',
    apply: migrate_0_4_to_0_5,
  },
  {
    from: '0.5.0',
    to: '0.6.0',
    description: 'Phase 6 typed validation issues; AppState shape unchanged.',
    apply: migrate_0_5_to_0_6,
  },
  {
    from: '0.6.0',
    to: '0.7.0',
    description: 'Phase 7A migration engine + review packet; AppState shape unchanged.',
    apply: migrate_0_6_to_0_7,
  },
  {
    from: '0.7.0',
    to: '0.8.0',
    description:
      'Phase 7B vendor resilience: adds promptWrappers array, defaults defaultPromptWrapperId on profiles, defaults severity on compatibility notes, defaults active on prompt templates.',
    apply: migrate_0_7_to_0_8,
  },
  {
    from: '0.10.5',
    to: '0.11.0',
    description:
      'v0.11.0 Markdown Handoff Mode: adds top-level rawNotes (fallback substrate) and importHistory (commit log with rollback snapshots) arrays.',
    apply: migrate_0_10_5_to_0_11_0,
  },
];

// ── Public migration API ─────────────────────────────────────────────────────

/**
 * Migrate a raw, already-extracted AppState toward the current
 * SCHEMA_VERSION. Input is the *state* object (not the export envelope —
 * unwrap with extractAppState first). Output is still raw/untyped because
 * the next pipeline stage (validation/normalization) is the typed seam.
 *
 * Behavior:
 *   - If the source version is unknown, returns the input unchanged with
 *     a `SOURCE_VERSION_UNKNOWN` notice.
 *   - If the source version is newer than the app, returns the input
 *     unchanged with a `SOURCE_NEWER_THAN_APP` warning. (The app may
 *     reject the import later; we don't pretend to know what to do with
 *     a future schema.)
 *   - If the source version is current, returns the input with an
 *     `ALREADY_CURRENT` info notice.
 *   - Otherwise, runs each chain step whose `from` >= sourceVersion and
 *     <= targetVersion, in order, emitting one
 *     `MIGRATION_STEP_APPLIED` notice per step plus one
 *     `SCHEMA_STAMP_UPDATED` at the end.
 */
export function migrateAppState(
  rawState: unknown,
  sourceVersionHint?: string,
  options?: { envelopeWasLegacy?: boolean }
): MigrationResult {
  const targetVersion = SCHEMA_VERSION;
  const notices: MigrationNotice[] = [];

  // If the input isn't an object at all, there's nothing to migrate. We
  // pass through and let validation reject it properly.
  if (!rawState || typeof rawState !== 'object') {
    return {
      state: rawState,
      sourceVersion: '0.0.0-unknown',
      targetVersion,
      migrationsApplied: [
        {
          code: MIGRATION_CODES.SOURCE_VERSION_UNKNOWN,
          severity: 'warning',
          message:
            'Input is not an object — cannot migrate. Validation will reject.',
        },
      ],
    };
  }

  const detected = detectSourceVersion(
    rawState,
    sourceVersionHint,
    options?.envelopeWasLegacy
  );
  const sourceVersion = detected.version;

  if (detected.inferred) {
    if (sourceVersion === '0.0.0-unknown') {
      notices.push({
        code: MIGRATION_CODES.SOURCE_VERSION_UNKNOWN,
        severity: 'warning',
        message:
          'No schemaVersion declared and no envelope hint available. Migration skipped; validation will run on the input as-is.',
        path: 'schemaVersion',
      });
      return {
        state: rawState,
        sourceVersion,
        targetVersion,
        migrationsApplied: notices,
      };
    }
    notices.push({
      code: MIGRATION_CODES.SOURCE_VERSION_INFERRED,
      severity: 'info',
      message: `Source schemaVersion not declared; inferred as "${sourceVersion}".`,
      path: 'schemaVersion',
    });
  }

  if (options?.envelopeWasLegacy) {
    notices.push({
      code: MIGRATION_CODES.LEGACY_ENVELOPE_DETECTED,
      severity: 'info',
      message:
        'Import file used a legacy envelope shape; appState was unwrapped before migration.',
    });
  }

  const cmp = compareVersions(sourceVersion, targetVersion);

  if (cmp === 0) {
    notices.push({
      code: MIGRATION_CODES.ALREADY_CURRENT,
      severity: 'info',
      message: `Source schemaVersion (${sourceVersion}) matches current (${targetVersion}). No migration needed.`,
      path: 'schemaVersion',
    });
    return {
      state: rawState,
      sourceVersion,
      targetVersion,
      migrationsApplied: notices,
    };
  }

  if (cmp > 0) {
    notices.push({
      code: MIGRATION_CODES.SOURCE_NEWER_THAN_APP,
      severity: 'warning',
      message:
        `Source schemaVersion (${sourceVersion}) is newer than this app (${targetVersion}). ` +
        `No migration will run; validation may reject unknown fields.`,
      path: 'schemaVersion',
    });
    return {
      state: rawState,
      sourceVersion,
      targetVersion,
      migrationsApplied: notices,
    };
  }

  // Apply each chain step that moves us from sourceVersion toward target.
  let working: Record<string, unknown> = { ...(rawState as Record<string, unknown>) };
  for (const step of MIGRATION_CHAIN) {
    // A step applies if its `from` version is >= the current state's
    // version (where "current" updates as steps run) and `to` is <=
    // target.
    const stateVersion =
      typeof working.schemaVersion === 'string' ? working.schemaVersion : sourceVersion;
    if (compareVersions(step.from, stateVersion) < 0) continue;
    if (compareVersions(step.to, targetVersion) > 0) break;

    // Each step gets a fresh context. Notices it pushes are appended
    // to the overall notices stream after the step's headline notice
    // so the user reads "step ran" before the step's per-field details.
    const stepCtx: MigrationStepContext = { notices: [] };
    working = step.apply(working, stepCtx);
    // Stamp the post-step version so the next step's filter sees it.
    working.schemaVersion = step.to;
    notices.push({
      code: MIGRATION_CODES.MIGRATION_STEP_APPLIED,
      severity: 'info',
      message: `Migrated ${step.from} → ${step.to}: ${step.description}`,
      path: 'schemaVersion',
    });
    notices.push(...stepCtx.notices);
  }

  // Final stamp: ensure schemaVersion matches the app's SCHEMA_VERSION.
  if (working.schemaVersion !== targetVersion) {
    working.schemaVersion = targetVersion;
    notices.push({
      code: MIGRATION_CODES.SCHEMA_STAMP_UPDATED,
      severity: 'info',
      message: `schemaVersion stamped as "${targetVersion}".`,
      path: 'schemaVersion',
    });
  }

  return {
    state: working,
    sourceVersion,
    targetVersion,
    migrationsApplied: notices,
  };
}
