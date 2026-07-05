# Data Model

RoundTable — v0.11.0 (Markdown Handoff Mode)

## AppState (schema v0.11.0)

Single top-level object. Storage key: `roundtable.appState.v1`.

```
AppState {
  schemaVersion: string                  // e.g. "0.11.0"
  activeProjectId: string | null
  projects: Project[]
  modelProfiles: ModelProfile[]
  promptTemplates: PromptTemplate[]
  promptWrappers: PromptWrapper[]        // since 0.8.0
  rounds: Round[]
  decisions: Decision[]
  compatibilityNotes: CompatibilityNote[]
  rawNotes: RawNote[]                    // NEW in 0.11.0
  importHistory: ImportTransaction[]     // NEW in 0.11.0
  updatedAt: string                      // ISO timestamp
}
```

**Shape change vs 0.10.5:** new top-level `rawNotes` and
`importHistory` arrays for Markdown Handoff Mode (v0.11.0). Migration
step `0.10.5 → 0.11.0` (in `src/utils/migration.ts`) defaults both
to `[]` when missing. See `docs/SCHEMA_EVOLUTION.md → 0.10.5 → 0.11.0`
for the full versioning history and `docs/MARKDOWN_HANDOFF.md` for
the operator reference.

**v0.11.0 note:** the AppState shape change in 0.11.0 is the first
structural expansion since Phase 7B / `0.8.0`. The two new arrays
are bounded ring buffers — see "v0.11.0 Markdown Handoff Fields"
below.

## Phase 7B field expansions (additive, all optional)

| Type | New optional fields |
|---|---|
| `ModelProfile` | `profileVersion`, `vendorUrl`, `contextWindowNotes`, `defaultPromptWrapperId`, `modelBehaviorNotes`, `formattingNotes`, `refusalRiskNotes`, `strengths`, `weaknesses`, `lastReviewedAt` |
| `PromptTemplate` | `createdAt`, `updatedAt`, `changelog`, `active`, `supersedesTemplateId` |
| `CompatibilityNote` | `severity` (`low \| medium \| high \| workflow_breaking`), `impact`, `linkedModelProfileId`, `linkedPromptTemplateId`, `linkedPromptWrapperId`, `reviewedAt`. `status` enum widened to include `'deprecated'`. |

## PromptWrapper (Phase 7B, new)

Vendor-specific framing layer that wraps the Context Sandwich.

```
PromptWrapper {
  id: string
  name: string
  purpose: string
  targetVendor?: string
  targetRole?: string
  wrapperText: string                    // header above Sandwich
  outputInstructions: string             // footer below Sandwich
  compatibilityNotes?: string
  version?: string
  active?: boolean
}
```

`GENERIC_WRAPPER_ID` (= `"wrapper-generic"`) is exported from
`src/config/promptWrappers.ts` and is the canonical safe fallback
referenced by both `migration.ts` and `promptGeneration.ts`. Do not
rename or remove it.

## CompatibilityTest (Phase 7B, new — static config only)

Manual paste-into-model behavior test. **RoundTable does not run these.**
Lives in `src/config/compatibilityTests.ts`, not in `AppState`.

```
CompatibilityTest {
  id: string
  name: string
  purpose: string
  targetVendor?: string
  targetRole?: string
  promptText: string                     // pasted into target model
  expectedShape: string                  // what a passing response looks like
  notes?: string
}
```

## Round (Phase 5+ schema, unchanged in Phase 6)

```
Round {
  id, projectId, roundNumber, phase
  userInstruction: string
  selectedModelIds: string[]
  generatedPrompts: GeneratedPrompt[]
  modelResponses: ModelResponse[]
  mediatorPrompt: string
  mediatorResponse: string                // raw GPT-5.5 output
  mediatorSynthesis?: MediatorSynthesis   // user-reviewed structured fields
  userDecision: string
  canonicalStateUpdate: string            // user-approved; never auto-applied
  agreements, disagreements, risks, openQuestions, nextActions: string[]
  locked: boolean
  createdAt, updatedAt: string
}
```

## MediatorSynthesis

Nested object on Round. All fields are user-editable after extraction.
Nothing in MediatorSynthesis is applied to AppState automatically.

```
MediatorSynthesis {
  executiveSummary: string
  agreements: string
  disagreements: string
  risks: string
  openQuestions: string
  modelSpecificObservations: string
  recommendedDecision: string
  decisionRationale: string
  proposedCanonicalStateUpdate: string    // PROPOSAL ONLY — not auto-applied
  proposedNextActions: string
  proposedNextRoundPrompt: string
  confidenceCaveats: string
  updatedAt: string
}
```

## GeneratedPrompt / ModelResponse

```
GeneratedPrompt {
  id: string
  modelProfileId: string
  modelDisplayName: string
  promptText: string
  generatedAt: string
  copiedAt?: string
  status: 'generated' | 'copied'
}

ModelResponse {
  id: string
  modelProfileId: string
  modelDisplayName: string
  responseText: string
  pastedAt?: string
  status: 'awaiting_response' | 'pasted' | 'reviewed' | 'excluded'
}
```

Recovered IDs are minted by `generateSafeId('recovered-...')` from
`src/utils/id.ts`, which prefers `crypto.randomUUID()` with a
timestamp+random fallback. See `docs/MAINTAINABILITY.md` for the
full ID story.

## Decision

```
Decision {
  id: string
  projectId: string
  roundId: string
  decisionText: string
  rationale: string
  createdAt: string

  phase?: string
  nextAction?: string
  supersedesDecisionId?: string
}
```

## Validation issue typing (Phase 6, refreshed in Phase 7A)

`src/utils/validation.ts` exports `VALIDATION_CODES` (frozen object,
Phase 7A), `ValidationIssue`, `ValidationSeverity`, and the derived
`ValidationCode` literal-union type. Every validation finding —
structural error, referential rejection, soft repair, or schema
version mismatch — is represented as a typed issue:

```
ValidationIssue {
  code: ValidationCode      // stable enum — see VALIDATION_CODES
  severity: 'error' | 'warning' | 'info'
  message: string           // user-facing
  path?: string             // e.g. "rounds[3].projectId"
}
```

`ValidationResult` carries `issues: ValidationIssue[]` plus the
legacy `errors: string[]` / `warnings: string[]` for backward
compatibility. Phase 7A added `migrations: MigrationNotice[]` as a
separate stream alongside issues — migrations describe version-up
transformations applied by the migration engine, not validation
issues.

## Migration notices (Phase 7A)

`src/utils/migration.ts` exports `MIGRATION_CODES` (frozen object),
`MigrationNotice`, `MigrationResult`, and `migrateAppState()`.

```
MigrationNotice {
  code: MigrationCode       // see MIGRATION_CODES
  severity: 'info' | 'warning'
  message: string
  path?: string
}

MigrationResult {
  state: unknown            // migrated raw state — validation will check
  sourceVersion: string     // detected source schemaVersion (best effort)
  targetVersion: string     // always equals SCHEMA_VERSION
  migrationsApplied: MigrationNotice[]
}
```

`ImportSummary` carries an optional `sourceSchemaVersion` field
populated from `MigrationResult.sourceVersion`, so the import diff
table and any future tooling can show the detected source version.

## Canonical State Rule

**App never silently overwrites Project.canonicalState.**

The only authorized update path:

1. User reviews `proposedCanonicalStateUpdate` in Decision Log.
2. User checks "Apply to Project Canonical State".
3. User confirms lock action.
4. `applyCanonicalStateUpdate()` appends a dated section.

## Schema Versioning

Current: `0.11.0` in `src/config/exportFormats.ts`.

When changing the data model, follow the workflow in
`docs/SCHEMA_EVOLUTION.md → How to add a new schema field safely`,
and add a migration step per
`docs/MAINTAINABILITY.md → How to add a migration step`.

Because Phases 8 and 9 did not change the AppState shape, `0.10.0` is a version-tracking/release-candidate bump over the Phase 7B `0.8.0` schema shape rather than a structural expansion.

---

## v0.10.1 Project Lifecycle Fields

```typescript
// Project — optional lifecycle fields added in v0.10.1
archived?: boolean;        // true = hidden from active project list
archivedAt?: string | null; // ISO timestamp when archived, or null
```

**Project scoping rules:**
- `rounds[].projectId` — every round belongs to exactly one project
- `decisions[].projectId` — every decision belongs to exactly one project
- `modelProfiles`, `promptTemplates`, `promptWrappers`, `compatibilityNotes` — **global**, shared across all projects

**Lifecycle operations (src/utils/projectUtils.ts):**
- `createNewProject()` — creates project with `archived: false`, no rounds, no decisions
- `duplicateProject()` — deep-copies with fresh IDs; no orphaned rounds or decisions
- `archiveProject()` — sets `archived: true`; auto-switches activeProjectId if needed
- `deleteProject()` — removes project + matching rounds + matching decisions; prevents orphans

---

## v0.11.0 Markdown Handoff Fields

Two new top-level arrays on `AppState`, both bounded ring buffers,
both defined in `src/types/markdownArtifact.ts`. Caps are locked in
`src/config/markdownHandoff.ts`.

### RawNote (fallback substrate)

```typescript
type RawNoteImportStatus =
  | 'malformed'      // Frontmatter or YAML couldn't be parsed at all
  | 'unmatched'      // Parsed cleanly but couldn't be routed to a project/round
  | 'duplicate'      // Already imported (content_hash match) but user re-routed here
  | 'partial'        // Truncation suspected (unclosed fence, missing sections, etc.)
  | 'unparseable';   // Body structure didn't fit the source_kind contract

interface RawNote {
  id: string;
  createdAt: string;                            // ISO 8601
  sourceKind?: MarkdownArtifactSourceKind;      // best-effort from frontmatter
  projectId?: string;
  roundId?: string;
  originModel?: string;
  artifactType?: string;
  importStatus: RawNoteImportStatus;
  validationWarnings: ImportValidationWarning[];
  rawBody: string;                              // VERBATIM — NOT normalized
  parsedFrontmatter?: Partial<MarkdownArtifactFrontmatter>;
  siblingIds?: string[];                        // reserved for v0.11.1 stitching
}
```

Cap: `RAW_NOTES_DEFAULT_CAP = 200`. Older entries are pruned on
add. Re-import as a structured artifact is **not supported by
design** — Raw Notes are a manual-review space.

### ImportTransaction (commit log + rollback substrate)

```typescript
type ImportChangeKind =
  | 'round_field_set'
  | 'round_synthesis_set'
  | 'round_response_set'
  | 'round_prompt_set'
  | 'raw_note_added'
  | 'project_updated';

interface ImportChange {
  kind: ImportChangeKind;
  description: string;                  // free-form for the history UI
  path?: string;                        // e.g. "rounds[2].mediatorSynthesis"
}

interface ImportSnapshotSlice {
  round?: Round;                        // pre-import round (deep-cloned)
  project?: Project;
  decisions?: Decision[];
  rawNoteId?: string;                   // for raw-note imports
}

interface ImportTransaction {
  id: string;
  timestamp: string;                    // ISO 8601
  sourceArtifactType: MarkdownArtifactSourceKind;
  sourceArtifactId?: string;            // from frontmatter
  projectId?: string;
  roundId?: string;
  snapshotBefore: ImportSnapshotSlice;
  changes: ImportChange[];
  rolledBackAt?: string;                // ISO; set only when rolled back
  rollbackReason?: string;
}
```

Cap: `IMPORT_HISTORY_DEFAULT_CAP = 50`. Older entries remain
visible but their rollback button is disabled. Rollback granularity
is most-recent-only in v0.11.0; cascading rollback is deferred to
v0.11.1.

### MarkdownArtifactFrontmatter (the file format)

```typescript
type MarkdownArtifactSourceKind =
  | 'generated_prompt'
  | 'model_response'
  | 'mediator_packet'
  | 'mediator_synthesis'
  | 'raw_notes';

interface MarkdownArtifactFrontmatter {
  artifact_type: 'roundtable.markdown.v1'; // locked namespace + major
  source_kind: MarkdownArtifactSourceKind;
  schema_version: string;                  // app schema at export
  app_version: string;
  artifact_id: string;
  exported_at: string;                     // ISO 8601
  project_id: string;
  project_name: string;
  round_id: string | null;                 // null for project-wide (raw_notes)
  round_number: number | null;
  model_id: string | null;                 // null when N/A
  canonical_state_hash: string | null;     // sha256:<64-hex> or null
  prompt_hash: string | null;              // model_response only; else null
  content_hash: string | null;             // null when hashing unavailable
  part: { index: number; total: number } | null;  // reserved for v0.11.1
  generated_by: 'roundtable';              // trust anchor
}
```

Field order in the emitter is fixed (see
`serializeFrontmatterYaml` in `src/utils/markdownArtifact.ts`) so
two exports of the same content produce byte-identical files.

### Optional GeneratedPrompt field added in v0.11.0

```typescript
interface GeneratedPrompt {
  // ... unchanged 0.10.5 fields
  canonicalStateHashAtGeneration?: string;  // sha256:<hex> — NEW in v0.11.0
}
```

Captured when the prompt is generated; used to stamp matching
artifact frontmatter so importers can detect when a file was
generated under different project state. Missing on pre-v0.11.0
prompts; the stale-state badge silently skips rather than emitting
a false positive (per the "do not invent substantive content" rule).
The migration does not fabricate the value.

### Storage pressure thresholds (locked)

```typescript
const STORAGE_WARN_BYTES = 3_500_000;     // ~3.34 MB — cosmetic banner
const STORAGE_HARD_BYTES = 4_250_000;     // ~4.05 MB — block growing ops
```

The app shell renders a `StoragePressureBanner` at three levels:
`warn`, `hard`, and `error` (the latter when a save actually
failed with `QuotaExceededError`). The pre-commit storage
projection (`projectPostWritePressure` in `src/utils/storagePressure.ts`)
raises a `window.confirm` at the `hard` level before structured
commits.
