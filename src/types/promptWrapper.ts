// src/types/promptWrapper.ts
// Purpose: PromptWrapper type — vendor-specific framing layer ("bread")
//          that wraps the Context Sandwich for a particular target model.
// Owned by: this file
// Used by: config/promptWrappers.ts, AppState, promptGeneration,
//          ModelRosterPanel, RoundBuilderPanel, markdownExport
//
// Phase 7B (new in this phase):
//   Different models prefer different framing.
//     - GPT-5.5 mediator: structured synthesis sections.
//     - Claude implementation: file-change/build-report expectations.
//     - Gemini review: architecture-risk and acceptance-gate questions.
//     - Haiku summary: concise checklist formatting.
//
//   Wrappers are EDITABLE configuration. They intentionally do not form
//   a prompt DSL — wrapperText and outputInstructions are simple strings
//   the user can read and modify.
//
//   The Context Sandwich pattern is unchanged. Wrappers add a header
//   above and a footer below the Sandwich; they do not replace it.
//
// Recommended wrapper anatomy:
//   1. wrapperText           — vendor/model framing (the "header bread")
//   2. (Context Sandwich stays here, unchanged: project context →
//      current phase → user instruction → model role → compatibility)
//   3. outputInstructions    — output/format constraints (the "footer bread")
//
// Safe edits:
//   - Adding new optional fields.
//   - Adding new wrappers in config/promptWrappers.ts.
//   - Editing existing wrapperText / outputInstructions to adapt to a
//     model behavior change.
// Unsafe edits:
//   - Removing required fields (id, name, wrapperText) breaks
//     promptGeneration.
//   - Changing 'id' values orphans modelProfile.defaultPromptWrapperId
//     references; if you must rename, also update referencing profiles.

export interface PromptWrapper {
  id: string;
  name: string;
  /** Why this wrapper exists — when to choose it over another. */
  purpose: string;
  /** Vendor this wrapper is tuned for, e.g. "OpenAI", "Anthropic". */
  targetVendor?: string;
  /** Role this wrapper is tuned for, e.g. "Mediator", "Implementer", "Reviewer". */
  targetRole?: string;
  /** The framing prepended above the Context Sandwich. */
  wrapperText: string;
  /** The output / format instructions appended below the Context Sandwich. */
  outputInstructions: string;
  /** Free-form note on quirks this wrapper accommodates. */
  compatibilityNotes?: string;
  /** Wrapper version. Bump when materially changing behavior. */
  version?: string;
  /** Inactive wrappers stay in the array but aren't suggested in UI. */
  active?: boolean;
}
