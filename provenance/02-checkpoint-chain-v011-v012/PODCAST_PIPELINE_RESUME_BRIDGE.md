# Bridge Back to Podcast Pipeline

The RoundTable v0.11/v0.12 work in this chain was driven by the need to resume the Podcast Pipeline project inside a more durable file-based workflow.

To resume the Podcast Pipeline project in the latest RoundTable system:

1. Use the active RoundTable PWA/build artifact from `15-checkpoint-k-pwa-implementation`.
2. Import or reconstruct a RoundTable JSON AppState using schemaVersion `0.11.0` and appVersion `0.12.0`.
3. Set the active project to `project-podcast-pipeline`.
4. Set the current phase to `Phase 2 — Repo Scaffold + Local Development Environment`.
5. Set the next action to send the Phase 2 scaffold implementation prompt to Claude Sonnet 4.6.

The historical context that defines Phase 0 and Phase 1 lives in `00-podcast-pipeline-phase1-mediator-packet/PPscaffold.txt`.
