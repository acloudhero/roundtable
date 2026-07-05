// src/types/project.ts
// Purpose: Core Project type
// Owned by: this file
// Used by: AppState, demoProject, ProjectStatePanel, ProjectManager
// Safe edits: add optional fields
// Unsafe edits: removing/renaming existing fields will break storage deserialization
//
// v0.10.1: added optional archived / archivedAt for project lifecycle management.
// These default to false/null for existing projects (normalization in validation.ts).

export interface Project {
  id: string;
  name: string;
  description: string;
  currentPhase: string;
  canonicalState: string;
  createdAt: string;
  updatedAt: string;
  // v0.10.1 lifecycle fields
  archived?: boolean;
  archivedAt?: string | null;
}
