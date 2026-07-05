// src/types/compatibilityTest.ts
// Purpose: CompatibilityTest type — small library of prompts the user
//          can manually paste into a model to verify its behavior still
//          fits RoundTable expectations.
// Owned by: this file
// Used by: config/compatibilityTests.ts, AppState, PromptLibraryPanel
//          (display), markdownExport (Gemini Review Packet summary)
//
// Phase 7B (new in this phase):
//   These tests are NOT automated. RoundTable does not run them, does not
//   submit them, does not retrieve responses. The user copies a test
//   prompt, pastes it into the target model, reads the response, and
//   makes a judgment call about whether the model still behaves as
//   expected.
//
//   Examples (defaults shipped in config/compatibilityTests.ts):
//     - Structured output compliance test
//     - Markdown formatting test
//     - Implementation report shape test
//     - Architecture critique shape test
//     - Mediator synthesis shape test
//     - Summary / checklist formatting test
//
// Safe edits:
//   - Adding new tests in config.
//   - Refining existing test prompts.
// Unsafe edits:
//   - Adding any execution path. These are paste-only prompts.

export interface CompatibilityTest {
  id: string;
  /** Short name shown in UI. */
  name: string;
  /** What this test verifies. */
  purpose: string;
  /** Optional — vendor this test is tuned for. */
  targetVendor?: string;
  /** Optional — role this test is tuned for. */
  targetRole?: string;
  /** The full prompt to paste into the target model. */
  promptText: string;
  /** What a passing response looks like. */
  expectedShape: string;
  /** Free-form notes on known fail modes. */
  notes?: string;
}
