// src/types/decision.ts
// Purpose: Decision type — records user decisions from mediator synthesis
// Owned by: this file
// Used by: AppState, DecisionLogPanel, markdownExport
// Safe edits: add optional fields
// Unsafe edits: id/projectId/roundId changes break Decision Log queries

export interface Decision {
  id: string;
  projectId: string;
  roundId: string;
  decisionText: string;
  rationale: string;
  createdAt: string;

  // Optional future-friendly fields
  phase?: string;
  nextAction?: string;
  supersedesDecisionId?: string;
}
