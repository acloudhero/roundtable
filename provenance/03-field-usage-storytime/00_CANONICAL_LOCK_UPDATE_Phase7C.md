# Phase 7C / 7C.1 Canonical Lock Update

Project name: StoryTime  
Former name: Podcast Pipeline  
Current phase after lock: Phase 7C / 7C.1 — Architecture Baseline Amendment Locked  
Next phase: Phase 7C.1 Implementation / Phase 7D — App Containerization Implementation

## Decision

Lock the revised Phase 7C.1 Architecture Baseline Amendment.

## Lock basis

Gemini 3 Thinking reviewed the revised amendment and returned **SAFE TO LOCK**.

The amendment permits optional, local, single-host, demo-grade application containerization of the existing blue/green slots.

Bare-metal local Python remains the default supported mode. Docker remains optional and never required. The standard six quality gates remain Docker-free.

## Preserved

- local-first default
- NoopTelemetry default
- OTelTelemetry opt-in
- OpenTelemetry import isolation
- SQLite/event_log/artifacts as source of truth
- `pipeline_run_id` as durable correlation key
- `trace_id` as ephemeral
- artifact envelopes as inter-stage contract
- DTO stage boundaries
- non-god-object RunnerContext
- explicit blue/green slot identity
- separated blue/green state and feed roots
- Phase 7B host front door
- host active-slot pointer
- pointer-based switch and rollback

## Established

- per-slot named Docker volumes for SQLite state and feed artifacts
- no host bind-mounted SQLite state on cross-platform Docker filesystem layers
- no shared SQLite database
- no two writers to one SQLite database
- durable state and artifacts outlive containers
- loopback-only container port binding
- no Docker default broad host binding
- accepted blue/green state divergence
- no automated cross-slot migration or merging
- stable slot-derived `service.instance.id`
- resource detector ban for Docker/host/process identity overrides
- app owns telemetry identity
- Collector owns telemetry routing and future fan-out

## Still prohibited

- cloud deployment
- registry publishing
- Docker Hub, ECR, GHCR, GCP Artifact Registry, ACR, or any remote registry
- Kubernetes
- Terraform
- Helm
- CI/CD image publishing
- production HA
- production auth
- multi-tenancy
- active alerting
- vendor telemetry fan-out
- vendor SDKs in app code

## Recorded forward-looking Phase 8 preference

- Local stack: OpenTelemetry Collector, Prometheus, Loki, Jaeger, Grafana.
- Vendor priority: Dynatrace primary, New Relic secondary, Datadog tertiary/deferred.
- Phase 8 remains optional, disabled by default, Collector-owned, and app-vendor-neutral.
