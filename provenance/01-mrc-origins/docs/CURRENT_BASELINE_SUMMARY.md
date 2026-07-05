# Current Baseline Summary

## What is included as full code

The latest full code package available in this reconstruction is:

- `artifacts/06_rt_v0_10_4_response_persistence_baseline/rt-v104.zip`

This package was reviewed and approved as the v0.10.4 baseline for response persistence / aggregation hardening.

## What is approved but not fully included

The conversation records RT v0.10.5 as approved for mediator extraction tolerance and state mutation cleanup. In this runtime, only the review packet is available:

- `artifacts/07_rt_v0_10_5_mediator_extraction_review_only/rt-v105-gemini-review.md`

Because the full v0.10.5 package zip is not present in `/mnt/data`, this reconstruction does not claim to contain the executable v0.10.5 source package. To make the repository fully visible, add the original `rt-v105.zip` or the extracted v0.10.5 source tree when available.

## Recommended GitHub visibility approach

1. Use the latest full source package you trust as the source tree.
2. Add `docs/project-provenance/` and copy this reconstruction's `docs/` plus artifact READMEs into it.
3. Put large historical zips under a release asset or `artifacts/` folder rather than mixing them into the app source root.
4. Include hashes from `MANIFEST.sha256` so future readers can verify the files were not silently changed.
5. Mark unavailable artifacts honestly rather than replacing them with synthetic code.
