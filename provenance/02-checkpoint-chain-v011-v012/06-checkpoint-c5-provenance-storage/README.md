# 06 — Checkpoint C.5 — provenance capture + storage pressure surfacing

## Artifact

- **Original filename:** `roundtable-v0.11.0-checkpoint-C5-provenance-storage.zip`
- **Kind:** source checkpoint
- **Version / checkpoint:** v0.11.0 Checkpoint C.5
- **Size:** 280,854 bytes
- **SHA-256:** `baa085c6e1816620be89510d1f7a5a431b67db5387c050acc8d29a1fd9d19ef5`

## Role in the chronology

Closes export-provenance and storage-warning gaps before upload/import work begins.

## Key changes / contents

- Captures canonicalStateHashAtGeneration at prompt generation time.
- Ensures generated-prompt export prefers generation-time hash.
- Surfaces storage pressure warning banner in the app shell.

## Verification / confidence

Independently verified in chat: typecheck/build clean.

## How to use this artifact

Unzip this package to inspect or build this checkpoint. For source checkpoints, run `npm install`, `npx tsc --noEmit`, and `npm run build` from the extracted root when validating locally.

## Extracted notes for visibility

- `extracted-notes/CHECKPOINT_STATE.md`

## Next artifact in chain

07-checkpoint-d-upload-preview-rawnotes
