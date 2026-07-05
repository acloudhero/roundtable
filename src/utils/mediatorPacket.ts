// src/utils/mediatorPacket.ts
// Purpose: Generates the structured mediator synthesis packet for GPT-5.5 Thinking
// Phase 4: refined 12-section required output, explicit user-is-final-decider instruction
// v0.10.3: response bodies are now embedded with dynamic-tilde fencing in a
//          dedicated "Model Responses for This Round" section. Excluded
//          responses are listed separately. Missing bodies are flagged.
// Owned by: this file
// Used by: MediatorPanel
//
// IMPORTANT: The mediator packet asks GPT-5.5 to PROPOSE a canonical state update.
// The app MUST NOT automatically apply it. User approval is always required.

import { Project } from '../types/project';
import { ModelProfile } from '../types/modelProfile';
import { ModelResponse, GeneratedPrompt } from '../types/round';
import { fence } from './markdownExport';

export interface MediatorPacketInput {
  project: Project;
  roundNumber: number;
  userInstruction: string;
  selectedModels: ModelProfile[];
  generatedPrompts: GeneratedPrompt[];
  modelResponses: ModelResponse[];
  knownRisks?: string[];
  openQuestions?: string[];
}

/**
 * Build the per-model response inclusion summary used by both the packet
 * itself and the MediatorPanel UI verification surface.
 *
 * Categories:
 *   - included: status is 'pasted' or 'reviewed' AND responseText is non-empty
 *   - missing : status is 'pasted'/'reviewed' but responseText is empty,
 *               OR no response entry exists, OR status is 'awaiting_response'
 *   - excluded: status is 'excluded' (regardless of body presence)
 */
export type ResponseInclusionCategory = 'included' | 'missing' | 'excluded';

export interface ResponseInclusionRow {
  modelProfileId: string;
  modelDisplayName: string;
  roleName: string;
  vendor?: string;
  modelName?: string;
  category: ResponseInclusionCategory;
  charCount: number;
  status: ModelResponse['status'] | 'awaiting_response';
  pastedAt?: string;
}

export function summarizeResponseInclusion(
  selectedModels: ModelProfile[],
  modelResponses: ModelResponse[]
): ResponseInclusionRow[] {
  return selectedModels.map((m) => {
    const response = modelResponses.find((r) => r.modelProfileId === m.id);
    const text = response?.responseText ?? '';
    let category: ResponseInclusionCategory;
    if (response?.status === 'excluded') {
      category = 'excluded';
    } else if (
      (response?.status === 'pasted' || response?.status === 'reviewed') &&
      text.trim().length > 0
    ) {
      category = 'included';
    } else {
      category = 'missing';
    }
    return {
      modelProfileId: m.id,
      modelDisplayName: m.displayName,
      roleName: m.roleName,
      vendor: m.vendor,
      modelName: m.modelName,
      category,
      charCount: text.length,
      status: response?.status ?? 'awaiting_response',
      pastedAt: response?.pastedAt,
    };
  });
}

export function generateMediatorPacket(input: MediatorPacketInput): string {
  const {
    project,
    roundNumber,
    userInstruction,
    selectedModels,
    modelResponses,
    knownRisks = [],
    openQuestions = [],
  } = input;

  const inclusion = summarizeResponseInclusion(selectedModels, modelResponses);

  // Roster summary on the packet itself: short, one line per model.
  const rosterSummary = inclusion
    .map((row) => {
      const tag =
        row.category === 'included'
          ? '✓ Response included'
          : row.category === 'excluded'
          ? '⊘ Response excluded'
          : '✗ Response missing';
      return `- **${row.modelDisplayName}** — ${row.roleName} [${tag}]`;
    })
    .join('\n');

  // ── Model Responses for This Round (the v0.10.3 fix) ──────────────────────
  // Fenced bodies live here, one per included model. Excluded responses are
  // routed to a separate section below. Missing responses get an explicit
  // "[Missing response body]" marker so GPT-5.5 cannot silently overlook a
  // gap. Bodies are fenced with dynamic tilde fencing so any embedded
  // triple-backticks, JSON, terminal output, or nested fences in the
  // pasted text don't break packet structure.

  const includedAndMissing = inclusion.filter((r) => r.category !== 'excluded');
  const excludedRows = inclusion.filter((r) => r.category === 'excluded');

  const responsesBlock = includedAndMissing
    .map((row) => {
      const response = modelResponses.find((r) => r.modelProfileId === row.modelProfileId);
      const vendorLine = row.vendor && row.modelName ? `**Vendor / Model:** ${row.vendor} / ${row.modelName}  \n` : '';
      const pastedLine = row.pastedAt ? `**Pasted At:** ${row.pastedAt}  \n` : '';
      const statusLine = `**Status:** ${row.status}  \n`;

      if (row.category === 'missing') {
        return (
          `## ${row.modelDisplayName} — ${row.roleName}\n\n` +
          vendorLine +
          statusLine +
          pastedLine +
          `\n[Missing response body — this model did not return a usable response for this round. ` +
          `Note this gap explicitly in your synthesis. Do not fabricate the missing content.]\n`
        );
      }

      // included
      const body = response?.responseText ?? '';
      return (
        `## ${row.modelDisplayName} — ${row.roleName}\n\n` +
        vendorLine +
        statusLine +
        pastedLine +
        `**Body Length:** ${row.charCount.toLocaleString()} characters\n\n` +
        fence(body)
      );
    })
    .join('\n\n---\n\n');

  const excludedBlock =
    excludedRows.length > 0
      ? `\n\n---\n\n# Excluded Responses\n\n` +
        `_The following models had responses recorded for this round but were marked **excluded** ` +
        `by the user. They are listed here for transparency. Do **not** include their content in the synthesis._\n\n` +
        excludedRows
          .map((row) => {
            const vendorLine = row.vendor && row.modelName ? `Vendor / Model: ${row.vendor} / ${row.modelName}  \n` : '';
            const pastedLine = row.pastedAt ? `Pasted At: ${row.pastedAt}  \n` : '';
            return `## ${row.modelDisplayName} — ${row.roleName}\n\n${vendorLine}Status: excluded  \n${pastedLine}\n_(Excluded — body not provided to mediator.)_\n`;
          })
          .join('\n\n---\n\n')
      : '';

  const includedCount = inclusion.filter((r) => r.category === 'included').length;
  const totalSelected = selectedModels.length;

  const completionBanner =
    includedCount < totalSelected - excludedRows.length
      ? `\n> ⚠️ **Incomplete round:** ${includedCount}/${totalSelected - excludedRows.length} non-excluded model responses collected.\n> Synthesis will be based on available responses. Note incomplete lanes explicitly.\n`
      : `\n> ✓ All ${totalSelected - excludedRows.length} non-excluded model responses collected.\n`;

  const knownRisksSection =
    knownRisks.length > 0
      ? `\n## Known Risks From Prior Rounds\n${knownRisks.map((r) => `- ${r}`).join('\n')}\n`
      : '';

  const openQuestionsSection =
    openQuestions.length > 0
      ? `\n## Open Questions From Prior Rounds\n${openQuestions.map((q) => `- ${q}`).join('\n')}\n`
      : '';

  return `# RoundTable — Mediator Synthesis Packet

---

## Project
**Name:** ${project.name}

**Description:** ${project.description}

**Current Phase:** ${project.currentPhase}

**Round:** ${roundNumber}

---

## Canonical Project State

${project.canonicalState}

---

## Round Instruction

${userInstruction}

---

## Participating Models
${rosterSummary}
${completionBanner}
---
${knownRisksSection}${openQuestionsSection}
# Model Responses for This Round

${responsesBlock}${excludedBlock}

---

## Your Role and Instructions

You are the mediator, architect, state keeper, phase planner, prompt engineer, and reviewer for this project.

**Weighting guidance:**
- Weight each model's input according to their assigned role.
- Implementation models (Opus, Sonnet) carry weight on technical feasibility.
- The independent critic (Gemini) carries weight on risks and blind spots.
- You carry weight on synthesis, coherence, and phase continuity.

**Important:**
- The user is the **final decision-maker**. Your synthesis is a recommendation, not a directive.
- Do **not** assume your proposed canonical state update will be applied automatically.
- Write the proposed canonical state update as a **user-reviewable proposal** that the user must approve.
- If model responses are missing, explicitly note the gap. Do not fabricate missing responses.
- Excluded responses (listed under "Excluded Responses" if present) must not contribute to the synthesis.

---

## Required Structured Output

Respond using **exactly** these section headings (### level). Do not skip sections.
If you have nothing to report for a section, write "(None identified this round)".

### Executive Summary
[2–4 sentences summarizing the most important findings and the key decision the user faces.]

### Agreements
[What did the models agree on? List concisely.]

### Disagreements
[What did the models disagree on? Be specific about who disagreed and why.]

### Risks
[What risks were identified by models or by you? Include risks they may have missed.]

### Open Questions
[What remains unresolved or requires the user's input before proceeding?]

### Model-Specific Observations
[Notable observations about individual model performance, lane adherence, or blind spots this round.]

### Recommended Decision
[Your recommended decision for the user's consideration. One clear recommendation.]

### Decision Rationale
[Why you recommend this decision. What evidence supports it?]

### Proposed Canonical State Update
[A proposed update to the project's canonical state, reflecting decisions made this round.
Write this as a user-reviewable proposal. The app will NOT apply this automatically.
The user must review, edit, and explicitly approve before it is added to the project state.]

### Proposed Next Actions
[Concrete next steps. Numbered list. What should happen immediately after this round?]

### Proposed Next-Round Prompt
[A ready-to-use user instruction for the next round. Write it so the user can copy it directly into the Round Builder.]

### Confidence / Caveats
[Your confidence level in this synthesis. What caveats should the user consider? What could make your recommendation wrong?]`;
}
