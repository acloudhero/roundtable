# RoundTable v0.10.4 — Gemini Review Packet

## Review Context

**Project:** RoundTable  
**Review Target:** v0.10.4 response persistence / aggregation hardening  
**Base:** v0.10.3  
**Reviewer preparing packet:** GPT-5.5 Thinking  
**Purpose:** Independent review of whether v0.10.4 resolves the response persistence / aggregation race condition without introducing unsafe integrations.

## GPT-5.5 Gate Status

GPT-5.5 inspected the full `rt-v104.zip` package and verified:

- `npm ci` passes
- `npm run build` passes
- TypeScript errors: 0
- `package.json`: 0.10.4
- `package-lock.json`: 0.10.4
- `SCHEMA_VERSION`: 0.10.4
- `APP_VERSION`: 0.10.4
- `npm audit`: 0 vulnerabilities during Opus report; GPT-5.5 also saw clean install/build locally
- Original uploaded zip did **not** include `node_modules` or `dist`
- No APIs, scraping, browser automation, auth, backend, cloud sync, or new dependencies found

## Bug Being Reviewed

v0.10.3 fixed mediator response inclusion, but Gemini identified a remaining race risk:

1. The textarea may hold the latest pasted response locally.
2. A user clicks a status/workflow button before blur/save completes.
3. Blur and click dispatch state updates in the same React batch.
4. If each update computes a full `rounds` array from stale closure state, one can overwrite the other.
5. The UI can mark a response collected/reviewed while the actual response text is missing from canonical round state.

v0.10.4 claims to harden this using a **Total Serialization** principle: workflow transitions must commit/operate on canonical saved round state, not transient DOM/local draft state.

## Files Changed Relevant to Review

- `src/types/appState.ts`
- `src/App.tsx`
- `src/utils/roundUtils.ts`
- `src/components/ResponsesPanel.tsx`
- `src/components/MediatorPanel.tsx`
- panel prop signature updates for `AppStateUpdater`
- `package.json`, `package-lock.json`, `src/config/exportFormats.ts`
- `README.md`, `docs/PHASE_HISTORY.md`, `docs/RELEASE_CHECKLIST.md`

## Key Implementation Claims

### 1. `AppStateUpdater` added

`onUpdate` now accepts either a legacy `Partial<AppState>` or a functional updater:

~~~ts
export type AppStateUpdater =
  | Partial<AppState>
  | ((prev: AppState) => Partial<AppState>);
~~~

### 2. App-level update resolves function inside latest state

~~~ts
const onUpdate = useCallback((arg: AppStateUpdater) => {
  setState((prev) => {
    const partial = typeof arg === 'function' ? arg(prev) : arg;
    return { ...prev, ...partial, updatedAt: nowIso() };
  });
}, []);
~~~

### 3. `updateRoundFunctional()` added

This helper resolves the target round inside the latest `prev.rounds` state rather than using a closure-captured `state.rounds` array.

~~~ts
export function updateRoundFunctional(
  roundId: string,
  recipe: (round: Round) => Round
): (prev: AppState) => Partial<AppState> {
  return (prev: AppState): Partial<AppState> => {
    const target = prev.rounds.find((r) => r.id === roundId);
    if (!target) return {};
    const updated = recipe(target);
    return {
      rounds: prev.rounds.map((r) => (r.id === roundId ? updated : r)),
    };
  };
}
~~~

### 4. Response status transition commits text and status atomically

`ResponsesPanel.handleStatusChange()` now uses `updateRoundFunctional()`, calls `upsertModelResponse()` with the latest local text, then layers the status change onto the same latest-round update.

### 5. ResponsesPanel unmount flush

When leaving the Responses tab, a cleanup flushes local drafts into canonical round state using a single functional updater. This is intended to protect cross-panel transitions into Mediator.

### 6. Explicit flush before navigating to Mediator

The “Generate Mediator Packet” navigation button in Responses uses `flushAllDraftsAndNavigate('mediator')`, which commits all local drafts before tab change.

### 7. Mediator generation reads latest canonical round

`MediatorPanel.handleGenerate()` now reads `liveRound` from `prev.rounds` inside a functional updater before generating the mediator packet, so mediator generation does not use a stale round closure.

### 8. `upsertModelResponse()` preserves existing displayName

If a caller has no display name during unmount flush, `upsertModelResponse()` preserves the existing display name rather than overwriting it with empty string.

## GPT-5.5 Review Result

**Status:** Approved / Pass, with minor non-blocking notes.

The core response-persistence race is addressed in the critical paths:

- blur save
- status change
- response tab → mediator navigation
- mediator packet generation
- local persistence on state update

## Non-Blocking Notes for Gemini to Review

1. `MediatorPanel.handleSaveResponse()` and `handleSaveSynthesis()` still use legacy `replaceRound(state, updated)`. GPT-5.5 does not consider this a blocker for the v0.10.4 response aggregation bug because these paths are not the model-response textarea/status race, but future hardening could move all round mutations to `updateRoundFunctional()`.

2. `ResponsesPanel` still says “Changes save on focus-out.” The behavior is now stronger than that: status actions and mediator navigation also flush drafts. This is copy polish only.

3. `MediatorPanel.handleGenerate()` calls `setGeneratedPacket(packet)` inside an `onUpdate` functional updater. It builds and works; Opus flagged this as a known limitation. Future cleanup could compute packet outside or split display update differently if React behavior changes.

4. `replaceRound()` remains exported for legacy call sites. This is acceptable for now but may be worth Phase 8/v0.11 cleanup.

## Suggested Gemini Review Questions

1. Does v0.10.4 satisfy the “Total Serialization” principle for the response persistence / aggregation bug?
2. Are there any remaining race conditions in the model response → status → mediator generation path?
3. Should remaining `replaceRound(state, updated)` call sites be considered blockers or future cleanup?
4. Is the unmount-flush + explicit flush-before-navigate strategy sound enough for a React local-first app?
5. Is the package ready to be treated as the fixed v0.10.4 baseline?

## Acceptance Gate to Evaluate

v0.10.4 passes only if:

1. App builds cleanly.
2. TypeScript errors are zero.
3. Pasted response text is durably saved.
4. Status changes do not erase or bypass response text.
5. Clicking Reviewed / Collected immediately after pasting still saves the response.
6. Mediator / aggregate output includes all saved model responses.
7. Refreshing the page does not lose pasted responses.
8. Status-only updates preserve response text and metadata.
9. No APIs, scraping, browser automation, auth, backend, cloud sync, or new dependencies are introduced.
10. Version references are aligned at 0.10.4.
