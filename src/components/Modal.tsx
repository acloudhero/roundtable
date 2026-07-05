// src/components/Modal.tsx
// Purpose: v0.12.0 Checkpoint J — Modal System Replacement.
//          Implements ModalProvider + ModalDialog + useModal hook.
//          Replaces every app-owned window.confirm / window.alert /
//          window.prompt call in RoundTable with a theme-styled,
//          promise-returning dialog that works in normal browser mode
//          AND in future installed PWA / mobile contexts.
//
// Owned by:  this file (single-file feature)
// Used by:   src/main.tsx (mounts <ModalProvider> around <App />),
//            consuming components and hooks via useModal().
//
// Design rules:
//   1. ONE provider, mounted at the React tree root in main.tsx, so
//      both normal mode and recovery mode (RecoveryPanel) see it.
//   2. The API is async. Each call returns a Promise that resolves
//      with the operator's response. The Promise resolves exactly
//      once per call — never twice, never never.
//   3. Concurrent requests are queued (FIFO). If two confirms are
//      requested simultaneously, the second waits its turn behind
//      the first. The queue ensures no resolve callback is dropped.
//   4. Cancel paths: Escape key, backdrop click, and explicit Cancel
//      button all resolve as cancel. For confirms that's `false`; for
//      prompts `null`; for alerts the resolve is undefined (alerts
//      are informational — acknowledgement and cancel are equivalent).
//   5. Focus: the primary action button is focused on open for
//      confirms and alerts; for prompts the input is focused and its
//      contents selected (so the operator can immediately replace
//      the default value). This is enough for keyboard-only operation
//      in this checkpoint; see Known Limitations in CHECKPOINT_STATE_J.md.
//   6. No portal — the dialog renders inside the provider's React
//      subtree. RoundTable's app shell does not use stacking contexts
//      that interfere, and z-index: 1100 places it above
//      ImportPreviewModal's 1000.
//
// What this is NOT:
//   - Not a focus trap. Tab does not cycle within the dialog;
//     keyboard focus can escape to background elements. This is a
//     deliberate Checkpoint J scope decision — a real focus trap
//     adds substantial complexity for marginal benefit at this stage.
//   - Not a portal-based renderer. Adding `createPortal` is trivial
//     if z-index conflicts ever arise; for now the in-tree render is
//     simpler.
//   - Not a notification / toast system. One dialog at a time, blocking
//     until resolved. Toasts are a future concern.
//
// Note on imperative usage from hooks:
//   useMarkdownUpload (itself a hook) calls useModal() internally.
//   React's rules-of-hooks allow this: a hook can call other hooks
//   so long as it is called at the top level of its own caller.
//   The panel that calls useMarkdownUpload is mounted inside
//   ModalProvider, so the context is always available.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  ModalAPI,
  ConfirmOpts,
  AlertOpts,
  PromptOpts,
} from '../types/modal';

// ── Internal queue entry shapes ─────────────────────────────────────────────

type ConfirmRequest = {
  id: number;
  kind: 'confirm';
  opts: ConfirmOpts;
  resolve: (value: boolean) => void;
};
type AlertRequest = {
  id: number;
  kind: 'alert';
  opts: AlertOpts;
  resolve: () => void;
};
type PromptRequest = {
  id: number;
  kind: 'prompt';
  opts: PromptOpts;
  resolve: (value: string | null) => void;
};
type ModalRequest = ConfirmRequest | AlertRequest | PromptRequest;

// Monotonically-increasing id so dialogs can be keyed and the
// dialog component remounts cleanly when the head of the queue
// changes. Module-scoped because the counter only needs to be unique
// across the lifetime of the page, not across providers.
let _seq = 1;
const nextId = () => _seq++;

// ── Context ─────────────────────────────────────────────────────────────────

const ModalContext = createContext<ModalAPI | null>(null);

/**
 * The provider. Mount this near the React tree root so every panel
 * and every hook called from a panel can access the modal API.
 */
export function ModalProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ModalRequest[]>([]);

  const enqueue = useCallback((req: ModalRequest) => {
    setQueue((q) => [...q, req]);
  }, []);

  // Memoized so consumers' useCallback / useEffect deps don't churn.
  const api = useMemo<ModalAPI>(
    () => ({
      confirm: (opts) =>
        new Promise<boolean>((resolve) => {
          enqueue({ id: nextId(), kind: 'confirm', opts, resolve });
        }),
      alert: (opts) =>
        new Promise<void>((resolve) => {
          enqueue({ id: nextId(), kind: 'alert', opts, resolve });
        }),
      prompt: (opts) =>
        new Promise<string | null>((resolve) => {
          enqueue({ id: nextId(), kind: 'prompt', opts, resolve });
        }),
    }),
    [enqueue]
  );

  const current = queue[0] ?? null;

  const dismiss = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  // Resolve handlers — narrowed per request kind. The dialog component
  // calls one of these on operator action; we resolve the promise then
  // pop the queue.
  const handleConfirm = useCallback(
    (value: boolean) => {
      if (!current || current.kind !== 'confirm') return;
      current.resolve(value);
      dismiss();
    },
    [current, dismiss]
  );

  const handleAlertOk = useCallback(() => {
    if (!current || current.kind !== 'alert') return;
    current.resolve();
    dismiss();
  }, [current, dismiss]);

  const handlePromptSubmit = useCallback(
    (value: string | null) => {
      if (!current || current.kind !== 'prompt') return;
      current.resolve(value);
      dismiss();
    },
    [current, dismiss]
  );

  return (
    <ModalContext.Provider value={api}>
      {children}
      {current && (
        <ModalDialog
          key={current.id}
          request={current}
          onConfirm={handleConfirm}
          onAlertOk={handleAlertOk}
          onPromptSubmit={handlePromptSubmit}
        />
      )}
    </ModalContext.Provider>
  );
}

/**
 * Consumer hook. Throws when called outside a ModalProvider so the
 * mount-order bug surfaces loudly rather than silently no-ops.
 */
export function useModal(): ModalAPI {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error(
      'useModal must be used inside <ModalProvider>. ' +
        'Wrap your application root in ModalProvider (see src/main.tsx).'
    );
  }
  return ctx;
}

// ── Dialog component ────────────────────────────────────────────────────────

interface DialogProps {
  request: ModalRequest;
  onConfirm: (value: boolean) => void;
  onAlertOk: () => void;
  onPromptSubmit: (value: string | null) => void;
}

function ModalDialog({
  request,
  onConfirm,
  onAlertOk,
  onPromptSubmit,
}: DialogProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Controlled value for prompt. Seed once per request (the parent
  // remounts this component on queue head change via the `key={current.id}`
  // prop, so this effectively resets per request).
  const initialValue =
    request.kind === 'prompt' ? request.opts.defaultValue ?? '' : '';
  const [value, setValue] = useState<string>(initialValue);

  // Cancel handler — resolves the active request as cancel.
  // Wrapped in useCallback so the effect's stable identity holds.
  const cancel = useCallback(() => {
    if (request.kind === 'confirm') onConfirm(false);
    else if (request.kind === 'alert') onAlertOk();
    else onPromptSubmit(null);
  }, [request, onConfirm, onAlertOk, onPromptSubmit]);

  // Submit (primary action) — resolves the active request affirmatively.
  const submit = useCallback(() => {
    if (request.kind === 'confirm') onConfirm(true);
    else if (request.kind === 'alert') onAlertOk();
    else onPromptSubmit(value);
  }, [request, value, onConfirm, onAlertOk, onPromptSubmit]);

  // Escape-to-cancel. Listener bound to window so it catches the key
  // regardless of which element holds focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel]);

  // Initial focus. setTimeout(_, 0) defers past the current render so
  // the focusable element exists. Selecting the input contents lets
  // the operator immediately overwrite a default value.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (request.kind === 'prompt') {
        if (request.opts.multiline) {
          textareaRef.current?.focus();
          textareaRef.current?.select();
        } else {
          inputRef.current?.focus();
          inputRef.current?.select();
        }
      } else {
        primaryRef.current?.focus();
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [request.kind, request.opts]);

  // Backdrop click = cancel (only when the click landed on the backdrop
  // itself, not bubbling from a dialog child).
  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) cancel();
  };

  // Label helpers — narrow on `request.kind` so the discriminated-union
  // shape stays type-safe. Each label has a sensible default that
  // matches the prior window.confirm / window.alert / window.prompt
  // conventions.
  const getCancelLabel = (): string => {
    if (request.kind === 'confirm')
      return request.opts.cancelLabel ?? 'Cancel';
    if (request.kind === 'prompt')
      return request.opts.cancelLabel ?? 'Cancel';
    return 'Cancel';
  };
  const getConfirmLabel = (): string => {
    if (request.kind === 'confirm')
      return request.opts.confirmLabel ?? 'Confirm';
    if (request.kind === 'prompt') return request.opts.confirmLabel ?? 'Submit';
    return 'OK';
  };

  const isDestructive =
    (request.kind === 'confirm' && !!request.opts.destructive) ||
    (request.kind === 'prompt' && !!request.opts.destructive);

  const titleId = `rt-modal-title-${request.id}`;
  const bodyId = `rt-modal-body-${request.id}`;

  return (
    <div
      className="rt-modal-backdrop"
      onClick={onBackdropClick}
      role="presentation"
    >
      <div
        className={
          'rt-modal-dialog' +
          (isDestructive ? ' rt-modal-dialog-destructive' : '')
        }
        role={request.kind === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rt-modal-header">
          <h2 className="rt-modal-title" id={titleId}>
            {request.opts.title}
          </h2>
        </div>

        <div className="rt-modal-body" id={bodyId}>
          {request.kind === 'prompt' ? (
            <>
              {request.opts.message && (
                <p className="rt-modal-message">{request.opts.message}</p>
              )}
              {request.opts.multiline ? (
                <textarea
                  ref={textareaRef}
                  className="rt-modal-input rt-modal-input-multiline"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={request.opts.placeholder}
                  rows={4}
                />
              ) : (
                <input
                  ref={inputRef}
                  className="rt-modal-input"
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={request.opts.placeholder}
                  onKeyDown={(e) => {
                    // Enter submits single-line prompts. Multi-line
                    // textareas keep their native newline behavior;
                    // operators submit via the button or Ctrl/Cmd+Enter
                    // (not wired yet — see Known Limitations).
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
              )}
            </>
          ) : (
            <p className="rt-modal-message">{request.opts.message}</p>
          )}
        </div>

        <div className="rt-modal-actions">
          {request.kind === 'alert' ? (
            // Single-button form. Primary OK only.
            <button
              ref={primaryRef}
              type="button"
              className="btn btn-primary rt-modal-btn"
              onClick={submit}
            >
              {request.opts.okLabel ?? 'OK'}
            </button>
          ) : (
            // Two-button form. Cancel first in DOM order so that on
            // mobile (column-reverse layout — see app.css) the primary
            // appears on top, but tab order still goes Cancel → Confirm.
            <>
              <button
                type="button"
                className="btn btn-secondary rt-modal-btn"
                onClick={cancel}
              >
                {getCancelLabel()}
              </button>
              <button
                ref={primaryRef}
                type="button"
                className={
                  'btn rt-modal-btn ' +
                  (isDestructive ? 'btn-danger-solid' : 'btn-primary')
                }
                onClick={submit}
              >
                {getConfirmLabel()}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
