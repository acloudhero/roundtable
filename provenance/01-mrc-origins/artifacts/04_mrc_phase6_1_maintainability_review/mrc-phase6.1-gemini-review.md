# Model Roundtable Console — Phase 6.1 Gemini Review Packet

**Review target:** Phase 6.1 — Maintainability Gate Cleanup  
**Prepared by:** GPT-5.5 Thinking  
**Date:** May 9, 2026  

This is a curated Markdown review packet, not the full repo. GPT-5.5 inspected the full uploaded Phase 6.1 zip and ran the build locally.


## GPT-5.5 Gate Status

**Decision:** Phase 6.1 passes GPT-5.5 review.

Verified:

| Check | Result |
|---|---|
| `npm ci` | Pass |
| `npm run build` | Pass |
| TypeScript errors | 0 |
| `package.json` | `0.6.0` |
| `package-lock.json` | `0.6.0` |
| `SCHEMA_VERSION` | `0.6.0` |
| `APP_VERSION` | `0.6.0` |
| New dependencies | None |
| Unsafe integrations | None found |

Phase 6.1 was a surgical cleanup over Phase 6. The patch changed three review-critical files:

- `docs/PHASE_HISTORY.md`
- `src/utils/validation.ts`
- `src/utils/markdownExport.ts`


## Review Questions for Gemini

Please review whether Phase 6.1 satisfies the maintainability gate:

1. Is `docs/PHASE_HISTORY.md` now sufficiently chronological and non-contradictory?
2. Does `normalizeProjects()` now satisfy the central safe-ID requirement?
3. Is missing project ID recovery surfaced clearly enough before import confirmation?
4. Is the `markdownExport.ts` header now aligned with the dynamic tilde-fencing implementation?
5. Do you see any remaining maintainability blockers before moving to Phase 7?
6. Treat the Vite/esbuild dev-server advisory and lack of automated tests as known future hardening items, not Phase 6.1 blockers, unless you disagree.


## Known Non-Blocking Carryovers

- No automated test suite yet. Manual verification remains documented in `docs/MAINTAINABILITY.md`.
- Vite/esbuild dev-server audit advisory remains deferred to Phase 9 release-candidate hardening.
- Phase 6.1 currently marks itself as `Current` in `PHASE_HISTORY.md`; after Gemini/GPT approval, this can be mentally treated as completed and then updated in a future phase history touchup.


## Code/Documentation Excerpts

### 1. PHASE_HISTORY chronological index

```markdown
# Phase History

Model Roundtable Console — chronological record of completed and future
phases. Status reflects the state of the project as of Phase 6.1.

| # | Phase | Status |
|---|---|---|
| 0 | Project Charter and Scope Lock | Completed |
| 1 | Architecture and UX Blueprint | Completed |
| 2 | Lightweight Repo Scaffold | Completed |
| 3 | Core Round Workflow | Completed |
| 3.1 | Cleanup Patch | Completed |
| 4 | Mediator Packet and Decision Loop Refinement | Completed |
| 5 | Export, Import, Durable State, and Recovery | Completed |
| 5.1 | Durability Gate Cleanup | Completed |
| 6 | Internal Documentation and Maintainability Pass | Completed |
| 6.1 | Maintainability Gate Cleanup | Current |
| 7 | Compatibility Resilience Layer | Future |
| 8 | UI Polish and Mobile Usability | Future |
| 9 | Release Candidate Hardening | Future |

---
```


### 2. Phase 6.1 entry

```markdown
## Phase 6.1 — Maintainability Gate Cleanup (Current)

**Version:** 0.6.0 (patch) · **Schema:** 0.6.0

**Fixes applied:**

1. **PHASE_HISTORY rewritten chronologically** — This file. Previous
   revisions accumulated stale "Current" labels on Phases 3, 3.1, 4,
   and 5 simultaneously, plus duplicate "Planned" sections for Phases
   4 and 5 even though those phases had completed. Replaced with a
   single chronological history with accurate completion status per
   phase, an index table at the top, and the Vite/esbuild deferral to
   Phase 9 preserved.

2. **Recovered project IDs use `generateSafeId()`** —
   `normalizeProjects()` in `src/utils/validation.ts` previously
   generated recovered project IDs with the inline pattern
   `recovered-proj-${i}`. Replaced with
   `generateSafeId('recovered-proj')` to centralize ID safety on the
   same utility used for prompts, responses, and rounds. No new
   dependency.

3. **Project ID recovery surfaced in repair warnings** — When
   `normalizeProjects()` mints a new ID for a project that arrived
   without one, it now pushes a repair message into `ctx.repairs` of
   the form *"Recovered missing project id at projects[N] using
   generateSafeId('recovered-proj')."* That message flows through the
   existing `AUTO_REPAIR_APPLIED` path and appears in the import
   preview so users see the change before confirmation. No fabricated
   project content.

4. **`markdownExport.ts` header comment corrected** — The header
   comment incorrectly described triple-backtick fencing even though
   the implementation uses dynamic tilde fencing (in place since Phase
   5.1). Comment rewritten to match the implementation. The fencing
   logic itself is unchanged.

**Behavior preserved:** No change to validation outcomes, normalization
behavior beyond the ID source, Markdown export contents, or any UI
flow. Phase 5.1 firewall guarantees and Phase 6 maintainability
guarantees remain intact.

**Vite/esbuild audit advisory** — Unchanged. Deferred to Phase 9.

---
```


### 3. `normalizeProjects()` safe recovered ID handling

```ts
function normalizeProjects(s: Record<string, unknown>, ctx: NormalizeContext): Project[] {
  const raw = s.projects;
  const list = Array.isArray(raw) ? raw : [];
  if (!Array.isArray(raw)) ctx.repairs.push('Created empty projects array.');

  return list.map((p, i) => {
    const proj = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;

    // Recovered project IDs go through the central safe-ID utility (Phase 6.1)
    // so the same Web Crypto + fallback path used by prompts/responses/rounds
    // also covers projects. The repair is surfaced so the user sees that an
    // ID was minted on import — no project content is fabricated.
    let id: string;
    if (typeof proj.id === 'string' && proj.id.length > 0) {
      id = proj.id;
    } else {
      id = generateSafeId('recovered-proj');
      ctx.repairs.push(
        `Recovered missing project id at projects[${i}] using generateSafeId('recovered-proj').`
      );
    }

    return {
      id,
      name: (proj.name as string) ?? '(Recovered Project)',
      description: (proj.description as string) ?? '',
      currentPhase: (proj.currentPhase as string) ?? '',
      canonicalState: (proj.canonicalState as string) ?? '',
      createdAt: typeof proj.createdAt === 'string' ? (proj.createdAt as string) : ctx.now,
      updatedAt: typeof proj.updatedAt === 'string' ? (proj.updatedAt as string) : ctx.now,
    };
  });
}
```


### 4. Dry-run normalization repairs are surfaced as typed warnings

```ts
  // Dry-run normalization so the user sees repairs in the import preview
  // BEFORE confirming. This is part of the Phase 5.1 import-firewall contract.
  if (!issues.some((i) => i.severity === 'error')) {
    try {
      const { repairs } = normalizeImportedState(raw);
      for (const r of repairs) {
        pushIssue(issues, 'AUTO_REPAIR_APPLIED', 'warning', `[Auto-repair] ${r}`);
      }
    } catch {
      pushIssue(
        issues,
        'AUTO_REPAIR_APPLIED',
        'warning',
        '[Auto-repair] Could not preview normalization repairs — proceed with caution.'
      );
    }
  }

  const split = splitIssues(issues);
  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
    errors: split.errors,
    warnings: split.warnings,
    repaired: false,
    summary,
  };
```


### 5. Referential integrity firewall remains strict where required

```ts
  // Round referential integrity — STRICT
  const roundIds = new Set<string>();
  rounds.forEach((round, idx) => {
    const r = round as Record<string, unknown>;
    const rid = typeof r.id === 'string' ? r.id : null;
    if (rid) roundIds.add(rid);

    if (typeof r.projectId !== 'string' || !projectIds.has(r.projectId)) {
      pushIssue(
        issues,
        'ORPHANED_ROUND',
        'error',
        `Round "${rid ?? '?'}" references project "${String(r.projectId ?? 'missing')}" ` +
          `which does not exist in this export. Import rejected — include the project or remove this round.`,
        `rounds[${idx}].projectId`
      );
    }

    // Field-level soft repairs — informational warnings; normalization handles them.
    if (typeof r.locked !== 'boolean') {
      pushIssue(
        issues,
        'FIELD_DEFAULTED',
        'warning',
        `Round "${rid ?? '?'}" missing/invalid locked field — will default to false.`,
        `rounds[${idx}].locked`
      );
    }
    if (!Array.isArray(r.generatedPrompts)) {
      pushIssue(
        issues,
        'FIELD_DEFAULTED',
        'warning',
        `Round "${rid ?? '?'}" generatedPrompts not an array — will be repaired to [].`,
        `rounds[${idx}].generatedPrompts`
      );
    }
    if (!Array.isArray(r.modelResponses)) {
      pushIssue(
        issues,
        'FIELD_DEFAULTED',
        'warning',
        `Round "${rid ?? '?'}" modelResponses not an array — will be repaired to [].`,
        `rounds[${idx}].modelResponses`
      );
    }
    if (!Array.isArray(r.selectedModelIds)) {
      pushIssue(
        issues,
        'FIELD_DEFAULTED',
        'warning',
        `Round "${rid ?? '?'}" selectedModelIds not an array — will be repaired to [].`,
        `rounds[${idx}].selectedModelIds`
      );
    }
  });

  // Decision referential integrity
  decisions.forEach((dec, idx) => {
    const d = dec as Record<string, unknown>;
    const did = typeof d.id === 'string' ? d.id : '?';

    // Strict: invalid projectId on a decision is a hard error.
    if (typeof d.projectId === 'string' && !projectIds.has(d.projectId)) {
      pushIssue(
        issues,
        'ORPHANED_DECISION_PROJECT',
        'error',
        `Decision "${did}" references project "${String(d.projectId)}" which does not exist. Import rejected.`,
        `decisions[${idx}].projectId`
      );
    }

    // Soft: broken roundId — decision text may still be usable.
    if (typeof d.roundId === 'string' && !roundIds.has(d.roundId)) {
      pushIssue(
        issues,
        'BROKEN_DECISION_ROUND_LINK',
        'warning',
        `Decision "${did}" references round "${d.roundId}" not found in this export. ` +
          `Decision will import but its round link will be broken.`,
        `decisions[${idx}].roundId`
      );
    }
  });
```


### 6. Dynamic tilde-fencing header and helper

```ts
// src/utils/markdownExport.ts
// Purpose: Human-readable Markdown exports for review, handoff, and archiving.
// Phase 5: multiple export types with fenced blocks around user/model content.
// Phase 5.1: triple-backtick fencing replaced with DYNAMIC TILDE FENCING.
// Owned by: this file
// Used by: ExportImportPanel
//
// FENCING RULE — IMPORTANT:
// Large user-authored or model-authored content is wrapped in dynamic tilde
// fences (~~~~markdown ... ~~~~), NOT triple backticks. The `fence()` helper
// counts the longest run of consecutive tildes already in the content and
// emits a fence of at least 4 tildes, or one longer than the longest run.
// This ensures embedded code fences (including triple-backtick blocks pasted
// from model responses) do not prematurely close the export's outer fence
// and break the document structure.
//
// Apply to: canonical state, generated prompts, model responses, mediator
// packet, mediator response, mediator synthesis fields, decision rationale
// (when long), canonical state updates, and prompt templates.
//
// Do NOT replace `fence()` with naive triple-backtick fencing — that is the
// exact regression Phase 5.1 fixed.

import { AppState } from '../types/appState';
import { Round, MediatorSynthesis } from '../types/round';
import { Project } from '../types/project';
import { Decision } from '../types/decision';
import { nowIso, formatDisplay } from './dateTime';
import { SCHEMA_VERSION } from '../config/exportFormats';

// ── Utilities ─────────────────────────────────────────────────────────────────

// fence() uses dynamic tilde fencing to safely wrap content that may itself
// contain triple-backtick code fences. We count the longest existing tilde
// run in the content and use at least 4 or one more than that.
function fence(content: string, lang = 'markdown'): string {
  if (!content || !content.trim()) return '_None_';
  const trimmed = content.trim();
  // Find the longest run of tildes already in the content
  const runs = trimmed.match(/~+/g) ?? [];
  const maxRun = runs.reduce((m, r) => Math.max(m, r.length), 0);
  const fenceLen = Math.max(4, maxRun + 1);
  const fence = '~'.repeat(fenceLen);
  return `${fence}${lang}\n${trimmed}\n${fence}`;
}
```


### 7. README version line

```markdown
## Version

`0.6.0` (Phase 6) · Schema: `0.6.0` · Storage key: `mrc.appState.v0`
```


### 8. Schema evolution doc presence

```markdown
# Schema Evolution

Model Roundtable Console — schema lifecycle and import-compatibility guide.

This document is the single source of truth for how MRC's data model has
evolved, how older exports are handled, and how to extend the schema
without breaking existing user data. **Read this before bumping
`SCHEMA_VERSION` or changing any field on `AppState`.**

---

## Current schema version

`0.6.0` — defined in `src/config/exportFormats.ts` as `SCHEMA_VERSION`.

The same string is stamped onto:

- New `AppState` objects (`src/data/initialAppState.ts`)
- Every JSON export (`src/utils/jsonExport.ts`)
- Every Markdown export header (`src/utils/markdownExport.ts`)
- Validation comparisons against incoming imports (`src/utils/validation.ts`)

The application package version (`package.json`, `package-lock.json`) and
the in-app `APP_VERSION` (`src/utils/jsonExport.ts`) move in lockstep with
`SCHEMA_VERSION` for now. They may decouple once MRC reaches `1.0.0`.

---

## What changed by version

### 0.4.0 → 0.5.0 (Phase 5 — Export, Import, Durable State, Recovery)

**Shape changes:** none. `AppState` keys are unchanged from 0.4.0.

**Pipeline changes:**

- New JSON export envelope:
  `{ exportType, schemaVersion, exportedAt, appName, appVersion, source, payload: { appState } }`.
  Older `{ schemaVersion, exportedAt, appState }` exports are still accepted
  on import as `legacy` and produce a `LEGACY_FORMAT_DETECTED` warning.
- New `validation.ts` import firewall: parse → extract → validate → normalize.
- New `localStorageAdapter.loadWithRecovery()` returning `{ state, rawValue,
  error, wasCorrupted }` so corrupted local state opens RecoveryPanel rather
  than crashing.
- New referential-integrity rules:
  - Orphaned `round.projectId` → hard error (rejected import).
  - Invalid `decision.projectId` → hard error.
  - Broken `decision.roundId` → warning only (decision text preserved).
- Backup-before-import gate added to the import flow.

### 0.5.0 → 0.6.0 (Phase 6 — Internal Documentation and Maintainability Pass)

**Shape changes:** none. `AppState` keys are unchanged from 0.5.0.
A `0.5.0` export will normalize cleanly into a `0.6.0` AppState with no
substantive differences.

**Pipeline changes:**

- Validation results now include a typed `issues: ValidationIssue[]`
  alongside the legacy `errors: string[]` / `warnings: string[]`. UI can
  render either; both views describe the same underlying issues.
- New `ValidationCode` enum-as-string-union for stable issue identity:
  `JSON_PARSE_FAILED`, `APP_STATE_MISSING`, `SCHEMA_MISSING`,
  `SCHEMA_MISMATCH`, `EXPORT_TYPE_UNKNOWN`, `LEGACY_FORMAT_DETECTED`,
  `REQUIRED_ARRAY_MISSING`, `REQUIRED_ARRAY_INVALID`, `ORPHANED_ROUND`,
  `ORPHANED_DECISION_PROJECT`, `BROKEN_DECISION_ROUND_LINK`,
  `ACTIVE_PROJECT_REPAIRED`, `FIELD_DEFAULTED`, `TIMESTAMP_DEFAULTED`,
  `AUTO_REPAIR_APPLIED`.
- `normalizeImportedState()` split into per-collection helpers
  (`normalizeProjects`, `normalizeActiveProjectId`, `normalizeRounds`,
```


### 9. Maintainability doc opening

```markdown
# Maintainability Guide

Model Roundtable Console — practical orientation for anyone editing the
codebase. Written for:

- future AI implementation models
- nontraditional developers
- the product owner returning after time away

This document is deliberately practical. It tells you where things live,
which edits are safe, which edits are risky, and how to test changes
without breaking the local-first guarantees that make MRC trustworthy.

If a thing isn't documented here, it isn't an established pattern.
Don't invent one.

---

## What MRC is, in two sentences

MRC is a local-first, browser-based cockpit for coordinating multiple
consumer AI models via **manual copy/paste** workflows. It has no
backend, no API keys, no scraping, no browser automation, and no cloud
sync — and it must stay that way.

---

## Map of the codebase

```
src/
  components/    UI panels, one per top-level tab
  config/        Static configuration: model profiles, prompts, notes
  data/          Demo data and INITIAL_APP_STATE
  storage/       StorageAdapter interface + localStorage implementation
  styles/        app.css (single stylesheet, no framework)
  types/         TypeScript interfaces (AppState, Round, Project, ...)
  utils/         Pure utilities (validation, exports, prompts, mediator)

docs/            Internal documentation (you are here)
```

The app entry point is `src/main.tsx` → `src/App.tsx`. App.tsx wires
state, recovery mode, and the panel switcher.

---

## Major code areas at a glance

| Area | File(s) | Owns |
|---|---|---|
| Top-level state | `src/App.tsx` | Single `AppState`, recovery-mode gate, tab routing |
| Storage | `src/storage/localStorageAdapter.ts` | `load`, `save`, `clear`, `loadWithRecovery`, `loadRaw`, `preserveCorrupted` |
| Storage seam | `src/storage/storageAdapter.ts` | The `StorageAdapter` interface — swap localStorage for IndexedDB later without changing UI |
| Schema | `src/types/*.ts`, `src/config/exportFormats.ts` | TypeScript shape + `SCHEMA_VERSION` |
| Initial state | `src/data/initialAppState.ts` | Demo data shipped with a fresh install |
| Prompt generation | `src/utils/promptGeneration.ts` | Context Sandwich prompt construction (one place, no scattering) |
| Mediator packet | `src/utils/mediatorPacket.ts` | The exact packet sent to GPT-5.5 |
| Mediator extraction | `src/utils/mediatorExtract.ts` | Parses GPT-5.5 response into `MediatorSynthesis` fields |
| Round transitions | `src/utils/roundUtils.ts` | Pure state-transition functions (`createRound`, `markPromptCopied`, ...) |
| Validation firewall | `src/utils/validation.ts` | Parse / extract / validate / normalize import payloads |
| JSON export | `src/utils/jsonExport.ts` | Envelope, filenames, `downloadText`, `downloadBackup` |
| Markdown export | `src/utils/markdownExport.ts` | 8 Markdown export shapes with dynamic tilde fencing |
| ID generation | `src/utils/id.ts` | `generateSafeId` / `generateId` (Web Crypto + fallback) |
| Recovery UX | `src/components/RecoveryPanel.tsx` | Shown when localStorage is malformed |
| Export/Import UX | `src/components/ExportImportPanel.tsx` | Two-section panel: exports + 4-stage import flow |

---

## Safe edit zones

Edits in these areas are routine and rarely break invariants:

### Configuration (`src/config/`)

- `modelProfiles.ts` — add/edit/remove model profiles. They flow to the
  Model Roster automatically.
- `promptTemplates.ts` — add/edit prompt templates. They appear in the
  Prompt Library automatically.
- `compatibilityNotes.ts` — add notes. `active` notes are auto-included
  in generated prompts for matching models.

### Demo data (`src/data/`)

- `demoProject.ts`, `demoRounds.ts`, `initialAppState.ts` — change demo
  fixtures freely. They only affect first-load and "Reset to Demo Data".

### Markdown export shapes (`src/utils/markdownExport.ts`)

- Adjusting wording, section ordering, or adding new export types.
```


## Requested Gemini Response Format

Please respond with:

1. Phase 6.1 approval status: `Approved`, `Approved with cleanup notes`, or `Not approved`.
2. Any blocking issues.
3. Any non-blocking cleanup notes.
4. Whether the project is ready for Phase 7 — Compatibility Resilience Layer.
5. Recommended Phase 7 focus areas.
