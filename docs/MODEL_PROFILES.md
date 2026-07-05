# Model Profiles

RoundTable — Phase 7B

## Where They Live

- Type: `src/types/modelProfile.ts`
- Defaults: `src/config/modelProfiles.ts`
- Stored: `AppState.modelProfiles`

## How to Add a New Model

1. Open `src/config/modelProfiles.ts`
2. Copy an existing profile object
3. Set a unique `id` (snake_case, no spaces, e.g. `gpt4o_mini`)
4. Fill in all required fields
5. (Optional) Populate Phase 7B vendor-resilience fields
6. Set `active: true` if it should appear by default
7. Save — no other files need to change

## Required Fields

- `id` — unique identifier (do not change after first use)
- `displayName` — shown in UI
- `vendor` — e.g. "OpenAI", "Anthropic", "Google"
- `modelName` — model string for reference
- `roleName` — short role label (shown prominently in UI)
- `rolePrompt` — full role instructions included in every prompt for this model
- `promptStyleNotes` — notes about how this model prefers to receive prompts
- `contextLimitNotes` — context window and memory notes
- `compatibilityNotes` — model-level notes (use CompatibilityNotes for issue tracking)
- `active` — whether the model appears in Round Builder

## Phase 7B Optional Fields (vendor resilience)

| Field | Purpose |
|---|---|
| `profileVersion` | Bump when this profile's behavior assumptions materially change |
| `vendorUrl` | Link to the vendor's docs page for this model |
| `contextWindowNotes` | Free-form note on context window size and behavior |
| `preferredOutputFormat` | What format the model produces best |
| `defaultPromptTemplateId` | Default prompt template id for this model |
| `defaultPromptWrapperId` | Default wrapper id (Phase 7B) — resolves to `wrapper-generic` if absent |
| `modelBehaviorNotes` | Observed behavior in RoundTable use |
| `formattingNotes` | Markdown / structured-output habits |
| `refusalRiskNotes` | Refusal patterns + workaround phrasing |
| `strengths` | Free-form, comma-separated OK |
| `weaknesses` | Free-form |
| `lastReviewedAt` | ISO date of last manual review |

All Phase 7B fields are optional. They render in
`ModelRosterPanel` as read-only blocks only when populated. The
0.7→0.8 migration step defaults `defaultPromptWrapperId` to
`wrapper-generic` on profiles that lack it; other Phase 7B fields
stay missing on imports that didn't have them (free-form prose is
never fabricated).

## Changing an Existing Profile

Safe: update `rolePrompt`, `promptStyleNotes`, `contextLimitNotes`,
`compatibilityNotes`, `active`, any Phase 7B optional field.

Unsafe: changing `id` will orphan existing rounds that reference
that model ID.

When you make a meaningful change, also bump `profileVersion` and
update `lastReviewedAt`. This is documented as the maintenance
pattern in `docs/VENDOR_RESILIENCE.md`.

## See Also

- `docs/VENDOR_RESILIENCE.md` — when a model changes its behavior,
  this is where to start.
