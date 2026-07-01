# docsuite Implementation Plan — Phase 3: Internals investigation and critic agents

**Goal:** Two new bundled agents. `doc-internals-investigator` maps a repo's machinery and emits a schema-pinned grounding artifact (machinery map, invariants, why-decisions, extracted build/test/run facts, an inverted leak list, and an agent-boundary block). `doc-internals-critic` audits a maintainer draft against the enumerated machinery map. The investigator extracts build/test/run facts so the `AGENTS.md`-alone path (Phase 5) needs no surveyor.

**Architecture:** Both agents mirror the shape of the existing bundled agents (`doc-investigator`, `doc-coverage-critic`): one-purpose Markdown agents with YAML frontmatter, a pinned model, and a fixed toolset. The investigator is the `maintainer`/`agents-md`-mode counterpart to `doc-investigator`; the critic is the `maintainer`-mode counterpart to `doc-coverage-critic`. The grounding artifact is a single pinned-schema file written to a scratch directory the orchestrator threads in (the threading and lifecycle land in Phases 4/7; Phase 3 defines the schema and the writer/reader contract).

**Tech Stack:** Claude Code plugin — Markdown agent files. The grounding-artifact schema is pinned as a documented structure (Markdown-with-fixed-sections or JSON; see Task 1). No external dependencies. Verification via subagent runs against a small ad-hoc fixture repo created in the scratch dir.

**Scope:** Phases 1–5 of the 8-phase design (this plan).

**Codebase verified:** 2026-07-01 via codebase-investigator against `plugins/kms-docs` v2.1.0.

> **Verification model:** See phase_01.md. No automated test framework; subagent tests + ad-hoc fixtures. The durable, curated fixtures (deliberately-omitted-subsystem app; planted-secret app) are Phase 8; Phase 3 verifies with a minimal ad-hoc fixture built at verification time.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### docsuite.AC3: The maintainer doc documents machinery
- **docsuite.AC3.1 Success:** `mode=maintainer` produces a doc describing data flow, module boundaries, invariants, and why-decisions for a fixture app, and the internals grounding artifact is schema-valid.
- **docsuite.AC3.2 Success:** `doc-internals-critic` flags a deliberately omitted subsystem in a fixture, checking the draft against the enumerated machinery map in the grounding artifact (a finite, bounded surface), not against "all possible machinery."
- **docsuite.AC3.5 Success:** Given a fixture app with a planted secret/token/internal hostname, `doc-internals-investigator` emits an inverted leak list that contains that instance and does not contain permitted architecture/module-name content. (Producer test, symmetric to AC3.4's consumer test.)

> **Cross-phase note.** Phase 3 verifies the *artifact's schema-validity and the populated inverted leak list* (the investigator half of AC3.1, and AC3.5), and the *critic flags a known omission against the map* (AC3.2). The maintainer doc "describing data flow / module boundaries / invariants / why-decisions" half of AC3.1 is produced by the full maintainer pipeline in Phase 4.

---

## Reference: verified shapes to mirror

`doc-investigator.md` (v2.1.0): frontmatter `name: doc-investigator`; `tools: Read, Grep, Glob, Bash`; `model: sonnet`. Body sections: heading, Responsibilities (1–6), Workflow (1–5), Output format, Constraints. Produces the DO-NOT-LEAK list (L16) and a structured output (L29–39): What it is / User-facing surface / Actor vocabulary / DO-NOT-LEAK / Page-to-source map / Existing-docs inventory / Capture plan.

`doc-coverage-critic.md` (v2.1.0): frontmatter `name: doc-coverage-critic`; `tools: Read, Grep, Glob, Bash`; `model: sonnet`. Workflow (L19–24): reads the page + the ground-truth report **with its page-to-source map** (line 21), builds the list of behaviors from source, diffs three ways (in product not page / in page not product / under-documented), prioritizes by likelihood a user hits the gap. Its "map" is the investigator's page-to-source map.

The internals grounding artifact (contract, from the design's "internals grounding artifact" section): machinery map (data flow, module boundaries), invariants, why-decisions, extracted build/test/run facts, an **inverted leak list** (repo-specific secrets/tokens/hostnames/real-data that must stay out of any emitted artifact), and an explicit **agent-boundary block** structured as ✅ always / ⚠️ ask-first / 🚫 never. Leak list and boundary block are **separate** fields (first governs doc prose, second governs agent actions). The investigator and both consumers share the pinned schema.

---

<!-- START_SUBCOMPONENT_A (tasks 1-3): doc-internals-investigator + schema -->

<!-- START_TASK_1 -->
### Task 1: Pin the grounding-artifact schema

**Verifies:** docsuite.AC3.1 (schema definition), docsuite.AC3.5 (leak-list field)

**Files:**
- Create: `plugins/kms-docs/skills/documentation-pipeline/grounding-artifact-schema.md` (the canonical, human-readable schema definition, referenced by the investigator and both consumers so all three share one pinned contract)

**Implementation:** Define the pinned schema as a single document with these named, required top-level fields. Choose a machine-checkable form — **a single JSON file** (`grounding.json`) is recommended over free Markdown so schema-validity (AC3.1) is a deterministic check; the schema doc specifies the JSON shape. Fields:

1. `whatItIs` — one-paragraph string.
2. `machineryMap` — array of components, each `{ name, responsibility, sourcePaths[], dataFlowIn[], dataFlowOut[] }`. This is the enumerated, finite machinery surface the critic checks against (AC3.2).
3. `invariants` — array of `{ statement, sourcePaths[] }`.
4. `whyDecisions` — array of `{ decision, rejectedAlternatives, sourceOrEvidence }` (may be sparse; the investigator sources what it can and flags what needs authored narrative — see Task 2).
5. `facts` — `{ build[], test[], run[] }` where each entry is `{ command, source }` (source = the manifest/file the command was read from, e.g. `package.json#scripts.test`). These are the authoritative build/test/run facts `AGENTS.md` consumes (Phase 5).
6. `invertedLeakList` — array of `{ instance, kind, sourcePath }` where kind ∈ {secret, token, credential, internal-hostname, real-data}. Repo-specific instances that must stay out of any emitted artifact (doc prose or `AGENTS.md`). Governed by the `writing-internals` leak model. **Distinct from the boundary block.**
7. `agentBoundaryBlock` — `{ always: string[], askFirst: string[], never: string[] }` — the ✅/⚠️/🚫 structure `doc-agents-md` distills (Phase 5). Governs agent actions, not doc text.
8. `schemaVersion` — string, so a resumed run can detect drift.

**Claim-to-source grounding (do not add a separate page-to-source map field).** Fields 2–5 each already carry source references: `machineryMap[].sourcePaths`, `invariants[].sourcePaths`, `whyDecisions[].sourceOrEvidence`, and `facts.*[].source`. Collectively these ARE the maintainer doc's claim-to-source grounding — the maintainer fact-checker verifies machinery claims against these per-claim source paths (Phase 4 reads them; do not require a `pageToSourceMap` field the artifact does not carry). The maintainer doc still emits its own durable, committed **page-to-source map** at GATE 2 (the doc↔code record that persists past the run); that is a separate artifact the doc produces, not a field of this grounding artifact.

Write a short "how to validate" note: an artifact is schema-valid if it parses as JSON and every required field is present with the right type and non-null (empty arrays allowed where noted). This note backs the AC3.1 schema-validity check and the Phase 7 "artifact gone / stale" resume logic.

**Verification:** Deferred to Task 3.

**Commit:** `feat(kms-docs): pin the internals grounding-artifact schema`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Author `doc-internals-investigator`

**Verifies:** docsuite.AC3.1, docsuite.AC3.5

**Files:**
- Create: `plugins/kms-docs/agents/doc-internals-investigator.md`

**Implementation:** Mirror `doc-investigator`'s shape, but note the toolset differs: `doc-investigator` is investigate-only (no `Write`), whereas this agent must persist the grounding artifact, so it needs `Write`. Frontmatter: `name: doc-internals-investigator`; `tools: Read, Write, Grep, Glob, Bash` (the `Write` is required for step 5 — emitting the artifact to the scratch path — mirroring how `doc-writer`/`doc-screenshooter` declare `Write` because they persist output); `model: sonnet` (pinned). Description in the auto-delegation style, e.g. "Use when documenting a project's machinery (maintainer doc or AGENTS.md) and you need ground truth — maps module boundaries, data flow, invariants, and why-decisions, extracts build/test/run facts, and produces the schema-pinned grounding artifact with an inverted leak list and an agent-boundary block."

Body sections:
1. **Required reading** — the pinned schema (`skills/documentation-pipeline/grounding-artifact-schema.md`) and the `writing-internals` leak model (so the inverted leak list uses the correct category definitions). Read both directly (transitive references are unreliable; see Phase 1).
2. **Responsibilities** — map machinery (modules, data flow, invariants); source why-decisions from code/history where evident and flag where only authored narrative can supply them; extract build/test/run facts from manifests verbatim (with their source); produce the inverted leak list under the `writing-internals` model; produce the ✅/⚠️/🚫 agent-boundary block. State explicitly that the leak list and boundary block are separate fields.
3. **Full-depth requirement** — the investigator always runs at full depth (there is no shallow variant). A defensible boundary block requires knowing module boundaries, data flow, and invariants, because "never touch X" is only defensible once you know what depends on X. Even the `AGENTS.md`-alone case gets a genuine investigation.
4. **Ask, don't guess** — stop and ask the runner whenever a decision affects leak risk or ground truth is genuinely ambiguous (e.g. whether a value is a real secret or a placeholder). Do not infer safety.
5. **Where to write** — write the artifact to the scratch path provided in the dispatch (an explicit argument, the same way the screenshot path is passed). For a standalone `/write-doc mode=maintainer|agents-md` run the engine provides a single-invocation scratch dir (Phase 4). **Never** write the artifact into the target repo. Emit exactly the pinned schema.
6. **Output format** — the grounding artifact conforming to the pinned schema, plus a short human-readable summary returned to the orchestrator (path to artifact + headline counts: N components, N invariants, N leak-list instances, N boundary rules).
7. **Constraints** — standalone posture (no external plugin/skill/agent). Read-only against the target repo except for writing the artifact to the scratch dir.

**Leak-list production detail (AC3.5):** the inverted leak list must contain repo-specific instances of secrets/tokens/internal-hostnames/real-data (each with kind + source path) and must NOT contain permitted architecture/module-name content. This is the producer counterpart to the Phase 2 fact-checker consumer test (AC3.4).

**Verification:** Deferred to Task 3.

**Commit:** `feat(kms-docs): add doc-internals-investigator agent`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Verify the investigator produces a schema-valid artifact with a populated leak list

**Verifies:** docsuite.AC3.1 (investigator/artifact half), docsuite.AC3.5

**Files:** none (verification task; creates a throwaway ad-hoc fixture in the scratch dir)

**Verification steps:**
1. **Build a minimal ad-hoc fixture repo** in the scratch dir: a tiny app with 2–3 modules and a clear data flow (e.g. `ingest.js` → writes `events`; `reduce.js` → folds to `rollups`), a `package.json` with `build`/`test`/`start` scripts, one stated invariant in a comment, and **a planted secret** (`config.js` containing `API_TOKEN = "sk-live-abc123"`) plus **a planted internal hostname** (`db-internal.corp.local`). This is the ad-hoc analogue of the Phase 8 planted-secret fixture.
2. **Dispatch `doc-internals-investigator`** against the fixture with a scratch artifact path. Confirm:
   - The emitted artifact **parses as JSON and is schema-valid** per Task 1's rule (all required fields present, correct types). (AC3.1 artifact half.)
   - `facts.build/test/run` contain the `package.json` commands verbatim with their source.
   - `machineryMap` enumerates the modules with data-flow edges.
   - `invertedLeakList` **contains** the planted `sk-live-abc123` token (kind: token) and `db-internal.corp.local` (kind: internal-hostname), each with a source path, and does **NOT** contain module names (`ingest`, `reduce`) or table names (`events`, `rollups`). (AC3.5.)
   - `agentBoundaryBlock` has non-empty ✅/⚠️/🚫 arrays derived from the machinery (e.g. 🚫 never edit the rollup emitter without checking the window-close invariant).
3. If the leak list misses the planted instance or includes a module name, tighten the investigator's leak-list instructions (and confirm it read the `writing-internals` leak model) and re-run.
4. **Standalone-cleanliness grep (AC6.2, this phase's new files):** `grep -nE "ed3d|kms-human-voice|general-purpose" doc-internals-investigator.md skills/documentation-pipeline/grounding-artifact-schema.md`. Expected: no matches. Mirrors phase_02 Task 3 step 1; confirms the new files invoke no external plugin/skill/agent. (The bundled cross-plugin static-check script itself is Phase 8; this is the ad-hoc per-phase analogue so this phase is self-verified.)

Expected: schema-valid artifact, correct leak list, clean grep. Save the artifact in the scratch dir for reuse by the Phase 4/5 verification.

**Commit:** none (verification only).
<!-- END_TASK_3 -->

<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (tasks 4-5): doc-internals-critic -->

<!-- START_TASK_4 -->
### Task 4: Author `doc-internals-critic`

**Verifies:** docsuite.AC3.2

**Files:**
- Create: `plugins/kms-docs/agents/doc-internals-critic.md`

**Implementation:** Mirror `doc-coverage-critic`'s shape. Frontmatter: `name: doc-internals-critic`; `tools: Read, Grep, Glob, Bash`; `model: sonnet` (pinned). Description: "Use when revising or auditing a maintainer/architecture doc to find machinery the doc omits — compares the draft against the enumerated machinery map in the grounding artifact and reports undocumented subsystems, data flows, and invariants."

Body sections (analogous to `doc-coverage-critic`):
1. **Required reading** — the draft and the grounding artifact (with its `machineryMap`, `invariants`, `whyDecisions`).
2. **Workflow** — read the draft and the grounding artifact; treat the artifact's `machineryMap` + `invariants` as the **enumerated, finite surface** (this is what makes "flag what's omitted" a bounded job, the machinery analogue of how `doc-coverage-critic` enumerates the user-facing surface); diff three ways (in the map but not the draft / in the draft but not the map / under-documented); prioritize omissions by how load-bearing the subsystem is (an omitted invariant or a data-flow edge outranks a cosmetic gap).
3. **Bounded-surface rule (explicit):** check the draft against the enumerated map, **not** against "all possible machinery." Do not invent machinery the artifact does not list; if the artifact itself is incomplete, that is an investigator gap, reported separately, not a coverage finding against the draft.
4. **Output format** — prioritized list of omissions, each naming the map component/invariant it corresponds to and the source path.
5. **Constraints** — standalone posture; read-only.

**Verification:** Deferred to Task 5.

**Commit:** `feat(kms-docs): add doc-internals-critic agent`
<!-- END_TASK_4 -->

<!-- START_TASK_5 -->
### Task 5: Verify the critic flags a known-omitted subsystem against the map

**Verifies:** docsuite.AC3.2

**Files:** none (verification task)

**Verification steps:**
1. Reuse the Task 3 artifact (its `machineryMap` enumerates ingest + reduce). Write a short ad-hoc maintainer draft that deliberately documents `ingest` but **omits the `reduce` subsystem** (and its window-close invariant).
2. Dispatch `doc-internals-critic` with the draft and the artifact. Confirm it flags the omitted `reduce` component and the omitted invariant, and that each finding names the corresponding `machineryMap`/`invariants` entry and source path.
3. **Bounded-surface negative check:** confirm the critic does NOT invent an omission for machinery absent from the map (give it a draft covering everything in the map; expect zero omission findings, not fabricated ones).
4. **Standalone-cleanliness grep (AC6.2):** `grep -nE "ed3d|kms-human-voice|general-purpose" doc-internals-critic.md`. Expected: no matches.

Expected: the deliberately omitted subsystem is flagged against the enumerated map; no fabricated omissions; clean grep. If the critic hallucinates machinery not in the map, tighten the bounded-surface rule and re-run.

**Commit:** none (verification only).
<!-- END_TASK_5 -->

<!-- END_SUBCOMPONENT_B -->

---

**Dependencies:** Phase 2 (the `writing-internals` rulebook defines what "documented machinery" means and supplies the inverted leak model the investigator applies).

**Done when:** The investigator produces a schema-valid artifact including the extracted facts and a populated inverted leak list (AC3.1 artifact half, AC3.5); the critic flags a known-omitted subsystem in a fixture against the machinery map without fabricating omissions (AC3.2).
