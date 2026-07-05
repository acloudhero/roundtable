// src/config/promptTemplates.ts
// Purpose: Default prompt templates following the Context Sandwich pattern
// Owned by: this file
// Used by: data/initialAppState.ts, PromptLibraryPanel, promptGeneration.ts
// Safe edits: add new templates, update notes
// Unsafe edits: changing template variables must be coordinated with promptGeneration.ts

import { PromptTemplate } from '../types/promptTemplate';

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'context_sandwich_standard',
    name: 'Context Sandwich — Standard',
    purpose: 'Standard model prompt following the Context Sandwich pattern for most roundtable rounds',
    templateText: `# RoundTable Prompt

## Project
{{projectName}}

## Current Phase
{{currentPhase}}

## Project Context
{{canonicalState}}

## Specific User Instruction for This Round
{{userInstruction}}

## Your Assigned Role
{{roleName}}

## Role Instructions
{{rolePrompt}}

## Model-Specific Notes
{{promptStyleNotes}}
{{contextLimitNotes}}
{{compatibilityNotes}}

## Required Output
Please respond in the format requested for your role.
Focus only on your assigned lane.
Do not take over the mediator role unless explicitly instructed.
Identify assumptions, risks, and recommended next actions.`,
    variables: [
      'projectName',
      'currentPhase',
      'canonicalState',
      'userInstruction',
      'roleName',
      'rolePrompt',
      'promptStyleNotes',
      'contextLimitNotes',
      'compatibilityNotes',
    ],
    notes: 'Default template. Uses the Context Sandwich: project context → instruction → role constraints. Do not reorder sections.',
    version: '1.0',
  },
  {
    id: 'mediator_synthesis',
    name: 'Mediator Synthesis Packet',
    purpose: 'Packet for GPT-5.5 Thinking to synthesize model responses into decisions and next actions',
    templateText: `# RoundTable — Mediator Synthesis Packet

## Project
{{projectName}}

## Current Phase
{{currentPhase}}

## Project Context
{{canonicalState}}

## User Instruction for This Round
{{userInstruction}}

## Participating Models and Their Roles
{{modelRosterSummary}}

## Model Responses

{{modelResponsesBlock}}

## Your Role
You are the mediator, architect, state keeper, phase planner, prompt engineer, and reviewer for this project.
Weight each model's input according to their assigned role.
The user is the final decision-maker.

## Required Synthesis Output

Please provide your synthesis in the following format:

### Agreements
[What did the models agree on?]

### Disagreements
[What did the models disagree on? Be specific.]

### Risks
[What risks did the models identify, or did you notice?]

### Open Questions
[What remains unresolved?]

### Recommended Decision
[Your recommended decision for the user's consideration]

### Recommended Next Action
[The single most important next step]

### Proposed Next Prompt
[A ready-to-use instruction for the next round, if applicable]

### Canonical State Update
[Updated canonical project state, reflecting any decisions made this round]`,
    variables: [
      'projectName',
      'currentPhase',
      'canonicalState',
      'userInstruction',
      'modelRosterSummary',
      'modelResponsesBlock',
    ],
    notes: 'Used by mediatorPacket.ts to generate the GPT-5.5 synthesis request. Do not remove any Required Synthesis Output sections.',
    version: '1.0',
  },
];
