# Compatibility Notes

RoundTable — Phase 7B

## Where They Live

- Type: `src/types/compatibilityNote.ts`
- Defaults: `src/config/compatibilityNotes.ts`
- Stored: `AppState.compatibilityNotes`

## Purpose

Compatibility notes track known model quirks and workarounds. Active
notes are automatically included in generated prompts for the
matching model and surfaced in the Round Builder warning panel for
selected models.

## Status Values (Phase 7B)

- `active` — known issue, workaround included in prompts and warned in Round Builder
- `watching` — potential issue, monitoring but not yet confirmed
- `resolved` — issue no longer present (kept for history)
- `deprecated` — note no longer applicable (e.g. model retired) — kept for history

## Severity Values (Phase 7B)

| Severity | When to use |
|---|---|
| `low` | Minor cosmetic quirk; no impact on RoundTable behavior |
| `medium` | Noticeable; user should be aware but workflow continues |
| `high` | Affects output quality enough that the user should adjust |
| `workflow_breaking` | The model can no longer fulfill its assigned role |

The Round Builder warning panel sorts by severity, so
`workflow_breaking` floats to the top. The 0.7→0.8 migration step
defaults missing severity to `'medium'`.

## How to Add a Note

1. Open `src/config/compatibilityNotes.ts` (or edit the durable
   `AppState.compatibilityNotes` array via a future edit UI)
2. Add a new object to the array
3. Set a unique `id`
4. Set `status: 'active'` to include it in generated prompts
5. Set `severity` (Phase 7B)
6. (Optional) Set `linkedModelProfileId` for tighter targeting than
   vendor/modelName matching
7. (Optional) Set `linkedPromptTemplateId` or `linkedPromptWrapperId`
   if the note applies to a specific template/wrapper rather than
   the model in general
8. Save

## Phase 7B Linkage Behavior

When `linkedModelProfileId` is present, both `RoundBuilderPanel` and
`promptGeneration.ts` use it for targeted matching. When absent,
they fall back to vendor + modelName matching — so 0.7-era notes
without linkage still work in 0.8 unchanged.

## How to Resolve a Note

Change `status` to `'resolved'`. It will stop appearing in generated
prompts but stay in the record. Use `'deprecated'` instead when the
note no longer applies because the model itself was retired.

## See Also

- `docs/VENDOR_RESILIENCE.md` — operator's manual for when a model
  changes behavior; covers worked examples of when to add a note vs
  edit a wrapper vs adjust a profile.

## Troubleshooting: Clipboard Issues

If copy buttons fail:
- The app must be served over HTTPS or localhost (not file://)
- Run `npm run dev` to use localhost
- On older browsers, the fallback `execCommand` will be attempted
