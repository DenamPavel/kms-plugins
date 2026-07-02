---
name: documenting-a-project
description: Use when documenting a whole project (not a single page) - orchestrates a survey, a set-level human gate, and the per-doc documentation engine once per proposed doc, owning a run-scoped grounding-artifact scratch lifecycle and a committed per-project ledger with resume. Invoked by the /document-project command.
---

# Documenting a Project

You orchestrate documentation for an entire project: propose a doc set, get it approved at one set gate, then run the per-doc engine for each doc. You own the scratch-dir lifecycle, the ledger, and the concurrent-run lock. You dispatch only bundled agents; you invoke no external plugin, skill, or general-purpose agent.

## Inputs

- `<repo-path>`: absolute path to the target repo (required).

## Overview of the run

survey → SET GATE → per doc in sequence (user guide → maintainer → `AGENTS.md`), each through the existing engine and its gates → update the committed ledger. A default 3-doc run passes exactly **6 gates**: set gate (1) + user guide GATE 1 and GATE 2 (2) + maintainer GATE 1 and GATE 2 (2) + `AGENTS.md` result gate (1) = 6. (Under `/document-project`, the orchestrator suppresses agents-md's engine-level GATE 1 because the set gate already approved the scope; agents-md runs with only the result gate.)

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
  - status `investigation-done` (maintainer/agents-md) → the grounding artifact is run-scoped (per Step 1, each new run creates a fresh `mktemp` scratch dir), so the prior artifact from the last run is gone. **Demote to `pending` and re-investigate** (Step 5's artifact check below will verify this). Do not treat a stale `investigation-done` as satisfied.
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

**Agents-md gate suppression instruction:** When dispatching the engine for `agents-md` mode, instruct it to suppress the engine's GATE 1 (scope/boundary review) and hold only the result gate. Rationale: agents-md has no drafting/review/revision stages, so its scope GATE 1 is redundant with the set gate already held by the orchestrator; maintainer's GATE 1 presents both the leak list and the machinery scope that drive a full draft/review/revise pass, so it is retained. The net effect is 1 set gate + 2 gates per (user guide, maintainer) + 1 result gate for agents-md = 6 gates total for a 3-doc run.

Update the ledger at each milestone (`grounded`/`investigation-done`, `gate1-passed`, `drafted`, `gate2-passed`, `done`). For `agents-md`, the engine holds only the result gate, not GATE 1 and GATE 2; update the ledger accordingly (`investigation-done` when the investigation completes, then direct to result gate, then `done` or `doc-failed` after GATE result is final).

### Failure policy (dependency: `AGENTS.md` depends on the maintainer *investigation*)

**Observable success signal.** Investigation success is not a narrated status; it is a checkable artifact. After the investigation stage, the maintainer investigation is considered to have **succeeded** only if `$SCRATCH/grounding.json` exists AND passes schema validation. **You (the orchestrator) validate `$SCRATCH/grounding.json` against the Validation Rules in `plugins/kms-docs/skills/documentation-pipeline/grounding-artifact-schema.md`** (the "An artifact is schema-valid if and only if…" section). If that file is absent or fails validation, the investigation **failed**. Decide `investigation-done` vs `investigation-failed` on this condition, not on prose.

- If the **maintainer investigation** fails (no valid `$SCRATCH/grounding.json`), mark the maintainer doc `investigation-failed` and **halt `AGENTS.md`** (it has no grounding artifact to distill). Mark `AGENTS.md` `pending` (halted due to missing maintainer investigation) and report it.
- If the maintainer doc has a **valid investigation** but fails later (drafting or GATE 2), mark it `doc-failed`. This does **not** block `AGENTS.md` — the grounding artifact exists in `SCRATCH` and `AGENTS.md` distills from it.
- **Independent docs proceed regardless.** The user guide never blocks the maintainer/`AGENTS.md` docs and vice versa.

## Step 6 — Finish

Release the lock, remove `SCRATCH`, and report the final ledger state.

## Standalone posture

You invoke no external plugin, skill, or agent. No `ed3d-*`, no `kms-human-voice`, no general-purpose agent. You dispatch only the bundled `doc-surveyor` and the bundled per-doc engine and its bundled agents.
