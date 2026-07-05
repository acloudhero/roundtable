// src/storage/storageAdapter.ts
// Purpose: Storage adapter interface — abstracts localStorage so it can be replaced later
// Owned by: this file
// Used by: App.tsx, localStorageAdapter.ts
// Safe edits: add new methods if needed (e.g., loadSection, saveSection)
// Unsafe edits: do not call localStorage directly from UI components — use this interface

import { AppState } from '../types/appState';

export interface StorageAdapter {
  load(): AppState | null;
  save(state: AppState): void;
  clear(): void;
}
