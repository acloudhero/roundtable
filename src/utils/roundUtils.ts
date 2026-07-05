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
import { PromptWrapper } from '../types/promptWrapper';
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
  compatibilityNotes: CompatibilityNote[],
  // Phase 7B: optional pool of prompt wrappers used to apply
  // vendor-specific framing. Omitting it preserves the legacy
  // (no-wrapper) prompt shape.
  promptWrappers?: PromptWrapper[],
  // v0.11.0: optional canonical-state hash captured at generation time.
  // Passed in by callers (RoundBuilderPanel) that have already computed
  // it via hashProjectCanonicalState(project). This becomes the
  // GeneratedPrompt.canonicalStateHashAtGeneration field, used by
  // Markdown Handoff Mode to:
  //   - stamp matching frontmatter on artifact exports;
  //   - drive the hash-based stale-state badge on Round Builder &
  //     Mediator panels (replaces the v0.10.3 prefix heuristic).
  // null is preserved as null — older state may not have a hash, and we
  // do not fabricate one.
  canonicalStateHashAtGeneration?: string | null
): Round {
  const selectedModels = models.filter((m) => round.selectedModelIds.includes(m.id));
  const results = generateAllPrompts(
    project,
    round.userInstruction,
    selectedModels,
    compatibilityNotes,
    promptWrappers
  );

  const prompts: GeneratedPrompt[] = results.map((r) => ({
    id: generateId('prompt'),
    modelProfileId: r.modelId,
    modelDisplayName: r.modelDisplayName,
    promptText: r.promptText,
    generatedAt: nowIso(),
    copiedAt: undefined,
    status: 'generated' as PromptStatus,
    // v0.11.0: only stamp when a hash was provided. Undefined preserves
    // round-trip for callers that don't supply it; the field is optional
    // and the import side handles both shapes.
    ...(canonicalStateHashAtGeneration
      ? { canonicalStateHashAtGeneration }
      : {}),
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

  // v0.10.3 fix: preserve any existing 'reviewed' or 'excluded' status the user
  // has already set. The previous behavior reset status to 'pasted' on every
  // textarea blur, which meant editing a response after marking it
  // 'reviewed' silently demoted it back to 'pasted' — and combined with the
  // race condition between blur and status-button clicks in ResponsesPanel,
  // could leave the round with status='reviewed' but responseText=''. That
  // was the visible mediator-packet bug: status said reviewed, but body was
  // missing because a stale-closure race overwrote the body.
  let nextStatus: ResponseStatus;
  if (!responseText.trim()) {
    nextStatus = 'awaiting_response';
  } else if (existing && (existing.status === 'reviewed' || existing.status === 'excluded')) {
    nextStatus = existing.status; // preserve user's prior decision
  } else {
    nextStatus = 'pasted';
  }

  const updated: ModelResponse = {
    id: existing?.id ?? generateId('resp'),
    modelProfileId,
    // v0.10.4: preserve existing display name when caller passes an empty
    // string. This protects the unmount-flush path in ResponsesPanel and
    // any future caller that doesn't have ready access to display names.
    modelDisplayName: modelDisplayName || existing?.modelDisplayName || '',
    responseText,
    pastedAt: isFirstPaste && responseText.trim() ? nowIso() : (existing?.pastedAt),
    status: nextStatus,
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

/**
 * @deprecated since v0.10.5 — prefer {@link updateRoundFunctional} for any
 * new code. `replaceRound` computes `rounds` from a closure-captured
 * `state`, which loses data when two dispatches in the same React batch
 * each spread a whole `rounds` array. As of v0.10.5 no in-app code path
 * calls this helper; it is kept exported only for backward compatibility
 * with any external test or downstream code that may import it. Will be
 * removed in a future major-version release.
 */
export function replaceRound(state: AppState, updated: Round): Partial<AppState> {
  return {
    rounds: state.rounds.map((r) => (r.id === updated.id ? updated : r)),
  };
}

/**
 * v0.10.4: Race-free round mutation helper.
 *
 * Returns a functional updater suitable for the new
 * `onUpdate(updater: (prev) => Partial<AppState>)` signature. Unlike
 * `replaceRound`, which computes `rounds` from a closure-captured
 * `state` (and so loses data when two dispatches in the same React
 * batch each spread a whole `rounds` array), this helper resolves the
 * round *inside* the setState updater — it always operates on the
 * latest committed state.
 *
 * The `recipe` callback receives the latest version of the round (so
 * any concurrently-dispatched commits are already applied) and
 * returns the next version of the round.
 *
 * If the round id is not found in `prev.rounds` (e.g. round was
 * deleted since the dispatch was scheduled), the updater returns an
 * empty partial — no-op rather than throwing.
 *
 * Usage:
 *
 *   onUpdate(updateRoundFunctional(roundId, (round) =>
 *     upsertModelResponse(round, modelProfileId, modelDisplayName, text)
 *   ));
 *
 * This is the recommended pattern for ANY workflow transition that
 * touches a round (text save, status change, locking, decision
 * recording). It eliminates the textarea-blur + status-click race
 * documented in the v0.10.3 root-cause and tightens the "Total
 * Serialization" boundary from the v0.10.4 brief.
 */
export function updateRoundFunctional(
  roundId: string,
  recipe: (round: Round) => Round
): (prev: AppState) => Partial<AppState> {
  return (prev: AppState): Partial<AppState> => {
    const target = prev.rounds.find((r) => r.id === roundId);
    if (!target) return {};
    const updated = recipe(target);
    return {
      rounds: prev.rounds.map((r) => (r.id === roundId ? updated : r)),
    };
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
