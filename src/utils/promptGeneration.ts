// src/utils/promptGeneration.ts
// Purpose: Centralized prompt generation — Context Sandwich + Phase 7B wrapper layer.
// Owned by: this file
// Used by: roundUtils.ts (generatePromptsForRound)
//
// CONTEXT SANDWICH (unchanged since Phase 1):
//   1. Project Context  (top bread)
//   2. Current Phase
//   3. Specific User Instruction  (filling)
//   4. Model Role + Constraints
//   5. Compatibility Notes
//   6. Required Output Format  (bottom bread)
//
// PHASE 7B — PROMPT WRAPPER LAYER:
//   A vendor-specific wrapper acts as additional bread *outside* the
//   Sandwich. The wrapper contributes:
//     - wrapperText            (prepended above the Sandwich)
//     - outputInstructions     (appended below the Sandwich)
//     - compatibilityNotes     (informational; rendered inline above
//                              the wrapper footer if present)
//
//   The Sandwich itself is unchanged. Wrappers add framing; they do
//   not replace any Sandwich section.
//
// Resolution order for which wrapper applies (highest priority first):
//   1. Explicit `wrapper` argument passed by the caller.
//   2. Wrapper whose id matches `model.defaultPromptWrapperId`.
//   3. The Generic wrapper (`wrapper-generic`), if present in the
//      provided wrappers array.
//   4. None — wrapperText and outputInstructions silently degrade to
//      empty strings, producing exactly the Phase 5/6/7A prompt shape.
//
// This file owns prompt assembly. Do NOT scatter wrapper or sandwich
// rendering into UI components.
//
// Safe edits:
//   - Adjusting Sandwich section wording.
//   - Adding new optional Sandwich sections.
//   - Adding new wrapper-resolution rules.
// Unsafe edits:
//   - Removing the Context Sandwich pattern; downstream models depend
//     on its consistent shape.
//   - Mutating wrapper text — wrappers come from configuration; treat
//     them as read-only here.

import { Project } from '../types/project';
import { ModelProfile } from '../types/modelProfile';
import { CompatibilityNote } from '../types/compatibilityNote';
import { PromptWrapper } from '../types/promptWrapper';
import { GENERIC_WRAPPER_ID } from '../config/promptWrappers';

export interface PromptGenerationInput {
  project: Project;
  userInstruction: string;
  model: ModelProfile;
  compatibilityNotes: CompatibilityNote[];
  /** Phase 7B: optional wrapper. If omitted, resolves via the model
   *  profile's defaultPromptWrapperId from the wrappers list, or to
   *  the Generic wrapper, or to no wrapper at all. */
  wrapper?: PromptWrapper;
  /** Phase 7B: optional pool of available wrappers used for resolution
   *  when `wrapper` is not explicitly supplied. */
  wrappers?: PromptWrapper[];
}

/**
 * Resolve the wrapper that should be applied to a given model, given
 * the available wrappers. Returns undefined if no wrapper is found.
 *
 * Resolution priority: explicit > model default > Generic > none.
 */
export function resolveWrapper(
  model: ModelProfile,
  wrappers: PromptWrapper[] | undefined,
  explicit?: PromptWrapper
): PromptWrapper | undefined {
  if (explicit) return explicit;
  if (!wrappers || wrappers.length === 0) return undefined;

  const byId = (id?: string) =>
    id ? wrappers.find((w) => w.id === id && w.active !== false) : undefined;

  return byId(model.defaultPromptWrapperId) ?? byId(GENERIC_WRAPPER_ID);
}

export function generateModelPrompt(input: PromptGenerationInput): string {
  const { project, userInstruction, model, compatibilityNotes, wrappers } = input;
  const wrapper = resolveWrapper(model, wrappers, input.wrapper);

  // Filter active compatibility notes for this model. Phase 7B prefers
  // linkedModelProfileId when present, falling back to the legacy
  // vendor/modelName match so older notes still apply.
  const modelNotes = compatibilityNotes
    .filter((n) => {
      if (n.status !== 'active') return false;
      if (n.linkedModelProfileId) return n.linkedModelProfileId === model.id;
      return n.modelName === model.modelName || n.vendor === model.vendor;
    })
    .map((n) => {
      const sev = n.severity ? ` [${n.severity}]` : '';
      return `- **${n.issue}**${sev}\n  Workaround: ${n.workaround}`;
    })
    .join('\n');

  const notesSection = [
    model.promptStyleNotes ? `**Prompt Style:** ${model.promptStyleNotes}` : '',
    model.contextLimitNotes ? `**Context Limits:** ${model.contextLimitNotes}` : '',
    model.formattingNotes ? `**Formatting Notes:** ${model.formattingNotes}` : '',
    model.refusalRiskNotes ? `**Refusal Risk Notes:** ${model.refusalRiskNotes}` : '',
    modelNotes ? `**Known Issues:**\n${modelNotes}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  // Build the Context Sandwich (unchanged from Phase 5/6/7A).
  const sandwich = `# RoundTable Prompt

## Project
${project.name}

## Current Phase
${project.currentPhase}

## Project Context
${project.canonicalState}

## Specific User Instruction for This Round
${userInstruction}

## Your Assigned Role
${model.roleName}

## Role Instructions
${model.rolePrompt}

## Model-Specific Notes
${notesSection || '(No specific notes for this model.)'}`;

  // Wrapper bread.
  const header = wrapper?.wrapperText?.trim()
    ? `${wrapper.wrapperText.trim()}\n\n---\n\n`
    : '';

  // Inline wrapper-level compatibility notes immediately above the
  // wrapper footer if present.
  const wrapperCompat =
    wrapper?.compatibilityNotes && wrapper.compatibilityNotes.trim()
      ? `\n\n## Wrapper Compatibility Notes\n${wrapper.compatibilityNotes.trim()}`
      : '';

  // Wrapper footer (output instructions). When the wrapper supplies its
  // own output instructions, they replace the legacy "Required Output"
  // boilerplate. When the wrapper is absent or omits them, we fall back
  // to the legacy boilerplate so older flows behave identically.
  const legacyOutput = `## Required Output
Please respond in the format requested for your role.
Focus only on your assigned lane.
Do not take over the mediator role unless explicitly instructed.
Identify assumptions, risks, and recommended next actions.`;

  const footer = wrapper?.outputInstructions?.trim()
    ? `\n\n## Required Output\n${wrapper.outputInstructions.trim()}`
    : `\n\n${legacyOutput}`;

  return `${header}${sandwich}${wrapperCompat}${footer}`;
}

export interface BatchPromptResult {
  modelId: string;
  modelDisplayName: string;
  promptText: string;
}

/**
 * Generate prompts for every model. Phase 7B: an optional `wrappers`
 * pool can be passed; it is resolved per-model via the same priority
 * rules as `generateModelPrompt`. Callers that don't pass `wrappers`
 * get the legacy Phase 5/6/7A prompt shape with no wrapper layer.
 */
export function generateAllPrompts(
  project: Project,
  userInstruction: string,
  models: ModelProfile[],
  compatibilityNotes: CompatibilityNote[],
  wrappers?: PromptWrapper[]
): BatchPromptResult[] {
  return models.map((model) => ({
    modelId: model.id,
    modelDisplayName: model.displayName,
    promptText: generateModelPrompt({
      project,
      userInstruction,
      model,
      compatibilityNotes,
      wrappers,
    }),
  }));
}
