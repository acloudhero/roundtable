// src/components/PromptLibraryPanel.tsx
// Purpose: Displays prompt templates, prompt wrappers (Phase 7B), and the
//          compatibility test prompt library (Phase 7B).
// Owned by: this file
// Used by: App.tsx
//
// Safe edits:
//   - Display tweaks, filtering, ordering.
//   - Adding new sections that draw from AppState arrays.
// Unsafe edits:
//   - To add a template/wrapper/test, edit the relevant config file
//     (src/config/promptTemplates.ts, src/config/promptWrappers.ts,
//     src/config/compatibilityTests.ts) — this panel is a *display*
//     surface only, not an editor (full editing UI deferred to Phase 8).

import { useState } from 'react';
import { AppState } from '../types/appState';
import { PromptTemplate } from '../types/promptTemplate';
import { PromptWrapper } from '../types/promptWrapper';
import { CompatibilityTest } from '../types/compatibilityTest';
import { DEFAULT_COMPATIBILITY_TESTS } from '../config/compatibilityTests';
import { copyToClipboard } from '../utils/clipboard';

interface Props {
  state: AppState;
}

export default function PromptLibraryPanel({ state }: Props) {
  // Compatibility tests live in static config (not AppState) so the user
  // can't accidentally delete them by clearing local data. They are
  // manually-pastable prompts; RoundTable does not run them.
  const tests: CompatibilityTest[] = DEFAULT_COMPATIBILITY_TESTS;

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="panel-title">Prompt Library</h1>
        <p className="panel-desc">
          Prompt templates, vendor-specific wrappers (Phase 7B), and manual
          compatibility test prompts. Templates and wrappers live in{' '}
          <code>src/config/promptTemplates.ts</code>,{' '}
          <code>src/config/promptWrappers.ts</code>, and{' '}
          <code>src/config/compatibilityTests.ts</code>.
        </p>
      </div>

      <div className="notice mb-24 info">
        <strong>Context Sandwich Pattern:</strong> Project Context → Current Phase → User Instruction → Model Role → Compatibility Notes → Required Output Format.
        Phase 7B adds a vendor-specific <em>wrapper</em> as outer "bread" around the Sandwich without changing the Sandwich itself.
      </div>

      {/* ── Prompt Templates ────────────────────────────────────────────── */}
      <div className="section-heading mb-12">Prompt Templates ({state.promptTemplates.length})</div>
      {state.promptTemplates.length === 0 && (
        <div className="empty-state mb-16">
          <div className="empty-state-icon">📄</div>
          <div className="empty-state-title">No prompt templates</div>
          <div className="empty-state-desc">Add templates in <code>src/config/promptTemplates.ts</code>.</div>
        </div>
      )}
      {state.promptTemplates.map((template: PromptTemplate) => (
        <div className="template-card" key={template.id}>
          {/* Header */}
          <div className="template-header">
            <div style={{ flex:1, minWidth:0 }}>
              <span className="card-title">{template.name}</span>
              {template.purpose && (
                <div className="text-xs text-muted mt-4 truncate">{template.purpose}</div>
              )}
            </div>
            <div className="flex gap-6" style={{ flexShrink:0 }}>
              {template.active === false && <span className="badge badge-red">inactive</span>}
              {template.version && <span className="badge badge-muted">v{template.version}</span>}
            </div>
          </div>

          {/* Version metadata row */}
          {(template.createdAt || template.updatedAt || template.supersedesTemplateId || template.changelog) && (
            <div className="template-meta">
              {template.createdAt && (
                <div className="template-meta-item">
                  <span className="template-meta-label">Created</span>
                  <span className="template-meta-value">{template.createdAt}</span>
                </div>
              )}
              {template.updatedAt && (
                <div className="template-meta-item">
                  <span className="template-meta-label">Updated</span>
                  <span className="template-meta-value">{template.updatedAt}</span>
                </div>
              )}
              {template.supersedesTemplateId && (
                <div className="template-meta-item">
                  <span className="template-meta-label">Supersedes</span>
                  <code className="template-meta-value">{template.supersedesTemplateId}</code>
                </div>
              )}
              {template.changelog && (
                <div className="template-meta-item" style={{ flex:'1 1 100%' }}>
                  <span className="template-meta-label">Changelog</span>
                  <div className="template-changelog">{template.changelog}</div>
                </div>
              )}
            </div>
          )}

          {/* Body */}
          <div className="template-body">
            <div className="section-heading">Variables</div>
            <div className="tag-list mb-12">
              {template.variables.map((v) => (
                <span key={v} className="tag text-mono text-xs">{`{{${v}}}`}</span>
              ))}
            </div>

            {template.notes && (
              <div className="mb-12">
                <div className="section-heading">Notes</div>
                <p className="text-xs" style={{ color:'var(--text-secondary)' }}>{template.notes}</p>
              </div>
            )}

            <details>
              <summary className="text-xs text-muted" style={{ listStyle:'none', cursor:'pointer' }}>
                ▶ View template text
              </summary>
              <div className="prompt-box mt-8">{template.templateText}</div>
            </details>
          </div>
        </div>
      ))}

      {/* ── Prompt Wrappers (Phase 7B) ──────────────────────────────────── */}
      {state.promptWrappers && state.promptWrappers.length > 0 && (
        <>
          <div className="section-heading mt-24 mb-12">Prompt Wrappers (Phase 7B) ({state.promptWrappers.length})</div>
          {state.promptWrappers.map((wrapper: PromptWrapper) => (
            <WrapperCard key={wrapper.id} wrapper={wrapper} />
          ))}
        </>
      )}

      {/* ── Compatibility Test Prompts (Phase 7B) ───────────────────────── */}
      <div className="section-heading mt-24 mb-12">Compatibility Test Prompts (Phase 7B) ({tests.length})</div>
      <div className="notice info mb-12 text-xs">
        <strong>Manual paste-only:</strong> RoundTable does not run these. Copy a test, paste it into the target model, read the response, and decide whether the model still behaves as expected.
      </div>
      {tests.map((test) => (
        <CompatibilityTestCard key={test.id} test={test} />
      ))}
    </div>
  );
}

function WrapperCard({ wrapper }: { wrapper: PromptWrapper }) {
  return (
    <div className="card" key={wrapper.id}>
      <div className="card-header">
        <span className="card-title">{wrapper.name}</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {wrapper.active === false && <span className="badge badge-muted">inactive</span>}
          {wrapper.version && <span className="badge badge-muted">v{wrapper.version}</span>}
        </span>
      </div>
      <p className="text-sm mb-12" style={{ color: 'var(--text-secondary)' }}>{wrapper.purpose}</p>

      <div className="text-xs text-muted mb-12" style={{ fontFamily: 'var(--font-mono)' }}>
        id: <code>{wrapper.id}</code>
        {wrapper.targetVendor && <> · vendor: {wrapper.targetVendor}</>}
        {wrapper.targetRole && <> · role: {wrapper.targetRole}</>}
      </div>

      <details style={{ marginTop: 8 }}>
        <summary className="text-xs text-muted" style={{ listStyle: 'none', cursor: 'pointer' }}>
          ▶ View wrapper text and output instructions
        </summary>
        <div className="mt-8">
          <div className="section-heading">Wrapper Text (header above Sandwich)</div>
          <div className="prompt-box">{wrapper.wrapperText}</div>
        </div>
        <div className="mt-8">
          <div className="section-heading">Output Instructions (footer below Sandwich)</div>
          <div className="prompt-box">{wrapper.outputInstructions}</div>
        </div>
        {wrapper.compatibilityNotes && (
          <div className="mt-8">
            <div className="section-heading">Wrapper Compatibility Notes</div>
            <div className="model-notes">{wrapper.compatibilityNotes}</div>
          </div>
        )}
      </details>
    </div>
  );
}

function CompatibilityTestCard({ test }: { test: CompatibilityTest }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(test.promptText);
    if (ok) { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="compat-test-item">
      <div className="compat-test-header">
        <div style={{ flex: 1 }}>
          <div className="card-title">{test.name}</div>
          {test.purpose && <div className="text-xs text-muted mt-4">{test.purpose}</div>}
        </div>
        <div className="flex gap-6 flex-center" style={{ flexShrink: 0 }}>
          {test.targetVendor && <span className="badge badge-muted">{test.targetVendor}</span>}
          {test.targetRole && <span className="badge badge-muted">{test.targetRole}</span>}
          {/* Copy-confirm badge — no layout shift on button */}
          {copied && <span className="copy-confirm">✓ Copied</span>}
        </div>
      </div>

      {test.expectedShape && (
        <div className="text-xs text-muted mb-8">
          <strong>Expected:</strong> {test.expectedShape}
        </div>
      )}

      <details>
        <summary className="text-xs text-muted" style={{ listStyle:'none', cursor:'pointer', marginBottom: 8 }}>
          ▶ View test prompt
        </summary>
        <div className="prompt-box mt-8 mb-10">{test.promptText}</div>
      </details>

      {test.notes && (
        <div className="text-xs text-muted mb-10"><strong>Notes:</strong> {test.notes}</div>
      )}

      <button className="btn btn-secondary btn-sm" onClick={handleCopy} aria-label={`Copy test: ${test.name}`}>
        Copy Test Prompt → paste into target model manually
      </button>
    </div>
  );
}
