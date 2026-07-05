// src/utils/markdownNormalize.ts
// Purpose: Pure text normalization for Markdown handoff artifact bodies and
//          any other string we want a stable, deterministic byte sequence for
//          (so that hashing is reproducible across editors, OSes, browsers).
// Owned by:  this file
// Used by:   markdownHash, markdownArtifact, artifactImport, mediatorExtract
//            (anywhere that a content_hash, canonical_state_hash, or
//             prompt_hash is computed or compared).
//
// v0.11.0 LOCKED SPEC (do not change without bumping ARTIFACT_TYPE to v2):
//
//   1. Decode input as UTF-8 (JavaScript strings are already UTF-16/codepoint
//      sequences — by the time we see them, decode has happened).
//   2. Strip a single leading BOM (U+FEFF) if present. Only the very first
//      codepoint is stripped — internal BOMs are intentional content.
//   3. Apply Unicode NFC normalization. NFC is the W3C-recommended form for
//      interchange and the form most editors produce by default. NFC keeps
//      precomposed characters precomposed.
//   4. Replace all "\r\n" and standalone "\r" with "\n". Order matters: do
//      CRLF first, then any remaining CRs (which were "\r" not followed by
//      "\n").
//   5. Ensure exactly one trailing "\n": strip any trailing run of "\n"
//      down to zero, then append exactly one.
//   6. **Do not** touch leading or trailing whitespace on individual lines.
//      Stripping per-line trailing whitespace would corrupt code blocks,
//      indented lists, and ASCII tables. Editor whitespace mutations are a
//      documented source of false hash mismatches; the import-preview
//      workflow surfaces them and the user decides whether to import anyway.
//
// This function is pure, synchronous, side-effect-free, and deterministic.
// Identical inputs MUST produce identical outputs in every browser RoundTable
// supports.

/**
 * Normalize a Markdown body or other string for stable hashing.
 *
 * @param text Any string. Empty string is valid and produces "\n".
 * @returns The normalized string. Always ends with exactly one "\n".
 */
export function normalizeForHash(text: string): string {
  if (typeof text !== 'string') {
    // Defensive: callers should always pass a string. Coerce to empty so
    // hash() can still produce a deterministic value for downstream code.
    text = '';
  }

  let s = text;

  // 2. Strip a single leading BOM. U+FEFF is the standard BOM codepoint.
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
  }

  // 3. Unicode NFC. String.prototype.normalize is in every supported browser.
  s = s.normalize('NFC');

  // 4. Line-ending normalization. CRLF first, then any remaining CR.
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 5. Exactly one trailing "\n".
  s = s.replace(/\n+$/, '') + '\n';

  return s;
}

/**
 * Convenience: byte length of the normalized string when encoded as UTF-8.
 * Used by storage-pressure estimates and the import-preview character count.
 * Does not include any frontmatter — pass the body you actually intend to
 * hash.
 */
export function normalizedByteLength(text: string): number {
  const normalized = normalizeForHash(text);
  // TextEncoder is available in every browser RoundTable supports. We fall
  // back to a rough estimate (chars * 2) only in environments where it's
  // missing — not expected in production.
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(normalized).length;
  }
  return normalized.length * 2;
}
