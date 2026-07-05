# GitHub / Portfolio Visibility Guide

This reconstruction is intended to make the RoundTable project legible to a reviewer without pretending every historical package is available.

## Suggested repository sections

- `README.md` — current product overview and how to run the app.
- `docs/ARCHITECTURE.md` — local-first manual-copy/paste design.
- `docs/PROJECT_HISTORY.md` — summarized phase chronology.
- `docs/project-provenance/` — artifact chronology, review packets, and hashes.
- `artifacts/` or GitHub Releases — historical zips and review bundles.

## Suggested narrative

RoundTable began as Model Roundtable Console: a local-first coordination cockpit for multi-model AI workflows. Its core design choice is manual copy/paste rather than API orchestration or scraping. Over the project, the app gained durable local state, round workflow management, mediator packets, structured synthesis extraction, export/import recovery, schema migration, prompt/vendor compatibility features, and response-persistence hardening.

## What to show reviewers

- The app runs locally with Vite/React/TypeScript.
- The tool explicitly avoids scraping/API automation.
- Export/import and recovery were treated as first-class workflow safety features.
- The artifact trail shows iterative review by GPT-5.5 and Gemini, with implementation passes by Claude models.
- Later RT versions hardened real operational bugs rather than merely adding UI polish.
