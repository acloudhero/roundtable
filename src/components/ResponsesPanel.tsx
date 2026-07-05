// src/components/ResponsesPanel.tsx
// Purpose: Paste model responses, track pastedAt timestamps, show response status
// Phase 3: full response ingestion with chain-of-custody, status indicators, locked protection
//
// v0.10.4: Hardened response persistence to satisfy "Total Serialization":
//   - All round mutations dispatch via `updateRoundFunctional`, which
//     resolves the latest round inside React's setState updater. This
//     eliminates the textarea-blur + status-button-click race where two
//     dispatches in the same gesture each computed a whole `rounds`
//     slice from stale state and the second's slice overwrote the
//     first's.
//   - On panel unmount (tab navigation away), any uncommitted local
//     textarea drafts are flushed in a single atomic round update so
//     the next panel (typically MediatorPanel) reads complete data.
//   - Status-only updates explicitly preserve responseText and metadata.

import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateUpdater } from '../types/appState';
import { ResponseStatus, Round, ModelResponse, GeneratedPrompt } from '../types/round';
import { ModelProfile } from '../types/modelProfile';
import {
  getActiveRound,
  getCurrentRound,
  upsertModelResponse,
  getRoundProgress,
  updateRoundFunctional,
} from '../utils/roundUtils';
import { downloadMarkdownArtifact } from '../utils/markdownArtifactDownload';
// v0.11.0 Checkpoint D — Upload .md → preview → Raw Notes flow.
import { useMarkdownUpload } from '../hooks/useMarkdownUpload';
import ImportPreviewModal from './ImportPreviewModal';
import { formatDisplay, nowIso } from '../utils/dateTime';

interface Props {
  state: AppState;
  onUpdate: (updated: AppStateUpdater) => void;
  onNavigate: (tab: string) => void;
}

export default function ResponsesPanel({ state, onUpdate, onNavigate }: Props) {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const activeRound = getActiveRound(state);
  // currentRound: used for read-only display when latest round is locked
  const currentRound = getCurrentRound(state);

  // v0.11.0 Checkpoint D — Upload .md → Import Preview → Raw Notes.
  //
  // Panel-level Upload .md button (not per-slot). Per-slot routing
  // requires structured commit (Checkpoint E). For now: the hook
  // detects source_kind and target model from frontmatter; the user
  // picks Import as Raw Notes to preserve verbatim, or Cancel.
  const mdUpload = useMarkdownUpload(state, onUpdate, { panelLabel: 'in Responses' });

  // Local response text state — synced from round
  const [localResponses, setLocalResponses] = useState<Record<string, string>>({});

  useEffect(() => {
    const round = activeRound ?? currentRound;
    if (round) {
      const map: Record<string, string> = {};
      round.modelResponses.forEach((r) => { map[r.modelProfileId] = r.responseText; });
      setLocalResponses(map);
    }
  }, [activeRound?.id, currentRound?.id]);

  // ─── v0.10.4: Unmount-flush refs ─────────────────────────────────────────
  // Refs that always hold the latest values, accessible inside the
  // unmount cleanup (which would otherwise see only the mount-time
  // closure). The cleanup composes a single functional update that
  // flushes every dirty draft atomically.
  const draftsRef = useRef(localResponses);
  const activeRoundIdRef = useRef<string | null>(activeRound?.id ?? null);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { draftsRef.current = localResponses; }, [localResponses]);
  useEffect(() => { activeRoundIdRef.current = activeRound?.id ?? null; }, [activeRound?.id]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    return () => {
      // Panel is unmounting (tab navigation away). Commit any uncommitted
      // local textarea drafts so the next panel reads from a consistent
      // round state. This is the cross-panel half of "Total Serialization"
      // — it makes the MediatorPanel's Generate handler safe regardless
      // of whether the user clicked outside a textarea before navigating.
      const drafts = draftsRef.current;
      const roundId = activeRoundIdRef.current;
      if (!roundId || !drafts) return;

      onUpdateRef.current(
        updateRoundFunctional(roundId, (round): Round => {
          let working: Round = round;
          let dirty = false;
          for (const [modelProfileId, text] of Object.entries(drafts)) {
            const existing = working.modelResponses.find(
              (r: ModelResponse) => r.modelProfileId === modelProfileId
            );
            if ((existing?.responseText ?? '') === text) continue;
            // upsertModelResponse preserves modelDisplayName from existing
            // when caller passes ''. That's the safe fallback here because
            // we no longer have ready access to selectedModels in unmount.
            working = upsertModelResponse(
              working,
              modelProfileId,
              existing?.modelDisplayName ?? '',
              text
            );
            dirty = true;
          }
          return dirty ? { ...working, updatedAt: nowIso() } : round;
        })
      );
    };
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleChange = (modelProfileId: string, text: string) => {
    setLocalResponses((prev) => ({ ...prev, [modelProfileId]: text }));
  };

  const handleBlur = (modelProfileId: string, modelDisplayName: string) => {
    if (!activeRound) return;
    const text = localResponses[modelProfileId] ?? '';
    onUpdate(
      updateRoundFunctional(activeRound.id, (round) =>
        upsertModelResponse(round, modelProfileId, modelDisplayName, text)
      )
    );
  };

  const handleStatusChange = (modelProfileId: string, modelDisplayName: string, status: ResponseStatus) => {
    if (!activeRound) return;
    // v0.10.4: this used to read activeRound from the component closure,
    // which could be stale relative to a still-pending blur save from the
    // textarea. Both handlers fire in the same React batch when the user
    // clicks a status button while a textarea is focused. With the
    // functional updater, the `recipe` callback below receives the
    // round AFTER any concurrent blur save has been applied, then layers
    // status on top atomically. No race, no overwrite.
    const text = localResponses[modelProfileId] ?? '';
    onUpdate(
      updateRoundFunctional(activeRound.id, (round): Round => {
        // First, ensure the latest local text is committed. If the blur
        // handler already committed identical text, this is a no-op
        // (same value).
        const withText = upsertModelResponse(round, modelProfileId, modelDisplayName, text);
        // Then layer the status change on top, preserving all other
        // response fields (id, modelDisplayName, responseText, pastedAt).
        return {
          ...withText,
          modelResponses: withText.modelResponses.map((r: ModelResponse) =>
            r.modelProfileId === modelProfileId ? { ...r, status } : r
          ),
          updatedAt: nowIso(),
        };
      })
    );
  };

  // v0.11.0 Checkpoint C — Download .md for a model response.
  //
  // The download captures the *current local text* (including any draft
  // not yet blurred). It also commits that draft to AppState through the
  // existing upsertModelResponse helper, so the persisted state matches
  // what was just exported. Without this dual commit, a user typing into
  // the textarea and clicking Download could get an artifact whose body
  // reflects pre-typing state — a confusing same-tick race.
  //
  // We build an in-memory ephemeralRound via the same upsertModelResponse
  // helper used by the persistence path, so the artifact's body is
  // byte-equal to what the persisted round will hold after the dispatched
  // update is applied.
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadFailedId, setDownloadFailedId] = useState<string | null>(null);

  const handleDownload = async (modelProfileId: string, modelDisplayName: string) => {
    if (!activeRound || !project) return;
    const localText = localResponses[modelProfileId] ?? '';
    if (!localText.trim()) return; // button gating already prevents this; defensive
    setDownloadingId(modelProfileId);
    setDownloadFailedId(null);

    // Commit draft so persisted state matches what we just exported.
    onUpdate(
      updateRoundFunctional(activeRound.id, (round) =>
        upsertModelResponse(round, modelProfileId, modelDisplayName, localText)
      )
    );

    // Build artifact against an ephemeral round constructed via the same
    // upsertModelResponse helper used by the persistence dispatch above —
    // the artifact's body matches what the persisted round will hold.
    const ephemeralRound = upsertModelResponse(
      activeRound,
      modelProfileId,
      modelDisplayName,
      localText
    );

    try {
      await downloadMarkdownArtifact({
        kind: 'model_response',
        ctx: { project },
        round: ephemeralRound,
        modelProfileId,
      });
    } catch (err) {
      console.error('[RoundTable] Response .md download failed:', err);
      setDownloadFailedId(modelProfileId);
    } finally {
      setDownloadingId(null);
    }
  };

  /**
   * v0.10.4: Explicit flush helper used by the "Generate Mediator Packet
   * Anyway →" navigation button at the bottom of the panel. Calling this
   * before navigation guarantees the MediatorPanel mounts against a round
   * state that includes every draft the user has typed, even drafts that
   * never lost focus.
   */
  const flushAllDraftsAndNavigate = (tab: string) => {
    if (!activeRound) {
      onNavigate(tab);
      return;
    }
    const drafts = localResponses;
    onUpdate(
      updateRoundFunctional(activeRound.id, (round): Round => {
        let working: Round = round;
        let dirty = false;
        for (const [modelProfileId, text] of Object.entries(drafts)) {
          const existing = working.modelResponses.find(
            (r: ModelResponse) => r.modelProfileId === modelProfileId
          );
          if ((existing?.responseText ?? '') === text) continue;
          working = upsertModelResponse(
            working,
            modelProfileId,
            existing?.modelDisplayName ?? '',
            text
          );
          dirty = true;
        }
        return dirty ? { ...working, updatedAt: nowIso() } : round;
      })
    );
    onNavigate(tab);
  };

  if (!project) return (
    <div className="panel">
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-title">No active project</div>
        <div className="empty-state-desc">Set up a project in the Project State tab first.</div>
      </div>
    </div>
  );

  // If no active (unlocked) round, show the latest locked round read-only
  if (!activeRound) {
    if (!currentRound) {
      return (
        <div className="panel">
          <div className="panel-header"><h1 className="panel-title">Responses</h1></div>
          <div className="notice mb-16 info">No rounds yet. Start one in Round Builder.</div>
        </div>
      );
    }
    // Show locked round responses read-only
    const lockedModels = state.modelProfiles.filter((m) => currentRound.selectedModelIds.includes(m.id));
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="flex-between">
            <div>
              <h1 className="panel-title">Responses</h1>
              <p className="panel-desc">Round {currentRound.roundNumber} is locked — responses are read-only.</p>
            </div>
            <span className="locked-badge locked">🔒 Round {currentRound.roundNumber} Locked</span>
          </div>
        </div>
        <div className="notice mb-16">
          This round is locked. Future edits should be made in a new round.
        </div>
        {lockedModels.map((model) => {
          const response = currentRound.modelResponses.find((r) => r.modelProfileId === model.id);
          return (
            <div className="card" key={model.id} style={{ marginBottom: 14 }}>
              <div className="card-header">
                <span className="card-title">{model.displayName}</span>
                <span className={"badge " + (response?.responseText ? "badge-green" : "badge-muted")}>
                  {response?.status ?? "awaiting response"}
                </span>
              </div>
              <div className="prompt-box response">{response?.responseText || "(No response recorded)"}</div>
            </div>
          );
        })}
      </div>
    );
  }

  const selectedModels = state.modelProfiles.filter((m) =>
    activeRound.selectedModelIds.includes(m.id)
  );
  const progress = getRoundProgress(activeRound);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex-between">
          <div>
            <h1 className="panel-title">Responses</h1>
            <p className="panel-desc">Paste each model's response. Drafts are committed automatically on blur, on status change, and before mediator navigation.</p>
          </div>
          <div className="flex gap-8 flex-center">
            <span className={`badge ${progress.responsesCollected === progress.responsesTotal && progress.responsesTotal > 0 ? 'badge-green' : 'badge-amber'}`}>
              {progress.responsesCollected}/{progress.responsesTotal} responses
            </span>
            <span className={`workflow-chip ${activeRound.locked ? 'locked' : 'active'}`}>
              {activeRound.locked ? `🔒 Round ${activeRound.roundNumber} Locked` : `✏️ Round ${activeRound.roundNumber}`}
            </span>
          </div>
        </div>
      </div>

      <div className="notice mb-16 info">
        <strong>Round {activeRound.roundNumber}</strong> · {activeRound.phase}
        <br />
        <span className="text-xs">{activeRound.userInstruction}</span>
      </div>

      {/* v0.11.0 Checkpoint D — Panel-level Upload .md affordance.
          One button at the top of Responses, not per-slot. The hook
          detects source_kind and target model from the file's
          frontmatter. For Checkpoint D the only commit path is
          Import as Raw Notes — structured commit (which would route
          to the matching model slot) lands in Checkpoint E. */}
      {!activeRound.locked && (
        <div className="flex gap-8 mb-12" style={{ alignItems: 'center' }}>
          <button
            className="btn btn-secondary text-xs"
            onClick={mdUpload.triggerUpload}
            disabled={mdUpload.loading}
            aria-label="Upload model response .md file"
            title="Upload a .md handoff artifact. Opens the import preview."
            style={{ minHeight: 32, padding: '6px 12px' }}
          >
            {mdUpload.loading ? '…Loading' : 'Upload .md'}
          </button>
          <span className="text-xs text-muted">
            Imports a .md handoff artifact. Structured response routing arrives in a future checkpoint;
            for now files preserve as Raw Notes.
          </span>
        </div>
      )}
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

      {selectedModels.length === 0 && (
        <div className="empty-state mb-16">
          <div className="empty-state-icon">🤖</div>
          <div className="empty-state-title">No models selected</div>
          <div className="empty-state-desc">Go to Round Builder and select models for this round.</div>
        </div>
      )}

      {selectedModels.map((model) => {
        const response = activeRound.modelResponses.find((r) => r.modelProfileId === model.id);
        const prompt = activeRound.generatedPrompts.find((p) => p.modelProfileId === model.id);
        const localText = localResponses[model.id] ?? '';
        const hasResponse = localText.trim().length > 0;

        // v0.11.0 Checkpoint G — each slot delegates to ResponseSlotCard,
        // which hosts its own useMarkdownUpload hook bound to model.id.
        // This is the React-correct way to give each row its own preview
        // state without violating Rules of Hooks (no hooks inside map
        // callbacks).
        return (
          <ResponseSlotCard
            key={model.id}
            model={model}
            response={response}
            prompt={prompt}
            localText={localText}
            hasResponse={hasResponse}
            locked={activeRound.locked}
            roundNumber={activeRound.roundNumber}
            state={state}
            onUpdate={onUpdate}
            onChange={(v) => handleChange(model.id, v)}
            onBlur={() => handleBlur(model.id, model.displayName)}
            onStatusChange={(s) => handleStatusChange(model.id, model.displayName, s)}
            onDownload={() => handleDownload(model.id, model.displayName)}
            downloading={downloadingId === model.id}
            downloadFailed={downloadFailedId === model.id}
          />
        );
      })}

      {progress.responsesCollected > 0 && (
        <button className="btn btn-primary mt-8" onClick={() => flushAllDraftsAndNavigate('mediator')} style={{ width: '100%' }}>
          {progress.responsesCollected < progress.responsesTotal
            ? `${progress.responsesCollected}/${progress.responsesTotal} responses — Generate Mediator Packet Anyway →`
            : 'All responses collected → Generate Mediator Packet →'}
        </button>
      )}

      {activeRound.locked && (
        <div className="round-locked-banner mt-16">
          <span className="lock-icon">🔒</span>
          <div>Round is locked — responses are read-only.
            <span className="text-muted" style={{ marginLeft: 8 }}>Start a new round in Round Builder.</span>
          </div>
        </div>
      )}

      {/* v0.11.0 Checkpoint D — Import Preview modal (mounted once at panel level). */}
      <ImportPreviewModal {...mdUpload.modalProps} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.11.0 Checkpoint G — ResponseSlotCard
//
// One slot card per selected model. Extracted out of the inline map
// callback so each row can host its own `useMarkdownUpload` hook
// (Rules of Hooks forbid hook calls inside callbacks).
//
// The hook is bound to this row's model.id via `expectedSourceKind:
// 'model_response'` and `expectedModelId: model.id`. That lets the
// import preview surface MODEL_ID_MISMATCH_WITH_SLOT / SOURCE_KIND_INVALID
// warnings when the user uploads a file targeting a different model
// (or a different kind altogether), AND lets the hook's deferred-reason
// gate block structured commit in those cases — without removing the
// Raw Notes fallback.
//
// The existing panel-level Upload .md affordance (top of the panel)
// stays available for users who want to upload an artifact and let
// its frontmatter decide which slot to land in. Per-slot is for
// "I know this file is for THIS model" cases.
// ─────────────────────────────────────────────────────────────────────────────

interface ResponseSlotCardProps {
  model: ModelProfile;
  response: ModelResponse | undefined;
  prompt: GeneratedPrompt | undefined;
  localText: string;
  hasResponse: boolean;
  locked: boolean;
  roundNumber: number;
  state: AppState;
  onUpdate: (updater: AppStateUpdater) => void;
  onChange: (value: string) => void;
  onBlur: () => void;
  onStatusChange: (status: ResponseStatus) => void;
  onDownload: () => void;
  downloading: boolean;
  downloadFailed: boolean;
}

function ResponseSlotCard({
  model,
  response,
  prompt,
  localText,
  hasResponse,
  locked,
  roundNumber: _roundNumber,
  state,
  onUpdate,
  onChange,
  onBlur,
  onStatusChange,
  onDownload,
  downloading,
  downloadFailed,
}: ResponseSlotCardProps) {
  // v0.11.0 Checkpoint G — per-slot Upload .md.
  //
  // Hook is bound to this row's model. The hook's preview build
  // forwards `expectedSourceKind` and `expectedModelId` to
  // buildImportPreview, which surfaces mismatch warnings; the hook's
  // deferred-reason gate then disables structured commit on mismatch.
  // Raw Notes remains available regardless.
  const slotUpload = useMarkdownUpload(state, onUpdate, {
    panelLabel: `into ${model.displayName} response slot`,
    expectedSourceKind: 'model_response',
    expectedModelId: model.id,
  });

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div>
          <span className="card-title">{model.displayName}</span>
          <div className="text-xs text-muted mt-4">{model.roleName}</div>
        </div>
        <div className="flex gap-8 flex-center">
          {response?.pastedAt && (
            <span className="text-xs text-muted">Pasted {formatDisplay(response.pastedAt)}</span>
          )}
          <span className={`badge ${hasResponse ? 'badge-green' : 'badge-muted'}`}>
            {hasResponse ? `✓ ${response?.status ?? 'pasted'}` : 'awaiting response'}
          </span>
        </div>
      </div>

      {/* Prompt reminder (collapsible) */}
      {prompt && (
        <details className="mb-10">
          <summary className="text-xs text-muted" style={{ cursor: 'pointer', listStyle: 'none' }}>
            ▶ View prompt sent to {model.displayName}
          </summary>
          <div className="prompt-box mt-6" style={{ maxHeight: 160 }}>{prompt.promptText}</div>
        </details>
      )}

      <textarea
        className="form-textarea large"
        placeholder={`Paste ${model.displayName}'s response here…`}
        value={localText}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={locked}
        style={{ opacity: locked ? 0.65 : 1 }}
      />

      {/* Action row — Status buttons + Download .md (when response
          exists) + per-slot Upload .md (always when unlocked). Per-slot
          Upload is rendered separately from hasResponse since the user
          may want to import INTO an empty slot. */}
      {!locked && (
        <>
          <div className="flex gap-8 mt-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            {hasResponse && (['pasted', 'reviewed', 'excluded'] as ResponseStatus[]).map((s) => (
              <button
                key={s}
                className={`btn ${response?.status === s ? 'btn-primary' : 'btn-ghost'} text-xs`}
                style={{ padding: '4px 10px' }}
                onClick={() => onStatusChange(s)}
              >
                {s}
              </button>
            ))}

            {/* Spacer pushes the .md buttons to the right edge on wide
                viewports; on narrow ones flex-wrap drops them to the
                next line. */}
            <div style={{ marginLeft: hasResponse ? 'auto' : 0 }} />

            {/* v0.11.0 Checkpoint G — per-slot Upload .md. Hook is bound
                to this row's model.id so mismatches surface clearly. */}
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '4px 10px' }}
              onClick={slotUpload.triggerUpload}
              disabled={slotUpload.loading}
              aria-label={`Upload .md into ${model.displayName} response slot`}
              title={`Upload a .md handoff artifact for ${model.displayName}. The file's model_id must match this slot.`}
            >
              {slotUpload.loading ? '…Loading' : 'Upload .md'}
            </button>

            {/* v0.11.0 Checkpoint C — Download .md (response artifact). */}
            {hasResponse && (
              <button
                className="btn btn-secondary text-xs"
                style={{ padding: '4px 10px' }}
                onClick={onDownload}
                disabled={downloading}
                aria-label={`Download response from ${model.displayName} as Markdown`}
                title="Download a .md handoff artifact (frontmatter + body)"
              >
                {downloading ? '…Saving' : 'Download .md'}
              </button>
            )}
          </div>

          {/* Hidden file input for the per-slot Upload .md button. */}
          <input
            ref={slotUpload.fileInputRef}
            type="file"
            accept={slotUpload.acceptString}
            onChange={slotUpload.onFileInputChange}
            style={{ display: 'none' }}
            aria-hidden="true"
          />

          {slotUpload.error && (
            <div className="notice danger mt-8 text-xs">{slotUpload.error}</div>
          )}
          {slotUpload.status && (
            <div className="notice info mt-8 text-xs">{slotUpload.status}</div>
          )}
          {downloadFailed && (
            <div className="notice danger mt-8 text-xs">
              Markdown download failed. See the browser console for details.
            </div>
          )}
        </>
      )}

      {/* Per-slot Import Preview modal — opened only when the user
          triggers this row's Upload .md affordance. Multiple rows each
          mount their own modal node; only one can be `open` at a time
          since the user can only trigger one upload picker per click. */}
      <ImportPreviewModal {...slotUpload.modalProps} />
    </div>
  );
}
