# RT_RESPONSE — StoryTime Phase 7C Architecture Baseline Amendment Candidate (Revised — Phase 7C.1)

**Project:** StoryTime (formerly Podcast Pipeline)
**Phase:** Phase 7C.1 — Architecture Baseline Amendment Cleanup (revision of the Phase 7C candidate)
**Author role:** Claude Opus 4.7 — Deep Architecture / Hardening Reviewer and Amendment Author
**Artifact type:** Architecture Baseline Amendment *candidate*, revised — planning only
**Status:** Revised after Gemini critique (verdict: SAFE WITH EDITS); ready for GPT-5.5 re-review and user lock decision

> **This is an amendment candidate, not an implementation.** No repository
> files were modified, no Dockerfile / compose / code / tests were written, no
> tarball was produced, and no tests were run or claimed. This Phase 7C.1
> revision applies Gemini's four required edits and a forward-looking Phase 8
> note to the Phase 7C candidate; it is a document cleanup pass only. The user
> is the final decision-maker; this amendment authorizes nothing until
> reviewed and explicitly locked.

---

## Executive Summary

I recommend **amending the Architecture Baseline — narrowly — to permit
application containerization as an optional, local, demo-grade deployment
mode**, and nothing more. Containerization should be allowed *only* as an
alternative way to run the existing blue/green slots on a single developer
host. Bare-metal local Python remains the default and fully supported mode;
Docker remains **optional**, never required. No cloud deployment, no registry
publishing, no Kubernetes, no Terraform, no production HA/auth/multi-tenancy,
and no vendor telemetry fan-out are authorized by this amendment.

The reasoning is not "containers are exciting." It is that Gemini's sequencing
argument is correct: Phase 8 vendor fan-out rests on a telemetry *topology* —
resource identity, Collector routing, network endpoints, entity mapping — that
shifts when the app moves into a container. Settling that topology *first*, in
a bounded amendment, prevents Phase 8 from building on assumptions it would
later have to discard. The single most valuable thing this amendment does is
define a **stable resource-identity contract** that holds identically across
bare-metal and containerized modes, so that "blue" and "green" remain the same
observability entities no matter how they are run.

The amendment is deliberately conservative. Every expansion it does *not*
grant is listed explicitly, and the data-safety guardrails (per-slot SQLite,
named volumes, loopback-only port publishing, no secrets in images) are
written as hard rules so a later implementation phase cannot quietly relax
them.

---

## Gemini-Required Cleanup Summary

Gemini reviewed the Phase 7C candidate and returned a verdict of **SAFE WITH
EDITS** — agreeing the amendment is narrow, local-first, and architecturally
sound, while requiring four clarifying constraints before lock. This Phase
7C.1 revision incorporates all four, plus a forward-looking Phase 8 note.

1. **Explicit Resource Detector Ban — incorporated.** *Resource Attribute
   Strategy* now states as a hard rule that the OpenTelemetry Python SDK must
   disable automatic Docker/Host environment resource detectors so that
   ephemeral container IDs, hostnames, or PIDs cannot overwrite the pinned,
   slot-derived `service.instance.id`, and reaffirms the full resource
   identity contract as authoritative.
2. **Blue/Green State Divergence acknowledged — incorporated.** *Runs and
   Feed Artifact Persistence* now states as a hard rule that blue and green
   use strictly isolated state, that automated migration / historical-state
   merging is out of scope, and that switching changes which isolated
   historical timeline is served — accepted deliberately for a local/demo
   blue/green model that prioritises rollback safety over state convergence.
3. **Loopback-Only Container Port Binding — incorporated.** *Blue/Green
   Container Topology* now states as a hard rule that containerized backend
   slots must map ports strictly to the host loopback adapter
   (`127.0.0.1:8000:8000`, `127.0.0.1:8001:8001`) and that `0.0.0.0` /
   Docker's default broad host binding is prohibited in this phase.
4. **No Registry Publishing — incorporated.** *Explicit Non-Goals* now states
   as a hard rule that containers are for local daemon execution only and
   that pushing images to Docker Hub, AWS ECR, GitHub Container Registry, GCP
   Artifact Registry, Azure Container Registry, or any other remote registry
   is strictly prohibited in this phase.

In addition, *Impact on Future Phase 8 Fan-Out* now carries a short
forward-looking note recording the user's preferred Phase 8 backend stack and
vendor fan-out priority, while keeping Phase 8 deferred, optional, and
Collector-owned.

The four edits are clarifying constraints; none changes the amendment's
recommendation or scope. They tighten wording so a later implementation phase
cannot relax a guardrail by omission.

---

## Amendment Recommendation

**Recommended: YES — amend, with a tightly bounded scope.**

The amendment should add a new, explicitly scoped clause to Architecture
Baseline §16 (or a new §16A) stating, in substance:

> Application containerization is permitted **solely** as an optional, local,
> single-host, demo-grade deployment mode for the existing blue/green slots.
> A StoryTime application image MAY be built and run locally. Bare-metal local
> Python operation remains the default supported mode and the basis of the
> developer workflow and the test gates. Docker remains **optional**.
> Containerization grants no authority for cloud deployment, image-registry
> publishing, orchestration (Kubernetes), infrastructure-as-code (Terraform),
> production HA, production auth, multi-tenancy, or vendor telemetry fan-out;
> each of those remains prohibited and would require its own separate
> amendment or phase.

I considered and rejected two alternatives:

- **Reject the amendment entirely (status quo).** This keeps the app
  uncontainerized indefinitely. It is internally safe but it pushes the
  containerization-vs-fan-out topology question into Phase 8, where it becomes
  entangled with vendor work — exactly the rework risk Gemini flagged. It also
  sits awkwardly with the project's stated identity as a portfolio-grade
  cloud-native architecture demo. Not recommended.
- **Broad amendment (allow containerization plus a cloud-deploy path).**
  Over-reaches. It would invite scope creep, blur the local-first charter, and
  authorize work the project has no concrete need for yet. Rejected on the
  project's own "prefer conservative architecture" principle.

The bounded "yes" is the proportionate answer: it unblocks the topology work
Phase 8 genuinely depends on, while conceding nothing about cloud, scale, or
production posture.

---

## Current Architecture Baseline Constraint

Architecture Baseline §16 ("Local OpenTelemetry Collector + Jaeger Topology")
currently states that Docker is used **only** for the local observability
stack and that *the StoryTime application itself is not containerized*. Phase
7B appended an explicit documentation note to §16 recording that introducing
an application container or image — "for a versioned artifact, a managed-cloud
path, or an orchestrator" — would be a **material change** to that section
and **requires an explicit Architecture Baseline amendment approved by the
user**, and "must never be introduced as an implementation detail."

That note is the gate. Phase 7C is the amendment process it called for.
Because the constraint is explicit and load-bearing, app containerization
cannot be introduced by a future implementation prompt unless this amendment
(or one like it) is reviewed and locked first. The constraint is doing its
job; this document is the front door it requires.

Two adjacent baseline sections are relevant and are **not** loosened here:

- **§15 Local HTTP Serving Model** — loopback-only serving. This amendment
  preserves it: containerized slots must publish ports to `127.0.0.1` only.
- **§5 Local State Store Design / §2 / §18** — SQLite under `runs/`,
  `feed/` as published output. This amendment preserves SQLite/event_log/
  artifacts as the source of truth and does not introduce a shared database.

---

## Proposed Containerization Scope

Containerization, *if* the amendment is approved, means exactly the following
and nothing else:

1. **One application image.** A single StoryTime application image built from
   the existing `src/` package and `pyproject.toml` / `uv.lock`. It is a
   runtime for the existing `storytime` CLI — it runs pipeline commands (which
   write SQLite state) and the feed server (which reads published feed
   output). It is *one* image; "blue" and "green" are not separate images.
2. **Parametrized per slot by environment, not by image.** Blue vs. green is
   selected exactly as today — by the per-slot env file (`config/deploy/
   blue.env`, `green.env`) and the existing `STORYTIME_DEPLOYMENT_SLOT` /
   state-root / feed-root configuration. The image is slot-agnostic; the
   *container* is slot-specific. This guarantees one build serves both slots
   and there is no blue/green image drift.
3. **Local, single-host only.** The image is built locally (`docker build`)
   and run locally. It is not pushed to any registry, not tagged for release,
   not deployed anywhere.
4. **An optional alternative, not a replacement.** Running the slots as
   bare-metal Python processes (the Phase 7A/7B model) remains fully
   supported. The containerized mode is a second, opt-in way to run the same
   slots for demonstration purposes.
5. **Reuse, not redesign, of the blue/green mechanism.** The Phase 7B native
   Python front door, the active-slot pointer, and the switch/rollback
   semantics are preserved unchanged. Containerization changes *how a slot's
   process is hosted*, not *how traffic is switched*.

What a later implementation phase ("Phase 7D") would need to *create* —
described here, not written — is: an application `Dockerfile`, a
`.dockerignore`, an optional compose definition for the two app-slot
containers, per-slot named-volume declarations, loopback-bound port
publishing, a small configuration addition for stable instance identity (see
*Resource Attribute Strategy*), an optional `storytime doctor` enhancement,
documentation, and data-as-configuration tests. None of those files are
produced in Phase 7C.

---

## Explicit Non-Goals

This amendment does **not** authorize, and a later implementation phase under
it must **not** introduce, any of the following:

- Cloud deployment of any kind; any managed cloud service.
- Publishing the image to any registry (public or private).
- Kubernetes, any orchestrator, or Helm.
- Terraform or any infrastructure-as-code.
- Production-grade high availability or true zero-downtime deployment.
- Production authentication, authorization, or TLS termination.
- Multi-tenant behavior.
- Active alerting or paging.
- CI/CD automation (including automated image builds).
- Vendor telemetry fan-out (Dynatrace or otherwise) — remains Phase 8 or later.
- Any vendor credentials, tokens, or API examples using real secrets.
- A shared SQLite database across slots, or any two processes writing one
  SQLite database.
- Replacing SQLite as the local source of truth (a Postgres path is discussed
  only as a *future* option, not authorized here).
- Containerizing the front door or the OTel Collector beyond what §16 already
  allows for the Collector.
- Non-loopback network exposure of any StoryTime port.
- Image supply-chain hardening (signing, SBOM, provenance) — defensible as a
  later phase, out of scope here.

A later implementation phase *may describe* what production work would
eventually require, but must not build it.

**Hard rule — No Registry Publishing (Gemini-required edit 4).** Containers
are for local daemon execution only. Pushing images to Docker Hub, AWS ECR
(Elastic Container Registry), GitHub Container Registry (GHCR), GCP Artifact
Registry, Azure Container Registry (ACR), or any other remote, private, or
public registry is strictly prohibited in this phase. Registry publishing,
image promotion, image signing, SBOM / provenance workflows, and CI/CD image
builds all remain out of scope unless authorized by a later, separate phase.
The application image, if built under the eventual implementation phase,
exists only on the developer's local Docker daemon.

---

## SQLite / WAL / Volume Strategy

This is the highest-risk area of containerization for StoryTime and the
amendment treats it as a set of hard rules, not guidance.

**The core hazard.** SQLite in WAL mode uses three files — the database, the
`-wal` write-ahead log, and the `-shm` shared-memory file — and the `-shm`
file is memory-mapped by every connection. WAL mode therefore depends on
correct POSIX advisory byte-range locking (`fcntl`) and working shared-memory
`mmap`, and SQLite's own documentation states WAL does not function correctly
when the database lives on a network or non-coherent filesystem. Docker
Desktop on macOS and Windows, and similar tools (OrbStack), expose **host bind
mounts** through a virtualized file-sharing layer (historically osxfs, later
gRPC-FUSE, now virtiofs; OrbStack uses its own). These layers have a long
history of not faithfully providing the locking and `mmap` semantics SQLite
WAL requires. Native Linux bind mounts are fine; the cross-platform Docker
Desktop / OrbStack case is not reliably safe.

**Rule 1 — the SQLite state directory must never live on a cross-platform
host bind mount.** Each slot's state root (`runs/<slot>`, which contains
`state.db` and its WAL/SHM files) must be persisted on a **per-slot named
Docker volume**. Named volumes are backed by the Docker VM's own Linux
filesystem, so the container sees a native, coherent filesystem with correct
locking and `mmap`. This single rule removes the cross-platform hazard.

**Rule 2 — one writer per database; no shared database (Q6, Q8).** Blue and
green must use **separate state roots on separate named volumes**, exactly as
Phase 7A established. They never share a SQLite file. Two containers must
never write the same SQLite database in this phase or any phase this
amendment authorizes. This is preserved by construction: each slot mounts only
its own volume.

**Rule 3 — durable data outlives the container (Q9, Q16, Q17).** Nothing
durable lives in a container's writable layer. The state DB and the published
feed live in named volumes whose lifecycle is independent of the container's.
Consequently, stopping, rebuilding, recreating, or removing a slot container
cannot destroy or orphan that slot's `state.db`, `runs/` working directories,
audio artifacts, or RSS output — the volume persists and re-attaches. `docker
rm` of a slot container must be a safe, routine operation.

**Rule 4 — WAL mode itself is unchanged.** The state store keeps WAL mode on.
The change is purely *where the files sit* (a named volume), not *how SQLite
is configured*. No `journal_mode` change is proposed.

**Rule 5 — read-only inputs may be bind-mounted.** Source manifests and source
texts (read-only inputs) are not WAL files and *may* be supplied via read-only
host bind mounts; that is a convenience and carries none of the WAL hazard.

**Cross-platform quirks (Q11).** The amendment explicitly documents that
contributors on macOS/Windows Docker Desktop or OrbStack must use the
named-volume path for state and must not bind-mount the SQLite directory from
the host. virtiofs/FUSE-class layers are called out by name in the runbook so
the reason is visible, not folklore.

**Avoiding data loss on switch/rollback (Q9).** Because each slot's data lives
in its own named volume and the switch only re-points the front door, a switch
or rollback touches no database and no feed file. The inactive slot's volume
is a pristine, warm rollback target at all times.

**Postgres migration path (Q10) — noted, not authorized.** Architecture
Baseline §19 already maps `runs/state.db` SQLite → a managed relational
database as a "Medium" cost migration behind the existing state/storage
adapter seam. A future phase *could* introduce a Postgres-backed state store
behind that interface. This amendment neither requires nor authorizes it;
SQLite remains the source of truth. The only relevance here is that the
amendment must not do anything that *closes* that future door — and it does
not.

---

## Runs and Feed Artifact Persistence

The persistence model preserves and extends the Phase 7A separation.

- **`runs/<slot>` (working state, including `state.db`)** — per-slot named
  volume. Working pipeline directories and the SQLite state DB are durable and
  slot-scoped. (Q12)
- **`feed/<slot>` (published output)** — per-slot named volume. Published RSS
  and audio artifacts are durable and slot-scoped. (Q13)
- **Separate artifact roots per slot (Q14).** Yes — unconditionally. Blue and
  green never share a working root or a feed root. This is the Phase 7A
  invariant and the amendment forbids weakening it.
- **Published feed is slot-scoped, never shared or copied (Q15).** There is no
  "promote the feed" file operation. "Promotion" *is* the front-door switch:
  consumers reach the active slot's feed because the front door points there.
  Blue and green each publish their own feed to their own volume; the
  amendment explicitly rejects sharing, copying, or merging feed output
  between slots, because copying reintroduces a blue/green coupling and a
  partial-copy failure mode.
- **Rollback does not corrupt feed/audio state (Q16).** Because feed output is
  per-slot and immutable-by-convention (§18), and the switch never writes feed
  files, rolling back simply re-points consumers at the previously published,
  still-intact feed of the other slot.
- **Container lifecycle never destroys artifacts (Q17).** This is Rule 3 of
  the SQLite section applied to artifacts: every durable artifact root is a
  named volume, never the container layer. Recreating or rebuilding a slot
  container re-attaches the same volumes. An implementation-phase guardrail:
  the image build must `.dockerignore` `runs/` and `feed/` so artifacts are
  never baked into the image, and the container must not write durable data
  anywhere except the mounted volumes.

For host inspection of feed output, the recommended pattern is `docker cp` or
an explicit, separate read-only mount — documented as an inspection aid, kept
distinct from the live persistence path.

**Hard rule — Blue/Green State Divergence (Gemini-required edit 2).** Blue and
green slots use strictly isolated state. Automated data migration or
historical-state merging between slots is out of scope. Operators acknowledge
that switching slots changes which isolated historical timeline is served.

This is a deliberate and accepted property of the local/demo-grade blue/green
model, not an oversight:

- Rollback safety is prioritised over automatic state convergence — the
  inactive slot must remain an untouched, trustworthy rollback target.
- Switching does not copy, merge, or promote SQLite databases.
- Each slot preserves its own state and feed history independently.
- This is **not** a production replicated-state deployment model; there is no
  cross-slot replication, no shared write path, and no convergence guarantee.

The operator-facing consequence must be documented honestly (see *Front Door
and Active-Slot Strategy*): a switch re-points consumers at the other slot's
*separate* timeline of runs and published feed; it does not reconcile the two.
If an operator wants the candidate slot to reflect the live slot's history,
that is a manual, out-of-band action and is outside the scope this amendment
authorizes.

---

## Blue/Green Container Topology

Containerized blue/green maps one-to-one onto the existing Phase 7A/7B slot
model — that is the point, and it is the main continuity guarantee.

- **One image, two containers.** Blue and green are two containers (or two
  compose services) from the single application image. (Q16/Q18)
- **Per-slot identity, state, and feed (Q17).** Each slot container gets: its
  own env file (`config/deploy/<slot>.env`), its own state-root named volume,
  its own feed-root named volume, its own service-identity resource attributes
  (see *Resource Attribute Strategy*), and its own published loopback port —
  blue on `127.0.0.1:8000`, green on `127.0.0.1:8001`, exactly the Phase 7A
  port assignment.
- **Both slots run simultaneously (Q18).** Yes. Blue (live) and green
  (candidate) run at the same time — that is what makes blue/green a
  candidate-validation model rather than a stop-start redeploy.
- **The inactive slot is not blocked, only not routed (Q19).** The inactive
  slot keeps running and remains directly reachable on its own loopback port
  for inspection and pre-switch validation; it is simply not what the front
  door points at. This matches Phase 7B semantics. Blocking the inactive slot
  would defeat warm rollback and pre-switch health checks.
- **Switch and rollback are unchanged (Q20).** The Phase 7B native Python
  front door and active-slot pointer continue to govern switching. The front
  door points at the active slot's loopback port; containerizing the process
  behind that port changes nothing about the switch. Switch and rollback
  remain operator-initiated, atomic at the pointer, and demo-grade.

**Hard rule — Loopback-Only Container Port Binding (Gemini-required edit 3).**
All containerized backend slots must map ports strictly to the host loopback
adapter — for example `127.0.0.1:8000:8000` for blue and
`127.0.0.1:8001:8001` for green. Binding to `0.0.0.0`, or using Docker's
default broad host binding (the bare `8000:8000` form, which publishes on all
host interfaces), is prohibited in this phase. This rule preserves the
existing Local HTTP Serving Model (Architecture Baseline §15) and prevents
accidental exposure of a StoryTime slot to the local network. It is a hard
rule for the implementation phase and is a port-publishing checkpoint for
review.

---

## Front Door and Active-Slot Strategy

- **The front door stays on the host, uncontainerized (Q21, Q22).** In the
  scope of this amendment the Phase 7B native Python front door remains a host
  process binding `127.0.0.1:8080`. Keeping it on the host means it reaches
  the slot containers' published loopback ports exactly as it reaches
  bare-metal slot processes today — zero change to the front door, the
  switch, or the tests. Containerizing the front door would require a
  user-defined Docker network and intra-network service discovery to reach
  sibling containers; that is additional topology with no demo benefit at this
  stage. A *later, optional* phase MAY containerize the front door, but this
  amendment does not authorize it and recommends against it for now.
- **The active-slot pointer remains a host file (Q23).** `config/deploy/
  active-slot` stays a plain host file, read by the host front door. It does
  not need to enter any container. If a future phase containerizes the front
  door, the pointer would become a mounted file at that time — explicitly
  deferred, not decided here.
- **Safest local-first path (Q24).** Host front door + host active-slot
  pointer + containerized app slots + per-slot named volumes + loopback-only
  published ports. This path adds containerization where it has value (a
  portable, reproducible app runtime) and avoids it where it only adds
  topology (the front door). It makes no production zero-downtime claim: the
  switch is still a single operator action against a pointer.
- **Honesty requirements for the demo (Q25).** The documentation must state
  plainly that this is a single-host, demo-grade, operator-initiated
  blue/green mechanism; that it is not production zero-downtime deployment,
  not HA, and not orchestrated; that "switch" re-points a front door and does
  not drain or gracefully migrate in-flight pipeline work; and that the
  inactive slot is a preserved rollback target, not a hot standby with
  failover.

---

## OTel Collector Topology

- **The Collector runs as an infrastructure container (Q26).** Unchanged from
  Architecture Baseline §16 — `docker-compose.observability.yml` continues to
  provide the OTel Collector and Jaeger. This amendment does not alter the
  Collector's role; it only clarifies how containerized app slots reach it.
- **Both app slots export to one shared Collector (Q27).** Blue and green
  export to the *same* Collector. The Collector is shared infrastructure, not
  a per-slot component. One Collector receiving both slots' telemetry is what
  makes a single side-by-side blue/green observability view possible.
- **Slots are distinguished by resource attributes, not by endpoint or by
  separate Collectors (Q28).** Each slot tags its telemetry with
  `deployment.slot` (and the stable identity attributes below). The Collector
  receives both streams on one endpoint and can label, route, or filter by
  that attribute. Resource attributes are the correct discriminator: they are
  low-cardinality, already in place since Phase 7A, and stable across
  bare-metal and containerized modes. Separate per-slot Collectors or
  endpoints would be redundant topology.
- **App owns identity; Collector owns transport and routing (Q29).** The
  application sets *identity* — the resource attributes that say "this is
  StoryTime, slot blue." The Collector owns *where telemetry goes* — receivers,
  processors, exporters. Identity must not be invented in the Collector;
  routing/export must not be hard-coded in the app. This separation is what
  makes Phase 8 a Collector-config change rather than an app change.
- **Networking.** When app slots are containers and the Collector is a
  container, they share a user-defined Docker bridge network and the app's
  OTLP endpoint becomes the Collector's service name (e.g.
  `http://otel-collector:4318`). When the app runs bare-metal against a
  containerized Collector, the endpoint is `http://127.0.0.1:4318` (the
  Collector already publishes 4317/4318 to loopback per §16). The endpoint is
  already env-configurable today via `STORYTIME_OTLP_ENDPOINT` — the same knob
  serves both modes; only its value differs. No new app mechanism is needed.
- **Preparing for Phase 8 fan-out (Q30).** The Collector is established here
  as the *single fan-out point*. Phase 8 vendor fan-out becomes adding
  exporters to the Collector's pipeline; the application and its instrumented
  spans/metrics do not change. The amendment states this as a boundary rule:
  all vendor fan-out happens in the Collector, never in the app.

---

## Resource Attribute Strategy

This section directly answers Gemini's central concern — that containerization
silently changes OTel resource identity — and it is, in my assessment, the
most important deliverable of the amendment.

**Current state (verified against the Phase 7B code).** The OTel adapter
builds the resource with `service.name` (default `storytime`),
`service.version`, `deployment.environment` (default `local`), and — when a
slot is set — `deployment.slot`. The span/metric attribute vocabulary
deliberately carries **no** process identity: no hostname, no PID, no path,
explicitly so identity "must not depend on where the process happens to run."
Notably, the resource currently sets **no `service.instance.id` at all**.

**The risk.** A containerization phase, left to its own devices, very commonly
introduces a `service.instance.id` derived from the container ID (or relies on
a resource detector that does so). Container IDs change on every rebuild and
recreate. If `service.instance.id` becomes container-derived, every `docker
compose up --build` mints a *new* observability entity, and in a vendor like
Dynatrace the blue slot's history fragments across many short-lived entities —
the demo's continuity is destroyed. The same churn would happen at the
bare-metal ↔ container boundary.

**The amendment's Resource Identity Contract.** The amendment defines a fixed
set of resource attributes with fixed derivation rules that must hold
**identically** in bare-metal and containerized modes:

- **`service.name`** — always the constant `storytime`. Never derived from
  hostname, image name, or container. (Q34)
- **`deployment.environment`** — stays `local` for both bare-metal and
  *local* containerized operation. Running in a container on a developer
  machine is still `local`. A future cloud phase may introduce a closed set
  such as `staging` / `prod`; this amendment does not. (Q32)
- **`deployment.slot`** — `blue` or `green`, set per-slot from the slot env
  file, identical in both modes. (Q33)
- **`service.instance.id`** — **must be explicitly pinned to a stable,
  slot-derived value** and set from configuration, e.g. `storytime-blue` /
  `storytime-green` (or `<environment>-<slot>`). It must **not** be the
  container ID, the PID, or a per-start random value. Set this way, blue is
  "the same instance" across restarts, rebuilds, and the bare-metal↔container
  boundary. (Q35) This is a small, bounded configuration addition that a later
  implementation phase would make; it is the one code-adjacent change the
  amendment specifically calls for, and it is best made *now-ish* so that
  bare-metal and container modes agree from day one.
  - *Caveat:* a slot-stable instance id is correct because StoryTime runs
    exactly one process per slot. If a future phase ever ran multiple
    concurrent instances of one slot, instance id would need a per-instance
    suffix. That is out of scope and explicitly noted.
- **`service.version`** — continues to come from the package version; stable
  across modes for a given build.

**Attributes to avoid (Q36).** The amendment forbids, as resource or routine
span/metric attributes: raw container ID, PID, ephemeral hostnames, IP
addresses, container start timestamps used as identity, and any `host.*`
attribute derived from the container. These are high-cardinality or unstable
and would pollute entity mapping. The codebase already follows this
discipline; the amendment makes it an explicit, named rule so a
containerization phase does not regress it.

**Hard rule — Resource Detector Ban (Gemini-required edit 1).** The
OpenTelemetry Python SDK must disable automatic Docker/Host environment
resource detectors to prevent ephemeral container IDs, hostnames, PIDs, or
other runtime-derived values from overwriting the pinned, slot-derived
`service.instance.id`. The application's resource identity contract is
**authoritative** and is the only source of these attributes:

- `service.name` remains stable — the constant `storytime`.
- `service.version` remains package-derived.
- `deployment.environment` remains `local` unless a later phase explicitly
  defines otherwise.
- `deployment.slot` remains `blue` or `green`.
- `service.instance.id` is pinned to a stable slot-derived value such as
  `storytime-blue` or `storytime-green`.
- Container IDs must **not** become `service.instance.id`.

Concretely for the later implementation phase: the SDK must be configured so
that no environment/host/process/container resource detector runs (for
example, by not enabling them and by setting the resource explicitly from
config), and the explicitly-constructed `Resource` is the sole authority for
the contract attributes. A container-derived or detector-derived
`service.instance.id` is a defect, not a default to be tolerated.

**Anticipating Dynatrace entity mapping without implementing fan-out (Q37).**
Vendors map service entities primarily off `service.name` (and
`service.namespace` where used) plus `service.instance.id`. By pinning those
to stable, slot-derived values now, Phase 8 fan-out inherits a clean entity
model — one StoryTime service, two stable instances (blue, green) — without
any vendor-specific code. The amendment documents the *intended* entity model;
it implements nothing vendor-specific and adds no exporter.

**Q31 restated as the guarantee:** `service.name`, `service.version`,
`deployment.environment`, `deployment.slot`, and `service.instance.id` are the
attributes that must remain stable across local-uncontainerized and
containerized modes, and the amendment's contract is precisely that they do.

---

## Impact on Future Phase 8 Fan-Out

- **What Phase 8 may assume after this amendment (Q48).** A stable resource
  identity contract; a single shared Collector as the one fan-out point; app
  slots (bare-metal or containerized) that export to that Collector over an
  env-configured endpoint; and a clean two-instance entity model.
- **Phase 8 tasks that become safer (Q49).** Collector exporter configuration;
  vendor entity mapping (because identity is already stable); demo continuity
  across rebuilds; and reasoning about routing, because blue/green is already
  expressed as a resource attribute rather than as network topology.
- **What Phase 8 must still defer to live vendor testing (Q50).** Real vendor
  credentials and exporter endpoints; live ingestion validation; vendor-side
  entity/tuning verification. None of these can be committed or fully tested
  without real tokens the project will not store.
- **Phase 8 should be redesigned as config/template-first (Q51).** Phase 8
  should deliver Collector exporter *templates* and documentation, with live
  vendor validation as an optional, separately gated step. This keeps Phase 8
  reviewable and reproducible without secrets, and matches the project's
  local-first, no-committed-credentials posture.
- **The boundary between containerization and fan-out (Q52).**
  Containerization (this amendment, and the 7D implementation it would
  authorize) defines **topology and identity** — how slots are hosted, how
  they reach the Collector, what stable attributes they carry. Fan-out
  (Phase 8) defines **where telemetry is exported** — and lives entirely in
  the Collector configuration. The application never changes for fan-out.
  That clean boundary is the reason Gemini's "do 7C before Phase 8"
  sequencing is correct, and the amendment states it as a rule.

**Forward-looking note — Phase 8 backend priority (recorded, not authorized).**
For planning continuity, the user's preferred Phase 8 direction is recorded
here. It is **not** authorized by this amendment and changes nothing in
Phase 7C/7D scope.

- *Required local / open-source stack:* OpenTelemetry Collector as the central
  telemetry router; Prometheus for metrics; Loki for logs; Jaeger for traces;
  Grafana for dashboards and visualization. (Today the observability stack is
  Collector + Jaeger; Prometheus, Loki, and Grafana would be Phase 8
  additions, all as local infrastructure containers under the existing §16
  "Docker for the observability stack" allowance.)
- *Vendor fan-out priority:* (1) Dynatrace — primary vendor target;
  (2) New Relic — secondary vendor target; (3) Datadog — tertiary / deferred,
  explicitly not a priority.
- *Constraints that already apply and must continue to apply:* Phase 8 remains
  deferred and must be **optional and disabled by default**; all fan-out is
  **Collector-owned**; and **no vendor SDKs are added to StoryTime application
  code**. The application emits OTLP to the local Collector exactly as it does
  today; vendor exporters are Collector configuration only. This keeps the
  containerization-vs-fan-out boundary (Q52) intact and keeps the resource
  identity contract the single basis for vendor entity mapping.

---

## Local-First Preservation Rules

- **Bare-metal local Python remains the default (Q38, Q39).** Everything
  continues to work with `uv run storytime ...` and no Docker. Bare-metal
  operation is not merely "still supported" — it remains the *primary*
  documented path and the foundation of the developer workflow.
- **Docker is optional (Q40).** After the amendment Docker is an **optional**
  capability: a supported, documented alternative for the blue/green demo and
  (already, per §16) for the observability stack. The amendment must use the
  word "optional" and must never make Docker "required." A contributor with no
  Docker installed can still develop StoryTime, run the pipeline, run the
  feed server, and run every quality gate.
- **The test gates never require Docker (Q42).** `uv sync`, `pytest`, `ruff`,
  `mypy`, `lint-imports`, and `storytime doctor` must all pass with no Docker
  present. Any container-related tests a later phase adds must validate
  configuration *as data* (compose/Dockerfile/volume declarations parsed and
  asserted), in the spirit of the existing `test_dashboards.py` and
  `test_frontdoor.py` patterns, and any genuinely live container smoke test
  must skip gracefully when Docker is absent.
- **Docs and commands must make the distinction explicit (Q41).** The README
  and runbook present bare-metal as the primary path and containerized
  blue/green as an optional demo path, clearly separated. `storytime doctor`
  already reports deployment identity and must remain meaningful in both
  modes; a later phase may *optionally* have it report whether it is running
  containerized or bare-metal, if that can be done as a low-risk read-only
  enhancement.
- **Onboarding (Q42).** New-contributor onboarding stays Docker-free by
  default. The containerized demo is opt-in and additive; it does not become a
  prerequisite for contributing.

---

## Security and Secrets Rules

- **Secrets in containerized local operation today (Q43).** Effectively none.
  StoryTime is local-first with no vendor integration, no auth, and no managed
  services. The only "secret-shaped" things are *future* vendor credentials
  (e.g. a Dynatrace token) that do not exist in the project now.
- **`.env` stays local-only and gitignored (Q44).** The repository already
  gitignores `.env`. The amendment keeps that. It also draws a clear line:
  *non-secret slot configuration* (ports, slot name) in `config/deploy/
  blue.env` / `green.env` MAY remain committed, because it contains no
  secrets; *secrets* (future tokens) must go in a separate, gitignored file
  (e.g. a `*.local.env` / `*.secret.env` pattern, or `.env`) that is **never**
  committed.
- **`.env.example` (Q45).** `.env.example` documents the *shape* of every
  environment variable — including placeholders for future vendor credentials
  with obviously fake values — so a contributor knows what is needed without
  any real secret being present in the repository.
- **Preparing for future vendor credentials without adding them (Q46).**
  Define the variable *names* and the gitignored secrets-file *location* now,
  in `.env.example` and `.gitignore`; add nothing real. Phase 8 then populates
  a local, gitignored secrets file from those documented names.
- **Preventing credential leakage (Q47).** Hard rules for any later phase:
  secrets are **runtime-injected** (via environment or a mounted file), never
  baked into the image with `COPY`/`ENV`; no secret appears in committed
  compose or env files; `.gitignore` and `.dockerignore` must both cover the
  secrets-file patterns so secrets reach neither version control nor the image
  build context; and logs / `doctor` output must never echo secret values.

---

## Implementation Risks

Risks the eventual Phase 7D implementation phase must manage (flagged here, not
solved here):

1. **SQLite WAL on the wrong filesystem.** Mitigated by the named-volume rule;
   the risk is an implementer using a host bind mount "because it is simpler."
   The implementation phase must enforce named volumes for state and document
   why.
2. **Non-loopback port publishing.** Docker's default publish form binds
   `0.0.0.0`. An implementer must use the explicit `127.0.0.1:` form or
   silently break §15. This must be a test-or-review checkpoint.
3. **Durable data in the container layer.** If `runs/`/`feed/` are not
   `.dockerignore`d and not volume-mounted, artifacts get baked into the image
   or lost on `docker rm`. The build context and volume wiring must be audited.
4. **`service.instance.id` left unpinned or container-derived.** Would
   reintroduce entity churn. The implementation must set it from config to a
   stable slot value and must not enable a resource detector that overrides it.
5. **Running the container as root / permission drift on volumes.** A later
   phase should run as a non-root user and ensure volume ownership is
   consistent so the SQLite files remain writable across recreate.
6. **uv / lockfile reproducibility inside the image.** The image build should
   install from the frozen `uv.lock` so the container and bare-metal
   environments match; a drift here would make "it works on my machine"
   ambiguous across modes.
7. **Base image instability.** The base image should be pinned (by digest,
   ideally) so rebuilds are reproducible.
8. **Test suite accidentally depending on Docker.** Any container test must be
   data-validation or skip-gracefully; the six gates must stay Docker-free.

---

## Architecture Risks

Risks to the architecture itself if the amendment is approved:

1. **Scope creep — "local demo container" silently becoming a production
   deployment assumption.** The amendment's explicit non-goals and the honesty
   requirements in the docs are the guardrail; reviewers should treat any
   later drift toward registries, cloud, or orchestration as requiring a fresh
   amendment.
2. **Two ways to run a slot drifting apart.** Bare-metal and containerized
   modes must stay behaviorally identical. The single-image, same-env-files,
   same-config-knobs rule keeps them aligned; a divergence (e.g. a
   container-only config path) would be an architecture smell.
3. **Erosion of the local-first charter.** If Docker quietly becomes the
   "real" way to run StoryTime, the charter is weakened. The "Docker optional,
   bare-metal default, gates Docker-free" rules exist to prevent this and
   should be checked at review.
4. **Weakening SQLite-as-source-of-truth.** The amendment keeps SQLite the
   source of truth and forbids a shared database; a later phase proposing a
   shared or networked database would be a separate, material amendment.
5. **Telemetry topology assumptions leaking into the app.** If routing/export
   logic creeps from the Collector into the app, the Phase 8 boundary breaks.
   The "app owns identity, Collector owns routing" rule is the defense.

**What would make this amendment unsafe to approve (Q56).** It should *not* be
approved if, as written or as later interpreted, it would: permit a shared
SQLite database or two writers on one DB; make Docker required rather than
optional; authorize cloud deployment, a registry, Kubernetes, or Terraform;
leave `service.instance.id` unpinned or container-derived; allow non-loopback
port exposure; permit secrets baked into images or committed; or weaken
SQLite/event_log/artifacts as the source of truth. If any of those are true,
the correct action is to revise the amendment, not approve it.

---

## Recommended Model Routing

- **Implementation lead after amendment lock (Q53): Claude Opus 4.7.** The
  eventual Phase 7D implementation is a multi-file, hardening-sensitive change
  — Dockerfile, `.dockerignore`, optional compose, per-slot named-volume and
  loopback-port wiring, a configuration change for stable instance identity, a
  possible `doctor` enhancement, documentation across several files, and
  data-as-configuration tests. That spread of cross-cutting, correctness-
  critical work fits the deep-implementation role. **Claude Sonnet 4.6** is
  appropriate for bounded cleanup after GPT/Gemini review.
- **GPT-5.5 review (Q54).** As mediator and state-keeper, GPT-5.5 should check
  that the amendment is internally consistent, that its scope is genuinely
  bounded (no hidden authorization of cloud/registry/orchestration), that the
  proposed canonical-state update is accurate and minimal, that the non-goals
  are airtight, and that the acceptance criteria are concrete and checkable.
- **Gemini critique (Q55).** Gemini should specifically stress-test: (a) the
  SQLite-WAL-over-volumes hardening — is the named-volume rule sufficient
  across Docker Desktop and OrbStack versions; (b) the Resource Identity
  Contract — does pinning `service.instance.id` to a slot value truly
  guarantee entity continuity, and are there OTel resource detectors that
  could still override it; (c) local-first preservation — is Docker genuinely
  optional, and do the gates truly stay Docker-free; (d) the Collector
  topology — does "app owns identity, Collector owns routing" actually set
  Phase 8 up cleanly, or is there a hidden coupling.

---

## Gemini Review Prompt Recommendation

A concise outline for the Gemini critique prompt (outline only):

- **Framing.** "You are reviewing a Phase 7C Architecture Baseline Amendment
  *candidate* for StoryTime. It proposes bounded, local-only, optional app
  containerization. Critique it before any implementation prompt is generated.
  Do not write code."
- **Focus areas.** (1) Data safety: is the per-slot-named-volume rule
  sufficient to make SQLite WAL safe across native Linux, Docker Desktop
  (virtiofs/gRPC-FUSE), and OrbStack; identify any residual corruption or
  locking risk. (2) Identity: does the Resource Identity Contract — pinned,
  slot-derived `service.instance.id` — actually guarantee stable Dynatrace
  entity mapping across rebuilds and the bare-metal↔container boundary; flag
  any OTel resource-detector interaction. (3) Local-first: confirm Docker is
  genuinely optional and the six gates remain Docker-free; flag anything that
  makes Docker creep toward required. (4) Phase 8 boundary: does the
  Collector-as-sole-fan-out-point rule cleanly separate containerization from
  vendor fan-out. (5) Scope: is anything cloud/registry/orchestration-shaped
  smuggled in.
- **Required output.** A keep/revise/reject verdict per focus area, a
  consolidated list of changes required before lock, and an explicit
  unsafe-to-approve list if any.

---

## Amendment Acceptance Criteria

The amendment can be locked only when all of the following are true:

1. Bare-metal local Python remains the default mode and all six gates pass
   with no Docker installed.
2. The amendment text states Docker is **optional** and never required.
3. Blue and green keep separate state roots and separate feed roots; no shared
   SQLite database; no design in which two processes write one SQLite DB.
4. The SQLite state directory is mandated onto per-slot named volumes, with
   cross-platform host bind mounts for the state DB explicitly prohibited.
5. Durable data (state DB, `runs/`, `feed/`) is mandated to live in named
   volumes that outlive containers; nothing durable in the container layer.
6. Container ports are mandated to publish to `127.0.0.1` only (§15 preserved).
7. A Resource Identity Contract is defined: `service.name`,
   `service.version`, `deployment.environment`, `deployment.slot`, and a
   pinned, slot-derived `service.instance.id`, stable across both modes; and
   automatic Docker/Host/process resource detectors are explicitly banned so
   they cannot overwrite the pinned `service.instance.id`.
8. The Phase 7B front door, active-slot pointer, and switch/rollback semantics
   are preserved unchanged.
9. The amendment authorizes no cloud deployment, no registry publishing (no
   Docker Hub / ECR / GHCR / GCP Artifact Registry / ACR or any other
   registry), no Kubernetes, no Terraform, no production HA/auth, no
   multi-tenancy, no active alerting, no CI/CD, and no vendor telemetry
   fan-out.
10. SQLite/event_log/artifacts remain the source of truth; `pipeline_run_id`
    remains the durable correlation key; `trace_id` remains ephemeral.
11. Secrets rules are stated: runtime-injected only, never in images, never
    committed; `.gitignore` and `.dockerignore` cover secret-file patterns.
12. The containerization-vs-fan-out boundary is stated: fan-out lives in the
    Collector; the app never changes for fan-out.
13. Blue/green state divergence is stated and accepted: slots use strictly
    isolated state, switching changes which isolated timeline is served, and
    no automated cross-slot migration or merge is in scope.
14. The four Gemini-required edits (resource detector ban, blue/green state
    divergence acknowledgement, loopback-only container port binding, no
    registry publishing) are incorporated as hard rules.
15. GPT-5.5 has re-reviewed the revised amendment, Gemini has re-reviewed it
    if required, and the user has explicitly approved the lock.

---

## Proposed Canonical State Update

*Concise appendable block — not a rewrite of the canonical state document.*

> **Phase 7C / 7C.1 Canonical State Update — Architecture Baseline Amendment
> Candidate (revised; proposed; not locked).**
>
> Phase 7C produced an Architecture Baseline Amendment *candidate*. Gemini
> reviewed it with a verdict of SAFE WITH EDITS. Phase 7C.1 applied the four
> required edits and a forward-looking Phase 8 note. No repository files were
> changed and no implementation was performed in either round.
>
> Proposed decision: amend Architecture Baseline §16 to permit **optional,
> local, single-host, demo-grade application containerization** of the
> existing blue/green slots. Bare-metal local Python remains the default
> supported mode; Docker remains optional; the six quality gates remain
> Docker-free.
>
> Preserved unchanged: local-first default; NoopTelemetry default;
> OTelTelemetry opt-in; OpenTelemetry import isolation; SQLite/event_log/
> artifacts as source of truth; `pipeline_run_id` as durable correlation key;
> `trace_id` ephemeral; artifact envelopes as inter-stage contract; DTO stage
> boundaries; non-god-object RunnerContext; explicit blue/green slot identity;
> separated blue/green state and feed roots; the Phase 7B front door, pointer,
> and switch/rollback.
>
> Established by the amendment: per-slot named volumes for state and feed;
> prohibition of shared SQLite and of cross-platform host bind mounts for the
> state DB; loopback-only container port publishing
> (`127.0.0.1:8000:8000` / `127.0.0.1:8001:8001`; `0.0.0.0` prohibited); a
> Resource Identity Contract pinning `service.name`, `service.version`,
> `deployment.environment`, `deployment.slot`, and a stable slot-derived
> `service.instance.id` across bare-metal and containerized modes, with
> automatic Docker/Host/process resource detectors banned; explicit
> acknowledgement that blue and green keep strictly isolated state timelines
> with no automated cross-slot migration or merge; the Collector as the single
> Phase 8 fan-out point.
>
> Still prohibited / deferred: cloud deployment; image-registry publishing to
> Docker Hub, ECR, GHCR, GCP Artifact Registry, ACR, or any other registry;
> image signing / SBOM / provenance; Kubernetes; Terraform; production HA;
> production auth; multi-tenancy; active alerting; CI/CD automation; and
> vendor telemetry fan-out (Phase 8 or later).
>
> Recorded (not authorized): the user's preferred Phase 8 backend stack —
> local/OSS Collector + Prometheus + Loki + Jaeger + Grafana — and vendor
> fan-out priority — Dynatrace (primary), New Relic (secondary), Datadog
> (tertiary/deferred). Phase 8 remains optional, disabled by default,
> Collector-owned, with no vendor SDKs in application code.
>
> Status: revised candidate awaiting GPT-5.5 re-review, Gemini re-review if
> required, and explicit user approval before lock. Implementation (Phase 7D)
> is not authorized by this update.

---

## Proposed Implementation Prompt Outline

*High-level outline only — this is not an implementation prompt and must not
be treated as one. It is sketched so reviewers can see where a locked
amendment would lead.*

A future **Phase 7D — App Containerization Implementation** prompt would, at a
high level, cover:

- Authoring an application `Dockerfile` (pinned base image, install from the
  frozen `uv.lock`, non-root runtime user).
- Authoring a `.dockerignore` excluding `runs/`, `feed/`, `.env`, caches, and
  any secrets-file patterns.
- An optional compose definition for the two app-slot containers, kept
  consistent with — and runnable alongside — the existing observability
  compose, with per-slot env files and per-slot named volumes.
- Per-slot named volumes for `runs/<slot>` and `feed/<slot>`; loopback-only
  port publishing (`127.0.0.1:8000` / `8001`).
- A bounded configuration change to set a stable, slot-derived
  `service.instance.id` from config, applied identically in both modes.
- An optional, low-risk `storytime doctor` enhancement reporting
  containerized-vs-bare-metal mode.
- Documentation: README and runbook updates clearly separating bare-metal
  (default) from the optional containerized demo, with honesty caveats and the
  virtiofs/FUSE named-volume guidance.
- Tests that validate the container configuration **as data** (no Docker
  required) plus optional live smoke tests that skip gracefully when Docker is
  absent.
- The standard six gates, all passing with no Docker installed.

The Phase 7D prompt itself would be authored only after this amendment is
locked, by the model routing recommended above.

---

## Confidence / Caveats

**Confidence: high** in the conservative recommendation — a narrow,
local-only, optional containerization amendment with a stable resource
identity contract is the proportionate answer, and it resolves the
sequencing risk Gemini correctly identified without over-reaching.

**Caveats:**

- This is **planning/amendment work only.** It authorizes no implementation,
  changes no repository files, and runs no tests. Phase 7D is not authorized
  until this amendment is reviewed and the user explicitly locks it.
- The SQLite-WAL-over-virtualized-filesystem behavior of Docker Desktop and
  OrbStack has improved over time and varies by version. The named-volume rule
  is the robust mitigation precisely because it avoids that layer entirely;
  reviewers should still treat host bind mounts of the state DB as unsafe
  regardless of any particular tool version.
- The amendment does not pre-judge Phase 8's exact final shape; it only fixes
  the boundary (fan-out lives in the Collector) and the identity contract that
  Phase 8 will rely on.
- The `service.instance.id` pinning is the one change the amendment recommends
  be treated as near-term and code-adjacent; everything else is structural
  amendment text. A reviewer may reasonably ask whether that small change
  should land as part of 7D or as an earlier micro-change — either is
  defensible.
- The user remains the final decision-maker. Per the Phase Closure Protocol,
  this candidate becomes a locked amendment only after GPT-5.5 review, Gemini
  critique, any required revision and re-review, and explicit user approval.

---

## Lock Readiness

After the Phase 7C.1 cleanup, the amendment candidate is, in my assessment,
**ready to advance to GPT-5.5 re-review and a user lock decision**, with a
Gemini re-review only if GPT-5.5 or the user requests one.

The basis for that assessment:

- Gemini's verdict was **SAFE WITH EDITS** — it agreed the amendment is
  narrow, local-first, and architecturally sound, and conditioned lock solely
  on four clarifying edits.
- All four required edits are incorporated as **hard rules** in their relevant
  sections (resource detector ban → *Resource Attribute Strategy*; blue/green
  state divergence → *Runs and Feed Artifact Persistence*; loopback-only
  container port binding → *Blue/Green Container Topology*; no registry
  publishing → *Explicit Non-Goals*), summarised in *Gemini-Required Cleanup
  Summary*, and reflected in *Amendment Acceptance Criteria* and the *Proposed
  Canonical State Update*.
- The four edits are clarifying constraints. None of them changes the
  amendment's recommendation, scope, or structure — they tighten wording so a
  later implementation phase cannot relax a guardrail by omission. There is no
  new architectural decision in this revision that would itself require fresh
  critique.
- The forward-looking Phase 8 note is explicitly **recorded, not authorized**;
  it changes nothing in Phase 7C/7D scope and creates no new commitment.

Recommended next steps in the Phase Closure Protocol:

1. **GPT-5.5 re-review** — confirm the four edits are faithfully incorporated,
   that scope remains bounded, and that the canonical-state update is accurate
   and minimal.
2. **Gemini re-review — optional.** Because every change in 7C.1 is a verbatim
   application of Gemini's own required edits, a further Gemini pass is not
   strictly necessary; it is reasonable for GPT-5.5 or the user to request one
   as a courtesy check, but the amendment does not depend on it.
3. **User lock decision** — the user, as final decision-maker, explicitly
   approves the Architecture Baseline amendment or returns it with further
   direction.
4. On lock, a separate **Phase 7D — App Containerization Implementation**
   round may be authored, by the model routing recommended above.

This remains planning/amendment work only. Nothing in this document authorizes
implementation; Phase 7D is not authorized until the user explicitly locks the
amendment.
