// src/components/RoundBuilderPanel.tsx
// Purpose: Create rounds, select models, generate Context Sandwich prompts, track copy status
// Phase 3.1: getCurrentRound() used for read-only display when latest round is locked
//            getActiveRound() still used for editable workflow logic

import { useState, useEffect } from 'react';
import { AppState, AppStateUpdater } from '../types/appState';
import { Round, GeneratedPrompt } from '../types/round';
import { ModelProfile } from '../types/modelProfile';
import { CompatibilityNote, CompatibilitySeverity } from '../types/compatibilityNote';
import {
  createRound,
  generatePromptsForRound,
  markPromptCopied,
  getActiveRound,
  getCurrentRound,
  getRoundProgress,
  updateRoundFunctional,
} from '../utils/roundUtils';
import { copyToClipboard } from '../utils/clipboard';
import { downloadMarkdownArtifact } from '../utils/markdownArtifactDownload';
// v0.11.0 Checkpoint C.5: capture canonical-state hash at prompt-generation
// time so downstream Markdown handoff artifacts stamp the state-at-generation
// hash on their frontmatter rather than the state-at-export hash. The
// downstream Download .md path already prefers this stored hash when
// present (see handleDownload below).
import { hashProjectCanonicalState } from '../utils/markdownArtifact';
// v0.11.0 Checkpoint D — Upload .md → preview → Raw Notes flow.
import { useMarkdownUpload } from '../hooks/useMarkdownUpload';
import ImportPreviewModal from './ImportPreviewModal';
import { nowIso, formatDisplay } from '../utils/dateTime';

interface Props {
  state: AppState;
  onUpdate: (updated: AppStateUpdater) => void;
  onNavigate: (tab: string) => void;
}

export default function RoundBuilderPanel({ state, onUpdate, onNavigate }: Props) {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const activeModels = state.modelProfiles.filter((m) => m.active);

  // activeRound: unlocked round for editable workflow
  const activeRound = getActiveRound(state);
  // currentRound: latest round regardless of locked — for read-only display
  const currentRound = getCurrentRound(state);

  // v0.11.0 Checkpoint D — Upload .md → Import Preview → Raw Notes.
  //
  // Round Builder accepts uploads at the panel level. The hook routes
  // body and parsed frontmatter through buildImportPreview; the modal
  // detects source_kind and offers Cancel / Import as Raw Notes only.
  // Structured commit (which would replace-or-append a generated prompt
  // on the current round) arrives in Checkpoint E.
  const mdUpload = useMarkdownUpload(state, onUpdate, { panelLabel: 'in Round Builder' });

  const [instruction, setInstruction] = useState(activeRound?.userInstruction ?? '');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(
    activeRound?.selectedModelIds ?? activeModels.map((m) => m.id)
  );
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState<string | null>(null);
  // v0.11.0 Checkpoint C: per-prompt Download .md state. Separate from
  // copy state so the two affordances can be in-flight independently.
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadFailed, setDownloadFailed] = useState<string | null>(null);
  const [showNewRoundWarning, setShowNewRoundWarning] = useState(false);

  useEffect(() => {
    setInstruction(activeRound?.userInstruction ?? '');
    setSelectedModelIds(activeRound?.selectedModelIds ?? activeModels.map((m) => m.id));
  }, [activeRound?.id]);

  const progress = activeRound ? getRoundProgress(activeRound) : null;

  const toggleModel = (id: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSaveInstruction = () => {
    if (!activeRound || !project) return;
    // v0.10.5: migrated from replaceRound(state, ...) to functional updater
    // for Total Serialization consistency. Captures the latest round
    // inside the recipe rather than the closure.
    onUpdate(
      updateRoundFunctional(activeRound.id, (liveRound: Round): Round => ({
        ...liveRound,
        userInstruction: instruction,
        selectedModelIds,
        updatedAt: nowIso(),
      }))
    );
  };

  const handleNewRound = () => {
    if (!project) return;
    if (activeRound && !activeRound.locked && activeRound.generatedPrompts.length > 0) {
      setShowNewRoundWarning(true);
      return;
    }
    doCreateRound();
  };

  const doCreateRound = () => {
    if (!project) return;
    const round = createRound(project, state.rounds);
    onUpdate({ rounds: [...state.rounds, round] });
    setInstruction('');
    setSelectedModelIds(activeModels.map((m) => m.id));
    setShowNewRoundWarning(false);
  };

  const handleGenerate = async () => {
    if (!project || !activeRound || !instruction.trim()) return;
    // v0.10.5: migrated to functional updater. modelProfiles/compatibilityNotes/
    // promptWrappers are read-only config slices that don't mutate during
    // this operation — closure-capture is safe for those. We use the
    // recipe to compose prompts against the *latest* round (in case a
    // concurrent commit landed in the same batch).
    const capturedProject = project;
    const capturedProfiles = state.modelProfiles;
    const capturedCompat = state.compatibilityNotes;
    const capturedWrappers = state.promptWrappers;
    const capturedInstruction = instruction;
    const capturedSelectedIds = selectedModelIds;

    // v0.11.0 Checkpoint C.5: capture the project canonical-state hash
    // BEFORE the functional dispatch so the hash represents state at
    // *generation* time, not state-at-export time. The hash is the same
    // SHA-256 over the normalized canonical state that buildArtifact uses,
    // so the artifact's canonical_state_hash frontmatter field will match
    // exactly when the prompt is later exported as a .md artifact.
    //
    // Graceful degradation:
    //   - hashProjectCanonicalState returns null when SubtleCrypto is
    //     unavailable (e.g. file:// origin). Null is propagated through
    //     to generatePromptsForRound, which simply does not stamp the
    //     field — equivalent to a pre-v0.11.0 prompt. No throw, no
    //     blocking UI, no failed generation.
    //   - If the await itself throws (extremely unlikely — we catch
    //     defensively), we fall back to null and continue.
    let capturedHash: string | null = null;
    try {
      capturedHash = await hashProjectCanonicalState(capturedProject);
    } catch (err) {
      console.warn(
        '[RoundTable] Could not hash project canonical state at prompt generation. ' +
        'Continuing without canonicalStateHashAtGeneration provenance.',
        err
      );
      capturedHash = null;
    }

    onUpdate(
      updateRoundFunctional(activeRound.id, (liveRound) => {
        const withInstruction = {
          ...liveRound,
          userInstruction: capturedInstruction,
          selectedModelIds: capturedSelectedIds,
          updatedAt: nowIso(),
        };
        return generatePromptsForRound(
          withInstruction,
          capturedProject,
          capturedProfiles,
          capturedCompat,
          capturedWrappers,
          // v0.11.0 Checkpoint C.5: pass the captured hash through. The
          // helper stamps it onto each new GeneratedPrompt as
          // canonicalStateHashAtGeneration; null is preserved as "no
          // hash available", which the downstream UI handles silently.
          capturedHash
        );
      })
    );
  };

  const handleCopy = async (prompt: GeneratedPrompt) => {
    if (!activeRound) return;
    setCopyingId(prompt.id);
    setCopyFailed(null);
    const success = await copyToClipboard(prompt.promptText);
    if (success) {
      // v0.10.5: migrated to functional updater. markPromptCopied operates
      // on the round it receives; calling it inside the recipe means we
      // mark the prompt on the latest round.
      onUpdate(
        updateRoundFunctional(activeRound.id, (liveRound) =>
          markPromptCopied(liveRound, prompt.id)
        )
      );
    } else {
      setCopyFailed(prompt.id);
    }
    setCopyingId(null);
  };

  // v0.11.0 Checkpoint C — Download .md for a generated prompt.
  //
  // Same source string contract: the artifact body wraps prompt.promptText
  // verbatim (via the dynamic-tilde fence helper) so the .md file's body
  // is the exact prompt text that Copy puts on the clipboard. The wrapper
  // (frontmatter + heading + fence) is the structured-artifact frame;
  // the inner prompt content is unchanged.
  //
  // Downloads do NOT mark the prompt as copied (downloading is a separate
  // affordance from the "I'm about to paste this into a model chat" copy
  // semantics that drive prompt.status).
  const handleDownload = async (prompt: GeneratedPrompt) => {
    if (!activeRound || !project) return;
    setDownloadingId(prompt.id);
    setDownloadFailed(null);
    try {
      await downloadMarkdownArtifact({
        kind: 'generated_prompt',
        ctx: {
          project,
          // Prefer the prompt's stored canonicalStateHashAtGeneration when
          // present (it ties the artifact to state-at-generation rather
          // than state-at-export). When absent (pre-v0.11.0 prompts or
          // ones generated before the capture wiring lands), buildArtifact
          // falls back to computing the *current* canonical state hash.
          canonicalStateHash: prompt.canonicalStateHashAtGeneration,
        },
        round: activeRound,
        promptId: prompt.id,
      });
    } catch (err) {
      console.error('[RoundTable] Prompt .md download failed:', err);
      setDownloadFailed(prompt.id);
    } finally {
      setDownloadingId(null);
    }
  };

  if (!project) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No active project</div>
          <div className="empty-state-desc">Set up a project in the Project State tab first.</div>
        </div>
      </div>
    );
  }

  const canGenerate = !!activeRound && instruction.trim().length > 0 && selectedModelIds.length > 0;
  const displayRound = activeRound ?? currentRound;

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex-between">
          <div>
            <h1 className="panel-title">Round Builder</h1>
            <p className="panel-desc">Set instruction → select models → generate prompts → copy to each model manually</p>
          </div>
          <div className="flex gap-8 flex-center">
            {displayRound && (
              <span className={`locked-badge ${displayRound.locked ? 'locked' : 'unlocked'}`}>
                {displayRound.locked ? `🔒 Round ${displayRound.roundNumber} Locked` : `✏️ Round ${displayRound.roundNumber}`}
              </span>
            )}
            {/* v0.11.0 Checkpoint D — Upload .md affordance.
                Panel-level button. The hook detects source_kind from
                frontmatter; for Checkpoint D the only commit path is
                Import as Raw Notes. Structured commit (which would
                replace-or-append a generated prompt on the round) is
                deferred to Checkpoint E. */}
            <button
              className="btn btn-secondary"
              onClick={mdUpload.triggerUpload}
              disabled={mdUpload.loading}
              aria-label="Upload a .md handoff artifact"
              title="Upload a .md handoff artifact. Opens the import preview."
            >
              {mdUpload.loading ? '…Loading' : 'Upload .md'}
            </button>
            <button className="btn btn-secondary" onClick={handleNewRound}>
              + New Round
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input for the Upload .md button above. */}
      <input
        ref={mdUpload.fileInputRef}
        type="file"
        accept={mdUpload.acceptString}
        onChange={mdUpload.onFileInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      {mdUpload.error && (
        <div className="notice danger mb-12 text-xs">{mdUpload.error}</div>
      )}
      {mdUpload.status && (
        <div className="notice info mb-12 text-xs">{mdUpload.status}</div>
      )}

      {/* New round warning */}
      {showNewRoundWarning && (
        <div className="notice danger mb-16">
          <strong>Warning:</strong> Round {activeRound?.roundNumber} is active and has prompts. Creating a new round will leave it incomplete.
          <div className="flex gap-8 mt-8">
            <button className="btn btn-danger" onClick={doCreateRound}>Create New Round Anyway</button>
            <button className="btn btn-secondary" onClick={() => setShowNewRoundWarning(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* No rounds at all */}
      {!displayRound && (
        <div className="empty-state mb-16">
          <div className="empty-state-icon">🔄</div>
          <div className="empty-state-title">No rounds yet</div>
          <div className="empty-state-desc">Click <strong>+ New Round</strong> to begin your first round.</div>
        </div>
      )}

      {/* Locked round — read-only view */}
      {displayRound?.locked && (
        <>
          <div className="round-locked-banner">
            <span className="lock-icon">🔒</span>
            <div>
              <strong>Round {displayRound.roundNumber} is locked</strong> — decision recorded.
              <span className="text-muted" style={{ marginLeft: 8 }}>Use + New Round to continue.</span>
            </div>
          </div>

          <div className="card mb-16">
            <div className="card-header">
              <span className="card-title">Round {displayRound.roundNumber} — Instruction</span>
              <span className="badge badge-muted">{displayRound.phase}</span>
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {displayRound.userInstruction || '(No instruction recorded)'}
            </div>
          </div>

          {displayRound.generatedPrompts.length > 0 && (
            <>
              <div className="section-heading">Generated Prompts (Read-Only)</div>
              {displayRound.generatedPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onCopy={() => {}}
                  copying={false}
                  failed={false}
                  onDownload={() => {}}
                  downloading={false}
                  downloadFailed={false}
                  readonly
                />
              ))}
            </>
          )}

          {displayRound.userDecision && (
            <div className="card mt-16">
              <div className="card-title mb-8">Decision Recorded</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{displayRound.userDecision}</div>
            </div>
          )}
        </>
      )}

      {/* Active round — editable workflow */}
      {activeRound && !activeRound.locked && (
        <div className="workbench">
          {/* LEFT: Instruction + model selection */}
          <div>
            <div className="card mb-16">
              <div className="step-label">
                <span className="step-number">1</span>
                Round Instruction
                <span className="badge badge-muted" style={{ marginLeft: 6 }}>Round {activeRound.roundNumber}</span>
              </div>
              <div className="form-group">
                <label className="form-label">What should the models work on?</label>
                <textarea
                  className="form-textarea large"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Describe the specific task for this round..."
                />
              </div>
              <button className="btn btn-ghost text-xs" onClick={handleSaveInstruction} style={{ marginTop: 4 }}>
                Save instruction
              </button>
            </div>

            <div className="card">
              <div className="step-label mb-12">
                <span className="step-number">2</span>
                Select Models
                {selectedModelIds.length > 0 && (
                  <span className="badge badge-green" style={{ marginLeft: 6 }}>{selectedModelIds.length} selected</span>
                )}
              </div>
              {activeModels.map((model) => (
                <label key={model.id} className="flex-center gap-12" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedModelIds.includes(model.id)}
                    onChange={() => toggleModel(model.id)}
                    style={{ accentColor: 'var(--amber)', width: 16, height: 16 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{model.displayName}</div>
                    <div className="text-xs text-muted">{model.roleName}</div>
                  </div>
                </label>
              ))}

              {/* Phase 7B: passive compatibility warnings for the selected models. */}
              <CompatibilityWarnings
                selectedModelIds={selectedModelIds}
                modelProfiles={state.modelProfiles}
                compatibilityNotes={state.compatibilityNotes}
              />

              <button
                className="btn btn-primary mt-16"
                onClick={handleGenerate}
                disabled={!canGenerate}
                style={{ width: '100%' }}
              >
                Generate Context Sandwich Prompts →
              </button>
            </div>
          </div>

          {/* RIGHT: Generated prompts */}
          <div>
            {progress && progress.promptsTotal > 0 && (
              <div className="flex-between mb-12">
                <div className="step-label" style={{ marginBottom: 0 }}>
                  <span className="step-number">3</span>
                  Copy to Each Model
                </div>
                <span className={`badge ${progress.promptsCopied === progress.promptsTotal ? 'badge-green' : 'badge-amber'}`}>
                  {progress.promptsCopied}/{progress.promptsTotal} copied
                </span>
              </div>
            )}

            {activeRound.generatedPrompts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✍️</div>
                <div className="empty-state-title">No prompts generated yet</div>
                <div className="empty-state-desc">Write an instruction, select models, then click Generate.</div>
              </div>
            ) : (
              activeRound.generatedPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onCopy={() => handleCopy(prompt)}
                  copying={copyingId === prompt.id}
                  failed={copyFailed === prompt.id}
                  onDownload={() => handleDownload(prompt)}
                  downloading={downloadingId === prompt.id}
                  downloadFailed={downloadFailed === prompt.id}
                />
              ))
            )}

            {progress && progress.promptsCopied > 0 && (
              <div className="next-step-cue mt-8"
                onClick={() => onNavigate('responses')}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onNavigate('responses')}>
                <span className="text-xs">Prompts copied?</span>
                <strong style={{ fontSize: 13 }}>Go to Responses</strong>
                <span className="next-step-cue-arrow">→</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* v0.11.0 Checkpoint D — Import Preview modal (mounted once at panel level). */}
      <ImportPreviewModal {...mdUpload.modalProps} />
    </div>
  );
}

function PromptCard({
  prompt,
  onCopy,
  copying,
  failed,
  onDownload,
  downloading,
  downloadFailed,
  readonly = false,
}: {
  prompt: GeneratedPrompt;
  onCopy: () => void;
  copying: boolean;
  failed: boolean;
  /** v0.11.0 Checkpoint C: Download .md handler. Provide a no-op for
   *  read-only displays. */
  onDownload: () => void;
  downloading: boolean;
  downloadFailed: boolean;
  readonly?: boolean;
}) {
  const isCopied = prompt.status === 'copied';
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      {/* Header — title + copy-confirm badge (no layout shift) */}
      <div className="card-header">
        <div>
          <span className="card-title">{prompt.modelDisplayName}</span>
          <div className="text-xs text-muted mt-4">
            Generated {formatDisplay(prompt.generatedAt)}
            {prompt.copiedAt && <> · Copied {formatDisplay(prompt.copiedAt)}</>}
          </div>
        </div>
        {/* Badge sits in header — copying feedback here doesn't move the button below */}
        {isCopied
          ? <span className="copy-confirm">✓ Copied</span>
          : <span className="badge badge-amber">Generated</span>}
      </div>

      <div className="prompt-box mb-12">{prompt.promptText}</div>

      {!readonly && (
        <>
          {failed && (
            <div className="notice danger mb-8 text-xs">
              Clipboard copy failed. Select all text above and copy manually (Ctrl+A, Ctrl+C).
            </div>
          )}
          {downloadFailed && (
            <div className="notice danger mb-8 text-xs">
              Markdown download failed. See the browser console for details.
            </div>
          )}
          {/* Copy + Download .md buttons sit side-by-side. Copy is the
              primary affordance (paste-into-model-chat workflow); Download
              is the v0.11.0 Markdown Handoff archive path. Both consume
              the same prompt.promptText — Copy as-is, Download wrapped in
              a structured artifact (frontmatter + fenced body). */}
          <div className="flex gap-8">
            <button
              className="btn btn-copy"
              onClick={onCopy}
              disabled={copying}
              aria-label={`Copy prompt for ${prompt.modelDisplayName}`}
            >
              {copying ? '…Copying' : isCopied ? `Re-copy → ${prompt.modelDisplayName}` : `Copy → ${prompt.modelDisplayName}`}
            </button>
            <button
              className="btn btn-secondary"
              onClick={onDownload}
              disabled={downloading}
              aria-label={`Download prompt for ${prompt.modelDisplayName} as Markdown`}
              title="Download a .md handoff artifact (frontmatter + body)"
            >
              {downloading ? '…Saving' : 'Download .md'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Phase 7B: Compatibility warnings for selected models ─────────────────────
//
// Surfaces relevant CompatibilityNote entries for the selected models, plus
// any free-form modelBehaviorNotes / refusalRiskNotes from the model profiles
// themselves. Warnings are passive (no interaction required), expandable so
// experienced operators can collapse them, and grouped by severity so the
// most disruptive items lead.
//
// Source of truth for warning text: ModelProfile and CompatibilityNote.
// Round Builder must NOT hardcode warning strings — that scatters
// vendor-specific behavior throughout the app and fights the Phase 7B
// design intent.


interface CompatWarning {
  source: 'note' | 'profile';
  severity: CompatibilitySeverity;
  modelName: string;
  text: string;
  workaround?: string;
}

const SEVERITY_RANK: Record<CompatibilitySeverity, number> = {
  workflow_breaking: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SEVERITY_LABEL: Record<CompatibilitySeverity, string> = {
  workflow_breaking: '⛔ Workflow-breaking',
  high: '⚠ High',
  medium: '◆ Medium',
  low: '· Low',
};

function CompatibilityWarnings({
  selectedModelIds,
  modelProfiles,
  compatibilityNotes,
}: {
  selectedModelIds: string[];
  modelProfiles: ModelProfile[];
  compatibilityNotes: CompatibilityNote[];
}) {
  const [expanded, setExpanded] = useState(true);

  if (selectedModelIds.length === 0) return null;

  const selectedProfiles = modelProfiles.filter((m) => selectedModelIds.includes(m.id));
  const warnings: CompatWarning[] = [];

  // Pull in any active CompatibilityNote that links to a selected model
  // (preferring linkedModelProfileId, falling back to vendor/modelName).
  for (const note of compatibilityNotes) {
    if (note.status !== 'active') continue;
    const matches = selectedProfiles.find((p) =>
      note.linkedModelProfileId
        ? note.linkedModelProfileId === p.id
        : note.modelName === p.modelName || note.vendor === p.vendor
    );
    if (!matches) continue;
    warnings.push({
      source: 'note',
      severity: (note.severity as CompatibilitySeverity) ?? 'medium',
      modelName: matches.displayName,
      text: note.issue,
      workaround: note.workaround,
    });
  }

  // Free-form profile-level notes.
  for (const p of selectedProfiles) {
    if (p.modelBehaviorNotes && p.modelBehaviorNotes.trim()) {
      warnings.push({
        source: 'profile',
        severity: 'medium',
        modelName: p.displayName,
        text: `Behavior: ${p.modelBehaviorNotes.trim()}`,
      });
    }
    if (p.refusalRiskNotes && p.refusalRiskNotes.trim()) {
      warnings.push({
        source: 'profile',
        severity: 'high',
        modelName: p.displayName,
        text: `Refusal risk: ${p.refusalRiskNotes.trim()}`,
      });
    }
  }

  if (warnings.length === 0) return null;

  warnings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const headlineSeverity = warnings[0].severity;
  const headlineLabel =
    headlineSeverity === 'workflow_breaking' || headlineSeverity === 'high'
      ? 'danger'
      : '';

  const severityCls = headlineSeverity === 'workflow_breaking' ? 'severity-high'
    : headlineSeverity === 'high' ? 'severity-high'
    : headlineSeverity === 'medium' ? 'severity-medium' : 'severity-low';

  return (
    <div className={`compat-warning mt-12 ${severityCls}`}>
      <div className="compat-warning-header" onClick={() => setExpanded((v) => !v)}
        role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setExpanded(v => !v)}>
        <span className="text-xs" style={{ fontWeight: 600 }}>
          {expanded ? '▾' : '▸'} {warnings.length} compatibility note{warnings.length !== 1 ? 's' : ''} — top: {SEVERITY_LABEL[headlineSeverity]}
        </span>
        <span className="text-xs text-muted">{expanded ? 'collapse' : 'expand'}</span>
      </div>
      {expanded && (
        <div className="compat-warning-body">
          {warnings.map((w, i) => (
            <div key={`${w.source}-${i}`} style={{ marginBottom: 8 }}>
              <div className="flex-center gap-8 mb-4">
                <span className="text-xs text-mono" style={{ fontWeight: 600 }}>{SEVERITY_LABEL[w.severity]}</span>
                <span className="badge badge-muted text-xs">{w.modelName}</span>
              </div>
              <div className="text-xs">{w.text}</div>
              {w.workaround && (
                <div className="text-xs text-muted mt-4" style={{ paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>
                  Workaround: {w.workaround}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
