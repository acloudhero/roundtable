// src/types/modal.ts
// Purpose: v0.12.0 Checkpoint J — Modal System Replacement.
//          Type-only surface for the in-app modal API that replaces
//          window.confirm / window.alert / window.prompt.
//
// Owned by:  this file
// Used by:   src/components/Modal.tsx (the implementation),
//            and every panel/hook that requests confirmation, alert,
//            or prompt input (App.tsx, RecoveryPanel, ImportHistoryPanel,
//            useMarkdownUpload, …).
//
// Design notes:
//   - All three calls return Promises so callers `await` them. This
//     mirrors window.confirm/alert/prompt's synchronous-blocking shape
//     in a way that's compatible with React's render model.
//   - Cancel semantics:
//       confirm → resolves to `false`
//       alert   → resolves to undefined (user has acknowledged)
//       prompt  → resolves to `null` (operator cancelled);
//                 `'' `(empty string) means operator submitted empty.
//   - `destructive` is a styling hint; the underlying modal renders
//     a solid-red primary button when set. The semantic difference
//     vs. non-destructive is purely visual — both still require an
//     explicit operator click.
//
// No schema-shape implications. AppState is untouched.

export interface ConfirmOpts {
  /** Short heading for the modal. Keep to one line where possible. */
  title: string;
  /** Body text. Plain string; newlines render as line breaks
   *  (CSS `white-space: pre-wrap`). */
  message: string;
  /** Label for the affirmative action button. Default: `'Confirm'`. */
  confirmLabel?: string;
  /** Label for the cancel button. Default: `'Cancel'`. */
  cancelLabel?: string;
  /** Style the confirm button as a destructive action (solid red).
   *  Default: `false`. */
  destructive?: boolean;
}

export interface AlertOpts {
  /** Short heading for the modal. */
  title: string;
  /** Body text. Plain string; newlines render as line breaks. */
  message: string;
  /** Label for the acknowledge button. Default: `'OK'`. */
  okLabel?: string;
}

export interface PromptOpts {
  /** Short heading for the modal. */
  title: string;
  /** Optional body text shown above the input. Plain string; newlines
   *  render as line breaks. */
  message?: string;
  /** Initial value of the input. Default: empty string. */
  defaultValue?: string;
  /** Placeholder shown when the input is empty. */
  placeholder?: string;
  /** Label for the affirmative action button. Default: `'Submit'`. */
  confirmLabel?: string;
  /** Label for the cancel button. Default: `'Cancel'`. */
  cancelLabel?: string;
  /** Render a multi-line textarea instead of a single-line input.
   *  Default: `false`. */
  multiline?: boolean;
  /** Style the confirm button as a destructive action (solid red).
   *  Default: `false`. */
  destructive?: boolean;
}

/**
 * The modal API exposed via `useModal()` (defined in `src/components/Modal.tsx`).
 *
 * Each method enqueues a request on the provider's internal queue and
 * returns a Promise that resolves when the operator acts on the
 * resulting dialog.
 */
export interface ModalAPI {
  /** Two-button confirmation. Resolves `true` if the operator pressed
   *  the affirmative button, `false` on cancel / Escape / backdrop. */
  confirm(opts: ConfirmOpts): Promise<boolean>;
  /** Single-button acknowledgement. Resolves when the operator
   *  acknowledges. Cancel / Escape / backdrop also resolves
   *  (an alert is informational only). */
  alert(opts: AlertOpts): Promise<void>;
  /** Two-button input prompt. Resolves to the operator's submitted
   *  string (empty string is allowed), or `null` on cancel / Escape /
   *  backdrop. */
  prompt(opts: PromptOpts): Promise<string | null>;
}
