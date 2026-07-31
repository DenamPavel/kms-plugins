# panel-audit

An enforced summarize-audit loop for multi-model councils and review panels on **non-code** work (analysis, research, design). For code review, use `/angel`.

## The problem it addresses

Running a panel is not where things go wrong. Compressing its output into takeaways is: a summary of a council is itself a claim, and that is where a sample gets generalized to "only N do X" or a reviewer's finding gets mischaracterized. This plugin keeps council composition flexible and puts the compression step under a loop that a re-deriving auditor drives to convergence.

## Components

- **`working-with-panels` skill** — the front door. Ground the brief, run the council, pipe raw outputs to the loop, present the audit trail without compressing it, adjudicate what the loop surfaces, and log the run.
- **`panel-audit-loop` workflow** — the enforced engine. Summarize → audit → revise, looping until convergence or a 3-round cap, in isolated agent contexts so the orchestrator's window stays clean. Returns the summary plus a full audit trail; `contested`, `unverifiable`, and `unresolvedAtCap` items surface for human adjudication.
- **`panel-summarizer` agent** (Opus) — collapses raw panel outputs into source-attributed claims, adds nothing, preserves disagreement; on revision rounds fixes or contests-with-reason.
- **`panel-auditor` agent** (Fable, a different model so blind spots are not correlated) — re-derives each claim against primary sources instead of proofreading; flags subset-generalizations, mischaracterized reviews, and mechanism/quantitative errors under re-derive-or-flag.
- **`audit-summary` hook** — a `PostToolUse` backstop. If a summary/findings doc is written to a project file by hand, it dispatches the auditor for a single advisory pass and points back at the enforced loop. One pass is not the loop.

## Design notes

- **Decorrelated critic.** Summarizer and auditor run on different models on purpose.
- **Grounded critic.** The auditor re-derives against data/source memos/code; a proofreading critic would rubber-stamp fluent-but-wrong claims.
- **Escape hatch.** The summarizer can contest a finding with a source-grounded reason; genuine standoffs go to the human rather than forcing a wrong edit or thrashing.
- **Deliberate termination.** Converge or 3-round cap, then escalate; contested counts as resolved to prevent thrash.
- **DB limitation.** Redshift-backed claims the auditor cannot reach return as `unverifiable` and land on the human; they are never fake-passed.

## Status

Built and self-verified (loop control flow dry-run across converge/cap/contest; hook emits valid JSON on fire). **Not yet run on a real council.** Its value is unproven until it flags a real overstatement in a real summary; the skill's run log exists to accumulate that evidence.
