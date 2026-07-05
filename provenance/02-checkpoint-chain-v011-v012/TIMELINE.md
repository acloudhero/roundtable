# Artifact Timeline

## 00. Podcast Pipeline mediator packet / architecture baseline context

- File: `PPscaffold.txt`
- Version: Podcast Pipeline Planning
- Purpose: Preserves the Podcast Pipeline planning context that caused RoundTable to become necessary. It captures Phase 0/Phase 1 decisions and the Phase 2 scaffold direction.
- SHA-256: `4e1c74b68dc3e4106df24ce0f085d025e780fc0a7183edbc881be4a3aa65ef58`

## 01. RoundTable v0.10.5 baseline

- File: `rt-v105.zip`
- Version: v0.10.5
- Purpose: Baseline RoundTable app before Markdown Handoff Mode. This is the pre-v0.11.0 state used as the implementation starting point.
- SHA-256: `a8d52bce07d808355632fd2bb3ce456c252cb478e148bf0fb9d01c71fbefc072`

## 02. v0.11.0 Markdown Handoff feasibility / phase plan

- File: `v0.11.0-markdown-handoff-feasibility.md`
- Version: v0.11.0 plan
- Purpose: Controls the v0.11.0 feature release. Reframes RoundTable as the authoritative local state manager and Markdown files as durable handoff artifacts.
- SHA-256: `8e08a58a1cd9f67e52cb86dbeaf2c7e7fb5e3f17daa84138db25fa5f110589b6`

## 03. Checkpoint A — v0.11.0 foundation layer

- File: `rt-v110-checkpoint.zip`
- Version: v0.11.0 Checkpoint A
- Purpose: Foundation implementation for Markdown Handoff Mode. Adds types, config, hashing/normalization/parsing utilities, migration/validation, artifact import foundations, and storage pressure utilities.
- SHA-256: `f2cf7d38f70fe867de49616b5b951e20591779552f8385cee6d695defe1e919d`

## 04. Checkpoint B — UI shell integration

- File: `roundtable-v0.11.0-checkpoint-B-ui-shell.zip`
- Version: v0.11.0 Checkpoint B
- Purpose: Adds UI panels and tab routing for Raw Notes, Import History, and Import Preview without wiring import/export behavior yet.
- SHA-256: `41911e6dab0eb4b986518567fa7e1c1d2124c3fdd561ba005d2ef913920fa0b1`

## 05. Checkpoint C — Download .md export controls

- File: `roundtable-v0.11.0-checkpoint-C-download-export.zip`
- Version: v0.11.0 Checkpoint C
- Purpose: Adds one-way Markdown artifact export controls across prompt/response/mediator surfaces.
- SHA-256: `16f4362020fa1b26de181c3826ede15aa9348509eff8c7fb2744b47bc1a742b3`

## 06. Checkpoint C.5 — provenance capture + storage pressure surfacing

- File: `roundtable-v0.11.0-checkpoint-C5-provenance-storage.zip`
- Version: v0.11.0 Checkpoint C.5
- Purpose: Closes export-provenance and storage-warning gaps before upload/import work begins.
- SHA-256: `baa085c6e1816620be89510d1f7a5a431b67db5387c050acc8d29a1fd9d19ef5`

## 07. Checkpoint D — Upload .md preview + Raw Notes fallback

- File: `roundtable-v0.11.0-checkpoint-D-upload-preview-rawnotes.zip`
- Version: v0.11.0 Checkpoint D
- Purpose: Adds safe inbound Markdown handling without structured state mutation. Uploaded Markdown can be previewed and preserved as Raw Notes.
- SHA-256: `f1b98af7b7697fbbfeca9964c7b30b089c9226d97dd5d30263fd62f473a81b34`

## 08. Checkpoint E — mediator_synthesis structured import

- File: `roundtable-v0.11.0-checkpoint-E-mediator-synthesis-import.zip`
- Version: v0.11.0 Checkpoint E
- Purpose: First structured import commit path. Valid mediator_synthesis Markdown can populate structured mediator synthesis fields and rollback safely.
- SHA-256: `a434b4c339aaf381725322185b356e67efa2b38503a6df274d873c1477cf9af4`

## 09. Checkpoint F — import correctness hardening

- File: `roundtable-v0.11.0-checkpoint-F-import-correctness.zip`
- Version: v0.11.0 Checkpoint F
- Purpose: Fixes two importer correctness false positives before expanding structured import types.
- SHA-256: `59628413055d1fc8ca06465bfe736372279ced28e20b69b87511bc1eb5814f86`

## 10. Checkpoint G — model_response structured import + per-slot upload

- File: `roundtable-v0.11.0-checkpoint-G-model-response-import.zip`
- Version: v0.11.0 Checkpoint G
- Purpose: Adds structured import for model_response artifacts and per-slot Upload .md controls in Responses.
- SHA-256: `56e0a8d1eeef1c19f67f3d5dc3af24712ea2ab0d429334c3aad5a710fa740f17`

## 11. Checkpoint H — remaining structured imports + truncation warning fix

- File: `roundtable-v0.11.0-checkpoint-H-remaining-structured-imports.zip`
- Version: v0.11.0 Checkpoint H
- Purpose: Completes the remaining core structured import source kinds and fixes the POTENTIALLY_TRUNCATED false positive.
- SHA-256: `a9632134a3660e92f376336c583434a9afb12e328d28f2a8c8bd5baf0a4bc439`

## 12. Checkpoint I — v0.11.0 RC hardening + docs + acceptance walk

- File: `roundtable-v0.11.0-checkpoint-I-rc-hardening-docs.zip`
- Version: v0.11.0 Checkpoint I / RC
- Purpose: Converts v0.11.0 from feature-complete to release-candidate ready with docs, checklist, acceptance walk, and a small Raw Notes delete UI.
- SHA-256: `9da0ad2c548631f6dd958eb3f118f8fd5b0b47c765009d179520361ba8698ffe`

## 13. PWA readiness assessment document

- File: `roundtable-v0.11.0-pwa-readiness-doc.zip`
- Version: v0.11.0 planning after RC
- Purpose: Adds docs/PWA_READINESS.md as a planning-only assessment for the v0.12 PWA track.
- SHA-256: `1c3d35db4cd297958165eb8811be6bd2dd346a1b7f994feed496be699d66e4f9`

## 14. Checkpoint J — modal system replacement

- File: `roundtable-v0.12.0-checkpoint-J-modal-system.zip`
- Version: v0.12.0 Checkpoint J
- Purpose: First v0.12 prep checkpoint. Replaces browser-native confirm/alert/prompt with RoundTable-styled modal APIs.
- SHA-256: `dc93f1258107e82e2cfac2712dd31ebb45711c7f790f99cb0759c66205b2f3bc`

## 15. Checkpoint K — PWA implementation bundle

- File: `roundtable-v0.12.0-checkpoint-K-pwa-implementation-bundle.zip`
- Version: v0.12.0 Checkpoint K
- Purpose: Adds installable/offline-capable PWA shell for static HTTPS hosting, with Netlify as first deployment target.
- SHA-256: `852ed9c002a84ce9f4cd27a0fc334ca9b704fb68310f8b9e32348f8ba3cf55b1`

