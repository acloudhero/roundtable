// src/config/exportFormats.ts
// Purpose: Export format configuration and schema versioning.
//
// SCHEMA_VERSION is the canonical version string for the AppState data model.
// It is read by:
//   - data/initialAppState.ts (stamps new local state)
//   - utils/jsonExport.ts      (stamps every JSON export)
//   - utils/markdownExport.ts  (stamps every Markdown export)
//   - utils/markdownArtifact.ts(stamps every Markdown handoff artifact, v0.11.0)
//   - utils/validation.ts      (compares against incoming imports)
//
// When you change the AppState shape:
//   1. Bump SCHEMA_VERSION here.
//   2. Document the change in docs/SCHEMA_EVOLUTION.md.
//   3. Update normalization in utils/validation.ts if older exports need repair.
//   4. Update package.json + package-lock.json.
//
// STORAGE_KEY is the localStorage key for AppState.
// Phase 9: renamed from mrc.appState.v0 to roundtable.appState.v1.
// No legacy migration was added — the app had not been used operationally.
//
// v0.11.0 (Markdown Handoff Mode): adds the rawNotes and importHistory
// top-level arrays to AppState. Migration migrate_0_10_5_to_0_11_0 defaults
// both to []; no other shape changes. ARTIFACT_TYPE is the namespace + major
// version of the Markdown handoff artifact frontmatter — bumping to v2 is a
// breaking format change.
//
// v0.12.0 (Checkpoint J — Modal System Replacement): bumps APP_VERSION
// only. NO AppState shape change. NO migration step. SCHEMA_VERSION stays
// at 0.11.0 because the storage shape is byte-identical to the v0.11.0 RC.
// Newly-emitted Markdown handoff artifacts will carry app_version "0.12.0"
// alongside schema_version "0.11.0"; older artifacts (app_version "0.11.0")
// remain fully round-trip-compatible because the importer only gates on
// schema_version range, not app_version.

export const SCHEMA_VERSION = '0.11.0';
export const APP_VERSION = '0.12.0';
export const STORAGE_KEY = 'roundtable.appState.v1';

/** v0.11.0: Markdown handoff artifact type namespace.
 *  Treat any change to this string as a breaking format change.
 *  Readers reject newer-major artifact_type values; older-major values
 *  (none exist yet) would route through future migrations. */
export const ARTIFACT_TYPE = 'roundtable.markdown.v1';

export const EXPORT_FORMATS = {
  json: {
    label: 'Full JSON Export',
    description: 'Complete app state as JSON. Use for backup or migration.',
    fileExtension: 'json',
    mimeType: 'application/json',
  },
  markdown: {
    label: 'Project Markdown',
    description: 'Human-readable project summary. Use for handoff or documentation.',
    fileExtension: 'md',
    mimeType: 'text/markdown',
  },
} as const;
