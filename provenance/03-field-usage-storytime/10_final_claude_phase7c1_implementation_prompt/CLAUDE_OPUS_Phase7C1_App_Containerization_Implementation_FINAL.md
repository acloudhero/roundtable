# Claude Opus Prompt — StoryTime Phase 7C.1 / 7D App Containerization Implementation

**Project:** StoryTime, formerly Podcast Pipeline  
**Target model:** Claude Opus 4.7  
**Phase label:** Phase 7C.1 Implementation in RoundTable, also referred to as Phase 7D — App Containerization Implementation  
**Purpose:** Implement the locked Phase 7C / 7C.1 Architecture Baseline Amendment for optional local app containerization  
**Status:** Final implementation prompt for Claude Opus  
**Important:** Implement only the locked amendment. Do not expand scope.

---

## Prompt to Send to Claude Opus 4.7

You are Claude Opus 4.7, participating in the RoundTable for StoryTime, formerly Podcast Pipeline.

## Current Phase

Phase 7C.1 Implementation — App Containerization Implementation

This is the implementation of the locked Phase 7C / 7C.1 Architecture Baseline Amendment. Some project notes may call this Phase 7D. Treat those as the same implementation step: optional local app containerization under the locked Phase 7C / 7C.1 amendment.

## Your Role

Deep Implementation / Hardening.

You are being asked to implement the locked amendment narrowly and safely.

The user is the final decision-maker. GPT-5.5 Thinking is the mediator/state keeper. Gemini 3 Thinking has reviewed and approved the Phase 7C.1 amendment as SAFE TO LOCK.

## Critical Scope Instruction

Implement only the optional, local, single-host, demo-grade application containerization path approved by the locked Phase 7C / 7C.1 amendment.

Do not expand the architecture.

Do **not** add cloud deployment.

Do **not** add registry publishing.

Do **not** push images.

Do **not** add Kubernetes.

Do **not** add Terraform.

Do **not** add Helm.

Do **not** add CI/CD automation.

Do **not** add production HA.

Do **not** add production auth.

Do **not** add multi-tenant behavior.

Do **not** add active alerting.

Do **not** add vendor telemetry fan-out.

Do **not** add Dynatrace, New Relic, or Datadog exporters.

Do **not** add vendor SDKs to application code.

Do **not** add real vendor credentials.

Do **not** make Docker required.

Do **not** break bare-metal local Python operation.

Do **not** containerize the Phase 7B front door.

Do **not** replace the native Python front door with Nginx, Caddy, Envoy, Traefik, Kong, or any other proxy.

Do **not** bind backend ports to `0.0.0.0`.

Do **not** use host bind mounts for SQLite state.

Do **not** create any automated state merge, migration, promotion, or reset script unless it is already clearly safer than documentation and fits the existing CLI style. Prefer documentation for destructive local reset operations.

## Locked Phase 7C / 7C.1 Amendment Summary

The locked amendment permits optional local app containerization only under these rules:

- Bare-metal local Python remains the default supported mode.
- Docker remains optional and never required.
- The six quality gates remain Docker-free:
  - `uv sync --frozen --extra dev`
  - `uv run pytest -q`
  - `uv run ruff check .`
  - `uv run mypy`
  - `uv run lint-imports`
  - `uv run storytime doctor`
- SQLite/event_log/artifacts remain the source of truth.
- `pipeline_run_id` remains the durable correlation key.
- `trace_id` remains ephemeral.
- Blue and green retain separate state roots and feed roots.
- No shared SQLite database is allowed.
- No two processes may write to one SQLite database.
- SQLite state must live on per-slot named Docker volumes.
- Cross-platform host bind mounts for SQLite state are prohibited.
- Durable state, `runs/`, and `feed/` artifacts must outlive containers.
- Blue/green state divergence is accepted and must be documented.
- The Phase 7B native Python front door remains host-based.
- The active-slot pointer remains a host file.
- Switch and rollback remain pointer-based, operator-initiated, and demo-grade.
- Containerized backend ports must bind only to host loopback.
- `service.instance.id` must be pinned to stable slot-derived values.
- Docker/host/process resource detectors must not override `service.instance.id`.
- App owns telemetry identity.
- Collector owns telemetry routing and future fan-out.
- Phase 8 fan-out remains deferred.

## Implementation Goals

Implement the minimal app-containerization layer required to satisfy the locked amendment.

You should create or update only the files necessary to support:

1. A local StoryTime application Docker image.
2. Optional local blue/green app containers.
3. Per-slot named Docker volumes for state and feed artifacts.
4. Strict loopback-only backend port publishing.
5. Stable slot-derived `service.instance.id`.
6. Resource detector prevention / explicit resource identity authority.
7. `.dockerignore` protection for artifacts, caches, and secrets.
8. Documentation that clearly separates bare-metal default mode from optional containerized demo mode.
9. Tests that validate the container configuration as data without requiring Docker to be installed.
10. Optional live Docker smoke instructions that skip or remain manual when Docker is unavailable.
11. Canonical documentation updates recording the locked amendment and Phase 7C.1 implementation, if the repo has the relevant canonical docs.

## Implementation Requirements

### 1. Application Dockerfile

Create a Dockerfile for the StoryTime application.

Requirements:

- Build from the existing Python project.
- Use the locked dependency set, preferably through `uv.lock`.
- Do not install unpinned dependencies.
- Do not require network access at runtime.
- Do not bake `runs/`, `feed/`, `.env`, secrets, caches, or local artifacts into the image.
- Run as a non-root user if practical without destabilizing the local demo.
- Preserve existing CLI behavior.
- Support running StoryTime CLI commands and the local feed server.
- Do not start a production server.
- Do not expose production semantics.
- Do not include cloud, registry, production, or vendor assumptions.
- Keep the image local-daemon only.

If a non-root runtime user causes volume-permission complexity, choose the safest local-first behavior and document the tradeoff explicitly. Prefer non-root where feasible.

### 2. `.dockerignore`

Create or update `.dockerignore`.

It must exclude at minimum:

- `runs/`
- `feed/`
- `.env`
- `*.local.env`
- `*.secret.env`
- caches
- virtual environments
- test caches
- build artifacts
- local RoundTable artifacts if present
- any secret-file patterns introduced by documentation
- any local output artifacts that should not enter the image build context

The purpose is to ensure durable artifacts and secrets never enter the image build context.

### 3. Optional Compose Definition for App Slots

Create an app-container compose file only if this is the cleanest way to represent the local blue/green demo. A compose file is expected to be useful here, but you may choose a different minimal structure if the repository already has a better convention.

The compose definition must:

- Define blue and green app-slot services from the same image/build context.
- Use existing per-slot env files where safe.
- Use separate named volumes for each slot’s `runs/` state root.
- Use separate named volumes for each slot’s `feed/` output root.
- Publish blue only to host loopback, for example `127.0.0.1:8000:8000`.
- Publish green only to host loopback, for example `127.0.0.1:8001:8001`.
- Never use broad `8000:8000` / `8001:8001` host binding.
- Never bind-mount the SQLite state directory from the host.
- Allow read-only bind mounts only for non-WAL input material if useful and clearly documented.
- Keep the Phase 7B front door outside Docker.
- Keep the active-slot pointer as a host file.
- Avoid adding a proxy container.
- Avoid containerizing the front door.
- Avoid adding cloud, registry, orchestration, or vendor assumptions.
- Avoid tying the app compose to live vendor credentials.

If you choose not to use compose, explain why and provide the equivalent local command/documentation structure without violating any locked rules.

### 4. Stable Resource Identity

Implement the minimal configuration/code change required for stable `service.instance.id`.

Requirements:

- `service.name` remains `storytime`.
- `service.version` remains package-derived.
- `deployment.environment` remains `local` unless explicitly configured otherwise by existing config.
- `deployment.slot` remains `blue` or `green`.
- `service.instance.id` is pinned to a stable slot-derived value such as `storytime-blue` or `storytime-green`.
- Container ID, PID, hostname, IP address, random value, and start timestamp must not become `service.instance.id`.
- Bare-metal mode and container mode must use the same derivation logic.
- The change must remain inside the telemetry/config boundary.
- OpenTelemetry imports must remain isolated to approved telemetry modules.
- Do not introduce vendor-specific telemetry code.
- Do not add Dynatrace, New Relic, or Datadog code.

Implementation guidance:

- Prefer deriving a default instance id from the deployment slot when no explicit value is configured.
- If an explicit env/config setting already exists or can be added cleanly, it may override the default only if it remains stable and documented.
- Make the slot-derived value visible in `storytime doctor` only if that is consistent with the existing doctor output style and does not expose secrets.
- Add focused tests proving stable derivation.

### 5. Resource Detector Ban / Explicit Resource Authority

Ensure that automatic Docker/host/process resource detectors cannot override the explicit Resource Identity Contract.

Requirements:

- Do not enable Docker, host, or process resource detectors.
- Do not add `opentelemetry-resourcedetector-docker` or equivalent packages.
- Do not let environment-derived or detector-derived container identity override `service.instance.id`.
- Explicitly constructed resource attributes from StoryTime config must be authoritative.
- Add tests or assertions where feasible to verify no container-derived identity is used.
- Preserve import-linter / OpenTelemetry import boundary rules.

### 6. Front Door Preservation

Preserve the Phase 7B front door.

Requirements:

- The native Python front door remains host-based.
- The active-slot pointer remains a host file.
- Switch and rollback remain pointer-based.
- The front door should route to the slot backend ports as before.
- Do not containerize the front door.
- Do not add Nginx, Caddy, Envoy, Traefik, Kong, or any other proxy.
- Do not change the semantics of switch/rollback.
- Documentation must state that switch/rollback are demo-grade and operator-initiated.
- Documentation must state that the inactive slot is not blocked, only not routed.

### 7. Blue/Green State Divergence Documentation

Document the accepted divergence limitation.

Required language or equivalent:

> Blue and Green slots use strictly isolated state. Switching slots changes which isolated timeline is served. Switching does not merge, migrate, copy, or promote SQLite databases or historical run state. This is intentional for the local/demo-grade blue/green model because rollback safety is prioritized over automatic state convergence.

Make sure this appears in the relevant deployment/runbook documentation.

### 8. Docker Volume Lifecycle Documentation

Document how named volumes preserve state across container rebuild/recreate.

Also document how an operator may intentionally reset a local slot’s state.

This must be framed as a destructive local operation and should require an explicit warning.

For example, the docs may describe:

- stop the slot container;
- remove the slot’s named volume;
- recreate the slot container;
- understand this deletes that slot’s local historical timeline.

Do not add automated destructive reset scripts unless they clearly fit the project’s CLI conventions and are safer than documentation.

### 9. Local-First Documentation

Update documentation so it is impossible to mistake Docker for the default path.

Documentation must state:

- Bare-metal local Python remains the default.
- Docker is optional.
- Docker is used only for optional app-container demo and existing observability infrastructure.
- No cloud deployment is provided.
- No registry publishing is provided.
- No production HA is provided.
- No production auth is provided.
- No vendor fan-out is provided in this phase.
- The six quality gates do not require Docker.
- Containerized mode is local single-host demo infrastructure only.

### 10. Security / Secrets

Implement only safe secrets hygiene.

Requirements:

- Do not commit real secrets.
- Do not add real vendor tokens.
- Do not add placeholder values that look real.
- Ensure `.gitignore` and `.dockerignore` cover local secret-file patterns.
- Runtime-injected secrets are allowed only as future documentation placeholders.
- Do not echo secret values in doctor output or docs examples.
- Do not add vendor credential requirements.
- Do not create any registry login or push instructions.

### 11. Tests

Add tests that validate the containerization configuration as data without requiring Docker to be installed.

Tests should check, as applicable:

- Dockerfile exists and does not copy `runs/`, `feed/`, `.env`, or secret patterns.
- `.dockerignore` excludes required paths and secret patterns.
- Compose/app-slot config, if present, uses separate named volumes for blue and green state/feed.
- Compose/app-slot config, if present, uses loopback-only port publishing.
- Compose/app-slot config, if present, does not use broad `8000:8000` or `8001:8001` bindings.
- Compose/app-slot config, if present, does not bind-mount SQLite state from the host.
- Compose/app-slot config, if present, does not containerize the front door.
- No registry/push workflow is introduced.
- No Kubernetes/Terraform/Helm files are introduced.
- No CI/CD workflow for image build/push is introduced.
- No vendor fan-out config is introduced.
- Stable `service.instance.id` derivation behaves the same in bare-metal and container-like env config.
- Docker/host/process detector packages are not introduced.
- OpenTelemetry import isolation still passes.
- Documentation contains the blue/green state divergence warning.
- Documentation contains the local-only / no-registry / loopback-only guardrails.

Any live Docker smoke test must be optional and skip gracefully when Docker is unavailable. Do not make Docker a requirement for pytest.

### 12. Documentation

Update relevant docs, likely including but not limited to:

- `README.md`
- deployment or blue/green runbook docs
- `docs/architecture-baseline.md` or amendment notes, if the repo uses them
- `docs/canonical-state.md`, if the repo mirrors RoundTable state there
- `docs/phase-history.md`, if present
- `docs/open-issues.md`, if present

Documentation must be honest about:

- local-only scope;
- optional Docker;
- state divergence;
- no production zero-downtime claim;
- named-volume SQLite safety;
- Docker Desktop / OrbStack / virtiofs/FUSE host-bind-mount caveat;
- loopback-only exposure;
- no registry publishing;
- no cloud;
- no Kubernetes;
- no Terraform;
- no vendor fan-out yet;
- Phase 8 fan-out direction recorded but not implemented.

### 13. Canonical / Phase-History Updates

Because Phase 7C / 7C.1 is now locked, update repo-mirrored canonical docs if they exist.

Do not rewrite the entire canonical state unless the repo already does it that way.

Prefer concise append-only updates.

The update should record:

- Phase 7C / 7C.1 Architecture Baseline Amendment locked.
- Optional local app containerization authorized under constraints.
- Bare-metal default preserved.
- Docker optional.
- Six gates Docker-free.
- Named volumes for SQLite/feed state.
- No host bind-mounted SQLite.
- Loopback-only backend port publishing.
- Blue/green state divergence accepted.
- Stable slot-derived `service.instance.id`.
- Resource detector ban.
- App owns identity; Collector owns routing.
- No cloud, no registry, no Kubernetes, no Terraform, no CI/CD, no vendor fan-out.
- Phase 8 preference recorded but not implemented.

### 14. Open Issues / Carryovers

Update open issues / carryovers as appropriate.

Expected carryovers after Phase 7C.1 implementation may include:

- Phase 8 Multi-Backend Telemetry Fan-Out:
  - local stack: OTel Collector, Prometheus, Loki, Jaeger, Grafana;
  - vendor priority: Dynatrace primary, New Relic secondary, Datadog deferred.
- Optional future front-door containerization, if ever needed.
- Future cloud deployment path, explicitly not authorized yet.
- Future registry/image promotion path, explicitly not authorized yet.
- Future Postgres migration path, explicitly not authorized yet.
- Future production-grade blue/green state convergence or database migration strategy, explicitly not authorized yet.

Do not resolve these carryovers in this implementation.

## Required Verification

Run the standard local gates:

```bash
uv sync --frozen --extra dev
uv run pytest -q
uv run ruff check .
uv run mypy
uv run lint-imports
uv run storytime doctor
```

If Docker is available, you may optionally run a live local smoke check, but it must be clearly labeled optional and must not become a required gate.

Do not claim Docker live validation if Docker was unavailable.

Report exactly what you ran and exactly what passed or failed.

If a required command fails, stop, report the failure honestly, explain likely cause, and do not claim the phase is complete.

## Expected Output

Produce:

1. A concise implementation report.
2. A list of changed files.
3. A summary of architecture boundaries preserved.
4. A summary of tests added or updated.
5. Exact verification commands run and results.
6. Any optional Docker smoke check results, clearly marked optional.
7. Any deviations or tradeoffs.
8. Remaining carryovers.
9. A tarball or zip artifact of the updated repository.

## Required Output Sections

Use these exact headings:

### Implementation Summary
### Files Changed
### Architecture Boundaries Preserved
### Containerization Scope Delivered
### SQLite / Volume Safety
### Blue/Green Behavior
### Front Door Preservation
### OpenTelemetry Identity Changes
### Local-First / Security Posture
### Tests Added or Updated
### Verification Results
### Optional Docker Smoke Check
### Deviations / Tradeoffs
### Remaining Carryovers
### Artifact Produced
### Confidence / Caveats

## Final Reminder

This is an implementation of the locked Phase 7C / 7C.1 amendment only.

Do not expand scope.

Do not implement Phase 8.

Do not add vendor fan-out.

Do not add cloud deployment.

Do not add registry publishing.

Do not weaken local-first operation.

Do not make Docker required.

Do not use host bind mounts for SQLite state.

Do not expose backend ports beyond loopback.

Do not allow container IDs or host detectors to override stable telemetry identity.
