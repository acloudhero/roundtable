// src/storage/localStorageAdapter.ts
// Purpose: localStorage implementation of StorageAdapter + recovery utilities
// Phase 5: added loadRaw(), loadWithRecovery() for malformed-data detection
// v0.11.0: storage-pressure reporting on save + structured failure on
//          QuotaExceededError. The adapter never silently fails — every
//          write reports its outcome so the UI can surface agency
//          (download, prune, retry) instead of crashing.
//
// Owned by: this file
// Used by: App.tsx
//
// To replace localStorage with IndexedDB:
//   Create indexedDbAdapter.ts implementing StorageAdapter, swap in App.tsx.
//   This file stays unchanged.

import { AppState } from '../types/appState';
import { StorageAdapter } from './storageAdapter';
import { STORAGE_KEY } from '../config/exportFormats';
import { reportStoragePressure, StoragePressureReport } from '../utils/storagePressure';

export interface StorageLoadResult {
  state: AppState | null;
  rawValue: string | null;
  error: string | null;
  wasCorrupted: boolean;
}

/** v0.11.0: structured result for save attempts. The save method still
 *  exists with its original void signature for backward compatibility
 *  with App.tsx's effect; saveWithReport returns the same data plus a
 *  pressure report and a structured failure code on quota errors. */
export interface StorageSaveResult {
  /** True if localStorage.setItem succeeded. */
  ok: boolean;
  /** Reason for failure, when ok is false. Currently only 'quota_exceeded'
   *  and 'unknown'. */
  error?: 'quota_exceeded' | 'unknown';
  /** Pressure report computed against the state we attempted to save. */
  pressure: StoragePressureReport;
  /** The serialized JSON we attempted to write. Useful for offering the
   *  user a download of the current state if storage is full. */
  serializedJson?: string;
}

export const localStorageAdapter: StorageAdapter & {
  loadRaw: () => string | null;
  loadWithRecovery: () => StorageLoadResult;
  preserveCorrupted: (raw: string) => void;
  saveWithReport: (state: AppState) => StorageSaveResult;
} = {
  load(): AppState | null {
    const result = this.loadWithRecovery();
    return result.state;
  },

  loadRaw(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },

  loadWithRecovery(): StorageLoadResult {
    let rawValue: string | null = null;
    try {
      rawValue = localStorage.getItem(STORAGE_KEY);
      if (!rawValue) {
        return { state: null, rawValue: null, error: null, wasCorrupted: false };
      }
      const parsed = JSON.parse(rawValue) as AppState;
      // Basic sanity check
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.projects)) {
        return {
          state: null,
          rawValue,
          error: 'Stored data failed sanity check (missing projects array).',
          wasCorrupted: true,
        };
      }
      return { state: parsed, rawValue, error: null, wasCorrupted: false };
    } catch (err) {
      return {
        state: null,
        rawValue,
        error: `Failed to parse stored data: ${(err as Error).message}`,
        wasCorrupted: true,
      };
    }
  },

  // Preserve the raw corrupted string under a separate key so the user can download it
  preserveCorrupted(raw: string): void {
    try {
      const key = `${STORAGE_KEY}.corrupted.${Date.now()}`;
      localStorage.setItem(key, raw);
    } catch { /* storage full — can't preserve */ }
  },

  save(state: AppState): void {
    // Backward-compatible void save. Internally calls saveWithReport so
    // the pressure report still runs and console-logs at warn/hard
    // levels.
    this.saveWithReport(state);
  },

  /**
   * v0.11.0: Save with a structured result and pressure report.
   *
   * Behavior:
   *   - Always attempts the setItem call. We never silently drop a save.
   *   - On QuotaExceededError (or DOMException 22), returns ok=false with
   *     error='quota_exceeded' so the UI can offer download/prune.
   *   - On other errors, returns ok=false with error='unknown' and logs.
   *   - The pressure report is always populated (independent of ok).
   */
  saveWithReport(state: AppState): StorageSaveResult {
    const pressure = reportStoragePressure(state);
    if (pressure.level === 'warn') {
      console.warn('[RoundTable] storage pressure WARN:', pressure.message);
    } else if (pressure.level === 'hard') {
      console.warn('[RoundTable] storage pressure HARD:', pressure.message);
    }

    let serializedJson: string;
    try {
      serializedJson = JSON.stringify(state);
    } catch (err) {
      console.error('[RoundTable] Failed to serialize state for save:', err);
      return { ok: false, error: 'unknown', pressure };
    }

    try {
      localStorage.setItem(STORAGE_KEY, serializedJson);
      return { ok: true, pressure, serializedJson };
    } catch (err) {
      const e = err as DOMException;
      const isQuota =
        e?.name === 'QuotaExceededError' ||
        e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        (typeof DOMException !== 'undefined' && e instanceof DOMException && e.code === 22);
      console.error('[RoundTable] Failed to save state to localStorage:', err);
      return {
        ok: false,
        error: isQuota ? 'quota_exceeded' : 'unknown',
        pressure,
        serializedJson,
      };
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('[RoundTable] Failed to clear localStorage:', err);
    }
  },
};
