// src/types/promptTemplate.ts
// Purpose: PromptTemplate type — reusable prompt scaffolds in the Prompt Library.
// Owned by: this file
// Used by: config/promptTemplates.ts, AppState, PromptLibraryPanel,
//          promptGeneration, markdownExport
//
// Phase 7B expansion (versioning):
//   Prompt templates accumulate revisions as models change. Phase 7B
//   adds optional version metadata so changes are traceable without
//   building a full version-control system. New optional fields:
//   version, createdAt, updatedAt, changelog, active, supersedesTemplateId.
//   All optional → 0.7.0 exports import cleanly.
//
// When to bump version vs edit in place:
//   - Bump when changing prompt behavior in a way that affects model
//     output materially (e.g. retuning for a new model release).
//   - Edit in place for typo fixes or minor wording.
//   - When superseding, set supersedesTemplateId on the new template
//     and mark the old template active: false rather than deleting it
//     — kept rounds may reference the old id.
//
// Safe edits:
//   - Adding new optional fields.
//   - Adding new templates in config.
// Unsafe edits:
//   - Changing templateText structure may break promptGeneration.ts.

export interface PromptTemplate {
  // ── Required ───────────────────────────────────────────────────────
  id: string;
  name: string;
  purpose: string;
  templateText: string;
  variables: string[]; // e.g. ["projectName", "userInstruction", "modelRole"]
  notes: string;

  // ── Optional (Phase 6+) ────────────────────────────────────────────
  version?: string;

  // ── Optional (Phase 7B — versioning) ───────────────────────────────
  createdAt?: string;
  updatedAt?: string;
  /** Human-readable summary of changes between versions. */
  changelog?: string;
  /** Inactive templates are kept for historical traceability. */
  active?: boolean;
  /** If this template replaces an older one, point to it here. */
  supersedesTemplateId?: string;
}
