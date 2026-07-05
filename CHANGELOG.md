# Changelog

## 0.12.0-cloudflare-domain-correction — Domain spelling correction

- Corrected portfolio-domain references to `ericharrisportfolio.com` after a plural-domain typo was identified.
- Regenerated the Cloudflare source package and direct-upload `dist` package after verification.

## 0.12.0-cloudflare-visibility — Cloudflare Pages portfolio package

- Pivoted the public demo target from Netlify to Cloudflare Pages because `ericharrisportfolio.com` is already hosted on Cloudflare.
- Added `wrangler.toml` for Cloudflare Pages output configuration.
- Added `public/_headers` for Cloudflare Pages cache behavior around hashed assets, service worker, manifest, and app shell.
- Added `docs/CLOUDFLARE_DEPLOYMENT.md` with Git integration, Wrangler Direct Upload, custom-domain, and smoke-test instructions.
- Renamed the old root Netlify config to `netlify.toml.legacy` so historical context is preserved without making Netlify look like the intended target.

## 0.12.0 — PWA implementation bundle

- Added static PWA support with Workbox-generated service worker.
- Added web app manifest and install icons.
- Added operator-prompted update banner.
- Added static deployment configuration; original checkpoint target was Netlify, later pivoted to Cloudflare Pages for the portfolio package.
- Added modal system replacement for destructive confirmations.
- Kept AppState schema at `0.11.0`; no storage migration required.
- Refreshed dependencies to clear npm audit advisories during portfolio packaging.

## 0.11.0 — Markdown handoff mode

- Added Markdown artifact export/import flow.
- Added YAML frontmatter provenance and content hashes.
- Added import preview gates.
- Added malformed-file Raw Notes fallback.
- Added Import History with rollback snapshots.
- Added stale canonical-state and stale prompt warnings.
- Added storage-pressure warning surfaces.
- Added acceptance walk documentation and verification harness.
