# panel-audit

Fact-checking for multi-model councils and review panels on **non-code** work (analysis, research, design).

## The problem it addresses

The error a panel ships is a seat that was confidently wrong about the world. Seats produce fluent, well-argued, internally consistent reports, and a seat with no way to check a date or a holding will assert one anyway, in the same voice it uses for the things it knows.

So this plugin checks the deliverable's claims against the world, at the point where they are about to be relied on.

## Components

- **`working-with-panels` skill**: the front door. It walks the chair from tooling the seats through logging the run: ground the brief, run the council, write the deliverable, verify its claims, act on the verdicts uncompressed.
- **`run-panel` workflow**: dispatches the seats in parallel. Each seat writes its full report to disk and returns only a headline plus its own list of checkable claims, so the chair's context stays small and the claim ledger comes out as a by-product rather than a later extraction pass. Applies the tooling gate: a seat marked empirical that has no research tools is logged by name, and its own prompt tells it to mark every outside fact unverified rather than argue from it. Also surfaces `highRisk` claims: load-bearing, unchecked, and from a seat with no tools. Takes `question`, `seats`, and `reportDir`.
- **`verify-claims` workflow**: the engine. Takes a `run-panel` claim ledger through `claims`, or extracts the claims from a finished document through `draftPath`. Groups them by topic and fans out tool-equipped verifiers in parallel, one per cluster. No rounds. Returns a verdict per claim with the sources consulted, and separates the failures out as `mustFix`.
- **`claim-verifier` agent** (Sonnet, tool-equipped): checks one cluster of claims against primary and external sources. Reports `unverifiable` rather than rubber-stamping a thin search.
- **`panel-auditor` agent** (Fable, a different model so blind spots are not correlated): single-pass fact-auditor for a whole document. Used by the hook.
- **`audit-summary` hook**: a `PostToolUse` backstop. When an agent writes an unverified summary or findings doc to a project file, the hook dispatches the auditor for one advisory pass and points at the workflow.

## Verdicts

`verify-claims` returns one of five verdicts for each claim.

| Verdict | Meaning |
|---------|---------|
| `confirmed` | Checked and true. On a compound claim, every component was checked; a partially checked claim is never `confirmed`. |
| `wrong` | Checked and false. Carries the correction. |
| `imprecise` | Directionally right and wrong in a specific: a figure, a scope, a date, a dropped qualifier. |
| `unverifiable` | Nobody here could settle it. An honest outcome, and it gets labeled in the document rather than dropped. |
| `inherited` | *Nobody in this run checked it.* A tooled seat reported checking it and cited sources, so its verdict was carried over. Weaker than `confirmed`, and worth reading as such. |

## Reuse

Budget caps cut cost by not looking. Reuse cuts it by not redoing settled work, and that is the larger waste: in one traced 0.1.x run the workflow verified the same four facts four separate times, because the panel's own evidence seat had already checked them and nothing downstream consumed the result. All three paths below run before the workflow dispatches a single verifier.

- **Duplicate claims collapse.** Two seats asserting the same fact costs one lookup. Every id still receives the verdict, tagged `duplicateOf`.
- **Prior verdicts carry forward.** `priorVerdicts` brings in verdicts from an earlier run, and the workflow does not re-check a claim whose text is unchanged. It returns `verdictCache` for the chair to append, since a workflow has no filesystem access; the `working-with-panels` skill carries a copy-paste snippet for that append.
- **Seat-verified claims inherit.** A claim a tooled seat checked and cited sources for comes back `inherited` rather than re-run. The workflow re-verifies a deterministic sample anyway (`spotCheckRate`, default 0.25), and a failed spot-check condemns the whole inherited batch rather than the sampled claim alone, on the reasoning that a seat citing one bad source has probably cited others. `trustSeats: false` disables inheritance entirely.

The workflow excludes `inherited` claims from the unverifiable-rate denominator, since nobody in the run checked them and counting them would flatter the rate.

## Cost controls

Caps make a run affordable and they cost coverage. On one 2000-word memo, the controls cut the run from 595k tokens to 203k and missed two of the three genuine errors the unconstrained run found. So every cap reports what it dropped.

- **`searchBudget`** (default 5) is per claim, not per group. A four-claim group gets roughly twenty lookups. The workflow tells the verifier the budget is a ceiling and not a target, because an `unverifiable` verdict moves the work to a human with less context.
- **`extractCap`** (default 20) bounds extraction from a `draftPath`, with ranking instructions. Compressed claims ("all", "none", "only N", "no X has ever") rank first, since they are the most confident and least checked claims in any document.
- **`maxClusters`** truncates the tail. Load-bearing groups run first, and anything dropped comes back in `uncheckedByCap`.
- **`unverifiableRate`** comes back with the results, and above 15% the workflow logs a warning that the budget rather than the sources is the likely cause. Without that signal a starved run reads as clean to anyone looking only at the confirmed count.

## Design notes

- **A seat that will assert facts must have research tools.** A seat without them holds a lens (structure, logic, craft) and marks every empirical assertion unverified. `run-panel` names any seat that breaks this in the run log and constrains that seat's prompt, but it still dispatches the seat, so the warning is the control rather than a refusal. The rule on its own would have prevented the traced 0.1.x failure, a tool-less seat shipping five false cases out of seven (see Changes in 0.2.0), which makes it the highest-value line in the plugin.
- **An intermediate document is a claim, not a source.** When a memo says a court held X, the check is the holding, not the seat report that mentioned it. The sole exception is a claim explicitly about attribution.
- **Verify the thing that ships.** Claims are checked as they appear in the deliverable, so nothing is spent perfecting an intermediate that gets thrown away, and nothing that ships goes unchecked.
- **Only what survived into the draft.** Facts a seat raised and the chair did not use are not worth checking.
- **Caps are reported, never silent.** A truncation that reads as full coverage is worse than no check.
- **Dead agents fail closed.** A verifier that returns nothing marks its claims `unverifiable`, never clean, because an empty result set otherwise computes to a clean pass.
- **Unverifiable is an honest outcome.** It gets labeled in the document. A rubber-stamped claim becomes a false statement someone acts on.

## Tests

`tests/reuse.test.mjs` stubs `agent()` and `parallel()` and exercises the whole reuse and failure surface at zero token cost: duplicate collapse, prior-verdict reuse, inheritance and sampling, the untooled-seat exclusion, spot-check failure propagation, and dead-verifier fail-closed. 16 assertions.

```bash
node tests/reuse.test.mjs
```

## Changes in 0.2.0

0.1.x ran a summarize-audit loop: an Opus summarizer collapsed the panel into attributed claims, a Fable auditor re-derived them, and the two looped to convergence. Its ground truth was *what the seats said*, stated outright in the summarizer's prompt ("Add nothing no seat said") and in the workflow's revise prompt ("RAW COUNCIL OUTPUTS (ground truth for what the seats said)").

That made it a fidelity machine. It reliably caught the chair over-crediting a seat, and it had no mechanism that could ask whether a seat was right. Across eleven logged runs it returned 30 findings: 20 `overstated`, 5 `wrong`, 3 `unverifiable`, 2 `understated`, with the majority being attribution corrections inside a digest that existed only to be rewritten into a memo. On 2026-08-16 it passed clean a seat's list of seven historical cases of which five were false, because the summary described the list accurately, which it did.

0.2.0 deletes the summarizer, the rounds, the claims/ids/contested machinery, and the loop workflow. The chair writes the deliverable; the workflow checks whether it is true.

## Status

Rebuilt 0.2.0 from eleven logged 0.1.x runs and one traced failure. The run log at `~/.panel-audit/runs/log.jsonl` carries a `changedTheDeliverable` field so the next revision can be driven by whether findings actually altered shipped text rather than by how many findings were produced.
