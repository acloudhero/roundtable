// src/config/compatibilityNotes.ts
// Purpose: Known model-specific quirks and workarounds
// Owned by: this file
// Used by: data/initialAppState.ts, promptGeneration.ts, HelpPanel
// Safe edits: add new notes, update status to 'resolved' or 'watching'
// Unsafe edits: removing active notes may cause prompt generation to silently drop important warnings

import { CompatibilityNote } from '../types/compatibilityNote';

export const DEFAULT_COMPATIBILITY_NOTES: CompatibilityNote[] = [
  {
    id: 'cn_gpt55_structured_output',
    vendor: 'OpenAI',
    modelName: 'gpt-5.5-thinking',
    issue: 'Thinking mode responses may omit section headers if not explicitly requested',
    workaround: 'Always include explicit section headers in the required output format. Use markdown ### headers.',
    dateObserved: '2026-01-15',
    status: 'active',
  },
  {
    id: 'cn_claude_context_compaction',
    vendor: 'Anthropic',
    modelName: 'claude-sonnet-4-6',
    issue: 'Context compaction (beta) may summarize important canonical state in very long sessions',
    workaround: 'Re-paste canonical state at the start of each new round prompt rather than relying on session memory.',
    dateObserved: '2026-02-01',
    status: 'watching',
  },
  {
    id: 'cn_gemini_adversarial_drift',
    vendor: 'Google',
    modelName: 'gemini-3-thinking',
    issue: 'Without explicit framing, Gemini may default to agreement rather than adversarial review',
    workaround: 'Include explicit "play devil\'s advocate" or "identify what could go wrong" framing in the prompt.',
    dateObserved: '2026-02-05',
    status: 'active',
  },
  {
    id: 'cn_haiku_scope_creep',
    vendor: 'Anthropic',
    modelName: 'claude-haiku-4-5',
    issue: 'Haiku may pad short summary tasks with unrequested analysis',
    workaround: 'Specify exact output format (e.g. "Return a bulleted list only. No preamble.") in the prompt.',
    dateObserved: '2026-01-20',
    status: 'active',
  },
  {
    id: 'cn_opus_long_refactor',
    vendor: 'Anthropic',
    modelName: 'claude-opus-4-7',
    issue: 'Very large refactors may cause Opus to truncate output before completing all changes',
    workaround: 'Break large refactors into sequential rounds. Confirm completion before proceeding.',
    dateObserved: '2026-02-10',
    status: 'active',
  },
];
