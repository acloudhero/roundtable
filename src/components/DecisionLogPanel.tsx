// src/components/DecisionLogPanel.tsx
// Purpose: Record decisions, transfer mediator recommendations as drafts, lock round
// Phase 4: draft-transfer buttons, next-round prompt support, "Start next round" action
//
// SAFETY RULES:
//   - "Use as draft" buttons only fill editable fields. They do NOT lock the round.
//   - Canonical state is ONLY updated when the user checks "Apply" and confirms.
//   - Lock happens only on the final explicit action.

import { useState, useEffect } from 'react';
import { AppState, AppStateUpdater } from '../types/appState';
import { Decision } from '../types/decision';
import {
  getActiveRound,
  getCurrentRound,
  recordDecisionForRound,
  applyCanonicalStateUpdate,
  createRoundFromPrompt,
} from '../utils/roundUtils';
import { copyToClipboard } from '../utils/clipboard';
import { generateId } from '../utils/id';
import { nowIso, formatDisplay } from '../utils/dateTime';

interface Props {
  state: AppState;
  onUpdate: (updated: AppStateUpdater) => void;
  onNavigate: (tab: string) => void;
}

export default function DecisionLogPanel({ state, onUpdate, onNavigate }: Props) {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const activeRound = getActiveRound(state);
  const currentRound = getCurrentRound(state);
  const decisions = state.decisions.filter((d) => d.projectId === project?.id);

  // Decision form state
  const [decisionText, setDecisionText] = useState('');
  const [rationale, setRationale] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [canonicalUpdate, setCanonicalUpdate] = useState('');
  const [applyToState, setApplyToState] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [justLocked, setJustLocked] = useState(false);
  const [nextRoundPromptCopied, setNextRoundPromptCopied] = useState(false);

  const synthesis = activeRound?.mediatorSynthesis ?? currentRound?.mediatorSynthesis;

  // Populate canonical update from existing round if set
  useEffect(() => {
    if (activeRound?.canonicalStateUpdate) setCanonicalUpdate(activeRound.canonicalStateUpdate);
  }, [activeRound?.id]);

  // ── Draft transfer helpers ──────────────────────────────────────────────────

  const useDraftDecision = () => {
    if (synthesis?.recommendedDecision) setDecisionText(synthesis.recommendedDecision);
    if (synthesis?.decisionRationale) setRationale(synthesis.decisionRationale);
    setConfirmLock(false);
  };

  const useDraftCanonicalUpdate = () => {
    if (synthesis?.proposedCanonicalStateUpdate) {
      setCanonicalUpdate(synthesis.proposedCanonicalStateUpdate);
      setApplyToState(false); // user must check the box themselves
    }
    setConfirmLock(false);
  };

  // ── Next-round prompt ───────────────────────────────────────────────────────

  const proposedNextPrompt = synthesis?.proposedNextRoundPrompt ?? '';

  const handleCopyNextPrompt = async () => {
    const ok = await copyToClipboard(proposedNextPrompt);
    if (ok) { setNextRoundPromptCopied(true); setTimeout(() => setNextRoundPromptCopied(false), 2000); }
  };

  const handleStartNextRound = () => {
    if (!project || !proposedNextPrompt.trim()) return;
    const newRound = createRoundFromPrompt(project, state.rounds, proposedNextPrompt);
    onUpdate({ rounds: [...state.rounds, newRound] });
    onNavigate('round-builder');
  };

  // ── Record decision ─────────────────────────────────────────────────────────

  const handleRecord = () => {
    if (!project || !activeRound || !decisionText.trim()) return;
    if (!confirmLock) { setConfirmLock(true); return; }

    const decision: Decision = {
      id: generateId('dec'),
      projectId: project.id,
      roundId: activeRound.id,
      decisionText,
      rationale,
      createdAt: nowIso(),
      phase: project.currentPhase,
      nextAction: nextAction || undefined,
    };

    const lockedRound = recordDecisionForRound(activeRound, decisionText, canonicalUpdate);

    let updatedProjects = state.projects;
    if (applyToState && canonicalUpdate.trim()) {
      const updatedProject = applyCanonicalStateUpdate(project, canonicalUpdate, activeRound.roundNumber);
      updatedProjects = state.projects.map((p) => (p.id === project.id ? updatedProject : p));
    }

    onUpdate({
      decisions: [...state.decisions, decision],
      rounds: state.rounds.map((r) => (r.id === lockedRound.id ? lockedRound : r)),
      projects: updatedProjects,
    });

    setDecisionText(''); setRationale(''); setNextAction('');
    setCanonicalUpdate(''); setApplyToState(false);
    setConfirmLock(false);
    setJustLocked(true);
    setTimeout(() => setJustLocked(false), 4000);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="panel-title">Decision Log</h1>
        <p className="panel-desc">
          Review mediator synthesis → transfer drafts → record decision → optionally apply canonical state update → lock round.
        </p>
      </div>

      {/* ── Active round decision form ───────────────────────────────────────── */}
      {activeRound && !activeRound.locked && (
        <div className="card mb-24">
          <div className="card-header">
            <span className="card-title">Record Decision — Round {activeRound.roundNumber}</span>
<span className="workflow-chip active">✏️ Active</span>
          </div>

          {/* Mediator synthesis reference */}
          {synthesis && (
            <MediatorReference
              synthesis={synthesis}
              onUseDraftDecision={useDraftDecision}
              onUseDraftCanonical={useDraftCanonicalUpdate}
              onCopyNextPrompt={handleCopyNextPrompt}
              onStartNextRound={handleStartNextRound}
              nextRoundPromptCopied={nextRoundPromptCopied}
            />
          )}

          {!synthesis && (
            <div className="notice mb-16 info text-xs">
              No mediator synthesis yet. Go to Mediator tab to paste and extract the mediator response first.
            </div>
          )}

          <hr className="divider" />

          {/* Decision fields */}
          <div className="form-group">
            <div className="flex-between mb-6">
              <label className="form-label" style={{ marginBottom: 0 }}>Your Decision *</label>
              {synthesis?.recommendedDecision && (
                <button className="btn btn-ghost text-xs" onClick={useDraftDecision} style={{ padding: '2px 8px' }}>
                  Use mediator recommendation as draft
                </button>
              )}
            </div>
            <textarea
              className="form-textarea"
              placeholder="What did you decide?"
              value={decisionText}
              onChange={(e) => { setDecisionText(e.target.value); setConfirmLock(false); }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Rationale</label>
            <textarea
              className="form-textarea"
              placeholder="Why did you make this decision?"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Next Action</label>
            <input
              className="form-input"
              placeholder="Most important next step"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
          </div>

          <hr className="divider" />

          {/* Canonical state update */}
          <div className="form-group">
            <div className="flex-between mb-6">
              <label className="form-label" style={{ color: 'var(--amber)', marginBottom: 0 }}>
                Canonical State Update to Apply
              </label>
              {synthesis?.proposedCanonicalStateUpdate && (
                <button className="btn btn-ghost text-xs" onClick={useDraftCanonicalUpdate} style={{ padding: '2px 8px' }}>
                  Use proposed canonical update as draft
                </button>
              )}
            </div>
            <p className="text-xs text-muted mb-8">
              Review and edit the mediator's proposal. Will only be applied if you check the box below.
            </p>
            <textarea
              className="form-textarea canonical-state-editor"
              style={{ minHeight: 180 }}
              placeholder="Paste or write the canonical state update for this round…"
              value={canonicalUpdate}
              onChange={(e) => { setCanonicalUpdate(e.target.value); setConfirmLock(false); }}
            />
          </div>

          {canonicalUpdate.trim() && (
            <label className="flex-center gap-12 mb-16" style={{ cursor: 'pointer', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                checked={applyToState}
                onChange={(e) => { setApplyToState(e.target.checked); setConfirmLock(false); }}
                style={{ accentColor: 'var(--amber)', width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Apply to Project Canonical State</div>
                <div className="text-xs text-muted">
                  Appends a dated "Round {activeRound.roundNumber} Canonical State Update" section. Original state is preserved.
                </div>
              </div>
            </label>
          )}

          {confirmLock && (
            <div className="notice danger mb-12">
              <strong>Confirm lock:</strong> Recording this decision will lock Round {activeRound.roundNumber}.
              {applyToState && canonicalUpdate.trim() && ' Canonical state update will be appended to the project state.'}
              {' '}This cannot be undone without manual edits.
            </div>
          )}

          <div className="flex gap-8">
            <button
              className="btn btn-primary"
              onClick={handleRecord}
              disabled={!decisionText.trim()}
              style={{ flex: 1 }}
            >
              {justLocked
                ? '✓ Recorded & Locked'
                : confirmLock
                ? '⚠ Confirm — Lock Round & Record Decision'
                : applyToState && canonicalUpdate.trim()
                ? 'Apply Canonical Update + Lock Round'
                : 'Record Decision & Lock Round'}
            </button>
            {confirmLock && (
              <button className="btn btn-secondary" onClick={() => setConfirmLock(false)}>Cancel</button>
            )}
          </div>
        </div>
      )}

      {/* Locked round notice + proposed next-round prompt */}
      {currentRound?.locked && !activeRound && (
        <div className="card mb-24">
          <div className="round-locked-banner" style={{ marginBottom: 12 }}>
            <span className="lock-icon">🔒</span>
            <strong>Round {currentRound.roundNumber} is locked</strong>
          </div>
          <div className="card-header" style={{ paddingTop: 0 }}>
            <span className="card-title">Round {currentRound.roundNumber} Summary</span>
          </div>
          {currentRound.userDecision && (
            <div className="mb-12">
              <div className="section-heading">Decision Recorded</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{currentRound.userDecision}</div>
            </div>
          )}
          {currentRound.mediatorSynthesis?.proposedNextRoundPrompt && (
            <NextRoundPromptCard
              prompt={currentRound.mediatorSynthesis.proposedNextRoundPrompt}
              onCopy={handleCopyNextPrompt}
              onStart={handleStartNextRound}
              copied={nextRoundPromptCopied}
            />
          )}
        </div>
      )}

      {/* Decision history */}
      <div className="flex-between mb-12">
        <div className="section-heading" style={{ marginBottom: 0 }}>Decision History</div>
        <span className="badge badge-muted">{decisions.length} decisions</span>
      </div>

      {decisions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">No decisions yet</div>
          <div className="empty-state-desc">Complete a round and record your decision to build the decision log.</div>
        </div>
      ) : (
        [...decisions].reverse().map((d: Decision) => {
          const round = state.rounds.find((r) => r.id === d.roundId);
          return (
            <div className="decision-entry" key={d.id}>
              <div className="flex-between mb-8">
                <div className="flex gap-8 flex-center">
                  <span className="badge badge-amber">{d.phase ?? 'Unknown Phase'}</span>
                  {round && <span className="badge badge-muted">Round {round.roundNumber}</span>}
                </div>
                <span className="text-xs text-muted">{formatDisplay(d.createdAt)}</span>
              </div>
              <div className="decision-text">{d.decisionText}</div>
              {d.rationale && <div className="decision-rationale">{d.rationale}</div>}
              {d.nextAction && (
                <div className="flex-center gap-8 mt-6">
                  <span className="text-xs text-muted">Next action:</span>
                  <span className="text-xs text-amber">{d.nextAction}</span>
                </div>
              )}
              {round?.canonicalStateUpdate && (
                <details className="mt-8">
                  <summary className="text-xs text-muted" style={{ cursor: 'pointer', listStyle: 'none' }}>
                    ▶ Canonical state update for this round
                  </summary>
                  <div className="prompt-box mt-6 text-xs">{round.canonicalStateUpdate}</div>
                </details>
              )}
              {round?.mediatorSynthesis?.proposedNextRoundPrompt && (
                <details className="mt-6">
                  <summary className="text-xs text-muted" style={{ cursor: 'pointer', listStyle: 'none' }}>
                    ▶ Proposed next-round prompt
                  </summary>
                  <div className="prompt-box mt-6 text-xs">{round.mediatorSynthesis.proposedNextRoundPrompt}</div>
                </details>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

import { MediatorSynthesis } from '../types/round';
import { SYNTHESIS_FIELD_LABELS } from '../utils/mediatorExtract';

function MediatorReference({
  synthesis,
  onUseDraftDecision,
  onUseDraftCanonical,
  onCopyNextPrompt,
  onStartNextRound,
  nextRoundPromptCopied,
}: {
  synthesis: MediatorSynthesis;
  onUseDraftDecision: () => void;
  onUseDraftCanonical: () => void;
  onCopyNextPrompt: () => void;
  onStartNextRound: () => void;
  nextRoundPromptCopied: boolean;
}) {
  return (
    <details className="mb-16" open>
      <summary className="card-title" style={{ cursor: 'pointer', listStyle: 'none', marginBottom: 12 }}>
        ▼ Mediator Synthesis Reference
      </summary>
      <div style={{ paddingLeft: 8 }}>
        <div className="notice mb-12 info text-xs">
          These are the mediator's proposals. Use the buttons to load them as editable drafts. Nothing below is applied automatically.
        </div>

        {/* Executive summary */}
        {synthesis.executiveSummary && (
          <RefField label="Executive Summary" value={synthesis.executiveSummary} />
        )}

        {/* Recommended decision + transfer button */}
        {synthesis.recommendedDecision && (
          <div className="mb-12">
            <div className="flex-between mb-4">
              <span className="section-heading" style={{ marginBottom: 0 }}>Recommended Decision</span>
              <button className="btn btn-ghost text-xs" onClick={onUseDraftDecision} style={{ padding: '2px 10px' }}>
                Use as draft →
              </button>
            </div>
            <div className="prompt-box" style={{ maxHeight: 120, whiteSpace: 'pre-wrap' }}>{synthesis.recommendedDecision}</div>
            {synthesis.decisionRationale && (
              <div className="prompt-box mt-6 text-xs" style={{ maxHeight: 100 }}>{synthesis.decisionRationale}</div>
            )}
          </div>
        )}

        {/* Proposed canonical update + transfer button */}
        {synthesis.proposedCanonicalStateUpdate && (
          <div className="mb-12">
            <div className="flex-between mb-4">
              <span className="section-heading" style={{ marginBottom: 0, color: 'var(--amber)' }}>
                Proposed Canonical State Update ⚠ Not auto-applied
              </span>
              <button className="btn btn-ghost text-xs" onClick={onUseDraftCanonical} style={{ padding: '2px 10px' }}>
                Use as draft →
              </button>
            </div>
            <div className="prompt-box" style={{ maxHeight: 160, whiteSpace: 'pre-wrap' }}>{synthesis.proposedCanonicalStateUpdate}</div>
          </div>
        )}

        {/* Proposed next actions */}
        {synthesis.proposedNextActions && (
          <RefField label="Proposed Next Actions" value={synthesis.proposedNextActions} />
        )}

        {/* Next-round prompt */}
        {synthesis.proposedNextRoundPrompt && (
          <NextRoundPromptCard
            prompt={synthesis.proposedNextRoundPrompt}
            onCopy={onCopyNextPrompt}
            onStart={onStartNextRound}
            copied={nextRoundPromptCopied}
          />
        )}

        {/* Caveats */}
        {synthesis.confidenceCaveats && (
          <RefField label="Confidence / Caveats" value={synthesis.confidenceCaveats} />
        )}
      </div>
    </details>
  );
}

function RefField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-12">
      <div className="section-heading">{label}</div>
      <div className="prompt-box text-xs" style={{ maxHeight: 120, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}

function NextRoundPromptCard({
  prompt,
  onCopy,
  onStart,
  copied,
}: {
  prompt: string;
  onCopy: () => void;
  onStart: () => void;
  copied: boolean;
}) {
  return (
    <div className="card" style={{ border: '1px solid var(--green-dim)', marginBottom: 12 }}>
      <div className="card-header">
        <span className="card-title" style={{ color: 'var(--green)' }}>Proposed Next-Round Prompt</span>
        <span className="badge badge-green">Ready to use</span>
      </div>
      <div className="prompt-box mb-12" style={{ whiteSpace: 'pre-wrap', maxHeight: 160 }}>{prompt}</div>
      <div className="flex gap-8">
        <button className="btn btn-secondary" onClick={onCopy} style={{ flex: 1 }}>
          {copied ? '✓ Copied' : 'Copy Prompt'}
        </button>
        <button className="btn btn-primary" onClick={onStart} style={{ flex: 1 }}>
          Start Next Round From This Prompt →
        </button>
      </div>
    </div>
  );
}
