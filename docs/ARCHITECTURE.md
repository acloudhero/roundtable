# Architecture

RoundTable — Phase 6 (folder layout unchanged from Phase 2)

## Overview

RoundTable is a local-first browser app. There is no backend. All state lives in localStorage via a storage adapter.

## Folder Structure

```
src/
  components/   — UI panels, one per screen tab
  config/       — Model profiles, prompt templates, compatibility notes, export config
  data/         — Demo data and initial app state
  storage/      — StorageAdapter interface and localStorage implementation
  types/        — TypeScript interfaces (AppState, Project, Round, ModelProfile, etc.)
  utils/        — Pure utility functions (prompt generation, mediator packet, export, clipboard)
  styles/       — app.css (single stylesheet)
```

## Data Flow

1. App.tsx loads state from `localStorageAdapter.load()` on mount.
2. If no stored state, `INITIAL_APP_STATE` from `data/initialAppState.ts` is used.
3. Any panel that needs to update state calls `onUpdate(partial: Partial<AppState>)`.
4. App.tsx merges the partial update and saves via `localStorageAdapter.save()`.
5. All panels receive the full state as props.

## Key Design Decisions

- **Single AppState object**: Simplifies JSON export/import. The entire app can be serialized and restored from one object.
- **Storage adapter interface**: `src/storage/storageAdapter.ts` defines the interface. `localStorageAdapter` implements it. Swap for IndexedDB later without changing UI code.
- **Config-driven model behavior**: Model roles, prompt notes, and compatibility notes live in `src/config/`. No model-specific logic is scattered in components.
- **Context Sandwich prompt generation**: All prompt generation is centralized in `src/utils/promptGeneration.ts`.
- **Round immutability**: Rounds have a `locked` field. Once a decision is recorded, the round is locked. Locked rounds are read-only by default.
- **Glass box UI**: Generated prompts, responses, and mediator packets are always visible in the UI. Nothing important is hidden behind automation.

## Dependencies

- Vite + React + TypeScript
- Plain CSS (no CSS framework)
- No backend, no auth, no API keys
- No routing library (simple tab state in App.tsx)
