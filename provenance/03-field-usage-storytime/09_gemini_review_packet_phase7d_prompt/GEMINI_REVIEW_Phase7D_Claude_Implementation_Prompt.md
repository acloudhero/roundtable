# Gemini Review Packet — Phase 7C/7D Claude Implementation Prompt Critique

**Project:** StoryTime, formerly Podcast Pipeline  
**Current transition:** Phase 7C / 7C.1 Architecture Baseline Amendment → implementation prompt review  
**Recommended implementation phase name:** Phase 7D — App Containerization Implementation  
**Purpose of this file:** Explain Claude Opus’s Phase 7C.1 amendment, then ask Gemini to critique the Claude Opus implementation prompt before the user sends it to Claude.  
**Status:** Gemini critique packet only. Do not implement from this file.

---

## Instructions for Gemini

You are Gemini 3 Thinking, acting as the Independent Critic / Architecture Reviewer for StoryTime.

Your task is to critique the Claude Opus implementation prompt included later in this file.

Do **not** implement.  
Do **not** write Dockerfiles.  
Do **not** write docker-compose files.  
Do **not** write code.  
Do **not** produce patches.  
Do **not** produce a tarball.

You are reviewing whether the implementation prompt is safe, scoped, testable, and aligned with the locked Phase 7C / 7C.1 Architecture Baseline Amendment.

The user is the final decision-maker. GPT-5.5 Thinking is the mediator/state keeper. Claude Opus 4.7 is the proposed implementation model after this critique.

---

# What Claude Opus Came Up With in Phase 7C / 7C.1

Claude Opus drafted a Phase 7C Architecture Baseline Amendment candidate and then revised it in Phase 7C.1 after Gemini critique.

The amendment is planning-only. It does not implement anything.

## Amendment Decision

Claude recommends amending the Architecture Baseline narrowly to permit **optional, local, single-host, demo-grade app containerization** of the existing blue/green StoryTime slots.

The amendment does **not** authorize cloud deployment or production deployment.

## Key Boundaries from Claude’s Amendment

The amendment says:

- Bare-metal local Python remains the default supported mode.
- Docker remains optional and never required.
- The standard local quality gates remain Docker-free.
- Application containerization is local-only and demo-grade.
- No cloud deployment is authorized.
- No registry publishing is authorized.
- No Kubernetes is authorized.
- No Terraform is authorized.
- No production HA is authorized.
- No production auth is authorized.
- No multi-tenant behavior is authorized.
- No active alerting is authorized.
- No CI/CD automation is authorized.
- No vendor telemetry fan-out is authorized in Phase 7C / 7D.
- Vendor telemetry fan-out remains Phase 8 or later.

## Data / Persistence Rules from Claude’s Amendment

The amendment requires:

- SQLite/event_log/artifacts remain the source of truth.
- `pipeline_run_id` remains the durable correlation key.
- `trace_id` remains ephemeral.
- Blue and green keep separate state roots and separate feed roots.
- No shared SQLite database is allowed.
- No two processes may write to one SQLite database.
- SQLite state must live on per-slot named Docker volumes.
- Cross-platform host bind mounts for SQLite state are prohibited.
- Durable state, `runs/`, and `feed/` artifacts must outlive containers.
- Containers must not store durable state in their writable layer.
- `runs/`, `feed/`, `.env`, caches, and secret-file patterns must be excluded from image build context through `.dockerignore`.

## Blue/Green Rules from Claude’s Amendment

The amendment requires:

- One application image, two containers or services.
- The image is slot-agnostic.
- Blue and green are selected by existing per-slot environment/configuration.
- Blue and green each use separate named volumes.
- Blue and green each expose only loopback-bound backend ports.
- The Phase 7B native Python front door remains host-based.
- The active-slot pointer remains a host file.
- Switch and rollback remain pointer-based, operator-initiated, and demo-grade.
- Blue/green state divergence is explicitly accepted:
  - switching serves a different isolated slot timeline;
  - switching does not merge or migrate state;
  - rollback safety is prioritized over automated state convergence.

## Network / Port Rules from Claude’s Amendment

The amendment requires strict loopback-only publishing, for example:

```text
127.0.0.1:8000:8000
127.0.0.1:8001:8001
```

Binding to `0.0.0.0` or Docker’s default broad host binding is prohibited.

## OpenTelemetry / Identity Rules from Claude’s Amendment

The amendment establishes a Resource Identity Contract:

- `service.name` remains `storytime`.
- `service.version` remains package-derived.
- `deployment.environment` remains `local` unless a later phase changes it.
- `deployment.slot` remains `blue` or `green`.
- `service.instance.id` must be pinned to a stable slot-derived value such as `storytime-blue` or `storytime-green`.
- Container IDs, PIDs, ephemeral hostnames, IP addresses, and start timestamps must not become identity.
- Automatic Docker/host/process resource detectors must not override the pinned `service.instance.id`.

The app owns telemetry identity. The Collector owns telemetry routing and fan-out.

## Phase 8 Forward-Looking Preference Recorded by the Amendment

Phase 8 is **not** authorized by this implementation prompt, but the amendment records the user’s desired future fan-out direction.

Required local/open-source stack for Phase 8:

- OpenTelemetry Collector as central router.
- Prometheus for metrics.
- Loki for logs.
- Jaeger for traces.
- Grafana for dashboards and visualization.

Vendor fan-out priority for Phase 8:

1. Dynatrace — primary vendor target.
2. New Relic — secondary vendor target.
3. Datadog — tertiary/deferred target.

Phase 8 must remain optional, disabled by default, Collector-owned, and must not add vendor SDKs to application code.

---

# Gemini Task

Critique the Claude Opus implementation prompt below.

Your critique should answer:

1. Is this implementation prompt safe to send to Claude Opus?
2. Does it implement only the locked Phase 7C / 7C.1 amendment?
3. Does it accidentally authorize cloud, registry publishing, Kubernetes, Terraform, CI/CD, production behavior, active alerting, or vendor fan-out?
4. Does it preserve bare-metal local Python as default?
5. Does it keep Docker optional?
6. Does it keep the six quality gates Docker-free?
7. Does it correctly require per-slot named volumes for SQLite and feed artifacts?
8. Does it correctly prohibit host bind-mounted SQLite state?
9. Does it correctly enforce one writer per SQLite DB?
10. Does it correctly preserve blue/green state divergence as an honest limitation?
11. Does it correctly preserve the Phase 7B host front door and host active-slot pointer?
12. Does it correctly require loopback-only port publishing?
13. Does it correctly implement stable `service.instance.id` without enabling Docker/host resource detectors?
14. Does it preserve OpenTelemetry import isolation?
15. Does it keep Phase 8 fan-out deferred, Collector-owned, and app-vendor-neutral?
16. Are the requested tests sufficient and safe?
17. Is the prompt too broad, too narrow, or properly scoped?
18. What edits are required before the user sends this prompt to Claude Opus?

## Required Gemini Output

Use these exact headings:

### Executive Verdict
State one of: safe to send as-is, safe with edits, or unsafe.

### Highest-Value Findings
Summarize the most important strengths and concerns.

### Scope Safety Review
Evaluate whether this prompt stays within Phase 7D / implementation-of-7C bounds.

### Architecture Baseline Compliance
Evaluate whether the prompt correctly implements the locked amendment without weakening it.

### SQLite / WAL / Volume Review
Evaluate the persistence and data-safety requirements.

### Blue/Green Semantics Review
Evaluate slot separation, state divergence, switch/rollback, and front-door behavior.

### OpenTelemetry Identity Review
Evaluate the resource identity requirements and detector-ban language.

### Local-First / Security Review
Evaluate Docker optionality, Docker-free gates, secrets, and local-only behavior.

### Phase 8 Boundary Review
Evaluate whether the prompt correctly defers fan-out while preparing for it.

### Test and Verification Review
Evaluate whether the requested tests and gates are appropriate.

### Hidden Scope Creep
Identify any wording that could accidentally authorize out-of-scope work.

### Required Edits Before Sending to Claude
List specific edits, additions, or removals required.

### Final Recommendation
Give a clear go/no-go recommendation.

---

# Draft Prompt to Send to Claude Opus 4.7 After Gemini Critique

You are Claude Opus 4.7, participating in the RoundTable for StoryTime, formerly Podcast Pipeline.

## Current Phase

Phase 7D — App Containerization Implementation

This phase implements the locked Phase 7C / 7C.1 Architecture Baseline Amendment for optional local app containerization.

If the user’s RoundTable labels this as “Phase 7C Implementation,” treat it as the implementation of the locked Phase 7C / 7C.1 amendment. Do not reinterpret the architecture.

## Your Role

Deep Implementation / Hardening.

You are being asked to implement the locked amendment narrowly and safely. The user is the final decision-maker. GPT-5.5 is the mediator/state keeper. Gemini will critique your output after implementation.

## Critical Scope Instruction

Implement only the optional, local, single-host, demo-grade application containerization path approved by the locked Phase 7C / 7C.1 amendment.

Do not expand the architecture.

Do not add cloud deployment.

Do not add registry publishing.

Do not push images.

Do not add Kubernetes.

Do not add Terraform.

Do not add Helm.

Do not add CI/CD automation.

Do not add production HA.

Do not add production auth.

Do not add multi-tenant behavior.

Do not add active alerting.

Do not add vendor telemetry fan-out.

Do not add Dynatrace, New Relic, or Datadog exporters.

Do not add vendor SDKs to application code.

Do not add real vendor credentials.

Do not make Docker required.

Do not break bare-metal local Python operation.

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
4. Strict loopback-only port publishing.
5. Stable slot-derived `service.instance.id`.
6. Resource detector prevention / explicit resource identity authority.
7. `.dockerignore` protection for artifacts, caches, and secrets.
8. Documentation that clearly separates bare-metal default mode from optional containerized demo mode.
9. Tests that validate the container configuration as data without requiring Docker to be installed.
10. Optional live Docker smoke instructions that skip or remain manual when Docker is unavailable.

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

If a non-root runtime user causes volume-permission complexity, choose the safest local-first behavior and document the tradeoff explicitly. Prefer non-root where feasible.

### 2. .dockerignore

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

The purpose is to ensure durable artifacts and secrets never enter the image build context.

### 3. Optional Compose Definition for App Slots

Create an app-container compose file only if this is the cleanest way to represent the local blue/green demo.

The compose definition must:

- Define blue and green app-slot services from the same image/build context.
- Use existing per-slot env files where safe.
- Use separate named volumes for each slot’s `runs/` state root.
- Use separate named volumes for each slot’s `feed/` output root.
- Publish blue only to host loopback, e.g. `127.0.0.1:8000:8000`.
- Publish green only to host loopback, e.g. `127.0.0.1:8001:8001`.
- Never use broad `8000:8000` / `8001:8001` host binding.
- Never bind-mount the SQLite state directory from the host.
- Allow read-only bind mounts only for non-WAL input material if useful and clearly documented.
- Keep the Phase 7B front door outside Docker.
- Keep the active-slot pointer as a host file.
- Avoid adding a proxy container.
- Avoid containerizing the front door.
- Avoid adding cloud or registry assumptions.

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

### 5. Resource Detector Ban / Explicit Resource Authority

Ensure that automatic Docker/host/process resource detectors cannot override the explicit Resource Identity Contract.

Requirements:

- Do not enable Docker, host, or process resource detectors.
- Do not add `opentelemetry-resourcedetector-docker` or equivalent packages.
- Do not let environment-derived or detector-derived container identity override `service.instance.id`.
- Explicitly constructed resource attributes from StoryTime config must be authoritative.
- Add tests or assertions where feasible to verify no container-derived identity is used.

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

### 7. Blue/Green State Divergence Documentation

Document the accepted divergence limitation.

Required language or equivalent:

“Blue and Green slots use strictly isolated state. Switching slots changes which isolated timeline is served. Switching does not merge, migrate, copy, or promote SQLite databases or historical run state. This is intentional for the local/demo-grade blue/green model because rollback safety is prioritized over automatic state convergence.”

Make sure this appears in the relevant deployment/runbook documentation.

### 8. Docker Volume Lifecycle Documentation

Document how named volumes preserve state across container rebuild/recreate.

Also document how an operator may intentionally reset a local slot’s state.

This must be framed as a destructive local operation and should require an explicit warning.

For example:

- stop the slot container;
- remove the slot’s named volume;
- recreate the slot container;
- understand this deletes that slot’s local historical timeline.

Do not add automated destructive reset scripts unless they already fit the project’s CLI conventions and are safer than documentation.

### 9. Local-First Documentation

Update documentation so it is impossible to mistake Docker for the default path.

Documentation must state:

- Bare-metal local Python remains the default.
- Docker is optional.
- Docker is used only for optional app container demo and existing observability infrastructure.
- No cloud deployment is provided.
- No registry publishing is provided.
- No production HA is provided.
- No production auth is provided.
- No vendor fan-out is provided in this phase.
- The six quality gates do not require Docker.

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

### 11. Tests

Add tests that validate the containerization configuration as data without requiring Docker to be installed.

Tests should check, as applicable:

- Dockerfile exists and does not copy `runs/`, `feed/`, `.env`, or secret patterns.
- `.dockerignore` excludes required paths and secret patterns.
- Compose/app-slot config, if present, uses separate named volumes for blue and green state/feed.
- Compose/app-slot config, if present, uses loopback-only port publishing.
- Compose/app-slot config, if present, does not bind-mount SQLite state from the host.
- Compose/app-slot config, if present, does not containerize the front door.
- No registry/push workflow is introduced.
- No Kubernetes/Terraform files are introduced.
- No vendor fan-out config is introduced.
- Stable `service.instance.id` derivation behaves the same in bare-metal and container-like env config.
- Docker/host/process detector packages are not introduced.
- OpenTelemetry import isolation still passes.

Any live Docker smoke test must be optional and skip gracefully when Docker is unavailable. Do not make Docker a requirement for pytest.

### 12. Documentation

Update relevant docs, likely including but not limited to:

- README
- deployment or blue/green runbook
- architecture baseline or architecture amendment notes
- open issues / phase history if the repo already uses those docs

Documentation must be honest about:

- local-only scope;
- optional Docker;
- state divergence;
- no production zero-downtime claim;
- named-volume SQLite safety;
- loopback-only exposure;
- no registry publishing;
- no cloud;
- no vendor fan-out yet;
- Phase 8 fan-out direction recorded but not implemented.

### 13. Open Issues / Carryovers

Update open issues / carryovers as appropriate.

Expected carryovers after Phase 7D may include:

- Phase 8 Multi-Backend Telemetry Fan-Out:
  - local stack: OTel Collector, Prometheus, Loki, Jaeger, Grafana;
  - vendor priority: Dynatrace primary, New Relic secondary, Datadog deferred.
- Optional future front-door containerization, if ever needed.
- Future cloud deployment path, explicitly not authorized yet.
- Future registry/image promotion path, explicitly not authorized yet.
- Future Postgres migration path, explicitly not authorized yet.

Do not resolve these carryovers in Phase 7D.

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
