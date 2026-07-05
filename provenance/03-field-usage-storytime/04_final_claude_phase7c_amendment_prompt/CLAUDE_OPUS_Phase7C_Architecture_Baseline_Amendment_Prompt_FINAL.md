# Claude Opus Prompt — Phase 7C Architecture Baseline Amendment

**Project:** StoryTime, formerly Podcast Pipeline  
**Target model:** Claude Opus 4.7  
**Target phase:** Phase 7C — Architecture Baseline Amendment for App Containerization / Cloud Deploy Readiness  
**Status:** Final prompt after Gemini critique  
**Important:** This is planning/amendment work only. It does not authorize implementation.

---

# Prompt to Send to Claude Opus 4.7 After Gemini Review

You are Claude Opus 4.7, participating in the RoundTable for StoryTime, formerly Podcast Pipeline.

## Current Phase

Phase 7C — Architecture Baseline Amendment for App Containerization / Cloud Deploy Readiness

## Your Role

Deep Architecture / Hardening Reviewer and Amendment Author.

You are being asked to create a **Phase 7C Architecture Baseline Amendment candidate**, not to implement it.

The user is the final decision-maker. GPT-5.5 is the mediator/state keeper. Gemini will critique your amendment before any implementation prompt is generated.

## Critical Instruction

Do **not** implement.

Do **not** modify repository files.

Do **not** write Dockerfiles.

Do **not** write docker-compose files.

Do **not** write code patches.

Do **not** produce a tarball.

Do **not** output `docker init` commands or suggest scaffolding CLI tools.

Do **not** claim tests were run.

This phase is a planning/amendment phase only.

Your output should be a rigorous Markdown architecture amendment proposal that can be reviewed by GPT-5.5, Gemini, and the user.

## Project Context

StoryTime is a local-first, observability-native content-to-audio pipeline that converts approved public-domain or CC0 text into podcast-ready audio, RSS feed artifacts, and traceable pipeline telemetry.

The project is also a portfolio-grade OpenTelemetry/cloud-native architecture demo and a proving ground for disciplined RoundTable-driven AI development.

## Current True State

The project has progressed well past the original restart/scaffold stage.

Locked phases include:
- Phase 0 — Product Charter
- Phase 1 — Architecture Baseline
- Phase Closure Protocol
- Phase 2 — Repo Scaffold + Local Development Environment
- Phase 3 — Thin Vertical Slice MVP
- Phase 4 / 4.1 — Interactive Approval, Pipeline Rehydration, Approval/Event Taxonomy Cleanup
- Phase 5 — OpenTelemetry Instrumentation Foundation
- Phase 6A — Observability Infrastructure / Dashboards-as-Code / Demo Harness
- Phase 7A — Lean Blue/Green Option A
- Phase 7B — Higher-Assurance Blue/Green Front Door / Active-Slot Switching

## Phase 7B Locked State

Phase 7B implemented and locked:
- Native Python standard-library front door.
- Stable local loopback front-door port.
- Active-slot pointer.
- Atomic active-slot switching.
- Rollback as the same switch mechanism targeting the previous slot.
- Separate blue and green state/feed roots.
- Front door does not mutate pipeline state.
- Front door remains outside the pipeline telemetry path.
- NoopTelemetry remains default.
- OTelTelemetry remains opt-in.
- OpenTelemetry import isolation remains protected.
- Architecture Baseline remains unamended.
- Future app containerization is documented as requiring explicit Architecture Baseline amendment.
- No app Dockerfile.
- No app containers.
- No Kubernetes.
- No Terraform.
- No managed cloud services.
- No vendor telemetry fan-out.
- No active alerting.
- No production auth.
- No multi-tenant behavior.

Reported verification for Phase 7B included:
- `uv sync --frozen --extra dev`
- `uv run pytest -q`
- `uv run ruff check .`
- `uv run mypy`
- `uv run lint-imports`
- `uv run storytime doctor`

## Why Phase 7C Exists

After Phase 7B, the next roadmap option was Phase 8 — Multi-Backend Telemetry Fan-Out.

GPT-5.5 initially recommended Phase 8 next because it aligns strongly with the Dynatrace / observability portfolio narrative.

Gemini 3 Thinking challenged that recommendation and identified credible topology rework risk if vendor telemetry fan-out is implemented before app containerization is addressed.

Gemini’s core concern:
- Local uncontainerized process telemetry has a different topology from containerized app telemetry.
- OTel resource identity may change later.
- Collector routing may change later.
- `service.instance.id` may change later.
- Docker bridge networking will affect endpoint assumptions.
- Dynatrace entity mapping may change later.
- SQLite and `runs/` / `feed/` persistence must be solved before a credible cloud-native fan-out story.
- Building fan-out first may create throwaway Collector configuration and unstable demo assumptions.

The revised direction is therefore:

**Do Phase 7C Architecture Baseline Amendment Planning before Phase 8 implementation planning.**

## Current Architecture Baseline Constraint

The current Architecture Baseline does **not** allow app containerization as an implementation step.

Earlier phases allowed Docker only for local observability infrastructure such as OTel Collector and Jaeger.

App containerization requires a formal Architecture Baseline Amendment before implementation.

Your job is to draft the amendment proposal that would allow or reject app containerization under explicit constraints.

## Phase 7C Goal

Create a formal Architecture Baseline Amendment candidate answering:

**Should StoryTime amend the Architecture Baseline to allow app containerization, and if yes, under exactly what constraints?**

The amendment must define the architecture clearly enough that a later implementation prompt can be safely generated without violating local-first constraints or corrupting the app’s source-of-truth model.

## Hard Constraints

You must preserve these unless you explicitly propose an amendment and justify it:

- Local-first remains the default operating model.
- NoopTelemetry remains default.
- OTelTelemetry remains opt-in.
- OpenTelemetry imports remain isolated to telemetry modules.
- SQLite/event_log/artifacts remain the local source of truth unless the amendment explicitly proposes a bounded change.
- `pipeline_run_id` remains the durable correlation key.
- `trace_id` remains ephemeral and must not become business identity.
- Artifact envelopes remain the inter-stage contract.
- DTO-style stage boundaries remain.
- RunnerContext must not become a mutable god-object.
- Blue and green slot identity must remain explicit.
- Blue and green state/feed roots must remain separated.
- Vendor telemetry fan-out remains deferred to Phase 8 or later.
- No vendor secrets may be committed.
- No production cloud deployment is authorized by this phase.
- No Kubernetes or Terraform is authorized by this phase.
- No production auth or multi-tenant behavior is authorized by this phase.
- No active alerting is authorized by this phase.

## Explicit Non-Goals

Do not include implementation output for:
- Dockerfile contents.
- docker-compose.yml contents.
- shell scripts.
- Python code.
- test code.
- CI/CD configuration.
- Kubernetes manifests.
- Terraform.
- live cloud deployment.
- vendor telemetry exporter configuration.
- Dynatrace credentials or API examples using real tokens.
- production HA.
- production auth.
- multi-tenant behavior.

You may describe what a later implementation phase would need to create, but do not write those files.

## Questions You Must Answer

### Amendment Decision

1. Should the Architecture Baseline be amended to allow app containerization?
2. If yes, what exact form of app containerization should be allowed?
3. Should containerization be local-demo-only at first?
4. What remains prohibited until a later cloud-deployment phase?

### SQLite / WAL / Volume Strategy

5. How should SQLite WAL mode behave inside containers?
6. Should blue and green app slots share one SQLite database, use separate SQLite files, or use separate state roots?
7. What file-locking risks exist with SQLite over Docker-mounted volumes?
8. Should multiple containers ever write to the same SQLite database in this project phase?
9. What must be true to avoid data loss during switch/rollback?
10. What migration path exists later from SQLite to Postgres if needed?
11. How should the design account for cross-platform Docker volume mounting quirks, including macOS/Windows Docker Desktop or OrbStack file-sharing layers such as virtiofs/FUSE versus native Linux, when running SQLite in WAL mode?

### Runs and Feed Artifact Persistence

12. How should `runs/` be mounted or persisted?
13. How should `feed/` be mounted or persisted?
14. Should blue and green slots have separate artifact roots?
15. Should published feed output be shared, copied, promoted, or slot-scoped?
16. What must be true for rollback not to corrupt feed/audio state?
17. How does the topology guarantee that spinning down, rebuilding, or recreating a slot container does not destroy or orphan the underlying audio artifacts, RSS artifacts, run artifacts, or state metadata?

### Blue/Green Container Topology

16. How should blue and green app containers map to existing deployment slots?
17. Should each slot have its own env file, state root, feed root, and service identity?
18. Should both blue and green containers run simultaneously?
19. Should inactive slot traffic be blocked or merely not routed?
20. How should switch and rollback work after containerization?

### Front Door and Active Slot Strategy

21. Should the current native Python front door remain outside containers?
22. Should it eventually become a containerized service?
23. Should the active-slot pointer remain a host file, mounted file, env value, or proxy config concept?
24. What is the safest local-first path that does not imply production-grade zero downtime?
25. What must be documented so the demo remains honest?

### OTel Collector Topology

26. Should OTel Collector run as an infra container?
27. Should blue and green app containers export to the same Collector?
28. Should the Collector distinguish blue/green using resource attributes, endpoints, labels, or env vars?
29. What should remain configured in the app versus in the Collector?
30. How should Collector topology prepare for later Phase 8 vendor fan-out?

### Resource Attribute Strategy

31. Which OpenTelemetry resource attributes must remain stable across local uncontainerized and containerized modes?
32. How should `deployment.environment` be used?
33. How should `deployment.slot` be used?
34. How should `service.name` remain stable?
35. How should `service.instance.id` be handled so local PID vs container ID does not destroy demo continuity?
36. What attributes should be avoided due to high cardinality or instability?
37. How should Dynatrace/entity mapping be anticipated without implementing vendor fan-out?

### Local-First Preservation

38. How does the project remain usable without Docker?
39. Should bare-metal/local Python operation remain supported?
40. Should Docker become optional, recommended, or required after the amendment?
41. What commands or docs must make this distinction clear?
42. How does this affect developer onboarding?

### Security and Secrets

43. What secrets exist in containerized local operation?
44. Should `.env` files remain local-only and gitignored?
45. What belongs in `.env.example`?
46. How should future vendor credentials be prepared for without adding them now?
47. How should the amendment prevent credential leakage?

### Future Phase 8 Impact

48. What should Phase 8 telemetry fan-out assume after this amendment?
49. Which Phase 8 tasks become safer after containerization is defined?
50. Which fan-out work should still remain deferred until live vendor testing?
51. Should Phase 8 be redesigned as config-only, template-only, or optional live validation?
52. What should be the boundary between containerization and vendor fan-out?

### Model Routing and Review

53. Should Claude Opus 4.7 or Claude Sonnet 4.6 lead eventual implementation after amendment lock?
54. What should GPT-5.5 review after your amendment?
55. What should Gemini specifically critique before implementation?
56. What would make this amendment unsafe to approve?

## Required Output Format

Use these exact Markdown headings.

### Executive Summary
Briefly state your amendment recommendation and why.

### Amendment Recommendation
State whether you recommend amending the Architecture Baseline to allow app containerization.

### Current Architecture Baseline Constraint
Summarize the current constraint and why amendment is required.

### Proposed Containerization Scope
Define exactly what app containerization would mean for StoryTime.

### Explicit Non-Goals
List what remains out of scope.

### SQLite / WAL / Volume Strategy
Define the state persistence model and data-loss guardrails.

### Runs and Feed Artifact Persistence
Define how working artifacts and published artifacts should be persisted and separated.

### Blue/Green Container Topology
Define how blue/green slots map into containerized operation.

### Front Door and Active-Slot Strategy
Define how the front door and active-slot pointer should behave after amendment.

### OTel Collector Topology
Define the recommended Collector topology in a containerized local demo.

### Resource Attribute Strategy
Define stable resource attributes and identity rules across local/container modes.

### Impact on Future Phase 8 Fan-Out
Explain how this amendment prepares for Phase 8 and what Phase 8 must still avoid.

### Local-First Preservation Rules
Explain how non-Docker local operation remains supported or how that support changes.

### Security and Secrets Rules
Define `.env`, `.env.example`, `.gitignore`, and future vendor credential rules.

### Implementation Risks
List risks for the later implementation phase.

### Architecture Risks
List risks to the architecture itself.

### Recommended Model Routing
Recommend which models should handle implementation and review after amendment lock.

### Gemini Review Prompt Recommendation
Provide a concise prompt outline for Gemini to critique this amendment.

### Amendment Acceptance Criteria
List concrete criteria that must be true before the amendment can be locked.

### Proposed Canonical State Update
Write a concise, user-reviewable proposed appendment to the canonical state. Do not rewrite the entire canonical state document.

### Proposed Implementation Prompt Outline
Provide a high-level outline only. Do not write an implementation prompt.

### Confidence / Caveats
State confidence and caveats.

## Additional Style Requirements

- Be explicit about assumptions.
- Prefer conservative architecture over exciting architecture.
- Flag any recommendation that would require a later separate phase.
- Do not blur amendment planning with implementation.
- Do not claim implementation readiness unless the amendment is clear enough for later GPT/Gemini review.
- Use concrete architecture language, not vague cloud-native slogans.
- Preserve the user as final decision-maker.
- If you believe app containerization should still not be allowed, say so clearly and recommend the alternative path.

