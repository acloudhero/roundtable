// src/types/round.ts
// Purpose: Round type — core workflow unit in RoundTable
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
  /** v0.11.0: SHA-256 of the project's canonical state at the moment this
   *  prompt was generated. Used by Markdown Handoff Mode to:
   *    (a) stamp matching artifact frontmatter so importers can detect
   *        when the file was generated under different project state;
   *    (b) drive a hash-based stale-state indicator on Round Builder
   *        and Mediator panels (replaces the v0.10.3 60-char prefix
   *        heuristic; both coexist for one release for safety).
   *  Optional because pre-v0.11.0 prompts predate the field; their
   *  stale-state badge silently skips rather than showing a false
   *  positive. Format: `sha256:<lowercase-hex>`. */
  canonicalStateHashAtGeneration?: string;
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
