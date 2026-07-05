// src/types/markdownArtifact.ts
// Purpose: Type definitions for the v0.11.0 Markdown Handoff Mode.
// Owned by:  this file
// Used by:   utils/markdownArtifact, utils/markdownParse, utils/artifactImport,
//            utils/importHistory, types/appState, plus all UI surfaces.
//
// Design rules:
//   - The discriminant for the artifact union is `source_kind`.
//   - Fields not applicable to a given source_kind are emitted as YAML null
//     (`~`/null) rather than omitted. This keeps the parser and the
//     hand-written guards simple and predictable.
//   - Substantive fields (project_id, round_id, content_hash, etc.) are
//     captured at *export time* and are then immutable for the artifact's
//     life. The only way to produce a new artifact_id is to re-export.
//   - Raw notes and import transactions live on AppState as bounded ring
//     buffers — see config/markdownHandoff for the cap constants.

import { Round } from './round';
import { Project } from './project';
import { Decision } from './decision';

// ── Discriminant ─────────────────────────────────────────────────────────────

export type MarkdownArtifactSourceKind =
  | 'generated_prompt'
  | 'model_response'
  | 'mediator_packet'
  | 'mediator_synthesis'
  | 'raw_notes';

export const ALL_SOURCE_KINDS: readonly MarkdownArtifactSourceKind[] = [
  'generated_prompt',
  'model_response',
  'mediator_packet',
  'mediator_synthesis',
  'raw_notes',
] as const;

// ── Frontmatter ──────────────────────────────────────────────────────────────

/**
 * The canonical YAML frontmatter that prefixes every RoundTable-generated
 * Markdown artifact. Field order in the emitter is fixed (see
 * markdownArtifact.serializeFrontmatter) so two exports of the same content
 * produce byte-identical files.
 */
export interface MarkdownArtifactFrontmatter {
  /** Namespace + major version. Readers reject unknown values. */
  artifact_type: 'roundtable.markdown.v1';
  /** Which kind of artifact this is. Discriminates the union. */
  source_kind: MarkdownArtifactSourceKind;
  /** App schema version at the moment of export. */
  schema_version: string;
  /** App version (UI/code) at the moment of export. */
  app_version: string;
  /** Unique id for this artifact instance. */
  artifact_id: string;
  /** ISO 8601 export timestamp. */
  exported_at: string;
  /** Owning project. */
  project_id: string;
  project_name: string;
  /** Owning round (null for project-wide artifacts, e.g. raw_notes). */
  round_id: string | null;
  round_number: number | null;
  /** Model the artifact was generated *for* or *by* (null when N/A). */
  model_id: string | null;
  /** SHA-256 of the project canonical state at export time. Null if
   *  hashing is unavailable (file:// deployment). */
  canonical_state_hash: string | null;
  /** SHA-256 of the prompt that produced this response (model_response
   *  only; null otherwise). Null if hashing is unavailable. */
  prompt_hash: string | null;
  /** SHA-256 of the normalized body. Null if hashing is unavailable. */
  content_hash: string | null;
  /** Reserved for future multi-part stitching. Always emitted as null in
   *  v0.11.0. */
  part: { index: number; total: number } | null;
  /** Trust-anchor: identifies who produced this artifact. */
  generated_by: 'roundtable';
}

// ── Build/serialize result ───────────────────────────────────────────────────

/**
 * The return shape of buildArtifact() — the single-source-of-truth function
 * for every download/copy/preview surface. UI paths consume `fullText`;
 * tests verify byte-equality across paths against `fullText`.
 */
export interface BuiltArtifact {
  frontmatter: MarkdownArtifactFrontmatter;
  /** The artifact body, post-normalization. Already includes the artifact's
   *  human-readable section headings. Does NOT include the frontmatter. */
  body: string;
  /** The complete file text: serialized frontmatter + blank line + body.
   *  This is THE string that download/copy/preview must all use. */
  fullText: string;
  /** Convenience: same as frontmatter.artifact_id. */
  artifactId: string;
}

// ── Build inputs ─────────────────────────────────────────────────────────────

/** Common context required for every artifact build. */
export interface ArtifactBuildContext {
  project: Project;
  /** Optional pre-computed canonical state hash. If omitted, buildArtifact
   *  computes it. Passed in by callers that have already computed it
   *  (e.g. roundUtils.generatePromptsForRound). */
  canonicalStateHash?: string | null;
  /** Override for exported_at (testing only; production passes nowIso). */
  exportedAt?: string;
  /** Override for artifact_id (testing/round-trip only). */
  artifactId?: string;
}

export interface BuildGeneratedPromptInput {
  kind: 'generated_prompt';
  ctx: ArtifactBuildContext;
  round: Round;
  /** The prompt being exported. */
  promptId: string;
}

export interface BuildModelResponseInput {
  kind: 'model_response';
  ctx: ArtifactBuildContext;
  round: Round;
  /** The response being exported (matched by modelProfileId on the round). */
  modelProfileId: string;
}

export interface BuildMediatorPacketInput {
  kind: 'mediator_packet';
  ctx: ArtifactBuildContext;
  round: Round;
}

export interface BuildMediatorSynthesisInput {
  kind: 'mediator_synthesis';
  ctx: ArtifactBuildContext;
  round: Round;
}

export interface BuildRawNotesInput {
  kind: 'raw_notes';
  ctx: ArtifactBuildContext;
  /** Free-form body. Used when the user explicitly exports raw notes. */
  body: string;
  /** Optional round association. */
  round?: Round | null;
}

export type BuildArtifactInput =
  | BuildGeneratedPromptInput
  | BuildModelResponseInput
  | BuildMediatorPacketInput
  | BuildMediatorSynthesisInput
  | BuildRawNotesInput;

// ── Raw Notes (fallback substrate) ───────────────────────────────────────────

/** Why a Raw Note ended up in Raw Notes. Helps the user understand what
 *  to do next when reviewing the fallback list. */
export type RawNoteImportStatus =
  | 'malformed'      // Frontmatter or YAML couldn't be parsed at all.
  | 'unmatched'      // Parsed cleanly but couldn't be routed to a project/round.
  | 'duplicate'      // Already imported (content_hash match) but user re-routed here.
  | 'partial'        // Truncation suspected (unclosed fence, missing sections, etc.).
  | 'unparseable';   // Body structure didn't fit the source_kind contract.

export interface RawNote {
  id: string;
  /** ISO 8601 timestamp of when this note landed in Raw Notes. */
  createdAt: string;
  /** Best-effort detection from the parsed frontmatter. Optional. */
  sourceKind?: MarkdownArtifactSourceKind;
  projectId?: string;
  roundId?: string;
  originModel?: string;
  artifactType?: string;
  importStatus: RawNoteImportStatus;
  validationWarnings: ImportValidationWarning[];
  /** The body verbatim. NOT normalized. */
  rawBody: string;
  /** Whatever frontmatter we could parse, even partially. */
  parsedFrontmatter?: Partial<MarkdownArtifactFrontmatter>;
  /** Siblings — ids of other Raw Notes that look related (same project/round,
   *  within ~60s of each other). Used for future stitching. */
  siblingIds?: string[];
}

// ── Import validation warnings ───────────────────────────────────────────────

/** Severity ranking — Errors block the commit gate; Warnings allow it
 *  behind an "Import anyway" two-step; Info is purely informational. */
export type ImportWarningSeverity = 'error' | 'warning' | 'info';

/** Stable codes (UPPER_SNAKE_CASE). Renaming/removing existing codes is
 *  a breaking change for UI filters. New codes can be added freely. */
export type ImportWarningCode =
  // Errors (hard blocks)
  | 'ARTIFACT_TYPE_UNKNOWN'
  | 'SOURCE_KIND_INVALID'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'FRONTMATTER_PARSE_FAILED'
  | 'NO_FRONTMATTER'
  // Warnings
  | 'PROJECT_NOT_FOUND'
  | 'ROUND_NOT_FOUND'
  | 'CANONICAL_STATE_HASH_MISMATCH'
  | 'PROMPT_HASH_MISMATCH'
  | 'CONTENT_HASH_MISMATCH'
  | 'UNCLOSED_CODE_FENCE'
  | 'POTENTIALLY_TRUNCATED'
  | 'BODY_UNPARSEABLE'
  | 'HASHING_UNAVAILABLE'
  | 'STORAGE_NEAR_LIMIT'
  // v0.11.0 Checkpoint E — mediator_synthesis structure warnings.
  // REQUIRED_SECTION_MISSING and DUPLICATE_HEADING are emitted by
  // analyzeSynthesisStructure when the body is missing required
  // headings or contains repeated ones. Neither blocks commit;
  // they're advisory because the resulting synthesis fields just
  // end up empty / concatenated, and the raw body is always
  // preserved on round.mediatorResponse.
  | 'REQUIRED_SECTION_MISSING'
  | 'DUPLICATE_HEADING'
  // v0.11.0 Checkpoint G — model_response structured import gates.
  //
  // EXISTING_RESPONSE_WILL_BE_OVERWRITTEN: surfaced as a 'warning' when
  //   the resolved target slot already holds a non-empty response body.
  //   The modal's two-step "Import anyway" gate forces deliberate
  //   confirmation. Rollback restores both body AND status via the
  //   snapshotBefore.round on the ImportTransaction.
  //
  // MODEL_ID_MISMATCH_WITH_SLOT: emitted only when the import was
  //   triggered from a per-slot Upload .md button (so a target
  //   model_id is known in advance) AND the artifact frontmatter
  //   declares a different model_id. Severity is 'warning' — the
  //   modal's deferred-reason gate downgrades this to a hard block
  //   for structured commit so we never silently misroute.
  //
  // MODEL_ID_NOT_IN_ROSTER: the artifact's declared model_id does
  //   not match ANY model_response slot on the target round.
  //   Severity 'warning'; structured commit is blocked because
  //   there is no slot to populate.
  //
  // LOCKED_ROUND: target round is locked. Severity 'warning';
  //   structured commit is blocked. Raw Notes is still available
  //   so the operator can preserve the body for later review.
  | 'EXISTING_RESPONSE_WILL_BE_OVERWRITTEN'
  | 'MODEL_ID_MISMATCH_WITH_SLOT'
  | 'MODEL_ID_NOT_IN_ROSTER'
  | 'LOCKED_ROUND'
  // v0.11.0 Checkpoint H — generated_prompt + mediator_packet gates.
  //
  // EXISTING_PROMPT_WILL_BE_OVERWRITTEN: emitted when the target round
  //   already has a generated_prompt slot for fm.model_id with a
  //   non-empty promptText. Severity 'warning'; the modal's two-step
  //   "Import anyway" gate handles deliberate confirmation. Rollback
  //   restores the round including any prompt status (generated /
  //   copied) that was preserved.
  //
  // EXISTING_PACKET_WILL_BE_OVERWRITTEN: emitted when the target round
  //   already has a non-empty round.mediatorPrompt and the import
  //   would replace it. Severity 'warning' + two-step gate.
  | 'EXISTING_PROMPT_WILL_BE_OVERWRITTEN'
  | 'EXISTING_PACKET_WILL_BE_OVERWRITTEN'
  // Info
  | 'CONTENT_HASH_MATCHES_EXISTING'
  | 'MIGRATION_NOTICE'
  // v0.11.0 Checkpoint E — heading-shaped lines that didn't match
  // any HEADING_MAP entry. Body below an unmatched heading is NOT
  // structurally mapped (the synthesis field stays empty), but
  // round.mediatorResponse retains the full raw body verbatim.
  | 'UNMATCHED_HEADING';

export interface ImportValidationWarning {
  code: ImportWarningCode;
  severity: ImportWarningSeverity;
  message: string;
  /** Dotted path into the frontmatter or body when available. */
  path?: string;
}

// ── Import preview & transaction (committed import) ──────────────────────────

/**
 * v0.11.0 Checkpoint G — optional context for buildImportPreview.
 *
 * The panel-level Upload .md affordance provides no caller-known
 * expectations; the importer takes the artifact's frontmatter at face
 * value. A per-slot Upload .md affordance (e.g. each row in
 * ResponsesPanel) DOES know in advance what model_id the user expects
 * to import into. Passing that expectation lets the preview surface
 * a clear mismatch warning when the uploaded file targets a different
 * model.
 *
 * The context is purely additive. All fields are optional. Existing
 * callers that omit the parameter behave exactly as before.
 */
export interface ImportPreviewContext {
  /** When a panel only meaningfully accepts one source kind. Currently
   *  used by per-slot Upload .md affordances in ResponsesPanel
   *  (expects 'model_response'). Mismatch becomes a hard-block warning
   *  on structured commit but Raw Notes is still available. */
  expectedSourceKind?: MarkdownArtifactSourceKind;
  /** When the caller knows which model_id the user intends to import.
   *  Mismatch with frontmatter.model_id becomes
   *  `MODEL_ID_MISMATCH_WITH_SLOT`. */
  expectedModelId?: string;
}

/** What buildPreview returns. The user reviews this surface before commit. */
export interface ImportPreview {
  /** The raw text the user gave us (after CRLF→LF and BOM strip, but
   *  *not* per-line normalized — we show what they handed us). */
  rawText: string;
  /** Was a frontmatter block found? */
  hadFrontmatter: boolean;
  /** Parsed frontmatter (when possible — fields that failed validation
   *  may be undefined here). */
  frontmatter?: Partial<MarkdownArtifactFrontmatter>;
  /** The post-frontmatter body, exactly as it appeared in the file. */
  body: string;
  /** Body run through normalizeForHash — what we'd actually persist. */
  normalizedBody: string;
  /** Recomputed content hash of the normalized body (null if hashing
   *  unavailable). */
  recomputedContentHash: string | null;
  /** Warnings, grouped by severity in the UI. */
  warnings: ImportValidationWarning[];
  /** Where this artifact will land if committed. */
  targetSummary: ImportTargetSummary;
  /** What outcomes the commit step has available. */
  availableOutcomes: ImportOutcome[];
  /** Default outcome (highlighted in UI). Always one of availableOutcomes. */
  defaultOutcome: ImportOutcome;
}

export interface ImportTargetSummary {
  sourceKind?: MarkdownArtifactSourceKind;
  projectId?: string;
  projectName?: string;
  roundId?: string;
  roundNumber?: number;
  modelId?: string;
  /** Human-readable summary, e.g. "Mediator packet for Round 7". */
  description: string;
}

/** What the user picks at the commit gate. */
export type ImportOutcome =
  | 'commit'           // Apply to AppState as the artifact's source_kind dictates.
  | 'import_as_raw'    // Route to Raw Notes verbatim with warnings preserved.
  | 'cancel';          // Discard.

// ── Import transaction (committed history) ───────────────────────────────────

/** One discrete commit landed in AppState. Used for rollback and history. */
export interface ImportTransaction {
  id: string;
  /** ISO 8601. */
  timestamp: string;
  sourceArtifactType: MarkdownArtifactSourceKind;
  /** Frontmatter.artifact_id of the imported file (when available). */
  sourceArtifactId?: string;
  projectId?: string;
  roundId?: string;
  /** The slice of AppState we restore on rollback. Intentionally NOT the
   *  whole AppState — rollback is targeted, not global. */
  snapshotBefore: ImportSnapshotSlice;
  /** Diff-like log for the history UI. */
  changes: ImportChange[];
  /** Populated when (and only when) the user rolled this transaction back. */
  rolledBackAt?: string;
  rollbackReason?: string;
}

export interface ImportSnapshotSlice {
  /** Snapshot of the affected round, if any. */
  round?: Round;
  /** Snapshot of the affected project, if the import touched it (e.g.
   *  a synthesis import that later got applied to canonical state — note:
   *  v0.11.0 does not auto-apply canonical state, but we still snapshot
   *  for future-proofing). */
  project?: Project;
  /** Snapshot of decisions touched. */
  decisions?: Decision[];
  /** Snapshot of a Raw Note added by the import, so rollback removes it. */
  rawNoteId?: string;
}

export type ImportChangeKind =
  | 'round_field_set'
  | 'round_synthesis_set'
  | 'round_response_set'
  | 'round_prompt_set'
  | 'raw_note_added'
  | 'project_updated';

export interface ImportChange {
  kind: ImportChangeKind;
  /** Free-form description for the history UI. */
  description: string;
  /** Optional path into AppState, e.g. `rounds[2].mediatorSynthesis`. */
  path?: string;
}
