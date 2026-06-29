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

These six agents ship with this plugin. Dispatch each with the Task tool, using the agent's name (the left column below) as the subagent type. The pipeline needs no other plugin and no general-purpose agent; use the bundled agents, not a generic substitute, so the roles and model assignments hold.

| Agent | Model | Role |
|-------|-------|------|
| `doc-investigator` | sonnet | Ground truth: user-facing surface, DO-NOT-LEAK list, page-to-source map, existing-docs inventory |
| `doc-writer` | sonnet | Draft applying the `writing-documentation` skill |
| `doc-fact-checker` | sonnet | Verify every claim against source |
| `doc-editor` | opus | Machine-writing tells, voice, structure |
| `doc-coverage-critic` | sonnet | Shipped behavior the page omits |
| `doc-reviser` | opus | Rewrite from intent, reject wrong findings |

The editor runs on a different model than the writer, which satisfies the skill's "at least one reviewer on a different model" rule by construction.

## The pipeline

Track progress with TaskCreate so a long run does not lose its place.

### Stage 1 — Ground

Dispatch `doc-investigator` on the source. It returns the user-facing surface, the DO-NOT-LEAK list, the actor vocabulary, the page-to-source map, and the existing-docs inventory. Save its report to a working file the later agents can read.

### GATE 1 — Human review of scope

Present to the human: the target, the DO-NOT-LEAK list, the coverage scope (what the page will and will not cover), and the page-to-source map. Get approval or corrections before drafting. Do not skip this gate.

### Stage 2 — Draft

Dispatch `doc-writer` with the skill and the approved ground truth. It writes the draft to a working path.

### Stage 3 — Review (parallel, cross-model)

Dispatch these three in parallel, each reading the draft and the ground truth:

- `doc-fact-checker`
- `doc-editor` (opus)
- `doc-coverage-critic`

Collect all findings. Deduplicate overlapping ones before revision.

### Stage 4 — Revise

Dispatch `doc-reviser` with the draft and all findings. It rewrites from intent, rejects wrong findings with reasons, closes coverage gaps, and writes the revised page.

If the revise pass plausibly introduced new issues, re-run Stage 3 on the revised page. Loop until the reviewers are clean or the human accepts the remaining items.

### GATE 2 — Human review of the result

Present the finished page (a diff if it replaces a live page), the page-to-source map, the accepted and rejected findings, and a plain statement that this is machine-written and needs human review before it ships. Do not write over a live page without this gate.

## After approval

- Write the page to its destination.
- Add or update the page-to-source map in the docs repo.
- Add the nearest code-to-docs note (in the closest `AGENTS.md` or `CLAUDE.md`): "if you change this, update `<page>`."
- Flag every file touched.

## Notes

- A reviewer finding is input, not a verdict. The reviser may reject a finding that is wrong.
- Keep project specifics (the controlled vocabulary, the page structure, the home of the page-to-source map) in the docs repo, not in this skill.
- The pipeline scales down: for a tiny change, run ground → draft → fact-check → revise and skip the coverage critic. State when you skip a stage and why.
