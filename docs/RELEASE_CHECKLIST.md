# RoundTable Release Checklist

**Version:** 0.11.0 (Markdown Handoff Mode — Release Candidate)

This checklist prepares you to run your first real operational loop with RoundTable.

---

## Pre-Flight Checks

### Build

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` returns 0 errors
- [ ] `npm audit` reports 0 vulnerabilities

### Version alignment

- [ ] `package.json` version: `0.11.0`
- [ ] `package-lock.json` version: `0.11.0`
- [ ] `SCHEMA_VERSION` in `exportFormats.ts`: `0.11.0`
- [ ] `APP_VERSION` in `exportFormats.ts`: `0.11.0`
- [ ] `ARTIFACT_TYPE` in `exportFormats.ts`: `roundtable.markdown.v1`
- [ ] README current version line: `0.11.0`

### RoundTable rename

- [ ] App header shows "RoundTable"
- [ ] Browser tab title shows "RoundTable"
- [ ] JSON export `appName` field shows "RoundTable"
- [ ] JSON export file prefix: `ROUNDTABLE_PROJECT_...`
- [ ] Markdown export file prefixes: `ROUNDTABLE_...`
- [ ] Gemini Review Packet header: "RoundTable — Gemini Review Packet"
- [ ] No "Model Roundtable Console" or "MRC" in current UI headers
- [ ] No "MRC_" in current export filenames

### Storage key

- [ ] `localStorage` key is `roundtable.appState.v1` (verify in DevTools → Application → Local Storage)

---

## Core Workflow Smoke Test

### Project and state

- [ ] Load demo data (Export / Import → Reset to Demo Data)
- [ ] View Dashboard — round progress, workflow chips visible
- [ ] Edit canonical state in Project State tab → Save → confirm persists after page refresh

### Model Roster

- [ ] All 5 default profiles visible (GPT-5.5 Thinking, Claude Opus, Sonnet, Haiku, Gemini)
- [ ] `defaultPromptWrapperId` and `profileVersion` visible on profiles
- [ ] Deactivate / Reactivate a model — persists after page refresh
- [ ] No profile with `wrapper-claude-implementer` on Haiku (should be `wrapper-haiku-summary`)

### Round Builder

- [ ] Create a new round (+ New Round button)
- [ ] Write a short instruction
- [ ] Select 2-3 models
- [ ] Click "Generate Context Sandwich Prompts"
- [ ] Each prompt appears with Copy button
- [ ] Click Copy → `copy-confirm` badge appears in card header without moving the Copy button

### Responses

- [ ] Navigate to Responses tab
- [ ] Paste a short response for one model
- [ ] Confirm `pastedAt` timestamp appears
- [ ] Status badge updates to "pasted"
- [ ] Next-step cue navigates to Mediator

### Mediator

- [ ] Click "Generate Mediator Packet"
- [ ] Packet appears with "Copy → GPT-5.5 Thinking" button
- [ ] Copy button works; `copy-confirm` badge appears without layout shift
- [ ] Paste a fake mediator response
- [ ] Click "Save & Extract Structured Fields"
- [ ] 12 synthesis fields appear with content
- [ ] `Proposed Canonical State Update` field labeled "⚠ Not auto-applied"
- [ ] Click "Save Structured Synthesis"

### Decision Log

- [ ] "Use mediator recommendation as draft" fills decision text field (does not lock round)
- [ ] "Use proposed canonical update as draft" fills canonical update field (does not lock round)
- [ ] Enter decision text
- [ ] Check "Apply to Project Canonical State"
- [ ] Click "Record Decision & Lock Round" → confirm prompt appears → confirm
- [ ] Round is now locked; `round-locked-banner` visible across all workflow panels
- [ ] Decision appears in decision history

### Next round

- [ ] Go to Round Builder → "Start Next Round From This Prompt" uses proposed prompt
- [ ] New round (Round 2) created, instruction pre-filled

### Export / Import safety

- [ ] Export JSON → file downloads as `ROUNDTABLE_PROJECT_...json`
- [ ] Open the JSON in a text editor → confirm `appName: "RoundTable"`, `exportType: "roundtable.fullProjectExport"`, `schemaVersion: "0.11.0"`
- [ ] In Import tab, paste the JSON → validation preview appears
- [ ] Diff table shows correct counts
- [ ] "Download Backup Now" works
- [ ] "Confirm — Import and Replace State" works after backup step

### Future-schema rejection

- [ ] Edit a JSON export, change `schemaVersion` to `"99.0.0"`
- [ ] Paste it into Import tab → validation shows **UNSUPPORTED_SCHEMA_VERSION error**
- [ ] "Confirm Import" button remains disabled

### Older-schema import

- [ ] Edit a JSON export, change `schemaVersion` to `"0.5.0"`
- [ ] Paste into Import → migration notices appear as warnings
- [ ] Import completes with migrated state

### Markdown exports

- [ ] Export Full Project History → file downloads as `ROUNDTABLE_HISTORY_...md`
- [ ] Open in text editor → readable Markdown, fenced code blocks with `~~~~`
- [ ] Export Gemini Review Packet → downloads as `ROUNDTABLE_GEMINI_REVIEW_...md`
- [ ] Gemini Review Packet header shows "RoundTable — Gemini Review Packet"
- [ ] No API calls, upload, or automation triggered

### Recovery mode

- [ ] Open DevTools → Application → Local Storage → find `roundtable.appState.v1`
- [ ] Edit the value to `{ broken }` (invalid JSON)
- [ ] Reload page → Recovery Mode panel appears
- [ ] "Download Raw Corrupted Data" button visible
- [ ] "Reset to Demo Data" restores app

---

## Mobile Smoke Test

- [ ] Open `http://localhost:5173` on a phone (same WiFi)
- [ ] All tabs visible in scrollable tab bar
- [ ] Round Builder renders single-column
- [ ] Copy buttons are thumb-friendly (≥44px height)
- [ ] Paste textarea large enough for response text
- [ ] No horizontal scroll / overflow
- [ ] Onboarding card visible when no project loaded

---

## Accessibility Smoke Test

- [ ] Tab through Round Builder → all interactive elements reachable by keyboard
- [ ] Focus-visible outline visible on focused elements (amber outline)
- [ ] No icon-only buttons without text labels
- [ ] Locked round state clearly communicated (not just color — text says "Locked")
- [ ] Empty states have title and description text, not just icons

---

## No Unsafe Integrations

- [ ] No API calls to any model provider
- [ ] No background network requests (DevTools → Network tab should be quiet after load)
- [ ] No WebSocket connections
- [ ] No authentication
- [ ] No cloud sync
- [ ] No browser extension hooks

---

## Known Limitations (Phase 9)

1. **Model profile editing** — Display-only in the UI. To edit, update `src/config/modelProfiles.ts`.
2. **Prompt template editing** — Display-only. Edit `src/config/promptTemplates.ts`.
3. **WCAG accessibility audit** — Not yet completed. Practical accessibility pass done in Phase 8/9. Full audit deferred to Phase 10.
4. **Performance at scale** — Not profiled for large round histories (50+ rounds). Deferred to Phase 10.
5. **IndexedDB upgrade path** — `localStorageAdapter` is designed to be replaced with IndexedDB but that hasn't been needed yet.

---

## Operational Trial Instructions

If all checklist items pass, you are ready for a real operational round:

1. **Backup first.** Export JSON before starting.
2. **Set up your real project.** Edit canonical state in Project State tab.
3. **Configure your models.** Deactivate any models you won't use this round.
4. **Start Round 1.** Write a real instruction. Generate prompts. Copy to each model.
5. **Paste responses.** Return after each model responds.
6. **Generate mediator packet.** Copy to GPT-5.5 Thinking. Paste mediator response.
7. **Review synthesis.** Extract structured fields. Edit if needed.
8. **Record decision.** Apply canonical state update if appropriate. Lock round.
9. **Export JSON.** Back up after each round.
10. **Report any friction** to the Phase 10 issue log.

When the app survives one full real loop without critical issues → promote to 1.0.0.

---

## v0.10.5 — Mediator Packet Response Inclusion (workflow-critical)

After upgrading to v0.10.5, run this short manual verification to
confirm the mediator workflow is healthy:

- [ ] In Round Builder, start a round with at least 2 active models selected.
- [ ] Generate prompts and copy them to the target models manually.
- [ ] In the Responses panel, paste a non-trivial response for each
      model (include at least one with embedded triple-backticks or a
      JSON block to exercise the dynamic-tilde fence).
- [ ] Click the `reviewed` button on at least one response.
- [ ] Edit one of the reviewed responses (any small change), blur the
      textarea. Confirm the badge still shows `reviewed` (status
      preservation — not silently demoted to `pasted`).
- [ ] Open the Mediator panel.
- [ ] Verify the **response inclusion summary** shows each model with
      `included — N chars` and the right total counts.
- [ ] Click **Generate Mediator Packet**.
- [ ] Expand the generated packet preview. Confirm there is a
      `# Model Responses for This Round` section, each model has
      its full body fenced with `~~~~markdown ... ~~~~`, and any
      embedded triple-backticks render literally inside the fence.
- [ ] Mark one response `excluded` and click **Regenerate Packet**.
      Confirm the excluded model now appears under
      `# Excluded Responses` (not in the synthesis section), and the
      inclusion summary shows it as `excluded`.
- [ ] Edit a still-included response. Confirm the **stale packet
      banner** appears in the Mediator panel until you click
      Regenerate.
- [ ] Click **Copy → GPT-5.5 Thinking**. Paste into a scratch text
      editor. Confirm response bodies are present in the pasted text.

---

## v0.10.5 — Response Persistence Hardening (workflow-critical)

After upgrading to v0.10.5, run this regression scenario to confirm
the response-persistence path is healthy under Total Serialization:

- [ ] Start a round with at least 4 active models.
- [ ] Generate prompts.
- [ ] Paste a distinct response into each model's textarea. Do NOT
      click outside any textarea between pastes.
- [ ] On the **last** model whose textarea you typed into, immediately
      click the **Reviewed** button (without first clicking outside
      the textarea).
- [ ] Navigate to the Mediator panel.
- [ ] Click **Generate Mediator Packet**. Expand the preview.
- [ ] Confirm the packet contains all 4 response bodies in the
      `# Model Responses for This Round` section, with the expected
      character counts.
- [ ] Confirm the response inclusion summary above the preview shows
      4 × `included — N chars` with no `missing` entries.
- [ ] Refresh the browser page.
- [ ] Open the Responses panel. Confirm all 4 response texts are still
      present in the textareas and the badges still show the right
      status (`pasted` or `reviewed`, never silently demoted).
- [ ] Navigate to the Mediator panel and click **Generate Mediator
      Packet** again. Confirm all 4 bodies still appear.
- [ ] (Optional but recommended) Open browser DevTools → Application
      → Local Storage → `roundtable.appState.v1`. Confirm all 4
      `responseText` values are present in the stored JSON.

---

## v0.10.5 — Mediator Extraction Tolerance (workflow-critical for parser)

After upgrading to v0.10.5, run this short verification of the mediator
extraction tolerance:

- [ ] In the Mediator panel, paste a fake mediator response that uses
      `### 1. Executive Summary` (numbered prefix) and `### 2. Agreements`.
- [ ] Click **Save & Extract Structured Fields**. Confirm both fields
      populate correctly.
- [ ] Repeat with a response that uses `## Executive Summary` (level-2
      heading). Confirm extraction still works.
- [ ] Repeat with `[EXECUTIVE SUMMARY]` and `[AGREEMENTS]` bracket labels.
- [ ] Repeat with `Executive Summary:` and `Agreements:` colon labels
      (no Markdown prefix).
- [ ] Paste a response with a `### Random Internal Note` between known
      headings. Confirm the known headings still extract, and the
      Random Internal Note body is silently dropped (does NOT contaminate
      the previous section).
- [ ] Paste a response with NO known headings at all. Confirm extraction
      returns 0 sections without crashing, and the user can manually
      fill the fields.
- [ ] Verify body content containing `Note: blah` or `Risk: high` mid-line
      is NOT treated as a heading split.

---

## v0.11.0 — Markdown Handoff Mode Acceptance Walk (release-critical)

This section walks the 15 acceptance criteria from the v0.11.0
feasibility plan. The automated walk lives in
`scripts/acceptance-walk.ts`; the manual list below is the
operator-side verification that the automated walk's findings
match what an operator sees in the UI.

**Automated acceptance walk:**

```bash
npx esbuild scripts/acceptance-walk.ts --bundle --platform=node \
  --target=node22 --format=cjs --outfile=/tmp/walk.cjs
node /tmp/walk.cjs
```

Expected output ends with `Summary: 15 pass, 0 partial, 0 fail`.

**Manual operator verification (one full Markdown handoff loop):**

### Same-source guarantee (C1) and round-trip integrity (C2)

- [ ] In Round Builder, generate prompts for a new round with 2+
      models.
- [ ] On any prompt card, click **Download `.md`** → file saves with
      the `RT_PROMPT_*.md` prefix.
- [ ] Open the file in a text editor → confirm the frontmatter
      block starts with `---` on line 1, ends with `---` on its own
      line, contains `artifact_type: "roundtable.markdown.v1"` and
      `source_kind: "generated_prompt"`, and a `content_hash:
      "sha256:..."` value is present (not `null`).
- [ ] In any panel with an Upload `.md` affordance, upload the same
      file → preview modal opens with the target description and
      ZERO error warnings.
- [ ] Click Import → status notice confirms the import; Import
      History shows a new transaction.

### Stale state detection (C3, C4)

- [ ] Edit the project canonical state in Project State panel →
      Save.
- [ ] Upload a previously-exported `.md` for that project →
      preview shows `CANONICAL_STATE_HASH_MISMATCH` warning.
- [ ] In Round Builder, regenerate the prompt for one model (this
      changes the prompt text) → export the OLD response file →
      upload it → preview shows `PROMPT_HASH_MISMATCH` warning.

### Post-export edit detection (C5)

- [ ] Export a model response as `.md`.
- [ ] Open the file in a text editor; change a word in the body.
- [ ] Upload the edited file → preview shows `CONTENT_HASH_MISMATCH`
      warning.

### Malformed YAML → Raw Notes (C6)

- [ ] Create a file with the frontmatter `---\nartifact_type: [bad\n---\nbody.\n`.
- [ ] Upload it → preview shows `FRONTMATTER_PARSE_FAILED` warning,
      the Import button is NOT available, the Import as Raw Notes
      button IS available.
- [ ] Click Import as Raw Notes → Raw Notes panel shows the entry
      with `malformed` status.

### Truncated body → partial warning (C7)

- [ ] Take a clean `.md` export; in a text editor, delete the
      closing fence line so the fenced block is open.
- [ ] Upload → preview shows `UNCLOSED_CODE_FENCE` warning.
- [ ] Truncate a different file mid-prose (no fence involved, last
      char is not a terminator) → preview shows `POTENTIALLY_TRUNCATED`
      info.

### Code-fence-aware extraction (C8)

- [ ] Construct a mediator_synthesis `.md` whose body has a
      `~~~~markdown` fence containing a fake `### Risks` heading,
      followed by a REAL `### Risks` section outside the fence.
- [ ] Import as structured → check the mediator panel — the Risks
      field shows the REAL section content, not the fence content.

### CRLF/LF stability (C9)

- [ ] Open a `.md` export in a Windows-style editor and save it
      with CRLF line endings.
- [ ] Upload to RoundTable → preview shows NO `CONTENT_HASH_MISMATCH`.
- [ ] Add a leading BOM to the file (some Windows editors do this
      automatically) → upload → still no hash mismatch.

### Rollback (C10)

- [ ] Import a response that overwrites an existing slot → click
      Import in the modal, observe the two-step "⚠ Confirm Import"
      gate, commit.
- [ ] Open Import History → confirm the transaction lists
      "overwrote existing" in the change description.
- [ ] Click Rollback on the most recent transaction → confirm
      reason prompt → submit.
- [ ] Verify the response body is restored AND the previous status
      (`reviewed` / `excluded` / `pasted`) is intact.

### No silent data loss (C11)

- [ ] Upload a plain `.txt`-style file (no frontmatter) → Raw
      Notes saves it with `malformed` status and the body intact.
- [ ] Upload a file with `artifact_type: "something.else.v1"` →
      Raw Notes saves it with the body intact.

### Forward-schema rejection (C12)

- [ ] Edit a `.md` export and change `schema_version` to `"99.0.0"`.
- [ ] Upload → preview shows `UNSUPPORTED_SCHEMA_VERSION` error.
- [ ] Import button is NOT available; Import as Raw Notes IS
      available.

### Migration safety (C13)

- [ ] Export an old v0.10.5 JSON (or any pre-v0.11.0 JSON without
      `rawNotes` / `importHistory`).
- [ ] Import → migration notices show `Added top-level "rawNotes"
      array (empty)` and `Added top-level "importHistory" array
      (empty)`.
- [ ] After import, open Raw Notes / Import History panels — both
      are empty but the panels function.

### No new network surfaces (C14)

- [ ] Open DevTools → Network tab → reload RoundTable. After
      bundle load, the Network tab should remain quiet during the
      full Markdown handoff loop (Download, Upload, Import,
      Rollback, Save as Raw Note).
- [ ] Codebase verification:
      `grep -rE "\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|RTCPeerConnection" src/`
      returns no functional call sites (only comments / static
      vendor URLs in modelProfiles.ts).

### Existing v0.10.5 workflows unaffected (C15)

- [ ] Run the v0.10.5 Mediator extraction tolerance checklist
      above — confirm all cases still pass.
- [ ] Run the v0.10.5 Response Persistence Hardening checklist
      above — confirm all cases still pass.
- [ ] Generate a mediator packet via the existing Copy → GPT-5.5
      flow (no Markdown handoff involvement) → confirm the
      packet text matches the legacy format.

### Optional Raw Notes delete (Checkpoint I)

- [ ] In Raw Notes panel, click the Delete button on a row → confirm
      dialog appears.
- [ ] Cancel → row stays.
- [ ] Click Delete → confirm → row is removed.

### Storage pressure banner

- [ ] In a controlled test (or by importing a very large file
      multiple times), push serialized AppState past 3.5 MB →
      confirm the `warn` banner appears with action links to
      Raw Notes, Import History, and Export / Import.
- [ ] Push past 4.25 MB → confirm the `hard` banner appears with
      the same actions, and structured commits trigger a
      `window.confirm` projection gate.

---

## v0.12.0 — PWA installability + Netlify hosting (Checkpoint K)

This section is the operator's manual verification list for the
PWA implementation bundle delivered in Checkpoint K. It assumes
the build artifacts have been deployed to Netlify (or another
HTTPS-capable static host).

**Pre-deploy checks** (local):

- [ ] `npm install` reports 0 vulnerabilities
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] `dist/manifest.webmanifest` exists and parses as valid JSON
- [ ] `dist/sw.js` exists and references the precache manifest
- [ ] `dist/workbox-*.js` exists alongside `sw.js`
- [ ] `dist/favicon.png`, `dist/apple-touch-icon.png`,
      `dist/icon-192.png`, `dist/icon-512.png`,
      `dist/icon-192-maskable.png`, `dist/icon-512-maskable.png`
      all exist
- [ ] `dist/index.html` includes
      `<link rel="manifest" href="./manifest.webmanifest">`
- [ ] `dist/index.html` includes
      `<meta name="theme-color" content="#0d0f11">`
- [ ] `dist/index.html` includes the four Apple-specific meta
      tags (`apple-mobile-web-app-capable`,
      `apple-mobile-web-app-status-bar-style`,
      `apple-mobile-web-app-title`, `apple-touch-icon`)
- [ ] `dist/index.html` viewport meta includes `viewport-fit=cover`

**Local PWA preview** (`npm run preview`):

- [ ] App loads at `http://localhost:4173`
- [ ] Chrome DevTools → Application → Manifest renders the
      manifest with all six icons
- [ ] Chrome DevTools → Application → Service Workers shows
      `sw.js` registered and active
- [ ] First load: "Offline Ready" banner appears once, then
      auto-dismisses after ~8 seconds
- [ ] After install (Chrome URL-bar install icon → Install
      RoundTable), the app opens in a standalone window
- [ ] DevTools console shows
      `[RoundTable] navigator.storage.persist() → granted` (or
      `not granted`, depending on browser policy)

**Hosted PWA verification** (after Netlify deploy):

- [ ] Site loads at the HTTPS Netlify URL
- [ ] Lighthouse → Progressive Web App audit passes the
      installability criteria
- [ ] Lighthouse → Best Practices reports no SW or manifest
      warnings
- [ ] Install affordance appears in Chrome / Edge / Brave URL
      bar within ~30 seconds of first visit
- [ ] On iOS Safari, Share Sheet → "Add to Home Screen" succeeds
      and the home-screen icon shows the RT monogram
- [ ] On Android Chrome, the install prompt appears in the
      bottom sheet within a minute of first visit
- [ ] Reload the page → app loads from cache (DevTools →
      Network → "Offline" toggle, then reload; app shell still
      renders)
- [ ] Deploy a new build → revisit the deployed site → the
      "Update Available" banner appears within seconds → click
      "Reload to update" → page reloads on the new bundle hash
- [ ] Click "Later" → banner disappears for the session → reload
      manually → banner reappears (SW still waiting)

**Mobile UX spot checks:**

- [ ] Open the deployed PWA on a notched iOS device (or
      simulator with notch enabled). Header sits below the
      dynamic island; tab nav sits above the home indicator.
- [ ] Pull-to-refresh at the top of a panel does not reload the
      PWA (overscroll-behavior is working).
- [ ] Long-press on a tab button does not show the iOS
      selection-menu callout (user-select: none is working).
- [ ] All primary action buttons (Confirm, Import, Roll back,
      Reset to demo, Reload to update) are at least 44 px tall.

**Markdown handoff under PWA:**

- [ ] On the deployed PWA, download a Markdown artifact from
      Round Builder → file saves correctly (desktop: quiet save;
      iOS: Share Sheet → Save to Files; Android: quiet save to
      Downloads).
- [ ] On the deployed PWA, upload the same Markdown artifact in
      another panel → preview modal opens, structured commit
      works, transaction lands in Import History.
- [ ] In Chrome DevTools → Network, after first load, no
      RoundTable-domain requests appear during the entire
      workflow (the SW is serving everything from cache; the app
      makes no runtime network calls).

**Pass criteria:** every checkbox above marked done. Any failure
is documented in `CHECKPOINT_STATE_K.md` or in a follow-up
checkpoint note before tagging v0.12.0 as a release candidate.

