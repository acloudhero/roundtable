// src/utils/id.ts
// Purpose: Centralized ID generation for RoundTable.
//
// Why this file exists:
//   Throughout the codebase we need short unique IDs (rounds, prompts,
//   responses, decisions, recovered records). Older code used inline
//   `Math.random().toString(36)` fallbacks which are not collision-safe
//   and not centralized. This file is the single source of truth.
//
// Two exports:
//   - generateSafeId(prefix)  — preferred. Uses crypto.randomUUID() when
//     available, with a timestamp+random fallback for older or unusual
//     browser environments. Format: `${prefix}-${uuid_or_fallback}`.
//   - generateId(prefix)      — legacy alias retained so existing callers
//     in roundUtils.ts and DecisionLogPanel.tsx continue to work
//     unchanged. Internally delegates to generateSafeId.
//
// Common safe edits:
//   - Adding additional helpers built on top of generateSafeId.
//   - Adjusting the fallback format (be careful: don't introduce
//     characters that break URLs, filenames, or JSON keys).
//
// Common unsafe edits:
//   - Adding a new dependency for UUIDs. Not needed — Web Crypto is
//     available in every browser RoundTable supports, and we have a fallback.
//   - Calling this from a non-browser context. `crypto` is checked
//     defensively, so it's safe, but ID determinism is never assumed.

/**
 * Generate a unique, debug-friendly ID.
 *
 * Prefers `crypto.randomUUID()` (RFC 4122 v4) when available.
 * Falls back to `${Date.now()}-${random}` if Web Crypto is missing
 * (e.g. very old browsers, sandboxed iframes without crypto).
 *
 * The prefix is preserved literally so logs, the DOM, and exports
 * stay greppable: e.g. `round-...`, `prompt-...`, `recovered-prompt-...`.
 */
export function generateSafeId(prefix = 'id'): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${uuid}`;
}

/**
 * Legacy alias kept for backward compatibility with Phase 1–5 call sites.
 * New code should call generateSafeId directly.
 *
 * NOTE: The output format changed slightly in Phase 6 (now hyphen-uuid
 * instead of underscore-timestamp-random). Existing stored IDs are
 * unchanged — only newly minted IDs use the new format. ID values are
 * opaque to the rest of the app, so this is a behavior-preserving change.
 */
export function generateId(prefix = 'id'): string {
  return generateSafeId(prefix);
}
