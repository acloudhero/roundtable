// src/components/Dashboard.tsx
// Purpose: Project overview, workflow progress, contextual next-step guidance
// Phase 8: workflow-chip status, progress bars, empty states, mobile layout

import { AppState } from '../types/appState';
import { getRoundProgress, getLatestRound } from '../utils/roundUtils';

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  not_started:         { label: 'Not Started',      cls: 'active' },
  prompted:            { label: 'Prompts Ready',     cls: 'prompted' },
  collecting_responses:{ label: 'Collecting',        cls: 'collecting' },
  ready_for_mediator:  { label: 'Ready to Mediate', cls: 'collecting' },
  mediator_response_saved:{ label: 'Synthesis Ready',cls: 'synthesizing' },
  decision_recorded:   { label: 'Decision Recorded', cls: 'decided' },
  locked:              { label: 'Locked',            cls: 'locked' },
};

interface Props {
  state: AppState;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ state, onNavigate }: Props) {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const allRounds  = state.rounds.filter((r) => r.projectId === project?.id);
  const decisions  = state.decisions.filter((d) => d.projectId === project?.id);
  const latestRound = getLatestRound(state);
  const progress   = latestRound ? getRoundProgress(latestRound) : null;
  const chip       = progress ? (STATUS_CHIP[progress.workflowStatus] ?? STATUS_CHIP.not_started) : null;

  if (!project) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h1 className="panel-title">Dashboard</h1>
          <p className="panel-desc">Local-first workflow cockpit for coordinating AI models</p>
        </div>
        <div className="empty-state" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div className="empty-state-icon">🔁</div>
          <div className="empty-state-title">Ready to start?</div>
          <div className="empty-state-desc">
            RoundTable is a local-first manual copy/paste workflow cockpit.
            No API keys. No automation. You copy prompts to each model and paste responses back.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, width: '100%' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              GETTING STARTED
            </div>
            {[
              ['📂 Import Backup', 'Restore a previous JSON export', 'export'],
              ['📋 Manage Projects', 'Create, switch, or import projects', 'projects'],
              ['📋 Set Up Project', 'Define your project and canonical state', 'project-state'],
              ['🤖 Configure Models', 'Activate and review model profiles', 'model-roster'],
              ['🔄 Start a Round', 'Generate prompts for your models', 'round-builder'],
            ].map(([icon, label, tab]) => (
              <button key={tab as string}
                className="btn btn-secondary"
                onClick={() => onNavigate(tab as string)}
                style={{ width: '100%', justifyContent: 'flex-start', gap: 10, textAlign: 'left' }}>
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="panel-title">Dashboard</h1>
        <p className="panel-desc">{project.currentPhase}</p>
      </div>

      {/* Stats row */}
      <div className="stats-row mb-16">
        {[
          { label: 'Rounds',    value: allRounds.length,    sub: `${allRounds.filter(r=>r.locked).length} locked` },
          { label: 'Decisions', value: decisions.length,    sub: 'recorded' },
          { label: 'Models',    value: state.modelProfiles.filter(m=>m.active).length, sub: 'active' },
          { label: 'Schema',    value: state.schemaVersion, sub: 'version', mono: true },
        ].map(({ label, value, sub, mono }) => (
          <div className="stat-card" key={label}>
            <span className="stat-label">{label}</span>
            <span className="stat-value" style={mono ? { fontSize: 15, paddingTop: 8 } : undefined}>{value}</span>
            <span className="stat-sub">{sub}</span>
          </div>
        ))}
      </div>

      {/* Current round card */}
      {latestRound && progress && (
        <div className="card mb-16">
          <div className="card-header">
            <span className="card-title">Round {latestRound.roundNumber}</span>
            <span className={`workflow-chip ${chip!.cls}`}>{chip!.label}</span>
          </div>

          {latestRound.userInstruction && (
            <p className="text-sm mb-12" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              "{latestRound.userInstruction.slice(0, 140)}{latestRound.userInstruction.length > 140 ? '…' : ''}"
            </p>
          )}

          {/* Progress bars */}
          <div className="grid-2 mb-12" style={{ gap: 12 }}>
            <ProgressItem label="Prompts Copied"
              value={progress.promptsCopied} total={progress.promptsTotal} />
            <ProgressItem label="Responses"
              value={progress.responsesCollected} total={progress.responsesTotal} />
          </div>

          {/* Status dots */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            <StatusDot label="Mediator Response" on={progress.hasMediatorResponse} />
            <StatusDot label="Synthesis" on={progress.hasMediatorSynthesis} />
            <StatusDot label="Decision" on={progress.hasDecision} />
            <StatusDot label="Locked" on={progress.isLocked} danger />
          </div>

          {/* Next-step cue */}
          {!progress.isLocked && (
            <NextStepCue progress={progress} onNavigate={onNavigate} />
          )}
        </div>
      )}

      {!latestRound && (
        <div className="empty-state mb-16">
          <div className="empty-state-icon">🔄</div>
          <div className="empty-state-title">No rounds yet</div>
          <div className="empty-state-desc">Open Round Builder to start your first round.</div>
          <button className="btn btn-primary" onClick={() => onNavigate('round-builder')}>
            Open Round Builder →
          </button>
        </div>
      )}

      {/* Workflow guide */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Workflow</span>
          <span className="card-meta text-xs">Manual copy/paste — no API</span>
        </div>
        <div className="workflow-steps">
          {[
            { step: '1', label: 'Round Builder',   desc: 'Set instruction, select models, generate prompts', tab: 'round-builder' },
            { step: '2', label: 'Copy Prompts',    desc: 'Copy each prompt manually to its model',            tab: 'round-builder' },
            { step: '3', label: 'Responses',       desc: 'Paste each model\'s response back',                 tab: 'responses' },
            { step: '4', label: 'Mediator',        desc: 'Generate packet, copy to GPT-5.5, paste response',  tab: 'mediator' },
            { step: '5', label: 'Decision Log',    desc: 'Record decision, apply canonical update, lock round',tab: 'decisions' },
            { step: '6', label: 'Project State',   desc: 'Review canonical state for next round',             tab: 'project-state' },
            { step: '7', label: 'Export / Import', desc: 'Back up JSON; export Markdown for review',          tab: 'export' },
            { step: '8', label: 'Projects',        desc: 'Create, switch, duplicate, archive projects',    tab: 'projects' },
          ].map(({ step, label, desc, tab }) => (
            <div className="workflow-step" key={step}>
              <span className="workflow-step-num">{step}</span>
              <div className="workflow-step-text">
                <strong>
                  <button onClick={() => onNavigate(tab)}
                    style={{ background:'none', border:'none', color:'var(--amber)', cursor:'pointer',
                             fontFamily:'var(--font-mono)', fontSize:13, fontWeight:600, padding:0 }}>
                    {label} →
                  </button>
                </strong>
                <span>{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProgressItem({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const done = total > 0 && value === total;
  return (
    <div>
      <div className="flex-between mb-4">
        <span className="text-xs text-muted">{label}</span>
        <span className={`text-xs ${done ? 'text-green' : 'text-amber'}`}>{value}/{total}</span>
      </div>
      <div className="progress-bar-wrap">
        <div className={`progress-bar-fill ${done ? 'complete' : 'partial'}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusDot({ label, on, danger = false }: { label: string; on: boolean; danger?: boolean }) {
  const color = on ? (danger ? 'var(--red)' : 'var(--green)') : 'var(--border-accent)';
  return (
    <div className="flex-center gap-8">
      <span style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
      <span className="text-xs" style={{ color: on ? (danger ? 'var(--red)' : 'var(--green)') : 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

import { RoundProgress } from '../types/round';

function NextStepCue({ progress, onNavigate }: { progress: RoundProgress; onNavigate: (t:string)=>void }) {
  let label = '';
  let tab   = '';
  if (progress.promptsTotal === 0) { label = 'Build Prompts'; tab = 'round-builder'; }
  else if (progress.responsesCollected === 0) { label = 'Paste Responses'; tab = 'responses'; }
  else if (!progress.hasMediatorResponse) { label = 'Generate Mediator Packet'; tab = 'mediator'; }
  else if (!progress.hasMediatorSynthesis) { label = 'Extract Synthesis'; tab = 'mediator'; }
  else if (!progress.hasDecision) { label = 'Record Decision'; tab = 'decisions'; }
  if (!label) return null;
  return (
    <div className="next-step-cue" onClick={() => onNavigate(tab)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate(tab)}>
      <span className="text-xs text-mono">Next step</span>
      <strong style={{ fontSize:13 }}>{label}</strong>
      <span className="next-step-cue-arrow">→</span>
    </div>
  );
}
