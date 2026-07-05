# Repository Provenance

This public portfolio package was reconstructed from the surviving RoundTable checkpoint artifacts supplied on July 5, 2026.

> **Full development record:** this document covers the packaging of the current source tree only. The complete chronological artifact chain — from the project's MRC origins through every v0.11.0/v0.12.0 checkpoint and into field usage — lives in [`../provenance/README.md`](../provenance/README.md), consolidated July 5, 2026 with all source-bundle checksums re-verified.

## Selected source of truth

The latest complete source bundle was selected as the base:

```text
roundtable-v0.12.0-checkpoint-K-pwa-implementation-bundle.zip
```

Reason: checkpoint K contains the v0.12.0 PWA implementation bundle, Netlify config, public icons, v0.11.0 handoff docs, and the checkpoint J modal system changes.

## Source artifacts inspected

| Artifact | SHA-256 |
|---|---|
| `roundtable-v0.11.0-checkpoint-D-upload-preview-rawnotes.zip` | `f1b98af7b7697fbbfeca9964c7b30b089c9226d97dd5d30263fd62f473a81b34` |
| `roundtable-v0.11.0-checkpoint-E-mediator-synthesis-import.zip` | `a434b4c339aaf381725322185b356e67efa2b38503a6df274d873c1477cf9af4` |
| `roundtable-v0.11.0-checkpoint-F-import-correctness.zip` | `59628413055d1fc8ca06465bfe736372279ced28e20b69b87511bc1eb5814f86` |
| `roundtable-v0.11.0-checkpoint-G-model-response-import.zip` | `56e0a8d1eeef1c19f67f3d5dc3af24712ea2ab0d429334c3aad5a710fa740f17` |
| `roundtable-v0.11.0-checkpoint-H-remaining-structured-imports.zip` | `a9632134a3660e92f376336c583434a9afb12e328d28f2a8c8bd5baf0a4bc439` |
| `roundtable-v0.11.0-checkpoint-I-rc-hardening-docs.zip` | `9da0ad2c548631f6dd958eb3f118f8fd5b0b47c765009d179520361ba8698ffe` |
| `roundtable-v0.11.0-pwa-readiness-doc.zip` | `1c3d35db4cd297958165eb8811be6bd2dd346a1b7f994feed496be699d66e4f9` |
| `roundtable-v0.12.0-checkpoint-J-modal-system.zip` | `dc93f1258107e82e2cfac2712dd31ebb45711c7f790f99cb0759c66205b2f3bc` |
| `roundtable-v0.12.0-checkpoint-K-pwa-implementation-bundle.zip` | `852ed9c002a84ce9f4cd27a0fc334ca9b704fb68310f8b9e32348f8ba3cf55b1` |


## Cloudflare deployment pivot

After the consolidated visibility package was created, the public deployment target was changed from Netlify to Cloudflare Pages because `ericharrisportfolio.com` is already hosted on Cloudflare. The historical checkpoint K references to Netlify remain preserved in `provenance/` because they describe what happened during development. The current repo root is Cloudflare-first and includes `wrangler.toml`, `public/_headers`, and [`CLOUDFLARE_DEPLOYMENT.md`](CLOUDFLARE_DEPLOYMENT.md).

## Portfolio packaging changes

The GitHub-ready package adds or refreshes:

- public-facing `README.md`
- `.gitignore`
- `LICENSE`
- `SECURITY.md`
- `CHANGELOG.md`
- `.github/workflows/ci.yml`
- `docs/PORTFOLIO_BRIEF.md`
- `docs/GITHUB_PORTFOLIO_PUBLISHING.md`
- `docs/PROVENANCE.md`
- `package.json` scripts for `acceptance:walk` and `verify`
- dependency lock refresh to clear npm audit advisories

## Verification performed during packaging

```text
npm ci
npm run build
npm run acceptance:walk
npm audit
```

Observed results:

```text
production build: pass
acceptance walk: 15 pass, 0 partial, 0 fail
npm audit: 0 vulnerabilities
```
