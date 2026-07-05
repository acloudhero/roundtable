# Model Roundtable Console — Phase 4 Gemini Review Packet

**Date:** May 8, 2026  
**Prepared by:** GPT-5.5 Thinking  
**Purpose:** Single-file Markdown review bundle for Gemini 3 Thinking.  

This is **not** the full repo. It is a review-focused Markdown packet containing phase context, GPT-5.5 gate status, review goals, known issue notes, and the most relevant Phase 4 files/excerpts.

---

## 1. Phase Context

Project: **Model Roundtable Console (MRC)**  
Phase: **Phase 4 — Mediator Packet and Decision Loop Refinement**

MRC is a local-first manual-copy/paste workflow cockpit for coordinating multiple consumer AI models. It does **not** use model-provider APIs, browser automation, scraping, login automation, backend services, cloud sync, or authentication.

Phase 4 focused on the mediator packet and decision loop:

1. Refine GPT-5.5 mediator packet structure.
2. Require a predictable 12-section mediator response format.
3. Add structured mediator synthesis fields.
4. Use simple heading-based extraction only, with graceful fallback.
5. Provide user-controlled draft-transfer buttons into decision fields.
6. Preserve explicit user approval before canonical state updates.
7. Add proposed next-round prompt support.
8. Keep locked rounds visible/read-only.
9. Update export/docs for mediator synthesis fields.

---

## 2. GPT-5.5 Gate Status

GPT-5.5 reviewed the full Phase 4 package and ran:

```bash
npm ci
npm run build
```

Result:

| Check | Result |
|---|---|
| `npm ci` | Pass |
| `npm run build` | Pass |
| TypeScript errors | 0 |
| `package.json` version | `0.4.0` |
| `package-lock.json` version | `0.4.0` |
| Schema version | `0.4.0` |
| Lockfile alignment | Confirmed |
| API/backend/scraping/browser automation | None found |

**GPT-5.5 Review Decision:** Phase 4 passes.

---

## 3. Known Issue for Gemini to Note

`README.md` still contains stale version text from Phase 3.1:

```txt
Current: 0.3.0
Version: 0.3.1
Schema: 0.3.0
```

It should be updated to:

```txt
Current: 0.4.0
Version: 0.4.0
Schema: 0.4.0
```

This is documentation hygiene only, not a Phase 4 architecture blocker.

---

## 4. Gemini Review Goals

Please review the Phase 4 implementation for the following goals:

1. Refined GPT-5.5 mediator packet with 12 required sections.
2. Structured mediator synthesis fields.
3. Simple heading-based extraction only; no black-box parsing.
4. Draft-transfer buttons that fill editable decision fields but do not auto-apply changes.
5. Explicit user approval before canonical state update.
6. Proposed next-round prompt support.
7. Locked rounds remain visible/read-only.
8. JSON/Markdown export includes new mediator/decision fields.
9. No API calls, scraping, browser automation, auth, backend, or cloud sync.

---

## 5. Specific Questions for Gemini

1. Does the mediator synthesis model preserve the “cockpit controlled by user” principle?
2. Is the heading-based extraction simple enough to be safe but useful enough to reduce friction?
3. Are the draft-transfer controls clear enough, or do they risk implying automatic authority?
4. Does the next-round prompt support belong in Phase 4, or should any part of it be deferred?
5. Are there any risks before proceeding to Phase 5 — Export, Import, and Durable State?

---

## 6. Review Files

The following sections include the review-relevant files from the Phase 4 implementation.

---

### File: `README.md`

```markdown
# Model Roundtable Console

A local-first browser application for coordinating multiple consumer AI models in a structured roundtable workflow.

**Phase 3 — Core Round Workflow**

---

## What This App Is

- A **manual copy/paste coordination cockpit** for multi-model AI workflows
- A **prompt generator** using the Context Sandwich pattern
- A **chain-of-custody audit log** tracking when prompts were copied and responses were pasted
- A **project state and decision logger** with round history
- A **local-first tool** — all data stays in your browser

## What This App Is Not

- ❌ Not an API orchestration tool
- ❌ Not a browser automation or scraping tool
- ❌ Not connected to any AI model directly
- ❌ Has no backend, no authentication, no server

---

## Local Install & Run

**Prerequisites:** Node.js 18+

```bash
cd model-roundtable-console
npm install
npm run dev
```

Open `http://localhost:5173`

```bash
npm run build   # production build
npm run preview # preview production build
```

---

## Core Workflow (Phase 4)

1. **Project State** — Set project name, phase, and canonical state
2. **Model Roster** — Activate the models you want to use
3. **Round Builder** — Click `+ New Round`, write instruction, select models, generate prompts
4. **Copy Prompts** — Click Copy button for each model (copiedAt timestamp recorded)
5. **Responses** — Paste each model's response (pastedAt timestamp recorded)
6. **Mediator** — Generate packet → copy to GPT-5.5 → paste response → Extract structured fields → review/edit synthesis
7. **Decision Log** — Review mediator synthesis → use drafts → record decision → optionally apply canonical state update → lock round → use proposed next-round prompt
8. **Project State** — Review and refine canonical state for next round
9. **Export** — Export JSON or Markdown

---

## Chain-of-Custody Tracking

Phase 3 tracks the full manual workflow audit trail:

| Event | Recorded |
|---|---|
| Prompt generated | `generatedAt` |
| User clicked Copy | `copiedAt` |
| User pasted response | `pastedAt` |
| Decision recorded | `Decision.createdAt` |
| Round locked | `Round.locked = true` |

---

## Canonical State — Important Rule

**The app never automatically updates `Project.canonicalState`.**

The mediator may *propose* a canonical state update, but it is only applied when:
1. The user pastes/writes the update in Decision Log → "Canonical State Update to Apply"
2. The user checks "Apply to Project Canonical State"
3. The user confirms the lock action

When applied, the update is appended as a dated section — the original state is preserved.

---

## Data Warning

⚠️ **All data is stored locally in your browser (localStorage).**

Export your JSON regularly from Export / Import. Clearing browser data will delete your project state.

---

## Major Folders

| Folder | Purpose |
|---|---|
| `src/components/` | UI panels — one per screen tab |
| `src/config/` | Model profiles, prompt templates, compatibility notes |
| `src/data/` | Demo data and initial app state |
| `src/storage/` | StorageAdapter interface and localStorage implementation |
| `src/types/` | TypeScript interfaces (AppState, Round, GeneratedPrompt, etc.) |
| `src/utils/` | Pure utilities (roundUtils, promptGeneration, mediatorPacket, export) |
| `src/styles/` | app.css |
| `docs/` | Internal documentation |

---

## Adding a New Model

Edit `src/config/modelProfiles.ts`. See `docs/MODEL_PROFILES.md`.

---

## Automation Warning

Do not attempt to automate browser sessions, scrape responses, or add API calls.
This app is designed for manual copy/paste workflows only.

---

## Schema Version

Current: `0.3.0` · Storage key: `mrc.appState.v0`

---

## Dependency Audit Advisory

`npm audit` may report a moderate advisory in the Vite/esbuild dev-server dependency chain.

- This affects the **local development server** only — MRC has no production backend.
- Do **not** run `npm audit fix --force`; it may jump to a breaking Vite major version.
- This will be addressed during Phase 9 release-candidate hardening.
- For local development use, the risk is minimal.

---

## Version

`0.3.1` (Phase 3.1 cleanup) · Schema: `0.3.0` · Storage key: `mrc.appState.v0`

```

---

### File: `docs/PHASE_HISTORY.md`

```markdown
# Phase History

Model Roundtable Console

## Phase 1 — Architecture (Completed)

**Outcome:** Data model defined. AppState as single top-level object. Storage adapter. Context Sandwich. Round immutability via locked field.

**Key decisions:** Single AppState, storage adapter, Context Sandwich, locked: boolean on Round.

**Attribution:** Gemini 3 Thinking contributed: Context Sandwich, storage adapter interface, round immutability rationale, glass box UI principle, rich prompt/response arrays.

---

## Phase 2 — Lightweight Repo Scaffold (Completed)

**Outcome:** All 10 screens, demo data, storage adapter wired, Context Sandwich utility, mediator packet utility, placeholder export, industrial terminal aesthetic.

**Delivered:** 49 files, zero TypeScript errors, clean build.

---

## Phase 3 — Core Round Workflow (Current)

**Objective:** Transform Phase 2 scaffold into a functional local workflow engine.

**Key changes:**
- Rich GeneratedPrompt[] schema with id, modelProfileId, generatedAt, copiedAt, status
- Rich ModelResponse[] schema with id, modelProfileId, pastedAt, status
- canonicalStateUpdate field on Round (user-approved, never auto-applied)
- roundUtils.ts: pure state transition functions (createRound, generatePromptsForRound, markPromptCopied, upsertModelResponse, recordDecisionForRound, applyCanonicalStateUpdate, getRoundProgress, isRoundMediatorReady)
- Dashboard: real-time workflow progress bars, chain-of-custody status dots
- RoundBuilderPanel: new round creation with incomplete-round warning, copy tracking with copiedAt
- ResponsesPanel: pastedAt timestamps, response status toggles (pasted/reviewed/excluded)
- MediatorPanel: partial-response warning, mediator response storage
- DecisionLogPanel: explicit canonicalStateUpdate textarea + apply checkbox + confirmation
- ProjectStatePanel: prominent canonical state editor
- Schema version bumped to 0.3.0
- markdownExport updated for rich array schema

**Rule established:** Canonical state may only be updated through explicit user action. App never silently overwrites Project.canonicalState.

**Attribution:** Gemini 3 Thinking endorsed richer schema and chain-of-custody tracking. GPT-5.5 Thinking added clarification: no silent canonical state rewrites.

---

## Phase 4 — Decision Loop Refinement (Planned)

**Objective:** Structured mediator response parsing, Decision Log filtering by phase, unlock action for locked rounds.

---

## Phase 5 — Export & Production Hardening (Planned)

**Objective:** Production-grade export/import, validation, schema migration support.

---

## Phase 3.1 — Cleanup Patch (Current)

**Version:** 0.3.1

**Fixes applied:**

1. **Locked round visibility** — Added `getCurrentRound()` to `roundUtils.ts`. RoundBuilderPanel, ResponsesPanel, and MediatorPanel now use `getCurrentRound()` for read-only display when the latest round is locked. `getActiveRound()` continues to guard editable workflow logic.

2. **External font import removed** — Removed Google Fonts `@import` from `app.css`. System font stack now used: `Inter, ui-sans-serif, system-ui, -apple-system, ...`. No external network dependency at load time.

3. **Package version aligned** — `package.json` bumped to `0.3.1` to match Phase 3.1.

4. **Canonical State Editor** — Added `.canonical-state-editor` CSS class with generous `min-height` (480px desktop, 600px tall screens, 260px mobile). Project.canonicalState is the project's long-term Ground Truth ledger and must not be cramped.

5. **Vite/esbuild audit advisory** — `npm audit` may report a moderate advisory in the Vite/esbuild dev-server dependency chain. This affects the local development server only — it is not a production backend exposure. **Do not run `npm audit fix --force`** during this phase; an automatic upgrade may jump to a breaking Vite major version. This will be reviewed during Phase 9 release-candidate hardening.

---

## Phase 4 — Decision Loop Refinement (Planned)

**Objective:** Structured mediator response parsing, Decision Log filtering by phase, optional unlock action for locked rounds with warning.

---

## Phase 5 — Export & Production Hardening (Planned)

**Objective:** Production-grade export/import, validation, schema migration support.

---

## Phase 9 — Release Candidate Hardening (Planned)

**Objective:** Dependency audit resolution, performance, accessibility, final export polish.
Items deferred here: Vite/esbuild dev-server advisory resolution.

---

## Phase 4 — Mediator Packet and Decision Loop Refinement (Current)

**Version:** 0.4.0 · **Schema:** 0.4.0

**Objective:** Refine the mediator packet and decision loop into a structured, glass-box decision cockpit.

**Key changes:**

- **MediatorSynthesis type** — New nested object on Round with 12 structured fields: executiveSummary, agreements, disagreements, risks, openQuestions, modelSpecificObservations, recommendedDecision, decisionRationale, proposedCanonicalStateUpdate, proposedNextActions, proposedNextRoundPrompt, confidenceCaveats.

- **mediatorExtract.ts** — New utility. Simple `###` heading-based section extractor. Falls back gracefully to empty fields if headings not found. Nothing auto-applied.

- **mediatorPacket.ts** — Refined 12-section required output format. Explicit "user is the final decision-maker" instruction. Model response status shown. Known risks and open questions included. Missing response warning.

- **MediatorPanel** — 3-step workflow: generate packet → paste full response → extract + edit structured fields. Extraction is transparent and user-reviewed. proposedCanonicalStateUpdate labeled "Not auto-applied".

- **DecisionLogPanel** — Mediator synthesis reference section with draft-transfer buttons ("Use as draft →"). Proposed next-round prompt card with "Copy" and "Start Next Round From This Prompt →". Two-click lock confirmation. Canonical state update requires explicit checkbox + confirm.

- **Dashboard** — New "Synthesis Ready" workflow status. "Synthesis Extracted" status dot.

- **markdownExport** — Includes mediator synthesis summary, round details per locked round, proposed next-round prompt.

- **createRoundFromPrompt()** — New roundUtils helper. Creates a new round with a proposed instruction as userInstruction.

**Safety rules maintained:**
- Project.canonicalState only updated by explicit user checkbox + confirmation.
- Draft-transfer buttons only fill editable fields — do not lock or mutate state.
- No API calls, scraping, automation, or backend introduced.

```

---

### File: `package.json`

```json
{
  "name": "model-roundtable-console",
  "version": "0.4.0",
  "description": "Local-first manual copy/paste coordination cockpit for consumer AI model workflows",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "typescript": "^5.4.5",
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
```

---

### File: `src/types/round.ts`

```ts
// src/types/round.ts
// Purpose: Round type — core workflow unit in MRC
// Phase 4: added MediatorSynthesis nested object
// Owned by: this file
// Used by: AppState, all round-related components and utils

export type PromptStatus = 'generated' | 'copied';

export type ResponseStatus = 'awaiting_response' | 'pasted' | 'reviewed' | 'excluded';

export type RoundWorkflowStatus =
  | 'not_started'
  | 'prompted'
  | 'collecting_responses'
  | 'ready_for_mediator'
  | 'mediator_response_saved'
  | 'decision_recorded'
  | 'locked';

export interface GeneratedPrompt {
  id: string;
  modelProfileId: string;
  modelDisplayName: string;
  promptText: string;
  generatedAt: string;
  copiedAt?: string;
  status: PromptStatus;
}

export interface ModelResponse {
  id: string;
  modelProfileId: string;
  modelDisplayName: string;
  responseText: string;
  pastedAt?: string;
  status: ResponseStatus;
}

// MediatorSynthesis — structured fields extracted/edited from the raw mediator response.
// These are always user-reviewed. Nothing here is applied automatically.
// proposedCanonicalStateUpdate: a proposal only — applied via explicit user action in DecisionLog.
export interface MediatorSynthesis {
  executiveSummary: string;
  agreements: string;
  disagreements: string;
  risks: string;
  openQuestions: string;
  modelSpecificObservations: string;
  recommendedDecision: string;
  decisionRationale: string;
  proposedCanonicalStateUpdate: string;
  proposedNextActions: string;
  proposedNextRoundPrompt: string;
  confidenceCaveats: string;
  updatedAt: string;
}

export interface RoundProgress {
  workflowStatus: RoundWorkflowStatus;
  promptsCopied: number;
  promptsTotal: number;
  responsesCollected: number;
  responsesTotal: number;
  hasMediatorResponse: boolean;
  hasMediatorSynthesis: boolean;
  hasDecision: boolean;
  isLocked: boolean;
}

export interface Round {
  id: string;
  projectId: string;
  roundNumber: number;
  phase: string;
  userInstruction: string;
  selectedModelIds: string[];
  generatedPrompts: GeneratedPrompt[];
  modelResponses: ModelResponse[];
  mediatorPrompt: string;
  mediatorResponse: string;
  mediatorSynthesis?: MediatorSynthesis;  // structured synthesis — user-reviewed
  userDecision: string;
  canonicalStateUpdate: string; // user-approved; never auto-applied
  agreements: string[];
  disagreements: string[];
  risks: string[];
  openQuestions: string[];
  nextActions: string[];
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

```

---

### File: `src/utils/mediatorExtract.ts`

```ts
// src/utils/mediatorExtract.ts
// Purpose: Simple heading-based extraction of structured sections from a mediator response
// Owned by: this file
// Used by: MediatorPanel
//
// DESIGN PRINCIPLES:
//   - Uses only ### heading splits — no regex magic, no NLP
//   - All extracted content is placed in editable fields; user reviews before saving
//   - Falls back gracefully: if no headings found, all fields are empty strings
//   - Nothing is applied to AppState until user explicitly saves
//
// The mediator response is expected to have sections like:
//   ### Executive Summary
//   ### Agreements
//   ... etc.

import { MediatorSynthesis } from '../types/round';
import { nowIso } from './dateTime';

// Map of heading text (lower-cased, trimmed) → MediatorSynthesis key
const HEADING_MAP: Record<string, keyof Omit<MediatorSynthesis, 'updatedAt'>> = {
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

// Returns true if any meaningful content was found in the response
export function extractMediatorSections(rawResponse: string): {
  synthesis: MediatorSynthesis;
  extractedCount: number;
} {
  const synthesis = emptyMediatorSynthesis();
  let extractedCount = 0;

  if (!rawResponse.trim()) {
    return { synthesis, extractedCount: 0 };
  }

  // Split on lines that start with ### (heading level 3)
  const parts = rawResponse.split(/^###\s+/m);

  for (const part of parts) {
    const newlineIdx = part.indexOf('\n');
    if (newlineIdx === -1) continue;

    const rawHeading = part.slice(0, newlineIdx).trim();
    const content = part.slice(newlineIdx + 1).trim();

    if (!content) continue;

    const key = HEADING_MAP[rawHeading.toLowerCase()];
    if (key) {
      synthesis[key] = content;
      extractedCount++;
    }
  }

  synthesis.updatedAt = nowIso();
  return { synthesis, extractedCount };
}

// Human-readable labels for the structured fields
export const SYNTHESIS_FIELD_LABELS: Record<keyof Omit<MediatorSynthesis, 'updatedAt'>, string> = {
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
export const DECISION_TRANSFER_FIELDS: (keyof Omit<MediatorSynthesis, 'updatedAt'>)[] = [
  'recommendedDecision',
  'decisionRationale',
  'proposedCanonicalStateUpdate',
  'proposedNextActions',
  'proposedNextRoundPrompt',
];

```

---

### File: `src/utils/mediatorPacket.ts`

```ts
// src/utils/mediatorPacket.ts
// Purpose: Generates the structured mediator synthesis packet for GPT-5.5 Thinking
// Phase 4: refined 12-section required output, explicit user-is-final-decider instruction
// Owned by: this file
// Used by: MediatorPanel
//
// IMPORTANT: The mediator packet asks GPT-5.5 to PROPOSE a canonical state update.
// The app MUST NOT automatically apply it. User approval is always required.

import { Project } from '../types/project';
import { ModelProfile } from '../types/modelProfile';
import { ModelResponse, GeneratedPrompt } from '../types/round';

export interface MediatorPacketInput {
  project: Project;
  roundNumber: number;
  userInstruction: string;
  selectedModels: ModelProfile[];
  generatedPrompts: GeneratedPrompt[];
  modelResponses: ModelResponse[];
  knownRisks?: string[];
  openQuestions?: string[];
}

export function generateMediatorPacket(input: MediatorPacketInput): string {
  const {
    project,
    roundNumber,
    userInstruction,
    selectedModels,
    generatedPrompts,
    modelResponses,
    knownRisks = [],
    openQuestions = [],
  } = input;

  // Build roster summary with response status
  const rosterSummary = selectedModels
    .map((m) => {
      const response = modelResponses.find((r) => r.modelProfileId === m.id);
      const status = response?.status === 'pasted' || response?.status === 'reviewed'
        ? '✓ Response collected'
        : '✗ Response not yet collected';
      return `- **${m.displayName}** — ${m.roleName} [${status}]`;
    })
    .join('\n');

  // Build response blocks per model
  const responsesBlock = selectedModels
    .map((m) => {
      const response = modelResponses.find((r) => r.modelProfileId === m.id);
      const hasResponse = response?.status === 'pasted' || response?.status === 'reviewed';
      const pastedNote = response?.pastedAt
        ? `*Response collected: ${new Date(response.pastedAt).toLocaleString()}*`
        : '';
      const text = hasResponse && response?.responseText?.trim()
        ? response.responseText
        : '*(No response collected for this model. This model\'s lane is incomplete.)*';
      return `### ${m.displayName} — ${m.roleName}\n${pastedNote}\n\n${text}`;
    })
    .join('\n\n---\n\n');

  const collectedCount = modelResponses.filter(
    (r) => r.status === 'pasted' || r.status === 'reviewed'
  ).length;

  const completionBanner = collectedCount < selectedModels.length
    ? `\n> ⚠️ **Incomplete round:** ${collectedCount}/${selectedModels.length} model responses collected.\n> Synthesis will be based on available responses. Note incomplete lanes explicitly.\n`
    : `\n> ✓ All ${selectedModels.length} model responses collected.\n`;

  const knownRisksSection = knownRisks.length > 0
    ? `\n## Known Risks From Prior Rounds\n${knownRisks.map((r) => `- ${r}`).join('\n')}\n`
    : '';

  const openQuestionsSection = openQuestions.length > 0
    ? `\n## Open Questions From Prior Rounds\n${openQuestions.map((q) => `- ${q}`).join('\n')}\n`
    : '';

  return `# Model Roundtable Console — Mediator Synthesis Packet

---

## Project
**Name:** ${project.name}

**Description:** ${project.description}

**Current Phase:** ${project.currentPhase}

**Round:** ${roundNumber}

---

## Canonical Project State

${project.canonicalState}

---

## Round Instruction

${userInstruction}

---

## Participating Models
${rosterSummary}
${completionBanner}
---
${knownRisksSection}${openQuestionsSection}
## Model Responses

${responsesBlock}

---

## Your Role and Instructions

You are the mediator, architect, state keeper, phase planner, prompt engineer, and reviewer for this project.

**Weighting guidance:**
- Weight each model's input according to their assigned role.
- Implementation models (Opus, Sonnet) carry weight on technical feasibility.
- The independent critic (Gemini) carries weight on risks and blind spots.
- You carry weight on synthesis, coherence, and phase continuity.

**Important:**
- The user is the **final decision-maker**. Your synthesis is a recommendation, not a directive.
- Do **not** assume your proposed canonical state update will be applied automatically.
- Write the proposed canonical state update as a **user-reviewable proposal** that the user must approve.
- If model responses are missing, explicitly note the gap. Do not fabricate missing responses.

---

## Required Structured Output

Respond using **exactly** these section headings (### level). Do not skip sections.
If you have nothing to report for a section, write "(None identified this round)".

### Executive Summary
[2–4 sentences summarizing the most important findings and the key decision the user faces.]

### Agreements
[What did the models agree on? List concisely.]

### Disagreements
[What did the models disagree on? Be specific about who disagreed and why.]

### Risks
[What risks were identified by models or by you? Include risks they may have missed.]

### Open Questions
[What remains unresolved or requires the user's input before proceeding?]

### Model-Specific Observations
[Notable observations about individual model performance, lane adherence, or blind spots this round.]

### Recommended Decision
[Your recommended decision for the user's consideration. One clear recommendation.]

### Decision Rationale
[Why you recommend this decision. What evidence supports it?]

### Proposed Canonical State Update
[A proposed update to the project's canonical state, reflecting decisions made this round.
Write this as a user-reviewable proposal. The app will NOT apply this automatically.
The user must review, edit, and explicitly approve before it is added to the project state.]

### Proposed Next Actions
[Concrete next steps. Numbered list. What should happen immediately after this round?]

### Proposed Next-Round Prompt
[A ready-to-use user instruction for the next round. Write it so the user can copy it directly into the Round Builder.]

### Confidence / Caveats
[Your confidence level in this synthesis. What caveats should the user consider? What could make your recommendation wrong?]`;
}

```

---

### File: `src/utils/roundUtils.ts`

```ts
// src/utils/roundUtils.ts
// Purpose: Pure utility functions for round state transitions
// Owned by: this file
// Used by: RoundBuilderPanel, ResponsesPanel, MediatorPanel, DecisionLogPanel, App.tsx
// Safe edits: add new utility functions, extend progress logic
// Unsafe edits: do not call StorageAdapter or setState here — return new state objects only
//
// All functions are pure: they receive state slices and return new objects.
// Components are responsible for calling onUpdate() with the returned values.

import { Round, GeneratedPrompt, ModelResponse, RoundProgress, RoundWorkflowStatus, PromptStatus, ResponseStatus } from '../types/round';
import { Project } from '../types/project';
import { ModelProfile } from '../types/modelProfile';
import { CompatibilityNote } from '../types/compatibilityNote';
import { AppState } from '../types/appState';
import { generateAllPrompts } from './promptGeneration';
import { generateId } from './id';
import { nowIso } from './dateTime';

// ─── Round Creation ──────────────────────────────────────────────────────────

export function createRound(
  project: Project,
  existingRounds: Round[]
): Round {
  const maxNum = existingRounds
    .filter((r) => r.projectId === project.id)
    .reduce((max, r) => Math.max(max, r.roundNumber), 0);

  return {
    id: generateId('round'),
    projectId: project.id,
    roundNumber: maxNum + 1,
    phase: project.currentPhase,
    userInstruction: '',
    selectedModelIds: [],
    generatedPrompts: [],
    modelResponses: [],
    mediatorPrompt: '',
    mediatorResponse: '',
    userDecision: '',
    canonicalStateUpdate: '',
    agreements: [],
    disagreements: [],
    risks: [],
    openQuestions: [],
    nextActions: [],
    locked: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

// ─── Prompt Generation ───────────────────────────────────────────────────────

export function generatePromptsForRound(
  round: Round,
  project: Project,
  models: ModelProfile[],
  compatibilityNotes: CompatibilityNote[]
): Round {
  const selectedModels = models.filter((m) => round.selectedModelIds.includes(m.id));
  const results = generateAllPrompts(project, round.userInstruction, selectedModels, compatibilityNotes);

  const prompts: GeneratedPrompt[] = results.map((r) => ({
    id: generateId('prompt'),
    modelProfileId: r.modelId,
    modelDisplayName: r.modelDisplayName,
    promptText: r.promptText,
    generatedAt: nowIso(),
    copiedAt: undefined,
    status: 'generated' as PromptStatus,
  }));

  return { ...round, generatedPrompts: prompts, updatedAt: nowIso() };
}

// ─── Copy Tracking ───────────────────────────────────────────────────────────

export function markPromptCopied(round: Round, promptId: string): Round {
  const prompts = round.generatedPrompts.map((p) =>
    p.id === promptId
      ? { ...p, copiedAt: nowIso(), status: 'copied' as PromptStatus }
      : p
  );
  return { ...round, generatedPrompts: prompts, updatedAt: nowIso() };
}

// ─── Response Ingestion ──────────────────────────────────────────────────────

export function upsertModelResponse(
  round: Round,
  modelProfileId: string,
  modelDisplayName: string,
  responseText: string
): Round {
  const existing = round.modelResponses.find((r) => r.modelProfileId === modelProfileId);
  const isFirstPaste = !existing || !existing.pastedAt;

  const updated: ModelResponse = {
    id: existing?.id ?? generateId('resp'),
    modelProfileId,
    modelDisplayName,
    responseText,
    pastedAt: isFirstPaste && responseText.trim() ? nowIso() : (existing?.pastedAt),
    status: responseText.trim()
      ? ('pasted' as ResponseStatus)
      : ('awaiting_response' as ResponseStatus),
  };

  const responses = existing
    ? round.modelResponses.map((r) => (r.modelProfileId === modelProfileId ? updated : r))
    : [...round.modelResponses, updated];

  return { ...round, modelResponses: responses, updatedAt: nowIso() };
}

// ─── Decision Recording ──────────────────────────────────────────────────────

export function recordDecisionForRound(
  round: Round,
  decisionText: string,
  canonicalStateUpdate: string
): Round {
  return {
    ...round,
    userDecision: decisionText,
    canonicalStateUpdate,
    locked: true,
    updatedAt: nowIso(),
  };
}

// ─── Canonical State Update ──────────────────────────────────────────────────

export function applyCanonicalStateUpdate(
  project: Project,
  canonicalStateUpdate: string,
  roundNumber: number
): Project {
  const timestamp = new Date().toISOString().slice(0, 10);
  const appendBlock = `\n\n## Round ${roundNumber} Canonical State Update — ${timestamp}\n${canonicalStateUpdate}`;
  return {
    ...project,
    canonicalState: project.canonicalState + appendBlock,
    updatedAt: nowIso(),
  };
}

// ─── Progress Calculation ────────────────────────────────────────────────────

export function getRoundProgress(round: Round): RoundProgress {
  const promptsTotal = round.generatedPrompts.length;
  const promptsCopied = round.generatedPrompts.filter((p) => p.status === 'copied').length;
  const responsesTotal = round.selectedModelIds.length;
  const responsesCollected = round.modelResponses.filter(
    (r) => r.status === 'pasted' || r.status === 'reviewed'
  ).length;
  const hasMediatorResponse = round.mediatorResponse.trim().length > 0;
  const hasMediatorSynthesis = !!(round.mediatorSynthesis && (
    round.mediatorSynthesis.recommendedDecision.trim() ||
    round.mediatorSynthesis.executiveSummary.trim()
  ));
  const hasDecision = round.userDecision.trim().length > 0;
  const isLocked = round.locked;

  let workflowStatus: RoundWorkflowStatus = 'not_started';
  if (isLocked) {
    workflowStatus = 'locked';
  } else if (hasDecision) {
    workflowStatus = 'decision_recorded';
  } else if (hasMediatorSynthesis) {
    workflowStatus = 'mediator_response_saved';
  } else if (hasMediatorResponse) {
    workflowStatus = 'ready_for_mediator';
  } else if (responsesCollected > 0) {
    workflowStatus = 'collecting_responses';
  } else if (promptsTotal > 0) {
    workflowStatus = 'prompted';
  }

  return {
    workflowStatus,
    promptsCopied,
    promptsTotal,
    responsesCollected,
    responsesTotal,
    hasMediatorResponse,
    hasMediatorSynthesis,
    hasDecision,
    isLocked,
  };
}

export function isRoundMediatorReady(round: Round): boolean {
  return round.modelResponses.some(
    (r) => r.status === 'pasted' || r.status === 'reviewed'
  );
}

// ─── Active Round Selector ───────────────────────────────────────────────────

export function getActiveRound(state: AppState): Round | null {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  if (!project) return null;
  return (
    state.rounds
      .filter((r) => r.projectId === project.id && !r.locked)
      .sort((a, b) => b.roundNumber - a.roundNumber)[0] ?? null
  );
}

export function getLatestRound(state: AppState): Round | null {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  if (!project) return null;
  return (
    state.rounds
      .filter((r) => r.projectId === project.id)
      .sort((a, b) => b.roundNumber - a.roundNumber)[0] ?? null
  );
}

export function replaceRound(state: AppState, updated: Round): Partial<AppState> {
  return {
    rounds: state.rounds.map((r) => (r.id === updated.id ? updated : r)),
  };
}
// ─── getCurrentRound ─────────────────────────────────────────────────────────
// Returns the latest round regardless of locked status.
// Use for read-only display in workflow panels when getActiveRound() returns null
// (i.e. the latest round is locked and no new round has been started yet).

export function getCurrentRound(state: AppState): Round | null {
  // Prefer the active (unlocked) round if one exists
  const active = getActiveRound(state);
  if (active) return active;
  // Fall back to the latest round even if locked
  return getLatestRound(state);
}

// ─── MediatorSynthesis Helpers ────────────────────────────────────────────────

import { MediatorSynthesis } from '../types/round';

export function saveMediatorSynthesis(round: Round, synthesis: MediatorSynthesis): Round {
  return {
    ...round,
    mediatorSynthesis: { ...synthesis, updatedAt: nowIso() },
    updatedAt: nowIso(),
  };
}

// ─── Next-Round Creation From Prompt ─────────────────────────────────────────

export function createRoundFromPrompt(
  project: Project,
  existingRounds: Round[],
  proposedInstruction: string
): Round {
  const base = createRound(project, existingRounds);
  return { ...base, userInstruction: proposedInstruction };
}

```

---

### File: `src/utils/markdownExport.ts`

```ts
// src/utils/markdownExport.ts
// Purpose: Readable Markdown export — Phase 4: includes mediator synthesis fields
// Owned by: this file
// Used by: ExportImportPanel

import { AppState } from '../types/appState';
import { Project } from '../types/project';
import { Decision } from '../types/decision';
import { Round } from '../types/round';
import { nowIso, formatDisplay } from './dateTime';

function synthSection(round: Round): string {
  const s = round.mediatorSynthesis;
  if (!s) return '';
  const parts: string[] = [];
  if (s.executiveSummary) parts.push(`**Executive Summary:**\n${s.executiveSummary}`);
  if (s.recommendedDecision) parts.push(`**Recommended Decision:**\n${s.recommendedDecision}`);
  if (s.proposedCanonicalStateUpdate) parts.push(`**Proposed Canonical State Update:**\n${s.proposedCanonicalStateUpdate}`);
  if (s.proposedNextRoundPrompt) parts.push(`**Proposed Next-Round Prompt:**\n${s.proposedNextRoundPrompt}`);
  if (s.confidenceCaveats) parts.push(`**Caveats:**\n${s.confidenceCaveats}`);
  return parts.length > 0 ? `\n### Mediator Synthesis\n\n${parts.join('\n\n')}\n` : '';
}

export function exportProjectMarkdown(state: AppState): string {
  const project: Project | undefined = state.projects.find(
    (p) => p.id === state.activeProjectId
  );

  if (!project) {
    return `# Model Roundtable Console Export\n\nNo active project found.\n\nExported: ${formatDisplay(nowIso())}`;
  }

  const decisions: Decision[] = state.decisions.filter((d) => d.projectId === project.id);
  const rounds: Round[] = state.rounds
    .filter((r) => r.projectId === project.id)
    .sort((a, b) => a.roundNumber - b.roundNumber);
  const latestRound = rounds[rounds.length - 1];

  const openQuestions = latestRound?.openQuestions ?? [];
  const risks = latestRound?.risks ?? [];
  const nextActions = latestRound?.nextActions ?? [];
  const proposedNextPrompt = latestRound?.mediatorSynthesis?.proposedNextRoundPrompt ?? '';

  const decisionSection =
    decisions.length > 0
      ? decisions
          .map((d) => {
            const r = rounds.find((rr) => rr.id === d.roundId);
            return `### Round ${r?.roundNumber ?? '?'} — ${formatDisplay(d.createdAt)}\n**Decision:** ${d.decisionText}\n\n**Rationale:** ${d.rationale}${d.nextAction ? `\n\n**Next Action:** ${d.nextAction}` : ''}`;
          })
          .join('\n\n')
      : '_No decisions recorded yet._';

  const roundSummary = rounds.length > 0
    ? rounds.map((r) => {
        const copiedCount = r.generatedPrompts.filter((p) => p.status === 'copied').length;
        const responseCount = r.modelResponses.filter((mr) => mr.status === 'pasted' || mr.status === 'reviewed').length;
        const hasSynth = r.mediatorSynthesis ? '✓' : '–';
        return `| ${r.roundNumber} | ${r.phase} | ${copiedCount}/${r.generatedPrompts.length} | ${responseCount}/${r.selectedModelIds.length} | ${hasSynth} | ${r.locked ? '🔒 Locked' : '✏️ Active'} |`;
      }).join('\n')
    : '_No rounds._';

  const roundDetails = rounds
    .filter((r) => r.locked)
    .map((r) => {
      const decision = decisions.find((d) => d.roundId === r.id);
      return `## Round ${r.roundNumber} — ${r.phase}

**Instruction:** ${r.userInstruction}

**Decision:** ${decision?.decisionText ?? '_Not recorded_'}

**Rationale:** ${decision?.rationale ?? ''}
${synthSection(r)}${r.canonicalStateUpdate ? `\n**Canonical State Update Applied:**\n${r.canonicalStateUpdate}\n` : ''}`;
    }).join('\n---\n\n');

  return `# ${project.name}

**Phase:** ${project.currentPhase}

**Exported:** ${formatDisplay(nowIso())}

**Schema Version:** ${state.schemaVersion}

---

## Description

${project.description}

---

## Canonical State

${project.canonicalState}

---

## Round Summary

| # | Phase | Prompts | Responses | Synthesis | Status |
|---|---|---|---|---|---|
${roundSummary}

---

## Completed Rounds

${roundDetails || '_No locked rounds yet._'}

---

## Latest Decisions

${decisionSection}

---

## Open Questions

${openQuestions.length > 0 ? openQuestions.map((q) => `- ${q}`).join('\n') : '_None._'}

---

## Risks

${risks.length > 0 ? risks.map((r) => `- ${r}`).join('\n') : '_None._'}

---

## Next Actions

${nextActions.length > 0 ? nextActions.map((a) => `- ${a}`).join('\n') : '_None._'}

${proposedNextPrompt ? `---\n\n## Proposed Next-Round Prompt\n\n${proposedNextPrompt}\n` : ''}
---

_Exported from Model Roundtable Console v${state.schemaVersion}. Data is local to this browser._
`;
}

```

---

### File: `src/components/MediatorPanel.tsx`

```tsx
// src/components/MediatorPanel.tsx
// Purpose: Generate mediator packet → copy → paste response → extract/edit structured synthesis
// Phase 4: structured MediatorSynthesis fields, heading-based extraction, user-review workflow
//
// WORKFLOW (4 steps):
//   1. Generate mediator packet (uses pasted model responses)
//   2. Copy packet → paste into GPT-5.5 Thinking externally
//   3. Paste full mediator response back here
//   4. Extract structured fields → review/edit → save synthesis
//
// SAFETY: Nothing in this panel automatically updates Project.canonicalState.
//         proposedCanonicalStateUpdate is a text field the user reads and transfers manually.

import { useState, useEffect } from 'react';
import { AppState } from '../types/appState';
import { MediatorSynthesis } from '../types/round';
import { generateMediatorPacket } from '../utils/mediatorPacket';
import { extractMediatorSections, emptyMediatorSynthesis, SYNTHESIS_FIELD_LABELS } from '../utils/mediatorExtract';
import {
  getActiveRound,
  getCurrentRound,
  getRoundProgress,
  isRoundMediatorReady,
  saveMediatorSynthesis,
  replaceRound,
} from '../utils/roundUtils';
import { copyToClipboard } from '../utils/clipboard';
import { nowIso, formatDisplay } from '../utils/dateTime';

interface Props {
  state: AppState;
  onUpdate: (updated: Partial<AppState>) => void;
  onNavigate: (tab: string) => void;
}

// Fields that are taller (multi-paragraph content)
const TALL_FIELDS: (keyof Omit<MediatorSynthesis, 'updatedAt'>)[] = [
  'executiveSummary', 'agreements', 'disagreements', 'risks', 'openQuestions',
  'modelSpecificObservations', 'proposedCanonicalStateUpdate', 'proposedNextActions',
];

export default function MediatorPanel({ state, onUpdate, onNavigate }: Props) {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const activeRound = getActiveRound(state);
  const currentRound = getCurrentRound(state);

  const [generatedPacket, setGeneratedPacket] = useState('');
  const [packetCopied, setPacketCopied] = useState(false);
  const [packetCopyFailed, setPacketCopyFailed] = useState(false);
  const [localMediatorResponse, setLocalMediatorResponse] = useState('');
  const [responseSaved, setResponseSaved] = useState(false);
  const [synthesis, setSynthesis] = useState<MediatorSynthesis>(emptyMediatorSynthesis());
  const [synthesisSaved, setSynthesisSaved] = useState(false);
  const [extractedCount, setExtractedCount] = useState<number | null>(null);

  useEffect(() => {
    const round = activeRound ?? currentRound;
    if (round) {
      setLocalMediatorResponse(round.mediatorResponse ?? '');
      if (round.mediatorPrompt) setGeneratedPacket(round.mediatorPrompt);
      if (round.mediatorSynthesis) setSynthesis(round.mediatorSynthesis);
      else setSynthesis(emptyMediatorSynthesis());
    }
  }, [activeRound?.id, currentRound?.id]);

  // ── Locked / no-round guards ────────────────────────────────────────────────

  if (!project || (!activeRound && !currentRound)) {
    return (
      <div className="panel">
        <div className="panel-header"><h1 className="panel-title">Mediator Summary</h1></div>
        <div className="empty-state">No rounds yet. Build a round and paste responses first.</div>
      </div>
    );
  }

  if (!activeRound && currentRound?.locked) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="flex-between">
            <h1 className="panel-title">Mediator Summary</h1>
            <span className="locked-badge locked">🔒 Round {currentRound.roundNumber} Locked</span>
          </div>
        </div>
        <div className="notice mb-16">
          Round {currentRound.roundNumber} is locked — read-only. Use Round Builder to start a new round.
        </div>
        <LockedMediatorView round={currentRound} />
      </div>
    );
  }

  // ── Active round handlers ───────────────────────────────────────────────────

  const round = activeRound!;
  const progress = getRoundProgress(round);
  const mediatorReady = isRoundMediatorReady(round);

  const handleGenerate = () => {
    if (!project) return;
    const selectedModels = state.modelProfiles.filter((m) => round.selectedModelIds.includes(m.id));
    const latestDecisions = state.decisions.filter((d) => d.projectId === project.id);
    const recentRisks = round.risks;
    const recentOpenQ = round.openQuestions;

    const packet = generateMediatorPacket({
      project,
      roundNumber: round.roundNumber,
      userInstruction: round.userInstruction,
      selectedModels,
      generatedPrompts: round.generatedPrompts,
      modelResponses: round.modelResponses,
      knownRisks: recentRisks,
      openQuestions: recentOpenQ,
    });
    setGeneratedPacket(packet);
    onUpdate(replaceRound(state, { ...round, mediatorPrompt: packet, updatedAt: nowIso() }));
  };

  const handleCopyPacket = async () => {
    setPacketCopyFailed(false);
    const ok = await copyToClipboard(generatedPacket);
    if (ok) { setPacketCopied(true); setTimeout(() => setPacketCopied(false), 2500); }
    else setPacketCopyFailed(true);
  };

  const handleSaveResponse = () => {
    const updated = { ...round, mediatorResponse: localMediatorResponse, updatedAt: nowIso() };
    onUpdate(replaceRound(state, updated));
    setResponseSaved(true);
    setTimeout(() => setResponseSaved(false), 2000);
  };

  const handleExtract = () => {
    const { synthesis: extracted, extractedCount: count } = extractMediatorSections(localMediatorResponse);
    setSynthesis(extracted);
    setExtractedCount(count);
  };

  const handleSaveSynthesis = () => {
    const updated = saveMediatorSynthesis(round, synthesis);
    onUpdate(replaceRound(state, updated));
    setSynthesisSaved(true);
    setTimeout(() => setSynthesisSaved(false), 2000);
  };

  const handleSynthesisField = (key: keyof Omit<MediatorSynthesis, 'updatedAt'>, value: string) => {
    setSynthesis((prev) => ({ ...prev, [key]: value }));
  };

  const hasMediatorResponse = localMediatorResponse.trim().length > 0;
  const synthesisFilled = synthesis.recommendedDecision.trim().length > 0 || synthesis.executiveSummary.trim().length > 0;

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex-between">
          <div>
            <h1 className="panel-title">Mediator Summary</h1>
            <p className="panel-desc">Generate packet → copy to GPT-5.5 → paste response → extract structured fields → review → proceed to Decision Log</p>
          </div>
          <span className={`locked-badge ${round.locked ? 'locked' : 'unlocked'}`}>
            ✏️ Round {round.roundNumber}
          </span>
        </div>
      </div>

      {/* Step 1 + 2: Generate + copy packet */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Step 1 — Generate &amp; Copy Mediator Packet</span>
          {progress.hasMediatorResponse && <span className="badge badge-green">✓ Response saved</span>}
        </div>

        {!mediatorReady && (
          <div className="notice danger mb-12">
            No model responses collected yet. Paste responses in the Responses tab first.
          </div>
        )}
        {mediatorReady && progress.responsesCollected < progress.responsesTotal && (
          <div className="notice mb-12">
            <strong>{progress.responsesCollected}/{progress.responsesTotal} responses collected.</strong> Packet will note missing responses.
          </div>
        )}

        <div className="flex gap-8 mb-12">
          <button className="btn btn-primary" onClick={handleGenerate} disabled={!mediatorReady}>
            {generatedPacket ? 'Regenerate Packet' : 'Generate Mediator Packet'}
          </button>
          {generatedPacket && (
            <button className={`btn ${packetCopied ? 'btn-secondary' : 'btn-secondary'}`} onClick={handleCopyPacket}>
              {packetCopied ? '✓ Copied!' : 'Copy → GPT-5.5 Thinking'}
            </button>
          )}
        </div>

        {packetCopyFailed && (
          <div className="notice danger mb-8 text-xs">Clipboard failed. Select all text below and copy manually.</div>
        )}

        {generatedPacket && (
          <details>
            <summary className="text-xs text-muted" style={{ cursor: 'pointer', listStyle: 'none' }}>
              ▶ View generated packet ({generatedPacket.length.toLocaleString()} chars)
            </summary>
            <div className="prompt-box mediator mt-8" style={{ maxHeight: 320 }}>{generatedPacket}</div>
          </details>
        )}
      </div>

      {/* Step 3: Paste mediator response */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Step 2 — Paste Mediator Response</span>
          {responseSaved && <span className="badge badge-green">✓ Saved</span>}
        </div>
        <p className="text-xs text-muted mb-10">
          After GPT-5.5 Thinking responds, paste the full response here. Then click Extract to populate structured fields.
        </p>
        <textarea
          className="form-textarea xlarge"
          placeholder="Paste GPT-5.5 Thinking's full response here…"
          value={localMediatorResponse}
          onChange={(e) => setLocalMediatorResponse(e.target.value)}
          onBlur={handleSaveResponse}
        />
        <div className="flex gap-8 mt-8">
          <button
            className="btn btn-primary"
            onClick={() => { handleSaveResponse(); handleExtract(); }}
            disabled={!hasMediatorResponse}
          >
            Save &amp; Extract Structured Fields
          </button>
          <button className="btn btn-secondary" onClick={handleSaveResponse} disabled={!hasMediatorResponse}>
            {responseSaved ? '✓ Saved' : 'Save Response'}
          </button>
        </div>
        {extractedCount !== null && (
          <div className={`notice mt-8 ${extractedCount > 0 ? 'info' : 'danger'} text-xs`}>
            {extractedCount > 0
              ? `Extracted ${extractedCount} sections from the response. Review and edit the fields below, then save.`
              : 'No ### headings found — all fields left blank for manual entry. Fill them in below and save.'}
          </div>
        )}
      </div>

      {/* Step 4: Structured synthesis fields */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Step 3 — Review &amp; Edit Structured Synthesis</span>
          <div className="flex gap-8">
            {round.mediatorSynthesis?.updatedAt && (
              <span className="text-xs text-muted">Saved {formatDisplay(round.mediatorSynthesis.updatedAt)}</span>
            )}
            {synthesisSaved && <span className="badge badge-green">✓ Saved</span>}
          </div>
        </div>

        <div className="notice mb-12 info text-xs">
          These fields are user-editable. Nothing here is applied automatically.
          <strong> Proposed Canonical State Update</strong> requires explicit approval in Decision Log.
        </div>

        {(Object.keys(SYNTHESIS_FIELD_LABELS) as (keyof Omit<MediatorSynthesis, 'updatedAt'>)[]).map((key) => {
          const isTall = TALL_FIELDS.includes(key);
          const isCanonicalUpdate = key === 'proposedCanonicalStateUpdate';
          return (
            <div className="form-group" key={key}>
              <label className="form-label" style={{ color: isCanonicalUpdate ? 'var(--amber)' : undefined }}>
                {SYNTHESIS_FIELD_LABELS[key]}
                {isCanonicalUpdate && ' ⚠ Not auto-applied'}
              </label>
              <textarea
                className="form-textarea"
                style={{ minHeight: isTall ? 120 : 72 }}
                value={synthesis[key]}
                onChange={(e) => handleSynthesisField(key, e.target.value)}
                placeholder={`(${SYNTHESIS_FIELD_LABELS[key]})`}
              />
            </div>
          );
        })}

        <button className="btn btn-primary" onClick={handleSaveSynthesis} disabled={!synthesisFilled} style={{ width: '100%' }}>
          {synthesisSaved ? '✓ Synthesis Saved' : 'Save Structured Synthesis'}
        </button>
      </div>

      {/* Navigate to Decision Log */}
      {synthesisFilled && (
        <button className="btn btn-primary" onClick={() => onNavigate('decisions')} style={{ width: '100%' }}>
          Synthesis saved → Record Decision →
        </button>
      )}
    </div>
  );
}

// Read-only view for locked rounds
function LockedMediatorView({ round }: { round: NonNullable<ReturnType<typeof getCurrentRound>> }) {
  const synthesis = round.mediatorSynthesis;
  return (
    <>
      {round.mediatorResponse && (
        <div className="card mb-16">
          <div className="card-title mb-8">Full Mediator Response</div>
          <div className="prompt-box mediator" style={{ maxHeight: 300 }}>{round.mediatorResponse}</div>
        </div>
      )}
      {synthesis && (
        <div className="card">
          <div className="card-title mb-12">Structured Synthesis (Read-Only)</div>
          {(Object.keys(SYNTHESIS_FIELD_LABELS) as (keyof Omit<MediatorSynthesis, 'updatedAt'>)[]).map((key) => {
            const val = synthesis[key];
            if (!val) return null;
            return (
              <div key={key} className="mb-16">
                <div className="section-heading">{SYNTHESIS_FIELD_LABELS[key]}</div>
                <div className="prompt-box" style={{ whiteSpace: 'pre-wrap', maxHeight: 200 }}>{val}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

```

---

### File: `src/components/DecisionLogPanel.tsx`

```tsx
// src/components/DecisionLogPanel.tsx
// Purpose: Record decisions, transfer mediator recommendations as drafts, lock round
// Phase 4: draft-transfer buttons, next-round prompt support, "Start next round" action
//
// SAFETY RULES:
//   - "Use as draft" buttons only fill editable fields. They do NOT lock the round.
//   - Canonical state is ONLY updated when the user checks "Apply" and confirms.
//   - Lock happens only on the final explicit action.

import { useState, useEffect } from 'react';
import { AppState } from '../types/appState';
import { Decision } from '../types/decision';
import {
  getActiveRound,
  getCurrentRound,
  recordDecisionForRound,
  applyCanonicalStateUpdate,
  createRoundFromPrompt,
  replaceRound,
} from '../utils/roundUtils';
import { copyToClipboard } from '../utils/clipboard';
import { generateId } from '../utils/id';
import { nowIso, formatDisplay } from '../utils/dateTime';

interface Props {
  state: AppState;
  onUpdate: (updated: Partial<AppState>) => void;
  onNavigate: (tab: string) => void;
}

export default function DecisionLogPanel({ state, onUpdate, onNavigate }: Props) {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const activeRound = getActiveRound(state);
  const currentRound = getCurrentRound(state);
  const decisions = state.decisions.filter((d) => d.projectId === project?.id);

  // Decision form state
  const [decisionText, setDecisionText] = useState('');
  const [rationale, setRationale] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [canonicalUpdate, setCanonicalUpdate] = useState('');
  const [applyToState, setApplyToState] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [justLocked, setJustLocked] = useState(false);
  const [nextRoundPromptCopied, setNextRoundPromptCopied] = useState(false);

  const synthesis = activeRound?.mediatorSynthesis ?? currentRound?.mediatorSynthesis;

  // Populate canonical update from existing round if set
  useEffect(() => {
    if (activeRound?.canonicalStateUpdate) setCanonicalUpdate(activeRound.canonicalStateUpdate);
  }, [activeRound?.id]);

  // ── Draft transfer helpers ──────────────────────────────────────────────────

  const useDraftDecision = () => {
    if (synthesis?.recommendedDecision) setDecisionText(synthesis.recommendedDecision);
    if (synthesis?.decisionRationale) setRationale(synthesis.decisionRationale);
    setConfirmLock(false);
  };

  const useDraftCanonicalUpdate = () => {
    if (synthesis?.proposedCanonicalStateUpdate) {
      setCanonicalUpdate(synthesis.proposedCanonicalStateUpdate);
      setApplyToState(false); // user must check the box themselves
    }
    setConfirmLock(false);
  };

  // ── Next-round prompt ───────────────────────────────────────────────────────

  const proposedNextPrompt = synthesis?.proposedNextRoundPrompt ?? '';

  const handleCopyNextPrompt = async () => {
    const ok = await copyToClipboard(proposedNextPrompt);
    if (ok) { setNextRoundPromptCopied(true); setTimeout(() => setNextRoundPromptCopied(false), 2000); }
  };

  const handleStartNextRound = () => {
    if (!project || !proposedNextPrompt.trim()) return;
    const newRound = createRoundFromPrompt(project, state.rounds, proposedNextPrompt);
    onUpdate({ rounds: [...state.rounds, newRound] });
    onNavigate('round-builder');
  };

  // ── Record decision ─────────────────────────────────────────────────────────

  const handleRecord = () => {
    if (!project || !activeRound || !decisionText.trim()) return;
    if (!confirmLock) { setConfirmLock(true); return; }

    const decision: Decision = {
      id: generateId('dec'),
      projectId: project.id,
      roundId: activeRound.id,
      decisionText,
      rationale,
      createdAt: nowIso(),
      phase: project.currentPhase,
      nextAction: nextAction || undefined,
    };

    const lockedRound = recordDecisionForRound(activeRound, decisionText, canonicalUpdate);

    let updatedProjects = state.projects;
    if (applyToState && canonicalUpdate.trim()) {
      const updatedProject = applyCanonicalStateUpdate(project, canonicalUpdate, activeRound.roundNumber);
      updatedProjects = state.projects.map((p) => (p.id === project.id ? updatedProject : p));
    }

    onUpdate({
      decisions: [...state.decisions, decision],
      rounds: state.rounds.map((r) => (r.id === lockedRound.id ? lockedRound : r)),
      projects: updatedProjects,
    });

    setDecisionText(''); setRationale(''); setNextAction('');
    setCanonicalUpdate(''); setApplyToState(false);
    setConfirmLock(false);
    setJustLocked(true);
    setTimeout(() => setJustLocked(false), 4000);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="panel-title">Decision Log</h1>
        <p className="panel-desc">
          Review mediator synthesis → transfer drafts → record decision → optionally apply canonical state update → lock round.
        </p>
      </div>

      {/* ── Active round decision form ───────────────────────────────────────── */}
      {activeRound && !activeRound.locked && (
        <div className="card mb-24">
          <div className="card-header">
            <span className="card-title">Record Decision — Round {activeRound.roundNumber}</span>
            <span className="locked-badge unlocked">✏️ Active</span>
          </div>

          {/* Mediator synthesis reference */}
          {synthesis && (
            <MediatorReference
              synthesis={synthesis}
              onUseDraftDecision={useDraftDecision}
              onUseDraftCanonical={useDraftCanonicalUpdate}
              onCopyNextPrompt={handleCopyNextPrompt}
              onStartNextRound={handleStartNextRound}
              nextRoundPromptCopied={nextRoundPromptCopied}
            />
          )}

          {!synthesis && (
            <div className="notice mb-16 info text-xs">
              No mediator synthesis yet. Go to Mediator tab to paste and extract the mediator response first.
            </div>
          )}

          <hr className="divider" />

          {/* Decision fields */}
          <div className="form-group">
            <div className="flex-between mb-6">
              <label className="form-label" style={{ marginBottom: 0 }}>Your Decision *</label>
              {synthesis?.recommendedDecision && (
                <button className="btn btn-ghost text-xs" onClick={useDraftDecision} style={{ padding: '2px 8px' }}>
                  Use mediator recommendation as draft
                </button>
              )}
            </div>
            <textarea
              className="form-textarea"
              placeholder="What did you decide?"
              value={decisionText}
              onChange={(e) => { setDecisionText(e.target.value); setConfirmLock(false); }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Rationale</label>
            <textarea
              className="form-textarea"
              placeholder="Why did you make this decision?"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Next Action</label>
            <input
              className="form-input"
              placeholder="Most important next step"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
          </div>

          <hr className="divider" />

          {/* Canonical state update */}
          <div className="form-group">
            <div className="flex-between mb-6">
              <label className="form-label" style={{ color: 'var(--amber)', marginBottom: 0 }}>
                Canonical State Update to Apply
              </label>
              {synthesis?.proposedCanonicalStateUpdate && (
                <button className="btn btn-ghost text-xs" onClick={useDraftCanonicalUpdate} style={{ padding: '2px 8px' }}>
                  Use proposed canonical update as draft
                </button>
              )}
            </div>
            <p className="text-xs text-muted mb-8">
              Review and edit the mediator's proposal. Will only be applied if you check the box below.
            </p>
            <textarea
              className="form-textarea canonical-state-editor"
              style={{ minHeight: 180 }}
              placeholder="Paste or write the canonical state update for this round…"
              value={canonicalUpdate}
              onChange={(e) => { setCanonicalUpdate(e.target.value); setConfirmLock(false); }}
            />
          </div>

          {canonicalUpdate.trim() && (
            <label className="flex-center gap-12 mb-16" style={{ cursor: 'pointer', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                checked={applyToState}
                onChange={(e) => { setApplyToState(e.target.checked); setConfirmLock(false); }}
                style={{ accentColor: 'var(--amber)', width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Apply to Project Canonical State</div>
                <div className="text-xs text-muted">
                  Appends a dated "Round {activeRound.roundNumber} Canonical State Update" section. Original state is preserved.
                </div>
              </div>
            </label>
          )}

          {confirmLock && (
            <div className="notice danger mb-12">
              <strong>Confirm lock:</strong> Recording this decision will lock Round {activeRound.roundNumber}.
              {applyToState && canonicalUpdate.trim() && ' Canonical state update will be appended to the project state.'}
              {' '}This cannot be undone without manual edits.
            </div>
          )}

          <div className="flex gap-8">
            <button
              className="btn btn-primary"
              onClick={handleRecord}
              disabled={!decisionText.trim()}
              style={{ flex: 1 }}
            >
              {justLocked
                ? '✓ Decision Recorded — Round Locked'
                : confirmLock
                ? '⚠ Confirm — Lock Round & Record Decision'
                : applyToState && canonicalUpdate.trim()
                ? 'Apply Canonical Update + Lock Round'
                : 'Record Decision & Lock Round'}
            </button>
            {confirmLock && (
              <button className="btn btn-secondary" onClick={() => setConfirmLock(false)}>Cancel</button>
            )}
          </div>
        </div>
      )}

      {/* Locked round notice + proposed next-round prompt */}
      {currentRound?.locked && !activeRound && (
        <div className="card mb-24">
          <div className="card-header">
            <span className="card-title">Round {currentRound.roundNumber} — Locked</span>
            <span className="locked-badge locked">🔒</span>
          </div>
          {currentRound.userDecision && (
            <div className="mb-12">
              <div className="section-heading">Decision Recorded</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{currentRound.userDecision}</div>
            </div>
          )}
          {currentRound.mediatorSynthesis?.proposedNextRoundPrompt && (
            <NextRoundPromptCard
              prompt={currentRound.mediatorSynthesis.proposedNextRoundPrompt}
              onCopy={handleCopyNextPrompt}
              onStart={handleStartNextRound}
              copied={nextRoundPromptCopied}
            />
          )}
        </div>
      )}

      {/* Decision history */}
      <div className="flex-between mb-12">
        <div className="section-heading" style={{ marginBottom: 0 }}>Decision History</div>
        <span className="badge badge-muted">{decisions.length} decisions</span>
      </div>

      {decisions.length === 0 ? (
        <div className="empty-state">No decisions recorded yet.</div>
      ) : (
        [...decisions].reverse().map((d: Decision) => {
          const round = state.rounds.find((r) => r.id === d.roundId);
          return (
            <div className="decision-entry" key={d.id}>
              <div className="flex-between mb-8">
                <div className="flex gap-8 flex-center">
                  <span className="badge badge-amber">{d.phase ?? 'Unknown Phase'}</span>
                  {round && <span className="badge badge-muted">Round {round.roundNumber}</span>}
                </div>
                <span className="text-xs text-muted">{formatDisplay(d.createdAt)}</span>
              </div>
              <div className="decision-text">{d.decisionText}</div>
              {d.rationale && <div className="decision-rationale">{d.rationale}</div>}
              {d.nextAction && (
                <div className="flex-center gap-8 mt-6">
                  <span className="text-xs text-muted">Next action:</span>
                  <span className="text-xs text-amber">{d.nextAction}</span>
                </div>
              )}
              {round?.canonicalStateUpdate && (
                <details className="mt-8">
                  <summary className="text-xs text-muted" style={{ cursor: 'pointer', listStyle: 'none' }}>
                    ▶ Canonical state update for this round
                  </summary>
                  <div className="prompt-box mt-6 text-xs">{round.canonicalStateUpdate}</div>
                </details>
              )}
              {round?.mediatorSynthesis?.proposedNextRoundPrompt && (
                <details className="mt-6">
                  <summary className="text-xs text-muted" style={{ cursor: 'pointer', listStyle: 'none' }}>
                    ▶ Proposed next-round prompt
                  </summary>
                  <div className="prompt-box mt-6 text-xs">{round.mediatorSynthesis.proposedNextRoundPrompt}</div>
                </details>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

import { MediatorSynthesis } from '../types/round';
import { SYNTHESIS_FIELD_LABELS } from '../utils/mediatorExtract';

function MediatorReference({
  synthesis,
  onUseDraftDecision,
  onUseDraftCanonical,
  onCopyNextPrompt,
  onStartNextRound,
  nextRoundPromptCopied,
}: {
  synthesis: MediatorSynthesis;
  onUseDraftDecision: () => void;
  onUseDraftCanonical: () => void;
  onCopyNextPrompt: () => void;
  onStartNextRound: () => void;
  nextRoundPromptCopied: boolean;
}) {
  return (
    <details className="mb-16" open>
      <summary className="card-title" style={{ cursor: 'pointer', listStyle: 'none', marginBottom: 12 }}>
        ▼ Mediator Synthesis Reference
      </summary>
      <div style={{ paddingLeft: 8 }}>
        <div className="notice mb-12 info text-xs">
          These are the mediator's proposals. Use the buttons to load them as editable drafts. Nothing below is applied automatically.
        </div>

        {/* Executive summary */}
        {synthesis.executiveSummary && (
          <RefField label="Executive Summary" value={synthesis.executiveSummary} />
        )}

        {/* Recommended decision + transfer button */}
        {synthesis.recommendedDecision && (
          <div className="mb-12">
            <div className="flex-between mb-4">
              <span className="section-heading" style={{ marginBottom: 0 }}>Recommended Decision</span>
              <button className="btn btn-ghost text-xs" onClick={onUseDraftDecision} style={{ padding: '2px 10px' }}>
                Use as draft →
              </button>
            </div>
            <div className="prompt-box" style={{ maxHeight: 120, whiteSpace: 'pre-wrap' }}>{synthesis.recommendedDecision}</div>
            {synthesis.decisionRationale && (
              <div className="prompt-box mt-6 text-xs" style={{ maxHeight: 100 }}>{synthesis.decisionRationale}</div>
            )}
          </div>
        )}

        {/* Proposed canonical update + transfer button */}
        {synthesis.proposedCanonicalStateUpdate && (
          <div className="mb-12">
            <div className="flex-between mb-4">
              <span className="section-heading" style={{ marginBottom: 0, color: 'var(--amber)' }}>
                Proposed Canonical State Update ⚠ Not auto-applied
              </span>
              <button className="btn btn-ghost text-xs" onClick={onUseDraftCanonical} style={{ padding: '2px 10px' }}>
                Use as draft →
              </button>
            </div>
            <div className="prompt-box" style={{ maxHeight: 160, whiteSpace: 'pre-wrap' }}>{synthesis.proposedCanonicalStateUpdate}</div>
          </div>
        )}

        {/* Proposed next actions */}
        {synthesis.proposedNextActions && (
          <RefField label="Proposed Next Actions" value={synthesis.proposedNextActions} />
        )}

        {/* Next-round prompt */}
        {synthesis.proposedNextRoundPrompt && (
          <NextRoundPromptCard
            prompt={synthesis.proposedNextRoundPrompt}
            onCopy={onCopyNextPrompt}
            onStart={onStartNextRound}
            copied={nextRoundPromptCopied}
          />
        )}

        {/* Caveats */}
        {synthesis.confidenceCaveats && (
          <RefField label="Confidence / Caveats" value={synthesis.confidenceCaveats} />
        )}
      </div>
    </details>
  );
}

function RefField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-12">
      <div className="section-heading">{label}</div>
      <div className="prompt-box text-xs" style={{ maxHeight: 120, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}

function NextRoundPromptCard({
  prompt,
  onCopy,
  onStart,
  copied,
}: {
  prompt: string;
  onCopy: () => void;
  onStart: () => void;
  copied: boolean;
}) {
  return (
    <div className="card" style={{ border: '1px solid var(--green-dim)', marginBottom: 12 }}>
      <div className="card-header">
        <span className="card-title" style={{ color: 'var(--green)' }}>Proposed Next-Round Prompt</span>
        <span className="badge badge-green">Ready to use</span>
      </div>
      <div className="prompt-box mb-12" style={{ whiteSpace: 'pre-wrap', maxHeight: 160 }}>{prompt}</div>
      <div className="flex gap-8">
        <button className="btn btn-secondary" onClick={onCopy} style={{ flex: 1 }}>
          {copied ? '✓ Copied' : 'Copy Prompt'}
        </button>
        <button className="btn btn-primary" onClick={onStart} style={{ flex: 1 }}>
          Start Next Round From This Prompt →
        </button>
      </div>
    </div>
  );
}

```
