// src/types/compatibilityNote.ts
// Purpose: CompatibilityNote type — tracks known model/vendor quirks and workarounds.
// Owned by: this file
// Used by: config/compatibilityNotes.ts, AppState, promptGeneration,
//          RoundBuilderPanel, HelpPanel, markdownExport
//
// Phase 7B expansion (severity, impact, linkage):
//   Compatibility notes now carry severity and richer linkage so the
//   Round Builder can surface relevant warnings for selected models,
//   and so the user can reason about which notes are workflow-blocking
//   vs cosmetic. Status enum widened to include 'deprecated'. All new
//   fields are OPTIONAL so 0.7.0 exports import cleanly.
//
// Safe edits:
//   - Adding new optional fields.
//   - Adding new notes in config.
//   - Updating status to 'resolved', 'watching', or 'deprecated'.
// Unsafe edits:
//   - Renaming severity values; UI filtering depends on them.
//   - Removing 'active' from CompatibilityStatus; promptGeneration
//     filters on it.

export type CompatibilityStatus = 'active' | 'resolved' | 'watching' | 'deprecated';

export type CompatibilitySeverity = 'low' | 'medium' | 'high' | 'workflow_breaking';

export interface CompatibilityNote {
  // ── Required (since Phase 2) ───────────────────────────────────────
  id: string;
  vendor: string;
  modelName: string;
  issue: string;
  workaround: string;
  dateObserved: string;
  status: CompatibilityStatus;

  // ── Optional (Phase 7B — severity / impact / linkage) ──────────────
  /** How disruptive this issue is. UI surfaces this prominently. */
  severity?: CompatibilitySeverity;
  /** Free-form description of the impact on the workflow. */
  impact?: string;
  /** Optional link to a specific ModelProfile.id this note applies to. */
  linkedModelProfileId?: string;
  /** Optional link to a PromptTemplate.id known to be affected. */
  linkedPromptTemplateId?: string;
  /** Optional link to a PromptWrapper.id known to be affected. */
  linkedPromptWrapperId?: string;
  /** ISO date of last manual user review. */
  reviewedAt?: string;
}
