// src/components/ModelRosterPanel.tsx
// Purpose: Displays model profiles with expanded Phase 7B/8 fields
// Phase 8: model-profile-card CSS, wrapper-tag, grouped metadata, mobile layout
// Owned by: this file
// Safe edits: add display fields
// Unsafe edits: to add/edit profiles, update src/config/modelProfiles.ts

import { AppState, AppStateUpdater } from '../types/appState';
import { ModelProfile } from '../types/modelProfile';

interface Props {
  state: AppState;
  onUpdate: (updated: AppStateUpdater) => void;
}

export default function ModelRosterPanel({ state, onUpdate }: Props) {
  const toggleActive = (id: string) => {
    onUpdate({ modelProfiles: state.modelProfiles.map((m) => m.id === id ? { ...m, active: !m.active } : m) });
  };

  if (state.modelProfiles.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header"><h1 className="panel-title">Model Roster</h1></div>
        <div className="empty-state">
          <div className="empty-state-icon">🤖</div>
          <div className="empty-state-title">No model profiles</div>
          <div className="empty-state-desc">Add profiles in <code>src/config/modelProfiles.ts</code>.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="panel-title">Model Roster</h1>
        <p className="panel-desc">
          Active models appear in Round Builder. To add or edit a model, update{' '}
          <code>src/config/modelProfiles.ts</code>.
        </p>
      </div>

      <div className="notice mb-16 info text-xs">
        Model behavior is configuration-driven. Do not hardcode model-specific logic in UI components.
      </div>

      {state.modelProfiles.map((model: ModelProfile) => (
        <div className={`model-profile-card ${model.active ? '' : 'inactive'}`} key={model.id}>
          {/* Header */}
          <div className="model-profile-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="model-name">{model.displayName}</div>
              <div className="model-vendor text-xs text-muted">{model.vendor} · {model.modelName}</div>
              <div className="model-role text-xs mt-4">{model.roleName}</div>
            </div>
            <div className="flex gap-8 flex-center" style={{ flexShrink: 0 }}>
              <span className={`workflow-chip ${model.active ? 'active' : 'locked'}`} style={{ fontSize: 9 }}>
                {model.active ? 'Active' : 'Inactive'}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => toggleActive(model.id)}
                aria-label={`${model.active ? 'Deactivate' : 'Activate'} ${model.displayName}`}
              >
                {model.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>

          {/* Metadata grid */}
          <div className="model-profile-meta">
            {model.defaultPromptWrapperId && (
              <div className="model-profile-meta-item">
                <span className="model-profile-meta-label">Prompt Wrapper</span>
                <span className="wrapper-tag">{model.defaultPromptWrapperId}</span>
              </div>
            )}
            {model.profileVersion && (
              <div className="model-profile-meta-item">
                <span className="model-profile-meta-label">Profile Version</span>
                <span className="model-profile-meta-value">{model.profileVersion}</span>
              </div>
            )}
            {model.vendorUrl && (
              <div className="model-profile-meta-item">
                <span className="model-profile-meta-label">Vendor URL</span>
                <a href={model.vendorUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-amber" style={{ wordBreak: 'break-all' }}>
                  {model.vendorUrl}
                </a>
              </div>
            )}
            {model.lastUpdated && (
              <div className="model-profile-meta-item">
                <span className="model-profile-meta-label">Last Updated</span>
                <span className="model-profile-meta-value">{model.lastUpdated}</span>
              </div>
            )}
            {model.preferredOutputFormat && (
              <div className="model-profile-meta-item">
                <span className="model-profile-meta-label">Output Format</span>
                <span className="model-profile-meta-value">{model.preferredOutputFormat}</span>
              </div>
            )}
            {model.contextWindowNotes && (
              <div className="model-profile-meta-item" style={{ gridColumn: '1 / -1' }}>
                <span className="model-profile-meta-label">Context Window</span>
                <span className="model-profile-meta-value">{model.contextWindowNotes}</span>
              </div>
            )}
          </div>

          {/* Expandable body */}
          <details>
            <summary className="text-xs text-muted"
              style={{ listStyle:'none', cursor:'pointer', padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
              ▶ Role prompt, notes &amp; compatibility
            </summary>

            <div className="model-profile-body">
              {/* Role prompt */}
              <div className="model-profile-section">
                <div className="section-heading">Role Prompt</div>
                <div className="prompt-box" style={{ maxHeight: 180 }}>{model.rolePrompt}</div>
              </div>

              {/* Two-column notes */}
              <div className="grid-2 mt-12" style={{ gap: '8px 16px' }}>
                {model.promptStyleNotes && (
                  <div className="model-profile-section">
                    <div className="model-profile-meta-label mb-4">Prompt Style</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{model.promptStyleNotes}</div>
                  </div>
                )}
                {model.contextLimitNotes && (
                  <div className="model-profile-section">
                    <div className="model-profile-meta-label mb-4">Context Limits</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{model.contextLimitNotes}</div>
                  </div>
                )}
                {model.formattingNotes && (
                  <div className="model-profile-section">
                    <div className="model-profile-meta-label mb-4">Formatting Notes</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{model.formattingNotes}</div>
                  </div>
                )}
                {model.refusalRiskNotes && (
                  <div className="model-profile-section">
                    <div className="model-profile-meta-label mb-4">Refusal Risk</div>
                    <div className="text-xs" style={{ color: 'var(--red)' }}>{model.refusalRiskNotes}</div>
                  </div>
                )}
              </div>

              {/* Strengths / Weaknesses */}
              {(model.strengths || model.weaknesses) && (
                <div className="grid-2 mt-12" style={{ gap: '8px 16px' }}>
                  {model.strengths && (
                    <div className="model-profile-section">
                      <div className="model-profile-meta-label mb-4">Strengths</div>
                      <div className="text-xs" style={{ color: 'var(--green)', whiteSpace: 'pre-wrap' }}>{model.strengths}</div>
                    </div>
                  )}
                  {model.weaknesses && (
                    <div className="model-profile-section">
                      <div className="model-profile-meta-label mb-4">Weaknesses</div>
                      <div className="text-xs" style={{ color: 'var(--amber)', whiteSpace: 'pre-wrap' }}>{model.weaknesses}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Behavior and compatibility notes */}
              {model.modelBehaviorNotes && (
                <div className="model-profile-section mt-12">
                  <div className="model-profile-meta-label mb-4">Behavior Notes</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{model.modelBehaviorNotes}</div>
                </div>
              )}
              {model.compatibilityNotes && (
                <div className="model-profile-section mt-8">
                  <div className="model-profile-meta-label mb-4">Compatibility Notes</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{model.compatibilityNotes}</div>
                </div>
              )}
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}
