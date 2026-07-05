# 07 — Checkpoint D — Upload .md preview + Raw Notes fallback

## Artifact

- **Original filename:** `roundtable-v0.11.0-checkpoint-D-upload-preview-rawnotes.zip`
- **Kind:** source checkpoint
- **Version / checkpoint:** v0.11.0 Checkpoint D
- **Size:** 288,751 bytes
- **SHA-256:** `f1b98af7b7697fbbfeca9964c7b30b089c9226d97dd5d30263fd62f473a81b34`

## Role in the chronology

Adds safe inbound Markdown handling without structured state mutation. Uploaded Markdown can be previewed and preserved as Raw Notes.

## Key changes / contents

- Created useMarkdownUpload hook.
- Wired Upload .md controls into RoundBuilder, Responses, and Mediator.
- ImportPreviewModal wired with disabled structured Import path.
- Import as Raw Notes implemented.

## Verification / confidence

Independently verified in chat: typecheck/build clean.

## How to use this artifact

Unzip this package to inspect or build this checkpoint. For source checkpoints, run `npm install`, `npx tsc --noEmit`, and `npm run build` from the extracted root when validating locally.

## Extracted notes for visibility

- `extracted-notes/CHECKPOINT_STATE.md`

## Next artifact in chain

08-checkpoint-e-mediator-synthesis-import
