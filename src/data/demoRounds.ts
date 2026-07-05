// src/data/demoRounds.ts
// Purpose: Demo rounds for Phase 3 scaffold — shows rich schema with status/timestamps
// Owned by: this file
// Used by: initialAppState.ts

import { Round } from '../types/round';

export const DEMO_ROUNDS: Round[] = [
  {
    id: 'round_001',
    projectId: 'proj_demo_001',
    roundNumber: 1,
    phase: 'Phase 1 — Architecture',
    userInstruction: 'Define the data model and file structure for RoundTable. Focus on AppState shape, major types, and how configuration will be separated from logic.',
    selectedModelIds: ['claude_opus_47', 'gemini3_thinking'],
    generatedPrompts: [
      {
        id: 'prompt_r1_001',
        modelProfileId: 'claude_opus_47',
        modelDisplayName: 'Claude Opus 4.7',
        promptText: '# RoundTable Prompt\n\n## Project\nRoundTable\n\n## Current Phase\nPhase 1 — Architecture\n\n[...Context Sandwich prompt...]',
        generatedAt: '2026-05-07T14:20:00Z',
        copiedAt: '2026-05-07T14:23:00Z',
        status: 'copied',
      },
      {
        id: 'prompt_r1_002',
        modelProfileId: 'gemini3_thinking',
        modelDisplayName: 'Gemini 3 Thinking',
        promptText: '# RoundTable Prompt\n\n## Project\nRoundTable\n\n## Current Phase\nPhase 1 — Architecture\n\n[...Context Sandwich prompt...]',
        generatedAt: '2026-05-07T14:20:00Z',
        copiedAt: '2026-05-07T14:25:00Z',
        status: 'copied',
      },
    ],
    modelResponses: [
      {
        id: 'resp_r1_001',
        modelProfileId: 'claude_opus_47',
        modelDisplayName: 'Claude Opus 4.7',
        responseText: 'Recommended AppState as a single top-level object for easy JSON export. Proposed the types/appState.ts, types/round.ts, and types/modelProfile.ts structure. Flagged that the locked field on Round will be important for preventing accidental history rewrites.',
        pastedAt: '2026-05-07T14:45:00Z',
        status: 'pasted',
      },
      {
        id: 'resp_r1_002',
        modelProfileId: 'gemini3_thinking',
        modelDisplayName: 'Gemini 3 Thinking',
        responseText: 'Agreed with the single AppState object approach. Added the recommendation for a storage adapter interface so localStorage can be replaced with IndexedDB later. Flagged risk: if schemaVersion is not incremented on data model changes, migrations will be difficult. Recommended the Context Sandwich pattern and richer prompt/response arrays with timestamps for chain-of-custody.',
        pastedAt: '2026-05-07T14:50:00Z',
        status: 'pasted',
      },
    ],
    mediatorPrompt: '[Mediator packet was generated and copied to GPT-5.5 Thinking]',
    mediatorResponse: `## Agreements
- Single AppState object is the right approach
- Storage adapter interface should abstract localStorage
- Context Sandwich is the right prompt generation pattern
- Rich GeneratedPrompt[] and ModelResponse[] arrays with copiedAt/pastedAt timestamps

## Disagreements
- None significant in Round 1

## Risks
- schemaVersion drift if data model changes are not tracked
- locked field needs clear spec before Phase 3

## Open Questions
- Should Decision Log be filterable by phase?

## Recommended Decision
Proceed with the proposed data model. Use rich prompt/response arrays. Add locked field.

## Recommended Next Action
Build Phase 2 scaffold, then Phase 3 core workflow.

## Proposed Canonical State Update
Data model defined with rich round schema. Proceeding to Phase 2 scaffold.`,
    userDecision: 'Approved. Proceeding to Phase 2 scaffold as described.',
    canonicalStateUpdate: 'Data model defined with rich round schema. Rich GeneratedPrompt[] and ModelResponse[] with chain-of-custody timestamps. Proceeding to Phase 2 scaffold.',
    agreements: [
      'Single AppState object for easy export/import',
      'Storage adapter interface',
      'Context Sandwich prompt generation pattern',
      'Rich prompt/response arrays with timestamps',
    ],
    disagreements: [],
    risks: [
      'schemaVersion drift if data model changes not tracked',
      'locked field needs clear spec',
    ],
    openQuestions: ['Should Decision Log be filterable by phase?'],
    nextActions: ['Build Phase 2 scaffold'],
    locked: true,
    createdAt: '2026-05-07T14:00:00Z',
    updatedAt: '2026-05-07T15:30:00Z',
  },
  {
    id: 'round_002',
    projectId: 'proj_demo_001',
    roundNumber: 2,
    phase: 'Phase 2 — Lightweight Repo Scaffold',
    userInstruction: 'Implement the Phase 2 scaffold: all major screens, demo data, storage adapter, Context Sandwich prompt generation, mediator packet utility, and placeholder export utilities.',
    selectedModelIds: ['claude_sonnet_46'],
    generatedPrompts: [
      {
        id: 'prompt_r2_001',
        modelProfileId: 'claude_sonnet_46',
        modelDisplayName: 'Claude Sonnet 4.6',
        promptText: '[Context Sandwich prompt was generated — copy it to Claude Sonnet 4.6]',
        generatedAt: '2026-05-08T09:00:00Z',
        copiedAt: '2026-05-08T09:05:00Z',
        status: 'copied',
      },
    ],
    modelResponses: [
      {
        id: 'resp_r2_001',
        modelProfileId: 'claude_sonnet_46',
        modelDisplayName: 'Claude Sonnet 4.6',
        responseText: 'Phase 2 scaffold delivered: 49 files, zero TypeScript errors, clean production build. All 10 screen tabs, demo data, storage adapter, Context Sandwich utility, mediator packet utility, placeholder export, industrial terminal aesthetic.',
        pastedAt: '2026-05-08T10:30:00Z',
        status: 'pasted',
      },
    ],
    mediatorPrompt: '[Mediator packet generated]',
    mediatorResponse: `## Agreements
- Phase 2 scaffold complete and passing acceptance gate

## Recommended Decision
Proceed to Phase 3 core workflow implementation.

## Proposed Canonical State Update
Phase 2 scaffold complete. All screens, demo data, storage adapter, prompt generation, mediator packet utility delivered. Proceeding to Phase 3.`,
    userDecision: 'Approved. Proceeding to Phase 3.',
    canonicalStateUpdate: 'Phase 2 scaffold complete. Proceeding to Phase 3 core workflow.',
    agreements: ['Phase 2 scaffold complete'],
    disagreements: [],
    risks: [],
    openQuestions: [],
    nextActions: ['Implement Phase 3 core round workflow'],
    locked: true,
    createdAt: '2026-05-08T09:00:00Z',
    updatedAt: '2026-05-08T10:45:00Z',
  },
  {
    id: 'round_003',
    projectId: 'proj_demo_001',
    roundNumber: 3,
    phase: 'Phase 3 — Core Round Workflow',
    userInstruction: 'Implement Phase 3: rich round schema, chain-of-custody workflow, copy/paste tracking, decision loop with explicit canonical state update, locked round protection.',
    selectedModelIds: ['claude_sonnet_46'],
    generatedPrompts: [
      {
        id: 'prompt_r3_001',
        modelProfileId: 'claude_sonnet_46',
        modelDisplayName: 'Claude Sonnet 4.6',
        promptText: '[Phase 3 Context Sandwich prompt — copy to Claude Sonnet 4.6]',
        generatedAt: '2026-05-08T11:00:00Z',
        copiedAt: undefined,
        status: 'generated',
      },
    ],
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
    createdAt: '2026-05-08T11:00:00Z',
    updatedAt: '2026-05-08T11:00:00Z',
  },
];
