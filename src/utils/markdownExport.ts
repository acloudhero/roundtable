// src/utils/markdownExport.ts
// Purpose: Human-readable Markdown exports for review, handoff, and archiving.
// Phase 5: multiple export types with fenced blocks around user/model content.
// Phase 5.1: triple-backtick fencing replaced with DYNAMIC TILDE FENCING.
// Owned by: this file
// Used by: ExportImportPanel
//
// FENCING RULE — IMPORTANT:
// Large user-authored or model-authored content is wrapped in dynamic tilde
// fences (~~~~markdown ... ~~~~), NOT triple backticks. The `fence()` helper
// counts the longest run of consecutive tildes already in the content and
// emits a fence of at least 4 tildes, or one longer than the longest run.
// This ensures embedded code fences (including triple-backtick blocks pasted
// from model responses) do not prematurely close the export's outer fence
// and break the document structure.
//
// Apply to: canonical state, generated prompts, model responses, mediator
// packet, mediator response, mediator synthesis fields, decision rationale
// (when long), canonical state updates, and prompt templates.
//
// Do NOT replace `fence()` with naive triple-backtick fencing — that is the
// exact regression Phase 5.1 fixed.

import { AppState } from '../types/appState';
import { Round, MediatorSynthesis } from '../types/round';
import { Project } from '../types/project';
import { Decision } from '../types/decision';
import { nowIso, formatDisplay } from './dateTime';
import { SCHEMA_VERSION, APP_VERSION } from '../config/exportFormats';

// ── Utilities ─────────────────────────────────────────────────────────────────

// fence() uses dynamic tilde fencing to safely wrap content that may itself
// contain triple-backtick code fences. We count the longest existing tilde
// run in the content and use at least 4 or one more than that.
//
// Exported (v0.10.3) so mediatorPacket.ts and any other future Markdown
// generators can reuse the same safe-fence behavior. Do not duplicate this
// logic elsewhere.
export function fence(content: string, lang = 'markdown'): string {
  if (!content || !content.trim()) return '_None_';
  const trimmed = content.trim();
  // Find the longest run of tildes already in the content
  const runs = trimmed.match(/~+/g) ?? [];
  const maxRun = runs.reduce((m, r) => Math.max(m, r.length), 0);
  const fenceLen = Math.max(4, maxRun + 1);
  const fence = '~'.repeat(fenceLen);
  return `${fence}${lang}\n${trimmed}\n${fence}`;
}

function exportHeader(title: string, exportedAt: string): string {
  return `# ${title}\n\n_Exported: ${formatDisplay(exportedAt)}_  \n_Schema: ${SCHEMA_VERSION}_\n\n---\n\n`;
}

// ── 1. Full Project History ───────────────────────────────────────────────────

export function exportProjectHistory(state: AppState): string {
  const now = nowIso();
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  if (!project) return `# RoundTable Export\n\nNo active project.\n\nExported: ${formatDisplay(now)}`;

  const rounds = state.rounds.filter((r) => r.projectId === project.id).sort((a, b) => a.roundNumber - b.roundNumber);
  const decisions = state.decisions.filter((d) => d.projectId === project.id);

  const roundBlocks = rounds.map((r) => formatRoundBlock(r, state, decisions)).join('\n\n---\n\n');

  return exportHeader(`${project.name} — Full Project History`, now)
    + formatProjectMeta(project)
    + `## Canonical State\n\n${fence(project.canonicalState)}\n\n---\n\n`
    + `## Rounds\n\n${roundBlocks || '_No rounds yet._'}\n\n---\n\n`
    + `_End of history export._\n`;
}

// ── 2. Project Summary ────────────────────────────────────────────────────────

export function exportProjectSummary(state: AppState): string {
  const now = nowIso();
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  if (!project) return `# RoundTable Summary\n\nNo active project.`;

  const rounds = state.rounds.filter((r) => r.projectId === project.id);
  const decisions = state.decisions.filter((d) => d.projectId === project.id);
  const latestRound = rounds.sort((a, b) => b.roundNumber - a.roundNumber)[0];

  const openQ = latestRound?.openQuestions ?? [];
  const risks = latestRound?.risks ?? [];
  const nextActions = latestRound?.nextActions ?? [];
  const nextPrompt = latestRound?.mediatorSynthesis?.proposedNextRoundPrompt ?? '';

  return exportHeader(`${project.name} — Project Summary`, now)
    + formatProjectMeta(project)
    + `## Canonical State\n\n${fence(project.canonicalState)}\n\n---\n\n`
    + `## Status\n\n`
    + `| Item | Count |\n|---|---|\n`
    + `| Total Rounds | ${rounds.length} |\n`
    + `| Locked Rounds | ${rounds.filter((r) => r.locked).length} |\n`
    + `| Decisions | ${decisions.length} |\n\n---\n\n`
    + (risks.length > 0 ? `## Open Risks\n\n${risks.map((r) => `- ${r}`).join('\n')}\n\n---\n\n` : '')
    + (openQ.length > 0 ? `## Open Questions\n\n${openQ.map((q) => `- ${q}`).join('\n')}\n\n---\n\n` : '')
    + (nextActions.length > 0 ? `## Next Actions\n\n${nextActions.map((a) => `- ${a}`).join('\n')}\n\n---\n\n` : '')
    + (nextPrompt ? `## Proposed Next-Round Prompt\n\n${fence(nextPrompt)}\n\n---\n\n` : '')
    + `_End of summary._\n`;
}

// ── 3. Current Round Packet ───────────────────────────────────────────────────

export function exportCurrentRound(state: AppState): string {
  const now = nowIso();
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const round = state.rounds
    .filter((r) => r.projectId === project?.id)
    .sort((a, b) => b.roundNumber - a.roundNumber)[0];

  if (!project || !round) return `# RoundTable Round Export\n\nNo round found.\n\nExported: ${formatDisplay(now)}`;
  const decisions = state.decisions.filter((d) => d.roundId === round.id);

  return exportHeader(`${project.name} — Round ${round.roundNumber}`, now)
    + formatRoundBlock(round, state, decisions)
    + '\n\n---\n\n_End of round export._\n';
}

// ── 4. Decision Log ───────────────────────────────────────────────────────────

export function exportDecisionLog(state: AppState): string {
  const now = nowIso();
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  if (!project) return `# RoundTable Decision Log\n\nNo active project.`;

  const decisions = state.decisions.filter((d) => d.projectId === project.id);
  const rounds = state.rounds.filter((r) => r.projectId === project.id);

  const decisionBlocks = [...decisions].reverse().map((d: Decision) => {
    const round = rounds.find((r) => r.id === d.roundId);
    return `## Decision — Round ${round?.roundNumber ?? '?'} · ${formatDisplay(d.createdAt)}\n\n`
      + `**Phase:** ${d.phase ?? 'Unknown'}\n\n`
      + `**Decision:**\n\n${fence(d.decisionText)}\n\n`
      + (d.rationale ? `**Rationale:**\n\n${fence(d.rationale)}\n\n` : '')
      + (d.nextAction ? `**Next Action:** ${d.nextAction}\n\n` : '')
      + (round?.canonicalStateUpdate ? `**Canonical State Update Applied:**\n\n${fence(round.canonicalStateUpdate)}\n\n` : '');
  }).join('---\n\n');

  return exportHeader(`${project.name} — Decision Log`, now)
    + (decisionBlocks || '_No decisions recorded yet._')
    + '\n\n---\n\n_End of decision log._\n';
}

// ── 5. Compatibility Notes ────────────────────────────────────────────────────

export function exportCompatibilityNotes(state: AppState): string {
  const now = nowIso();
  const notes = state.compatibilityNotes;

  const active = notes.filter((n) => n.status === 'active');
  const watching = notes.filter((n) => n.status === 'watching');
  const resolved = notes.filter((n) => n.status === 'resolved');
  const deprecated = notes.filter((n) => n.status === 'deprecated');

  const formatNotes = (ns: typeof notes) =>
    ns
      .map((n) => {
        const sev = n.severity ? `**Severity:** ${n.severity}  \n` : '';
        const impact = n.impact ? `**Impact:** ${n.impact}\n\n` : '';
        const reviewed = n.reviewedAt ? `**Last Reviewed:** ${n.reviewedAt}  \n` : '';
        const linked = [
          n.linkedModelProfileId ? `model:${n.linkedModelProfileId}` : '',
          n.linkedPromptTemplateId ? `template:${n.linkedPromptTemplateId}` : '',
          n.linkedPromptWrapperId ? `wrapper:${n.linkedPromptWrapperId}` : '',
        ]
          .filter(Boolean)
          .join(', ');
        const linkedLine = linked ? `**Linked:** ${linked}  \n` : '';
        return (
          `### ${n.modelName} (${n.vendor})\n\n` +
          sev +
          `**Status:** ${n.status}  \n` +
          `**Observed:** ${n.dateObserved}  \n` +
          reviewed +
          linkedLine +
          `\n` +
          `**Issue:** ${n.issue}\n\n` +
          impact +
          `**Workaround:** ${n.workaround}\n`
        );
      })
      .join('\n---\n\n');

  return (
    exportHeader('Compatibility Notes', now) +
    `## Active Issues (${active.length})\n\n${active.length > 0 ? formatNotes(active) : '_None._'}\n\n---\n\n` +
    `## Watching (${watching.length})\n\n${watching.length > 0 ? formatNotes(watching) : '_None._'}\n\n---\n\n` +
    `## Resolved (${resolved.length})\n\n${resolved.length > 0 ? formatNotes(resolved) : '_None._'}\n\n---\n\n` +
    `## Deprecated (${deprecated.length})\n\n${deprecated.length > 0 ? formatNotes(deprecated) : '_None._'}\n\n` +
    `---\n\n_End of compatibility notes._\n`
  );
}

// ── 6. Model Roster ───────────────────────────────────────────────────────────

export function exportModelRoster(state: AppState): string {
  const now = nowIso();
  return exportHeader('Model Roster', now)
    + state.modelProfiles.map((m) =>
      `## ${m.displayName}\n\n`
      + `**Vendor:** ${m.vendor}  \n`
      + `**Model:** ${m.modelName}  \n`
      + `**Role:** ${m.roleName}  \n`
      + `**Active:** ${m.active ? 'Yes' : 'No'}\n\n`
      + `**Role Prompt:**\n\n${fence(m.rolePrompt)}\n\n`
      + (m.promptStyleNotes ? `**Prompt Style Notes:** ${m.promptStyleNotes}\n\n` : '')
      + (m.contextLimitNotes ? `**Context Limit Notes:** ${m.contextLimitNotes}\n\n` : '')
    ).join('---\n\n')
    + `---\n\n_End of model roster._\n`;
}

// ── 7. Prompt Library ─────────────────────────────────────────────────────────

export function exportPromptLibrary(state: AppState): string {
  const now = nowIso();
  return exportHeader('Prompt Library', now)
    + state.promptTemplates.map((t) =>
      `## ${t.name}\n\n`
      + `**Purpose:** ${t.purpose}\n\n`
      + (t.notes ? `**Notes:** ${t.notes}\n\n` : '')
      + `**Variables:** ${t.variables.map((v) => `\`{{${v}}}\``).join(', ')}\n\n`
      + `**Template:**\n\n${fence(t.templateText)}\n\n`
    ).join('---\n\n')
    + `---\n\n_End of prompt library._\n`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatProjectMeta(project: Project): string {
  return `## ${project.name}\n\n`
    + `**Phase:** ${project.currentPhase}\n\n`
    + `**Description:** ${project.description}\n\n`
    + `**Last Updated:** ${formatDisplay(project.updatedAt)}\n\n---\n\n`;
}

function formatRoundBlock(round: Round, state: AppState, decisions: Decision[]): string {
  const decision = decisions.find((d) => d.roundId === round.id);
  const selectedModels = state.modelProfiles.filter((m) => round.selectedModelIds.includes(m.id));

  const promptBlocks = round.generatedPrompts.map((gp) =>
    `### Prompt → ${gp.modelDisplayName}\n\n`
    + `_Generated: ${formatDisplay(gp.generatedAt)}_`
    + (gp.copiedAt ? `  \n_Copied: ${formatDisplay(gp.copiedAt)}_` : '')
    + `\n\n${fence(gp.promptText)}\n`
  ).join('\n');

  const responseBlocks = round.modelResponses.map((mr) =>
    `### Response ← ${mr.modelDisplayName}\n\n`
    + `_Status: ${mr.status}_`
    + (mr.pastedAt ? `  \n_Pasted: ${formatDisplay(mr.pastedAt)}_` : '')
    + `\n\n${fence(mr.responseText)}\n`
  ).join('\n');

  const synthBlock = round.mediatorSynthesis ? formatSynthesisBlock(round.mediatorSynthesis) : '';

  return `## Round ${round.roundNumber} — ${round.phase}\n\n`
    + `**Status:** ${round.locked ? '🔒 Locked' : '✏️ Active'}  \n`
    + `**Created:** ${formatDisplay(round.createdAt)}\n\n`
    + `**Instruction:**\n\n${fence(round.userInstruction)}\n\n`
    + (selectedModels.length > 0 ? `**Models:** ${selectedModels.map((m) => m.displayName).join(', ')}\n\n` : '')
    + (promptBlocks ? `### Generated Prompts\n\n${promptBlocks}\n` : '')
    + (responseBlocks ? `### Model Responses\n\n${responseBlocks}\n` : '')
    + (round.mediatorResponse ? `### Mediator Response\n\n${fence(round.mediatorResponse)}\n\n` : '')
    + (synthBlock ? `### Mediator Synthesis\n\n${synthBlock}\n` : '')
    + (decision ? `### User Decision\n\n${fence(decision.decisionText)}\n\n`
        + (decision.rationale ? `**Rationale:**\n\n${fence(decision.rationale)}\n\n` : '')
        + (decision.nextAction ? `**Next Action:** ${decision.nextAction}\n\n` : '') : '')
    + (round.canonicalStateUpdate ? `### Canonical State Update Applied\n\n${fence(round.canonicalStateUpdate)}\n\n` : '');
}

function formatSynthesisBlock(s: MediatorSynthesis): string {
  const fields: [string, string][] = [
    ['Executive Summary', s.executiveSummary],
    ['Agreements', s.agreements],
    ['Disagreements', s.disagreements],
    ['Risks', s.risks],
    ['Open Questions', s.openQuestions],
    ['Recommended Decision', s.recommendedDecision],
    ['Decision Rationale', s.decisionRationale],
    ['Proposed Canonical State Update', s.proposedCanonicalStateUpdate],
    ['Proposed Next Actions', s.proposedNextActions],
    ['Proposed Next-Round Prompt', s.proposedNextRoundPrompt],
    ['Confidence / Caveats', s.confidenceCaveats],
  ];
  return fields
    .filter(([, v]) => v && v.trim())
    .map(([label, val]) => `**${label}:**\n\n${fence(val)}\n`)
    .join('\n');
}

// ── Legacy compat ─────────────────────────────────────────────────────────────
export function exportProjectMarkdown(state: AppState): string {
  return exportProjectSummary(state);
}

// ── 8. Mediator Packet ────────────────────────────────────────────────────────
// Distinct export of the exact mediator packet sent to GPT-5.5 Thinking.
// Separate from the Current Round export — focused on the packet itself.

export function exportMediatorPacket(state: AppState): string {
  const now = nowIso();
  const project = state.projects.find((p) => p.id === state.activeProjectId);

  if (!project) {
    return exportHeader('Mediator Packet', now) + '_No active project found._\n';
  }

  const round = state.rounds
    .filter((r) => r.projectId === project.id)
    .sort((a, b) => b.roundNumber - a.roundNumber)[0];

  if (!round) {
    return exportHeader('Mediator Packet', now) + '_No rounds found for this project._\n';
  }

  const selectedModels = state.modelProfiles.filter((m) =>
    round.selectedModelIds.includes(m.id)
  );

  const collectedCount = round.modelResponses.filter(
    (r) => r.status === 'pasted' || r.status === 'reviewed'
  ).length;

  const rosterLines = selectedModels.map((m) => {
    const response = round.modelResponses.find((r) => r.modelProfileId === m.id);
    const status = (response?.status === 'pasted' || response?.status === 'reviewed')
      ? '✓ Response collected'
      : '✗ Response not collected';
    return `- **${m.displayName}** — ${m.roleName} [${status}]`;
  }).join('\n');

  return exportHeader(`Mediator Packet — ${project.name} Round ${round.roundNumber}`, now)
    + `## Project\n\n**Name:** ${project.name}  \n`
    + `**Phase:** ${project.currentPhase}  \n`
    + `**Round:** ${round.roundNumber}  \n`
    + `**Round Status:** ${round.locked ? '🔒 Locked' : '✏️ Active'}\n\n---\n\n`
    + `## Round Instruction\n\n${fence(round.userInstruction)}\n\n---\n\n`
    + `## Canonical State\n\n${fence(project.canonicalState)}\n\n---\n\n`
    + `## Selected Models (${selectedModels.length})\n\n${rosterLines || '_None._'}\n\n`
    + `**Response collection:** ${collectedCount}/${selectedModels.length}\n\n---\n\n`
    + (round.mediatorPrompt
      ? `## Mediator Packet (Sent to GPT-5.5 Thinking)\n\n${fence(round.mediatorPrompt)}\n\n---\n\n`
      : `## Mediator Packet\n\n_No mediator packet has been generated for this round yet._\n\n---\n\n`)
    + `_End of mediator packet export._\n`;
}

export function mediatorPacketFilename(state: AppState): string {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const safeName = (project?.name ?? 'Project').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const round = state.rounds
    .filter((r) => r.projectId === project?.id)
    .sort((a, b) => b.roundNumber - a.roundNumber)[0];
  const roundNum = round?.roundNumber ?? 0;
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `ROUNDTABLE_MEDIATOR_PACKET_${safeName}_Round-${roundNum}_${dateStamp}.md`;
}

// ── 9. Gemini Review Packet (Phase 7A) ────────────────────────────────────────
//
// A curated Markdown packet for *manual* external review by Gemini (or any
// other reviewer the user chooses). It contains:
//   - Review context: what we're asking the reviewer to do
//   - Project metadata: name, phase, app version, schema version, exportedAt
//   - Latest round summary: instruction, selected models, collection status
//   - Mediator synthesis summary
//   - Decision status and locked status
//   - Risks and open questions from the round
//   - Compatibility notes summary
//   - Specific questions for Gemini (placeholder — user edits before sending)
//   - Known limitations (placeholder)
//
// Local-only. No network calls. No auto-upload. The user reads this packet,
// edits the placeholders, and pastes it into Gemini themselves — same
// manual-copy/paste boundary as every other workflow in the app.
//
// All large user-/model-authored content is wrapped with the dynamic tilde
// fence helper so embedded code fences in canonical state, mediator
// synthesis, etc. don't break the packet structure.

export function exportGeminiReviewPacket(state: AppState): string {
  const now = nowIso();
  const project = state.projects.find((p) => p.id === state.activeProjectId);

  if (!project) {
    return exportHeader('RoundTable — Gemini Review Packet', now)
      + '_No active project. Set up a project before exporting a review packet._\n';
  }

  const round = state.rounds
    .filter((r) => r.projectId === project.id)
    .sort((a, b) => b.roundNumber - a.roundNumber)[0];

  const decision = round
    ? state.decisions.find((d) => d.roundId === round.id)
    : undefined;

  const selectedModels = round
    ? state.modelProfiles.filter((m) => round.selectedModelIds.includes(m.id))
    : [];

  const collectedCount = round
    ? round.modelResponses.filter(
        (r) => r.status === 'pasted' || r.status === 'reviewed'
      ).length
    : 0;

  const rosterLines =
    round && selectedModels.length > 0
      ? selectedModels
          .map((m) => {
            const resp = round.modelResponses.find((r) => r.modelProfileId === m.id);
            const status =
              resp?.status === 'pasted' || resp?.status === 'reviewed'
                ? '✓ Response collected'
                : '✗ Response not collected';
            return `- **${m.displayName}** — ${m.roleName} [${status}]`;
          })
          .join('\n')
      : '_No models selected for the latest round._';

  // Compatibility notes summary — group by status.
  const activeNotes = state.compatibilityNotes.filter((n) => n.status === 'active');
  const watchingNotes = state.compatibilityNotes.filter((n) => n.status === 'watching');
  const resolvedNotes = state.compatibilityNotes.filter((n) => n.status === 'resolved');
  const compatLines = [
    `- **Active:** ${activeNotes.length}`,
    `- **Watching:** ${watchingNotes.length}`,
    `- **Resolved:** ${resolvedNotes.length}`,
  ].join('\n');

  const synthesisBlock = (() => {
    if (!round?.mediatorSynthesis) return '_No mediator synthesis recorded for the latest round._';
    const ms = round.mediatorSynthesis;
    return [
      ms.executiveSummary && `### Executive Summary\n${fence(ms.executiveSummary)}`,
      ms.agreements && `### Agreements\n${fence(ms.agreements)}`,
      ms.disagreements && `### Disagreements\n${fence(ms.disagreements)}`,
      ms.risks && `### Risks\n${fence(ms.risks)}`,
      ms.openQuestions && `### Open Questions\n${fence(ms.openQuestions)}`,
      ms.recommendedDecision && `### Recommended Decision\n${fence(ms.recommendedDecision)}`,
      ms.confidenceCaveats && `### Confidence / Caveats\n${fence(ms.confidenceCaveats)}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  })();

  const decisionBlock = decision
    ? `**Status:** ${round?.locked ? '🔒 Locked & decided' : '✏️ Decided (round not yet locked)'}\n\n`
      + `**Decision:**\n\n${fence(decision.decisionText)}\n\n`
      + (decision.rationale ? `**Rationale:**\n\n${fence(decision.rationale)}\n` : '')
    : (round?.locked
        ? '_Round is locked but no decision is recorded for it (data integrity warning)._'
        : '_No decision recorded for the latest round yet._');

  const risksBlock =
    round && round.risks.length > 0
      ? round.risks.map((r) => `- ${r}`).join('\n')
      : '_None recorded._';

  const openQuestionsBlock =
    round && round.openQuestions.length > 0
      ? round.openQuestions.map((q) => `- ${q}`).join('\n')
      : '_None recorded._';

  // Header + review context
  let out = exportHeader(
    `RoundTable — Gemini Review Packet — ${project.name}`,
    now
  );

  out += `## Review Context\n\n`;
  out += `This packet is a **local Markdown export** prepared by RoundTable for **manual external review by Gemini** (or any reviewer the user chooses). RoundTable does not call Gemini, upload to Gemini, or automate any reviewer interaction. The user pastes this packet into Gemini manually.\n\n`;
  out += `Reviewers are asked to assess the round summary, mediator synthesis, and decision status against the project's canonical state, then provide structured critique using the "Specific Questions for Gemini" prompts at the end of this packet.\n\n---\n\n`;

  // Project metadata
  out += `## Project Metadata\n\n`;
  out += `- **Name:** ${project.name}\n`;
  out += `- **Current Phase:** ${project.currentPhase || '_(not set)_'}\n`;
  out += `- **App Version:** ${APP_VERSION}\n`;
  out += `- **Schema Version:** ${state.schemaVersion}\n`;
  out += `- **GPT-5.5 Mediator Gate Status:** _<edit before sending: e.g. "Phase X.Y approved by GPT-5.5 Thinking on YYYY-MM-DD" or "pending mediator review">_\n\n---\n\n`;

  // Project overview / canonical state
  out += `## Project Overview\n\n`;
  out += project.description
    ? `${fence(project.description)}\n\n`
    : `_No project description recorded._\n\n`;

  out += `### Canonical State\n\n`;
  out += `${fence(project.canonicalState)}\n\n---\n\n`;

  // Latest round summary
  if (!round) {
    out += `## Latest Round\n\n_No rounds recorded for this project yet._\n\n---\n\n`;
  } else {
    out += `## Latest Round Summary — Round ${round.roundNumber}\n\n`;
    out += `- **Phase:** ${round.phase || '_(not set)_'}\n`;
    out += `- **Round Status:** ${round.locked ? '🔒 Locked' : '✏️ Active'}\n`;
    out += `- **Selected Models:** ${selectedModels.length}\n`;
    out += `- **Response Collection:** ${collectedCount}/${selectedModels.length}\n\n`;
    out += `### Round Instruction\n\n${fence(round.userInstruction)}\n\n`;
    out += `### Roster & Response Status\n\n${rosterLines}\n\n---\n\n`;

    out += `## Mediator Synthesis Summary\n\n`;
    out += `${synthesisBlock}\n\n---\n\n`;

    out += `## Decision Status\n\n`;
    out += `${decisionBlock}\n\n---\n\n`;

    out += `## Current Risks\n\n${risksBlock}\n\n`;
    out += `## Current Open Questions\n\n${openQuestionsBlock}\n\n---\n\n`;
  }

  // Compatibility notes summary
  out += `## Compatibility Notes Summary\n\n${compatLines}\n\n`;
  if (activeNotes.length > 0) {
    out += `### Active Notes\n\n`;
    out += activeNotes
      .map((n) => {
        const sev = n.severity ? ` _[${n.severity}]_` : '';
        return `- **${n.vendor} ${n.modelName}**${sev} — ${n.issue}`;
      })
      .join('\n');
    out += `\n\n`;
  }
  out += `---\n\n`;

  // ── Phase 7B: vendor resilience surfaces ──────────────────────────────────
  // Surfacing model profiles, prompt wrappers, prompt template versions, and
  // compatibility test names lets the external reviewer see the model-behavior
  // assumptions baked into this round. Keep it concise — the reviewer doesn't
  // need full configurations, just the shape and version.

  // Model profile summary (active only)
  const activeProfiles = state.modelProfiles.filter((m) => m.active);
  if (activeProfiles.length > 0) {
    out += `## Model Profile Summary (Phase 7B)\n\n`;
    out += `_Active profiles. Edit \`src/config/modelProfiles.ts\` or the Model Roster panel to update._\n\n`;
    out += activeProfiles
      .map((m) => {
        const wrap = m.defaultPromptWrapperId ? ` · wrapper: \`${m.defaultPromptWrapperId}\`` : '';
        const ver = m.profileVersion ? ` · profile v${m.profileVersion}` : '';
        const reviewed = m.lastReviewedAt ? ` · reviewed ${m.lastReviewedAt}` : '';
        return `- **${m.displayName}** (${m.vendor}/${m.modelName}) — ${m.roleName}${wrap}${ver}${reviewed}`;
      })
      .join('\n');
    out += `\n\n---\n\n`;
  }

  // Prompt wrapper summary
  const activeWrappers = (state.promptWrappers ?? []).filter((w) => w.active !== false);
  if (activeWrappers.length > 0) {
    out += `## Prompt Wrapper Summary (Phase 7B)\n\n`;
    out += `_The vendor-specific framing layer that wraps the Context Sandwich. Edit \`src/config/promptWrappers.ts\` or AppState.promptWrappers to update._\n\n`;
    out += activeWrappers
      .map((w) => {
        const target = [w.targetVendor, w.targetRole].filter(Boolean).join(' / ');
        const ver = w.version ? ` · v${w.version}` : '';
        return `- **${w.name}** (\`${w.id}\`)${target ? ` — ${target}` : ''}${ver}\n  Purpose: ${w.purpose}`;
      })
      .join('\n');
    out += `\n\n---\n\n`;
  }

  // Prompt template version summary
  const activeTemplates = state.promptTemplates.filter((t) => t.active !== false);
  if (activeTemplates.length > 0) {
    out += `## Prompt Template Versions (Phase 7B)\n\n`;
    out += activeTemplates
      .map((t) => {
        const ver = t.version ? ` · v${t.version}` : '';
        const updated = t.updatedAt ? ` · updated ${t.updatedAt}` : '';
        const supersedes = t.supersedesTemplateId ? ` · supersedes \`${t.supersedesTemplateId}\`` : '';
        return `- **${t.name}** (\`${t.id}\`)${ver}${updated}${supersedes}\n  Purpose: ${t.purpose}`;
      })
      .join('\n');
    out += `\n\n---\n\n`;
  }

  // Compatibility test prompts library (names + purpose only — full text would
  // bloat the packet and the reviewer can request specific tests if needed).
  // The tests themselves live in `src/config/compatibilityTests.ts`.
  out += `## Compatibility Test Prompt Library (Phase 7B)\n\n`;
  out += `_Manual paste-into-model behavior tests. Names below; full prompts live in \`src/config/compatibilityTests.ts\`. RoundTable does not run these — the user pastes them into the target model and reads the response._\n\n`;
  out += [
    '- **Structured Output Compliance** — verifies explicit ### headings appear as requested',
    '- **Markdown Formatting** — verifies clean Markdown that survives RoundTable export fences',
    '- **Implementation Report Shape** — verifies Claude-style build report format',
    '- **Architecture Critique Shape (Gemini)** — verifies risk/gate/disagreements format',
    '- **Mediator Synthesis Shape (GPT-5.5)** — verifies all 12 synthesis sections appear',
    '- **Summary + Checklist Shape (Haiku)** — verifies brevity caps are honored',
  ].join('\n');
  out += `\n\n---\n\n`;

  // Validation/migration summary placeholder
  out += `## Validation / Migration Summary\n\n`;
  out += `_This export is generated from the live local state. No import was processed during this export, so no migration or validation summary applies. If you imported a backup recently, reference the import preview from that session for migration/repair details._\n\n---\n\n`;

  // Questions for Gemini
  out += `## Specific Questions for Gemini\n\n`;
  out += `_Edit these prompts before sending the packet. Defaults are starting points; tailor to the round's actual concerns._\n\n`;
  out += `1. Does the latest round's decision align with the canonical project state, or does it introduce drift?\n`;
  out += `2. Are there risks or open questions in the round that the mediator synthesis under-weighted?\n`;
  out += `3. Are any of the active compatibility notes likely to invalidate assumptions in the synthesis?\n`;
  out += `4. Would you recommend any change to the canonical state language based on this round?\n`;
  out += `5. What would you push back on if you were the mediator for the next round?\n\n---\n\n`;

  // Known limitations
  out += `## Known Limitations\n\n`;
  out += `- This packet is a **point-in-time snapshot**. Subsequent rounds, edits, or imports are not reflected.\n`;
  out += `- Only the **latest round** is summarized in detail. The full history is in the Project History export.\n`;
  out += `- Mediator synthesis fields are user-reviewed but may still contain extraction artifacts; treat them as advisory.\n`;
  out += `- RoundTable does not call Gemini or any other model. This packet must be carried to the reviewer manually.\n\n`;

  out += `_End of Gemini review packet._\n`;
  return out;
}

export function geminiReviewPacketFilename(state: AppState): string {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const safeName = (project?.name ?? 'Project').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `ROUNDTABLE_GEMINI_REVIEW_${safeName}_${dateStamp}.md`;
}
