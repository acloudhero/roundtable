// src/utils/dateTime.ts
// Purpose: Date/time formatting utilities
// Owned by: this file
// Used by: markdownExport, components displaying timestamps

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDisplay(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

export function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString();
  } catch {
    return isoString;
  }
}
