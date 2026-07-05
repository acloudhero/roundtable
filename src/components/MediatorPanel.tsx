// src/components/MediatorPanel.tsx
// Purpose: Generate mediator packet → copy → paste response → extract/edit structured synthesis
// Phase 4: structured MediatorSynthesis fields, heading-based extraction, user-review workflow
//
// WORKFLOW (4 steps):
//   1. Generate mediator packet (uses pasted model responses)
//   2. Copy packet → paste into GPT-5.5 Thinking externally
//   3. Paste full mediator response back here
//   4. Extract structured fields → review/edit → save synthesis
//
// SAFETY: Nothing in this panel automatically updates Project.canonicalState.
//         proposedCanonicalStateUpdate is a text field the user reads and transfers manually.

import { useState, useEffect } from 'react';
import { AppState, AppStateUpdater } from '../types/appState';
import { MediatorSynthesis, Round } from '../types/round';
import { generateMediatorPacket, summarizeResponseInclusion, ResponseInclusionRow } from '../utils/mediatorPacket';
import { extractMediatorSections, emptyMediatorSynthesis, SYNTHESIS_FIELD_LABELS } from '../utils/mediatorExtract';
import {
  getActiveRound,
  getCurrentRound,
  getRoundProgress,
  isRoundMediatorReady,
  saveMediatorSynthesis,
  updateRoundFunctional,
} from '../utils/roundUtils';
import { copyToClipboard } from '../utils/clipboard';
import { downloadMarkdownArtifact } from '../utils/markdownArtifactDownload';
// v0.11.0 Checkpoint D — Upload .md → preview → Raw Notes flow.
import { useMarkdownUpload } from '../hooks/useMarkdownUpload';
import ImportPreviewModal from './ImportPreviewModal';
import { nowIso, formatDisplay } from '../utils/dateTime';

interface Props {
  state: AppState;
  onUpdate: (updated: AppStateUpdater) => void;
  onNavigate: (tab: string) => void;
}

// Fields that are taller (multi-paragraph content)
const TALL_FIELDS: (keyof Omit<MediatorSynthesis, 'updatedAt'>)[] = [
  'executiveSummary', 'agreements', 'disagreements', 'risks', 'openQuestions',
  'modelSpecificObservations', 'proposedCanonicalStateUpdate', 'proposedNextActions',
];

export default function MediatorPanel({ state, onUpdate, onNavigate }: Props) {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const activeRound = getActiveRound(state);
  const currentRound = getCurrentRound(state);

  // v0.11.0 Checkpoint D — Upload .md → Import Preview → Raw Notes.
  //
  // One hook instance per panel. The hook owns: file-input ref, picker
  // trigger, file-read → buildImportPreview, modal open/close, Raw Notes
  // commit dispatch with storage-pressure guard. The modal's structured
  // Import button is rendered DISABLED (Checkpoint E will land structured
  // commit). Detected source kind drives the modal's target-summary
  // display; mediator_packet and mediator_synthesis both route here.
  const mdUpload = useMarkdownUpload(state, onUpdate, { panelLabel: 'in Mediator' });

  // v0.10.5: `generatedPacket` is derived from `round.mediatorPrompt` rather
  // than held as separate React-local state. The duplicate state caused a
  // React purity violation in v0.10.4 — `handleGenerate` was calling
  // `setGeneratedPacket(packet)` inside an `onUpdate((prev) => ...)`
  // functional updater, which React's docs explicitly disallow. By
  // deriving from the canonical round state, the updater stays pure
  // (it only computes the next round) and the display naturally reflects
  // whatever was just persisted.
  const [packetCopied, setPacketCopied] = useState(false);
  const [packetCopyFailed, setPacketCopyFailed] = useState(false);
  const [localMediatorResponse, setLocalMediatorResponse] = useState('');
  const [responseSaved, setResponseSaved] = useState(false);
  const [synthesis, setSynthesis] = useState<MediatorSynthesis>(emptyMediatorSynthesis());
  const [synthesisSaved, setSynthesisSaved] = useState(false);
  const [extractedCount, setExtractedCount] = useState<number | null>(null);

  useEffect(() => {
    const round = activeRound ?? currentRound;
    if (round) {
      setLocalMediatorResponse(round.mediatorResponse ?? '');
      // Note: generatedPacket is no longer set here — it derives from
      // round.mediatorPrompt directly (see derivation below).
      if (round.mediatorSynthesis) setSynthesis(round.mediatorSynthesis);
      else setSynthesis(emptyMediatorSynthesis());
    }
  }, [activeRound?.id, currentRound?.id]);

  // ── Locked / no-round guards ────────────────────────────────────────────────

  if (!project || (!activeRound && !currentRound)) {
    return (
      <div className="panel">
        <div className="panel-header"><h1 className="panel-title">Mediator Summary</h1></div>
        <div className="empty-state">No rounds yet. Build a round and paste responses first.</div>
      </div>
    );
  }

  if (!activeRound && currentRound?.locked) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="flex-between">
            <h1 className="panel-title">Mediator Summary</h1>
            <span className="locked-badge locked">🔒 Round {currentRound.roundNumber} Locked</span>
          </div>
        </div>
        <div className="round-locked-banner mb-16">
          <span className="lock-icon">🔒</span>
          <div>Round {currentRound.roundNumber} is locked — read-only.
            <span className="text-muted" style={{ marginLeft: 8 }}>Use Round Builder to start a new round.</span>
          </div>
        </div>
        <LockedMediatorView round={currentRound} />
      </div>
    );
  }

  // ── Active round handlers ───────────────────────────────────────────────────

  const round = activeRound!;
  const progress = getRoundProgress(round);
  const mediatorReady = isRoundMediatorReady(round);
  // v0.10.5: derived display value — single source of truth is the round.
  const generatedPacket: string = round.mediatorPrompt ?? '';

  // v0.10.3: live response inclusion summary + stale-packet detection.
  // The summary tells the user exactly what the next packet WILL include.
  // Staleness compares the packet stored in round.mediatorPrompt against
  // what summarizeResponseInclusion currently sees: if any included row's
  // body length doesn't match a substring presence, the saved packet may
  // not reflect current responses.
  const inclusionRows = (() => {
    if (!project) return [];
    const selectedModels = state.modelProfiles.filter((m) => round.selectedModelIds.includes(m.id));
    return summarizeResponseInclusion(selectedModels, round.modelResponses);
  })();

  const packetIsStale = (() => {
    if (!round.mediatorPrompt) return false;
    // For each included response, the packet should contain the exact body
    // length marker we now emit, AND a substring of the body text. If any
    // included row's body is non-empty but absent from the saved packet,
    // the packet is stale.
    for (const row of inclusionRows) {
      if (row.category !== 'included') continue;
      const response = round.modelResponses.find((r) => r.modelProfileId === row.modelProfileId);
      const body = response?.responseText ?? '';
      if (!body) continue;
      // Use a short prefix as a cheap inclusion check.
      const prefix = body.trim().slice(0, 60);
      if (prefix && !round.mediatorPrompt.includes(prefix)) return true;
    }
    return false;
  })();

  const handleGenerate = () => {
    if (!project) return;
    // v0.10.5: pure functional updater. The recipe computes the next round
    // from the *latest* round resolved inside the updater (no stale
    // closure read), then returns it. No side effects inside the updater
    // — `generatedPacket` is derived from `round.mediatorPrompt` outside,
    // so writing the packet to the round is the only state action needed.
    //
    // selectedModels and project are read from closure: they are
    // effectively static for the lifetime of this panel (changing them
    // requires navigating to a different tab, which unmounts this
    // component).
    onUpdate(
      updateRoundFunctional(round.id, (liveRound: Round): Round => {
        const selectedModels = state.modelProfiles.filter((m) =>
          liveRound.selectedModelIds.includes(m.id)
        );
        const packet = generateMediatorPacket({
          project,
          roundNumber: liveRound.roundNumber,
          userInstruction: liveRound.userInstruction,
          selectedModels,
          generatedPrompts: liveRound.generatedPrompts,
          modelResponses: liveRound.modelResponses,
          knownRisks: liveRound.risks,
          openQuestions: liveRound.openQuestions,
        });
        return { ...liveRound, mediatorPrompt: packet, updatedAt: nowIso() };
      })
    );
  };

  const handleCopyPacket = async () => {
    setPacketCopyFailed(false);
    const ok = await copyToClipboard(generatedPacket);
    if (ok) { setPacketCopied(true); setTimeout(() => setPacketCopied(false), 2500); }
    else setPacketCopyFailed(true);
  };

  // v0.11.0 Checkpoint C — Download .md for the mediator packet.
  //
  // Single-source-of-truth contract: the .md body wraps round.mediatorPrompt
  // (the EXACT packet string that Copy puts on the clipboard) inside a
  // frontmatter+heading frame. Inner packet content is byte-identical
  // to what the user copies — only the artifact wrapper differs.
  const [packetDownloading, setPacketDownloading] = useState(false);
  const [packetDownloadFailed, setPacketDownloadFailed] = useState(false);

  const handleDownloadPacket = async () => {
    if (!project) return;
    setPacketDownloadFailed(false);
    setPacketDownloading(true);
    try {
      await downloadMarkdownArtifact({
        kind: 'mediator_packet',
        ctx: { project },
        round,
      });
    } catch (err) {
      console.error('[RoundTable] Mediator packet .md download failed:', err);
      setPacketDownloadFailed(true);
    } finally {
      setPacketDownloading(false);
    }
  };

  // v0.11.0 Checkpoint C — Download .md for the saved structured synthesis.
  //
  // The synthesis artifact is built from round.mediatorSynthesis (the
  // structured object). It is only available when a synthesis has been
  // saved on the round; the in-progress `synthesis` local state is NOT
  // exported (the artifact reflects committed state). This keeps the
  // "what you exported" guarantee aligned with what the rest of the app
  // sees as the canonical synthesis.
  const [synthesisDownloading, setSynthesisDownloading] = useState(false);
  const [synthesisDownloadFailed, setSynthesisDownloadFailed] = useState(false);

  const handleDownloadSynthesis = async () => {
    if (!project) return;
    setSynthesisDownloadFailed(false);
    setSynthesisDownloading(true);
    try {
      await downloadMarkdownArtifact({
        kind: 'mediator_synthesis',
        ctx: { project },
        round,
      });
    } catch (err) {
      console.error('[RoundTable] Mediator synthesis .md download failed:', err);
      setSynthesisDownloadFailed(true);
    } finally {
      setSynthesisDownloading(false);
    }
  };

  const handleSaveResponse = () => {
    // v0.10.5: migrated from replaceRound(state, ...) to functional updater
    // so the mediatorResponse save composes correctly against the latest
    // round (matters if any concurrent dispatch lands in the same React
    // batch — e.g. the unmount-flush from ResponsesPanel).
    onUpdate(
      updateRoundFunctional(round.id, (liveRound: Round): Round => ({
        ...liveRound,
        mediatorResponse: localMediatorResponse,
        updatedAt: nowIso(),
      }))
    );
    setResponseSaved(true);
    setTimeout(() => setResponseSaved(false), 2000);
  };

  const handleExtract = () => {
    const { synthesis: extracted, extractedCount: count } = extractMediatorSections(localMediatorResponse);
    setSynthesis(extracted);
    setExtractedCount(count);
  };

  const handleSaveSynthesis = () => {
    // v0.10.5: migrated from replaceRound(state, ...) to functional updater.
    // The `saveMediatorSynthesis` helper produces the updated round from
    // any input round; we run it inside the recipe against the latest
    // round.
    onUpdate(
      updateRoundFunctional(round.id, (liveRound: Round): Round =>
        saveMediatorSynthesis(liveRound, synthesis)
      )
    );
    setSynthesisSaved(true);
    setTimeout(() => setSynthesisSaved(false), 2000);
  };

  const handleSynthesisField = (key: keyof Omit<MediatorSynthesis, 'updatedAt'>, value: string) => {
    setSynthesis((prev) => ({ ...prev, [key]: value }));
  };

  const hasMediatorResponse = localMediatorResponse.trim().length > 0;
  const synthesisFilled = synthesis.recommendedDecision.trim().length > 0 || synthesis.executiveSummary.trim().length > 0;

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex-between">
          <div>
            <h1 className="panel-title">Mediator Summary</h1>
            <p className="panel-desc">Generate packet → copy to GPT-5.5 → paste response → extract structured fields → review → proceed to Decision Log</p>
          </div>
          <span className={`locked-badge ${round.locked ? 'locked' : 'unlocked'}`}>
            ✏️ Round {round.roundNumber}
          </span>
        </div>
      </div>

      {/* Step 1 + 2: Generate + copy packet */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Step 1 — Generate &amp; Copy Mediator Packet</span>
          {progress.hasMediatorResponse && <span className="badge badge-green">✓ Response saved</span>}
        </div>

        {!mediatorReady && (
          <div className="notice danger mb-12">
            No model responses collected yet. Paste responses in the Responses tab first.
          </div>
        )}
        {mediatorReady && progress.responsesCollected < progress.responsesTotal && (
          <div className="notice mb-12">
            <strong>{progress.responsesCollected}/{progress.responsesTotal} responses collected.</strong> Packet will note missing responses.
          </div>
        )}

        <div className="flex gap-8 mb-12" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={!mediatorReady}>
            {generatedPacket ? 'Regenerate Packet' : 'Generate Mediator Packet'}
          </button>
          {generatedPacket && (
            <button className={`btn ${packetCopied ? 'btn-secondary' : 'btn-secondary'}`} onClick={handleCopyPacket}>
              {packetCopied ? '✓ Copied!' : 'Copy → GPT-5.5 Thinking'}
            </button>
          )}
          {/* v0.11.0 Checkpoint C — Download .md (mediator packet artifact).
              Available whenever a generated packet exists. Same source
              string as Copy: the artifact body wraps round.mediatorPrompt
              verbatim inside the structured frontmatter frame. */}
          {generatedPacket && (
            <button
              className="btn btn-secondary"
              onClick={handleDownloadPacket}
              disabled={packetDownloading}
              aria-label="Download mediator packet as Markdown"
              title="Download a .md handoff artifact (frontmatter + body)"
            >
              {packetDownloading ? '…Saving' : 'Download .md'}
            </button>
          )}
          {/* v0.11.0 Checkpoint D — Upload .md (mediator packet OR synthesis).
              The hook's preview detects source_kind from the file's
              frontmatter. Body-only files and malformed YAML both open
              the modal with appropriate warnings; the user picks Cancel
              or Import as Raw Notes. Structured commit is deferred to
              Checkpoint E — the modal renders the structured Import
              button disabled with an explanatory note. */}
          <button
            className="btn btn-secondary"
            onClick={mdUpload.triggerUpload}
            disabled={mdUpload.loading}
            aria-label="Upload mediator packet or synthesis .md file"
            title="Upload a .md handoff artifact (mediator packet or synthesis). Opens the import preview."
          >
            {mdUpload.loading ? '…Loading' : 'Upload .md'}
          </button>
        </div>

        {/* Hidden file input — clicked by the Upload .md button above. */}
        <input
          ref={mdUpload.fileInputRef}
          type="file"
          accept={mdUpload.acceptString}
          onChange={mdUpload.onFileInputChange}
          style={{ display: 'none' }}
          aria-hidden="true"
        />

        {mdUpload.error && (
          <div className="notice danger mb-8 text-xs">{mdUpload.error}</div>
        )}
        {mdUpload.status && (
          <div className="notice info mb-8 text-xs">{mdUpload.status}</div>
        )}

        {packetCopyFailed && (
          <div className="notice danger mb-8 text-xs">Clipboard failed. Select all text below and copy manually.</div>
        )}
        {packetDownloadFailed && (
          <div className="notice danger mb-8 text-xs">
            Markdown download failed. See the browser console for details.
          </div>
        )}

        {/* v0.10.3: Response inclusion summary — confirms what the next-generated
            packet will contain. Always shown when a round has selected models so
            the user can verify before clicking Copy. */}
        {inclusionRows.length > 0 && (
          <ResponseInclusionSummary
            rows={inclusionRows}
            packetIsStale={packetIsStale}
            hasPacket={Boolean(generatedPacket)}
          />
        )}

        {generatedPacket && (
          <details>
            <summary className="text-xs text-muted" style={{ cursor: 'pointer', listStyle: 'none' }}>
              ▶ View generated packet ({generatedPacket.length.toLocaleString()} chars)
            </summary>
            <div className="prompt-box mediator mt-8" style={{ maxHeight: 320 }}>{generatedPacket}</div>
          </details>
        )}
      </div>

      {/* Step 3: Paste mediator response */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Step 2 — Paste Mediator Response</span>
          {responseSaved && <span className="badge badge-green">✓ Saved</span>}
        </div>
        <p className="text-xs text-muted mb-10">
          After GPT-5.5 Thinking responds, paste the full response here. Then click Extract to populate structured fields.
        </p>
        <textarea
          className="form-textarea xlarge"
          placeholder="Paste GPT-5.5 Thinking's full response here…"
          value={localMediatorResponse}
          onChange={(e) => setLocalMediatorResponse(e.target.value)}
          onBlur={handleSaveResponse}
        />
        <div className="flex gap-8 mt-8">
          <button
            className="btn btn-primary"
            onClick={() => { handleSaveResponse(); handleExtract(); }}
            disabled={!hasMediatorResponse}
          >
            Save &amp; Extract Structured Fields
          </button>
          <button className="btn btn-secondary" onClick={handleSaveResponse} disabled={!hasMediatorResponse}>
            {responseSaved ? '✓ Saved' : 'Save Response'}
          </button>
        </div>
        {extractedCount !== null && (
          <div className={`notice mt-8 ${extractedCount > 0 ? 'info' : 'danger'} text-xs`}>
            {extractedCount > 0
              ? `Extracted ${extractedCount} sections from the response. Review and edit the fields below, then save.`
              : 'No ### headings found — all fields left blank for manual entry. Fill them in below and save.'}
          </div>
        )}
      </div>

      {/* Step 4: Structured synthesis fields */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Step 3 — Review &amp; Edit Structured Synthesis</span>
          <div className="flex gap-8">
            {round.mediatorSynthesis?.updatedAt && (
              <span className="text-xs text-muted">Saved {formatDisplay(round.mediatorSynthesis.updatedAt)}</span>
            )}
            {synthesisSaved && <span className="copy-confirm">✓ Saved</span>}
          </div>
        </div>

        <div className="notice mb-12 info text-xs">
          These fields are user-editable. Nothing here is applied automatically.
          <strong> Proposed Canonical State Update</strong> requires explicit approval in Decision Log.
        </div>

        {(Object.keys(SYNTHESIS_FIELD_LABELS) as (keyof Omit<MediatorSynthesis, 'updatedAt'>)[]).map((key) => {
          const isTall = TALL_FIELDS.includes(key);
          const isCanonicalUpdate = key === 'proposedCanonicalStateUpdate';
          return (
            <div className="form-group" key={key}>
              <label className="form-label" style={{ color: isCanonicalUpdate ? 'var(--amber)' : undefined }}>
                {SYNTHESIS_FIELD_LABELS[key]}
                {isCanonicalUpdate && ' ⚠ Not auto-applied'}
              </label>
              <textarea
                className="form-textarea"
                style={{ minHeight: isTall ? 120 : 72 }}
                value={synthesis[key]}
                onChange={(e) => handleSynthesisField(key, e.target.value)}
                placeholder={`(${SYNTHESIS_FIELD_LABELS[key]})`}
              />
            </div>
          );
        })}

        <button className="btn btn-primary" onClick={handleSaveSynthesis} disabled={!synthesisFilled} style={{ width: '100%' }}>
          {synthesisSaved ? '✓ Synthesis Saved' : 'Save Structured Synthesis'}
        </button>

        {/* v0.11.0 Checkpoint C — Download .md for the saved structured
            synthesis. Available only when round.mediatorSynthesis exists
            (i.e. the user has already clicked "Save Structured Synthesis"
            at least once on this round). In-progress unsaved edits in
            the form above are NOT exported — the artifact reflects the
            canonical, committed synthesis. */}
        {round.mediatorSynthesis && (
          <>
            <div className="flex gap-8 mt-8" style={{ alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={handleDownloadSynthesis}
                disabled={synthesisDownloading}
                aria-label="Download mediator synthesis as Markdown"
                title="Download a .md handoff artifact (frontmatter + structured synthesis body)"
              >
                {synthesisDownloading ? '…Saving' : 'Download Synthesis .md'}
              </button>
              <span className="text-xs text-muted">
                Exports the saved synthesis. In-progress edits above are not included until you Save.
              </span>
            </div>
            {synthesisDownloadFailed && (
              <div className="notice danger mt-8 text-xs">
                Markdown download failed. See the browser console for details.
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigate to Decision Log */}
      {synthesisFilled && (
        <div className="next-step-cue"
          onClick={() => onNavigate('decisions')}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('decisions')}>
          <span className="text-xs">Synthesis ready</span>
          <strong style={{ fontSize: 13 }}>Record Decision</strong>
          <span className="next-step-cue-arrow">→</span>
        </div>
      )}

      {/* v0.11.0 Checkpoint D — Import Preview modal. Mounted once at
          the panel level; the hook owns open/close state. */}
      <ImportPreviewModal {...mdUpload.modalProps} />
    </div>
  );
}

// Read-only view for locked rounds
function LockedMediatorView({ round }: { round: NonNullable<ReturnType<typeof getCurrentRound>> }) {
  const synthesis = round.mediatorSynthesis;
  return (
    <>
      {round.mediatorResponse && (
        <div className="card mb-16">
          <div className="card-title mb-8">Full Mediator Response</div>
          <div className="prompt-box mediator" style={{ maxHeight: 300 }}>{round.mediatorResponse}</div>
        </div>
      )}
      {synthesis && (
        <div className="card">
          <div className="card-title mb-12">Structured Synthesis (Read-Only)</div>
          {(Object.keys(SYNTHESIS_FIELD_LABELS) as (keyof Omit<MediatorSynthesis, 'updatedAt'>)[]).map((key) => {
            const val = synthesis[key];
            if (!val) return null;
            return (
              <div key={key} className="mb-16">
                <div className="section-heading">{SYNTHESIS_FIELD_LABELS[key]}</div>
                <div className="prompt-box" style={{ whiteSpace: 'pre-wrap', maxHeight: 200 }}>{val}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── v0.10.3: Response inclusion summary ─────────────────────────────────────
//
// Compact, readable summary placed near the packet controls so the user can
// verify what's actually in the packet before copying. Format per §6 of the
// v0.10.3 brief:
//
//   Mediator Packet Includes:
//   - GPT-5.5 Thinking — included — 2,140 chars
//   - Claude Opus 4.7 — included — 8,300 chars
//   - Claude Haiku 4.5 — missing response
//   - Claude Sonnet 4.6 — excluded
//
// Also shows a stale-packet banner when the saved packet doesn't appear to
// reflect the current responses, prompting the user to click Regenerate.

function ResponseInclusionSummary({
  rows,
  packetIsStale,
  hasPacket,
}: {
  rows: ResponseInclusionRow[];
  packetIsStale: boolean;
  hasPacket: boolean;
}) {
  const includedCount = rows.filter((r) => r.category === 'included').length;
  const missingCount = rows.filter((r) => r.category === 'missing').length;
  const excludedCount = rows.filter((r) => r.category === 'excluded').length;

  return (
    <div className="notice mb-8" style={{ padding: '8px 12px' }}>
      <div className="text-xs" style={{ fontWeight: 600, marginBottom: 6 }}>
        Mediator Packet Includes:
      </div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {rows.map((row) => {
          const tail =
            row.category === 'included'
              ? `included — ${row.charCount.toLocaleString()} chars`
              : row.category === 'missing'
              ? 'missing response'
              : 'excluded';
          const color =
            row.category === 'included'
              ? 'var(--green)'
              : row.category === 'missing'
              ? 'var(--red)'
              : 'var(--text-muted)';
          return (
            <li
              key={row.modelProfileId}
              className="text-xs"
              style={{ marginBottom: 2 }}
            >
              <span>{row.modelDisplayName} — </span>
              <span style={{ color }}>{tail}</span>
            </li>
          );
        })}
      </ul>
      <div className="text-xs text-muted" style={{ marginTop: 6 }}>
        Total: {includedCount} included
        {missingCount > 0 ? `, ${missingCount} missing` : ''}
        {excludedCount > 0 ? `, ${excludedCount} excluded` : ''}.
      </div>
      {hasPacket && packetIsStale && (
        <div
          className="notice danger text-xs"
          style={{ marginTop: 8, padding: '6px 10px' }}
        >
          ⚠ The saved mediator packet looks stale relative to the current
          responses (a response was edited after the packet was last generated).
          Click <strong>Regenerate Packet</strong> before copying.
        </div>
      )}
    </div>
  );
}
