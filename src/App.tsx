// src/App.tsx
// Purpose: Root component — tab routing, state management, storage adapter wiring
// Phase 5: recovery mode detection from malformed localStorage
// Safe edits: add new tabs, update tab labels
// Unsafe edits: do not call localStorage directly — use localStorageAdapter

import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateUpdater } from './types/appState';
import { localStorageAdapter } from './storage/localStorageAdapter';
import { INITIAL_APP_STATE } from './data/initialAppState';
import { nowIso } from './utils/dateTime';

import Dashboard from './components/Dashboard';
import ProjectStatePanel from './components/ProjectStatePanel';
import ModelRosterPanel from './components/ModelRosterPanel';
import PromptLibraryPanel from './components/PromptLibraryPanel';
import RoundBuilderPanel from './components/RoundBuilderPanel';
import ResponsesPanel from './components/ResponsesPanel';
import MediatorPanel from './components/MediatorPanel';
import DecisionLogPanel from './components/DecisionLogPanel';
import ExportImportPanel from './components/ExportImportPanel';
import HelpPanel from './components/HelpPanel';
import RecoveryPanel from './components/RecoveryPanel';
import ProjectManagerPanel from './components/ProjectManagerPanel';
// v0.11.0 Markdown Handoff Mode — new tabs (Checkpoint B: UI shell only).
// These panels read-only-render rawNotes and importHistory plus wire
// rollback. They are NOT yet wired into the per-panel Upload .md flow
// — that arrives in a later checkpoint.
import RawNotesPanel from './components/RawNotesPanel';
import ImportHistoryPanel from './components/ImportHistoryPanel';
// v0.12.0 Checkpoint J — Modal System Replacement.
// useModal replaces window.confirm at the reset-to-demo call site.
import { useModal } from './components/Modal';
// v0.12.0 Checkpoint K — PWA implementation bundle.
// Renders a RoundTable-styled update banner when a new service-worker
// version is waiting. Also handles the first-install "Offline ready"
// one-shot. The component is self-contained — it manages its own
// useRegisterSW hook and dismissal state.
import PwaUpdateBanner from './components/PwaUpdateBanner';

import './styles/app.css';

const TABS = [
  { id: 'dashboard',     label: 'Dashboard' },
  { id: 'project-state', label: 'Project State' },
  { id: 'model-roster',  label: 'Model Roster' },
  { id: 'prompt-lib',    label: 'Prompt Library' },
  { id: 'round-builder', label: 'Round Builder' },
  { id: 'responses',     label: 'Responses' },
  { id: 'mediator',      label: 'Mediator' },
  { id: 'decisions',     label: 'Decision Log' },
  { id: 'projects',      label: 'Projects' },
  { id: 'export',        label: 'Export / Import' },
  // v0.11.0 Markdown Handoff Mode tabs. Read-only fallback substrate
  // and the commit log + rollback surface. Placed after Export/Import
  // so the existing workflow tabs keep their left-to-right ordering.
  { id: 'raw-notes',     label: 'Raw Notes' },
  { id: 'import-history',label: 'Import History' },
  { id: 'help',          label: 'Help / Docs' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function App() {
  // Phase 5: use loadWithRecovery() to detect malformed data vs. clean absence
  const loadResult = localStorageAdapter.loadWithRecovery();

  const [state, setState] = useState<AppState>(
    () => loadResult.state ?? INITIAL_APP_STATE
  );
  const [recoveryMode, setRecoveryMode] = useState(loadResult.wasCorrupted);
  const [recoveryError] = useState(loadResult.error ?? '');
  const [corruptedRaw] = useState(loadResult.rawValue ?? null);

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  // v0.12.0 Checkpoint J — Modal System Replacement. Used by onReset
  // and passed down to RecoveryPanel.
  const modal = useModal();
  // v0.11.0 Checkpoint C.5: storage-pressure surfacing.
  //
  // We switched the save effect from save() to saveWithReport(). The
  // adapter still attempts the write either way (we never silently
  // suppress a save), but the structured result lets us:
  //   - Surface a pressure banner when serialized AppState approaches
  //     the localStorage quota threshold.
  //   - Surface a hard-error banner when a QuotaExceededError actually
  //     fires (the write failed; user needs to act).
  //
  // The pressure level is purely informational at the 'warn' threshold,
  // urgent at 'hard', and a hard error when the adapter reports !ok.
  // Cleanup is the user's choice (Raw Notes panel, Import History panel,
  // or JSON export + reset). We don't build a cleanup manager here.
  const [pressureLevel, setPressureLevel] = useState<'ok' | 'warn' | 'hard'>('ok');
  const [pressureMessage, setPressureMessage] = useState<string>('');
  const [saveError, setSaveError] =
    useState<null | { kind: 'quota_exceeded' | 'unknown'; bytes: number }>(null);

  useEffect(() => {
    if (!recoveryMode) {
      // v0.11.0 Checkpoint C.5: saveWithReport returns the same data
      // localStorageAdapter.save() wrote, plus a pressure report and a
      // structured failure flag on QuotaExceededError. We never silently
      // suppress writes — the adapter always attempts setItem.
      const result = localStorageAdapter.saveWithReport(state);
      setLastSaved(new Date().toLocaleTimeString());
      setPressureLevel(result.pressure.level);
      setPressureMessage(result.pressure.message);
      if (!result.ok) {
        setSaveError({
          kind: result.error ?? 'unknown',
          bytes: result.pressure.bytes,
        });
      } else if (saveError) {
        // A later save succeeded — clear the prior hard-error banner.
        setSaveError(null);
      }
    }
  }, [state, recoveryMode]);

  const onUpdate = useCallback((arg: AppStateUpdater) => {
    setState((prev) => {
      const partial = typeof arg === 'function' ? arg(prev) : arg;
      return { ...prev, ...partial, updatedAt: nowIso() };
    });
  }, []);

  const onReset = useCallback(async () => {
    // v0.12.0 Checkpoint J — Modal System Replacement.
    // Replaces window.confirm('Reset to demo data? This will clear all
    // current state.'). Theme-styled destructive confirm.
    const ok = await modal.confirm({
      title: 'Reset to demo data?',
      message:
        'This will clear all current state and load a fresh copy of ' +
        'the bundled demo project.\n\n' +
        'If you want to keep the current state, export JSON from the ' +
        'Export / Import tab first.',
      confirmLabel: 'Reset to demo',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    localStorageAdapter.clear();
    setState(INITIAL_APP_STATE);
    setActiveTab('dashboard');
  }, [modal]);

  const onNavigate = useCallback((tab: string) => {
    if (TABS.find((t) => t.id === tab)) {
      setActiveTab(tab as TabId);
    }
  }, []);

  // Recovery mode: show recovery panel instead of normal UI
  if (recoveryMode) {
    return (
      <RecoveryPanel
        corruptedRaw={corruptedRaw}
        error={recoveryError}
        onRestore={(restored) => {
          setState(restored);
          setRecoveryMode(false);
        }}
      />
    );
  }

  const project = state.projects.find((p) => p.id === state.activeProjectId);

  const renderPanel = () => {
    switch (activeTab) {
      case 'dashboard':     return <Dashboard state={state} onNavigate={onNavigate} />;
      case 'project-state': return <ProjectStatePanel state={state} onUpdate={onUpdate} />;
      case 'model-roster':  return <ModelRosterPanel state={state} onUpdate={onUpdate} />;
      case 'prompt-lib':    return <PromptLibraryPanel state={state} />;
      case 'round-builder': return <RoundBuilderPanel state={state} onUpdate={onUpdate} onNavigate={onNavigate} />;
      case 'responses':     return <ResponsesPanel state={state} onUpdate={onUpdate} onNavigate={onNavigate} />;
      case 'mediator':      return <MediatorPanel state={state} onUpdate={onUpdate} onNavigate={onNavigate} />;
      case 'decisions':     return <DecisionLogPanel state={state} onUpdate={onUpdate} onNavigate={onNavigate} />;
      case 'projects':      return <ProjectManagerPanel state={state} onUpdate={onUpdate} onNavigate={onNavigate} />;
      case 'export':        return <ExportImportPanel state={state} onUpdate={onUpdate} onReset={onReset} />;
      case 'raw-notes':     return <RawNotesPanel state={state} onUpdate={onUpdate} />;
      case 'import-history':return <ImportHistoryPanel state={state} onUpdate={onUpdate} />;
      case 'help':          return <HelpPanel state={state} />;
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-logo">
          <div className="header-logo-mark">RT</div>
          <div>
            <div className="header-title">RoundTable</div>
            <div className="header-subtitle">Local-first workflow cockpit · No API · No automation</div>
          </div>
        </div>
        {project && <div className="header-phase">{project.currentPhase}</div>}
        {lastSaved && (
          <div className="header-save-btn" style={{ cursor: 'default', opacity: 0.6 }}>
            saved {lastSaved}
          </div>
        )}
      </header>

      <nav className="tab-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* v0.12.0 Checkpoint K — PWA update banner. Self-contained:
          renders nothing when no update is waiting (the common case);
          renders a small banner above StoragePressureBanner when a
          new service-worker version is installed. Also surfaces the
          first-install Offline Ready one-shot. */}
      <PwaUpdateBanner />

      {/* v0.11.0 Checkpoint C.5: storage-pressure banner.
          Renders only when the adapter reports warn/hard, OR when the
          last save attempt failed (e.g. QuotaExceededError). Cleanup
          is the user's choice — point them at Raw Notes / Import
          History / Export-Import. We do not auto-prune. */}
      {(() => {
        // Resolve the banner level once, narrowing pressureLevel away
        // from 'ok' before passing to the typed prop. `saveError` takes
        // precedence — a save failure is more urgent than a pressure
        // threshold; if we have both, we render the failure variant.
        if (saveError) {
          return (
            <StoragePressureBanner
              level="error"
              message={pressureMessage}
              saveError={saveError}
              onNavigate={onNavigate}
            />
          );
        }
        if (pressureLevel === 'warn' || pressureLevel === 'hard') {
          return (
            <StoragePressureBanner
              level={pressureLevel}
              message={pressureMessage}
              saveError={null}
              onNavigate={onNavigate}
            />
          );
        }
        return null;
      })()}

      <main className="main-content">
        {renderPanel()}
      </main>
    </div>
  );
}

// ── v0.11.0 Checkpoint C.5 — StoragePressureBanner ────────────────────────────
//
// Minimal in-app surfacing of `localStorageAdapter.saveWithReport()`'s
// pressure report. Three levels:
//
//   - 'warn'   : serialized AppState is approaching the safe threshold
//                (~3.5 MB). Cosmetic banner; cleanup is recommended but
//                not blocking.
//   - 'hard'   : past the safe threshold (~4.25 MB). New imports that
//                grow state may push past the quota; the user should
//                prune Raw Notes / Import History or export and reset.
//   - 'error'  : the most recent save actually failed
//                (QuotaExceededError or other). The state in memory is
//                ahead of what's persisted — the user MUST act before
//                the next reload, or unsaved changes will be lost.
//
// The banner does NOT auto-prune. It links the user to the panels where
// they have agency (Raw Notes, Import History, Export / Import).
// Anything beyond this — bulk-prune, multi-step cleanup wizard,
// IndexedDB migration — is explicitly out of scope per the C.5 brief.

interface StoragePressureBannerProps {
  level: 'warn' | 'hard' | 'error';
  message: string;
  saveError: null | { kind: 'quota_exceeded' | 'unknown'; bytes: number };
  onNavigate: (tab: string) => void;
}

function StoragePressureBanner({
  level,
  message,
  saveError,
  onNavigate,
}: StoragePressureBannerProps) {
  // Resolve display strings per level. We deliberately do NOT use the
  // existing `notice danger` styles for the warn level — that would
  // over-state a cosmetic threshold. The new `.storage-pressure-banner`
  // classes handle level-specific styling.
  const variant =
    level === 'error' ? 'error' : level === 'hard' ? 'hard' : 'warn';

  const headline =
    variant === 'error'
      ? 'Storage save failed'
      : variant === 'hard'
      ? 'Storage usage past the safe threshold'
      : 'Storage usage approaching the safe threshold';

  const bodyText =
    variant === 'error'
      ? saveError?.kind === 'quota_exceeded'
        ? 'localStorage quota exceeded. Your most recent change is in memory but was not persisted. ' +
          'Export the current state from the Export / Import tab, then prune Raw Notes or Import History to free space, then re-import.'
        : 'The last write to localStorage failed. Export the current state from the Export / Import tab before reloading the page to avoid data loss.'
      : message ||
        'Consider pruning Raw Notes or Import History — both are bounded ring buffers but heavy use can still push localStorage toward its quota.';

  return (
    <div
      className={`storage-pressure-banner storage-pressure-banner-${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="storage-pressure-banner-body">
        <div className="storage-pressure-banner-headline">{headline}</div>
        <div className="storage-pressure-banner-message">{bodyText}</div>
      </div>
      <div className="storage-pressure-banner-actions">
        <button
          className="btn btn-ghost text-xs"
          onClick={() => onNavigate('raw-notes')}
          title="Review and prune fallback raw notes"
          style={{ minHeight: 28, padding: '4px 10px' }}
        >
          Raw Notes
        </button>
        <button
          className="btn btn-ghost text-xs"
          onClick={() => onNavigate('import-history')}
          title="Review import commit history"
          style={{ minHeight: 28, padding: '4px 10px' }}
        >
          Import History
        </button>
        <button
          className="btn btn-ghost text-xs"
          onClick={() => onNavigate('export')}
          title="Export current state as JSON before pruning"
          style={{ minHeight: 28, padding: '4px 10px' }}
        >
          Export / Import
        </button>
      </div>
    </div>
  );
}
