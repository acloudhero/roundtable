// src/utils/markdownArtifactDownload.ts
// Purpose: Convenience helper that pairs buildArtifact (single source of
//          truth for v0.11.0 Markdown handoff artifacts) with the existing
//          downloadText file-saver. Every Download .md button in the app
//          dispatches through this one helper.
//
// Owned by: this file
// Used by:  RoundBuilderPanel, ResponsesPanel, MediatorPanel (and any
//           future Download .md affordance).
//
// Why this lives in its own file:
//   - buildArtifact is async; downloadText is sync. Coupling them in one
//     awaitable function keeps the panel call sites simple and uniform.
//   - The filename is derived from the BuiltArtifact via filenameFor()
//     (which honors per-source-kind FILENAME_PREFIXES). Centralizing the
//     "build + name + save" sequence here means panels never reach into
//     the artifact internals.
//   - The MIME type is fixed to text/markdown — never override per-call.
//
// Design rule:
//   This helper is the ONLY way panels emit a .md file. If a panel needs
//   a different artifact text, it should pass different BuildArtifactInput
//   to buildArtifact — not bypass this helper. The single-source-of-truth
//   contract from the v0.11.0 feasibility doc (sec. 12, criterion #1)
//   depends on this discipline.

import { BuildArtifactInput, BuiltArtifact } from '../types/markdownArtifact';
import { buildArtifact, filenameFor } from './markdownArtifact';
import { downloadText } from './jsonExport';

/**
 * Build a Markdown handoff artifact and trigger a browser download.
 *
 * Returns the BuiltArtifact in case the caller wants to log/inspect
 * the artifact_id or surface a toast. Throws on error — panels should
 * catch and surface a user-facing notice (every existing call site
 * already wraps its async export work in try/catch for the clipboard
 * helper; the same pattern applies here).
 */
export async function downloadMarkdownArtifact(
  input: BuildArtifactInput
): Promise<BuiltArtifact> {
  const built = await buildArtifact(input);
  // filenameFor returns a deterministic, filesystem-safe name including
  // the per-source-kind prefix (RT_PROMPT_, RT_RESPONSE_, RT_MEDIATOR_PACKET_, etc.).
  const filename = filenameFor(built);
  downloadText(built.fullText, filename, 'text/markdown');
  return built;
}
