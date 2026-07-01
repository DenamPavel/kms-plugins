---
name: documentation-pipeline
description: Use when writing or revising a product or tool documentation page end to end - orchestrates grounding against source, drafting with the writing-documentation skill, a cross-model fact-check/edit/coverage review, revision from intent, and two human gates. Invoked by the /write-doc command.
---

# Documentation Pipeline

Orchestrates writing or revising a product documentation page using specialized agents around the `writing-documentation` rulebook. You are the orchestrator: you dispatch agents, hold the two human gates, and synthesize their findings.

## When to use

- Writing a new documentation page for a product or tool.
- Revising or auditing an existing page against the current product.

Invoked via `/write-doc`.

## Inputs you need first

- The target: which page, for which product, and where it should land.
- The source location (repo path) so agents can ground against it.

If either is missing, ask before starting.

## The agents

These seven agents ship with this plugin. Dispatch each with the Task tool, using the agent's name (the left column below) as the subagent type. The pipeline needs no other plugin and no general-purpose agent; use the bundled agents, not a generic substitute, so the roles and model assignments hold.

| Agent | Model | Role |
|-------|-------|------|
| `doc-investigator` | sonnet | Ground truth: user-facing surface, DO-NOT-LEAK list, page-to-source map, existing-docs inventory |
| `doc-writer` | sonnet | Draft applying the scope rulebook |
| `doc-fact-checker` | sonnet | Verify every claim against source |
| `doc-editor` | opus | Machine-writing tells, voice, structure |
| `doc-coverage-critic` | sonnet | Shipped behavior the page omits |
| `doc-reviser` | opus | Rewrite from intent, reject wrong findings |
| `doc-screenshooter` | sonnet | Capture screenshots from the running product via the bundled Playwright script, with the safe-mode leakage guard |

The editor runs on a different model than the writer, which satisfies the skill's "at least one reviewer on a different model" rule by construction.

Capture is bundled too: `doc-screenshooter` drives this plugin's own Playwright script (`scripts/capture.mjs`), so the pipeline needs no other plugin. The capture stage does depend on Node, the `playwright` npm package, and a runnable instance of the product; a page with no screenshots skips that stage entirely.

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

**Mode validation:** If `mode` is not one of `user-guide`, `maintainer`, or `agents-md`, stop and report the error to the human. Do not fall back to `user-guide`.

## The pipeline

Track progress with TaskCreate so a long run does not lose its place.

### Stage 1 — Ground

Dispatch **the mode's investigator** (see the mode table) on the source. It returns the user-facing surface, the mode's leak list, the actor vocabulary, the page-to-source map, the existing-docs inventory, and a capture plan (the surfaces worth a screenshot, each with its navigation path, the state to set up, what the shot must show, and what must not appear in frame). Save its report to a working file the later agents can read.

**In `maintainer` and `agents-md` modes, for standalone runs:** When no scratch path was supplied by a caller, create a single-invocation scratch directory outside the target repo with `mktemp -d`. Thread its path to the investigator as the artifact location and to every downstream agent that reads the artifact. Clean it up when the run finishes (success or abort). Do not create it inside the target repo. If a caller (the project orchestrator) already supplied a scratch path, use that and do not create or clean one; the caller owns the lifecycle. Run-id keying, concurrent-run isolation, and on-entry/on-exit cleanup for multi-doc runs are Phase 7's job; the standalone case only needs a single directory held for one invocation's lifetime.

### GATE 1 — Human review of scope

**In `user-guide` mode:** Present to the human: the target, the mode's leak list, the coverage scope (what the page will and will not cover), the page-to-source map, and the capture plan. For the capture plan, do two things with the human. First, approve which screenshots to keep. Second, agree a **safe-capture plan**: for each surface, how it will be rendered with no real data in frame. Do not assume the product already has a safe mode. Work the options through with the human and settle one per surface:

- a built-in safe or demo mode that scopes displayed data to safe values;
- a seeded or synthetic demo dataset, or a dedicated demo or staging instance;
- a fresh or empty account that shows empty or sample states;
- a surface that is inherently free of real data;
- as a last resort, capture and then redact the sensitive region with a solid block.

If a chosen option needs setup the pipeline cannot do itself (seeding a dataset, standing up a demo instance), that is a human action: pause for the human to do it, then resume. If no option makes a surface safe, drop it from the capture plan and document it in prose instead. Record the agreed safe-capture plan in the docs repo so later runs reuse it. Get approval or corrections before drafting. Do not skip this gate.

**In `maintainer` mode:** Present to the human: the target, the investigation's inverted leak list (the repo-specific secrets, tokens, hostnames, and real-data instances to keep out of the doc), and the coverage scope (the machinery the doc will and will not cover, from the grounding artifact's `machineryMap`). Show each machinery component and invariant together with the `sourcePaths` the investigator recorded. Presenting the source paths at GATE 1 keeps the maintainer gate symmetric with user-guide GATE 1, which shows a page-to-source map; the human should see the source grounding for the scope they approve, not first encounter it at GATE 2. Present no capture plan and no safe-capture plan (those are user-guide-only and are gated out by mode, not merely skipped for an empty plan). Get approval or corrections before drafting. Do not skip this gate.

**In `agents-md` mode:** GATE 1 presents the target, the investigation's inverted leak list, and the boundary/coverage scope (the ✅/⚠️/🚫 `agentBoundaryBlock` plus the `machineryMap` coverage with source paths). This is analogous to the maintainer branch. No capture plan or safe-capture plan (those are user-guide-only). Get approval or corrections before distillation. The `agents-md`-alone path runs a **full** internals investigation (not a shallow variant), holds this GATE 1, then distills via `doc-agents-md`, then the result gate (defined below). Build/test/run commands come from the investigation's `facts` extraction; no surveyor is involved.

### Stage 1.5 — Capture (only when the page needs screenshots)

**This stage runs only in `user-guide` mode.** In `maintainer` and `agents-md` mode there is no capture plan and this stage is skipped entirely. Within `user-guide` mode, also skip when the approved capture plan is empty or the product cannot be run in a safe-capture mode.

Dispatch the bundled `doc-screenshooter` agent with the approved capture plan, the safe-capture plan, and the `writing-documentation` screenshot rules; it follows the `capturing-screenshots` skill. Leakage is prevented in layers, not by one check:

1. **Safe state.** Render each surface using the safe-capture plan agreed at GATE 1 (a built-in safe mode, a seeded demo dataset, a demo instance, an empty account, or post-capture redaction). The plan is project-specific and lives in the docs repo.
2. **Precondition assert.** Before each shot, the agent confirms the surface is in the safe state the plan specifies and aborts if it cannot. A forgotten safe-mode toggle or the wrong dataset is the likeliest leak, so catch it before the pixels exist rather than after.
3. **Crop.** Capture the subject and trim surrounding chrome and unrelated panels.

The agent navigates to each surface, sets up the required state, captures a cropped image to a scratch directory, and returns a manifest mapping each filename to its surface and state. Save the manifest with the working files.

The orchestrator owns standing up the running instance in safe mode; that setup is project-specific. Keep raw captures in a gitignored scratch directory; only images a human approves at GATE 2 move into the docs image directory and the repo.

### Stage 2 — Draft

Dispatch `doc-writer` with **the mode's scope rulebook**, the approved ground truth, and the capture manifest. It writes the draft to a working path, embedding the approved screenshots where they earn their place, with alt text and captions per the rulebook.

**Orchestrator instruction to thread into the dispatch:**
- **(a) Resolved scope-rulebook path:** Write into the task prompt: "Your dispatched scope rulebook is `<mode-scope-rulebook>` (the mode's rulebook). You can load it at path `<plugin>/skills/<rulebook-dir>/SKILL.md` (e.g., `plugins/kms-docs/skills/writing-documentation/SKILL.md` for user-guide mode)."
- **(b) Leak list:** Write into the task prompt: "The leak list for this mode is `<mode-leak-list>` (in user-guide mode this is the investigator's DO-NOT-LEAK list; in maintainer/agents-md mode this is the investigator's inverted leak list)."
- **(c) Prose-voice-rules skill:** Write into the task prompt: "You must read the shared `prose-voice-rules` skill directly (path: `plugins/kms-docs/skills/prose-voice-rules/SKILL.md`). Do not rely on your scope rulebook to pull it in."
- **(d) Active mode name:** Write into the task prompt: "The active mode is `<mode>` (one of `user-guide`, `maintainer`, `agents-md`)."

### Stage 3 — Review (parallel, cross-model)

Dispatch these in parallel, each reading the draft and the ground truth:

- `doc-fact-checker`
- `doc-editor` (opus)
- **the mode's coverage critic**

In `agents-md` mode there is no coverage critic and no editor/reviser pass — see the AGENTS.md branch below.

**Orchestrator instruction to thread into each dispatch:**
- **(a) Resolved scope-rulebook path:** Write into the task prompt: "Your dispatched scope rulebook is `<mode-scope-rulebook>` (the mode's rulebook). You can load it at path `<plugin>/skills/<rulebook-dir>/SKILL.md` (e.g., `plugins/kms-docs/skills/writing-documentation/SKILL.md` for user-guide mode)."
- **(b) Leak list:** Write into the task prompt: "The leak list for this mode is `<mode-leak-list>` (in user-guide mode this is the investigator's DO-NOT-LEAK list; in maintainer/agents-md mode this is the investigator's inverted leak list)."
- **(c) Prose-voice-rules skill (`doc-editor` only):** Write into `doc-editor`'s task prompt: "You must read the shared `prose-voice-rules` skill directly (path: `plugins/kms-docs/skills/prose-voice-rules/SKILL.md`). Do not rely on your scope rulebook to pull it in." (`doc-fact-checker` and the coverage critic do not read the tells checklist, so this item is not threaded to them.)
- **(d) Active mode name:** Write into the task prompt: "The active mode is `<mode>` (one of `user-guide`, `maintainer`, `agents-md`)."

Collect all findings. Deduplicate overlapping ones before revision.

### Stage 4 — Revise

Dispatch `doc-reviser` with the draft and all findings. It applies **the mode's scope rulebook**, rewrites from intent, rejects wrong findings with reasons, closes coverage gaps, and writes the revised page.

**Orchestrator instruction to thread into the dispatch:**
- **(a) Resolved scope-rulebook path:** Write into the task prompt: "Your dispatched scope rulebook is `<mode-scope-rulebook>` (the mode's rulebook). You can load it at path `<plugin>/skills/<rulebook-dir>/SKILL.md` (e.g., `plugins/kms-docs/skills/writing-documentation/SKILL.md` for user-guide mode)."
- **(b) Leak list:** Write into the task prompt: "The leak list for this mode is `<mode-leak-list>` (in user-guide mode this is the investigator's DO-NOT-LEAK list; in maintainer/agents-md mode this is the investigator's inverted leak list)."
- **(c) Prose-voice-rules skill:** Write into the task prompt: "You must read the shared `prose-voice-rules` skill directly (path: `plugins/kms-docs/skills/prose-voice-rules/SKILL.md`). Do not rely on your scope rulebook to pull it in."
- **(d) Active mode name:** Write into the task prompt: "The active mode is `<mode>` (one of `user-guide`, `maintainer`, `agents-md`)."

If the revise pass plausibly introduced new issues, re-run Stage 3 on the revised page. Loop until the reviewers are clean or the human accepts the remaining items.

### GATE 2 — Human review of the result

Present the finished page (a diff if it replaces a live page), the page-to-source map (in user-guide mode this maps page sections to source files; in maintainer mode it maps machinery claims to source), the accepted and rejected findings, and a plain statement that this is machine-written and needs human review before it ships. Do not write over a live page without this gate.

### In `agents-md` mode

Skip Draft, Review, and Revise entirely. After the investigation and GATE 1, dispatch `doc-agents-md` (the distiller; added in Phase 5) to produce `AGENTS.md`, then hold a single result gate. Do not dispatch `doc-writer`, `doc-editor`, `doc-reviser`, or a coverage critic.

**Result gate (agents-md mode):** After `doc-agents-md` distills the file, present to the human:
- The drafted `AGENTS.md` (as rendered Markdown).
- Extracted commands (flagging any the investigation could not verify).
- `[TODO]` placeholders (sections needing human judgment).
- The mechanical-filter report (lines flagged as manifest-derivable, lines kept).
- A proposed optional `CLAUDE.md` bridge: "Claude Code does not read `AGENTS.md` natively. Would you like a thin `CLAUDE.md` at repo root with `@AGENTS.md` (or `@./AGENTS.md`) to import it? This syntax is verified against Claude Code 2.1.197. If you decline, only `AGENTS.md` will be written. If accepted and a `CLAUDE.md` already exists, the import will be prepended, not overwrite."

The file is **written and committed only after this gate passes**. No further review pass; this gate is the review.

**Facts precedence (Phase 7 vs. standalone):** Under `/document-project` (Phase 7), set-gate corrections override investigation-derived facts on conflict. In a standalone `agents-md` run (no project orchestrator), the investigation's extracted facts stand.

## After approval

- Write the page to its destination.
- Move the approved screenshots from the scratch directory into the docs image directory; leave the rest behind.
- Add or update the page-to-source map in the docs repo.
- Add the nearest code-to-docs note (in the closest `AGENTS.md` or `CLAUDE.md`): "if you change this, update `<page>`."
- Flag every file touched.

## Notes

- A reviewer finding is input, not a verdict. The reviser may reject a finding that is wrong.
- Keep project specifics (the controlled vocabulary, the page structure, the home of the page-to-source map) in the docs repo, not in this skill.
- The pipeline scales down: for a tiny change, run ground → draft → fact-check → revise and skip the coverage critic. Skip the Capture stage for a prose-only page or any revision that does not touch a screen. State when you skip a stage and why.
