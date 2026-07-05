# 12 — Checkpoint I — v0.11.0 RC hardening + docs + acceptance walk

## Artifact

- **Original filename:** `roundtable-v0.11.0-checkpoint-I-rc-hardening-docs.zip`
- **Kind:** source checkpoint
- **Version / checkpoint:** v0.11.0 Checkpoint I / RC
- **Size:** 340,458 bytes
- **SHA-256:** `9da0ad2c548631f6dd958eb3f118f8fd5b0b47c765009d179520361ba8698ffe`

## Role in the chronology

Converts v0.11.0 from feature-complete to release-candidate ready with docs, checklist, acceptance walk, and a small Raw Notes delete UI.

## Key changes / contents

- Creates docs/MARKDOWN_HANDOFF.md.
- Adds/updates phase history, schema evolution, data model, release checklist.
- Adds 15-criterion automated acceptance walk.
- Adds optional Raw Notes delete button.
- 15/15 acceptance criteria pass.

## Verification / confidence

Independently verified in chat: typecheck/build clean; acceptance walk 15 pass, 0 partial, 0 fail; no app-owned network surfaces.

## How to use this artifact

Unzip this package to inspect or build this checkpoint. For source checkpoints, run `npm install`, `npx tsc --noEmit`, and `npm run build` from the extracted root when validating locally.

## Extracted notes for visibility

- `extracted-notes/CHECKPOINT_STATE.md`
- `extracted-notes/CHECKPOINT_STATE_I.md`

## Next artifact in chain

13-pwa-readiness-doc
