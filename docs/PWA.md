# RoundTable PWA Guide

RoundTable — v0.12.0 Checkpoint K — operator reference for the
Progressive Web App build.

This document covers how to run RoundTable locally, how to build it,
how to preview the PWA locally, how to deploy to Netlify, what to
expect on first install, how the offline app shell works, what the
update banner does, and how the Phase 0 boundaries (no backend, no
sync, no accounts) are preserved.

For the architectural assessment that drove this work, see
`docs/PWA_READINESS.md`. For the Markdown handoff workflow this
PWA wraps around, see `docs/MARKDOWN_HANDOFF.md`.

---

## Running locally

```
npm install
npm run dev
```

Vite serves at `http://localhost:5173`. The PWA service worker is
intentionally **disabled** in dev mode (`devOptions.enabled: false`
in `vite.config.ts`) so hot-module reload isn't interfered with by
the cache. The app is otherwise fully functional: clipboard,
SubtleCrypto hashing, Markdown handoff import/export, modal system,
all panels.

`localhost` is a secure context, so `navigator.clipboard.writeText`
and `SubtleCrypto.digest` work without HTTPS provisioning.

## Building

```
npm run build
```

Produces a self-contained static site under `dist/`:

| File | Purpose |
|---|---|
| `dist/index.html` | App shell — minimal HTML with injected manifest + asset links |
| `dist/manifest.webmanifest` | Web App Manifest (installability) |
| `dist/sw.js` | Service worker (Workbox-generated; precaches the app shell) |
| `dist/workbox-*.js` | Workbox runtime (loaded by the SW) |
| `dist/favicon.png`, `dist/apple-touch-icon.png`, `dist/icon-*.png` | Icon assets |
| `dist/assets/index-*.js` | The React app bundle |
| `dist/assets/index-*.css` | The single global stylesheet |
| `dist/assets/workbox-window.prod.es5-*.js` | Client-side SW registration helper |

Bundle file names include content hashes (`index-DgLn-aB9.js`) so
caching is safe — a new build produces new hashes; old hashes
remain in operator caches but are unreferenced by the new
`index.html` and eventually cleaned up by Workbox's
`cleanupOutdatedCaches`.

## Previewing the PWA locally

The `dev` script disables the SW. To exercise the actual PWA on
your local machine before deploying:

```
npm run build
npm run preview
```

This serves `dist/` over HTTP on `http://localhost:4173` (Vite's
preview port). `localhost` counts as a secure context for the
browser, so the SW will register, the manifest will be readable,
and you can use Chrome DevTools → Application → Manifest /
Service Workers to verify installation.

To trigger an install prompt in Chrome:

1. Build and preview as above.
2. Open `http://localhost:4173` in Chrome / Edge / Brave.
3. Click the install icon in the URL bar (looks like a monitor with
   a down-arrow). Some Chromium versions show "Install RoundTable…"
   in the three-dot menu.
4. The app installs as a standalone window with the RoundTable
   icon.

Safari on macOS supports PWAs via "Add to Dock" from the File
menu. iOS Safari supports "Add to Home Screen" from the Share
Sheet. Firefox desktop does not currently surface an install
affordance, but the SW + manifest still work for offline use.

## Deploying to Netlify

The repository includes a minimal `netlify.toml` configured for
static hosting:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

Plus a SPA-style fallback redirect and conservative
`Cache-Control` headers for `/sw.js`, `/manifest.webmanifest`, and
`/index.html` (must-revalidate) versus aggressive caching for
`/assets/*` (immutable, one year — safe because the filenames are
content-hashed).

Steps:

1. Push the repo to a Git provider (GitHub / GitLab / Bitbucket).
2. In Netlify, **New site from Git** → pick the repo.
3. Netlify reads `netlify.toml` and auto-fills:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy. Netlify provisions HTTPS automatically.

That's the whole flow. No environment variables, no backend
functions, no edge handlers, no DNS gymnastics.

**Hosted PWA validation has not been performed** as part of
Checkpoint K. Once the site is live, run:

- Chrome DevTools → Lighthouse → "Progressive Web App" audit.
- Application tab → Manifest → confirm icons load.
- Application tab → Service Workers → confirm sw.js is registered.
- Application tab → Storage → confirm Persistent Storage is
  granted (or check console for the persistence-request log
  emitted by `src/components/PwaUpdateBanner.tsx`).

## First-install behavior

When an operator visits the deployed PWA for the first time:

1. The HTML loads. The app boots normally.
2. The service worker installs in the background.
3. Workbox precaches the app shell: HTML, JS, CSS, fonts, icons,
   manifest. Approximately 500 KB.
4. Once precaching completes, `PwaUpdateBanner` surfaces a one-time
   "Offline Ready" notification (green banner, auto-dismisses after
   8 seconds, manually dismissible).
5. `navigator.storage.persist()` is called opportunistically. If
   granted, the browser commits to not evicting RoundTable's
   localStorage data without warning. The operator sees no UI for
   this — the request is silent. Failure is silent too.

After this first visit, the app shell is available offline. Loading
RoundTable with no network connection works exactly the same as
loading it with one — the only difference is that a new build
won't be detected until the network returns.

## Offline app shell behavior

The service worker uses a **precache strategy** for the app shell
and **no runtime caching** for anything else:

- All files emitted into `dist/` (HTML, JS, CSS, icons, manifest)
  are precached on SW install.
- The SW intercepts navigation requests and serves `index.html`
  from the cache when offline.
- The SW does **not** cache external resources because there are
  no external resources — RoundTable makes zero runtime network
  requests.

What works offline:
- The entire RoundTable workflow: round building, prompt
  generation, response pasting, mediator synthesis, decision
  recording, export/import (JSON and Markdown).
- Clipboard read/write (`navigator.clipboard`).
- Hashing (`SubtleCrypto`).
- File save via `<a download>` (browser-native; no SW
  involvement).
- File upload via `<input type="file">` (same).

What doesn't work offline:
- Detecting that a new app version exists (the SW can't reach the
  network to check). When the operator comes back online, the next
  page load triggers an update check.

## Update banner behavior

When a new bundle is deployed and the operator visits the PWA, the
SW detects the new version, downloads it, and waits in the
`installed` state. `PwaUpdateBanner` then renders an amber banner
above the storage-pressure banner:

```
UPDATE AVAILABLE
A new version of RoundTable has been downloaded. Reload to apply it.
If you are mid-import or editing a round, finish first — your work
will not be saved by the reload.

[ Reload to update ]   [ Later ]
```

Behavior:

- **Reload to update** → calls `updateServiceWorker(true)`. The new
  SW activates; the page reloads; the operator is on the new version.
- **Later** → dismisses the banner. The SW continues to wait. The
  banner re-appears on the next page load.

The update is **operator-prompted**, not silent. The strategy
choice (`registerType: 'prompt'` in `vite.config.ts`) is deliberate:
auto-update would reload mid-import and destroy transient state in
`useMarkdownUpload`. Prompted update preserves operator agency.

## Local-first guarantee, restated

**The PWA conversion does not introduce any new network or backend
surfaces in application code.** Specifically:

- The application bundle makes zero `fetch` / `XMLHttpRequest` /
  `WebSocket` / `EventSource` / `RTCPeerConnection` /
  `navigator.sendBeacon` calls. Verified by grep on every
  checkpoint.
- The service worker intercepts the browser's own asset requests
  during install (to populate the precache) and during runtime (to
  serve from cache when offline). These are not application
  network calls — they're the browser asking the SW whether it has
  a cached copy of an asset the page already requested.
- `navigator.storage.persist()` is a storage API, not a network
  API. It asks the browser to mark RoundTable's localStorage as
  durable; no data is transmitted.
- The manifest is a static file served by the host (Netlify); the
  app never re-fetches it at runtime.

The Phase 0 boundary holds: **no backend, no API, no automation,
no cloud sync, no model-provider integration.** Operators interact
only with their local browser storage and the OS file picker.

## State portability has not changed

The PWA conversion adds nothing to the state model. AppState is
byte-identical to v0.11.0:

- **JSON export/import** (Export / Import tab) remains the primary
  state-portability mechanism. Operators can move state between
  devices, browsers, or installs by exporting JSON, copying the
  file, and importing on the target.
- **Markdown artifacts** (Download .md / Upload .md on each panel)
  remain the model-handoff portability mechanism. Each artifact
  carries integrity hashes and provenance frontmatter.
- The PWA does NOT sync state between installs. An installed PWA
  on a phone and an installed PWA on a laptop are separate
  origins (well, the same origin if hosted on the same Netlify
  URL — but each browser maintains its own localStorage).

Operators who use RoundTable on multiple devices should export
JSON and re-import on each device deliberately. There is no
"sign in" or "sync" surface, by design.

## No backend, no sync, no accounts

RoundTable has no:
- Backend service
- API endpoints
- User accounts
- Sign-in flow
- Sync mechanism
- Cloud storage
- Push notifications
- Analytics or telemetry (the `console.info` calls in
  `PwaUpdateBanner.tsx` and `localStorageAdapter.ts` log to the
  local browser console only)

This is the local-first ethos and has not changed in v0.11.0 or
v0.12.0. The PWA conversion explicitly preserves it.

## iOS Share Sheet / Save to Files note

When the operator downloads a Markdown artifact (Download `.md`
on any panel) **from an installed iOS PWA**, the file save goes
through the iOS Share Sheet — the operator taps "Save to Files,"
picks a location, and confirms. This is one extra tap compared to
the desktop browser experience.

This is not a regression introduced by the PWA conversion — it is
how iOS handles all `<a download>` actions in installed standalone
mode. The desktop experience (quiet save to Downloads) is
unchanged.

When the operator uploads a Markdown artifact (Upload `.md` on
any panel) from an installed iOS PWA, the iOS Files picker opens
normally. iCloud Drive, On My iPhone, and any other configured
location are all accessible. No regression.

Android Chrome (browser or installed PWA): download saves to
Downloads quietly; upload opens Files / Drive picker normally.

## file:// is not a supported PWA target

The Checkpoint K work assumes RoundTable is served from `https://`
(production) or `http://localhost` (development). The PWA features
(service worker registration, install affordance, manifest
recognition) **do not work** from a `file://` origin.

The pre-PWA `file://` usage pattern (open `index.html` directly
from disk by double-clicking) is no longer a supported
distribution mode. RoundTable is now an HTTPS-hosted static PWA.

The functional regressions a `file://` operator would have hit
even pre-PWA include:
- `SubtleCrypto` is unavailable on `file://`, so hashing falls
  back to `null`.
- Clipboard access requires user gestures and a secure context.
- The Markdown handoff hashes can't be verified.

These were already documented in `docs/MARKDOWN_HANDOFF.md`. The
PWA conversion does not introduce new `file://` regressions; it
simply adds PWA features that are also unavailable there.

## Known limitations

Carried from `docs/PWA_READINESS.md` and the Checkpoint K
implementation:

1. **No focus trap in modals.** Checkpoint J ships a working modal
   system but tab focus can escape to background elements. Real
   blocking modality is preserved via the backdrop and visual
   prominence. (Documented in `CHECKPOINT_STATE_J.md`.)
2. **No portal-based render for modals.** Same.
3. **No body scroll lock for modals.** Same.
4. **iOS Safari `navigator.storage.persist()` support is partial.**
   Calling it on unsupported browsers is safe (we guard with
   `typeof navigator.storage.persist === 'function'`).
5. **No splash screens** beyond the manifest `background_color`.
   Operators on iOS see a `#0d0f11` background before the app
   loads, no logo. Custom splashes are per-device-resolution PNG
   files; deferred for v1.1.
6. **Hosted Netlify validation has not been performed.** The
   `netlify.toml` and operator instructions are correct to the
   best of our knowledge but the actual deployment has not been
   tested against the live Netlify build pipeline.
7. **localStorage quota still ~5 MB on iOS Safari.** The
   IndexedDB storage adapter (Checkpoint O in
   `docs/PWA_READINESS.md` § 17) is deferred. Operators who hit
   the cap should prune Raw Notes / Import History or export
   JSON.
8. **No update auto-check while the app is open.** The SW checks
   for new versions on page load. If the operator keeps the PWA
   open for hours, they won't see a new version until they
   reload manually. A periodic update check is possible but
   deferred.

## Deferred to later checkpoints

Per the brief, Checkpoint K explicitly does not implement:

- IndexedDB storage adapter (Checkpoint O in
  `docs/PWA_READINESS.md`).
- Backend, sync, accounts.
- File handlers (registering as the system `.md` handler).
- `share_target` (receiving shared content).
- Push notifications, background sync, background fetch.
- Electron wrapper.
- New Markdown Handoff source kinds.
- Decision log structured import.
- Splash screens per device.
- In-app install prompt UI (the browser-provided affordance is
  sufficient).
- Hosted PWA validation (this should be the next non-checkpoint
  task — see `docs/RELEASE_CHECKLIST.md`).
