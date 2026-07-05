// src/config/compatibilityTests.ts
// Purpose: Default compatibility test prompts shipped with RoundTable.
// Owned by: this file
// Used by: PromptLibraryPanel (display), markdownExport (Gemini Review
//          Packet summary), VENDOR_RESILIENCE.md (referenced as the
//          paste-into-model verification path).
//
// IMPORTANT — these are MANUAL tests:
//   RoundTable does not run these. The user copies a test prompt, pastes it
//   into the target model, reads the response, and decides whether
//   the model's behavior still fits RoundTable expectations. There is no
//   automation, no submission, no retrieval. That is the whole point.
//
// HOW TO ADD A NEW TEST:
// 1. Copy an existing test object below.
// 2. Give it a unique 'id' (kebab-case OK).
// 3. Write a focused promptText that targets ONE behavior.
// 4. Describe expectedShape clearly.
// 5. Save — PromptLibraryPanel will display it automatically.
//
// Safe edits: add/edit tests here.
// Unsafe edits: adding any execution / submission path. These are
//               paste-only prompts.

import { CompatibilityTest } from '../types/compatibilityTest';

export const DEFAULT_COMPATIBILITY_TESTS: CompatibilityTest[] = [
  {
    id: 'compat-test-structured-output',
    name: 'Structured Output Compliance',
    purpose:
      'Verify the model produces explicit markdown ### headings when asked, without merging or omitting sections.',
    promptText: `Reply to this prompt using exactly these four markdown headings, in this order, with non-empty content under each:

### Summary
### Risks
### Open Questions
### Recommended Next Action

The topic is: "Add a new compatibility note to RoundTable for a model that recently changed its markdown behavior." Each section should be 1-3 sentences.`,
    expectedShape:
      'Four ### headings appear in the requested order. No merging, no omissions, no extra headings.',
    notes:
      'Models in "thinking" or "reasoning" modes sometimes drop section headings. This test catches that regression.',
  },
  {
    id: 'compat-test-markdown-formatting',
    name: 'Markdown Formatting',
    purpose:
      'Verify the model emits clean GitHub-flavored Markdown that survives copy/paste into RoundTable exports.',
    promptText: `Produce a short markdown document with the following elements:
- A level-2 heading
- A bulleted list with 3 items
- A numbered list with 3 items
- An inline \`code\` reference
- A fenced code block in javascript
- A blockquote
- A bold and an italic phrase in one sentence

Do not add commentary about formatting. Just produce the document.`,
    expectedShape:
      'A single markdown document containing all 7 requested elements. The fenced code block is fenced with triple backticks (or tildes); RoundTable dynamic-tilde-fences will quote it correctly.',
    notes:
      'A model that emits HTML or unfenced code is not compatible with RoundTable Markdown exports.',
  },
  {
    id: 'compat-test-implementation-report',
    name: 'Implementation Report Shape',
    purpose:
      'Verify a Claude-like implementer model produces the expected build-result + files-changed report shape.',
    targetVendor: 'Anthropic',
    targetRole: 'Implementer',
    promptText: `Imagine you just modified two files (\`src/foo.ts\`, \`src/bar.ts\`) and added one (\`src/baz.ts\`) in a TypeScript project. Pretend the build passed with 0 TS errors. Produce the implementation report in the format RoundTable expects: a short summary, a files-changed list, a build result line, and a "carryover items" list (which can be "(none)").`,
    expectedShape:
      'Four labeled sections in order: summary, files changed, build result, carryover items.',
  },
  {
    id: 'compat-test-architecture-critique',
    name: 'Architecture Critique Shape (Gemini)',
    purpose:
      'Verify a reviewer model produces architectural critique grouped by risk, acceptance gate, and disagreements.',
    targetVendor: 'Google',
    targetRole: 'Reviewer',
    promptText: `Read this short fictional design: "We are adding a new in-browser MCP integration to our local-first React app. The MCP client will run in the browser and contact a registry over HTTPS to discover tools."

Produce a critique with these markdown headings: Architecture Risk Assessment, Acceptance Gate Concerns, Specific Disagreements, Recommended Adjustments, Questions for Next Round, Confidence Caveats.`,
    expectedShape:
      'All six headings present, each with at least 1 substantive sentence. Tone is critical but not dismissive.',
  },
  {
    id: 'compat-test-mediator-synthesis',
    name: 'Mediator Synthesis Shape (GPT-5.5)',
    purpose:
      'Verify GPT-5.5 produces all 12 mediator synthesis sections without merging or skipping any.',
    targetVendor: 'OpenAI',
    targetRole: 'Mediator',
    promptText: `Three model responses (fictional, omitted) reviewed a proposal to add prompt wrappers to RoundTable. Synthesize them as the mediator. Produce all 12 mediator synthesis sections (Executive Summary, Agreements, Disagreements, Risks, Open Questions, Model-Specific Observations, Recommended Decision, Decision Rationale, Proposed Canonical State Update, Proposed Next Actions, Proposed Next Round Prompt, Confidence / Caveats), each as a ### heading. Use plausible filler content; the test is shape, not content.`,
    expectedShape:
      'All 12 ### headings appear in the listed order, each with non-empty content.',
    notes:
      'A regression here means the mediator extraction utility (mediatorExtract.ts) will silently drop fields.',
  },
  {
    id: 'compat-test-summary-checklist',
    name: 'Summary + Checklist Shape (Haiku)',
    purpose:
      'Verify a small/fast model can produce a tight summary + bulleted checklist within length caps.',
    targetVendor: 'Anthropic',
    targetRole: 'Summarizer',
    promptText: `Summarize the following in one paragraph (no more than 60 words), then produce a bulleted checklist of no more than 8 items. Do not add any other commentary.

Topic: "Update the RoundTable Gemini Review Packet to include a summary of all expanded ModelProfile fields, prompt wrapper summaries, and compatibility test names."`,
    expectedShape:
      'One paragraph (≤ 60 words) followed by a bulleted list (≤ 8 items). No third section, no commentary.',
    notes:
      'Small models tend to elaborate beyond the cap; this test detects that drift quickly.',
  },
];
