# RoundTable / Podcast Pipeline Artifact Chain

This package recreates the artifact chain from the chat in chronological order so the project history is visible and auditable. Each numbered folder contains the original artifact plus a README explaining its role, contents, verification status, and the next artifact in the chain.

## Current reconstruction boundary

The chain begins with the Podcast Pipeline mediator packet and RoundTable v0.10.5 baseline, then follows the v0.11.0 Markdown Handoff build through RC readiness and the v0.12.0 PWA implementation bundle. The active latest artifact in this reconstructed chain is `15-checkpoint-k-pwa-implementation/roundtable-v0.12.0-checkpoint-K-pwa-implementation-bundle.zip`.

## Chronology

| # | Artifact | Version / checkpoint | Purpose | Verification |
|---:|---|---|---|---|
| 00 | [Podcast Pipeline mediator packet / architecture baseline context](./00-podcast-pipeline-phase1-mediator-packet/README.md) | Podcast Pipeline Planning | Preserves the Podcast Pipeline planning context that caused RoundTable to become necessary. It captures Phase 0/Phase 1 decisions and the Phase 2 scaffold direction. | Text artifact; not a buildable app artifact. |
| 01 | [RoundTable v0.10.5 baseline](./01-roundtable-v105-baseline/README.md) | v0.10.5 | Baseline RoundTable app before Markdown Handoff Mode. This is the pre-v0.11.0 state used as the implementation starting point. | Baseline source artifact; later checkpoints were built from this lineage. |
| 02 | [v0.11.0 Markdown Handoff feasibility / phase plan](./02-v011-markdown-handoff-feasibility/README.md) | v0.11.0 plan | Controls the v0.11.0 feature release. Reframes RoundTable as the authoritative local state manager and Markdown files as durable handoff artifacts. | Planning document; used as controlling implementation plan throughout checkpoints A-I. |
| 03 | [Checkpoint A — v0.11.0 foundation layer](./03-v110-checkpoint-a-foundation/README.md) | v0.11.0 Checkpoint A | Foundation implementation for Markdown Handoff Mode. Adds types, config, hashing/normalization/parsing utilities, migration/validation, artifact import foundations, and storage pressure utilities. | Build/typecheck verified clean during this chat; used as base for Checkpoint B. |
| 04 | [Checkpoint B — UI shell integration](./04-checkpoint-b-ui-shell/README.md) | v0.11.0 Checkpoint B | Adds UI panels and tab routing for Raw Notes, Import History, and Import Preview without wiring import/export behavior yet. | Independently verified in chat: npm install, tsc, production build clean. |
| 05 | [Checkpoint C — Download .md export controls](./05-checkpoint-c-download-export/README.md) | v0.11.0 Checkpoint C | Adds one-way Markdown artifact export controls across prompt/response/mediator surfaces. | Independently verified in chat: typecheck/build clean. |
| 06 | [Checkpoint C.5 — provenance capture + storage pressure surfacing](./06-checkpoint-c5-provenance-storage/README.md) | v0.11.0 Checkpoint C.5 | Closes export-provenance and storage-warning gaps before upload/import work begins. | Independently verified in chat: typecheck/build clean. |
| 07 | [Checkpoint D — Upload .md preview + Raw Notes fallback](./07-checkpoint-d-upload-preview-rawnotes/README.md) | v0.11.0 Checkpoint D | Adds safe inbound Markdown handling without structured state mutation. Uploaded Markdown can be previewed and preserved as Raw Notes. | Independently verified in chat: typecheck/build clean. |
| 08 | [Checkpoint E — mediator_synthesis structured import](./08-checkpoint-e-mediator-synthesis-import/README.md) | v0.11.0 Checkpoint E | First structured import commit path. Valid mediator_synthesis Markdown can populate structured mediator synthesis fields and rollback safely. | Independently verified in chat: typecheck/build clean. |
| 09 | [Checkpoint F — import correctness hardening](./09-checkpoint-f-import-correctness/README.md) | v0.11.0 Checkpoint F | Fixes two importer correctness false positives before expanding structured import types. | Independently verified in chat: typecheck/build clean. |
| 10 | [Checkpoint G — model_response structured import + per-slot upload](./10-checkpoint-g-model-response-import/README.md) | v0.11.0 Checkpoint G | Adds structured import for model_response artifacts and per-slot Upload .md controls in Responses. | Independently verified in chat: typecheck/build clean. |
| 11 | [Checkpoint H — remaining structured imports + truncation warning fix](./11-checkpoint-h-remaining-structured-imports/README.md) | v0.11.0 Checkpoint H | Completes the remaining core structured import source kinds and fixes the POTENTIALLY_TRUNCATED false positive. | Independently verified in chat: typecheck/build clean. |
| 12 | [Checkpoint I — v0.11.0 RC hardening + docs + acceptance walk](./12-checkpoint-i-rc-hardening-docs/README.md) | v0.11.0 Checkpoint I / RC | Converts v0.11.0 from feature-complete to release-candidate ready with docs, checklist, acceptance walk, and a small Raw Notes delete UI. | Independently verified in chat: typecheck/build clean; acceptance walk 15 pass, 0 partial, 0 fail; no app-owned network surfaces. |
| 13 | [PWA readiness assessment document](./13-pwa-readiness-doc/README.md) | v0.11.0 planning after RC | Adds docs/PWA_READINESS.md as a planning-only assessment for the v0.12 PWA track. | Independently verified in chat: typecheck/build clean; document exists and is planning-only. |
| 14 | [Checkpoint J — modal system replacement](./14-checkpoint-j-modal-system/README.md) | v0.12.0 Checkpoint J | First v0.12 prep checkpoint. Replaces browser-native confirm/alert/prompt with RoundTable-styled modal APIs. | Independently verified in chat: typecheck/build clean; acceptance walk 15/15; no runtime native dialog calls remain. |
| 15 | [Checkpoint K — PWA implementation bundle](./15-checkpoint-k-pwa-implementation/README.md) | v0.12.0 Checkpoint K | Adds installable/offline-capable PWA shell for static HTTPS hosting, with Netlify as first deployment target. | Independently verified in chat: typecheck/build clean; acceptance walk 15/15; dist emits manifest, sw.js, workbox runtime, icons; no app-owned network calls. |

## How to validate a source checkpoint

For any RoundTable source checkpoint ZIP:

```bash
unzip <artifact>.zip -d rt-check
cd rt-check
npm install --no-audit --no-fund
npx tsc --noEmit
npm run build
```

For v0.11.0 RC and later, the acceptance walk may also be available under `scripts/acceptance-walk.ts`.

## Deployment note

For the PWA implementation bundle, build locally and deploy the generated `dist/` folder to Netlify Drop. Do not drag the full source ZIP to Netlify Drop unless you are configuring Netlify to build from source.

## Integrity

See `CHECKSUMS_SHA256.txt` and `artifact_index.json` for size/checksum details.
