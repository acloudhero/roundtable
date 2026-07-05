# RoundTable Portfolio Brief

## One-sentence summary

RoundTable is a local-first React/TypeScript PWA for coordinating manual multi-model AI workflows with prompt provenance, Markdown handoff artifacts, import safety, and rollback.

## The problem

When a project uses several AI models in parallel, the work can become difficult to govern. Prompts get copied into different model interfaces. Responses come back in different styles. The operator needs a mediator synthesis, but also needs to preserve what was asked, what was answered, what was decided, and what changed in canonical project state.

A chat transcript alone is not a reliable operating system for that workflow.

## The product answer

RoundTable gives the operator a cockpit:

- define project state
- select model roles
- generate model-specific prompts
- timestamp manual copy/paste actions
- collect responses
- build a mediator packet
- parse mediator synthesis into decision fields
- apply canonical-state updates only after explicit review
- export/import durable JSON and Markdown artifacts
- recover malformed imports as raw notes instead of losing data
- rollback structured imports from import history

## Why local-first matters

The app intentionally does not connect to model APIs. That constraint is the product principle, not a missing feature. It keeps the operator in control of what leaves the browser and allows the workflow to span whichever model interfaces are available.

## Engineering themes demonstrated

### Product architecture

RoundTable separates UI panels, config, storage, data contracts, migration, validation, import/export, and mediator utilities. The app is small enough to inspect but structured like a real tool.

### Data safety

The Markdown handoff system uses frontmatter metadata, content hashes, stale-state checks, malformed-file fallback, and rollback snapshots. The import system is designed to avoid silent data loss.

### State management

The project state, rounds, prompts, responses, decisions, raw notes, and import history all live in one typed AppState model with migration support.

### Operator experience

The UI is designed around a human-in-the-loop workflow: review gates, destructive-action modals, storage-pressure banners, recovery mode, mobile-friendly panels, and PWA offline readiness.

### Deployment discipline

The app builds as a static PWA and can be hosted without backend infrastructure. `wrangler.toml` and `public/_headers` document the Cloudflare Pages hosting boundary.

## Interview talk track

“I built RoundTable because my AI workflow had become operationally complex. I was coordinating multiple models, each with a different role, and I needed a way to preserve prompt provenance, compare responses, synthesize decisions, and carry canonical project state forward without relying on hidden automation or APIs. The application is intentionally local-first: it uses React, TypeScript, Vite, browser storage, structured JSON export/import, and Markdown artifacts with integrity checks. The most important engineering work is not the UI alone; it is the safety model around imports, hashes, stale-state detection, raw-note fallback, and rollback.”

## Suggested repo description

Local-first React/TypeScript PWA for coordinating manual multi-model AI workflows with prompt provenance, Markdown handoff, import safety, and rollback.

## Suggested resume bullet

Built RoundTable, a local-first React/TypeScript PWA for coordinating manual multi-model AI workflows; implemented prompt provenance, Markdown handoff artifacts, stale-state detection, import preview gates, raw-note fallback, rollback snapshots, and static PWA deployment.
