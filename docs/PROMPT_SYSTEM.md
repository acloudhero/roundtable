# Prompt System

RoundTable — Phase 7B

## Context Sandwich Pattern (since Phase 1, unchanged in Phase 7B)

Every model prompt:
1. Project Context (top bread): name, phase, canonical state
2. User Instruction
3. Model Role + Constraints
4. Active Compatibility Notes
5. Required Output Format (bottom bread)

## Phase 7B: Prompt Wrapper Layer

A vendor-specific *wrapper* now wraps the Sandwich. The Sandwich
itself is unchanged. The wrapper contributes:

- `wrapperText` — vendor/model framing prepended **above** the Sandwich
- `outputInstructions` — output/format constraints appended **below**
  the Sandwich
- `compatibilityNotes` — informational, rendered inline above the
  wrapper footer if present

Resolution order (in `src/utils/promptGeneration.ts`):

1. Explicit `wrapper` argument (rare).
2. The model's `defaultPromptWrapperId`, looked up against the
   AppState `promptWrappers` array.
3. The Generic wrapper (`GENERIC_WRAPPER_ID = "wrapper-generic"`).
4. None — Sandwich shape unchanged from Phase 5/6/7A.

Wrappers live in `src/config/promptWrappers.ts`. See
`docs/VENDOR_RESILIENCE.md` for the operator's manual on when to
edit a wrapper, when to add a new wrapper, and how wrapper resolution
interacts with the Phase 7B `defaultPromptWrapperId` migration
default.

## Mediator Packet (Phase 4)

`src/utils/mediatorPacket.ts` — `generateMediatorPacket()`

The Phase 4 packet includes:
- Project name, description, current phase, round number
- Canonical project state
- Round instruction
- Model roster with response status (✓ collected / ✗ missing)
- Missing response banner if applicable
- Known risks and open questions from the round
- Each model's full response

Required output format (12 sections using ### headings):

1. Executive Summary
2. Agreements
3. Disagreements
4. Risks
5. Open Questions
6. Model-Specific Observations
7. Recommended Decision
8. Decision Rationale
9. Proposed Canonical State Update ← proposal only, never auto-applied
10. Proposed Next Actions
11. Proposed Next-Round Prompt
12. Confidence / Caveats

## Mediator Section Extraction

`src/utils/mediatorExtract.ts` — `extractMediatorSections()`

Simple `###` heading-based splitter. Maps heading text to MediatorSynthesis fields.
Falls back gracefully to empty fields if no headings found.
Extracted content is placed in editable fields — user reviews before saving.

## Distinction Between Layers

| Layer | What it is | Who controls it |
|---|---|---|
| Raw mediator response | Full GPT-5.5 output | GPT-5.5 |
| MediatorSynthesis | Extracted/edited structured fields | User (edits and saves) |
| userDecision | What the user actually decided | User only |
| canonicalStateUpdate | State update applied to project | User (explicit approval) |

## No Automation Boundary

The app never:
- Calls any AI model API
- Scrapes browser sessions
- Automatically applies canonical state updates
- Automatically records decisions
- Automatically locks rounds
