# Installing RoundTable

RoundTable is a local-first Progressive Web App (PWA). There are two ways to use it: **install it as an app** from a hosted URL, or **run it from source**. Either way, all of your data stays in your own browser's storage — there is no account, no server, and no sync.

Current live demo: https://rtrc.netlify.app/

> Operator-level PWA details (service worker behavior, update flow, deployment) live in [`docs/PWA.md`](docs/PWA.md). This file is the quick path.

---

## Option 1 — Install as an app (recommended for users)

You need the app's hosted URL (an HTTPS deployment of this repo — see "Hosting it yourself" below if one isn't published yet).

### Desktop — Chrome or Edge

1. Open the app URL.
2. Click the **install icon** in the address bar (a monitor with a down-arrow in Chrome; "App available" in Edge), or open the browser menu → **Cast, save and share → Install page as app…** (Chrome) / **Apps → Install this site as an app** (Edge).
3. Confirm. RoundTable opens in its own window and appears in your launcher/Start menu/dock.

### Android — Chrome

1. Open the app URL.
2. Tap the **⋮ menu → Add to Home screen → Install**.
3. Launch from the home-screen icon; it runs standalone (no browser chrome).

### iPhone / iPad — Safari

1. Open the app URL **in Safari** (installation from third-party iOS browsers is not supported by iOS).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch from the home-screen icon.

> **iOS storage caution:** iOS can evict browser storage for sites/apps you haven't opened in a while. RoundTable asks the browser for persistent storage where supported, but on iOS the durable habit is simple: **export a JSON backup** (Export panel) after significant work sessions.

### Firefox / other browsers

The app works fully in the browser tab; Firefox desktop does not offer PWA installation. Use it as a normal site, or install via Chrome/Edge/Safari.

### After installing

- **Offline:** the app shell loads with no network. Your data was always local, so the workflow keeps working offline.
- **Updates:** when a new version is deployed, RoundTable shows an in-app **update banner** — updates apply only when you accept them, never mid-session.
- **Your data:** lives in your browser's localStorage under the key `roundtable.appState.v1`, scoped to the exact origin (URL) you installed from. Moving between hosts means exporting JSON from one and importing into the other.
- **Backups:** Export → JSON produces a complete, re-importable snapshot. Markdown handoff exports are for workflow artifacts, not full-state backup.
- **Uninstalling** removes the icon; site data can persist until you clear it in browser settings. Export first if you care about the state.

---

## Option 2 — Run from source (developers)

Prerequisites: **Node.js ≥ 20** (Node 22 is what CI uses; an `.nvmrc` is included) and npm.

```bash
git clone <this-repo>
cd roundtable
npm ci
npm run dev        # Vite dev server — open the printed localhost URL
```

Production build and local PWA preview:

```bash
npm run build      # tsc + vite build → dist/
npm run preview    # serves dist/ locally; service worker active on localhost
```

Full verification (what CI runs on every push):

```bash
npm run verify     # build + 15-criterion acceptance walk + npm audit (high)
```

Note: the dev server intentionally does not register the service worker; PWA behavior (install prompt, offline shell, update banner) is exercised via `npm run preview` or a real HTTPS deployment.

## Hosting it yourself

Any static host with HTTPS works. This package is configured for Cloudflare Pages:

```text
Build command:           npm run build
Build output directory:  dist
Root directory:          /
```

For a local/direct upload path, run:

```bash
npm run build
npx wrangler pages deploy dist --project-name roundtable
```

Deploy, open the site over HTTPS, and the install flows above become available. Hosting serves only the static app shell — user data never leaves the user's browser. Full deployment guidance is in [`docs/CLOUDFLARE_DEPLOYMENT.md`](docs/CLOUDFLARE_DEPLOYMENT.md), with PWA behavior details in [`docs/PWA.md`](docs/PWA.md).

## Troubleshooting

- **No install option appears:** confirm you're on HTTPS (or `localhost`), and in a supporting browser (Chrome/Edge/Safari-iOS). `file://` is not a supported PWA target.
- **Stuck on an old version:** the update banner applies updates on acceptance; if a banner never appears after a redeploy, a hard reload (Ctrl/Cmd+Shift+R) re-checks the service worker.
- **State seems missing:** check you're on the same origin you used before (protocol + domain + port all count), and check the Recovery panel before assuming loss.
