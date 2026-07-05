# 03 — Checkpoint A — v0.11.0 foundation layer

## Artifact

- **Original filename:** `rt-v110-checkpoint.zip`
- **Kind:** source checkpoint
- **Version / checkpoint:** v0.11.0 Checkpoint A
- **Size:** 260,423 bytes
- **SHA-256:** `f2cf7d38f70fe867de49616b5b951e20591779552f8385cee6d695defe1e919d`

## Role in the chronology

Foundation implementation for Markdown Handoff Mode. Adds types, config, hashing/normalization/parsing utilities, migration/validation, artifact import foundations, and storage pressure utilities.

## Key changes / contents

- Markdown artifact types and config.
- Raw Notes / Import History state foundations.
- Markdown normalize/hash/parse/artifact utilities.
- Migration and validation helpers.
- No UI shell wiring yet.

## Verification / confidence

Build/typecheck verified clean during this chat; used as base for Checkpoint B.

## How to use this artifact

Unzip this package to inspect or build this checkpoint. For source checkpoints, run `npm install`, `npx tsc --noEmit`, and `npm run build` from the extracted root when validating locally.

## Extracted notes for visibility

- `extracted-notes/CHECKPOINT_STATE.md`

## Next artifact in chain

04-checkpoint-b-ui-shell
