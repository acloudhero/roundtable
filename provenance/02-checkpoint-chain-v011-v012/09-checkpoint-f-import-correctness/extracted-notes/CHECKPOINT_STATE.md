# RoundTable v0.11.0 Markdown Handoff Mode — Checkpoint F State

**Status:** Both Checkpoint E known importer correctness issues fixed. Build clean. End-to-end smoke test confirms a clean round-trip now produces zero spurious warnings.

This document describes the exact state of the codebase at the moment this zip was produced. Read it before resuming.

## What changed in Checkpoint F

Two narrow, surgical fixes to importer correctness. No new files. No new dependencies. No scope expansion.

### Files created

None.

### Files modified

- **`src/utils/markdownParse.ts`** — fixed the body-extraction in `splitFrontmatter` to skip the conventional blank line that follows the closing `---` delimiter. Diff: +21 / −1 lines (mostly explanatory comment).
- **`src/utils/mediatorExtract.ts`** — tightened the `# marker` branch in `isHeadingShaped` from `/^#{1,6}\s+\S/` (any H1–H6) to `/^###\s+\S/` (exactly H3). The other branches (bracket form `[…]`, un-prefixed HEADING_MAP lookup, dash-suffix lookup) are unchanged. Diff: +14 / −5 lines (mostly explanatory comment).

### Files NOT modified

- All other foundation utilities, types, configs, components — untouched.
- No frontmatter schema changes.
- No hash-algorithm changes.
- No normalization-policy changes (BOM strip, NFC, CRLF→LF, exactly one trailing LF — all preserved).
- `extractMediatorSections` behavior with respect to its caller is unchanged — same return shape, same dispatcher logic.
- `buildArtifact`, the writer, is untouched.
- `package.json` / `package-lock.json` / CSS — unchanged.

## Exact fix for CONTENT_HASH_MISMATCH false positive

**Root cause:** `buildArtifact` writes the artifact as `---\n<yaml>---\n\n<body>` and hashes `<body>` directly (no leading newline). The reader's `splitFrontmatter` used `lines.slice(closingLineIndex + 1).join('\n')` to extract the body — which captured the conventional separator blank line as a leading `\n` on the body. The reader then re-hashed `\n<body>`, diverging from the writer's hash by exactly one byte. Result: every clean round-trip fired `CONTENT_HASH_MISMATCH`.

**Fix site:** `splitFrontmatter` body extraction.

**Change:**

```ts
// before
const bodyLf = lines.slice(closingLineIndex + 1).join('\n');

// after
const bodyStartIndex =
  closingLineIndex + 1 < lines.length && lines[closingLineIndex + 1] === ''
    ? closingLineIndex + 2
    : closingLineIndex + 1;
const bodyLf = lines.slice(bodyStartIndex).join('\n');
```

**Why this site (not buildArtifact):**
- The blank line is *structurally* a separator (Jekyll, Hugo, and every YAML-frontmatter tool in the ecosystem use the same convention).
- It is *not* body content; treating it as content was the bug.
- Touching the reader keeps the writer side untouched — `BuiltArtifact.body` and `BuiltArtifact.fullText` exposed to consumers are unchanged. Tests, downloads, and any external readers of the BuiltArtifact contract remain stable.

**Why "at most one blank line" and not "strip all leading blank lines":**
- An author/file manually edited to add an *extra* blank line is genuinely modified. We preserve any second blank line as body content so the hash mismatch becomes a real "file was edited" signal rather than silent normalization.
- The convention is exactly one blank line — anything more is a signal, not a separator.

**Normalization policy preserved:**
- BOM strip: still happens at the top of `splitFrontmatter` and again in `normalizeForHash`.
- NFC: in `normalizeForHash`, unchanged.
- CRLF/CR → LF: still happens.
- Exactly one trailing LF: still happens via `normalizeForHash`.
- Per-line whitespace: still preserved.

**Hash validation strength preserved:**
- Hashes still validate every byte of the body. The fix removes a SPURIOUS byte that the writer never wrote, restoring write/read symmetry.
- Any genuine edit (extra blank line, modified character, missing character) still triggers `CONTENT_HASH_MISMATCH`.

## Exact fix for H1 / UNMATCHED_HEADING noise

**Root cause:** `buildMediatorSynthesisBody` emits a title line `# Mediator Synthesis — Round N` at the top of every synthesis artifact (matching the existing user-facing convention for mediator output). `isHeadingShaped` previously accepted any `#{1,6}` heading marker, so this H1 line was classified as heading-shaped. `detectMediatorHeading` then looked it up in `HEADING_MAP` (which only contains the 12 canonical `###` section labels), found nothing, and `extractMediatorSections` appended it to `unmatchedHeadings`. Result: every clean round-trip emitted one `UNMATCHED_HEADING` info notice for the artifact's own title.

**Fix site:** `isHeadingShaped` regex.

**Change:**

```ts
// before
if (/^#{1,6}\s+\S/.test(s)) return true;

// after  (exactly three # — H3 only)
if (/^###\s+\S/.test(s)) return true;
```

**Why this exact regex:**
- `^###` requires exactly 3 leading `#`.
- `\s+` requires at least one whitespace after the third `#`. This rejects `####…` because the 4th `#` is not whitespace, so the `\s+` clause cannot match.
- `\S` requires non-whitespace content after the space. Rejects empty headings and trailing-space-only lines.

**Behavior matrix after the fix:**

| Input                                | branch (a) `### ` | branch (b) `[…]` | branch (c) HEADING_MAP | `isHeadingShaped` | Notes |
|--------------------------------------|--------|--------|------------|---------|---------------------------------------------|
| `# Mediator Synthesis — Round 5`     | ✗      | ✗      | ✗          | **false** | Fix 2 — H1 title is body content now        |
| `## Some H2 title`                   | ✗      | ✗      | ✗          | **false** | H2 unknown stays as body content            |
| `## Risks` (H2 with known label)     | ✗      | ✗      | ✓ (`risks`) | **true** | H2 KNOWN still resolves via map — by design |
| `### Risks`                          | ✓      | —      | —          | **true** | Canonical case                              |
| `### Bogus Section`                  | ✓      | —      | —          | **true** | Still flagged as unmatched downstream       |
| `#### Sub-risk`                      | ✗      | ✗      | ✗          | **false** | H4 sub-headings stay as body content        |
| `##### Deeper`                       | ✗      | ✗      | ✗          | **false** | H5+ stays as body content                   |
| `[Risks]`                            | ✗      | ✓      | —          | **true** | Bracket form preserved (legacy tolerance)   |
| `Risks:`                             | ✗      | ✗      | ✓          | **true** | Un-prefixed known form preserved            |
| `Just a paragraph.`                  | ✗      | ✗      | ✗          | **false** | Plain text stays body                       |
| `###word` (no space)                 | ✗      | ✗      | ✗          | **false** | Strict whitespace requirement               |

**Why H4–H6 are now also excluded:**
- The brief specifies that the 12 required mediator synthesis headings live at `###` level.
- H4–H6 in practice are intra-section sub-headings ("Risks > Subrisk A"). Treating them as section-heading candidates would erroneously split a section's content.
- Excluding them also reduces false `UNMATCHED_HEADING` noise from any artifact that includes sub-headings.

**Behavior preserved per the brief's requirements:**
- Required ### headings still match.
- Unknown ### headings still emit `UNMATCHED_HEADING` (verified via spot-check `### Bogus Section`).
- Duplicate known ### still emits `DUPLICATE_HEADING` (verified).
- Missing required headings still emit `REQUIRED_SECTION_MISSING` (verified).
- Headings inside fenced code blocks still ignored — the fence-aware walker runs BEFORE `isHeadingShaped`, so the regex change doesn't affect fence handling (verified with `### Risks\n...\n\`\`\`\n### Inside Fence\n...\n\`\`\`\n### Open Questions\n` test case).

**Not a brittle regex:**
- The fix is a single character class tightening (`#{1,6}` → `###`). It does not introduce lookaheads, alternation, or other complex features.
- Branch (c) HEADING_MAP fallback still catches every known label form (`## Risks`, `Risks:`, etc.) so the canonical-data path is unaffected.

## Verification performed

End-to-end smoke test (`/tmp/f-verify.mjs` bundled via esbuild and run under Node 22):

**Heading shape spot-checks (Fix 2): 11/11 pass**
- H1 title, H2 unknown, H4, H5, plain text, `###word` → all return false.
- H2 known, H3 known, H3 unknown, bracket form, un-prefixed form → all return true.

**Fence-aware behavior (regression):**
- Body containing `### Risks\nfoo\n\`\`\`\n### Inside Fence\nbar\n\`\`\`\n### Open Questions\nq1\n` → `presentKeys: ['risks', 'openQuestions']`, `unmatchedHeadings: []`. The fenced `### Inside Fence` did NOT split a section, did NOT appear as unmatched. **PASS.**

**End-to-end round-trip (the two key checks from the brief):**
- Build a synthesis artifact via `buildArtifact({ kind: 'mediator_synthesis', ... })`.
- Re-import via `buildImportPreview(text, state)`.
- Warning codes captured: `['REQUIRED_SECTION_MISSING']` only.
- `CONTENT_HASH_MISMATCH` absent ✓ (Fix 1)
- `UNMATCHED_HEADING` absent ✓ (Fix 2)
- `REQUIRED_SECTION_MISSING` still present, correctly listing the 3 deliberately-empty fields in the test synthesis ✓

**Structured commit + rollback (regression):**
- `commitStructured(preview, state)` produces a transaction.
- Round's `mediatorSynthesis` populated post-commit ✓.
- `canRollback(state, txId)` returns `true` ✓.
- After rollback: `mediatorSynthesis` cleared ✓.

**Duplicate ### still warns (regression):**
- Body with `### Risks\na\n### Risks\nb\n` → `duplicateKeys: ['risks']` ✓.

**Unknown ### still warns (regression):**
- Body with `### Bogus Section\nx\n` → `unmatchedHeadings: ['### Bogus Section']` ✓.

## Build state

- `npx tsc --noEmit` → exit 0, no output.
- `npm run build` → exit 0:
  - `dist/index.html` 0.51 kB
  - `dist/assets/index-*.css` 27.38 kB (gzip 5.06 kB) — unchanged from E.
  - `dist/assets/index-*.js` 412.12 kB (gzip 120.88 kB) — +0.03 kB vs E (essentially noise; the regex change is a few characters and the splitFrontmatter change is a handful of lines).
  - 76 modules transformed (unchanged).

## Known limitations

- **`## Risks` (H2 with a known label) is still treated as a section heading.** This is intentional, not a defect: the brief targets "H1/H2 *titles*" (i.e. unknown content at H1/H2). H2 lines that resolve to a known `HEADING_MAP` entry continue to function as section headings via branch (c). Models that emit `## Risks` instead of `### Risks` still produce valid synthesis imports.
- **H4–H6 sub-headings now become body content.** This is a behavior change — previously they were classified as heading-shaped (and therefore as unmatched section headings, splitting their parent section). The new behavior is more correct: sub-headings should be body content. If any existing artifacts depended on H4–H6 splitting sections, those imports will now keep the sub-heading text inside the parent section's structured field.
- **Bracket form `[Foo]` still accepted unconditionally.** Branch (b) doesn't constrain the bracket contents. An artifact with `[Random Sentence]` on its own line would still be classified as heading-shaped and emit `UNMATCHED_HEADING`. This is unchanged from Checkpoint E; the brief did not call out bracket tightening.
- **The blank-line skip in `splitFrontmatter` is "at most one".** A file with TWO blank lines after the closing `---` will have ONE preserved on the body. Subsequent re-import will hash it differently than the writer's output, and `CONTENT_HASH_MISMATCH` will fire — correctly, because the file was modified.

## Deferred items for Checkpoint G

- Structured commit for `generated_prompt` (foundation exists in `commitGeneratedPrompt`).
- Structured commit for `model_response` (foundation exists in `commitModelResponse`).
- Structured commit for `mediator_packet` (foundation exists in `commitMediatorPacket`).
- Per-slot Upload `.md` in `ResponsesPanel` once `model_response` structured commit lands.
- Replace `window.confirm` storage gate with in-style modal.
- `docs/MARKDOWN_HANDOFF.md` + updates to `PHASE_HISTORY`, `SCHEMA_EVOLUTION`, `DATA_MODEL`, `RELEASE_CHECKLIST`.
- 15-item acceptance criteria walk (feasibility doc sec. 12).

## How to resume

1. `npm install` (no new deps).
2. `npx tsc --noEmit` → expect clean.
3. `npm run build` → expect clean.
4. Optional: re-run `/tmp/f-verify.mjs` (bundled via esbuild + node) to re-confirm all assertions pass.
5. Manual exercise:
   - Generate and save a synthesis via the Mediator panel.
   - Click `Download Synthesis .md`.
   - Click `Upload .md`, pick the just-downloaded file.
   - Confirm preview shows source_kind `mediator_synthesis`, availableOutcomes includes commit, Import button enabled.
   - **Confirm no CONTENT_HASH_MISMATCH warning** (Fix 1 verification).
   - **Confirm no UNMATCHED_HEADING warning from the H1 title** (Fix 2 verification).
   - If the synthesis had empty fields, confirm `REQUIRED_SECTION_MISSING` lists exactly those.
   - Click Import → confirm synthesis fields populated.
   - Roll back via Import History → confirm round restored.
6. Begin Checkpoint G: extend the structured-commit gate in `useMarkdownUpload.ts` to allow `generated_prompt`, `model_response`, `mediator_packet`.
