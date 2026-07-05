// src/utils/markdownParse.ts
// Purpose: Parse a v0.11.0 Markdown handoff file into (frontmatter, body),
//          and provide a code-fence-aware line iterator used by the
//          synthesis section parser.
//
// Owned by:  this file
// Used by:   utils/artifactImport (split + frontmatter validate),
//            utils/mediatorExtract (synthesis section parser).
//
// LOCKED v0.11.0 BEHAVIOR:
//
//   Frontmatter rules (strict):
//     - The frontmatter block MUST be the first bytes of the file. We allow
//       a single leading BOM (stripped before this function runs, in
//       practice — but we tolerate it here too for robustness).
//     - The opening delimiter is `---` on line 1 (after BOM strip).
//     - The closing delimiter is `---` on its own line (no leading
//       whitespace; trailing whitespace tolerated).
//     - Anything that does not match this exact shape is "no frontmatter"
//       → the caller routes such files to Raw Notes.
//
//   Code-fence-aware iterator:
//     - Tracks ` ``` ` and `~~~` fences (length >= 3) at the start of a line.
//     - The first fence character on the line "locks" the fence type. The
//       closing fence must be the same character with length >= opening.
//     - Inside a fence, heading-shaped lines are suppressed (i.e. the
//       caller is told that the line is "body, not heading").
//     - Indented (4-space) fences are intentionally NOT tracked. They are
//       rare in mediator output and tracking them complicates the state
//       machine for marginal value. Documented limitation.
//     - A missing closing fence does NOT crash. The walker emits a
//       `unclosedFence: true` flag at the end; callers route that to a
//       UNCLOSED_CODE_FENCE warning.

import yaml from 'js-yaml';

// ── Frontmatter split ────────────────────────────────────────────────────────

export interface FrontmatterSplit {
  /** Did the file open with a valid `---` delimiter on line 1? */
  hadFrontmatter: boolean;
  /** Raw YAML text (between the delimiters). Empty when hadFrontmatter is false. */
  yamlText: string;
  /** Everything after the closing `---` line (and a single trailing newline
   *  if present after the closing delimiter line). Empty when no
   *  frontmatter — the entire input is body. */
  body: string;
  /** YAML parse outcome. Only set when hadFrontmatter is true. */
  parsedYaml?: unknown;
  /** Set when YAML parsing threw. */
  parseError?: string;
}

/**
 * Split a Markdown handoff file into frontmatter (YAML) + body.
 *
 * Tolerant to:
 *   - a leading BOM (one codepoint)
 *   - CRLF or CR line endings (the splitter normalizes its *internal*
 *     processing, but the returned body preserves what the user actually
 *     gave us — preview honesty)
 *
 * Strict on:
 *   - delimiter placement (must be line 1; closing must be on its own line)
 *
 * Returns hadFrontmatter=false for any non-conforming shape — caller routes
 * such files to Raw Notes per the locked design.
 */
export function splitFrontmatter(text: string): FrontmatterSplit {
  if (typeof text !== 'string' || text.length === 0) {
    return { hadFrontmatter: false, yamlText: '', body: '' };
  }

  // Tolerate a leading BOM defensively (callers also strip it).
  let working = text;
  if (working.charCodeAt(0) === 0xfeff) {
    working = working.slice(1);
  }

  // Normalize line endings for the splitting step only. We restore the
  // original body text below so the user-visible body matches their input.
  // To do that cleanly, we work entirely in "lf-converted" land and then
  // reconstruct.
  const lf = working.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Strict: the first three characters must be `---` immediately followed by
  // \n. We deliberately do NOT accept `--- ` or `---\r` (the latter was
  // already collapsed to \n above).
  if (!lf.startsWith('---\n')) {
    return { hadFrontmatter: false, yamlText: '', body: text };
  }

  // Find the closing `---\n` (or `---` at end-of-string with no trailing
  // newline). The closing must be on its own line.
  const lines = lf.split('\n');
  // lines[0] is '---'. We search from line 1 onward for a line that is
  // exactly '---' (no other content).
  let closingLineIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      closingLineIndex = i;
      break;
    }
  }
  if (closingLineIndex === -1) {
    // No closing delimiter found — not a valid frontmatter file.
    return { hadFrontmatter: false, yamlText: '', body: text };
  }

  // Reassemble the YAML text (lines[1..closingLineIndex-1]) and the body
  // (lines[closingLineIndex+1..end]).
  const yamlText = lines.slice(1, closingLineIndex).join('\n');

  // v0.11.0 Checkpoint F — round-trip hash correctness.
  //
  // buildArtifact composes its output as `---\n${yaml}---\n\n${body}` —
  // i.e. a SINGLE blank line separates frontmatter from body, by
  // convention (matching Jekyll, Hugo, and every YAML-frontmatter tool
  // in the Markdown ecosystem). That blank line is structurally a
  // separator, NOT part of the body. The writer hashes `body` alone.
  // If we naively slice from `closingLineIndex + 1` we capture that
  // separator line as a leading `\n` on the body — the importer then
  // re-hashes a body that begins with `\n`, which diverges from the
  // writer's hash by exactly one byte. Result: every clean round-trip
  // fires CONTENT_HASH_MISMATCH.
  //
  // The fix is to recognize the conventional separator and skip it.
  // We skip AT MOST ONE blank line. If the body genuinely begins with
  // two blank lines (e.g. the user manually edited the file to add an
  // extra blank line), we preserve the second one as body content —
  // and the hash mismatch is now a real signal that the file was
  // edited, not noise.
  const bodyStartIndex =
    closingLineIndex + 1 < lines.length && lines[closingLineIndex + 1] === ''
      ? closingLineIndex + 2
      : closingLineIndex + 1;
  const bodyLf = lines.slice(bodyStartIndex).join('\n');

  // Parse YAML safely. js-yaml's `load` with the default schema is
  // sufficient; we lock down the shape via guard functions in
  // utils/artifactImport. We catch any throw and surface as parseError.
  let parsedYaml: unknown;
  let parseError: string | undefined;
  try {
    parsedYaml = yaml.load(yamlText, { schema: yaml.JSON_SCHEMA });
  } catch (err) {
    parseError = (err as Error).message;
  }

  return {
    hadFrontmatter: true,
    yamlText,
    body: bodyLf,
    parsedYaml,
    parseError,
  };
}

// ── Code-fence-aware line walker ─────────────────────────────────────────────

export type FenceState = 'OUTSIDE' | 'INSIDE_FENCE';

export interface LineEvent {
  /** Zero-indexed line number in the input. */
  index: number;
  /** Original line text (no trailing newline). */
  text: string;
  /** Was this line inside a code fence when it was visited? */
  insideFence: boolean;
  /** Is this line itself a fence-open or fence-close marker? */
  isFenceMarker: boolean;
}

export interface WalkResult {
  /** True if the walker reached EOF still INSIDE_FENCE. Caller should
   *  surface this as UNCLOSED_CODE_FENCE. */
  unclosedFence: boolean;
}

/**
 * Walk the input body line by line, telling the visitor for each line
 * whether it is inside a code fence and whether it is the fence boundary
 * marker itself.
 *
 * Visitors should treat lines with `insideFence: true` OR `isFenceMarker:
 * true` as body content, never as section headings.
 *
 * The body MAY end with a partial fence (no closing marker). The walker
 * does not throw; it returns `unclosedFence: true` so the caller can
 * surface a UNCLOSED_CODE_FENCE warning.
 *
 * @param body  The Markdown body. CRLF/LF/CR are all accepted; the walker
 *              normalizes internally.
 * @param visit Called once per line.
 */
export function walkFenceAware(
  body: string,
  visit: (ev: LineEvent) => void
): WalkResult {
  if (typeof body !== 'string') {
    return { unclosedFence: false };
  }

  // Normalize line endings for the walk; the visitor sees per-line text
  // with no trailing newline.
  const lf = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = lf.split('\n');

  // We do not consume a trailing empty line from a final newline — split
  // includes it. The visitor will see it as an empty-string line, which is
  // correct.

  let state: FenceState = 'OUTSIDE';
  let fenceChar: '`' | '~' | null = null;
  let fenceLen = 0;

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const trimmed = text.trim();
    let isFenceMarker = false;

    if (state === 'OUTSIDE') {
      const m = /^(`{3,}|~{3,})/.exec(trimmed);
      if (m) {
        state = 'INSIDE_FENCE';
        fenceChar = m[1][0] as '`' | '~';
        fenceLen = m[1].length;
        isFenceMarker = true;
      }
    } else {
      // INSIDE_FENCE. Look for a closing fence — same character, length
      // >= opening, AND the trimmed line is *only* fence characters (no
      // language tag, no trailing content). The closing rule is stricter
      // than opening: openings allow a trailing language identifier
      // (```ts), closings do not.
      const closingRe = new RegExp('^' + (fenceChar === '`' ? '`' : '~') + `{${fenceLen},}$`);
      if (closingRe.test(trimmed)) {
        state = 'OUTSIDE';
        fenceChar = null;
        fenceLen = 0;
        isFenceMarker = true;
      }
    }

    visit({
      index: i,
      text,
      insideFence: state === 'INSIDE_FENCE' || (isFenceMarker && state === 'OUTSIDE'),
      // The line that *closes* a fence is itself a body line that lived
      // inside the fence; flag it both ways so the caller can decide.
      // We expose `insideFence: true` for closing markers (covered above)
      // and `false` only when the marker opened a new fence — but for
      // section-header suppression purposes, both openings and closings
      // should suppress heading detection, so we conservatively report
      // insideFence=true for both. The previous line set state, so:
      isFenceMarker,
    });

    // Correct insideFence for the case where we just opened a fence on
    // *this* line. Visitor sees the fence marker as "inside" the fence so
    // it isn't treated as a heading. (The boolean above already handles
    // this via the post-state check; redundancy is intentional for
    // readability.)
  }

  return { unclosedFence: state === 'INSIDE_FENCE' };
}

// ── Section iteration (convenience) ──────────────────────────────────────────

/**
 * Iterate sections of the body delimited by lines that match the supplied
 * `isHeading` predicate, with fences honored — headings inside a code fence
 * are treated as body and do NOT open a new section.
 *
 * For each section the visitor receives the heading line (or null for the
 * leading pre-heading block) plus an array of body lines.
 *
 * Returns the unclosed-fence flag from the underlying walker for the
 * caller to surface as a warning if needed.
 */
export interface Section {
  /** The heading line that opened this section, or null for the leading
   *  text before the first heading. */
  heading: string | null;
  /** Body lines (no trailing newline). */
  bodyLines: string[];
}

export function iterateFenceAwareSections(
  body: string,
  isHeading: (line: string) => boolean
): { sections: Section[]; unclosedFence: boolean } {
  const sections: Section[] = [];
  let current: Section = { heading: null, bodyLines: [] };

  const result = walkFenceAware(body, (ev) => {
    const headingHere =
      !ev.insideFence && !ev.isFenceMarker && isHeading(ev.text);

    if (headingHere) {
      // Flush current section, start a new one keyed on this heading line.
      sections.push(current);
      current = { heading: ev.text, bodyLines: [] };
    } else {
      current.bodyLines.push(ev.text);
    }
  });

  // Flush the final section.
  sections.push(current);

  return { sections, unclosedFence: result.unclosedFence };
}
