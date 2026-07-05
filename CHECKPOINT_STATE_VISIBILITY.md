# RoundTable v0.12.0 — Consolidated Visibility Package — Checkpoint State

**Status:** Documentation/provenance packaging checkpoint. Zero application code changes. App version remains `0.12.0`; storage schema remains `0.11.0` (no `AppState` shape change — per schema-versioning discipline, no bump).

**Date:** July 5, 2026

This document describes the exact state of the repository at the moment this package was produced. Read it before resuming.

## Purpose

Consolidate four independently assembled visibility bundles into this single GitHub-ready repository, in chronological order, so the phase-gating and implementation chain that produced v0.12.0 is visible and auditable alongside the working application.

## Source bundles consumed (integrity verified at consolidation)

| Bundle | Verification |
|---|---|
| `roundtable-github-portfolio-v0_12_0.zip` | SHA-256 matched sidecar checksum file (`ff4b8439…837c`) — used as repository base, unmodified source tree |
| `roundtable_visibility_reconstruction.zip` | Internal `MANIFEST.sha256`: 29/29 files OK; manifest self-hash OK → `provenance/01-mrc-origins/` |
| `roundtable_project_visibility_artifact_chain.zip` | Internal `CHECKSUMS_SHA256.txt`: 16/16 artifacts OK → `provenance/02-checkpoint-chain-v011-v012/` |
| `storytime_phase7c_visibility_bundle.zip` | Internal `MANIFEST.md` hashes: 10/10 files OK → `provenance/03-field-usage-storytime/` |

Source bundles were copied intact — no historical file was edited, renamed, or removed. Era folders retain their original internal structure, READMEs, and manifests.

## Files created

| Path | Purpose |
|---|---|
| `provenance/README.md` | Master chronology: three-era merged timeline, phase-gating model, manual-gates→CI narrative, cross-references (incl. the v0.10.5 missing-artifact resolution), reviewer audit guide, current status |
| `provenance/DEVELOPMENT_PRACTICES.md` | Supplement distilled from development-session records: multi-model pipeline roles, session-continuity discipline, engineering invariants, scope control, open items |
| `provenance/MANIFEST.sha256` | Regenerated SHA-256 manifest over the entire consolidated `provenance/` tree |
| `provenance/01-mrc-origins/**` | Era 1 bundle (copied intact) |
| `provenance/02-checkpoint-chain-v011-v012/**` | Era 2 bundle (copied intact) |
| `provenance/03-field-usage-storytime/**` | Era 3 bundle (copied intact) |
| `INSTALL.md` | End-user PWA install guide (Chrome/Edge desktop, Android, iOS Safari) + developer setup + self-hosting + troubleshooting |
| `CHECKPOINT_STATE_VISIBILITY.md` | This file |

## Files modified

| Path | Change |
|---|---|
| `README.md` | Added header links (install / provenance / live-app placeholder / portfolio home); added "Development Provenance" section; extended Documentation Map. No removals. |
| `docs/PROVENANCE.md` | Added pointer blockquote to `provenance/README.md`. Existing content untouched. |
| `package-lock.json` | **Portability fix:** 19 `resolved` URLs pointed at an internal package mirror (non-public host), which breaks `npm ci` outside the original packaging environment and leaks an internal hostname. Rewrote only the registry host on those 19 entries to `https://registry.npmjs.org`. Every package version and sha512 `integrity` hash is byte-identical to the verified Checkpoint K tree — the dependency graph is unchanged. Post-fix `npm ci` installs 357 packages cleanly. |

## Files NOT modified

All of `src/`, `public/`, `scripts/`, `index.html`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `netlify.toml`, `.github/workflows/ci.yml`, `LICENSE`, `SECURITY.md`, `CHANGELOG.md`, all prior `CHECKPOINT_STATE*.md`, and all pre-existing `docs/*` except the one-blockquote addition noted above.

## Verification performed (this packaging pass)

```text
npx tsc --noEmit                 → clean
npm run build                    → clean (bundle hash unchanged vs. checkpoint K base — no code touched)
npm run acceptance:walk          → 15 pass, 0 partial, 0 fail
network grep over src/           → no app-owned network surfaces
provenance manifest verification → all era checksums re-verified post-copy
ZIP e2e: extract → npm ci → tsc → build → walk → all clean
```

## Deliverable

`roundtable-v0.12.0-consolidated-visibility-package.zip` (SHA-256 in accompanying sidecar file).

## Known open items (unchanged by this checkpoint)

1. Hosted Netlify PWA validation — pending; `README.md` carries a "Live app: URL pending" placeholder to be replaced after validation.
2. Checkpoint N (PWA-aware documentation pass) — remaining per `docs/PWA_READINESS.md`.
3. Checkpoint O (IndexedDB adapter) — optional, evidence-triggered only.

## Resume instructions

To publish: follow `docs/GITHUB_PORTFOLIO_PUBLISHING.md`, push this tree as the repository root, confirm CI goes green on the first push, deploy to Netlify per `docs/PWA.md`, then replace the README "Live app" placeholder with the real URL and link the repo + live app from ericharrisportfolio.com.
