// src/utils/markdownHash.ts
// Purpose: SHA-256 content hashing for Markdown handoff artifacts.
// Owned by:  this file
// Used by:   markdownArtifact (export), artifactImport (import compare),
//            roundUtils.generatePromptsForRound (provenance capture).
//
// LOCKED SPEC (v0.11.0; do not change without bumping ARTIFACT_TYPE):
//
//   - Algorithm: SHA-256 via window.crypto.subtle.digest('SHA-256', bytes).
//   - Input: the *normalized* body string (see markdownNormalize), encoded
//     as UTF-8 with TextEncoder.
//   - Output format in frontmatter: `sha256:<lowercase-hex>`. The
//     `sha256:` prefix is a namespace so future algorithm changes don't
//     break the schema — readers must reject unknown algorithm prefixes
//     rather than guessing.
//
// SubtleCrypto availability:
//   SubtleCrypto is present in every modern browser, BUT only in *secure
//   contexts* (HTTPS or http://localhost). The plain file:// origin does
//   not satisfy `window.isSecureContext`, so SubtleCrypto is unavailable
//   there. RoundTable is designed for localhost dev and HTTPS hosting.
//   We DO NOT silently substitute a weaker algorithm.
//
//   When SubtleCrypto is unavailable, `computeContentHash` resolves to
//   `null` and callers MUST treat that as "hashing disabled":
//     - Markdown handoff exports omit hash fields (frontmatter values
//       stay null, so the file remains importable as informational).
//     - Stale-state detection is suppressed.
//     - A banner is shown in the relevant panels recommending localhost
//       or HTTPS hosting.
//
//   The graceful-degradation path preserves the rest of the handoff
//   workflow (download/upload/preview) and never crashes the app.

/** Lower-case hex string prefixed with the algorithm namespace. */
export type ContentHash = string;

/** Is SubtleCrypto.digest available in the current execution context? */
export function isHashingAvailable(): boolean {
  try {
    return (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof crypto.subtle.digest === 'function' &&
      (typeof window === 'undefined' || window.isSecureContext === true)
    );
  } catch {
    return false;
  }
}

/**
 * Compute the SHA-256 hash of an already-normalized string.
 *
 * @param normalizedBody  The output of normalizeForHash(). Pass any string
 *                        that has been run through the normalization step;
 *                        otherwise the hash is meaningless because two
 *                        editor-mutated copies of the same content would
 *                        hash differently.
 * @returns Hex digest prefixed with `sha256:`, or `null` if hashing is
 *          unavailable in the current execution context. Callers MUST
 *          handle null — see file header.
 */
export async function computeContentHash(normalizedBody: string): Promise<ContentHash | null> {
  if (!isHashingAvailable()) return null;
  try {
    const bytes = new TextEncoder().encode(normalizedBody);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return `sha256:${bufferToHex(digest)}`;
  } catch (err) {
    // SubtleCrypto.digest can throw in exotic environments (sandboxed
    // iframes without crypto, etc.). Treat the same as "unavailable".
    console.warn('[RoundTable] SHA-256 digest failed:', err);
    return null;
  }
}

/** Parse a `sha256:<hex>` string into the bare hex digest, or return null
 *  if the prefix is missing/unknown or the hex is malformed. Used by
 *  import-time comparisons so we can reject unknown algorithms cleanly. */
export function parseContentHash(value: unknown): { algorithm: 'sha256'; hex: string } | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('sha256:')) return null;
  const hex = value.slice('sha256:'.length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) return null;
  return { algorithm: 'sha256', hex };
}

/** Compare two ContentHash values for byte-equality. Returns false if
 *  either side is null/unparseable — undefined hashes never "match". */
export function hashesEqual(a: ContentHash | null | undefined, b: ContentHash | null | undefined): boolean {
  if (!a || !b) return false;
  const pa = parseContentHash(a);
  const pb = parseContentHash(b);
  if (!pa || !pb) return false;
  return pa.algorithm === pb.algorithm && pa.hex === pb.hex;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function bufferToHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < view.length; i++) {
    const h = view[i].toString(16);
    out += h.length === 1 ? '0' + h : h;
  }
  return out;
}
