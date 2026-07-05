// src/components/ImportPreviewModal.tsx
// Purpose: v0.11.0 Markdown Handoff Mode — the preview gate between
//          parse-and-validate and commit. The modal displays:
//            - detected source kind + target (project/round/model)
//            - warnings grouped by severity (Errors / Warnings / Info)
//            - a plain `<pre>` preview of the (normalized) body
//            - action row: Import / Import as Raw Notes / Cancel
//
// Checkpoint B scope (UI shell only):
//   - This component MUST compile and render correctly given any
//     ImportPreview from utils/artifactImport.ts::buildImportPreview().
//   - It is NOT yet wired into RoundBuilder / Responses / Mediator /
//     DecisionLog. Wiring is the next checkpoint.
//   - The modal is presentational: it receives an ImportPreview and
//     three callbacks (onImport, onImportAsRaw, onCancel) and never
//     performs validation, mutation, or storage writes itself.
//
// Strict design rules carried over from the v0.11.0 feasibility doc:
//   - Warning grouping order: Errors first, then Warnings, then Info.
//   - The most severe issue determines the default-action visibility:
//     when Errors are present, the primary "Import" action is hidden.
//   - "Import as Raw Notes" is ALWAYS available unless the available-
//     outcomes list excludes it (currently it never does, but we honor
//     the list to keep this component forward-compatible).
//   - Body preview is plain `<pre>` only — no Markdown render dependency
//     in v0.11.0 (Q14 decision).
//
// Owned by: this file
// Used by:  not yet wired — see CHECKPOINT_STATE.md and the next
//           implementation checkpoint.

import { useEffect, useMemo, useState } from 'react';
import {
  ImportOutcome,
  ImportPreview,
  ImportValidationWarning,
} from '../types/markdownArtifact';
import { copyToClipboard } from '../utils/clipboard';

interface Props {
  /** When true the modal is rendered. When false it is unmounted. */
  open: boolean;
  /** Result of utils/artifactImport.ts::buildImportPreview. Null is
   *  treated the same as `open === false` so the modal never renders
   *  garbage in an "opened but not yet built" intermediate state. */
  preview: ImportPreview | null;
  /** Called when the user chooses "Import" (only possible when no
   *  Errors are present and source_kind has a commit path). */
  onImport: () => void;
  /** Called when the user chooses "Import as Raw Notes". Always
   *  available unless the preview omits it from availableOutcomes. */
  onImportAsRaw: () => void;
  /** Called when the user chooses Cancel or dismisses the modal. */
  onCancel: () => void;
  /** v0.11.0 Checkpoint D: when set, the structured "Import" button is
   *  rendered DISABLED with this string surfaced as both a tooltip and
   *  a small note below the body preview. Used by useMarkdownUpload to
   *  signal that structured commit is deferred until Checkpoint E. */
  structuredImportDeferredReason?: string;
}

/**
 * The Import Preview modal.
 *
 * This is a *presentational* component. It does not own any state
 * beyond UI affordances (an "Import anyway" two-step toggle when
 * warnings are present, body-copy feedback, etc.). All decisions
 * about what actions are available are read from `preview.availableOutcomes`
 * and `preview.defaultOutcome`.
 */
export default function ImportPreviewModal({
  open,
  preview,
  onImport,
  onImportAsRaw,
  onCancel,
  structuredImportDeferredReason,
}: Props) {
  // Two-step confirmation for "Import" when warnings exist. The user
  // clicks Import once → button label changes to "Confirm Import" →
  // clicks again to actually commit. This matches the "deliberate
  // two-step" pattern from the v0.11.0 feasibility doc, sec. 13 (UX
  // risks → warning fatigue mitigation).
  const [importConfirming, setImportConfirming] = useState(false);
  const [bodyCopied, setBodyCopied] = useState(false);

  // Reset the two-step state whenever the preview changes (a new file
  // was uploaded) or the modal closes.
  useEffect(() => {
    setImportConfirming(false);
    setBodyCopied(false);
  }, [preview, open]);

  // Group warnings by severity once per render. useMemo keeps the
  // group references stable across re-renders that don't change the
  // warning list.
  const grouped = useMemo(() => groupWarnings(preview?.warnings ?? []), [preview]);

  if (!open || !preview) return null;

  const errors = grouped.errors;
  const warnings = grouped.warnings;
  const infos = grouped.info;
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  const canCommit = preview.availableOutcomes.includes('commit') && !hasErrors;
  const canImportAsRaw = preview.availableOutcomes.includes('import_as_raw');

  const handleImportClick = () => {
    // No warnings → commit immediately.
    if (!hasWarnings) {
      onImport();
      return;
    }
    // Two-step: first click sets `importConfirming`, second commits.
    if (!importConfirming) {
      setImportConfirming(true);
      return;
    }
    onImport();
  };

  const handleCopyBody = async () => {
    const ok = await copyToClipboard(preview.normalizedBody);
    if (ok) {
      setBodyCopied(true);
      setTimeout(() => setBodyCopied(false), 2000);
    }
  };

  return (
    <div
      className="import-preview-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-preview-modal-title"
      // Backdrop click = cancel. Use onMouseDown so accidental drags
      // inside the modal don't close it.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="import-preview-modal">
        <header className="import-preview-modal-header">
          <h2 id="import-preview-modal-title" className="panel-title" style={{ margin: 0 }}>
            Import Preview
          </h2>
          <button
            className="btn btn-ghost text-xs"
            onClick={onCancel}
            aria-label="Close import preview"
          >
            ✕
          </button>
        </header>

        {/* ── Target summary ─────────────────────────────────────────────── */}
        <section className="import-preview-section">
          <div className="section-heading">Target</div>
          <TargetSummary preview={preview} />
        </section>

        {/* ── Warnings, grouped by severity ──────────────────────────────── */}
        {(errors.length > 0 || warnings.length > 0 || infos.length > 0) && (
          <section className="import-preview-section">
            <div className="section-heading">
              Validation
              <span className="text-xs text-muted" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                ({errors.length} errors · {warnings.length} warnings · {infos.length} info)
              </span>
            </div>
            <WarningList title="Errors"   variant="danger" items={errors}   />
            <WarningList title="Warnings" variant="warn"   items={warnings} />
            <WarningList title="Info"     variant="info"   items={infos}    />
          </section>
        )}

        {/* ── Body preview (plain <pre>, per Q11 decision) ───────────────── */}
        <section className="import-preview-section">
          <div className="flex-between">
            <div className="section-heading" style={{ marginBottom: 0 }}>
              Body Preview
              <span className="text-xs text-muted" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                ({preview.normalizedBody.length.toLocaleString()} chars, normalized)
              </span>
            </div>
            <button
              className="btn btn-ghost text-xs"
              onClick={handleCopyBody}
              aria-label="Copy normalized body"
              style={{ minHeight: 28, padding: '4px 10px' }}
            >
              {bodyCopied ? '✓ Copied' : 'Copy body'}
            </button>
          </div>
          <pre className="import-preview-body">
            {preview.normalizedBody || '(empty body)'}
          </pre>
        </section>

        {/* ── Hash + frontmatter (collapsed by default) ──────────────────── */}
        {preview.hadFrontmatter && (
          <section className="import-preview-section">
            <details>
              <summary className="text-xs text-muted" style={{ cursor: 'pointer', listStyle: 'none' }}>
                ▶ Frontmatter ({preview.frontmatter?.source_kind ?? 'unknown source_kind'})
              </summary>
              <pre className="import-preview-body" style={{ marginTop: 8, maxHeight: 200 }}>
                {formatFrontmatter(preview)}
              </pre>
            </details>
          </section>
        )}

        {/* ── Action row ─────────────────────────────────────────────────── */}
        <footer className="import-preview-modal-footer">
          {hasErrors && (
            <div className="notice danger text-xs" style={{ width: '100%', marginBottom: 10 }}>
              Hard errors are present — Import as authoritative is disabled. You can still save the file
              as a Raw Note to preserve the body verbatim while the issue is investigated.
            </div>
          )}
          {structuredImportDeferredReason && !hasErrors && (
            // v0.11.0 Checkpoint D: structured commit is deferred. Surface
            // the explanation prominently so the user understands why the
            // primary Import button is disabled even when validation passed.
            <div
              className="notice info text-xs"
              style={{ width: '100%', marginBottom: 10 }}
              role="status"
            >
              {structuredImportDeferredReason}
            </div>
          )}
          <div className="flex gap-8" style={{ width: '100%', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            {canImportAsRaw && (
              <button
                className={`btn ${
                  // When structured Import is deferred, Raw Notes IS the
                  // primary affordance — promote it visually.
                  (preview.defaultOutcome === 'import_as_raw' && !canCommit) || structuredImportDeferredReason
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
                onClick={onImportAsRaw}
              >
                Import as Raw Notes
              </button>
            )}
            {canCommit && (
              // Render the structured Import button even when deferred,
              // so the affordance is visible — but disable it.
              <button
                className="btn btn-primary"
                onClick={structuredImportDeferredReason ? undefined : handleImportClick}
                disabled={Boolean(structuredImportDeferredReason)}
                title={structuredImportDeferredReason ?? undefined}
                aria-label={
                  structuredImportDeferredReason
                    ? 'Structured Import (deferred to Checkpoint E)'
                    : importConfirming
                    ? 'Confirm import'
                    : 'Import'
                }
              >
                {structuredImportDeferredReason
                  ? 'Import (deferred)'
                  : importConfirming
                  ? '⚠ Confirm Import'
                  : hasWarnings
                  ? 'Import anyway'
                  : 'Import'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TargetSummary({ preview }: { preview: ImportPreview }) {
  const t = preview.targetSummary;
  const fm = preview.frontmatter;
  // Build a small structured list of facts about where the import
  // would land. If frontmatter is absent we still show what we know.
  const rows: Array<[string, string]> = [];
  rows.push(['Source kind', t.sourceKind ?? fm?.source_kind ?? '(unknown)']);
  rows.push(['Description', t.description]);
  if (t.projectName || t.projectId) {
    rows.push([
      'Project',
      `${t.projectName ?? ''}${t.projectName && t.projectId ? ' · ' : ''}${t.projectId ?? ''}`,
    ]);
  }
  if (t.roundNumber !== undefined || t.roundId) {
    rows.push([
      'Round',
      `${t.roundNumber !== undefined ? `#${t.roundNumber}` : ''}${t.roundNumber !== undefined && t.roundId ? ' · ' : ''}${t.roundId ?? ''}`,
    ]);
  }
  if (t.modelId) rows.push(['Model', t.modelId]);

  return (
    <div className="import-preview-target">
      {rows.map(([label, value]) => (
        <div key={label} className="import-preview-target-row">
          <div className="import-preview-target-label">{label}</div>
          <div className="import-preview-target-value">{value || '—'}</div>
        </div>
      ))}
    </div>
  );
}

function WarningList({
  title,
  variant,
  items,
}: {
  title: string;
  variant: 'danger' | 'warn' | 'info';
  items: ImportValidationWarning[];
}) {
  if (items.length === 0) return null;
  const noticeClass =
    variant === 'danger' ? 'notice danger' : variant === 'info' ? 'notice info' : 'notice';
  return (
    <div className={`${noticeClass} import-preview-warning-group`}>
      <div className="text-xs" style={{ fontWeight: 600, marginBottom: 6 }}>
        {title} ({items.length})
      </div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {items.map((w, i) => (
          <li key={`${w.code}-${i}`} className="text-xs" style={{ marginBottom: 4 }}>
            <code style={{ marginRight: 6 }}>{w.code}</code>
            {w.message}
            {w.path && (
              <span className="text-muted" style={{ marginLeft: 6 }}>
                (at <code>{w.path}</code>)
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function groupWarnings(ws: ImportValidationWarning[]) {
  const errors: ImportValidationWarning[] = [];
  const warnings: ImportValidationWarning[] = [];
  const info: ImportValidationWarning[] = [];
  for (const w of ws) {
    if (w.severity === 'error') errors.push(w);
    else if (w.severity === 'warning') warnings.push(w);
    else info.push(w);
  }
  return { errors, warnings, info };
}

/**
 * Render the frontmatter as YAML-ish text for the collapsed details
 * pane. We don't re-emit valid YAML here — this is a human-readable
 * dump only. The single-source-of-truth YAML serializer lives in
 * utils/markdownArtifact.ts and is the only path that should produce
 * round-trippable frontmatter.
 */
function formatFrontmatter(preview: ImportPreview): string {
  const fm = preview.frontmatter ?? {};
  const lines: string[] = [];
  const order: (keyof typeof fm)[] = [
    'artifact_type',
    'source_kind',
    'schema_version',
    'app_version',
    'artifact_id',
    'exported_at',
    'project_id',
    'project_name',
    'round_id',
    'round_number',
    'model_id',
    'canonical_state_hash',
    'prompt_hash',
    'content_hash',
    'part',
    'generated_by',
  ];
  for (const k of order) {
    const v = (fm as Record<string, unknown>)[k as string];
    if (v === undefined) continue;
    lines.push(`${String(k)}: ${formatValue(v)}`);
  }
  if (preview.recomputedContentHash) {
    lines.push('');
    lines.push(`# recomputed_content_hash: ${preview.recomputedContentHash}`);
  }
  return lines.join('\n');
}

function formatValue(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
