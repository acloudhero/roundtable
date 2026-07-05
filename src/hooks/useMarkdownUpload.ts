// src/hooks/useMarkdownUpload.ts
// Purpose: v0.11.0 Checkpoint D — encapsulate the Upload-.md → preview →
//          Raw Notes flow used by every panel that needs to accept .md
//          handoff artifacts.
//
// Why a hook (not duplicated per-panel state):
//
//   - Three panels (RoundBuilder, Responses, Mediator) need the same
//     state machine: idle → reading-file → previewing → committing →
//     idle (with a parallel error rail). Putting this in one hook
//     means there is exactly one path and one set of UI states to
//     maintain.
//
//   - The Raw Notes commit dispatch chain is non-trivial: project
//     pre-write storage pressure, compose with prior storage banner
//     state, give the user a chance to abort on hard pressure, then
//     dispatch the updater. Centralising this avoids three copies of
//     subtle storage-guard logic.
//
//   - The hook returns a `ready-to-spread` props object for the
//     ImportPreviewModal. Panels never touch the modal's props
//     individually — the hook ships a complete contract.
//
// Strict Checkpoint D scope:
//   - Only Raw Notes commit is wired. The modal's structured Import
//     button is rendered DISABLED with `structuredImportDeferredReason`
//     set, so the user sees the affordance is coming but the action
//     can't fire. Checkpoint E will land structured commit through
//     `commitStructured` from utils/importHistory.ts.
//
//   - File reading is plain `text()` from the standard File API; no
//     drag-and-drop, no chunked reads, no encoding negotiation.
//
//   - Storage pressure is pre-projected via `projectPostWritePressure`.
//     On 'hard' level we surface a modal.confirm (v0.12.0 Checkpoint J;
//     formerly window.confirm) so the user has explicit agency before
//     pushing localStorage closer to its limit. On a true quota-exceeded
//     save error the existing app-shell StoragePressureBanner takes over
//     (errored state surfaces on the next save effect tick).
//
//   - The hook does NOT mutate state on cancel. It is purely
//     additive — every error / dismissal returns the user to the
//     pre-upload UI with no observable change.
//
// Owned by: this file
// Used by:  RoundBuilderPanel, ResponsesPanel, MediatorPanel (each
//           per-panel Upload .md button). Future panels can adopt the
//           same hook without code duplication.

import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, AppStateUpdater } from '../types/appState';
import { ImportPreview, ImportPreviewContext } from '../types/markdownArtifact';
import { buildImportPreview } from '../utils/artifactImport';
// v0.11.0 Checkpoint E — commitStructured is the structured-import
// dispatcher in utils/importHistory.ts. For Checkpoint E we ONLY wire
// it for source_kind: mediator_synthesis; all other source kinds
// continue to render the modal's Import button as deferred.
import { commitAsRawNote, commitStructured } from '../utils/importHistory';
import { byteLength, projectPostWritePressure, formatBytes } from '../utils/storagePressure';
import { MARKDOWN_FILE_ACCEPT, STORAGE_HARD_BYTES } from '../config/markdownHandoff';
// v0.12.0 Checkpoint J — Modal System Replacement. The two storage-
// pressure hard-gate prompts in onImport and onImportAsRaw used to
// call window.confirm; they now await modal.confirm.
import { useModal } from '../components/Modal';

/**
 * Hook return type. The shape is deliberately verbose so panels can
 * pick exactly the affordances they want to render. The {modalProps}
 * field bundles everything the ImportPreviewModal needs into a single
 * spreadable object.
 */
export interface MarkdownUploadHandle {
  /** Ref to attach to a hidden `<input type="file" />`. */
  fileInputRef: React.RefObject<HTMLInputElement>;
  /** Programmatic upload trigger — call from the panel's Upload .md button. */
  triggerUpload: () => void;
  /** Wire to the same hidden input's `onChange`. */
  onFileInputChange: React.ChangeEventHandler<HTMLInputElement>;
  /** True while a file is being read or the preview is being built. */
  loading: boolean;
  /** Last upload error (file read failure, preview build failure). Null when none. */
  error: string | null;
  /** Last informational status — e.g. "Saved as Raw Note". Null when none. */
  status: string | null;
  /** Full props bundle for ImportPreviewModal. Spread it directly. */
  modalProps: {
    open: boolean;
    preview: ImportPreview | null;
    onImport: () => void;
    onImportAsRaw: () => void;
    onCancel: () => void;
    structuredImportDeferredReason?: string;
  };
  /** Accept attribute string for the file input. Locked by config. */
  acceptString: string;
}

/**
 * The Checkpoint D upload hook (extended in F + G).
 *
 * @param state    The current AppState. Used by buildImportPreview for
 *                 referential lookups (project/round/model) and by the
 *                 storage projection.
 * @param onUpdate The standard panel onUpdate dispatcher. The hook
 *                 calls it with a commitAsRawNote / commitStructured-
 *                 produced updater.
 *
 * Optional config:
 *   - `panelLabel`: a string included in status/error messages so the
 *                   user knows which panel triggered the modal.
 *
 *   - v0.11.0 Checkpoint G additions —
 *     `expectedSourceKind`: when the affordance only meaningfully
 *                   accepts one source kind (e.g. ResponsesPanel
 *                   per-slot Upload .md expects 'model_response'),
 *                   passing it surfaces a hard SOURCE_KIND_INVALID
 *                   warning on mismatch.
 *     `expectedModelId`:    when the affordance is bound to a
 *                   specific model slot, passing the slot's model id
 *                   surfaces MODEL_ID_MISMATCH_WITH_SLOT on mismatch
 *                   and lets the deferred-reason gate block
 *                   structured commit.
 */
export function useMarkdownUpload(
  state: AppState,
  onUpdate: (updater: AppStateUpdater) => void,
  options?: {
    panelLabel?: string;
    expectedSourceKind?: ImportPreviewContext['expectedSourceKind'];
    expectedModelId?: ImportPreviewContext['expectedModelId'];
  }
): MarkdownUploadHandle {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  // v0.12.0 Checkpoint J — Modal System Replacement.
  // The two storage-pressure hard-gates in onImport / onImportAsRaw
  // call modal.confirm via this handle. The handle is a stable
  // reference (memoized inside ModalProvider) so useCallback deps
  // including it don't churn.
  const modal = useModal();

  const panelLabel = options?.panelLabel ?? '';
  const expectedSourceKind = options?.expectedSourceKind;
  const expectedModelId = options?.expectedModelId;

  // Open the file picker.
  const triggerUpload = useCallback(() => {
    // Reset transient state from any prior upload so the user starts
    // fresh. We do NOT clear `preview` until after the picker closes,
    // so a quick re-trigger doesn't flicker the modal.
    setError(null);
    setStatus(null);
    fileInputRef.current?.click();
  }, []);

  // File picker change handler.
  const onFileInputChange: React.ChangeEventHandler<HTMLInputElement> =
    useCallback(
      async (e) => {
        const file = e.target.files?.[0];
        // Reset the input value so re-selecting the SAME file fires onChange again.
        e.target.value = '';
        if (!file) return;

        setLoading(true);
        setError(null);
        setStatus(null);
        try {
          // The File.text() API decodes as UTF-8. BOM stripping happens
          // in buildImportPreview via normalizeForHash, so we don't need
          // to pre-strip here.
          const text = await file.text();
          // v0.11.0 Checkpoint G — forward optional expectations so the
          // preview can surface mismatch warnings (e.g. per-slot Upload
          // .md in ResponsesPanel passes expectedModelId).
          const result = await buildImportPreview(text, state, {
            expectedSourceKind,
            expectedModelId,
          });
          setPreview(result);
          setOpen(true);
        } catch (err) {
          // Read or parse failure. We do NOT auto-save — the user
          // sees an error and can retry. Their original file is
          // untouched on disk.
          const msg =
            err instanceof Error ? err.message : 'Unknown error reading file';
          setError(
            `Failed to read .md file${panelLabel ? ` ${panelLabel}` : ''}: ${msg}`
          );
          setPreview(null);
          setOpen(false);
        } finally {
          setLoading(false);
        }
      },
      [state, panelLabel, expectedSourceKind, expectedModelId]
    );

  // Modal: cancel.
  const onCancel = useCallback(() => {
    setOpen(false);
    setPreview(null);
  }, []);

  // v0.11.0 Checkpoint G — structured Import path now spans TWO
  // source kinds: mediator_synthesis (Checkpoint E) and model_response
  // (this checkpoint). For all other source kinds the modal's primary
  // Import button stays disabled via `structuredImportDeferredReason`
  // (computed below in modalProps).
  //
  // Common shape for both branches:
  //   1. Defensive re-check of eligibility (source_kind, round_id,
  //      target round resolves, round not locked, slot resolves for
  //      model_response).
  //   2. Pre-project storage pressure — structured commits carry the
  //      WHOLE round snapshot in the ImportTransaction.
  //   3. Dispatch via commitStructured → onUpdate. The dispatcher in
  //      utils/importHistory.ts routes to the right
  //      commit<SourceKind> helper.
  //   4. Close the modal on success; surface a status confirmation
  //      with the new transaction id so the user can locate it in
  //      Import History if they need to roll back.
  const onImport = useCallback(async () => {
    if (!preview) {
      setError('No preview available. Re-open the file and try again.');
      return;
    }
    const fm = preview.frontmatter;
    if (!fm || !fm.source_kind) {
      setError(
        'Cannot structured-import: the artifact has no recognizable ' +
        'frontmatter. Use Import as Raw Notes to preserve the content.'
      );
      return;
    }

    // Whitelist of structured-commit kinds wired through this hook in
    // Checkpoints E (mediator_synthesis), G (model_response), and
    // H (generated_prompt, mediator_packet). Defensive: even if the
    // modal's Import button somehow fires for a non-whitelisted kind,
    // we surface an error rather than risk a misroute. raw_notes
    // routes via 'import_as_raw' and never reaches here.
    const STRUCTURED_KINDS = [
      'mediator_synthesis',
      'model_response',
      'generated_prompt',
      'mediator_packet',
    ] as const;
    if (!(STRUCTURED_KINDS as readonly string[]).includes(fm.source_kind)) {
      setError(
        `Structured import for source_kind "${fm.source_kind}" is not yet ` +
        `available. Use Import as Raw Notes to preserve the content.`
      );
      return;
    }

    if (!fm.round_id) {
      setError(
        'Cannot structured-import: the artifact does not declare a round_id. ' +
        'Use Import as Raw Notes to preserve the content.'
      );
      return;
    }
    const targetRound = state.rounds.find((r) => r.id === fm.round_id);
    if (!targetRound) {
      setError(
        `Cannot structured-import: round_id "${fm.round_id}" does not resolve ` +
        `to any round in this RoundTable. Use Import as Raw Notes to preserve ` +
        `the content.`
      );
      return;
    }
    // v0.11.0 Checkpoint G — locked-round protection. The preview also
    // emits LOCKED_ROUND as a warning, but we re-check here so a stale
    // closure can't slip through. The modal's deferred-reason gate
    // already disables Import in this case; this is belt-and-suspenders.
    if (targetRound.locked) {
      setError(
        `Cannot structured-import: Round ${targetRound.roundNumber} is locked. ` +
        `Use Import as Raw Notes to preserve the content.`
      );
      return;
    }

    // v0.11.0 Checkpoint G — model_response specific re-checks.
    //
    // The preview's analyzeModelResponseTarget already emitted
    // MODEL_ID_MISMATCH_WITH_SLOT / MODEL_ID_NOT_IN_ROSTER warnings
    // when applicable. The deferred-reason gate then blocks structured
    // commit. Here we re-resolve to make absolutely sure we route to
    // the correct slot — duplicating the check is cheap and prevents
    // any future regression in the gate from silently misrouting.
    if (fm.source_kind === 'model_response') {
      if (!fm.model_id) {
        setError(
          'Cannot structured-import: the model_response artifact does not ' +
          'declare a model_id. Use Import as Raw Notes to preserve the content.'
        );
        return;
      }
      // Either an existing slot already exists for this model, or the
      // model is selected for the round (allowed: append new slot).
      const hasSlot = targetRound.modelResponses.some((r) => r.modelProfileId === fm.model_id);
      const isSelected = targetRound.selectedModelIds.includes(fm.model_id);
      if (!hasSlot && !isSelected) {
        setError(
          `Cannot structured-import: model_id "${fm.model_id}" has no ` +
          `response slot on Round ${targetRound.roundNumber} and is not in ` +
          `the selected-model list. Add the model to the round first, or ` +
          `Import as Raw Notes.`
        );
        return;
      }
      // Per-slot mismatch — the affordance was bound to a specific
      // model id and the file targets a different one.
      if (expectedModelId && fm.model_id !== expectedModelId) {
        setError(
          `Cannot structured-import: this upload affordance is bound to ` +
          `model_id "${expectedModelId}" but the file declares "${fm.model_id}". ` +
          `Use Import as Raw Notes to preserve the content, or upload the file ` +
          `through the panel-level Upload .md affordance to route by frontmatter.`
        );
        return;
      }
    }

    // v0.11.0 Checkpoint H — generated_prompt specific re-checks.
    // Same shape as model_response; the preview's
    // analyzeGeneratedPromptTarget already emitted warnings, but we
    // re-check defensively so a stale closure cannot misroute.
    if (fm.source_kind === 'generated_prompt') {
      if (!fm.model_id) {
        setError(
          'Cannot structured-import: the generated_prompt artifact does not ' +
          'declare a model_id. Use Import as Raw Notes to preserve the content.'
        );
        return;
      }
      const hasSlot = targetRound.generatedPrompts.some((p) => p.modelProfileId === fm.model_id);
      const isSelected = targetRound.selectedModelIds.includes(fm.model_id);
      if (!hasSlot && !isSelected) {
        setError(
          `Cannot structured-import: model_id "${fm.model_id}" has no ` +
          `generated prompt slot on Round ${targetRound.roundNumber} and is not ` +
          `in the selected-model list. Add the model to the round first, or ` +
          `Import as Raw Notes.`
        );
        return;
      }
    }

    // mediator_packet has no model-level concerns; round-level checks
    // (resolution + locked) already executed above.

    // Storage projection — structured commits append both the new
    // round state AND a snapshotBefore on the ImportTransaction.
    // Conservative estimate: the body bytes plus a round-snapshot
    // overhead (rough upper bound from current round size).
    const roundSnapshotBytes = byteLength(JSON.stringify(targetRound));
    const extraBytes = byteLength(preview.normalizedBody) + roundSnapshotBytes + 4096;
    const projected = projectPostWritePressure(state, extraBytes);
    if (projected.level === 'hard') {
      // v0.12.0 Checkpoint J — replaces window.confirm. Same gate, same
      // message, theme-styled modal.
      const proceed = await modal.confirm({
        title: 'Storage near limit',
        message:
          'Structured importing this artifact would push localStorage ' +
          `past the safe threshold (projected ${projected.bytesHuman}, ` +
          `hard limit ${formatBytes(STORAGE_HARD_BYTES)}).\n\n` +
          'If the save fails after this point, your most recent change ' +
          'will be in memory but not persisted. We recommend exporting ' +
          'current state from the Export / Import tab and pruning Raw ' +
          'Notes or Import History first.',
        confirmLabel: 'Proceed anyway',
        cancelLabel: 'Cancel',
        destructive: false,
      });
      if (!proceed) return;
    }

    try {
      const result = commitStructured(preview, state);
      onUpdate(result.updater);
      const txTail = result.transaction.id.slice(-12);
      if (fm.source_kind === 'mediator_synthesis') {
        setStatus(
          `Imported mediator synthesis into Round ${targetRound.roundNumber}. ` +
          `Transaction id: ${txTail} (see Import History to roll back).`
        );
      } else if (fm.source_kind === 'model_response') {
        const profile = state.modelProfiles.find((m) => m.id === fm.model_id);
        const displayName = profile?.displayName ?? fm.model_id ?? 'model';
        setStatus(
          `Imported response from ${displayName} into Round ${targetRound.roundNumber}. ` +
          `Transaction id: ${txTail} (see Import History to roll back).`
        );
      } else if (fm.source_kind === 'generated_prompt') {
        const profile = state.modelProfiles.find((m) => m.id === fm.model_id);
        const displayName = profile?.displayName ?? fm.model_id ?? 'model';
        setStatus(
          `Imported generated prompt for ${displayName} into Round ${targetRound.roundNumber}. ` +
          `Transaction id: ${txTail} (see Import History to roll back).`
        );
      } else {
        // mediator_packet — round-scoped, no model.
        setStatus(
          `Imported mediator packet into Round ${targetRound.roundNumber}. ` +
          `Transaction id: ${txTail} (see Import History to roll back).`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(
        `Failed to commit structured import: ${msg}. The original file is unchanged ` +
        `and you can still Import as Raw Notes to preserve the content.`
      );
      // Keep the modal open so the user can fall back to Raw Notes.
      return;
    }

    setOpen(false);
    setPreview(null);
  }, [preview, state, onUpdate, expectedModelId, modal]);

  // Modal: Import as Raw Notes — the main commit path for Checkpoint D.
  const onImportAsRaw = useCallback(async () => {
    if (!preview) {
      setError('No preview available. Re-open the file and try again.');
      return;
    }

    // Pre-project storage pressure before dispatching. A Raw Note
    // carries the *verbatim* raw text — for large files this can
    // meaningfully push localStorage usage. We give the user a
    // confirmation prompt at the 'hard' level so they don't blindly
    // saturate storage; on 'warn' we proceed silently (the app-shell
    // banner already surfaces ongoing pressure).
    const extraBytes = byteLength(preview.rawText) + 4096; // ~4 KB tx overhead
    const projected = projectPostWritePressure(state, extraBytes);

    if (projected.level === 'hard') {
      // v0.12.0 Checkpoint J — replaces window.confirm. Same gate, same
      // message, theme-styled modal.
      const proceed = await modal.confirm({
        title: 'Storage near limit',
        message:
          'Importing this file would push localStorage past the safe ' +
          `threshold (projected ${projected.bytesHuman}, hard limit ` +
          `${formatBytes(STORAGE_HARD_BYTES)}).\n\n` +
          'If the save fails after this point, your most recent change ' +
          'will be in memory but not persisted. We recommend exporting ' +
          'current state from the Export / Import tab and pruning Raw ' +
          'Notes or Import History first.',
        confirmLabel: 'Proceed anyway',
        cancelLabel: 'Cancel',
        destructive: false,
      });
      if (!proceed) return;
    }

    try {
      const result = commitAsRawNote(preview);
      onUpdate(result.updater);
      setStatus(
        `Saved as Raw Note (status: ${result.transaction.changes[0]?.description ?? 'unknown'}).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to save as Raw Note: ${msg}. The original file is unchanged.`);
      // Keep the preview open so the user can copy out content if needed.
      return;
    }

    // Successful dispatch. Close the modal; the user can verify in the
    // Raw Notes tab. If the next save effect fails (quota exceeded),
    // the app-shell StoragePressureBanner will surface — content is
    // still in memory at that point.
    setOpen(false);
    setPreview(null);
  }, [preview, state, onUpdate, modal]);

  // v0.11.0 Checkpoints E + G — derive the deferred-reason CONDITIONALLY.
  //
  // The modal honors `structuredImportDeferredReason` by disabling the
  // primary Import button. We clear it (return undefined) only for the
  // commit-eligible source kinds wired through this hook:
  //
  //   - mediator_synthesis (Checkpoint E) — gates: no errors, round_id
  //     resolves.
  //   - model_response     (Checkpoint G) — gates: no errors, round_id
  //     resolves, round not locked, model_id resolves to a slot OR is
  //     in the round's selectedModelIds. When the affordance is bound
  //     to a specific expectedModelId, mismatch is also a hard gate.
  //
  // Other source kinds (generated_prompt, mediator_packet, raw_notes)
  // remain deferred.
  //
  // Hard-block warning codes for model_response: any of
  // MODEL_ID_MISMATCH_WITH_SLOT, MODEL_ID_NOT_IN_ROSTER, LOCKED_ROUND,
  // SOURCE_KIND_INVALID surfaces a specific deferred reason.
  // EXISTING_RESPONSE_WILL_BE_OVERWRITTEN is NOT a hard block — the
  // modal's two-step "Import anyway" gate is the deliberate-confirm
  // user action required by the brief.
  const deferredReason = useMemo<string | undefined>(() => {
    const fm = preview?.frontmatter;
    if (!preview || !fm || !fm.source_kind) {
      // No frontmatter / unusable preview — modal won't render structured
      // Import button anyway; the reason is moot.
      return undefined;
    }

    const hasErrors = preview.warnings.some((w) => w.severity === 'error');
    if (hasErrors) {
      // Universal hard block — preview.commitAvailable is already false
      // so the modal hides the structured Import button. Returning a
      // reason here is informational only.
      return 'Cannot structured-import: hard errors detected (see warnings above). ' +
             'Import as Raw Notes preserves the body verbatim.';
    }

    if (fm.source_kind === 'mediator_synthesis') {
      if (!fm.round_id) {
        return 'Cannot structured-import: the artifact does not declare a round_id. ' +
               'Import as Raw Notes preserves the body verbatim.';
      }
      const roundResolves = state.rounds.some((r) => r.id === fm.round_id);
      if (!roundResolves) {
        return `Cannot structured-import: round_id "${fm.round_id}" does not resolve to any ` +
               `round in this RoundTable. Import as Raw Notes preserves the body verbatim.`;
      }
      // Gate cleared — enable the primary Import button.
      return undefined;
    }

    if (fm.source_kind === 'model_response') {
      // model_response gates. Several of these the preview already
      // surfaced as warning-severity codes (analyzeModelResponseTarget),
      // and we promote them to "deferred" here so the button is
      // disabled even though the preview itself didn't emit a hard error.
      if (!fm.round_id) {
        return 'Cannot structured-import: the artifact does not declare a round_id. ' +
               'Import as Raw Notes preserves the body verbatim.';
      }
      const round = state.rounds.find((r) => r.id === fm.round_id);
      if (!round) {
        return `Cannot structured-import: round_id "${fm.round_id}" does not resolve to any ` +
               `round in this RoundTable. Import as Raw Notes preserves the body verbatim.`;
      }
      // Locked-round protection.
      if (round.locked) {
        return `Cannot structured-import: Round ${round.roundNumber} is locked. ` +
               `Import as Raw Notes preserves the body verbatim.`;
      }
      if (!fm.model_id) {
        return 'Cannot structured-import: the model_response artifact does not declare ' +
               'a model_id. Import as Raw Notes preserves the body verbatim.';
      }
      // Slot resolution: either an existing slot for this model id, or
      // the model is selected for the round (allowing append).
      const hasSlot = round.modelResponses.some((r) => r.modelProfileId === fm.model_id);
      const isSelected = round.selectedModelIds.includes(fm.model_id);
      if (!hasSlot && !isSelected) {
        return `Cannot structured-import: model_id "${fm.model_id}" has no response slot ` +
               `on Round ${round.roundNumber} and is not in the selected-model list. ` +
               `Import as Raw Notes preserves the body verbatim.`;
      }
      // Per-slot mismatch — only fires when the hook was instantiated
      // with an expectedModelId. The preview also emitted a warning
      // (MODEL_ID_MISMATCH_WITH_SLOT) that's visible above the action row.
      if (expectedModelId && fm.model_id !== expectedModelId) {
        return `Cannot structured-import: this upload affordance is bound to ` +
               `model_id "${expectedModelId}" but the file declares "${fm.model_id}". ` +
               `Import as Raw Notes preserves the body verbatim.`;
      }
      // All gates cleared — enable the primary Import button. Any
      // overwrite warning is surfaced visibly and the modal's
      // two-step "Import anyway" gate handles deliberate confirmation.
      return undefined;
    }

    if (fm.source_kind === 'generated_prompt') {
      // v0.11.0 Checkpoint H — generated_prompt gates: identical
      // shape to model_response (round resolves, not locked, model_id
      // resolves to slot or is selected). No per-slot affordance
      // exists for prompts in Checkpoint H so expectedModelId is not
      // consulted here.
      if (!fm.round_id) {
        return 'Cannot structured-import: the artifact does not declare a round_id. ' +
               'Import as Raw Notes preserves the body verbatim.';
      }
      const round = state.rounds.find((r) => r.id === fm.round_id);
      if (!round) {
        return `Cannot structured-import: round_id "${fm.round_id}" does not resolve to any ` +
               `round in this RoundTable. Import as Raw Notes preserves the body verbatim.`;
      }
      if (round.locked) {
        return `Cannot structured-import: Round ${round.roundNumber} is locked. ` +
               `Import as Raw Notes preserves the body verbatim.`;
      }
      if (!fm.model_id) {
        return 'Cannot structured-import: the generated_prompt artifact does not declare ' +
               'a model_id. Import as Raw Notes preserves the body verbatim.';
      }
      const hasSlot = round.generatedPrompts.some((p) => p.modelProfileId === fm.model_id);
      const isSelected = round.selectedModelIds.includes(fm.model_id);
      if (!hasSlot && !isSelected) {
        return `Cannot structured-import: model_id "${fm.model_id}" has no generated prompt slot ` +
               `on Round ${round.roundNumber} and is not in the selected-model list. ` +
               `Import as Raw Notes preserves the body verbatim.`;
      }
      return undefined;
    }

    if (fm.source_kind === 'mediator_packet') {
      // v0.11.0 Checkpoint H — mediator_packet gates: round-scoped
      // only. No model concerns. Overwrite warning is advisory and
      // handled by the two-step gate; it doesn't block here.
      if (!fm.round_id) {
        return 'Cannot structured-import: the artifact does not declare a round_id. ' +
               'Import as Raw Notes preserves the body verbatim.';
      }
      const round = state.rounds.find((r) => r.id === fm.round_id);
      if (!round) {
        return `Cannot structured-import: round_id "${fm.round_id}" does not resolve to any ` +
               `round in this RoundTable. Import as Raw Notes preserves the body verbatim.`;
      }
      if (round.locked) {
        return `Cannot structured-import: Round ${round.roundNumber} is locked. ` +
               `Import as Raw Notes preserves the body verbatim.`;
      }
      return undefined;
    }

    // All other source kinds — structured commit not yet wired.
    return 'Structured import for this source kind arrives in a later checkpoint. ' +
           'For now, Import as Raw Notes preserves the file verbatim so no data is lost.';
  }, [preview, state.rounds, expectedModelId]);

  const modalProps = useMemo(
    () => ({
      open,
      preview,
      onImport,
      onImportAsRaw,
      onCancel,
      structuredImportDeferredReason: deferredReason,
    }),
    [open, preview, onImport, onImportAsRaw, onCancel, deferredReason]
  );

  return {
    fileInputRef,
    triggerUpload,
    onFileInputChange,
    loading,
    error,
    status,
    modalProps,
    acceptString: MARKDOWN_FILE_ACCEPT,
  };
}
