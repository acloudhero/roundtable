# Gemini Response — Phase 7C Claude Prompt Critique

### Executive Verdict
**SAFE TO SEND WITH MINOR EDITS.** This prompt is an exceptionally mature piece of Systems Engineering. It successfully translates the strategic pivot (doing containerization planning before telemetry fan-out) into a rigorously bounded task for an LLM. By explicitly treating the prompt as an "amendment proposal" rather than an "implementation ticket," you have successfully neutralized Claude Opus's tendency to prematurely generate Dockerfiles and Terraform scripts.

### Prompt Scope Assessment
**Status: EXCELLENT.**
The prompt perfectly anchors Phase 7C as a documentation-and-design-only phase. The "Critical Instruction" section is an airtight "Opus Shield" (Do not implement, Do not write Dockerfiles, Do not write docker-compose files, etc.). It gives Opus exactly enough structure to think deeply about the topology without authorizing a single line of executable code.

### Architecture Baseline Compliance
**Status: PASSED.**
The prompt explicitly enforces that the Architecture Baseline is currently *unamended* and that this exercise is the bureaucratic prerequisite to changing it. By forcing Opus to answer *whether* the baseline should be amended—and under what exact constraints—you preserve the RoundTable source-of-truth governance model perfectly.

### Containerization Design Coverage
**Status: PASSED.**
You have successfully mapped out the "hard parts" of local containerization. Too often, containerization prompts just ask for a Dockerfile. This prompt forces the model to think about the *operating model* of the containers: active vs. inactive slots, front-door proxy locations, and artifact persistence.

### SQLite / WAL / Volume Risk Review
**Status: PASSED (WITH ONE MINOR BLIND SPOT).**
Questions 5 through 10 aggressively target the primary failure mode of containerized local development: SQLite database corruption over Docker volume mounts. Forcing the model to confront WAL mode behavior, file locking, and concurrent write boundaries will prevent catastrophic data loss during Blue/Green container swaps.

*Blind Spot:* It does not explicitly ask Opus to account for host-OS differences (e.g., macOS/Windows Docker Desktop file-sharing performance and locking quirks vs. native Linux). *See Recommended Edits.*

### Blue/Green Topology Review
**Status: PASSED.**
The prompt elegantly extends the Phase 7A/7B logic into the container realm. Asking whether inactive slot traffic should be "blocked or merely not routed" (Question 19) is a brilliant forcing function to make Opus design a secure, honest active-slot architecture.

### OpenTelemetry / Resource Identity Review
**Status: PASSED.**
This is the strongest section of the prompt. Question 35 ("How should service.instance.id be handled so local PID vs container ID does not destroy demo continuity?") proves that the lessons from the Gemini critique were deeply absorbed. By forcing Opus to lock down deployment.environment, deployment.slot, and service.name now, you are ensuring Phase 8 (Vendor Fan-Out) will be a smooth configuration exercise rather than a topological rewrite.

### Local-First and Security Review
**Status: PASSED.**
Questions 38 through 42 ensure that the ARCH-LOCK on local-first development is not destroyed by the introduction of Docker. Forcing the model to design a system where Docker is optional (or at least where bare-metal Python remains supported) maintains the low-friction developer experience. The security questions properly defer Phase 8 vendor secrets.

### Hidden Implementation Leakage
**Status: LOW RISK.**
The constraints against writing code and configurations are exhaustive. However, under the required output section "Proposed Canonical State Update", Opus might be tempted to rewrite your entire canonical-state.md file. The prompt's instruction to "Write a user-reviewable proposed canonical state update" is mostly safe, but you might want to specify that it should only provide the *diff* or the *appendment*, not the full document, to save tokens.

### Missing Questions or Requirements
1. **Cross-Platform Volume Quirk:** Docker volume mounts for SQLite behave very differently on macOS/Windows (Docker Desktop / OrbStack) compared to native Linux due to file synchronization layers (virtiofs, gRPC FUSE).
2. **Data-Wipe Semantics:** If a container is spun down or rebuilt, what guarantees that runs/ and feed/ are not accidentally orphaned or destroyed?

### Recommended Edits
I recommend adding the following specific bullet points to the prompt before dispatching it to Claude Opus:

1. **Under "SQLite / WAL / Volume Strategy", add:**
   - *How should the design account for cross-platform Docker volume mounting quirks (e.g., macOS/Windows virtiofs/FUSE file locking constraints vs native Linux) when running SQLite in WAL mode?*
2. **Under "Runs and Feed Artifact Persistence", add:**
   - *How does the topology guarantee that spinning down or recreating a slot's container does not destroy the underlying audio artifacts?*
3. **Under "Explicit Non-Goals", add:**
   - *Do not output docker init commands or suggest scaffolding CLI tools.*
4. **Under "Required Output Format -> Proposed Canonical State Update", refine to:**
   - *Write a concise, user-reviewable proposed appendment to the canonical state. Do not rewrite the entire canonical state document.*

### Final Recommendation
**GO.** Apply the minor recommended edits and send this to Claude Opus 4.7. This prompt is a masterclass in AI constraint management. It successfully forces a highly capable model to do the difficult, unglamorous work of Systems Architecture definition before it is allowed to play with Dockerfiles.
