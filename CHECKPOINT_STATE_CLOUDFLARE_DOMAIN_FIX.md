# Checkpoint State — Cloudflare Domain Correction

## Date
2026-07-05

## Purpose
Correct the Cloudflare portfolio deployment target to `ericharrisportfolio.com` after a plural-domain typo was identified.

## Source of Truth
The package remains based on `roundtable-v0.12.0-cloudflare-visibility-package.zip`; this checkpoint only corrects public-facing domain references and regenerates source and direct-upload distribution ZIPs.

## Correct Portfolio Domain
- Portfolio home: `https://ericharrisportfolio.com`
- Recommended RoundTable demo URL: `https://roundtable.ericharrisportfolio.com`

## Verification
- `npm ci` passed
- `npm run build` passed
- `npm run acceptance:walk` passed, 15/15
- `npm audit --audit-level=high` passed, 0 vulnerabilities
- No remaining plural-domain typo references in the packaged source tree
