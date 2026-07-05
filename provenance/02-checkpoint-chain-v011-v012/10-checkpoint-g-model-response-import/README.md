# 10 — Checkpoint G — model_response structured import + per-slot upload

## Artifact

- **Original filename:** `roundtable-v0.11.0-checkpoint-G-model-response-import.zip`
- **Kind:** source checkpoint
- **Version / checkpoint:** v0.11.0 Checkpoint G
- **Size:** 301,673 bytes
- **SHA-256:** `56e0a8d1eeef1c19f67f3d5dc3af24712ea2ab0d429334c3aad5a710fa740f17`

## Role in the chronology

Adds structured import for model_response artifacts and per-slot Upload .md controls in Responses.

## Key changes / contents

- Structured model_response import commits to correct response slot.
- Per-slot upload infers expected model_id.
- Warns/blocks unsafe model mismatch, unknown model, locked round, and overwrite cases.
- Rollback restores prior response body and status.

## Verification / confidence

Independently verified in chat: typecheck/build clean.

## How to use this artifact

Unzip this package to inspect or build this checkpoint. For source checkpoints, run `npm install`, `npx tsc --noEmit`, and `npm run build` from the extracted root when validating locally.

## Extracted notes for visibility

- `extracted-notes/CHECKPOINT_STATE.md`

## Next artifact in chain

11-checkpoint-h-remaining-structured-imports
