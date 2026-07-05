# RoundTable

RoundTable is a local-first React/TypeScript PWA for coordinating manual multi-model AI workflows with prompt provenance, Markdown handoff, import safety, rollback, and review-state continuity.

Live Demo: https://rtrc.netlify.app/

GitHub: https://github.com/acloudhero/roundtable

GitHub is the public source repository. The current live demo is hosted at https://rtrc.netlify.app/. Any other deployment path is optional/future, not the current live demo.

---

**RoundTable** is a local-first coordination cockpit for multi-model AI work. It helps an operator run structured “rounds” across ChatGPT, Claude, Gemini, and other model interfaces without APIs, browser automation, scraping, or backend services.

The app exists because manual multi-model work gets messy fast: prompts drift, pasted responses become hard to trace, mediator summaries lose provenance, and project state can become ambiguous. RoundTable turns that workflow into an auditable operating loop.

**Current app version:** `0.12.0`  
**Current storage schema:** `0.11.0`  
**Storage key:** `roundtable.appState.v1`  
**Current live demo:** https://rtrc.netlify.app/

> Version note: v0.12.0 adds the modal system and PWA implementation without changing the AppState shape. That is why the app version is `0.12.0` while the storage schema remains `0.11.0`.

**Install the app:** [`INSTALL.md`](INSTALL.md) — PWA installation for desktop, Android, and iOS, plus developer setup.  
**Development history:** [`provenance/`](provenance/README.md) — the complete phase-gated artifact chain from the project's origins to v0.12.0, with per-artifact SHA-256 checksums.  
**Live app:** [https://rtrc.netlify.app/](https://rtrc.netlify.app/)  
**Portfolio home:** [ericharrisportfolio.com](https://ericharrisportfolio.com)

---

## Portfolio Summary

RoundTable demonstrates practical product engineering around a real workflow problem:

- **Local-first architecture**: browser storage, JSON export/import, no server dependency.
- **Trust boundary discipline**: no model APIs, no scraping, no hidden network orchestration.
- **Workflow state management**: projects, rounds, prompts, responses, mediator packets, decisions, canonical state, raw notes, import history, and rollback.
- **Provenance and auditability**: timestamped copy/paste actions, generated artifact hashes, stale-state detection, and structured import previews.
- **Operator-centered UX**: mobile-friendly panels, confirmation modals, storage-pressure warnings, recovery mode, and PWA offline readiness.

This is not a toy prompt page. It is an application layer for coordinating human-mediated AI workflows while preserving chain of custody.

---

## Development Provenance

This repository ships with its own auditable build history. The [`provenance/`](provenance/README.md) directory consolidates the complete development record in chronological order across three eras:

1. **[MRC origins](provenance/01-mrc-origins/README.md)** — the project's first life as Model Roundtable Console: phase-gated builds (Phases 0–9), independent Gemini review packets, and the v0.10.3→v0.10.5 race-condition hardening story.
2. **[The v0.11.0 → v0.12.0 checkpoint chain](provenance/02-checkpoint-chain-v011-v012/README.md)** — eleven verification-gated checkpoints (A through K) with a buildable, checksummed source ZIP at every step, from Markdown Handoff Mode through the PWA implementation that this repo now is.
3. **[Field usage](provenance/03-field-usage-storytime/README.md)** — RoundTable coordinating a real 23-round multi-model project, including an honestly documented failure and recovery.

Every checkpoint passed the same gate before delivery: clean typecheck, clean production build, the acceptance walk, a network grep proving zero app-owned network surfaces, and end-to-end re-verification from the packaged ZIP. That manual gate is now automated as this repo's CI (`.github/workflows/ci.yml` → `npm run verify`). The process itself — plan documents, scoped checkpoints, independent multi-model review, cleanup gates — is described in [`provenance/DEVELOPMENT_PRACTICES.md`](provenance/DEVELOPMENT_PRACTICES.md).

RoundTable was built *with* the workflow it implements: GPT as mediator/architect, Claude for implementation, Gemini for independent review, every handoff human-mediated. The provenance directory is that loop, preserved.

---

## What RoundTable Does

RoundTable supports a repeatable multi-model workflow:

1. Define the project and canonical state.
2. Select model profiles and prompt wrappers.
3. Generate Context Sandwich prompts for each model.
4. Copy prompts out manually.
5. Paste model responses back into RoundTable.
6. Generate a mediator packet from the collected responses.
7. Paste mediator synthesis back into RoundTable.
8. Record decisions, risks, agreements, disagreements, next actions, and canonical-state updates.
9. Export JSON or Markdown handoff artifacts.
10. Continue the next round from a clean state snapshot.

RoundTable keeps the operator in control. It does not call AI APIs. It does not automate browser sessions. It does not scrape responses.

---

## Key Features

### Manual multi-model orchestration

RoundTable provides model profiles, prompt templates, model-specific wrappers, and a round builder for coordinating multiple AI systems from one structured workspace.

### Context Sandwich prompt generation

Prompts are generated from project state, round instructions, role-specific model profiles, and compatibility notes. This preserves the operator’s intent while making each model’s task explicit.

### Response capture and mediator synthesis

Responses are pasted back into model slots, then consolidated into a mediator packet. The mediator output can be parsed into agreements, disagreements, risks, open questions, next actions, canonical-state proposals, and decision drafts.

### Markdown handoff mode

RoundTable can export/import Markdown artifacts with YAML frontmatter, provenance metadata, content hashes, and source-kind validation.

Supported artifact surfaces include:

- generated prompts
- model responses
- mediator packets
- mediator synthesis
- raw notes

### Import safety and rollback

The import pipeline includes preview gates, malformed-frontmatter handling, raw-note fallback, stale canonical-state detection, stale prompt detection, import history, and rollback snapshots.

### Local-first PWA

v0.12.0 adds a static PWA implementation:

- Workbox-generated service worker
- app manifest and install icons
- offline-ready app shell
- operator-prompted update banner
- Cloudflare Pages deployment configuration

---

## Architecture

```text
Browser / PWA
   |
   |-- React + TypeScript UI panels
   |-- LocalStorage persistence through StorageAdapter
   |-- JSON export/import
   |-- Markdown artifact export/import
   |-- Hashing and validation utilities
   |-- PWA service worker for static shell caching

No backend
No model API calls
No browser automation
No cloud database
```

### Major folders

| Path | Purpose |
|---|---|
| `src/components/` | UI panels and workflow surfaces |
| `src/config/` | model profiles, wrappers, templates, export constants |
| `src/data/` | demo state and initial app state |
| `src/storage/` | storage adapter boundary |
| `src/types/` | TypeScript data contracts |
| `src/utils/` | import/export, validation, hashing, migration, prompt, and mediator logic |
| `docs/` | architecture, data model, schema, PWA, release, and portfolio documentation |
| `scripts/` | acceptance walk verification harness |

---

## Tech Stack

- React 18
- TypeScript
- Vite
- vite-plugin-pwa / Workbox
- js-yaml
- LocalStorage
- Static hosting via Cloudflare Pages or any HTTPS static host

---

## Local Setup

Prerequisite: Node.js 20+ recommended.

```bash
npm ci
npm run dev
```

Open the local Vite URL shown in the terminal.

Production build:

```bash
npm run build
npm run preview
```

Full local verification:

```bash
npm run verify
```

`npm run verify` runs the production build, the acceptance walk, and a high-severity npm audit check.

---

## Acceptance Walk

The bundled acceptance harness exercises the safety-critical Markdown handoff and import pipeline.

```bash
npm run acceptance:walk
```

Current preserved result from the checkpoint K packaging pass:

```text
Summary: 15 pass, 0 partial, 0 fail
```

The acceptance walk covers:

- same-source artifact generation
- round-trip hash integrity
- stale canonical-state detection
- stale prompt detection
- post-export edit detection
- malformed YAML fallback
- truncated body warnings
- code-fence-aware extraction
- CRLF/LF stability
- rollback restoration
- no silent data loss
- forward-schema rejection
- migration safety
- no new network surfaces
- v0.10.5 workflow compatibility

---

## Deployment

The current live demo is hosted at [https://rtrc.netlify.app/](https://rtrc.netlify.app/). The repo also includes `wrangler.toml` and `public/_headers` for an optional/future Cloudflare Pages deployment. The former Netlify config is preserved as `netlify.toml.legacy` only for provenance.

Recommended Cloudflare Pages settings:

```text
Framework preset: React (Vite) or None
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 20 or 22
```

The PWA is still local-first after deployment. Cloudflare Pages hosts the static app shell only. User data remains in the operator’s browser storage unless explicitly exported by the user.

For the exact deployment path, custom-domain note, and smoke test, see [`docs/CLOUDFLARE_DEPLOYMENT.md`](docs/CLOUDFLARE_DEPLOYMENT.md).

---

## Public Portfolio Positioning

Suggested GitHub description:

```text
Local-first React/TypeScript PWA for coordinating manual multi-model AI workflows with prompt provenance, Markdown handoff, import safety, and rollback.
```

Suggested topics:

```text
react typescript vite pwa local-first ai-workflow llm prompt-engineering state-management markdown netlify portfolio
```

Suggested resume bullet:

```text
Built RoundTable, a local-first React/TypeScript PWA for coordinating manual multi-model AI workflows; implemented prompt provenance, Markdown handoff artifacts, stale-state detection, import preview gates, raw-note fallback, rollback snapshots, and static PWA deployment.
```

---

## Documentation Map

Start here:

- [`INSTALL.md`](INSTALL.md) — install as a PWA (desktop / Android / iOS) or run from source
- [`provenance/README.md`](provenance/README.md) — consolidated chronological development record and phase-gating model
- [`provenance/DEVELOPMENT_PRACTICES.md`](provenance/DEVELOPMENT_PRACTICES.md) — multi-model pipeline, engineering invariants, verification culture
- [`docs/PORTFOLIO_BRIEF.md`](docs/PORTFOLIO_BRIEF.md) — recruiter/interviewer explanation
- [`docs/GITHUB_PORTFOLIO_PUBLISHING.md`](docs/GITHUB_PORTFOLIO_PUBLISHING.md) — publish checklist
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — state model and data contracts
- [`docs/MARKDOWN_HANDOFF.md`](docs/MARKDOWN_HANDOFF.md) — Markdown artifact system
- [`docs/PWA.md`](docs/PWA.md) — PWA behavior
- [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) — release verification
- [`docs/PROVENANCE.md`](docs/PROVENANCE.md) — checkpoint source bundle provenance

---

## License

This repository is published as a source-visible portfolio artifact. No open-source license is granted unless the license file is intentionally replaced.
