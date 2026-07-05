# Vendor Resilience

RoundTable — how to adapt RoundTable when ChatGPT, Claude,
Gemini, or another model changes its behavior.

This is the Phase 7B operator's manual. When a model you use
materially changes — new name, new context limits, different markdown
habits, harsher refusals, different formatting — this document tells
you where to make the adjustment so RoundTable keeps working.

The short version: **vendor-specific behavior lives in configuration
and AppState, not in code.** If you find yourself wanting to change a
component or utility to accommodate a model, stop and read the right
section below — there is almost certainly a config file that should
own that change instead.

---

## When a model's behavior changes — the decision tree

```
A model changed. What did it change?

├── Its name, vendor, or model ID                    → ModelProfile field
├── Its context window or limits                     → ModelProfile field
├── Its formatting habits (markdown, headings)       → PromptWrapper.outputInstructions
├── Its refusal tendencies                           → ModelProfile.refusalRiskNotes
├── Its preferred prompt structure                   → PromptWrapper.wrapperText
├── A specific quirk or workaround you discovered    → CompatibilityNote
├── Its output is wrong in a new, recurring way      → New compatibility test
└── Its strengths/weaknesses in a role               → ModelProfile.strengths / weaknesses
```

If your situation isn't on the tree, default to **CompatibilityNote**
— it's the most general surface and the Round Builder will display it
the next time the affected model is selected.

---

## How to edit ModelProfile fields

ModelProfile is the per-model description: who the model is, what
role it plays, what wrapper to use, what quirks to expect. Edit it
in `src/config/modelProfiles.ts`. Changes take effect after a reload
(or a re-render in dev).

Required fields (do not remove): `id`, `displayName`, `vendor`,
`modelName`, `roleName`, `rolePrompt`, `promptStyleNotes`,
`contextLimitNotes`, `compatibilityNotes`, `active`.

Phase 7B optional fields:

| Field | When to edit | Example |
|---|---|---|
| `profileVersion` | Bump when you make a meaningful behavior change to this profile so future you remembers the rev | `"2.0"` |
| `vendorUrl` | Vendor's docs page for this model | `"https://platform.openai.com/docs/models/..."` |
| `contextWindowNotes` | Free-form note on context window size and behavior | `"~200k tokens; degrades past ~120k in practice"` |
| `preferredOutputFormat` | What format the model produces best | `"GitHub-flavored Markdown with explicit ### headings"` |
| `defaultPromptTemplateId` | Default template id for this model | `"prompt-implementation"` |
| `defaultPromptWrapperId` | Default wrapper id for this model | `"wrapper-claude-implementer"` |
| `modelBehaviorNotes` | What you've observed about this model in RoundTable use | `"Drifts toward elaboration without explicit length caps"` |
| `formattingNotes` | Markdown / structured-output habits | `"Sometimes drops ### headings in thinking mode"` |
| `refusalRiskNotes` | When this model tends to refuse and how to phrase prompts to avoid it | `"Refuses on anything that looks like prod credentials; always use placeholders"` |
| `strengths` | Free-form, comma-separated OK | `"deep refactors, type-system reasoning"` |
| `weaknesses` | Free-form | `"long-tail Python ecosystem, niche frameworks"` |
| `lastReviewedAt` | ISO date you last manually reviewed this profile | `"2026-05-09"` |

All optional fields render in `ModelRosterPanel` only when populated,
so empty fields are not noisy. To edit interactively today: edit the
config file. (Full in-app editing UI is deferred to Phase 8.)

### Worked example: Claude Sonnet got better at long contexts

You're using `claude-sonnet-4.6` and notice it's now competent at
contexts you previously routed to Opus.

1. Open `src/config/modelProfiles.ts`.
2. Find the Sonnet profile.
3. Update `contextWindowNotes`: `"Now reliable up to ~150k tokens"`.
4. Update `strengths`: append `", long-context summaries"`.
5. Update `lastReviewedAt`: today's date.
6. Bump `profileVersion`: e.g. `"1.1"` → `"1.2"`.

That's it. Round Builder will show the updated notes for any round
that selects Sonnet. No prompt-generation code needs to change.

---

## How to choose or edit prompt wrappers

A **prompt wrapper** is the vendor-specific framing that wraps the
Context Sandwich. It contributes a header (`wrapperText`) prepended
above the Sandwich and a footer (`outputInstructions`) appended below
it. The Sandwich itself is unchanged.

Wrappers live in `src/config/promptWrappers.ts`. Default set
shipped with RoundTable:

| Wrapper id | Purpose |
|---|---|
| `wrapper-generic` | Safe fallback. Used by `migration.ts` and `promptGeneration.ts` when no other wrapper resolves. **Do not rename or remove this one.** |
| `wrapper-gpt55-mediator` | GPT-5.5 mediator framing — emphasizes the 12 structured synthesis sections |
| `wrapper-claude-implementer` | Claude Opus/Sonnet implementer framing — emphasizes work-window guidance and carryover permission |
| `wrapper-gemini-reviewer` | Gemini reviewer framing — emphasizes architecture risk + acceptance gate questions |
| `wrapper-haiku-summary` | Haiku/small-model framing — emphasizes brevity caps |

### Wrapper resolution order

For a given model in `promptGeneration.ts`:

1. Explicit `wrapper` argument (rare; only used in tests/inline calls).
2. `model.defaultPromptWrapperId` resolved against the AppState
   `promptWrappers` array.
3. The Generic wrapper (`wrapper-generic`).
4. None — Sandwich shape unchanged from Phase 5/6/7A.

### When to edit an existing wrapper vs add a new one

**Edit in place** when the change applies to all uses of this wrapper
— a typo fix, a wording clarification, a new section header you
always want to see.

**Add a new wrapper** when the change is divergent — a different role
profile that uses the same vendor, or an experimental wrapper you
want to A/B against the existing one.

When adding a wrapper:

1. Open `src/config/promptWrappers.ts`.
2. Copy an existing wrapper as a template.
3. Give it a unique `id` (kebab-case OK).
4. Tune `wrapperText` (header) and `outputInstructions` (footer).
5. Set `active: true` and a starting `version`.
6. To make a model default to it, set the matching ModelProfile's
   `defaultPromptWrapperId` to your new id.

### Worked example: GPT-5.5 starts dropping headings

You notice GPT-5.5 in thinking mode is omitting some of the 12
mediator synthesis headings in its responses.

1. Open `src/config/promptWrappers.ts`.
2. Find `wrapper-gpt55-mediator`.
3. In `outputInstructions`, strengthen the language:
   *"Every section must appear, even if briefly. Do not omit headings."*
4. Bump `version` to `"0.8.1"`.
5. Add a `CompatibilityNote` describing the regression so the next
   reviewer can read the history (see below).

---

## How to version prompt templates

Prompt templates also have version metadata in Phase 7B. Edit them
in `src/config/promptTemplates.ts`.

### When to bump version vs edit in place

- **Bump version** when changing prompt behavior in a way that
  materially affects model output — e.g. retuning a synthesis
  template for a new model release, restructuring sections.
- **Edit in place** for typo fixes or minor wording clarification.

### When to supersede a template instead of editing it

If a template's behavior is changing enough that historical rounds
would no longer reproduce, **supersede it**:

1. Create a new template with a new `id`.
2. Set the new template's `supersedesTemplateId` to the old id.
3. Mark the old template `active: false` (don't delete — kept rounds
   may still reference its `id`).
4. Update any `ModelProfile.defaultPromptTemplateId` references.
5. In the new template's `changelog`, summarize the change.

The Prompt Library panel shows version, supersedes link, and
changelog when populated.

### How to preserve old prompt behavior before tuning for a new model

Default approach: supersede rather than edit. The old template stays
in the array (just `active: false`), so any historical Round that
referenced it by id continues to render correctly when you scroll
back through Project History.

---

## How to add compatibility notes

Compatibility notes live in `src/config/compatibilityNotes.ts` (the
defaults shipped with RoundTable) and in `AppState.compatibilityNotes` (the
durable list the user accumulates). UI for editing the durable list
in-app is currently minimal — for now, edit the config file.

Phase 7B fields:

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Unique. Use a stable kebab-case id. |
| `vendor` | yes | e.g. `"OpenAI"`, `"Anthropic"`, `"Google"` |
| `modelName` | yes | The model you're tracking |
| `issue` | yes | Short description of the observed behavior |
| `workaround` | yes | What to do about it |
| `dateObserved` | yes | ISO date |
| `status` | yes | `'active'` \| `'watching'` \| `'resolved'` \| `'deprecated'` |
| `severity` | recommended | `'low'` \| `'medium'` \| `'high'` \| `'workflow_breaking'` |
| `impact` | optional | Free-form description of impact |
| `linkedModelProfileId` | optional | Tighter targeting than vendor/modelName match |
| `linkedPromptTemplateId` | optional | Note applies to a specific template |
| `linkedPromptWrapperId` | optional | Note applies to a specific wrapper |
| `reviewedAt` | optional | ISO date of last review |

When `linkedModelProfileId` is set, `RoundBuilderPanel` and
`promptGeneration.ts` use it for targeted matching; otherwise they
fall back to vendor/modelName matching (which is how Phase 5/6/7A
notes still apply).

### Severity guide

| Severity | When to use |
|---|---|
| `low` | Minor cosmetic quirk; no impact on RoundTable behavior |
| `medium` | Noticeable; user should be aware but workflow continues |
| `high` | Affects output quality enough that the user should adjust |
| `workflow_breaking` | The model can no longer fulfill its assigned role; consider switching wrappers, profiles, or models |

The Round Builder warning panel sorts by severity, so
`workflow_breaking` floats to the top.

### Worked example: Gemini stops emitting clean Markdown

Gemini begins wrapping responses in HTML elements that break RoundTable's
Markdown exports.

1. Add a CompatibilityNote in `src/config/compatibilityNotes.ts`:
   - `vendor: "Google"`, `modelName: "gemini-2.5-pro"`
   - `issue: "Wraps responses in HTML elements; breaks tilde fences."`
   - `workaround: "Add explicit 'use markdown only, no HTML' to wrapperText."`
   - `severity: "high"`, `status: "active"`, `dateObserved: "2026-05-09"`
   - `linkedPromptWrapperId: "wrapper-gemini-reviewer"` (so the note
     points at the wrapper that should be tightened).
2. In `src/config/promptWrappers.ts`, append the requested phrasing
   to `wrapper-gemini-reviewer.outputInstructions`.
3. Bump the wrapper's `version`.

---

## How to use compatibility test prompts

Phase 7B ships a small library of manual paste-into-model behavior
tests in `src/config/compatibilityTests.ts`. Defaults cover:

- Structured Output Compliance
- Markdown Formatting
- Implementation Report Shape
- Architecture Critique Shape (Gemini)
- Mediator Synthesis Shape (GPT-5.5)
- Summary + Checklist Shape (Haiku)

These are **paste-only**. RoundTable does not run them. The user opens
`PromptLibraryPanel`, finds a relevant test, clicks "Copy Test
Prompt", pastes into the target model, reads the response, and
decides whether the model still fits RoundTable expectations.

### When to add a new test

Add one when you discover a recurring failure mode. The test should
be:

- **Focused on one behavior.** Don't bundle three checks into one
  test prompt.
- **Reproducible.** A passing run today should look like a passing
  run six months from now.
- **Brief.** Long tests are less likely to be run.

To add: copy an existing entry in
`src/config/compatibilityTests.ts`, give it a unique id, set
`promptText` and `expectedShape`, and save. The Prompt Library will
show it next reload.

---

## Gemini Review Packet workflow

The Gemini Review Packet, introduced in Phase 7A, is preserved and
extended in Phase 7B.

**Flow:**

1. In `Export / Import → Markdown exports`, click **Gemini Review Packet**.
2. RoundTable produces a local `.md` file. **RoundTable does not call Gemini.**
3. Open the `.md` file. Edit the placeholder fields if you want
   (especially "GPT-5.5 Mediator Gate Status" and "Specific
   Questions for Gemini").
4. Paste the contents into Gemini yourself.
5. Read Gemini's response. Bring useful feedback back into RoundTable by
   recording a Decision, updating canonical state, or adding a
   compatibility note.

Phase 7B adds these summary sections to the packet (when populated):

- Model Profile Summary — active profiles with wrapper id, profile
  version, and last-reviewed date.
- Prompt Wrapper Summary — wrapper id, vendor/role, version, purpose.
- Prompt Template Versions — template id, version, updatedAt,
  supersedes link.
- Compatibility Test Prompt Library — names + purpose only (full
  prompts live in config).

The packet is, and remains, a **local Markdown file**. Phase 7B does
not introduce upload, posting, automation, or any network behavior.

---

## What not to automate

These are explicit non-goals for Phase 7B and remain non-goals for
all future phases unless an explicit charter change occurs:

- ❌ **Do not** add API calls to OpenAI, Anthropic, Google, or any
  model provider.
- ❌ **Do not** add browser automation, login automation, or scraping
  of model-provider sites.
- ❌ **Do not** add "auto-send to Gemini" or any automatic upload of
  the Review Packet.
- ❌ **Do not** add automatic submission/retrieval of compatibility
  test prompts. They are paste-only by design.
- ❌ **Do not** add cloud sync, backend services, authentication, or
  database servers.
- ❌ **Do not** build a browser extension.

The whole point of Phase 7B is that **the user remains in the loop**
when models change. A machine adapting to model changes without the
user is precisely the failure mode this phase exists to prevent.

---

## Examples of vendor/model changes and how to respond

### "ChatGPT changed its model name from gpt-5.5 to gpt-5.5-thinking"

- Update the `modelName` field on the affected ModelProfile.
- Bump `profileVersion`.
- Update `lastReviewedAt`.

### "Claude Opus 4.7 was deprecated in favor of 4.8"

- Add a new ModelProfile for 4.8 with a new `id`.
- Mark the old profile `active: false` (don't delete — kept rounds
  reference its id).
- Update `defaultPromptWrapperId` on the new profile if needed.
- If 4.8 has different behavior in a role, update the wrapper's
  `outputInstructions`.

### "Gemini's context window doubled but it gets confused near the end"

- Update `contextWindowNotes` on the Gemini ModelProfile to describe
  both the new size and the practical degradation point.
- Add a CompatibilityNote with `severity: "medium"` describing the
  end-of-window confusion.
- Bump `lastReviewedAt`.

### "A model started refusing prompts that mention 'production credentials'"

- Set or update `refusalRiskNotes` on that ModelProfile with the
  observed pattern and the workaround phrasing.
- If the workaround is wrapper-specific, also tighten the relevant
  wrapper's `wrapperText` to pre-empt the refusal.

### "A new model is available and we want to add it"

- Add a new ModelProfile in `src/config/modelProfiles.ts` with all
  required fields populated and as many Phase 7B optional fields as
  you have observations for.
- Pick a `defaultPromptWrapperId` (start with `wrapper-generic` if
  uncertain, then refine).
- If you have a known quirk on day one, add a CompatibilityNote with
  `linkedModelProfileId` set to the new profile's id.

### "An existing wrapper no longer works for a model that updated"

- Edit the wrapper's `wrapperText` or `outputInstructions`.
- Bump the wrapper's `version`.
- If the change is divergent enough that historical rounds shouldn't
  use the new wrapper, add a *new* wrapper with a new id and switch
  the relevant ModelProfile's `defaultPromptWrapperId` to it.

---

## Where the architecture lives (for hand-off to future implementers)

| Concern | File |
|---|---|
| ModelProfile schema | `src/types/modelProfile.ts` |
| Default model profiles | `src/config/modelProfiles.ts` |
| PromptTemplate schema | `src/types/promptTemplate.ts` |
| Default prompt templates | `src/config/promptTemplates.ts` |
| PromptWrapper schema | `src/types/promptWrapper.ts` |
| Default prompt wrappers + `GENERIC_WRAPPER_ID` | `src/config/promptWrappers.ts` |
| CompatibilityNote schema | `src/types/compatibilityNote.ts` |
| Default compatibility notes | `src/config/compatibilityNotes.ts` |
| CompatibilityTest schema | `src/types/compatibilityTest.ts` |
| Default compatibility tests | `src/config/compatibilityTests.ts` |
| Wrapper resolution + Sandwich assembly | `src/utils/promptGeneration.ts` |
| Migration step 0.7→0.8 (defaults wrappers, severity, active) | `src/utils/migration.ts` |
| Round Builder warning panel | `src/components/RoundBuilderPanel.tsx` (`CompatibilityWarnings`) |
| Read-only display of new ModelProfile fields | `src/components/ModelRosterPanel.tsx` |
| Wrapper + test display + copy button | `src/components/PromptLibraryPanel.tsx` |
| Gemini packet vendor-resilience sections | `src/utils/markdownExport.ts` (`exportGeminiReviewPacket`) |

If you find yourself wanting to put vendor-specific behavior anywhere
*else* (in the prompt-generation utility hardcoded, in a UI
component, in roundUtils, in storage, in validation, in migration
beyond the defaulting step), **stop**. The whole point of Phase 7B
is that those places do not own vendor behavior. The eight files in
the table above own it. Edit there.
