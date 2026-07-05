// src/data/demoProject.ts
// Purpose: Demo project for Phase 3 scaffold
// Safe edits: update demo content freely

import { Project } from '../types/project';

export const DEMO_PROJECT: Project = {
  id: 'proj_demo_001',
  name: 'RoundTable',
  description: 'A local-first browser application that coordinates multiple consumer AI models in a structured roundtable workflow. The user manually copies prompts to each model and pastes responses back into the app.',
  currentPhase: 'Phase 3 — Core Round Workflow',
  canonicalState: `## Canonical Project State

**Stack:** Vite + React + TypeScript + plain CSS + localStorage

**What exists (Phase 3):**
- Complete round workflow: create → generate prompts → copy → paste responses → mediator → decision → lock
- Rich GeneratedPrompt[] and ModelResponse[] with copiedAt/pastedAt chain-of-custody timestamps
- Round progress tracking (workflow status, copy/response counts)
- Explicit canonical state update field — never auto-applied
- Locked round protection (read-only after decision)
- Config-driven model profiles, prompt templates, compatibility notes
- Storage adapter (localStorage, IndexedDB upgrade path)
- Context Sandwich prompt generation (centralized in promptGeneration.ts)
- Mediator packet generation (centralized in mediatorPacket.ts)
- Pure round state utilities (roundUtils.ts)
- JSON and Markdown export

**What does not exist yet (Phase 4+):**
- Structured mediator response parsing
- Decision log filtering by phase
- Advanced export formats
- Multi-project management UI

**Constraints:**
- No backend, no API calls, no browser automation, no scraping
- Manual copy/paste only
- localStorage only (IndexedDB upgrade path planned)

**Open Questions:**
- Should Decision Log support filtering by phase in Phase 4?
- Should locked rounds have an explicit unlock action with warning?`,
  createdAt: '2026-05-08T10:00:00Z',
  updatedAt: '2026-05-08T11:00:00Z',
};
