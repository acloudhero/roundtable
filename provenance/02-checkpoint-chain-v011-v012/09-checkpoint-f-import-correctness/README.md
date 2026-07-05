# 09 — Checkpoint F — import correctness hardening

## Artifact

- **Original filename:** `roundtable-v0.11.0-checkpoint-F-import-correctness.zip`
- **Kind:** source checkpoint
- **Version / checkpoint:** v0.11.0 Checkpoint F
- **Size:** 293,153 bytes
- **SHA-256:** `59628413055d1fc8ca06465bfe736372279ced28e20b69b87511bc1eb5814f86`

## Role in the chronology

Fixes two importer correctness false positives before expanding structured import types.

## Key changes / contents

- Fixes CONTENT_HASH_MISMATCH false positive caused by frontmatter separator newline.
- Fixes H1 title noise causing UNMATCHED_HEADING warnings.
- Preserves fence-aware parsing behavior.

## Verification / confidence

Independently verified in chat: typecheck/build clean.

## How to use this artifact

Unzip this package to inspect or build this checkpoint. For source checkpoints, run `npm install`, `npx tsc --noEmit`, and `npm run build` from the extracted root when validating locally.

## Extracted notes for visibility

- `extracted-notes/CHECKPOINT_STATE.md`

## Next artifact in chain

10-checkpoint-g-model-response-import
