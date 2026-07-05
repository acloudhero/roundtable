# RoundTable v0.10.5 — Gemini Review Packet

## Review Context

**Project:** RoundTable  
**Review Target:** v0.10.5 mediator extraction tolerance + state mutation cleanup  
**Base:** approved v0.10.4  
**Packet prepared by:** GPT-5.5 Thinking  
**Purpose:** Independent review of whether v0.10.5 resolves the brittle mediator `###` extraction issue and cleans up the remaining state-mutation concerns without regressing v0.10.4 response persistence.

## GPT-5.5 Gate Status

GPT-5.5 inspected the full uploaded `rt-v105.zip` package and verified:

- `npm ci` passes
- `npm run build` passes
- TypeScript errors: 0
- `npm audit --audit-level=low` returns 0 vulnerabilities
- `package.json`: 0.10.5
- `package-lock.json`: 0.10.5
- `SCHEMA_VERSION`: 0.10.5
- `APP_VERSION`: 0.10.5
- Uploaded zip did **not** include `node_modules` or `dist`
- No APIs, scraping, browser automation, auth, backend, cloud sync, model-provider integrations, or new dependencies found

## Problem Being Reviewed

v0.10.4 fixed the response persistence / aggregation race, but mediator extraction remained brittle because the extractor depended on exact `###` headings. Common model output variants such as numbered headings, h2 headings, bracket labels, and colon labels failed to populate structured mediator synthesis fields.

v0.10.5 claims to fix this by replacing the brittle split-based parser with a tolerant line-based parser and by migrating remaining safe round mutations away from `replaceRound(state, updated)`.

## Files Changed Relevant to Review

- `src/utils/mediatorExtract.ts`
- `src/components/MediatorPanel.tsx`
- `src/components/RoundBuilderPanel.tsx`
- `src/components/DecisionLogPanel.tsx`
- `src/components/ResponsesPanel.tsx`
- `src/utils/roundUtils.ts`
- `package.json`, `package-lock.json`, `src/config/exportFormats.ts`
- `README.md`, `docs/PHASE_HISTORY.md`, `docs/RELEASE_CHECKLIST.md`

## Key Implementation Claims

### 1. Mediator extraction is now line-based

The old parser split on exact level-3 headings. The new parser walks the mediator response line by line, uses heading detection/normalization helpers, and only starts a section when the normalized heading maps to a known mediator synthesis field.

Relevant helpers:

~~~~ts
normalizeMediatorHeading(line: string): string
isHeadingShaped(line: string): boolean
detectMediatorHeading(line: string): SynthesisKey | null
extractMediatorSections(rawResponse: string)
~~~~

### 2. Supported heading variants

GPT-5.5 verified extraction for:

| Case | Result |
|---|---|
| `### Executive Summary` | Pass |
| `### 1. Executive Summary` | Pass |
| `## Executive Summary` | Pass |
| `[EXECUTIVE SUMMARY]` | Pass |
| `Executive Summary:` | Pass |
| `Executive Summary：` full-width colon | Pass |
| Mid-body `Note: blah` | Preserved as body, not treated as heading |
| Unknown `### Random Internal Note` between known sections | Does not crash; known surrounding sections still extract |

### 3. MediatorPanel generation purity cleanup

`generatedPacket` is now derived from `round.mediatorPrompt`, not duplicated as local state. The previous `setGeneratedPacket(packet)` call inside a functional updater was removed. `handleGenerate()` now writes the generated packet to the live round via `updateRoundFunctional()` with no nested local state setter.

### 4. Remaining replaceRound call sites removed from app code

Internal call sites in MediatorPanel and RoundBuilderPanel were migrated to `updateRoundFunctional()`. `replaceRound()` remains exported in `roundUtils.ts` only as a deprecated backward-compatibility helper.

### 5. Response persistence from v0.10.4 preserved

The v0.10.4 response-persistence hardening remains intact:

- `ResponsesPanel` still uses `updateRoundFunctional()`
- draft flush behavior remains
- status changes still commit text atomically
- mediator generation still reads canonical saved round state

## GPT-5.5 Review Result

**Status:** Approved / Pass.

v0.10.5 satisfies the parser hardening gate and the state-mutation cleanup gate.

## Non-Blocking Notes for Gemini

1. Unknown bracket headings like `[Some Random Bracket Note]` are heading-shaped but not recognized, so their body is discarded until the next known section. This keeps known sections clean, but a user could lose an unknown note from extracted fields. The raw mediator response remains available, and fields are editable manually.

2. Dash-suffix matching is intentionally permissive. For example, `### Executive Summary — Notes` maps to `executiveSummary`.

3. Duplicate section headings are concatenated with blank-line separation rather than overwritten. This preserves more content than the prior behavior.

4. `replaceRound()` remains exported but deprecated. Internal app call sites are zero.

## Suggested Gemini Review Questions

1. Does v0.10.5 adequately fix the brittle `###` mediator extraction bug?
2. Is the line-based parser tolerant enough without being too broad?
3. Is the unknown-heading discard behavior acceptable given the raw response/manual fallback remains available?
4. Is the React purity cleanup in MediatorPanel sufficient?
5. Is it acceptable to keep `replaceRound()` exported as deprecated?
6. Does v0.10.5 preserve the v0.10.4 Total Serialization response-persistence behavior?
7. Is v0.10.5 safe to use as the new baseline before Phase 8/v0.11 cleanup?

## Acceptance Gate to Evaluate

v0.10.5 passes only if:

1. App builds cleanly.
2. TypeScript errors are zero.
3. Version references are aligned at 0.10.5.
4. Existing canonical `### Executive Summary` extraction still works.
5. `### 1. Executive Summary` extraction works.
6. `## Executive Summary` extraction works.
7. `[EXECUTIVE SUMMARY]` extraction works.
8. `Executive Summary:` extraction works.
9. Unknown headings do not crash extraction or erase known extracted content.
10. Section body content is preserved except for boundary trimming.
11. Manual fallback remains available if extraction is incomplete.
12. Mediator generation no longer calls local React state setters from inside functional state updaters.
13. Remaining `replaceRound` call sites are migrated where safe or explicitly documented as deferred.
14. v0.10.4 response persistence / Total Serialization behavior is not regressed.
15. Dynamic Markdown fencing is not regressed.
16. No APIs, scraping, browser automation, auth, backend, cloud sync, model-provider integrations, or new dependencies are introduced.
