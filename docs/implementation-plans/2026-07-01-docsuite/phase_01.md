# docsuite Implementation Plan — Phase 1: Mode-parameterize the per-doc engine

**Goal:** The `documentation-pipeline` engine accepts a doc-type `mode` (`user-guide` | `maintainer` | `agents-md`); the `user-guide` default reproduces v2.1.0 behavior exactly. Lands in two verified steps so the behavior-preservation claim is provable.

**Architecture:** Replace hardcoded agent names, scope-rulebook references, and leak literals in the shipped engine (`documentation-pipeline/SKILL.md`, `commands/write-doc.md`, and the writer/editor/reviser/fact-checker agents) with a single mode-dispatch table plus mode-neutral wording. `user-guide` is wired to the exact agents/rulebook/leak framing the engine uses today. Then extract the shared prose-voice rules into one fragment file that both scope rulebooks and the three prose agents read directly (transitive reference is not reliable into subagents — verified against Claude Code 2.1.197).

**Tech Stack:** Claude Code plugin — Markdown skill/command/agent files. No code, no external dependencies. Verification is operational + subagent RED-GREEN-REFACTOR (the project's convention; there is no automated test framework).

**Scope:** Phases 1–5 of the 8-phase design (this plan). Phases 6–8 (survey, project orchestration, release) are a separate later plan, per the design's "Skill count / phase scope" note.

**Codebase verified:** 2026-07-01 via codebase-investigator against `plugins/kms-docs` v2.1.0.

---

## Verification model for this plan (read once)

This plugin has **no automated test suite**. Per `HANDOFF-screenshots.md` and `STATUS.md`, features are verified by:
- **Subagent RED-GREEN-REFACTOR** for rulebooks and agent prompts (dispatch the edited prompt to a subagent with a small ad-hoc input; confirm it behaves correctly; confirm the pre-edit version failed). Use the `ed3d-extending-claude:testing-skills-with-subagents` method — but **do not add ed3d as a plugin dependency of kms-docs**; the method is a planning-time verification technique run by the executor, not a runtime dependency of the shipped plugin.
- **Local smoke tests** for bundled Node scripts (success path + failure path), as `capture.mjs` was verified.
- **Operational end-to-end** runs against a real app, gated by the two human gates.
- **Ad-hoc fixtures created at verification time.** The durable, curated, hand-labeled fixtures and the formal standalone acceptance test are Phase 8 work (out of scope for this plan). Each phase below verifies its own behavior with a minimal ad-hoc input so the phase is complete-and-verified on its own; it does not depend on Phase 8.

No phase in this plan introduces a new npm dependency or invokes any external plugin/skill/agent from a shipped file.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### docsuite.AC1: The per-doc engine is mode-parameterized and backward-compatible
- **docsuite.AC1.1 Success:** A `/write-doc` invocation with no mode dispatches `doc-investigator`, `doc-coverage-critic`, `doc-writer`, `doc-editor`, and `doc-reviser` against the user-guide scope rulebook — identical dispatch to v2.1.0.
- **docsuite.AC1.2 Success:** A `/write-doc` invocation with `mode=maintainer` dispatches `doc-internals-investigator`, `doc-internals-critic`, points `doc-writer`, `doc-editor`, and `doc-reviser` at the internals scope rulebook, and feeds `doc-fact-checker` the mode's leak model plus the investigation's inverted leak list.
- **docsuite.AC1.3 Failure:** An unrecognized mode value is refused with a clear error by the command and the orchestrator, not silently treated as `user-guide`. Enforced at the instruction layer; a bad mode is a wiring error, not a leak risk, so it needs no code backstop the way the capture safe-mode assertion does.
- **docsuite.AC1.4 Edge:** The shared prose-voice tells/rules live in exactly one fragment file; `writing-documentation` (user-guide scope) and `writing-internals` (machinery scope) both reference it. Scope rules are mode-specific and are not shared.
- **docsuite.AC1.5 Success:** After the shared prose-voice fragment is extracted, a bare `/write-doc` run produces a draft whose reviewers apply the same tells checklist as v2.1.0. Each of `doc-writer`, `doc-editor`, `doc-reviser` names both its scope rulebook and the shared fragment in its own required-reading, so delivery does not depend on transitive reference-following. This is verified against the installed Claude Code, like the `@path` bridge.
- **docsuite.AC1.6 Success:** A `/write-doc` invocation with `mode=agents-md` dispatches `doc-internals-investigator` with no coverage critic and routes to `doc-agents-md` (the distiller) with no writer/editor/reviser pass.

> **Cross-phase note on AC1.2 and AC1.6:** Phase 1 wires and verifies the *dispatch decision* by mode. The agents these modes name — `doc-internals-investigator` (Phase 3), `doc-internals-critic` (Phase 3), `doc-agents-md` (Phase 5) — do not exist until later phases. Phase 1 verifies that supplying `mode=maintainer`/`mode=agents-md` selects the correct row of the dispatch table and the correct branch (agents-md: no critic, no writer/editor/reviser, route to distiller). End-to-end execution of those modes is verified in Phases 3–5. Phase 1's own executable claim is that `user-guide` is behavior-preserving (AC1.1) and the mode plumbing selects correctly (AC1.2/AC1.6 at the wiring level, AC1.3 fully).

---

## Reference: verified codebase state (do not re-derive; confirm before editing)

`plugins/kms-docs/skills/documentation-pipeline/SKILL.md` (v2.1.0):
- Stages: Ground (46–48), GATE 1 (50–62), Stage 1.5 Capture (64–76), Draft (78–80), Review parallel cross-model (82–90), Revise (92–96), GATE 2 (98–100).
- Agent dispatch by literal name: `doc-investigator` L48; `doc-screenshooter` L68; `doc-writer` L80; `doc-fact-checker` L86; `doc-editor` L87; `doc-coverage-critic` L88; `doc-reviser` L94. A model-assignment table sits around L31.
- `writing-documentation` references: L8, L31, L68, L80.
- Capture stage skip condition, L66 (verbatim): "Skip this stage when the approved capture plan is empty or the product cannot be run in a safe-capture mode."
- GATE 1 presentation, L52 (verbatim): "Present to the human: the target, the DO-NOT-LEAK list, the coverage scope (what the page will and will not cover), the page-to-source map, and the capture plan." Safe-capture sub-negotiation: L54–62.
- Standalone posture, L26 (verbatim): "…The pipeline needs no other plugin and no general-purpose agent; use the bundled agents, not a generic substitute, so the roles and model assignments hold."

`plugins/kms-docs/commands/write-doc.md`: `argument-hint: "[target page or feature] [repo path]"` (L3); "Run the documentation pipeline for: $ARGUMENTS" (L8); confirm-target instruction (L10–12).

Agents (all under `plugins/kms-docs/agents/`):
- `doc-writer.md`: required reading L12–14 (names `writing-documentation` at L14); "Apply every rule in the skill…" L21; leak line L40 ("Never leak anything on the DO-NOT-LEAK list."). Tools: `Read, Write, Grep, Glob, Bash`, model sonnet.
- `doc-editor.md`: required reading is a single line at L14 ("The `writing-documentation` skill, especially the tells checklist and the voice rules."); L13 is the blank line after the `## Required reading` heading. Leak line L20 ("Catch scope and salesmanship issues: implementation leak, competitive framing."). Model opus.
- `doc-reviser.md`: required reading names `writing-documentation` at L14 (L13 is blank); leak line L39 ("Never introduce a DO-NOT-LEAK item while revising."). Model opus.
- `doc-fact-checker.md`: leak-check L17 ("Confirm no DO-NOT-LEAK item appears in the draft.") and L24 ("Grep the draft for any implementation detail that should not be there."); claim-verification L14–16, L22–23. Model sonnet.
- `doc-investigator.md`: DO-NOT-LEAK production L16; output schema L29–39.

`plugins/kms-docs/skills/writing-documentation/SKILL.md`: Scope section 26–33; kms-human-voice inline-restatement note L8; describe-and-link rule L24; **tells checklist heading L102, table L106–132**; review gate 144–159; user-guide leak model L93–94 and L131. Frontmatter L1–4. (The **Voice rules** section sits above the tells checklist; the tells table at L104–105 states "Some rows restate the Voice and Verify rules above." Confirm the exact Voice-section line range at edit time — Task 6.)

---

## Step A — Dispatch table (behavior-preserving on its own)

<!-- START_SUBCOMPONENT_A (tasks 1-5) -->

<!-- START_TASK_1 -->
### Task 1: Add the mode-dispatch table and mode-neutral wording to the pipeline skill

**Verifies:** docsuite.AC1.1, docsuite.AC1.2, docsuite.AC1.6 (dispatch-wiring level)

**Files:**
- Modify: `plugins/kms-docs/skills/documentation-pipeline/SKILL.md`

**Implementation:**

1. **Add a "Mode" section** immediately after the standalone-posture paragraph (L26). The existing model-assignment table spans **L28–36**; insert the Mode section immediately before that table (after L26), not at a single line. Introduce the doc-type mode and the dispatch table. The table's `user-guide` row MUST name exactly the agents/rulebook/leak framing used today so the default is behavior-preserving:

   ```markdown
   ## Doc-type mode

   The pipeline runs in one of three modes, selected by an explicit `mode` argument
   the command passes in. `user-guide` is the default and reproduces this plugin's
   original single-page behavior exactly. The mode selects the investigator, the
   coverage critic, the scope rulebook (which governs the writer, editor, and
   reviser), and the leak model + list that every leak-aware agent reads.

   | Mode | Investigator | Coverage critic | Scope rulebook (writer/editor/reviser) | Leak model + list |
   |------|--------------|-----------------|----------------------------------------|-------------------|
   | `user-guide` (default) | `doc-investigator` | `doc-coverage-critic` | `writing-documentation` | user-guide model (from `writing-documentation`) + the investigator's DO-NOT-LEAK list |
   | `maintainer` | `doc-internals-investigator` | `doc-internals-critic` | `writing-internals` | inverted model (from `writing-internals`) + the investigator's inverted leak list |
   | `agents-md` | `doc-internals-investigator` | (none) | n/a — no writer/editor/reviser; `doc-agents-md` distills | inverted model (from `writing-internals`) + the investigator's inverted leak list |

   Throughout the stages below, "the mode's investigator / critic / scope rulebook /
   leak model + list" means the entry from this table for the active mode. Where the
   table cell reads n/a, that stage does not run in that mode.
   ```

2. **Replace hardcoded literals with mode-neutral references** at each verified location, keeping `user-guide` semantics intact:
   - L48 Ground stage: "Dispatch `doc-investigator`" → "Dispatch **the mode's investigator** (see the mode table)."
   - L31 model-assignment table row and L80 draft dispatch: "the `writing-documentation` skill" → "**the mode's scope rulebook**". (Keep the model pins; only the rulebook name becomes mode-driven.)
   - Review stage (L86–88): the fact-check/edit/coverage-critic list → "`doc-fact-checker`, `doc-editor`, and **the mode's coverage critic**. In `agents-md` mode there is no coverage critic and no editor/reviser pass — see the AGENTS.md branch below."
   - L94 revise: unchanged agent name (`doc-reviser`) but note it applies the mode's scope rulebook.

3. **Gate the capture stage and GATE 1 safe-capture sub-negotiation on mode.** The design requires the skip to be explicit by mode, not incidental on an empty plan:
   - Stage 1.5 header/skip (L64–66): change the skip rule to read: "**This stage runs only in `user-guide` mode.** In `maintainer` and `agents-md` mode there is no capture plan and this stage is skipped entirely. Within `user-guide` mode, also skip when the approved capture plan is empty or the product cannot be run in a safe-capture mode."
   - GATE 1 (L52 + L54–62): make the DO-NOT-LEAK-list/capture-plan presentation mode-aware. Change L52 to present "**the mode's leak list**" instead of "the DO-NOT-LEAK list" literally, and wrap the capture-plan + safe-capture-plan negotiation (L54–62) as "**In `user-guide` mode only:** …". Phase 4 adds the maintainer-mode GATE 1 presentation and **Phase 5 adds the `agents-md`-mode GATE 1 presentation**; here, just fence the user-guide-only parts so they do not fire under other modes. Do not leave any mode reaching GATE 1 with no defined presentation — the maintainer and agents-md branches are authored in Phases 4 and 5 respectively.

4. **Add the `agents-md` branch.** After the review/revise stages, add a short branch: "**In `agents-md` mode**, skip Draft, Review, and Revise entirely. After the investigation and GATE 1, dispatch `doc-agents-md` (the distiller; added in Phase 5) to produce `AGENTS.md`, then hold a single result gate (Phase 5 defines its presentation). Do not dispatch `doc-writer`, `doc-editor`, `doc-reviser`, or a coverage critic."

5. **Add mode validation at the orchestrator layer:** near the Mode section, add: "If `mode` is not one of `user-guide`, `maintainer`, or `agents-md`, stop and report the error to the human. Do not fall back to `user-guide`." (This is the orchestrator half of AC1.3; the command half is Task 2.)

6. **Thread the resolved rulebook name and leak list into every dispatch (the delivery mechanism).** Renaming the in-stage literals (step 2) is not enough on its own: an agent told to read "your dispatched scope rulebook" and "the dispatched leak list" only works if those tokens are actually in its dispatch prompt. Transitive reference is unreliable into subagents (verified against Claude Code 2.1.197). So add, at each dispatch of a scope-rulebook or leak-aware agent (`doc-writer` L80; the review agents `doc-fact-checker`/`doc-editor`/coverage-critic at L84–88; `doc-reviser` L94), an explicit instruction that the orchestrator writes into that agent's Task prompt: (a) **the resolved scope-rulebook** for the active mode — its skill name and its resolved path (thread the resolved path the same way the capture stage passes `<plugin>/scripts/capture.mjs`, i.e. an orchestrator-resolved plugin path, not a bare relative path the subagent must anchor itself); (b) **the investigation's leak list** for the active mode (as a path to the grounding/ground-truth artifact, or inline); and (c) **the active mode name**. This is the concrete wiring that makes Task 3/Task 4's "read your dispatched rulebook / the dispatched leak list" true rather than aspirational. In `user-guide` mode the values are `writing-documentation` + the DO-NOT-LEAK list (unchanged behavior); the point of this step is that `maintainer`/`agents-md` have no inertial fallback, so the values must be threaded explicitly.

**Do NOT** change model pins, gate semantics for user-guide, or the review-gate cross-model requirement. This task is dispatch wiring only.

**Verification:** Deferred to Task 5 (covers the whole of Step A together).

**Commit:** `feat(kms-docs): add doc-type mode dispatch table to documentation-pipeline`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Add optional trailing `mode` argument to the write-doc command

**Verifies:** docsuite.AC1.1, docsuite.AC1.3

**Files:**
- Modify: `plugins/kms-docs/commands/write-doc.md`

**Implementation:**
1. Update `argument-hint` (L3) to: `"[target page or feature] [repo path] [mode: user-guide|maintainer|agents-md]"`.
2. In the confirm-target instruction block (L10–12), add mode parsing: "Recognize a trailing `mode` token in `$ARGUMENTS` **only** when the last whitespace-separated token is an exact match for `user-guide`, `maintainer`, or `agents-md`. If the last token is not an exact match, there is no mode token — treat the whole of `$ARGUMENTS` as target + repo path and default `mode` to `user-guide` (this avoids mis-parsing a target or repo path that merely contains a word like 'maintainer'). If a would-be mode token is present but misspelled/unrecognized (e.g. `maintaner`), and the human's intent to pass a mode is ambiguous, ask rather than guess. When the human explicitly passes a mode value that is not one of the three, **refuse with a clear error** naming the allowed values and stop; do not run the pipeline and do not treat it as `user-guide`. Pass the resolved `mode` to the `documentation-pipeline` orchestrator."
3. Keep the two positional arguments (target, repo path) working exactly as before when no mode is supplied.

**Testing (AC1.3):** Dispatch a subagent given the edited command text and the argument string `"Login page /path/to/repo bogus-mode"`; confirm it refuses and names the allowed modes. Then `"Login page /path/to/repo"` → resolves to `user-guide` and proceeds. Then `"Login page /path/to/repo maintainer"` → resolves to `maintainer`.

**Verification:** Run the AC1.3 subagent check above; expected: refusal on `bogus-mode`, `user-guide` default on omission.

**Commit:** `feat(kms-docs): write-doc accepts optional mode argument, refuses unknown modes`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Point writer/editor/reviser at the mode's scope rulebook and leak model+list

**Verifies:** docsuite.AC1.1, docsuite.AC1.2

**Files:**
- Modify: `plugins/kms-docs/agents/doc-writer.md`
- Modify: `plugins/kms-docs/agents/doc-editor.md`
- Modify: `plugins/kms-docs/agents/doc-reviser.md`

**Implementation:** In each agent, replace the hardcoded `writing-documentation` reference and the hardcoded user-guide leak framing with mode-driven wording. The orchestrator already passes the mode's scope rulebook and leak list when it dispatches these agents (Task 1); the agent prompts must consume them by role, not by literal name.

- **First, grep-sweep every user-guide leak literal in the three agents.** `grep -n "DO-NOT-LEAK\|ground-truth report\|implementation leak" doc-writer.md doc-editor.md doc-reviser.md`. The design's edit list below cites the main lines, but the sweep is authoritative: every occurrence of `DO-NOT-LEAK`, "the ground-truth report", or "implementation leak" in these three agents must be either genericized to the mode-driven wording or explicitly scoped to user-guide. Leaving a stray "the DO-NOT-LEAK list" alongside the new "the dispatched leak list" wording gives a maintainer-mode agent two conflicting leak sources in one prompt (the exact failure the design warns of). Known occurrences beyond the cited lines: `doc-writer.md:15` ("The ground-truth report and the DO-NOT-LEAK list provided to you") and `doc-writer.md:3` (the description, "from a ground-truth report"). Sweep and confirm zero un-genericized occurrences remain.
- `doc-writer.md`:
  - Required reading L14: "The `writing-documentation` skill (the rulebook)." → "**The scope rulebook named in your dispatch** (the mode's rulebook — `writing-documentation` for user-guide, `writing-internals` for maintainer). Read it in full before drafting."
  - Required reading L15: "The ground-truth report and the DO-NOT-LEAK list provided to you." → "**The grounding artifact / ground-truth report and the leak list provided in your dispatch** (the mode's leak list — the DO-NOT-LEAK list in user-guide, the inverted leak list in maintainer/agents-md)."
  - Description L3 ("…from a ground-truth report"): genericize to "…from a grounding artifact / ground-truth report" so it does not imply the user-guide artifact specifically.
  - L21 "Apply every rule in the skill…": keep, but "the skill" now refers to the dispatched rulebook.
  - Leak line L40: "Never leak anything on the DO-NOT-LEAK list." → "Never emit anything on **the leak list provided in your dispatch**, and never write a sentence that violates **the leak model defined in your scope rulebook** (the model lets you judge a new sentence the investigator never saw)."
- `doc-editor.md`:
  - Required reading L13–14: "The `writing-documentation` skill, especially the tells checklist and the voice rules." → "**Your dispatched scope rulebook** (the mode's rulebook), especially its scope section." (The tells checklist / voice rules move to the shared fragment in Step B; Task 8 adds that fragment to required reading.)
  - Leak line L20: "implementation leak, competitive framing." → "leak-model violations as defined by **your dispatched scope rulebook's leak model** and any instance on **the dispatched leak list** (do not assume the user-guide definition; a maintainer doc's permitted subject is architecture)."
- `doc-reviser.md`:
  - Required reading L13: "The `writing-documentation` skill…" → "**Your dispatched scope rulebook** (the mode's rulebook), plus the draft and all findings…"
  - Leak line L39: "Never introduce a DO-NOT-LEAK item while revising." → "Never introduce anything on **the dispatched leak list**, and never write a passage that violates **the leak model in your scope rulebook**, while revising."

**Testing (AC1.1):** With `writing-documentation` still the user-guide rulebook and the DO-NOT-LEAK list still the user-guide list, a bare (`user-guide`) dispatch of each agent must behave identically to v2.1.0 — confirmed by Task 5's read-through + subagent draft check.

**Verification:** Deferred to Task 5.

**Commit:** `refactor(kms-docs): writer/editor/reviser read the mode's rulebook and leak model+list`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: Point the fact-checker's leak check at the mode's leak model+list; leave claim-verification unchanged

**Verifies:** docsuite.AC1.1, docsuite.AC1.2

**Files:**
- Modify: `plugins/kms-docs/agents/doc-fact-checker.md`

**Implementation:** The fact-checker has two distinct jobs; only the leak check is mode-dependent. **First grep-sweep the agent** (`grep -n "DO-NOT-LEAK" doc-fact-checker.md`) and genericize every occurrence, not just the two workflow lines: the known extra occurrence is `doc-fact-checker.md:35` (the output/summary line, "whether any DO-NOT-LEAK item leaked"), which must become "whether any leak-list instance or leak-model violation appears (per the mode's leak model and list)."
- Leak-check responsibility L17: "Confirm no DO-NOT-LEAK item appears in the draft." → "Confirm no instance from **the leak list provided in your dispatch** appears in the draft, and that no sentence violates **the leak model defined in the mode's scope rulebook**."
- Leak-check workflow L24: "Grep the draft for any implementation detail that should not be there." → "Grep the draft for any instance on **the dispatched leak list**, then read for any sentence that violates **the mode's leak model** (categories, so you can catch a sentence the investigator never saw). In `maintainer`/`agents-md` mode the permitted subject is architecture; do not flag it."
- Claim-verification (L14–16, L22–23): **unchanged.** Add one clarifying sentence: "Claim verification against source is mode-neutral: verify machinery claims against source exactly as you verify user-facing claims."

**Testing (AC1.1):** In `user-guide` mode with the DO-NOT-LEAK list, leak-check behavior is unchanged. (Full maintainer-mode leak-check verification — permit architecture, catch secrets — is AC3.4, exercised in Phase 2 and Phase 4.)

**Verification:** Deferred to Task 5.

**Commit:** `refactor(kms-docs): fact-checker leak check reads the mode's leak model and list`
<!-- END_TASK_4 -->

<!-- START_TASK_5 -->
### Task 5: Verify Step A is behavior-preserving and mode dispatch selects correctly

**Verifies:** docsuite.AC1.1, docsuite.AC1.2, docsuite.AC1.6, docsuite.AC1.3

**Files:** none (verification task)

**Verification steps:**
1. **Static read-through (AC1.1):** Re-read `documentation-pipeline/SKILL.md` and confirm the `user-guide` row names exactly `doc-investigator`, `doc-coverage-critic`, `doc-writer`, `doc-editor`, `doc-reviser`, `writing-documentation`, and the DO-NOT-LEAK list — i.e. the identical set the engine dispatched at v2.1.0. Confirm no user-guide gate semantics changed (capture stage still runs for user-guide with a non-empty plan; GATE 1 still presents the leak list, coverage scope, page-to-source map, capture plan; cross-model review gate intact).
2. **Dispatch-selection check (AC1.2 wiring / AC1.6):** Give a subagent the edited `SKILL.md` and ask it, for each of `mode=user-guide`, `mode=maintainer`, `mode=agents-md`: which investigator, critic, scope rulebook, and leak source does it select, and does it run Draft/Review/Revise? Expected: user-guide → full set + full pipeline; maintainer → internals investigator/critic, `writing-internals`, inverted leak list, full pipeline; agents-md → internals investigator, **no critic**, **no writer/editor/reviser**, routes to `doc-agents-md`, single result gate.
3. **Unknown-mode refusal (AC1.3):** Re-run the Task 2 subagent check (bogus mode refused; omission → user-guide) and confirm the orchestrator half (Task 1 step 5) also refuses an unknown mode.
4. **Behavior-preservation draft check (AC1.1):** Dispatch `doc-writer` in `user-guide` mode on a tiny sample source (e.g. a 20-line fixture module in the scratch dir) with the current DO-NOT-LEAK list; confirm it drafts against `writing-documentation` scope exactly as before. (This also seeds the Step B check in Task 9.)

Record results in the phase's working notes. Expected: all four pass; if the static read-through finds any changed user-guide semantic, fix it before proceeding.

**Commit:** none (verification only; no file changes unless a defect is found and fixed).
<!-- END_TASK_5 -->

<!-- END_SUBCOMPONENT_A -->

---

## Step B — Extract the shared prose-voice fragment

<!-- START_SUBCOMPONENT_B (tasks 6-9) -->

<!-- START_TASK_6 -->
### Task 6: Create the shared prose-voice fragment as a neutral shared skill

**Verifies:** docsuite.AC1.4

**Files:**
- Create: `plugins/kms-docs/skills/prose-voice-rules/SKILL.md`

**Implementation:** The design permits either "a fragment file … or a shared skill file" (design L223). Use a **neutral shared skill** — `skills/prose-voice-rules/` as its own directory, a peer of `writing-documentation` and `writing-internals`, not nested inside either consumer. This removes the up-and-over relative path a nested fragment would force on `writing-internals`, and it makes the rules loadable by skill name (the reliable in-plugin reference mechanism, the same way agents already load `writing-documentation`).
1. First confirm the exact line ranges in `writing-documentation/SKILL.md` at edit time: the **Voice rules** section (above the tells checklist; the tells table states "restate the Voice and Verify rules above") and the **tells checklist** (heading L102, table L106–132). These two blocks are the mode-neutral prose-voice rules to extract. The **Verify** rules and the **Scope** section (26–33) are NOT extracted — Scope is mode-specific (this is the AC1.4 requirement that scope rules are not shared); Verify stays with `writing-documentation` unless it is genuinely prose-voice-neutral (judge at edit time; when in doubt, leave it in `writing-documentation`).
2. Author `skills/prose-voice-rules/SKILL.md` with frontmatter (`name: prose-voice-rules`; a description saying it is the shared machine-writing tells checklist and prose-voice rules referenced by both `writing-documentation` and `writing-internals`) and a body containing the extracted Voice rules + the full tells checklist table verbatim. Do not paraphrase the tells table — it must remain byte-for-byte the v2.1.0 checklist so reviewers apply the same tells (AC1.5).

**Verification:** Deferred to Task 9. (Confirm the file exists and contains the complete 25-row tells table.)

**Commit:** `feat(kms-docs): extract shared prose-voice-rules fragment`
<!-- END_TASK_6 -->

<!-- START_TASK_7 -->
### Task 7: Point writing-documentation at the shared skill; add a consolidated user-guide leak-model section

**Verifies:** docsuite.AC1.4, docsuite.AC1.2 (user-guide leak-model home, symmetric with writing-internals)

**Files:**
- Modify: `plugins/kms-docs/skills/writing-documentation/SKILL.md`

**Implementation:**
1. Remove the now-extracted Voice-rules and tells-checklist blocks from `writing-documentation/SKILL.md` and replace them with a short pointer section: "## Prose voice and the tells checklist — The prose-voice rules and the machine-writing tells checklist live in the shared `prose-voice-rules` skill, shared with `writing-internals`. Read it in full; it is required reading for the writer, editor, and reviser." This honors the existing describe-and-link rule (L24) at the skill level.
2. **Add a consolidated "Leak model (user-guide)" section** to `writing-documentation` (fixing an asymmetry: `writing-internals` will carry an explicit numbered leak-model section, but the user-guide leak *model* today lives only implicitly in `doc-investigator.md:16`, not in the rulebook — so the writer/editor/reviser/fact-checker instruction to "read the leak model in your scope rulebook" has no home for user-guide mode). Author it as its own section mirroring `writing-internals`'s structure, stating the *sensitive categories* for a user-facing doc: implementation details, internal architecture/class/data-structure names, internal limits/counts, framework and library names, table and column names, API routes, secrets/tokens/credentials, internal hostnames/URLs, and competitive framing (consolidated from `doc-investigator.md:16` and the existing scope rules at L28–33). This gives the categorical leak judgment a readable home symmetric with `writing-internals`.
3. Keep the **Scope** section (26–33), the screenshot data rules (the "No real data in the frame" bullet is at L93–94; the "Real data in a screenshot" tell row is at L131 — these are screenshot-specific, distinct from the new general leak-model section), the review gate (144–159), and everything mode-specific in `writing-documentation`. Only the shared prose-voice/tells content moves out.
4. Confirm no other section of `writing-documentation` duplicates the tells table (investigator confirmed it appears once).

**Verification:** Deferred to Task 9.

**Commit:** `refactor(kms-docs): writing-documentation references shared prose-voice fragment`
<!-- END_TASK_7 -->

<!-- START_TASK_8 -->
### Task 8: Add the fragment to writer/editor/reviser required-reading directly

**Verifies:** docsuite.AC1.5

**Files:**
- Modify: `plugins/kms-docs/agents/doc-writer.md`
- Modify: `plugins/kms-docs/agents/doc-editor.md`
- Modify: `plugins/kms-docs/agents/doc-reviser.md`

**Implementation:** Transitive reference-following is **not reliable** into subagents (verified against Claude Code 2.1.197: a skill that merely mentions "see the prose-voice rules" does not guarantee they reach the agent's context). So each of the three prose agents must name and read the shared skill itself, in its own required-reading section, alongside its (mode-supplied) scope rulebook.

In each agent's required-reading list, add an explicit item: "**The shared `prose-voice-rules` skill.** Read it in full before working; apply every tell in its checklist. Read it directly — do not rely on your scope rulebook to pull it in." Reference it by skill name (loadable by the harness, the same mechanism by which these agents already load `writing-documentation`), and have the orchestrator also thread its resolved path in the dispatch (Task 1 step 6) so delivery does not depend on name-resolution alone. Result: each agent's required reading names **both** its scope rulebook (Task 3) **and** the shared `prose-voice-rules` skill.

**Verification:** Deferred to Task 9.

**Commit:** `fix(kms-docs): writer/editor/reviser read the shared prose-voice fragment directly`
<!-- END_TASK_8 -->

<!-- START_TASK_9 -->
### Task 9: Verify the fragment reaches reviewers and tells are still applied

**Verifies:** docsuite.AC1.4, docsuite.AC1.5

**Files:** none (verification task)

**Verification steps:**
1. **AC1.4 single-source check:** Grep the plugin for the tells-checklist heading/rows; confirm the table exists in exactly one file (`skills/prose-voice-rules/SKILL.md`) and both `writing-documentation/SKILL.md` and (after Phase 2) `writing-internals/SKILL.md` reference it by skill name. Confirm no scope rules were moved into the shared skill.
2. **AC1.5 required-reading check (against installed Claude Code):** Confirm each of `doc-writer`, `doc-editor`, `doc-reviser` names both its scope rulebook and the `prose-voice-rules` skill in its own required-reading. Then dispatch `doc-editor` (a real subagent, opus) on a short draft that plants a **fragment-idiosyncratic tell** — a violation of a rule whose exact framing is unique to *this* checklist (e.g. the "false equation" row or a "spatial metaphor for a named property" row), NOT a generic tell like an em-dash pile-up that any opus editor would catch from its own training. Confirm the editor flags it **in the checklist's own terms** (citing the specific tell name/framing). This is what actually proves the checklist reached the agent's context via direct required-reading rather than the editor's general knowledge; a generic-tell test can pass with the fragment entirely absent and would not verify the load-bearing delivery claim.
3. Compare against the Task 5 baseline draft: reviewers apply the same tells checklist as v2.1.0.

Expected: single-source confirmed, both tells flagged. If the editor misses a tell, verify the required-reading item is present and the fragment is complete before re-running.

**Commit:** none (verification only).
<!-- END_TASK_9 -->

<!-- END_SUBCOMPONENT_B -->

---

**Dependencies:** None (first phase).

**Done when:** After Step A, a bare `/write-doc` run dispatches the same agents/scope rulebook/leak model as v2.1.0 (AC1.1), the engine dispatches by mode when a mode is supplied (AC1.2), an unknown mode is refused (AC1.3), and `mode=agents-md` routes to the distiller with no writer/editor/reviser at the wiring level (AC1.6). After Step B, the shared fragment exists in one file, both rulebooks and all three agents reference it, and its rules verifiably reach the reviewers (AC1.4, AC1.5).
