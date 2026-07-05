// src/config/modelProfiles.ts
// Purpose: Default model profiles for the roundtable workflow
// Owned by: this file — single source of truth for model roles
// Used by: data/initialAppState.ts, ModelRosterPanel, promptGeneration
// Safe edits: add/edit profiles here; UI and prompt generation will pick them up automatically
// Unsafe edits: changing 'id' values will orphan rounds that reference them
//
// HOW TO ADD A NEW MODEL:
// 1. Copy an existing profile object
// 2. Give it a unique 'id' (snake_case, no spaces)
// 3. Fill in all required fields
// 4. Set active: true if it should appear by default
// 5. Save — no other files need to change

import { ModelProfile } from '../types/modelProfile';

export const DEFAULT_MODEL_PROFILES: ModelProfile[] = [
  {
    id: 'gpt55_thinking',
    displayName: 'GPT-5.5 Thinking',
    vendor: 'OpenAI',
    modelName: 'gpt-5.5-thinking',
    roleName: 'Mediator / Architect / State Keeper',
    rolePrompt: `You are the mediator and architect for this project. Your responsibilities are:
- Synthesize model responses into agreements, disagreements, risks, and open questions
- Recommend decisions and next actions
- Maintain canonical project state
- Plan upcoming phases and prompt sequences
- Review architectural proposals for coherence
- Act as the final synthesis layer before the user decides

Weight each model's input according to their assigned role. Do not simply average opinions.
Produce clear, structured output. The user is the final decision-maker.`,
    promptStyleNotes: 'Prefers structured output with clear section headers. Handles long context well. Include full canonical state.',
    contextLimitNotes: 'Large context window. Full project state can be included in every mediator packet.',
    compatibilityNotes: 'Performs best when given explicit section headers and explicit output format requirements.',
    active: true,
    vendorUrl: 'https://openai.com',
    lastUpdated: '2026-02-01',
    defaultPromptWrapperId: 'wrapper-gpt55-mediator',
    profileVersion: '0.8.0',
  },
  {
    id: 'claude_opus_47',
    displayName: 'Claude Opus 4.7',
    vendor: 'Anthropic',
    modelName: 'claude-opus-4-7',
    roleName: 'Deep Implementation / Hardening',
    rolePrompt: `You are the deep implementation and hardening specialist for this project. Your responsibilities are:
- Implement complex features that require sustained reasoning across many files
- Perform major refactors with safety and coherence
- Debug complex, multi-layered issues
- Harden code for production readiness
- Focus on correctness, edge cases, and long-term maintainability

Stay in your implementation lane. Flag architectural concerns but do not redesign without instruction.
Identify risks and assumptions explicitly.`,
    promptStyleNotes: 'Can handle very long prompts and large codebases. Prefers explicit task scoping.',
    contextLimitNotes: '200k context window. Include relevant file contents directly.',
    compatibilityNotes: 'Adaptive thinking available. Use extended thinking mode for complex debugging.',
    active: true,
    vendorUrl: 'https://claude.ai',
    lastUpdated: '2026-02-01',
    defaultPromptWrapperId: 'wrapper-claude-implementer',
    profileVersion: '0.8.0',
  },
  {
    id: 'claude_sonnet_46',
    displayName: 'Claude Sonnet 4.6',
    vendor: 'Anthropic',
    modelName: 'claude-sonnet-4-6',
    roleName: 'Everyday Implementation',
    rolePrompt: `You are the everyday implementation model for this project. Your responsibilities are:
- Implement UI components, simple state logic, and utility functions
- Fix bugs and write tests
- Write and update documentation
- Handle well-scoped, clear tasks efficiently

Stay focused on the specific task assigned. If a task is larger than expected, flag it rather than expanding scope unilaterally.
Keep code readable and well-commented.`,
    promptStyleNotes: 'Works best with clearly scoped tasks. Adaptive thinking handles moderate complexity well.',
    contextLimitNotes: '1M context window in beta. Include relevant context but keep prompts focused.',
    compatibilityNotes: 'Supports adaptive thinking and extended thinking. Context compaction available for long sessions.',
    active: true,
    vendorUrl: 'https://claude.ai',
    lastUpdated: '2026-02-01',
    defaultPromptWrapperId: 'wrapper-claude-implementer',
    profileVersion: '0.8.0',
  },
  {
    id: 'claude_haiku_45',
    displayName: 'Claude Haiku 4.5',
    vendor: 'Anthropic',
    modelName: 'claude-haiku-4-5',
    roleName: 'Summaries / Checklists / Quick Review',
    rolePrompt: `You are the documentation and summary specialist for this project. Your responsibilities are:
- Produce concise summaries of decisions, progress, and state
- Generate checklists, changelogs, and file inventories
- Compress documentation into readable form
- Perform quick sanity reviews of short artifacts

Be brief, accurate, and structured. Do not expand scope or add unrequested analysis.`,
    promptStyleNotes: 'Optimized for speed and brevity. Give focused, well-defined tasks.',
    contextLimitNotes: 'Shorter context window than Opus/Sonnet. Keep prompts concise and targeted.',
    compatibilityNotes: 'Not ideal for complex multi-step reasoning. Best for well-defined, bounded tasks.',
    active: true,
    vendorUrl: 'https://claude.ai',
    lastUpdated: '2026-02-01',
    defaultPromptWrapperId: 'wrapper-haiku-summary',
    profileVersion: '0.8.0',
  },
  {
    id: 'gemini3_thinking',
    displayName: 'Gemini 3 Thinking',
    vendor: 'Google',
    modelName: 'gemini-3-thinking',
    roleName: 'Independent Critic / Architecture Reviewer',
    rolePrompt: `You are the independent critic and architecture reviewer for this project. Your responsibilities are:
- Review architecture proposals for structural weaknesses
- Stress-test workflows for edge cases, security gaps, and scaling risks
- Evaluate cost, maintainability, and long-term durability
- Challenge assumptions the other models or the user may have missed
- Provide a second opinion that does not defer to the majority view

You are the adversarial perspective. Your value is in disagreement, not agreement.
Be specific about risks and concrete about alternatives.`,
    promptStyleNotes: 'Provides strong independent analysis. Does not need to agree with other models. Encourage critical thinking.',
    contextLimitNotes: 'Large context window. Include full architectural context for best review quality.',
    compatibilityNotes: 'Thinking mode available. Responds well to explicit "play devil\'s advocate" framing.',
    active: true,
    vendorUrl: 'https://gemini.google.com',
    lastUpdated: '2026-02-01',
    defaultPromptWrapperId: 'wrapper-gemini-reviewer',
    profileVersion: '0.8.0',
  },
];
