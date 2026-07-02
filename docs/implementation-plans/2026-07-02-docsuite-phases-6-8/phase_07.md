# docsuite Phases 6–8 Implementation Plan — Phase 7: Project orchestration

**Goal:** Add a `documenting-a-project` skill and a `/document-project <repo-path>` command that run survey → set gate → per-doc engine (once per doc, in the right mode), own the run-scoped grounding-artifact scratch lifecycle, maintain a committed per-project ledger with resume, guard against concurrent runs, and enforce the maintainer-investigation → `AGENTS.md` dependency.

**Architecture:** `documenting-a-project` is a second orchestrator skill layered over the existing per-doc engine (`documentation-pipeline` skill + `/write-doc`), matching the existing orchestrator-skill shape. It is pure orchestration: it dispatches only bundled agents and composes the existing pipeline. It dispatches `doc-surveyor` (Phase 6), holds the new **set gate**, then for each approved doc runs the `documentation-pipeline` in the correct mode, threading a caller-owned scratch path (the per-doc engine already accepts a caller-supplied scratch path and defers lifecycle to the caller — `documentation-pipeline/SKILL.md:70`). It reads/writes the committed ledger; the per-doc engine and `/write-doc` never touch the ledger.

**Tech Stack:** Markdown skill (SKILL.md) + markdown command. Orchestration steps use `Bash` for the scratch dir (`mktemp -d`), the lock file (atomic `mkdir`), and ledger read/write; the `Task` tool to dispatch agents; and the same human-gate presentation style the existing gates use.

**Scope:** Phases 6–8 of the docsuite design; Phases 1–5 shipped on `master`.

**Codebase verified:** 2026-07-02 via codebase-investigator.

**Key grounding facts (verified):**
- The per-doc engine already supports a caller-owned scratch path: `documentation-pipeline/SKILL.md:70` — "If a caller (the project orchestrator) already supplied a scratch path, use that and do not create or clean one; the caller owns the lifecycle." Phase 7 is that caller.
- **Grounding-artifact scratch dir lives OUTSIDE the target repo**, created with `mktemp -d` (`documentation-pipeline/SKILL.md:70`, design line 187). `HANDOFF-docsuite.md:28` has a **stale** line placing it at `<repo>/docs/.kms-run/internals-grounding.md` — that decision was reversed; do NOT write the grounding artifact into the target repo. Writing there risks committing an internals dump on a crash and would require mutating the target's `.gitignore`, which the plugin has no authority to do.
- **The ledger is different from the grounding artifact.** The ledger IS committed inside the target repo at `<repo>/docs/.docsuite-ledger.md` (design line 99, 319). Only the grounding artifact stays out of the repo.
- Grounding-artifact schema (`grounding-artifact-schema.md`): fields `whatItIs`, `machineryMap`, `invariants`, `whyDecisions`, `facts{build,test,run}`, `invertedLeakList`, `agentBoundaryBlock{always,askFirst,never}`, `schemaVersion`. `doc-agents-md` reads `facts` for commands (`doc-agents-md.md:24-27`).
- Facts precedence already documented in the engine (`documentation-pipeline/SKILL.md:86,159`; design line 282): standalone `agents-md` uses the investigation's `facts`; under `/document-project`, set-gate corrections override on conflict.
- Command template: `commands/write-doc.md` — frontmatter `description` + `argument-hint`, no `allowed-tools`, no `model`; parses args then runs the pipeline. `/write-doc`'s trailing-mode parsing + unrecognized-mode refusal already exist (Phase 1).
- Skill frontmatter: `documentation-pipeline/SKILL.md:1-4` — `name` + `description`, no `allowed-tools`.
- Sequencing + gate model locked in `HANDOFF-docsuite.md:19-29`: 1 set gate + 2 gates/doc = 6 gates for a 3-doc run; sequence survey → user guide → maintainer → `AGENTS.md`.
- No ledger, lock file, or backlink machinery exists yet — all net-new here. Page-to-source map + code-to-docs backlink are described in the engine's post-approval step (`documentation-pipeline/SKILL.md:161-167`) but the ledger is Phase 7's.

**Fixture note:** Behavioral verification against ad-hoc fixtures at verification time (no test runner). Where an AC needs a repeatable multi-run scenario (resume, failure policy), use a small scratch git repo created in the verification step.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### docsuite.AC2: The survey proposes and reconciles a doc set
- **docsuite.AC2.5 Edge:** A wholesale rejection at the set gate (operator declines the entire proposed set or cancels) aborts the run cleanly without writing a ledger or any doc.

### docsuite.AC5: Orchestration runs the gates, tracks, and resumes
- **docsuite.AC5.1 Success:** A default 3-doc run hits exactly 6 gates (1 set + 2 + 2 + 1).
- **docsuite.AC5.2 Success:** The committed ledger in `<repo>/docs/` records per-doc status through the defined states.
- **docsuite.AC5.3 Success:** Re-invoking `/document-project` reads the ledger and skips docs already marked `done`; a doc marked `investigation-done` whose scratch grounding artifact is gone is demoted and re-investigated rather than skipped.
- **docsuite.AC5.4 Failure:** A failed maintainer *investigation* blocks the dependent `AGENTS.md`. A maintainer doc that fails at drafting or GATE 2 *after* a valid investigation does not block `AGENTS.md`. Independent docs proceed regardless.
- **docsuite.AC5.5 Edge:** Corrections made at the set gate are written into the facts record the investigation and `AGENTS.md` consume, and override investigation-derived facts on conflict.
- **docsuite.AC5.6 Edge:** Direct `/write-doc` invocations do not read or write the ledger; the ledger is owned solely by `/document-project`, so the two entry points cannot silently drift its state.

---

<!-- START_SUBCOMPONENT_A (tasks 1-3) -->

<!-- START_TASK_1 -->
### Task 1: Author the `documenting-a-project` orchestrator skill

**Verifies:** docsuite.AC2.5, docsuite.AC5.1–docsuite.AC5.5 (deliverable; tested in Tasks 3–6)

**Files:**
- Create: `plugins/kms-docs/skills/documenting-a-project/SKILL.md`

**Implementation:**

Create the file with this content. It is the single owner of the scratch-dir lifecycle, the set gate, the ledger, and the concurrent-run guard.

```markdown
---
name: documenting-a-project
description: Use when documenting a whole project (not a single page) - orchestrates a survey, a set-level human gate, and the per-doc documentation engine once per proposed doc, owning a run-scoped grounding-artifact scratch lifecycle and a committed per-project ledger with resume. Invoked by the /document-project command.
---

# Documenting a Project

You orchestrate documentation for an entire project: propose a doc set, get it approved at one set gate, then run the per-doc engine for each doc. You own the scratch-dir lifecycle, the ledger, and the concurrent-run lock. You dispatch only bundled agents; you invoke no external plugin, skill, or general-purpose agent.

## Inputs

- `<repo-path>`: absolute path to the target repo (required).

## Overview of the run

survey → SET GATE → per doc in sequence (user guide → maintainer → `AGENTS.md`), each through the existing engine and its gates → update the committed ledger. A default 3-doc run passes exactly **6 gates**: set gate (1) + user guide GATE 1 and GATE 2 (2) + maintainer GATE 1 and GATE 2 (2) + `AGENTS.md` single result gate (1) = 6.

## Step 0 — Concurrent-run lock

Acquire a lock so a second run on the same repo cannot start concurrently:

1. Lock path: `<repo>/docs/.docsuite.lock`. Before creating it, record whether `<repo>/docs/` already existed (`test -d "<repo>/docs" && echo pre-existing`). Then `mkdir -p "<repo>/docs"`. Remember whether *you* created `docs/`, so a clean abort can remove it if it is left empty.
2. Acquire atomically: `mkdir "<repo>/docs/.docsuite.lock"` (mkdir fails if it already exists — an atomic test-and-set). Write an `owner` file inside recording the run-id and timestamp.
3. If acquisition fails because the directory exists, STOP and tell the runner another `/document-project` run holds the lock. If the runner confirms no other run is active (a prior crash left a stale lock), instruct them to remove `<repo>/docs/.docsuite.lock` and re-invoke. Do not force-remove it yourself.
4. Release the lock at the end of the run (success or abort), and on any early exit. On a clean abort (set-gate rejection) where no ledger or doc was written, also remove `<repo>/docs/` if you created it in item 1 above and it is now empty, so a rejected run leaves the target repo exactly as it was found.

## Step 1 — Run-scoped scratch dir (grounding-artifact lifecycle owner)

1. Create the scratch root OUTSIDE the target repo: `SCRATCH=$(mktemp -d -t docsuite-run-XXXXXX)`. `mktemp -d` yields a fresh, empty, uniquely-named dir, which gives per-run isolation (concurrent runs never share a scratch dir) and satisfies on-entry idempotency by construction (nothing to clean in a fresh dir).
2. **Never** create the scratch dir inside `<repo>`; the grounding artifact must not risk being committed into the target repo. (The stale `HANDOFF-docsuite.md:28` `.kms-run` path is superseded — ignore it.)
3. Thread `SCRATCH` into every per-doc engine dispatch as the caller-supplied scratch path; the engine writes/reads the grounding artifact there and does not create or clean its own (`documentation-pipeline/SKILL.md:70`). The internals investigation writes the pinned-schema artifact as `$SCRATCH/grounding.json` (per `grounding-artifact-schema.md`); the maintainer writer and the `AGENTS.md` distiller read that same file within the run.
4. On exit (success or abort), remove `SCRATCH` (`rm -rf "$SCRATCH"`). The grounding artifact is run-scoped and never persists across runs; the durable record is each doc's page-to-source map, committed by the engine.

## Step 2 — Survey

Dispatch `doc-surveyor` (Task tool, subagent type `doc-surveyor`) at `<repo-path>`. It returns the classification, the proposed doc set (with per-doc mode and write-fresh/audit-existing), the set-gate facts bundle, the safe-capture Q&A, and any blockers.

## Step 3 — SET GATE (human)

Present the surveyor's output to the human: the proposed doc set, each doc's mode and write-fresh/audit-existing intent, each doc's scope, the facts bundle, the safe-capture plan stub, and any blockers (unrunnable-for-capture app, monorepo per-package boundaries).

Ask the human to **approve, adjust, or reject**:
- **Approve:** proceed with the set as shown.
- **Adjust:** the human may drop/add docs, flip write-fresh vs audit-existing, edit scope, and **correct facts** (build/test/run commands, stack). Record every correction.
- **Reject (wholesale):** the human declines the entire set or cancels. In this case, **abort cleanly: write no ledger and no doc**, release the lock, remove the scratch dir, and remove `<repo>/docs/` if you created it in Step 0 and it is now empty, then stop. The ledger is created only in Step 4 (after approval), so a rejection leaves the target repo exactly as it was found.

**Set-gate corrections are authoritative.** Write the corrected facts into a corrected-facts record kept in `SCRATCH` (e.g. `SCRATCH/set-gate-facts.md`) and thread it into the maintainer investigation and the `AGENTS.md` distiller. On any conflict between a set-gate-corrected fact and an investigation-derived fact, the set-gate correction wins.

## Step 4 — Initialize / read the ledger

The ledger is committed at `<repo>/docs/.docsuite-ledger.md` and is owned solely by this skill. `/write-doc` never reads or writes it.

- **Fresh run (no ledger):** after set-gate approval, create the ledger with one row per approved doc at status `pending`, recording each doc's mode and intent (write / audit).
- **Resume run (ledger exists):** read it. For each doc:
  - status `done` → **skip**.
  - status `investigation-done` (maintainer/agents-md) → the grounding artifact is run-scoped and this is a new run, so the prior artifact is gone: **demote to `pending` and re-investigate**. Do not treat a stale `investigation-done` as satisfied.
  - status `gate2-passed` → the doc already cleared its final human gate; a crash between GATE 2 and the `done` write left it here. **Advance it to `done` and skip** — do NOT re-run the pipeline or re-ask the human gates for an already-approved doc, and do not re-promote already-committed output.
  - status `doc-failed` or `investigation-failed` → present at the set gate; if the human re-approves the doc, reset it to `pending`.
  - any genuinely-intermediate status (`grounded`, `gate1-passed`, `drafted`) → resume from `pending` (re-ground), since that doc's scratch state does not persist across runs and it has not yet been human-approved at GATE 2.

**Ledger states:** `pending | grounded | investigation-done | gate1-passed | drafted | gate2-passed | done | doc-failed | investigation-failed`. `grounded` marks the user-guide grounding milestone; `investigation-done` marks the maintainer/agents-md investigation milestone (same pipeline stage, named per mode). Update the committed ledger as each doc advances, and commit the ledger change.

## Step 5 — Per-doc engine, in sequence

Run the approved docs in this order: **user guide → maintainer → `AGENTS.md`**. For each doc, dispatch the existing `documentation-pipeline` engine in the doc's mode, passing:
- the target and `<repo-path>`;
- the doc's **mode** (`user-guide` | `maintainer` | `agents-md`);
- the **execution intent**: `write` (start fresh) or `audit` (re-ground and revise the existing page);
- the caller-supplied scratch path `SCRATCH`;
- for maintainer and `AGENTS.md`, the corrected-facts record from Step 3.

Update the ledger at each milestone (`grounded`/`investigation-done`, `gate1-passed`, `drafted`, `gate2-passed`, `done`). The engine still holds its own GATE 1 and GATE 2 (user guide, maintainer) or single result gate (`AGENTS.md`).

### Failure policy (dependency: `AGENTS.md` depends on the maintainer *investigation*)

**Observable success signal.** Investigation success is not a narrated status; it is a checkable artifact. After the investigation stage, the maintainer investigation is considered to have **succeeded** only if `$SCRATCH/grounding.json` exists AND passes the pinned schema-validity check (the same check AC3.1 relies on). If that file is absent or fails schema validation, the investigation **failed**. Decide `investigation-done` vs `investigation-failed` on this condition, not on prose.

- If the **maintainer investigation** fails (no valid `$SCRATCH/grounding.json`), mark the maintainer doc `investigation-failed` and **halt `AGENTS.md`** (it has no grounding artifact to distill). Mark `AGENTS.md` blocked/`pending` and report it.
- If the maintainer doc has a **valid investigation** but fails later (drafting or GATE 2), mark it `doc-failed`. This does **not** block `AGENTS.md` — the grounding artifact exists in `SCRATCH` and `AGENTS.md` distills from it.
- **Independent docs proceed regardless.** The user guide never blocks the maintainer/`AGENTS.md` docs and vice versa.

## Step 6 — Finish

Release the lock, remove `SCRATCH`, and report the final ledger state.

## Standalone posture

You invoke no external plugin, skill, or agent. No `ed3d-*`, no `kms-human-voice`, no general-purpose agent. You dispatch only the bundled `doc-surveyor` and the bundled per-doc engine and its bundled agents.
```

**Verification:**

Run: `test -f plugins/kms-docs/skills/documenting-a-project/SKILL.md && head -3 plugins/kms-docs/skills/documenting-a-project/SKILL.md`
Expected: File exists; frontmatter shows `name: documenting-a-project`.

Run (informal standalone pre-check; the authoritative check is Phase 8's `scripts/standalone-check.sh`): `grep -nE 'ed3d-|general-purpose|kms-human-voice' plugins/kms-docs/skills/documenting-a-project/SKILL.md | grep -vi 'no external\|invokes\? no\|no general-purpose\|no cross-plugin\|standalone posture' || echo "clean"`
Expected: `clean` (only the standalone-posture declaration mentions these, as things it does NOT invoke).

**Commit:** `feat(kms-docs): add documenting-a-project orchestrator skill`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Author the `/document-project` command

**Verifies:** docsuite.AC5.1 (entry point; tested in Task 3)

**Files:**
- Create: `plugins/kms-docs/commands/document-project.md`

**Implementation:**

Create the file, mirroring `commands/write-doc.md`'s shape (frontmatter `description` + `argument-hint`, no `allowed-tools`, no `model`):

```markdown
---
description: Document a whole project - survey the repo, approve the doc set at one set gate, then run the per-doc engine for each doc (user guide, maintainer, AGENTS.md) with a committed ledger and resume
argument-hint: "[repo path]"
---

Run the `documenting-a-project` skill for the repo in `$ARGUMENTS`.

Parse `$ARGUMENTS` as the target repo path. If it is empty or not an existing directory, stop and ask the runner for a valid repo path; do not guess.

The skill owns the whole run: it dispatches `doc-surveyor`, holds the set gate, runs the per-doc engine once per approved doc (user guide → maintainer → `AGENTS.md`) in the right mode, owns the run-scoped grounding-artifact scratch dir and the concurrent-run lock, and maintains the committed ledger at `<repo>/docs/.docsuite-ledger.md` with resume. This command is the sole entry point that reads or writes that ledger; `/write-doc` never touches it.

Do not accept a `mode` argument here — a project run always covers the approved set, and each doc's mode is decided by the surveyor's proposal and the set gate.
```

**Verification:**

Run: `test -f plugins/kms-docs/commands/document-project.md && head -3 plugins/kms-docs/commands/document-project.md`
Expected: File exists; frontmatter shows the `description` and `argument-hint`.

**Commit:** `feat(kms-docs): add /document-project command`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Wire execution intent (write / audit) into the per-doc engine

**Verifies:** docsuite.AC5.2 (the recorded `write`/`audit` intent is actually consumed, not just stored) and the behavioral half of docsuite.AC2.3 (an `audit-existing` doc is handled differently from a `write-fresh` doc). Tested by the audit-behavior check in Task 4.

**Why this task exists:** The orchestrator (Task 1, Step 5) passes each doc's execution intent, and the ledger records it, but the shipped per-doc engine has no input for it — `documentation-pipeline/SKILL.md`'s "Inputs you need first" lists only target + source, and `write-doc.md` parses only target + repo + mode. Today "revising or auditing an existing page" (`documentation-pipeline/SKILL.md:13`) is implicit behavior inferred from whether the page exists, not an explicit consumed parameter. Without this task the orchestrator would hand the engine an argument it ignores, and an `audit-existing` doc would be treated identically to `write-fresh`. This closes the design's requirement that "audit vs write [is] passed to the engine as explicit execution intent" (design line 323).

**Files:**
- Modify: `plugins/kms-docs/skills/documentation-pipeline/SKILL.md` — the "Inputs you need first" block (~lines 17-22) and the drafting stage
- Modify: `plugins/kms-docs/commands/write-doc.md` — a one-line note only (see below); do NOT add a new positional argument

**Implementation:**

1. In `documentation-pipeline/SKILL.md`, add an explicit **execution intent** input to "Inputs you need first": `write` | `audit`.
   - **Default when no caller supplies it:** infer from whether the target page already exists — page absent → `write`; page present → `audit`. This preserves the current standalone `/write-doc` behavior exactly (the implicit revise-if-exists behavior at `SKILL.md:13`), so a bare `/write-doc` run is unchanged.
   - **When a caller (the project orchestrator) supplies intent explicitly, that value wins** over the inference.
2. Branch the drafting stage on intent:
   - `audit` → re-ground against the existing page and treat drafting as a **revision of that page** (feed the existing page to `doc-writer`/`doc-reviser` as the base to revise), updating the page-to-source map rather than authoring a replacement from scratch.
   - `write` → author fresh.
   - The grounding/investigation stage runs in both cases; only the drafting base differs.
3. State that the orchestrator supplies intent as **named context on dispatch** (skill-to-skill context passed in the Task prompt), not as a positional CLI argument — so this does not touch `/write-doc`'s argument surface or its mode-parsing (leave AC1.x unrecognized-mode behavior untouched).
4. In `write-doc.md`, add a single clarifying sentence that a standalone `/write-doc` run infers intent from page existence and takes no explicit intent argument. Do not add a positional arg.

**Verification:**

Run: `grep -ni 'execution intent\|intent' plugins/kms-docs/skills/documentation-pipeline/SKILL.md | head`
Expected: the Inputs block and drafting stage reference the `write`/`audit` intent.

Behavioral (also exercised in Task 4): dispatch a `maintainer` doc with intent `audit` against a fixture that already has a maintainer page; confirm the engine revises the existing page (page-to-source map updated, existing content revised) rather than replacing it wholesale. A `write` run on a fresh target authors anew.

**Commit:** `feat(kms-docs): thread write/audit execution intent through the per-doc engine`
<!-- END_TASK_3 -->

<!-- END_SUBCOMPONENT_A -->

<!-- START_TASK_4 -->
### Task 4: Verify gate count, ledger states, and audit-vs-write behavior on a default 3-doc run (AC5.1, AC5.2)

**Verifies:** docsuite.AC5.1, docsuite.AC5.2, and the audit-behavior half of docsuite.AC2.3 (Task 3's engine wiring)

**Files:**
- Create (ad-hoc, outside the repo): a small user-facing git repo fixture (a runnable app with a `README`, real build/test/run scripts, and at least one documentable subsystem) under `$(mktemp -d)/proj/`, `git init`ed so the committed ledger has somewhere to live.

**Implementation / test procedure (behavioral, no test runner):**

1. Build the fixture repo (user-facing app with a safe/demo mode so capture is not blocked — or accept image-less to keep the run moving).
2. Invoke `/document-project <fixture-path>`. Drive it through: set-gate approval of the default 3-doc set; then each doc's gates. To keep the run tractable, you may approve quickly at each gate; the point is to **count the human gates and observe ledger transitions**, not to produce polished docs.
3. Count the gates encountered.
4. Inspect `<fixture>/docs/.docsuite-ledger.md` after the run (and, if practical, between docs).

**Testing:**
- **docsuite.AC5.1:** exactly **6** human gates occur: 1 set gate + user guide GATE 1 + user guide GATE 2 + maintainer GATE 1 + maintainer GATE 2 + `AGENTS.md` single result gate.
- **docsuite.AC5.2:** the committed ledger records each doc advancing through the defined states (e.g. `pending → grounded/investigation-done → gate1-passed → drafted → gate2-passed → done`), and the file is committed into `<fixture>/docs/`.
- **Audit-vs-write behavior (Task 3):** run the maintainer doc twice — once with intent `write` on a fresh target (confirm it authors from scratch), and once with intent `audit` against a fixture that already has a maintainer page (confirm the engine revises that existing page rather than replacing it). This exercises the engine wiring added in Task 3, proving `audit-existing` and `write-fresh` diverge in behavior, not just in the ledger.

**Verification:** Confirm the gate count is exactly 6, the ledger shows per-doc state progression, and the audit run revises while the write run authors fresh. Also confirm the grounding artifact was created as `grounding.json` under a `mktemp` dir OUTSIDE the fixture repo (not in `<fixture>/docs/.kms-run/`), and that the scratch dir and lock are gone after the run.

**Commit:** none (verification only). Fix Task 1/2/3 files if any check fails, then re-run.
<!-- END_TASK_4 -->

<!-- START_TASK_5 -->
### Task 5: Verify resume — skip `done`, advance `gate2-passed`, re-investigate stale `investigation-done` (AC5.3)

**Verifies:** docsuite.AC5.3

**Implementation / test procedure:**

1. Reuse (or rebuild) the Task 3 fixture repo with a committed ledger.
2. **Skip-done:** hand-edit the ledger so the user-guide doc is `done`, then re-invoke `/document-project`. Confirm the orchestrator **skips** the user-guide doc (does not re-run its pipeline).
3. **Stale investigation-done:** hand-edit the ledger so the maintainer doc is `investigation-done`. Since the scratch grounding artifact is run-scoped and the prior run's `mktemp` dir is gone, re-invoke and confirm the orchestrator **demotes** the maintainer doc to `pending` and **re-investigates** it rather than skipping or erroring on a missing artifact.
4. **Advance gate2-passed:** hand-edit the ledger so a doc is `gate2-passed` (approved at its final gate but not yet marked `done`). Re-invoke and confirm the orchestrator **advances it to `done` and skips** — it must NOT re-run the pipeline or re-ask the human gates for an already-approved doc.

**Testing:**
- **docsuite.AC5.3:** `done` docs are skipped on re-invocation; a `gate2-passed` doc is advanced to `done` and skipped (no gate re-run); a `investigation-done` doc whose scratch artifact is absent is demoted and re-investigated.

**Verification:** Observe the orchestrator's decisions (skip / advance / re-investigate) match the three scenarios. If not, fix the Step 4 resume logic in `documenting-a-project/SKILL.md`.

**Commit:** none (verification only).
<!-- END_TASK_5 -->

<!-- START_TASK_6 -->
### Task 6: Verify failure policy — investigation-failed blocks AGENTS.md, doc-failed does not (AC5.4)

**Verifies:** docsuite.AC5.4

**Implementation / test procedure:**

Because inducing a genuine investigation failure in a live run is awkward, verify via two controlled scenarios using the ledger + a forced-failure prompt:

1. **investigation-failed blocks AGENTS.md:** drive a run where the maintainer investigation produces **no valid `$SCRATCH/grounding.json`** — the observable failure signal from Step 5 (e.g. instruct the dispatched investigator to exit without writing the artifact, or corrupt the written artifact so it fails the schema-validity check). Confirm the orchestrator detects the missing/invalid artifact, marks the maintainer doc `investigation-failed`, and **halts `AGENTS.md`** (marks it blocked/`pending`, does not attempt to distill), while the independent user-guide doc still proceeds.
2. **doc-failed does not block AGENTS.md:** drive a run where the maintainer investigation succeeds (a schema-valid `$SCRATCH/grounding.json` is written) but the maintainer doc fails at GATE 2 (reject at the final gate). Confirm the maintainer doc is `doc-failed` and `AGENTS.md` **still runs**, distilling from the existing valid grounding artifact.

**Testing:**
- **docsuite.AC5.4:** the `investigation-failed` case halts `AGENTS.md`; the `doc-failed`-after-valid-investigation case does not; independent docs proceed in both cases.

**Verification:** Confirm both branches behave as specified. If not, fix the Step 5 failure policy in `documenting-a-project/SKILL.md`.

**Commit:** none (verification only).
<!-- END_TASK_6 -->

<!-- START_TASK_7 -->
### Task 7: Verify set-gate corrections override facts, clean rejection, and ledger isolation (AC5.5, AC2.5, AC5.6)

**Verifies:** docsuite.AC5.5, docsuite.AC2.5, docsuite.AC5.6

**Implementation / test procedure:**

1. **Set-gate correction overrides facts (AC5.5):** run `/document-project` on the fixture; at the set gate, correct a build/test/run command (make it differ from what the surveyor/investigation extracted). Proceed to the maintainer investigation and `AGENTS.md`. Confirm the corrected-facts record in `SCRATCH` is threaded through and that the generated `AGENTS.md` uses the **set-gate-corrected** command, not the investigation-derived one.
2. **Clean wholesale rejection (AC2.5):** run `/document-project` on a fresh fixture (no prior ledger); at the set gate, **reject the entire set / cancel**. Confirm the run aborts cleanly: **no `.docsuite-ledger.md` is written**, no doc is created, the lock is released, and the scratch dir is removed.
3. **Ledger isolation (AC5.6):** run a direct `/write-doc <target> <fixture> maintainer` (single-doc entry) against the same fixture. Confirm it does **not** create or modify `<fixture>/docs/.docsuite-ledger.md` (grep for the file before/after; it must be untouched by `/write-doc`).

**Testing:**
- **docsuite.AC5.5:** set-gate-corrected facts win over investigation-derived facts downstream (visible in `AGENTS.md`).
- **docsuite.AC2.5:** wholesale rejection writes no ledger and no doc, and unwinds lock + scratch.
- **docsuite.AC5.6:** `/write-doc` neither reads nor writes the ledger.

**Verification:** Confirm all three. For AC5.6, a `stat`/`git status` on the ledger path before and after the `/write-doc` run must show no change (or no file). Fix the relevant skill steps if any check fails.

**Commit:** none (verification only).
<!-- END_TASK_7 -->

---

**Phase 7 done when:** execution intent (`write`/`audit`) is wired into the engine and an `audit` run revises while a `write` run authors fresh (Task 3); a full 3-doc run hits exactly 6 gates and records per-doc status in the committed ledger (AC5.1, AC5.2); resume skips `done` docs, advances `gate2-passed` to `done` without re-running gates, and re-investigates stale `investigation-done` docs (AC5.3); an investigation-failed maintainer doc (no valid `grounding.json`) blocks `AGENTS.md` while a doc-failed-after-valid-investigation one does not (AC5.4); set-gate corrections override investigation-derived facts (AC5.5); a wholesale set-gate rejection aborts cleanly with no ledger and leaves the repo as found (AC2.5); and `/write-doc` never touches the ledger (AC5.6). The grounding artifact is always created as `grounding.json` outside the target repo, and the lock + scratch dir are cleaned on exit.
