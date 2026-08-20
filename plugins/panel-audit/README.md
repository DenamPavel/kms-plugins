# panel-audit

Fact-checking for multi-model councils and review panels on **non-code** work (analysis, research, design). For code review, use `/angel`.

## The problem it addresses

The error a panel ships is a seat that was confidently wrong about the world. Seats produce fluent, well-argued, internally consistent reports, and a seat with no way to check a date or a holding will assert one anyway, in the same voice it uses for the things it knows.

So this plugin checks the deliverable's claims against the world, at the point where they are about to be relied on.

## Components

- **`working-with-panels` skill** — the front door. Give fact-asserting seats real research tools, ground the brief, run the council, write the deliverable yourself, verify its claims, act on the verdicts without compressing them, log the run.
- **`verify-claims` workflow** — the engine. Extracts the checkable empirical claims from a finished deliverable, groups them by topic, and fans out tool-equipped verifiers in parallel, one per cluster. No rounds. Returns per-claim `confirmed` / `wrong` / `imprecise` / `unverifiable` with the sources actually consulted, partitioned into `mustFix`.
- **`claim-verifier` agent** (Sonnet, tool-equipped) — checks one cluster of claims against primary and external sources. Reports `unverifiable` rather than rubber-stamping a thin search.
- **`panel-auditor` agent** (Fable, a different model so blind spots are not correlated) — single-pass fact-auditor for a whole document. Used by the hook.
- **`audit-summary` hook** — a `PostToolUse` backstop. If a summary or findings doc is written to a project file unverified, it dispatches the auditor for one advisory pass and points at the workflow.

## Design notes

- **An intermediate document is a claim, not a source.** When a memo says a court held X, the check is the holding, not the seat report that mentioned it. The sole exception is a claim explicitly about attribution.
- **Verify the thing that ships.** Claims are extracted from the deliverable, so nothing is spent perfecting an intermediate that gets thrown away, and nothing that ships goes unchecked.
- **Only what survived into the draft.** Facts a seat raised and the chair did not use are not worth checking.
- **Caps are reported, never silent.** Load-bearing claims are checked first; anything dropped comes back in `uncheckedByCap`. A truncation that reads as full coverage is worse than no check.
- **Dead agents fail closed.** A verifier that returns nothing marks its claims `unverifiable`, never clean, because an empty result set otherwise computes to a clean pass.
- **Unverifiable is an honest outcome.** It gets labeled in the document. A rubber-stamped claim becomes a false statement someone acts on.

## What changed in 0.2.0, and why

0.1.x ran a summarize-audit loop: an Opus summarizer collapsed the panel into attributed claims, a Fable auditor re-derived them, and the two looped to convergence. Its ground truth was *what the seats said*, stated outright in the summarizer's prompt ("Add nothing no seat said") and in the workflow's revise prompt ("RAW COUNCIL OUTPUTS (ground truth for what the seats said)").

That made it a fidelity machine. It reliably caught the chair over-crediting a seat, and it had no mechanism that could ask whether a seat was right. Across eleven logged runs it returned 30 findings: 20 `overstated`, 5 `wrong`, 3 `unverifiable`, 2 `understated`, with the majority being attribution corrections inside a digest that existed only to be rewritten into a memo. On 2026-08-16 it passed clean a seat's list of seven historical cases of which five were false, because the summary described the list accurately, which it did.

0.2.0 deletes the summarizer, the rounds, the claims/ids/contested machinery, and the loop workflow. The chair writes the deliverable; the workflow checks whether it is true.

## Status

Rebuilt 0.2.0 from eleven logged 0.1.x runs and one traced failure. The run log at `~/.panel-audit/runs/log.jsonl` carries a `changedTheDeliverable` field so the next revision can be driven by whether findings actually altered shipped text rather than by how many findings were produced.
