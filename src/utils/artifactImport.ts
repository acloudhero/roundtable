// src/utils/artifactImport.ts
// Purpose: v0.11.0 Markdown Handoff Mode import pipeline.
//
// Pipeline stages (all pure, no localStorage writes — commit lives in
// importHistory.ts):
//
//   1. splitFrontmatter()    → frontmatter found / not / parse-error
//   2. validateFrontmatter() → schema-shape and type guards
//   3. resolveTargets()      → project/round lookup; mismatch detection
//   4. compareHashes()       → content_hash, canonical_state_hash,
//                              prompt_hash recomputation + compare
//   5. buildImportPreview()  → assemble the ImportPreview the modal renders
//
// Outcomes (decided by user at the preview gate):
//   - commit: apply to AppState (caller hands the preview to commitImport
//             in importHistory.ts).
//   - import_as_raw: route to Raw Notes, preserving body verbatim.
//   - cancel: discard.
//
// Raw Notes is the universal fallback. Files with malformed YAML, no
// frontmatter, unsupported artifact_type, etc. are *not blocked*; the
// preview offers "Import as Raw Notes" with all available metadata
// preserved. The user retains full agency.
//
// This file is pure. Hash computation is async (SubtleCrypto).

import {
  BuiltArtifact,
  ImportOutcome,
  ImportPreview,
  ImportPreviewContext,
  ImportTargetSummary,
  ImportValidationWarning,
  ImportWarningCode,
  ImportWarningSeverity,
  MarkdownArtifactFrontmatter,
  MarkdownArtifactSourceKind,
  RawNote,
  RawNoteImportStatus,
  ALL_SOURCE_KINDS,
  BuildArtifactInput,
} from '../types/markdownArtifact';
import { AppState } from '../types/appState';
import { ARTIFACT_TYPE, SCHEMA_VERSION } from '../config/exportFormats';
import { splitFrontmatter, walkFenceAware } from './markdownParse';
import { normalizeForHash } from './markdownNormalize';
import { computeContentHash, hashesEqual, isHashingAvailable, parseContentHash } from './markdownHash';
import { TRUNCATION_TERMINATORS } from '../config/markdownHandoff';
import { generateSafeId } from './id';
import { nowIso } from './dateTime';
import { buildArtifact } from './markdownArtifact';
// v0.11.0 Checkpoint E — used by analyzeSynthesisStructure to surface
// missing/duplicate/unmatched-heading warnings for mediator_synthesis
// imports. Imported lazily-typed (the function returns a backward-
// compatible extended shape; older builds returned a narrower one).
import { extractMediatorSections, SYNTHESIS_FIELD_LABELS, type SynthesisKey } from './mediatorExtract';

// ── Public entry point ──────────────────────────────────────────────────────

/**
 * Build a full ImportPreview from raw uploaded/pasted text. The preview
 * is the gate the user reviews before committing. Async because hash
 * recomputation requires SubtleCrypto.
 *
 * The returned preview always carries a non-empty `availableOutcomes`
 * array. `cancel` and `import_as_raw` are always available; `commit`
 * is added only when validation finds no Errors AND the artifact's
 * source_kind has a registered commit path.
 */
export async function buildImportPreview(
  rawText: string,
  state: AppState,
  // v0.11.0 Checkpoint G — optional context. When the caller knows in
  // advance which source kind / model id the user intends to import
  // (e.g. a per-slot Upload .md button in ResponsesPanel), passing it
  // here surfaces a clear mismatch warning if the artifact targets
  // something else. Purely additive; existing callers omit it.
  context?: ImportPreviewContext
): Promise<ImportPreview> {
  const warnings: ImportValidationWarning[] = [];

  // Strip a leading BOM defensively (also handled by splitFrontmatter).
  const text = rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText;

  const split = splitFrontmatter(text);

  // ── Branch A: No frontmatter or unparseable ────────────────────────────
  if (!split.hadFrontmatter) {
    warnings.push({
      code: 'NO_FRONTMATTER',
      severity: 'warning',
      message:
        'File does not begin with a valid `---` frontmatter delimiter. ' +
        'It can still be imported as Raw Notes, but RoundTable cannot route it to a specific round, ' +
        'detect staleness, or verify provenance.',
    });

    const normalized = normalizeForHash(text);
    const recomputed = await computeContentHash(normalized);
    if (!isHashingAvailable()) warnings.push(hashingUnavailableWarning());

    return {
      rawText: text,
      hadFrontmatter: false,
      body: text,
      normalizedBody: normalized,
      recomputedContentHash: recomputed,
      warnings,
      targetSummary: {
        description: 'Body-only file — will be saved as a Raw Note.',
      },
      availableOutcomes: ['import_as_raw', 'cancel'],
      defaultOutcome: 'import_as_raw',
    };
  }

  // ── Branch B: Frontmatter present but YAML parse failed ────────────────
  if (split.parseError !== undefined || split.parsedYaml === undefined || split.parsedYaml === null) {
    warnings.push({
      code: 'FRONTMATTER_PARSE_FAILED',
      severity: 'warning',
      message:
        `Frontmatter delimiters were found but YAML parsing failed: ${split.parseError ?? 'no parsed value'}. ` +
        'Import as Raw Notes to preserve the body verbatim while the frontmatter is investigated.',
    });

    const normalized = normalizeForHash(split.body);
    const recomputed = await computeContentHash(normalized);
    if (!isHashingAvailable()) warnings.push(hashingUnavailableWarning());

    return {
      rawText: text,
      hadFrontmatter: true,
      body: split.body,
      normalizedBody: normalized,
      recomputedContentHash: recomputed,
      warnings,
      targetSummary: {
        description: 'Frontmatter present but YAML failed to parse — will be saved as a Raw Note.',
      },
      availableOutcomes: ['import_as_raw', 'cancel'],
      defaultOutcome: 'import_as_raw',
    };
  }

  // ── Branch C: Frontmatter parsed; run guards ───────────────────────────
  const fm: Partial<MarkdownArtifactFrontmatter> = {};
  const fmValidationOk = validateFrontmatter(split.parsedYaml, fm, warnings);

  // Body & hash, regardless of validation outcome.
  const normalized = normalizeForHash(split.body);
  const recomputedHash = await computeContentHash(normalized);
  if (!isHashingAvailable()) warnings.push(hashingUnavailableWarning());

  // Validate body shape and detect truncation regardless of frontmatter
  // success — the body warnings remain meaningful.
  detectTruncationAndUnclosedFence(split.body, warnings);

  // Resolve target & compare hashes (only when frontmatter was usable).
  let targetSummary: ImportTargetSummary = { description: 'Unknown target.' };
  let commitAvailable = false;

  if (fmValidationOk && fm.source_kind) {
    targetSummary = resolveTargetSummary(fm, state);

    // Schema-version newer than this app's: hard block on commit (allow
    // raw notes save still).
    if (fm.schema_version && isSchemaNewerThanApp(fm.schema_version)) {
      warnings.push({
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        severity: 'error',
        message:
          `Artifact declares schema_version "${fm.schema_version}", which is newer than this app's ` +
          `supported version "${SCHEMA_VERSION}". Update RoundTable before importing as a structured artifact, ` +
          `or save as Raw Notes to preserve the body.`,
        path: 'schema_version',
      });
    }

    // Compare hashes — synchronous content-hash check + project/round
    // resolution. Canonical/prompt staleness checks are async and are
    // done by the caller (modal) via checkCanonicalStateStaleness /
    // checkPromptStaleness so we don't double-await here.
    compareHashes(fm, recomputedHash, state, warnings);

    // Detect duplicate (already imported by artifact_id) — info only.
    detectDuplicateImport(fm, state, warnings);

    // v0.11.0 Checkpoint E — when source_kind is mediator_synthesis,
    // run the structured extractor against the normalized body and
    // surface any missing-required-heading / duplicate-heading /
    // unmatched-heading findings as warnings. The warnings are
    // advisory: missing headings do NOT block commit (the
    // resulting synthesis will simply have an empty field). The
    // raw body is preserved on round.mediatorResponse by
    // commitMediatorSynthesis, so unmatched content is never lost.
    if (fm.source_kind === 'mediator_synthesis') {
      analyzeSynthesisStructure(normalized, warnings);
    }

    // v0.11.0 Checkpoint G — model_response target validation.
    //
    // For model_response artifacts we run additional resolution checks
    // against the live state: does the declared model_id map to any
    // existing response slot on the resolved round, will the import
    // overwrite an existing response body, is the round locked. These
    // are independent of the body content (which is captured verbatim
    // into the response slot regardless) — they're about WHERE the
    // body lands.
    //
    // Per-slot Upload .md affordances pass an `expectedModelId` in
    // `context`; mismatch with frontmatter.model_id surfaces a
    // dedicated MODEL_ID_MISMATCH_WITH_SLOT warning that the modal's
    // deferred-reason gate uses to hard-block structured commit
    // (Raw Notes remains available).
    if (fm.source_kind === 'model_response') {
      analyzeModelResponseTarget(fm, state, warnings, context);
    }

    // v0.11.0 Checkpoint H — generated_prompt target validation.
    // Round-level lock + per-prompt overwrite + model_id resolution.
    if (fm.source_kind === 'generated_prompt') {
      analyzeGeneratedPromptTarget(fm, state, warnings);
    }

    // v0.11.0 Checkpoint H — mediator_packet target validation.
    // Round-level lock + packet-overwrite. No model-level concerns.
    if (fm.source_kind === 'mediator_packet') {
      analyzeMediatorPacketTarget(fm, state, warnings);
    }

    // v0.11.0 Checkpoint G — caller-known source_kind expectation.
    // If the panel only meaningfully accepts one source kind (e.g.
    // a per-slot Upload .md in ResponsesPanel expects model_response)
    // and the file declares something else, surface a hard mismatch.
    if (
      context?.expectedSourceKind &&
      fm.source_kind &&
      fm.source_kind !== context.expectedSourceKind
    ) {
      warnings.push({
        code: 'SOURCE_KIND_INVALID',
        severity: 'error',
        message:
          `This affordance expected source_kind "${context.expectedSourceKind}" ` +
          `but the file declares "${fm.source_kind}". Structured import is disabled; ` +
          `you can still save the file as a Raw Note to preserve the body verbatim.`,
        path: 'source_kind',
      });
    }

    // commit_available iff no Errors AND the source_kind has a real
    // commit path. raw_notes routes via 'import_as_raw'.
    const hasErrors = warnings.some((w) => w.severity === 'error');
    commitAvailable = !hasErrors && fm.source_kind !== 'raw_notes';
  }

  const availableOutcomes: ImportOutcome[] = ['import_as_raw', 'cancel'];
  if (commitAvailable) availableOutcomes.unshift('commit');

  const defaultOutcome: ImportOutcome = commitAvailable ? 'commit' : 'import_as_raw';

  return {
    rawText: text,
    hadFrontmatter: true,
    frontmatter: fm,
    body: split.body,
    normalizedBody: normalized,
    recomputedContentHash: recomputedHash,
    warnings,
    targetSummary,
    availableOutcomes,
    defaultOutcome,
  };
}

// ── Frontmatter guards ──────────────────────────────────────────────────────

/**
 * Validate the parsed YAML against the locked frontmatter schema. Populates
 * `out` with every field we successfully recognized; pushes warnings for
 * every problem. Returns true if the frontmatter is "usable" — meaning we
 * could identify the source_kind and project_id at minimum. False forces
 * the import down the Raw Notes path.
 */
function validateFrontmatter(
  parsed: unknown,
  out: Partial<MarkdownArtifactFrontmatter>,
  warnings: ImportValidationWarning[]
): boolean {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    warnings.push({
      code: 'FRONTMATTER_PARSE_FAILED',
      severity: 'warning',
      message: 'Parsed frontmatter is not a mapping. Expected a flat YAML object.',
    });
    return false;
  }

  const raw = parsed as Record<string, unknown>;

  // artifact_type — must match the locked namespace + major.
  if (typeof raw.artifact_type !== 'string') {
    pushError(warnings, 'ARTIFACT_TYPE_UNKNOWN',
      'Missing or non-string `artifact_type`. RoundTable handoff files must declare `artifact_type: roundtable.markdown.v1`.',
      'artifact_type');
    return false;
  }
  if (raw.artifact_type !== ARTIFACT_TYPE) {
    pushError(warnings, 'ARTIFACT_TYPE_UNKNOWN',
      `Unknown artifact_type "${raw.artifact_type}". This app expects "${ARTIFACT_TYPE}". ` +
      `Save as Raw Notes to preserve the body.`,
      'artifact_type');
    return false;
  }
  out.artifact_type = ARTIFACT_TYPE;

  // source_kind — must be one of the locked values.
  if (typeof raw.source_kind !== 'string' || !isValidSourceKind(raw.source_kind)) {
    pushError(warnings, 'SOURCE_KIND_INVALID',
      `Missing or invalid \`source_kind\`. Expected one of: ${ALL_SOURCE_KINDS.join(', ')}.`,
      'source_kind');
    return false;
  }
  out.source_kind = raw.source_kind as MarkdownArtifactSourceKind;

  // Required strings.
  out.schema_version = strField(raw.schema_version, 'schema_version', warnings, true);
  out.app_version = strField(raw.app_version, 'app_version', warnings, false);
  out.artifact_id = strField(raw.artifact_id, 'artifact_id', warnings, false);
  out.exported_at = strField(raw.exported_at, 'exported_at', warnings, false);
  out.project_id = strField(raw.project_id, 'project_id', warnings, true);
  out.project_name = strField(raw.project_name, 'project_name', warnings, false);
  out.generated_by = 'roundtable';

  // Nullable strings.
  out.round_id = nullableStr(raw.round_id);
  out.model_id = nullableStr(raw.model_id);
  out.canonical_state_hash = nullableHashStr(raw.canonical_state_hash, 'canonical_state_hash', warnings);
  out.prompt_hash = nullableHashStr(raw.prompt_hash, 'prompt_hash', warnings);
  out.content_hash = nullableHashStr(raw.content_hash, 'content_hash', warnings);

  // round_number — number or null.
  if (raw.round_number === null || raw.round_number === undefined) {
    out.round_number = null;
  } else if (typeof raw.round_number === 'number' && isFinite(raw.round_number)) {
    out.round_number = raw.round_number;
  } else {
    out.round_number = null;
    warnings.push({
      code: 'FRONTMATTER_PARSE_FAILED',
      severity: 'warning',
      message: '`round_number` was not a number or null; treating as null.',
      path: 'round_number',
    });
  }

  // part — reserved for v0.11.1. Accept null/missing; ignore objects.
  out.part = null;

  return Boolean(out.source_kind && out.project_id);
}

function isValidSourceKind(s: string): boolean {
  return (ALL_SOURCE_KINDS as readonly string[]).includes(s);
}

function strField(
  v: unknown,
  path: string,
  warnings: ImportValidationWarning[],
  required: boolean
): string {
  if (typeof v === 'string') return v;
  if (required) {
    pushError(warnings, 'FRONTMATTER_PARSE_FAILED',
      `Missing or non-string \`${path}\`.`, path);
  }
  return '';
}

function nullableStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  return null;
}

function nullableHashStr(
  v: unknown,
  path: string,
  warnings: ImportValidationWarning[]
): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return null;
  if (parseContentHash(v) === null) {
    warnings.push({
      code: 'FRONTMATTER_PARSE_FAILED',
      severity: 'warning',
      message: `\`${path}\` does not match the expected \`sha256:<64-hex>\` shape. Field ignored.`,
      path,
    });
    return null;
  }
  return v;
}

// ── Target resolution ───────────────────────────────────────────────────────

function resolveTargetSummary(
  fm: Partial<MarkdownArtifactFrontmatter>,
  state: AppState
): ImportTargetSummary {
  const project = fm.project_id ? state.projects.find((p) => p.id === fm.project_id) : undefined;
  const round = fm.round_id ? state.rounds.find((r) => r.id === fm.round_id) : undefined;

  return {
    sourceKind: fm.source_kind,
    projectId: fm.project_id ?? undefined,
    projectName: project?.name ?? fm.project_name ?? undefined,
    roundId: fm.round_id ?? undefined,
    roundNumber: round?.roundNumber ?? fm.round_number ?? undefined,
    modelId: fm.model_id ?? undefined,
    description: humanTargetDescription(fm, project?.name, round?.roundNumber),
  };
}

function humanTargetDescription(
  fm: Partial<MarkdownArtifactFrontmatter>,
  resolvedProjectName: string | undefined,
  resolvedRoundNumber: number | undefined
): string {
  const kind = fm.source_kind ?? 'unknown';
  const proj = resolvedProjectName ?? fm.project_name ?? '(unknown project)';
  const r = resolvedRoundNumber ?? fm.round_number;
  switch (kind) {
    case 'generated_prompt':
      return `Generated prompt for ${fm.model_id ?? 'model'} on Round ${r ?? '?'} of "${proj}".`;
    case 'model_response':
      return `Model response from ${fm.model_id ?? 'model'} on Round ${r ?? '?'} of "${proj}".`;
    case 'mediator_packet':
      return `Mediator packet for Round ${r ?? '?'} of "${proj}".`;
    case 'mediator_synthesis':
      return `Mediator synthesis for Round ${r ?? '?'} of "${proj}".`;
    case 'raw_notes':
      return `Raw notes for "${proj}".`;
    default:
      return `Unknown artifact kind "${kind}".`;
  }
}

// ── Hash comparisons ────────────────────────────────────────────────────────

function compareHashes(
  fm: Partial<MarkdownArtifactFrontmatter>,
  recomputedBodyHash: string | null,
  state: AppState,
  warnings: ImportValidationWarning[]
): void {
  // content_hash mismatch with frontmatter — file was edited after export.
  if (fm.content_hash && recomputedBodyHash && !hashesEqual(fm.content_hash, recomputedBodyHash)) {
    warnings.push({
      code: 'CONTENT_HASH_MISMATCH',
      severity: 'warning',
      message:
        'The body content hash differs from the value in the frontmatter — the file was edited after ' +
        'export, or an editor mutated whitespace. The artifact is still importable, but provenance is reduced.',
      path: 'content_hash',
    });
  }

  // Project presence.
  if (fm.project_id && !state.projects.some((p) => p.id === fm.project_id)) {
    warnings.push({
      code: 'PROJECT_NOT_FOUND',
      severity: 'warning',
      message:
        `Artifact references project_id "${fm.project_id}" which does not exist in the current AppState. ` +
        `You can map it at commit time or save as Raw Notes.`,
      path: 'project_id',
    });
  }

  // Round presence — only required for commit paths that target a round.
  if (fm.round_id && fm.source_kind !== 'raw_notes') {
    if (!state.rounds.some((r) => r.id === fm.round_id)) {
      warnings.push({
        code: 'ROUND_NOT_FOUND',
        severity: 'warning',
        message:
          `Artifact references round_id "${fm.round_id}" which does not exist in the current AppState. ` +
          `Save as Raw Notes, or pick a different round at commit time.`,
        path: 'round_id',
      });
    }
  }
}

/**
 * Async check: compare the artifact's canonical_state_hash with the
 * current project's canonical state hash. Called separately because it
 * requires SubtleCrypto. Returns a warning when they differ, or null.
 */
export async function checkCanonicalStateStaleness(
  fm: Partial<MarkdownArtifactFrontmatter>,
  state: AppState
): Promise<ImportValidationWarning | null> {
  if (!fm.canonical_state_hash || !fm.project_id) return null;
  const project = state.projects.find((p) => p.id === fm.project_id);
  if (!project) return null;
  const currentHash = await computeContentHash(normalizeForHash(project.canonicalState));
  if (!currentHash) return null; // hashing unavailable
  if (hashesEqual(fm.canonical_state_hash, currentHash)) return null;
  return {
    code: 'CANONICAL_STATE_HASH_MISMATCH',
    severity: 'warning',
    message:
      `The project's canonical state has changed since this artifact was exported. ` +
      `The artifact's snapshot hash does not match the current canonical state. ` +
      `Import anyway only if you've reviewed the discrepancy.`,
    path: 'canonical_state_hash',
  };
}

/**
 * Async check: for model_response artifacts, compare the artifact's
 * prompt_hash to the current matching prompt's text hash. Returns a
 * PROMPT_HASH_MISMATCH warning when they differ, or null.
 */
export async function checkPromptStaleness(
  fm: Partial<MarkdownArtifactFrontmatter>,
  state: AppState
): Promise<ImportValidationWarning | null> {
  if (fm.source_kind !== 'model_response') return null;
  if (!fm.prompt_hash || !fm.round_id || !fm.model_id) return null;
  const round = state.rounds.find((r) => r.id === fm.round_id);
  if (!round) return null;
  const prompt = round.generatedPrompts.find((p) => p.modelProfileId === fm.model_id);
  if (!prompt) return null;
  const currentHash = await computeContentHash(normalizeForHash(prompt.promptText));
  if (!currentHash) return null;
  if (hashesEqual(fm.prompt_hash, currentHash)) return null;
  return {
    code: 'PROMPT_HASH_MISMATCH',
    severity: 'warning',
    message:
      `The prompt that generated this response has changed since the response was exported. ` +
      `Importing will associate the response with the *current* prompt. Verify this is what you intend.`,
    path: 'prompt_hash',
  };
}

// ── Duplicate detection ─────────────────────────────────────────────────────

function detectDuplicateImport(
  fm: Partial<MarkdownArtifactFrontmatter>,
  state: AppState,
  warnings: ImportValidationWarning[]
): void {
  if (!fm.artifact_id) return;
  const dup = state.importHistory.find(
    (tx) => tx.sourceArtifactId === fm.artifact_id && !tx.rolledBackAt
  );
  if (dup) {
    warnings.push({
      code: 'CONTENT_HASH_MATCHES_EXISTING',
      severity: 'info',
      message:
        `This artifact_id (${fm.artifact_id}) has already been imported on ${dup.timestamp}. ` +
        `Re-importing will create a new transaction.`,
      path: 'artifact_id',
    });
  }
}

// ── Synthesis-structure analysis (v0.11.0 Checkpoint E) ─────────────────────

/**
 * All 12 mediator synthesis section headings that should be present in a
 * complete artifact. Required by the Checkpoint E brief. Stored in
 * canonical-presentation order — the order the buildMediatorSynthesisBody
 * exporter emits, and the order operators read top-to-bottom in the UI.
 *
 * Used by analyzeSynthesisStructure to detect missing headings without
 * hard-coding the list at multiple sites — if a 13th section is ever
 * added, this constant is the single update point.
 */
const REQUIRED_SYNTHESIS_KEYS: readonly SynthesisKey[] = [
  'executiveSummary',
  'agreements',
  'disagreements',
  'risks',
  'openQuestions',
  'modelSpecificObservations',
  'recommendedDecision',
  'decisionRationale',
  'proposedCanonicalStateUpdate',
  'proposedNextActions',
  'proposedNextRoundPrompt',
  'confidenceCaveats',
] as const;

/**
 * Run the structured-synthesis extractor against the normalized body of
 * a mediator_synthesis artifact and push warnings for:
 *
 *   - missing required headings   (single batched warning listing all)
 *   - duplicate headings          (one warning per duplicated key)
 *   - unmatched headings          (one warning per unknown heading line)
 *   - unclosed code fence         (separate from the global truncation
 *                                  check; this one is mediator-specific)
 *
 * All warnings are SEVERITY 'warning' or 'info'. Missing headings do NOT
 * block commit; the resulting synthesis simply carries empty strings for
 * the missing fields, matching the shape of `emptyMediatorSynthesis()`.
 *
 * NOTE: this function inspects the body AS PARSED. The whole raw body
 * is preserved on round.mediatorResponse by commitMediatorSynthesis, so
 * any text the extractor couldn't structurally map is still accessible
 * to the operator in the mediator workflow — these warnings are advisory.
 */
function analyzeSynthesisStructure(
  body: string,
  warnings: ImportValidationWarning[]
): void {
  const analysis = extractMediatorSections(body);

  // Missing headings — batch into a single warning to avoid 12 separate
  // notice lines for a file that just has a typo at the top.
  const missing = REQUIRED_SYNTHESIS_KEYS.filter(
    (k) => !analysis.presentKeys.includes(k)
  );
  if (missing.length > 0) {
    const missingLabels = missing.map((k) => SYNTHESIS_FIELD_LABELS[k]);
    warnings.push({
      code: 'REQUIRED_SECTION_MISSING',
      severity: 'warning',
      message:
        `Mediator synthesis is missing ${missing.length} required ` +
        `heading${missing.length === 1 ? '' : 's'}: ${missingLabels.join(', ')}. ` +
        `Structured import will leave the corresponding field${missing.length === 1 ? '' : 's'} empty. ` +
        `The full raw body is preserved on round.mediatorResponse for manual review.`,
      path: 'body',
    });
  }

  // Duplicate headings — concatenated by the extractor, but surface the
  // fact so the operator knows.
  for (const dupKey of analysis.duplicateKeys) {
    warnings.push({
      code: 'DUPLICATE_HEADING',
      severity: 'warning',
      message:
        `Heading "${SYNTHESIS_FIELD_LABELS[dupKey]}" appeared more than once. ` +
        `Content from all occurrences was concatenated (separated by blank lines).`,
      path: 'body',
    });
  }

  // Unmatched headings — heading-shaped lines that the HEADING_MAP didn't
  // recognize. Cap the number we surface; an artifact with 50 unknown
  // sub-headings would otherwise flood the warning list. The full body
  // is still preserved on round.mediatorResponse regardless.
  const MAX_UNMATCHED_SURFACED = 6;
  const surface = analysis.unmatchedHeadings.slice(0, MAX_UNMATCHED_SURFACED);
  for (const heading of surface) {
    warnings.push({
      code: 'UNMATCHED_HEADING',
      severity: 'info',
      message:
        `Heading "${heading}" is not a recognized mediator synthesis section ` +
        `and will not populate any structured field. The body following this ` +
        `heading is preserved on round.mediatorResponse.`,
      path: 'body',
    });
  }
  if (analysis.unmatchedHeadings.length > MAX_UNMATCHED_SURFACED) {
    const remaining = analysis.unmatchedHeadings.length - MAX_UNMATCHED_SURFACED;
    warnings.push({
      code: 'UNMATCHED_HEADING',
      severity: 'info',
      message:
        `…plus ${remaining} more unrecognized heading${remaining === 1 ? '' : 's'} ` +
        `(see round.mediatorResponse after import).`,
      path: 'body',
    });
  }

  // Unclosed code fence — synthesis-specific surface for the
  // structured-section walker. The generic truncation check (called
  // separately) will also flag this; the mediator-targeted message is
  // more actionable for synthesis artifacts.
  if (analysis.unclosedFence) {
    warnings.push({
      code: 'UNCLOSED_CODE_FENCE',
      severity: 'warning',
      message:
        `The synthesis body contains an unclosed code fence. Section detection ` +
        `may have terminated early; verify the imported fields against the raw body.`,
      path: 'body',
    });
  }
}

// ── Model-response target analysis (v0.11.0 Checkpoint G) ───────────────────

/**
 * Inspect the LIVE state to determine whether a model_response artifact
 * can land safely. Emits warnings for:
 *
 *   - LOCKED_ROUND               (target round exists but is locked)
 *   - MODEL_ID_NOT_IN_ROSTER     (no response slot exists for fm.model_id)
 *   - MODEL_ID_MISMATCH_WITH_SLOT (per-slot caller passed expectedModelId
 *                                  that differs from frontmatter)
 *   - EXISTING_RESPONSE_WILL_BE_OVERWRITTEN
 *                                (target slot already holds a body)
 *
 * The first three are emitted at severity 'warning' BUT the modal's
 * deferred-reason gate (in useMarkdownUpload) treats them as hard
 * blocks on structured commit — the user can still save as Raw Notes
 * so no data is lost. (Severity 'warning' rather than 'error' so the
 * preview's `commitAvailable` boolean stays true; the hook's
 * source-kind-specific deferred-reason then takes precedence in
 * disabling the button.)
 *
 * EXISTING_RESPONSE_WILL_BE_OVERWRITTEN is also 'warning' but it does
 * NOT trip the deferred-reason gate — the user CAN proceed, going
 * through the modal's existing two-step "Import anyway" deliberate
 * confirmation flow. Rollback restores both body and status.
 *
 * NOTE: project resolution is already handled by resolveTargetSummary;
 * round resolution is also handled there (emits ROUND_NOT_FOUND if
 * missing). We DON'T re-check those here — we only add slot/status
 * checks layered on top of the resolved round.
 */
function analyzeModelResponseTarget(
  fm: Partial<MarkdownArtifactFrontmatter>,
  state: AppState,
  warnings: ImportValidationWarning[],
  context: ImportPreviewContext | undefined
): void {
  // Per-slot mismatch is the most explicit signal — surface first so it
  // appears at the top of the warning list.
  if (context?.expectedModelId && fm.model_id && context.expectedModelId !== fm.model_id) {
    warnings.push({
      code: 'MODEL_ID_MISMATCH_WITH_SLOT',
      severity: 'warning',
      message:
        `This upload affordance is bound to model_id "${context.expectedModelId}" ` +
        `but the file declares model_id "${fm.model_id}". Structured import would ` +
        `route to the wrong slot — it has been disabled. You can still Import as ` +
        `Raw Notes to preserve the body verbatim.`,
      path: 'model_id',
    });
  }

  // The rest of the checks require the round to be resolved. If
  // round_id was missing or didn't resolve, resolveTargetSummary
  // already emitted ROUND_NOT_FOUND.
  if (!fm.round_id) return;
  const round = state.rounds.find((r) => r.id === fm.round_id);
  if (!round) return;

  // Locked-round protection — block structured commit.
  if (round.locked) {
    warnings.push({
      code: 'LOCKED_ROUND',
      severity: 'warning',
      message:
        `Round ${round.roundNumber} is locked. Structured import is blocked to ` +
        `prevent mutation of completed work. Start a new round to add responses, ` +
        `or save this file as a Raw Note for later review.`,
      path: 'round_id',
    });
    return; // No point analyzing the slot — commit is blocked anyway.
  }

  if (!fm.model_id) {
    // No model_id declared — without it we cannot resolve a slot.
    // resolveTargetSummary already noted the missing field; we just
    // skip slot-level analysis.
    return;
  }

  // Find the slot. A "slot" here means: an existing modelResponse on
  // the round whose modelProfileId matches. We don't require the
  // model to be in selectedModelIds — the artifact may carry a
  // response from a model the user added then removed, and importing
  // still has value (the response upserts to the modelResponses
  // collection regardless of selection).
  const existingSlot = round.modelResponses.find((r) => r.modelProfileId === fm.model_id);
  const isInRoster = state.modelProfiles.some((m) => m.id === fm.model_id);
  const isSelectedThisRound = round.selectedModelIds.includes(fm.model_id);

  if (!existingSlot && !isSelectedThisRound) {
    // No existing slot AND not selected for the round — we'd be
    // appending a slot for a model not currently participating. Block
    // structured commit; offer Raw Notes.
    warnings.push({
      code: 'MODEL_ID_NOT_IN_ROSTER',
      severity: 'warning',
      message:
        `model_id "${fm.model_id}" has no existing response slot on Round ${round.roundNumber} ` +
        `and is not in the selected model list for this round. Structured import ` +
        `is disabled to avoid creating an orphaned slot. Add the model to the round ` +
        `(via Round Builder) and re-import, or Import as Raw Notes.` +
        (isInRoster ? '' : ' (Note: the model_id is also not in your overall model roster.)'),
      path: 'model_id',
    });
    return;
  }

  // Overwrite warning — surfaced when the target slot already has a
  // non-empty body. The two-step "Import anyway" gate in the modal
  // requires deliberate confirmation. Rollback restores the previous
  // body and status via snapshotBefore.round on the ImportTransaction.
  if (existingSlot && existingSlot.responseText.trim().length > 0) {
    warnings.push({
      code: 'EXISTING_RESPONSE_WILL_BE_OVERWRITTEN',
      severity: 'warning',
      message:
        `Round ${round.roundNumber} already has a response from "${existingSlot.modelDisplayName || fm.model_id}" ` +
        `(${existingSlot.responseText.length.toLocaleString()} chars, status: ${existingSlot.status}). ` +
        `Importing will REPLACE the response body. The existing status ` +
        `(${existingSlot.status}) is preserved. Rollback restores both ` +
        `body and status if needed.`,
      path: 'model_id',
    });
  }
}

// ── Generated-prompt target analysis (v0.11.0 Checkpoint H) ─────────────────

/**
 * Inspect the LIVE state to determine whether a generated_prompt
 * artifact can land safely. Emits warnings for:
 *
 *   - LOCKED_ROUND                      (target round is locked)
 *   - MODEL_ID_NOT_IN_ROSTER            (no existing prompt slot AND
 *                                        model not selected for round)
 *   - EXISTING_PROMPT_WILL_BE_OVERWRITTEN
 *                                       (target slot already has a
 *                                        non-empty promptText)
 *
 * Same overall shape as analyzeModelResponseTarget. Generated prompts
 * do NOT have a per-slot Upload .md affordance in Checkpoint H — the
 * hook's `expectedModelId` plumbing exists but no UI binds it for
 * prompts — so MODEL_ID_MISMATCH_WITH_SLOT cannot fire for this
 * source kind through any current UI path.
 */
function analyzeGeneratedPromptTarget(
  fm: Partial<MarkdownArtifactFrontmatter>,
  state: AppState,
  warnings: ImportValidationWarning[]
): void {
  if (!fm.round_id) return;
  const round = state.rounds.find((r) => r.id === fm.round_id);
  if (!round) return;

  if (round.locked) {
    warnings.push({
      code: 'LOCKED_ROUND',
      severity: 'warning',
      message:
        `Round ${round.roundNumber} is locked. Structured import is blocked to ` +
        `prevent mutation of completed work. Start a new round to add prompts, ` +
        `or save this file as a Raw Note for later review.`,
      path: 'round_id',
    });
    return;
  }

  if (!fm.model_id) return;

  // Find the slot. As with model_response, allow orphan-but-selected:
  // either an existing prompt slot for this model_id, OR the model is
  // in the round's selectedModelIds (append-new-slot path).
  const existingSlot = round.generatedPrompts.find((p) => p.modelProfileId === fm.model_id);
  const isInRoster = state.modelProfiles.some((m) => m.id === fm.model_id);
  const isSelectedThisRound = round.selectedModelIds.includes(fm.model_id);

  if (!existingSlot && !isSelectedThisRound) {
    warnings.push({
      code: 'MODEL_ID_NOT_IN_ROSTER',
      severity: 'warning',
      message:
        `model_id "${fm.model_id}" has no existing prompt slot on Round ${round.roundNumber} ` +
        `and is not in the selected model list for this round. Structured import ` +
        `is disabled to avoid creating an orphaned slot. Add the model to the round ` +
        `(via Round Builder) and re-import, or Import as Raw Notes.` +
        (isInRoster ? '' : ' (Note: the model_id is also not in your overall model roster.)'),
      path: 'model_id',
    });
    return;
  }

  if (existingSlot && existingSlot.promptText.trim().length > 0) {
    warnings.push({
      code: 'EXISTING_PROMPT_WILL_BE_OVERWRITTEN',
      severity: 'warning',
      message:
        `Round ${round.roundNumber} already has a generated prompt for ` +
        `"${existingSlot.modelDisplayName || fm.model_id}" ` +
        `(${existingSlot.promptText.length.toLocaleString()} chars, status: ${existingSlot.status}). ` +
        `Importing will REPLACE the prompt text. The existing status ` +
        `(${existingSlot.status}) is preserved. Rollback restores both ` +
        `text and status if needed.`,
      path: 'model_id',
    });
  }
}

// ── Mediator-packet target analysis (v0.11.0 Checkpoint H) ──────────────────

/**
 * Inspect the LIVE state to determine whether a mediator_packet
 * artifact can land safely. Emits warnings for:
 *
 *   - LOCKED_ROUND                        (target round is locked)
 *   - EXISTING_PACKET_WILL_BE_OVERWRITTEN (round.mediatorPrompt is
 *                                          non-empty)
 *
 * No model-level concerns — mediator packets are round-scoped. The
 * commit overwrites round.mediatorPrompt and PRESERVES round.mediator-
 * Synthesis and round.modelResponses by virtue of only touching the
 * single field.
 */
function analyzeMediatorPacketTarget(
  fm: Partial<MarkdownArtifactFrontmatter>,
  state: AppState,
  warnings: ImportValidationWarning[]
): void {
  if (!fm.round_id) return;
  const round = state.rounds.find((r) => r.id === fm.round_id);
  if (!round) return;

  if (round.locked) {
    warnings.push({
      code: 'LOCKED_ROUND',
      severity: 'warning',
      message:
        `Round ${round.roundNumber} is locked. Structured import is blocked to ` +
        `prevent mutation of completed work. Start a new round, or save this ` +
        `file as a Raw Note for later review.`,
      path: 'round_id',
    });
    return;
  }

  if (round.mediatorPrompt && round.mediatorPrompt.trim().length > 0) {
    warnings.push({
      code: 'EXISTING_PACKET_WILL_BE_OVERWRITTEN',
      severity: 'warning',
      message:
        `Round ${round.roundNumber} already has a mediator packet ` +
        `(${round.mediatorPrompt.length.toLocaleString()} chars). ` +
        `Importing will REPLACE the packet text. Existing mediator synthesis ` +
        `and model responses are preserved. Rollback restores the previous ` +
        `packet text if needed.`,
      path: 'round_id',
    });
  }
}

// ── Truncation / unclosed fence ─────────────────────────────────────────────

function detectTruncationAndUnclosedFence(
  body: string,
  warnings: ImportValidationWarning[]
): void {
  const walk = walkFenceAware(body, () => {});
  if (walk.unclosedFence) {
    warnings.push({
      code: 'UNCLOSED_CODE_FENCE',
      severity: 'warning',
      message:
        'A fenced code block was opened in the body but never closed. The file may be truncated. ' +
        'You can still import it, but downstream structured extraction may behave oddly.',
    });
  }
  // End-of-body terminator heuristic: last non-blank line should end with
  // one of TRUNCATION_TERMINATORS. Otherwise, suspect truncation.
  const lines = body.split('\n');
  let lastNonBlank = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (l.length > 0) {
      lastNonBlank = l;
      break;
    }
  }
  if (lastNonBlank.length > 0) {
    // v0.11.0 Checkpoint H — recognize a CLOSING code fence as a clean
    // end-of-body marker. A line composed entirely of fence characters
    // (~~~+ or ```+) indicates the file's final structural element is a
    // properly-closed fenced block — strong evidence the file was NOT
    // truncated. Without this carve-out, every RoundTable-generated
    // generated_prompt and model_response artifact (whose body ends with
    // a tilde fence wrapping the prompt/response text) emitted a
    // POTENTIALLY_TRUNCATED false positive on every clean round-trip.
    //
    // The genuine truncation case — an OPEN fence with no close — is
    // already covered by the walkFenceAware-driven UNCLOSED_CODE_FENCE
    // check above. So this carve-out cannot mask real truncation.
    if (/^(~{3,}|`{3,})\s*$/.test(lastNonBlank)) {
      return;
    }
    const lastChar = lastNonBlank[lastNonBlank.length - 1];
    if (!TRUNCATION_TERMINATORS.includes(lastChar)) {
      warnings.push({
        code: 'POTENTIALLY_TRUNCATED',
        severity: 'info',
        message:
          'The body does not end with a sentence terminator. This is often (but not always) a sign of truncation.',
      });
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isSchemaNewerThanApp(version: string): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!m) return false;
  const a = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = SCHEMA_VERSION.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!t) return false;
  const b = [Number(t[1]), Number(t[2]), Number(t[3])];
  if (a[0] !== b[0]) return a[0] > b[0];
  if (a[1] !== b[1]) return a[1] > b[1];
  return a[2] > b[2];
}

function pushError(
  warnings: ImportValidationWarning[],
  code: ImportWarningCode,
  message: string,
  path?: string
): void {
  warnings.push({ code, severity: 'error' as ImportWarningSeverity, message, path });
}

function hashingUnavailableWarning(): ImportValidationWarning {
  return {
    code: 'HASHING_UNAVAILABLE',
    severity: 'info',
    message:
      'SubtleCrypto is unavailable in this context (likely file:// origin). Content hashes cannot be ' +
      'recomputed locally; stale-state and edit-detection checks are skipped. Serve RoundTable from ' +
      'http://localhost or HTTPS to enable hashing.',
  };
}

// ── Raw Note conversion (universal fallback) ────────────────────────────────

/**
 * Convert an import preview into a RawNote. Always succeeds; the worst
 * case is a Raw Note with `parsedFrontmatter` undefined and the original
 * body intact. This is the *universal* fallback — any code path that
 * would otherwise drop import data on the floor MUST funnel through here.
 */
export function rawNoteFromPreview(preview: ImportPreview): RawNote {
  const fm = preview.frontmatter;
  let status: RawNoteImportStatus = 'unparseable';
  if (!preview.hadFrontmatter) status = 'malformed';
  else if (!fm) status = 'malformed';
  else if (preview.warnings.some((w) => w.code === 'UNCLOSED_CODE_FENCE' || w.code === 'POTENTIALLY_TRUNCATED')) {
    status = 'partial';
  } else if (preview.warnings.some((w) => w.code === 'PROJECT_NOT_FOUND' || w.code === 'ROUND_NOT_FOUND')) {
    status = 'unmatched';
  } else if (preview.warnings.some((w) => w.code === 'CONTENT_HASH_MATCHES_EXISTING')) {
    status = 'duplicate';
  }

  return {
    id: generateSafeId('rawnote'),
    createdAt: nowIso(),
    sourceKind: fm?.source_kind,
    projectId: fm?.project_id ?? undefined,
    roundId: fm?.round_id ?? undefined,
    originModel: fm?.model_id ?? undefined,
    artifactType: fm?.artifact_type ?? undefined,
    importStatus: status,
    validationWarnings: preview.warnings,
    rawBody: preview.body, // verbatim, NOT normalized
    parsedFrontmatter: fm,
  };
}

// ── Round-trip helper (acceptance-test aid) ─────────────────────────────────

/**
 * Build a Markdown artifact and immediately run it through buildImportPreview
 * against the same AppState. Used by acceptance tests to confirm the
 * round-trip-integrity contract (zero warnings, zero divergence).
 */
export async function roundTripPreview(
  input: BuildArtifactInput,
  state: AppState
): Promise<{ built: BuiltArtifact; preview: ImportPreview }> {
  const built = await buildArtifact(input);
  const preview = await buildImportPreview(built.fullText, state);
  return { built, preview };
}
