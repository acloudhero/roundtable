# RoundTable Project Visibility Reconstruction

This bundle recreates the artifact chain that is available from the current chat/runtime and organizes it in chronological order. Each artifact folder includes its own `README.md` explaining what the artifact is, where it fits in the project, and what limitation applies.

## Important limitation

This reconstruction only includes files that are present in the active runtime file set. Several packages were discussed or reportedly uploaded earlier in the conversation but are not available here. Those are listed in `docs/MISSING_OR_UNAVAILABLE_ARTIFACTS.md`. They have not been fabricated.

## Top-level files

- `docs/CHRONOLOGY.md` — chronological artifact trail.
- `docs/CURRENT_BASELINE_SUMMARY.md` — current included baseline and approved-but-missing notes.
- `docs/GITHUB_VISIBILITY_GUIDE.md` — recommended way to expose the project on GitHub/portfolio.
- `docs/MISSING_OR_UNAVAILABLE_ARTIFACTS.md` — honest list of unavailable referenced artifacts.
- `MANIFEST.sha256` — integrity hashes for generated and copied files.
- `artifact_chain.json` — machine-readable metadata index.

## Included artifact folders

- `artifacts/00_transcript_context` — Available Chat Transcript PDF
- `artifacts/01_mrc_phase3_1_cleanup_changed_files` — MRC Phase 3.1 Cleanup Changed Files for Gemini
- `artifacts/02_mrc_phase4_review_files_and_review` — MRC Phase 4 Review Files and Gemini Review Packet
- `artifacts/03_mrc_phase5_1_durability_review` — MRC Phase 5.1 Gemini Review Packet
- `artifacts/04_mrc_phase6_1_maintainability_review` — MRC Phase 6.1 Gemini Review Packet
- `artifacts/05_mrc_phase7a_1_migration_safety_review` — MRC Phase 7A.1 Gemini Review Packet
- `artifacts/06_rt_v0_10_4_response_persistence_baseline` — RoundTable v0.10.4 Response Persistence / Aggregation Baseline
- `artifacts/07_rt_v0_10_5_mediator_extraction_review_only` — RoundTable v0.10.5 Mediator Extraction Review Packet
- `artifacts/08_operational_vite_screenshot` — Operational Vite Server Screenshot

## How to use this bundle

1. Open `docs/CHRONOLOGY.md` first.
2. Review each artifact folder in order.
3. Use `MANIFEST.sha256` to verify file integrity after moving files into a repo.
4. If you recover missing zips, add them to the appropriate chronology slot and update the folder README.

## Most important available code artifact

The latest full source package available in this reconstruction is RT v0.10.4:

`artifacts/06_rt_v0_10_4_response_persistence_baseline/rt-v104.zip`

The conversation records RT v0.10.5 as approved, but only its Gemini review packet is available in this runtime.
