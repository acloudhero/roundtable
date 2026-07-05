# 05 — Checkpoint C — Download .md export controls

## Artifact

- **Original filename:** `roundtable-v0.11.0-checkpoint-C-download-export.zip`
- **Kind:** source checkpoint
- **Version / checkpoint:** v0.11.0 Checkpoint C
- **Size:** 277,780 bytes
- **SHA-256:** `16f4362020fa1b26de181c3826ede15aa9348509eff8c7fb2744b47bc1a742b3`

## Role in the chronology

Adds one-way Markdown artifact export controls across prompt/response/mediator surfaces.

## Key changes / contents

- Added Download .md buttons in RoundBuilder.
- Added Download .md buttons in Responses.
- Added mediator packet and mediator synthesis downloads where source strings exist.
- Introduced shared markdownArtifactDownload helper.

## Verification / confidence

Independently verified in chat: typecheck/build clean.

## How to use this artifact

Unzip this package to inspect or build this checkpoint. For source checkpoints, run `npm install`, `npx tsc --noEmit`, and `npm run build` from the extracted root when validating locally.

## Extracted notes for visibility

- `extracted-notes/CHECKPOINT_STATE.md`

## Next artifact in chain

06-checkpoint-c5-provenance-storage
