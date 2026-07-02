# docsuite Phases 6–8 Implementation Plan — Phase 6: Survey stage

**Goal:** Add a bundled `doc-surveyor` agent that, given an app repo, classifies it, inventories existing docs (marking each write-fresh vs audit-existing), proposes the doc set from the default taxonomy, extracts a set-gate facts bundle, and asks the safe-capture questions — producing everything the Phase 7 set gate needs, without invoking anything external.

**Architecture:** `doc-surveyor` is a one-purpose read-only bundled agent in `plugins/kms-docs/agents/`, modeled on the existing `doc-investigator` (same frontmatter shape, section structure, standalone posture, and ask-don't-guess pattern). It only produces a proposal and a facts bundle as a structured report; it writes no files and holds no gate. The Phase 7 orchestrator (`/document-project`) will dispatch it and present its output at the set gate. It reuses the existing mode vocabulary (`user-guide` | `maintainer` | `agents-md`) as the doc-set taxonomy.

**Tech Stack:** Markdown agent definition (YAML frontmatter + prompt body). No code, no npm dependency. Tools: `Read, Grep, Glob, Bash` (read-only investigation).

**Scope:** 3 phases from the original design (Phases 6–8 of the docsuite design; Phases 1–5 already shipped on `master`).

**Codebase verified:** 2026-07-02 via codebase-investigator.

**Key grounding facts (verified):**
- Agent frontmatter convention (`plugins/kms-docs/agents/doc-investigator.md:1-6`): `name`, `description` (third person, "Use when…"), `tools`, `model`. Model pinned as the literal string `sonnet` or `opus` (no `claude-` prefix, no version).
- `doc-investigator.md` is the closest template: sections `# Heading`, `## Responsibilities`, `## Workflow`, `## Output format`, `## Constraints`. It already inventories existing docs as a table `file | covers | gaps or staleness` (`doc-investigator.md:18,27,38`).
- Default doc set (`plugins/kms-docs/HANDOFF-docsuite.md:21`): "user guide + maintainer/architecture doc + `AGENTS.md`." The mode table (`documentation-pipeline/SKILL.md:50-54`) is the taxonomy; modes are `user-guide`, `maintainer`, `agents-md` (`STATUS.md:39-46`).
- The authoritative build/test/run facts `AGENTS.md` consumes come from the internals investigation's `facts` object (`grounding-artifact-schema.md:99-136`), NOT from the surveyor. The surveyor's facts bundle is the lighter set-gate bundle; Phase 7 reconciles the two (set-gate corrections override on conflict — AC5.5).
- Standalone posture is declared inline in existing agents. `doc-internals-investigator.md:79` reads "You invoke no external plugin, skill, or agent. No `ed3d-*`, `kms-*`, or cross-plugin references." `doc-agents-md.md:61` uses its own wording ("**Standalone posture:** No external plugin, skill, or agent. Only the bundled filter script and bundled schema.") with no forbidden token. Phase 8's static check greps for external references; the surveyor must carry the same kind of declaration and stay clean.
- Ask-don't-guess pattern precedent: `doc-internals-investigator.md:40-48` ("Stop and ask the runner whenever…"). Safe-capture negotiation precedent: `documentation-pipeline/SKILL.md:72-83` (five safe-capture options).

**Fixture note:** Phases 6–7 verify behaviorally against **ad-hoc fixtures created at verification time** (the same approach Phases 1–5 used — see `docs/implementation-plans/2026-07-01-docsuite/test-requirements.md:11`). The *durable, curated* fixtures and the formal standalone acceptance test are Phase 8. There is no automated test runner in this plugin; verification is "dispatch the agent, inspect the structured output against the AC."

---

## Acceptance Criteria Coverage

This phase implements and tests:

### docsuite.AC2: The survey proposes and reconciles a doc set
- **docsuite.AC2.1 Success:** For an app repo, `doc-surveyor` emits a proposed doc set (default taxonomy) plus a set-gate facts bundle (build/test/run commands, structure, stack).
- **docsuite.AC2.2 Success:** For a non-user-facing tooling repo, the survey drops the user guide from the proposal.
- **docsuite.AC2.3 Success:** Each existing doc is marked write-fresh vs audit-existing.
- **docsuite.AC2.4 Failure:** An app not runnable in a safe capture mode is flagged (screenshots may be skipped), surfaced at the set gate, not discovered mid-run.

### docsuite.AC7: Cross-cutting — ask, don't guess
- **docsuite.AC7.1 Success:** The surveyor asks the runner which data/accounts/verticals/fixtures are safe to capture and whether a safe mode exists, recording answers into the capture plan.

> **docsuite.AC2.5** (clean set-gate rejection aborts without writing a ledger) is *completed* in Phase 7, where the set gate and ledger live. Phase 6 only ensures the surveyor writes nothing itself, so a rejection has nothing to unwind.

---

<!-- START_SUBCOMPONENT_A (tasks 1-3) -->

<!-- START_TASK_1 -->
### Task 1: Author the `doc-surveyor` agent

**Verifies:** docsuite.AC2.1, docsuite.AC2.2, docsuite.AC2.3, docsuite.AC2.4, docsuite.AC7.1 (deliverable; tested in Tasks 2–3)

**Files:**
- Create: `plugins/kms-docs/agents/doc-surveyor.md`

**Implementation:**

Create the file with exactly this content (it mirrors `doc-investigator.md`'s shape and the established standalone/ask-don't-guess patterns):

```markdown
---
name: doc-surveyor
description: Use when documenting a whole project and you need to propose the doc set before any per-doc work - classifies a repo, inventories existing docs marking each write-fresh vs audit-existing, proposes the doc set from the default taxonomy, extracts a set-gate facts bundle, and asks the safe-capture questions
tools: Read, Grep, Glob, Bash
model: sonnet
---

# Doc Surveyor

You survey a whole project and propose the documentation set it should have, before any single document is written. You produce a proposal and a facts bundle for a human set gate to approve, adjust, or reject. You write no files and make no decisions the human has not confirmed.

## Responsibilities

1. Classify the repo: read manifests, entry points, and structure to determine what kind of project it is (user-facing app, library, CLI, service, internal tooling) and its stack.
2. Inventory existing docs. For each doc that overlaps the proposed set, mark it **write-fresh** (no usable existing doc, author from scratch) or **audit-existing** (a usable doc exists; re-ground and revise it rather than replace it).
3. Propose the doc set from the default taxonomy, adjusted for the repo (see Default taxonomy below).
4. Produce a set-gate **facts bundle**: build/test/run commands, repo structure, and stack. This bundle informs the set-gate proposal. It is NOT the authoritative facts source — the internals investigation extracts the authoritative build/test/run facts that `AGENTS.md` consumes. Where they conflict, set-gate corrections win downstream. Extract commands verbatim from manifests and cite each command's source file.
5. Ask the safe-capture questions (see Ask, Don't Guess) and record the answers into a capture-plan stub for the user guide.
6. Flag blocking conditions for the set gate: an app that cannot be run in a safe capture mode (screenshots may be skipped), and a monorepo with distinct per-package agent boundaries (out of v1 scope — a single flat boundary block cannot describe it).

## Default taxonomy

The v1 default doc set is: **user guide** (`mode=user-guide`), **maintainer/architecture doc** (`mode=maintainer`), and **`AGENTS.md`** (`mode=agents-md`). Use these exact mode names — they are the same modes the per-doc engine dispatches.

Adjust the default for the repo:

- **Drop the user guide** when the repo has no user-facing surface — a library, an internal tool, a build/CI helper, or a package consumed only by other code. A project with no human end-user product does not get a user guide. Keep the maintainer doc and `AGENTS.md`.
- Keep the maintainer doc and `AGENTS.md` for any code repo; both rest on the internals investigation, which every code repo supports.
- Ops/runbook, internal-API/reference, and non-app *process* docs are out of scope for v1 — do not propose them.

## Workflow

1. **Classify.** Read the manifests (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `Makefile`, `docker-compose.yml`, etc.), the entry points, and the top-level structure. Decide the project kind and stack. Note whether a user-facing surface exists.
2. **Inventory docs.** Find existing documentation (`README`, `docs/`, `AGENTS.md`, `CLAUDE.md`, wikis in-repo). For each, record what it covers and whether it is usable. Mark write-fresh vs audit-existing.
3. **Propose.** Build the doc-set proposal from the default taxonomy, adjusted per Default taxonomy. For each proposed doc, state its mode, whether it is write-fresh or audit-existing, and a one-line scope.
4. **Extract facts.** Copy build/test/run commands verbatim from manifests into the facts bundle with source citations. Record structure and stack.
5. **Ask safe-capture questions** (only relevant when a user guide is proposed). Record answers.
6. **Flag blockers** for the set gate.
7. **Return** the structured report below. Write nothing to disk.

## Output format

Return a single structured report with these sections:

- **Classification** — project kind, stack, whether a user-facing surface exists.
- **Proposed doc set** — a table: `doc | mode | write-fresh / audit-existing | one-line scope`. If the user guide was dropped, say so and why.
- **Existing-docs inventory** — a table: `file | covers | gaps or staleness | write-fresh / audit-existing`.
- **Set-gate facts bundle** — build / test / run commands (each with its source file), repo structure summary, stack. Marked "set-gate bundle — the internals investigation extracts the authoritative facts."
- **Safe-capture Q&A** — the questions asked and the runner's answers, as a capture-plan stub (surface → how it will be rendered with no real data). Present only when a user guide is proposed.
- **Blockers / flags** — app not runnable in a safe capture mode (with what is missing); monorepo with per-package boundaries (out of v1 scope); anything else the set gate must see before approving.

## Ask, Don't Guess

**Stop and ask the runner whenever:**

- A capture decision affects leak risk. Never infer what is safe to screencap. Ask explicitly: which data, accounts, verticals, and fixtures are safe to capture, and whether the app has a safe or demo mode that scopes displayed data to safe values. Record the answers into the capture-plan stub.
- The project kind is genuinely ambiguous (it is unclear whether there is a real user-facing surface, so it is unclear whether a user guide belongs).
- You cannot tell whether an existing doc is usable enough to audit rather than rewrite.

**Do not infer safety.** If you are unsure whether a surface can be captured without exposing real data, ask. It is better to ask and delay than to propose an unsafe capture plan.

## Constraints

- Read-only. You write no files and create no docs, no ledger, and no capture output. You produce a proposal and a facts bundle only.
- You do not run the app, log in, or take screenshots. You propose a capture plan; capture happens later, in the per-doc engine, behind its own gate.
- You extract commands verbatim; you do not invent or "correct" build/test/run commands.

## Standalone posture

You invoke no external plugin, skill, or agent. No `ed3d-*`, no `kms-human-voice`, no cross-plugin references, no general-purpose agent. Use only your own tools and the repo under survey.
```

**Verification:**

Run: `test -f plugins/kms-docs/agents/doc-surveyor.md && head -6 plugins/kms-docs/agents/doc-surveyor.md`
Expected: File exists; frontmatter shows `name: doc-surveyor`, `tools: Read, Grep, Glob, Bash`, `model: sonnet`.

Run (informal standalone pre-check; the authoritative check is Phase 8's `scripts/standalone-check.sh`): `grep -nE 'ed3d-|general-purpose|kms-human-voice' plugins/kms-docs/agents/doc-surveyor.md | grep -vi 'no external\|invokes\? no\|no general-purpose\|no cross-plugin\|standalone posture' || echo "clean"`
Expected: `clean` (the only allowed match is the standalone-posture declaration line, which names `ed3d-*` as something it does NOT invoke).

**Commit:** `feat(kms-docs): add doc-surveyor agent for project doc-set survey`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Verify the surveyor on a user-facing app fixture (AC2.1, AC2.3, AC2.4, AC7.1)

**Verifies:** docsuite.AC2.1, docsuite.AC2.3, docsuite.AC2.4, docsuite.AC7.1

**Files:**
- Create (ad-hoc, outside the repo): a minimal user-facing app fixture under a scratch dir, e.g. `$(mktemp -d)/surveyed-app/` containing a `package.json` with `build`/`test`/`start` scripts, one source entry point, and one pre-existing `README.md` that partially documents usage.

**Implementation / test procedure:**

This is a behavioral verification of a prompt-driven agent — there is no unit-test harness. Dispatch the agent and inspect its structured report against the ACs.

1. Build the ad-hoc fixture: a tiny runnable web/CLI app with a `package.json` whose `scripts` include real `build`, `test`, and `start` commands, a source file or two, and a `README.md` that covers install but not the full feature surface (so the inventory has both a "covers" and a "gap"). Do NOT give it a safe/demo mode, so AC2.4 has something to flag.
2. Dispatch `doc-surveyor` via the Task tool (subagent type `doc-surveyor`) pointed at the fixture path, with a prompt instructing it to survey the repo and return its report. When it reaches the safe-capture questions, answer as the runner (e.g. "no demo mode exists; only the seeded local fixture is safe").
3. Inspect the returned report.

**Testing — the report must show:**
- **docsuite.AC2.1:** a **Proposed doc set** table including user guide + maintainer + `AGENTS.md` with correct modes, AND a **Set-gate facts bundle** listing the fixture's `build`/`test`/`start` commands (verbatim, with `package.json` cited), plus structure and stack.
- **docsuite.AC2.3:** the **Existing-docs inventory** marks the `README.md` as `audit-existing` (usable, partial) — demonstrating the write-fresh vs audit-existing distinction.
- **docsuite.AC2.4:** a **Blockers / flags** entry noting the app has no safe capture mode, so screenshots may be skipped — surfaced in the report (which the set gate will show), not discovered mid-run.
- **docsuite.AC7.1:** a **Safe-capture Q&A** section recording that the surveyor asked which data/accounts/verticals/fixtures are safe and whether a safe mode exists, with the runner's answers captured into a capture-plan stub.

**Verification:** Manually confirm each of the four bullets above appears in the report. Record the pass in the verification notes.

**Commit:** none (verification only; fixture is ad-hoc and outside the repo). If any AC fails, fix `doc-surveyor.md` (Task 1) and re-run.
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Verify the surveyor drops the user guide for a non-user-facing repo (AC2.2)

**Verifies:** docsuite.AC2.2

**Files:**
- Create (ad-hoc, outside the repo): a minimal non-user-facing tooling repo under a scratch dir, e.g. `$(mktemp -d)/tooling-lib/` — a library or build helper with a `package.json` marked as a library (no `start`/serve script, exports only), source modules, and no end-user product.

**Implementation / test procedure:**

1. Build the ad-hoc fixture: a library/tooling repo with no user-facing surface (e.g. a set of exported utility modules, or a CI/build helper). No runnable end-user app.
2. Dispatch `doc-surveyor` (subagent type `doc-surveyor`) at the fixture path.
3. Inspect the returned report.

**Testing:**
- **docsuite.AC2.2:** the **Proposed doc set** table does NOT include a user guide, and the report states why (no user-facing surface). It still proposes the maintainer doc and `AGENTS.md`. No safe-capture Q&A is required (no user guide → no capture).

**Verification:** Manually confirm the user guide is absent with a stated reason, and the maintainer + `AGENTS.md` docs remain. If it fails, fix `doc-surveyor.md`'s Default taxonomy / classification instructions (Task 1) and re-run Tasks 2–3.

**Commit:** none (verification only). If Task 1 was edited to fix a failure, amend/extend the Task 1 commit.
<!-- END_TASK_3 -->

<!-- END_SUBCOMPONENT_A -->

---

**Phase 6 done when:** `doc-surveyor.md` exists and loads; a dispatch against a user-facing app fixture returns a proposal + facts bundle, marks existing docs write-fresh/audit-existing, flags an unrunnable-for-capture app, and records safe-capture answers (AC2.1, AC2.3, AC2.4, AC7.1); a dispatch against a non-user-facing tooling repo drops the user guide (AC2.2); and the agent is standalone-clean.
