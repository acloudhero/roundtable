# Project State

RoundTable — Phase 7A

## The Three Layers of State

RoundTable distinguishes three layers of state. Keeping them separate is what
makes the audit trail trustworthy.

### 1. Durable App State

The full `AppState` object persisted in localStorage under
`roundtable.appState.v1`. Everything below is part of it.

- Survives reloads.
- Restored from JSON exports.
- Inspected by validation on import.
- Recovered via Recovery Mode if it ever becomes malformed.

### 2. Canonical Project State

`Project.canonicalState` is the project's long-term **Ground Truth
ledger**. It is included in every Context Sandwich prompt.

- Updated **only** through explicit user action.
- Appended (not overwritten) when an authorized update is applied —
  the original is preserved as historical context.
- Treated as the project's single source of truth between rounds.

### 3. Round History

`AppState.rounds[]` records the per-round chain of custody:
prompts generated, prompts copied, responses pasted, mediator packet
sent, mediator response stored, synthesis extracted and edited,
decision recorded, round locked.

- Locked rounds are read-only by default.
- Each round carries `createdAt` / `updatedAt` and per-prompt /
  per-response timestamps for the audit trail.
- The current round drives the workflow UI; historical rounds drive
  the Decision Log and exports.

These three layers compose: durable state contains canonical state
contains round history. Editing round history (e.g. unlocking a round)
does not retroactively change canonical state, and updating canonical
state does not rewrite past rounds.

## Canonical State is Ground Truth

`Project.canonicalState` is included in every Context Sandwich prompt.
It must be kept accurate and current after each round.

## Update Paths

### Manual update (Project State tab)

Edit the Canonical State textarea directly → Save.

### Via Decision Loop

1. Mediator Tab → paste response → Save & Extract Structured Fields.
2. Review "Proposed Canonical State Update" in MediatorSynthesis fields.
3. Decision Log → "Use proposed canonical update as draft" (fills
   editable field only).
4. Edit the draft as needed.
5. Check "Apply to Project Canonical State".
6. Confirm → "Record Decision & Lock Round".
7. A dated section is appended:

   ```
   ## Round N Canonical State Update — YYYY-MM-DD
   [user-approved update]
   ```

## Safety Rule

**The app never automatically updates `Project.canonicalState`.**

`proposedCanonicalStateUpdate` in `MediatorSynthesis` is a text field —
a proposal. The "Use as draft" button only fills an editable textarea.
The update is only applied when the user explicitly checks "Apply"
and confirms.

## Format Recommendation

```markdown
## Canonical Project State

**Stack:** ...

**What exists:**
- ...

**What does not exist yet:**
- ...

**Constraints:**
- ...

**Open Questions:**
- ...
```

## Recovery and Canonical State

If durable state becomes malformed, Recovery Mode lets you (a)
download / copy the raw blob (which contains the canonical state),
(b) import a known-good backup, or (c) reset to demo. The canonical
state is therefore not lost just because localStorage failed to parse —
it lives in the raw string the user can rescue, and in any JSON export
already on disk.

See `docs/MAINTAINABILITY.md → Where recovery logic lives` for the
implementation surface.

---

## v0.10.1 Project Lifecycle

RoundTable now supports multiple projects with full lifecycle management.

**Creating a project:**
Go to Projects tab → "New Project" or "Start From Blank Project".
New projects start with 0 rounds and 0 decisions. Model profiles and templates are shared.

**Switching projects:**
Projects tab → click "Switch to This" on any non-archived project.
All workflow panels (Round Builder, Responses, Mediator, Decision Log) reflect the active project.

**Duplicating:**
Duplicates the project metadata, canonical state, and all rounds and decisions with fresh IDs. No orphaned data.

**Archiving:**
Hides the project from the active list. Data remains in JSON export. Can be unarchived.

**Deleting:**
Permanently removes the project and all its rounds and decisions. Requires typing the project name. Export JSON first.

**Important:** Deleting a project cannot be undone without a JSON backup. Export regularly.
