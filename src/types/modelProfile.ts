// src/types/modelProfile.ts
// Purpose: ModelProfile type — describes each AI model's role, prompt
//          constraints, and vendor/model compatibility surface area.
// Owned by: this file
// Used by: config/modelProfiles.ts, AppState, ModelRosterPanel,
//          promptGeneration, RoundBuilderPanel
//
// Phase 7B expansion (vendor resilience):
//   When ChatGPT, Claude, Gemini, or another model changes its name,
//   context limits, formatting behavior, refusal tendencies, markdown
//   habits, or preferred prompt structure, the user should be able to
//   adapt RoundTable by editing this profile — not by touching prompt
//   generation code or any UI component.
//
//   All Phase 7B fields are OPTIONAL so older 0.7.0 exports import
//   cleanly. The migration step from 0.7.0 → 0.8.0 defaults sensible
//   values where appropriate; missing fields stay missing.
//
// Safe edits:
//   - Adding new optional fields.
//   - Editing existing field values in config/modelProfiles.ts.
// Unsafe edits:
//   - Removing required fields (id, displayName, vendor, modelName,
//     roleName, rolePrompt) breaks prompt generation.
//   - Renaming fields breaks stored AppState.

export interface ModelProfile {
  // ── Required (since Phase 1) ───────────────────────────────────────
  id: string;
  displayName: string;
  vendor: string;
  modelName: string;
  roleName: string;
  rolePrompt: string;
  promptStyleNotes: string;
  contextLimitNotes: string;
  compatibilityNotes: string;
  active: boolean;

  // ── Optional (Phase 5+, future-friendly) ───────────────────────────
  preferredOutputFormat?: string;
  defaultPromptTemplateId?: string;
  vendorUrl?: string;
  lastUpdated?: string;

  // ── Optional (Phase 7B — vendor resilience) ────────────────────────
  /** Track changes to this profile across model/vendor revisions. */
  profileVersion?: string;
  /** Free-form note on context window size and behavior. */
  contextWindowNotes?: string;
  /** Default wrapper id used when generating prompts for this model. */
  defaultPromptWrapperId?: string;
  /** Observed model behavior — refusals, drift, hallucination tendencies. */
  modelBehaviorNotes?: string;
  /** Markdown / structured output habits this model exhibits. */
  formattingNotes?: string;
  /** Notes on refusal tendencies and how to phrase prompts to avoid them. */
  refusalRiskNotes?: string;
  /** Strengths the user has observed (free-form, comma-separated OK). */
  strengths?: string;
  /** Weaknesses the user has observed (free-form). */
  weaknesses?: string;
  /** ISO date of the last manual review by the user. */
  lastReviewedAt?: string;
}
