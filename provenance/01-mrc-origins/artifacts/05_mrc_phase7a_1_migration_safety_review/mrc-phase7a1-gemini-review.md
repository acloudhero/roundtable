# Model Roundtable Console — Phase 7A.1 Gemini Review Packet

## Review Context
- **Project:** Model Roundtable Console
- **Phase under review:** Phase 7A.1 — Migration Safety Cleanup
- **Reviewer requested:** Gemini 3 Thinking
- **Prepared by:** GPT-5.5 Thinking after full zip inspection
- **Package reviewed:** `mrc-phase7a1.zip`
- **Current version/schema:** `0.7.0`

## GPT-5.5 Gate Status
GPT-5.5 inspected the full Phase 7A.1 zip and verified:

- `npm ci` passes
- `npm run build` passes
- TypeScript errors: 0
- `package.json`: `0.7.0`
- `package-lock.json`: `0.7.0`
- `SCHEMA_VERSION`: `0.7.0`
- `APP_VERSION`: `0.7.0`
- No `fetch`, `axios`, `XMLHttpRequest`, `WebSocket`, backend, auth, scraping, cloud sync, or model-provider integrations found in `src/`

## Phase 7A.1 Cleanup Goal
Phase 7A added migration support and Gemini Review Packet export. GPT-5.5 found one blocker: newer/future schema imports were only warnings. Phase 7A.1 should reject newer schemas as hard errors to prevent a `0.7.0` app from silently normalizing/dropping unknown future fields from `0.8.0+` exports.

## Review Questions for Gemini
1. Does the future/newer schema rejection satisfy Zero Data Loss migration safety?
2. Is `UNSUPPORTED_SCHEMA_VERSION` correctly distinguished from normal `SCHEMA_MISMATCH`?
3. Does the import preview still distinguish errors, migrations, warnings, and auto-repairs clearly enough?
4. Is the Gemini Review Packet still local Markdown only and safe to use for external review?
5. Are there any remaining blockers before treating Phase 7A/7A.1 as approved and proceeding to Phase 7B?
6. Should `PHASE_HISTORY.md` marking Phase 7A and Phase 7A.1 as Current be cleaned at the start of Phase 7B, or is it acceptable during review?

## Known Minor Notes from GPT-5.5
- `PHASE_HISTORY.md` currently lists Phase 7A as Current in the index and Phase 7A.1 as Current in the changelog. This is acceptable during the review window, but should be flipped to Completed when Phase 7B starts.
- No automated test harness exists yet; manual build and code inspection remain the verification path until a later hardening phase.


## Review-Relevant Excerpt: `src/utils/validation.ts`

~~~~ts
// excerpt lines 100-139
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
// excerpt lines 287-336
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
        `Update MRC before importing this file.`,
      'schemaVersion'
    );
    // Surface error immediately — nothing further is safe to evaluate.
    const split = splitIssues(issues);
    return {
      valid: false,
~~~~


## Review-Relevant Excerpt: `src/utils/migration.ts`

~~~~ts
// excerpt lines 1-36
// src/utils/migration.ts
// Purpose: Schema migration engine for MRC imports (Phase 7A).
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
// excerpt lines 75-114
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
// excerpt lines 159-198
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

interface MigrationStep {
  from: string;        // major.minor.patch — first version this step applies *from*
  to: string;          // major.minor.patch — version this step produces
  description: string; // human-readable summary of the transform
  apply: (state: Record<string, unknown>) => Record<string, unknown>;
}

/**
~~~~


## Review-Relevant Excerpt: `src/components/ExportImportPanel.tsx`

~~~~ts
// excerpt lines 205-244
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
              { label: 'Gemini Review Packet', desc: 'Curated Markdown packet for manual external review. Does not upload or call Gemini.', fn: () => mdDownload(exportGeminiReviewPacket(state), geminiReviewPacketFilename(state)) },
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
// excerpt lines 396-435
    <>
      {errors.length > 0 && (
        <div className="notice danger mb-12">
          <strong>Errors (must fix before import):</strong>
          <IssueList issues={errors} />
        </div>
      )}

      {migrations.length > 0 && (
        <div className="notice info mb-12">
          <strong>Migrations applied:</strong>
          <MigrationList notices={migrations} />
        </div>
      )}

      {warnings.length > 0 && (
        <div className="notice mb-12">
          <strong>Warnings (review before confirming):</strong>
          <IssueList issues={warnings} />
        </div>
      )}

      {repairs.length > 0 && (
        <div className="notice info mb-12">
          <strong>Auto-repairs that will be applied:</strong>
          <IssueList issues={repairs} />
        </div>
      )}
    </>
  );
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  return (
    <ul style={{ marginTop: 6, paddingLeft: 16 }}>
      {issues.map((issue, i) => (
        <li key={`${issue.code}-${i}`} className="text-xs">
          {issue.message}
          {issue.path && (
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
~~~~


## Review-Relevant Excerpt: `src/utils/markdownExport.ts`

~~~~ts
// excerpt lines 344-383
//   - Known limitations (placeholder)
//
// Local-only. No network calls. No auto-upload. The user reads this packet,
// edits the placeholders, and pastes it into Gemini themselves — same
// manual-copy/paste boundary as every other workflow in the app.
//
// All large user-/model-authored content is wrapped with the dynamic tilde
// fence helper so embedded code fences in canonical state, mediator
// synthesis, etc. don't break the packet structure.

export function exportGeminiReviewPacket(state: AppState): string {
  const now = nowIso();
  const project = state.projects.find((p) => p.id === state.activeProjectId);

  if (!project) {
    return exportHeader('Model Roundtable Console — Gemini Review Packet', now)
      + '_No active project. Set up a project before exporting a review packet._\n';
  }

  const round = state.rounds
    .filter((r) => r.projectId === project.id)
    .sort((a, b) => b.roundNumber - a.roundNumber)[0];

  const decision = round
    ? state.decisions.find((d) => d.roundId === round.id)
    : undefined;

  const selectedModels = round
    ? state.modelProfiles.filter((m) => round.selectedModelIds.includes(m.id))
    : [];

  const collectedCount = round
    ? round.modelResponses.filter(
        (r) => r.status === 'pasted' || r.status === 'reviewed'
      ).length
    : 0;

  const rosterLines =
    round && selectedModels.length > 0
      ? selectedModels
// excerpt lines 513-528
  out += `## Known Limitations\n\n`;
  out += `- This packet is a **point-in-time snapshot**. Subsequent rounds, edits, or imports are not reflected.\n`;
  out += `- Only the **latest round** is summarized in detail. The full history is in the Project History export.\n`;
  out += `- Mediator synthesis fields are user-reviewed but may still contain extraction artifacts; treat them as advisory.\n`;
  out += `- MRC does not call Gemini or any other model. This packet must be carried to the reviewer manually.\n\n`;

  out += `_End of Gemini review packet._\n`;
  return out;
}

export function geminiReviewPacketFilename(state: AppState): string {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const safeName = (project?.name ?? 'Project').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `MRC_GEMINI_REVIEW_${safeName}_${dateStamp}.md`;
}
~~~~


## Review-Relevant Excerpt: `docs/PHASE_HISTORY.md`

~~~~markdown
// excerpt lines 560-592
candidate cut for v1.0.0.

**Items deferred here from earlier phases:**

- Vite/esbuild dev-server audit advisory (deferred since Phase 3.1).

Out of scope for Phases 0–6.1.

---

## Phase 7A.1 — Migration Safety Cleanup (Current)

**Version:** 0.7.0 (patch) · **Schema:** 0.7.0

**Objective:** Satisfy the Phase 7A migration safety gate — reject newer/future schema imports as hard errors.

**Fixes applied:**

1. **Newer schema imports rejected (HARD ERROR)** — Added `UNSUPPORTED_SCHEMA_VERSION` to `VALIDATION_CODES`. In `validateImportedState()`, after `migrateAppState()` runs, two independent checks detect a future-schema import:
   - (a) Migration notices: if `SOURCE_NEWER_THAN_APP` is present, the import is rejected immediately.
   - (b) Post-migration schemaVersion: if `s.schemaVersion` is still semver-greater than `SCHEMA_VERSION` (defense-in-depth for any path where the migration engine ran but notices were incomplete), the import is rejected.
   
   Error message: `"This export uses schemaVersion X, which is newer than this app's supported version Y. Update MRC before importing this file."`
   
   `valid: false` is returned, disabling Confirm Import.
   
   Older supported versions (0.4.0, 0.5.0, 0.6.0) still migrate forward as before.

2. **ExportImportPanel comment** — Updated header comment from "8 Markdown exports" to "9 Markdown exports".

3. **Gemini Review Packet duplicate** — Removed the duplicate `Exported At` line from `Project Metadata` in `exportGeminiReviewPacket()`. The timestamp is already emitted by `exportHeader()`.

4. **SCHEMA_EVOLUTION.md** — Updated to note that `SOURCE_NEWER_THAN_APP` (migration warning) now triggers `UNSUPPORTED_SCHEMA_VERSION` (validation error).
~~~~


## Review-Relevant Excerpt: `docs/SCHEMA_EVOLUTION.md`

~~~~markdown
// excerpt lines 90-129

**Pipeline changes:**

- New stage in the import pipeline: **migration** runs after
  envelope unwrap and before structural validation.
  Pipeline:
  `parseImportJson → extractAppState → migrateAppState → validateImportedState → normalizeImportedState`.
- New `src/utils/migration.ts` module with:
  - `MIGRATION_CODES` (frozen object): `SOURCE_VERSION_INFERRED`,
    `SOURCE_VERSION_UNKNOWN`, `ALREADY_CURRENT`,
    `SOURCE_NEWER_THAN_APP`, `MIGRATION_STEP_APPLIED`,
    `SCHEMA_STAMP_UPDATED`, `LEGACY_ENVELOPE_DETECTED`.
  - `MigrationNotice`, `MigrationResult` types.
  - `detectSourceVersion()`, `migrateAppState()` functions.
  - A `MIGRATION_CHAIN` registry of small per-version-up transforms.
- `VALIDATION_CODES` is now a frozen object (`as const`) with derived
  literal-union type `ValidationCode`. Same string values; richer
  runtime presence.
- `ValidationResult` carries a new `migrations: MigrationNotice[]`
  field. UI renders four distinct groups in the import preview:
  Errors / Migrations / Warnings / Auto-repairs.
- `ImportSummary` carries `sourceSchemaVersion` (best-effort detected
  source version).
- Path-aware `ValidationIssue.path` on every site that has an
  accurate dotted path. Paths are not invented when not known.

**Behavior preserved from 0.6.0:** Every validation outcome remains
identical for current-shape imports. Legacy imports (Phase 3/4
envelopes, raw AppState, schemaVersion-less files) now also flow
through the migration step and surface explicit migration notices
before the user confirms.

---

## Migration engine

The migration engine (`src/utils/migration.ts`) is the place where
*structural version-up transforms* live. It is intentionally small and
explicit — there is no plugin system, no Strategy Pattern, no auto-
discovery — just a registry of named functions.
// excerpt lines 155-194
3. Heuristic from envelope shape: if `envelopeWasLegacy` (Phase 3/4
   envelope), assume `0.4.0` — that's when MediatorSynthesis was
   first introduced, and the chain from 0.4 to 0.7 is no-op for
   shape, so over-shooting is harmless.
4. Falls back to `0.0.0-unknown`. In that case migration is skipped
   and a `SOURCE_VERSION_UNKNOWN` warning is emitted.

### Chain semantics

- If source ≥ target: returns input unchanged with `ALREADY_CURRENT`
  (info) or `SOURCE_NEWER_THAN_APP` (warning in migration engine; triggers `UNSUPPORTED_SCHEMA_VERSION` **error** in validation — import rejected).
- If source < target: every chain step whose `from` is ≥ source's
  current declared version runs in order, each emitting a
  `MIGRATION_STEP_APPLIED` info notice. Final `schemaVersion` is
  stamped to `SCHEMA_VERSION`.
- If source is unknown: skip migration, let validation run on the
  input as-is.

### What migrations may NEVER do

- Fabricate `decisions[]`, `userInstruction`, `modelResponses`,
  `mediatorResponse`, `mediatorSynthesis` content, `canonicalState`,
  decision rationale, compatibility-note text, or project
  descriptions. Migrations are about shape, not substance.
- Discard fields they don't recognize. Forward-compatible behavior
  prefers passing unknown fields through.
- Throw exceptions out of the engine. Bad shapes become validation
  issues, not crashes.

### How to add a migration step when the schema changes

1. Bump `SCHEMA_VERSION` in `src/config/exportFormats.ts` and the
   matching app/package versions (see version-bump checklist below).
2. Write `migrate_X_Y_to_X_Z(state)` in `migration.ts`. Keep it as
   small as possible. If the schema didn't change between two versions,
   the function body is `return state`; it's still useful because the
   chain emits a visible notice.
3. Append the step to `MIGRATION_CHAIN` in version order.
4. Add a "What changed by version" subsection to this document
   describing the structural transform.
~~~~


## Review-Relevant Excerpt: `README.md`

~~~~markdown
// excerpt lines 1-35
# Model Roundtable Console

A local-first browser application for coordinating multiple consumer AI
models in a structured roundtable workflow.

**Phase 7A — Schema Migration, Import Compatibility, and Gemini Review Packet Export**

---

## What This App Is

- A **manual copy/paste coordination cockpit** for multi-model AI workflows
- A **prompt generator** using the Context Sandwich pattern
- A **chain-of-custody audit log** tracking when prompts were copied and responses were pasted
- A **project state and decision logger** with round history
- A **schema-aware import pipeline** that migrates older MRC exports into the current shape
- A **review-packet exporter** that prepares structured Markdown for manual external critique
- A **local-first tool** — all data stays in your browser

## What This App Is Not

- ❌ Not an API orchestration tool — there are no API calls
- ❌ Not a browser automation or scraping tool
- ❌ Not connected to any AI model directly — including Gemini
- ❌ Has no backend, no authentication, no cloud sync
- ❌ Has no model-provider integrations or login automation
- ❌ The Gemini Review Packet is a local Markdown file. MRC does not
  upload it, post it, or send it anywhere. The user carries the file
  to the reviewer manually.

---

## Local Install & Run

**Prerequisites:** Node.js 18+
// excerpt lines 197-207

- This affects the **local development server** only — MRC has no production backend.
- Do **not** run `npm audit fix --force`; it may jump to a breaking Vite major version.
- This will be addressed during Phase 9 release-candidate hardening.
- For local development use, the risk is minimal.

---

## Version

`0.7.0` (Phase 7A) · Schema: `0.7.0` · Storage key: `mrc.appState.v0`
~~~~


## Acceptance Gate Being Reviewed
Phase 7A.1 passes if:

1. Build passes.
2. TypeScript errors are zero.
3. Package/schema versions remain aligned at `0.7.0`.
4. Imports from newer/future schema versions are rejected with a validation error.
5. Confirm Import remains disabled for newer/future schema imports.
6. Older supported schema imports still migrate forward.
7. Dynamic Markdown fencing is preserved.
8. Gemini Review Packet export is preserved and remains local-only.
9. No API calls, scraping, browser automation, auth, backend, cloud sync, model-provider integrations, or new dependencies are added.

## Requested Gemini Output Format
Please respond with:

1. Approval status: Approved / Approved with cleanup notes / Not approved
2. Blocking issues, if any
3. Non-blocking cleanup notes
4. Whether Phase 7A is ready to close
5. Whether the project is ready for Phase 7B
6. Recommended Phase 7B focus areas
