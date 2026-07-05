// src/utils/markdownArtifact.ts
// Purpose: Single source of truth for v0.11.0 Markdown Handoff Mode artifact
//          generation. EVERY UI surface (preview, copy-as-md, download.md)
//          consumes the same `fullText` string returned by buildArtifact().
//
// Owned by:  this file
// Used by:   RoundBuilderPanel, ResponsesPanel, MediatorPanel, DecisionLogPanel,
//            ExportImportPanel, ImportPreviewModal (preview rendering),
//            RawNotesPanel (raw note re-export), artifactImport (round-trip).
//
// THE SAME-SOURCE GUARANTEE:
//   - Every place that produces a Markdown handoff artifact calls
//     `buildArtifact(input)` and consumes `result.fullText`.
//   - No alternative path is permitted. Code review must reject any PR
//     that inlines artifact-building logic in a component.
//
// Why frontmatter is emitted by hand:
//   js-yaml.dump auto-casts dates, may quote-style-flip on different
//   inputs, and orders keys by insertion order which is fragile. The
//   schema is a flat, fixed set of fields; hand-emitting them in a fixed
//   order produces byte-identical output for byte-identical inputs.
//   js-yaml.load is used on the read side because incoming YAML may be
//   loosely formatted.
//
// Frontmatter field order is *fixed* and locked. Any change is a breaking
// format change — bump ARTIFACT_TYPE to v2.

import {
  BuildArtifactInput,
  BuildGeneratedPromptInput,
  BuildModelResponseInput,
  BuildMediatorPacketInput,
  BuildMediatorSynthesisInput,
  BuildRawNotesInput,
  BuiltArtifact,
  MarkdownArtifactFrontmatter,
  MarkdownArtifactSourceKind,
} from '../types/markdownArtifact';
import { Round, MediatorSynthesis } from '../types/round';
import { Project } from '../types/project';
import { ARTIFACT_TYPE, SCHEMA_VERSION, APP_VERSION } from '../config/exportFormats';
import { FILENAME_PREFIXES } from '../config/markdownHandoff';
import { normalizeForHash } from './markdownNormalize';
import { computeContentHash } from './markdownHash';
import { nowIso } from './dateTime';
import { generateSafeId } from './id';
import { fence } from './markdownExport';
import { generateMediatorPacket } from './mediatorPacket';
import { SYNTHESIS_FIELD_LABELS } from './mediatorExtract';

// ── Public entry points ──────────────────────────────────────────────────────

/**
 * Build a Markdown handoff artifact. Async because content_hash and
 * canonical_state_hash require SubtleCrypto.digest. Returns null hash
 * values gracefully when SubtleCrypto is unavailable (file:// origin).
 *
 * The returned `fullText` is THE string for download/copy/preview. UI
 * paths MUST consume this string and MUST NOT reconstruct artifact text
 * by other means.
 */
export async function buildArtifact(input: BuildArtifactInput): Promise<BuiltArtifact> {
  // 1) Body — kind-specific composition. All body strings go through
  //    normalizeForHash before the content_hash is computed. The
  //    normalized body is what we hash AND what we emit, so the file is
  //    byte-equivalent to what was hashed.
  let rawBody: string;
  let prompt_hash: string | null = null;
  let model_id: string | null = null;

  switch (input.kind) {
    case 'generated_prompt':
      rawBody = buildGeneratedPromptBody(input);
      model_id = findModelIdForPrompt(input);
      break;
    case 'model_response': {
      const built = buildModelResponseBody(input);
      rawBody = built.body;
      model_id = input.modelProfileId;
      // Hash the *generating prompt's text* if present on the round so the
      // import-time stale check has something to compare to.
      const prompt = input.round.generatedPrompts.find(
        (p) => p.modelProfileId === input.modelProfileId
      );
      if (prompt) {
        prompt_hash = await computeContentHash(normalizeForHash(prompt.promptText));
      }
      break;
    }
    case 'mediator_packet':
      rawBody = buildMediatorPacketBody(input);
      break;
    case 'mediator_synthesis':
      rawBody = buildMediatorSynthesisBody(input);
      break;
    case 'raw_notes':
      rawBody = buildRawNotesBody(input);
      break;
    default: {
      // Exhaustive-check helper.
      const _exhaust: never = input;
      throw new Error(`Unhandled artifact kind: ${(_exhaust as { kind: string }).kind}`);
    }
  }

  const body = normalizeForHash(rawBody);

  // 2) Hashes. canonical_state_hash may be pre-supplied (e.g. by
  //    roundUtils.generatePromptsForRound, which captured it at generation
  //    time and stamped it onto the prompt). If not supplied, we compute
  //    it here — but the pre-supplied hash is preferred because it ties
  //    the artifact to the state-at-generation rather than state-at-export,
  //    which matters for the stale-state check on the import side.
  const content_hash = await computeContentHash(body);
  const canonical_state_hash =
    input.ctx.canonicalStateHash !== undefined
      ? input.ctx.canonicalStateHash
      : await computeContentHash(normalizeForHash(input.ctx.project.canonicalState));

  // 3) Frontmatter. Field order is locked.
  const round = (input as { round?: Round }).round;
  const frontmatter: MarkdownArtifactFrontmatter = {
    artifact_type: ARTIFACT_TYPE,
    source_kind: input.kind,
    schema_version: SCHEMA_VERSION,
    app_version: APP_VERSION,
    artifact_id: input.ctx.artifactId ?? generateSafeId(`art-${shortKind(input.kind)}`),
    exported_at: input.ctx.exportedAt ?? nowIso(),
    project_id: input.ctx.project.id,
    project_name: input.ctx.project.name,
    round_id: round?.id ?? null,
    round_number: round?.roundNumber ?? null,
    model_id,
    canonical_state_hash,
    prompt_hash,
    content_hash,
    part: null, // reserved for v0.11.1 stitching
    generated_by: 'roundtable',
  };

  // 4) Serialize. Frontmatter delimiters frame the YAML; one blank line
  //    separates frontmatter from body; the body is exactly the
  //    normalized body string.
  const yamlText = serializeFrontmatterYaml(frontmatter);
  const fullText = `---\n${yamlText}---\n\n${body}`;

  return {
    frontmatter,
    body,
    fullText,
    artifactId: frontmatter.artifact_id,
  };
}

// ── Body composition per source_kind ─────────────────────────────────────────

function buildGeneratedPromptBody(input: BuildGeneratedPromptInput): string {
  const prompt = input.round.generatedPrompts.find((p) => p.id === input.promptId);
  if (!prompt) {
    return `# Generated Prompt — (Missing)\n\n_Prompt id "${input.promptId}" not found on Round ${input.round.roundNumber}._\n`;
  }
  return (
    `# Generated Prompt — ${prompt.modelDisplayName}\n\n` +
    `_Round ${input.round.roundNumber}, project "${input.ctx.project.name}"._\n\n` +
    `_Generated at: ${prompt.generatedAt}_\n\n` +
    `## Prompt Text\n\n` +
    `${fence(prompt.promptText)}\n`
  );
}

function findModelIdForPrompt(input: BuildArtifactInput): string | null {
  if (input.kind !== 'generated_prompt') return null;
  const p = input.round.generatedPrompts.find((gp) => gp.id === input.promptId);
  return p?.modelProfileId ?? null;
}

function buildModelResponseBody(input: BuildModelResponseInput): { body: string } {
  const r = input.round.modelResponses.find((mr) => mr.modelProfileId === input.modelProfileId);
  if (!r) {
    return {
      body:
        `# Model Response — (Missing)\n\n_No response for model "${input.modelProfileId}" on Round ${input.round.roundNumber}._\n`,
    };
  }
  return {
    body:
      `# Model Response — ${r.modelDisplayName}\n\n` +
      `_Round ${input.round.roundNumber}, project "${input.ctx.project.name}"._\n\n` +
      `_Status: ${r.status}_` +
      (r.pastedAt ? `  \n_Pasted at: ${r.pastedAt}_` : '') +
      `\n\n## Response Text\n\n` +
      `${fence(r.responseText)}\n`,
  };
}

function buildMediatorPacketBody(input: BuildMediatorPacketInput): string {
  // Mediator packets that were already generated and persisted have their
  // exact text on round.mediatorPrompt. We prefer the persisted text so
  // the artifact reflects exactly what was sent to GPT-5.5 — even if the
  // round's selected models or responses have changed since generation.
  // This is the "preserve what was sent" guarantee.
  if (input.round.mediatorPrompt && input.round.mediatorPrompt.trim().length > 0) {
    return (
      `# Mediator Packet — Round ${input.round.roundNumber}\n\n` +
      `_Project "${input.ctx.project.name}". Body below is the exact packet that was generated._\n\n` +
      `${input.round.mediatorPrompt}\n`
    );
  }
  // Fallback: synthesize fresh. Mark clearly so the reader knows this
  // wasn't the persisted packet.
  const selectedModels: never[] = [];
  const fresh = generateMediatorPacket({
    project: input.ctx.project,
    roundNumber: input.round.roundNumber,
    userInstruction: input.round.userInstruction,
    selectedModels: selectedModels,
    generatedPrompts: input.round.generatedPrompts,
    modelResponses: input.round.modelResponses,
    knownRisks: input.round.risks,
    openQuestions: input.round.openQuestions,
  });
  return (
    `# Mediator Packet — Round ${input.round.roundNumber} (Fresh)\n\n` +
    `_No persisted packet found on this round. Body below was reconstructed at export time._\n\n` +
    `${fresh}\n`
  );
}

function buildMediatorSynthesisBody(input: BuildMediatorSynthesisInput): string {
  const s = input.round.mediatorSynthesis;
  if (!s) {
    return (
      `# Mediator Synthesis — Round ${input.round.roundNumber}\n\n` +
      `_No mediator synthesis recorded for this round._\n`
    );
  }
  const sections = (Object.keys(SYNTHESIS_FIELD_LABELS) as (keyof Omit<MediatorSynthesis, 'updatedAt'>)[]).map((key) => {
    const val = s[key];
    if (!val || !val.trim()) return '';
    return `### ${SYNTHESIS_FIELD_LABELS[key]}\n\n${val.trim()}\n`;
  }).filter(Boolean).join('\n');
  return (
    `# Mediator Synthesis — Round ${input.round.roundNumber}\n\n` +
    `_Project "${input.ctx.project.name}". Headings below are recognized by the structured-synthesis parser._\n\n` +
    `${sections || '_All synthesis fields are empty._'}\n`
  );
}

function buildRawNotesBody(input: BuildRawNotesInput): string {
  return input.body;
}

// ── Filenames ────────────────────────────────────────────────────────────────

/** Produce a safe, descriptive filename for an artifact. The function is
 *  pure — no side effects, no clock reads beyond the timestamp embedded
 *  in the artifact_id. */
export function filenameFor(built: BuiltArtifact): string {
  const fm = built.frontmatter;
  const prefix = FILENAME_PREFIXES[fm.source_kind] ?? 'RT_ARTIFACT';
  const safeName = (fm.project_name || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const roundFragment = fm.round_number !== null ? `_Round-${fm.round_number}` : '';
  const modelFragment = fm.model_id ? `_${fm.model_id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)}` : '';
  const date = fm.exported_at.slice(0, 10).replace(/-/g, '');
  const shortId = fm.artifact_id.slice(-8);
  return `${prefix}_${safeName}${roundFragment}${modelFragment}_${date}_${shortId}.md`;
}

// ── Frontmatter serialization (hand-rolled; locked order) ────────────────────

/**
 * Emit YAML in the canonical, locked field order. Strings are emitted
 * with double-quoted escaping; YAML nulls are emitted as `null` (not `~`)
 * for unambiguous round-trips. Numbers are emitted as plain digits. The
 * `part` field is reserved and always emitted as `null` in v0.11.0.
 *
 * Output ends with a trailing newline so the caller can write
 * `---\n${yaml}---\n` cleanly.
 */
export function serializeFrontmatterYaml(fm: MarkdownArtifactFrontmatter): string {
  const lines: string[] = [];
  // Order is LOCKED.
  lines.push(`artifact_type: ${quoteYamlString(fm.artifact_type)}`);
  lines.push(`source_kind: ${quoteYamlString(fm.source_kind)}`);
  lines.push(`schema_version: ${quoteYamlString(fm.schema_version)}`);
  lines.push(`app_version: ${quoteYamlString(fm.app_version)}`);
  lines.push(`artifact_id: ${quoteYamlString(fm.artifact_id)}`);
  lines.push(`exported_at: ${quoteYamlString(fm.exported_at)}`);
  lines.push(`project_id: ${quoteYamlString(fm.project_id)}`);
  lines.push(`project_name: ${quoteYamlString(fm.project_name)}`);
  lines.push(`round_id: ${nullableString(fm.round_id)}`);
  lines.push(`round_number: ${nullableNumber(fm.round_number)}`);
  lines.push(`model_id: ${nullableString(fm.model_id)}`);
  lines.push(`canonical_state_hash: ${nullableString(fm.canonical_state_hash)}`);
  lines.push(`prompt_hash: ${nullableString(fm.prompt_hash)}`);
  lines.push(`content_hash: ${nullableString(fm.content_hash)}`);
  lines.push(`part: null`); // reserved
  lines.push(`generated_by: ${quoteYamlString(fm.generated_by)}`);
  return lines.join('\n') + '\n';
}

/** Quote any string with double quotes; escape backslash and double-quote
 *  for safe YAML JSON-schema decode. Control characters use \uXXXX form. */
function quoteYamlString(s: string): string {
  if (typeof s !== 'string') return '""';
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = s.charCodeAt(i);
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0');
    else out += ch;
  }
  out += '"';
  return out;
}

function nullableString(v: string | null | undefined): string {
  if (v === null || v === undefined) return 'null';
  return quoteYamlString(v);
}

function nullableNumber(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v !== 'number' || !isFinite(v)) return 'null';
  return String(v);
}

function shortKind(k: MarkdownArtifactSourceKind): string {
  switch (k) {
    case 'generated_prompt':   return 'prompt';
    case 'model_response':     return 'response';
    case 'mediator_packet':    return 'packet';
    case 'mediator_synthesis': return 'synthesis';
    case 'raw_notes':          return 'raw';
  }
}

// ── Re-exports ──────────────────────────────────────────────────────────────

export type { BuildArtifactInput, BuiltArtifact } from '../types/markdownArtifact';

// ── Convenience: build canonical-state hash for a project ───────────────────
//
// Helper used by callers that need the hash *before* dispatching state
// updates (e.g. roundUtils.generatePromptsForRound captures it onto the
// GeneratedPrompt itself). Returns null when SubtleCrypto is unavailable.

export async function hashProjectCanonicalState(project: Project): Promise<string | null> {
  return computeContentHash(normalizeForHash(project.canonicalState));
}

export async function hashPromptText(promptText: string): Promise<string | null> {
  return computeContentHash(normalizeForHash(promptText));
}
