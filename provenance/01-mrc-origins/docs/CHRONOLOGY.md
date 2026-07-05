# RoundTable Artifact Chronology

This chronology follows the artifact trail available in the current chat/runtime. It distinguishes included files from items that were discussed but are not available in the active file set.

## 00. Available Chat Transcript PDF
- **Folder:** `artifacts/00_transcript_context`
- **Phase/version:** Conversation-level provenance artifact
- **Status:** Available; partial by platform/runtime limitation
- **Summary:** PDF transcript of the conversation content accessible to the runtime, with assistant messages left and user messages right. It is useful as provenance, but platform-truncated/skipped segments cannot be recovered verbatim.

## 01. MRC Phase 3.1 Cleanup Changed Files for Gemini
- **Folder:** `artifacts/01_mrc_phase3_1_cleanup_changed_files`
- **Phase/version:** Phase 3.1 — cleanup patch after core round workflow
- **Status:** Available as changed-files bundle
- **Summary:** Focused changed-files bundle used for Gemini review after Phase 3.1 cleanup. It captures the early transition from scaffold/demo workflow into read-only locked-round visibility, canonical-state editor sizing, and system-font hardening.

## 02. MRC Phase 4 Review Files and Gemini Review Packet
- **Folder:** `artifacts/02_mrc_phase4_review_files_and_review`
- **Phase/version:** Phase 4 — mediator packet and decision loop refinement
- **Status:** Available as changed-files bundle plus review packet
- **Summary:** Files and review packet documenting Phase 4 structured mediator synthesis, extraction, decision-loop draft transfer, and next-round prompt support.

## 03. MRC Phase 5.1 Gemini Review Packet
- **Folder:** `artifacts/03_mrc_phase5_1_durability_review`
- **Phase/version:** Phase 5.1 — export/import durability and recovery cleanup
- **Status:** Available as review packet only
- **Summary:** Review packet for the durability gate: JSON import validation firewall, backup-before-import, recovery mode, Markdown export safety, dynamic tilde fencing, and unsupported/orphaned data behavior.

## 04. MRC Phase 6.1 Gemini Review Packet
- **Folder:** `artifacts/04_mrc_phase6_1_maintainability_review`
- **Phase/version:** Phase 6.1 — maintainability gate cleanup
- **Status:** Available as review packet only
- **Summary:** Review packet for maintainability: chronological phase history cleanup, safe ID generation, schema-evolution documentation, maintainability documentation, and typed validation issues.

## 05. MRC Phase 7A.1 Gemini Review Packet
- **Folder:** `artifacts/05_mrc_phase7a_1_migration_safety_review`
- **Phase/version:** Phase 7A.1 — migration safety cleanup
- **Status:** Available as review packet only
- **Summary:** Review packet for schema migration and import compatibility: future-schema rejection, explicit migration notices, validation code hardening, legacy payload support, and Gemini review packet export.

## 06. RoundTable v0.10.4 Response Persistence / Aggregation Baseline
- **Folder:** `artifacts/06_rt_v0_10_4_response_persistence_baseline`
- **Phase/version:** RT v0.10.4 — response persistence and aggregation hardening
- **Status:** Available as full package plus Gemini review packet
- **Summary:** Approved baseline package that fixed the response persistence / aggregation race using functional AppState updaters, updateRoundFunctional, response draft flushes, and canonical mediator generation. This is the latest full code package available in this runtime.

## 07. RoundTable v0.10.5 Mediator Extraction Review Packet
- **Folder:** `artifacts/07_rt_v0_10_5_mediator_extraction_review_only`
- **Phase/version:** RT v0.10.5 — mediator extraction tolerance + state mutation cleanup
- **Status:** Review packet available; full v0.10.5 zip was referenced/uploaded in the conversation but is not present in the active runtime file set
- **Summary:** Review packet documenting the approved v0.10.5 patch: line-based mediator extraction tolerant of heading variants, React purity cleanup in MediatorPanel, migration of remaining replaceRound call sites, and UI copy polish. The actual full package is listed as unavailable in the missing-artifacts register.

## 08. Operational Vite Server Screenshot
- **Folder:** `artifacts/08_operational_vite_screenshot`
- **Phase/version:** Local operational setup context
- **Status:** Available image artifact
- **Summary:** Screenshot showing a Vite dev server running locally from a RoundTable folder and the user’s local version directories. Useful as operational provenance for the local-first workflow.
