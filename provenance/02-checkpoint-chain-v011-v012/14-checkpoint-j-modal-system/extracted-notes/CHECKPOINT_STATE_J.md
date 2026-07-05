# RoundTable v0.12.0 — Checkpoint J — Modal System Replacement

**Status:** Complete. **6/6** browser-native dialog call sites replaced
with theme-styled, promise-returning in-app modals. Clean
type-check, clean production build, **15/15** v0.11.0 acceptance walk
criteria still pass. AppState shape unchanged. No migration. No
schema bump. No new external dependencies.

This document describes the exact state of the codebase at the moment
this ZIP was produced. Read it before resuming.

## Scope and rationale

Checkpoint J is a v0.11.x → v0.12.0 hardening checkpoint sequenced
ahead of the PWA conversion work. The v0.11.0 PWA readiness
assessment (see `docs/PWA_READINESS.md` § 10) identified browser-native
`window.confirm` / `window.alert` / `window.prompt` calls as a
reliability and quality risk:

1. **iOS Safari standalone-mode quirks** — native modals are
   sometimes dismissed without resolution when triggered from inside
   React event handlers that yield control. Two of RoundTable's six
   call sites lived inside the `useMarkdownUpload` hook's async
   commit flow — exactly the shape iOS handles inconsistently.
2. **Service-worker activation blocking** — open native modals can
   stall SW `skipWaiting()`. Eliminating them now removes that
   class of bug before Checkpoint L wires a service worker in.
3. **`window.prompt` is actively warned-against** in Chromium and
   gated behind permission policies in some embedded contexts.
4. **Visual consistency** — installed PWAs feel like apps; system
   dialogs feel like browsers.

Checkpoint J ships the modal-system replacement as a quality win
independent of the PWA work. If the PWA conversion is later
deferred or cancelled, Checkpoint J still delivers value (closes
v0.11.0's Known Limitation #6 from `docs/MARKDOWN_HANDOFF.md`).

## What changed in Checkpoint J

### Files created (2)

- **`src/types/modal.ts`** — public types for the modal API
  (`ModalAPI`, `ConfirmOpts`, `AlertOpts`, `PromptOpts`). Zero
  runtime code. Documents cancel semantics and the `destructive`
  styling hint.

- **`src/components/Modal.tsx`** — single-file implementation:
  `ModalProvider` (FIFO queue of requests, memoized API, React
  context), `useModal()` hook (consumer side), and the internal
  `ModalDialog` component (renders one request at a time with
  backdrop, header, body, actions). ~310 lines including the
  comment block.

### Files modified (6)

- **`src/main.tsx`** — wraps `<App />` in `<ModalProvider>` at the
  React tree root so both normal mode and the `recoveryMode` early
  return in `App.tsx` see the same context.

- **`src/App.tsx`** — imports `useModal`, calls it once near the
  other hooks, converts `onReset` to `async` and replaces
  `window.confirm('Reset to demo data? ...')` with a
  `modal.confirm({ destructive: true, ... })` call. Message text
  expanded slightly to recommend exporting JSON first.

- **`src/components/RecoveryPanel.tsx`** — imports `useModal`,
  calls it once at top, converts `handleReset` to `async` and
  replaces the `window.confirm(...)` recovery reset guard with
  `modal.confirm({ destructive: true, ... })`. Warning text
  preserved verbatim.

- **`src/components/ImportHistoryPanel.tsx`** — imports `useModal`,
  calls it once at top, converts `handleRollback` to `async`.
  Replaces `window.alert(...)` with `modal.alert({ ... })` for the
  cannot-rollback path; replaces `window.prompt(...)` with
  `modal.prompt({ multiline: true, destructive: true, ... })` for
  the rollback-reason capture. Cancel semantics preserved (cancel
  returns `null`, aborts the rollback dispatch).

- **`src/hooks/useMarkdownUpload.ts`** — imports `useModal`, calls
  it once near the other state hooks. Converts both `onImport` and
  `onImportAsRaw` from sync to `async` callbacks. Replaces both
  `window.confirm(...)` storage-pressure hard-gates with
  `modal.confirm({ destructive: false, confirmLabel: 'Proceed
  anyway', ... })` calls. Adds `modal` to both callbacks' useCallback
  dependency lists (stable reference because the provider's API is
  memoized).

- **`src/styles/app.css`** — appended ~130 lines of modal CSS
  (`.rt-modal-backdrop`, `.rt-modal-dialog`,
  `.rt-modal-dialog-destructive`, `.rt-modal-header`,
  `.rt-modal-title`, `.rt-modal-body`, `.rt-modal-message`,
  `.rt-modal-input`, `.rt-modal-input-multiline`,
  `.rt-modal-actions`, `.rt-modal-btn`) plus a new `.btn-danger-solid`
  utility class (solid-red destructive primary; the existing
  `.btn-danger` is outlined). Uses only existing CSS tokens.
  Buttons are 44 px tall (PWA-readiness floor). Mobile media query
  at `max-width: 480px` stacks the actions full-width with
  `flex-direction: column-reverse` so the primary action sits on
  top while DOM tab order remains Cancel → Confirm.

### Files NOT modified

- All Markdown Handoff utilities (`markdownArtifact.ts`,
  `markdownNormalize.ts`, `markdownHash.ts`, `markdownParse.ts`,
  `artifactImport.ts`, `importHistory.ts`) — untouched. Commit and
  rollback semantics unchanged.
- Migration engine (`migration.ts`) — untouched. No schema change.
- AppState shape and validation — untouched.
- `ImportPreviewModal.tsx` — untouched. It is unrelated to the
  six native-dialog call sites; it already uses a custom modal.
- `RawNotesPanel.tsx` — untouched. Its delete affordance is an
  inline two-step gate, not a native dialog.
- Storage pressure thresholds — `STORAGE_WARN_BYTES` /
  `STORAGE_HARD_BYTES` / cap constants unchanged.
- `SCHEMA_VERSION` — stays at `0.11.0`. AppState shape is
  byte-identical to v0.11.0 RC.
- `ARTIFACT_TYPE` — stays at `roundtable.markdown.v1`.

### Version bumps

- `package.json` version: `0.11.0` → `0.12.0`
- `package-lock.json` version: `0.11.0` → `0.12.0`
- `src/config/exportFormats.ts` `APP_VERSION`: `'0.11.0'` → `'0.12.0'`
- `src/config/exportFormats.ts` `SCHEMA_VERSION`: **unchanged** at `'0.11.0'`

Newly-emitted Markdown handoff artifacts will carry
`app_version: "0.12.0"` alongside `schema_version: "0.11.0"`. Older
artifacts (`app_version: "0.11.0"`) remain fully round-trip-compatible
because the importer only gates on `schema_version`, not on `app_version`.

## Modal API

Defined in `src/types/modal.ts`; implementation in
`src/components/Modal.tsx`:

```typescript
interface ModalAPI {
  confirm(opts: ConfirmOpts): Promise<boolean>;
  alert(opts: AlertOpts): Promise<void>;
  prompt(opts: PromptOpts): Promise<string | null>;
}
```

**Resolution semantics:**

| Method | Affirmative | Cancel / Escape / backdrop |
|---|---|---|
| `confirm` | `true` | `false` |
| `alert`   | `undefined` | `undefined` (alerts are informational) |
| `prompt`  | the operator's string (may be `''`) | `null` |

**`ConfirmOpts`:** `title`, `message`, optional `confirmLabel`
(default `'Confirm'`), optional `cancelLabel` (default `'Cancel'`),
optional `destructive` (styles confirm button solid red, default
`false`).

**`AlertOpts`:** `title`, `message`, optional `okLabel` (default
`'OK'`).

**`PromptOpts`:** `title`, optional `message`, optional `defaultValue`,
optional `placeholder`, optional `confirmLabel` (default `'Submit'`),
optional `cancelLabel`, optional `multiline` (default `false`),
optional `destructive`.

**Consumer pattern:**

```typescript
const modal = useModal();
const ok = await modal.confirm({
  title: 'Discard changes?',
  message: 'Unsaved edits will be lost.',
  destructive: true,
  confirmLabel: 'Discard',
});
if (!ok) return;
// proceed with destructive action
```

**Provider mount:** the provider is mounted exactly once at the
React tree root in `src/main.tsx`:

```tsx
<StrictMode>
  <ModalProvider>
    <App />
  </ModalProvider>
</StrictMode>
```

Hooks called within any descendant (panels, custom hooks like
`useMarkdownUpload`, and recovery mode) can call `useModal()`. The
provider throws a clear error if `useModal` is called outside it,
so a mount-order bug surfaces loudly.

**Queue behavior:** the provider holds a FIFO queue of requests.
If two confirms arrive simultaneously, the second waits its turn
behind the first. Each Promise resolves exactly once. The dialog
component is keyed on the queue head's `id` so React unmounts and
remounts cleanly between requests.

## Browser-native dialog call sites replaced (6)

| File | Line (before) | Native call | Replaced with |
|---|---|---|---|
| `src/App.tsx` | 117 | `window.confirm('Reset to demo data? ...')` | `modal.confirm({ destructive: true })` |
| `src/components/RecoveryPanel.tsx` | 70 | `window.confirm('Reset to demo data?\n\n...')` | `modal.confirm({ destructive: true })` |
| `src/components/ImportHistoryPanel.tsx` | 60 | `window.alert('Rollback is no longer available ...')` | `modal.alert({ ... })` |
| `src/components/ImportHistoryPanel.tsx` | 67 | `window.prompt('Rollback this import? ...', '')` | `modal.prompt({ multiline: true, destructive: true })` |
| `src/hooks/useMarkdownUpload.ts` | 358 | `window.confirm('Structured importing this artifact ...')` | `modal.confirm({ destructive: false, confirmLabel: 'Proceed anyway' })` |
| `src/hooks/useMarkdownUpload.ts` | 430 | `window.confirm('Importing this file would push localStorage ...')` | `modal.confirm({ destructive: false, confirmLabel: 'Proceed anyway' })` |

## Behavior verification per replaced dialog

Each replaced gate was inspected to confirm the new modal preserves
the prior behavior contract.

| Site | Pre-J behavior | Post-J behavior | Preserved? |
|---|---|---|---|
| **App.tsx reset-to-demo** | `confirm` returns true → wipe + load demo | `modal.confirm` resolves `true` → wipe + load demo. `false` / Escape / backdrop → no-op. | yes |
| **RecoveryPanel reset** | `confirm` returns true → clear localStorage + restore initial state | `modal.confirm` resolves `true` → clear + restore. `false` / Escape / backdrop → no-op. Warning text preserved (still mentions downloading/copying corrupted data first). | yes |
| **ImportHistoryPanel cannot-rollback** | `alert` blocks until dismissed; no further action | `modal.alert` resolves on OK / Escape / backdrop; no further action | yes |
| **ImportHistoryPanel rollback-reason** | `prompt` returns string (possibly empty) → dispatch rollback with reason or `'(no reason given)'`; null → abort | `modal.prompt` resolves string → dispatch rollback with reason or `'(no reason given)'`; resolves `null` (cancel / Escape / backdrop) → abort | yes |
| **useMarkdownUpload structured-import hard-gate** | `confirm` returns true → proceed to commitStructured | `modal.confirm` resolves `true` → proceed. `false` / Escape / backdrop → return without commit. | yes |
| **useMarkdownUpload raw-note hard-gate** | `confirm` returns true → proceed to commitAsRawNote | `modal.confirm` resolves `true` → proceed. `false` / Escape / backdrop → return without commit. | yes |

**None of the destructive paths can proceed automatically just
because the native dialog was replaced.** Each gate still requires
an explicit operator click on the affirmative button. The Escape
key and backdrop click both resolve as cancel, so an accidental
keypress aborts rather than confirms.

## Build / typecheck results

```
npx tsc --noEmit       # exit 0, clean
npm run build          # exit 0, 77 modules
                       # dist/index.html              0.51 kB │ gzip:   0.31 kB
                       # dist/assets/index-*.css     29.16 kB │ gzip:   5.32 kB
                       # dist/assets/index-*.js     429.10 kB │ gzip: 124.40 kB
                       # ✓ built in ~2.5s
```

Bundle delta from Checkpoint I baseline:
- 76 → 77 modules (+1: `src/components/Modal.tsx`)
- JS bundle 424.68 kB → 429.10 kB (+4.42 kB)
- CSS bundle 27.38 kB → 29.16 kB (+1.78 kB)
- Gzip JS 123.15 kB → 124.40 kB (+1.25 kB)
- Gzip CSS 5.06 kB → 5.32 kB (+0.26 kB)

## v0.11.0 acceptance walk regression check

The 15-criterion acceptance walk from Checkpoint I was re-run
against the Checkpoint J code base. Result preserved in
`scripts/acceptance-walk-results.txt`:

```
Summary: 15 pass, 0 partial, 0 fail
```

Plus the ancillary Raw Notes ring buffer sanity checks (200 cap,
oldest entries pruned, `removeRawNote` works) — all still pass.

The Markdown Handoff Mode workflow is unaffected by Checkpoint J.

## Grep proof: no app-owned native dialog calls remain

Final command:

```bash
grep -rnE "window\.(confirm|alert|prompt)[[:space:]]*\(" src/ --include="*.ts" --include="*.tsx" | grep -vE "^\s*//|^\s*\*"
```

Result: `(none)` — the only `window.confirm(` match anywhere in
`src/` is a `//` comment in `App.tsx` documenting what was replaced.

The strictest bare-call grep (`(^|[^A-Za-z0-9_.])(confirm|alert|prompt)\(`)
returns only `modal.confirm(...)` / `modal.alert(...)` /
`modal.prompt(...)` calls and comments. No runtime native-dialog
invocations remain in application code.

## Accessibility

Implemented:

- **Backdrop dimming** (`rgba(0,0,0,0.65)`) for visual focus.
- **`role="dialog"`** for confirm/prompt; **`role="alertdialog"`**
  for alert; **`aria-modal="true"`** on the dialog container.
- **`aria-labelledby`** pointing at the title; **`aria-describedby`**
  pointing at the body.
- **Escape key** cancels the dialog from anywhere on the page (window
  keydown listener).
- **Backdrop click** cancels the dialog (only when the click target
  is the backdrop itself, not bubbling from a child).
- **Initial focus** on the primary button for confirm/alert; on the
  input for prompt (with `select()` so default values can be
  replaced immediately).
- **Enter submits** single-line prompts.
- **`:focus` styles** on the input (amber border via CSS).
- **44px minimum touch target** on all buttons (`min-height: 44px`
  on `.rt-modal-btn`).

Known accessibility limitations (documented as deferred):

1. **No focus trap.** Tab can move focus to background elements
   while a dialog is open. Real blocking modality is preserved via
   the backdrop and the dialog's visual prominence.

2. **No `inert` attribute on background content.** Screen readers
   may still announce background regions. `aria-modal="true"` is
   the hint, but not all readers respect it.

3. **No body scroll lock.** Background page remains scrollable
   through the backdrop. Cosmetic only.

4. **Enter in multi-line textareas inserts a newline** rather than
   submitting. Operators submit via the button.

5. **No focus return to triggering element on close.** Acceptable
   for current call sites; tighten if dialogs become more
   widespread.

None of these limitations affect the destructive-action gating
contract.

## Mobile

Implemented:

- Backdrop fills viewport.
- Dialog centered with safe padding.
- `max-width: 480px` so dialogs don't stretch on desktop.
- `@media (max-width: 480px)` stacks actions full-width with
  `column-reverse` (primary on top, tab order preserved).
- 44px minimum button height.
- `white-space: pre-wrap` on messages — callers can pass multi-line
  text with `\n`.

Real iOS device testing belongs in Checkpoint M (mobile UX
hardening) or after Checkpoint L (PWA installability).

## Known limitations

The five accessibility limitations above. Plus:

6. **No portal-based render.** The dialog renders inside the
   provider's React subtree. If a future panel creates a
   conflicting stacking context, switching to `createPortal` is
   trivial.

7. **One dialog at a time, FIFO queue.** No way to dismiss all
   pending dialogs at once. No current call site requests
   concurrent dialogs.

8. **No animation on open/close.** Dialogs appear and disappear
   instantly. Kept out of scope for clean ship.

9. **The provider mounts a single context.** Nested ModalProviders
   are not supported. No current call site needs this.

## Deferred to Checkpoint K and beyond

Everything PWA-related is deferred per the brief. Specifically NOT
done in this checkpoint:

- No manifest (`public/manifest.json`).
- No service worker.
- No `vite-plugin-pwa` integration.
- No icons.
- No Netlify deployment config.
- No `index.html` PWA metadata (`<link rel="manifest">`,
  `<meta name="theme-color">`, Apple-specific tags).
- No mobile CSS hardening (safe-area insets, `viewport-fit=cover`,
  global touch-target floor, overscroll-behavior).
- No storage adapter swap (still localStorage-only).
- No backend / sync of any kind.
- No new Markdown Handoff source kinds.
- No unrelated refactors.

Per the PWA readiness assessment's recommended sequence (see
`docs/PWA_READINESS.md` § 17):

> **Checkpoint K** — Manifest + icons + HTML head additions
> **Checkpoint M** — Mobile UX hardening (parallelizable with K)
> **Checkpoint L** — Service worker + registration + update banner
> **Checkpoint N** — PWA-aware documentation pass

Checkpoint J unblocks Checkpoint L specifically (the SW activation
no-longer-blocked-by-native-confirm risk identified in
`docs/PWA_READINESS.md` § 10 is now resolved).

## Verdict

**Checkpoint J is complete and ready to ship.**

- 6/6 native dialog call sites replaced.
- 15/15 v0.11.0 acceptance walk criteria still pass.
- Clean type-check, clean production build.
- Zero AppState shape changes, zero migrations, zero new
  dependencies.
- Bundle delta is small (+4.42 kB JS, +1.78 kB CSS) and entirely
  attributable to the modal system itself.
- The destructive-action gating contract is preserved at every site.
- Documented accessibility limitations are listed and deferred to
  future polish.

The codebase is now ready for Checkpoint K (manifest + icons + HTML
head additions) whenever the open questions in
`docs/PWA_READINESS.md` § 19 are resolved.
