# Cloudflare Pages Deployment Guide

RoundTable is now packaged for Cloudflare Pages because the portfolio domain, `ericharrisportfolio.com`, already lives on Cloudflare.

The current public live demo remains:

```text
https://rtrc.netlify.app/
```

Keep the GitHub repo Website field and README live demo link pointed at that Netlify URL until a Cloudflare deployment is intentionally promoted to be the current live demo.

The deployment should remain boring: Cloudflare hosts the static app shell; RoundTable continues to store operator data in the browser only. Do not add Functions, Workers, analytics beacons, model APIs, databases, or server-side state for the public demo.

## Recommended path: Cloudflare Pages Git integration

Use this when the repo is already on GitHub and you want every push to `main` to redeploy the demo.

1. Push this repo to GitHub.
2. In Cloudflare, open **Workers & Pages**.
3. Choose **Create application** → **Pages** → **Connect to Git**.
4. Select the `roundtable` GitHub repository.
5. Use these build settings:

```text
Project name: roundtable
Production branch: main
Framework preset: React (Vite) or None
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 20 or 22
Environment variables: none required
Functions directory: none
```

Cloudflare Pages can connect directly to GitHub and automatically deploy when you push a branch. The React/Vite preset uses `npm run build` and `dist`, which matches RoundTable.

## Alternative path: Wrangler Direct Upload

Use this if you want to deploy the working demo before wiring the GitHub integration.

```bash
npm ci
npm run verify
npm run build
npx wrangler login
npx wrangler pages project create roundtable
npx wrangler pages deploy dist --project-name roundtable
```

Direct Upload deploys prebuilt assets from `dist/`. Cloudflare supports Wrangler deployment of a folder of assets. Use Git integration for the long-term portfolio repo; Direct Upload is useful for a fast first live smoke test.

## Custom domain placement

Optional future public demo URL:

```text
https://roundtable.ericharrisportfolio.com
```

This keeps the portfolio home page clean while giving RoundTable a direct app URL. After the Pages project deploys successfully, add the custom domain in the Cloudflare Pages project settings.

If this URL is later promoted as the current live demo, then update:

- GitHub repo **Website** field
- README `Live app` line
- `ericharrisportfolio.com` RoundTable card/button

## Files that matter

| File | Purpose |
|---|---|
| `wrangler.toml` | Declares the Cloudflare Pages project name and `dist` output directory. |
| `public/_headers` | Copied to `dist/_headers`; gives Cloudflare Pages cache rules for hashed assets, service worker, manifest, and app shell. |
| `.github/workflows/ci.yml` | Verifies build, acceptance walk, and audit before deployment confidence. |
| `docs/PWA.md` | Explains installability, offline shell behavior, and update-banner behavior. |

No `_redirects` file is included. Cloudflare Pages has SPA behavior for projects without a top-level `404.html`, and RoundTable currently does not need client-side route rewrite rules.

## Live smoke test

After deployment, verify:

- HTTPS URL loads the RoundTable app.
- Browser dev tools show no app-owned network calls beyond static asset/service-worker loading.
- Install prompt appears in Chrome/Edge desktop or Android Chrome.
- iOS Safari can add the app to the home screen.
- `npm run verify` still passes locally.
- Export JSON works.
- Export Markdown works.
- Import preview works.
- Offline reload works after the first successful online load.
- A new deploy surfaces the in-app update banner instead of silently reloading mid-session.

## Guardrail

Do not treat Cloudflare as application infrastructure for RoundTable yet. For this portfolio demo, Cloudflare is the static host only. The product story is stronger because the app has a crisp trust boundary: local browser state, manual model interfaces, explicit export/import, no hidden backend.
