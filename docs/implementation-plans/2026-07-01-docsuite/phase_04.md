# docsuite Implementation Plan — Phase 4: Maintainer doc mode end-to-end

**Goal:** `mode=maintainer` produces a machinery doc through the full two-gate engine: the internals investigator grounds it, GATE 1 presents the inverted leak list and coverage scope, the writer/editor/reviser apply `writing-internals` scope, the fact-checker's claim-verification runs unchanged on machinery while its leak check reads the inverted leak list, and the doc clears GATE 2.

**Architecture:** Wire the `maintainer` row of the Phase 1 dispatch table into a working end-to-end run. Most machinery already exists after Phases 1–3: the dispatch table (Phase 1), the mode-neutral agents (Phase 1), the `writing-internals` rulebook (Phase 2), the internals investigator/critic and grounding-artifact schema (Phase 3). Phase 4 adds the maintainer-mode GATE 1 presentation, confirms the review agents apply machinery scope, and gives a standalone `/write-doc mode=maintainer` run a self-managed single-invocation scratch dir (the full run-id-keyed lifecycle is Phase 7, out of this plan's scope).

**Tech Stack:** Claude Code plugin — Markdown skill/agent edits; a small amount of orchestrator shell for the standalone scratch dir (`mktemp -d`, cleanup on exit). No external dependencies.

**Scope:** Phases 1–5 of the 8-phase design (this plan).

**Codebase verified:** 2026-07-01 via codebase-investigator against `plugins/kms-docs` v2.1.0.

> **Verification model:** See phase_01.md. End-to-end verified operationally against a small ad-hoc fixture app (the Phase 3 fixture, extended) plus subagent checks; durable fixtures and formal standalone acceptance are Phase 8.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### docsuite.AC3: The maintainer doc documents machinery
- **docsuite.AC3.1 Success:** `mode=maintainer` produces a doc describing data flow, module boundaries, invariants, and why-decisions for a fixture app, and the internals grounding artifact is schema-valid.
- **docsuite.AC3.2 Success:** `doc-internals-critic` flags a deliberately omitted subsystem in a fixture, checking the draft against the enumerated machinery map in the grounding artifact (a finite, bounded surface), not against "all possible machinery."
- **docsuite.AC3.3 Success:** The maintainer doc clears GATE 1 and GATE 2, with the editor and reviser applying machinery scope (not user-guide scope).
- **docsuite.AC3.4 Failure:** `doc-fact-checker`, reading the investigation's inverted leak model and list, catches a maintainer doc that leaks a secret/token/internal hostname/real-production-datum, while permitting architecture/module/schema-shape content.

> **Cross-phase note.** AC3.1's artifact half and AC3.2 and AC3.5 were verified in Phase 3 against the investigator/critic in isolation. Phase 4 completes AC3.1's "produces a doc describing …" half and AC3.3's full two-gate claim by running the whole `maintainer` pipeline end-to-end, and re-confirms AC3.4 inside the running pipeline (Phase 2 verified the fact-checker's leak model in isolation).

---

## Reference: verified state after Phases 1–3

- Dispatch table (Phase 1) names, for `maintainer`: investigator `doc-internals-investigator`, critic `doc-internals-critic`, scope rulebook `writing-internals`, leak = inverted model + inverted leak list.
- Capture stage (Stage 1.5) and GATE 1 safe-capture sub-negotiation are gated to `user-guide` only (Phase 1, Task 1 step 3). GATE 1 line L52 now presents "the mode's leak list."
- `doc-writer`/`doc-editor`/`doc-reviser` read the dispatched scope rulebook + shared fragment; `doc-fact-checker` leak-check reads the mode's leak model + list, claim-verification unchanged (Phase 1, Tasks 3–4).
- `writing-internals` exists and is verified in isolation (Phase 2).
- `doc-internals-investigator` writes a schema-valid grounding artifact to a threaded scratch path; `doc-internals-critic` audits against the map (Phase 3).
- Original GATE 1 presentation (v2.1.0, user-guide): target + DO-NOT-LEAK list + coverage scope + page-to-source map + capture plan (`documentation-pipeline/SKILL.md:52`). GATE 2: finished page + page-to-source map + accepted/rejected findings + machine-written caveat (L100).

---

<!-- START_SUBCOMPONENT_A (tasks 1-4) -->

<!-- START_TASK_1 -->
### Task 1: Wire maintainer-mode GATE 1 presentation and confirm review-agent scope

**Verifies:** docsuite.AC3.3

**Files:**
- Modify: `plugins/kms-docs/skills/documentation-pipeline/SKILL.md`

**Implementation:**
1. **Maintainer-mode GATE 1 (symmetric with user-guide's DO-NOT-LEAK presentation at L52).** In the GATE 1 section, add a mode branch: "**In `maintainer` mode**, present to the human: the target, **the investigation's inverted leak list** (the repo-specific secrets/tokens/hostnames/real-data to keep out of the doc), and the coverage scope (the machinery the doc will and will not cover, from the grounding artifact's `machineryMap`) **together with its source paths** (each machinery component/invariant shown with the `sourcePaths` the investigator recorded). Presenting the source paths at GATE 1 keeps the maintainer gate symmetric with user-guide GATE 1, which shows a page-to-source map (L52) — the human should see the source grounding for the scope they approve, not first encounter it at GATE 2. Present **no capture plan and no safe-capture plan** — those are user-guide-only and are gated out by mode (Phase 1), not merely skipped for an empty plan. Get approval or corrections before drafting; do not skip this gate."
2. Confirm the ground stage in `maintainer` mode dispatches `doc-internals-investigator` (from the dispatch table) and threads the scratch path (Task 3 supplies the path for standalone runs).
3. Confirm the draft/review/revise stages, in `maintainer` mode, pass `writing-internals` as the scope rulebook to writer/editor/reviser and the inverted leak model + list to the fact-checker, and dispatch `doc-internals-critic` as the coverage critic. (These are dispatch-table lookups added in Phase 1; this task confirms the wiring produces a coherent maintainer run and adds any missing mode-conditional wording.)
4. Confirm GATE 2 presentation is mode-neutral and works for the maintainer doc (finished page + page-to-source map + findings + machine-written caveat). The page-to-source map for a maintainer doc maps machinery claims to source; note this explicitly.

**Verification:** Deferred to Task 4.

**Commit:** `feat(kms-docs): wire maintainer-mode GATE 1 and machinery-scope review`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Confirm fact-checker behavior on machinery (claim-verification unchanged; leak check inverted)

**Verifies:** docsuite.AC3.4

**Files:**
- Modify: `plugins/kms-docs/agents/doc-fact-checker.md` (the source-grounding reconciliation below is required; the leak/claim clarification is only needed if Phase 1's edits did not already express it cleanly)

**Implementation:** Confirm (and clarify in the prompt if needed) that in `maintainer` mode:
- **Claim-verification runs unchanged:** the fact-checker verifies machinery claims (data-flow direction, which module owns a table, the exact wording of an invariant, ordered/positional claims) against source exactly as it verifies user-facing claims. This is the same rigor, applied to machinery.
- **Leak check reads the inverted model + list:** it flags any instance on the inverted leak list and any sentence violating the `writing-internals` leak model (secrets/tokens/hostnames/real-data), and does **not** flag architecture/module/schema-shape content as a leak.

- **Reconcile the source-grounding reference (do not require a page-to-source map the artifact lacks).** The shared fact-checker's required-reading names a "ground-truth report with its page-to-source map" (`doc-fact-checker.md:21`), but the maintainer grounding artifact (Phase 3 schema) carries no `pageToSourceMap` field — instead its `machineryMap`/`invariants`/`whyDecisions`/`facts` entries each carry `sourcePaths`. Genericize the fact-checker's required-reading so that in `maintainer`/`agents-md` mode it grounds each machinery claim against **the grounding artifact's per-claim source paths** (the `sourcePaths`/`source` fields), and in `user-guide` mode against the page-to-source map as today. Phrase it mode-neutrally: "verify each claim against the source references the mode's grounding artifact provides (the user-guide page-to-source map, or the machinery artifact's per-claim `sourcePaths`)." This closes the producer/consumer mismatch: the maintainer fact-checker now has a real source to verify machinery claims against.

If the Phase 1 edits to `doc-fact-checker.md` already express the leak/claim split cleanly, the only change here is the source-grounding reconciliation above plus one sentence making machinery-claim-verification explicit.

**Verification:** Deferred to Task 4 (the AC3.4 end-to-end check).

**Commit:** `refactor(kms-docs): clarify fact-checker machinery claim-verification` (only if an edit was needed)
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Standalone scratch-dir handling for `/write-doc mode=maintainer`

**Verifies:** docsuite.AC3.1 (artifact reachable end-to-end in a standalone run)

**Files:**
- Modify: `plugins/kms-docs/skills/documentation-pipeline/SKILL.md`

**Implementation:** The grounding artifact must live in a scratch directory the orchestrator controls, never in the target repo (writing there risks committing an internals dump on a crash and would need to mutate the target's `.gitignore`, which the plugin has no authority to do). Under `/document-project` the project orchestrator owns the run-id-keyed lifecycle (Phase 7, out of this plan). For a **standalone** `/write-doc mode=maintainer` (or `mode=agents-md`) run there is no project orchestrator, so the per-doc engine manages a single-invocation scratch dir itself:

Add to the pipeline skill, in the ground stage for `maintainer`/`agents-md` modes when no scratch path was supplied by a caller: "Create a single-invocation scratch directory outside the target repo with `mktemp -d` (e.g. under the system temp dir). Thread its path to `doc-internals-investigator` as the artifact location and to every downstream agent that reads the artifact. Clean it up when the run finishes (success or abort). Do not create it inside the target repo. If a caller (the project orchestrator) already supplied a scratch path, use that and do not create or clean one — the caller owns the lifecycle."

State the boundary explicitly: run-id keying, concurrent-run isolation, and on-entry/on-exit cleanup for multi-doc runs are Phase 7's job; the standalone case only needs a single dir held for one invocation's lifetime.

**Verification:** Deferred to Task 4.

**Commit:** `feat(kms-docs): standalone maintainer/agents-md runs manage a single-invocation scratch dir`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: End-to-end maintainer run against an ad-hoc fixture

**Verifies:** docsuite.AC3.1, docsuite.AC3.2, docsuite.AC3.3, docsuite.AC3.4

**Files:** none (verification task; uses an ad-hoc fixture app)

**Verification steps:** Extend the Phase 3 ad-hoc fixture (ingest → reduce, planted secret + internal hostname, one invariant, a why-decision hint such as a comment "chose batch fold over streaming to bound memory"). Run `/write-doc "<fixture> maintainer doc" <fixture-path> maintainer` and drive it through both gates (acting as the human at the gates):
1. **AC3.1:** the investigator writes a schema-valid grounding artifact to the scratch dir (re-confirm schema-validity), and the produced doc **describes data flow, module boundaries, invariants, and at least one why-decision**. Confirm the doc is genuinely machinery (not user-facing surface).
2. **AC3.3 (GATE 1):** GATE 1 presents the inverted leak list and the coverage scope, and **no capture plan / no safe-capture plan**. Approve scope.
3. **AC3.3 (scope):** confirm `doc-editor` and `doc-reviser` applied `writing-internals` scope — the draft's architecture prose is NOT flagged as an implementation-leak/out-of-scope violation, and the reviser did not strip machinery "from intent." Contrast: a spot-run of the editor with `writing-documentation` scope on the same draft WOULD flag it.
4. **AC3.4:** plant, in the draft, a sentence pasting the fixture's real secret (`sk-live-...`) and the internal hostname. Confirm `doc-fact-checker` flags both as leaks (reading the inverted list + model) while NOT flagging the module/table names, and confirm its claim-verification independently catches a deliberately wrong machinery claim (e.g. reverse the data-flow direction in a sentence) against source.
5. **AC3.2:** run `doc-internals-critic` on a version of the draft that omits the `reduce` subsystem; confirm it flags the omission against the map (re-confirming Phase 3's result inside the pipeline).
6. **AC3.3 (GATE 2):** the revised doc clears GATE 2 (finished page + page-to-source map + accepted/rejected findings + machine-written caveat). Confirm the scratch dir is cleaned up after the run (Task 3).

Expected: all pass. If any review agent applies user-guide scope to machinery, or the fact-checker flags architecture, return to the relevant Phase 1/2 wording; if GATE 1 shows a capture plan under maintainer mode, fix the Phase 1 mode-gating.

**Commit:** none (verification only).
<!-- END_TASK_4 -->

<!-- END_SUBCOMPONENT_A -->

---

**Dependencies:** Phases 1–3.

**Done when:** A maintainer doc is produced for a fixture app, documents machinery (not surface), passes the internals critic, and clears GATE 1 + GATE 2 with machinery-scope review and the inverted leak model (AC3.1–AC3.4).
