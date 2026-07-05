# RoundTable Development Provenance

This directory is the consolidated, chronological development record of RoundTable. It merges three independently assembled visibility bundles into one auditable chain, from the project's origin as **Model Roundtable Console (MRC)** through the **v0.12.0 PWA implementation** and into **real operational field use**.

Every era folder preserves its original bundle intact — per-artifact READMEs, checkpoint ZIPs, review packets, and SHA-256 manifests — so a reviewer can verify any link in the chain independently.

**Consolidated:** July 5, 2026, from three source bundles whose internal checksums were re-verified at consolidation time (Era 1: 29/29, Era 2: 16/16, Era 3: 10/10 files OK).

---

## The three eras

| Era | Folder | Coverage | What it shows |
|---|---|---|---|
| 1 | [`01-mrc-origins/`](./01-mrc-origins/README.md) | MRC Phase 3.1 → RT v0.10.5 | Earliest recoverable development history: phase-gated builds, independent Gemini review packets, and the response-persistence race-condition hardening (v0.10.4). |
| 2 | [`02-checkpoint-chain-v011-v012/`](./02-checkpoint-chain-v011-v012/README.md) | Podcast Pipeline context → v0.11.0 Checkpoints A–I → v0.12.0 Checkpoints J–K | The complete checkpoint-gated implementation chain for Markdown Handoff Mode and the PWA, with a buildable source ZIP at every checkpoint. |
| 3 | [`03-field-usage-storytime/`](./03-field-usage-storytime/README.md) | StoryTime Phase 7C / 7C.1 | RoundTable operating in production on a real project (23+ rounds), including an honest failure record: a prompt-generation contamination incident and the out-of-band recovery protocol that followed. |

Read each era's own `README.md` first — each is self-describing and was written when the bundle was assembled.

---

## Merged chronology

### Era 1 — Model Roundtable Console origins (through v0.10.5)

The project began as **Model Roundtable Console (MRC)**: a local-first coordination cockpit for multi-model AI workflows, built on a locked Phase 0 charter — no backend, no APIs, no scraping, no browser automation, all state in browser localStorage. Development advanced through numbered, gated phases; most phases were followed by a `.1` cleanup gate driven by independent Gemini review.

The full phase ladder (per `docs/PHASE_HISTORY.md` in this repo):

| Phase | Name |
|---|---|
| 0 | Project Charter and Scope Lock |
| 1 | Architecture and UX Blueprint |
| 2 | Lightweight Repo Scaffold |
| 3 / 3.1 | Core Round Workflow / Cleanup Patch |
| 4 | Mediator Packet and Decision Loop Refinement |
| 5 / 5.1 | Export, Import, Durable State, Recovery / Durability Gate Cleanup |
| 6 / 6.1 | Internal Documentation and Maintainability Pass / Cleanup |
| 7A / 7A.1 | Schema Migration + Import Compatibility / Migration Safety Cleanup |
| 7B / 7B.1 | Model / Prompt / Vendor Compatibility Resilience / Cleanup |
| 8 / 8.1 | UI Polish and Mobile Usability / Cleanup |
| 9 | Release Candidate Hardening and **RoundTable rename** |
| 10 | Operational Trial and 1.0.0 (future) |

Artifacts preserved in `01-mrc-origins/artifacts/` (stage numbers are the bundle's own):

| Stage | Artifact | Status |
|---|---|---|
| 00 | Chat transcript PDF (conversation-level provenance) | Available, platform-truncated in places |
| 01 | Phase 3.1 cleanup — changed files for Gemini | Changed-files bundle |
| 02 | Phase 4 — review files + Gemini review packet | Bundle + review |
| 03 | Phase 5.1 — durability Gemini review packet | Review packet |
| 04 | Phase 6.1 — maintainability Gemini review packet | Review packet |
| 05 | Phase 7A.1 — migration safety Gemini review packet | Review packet |
| 06 | **RT v0.10.4** — response persistence baseline (full source + Gemini review) | Full package |
| 07 | RT v0.10.5 — mediator extraction review packet | Review packet only *(full ZIP resolved in Era 2 — see below)* |
| 08 | Operational Vite dev-server screenshot | Image |

The v0.10.3 → v0.10.5 sequence is the strongest engineering story in this era: a workflow-critical bug (pasted responses missing from mediator packets) was root-caused to two interacting defects — a same-batch React race between textarea `onBlur` and status-button `onClick` dispatches, and an unconditional status reset stomping reviewed/excluded decisions. The fix migrated **all** round mutations to a functional-updater pattern (`updateRoundFunctional`) that resolves the latest round inside `setState`, deprecated the closure-based `replaceRound` to zero call sites, and (in v0.10.5, after Gemini review) rewrote mediator extraction as a line-based tolerant parser and removed a `setState`-inside-updater purity violation.

`01-mrc-origins/docs/MISSING_OR_UNAVAILABLE_ARTIFACTS.md` is an honest register of packages referenced in conversation but unrecoverable when that bundle was assembled. Nothing there was fabricated. **One entry has since been resolved:** the RT v0.10.5 full package, listed missing in Era 1, exists as `02-checkpoint-chain-v011-v012/01-roundtable-v105-baseline/rt-v105.zip` (SHA-256 `a8d52bce…f072`).

### Era 2 — The v0.11.0 → v0.12.0 checkpoint chain

This era is fully reconstructed with a verifiable source ZIP at every step. See [`02-checkpoint-chain-v011-v012/TIMELINE.md`](./02-checkpoint-chain-v011-v012/TIMELINE.md) for per-artifact SHA-256 hashes.

| Stage | Checkpoint | Delivered |
|---|---|---|
| 00 | Podcast Pipeline mediator packet | The planning context that made a durable, file-based handoff workflow necessary — the motivation for v0.11.0 |
| 01 | v0.10.5 baseline | Implementation starting point (full source) |
| 02 | v0.11.0 feasibility plan | Controlling document for Checkpoints A–I: architecture, hashing/normalization spec, conflict matrix, acceptance criteria |
| 03 | **A** — Foundation | Types, config, hashing/normalization/parsing, migration/validation, storage-pressure utilities |
| 04 | **B** — UI shell | Raw Notes / Import History / Import Preview panels and routing (no behavior wiring yet) |
| 05 | **C** — Markdown export | One-way `.md` artifact export across prompt/response/mediator surfaces |
| 06 | **C.5** — Provenance + storage pressure | Export-provenance capture and storage warnings closed before any import work began |
| 07 | **D** — Upload preview + Raw Notes fallback | Safe inbound Markdown with zero structured-state mutation |
| 08 | **E** — mediator_synthesis import | First structured commit path, with rollback |
| 09 | **F** — Import correctness | Two importer false positives fixed before expanding import types |
| 10 | **G** — model_response import | Per-slot upload, status preservation on overwrite |
| 11 | **H** — Remaining structured imports | generated_prompt + mediator_packet; truncation false positive fixed |
| 12 | **I** — RC hardening | `docs/MARKDOWN_HANDOFF.md`, 15-criterion acceptance walk (15/15), release checklist |
| 13 | PWA readiness assessment | Planning-only, 20-section document; defined checkpoint sequence J → K+M → L → N (O optional) |
| 14 | **J** — Modal system (v0.12.0) | All six `window.confirm/alert/prompt` call sites replaced with themed promise-based modals — a PWA prerequisite (native dialogs can block service-worker-era UX) |
| 15 | **K** — PWA implementation (v0.12.0) | Absorbed the planned K/L/M scopes: manifest + six icons, Workbox precache-only service worker with operator-prompted updates, mobile UX hardening CSS, `netlify.toml`, `docs/PWA.md` |

**This repository's source tree is Checkpoint K plus portfolio packaging** (README, LICENSE, SECURITY, CHANGELOG, CI workflow, lockfile refresh) — see [`../docs/PROVENANCE.md`](../docs/PROVENANCE.md) for the packaging-time verification record.

### Era 3 — Field usage: StoryTime Phase 7C / 7C.1

RoundTable's purpose is coordinating real multi-model work, and this bundle shows it doing exactly that on the **StoryTime** project: RoundTable-generated prompts driving a GPT-mediated / Gemini-reviewed / Claude-implemented loop through 23+ rounds, culminating in an architecture-baseline amendment taken from draft → independent critique → revision → "SAFE TO LOCK".

It also preserves a failure honestly. At Round 23, RoundTable's generated prompt carried stale starter-state fields (contamination). Rather than hiding it, the operator froze the contaminated prompt as evidence (`01_round23_contaminated_prompt/`), continued StoryTime out-of-band with the same review discipline, and wrote a recovery ledger with a single-checkpoint re-entry rule for when the tool was repaired. That incident is part of why Era 2's Markdown Handoff Mode — durable, hash-verified, provenance-stamped handoff artifacts — was prioritized.

*Sourcing note: this era's artifacts originate from out-of-band sessions (primarily ChatGPT-side) and are presented exactly as bundled; the bundle's own `MANIFEST.md` hashes were re-verified at consolidation.*

---

## The phase-gating model

Every unit of work across all eras followed the same gate, at two scales (a "phase" in Era 1, a "checkpoint" in Era 2):

1. **Plan** — a controlling document defines scope, non-goals, and acceptance criteria *before* implementation (e.g., the v0.11.0 feasibility plan, the PWA readiness assessment).
2. **Implement** — one tightly-scoped unit. Scope creep is rejected at the gate: IndexedDB migration, diff viewers, drag/drop, bulk export, and any backend/API surface were explicitly out of scope and stayed out.
3. **Verify** — the non-negotiable local gate for every checkpoint:
   - `npx tsc --noEmit` clean
   - `npm run build` clean
   - 15-criterion acceptance walk passing (from Checkpoint I onward; 23-item gate sweeps in Era 1's Phase 7B)
   - network grep proving zero app-owned network surfaces
   - a `CHECKPOINT_STATE.md` documenting exact changes and deferred items
4. **Package + prove** — deliverable ZIP named `roundtable-v{version}-{checkpoint-slug}.zip`, then end-to-end re-verified *from the ZIP itself*: extract → install → typecheck → build → walk.
5. **Independent review** — Gemini review packets (Era 1 and Era 3) provide a second-model audit; "SAFE WITH EDITS" findings produce `.1` cleanup gates before lock.

Two version disciplines fall out of this: **`SCHEMA_VERSION` is decoupled from `APP_VERSION`** (schema bumps track `AppState` shape changes, not feature releases — which is why the app is v0.12.0 on schema 0.11.0), and **future-schema imports are hard errors**, never warnings.

## From manual gates to CI

The per-checkpoint manual gate is now encoded as continuous integration. This repo's [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs `npm run verify` on every push and pull request to `main`, which executes the same three pillars the manual gate always required:

```text
npm run verify
  ├── npm run build            # tsc + vite production build
  ├── npm run acceptance:walk  # 15-criterion import/handoff safety harness
  └── npm audit --audit-level=high
```

In other words: the CI pipeline is the automation of a discipline that was already being enforced by hand at every checkpoint in this chain. The acceptance walk that gates CI today is the same harness introduced at Checkpoint I and kept green through J and K (`scripts/acceptance-walk.ts`, preserved results in `scripts/acceptance-walk-results.txt`).

---

## Current status and open items

As of this consolidation (July 5, 2026):

- **v0.12.0 / Checkpoint K** is the active baseline; acceptance walk 15/15; `npm audit` 0 vulnerabilities at packaging time.
- **Hosted Netlify validation of the PWA has not yet been performed** — local build/preview verified only. `netlify.toml` and `docs/PWA.md` document the deployment path.
- **Checkpoint N** (PWA-aware documentation pass) remains from the readiness plan; **Checkpoint O** (IndexedDB storage adapter) stays optional, to be taken only if iOS storage quotas prove blocking in field use.
- The **Podcast Pipeline** resume path back into the latest build is documented in [`02-checkpoint-chain-v011-v012/PODCAST_PIPELINE_RESUME_BRIDGE.md`](./02-checkpoint-chain-v011-v012/PODCAST_PIPELINE_RESUME_BRIDGE.md).

## For reviewers: how to audit this chain

1. Pick any Era 2 checkpoint ZIP and verify its hash against `02-checkpoint-chain-v011-v012/TIMELINE.md` / `CHECKSUMS_SHA256.txt`.
2. Extract it and run the standard validation: `npm install && npx tsc --noEmit && npm run build`.
3. Diff adjacent checkpoints to see exactly what one gated unit of work changed.
4. Read `MANIFEST.sha256` files in Eras 1 and 3 (and `MANIFEST.md` hashes in Era 3) to verify document integrity.
5. Compare any historical `CHECKPOINT_STATE.md` (in each stage's `extracted-notes/`) against the shipped code.

See also [`DEVELOPMENT_PRACTICES.md`](./DEVELOPMENT_PRACTICES.md) for the multi-model development pipeline and engineering invariants distilled from the development-session records.
