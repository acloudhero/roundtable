# RoundTable

**Version:** `0.10.5` (v0.10.5 mediator extraction tolerance + state mutation cleanup) · Schema: `0.10.5` · Storage key: `roundtable.appState.v1`

*Formerly developed under the working name Model Roundtable Console / MRC.*

A local-first manual copy/paste coordination cockpit for multi-model AI workflows.

> **v0.10.5 — Mediator extraction tolerance + state mutation cleanup.**
> Mediator synthesis extraction now tolerates common heading variants
> in real model output: `## Executive Summary`, `### 1. Executive Summary`,
> `[EXECUTIVE SUMMARY]`, `Executive Summary:`, and dash-suffix forms.
> Unknown heading-shaped lines no longer erase known extracted content.
> Manual fallback still applies when extraction is incomplete.
> `MediatorPanel.handleGenerate` is now a pure functional updater
> (`generatedPacket` is derived from `round.mediatorPrompt`, no
> `setState` inside an updater). All remaining `replaceRound` call
> sites migrated to `updateRoundFunctional`; `replaceRound` is now
> `@deprecated` and kept only for backward compatibility. UI copy
> refreshed to reflect v0.10.4's stronger save behavior. No
> AppState shape change.

> **v0.10.4 — Response persistence / aggregation hardening.** Under
> "Total Serialization": no workflow transition relies on text that
> exists only in a transient component-local draft. All round
> mutations now dispatch via a functional updater (`updateRoundFunctional`)
> that resolves the latest round inside React's setState — eliminating
> the textarea-blur + status-click race at the slice level. Local
> textarea drafts are flushed on panel unmount and before any
> cross-panel navigation. Mediator packet generation reads canonical
> saved responses via the functional updater, never from stale
> closure. No AppState shape change.

> **v0.10.3 — Mediator packet response inclusion fix.** Pasted/reviewed
> model responses now reliably appear in the generated mediator packet
> with their full body text, dynamic-tilde-fenced for safe Markdown
> embedding. The Mediator panel shows a per-model inclusion summary
> with character counts, and warns when the saved packet has gone
> stale relative to edited responses. Behavior fix only — **no
> AppState shape change**, no migration changes, no new dependencies.

---

## What This App Is

- A **workflow cockpit** for coordinating multiple AI models (ChatGPT, Claude, Gemini, etc.)
- A **prompt generator** using the Context Sandwich pattern + vendor-specific wrappers
- A **chain-of-custody audit log** tracking when prompts were copied and responses pasted
- A **decision logger** with mediator synthesis, canonical state management, round history
- A **local-first tool** — all data stays in your browser

## What This App Is Not

- ❌ Not an API orchestration tool
- ❌ Not a browser automation or scraping tool
- ❌ Not connected to any AI model directly
- ❌ No backend, no authentication, no server, no cloud sync

You copy prompts out manually and paste model responses back in manually. RoundTable makes that motion cleaner, faster, and auditable.

---

## Local Install & Run

**Prerequisites:** Node.js 18+

```bash
cd roundtable
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Works on mobile at `http://[your-local-ip]:5173`.

```bash
npm run build   # production build
npm run preview # preview production build
```

---

## Core Workflow (Phase 9)

1. **Project State** — Set project name, phase, and canonical state
2. **Model Roster** — Review and activate model profiles
3. **Round Builder** — Write instruction, select models, generate Context Sandwich prompts
4. **Copy Prompts** — Copy each prompt to its model (copiedAt timestamp recorded)
5. **Responses** — Paste each model's response back (pastedAt timestamp recorded)
6. **Mediator** — Generate packet → copy to GPT-5.5 → paste response → Extract structured fields → review synthesis
7. **Decision Log** — Review mediator synthesis → use drafts → record decision → apply canonical state update → lock round
8. **Project State** — Apply canonical state update for next round
9. **Export / Import** — Back up JSON; export Markdown for review
10. **Repeat** — Start next round from proposed next-round prompt

---

## Chain-of-Custody Tracking

Every manual action is timestamped:

| Event | Recorded |
|---|---|
| Prompt generated | `generatedAt` |
| User clicked Copy | `copiedAt` |
| User pasted response | `pastedAt` |
| Decision recorded | `Decision.createdAt` |
| Round locked | `Round.locked = true` |

---

## Canonical State Rule

**RoundTable never automatically updates `Project.canonicalState`.**

The mediator may *propose* a canonical state update. It is only applied when:
1. User reviews the proposal in Decision Log
2. User checks "Apply to Project Canonical State"
3. User confirms the lock action

When applied, the update is appended as a dated section — original state preserved.

---

## Mobile Use

RoundTable is designed for phone use while switching between RoundTable and external model interfaces.

- Serve locally: `npm run dev` → open `http://localhost:5173` on your phone (same WiFi)
- All workflow panels stack single-column on mobile
- 44px minimum touch targets throughout
- Copy buttons are prominent and give in-place feedback (no layout shift)

**Important on mobile:** Export JSON regularly. Browser storage can be cleared unexpectedly.

---

## Data Warning

⚠️ **All data is stored locally in your browser (`roundtable.appState.v1`).**

- Clearing browser data, switching browsers, or using private/incognito mode will lose your state.
- **Export JSON regularly** from Export / Import.
- Store exports outside the browser (files, version control, cloud drive).

---

## Storage Key

`roundtable.appState.v1`

*Phase 9 renamed this key from `mrc.appState.v0` (used during development). No legacy migration was added — the app had not been used operationally. To restore previous dev data, use a JSON export from the old key if you saved one.*

---

## Major Folders

| Folder | Purpose |
|---|---|
| `src/components/` | UI panels — one per screen tab |
| `src/config/` | Model profiles, prompt templates, prompt wrappers, compatibility notes, exportFormats |
| `src/data/` | Demo data and initial app state |
| `src/storage/` | StorageAdapter interface and localStorage implementation |
| `src/types/` | TypeScript interfaces (AppState, Round, GeneratedPrompt, etc.) |
| `src/utils/` | Pure utilities (roundUtils, promptGeneration, mediatorPacket, mediatorExtract, export, clipboard) |
| `src/styles/` | app.css |
| `docs/` | Internal documentation |

---

## Adding a New Model

Edit `src/config/modelProfiles.ts`. See `docs/MODEL_PROFILES.md`.

---

## Dependency Advisory

The Vite/esbuild dev-server advisory (deferred since Phase 3.1) was resolved in Phase 9 by upgrading to Vite 6.4.2. `npm audit` should report 0 vulnerabilities.

---

## Automation Warning

Do not attempt to automate browser sessions, scrape responses, or add API calls.
RoundTable is designed for manual copy/paste workflows only.

---

## Phase

Current: **Phase 9 — Release Candidate Hardening and RoundTable Rename**
