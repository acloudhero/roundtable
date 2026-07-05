# PWA Readiness

RoundTable — v0.11.0 RC — planning document for Progressive Web App
conversion.

> **Status: PLANNING / READINESS ASSESSMENT — NOT DELIVERED WORK.**
>
> This document captures the work required to ship RoundTable as an
> installable, offline-capable Progressive Web App. **No PWA changes
> have been made.** The codebase remains the v0.11.0 RC produced at
> Checkpoint I; no manifest exists, no service worker exists, no
> icons exist, no PWA build tooling is installed. This document
> exists to scope the work before it is committed to a checkpoint
> sequence.
>
> When PWA work begins, this document is the source of truth for
> what's in scope, what's deferred, and what's explicitly excluded.
>
> **Update (v0.12.0): Checkpoint J — Modal System Replacement —
> is now delivered.** All six app-owned `window.confirm` /
> `window.alert` / `window.prompt` call sites identified in § 10
> have been replaced by a theme-styled, promise-returning in-app
> modal system (`src/components/Modal.tsx`, `src/types/modal.ts`).
> See `CHECKPOINT_STATE_J.md` for the full delivery report.
>
> **Update (v0.12.0): Checkpoint K — PWA Implementation Bundle —
> is now delivered.** Combines the original K, L, and M scopes:
> manifest + icons + HTML head metadata, service worker with
> Workbox via `vite-plugin-pwa`, operator-prompted update banner,
> opportunistic `navigator.storage.persist()`, mobile UX hardening
> (safe-area insets, `viewport-fit=cover`, overscroll-behavior,
> tap-highlight cleanup, 44 px touch-target floor), and a minimal
> Netlify-friendly `netlify.toml`. See `CHECKPOINT_STATE_K.md` for
> the full delivery report and `docs/PWA.md` for the operator
> guide. **Hosted Netlify validation has not been performed.**
> Checkpoint N (PWA-aware documentation expansion) remains.

---

## 1. Executive verdict

**RoundTable is unusually well-positioned for PWA conversion.** The
architectural decisions made for the local-first design — single
AppState in localStorage, no backend, no network primitives,
secure-context-aware clipboard wrapper, storage-pressure tracking
with explicit thresholds, mobile-first CSS from Phase 8 — are
exactly the prerequisites a PWA needs. The conversion work is real
but modest: roughly one substantive checkpoint of net-new
infrastructure (manifest + service worker + icon set), one
checkpoint of UX hardening (replacing browser modal dialogs that
were already documented as deferred in v0.11.0), one checkpoint of
mobile CSS polish, and an optional storage-upgrade checkpoint if
iOS Safari quotas become a real blocker.

The Phase 0 boundaries (no backend, no API, no automation, no
cloud sync) hold throughout. The PWA work introduces zero new
network surfaces in application code — the service worker
intercepts the browser's own asset fetches, which is the entire
point.

This assessment assumes "PWA" means *installable, offline-capable,
with a self-contained app shell on the user's device*. It does NOT
mean "wrap in a WebView," "add push notifications," or "add a
backend for sync." Those are different products.

---

## 2. What is already PWA-ready

The v0.11.0 RC contains substantial PWA prerequisites that were put
in place for unrelated reasons but happen to be exactly what a PWA
needs.

| Surface | Current state | Why it's PWA-favorable |
|---|---|---|
| Local-first design | Single AppState in localStorage; no backend; no network primitives | PWAs are at their best when they work fully offline; RoundTable already does. |
| Secure-context awareness | `src/utils/clipboard.ts` checks `window.isSecureContext` and gracefully falls back; `src/utils/markdownHash.ts` degrades to `null` hashes when `SubtleCrypto` is unavailable | PWAs require HTTPS (a secure context) — this aligns rather than conflicts. |
| Storage adapter abstraction | `StorageAdapter` interface in `src/storage/storageAdapter.ts`; `localStorageAdapter.ts` is the only impl; explicit comment about IndexedDB upgrade path | Swap-ready when storage limits demand it (see § 13). |
| Storage pressure tracking | `STORAGE_WARN_BYTES = 3.5 MB`, `STORAGE_HARD_BYTES = 4.25 MB` in `src/config/markdownHandoff.ts`; live banner in app shell; pre-commit projection | Already conservative; ready for tighter PWA quotas. |
| Mobile CSS | Phase 8 work: media queries at 768, 700, 640, 500, 480px; `body { overflow-x: hidden }`; `:focus-visible`; tab nav horizontally-scrollable on narrow screens | Foundation is in place; remaining gaps are specific (see § 11). |
| Viewport meta | `<meta name="viewport" content="width=device-width, initial-scale=1.0">` present and correct | Required for mobile rendering; already there. |
| Vite build | Vite 6, modern bundle with relative asset paths (`base: './'`) | Lets the PWA be hosted at any subpath without absolute-URL refactoring. |
| File operations | Standard `<input type="file" accept=".md,.markdown,text/markdown">` + `URL.createObjectURL` + `<a download>` pattern in `src/utils/jsonExport.ts`'s `downloadText` helper | Works in installed PWAs everywhere, including iOS (see § 12). |
| Update-safe data model | Schema migrations are forward-only and idempotent (`migrate_0_10_5_to_0_11_0`); the engine handles new-version-loading-old-data correctly | Service worker can swap bundles without corrupting persisted state. |

None of this work needs to be redone for PWA conversion.

---

## 3. What is missing

Concrete gaps that block PWA installability or quality.

| Surface | Current state | Required for PWA |
|---|---|---|
| `public/` directory | Does not exist | Required as the source location for static PWA assets (manifest, icons) |
| `manifest.json` | None | Required — installability gate |
| App icons | None — no favicon, no apple-touch-icon, no maskable icon | Required — installability gate; multiple sizes |
| Service worker | None | Required — installability gate; offline capability |
| SW registration | None in `src/main.tsx` | Required — for the SW to actually run |
| Theme color meta | None in `index.html` | Required for the Android status bar and OS dark-mode hints |
| `<link rel="manifest">` | Not in `index.html` | Required for browsers to discover the manifest |
| Apple-specific meta tags | None | Required for iOS install quality (`apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`) |
| Splash screens | None | Recommended for iOS standalone-mode polish |
| In-app modal system | Uses `window.confirm` / `alert` / `prompt` at 6 call sites | Strongly required — see § 10 |
| Safe-area handling | No `env(safe-area-inset-*)` references in CSS | Required for notched iOS devices in standalone mode |
| `viewport-fit=cover` | Not set | Required to let layout extend under notches/dynamic island |
| `navigator.storage.persist()` call | None | Recommended — requests durable storage from the browser |

---

## 4. Required PWA changes (overview)

At a high level, the PWA conversion adds these surfaces:

1. **Manifest** (§ 5) — single JSON file declaring identity, display
   mode, theme, scope.
2. **Icons** (§ 6) — six PNG files at standard sizes plus optional SVG.
3. **Service worker** (§ 7 & 8) — generated by `vite-plugin-pwa`,
   registered from `src/main.tsx`, with an update-available banner in
   the app shell.
4. **`index.html` head additions** (§ 9) — manifest link, theme-color
   meta, Apple-specific meta tags, icon links.
5. **Modal-system replacement** (§ 10) — replace all `window.confirm`
   / `alert` / `prompt` call sites with a theme-styled,
   promise-returning modal component pair.
6. **Mobile UX hardening** (§ 11) — touch-target audit to 44px,
   safe-area insets, `viewport-fit=cover`, tap-highlight removal,
   overscroll-behavior.
7. **Build/tooling delta** (§ 15) — add `vite-plugin-pwa` and
   optionally `workbox-window`; update `vite.config.ts`.

Each is detailed in its own section below. The remaining sections (§
12–§ 20) cover risks, interactions with v0.11.0, and the
decomposition into a checkpoint sequence.

---

## 5. Manifest requirements

Path: `public/manifest.json` (Vite serves `public/` at the root of
the built site).

The locked Phase 0 constraints make most fields obvious — local-first,
single-purpose, no shortcuts, no `share_target`, no `protocol_handlers`,
no `file_handlers` (those are deferrable enhancements; see § 18).

Minimum required fields:

| Field | Required value / shape | Rationale |
|---|---|---|
| `id` | A stable identifier (e.g. `./?source=pwa` or the start URL) | Browser uses this to dedupe install entries. |
| `name` | `RoundTable` | Long form — used in install dialogs. |
| `short_name` | `RoundTable` | Home-screen label (12-char target). |
| `description` | Source of truth: `package.json#description`; fix the duplicated `"Local-first local-first"` typo in the current `<meta name="description">` while there | Used in install dialogs. |
| `start_url` | `./index.html` (or `./`) | Must align with `vite.config.ts`'s `base: './'`. |
| `scope` | `./` | Controls which URLs are considered "in-app" for SW. |
| `display` | `standalone` | Removes browser chrome when installed. |
| `orientation` | `any` | RoundTable is responsive; no preferred orientation. |
| `background_color` | `#0d0f11` (matches `--bg-base` in `app.css`) | Splash background. |
| `theme_color` | `#0d0f11` | OS UI accent (status bar, title bar). |
| `icons` | See § 6 | Required entries. |
| `categories` | `["productivity", "developer", "utilities"]` | Optional but improves discovery in install dialogs. |

Deferrable (see § 18): `file_handlers`, `share_target`,
`protocol_handlers`, `shortcuts`, `screenshots`.

If the app gets hosted at a subpath (e.g. `https://example.com/roundtable/`),
both `start_url` and `scope` must reflect that path. The current
`base: './'` config lets us defer that decision until deployment.

---

## 6. Icon requirements

The minimum-credible icon set for cross-platform installability:

| Filename (suggested) | Size | `purpose` | Target |
|---|---|---|---|
| `icon-192.png` | 192×192 | `any` | Standard Android install icon |
| `icon-512.png` | 512×512 | `any` | High-density + splash source |
| `icon-192-maskable.png` | 192×192 | `maskable` | Android adaptive icon (safe zone) |
| `icon-512-maskable.png` | 512×512 | `maskable` | Android adaptive icon (high density) |
| `apple-touch-icon.png` | 180×180 | n/a (via `<link>`) | iOS home screen |
| `favicon.png` | 32×32 | n/a (via `<link>`) | Browser tab |

Maskable icons must keep meaningful content within the inner 80% (the
"safe zone") because Android crops to round / squircle / square per
the device theme. The current industrial-terminal aesthetic (amber on
near-black `#0d0f11`) makes the maskable design trivial — a centered
monogram (e.g. `RT`) or a circular mark with adequate padding survives
every platform crop.

**Asset-creation task, not a code task.** Worth flagging as the only
piece of net-new content the project needs that isn't directly
generated from existing material. If no brand mark exists, this
becomes a design dependency before Checkpoint K can ship.

A single SVG icon with `purpose: "any maskable"` can supplement the
PNGs if a vector mark exists. Not a substitute — Apple devices still
need raster PNG for `apple-touch-icon`.

---

## 7. Service worker strategy

**Recommended strategy: precached app shell, network-first for the
HTML entry, cache-first for hashed assets, no runtime caching.**

The Vite build already produces hashed asset filenames
(`index-DtFtPZM7.js`, `index-B4Y4O4JB.css`). These are immutably
named — a given bundle hash will never have different bytes. That
means:

- **Hashed assets (`*.js`, `*.css`, `*.woff2`, etc.):** cache-first,
  fall back to network. Cache hits are correct forever; misses
  populate the cache.
- **`index.html` (the entry):** network-first, fall back to cache.
  Keeps online operators on the latest version while still working
  fully offline.
- **`manifest.json` and icons:** precached on SW install.
- **No third bucket of "data" requests** because the application
  makes zero runtime network calls — this is the key simplification
  that justifies a minimal SW strategy.

The locked Phase 0 boundary holds: the SW does not introduce
network calls in application code. The SW intercepts the browser's
own asset requests; the application remains network-free. The
existing acceptance walk's C14 "no new network surfaces" criterion
remains valid — the relevant grep is over `src/`, not over the
generated SW.

**Tooling: `vite-plugin-pwa` with Workbox under the hood.**

The plugin handles SW generation, manifest emission, `<link
rel="manifest">` injection, asset precaching, and revision-aware
cache invalidation. The hand-rolled alternative (a static
`public/sw.js`) is tractable for a 76-module bundle but loses
Workbox's automatic revisioning logic — every new build would
require manually updating cache version strings, which is exactly
the kind of error-prone task the plugin exists to avoid.

Expected behavior summary:

- Each new build emits a SW with a fresh precache manifest keyed by
  the new asset hashes.
- The SW installs in the background on the next visit.
- The existing tab continues to run the old version.
- On reload (or via the in-app "Reload to update" banner), the new
  version activates.
- The old precache is automatically cleaned up.

---

## 8. Service worker registration / update strategy

**Registration site: `src/main.tsx`, after page load.**

The registration should be deferred (e.g. `'load'` event listener) to
keep the critical rendering path clean. Logical sketch (not code):

> If `'serviceWorker' in navigator`, register the generated SW URL
> after the `load` event. Wire the registration's `updatefound` event
> to a callback that surfaces a new banner in the app shell.

**Update strategy: `prompt` (operator-controlled), not `autoUpdate`.**

`vite-plugin-pwa` exposes a `registerType` option. The two
real choices:

| Strategy | Behavior | Fit for RoundTable |
|---|---|---|
| `autoUpdate` | New SW activates immediately on next page load; existing tabs reload silently | Wrong — destroys mid-import preview state and in-progress edits |
| `prompt` | New SW waits; app surfaces an "Update available" affordance; operator chooses when to reload | Right — preserves the operator's mid-round agency |

Mid-import, the operator has transient state in `useMarkdownUpload`'s
hook (the parsed preview, the captured warnings, the
deferred-reason memo). An auto-update reload destroys all of it. The
`prompt` strategy lets the operator finish the import, then reload
between rounds. This matches the local-first ethos of "the operator
is in control."

**Implementation surface: one new banner component.**

The app shell already renders a `StoragePressureBanner` (Phase 8 +
v0.11.0 Checkpoint C.5). A new `UpdateAvailableBanner` follows the
same pattern: subscribes to the SW registration's update event,
renders with explicit "Reload to update" + "Later" buttons, and
disappears when dismissed or reload is initiated.

**`navigator.storage.persist()` should be requested in the same
registration sequence.** If granted, the browser commits to not
evicting RoundTable's storage without warning. The call is
opportunistic — it may be denied — but failure is non-fatal. See §
13 for context.

---

## 9. `index.html` / head additions

Required additions to `index.html` (current head is minimal — see § 3
for the gap list).

In order:

| Tag | Purpose |
|---|---|
| `<link rel="manifest" href="./manifest.json">` | Browsers discover the manifest. |
| `<meta name="theme-color" content="#0d0f11">` | Android status bar; OS UI hints. |
| `<meta name="color-scheme" content="dark">` | RoundTable is dark-only; prevents iOS flash-of-white during load. |
| `<link rel="icon" href="./favicon.png" type="image/png">` | Browser tab. |
| `<link rel="apple-touch-icon" href="./apple-touch-icon.png">` | iOS home screen icon. |
| `<meta name="apple-mobile-web-app-capable" content="yes">` | Older iOS standalone-mode opt-in. (Newer iOS uses the manifest.) |
| `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` | Matches the `#0d0f11` background under the iOS status bar. |
| `<meta name="apple-mobile-web-app-title" content="RoundTable">` | Home-screen label on iOS. |
| Update `<meta name="viewport">` to add `viewport-fit=cover` | Lets the layout extend under notches; required for safe-area insets to resolve. |
| Fix duplicated `"Local-first local-first"` in `<meta name="description">` | Pre-existing typo; unrelated to PWA but worth doing in the same edit. |

Several of these (manifest link, theme-color, icons) will be
auto-injected by `vite-plugin-pwa` if the plugin is configured to do
so. The Apple-specific meta tags are not auto-injected and must be
added by hand.

---

## 10. Why `window.confirm` / `alert` / `prompt` should be replaced

**Recommendation: replace them BEFORE the service worker is
introduced, or in the same release.**

Current call sites:

| File | Method | Context | Risk in PWA |
|---|---|---|---|
| `src/hooks/useMarkdownUpload.ts:358` | `window.confirm` | Storage-pressure hard-limit gate (structured commit) | iOS standalone mode inconsistency |
| `src/hooks/useMarkdownUpload.ts:430` | `window.confirm` | Storage-pressure hard-limit gate (raw-note commit) | iOS standalone mode inconsistency |
| `src/components/ImportHistoryPanel.tsx:60` | `window.alert` | "Cannot rollback this transaction" | Visually jarring in installed PWA |
| `src/components/ImportHistoryPanel.tsx:67` | `window.prompt` | Rollback reason input | `window.prompt` is deprecated in some PWA contexts |
| `src/components/RecoveryPanel.tsx:70` | `window.confirm` | Recovery confirmation | Same as above |
| `src/App.tsx:117` | `window.confirm` | "Reset to demo data?" | Higher accidental-tap risk without URL bar |

Why this matters specifically for PWA:

1. **iOS Safari standalone-mode quirks.** Native modal dialogs in
   installed iOS PWAs are sometimes dismissed without resolution,
   especially when triggered from inside a React event handler that
   yields control. The `useMarkdownUpload` hook triggers `confirm`
   inside an async commit flow — exactly the shape iOS handles
   inconsistently.
2. **Service-worker activation blocking.** If a `window.confirm` is
   open when the SW tries to activate a new version
   (`skipWaiting()`), activation can stall. Replacing the dialogs
   removes this class of bug.
3. **`window.prompt` is actively warned-against** in Chromium and
   gated behind permission policies in some embedded contexts.
4. **Visual consistency.** Installed PWAs feel like apps; system
   dialogs feel like browsers. The visual disjunction undermines
   the installed-app feel for the parts of the workflow that matter
   most (storage pressure, rollback reasons, demo reset).
5. **Documented as deferred already.** `docs/MARKDOWN_HANDOFF.md`
   Known Limitation #6 already calls out the `window.confirm`
   storage-pressure gate as "deferred for in-style modal upgrade."
   PWA work is a natural forcing function.

**Recommended replacement: one `ConfirmModal` + one `PromptModal`,
both promise-returning, both theme-styled, both focus-trapped.** The
existing `ImportPreviewModal` is a precedent — the modal
infrastructure already exists. Generalizing it covers all six call
sites and removes a documented limitation.

This is a self-contained UX checkpoint that delivers value even if
the PWA work is later deferred or cancelled. **It should ship
first**, both for that reason and to avoid the SW-activation
blocking risk above.

---

## 11. Mobile UX hardening requirements

Phase 8 laid most of the groundwork. The remaining gaps are specific
and CSS-only.

**Touch targets.** The base rule `a, button { min-height: 36px }` in
`src/styles/app.css:798` is below WCAG 2.5.5 Level AAA (44×44 CSS
pixels), below Apple HIG (44pt), and below Material Design
(48dp). For a thumb-driven PWA, 44px is the floor. The
newly-added Raw Notes Delete button uses inline `minHeight: 32`,
which is too tight.

> Required: raise the global floor to `min-height: 44px`. Introduce a
> `.btn-compact` opt-out for dense lists where 36–38px is still
> defensible.

**Safe-area insets.** No references to `env(safe-area-inset-*)`
anywhere in the CSS. On notched iOS devices in standalone mode, the
app header sits under the dynamic island and the tab nav clips into
the home indicator.

> Required: `padding-top: max(12px, env(safe-area-inset-top))` on
> `.app-header`; `padding-bottom: max(0px,
> env(safe-area-inset-bottom))` on `.tab-nav`; potentially also
> `padding-left/right: env(safe-area-inset-left/right)` on outer
> containers for landscape on notched devices.

**`viewport-fit=cover`.** Without it, iOS pillarboxes the app on
notched devices and `env(safe-area-inset-*)` resolves to 0. Required
in `index.html`'s viewport meta (covered in § 9).

**Tap-highlight color.** The default iOS tap-highlight grey flash
looks like browser chrome inside an installed PWA.

> Required: `* { -webkit-tap-highlight-color: transparent; }` (or
> scoped to interactive elements).

**Overscroll behavior.** When the operator scrolls a textarea at
top-of-page, the default iOS pull-to-refresh gesture can reload the
PWA mid-round.

> Required: `body { overscroll-behavior: none; }` (or `contain` if
> bounce should be preserved for nested scrollers).

**User-select on tab nav.** Tab buttons currently allow text
selection; in installed PWAs, long-presses on tabs surface the
selection menu instead of the tab affordance.

> Required: `.tab-nav { user-select: none; -webkit-user-select: none; }`.

**Keyboard inset (deferred).** When the operator focuses a textarea
on iOS (the Round Builder's `userInstruction`, the Mediator panel's
`mediatorResponse`), the on-screen keyboard pushes the layout. iOS
Safari has improved significantly here, but `VisualViewport` API
listeners can anchor the active textarea more robustly.

> Recommended for v2; not required for the initial PWA release.

**Status: all of the above are CSS-only and can be parallelized with
any other checkpoint** (manifest, SW, or modal work).

---

## 12. iOS file upload / download notes

The Markdown handoff loop is the operational heart of v0.11.0. PWA
installation changes the file-handling UX on iOS specifically — but
**no code change is required.** The current pattern is the correct
one for iOS Safari, installed or not.

Cross-platform behavior:

| Platform | Upload `.md` | Download `.md` |
|---|---|---|
| Android Chrome (browser) | Opens Files / Drive picker | Quiet save to Downloads; visible in browser shade |
| Android Chrome (installed PWA) | Opens Files / Drive picker | Quiet save to Downloads; visible in OS file manager |
| iOS Safari (browser) | Opens iCloud Drive / Files picker | Save via Share Sheet; operator picks destination |
| iOS Safari (installed PWA) | Opens Files picker | **Save via Share Sheet; slightly more friction than browser** |
| Desktop (any) | Native file picker | Save to Downloads (or browser-prompted location) |

**Specific iOS PWA observations:**

- `URL.createObjectURL` + `<a download>` works in installed iOS
  PWAs. The download triggers the iOS Share Sheet — the operator
  taps "Save to Files," then picks a location. This is one extra
  tap compared to desktop. **Not broken; documentation-worthy.**
- The File System Access API (which would enable in-place "Save As"
  with persistent file handles) is **not supported in iOS Safari** —
  the current pattern is therefore the right one, not a regression.
- Drag-and-drop file upload is **not supported in iOS Safari**. The
  existing `<input type="file">` click flow is correct.
- The accept list `.md,.markdown,text/markdown` is respected on
  iOS but the Files picker still shows non-matching files greyed
  out rather than hiding them. Operators can tap them but the file
  is rejected by the input. This is iOS-standard behavior.

**Required actions: none in code. One paragraph in
`docs/MARKDOWN_HANDOFF.md`** describing the iOS Share Sheet flow so
operators aren't surprised on first install. This belongs in the
"Export flow" and "Import flow" sections (§ 4 and § 5 of that doc).

---

## 13. Storage / quota risks

**The locked v0.11.0 thresholds are conservative for desktop, tight
for iOS Safari.**

| Browser | Approx localStorage quota | Notes |
|---|---|---|
| Chrome / Edge desktop | ~10 MB per origin | Comfortable headroom. |
| Firefox desktop | ~10 MB per origin | Comfortable headroom. |
| Safari desktop | ~5 MB per origin | Tight; the `STORAGE_HARD_BYTES = 4.25 MB` ceiling is appropriate. |
| iOS Safari (browser) | ~5 MB per origin | Same as desktop Safari. |
| iOS Safari (installed PWA) | ~5 MB per origin | Same again, but data is treated as more durable. |
| Android Chrome | ~10 MB per origin | Comfortable headroom. |

A user with 199 raw notes and a busy import history can hit the
4.25 MB threshold legitimately. On iOS that's already at the quota
wall.

**Recommended approach: defer IndexedDB migration to a separate
checkpoint, but document the constraint NOW.**

The `StorageAdapter` interface is exactly the right abstraction; an
`indexedDBAdapter` implementation can be swapped in without
touching any call site outside `src/storage/`. IndexedDB quotas are
much larger (tens to hundreds of MB on iOS, usually GB-scale on
desktop). The migration path is:

1. Implement `indexedDBAdapter` against the existing interface.
2. On first run after upgrade, copy state from localStorage to
   IndexedDB.
3. Keep localStorage as a fallback for one release.
4. Relax `STORAGE_HARD_BYTES` to reflect the new ceiling.

This is **post-RC, post-initial-PWA work.** Worth scoping but not
worth blocking on.

**Two further iOS-Safari-specific concerns:**

1. **7-day eviction for unvisited sites.** iOS Safari can evict data
   for sites not visited in 7 days. *Installed* PWAs are treated
   more durably — data persists for installed PWAs unless the
   operator explicitly removes the app. This is a strong reason to
   recommend installation in operator onboarding.
2. **`navigator.storage.persist()`** is the right API to request
   durable storage explicitly. It can be called once on first run;
   if granted, the browser commits to not evicting without
   warning. This call belongs in the SW registration sequence (§ 8).

**Recommended pre-PWA documentation update:** a paragraph in
`docs/MARKDOWN_HANDOFF.md`'s storage-pressure section noting that
iOS Safari users may hit the cap sooner than desktop users, and
that installing the PWA improves durability of stored data.

---

## 14. HTTPS / hosting requirements

PWAs require HTTPS (or `localhost`). The current `vite.config.ts`'s
`base: './'` and the codebase's complete lack of absolute-path
assumptions mean RoundTable can be hosted at any HTTPS endpoint with
no code change.

**Common deployment targets and their fit:**

| Target | HTTPS by default | Fit |
|---|---|---|
| GitHub Pages | Yes | Works directly; subpath deploy requires `start_url`/`scope` to match (currently `./` covers it). |
| Netlify / Vercel / Cloudflare Pages | Yes | Works directly. |
| Self-hosted (nginx/Caddy/etc.) | No (must provision cert) | Works once HTTPS is provisioned (Let's Encrypt, etc.). |
| `file://` (open `index.html` directly) | n/a | **PWA install fails; `SubtleCrypto` already documented as unavailable.** |

**Open question** (also listed in § 19): is the `file://` "open from
USB stick" distribution still in scope? If yes, the PWA path
introduces a second distribution mode, not a replacement. RoundTable
would ship as:

- A PWA at an HTTPS URL (installable, offline-capable, no hashing
  in some edge cases anyway).
- A static-file tarball for `file://` use (no PWA, no hashing, no
  install, but works anywhere).

If `file://` is dropped, the documentation simplifies.

---

## 15. Build / tooling delta

**Minimum additions to `package.json` `devDependencies`:**

| Package | Approximate version | Purpose |
|---|---|---|
| `vite-plugin-pwa` | `^0.20.x` (latest 0.x at time of writing) | SW generation, manifest emission, asset precaching |
| `workbox-window` | `^7.x` (optional but recommended) | Convenience wrapper for SW registration and update-available events |

**`vite.config.ts` gains a `VitePWA(...)` plugin invocation** with:

- `registerType: 'prompt'` (per § 8's update strategy).
- `includeAssets: [...]` listing the icons and favicon.
- `manifest: { ... }` matching § 5's required fields.
- `workbox.globPatterns: ['**/*.{js,css,html,png,svg,woff2}']`.
- **No `workbox.runtimeCaching`** entry — the application makes no
  runtime network requests; the only caching needed is precache.

**No other dependencies are required.** Specifically not required:

- No state-management library (Redux, Zustand, etc.) — React state
  + the existing storage adapter remain sufficient.
- No router (the tab nav is custom; no URL-driven routing).
- No date library, no UI library — the existing CSS covers it.
- No testing harness for the SW — the acceptance walk's pure-utility
  tests don't exercise the SW; manual installability verification
  via Chrome DevTools Lighthouse is sufficient.

**Bundle size impact:** `vite-plugin-pwa` is a build-time tool; it
adds zero bytes to the runtime bundle. The generated SW itself is
~10–15 KB (Workbox runtime). Total runtime impact: well under 20 KB
gzipped, well outside the critical path.

---

## 16. PWA-specific risks interacting with v0.11.0

These are interactions worth surfacing before implementation begins.

**Update flow vs. schema migration.** The SW activates a new bundle
with a potentially-newer schema version. The migration engine
(`migrate_0_10_5_to_0_11_0` and predecessors) handles forward
migrations on load. The risk is that an operator mid-import in the
old version has transient `useMarkdownUpload` preview state that's
not persisted; an auto-reload destroys it. **Mitigation:** § 8's
`prompt` update strategy gives the operator the choice. Mid-import,
they postpone; between rounds, they accept.

**Storage pressure thresholds vs. iOS quota.** Already covered in §
13. The remaining risk is operator-perceived — "I haven't filled it
up yet, why am I getting QuotaExceededError?" The current
`StoragePressureBanner.error` level handles the case after the
fact, but the message text predates the PWA context. **Mitigation:**
clarifying line about "this device's browser may limit RoundTable
to less than the projected limit" added to the banner message.

**Hashing under installed PWA.** `SubtleCrypto` requires secure
context. Installed PWAs from HTTPS origins satisfy this; installed
PWAs from `localhost` also satisfy this. **No risk** — but the
acceptance walk should be re-run against the deployed PWA build to
confirm the hashing branch is actually exercised, not just the dev
server. This is one new line in the operator's manual verification
checklist (§ 14 of `docs/RELEASE_CHECKLIST.md`).

**`window.confirm` blocking SW activation.** Already covered in §
10. **Mitigation:** ship the modal-replacement checkpoint before or
with the SW checkpoint. This is the single strongest reason to
sequence Checkpoint J first.

**Demo data reset in installed PWA.** `App.tsx:117` "Reset to demo
data" is behind a `window.confirm`. In an installed PWA without the
browser URL bar, operators are likelier to hit this accidentally
(no URL bar means fewer visual cues that they're "in the
app"). **Mitigation:** the inline two-step gate pattern from the
Raw Notes Delete button (Checkpoint I) is the right shape. Apply
the same pattern here.

**Service worker first-load cost.** On the very first visit, the
SW downloads and precaches the full app shell. This is a one-time
cost (sub-second on a typical connection), but on a slow link it
can briefly extend the time-to-interactive. **Mitigation:** SW
installation runs *after* the page is interactive (deferred to the
`load` event per § 8), so the first-visit UX is unaffected; only
subsequent visits benefit from the cache.

**localStorage durability vs. SW caching.** The SW caches code;
localStorage holds data. These are independent. Clearing site data
in browser settings clears both. **No new risk** — just worth
documenting in the operator guide that "Clear site data" is
destructive of operator work.

---

## 17. Recommended checkpoint sequence

The PWA conversion decomposes into the following checkpoints. Each
is independently shippable; none is blocked on undelivered RC work.

| Checkpoint | Scope | Weight | Sequencing notes |
|---|---|---|---|
| **J — Modal system replacement** ✓ **DELIVERED v0.12.0** | Promise-returning `ConfirmModal` + `PromptModal`; replace all 6 `window.confirm` / `alert` / `prompt` call sites; theme-styled; focus-trapped; inline two-step gate for demo reset | Medium — 4 components touched, mechanical | **Shipped.** Quality win independent of PWA work; removes SW-blocking risk; closed Known Limitation #6 from `docs/MARKDOWN_HANDOFF.md`. See `CHECKPOINT_STATE_J.md`. |
| **K — Manifest + icons + HTML head** ✓ **DELIVERED v0.12.0** | `public/manifest.webmanifest` (emitted via vite-plugin-pwa); six PNG icons (favicon, apple-touch-icon, 192/512 + maskable); `index.html` head additions per § 9; fixed description typo | Small — config and assets | **Shipped together with L and M.** See `CHECKPOINT_STATE_K.md`. |
| **L — Service worker + registration + update banner** ✓ **DELIVERED v0.12.0** | `vite-plugin-pwa` integration; `vite.config.ts` `VitePWA(...)` plugin block; `src/components/PwaUpdateBanner.tsx` (registration via `useRegisterSW` + Reload-to-update banner); opportunistic `navigator.storage.persist()` | Medium — mostly config + one banner component | **Shipped together with K and M.** App is now installable + offline-capable. |
| **M — Mobile UX hardening** ✓ **DELIVERED v0.12.0** | `viewport-fit=cover`; safe-area insets; touch-target floor to 44px on primary buttons; `overscroll-behavior: contain`; `-webkit-tap-highlight-color: transparent`; tab-nav `user-select: none` | Small-to-medium — CSS-only | **Shipped together with K and L.** Appended to `src/styles/app.css`. |
| **N — PWA-aware documentation** | New `docs/PWA.md` operator guide (how to install, what changes); updates to `docs/MARKDOWN_HANDOFF.md` (iOS Share Sheet note, iOS storage note); updates to `docs/RELEASE_CHECKLIST.md` (PWA installability verification) | Small — docs only | Ships after K and L; consumes their results |
| **O — (Optional) IndexedDB storage adapter** | Implement `indexedDBAdapter` against existing `StorageAdapter` interface; one-time localStorage → IndexedDB migration; relax `STORAGE_HARD_BYTES`; update storage pressure messaging | Large — new adapter, migration, tests | **Post-RC.** Defer unless iOS quota is shown to be a real operator-side blocker |

**Suggested order: J → K + M (parallel) → L → N.** O is a separate
decision tied to operational evidence.

**Critical-path summary:** J unblocks SW activation safety. K + L
deliver installability + offline. M makes the installed app feel
right. N closes documentation. O is an enhancement.

---

## 18. Explicit non-goals

To prevent the PWA work from drifting into scope creep, these are
deliberately excluded from any PWA checkpoint:

- **No background sync.** RoundTable has nothing to sync (no
  backend). Phase 0 boundary holds.
- **No push notifications.** No backend to deliver them; no use
  case.
- **No `share_target` in the manifest.** Receiving shared content
  from other apps invites scope creep — what does "share to
  RoundTable" even mean for a multi-round workflow? Defer to
  v0.11.2+ if operators request it.
- **No `protocol_handlers`.** Same reason. Custom URL schemes are
  out of scope.
- **No `file_handlers`** in the initial PWA work. Registering
  RoundTable as the system handler for `.md` files is interesting
  for v0.11.1+ but invites confusion in v0.11.0 ("why did my
  Markdown editor open in RoundTable?").
- **No periodic background sync, no background fetch.** No use
  case.
- **No File System Access API.** Not supported in iOS Safari; the
  current `<input type="file">` + `<a download>` pattern works
  everywhere; sticking with it preserves portability.
- **No Web Push, no Payment Handlers, no Badging.** Out of scope.
- **No installable PWA prompt UI.** The browser-provided install
  affordance is sufficient; building a custom "Install RoundTable"
  banner is a v2 enhancement.
- **No PWA shortcuts** (the `shortcuts` manifest field for static
  deep links). Defer.
- **No screenshots** in the manifest. Used only in some install
  dialogs; not load-bearing.

The PWA work should make RoundTable **installable and
offline-capable**. Nothing more.

---

## 19. Open questions before implementation

These should be resolved before Checkpoint J starts. Each has a
recommended default but operator/owner judgment is the source of
truth.

1. **Deployment target.** GitHub Pages? Netlify? Vercel?
   Self-hosted? Determines whether `start_url` / `scope` need
   non-default values. **Default recommendation:** any HTTPS host at
   path `./`; current `base: './'` covers any subpath. Confirm
   before icons are sized for splash purposes.

2. **Icon source.** Does a RoundTable brand mark exist, or does the
   icon set need to be designed from scratch? If the latter, that's
   an asset-creation dependency that gates Checkpoint K. **Default
   recommendation:** start with a monogram (`RT` amber on near-black)
   for v1; commission a designed mark for v1.1 if needed.

3. **iOS quota tolerance.** Is the 4.25 MB hard threshold acceptable
   on iOS for the initial PWA release, or is Checkpoint O
   (IndexedDB) blocking? **Default recommendation:** not RC-blocking;
   operators can prune Raw Notes and Import History; ship the
   IndexedDB upgrade as v0.11.x or v0.12 enhancement.

4. **Update strategy.** `prompt` (operator chooses reload time) vs.
   `autoUpdate` (silent reload on next page load)? **Default
   recommendation:** `prompt` — preserves mid-round operator agency,
   matches local-first ethos.

5. **`file://` distribution.** Is the "double-click `index.html` from
   a USB stick" use case still in scope after PWA conversion?
   **Default recommendation:** drop `file://` and ship PWA-only.
   Hashing is already broken on `file://`; PWA install is broken on
   `file://`; the use case is increasingly niche. Confirm with the
   operator.

6. **Theme color.** `#0d0f11` matches the current `--bg-base`. Worth
   confirming this is the intended OS UI accent rather than the
   amber accent color (`var(--amber)`). **Default recommendation:**
   stick with `#0d0f11` so the status bar matches the app header
   visually.

7. **Icon design constraints.** Maskable variants need to keep
   meaningful content within the inner 80% safe zone. The current
   industrial-terminal monospace aesthetic implies a typographic
   mark works well. Confirm the visual direction (monogram vs.
   ligature vs. abstract shape) before raster export.

8. **Splash screen scope.** iOS standalone splash screens need
   per-device-resolution PNG files for best results (multiple sizes
   per `apple-touch-startup-image` link). Worth shipping the
   auto-generated fallback (`background_color` from manifest) in v1
   and adding device-specific splashes in v1.1? **Default
   recommendation:** yes — manifest `background_color` is
   sufficient for v1.

9. **Update-available banner UX.** Banner with "Reload to update" /
   "Later"? Or a quieter affordance? **Default recommendation:**
   match the existing `StoragePressureBanner` visual treatment for
   consistency.

10. **Acceptance walk extensions.** Should the v0.11.0 acceptance
    walk in `scripts/acceptance-walk.ts` be extended with a 16th
    criterion ("PWA installability") or kept clean and a new
    `scripts/pwa-walk.ts` shipped alongside? **Default
    recommendation:** new file. The PWA criteria are orthogonal to
    the v0.11.0 Markdown handoff criteria; mixing them muddies both.

---

## 20. Bottom-line recommendation

**RoundTable v0.11.0 RC should ship as-is. The PWA conversion is a
v0.11.x or v0.12 enhancement, sequenced as Checkpoints J → M (parallel
with K) → K → L → N.**

The conversion work is real but unusually constrained because the
v0.10.x and v0.11.0 architecture decisions already satisfy most PWA
prerequisites. The delivery is:

- One UX checkpoint (J) that's a quality win regardless of PWA — the
  modal replacement closes a documented limitation from v0.11.0 and
  removes an SW-blocking risk.
- One asset + config checkpoint (K) — manifest + icons + HTML head
  additions. Largely mechanical once icon assets exist.
- One infrastructure checkpoint (L) — service worker + registration +
  update banner. Driven by `vite-plugin-pwa`; the only net-new code
  is the update banner.
- One CSS polish checkpoint (M) — touch targets, safe-area, viewport
  fit. Parallelizable with anything.
- One documentation checkpoint (N) — `docs/PWA.md` operator guide.

No architectural refactoring. No breaking schema work. No
compromise to Phase 0 boundaries (no backend, no API, no automation,
no sync). The application code remains network-free; the SW
intercepts the browser's own asset fetches, which is the entire
point of a PWA.

**Open questions in § 19 should be answered before Checkpoint J
begins.** The two most consequential are (a) deployment target and
(b) whether `file://` distribution stays in scope. Everything else
has a defensible default.

---

## Document status

- **Created:** v0.11.0 RC (post-Checkpoint I).
- **Status:** PLANNING / READINESS — not delivered work.
- **Author of plan:** drafted during PWA readiness assessment;
  awaits operator review.
- **Implementation status:** **none.** No PWA code, configuration,
  assets, or dependencies have been added. The repository remains
  the v0.11.0 RC produced at Checkpoint I.
- **Next action:** resolve the open questions in § 19, then begin
  Checkpoint J (modal-system replacement).
