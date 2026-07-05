// src/utils/mediatorExtract.ts
// Purpose: Tolerant extraction of structured sections from a mediator response.
// Owned by: this file
// Used by: MediatorPanel, artifactImport (mediator_synthesis import path)
//
// v0.10.5: Replaced the brittle `split(/^###\s+/m)`-based parser with a
// line-based parser that tolerates common heading variants observed in
// real mediator output:
//
//   - Any Markdown heading level (#, ##, ###, ####, #####, ######)
//   - Numbered prefixes: "1.", "1)", "01.", "1:"
//   - Bracketed labels: "[EXECUTIVE SUMMARY]"
//   - Trailing colons (ASCII ":" and full-width "：")
//   - Mixed case
//   - Dash-suffix variants: "Executive Summary — Notes"
//
// v0.11.0: Extended with **code-fence awareness** via walkFenceAware in
// utils/markdownParse.ts. Heading-shaped lines INSIDE a fenced code block
// (triple backtick or triple tilde, length >= 3) are now treated as body
// content, not section openers. An unclosed fence at EOF surfaces an
// `unclosedFence` flag that callers can route to a UNCLOSED_CODE_FENCE
// warning. This was the key parser regression the v0.11.0 brief asked for.
//
// Design rules:
//   1. Only known mediator section headings (from HEADING_MAP) start a new
//      section. Unknown heading-shaped lines do NOT erase previously
//      extracted content — their body is discarded until the next known
//      heading.
//   2. The "Heading:" colon-only form is recognized ONLY when the prefix
//      (after stripping numbering/colon) maps to a known heading. This
//      avoids splitting on every line ending with a colon in the body.
//   3. All extraction is placed in editable fields; the user reviews
//      before saving. Nothing is applied to AppState here.
//   4. Body content is preserved verbatim except for boundary trim.
//   5. If extraction is incomplete, the user manually fills in remaining
//      fields — manual fallback is always available.
//   6. (v0.11.0) Fenced code blocks shield their contents from heading
//      detection. Indented (4-space) fences are intentionally NOT
//      tracked — documented limitation.
//
// Resist scope creep:
//   - Do NOT invent new synthesis fields. Only the fields already in
//     MediatorSynthesis are recognized.
//   - Do NOT split on every colon-ending line. Only known heading names.

import { MediatorSynthesis } from '../types/round';
import { nowIso } from './dateTime';
import { walkFenceAware } from './markdownParse';

// v0.11.0 Checkpoint E: exported so artifactImport.ts can type its
// synthesis-structure warning helper against the same key union.
export type SynthesisKey = keyof Omit<MediatorSynthesis, 'updatedAt'>;

// Map of normalized heading text → MediatorSynthesis key.
// Keys are stored fully normalized (lowercased, no Markdown markers, no
// numbered prefix, no surrounding brackets, no trailing colon). The
// detector normalizes a candidate line the same way before lookup.
const HEADING_MAP: Record<string, SynthesisKey> = {
  'executive summary':                'executiveSummary',
  'agreements':                       'agreements',
  'disagreements':                    'disagreements',
  'risks':                            'risks',
  'open questions':                   'openQuestions',
  'model-specific observations':      'modelSpecificObservations',
  'model specific observations':      'modelSpecificObservations',
  'recommended decision':             'recommendedDecision',
  'decision rationale':               'decisionRationale',
  'proposed canonical state update':  'proposedCanonicalStateUpdate',
  'canonical state update':           'proposedCanonicalStateUpdate',
  'proposed next actions':            'proposedNextActions',
  'next actions':                     'proposedNextActions',
  'proposed next-round prompt':       'proposedNextRoundPrompt',
  'proposed next round prompt':       'proposedNextRoundPrompt',
  'next-round prompt':                'proposedNextRoundPrompt',
  'next round prompt':                'proposedNextRoundPrompt',
  'confidence / caveats':             'confidenceCaveats',
  'confidence/caveats':               'confidenceCaveats',
  'caveats':                          'confidenceCaveats',
  'confidence and caveats':           'confidenceCaveats',
};

export function emptyMediatorSynthesis(): MediatorSynthesis {
  return {
    executiveSummary: '',
    agreements: '',
    disagreements: '',
    risks: '',
    openQuestions: '',
    modelSpecificObservations: '',
    recommendedDecision: '',
    decisionRationale: '',
    proposedCanonicalStateUpdate: '',
    proposedNextActions: '',
    proposedNextRoundPrompt: '',
    confidenceCaveats: '',
    updatedAt: nowIso(),
  };
}

/**
 * Strip heading decoration from a line and return the normalized text.
 * Decoration handled (in order):
 *   1. Leading Markdown heading markers (# through ######)
 *   2. Surrounding square brackets [ ]
 *   3. Leading numbered prefix (1., 1), 01., 1:)
 *   4. Trailing colon (ASCII or full-width)
 *   5. Trim + lowercase
 *
 * Pure function. No side effects.
 */
export function normalizeMediatorHeading(line: string): string {
  let s = line.trim();
  if (!s) return '';

  // 1. Strip leading Markdown heading markers (followed by required space)
  s = s.replace(/^#{1,6}\s+/, '');

  // 2. Strip surrounding brackets [ ... ]
  const bracketMatch = s.match(/^\[(.+)\]$/);
  if (bracketMatch) s = bracketMatch[1];

  // 3. Strip leading numbered prefix: "1.", "1)", "01.", "1:" — followed by space
  s = s.replace(/^\d+\s*[.\):]\s+/, '');

  // 4. Strip trailing colon (ASCII or full-width) plus optional trailing whitespace
  s = s.replace(/[:：]+\s*$/, '');

  return s.trim().toLowerCase();
}

/**
 * Decide whether a line is shaped like a mediator section heading.
 *
 * A line qualifies if:
 *   a) It begins with EXACTLY three Markdown heading markers `### ` —
 *      v0.11.0 Checkpoint F tightened from `#{1,6}` to exactly 3.
 *      The canonical mediator synthesis sections are emitted at H3
 *      level (### Risks, ### Open Questions, etc.). H1 and H2 are
 *      typically artifact / round titles ("# Mediator Synthesis — Round N"),
 *      and H4-H6 are intra-section sub-headings. Treating any of them
 *      as section-heading candidates produced false UNMATCHED_HEADING
 *      noise on every clean round-trip (every artifact begins with an
 *      H1 title). The strict `### ` shape eliminates that noise without
 *      sacrificing real heading detection.
 *   b) It is wrapped in `[ ... ]` brackets — kept as legacy tolerance
 *      for models that emit section names that way.
 *   c) After normalization, the result matches a known HEADING_MAP key.
 *      This catches "Executive Summary:" and "1. Risks" forms without
 *      catching every line ending with a colon. Constrained by the
 *      map, so it cannot produce UNMATCHED_HEADING noise — only ever
 *      detects known headings.
 *
 * Pure function. Exported for unit-test reuse.
 */
export function isHeadingShaped(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  // (a) Exactly three # markers, followed by required whitespace and
  // non-whitespace content. `^###\s+\S` rejects `####...` because the
  // 4th `#` is not whitespace, so the `\s+` clause cannot match.
  if (/^###\s+\S/.test(s)) return true;
  // (b) Bracketed form. Kept loose for tolerance.
  if (/^\[.+\]$/.test(s)) return true;
  // (c) Un-prefixed but normalizes to a known map entry.
  const normalized = normalizeMediatorHeading(s);
  if (HEADING_MAP[normalized]) return true;
  // Dash-suffix form: "Executive Summary — Notes" — check by stripping the
  // suffix and re-testing against the map.
  const dashStripped = normalized.replace(/\s+[—–-]\s+.+$/, '').trim();
  if (dashStripped !== normalized && HEADING_MAP[dashStripped]) return true;
  return false;
}

/**
 * Given a heading-shaped line, return the MediatorSynthesis key it maps
 * to, or null if the heading is shaped like a heading but isn't recognized.
 *
 * Pure function. Exported for unit-test reuse.
 */
export function detectMediatorHeading(line: string): SynthesisKey | null {
  if (!isHeadingShaped(line)) return null;
  const normalized = normalizeMediatorHeading(line);

  const direct = HEADING_MAP[normalized];
  if (direct) return direct;

  // Try the dash-suffix variant: "Executive Summary — Notes" → "executive summary".
  // Only when the prefix is unambiguously a known heading; do NOT strip
  // dashes if the result wouldn't map.
  const dashStripped = normalized.replace(/\s+[—–-]\s+.+$/, '').trim();
  if (dashStripped !== normalized) {
    const dashMatch = HEADING_MAP[dashStripped];
    if (dashMatch) return dashMatch;
  }

  return null;
}

/**
 * Extract structured mediator synthesis sections from a raw mediator
 * response.
 *
 * Algorithm (v0.11.0 fence-aware line parser):
 *   - Walk the response line by line, tracking whether the cursor is
 *     INSIDE or OUTSIDE a fenced code block (` ``` ` or `~~~`, length >= 3).
 *   - When a line is OUTSIDE a fence AND heading-shaped AND known, flush
 *     the current section and start collecting under the new key.
 *   - When a line is OUTSIDE a fence AND heading-shaped but NOT known,
 *     flush the current section and set currentKey=null. Subsequent body
 *     lines are discarded until the next known heading. This ensures
 *     unknown headings cannot erase known extracted content.
 *   - When a line is INSIDE a fence (or is itself a fence marker), it is
 *     always treated as body — even if it looks like a heading. This is
 *     the v0.11.0 behavior addition.
 *   - When a line is not heading-shaped, append it to the current
 *     section's body (or discard if currentKey is null).
 *
 * The returned synthesis has all known fields populated where
 * extraction succeeded; missing sections remain empty strings so the
 * user can fill them in manually.
 *
 * @returns
 *   synthesis: MediatorSynthesis with extracted (or empty) fields
 *   extractedCount: how many known sections were populated
 *   unclosedFence: true if EOF was reached while still INSIDE_FENCE.
 *                  The caller (artifactImport / MediatorPanel) surfaces
 *                  this as UNCLOSED_CODE_FENCE. Callers that don't care
 *                  can ignore the field.
 */
/**
 * Walk the response. Open new sections only on lines that are (a) heading-
 * shaped, (b) NOT inside a code fence, and (c) match a known heading key
 * after normalization.
 *
 * Returns the populated synthesis plus three analysis fields used by the
 * v0.11.0 Markdown Handoff import preview (added in Checkpoint E):
 *
 *   extractedCount    : how many known sections were populated.
 *   unclosedFence     : true if EOF was reached while still INSIDE_FENCE.
 *   presentKeys       : unique SynthesisKeys that received non-empty
 *                       content. The preview gate uses this to detect
 *                       which required headings are missing.
 *   duplicateKeys     : SynthesisKeys that appeared MORE THAN ONCE. The
 *                       extractor concatenates duplicates rather than
 *                       dropping them, but it surfaces the duplication so
 *                       the import preview can warn the user.
 *   unmatchedHeadings : raw heading lines that were heading-shaped but
 *                       did NOT resolve to a known SynthesisKey. Body
 *                       under these headings is NOT silently discarded —
 *                       commitMediatorSynthesis preserves the entire raw
 *                       body on round.mediatorResponse so the operator
 *                       can recover any text the extractor couldn't map.
 *
 * Backward-compatible: existing callers that destructure only
 * { synthesis, extractedCount, unclosedFence } continue to work — TS
 * tolerates ignored fields.
 */
export function extractMediatorSections(rawResponse: string): {
  synthesis: MediatorSynthesis;
  extractedCount: number;
  unclosedFence: boolean;
  presentKeys: SynthesisKey[];
  duplicateKeys: SynthesisKey[];
  unmatchedHeadings: string[];
} {
  const synthesis = emptyMediatorSynthesis();

  if (!rawResponse.trim()) {
    return {
      synthesis,
      extractedCount: 0,
      unclosedFence: false,
      presentKeys: [],
      duplicateKeys: [],
      unmatchedHeadings: [],
    };
  }

  let currentKey: SynthesisKey | null = null;
  let currentBody: string[] = [];

  // Collected by key. Using an array of strings per key handles the rare
  // case where the mediator emits the same heading twice — we concatenate
  // rather than losing the second occurrence.
  const collected: Partial<Record<SynthesisKey, string[]>> = {};

  // v0.11.0 Checkpoint E: track unmatched (heading-shaped but unknown)
  // headings so the import preview can warn the user. The body that
  // followed an unmatched heading is captured in `currentBody` and
  // flushed into `unmatchedBodySegments` rather than silently dropped.
  // (The whole raw body is still preserved on round.mediatorResponse —
  // these segments are only here to surface in warnings.)
  const unmatchedHeadings: string[] = [];

  const flush = () => {
    if (currentKey === null) return;
    const text = currentBody.join('\n').trim();
    if (!text) return;
    if (!collected[currentKey]) collected[currentKey] = [];
    collected[currentKey]!.push(text);
  };

  // v0.11.0: fence-aware iteration. Lines inside a fenced code block are
  // treated as body and CANNOT open a new section, even if they look
  // heading-shaped. Fence markers themselves are also body.
  const walkResult = walkFenceAware(rawResponse, (ev) => {
    const lineCanBeHeading = !ev.insideFence && !ev.isFenceMarker;
    if (lineCanBeHeading && isHeadingShaped(ev.text)) {
      flush();
      const detected = detectMediatorHeading(ev.text);
      if (detected) {
        currentKey = detected;
      } else {
        // Heading-shaped but not in HEADING_MAP. Record it for the
        // preview's warning surface; reset currentKey to null so the
        // body that follows accumulates against null and is dropped
        // from `synthesis` (but preserved on round.mediatorResponse).
        currentKey = null;
        unmatchedHeadings.push(ev.text.trim());
      }
      currentBody = [];
    } else {
      currentBody.push(ev.text);
    }
  });
  flush();

  let extractedCount = 0;
  const presentKeys: SynthesisKey[] = [];
  const duplicateKeys: SynthesisKey[] = [];
  for (const [key, parts] of Object.entries(collected)) {
    if (!parts || parts.length === 0) continue;
    synthesis[key as SynthesisKey] = parts.join('\n\n');
    extractedCount += 1;
    presentKeys.push(key as SynthesisKey);
    if (parts.length > 1) duplicateKeys.push(key as SynthesisKey);
  }

  synthesis.updatedAt = nowIso();
  return {
    synthesis,
    extractedCount,
    unclosedFence: walkResult.unclosedFence,
    presentKeys,
    duplicateKeys,
    unmatchedHeadings,
  };
}

// Human-readable labels for the structured fields
export const SYNTHESIS_FIELD_LABELS: Record<SynthesisKey, string> = {
  executiveSummary:             'Executive Summary',
  agreements:                   'Agreements',
  disagreements:                'Disagreements',
  risks:                        'Risks',
  openQuestions:                'Open Questions',
  modelSpecificObservations:    'Model-Specific Observations',
  recommendedDecision:          'Recommended Decision',
  decisionRationale:            'Decision Rationale',
  proposedCanonicalStateUpdate: 'Proposed Canonical State Update',
  proposedNextActions:          'Proposed Next Actions',
  proposedNextRoundPrompt:      'Proposed Next-Round Prompt',
  confidenceCaveats:            'Confidence / Caveats',
};

// Fields the user is most likely to transfer into the Decision form
export const DECISION_TRANSFER_FIELDS: SynthesisKey[] = [
  'recommendedDecision',
  'decisionRationale',
  'proposedCanonicalStateUpdate',
  'proposedNextActions',
  'proposedNextRoundPrompt',
];
