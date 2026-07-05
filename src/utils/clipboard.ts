// src/utils/clipboard.ts
// Purpose: Clipboard utility — wraps navigator.clipboard with fallback
// Owned by: this file
// Used by: any component with a "Copy" button
// Safe edits: improve error handling or add toast notification hooks
// Note: Clipboard API requires HTTPS or localhost. On plain file:// it may fail.

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for non-secure contexts
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('[RoundTable] Clipboard copy failed:', err);
    return false;
  }
}
