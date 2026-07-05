# Checkpoint State — Cloudflare Visibility Package

Date: 2026-07-05
Package: `roundtable-v0.12.0-cloudflare-visibility-package.zip`

## Purpose

Retarget the public RoundTable portfolio package from Netlify-oriented deployment to Cloudflare Pages, matching the existing `ericharrisportfolio.com` hosting environment.

## Source

Base package:

```text
roundtable-v0.12.0-consolidated-visibility-package.zip
SHA-256: 1354b0f2c2a1339e516a1b88e806dcbbfc66f063d5f5ccaf10fb3aed26ecc20b
```

## Changes

- Added `wrangler.toml` for Cloudflare Pages.
- Added `public/_headers`; Vite copies it to `dist/_headers` during build.
- Added `docs/CLOUDFLARE_DEPLOYMENT.md`.
- Updated `README.md`, `INSTALL.md`, `docs/PWA.md`, `docs/GITHUB_PORTFOLIO_PUBLISHING.md`, `docs/PORTFOLIO_BRIEF.md`, `docs/PROVENANCE.md`, and `CHANGELOG.md` to make Cloudflare Pages the current intended target.
- Preserved the former Netlify root config as `netlify.toml.legacy`.
- Added `npm run deploy:cloudflare` and `npm run preview:cloudflare`.

## Intended Cloudflare Pages settings

```text
Framework preset: React (Vite) or None
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 20 or 22
Environment variables: none required
```

Recommended live demo URL:

```text
https://roundtable.ericharrisportfolio.com
```

## Boundary

Cloudflare Pages is the static host only. RoundTable remains local-first: no backend, no model APIs, no analytics beacon, no external runtime service, no database, no sync.
