---
name: working-with-panels
description: Use when running a multi-model council or review panel on non-code work (analysis, research, design) and then writing up its output. Grounds the brief, requires seats that assert facts to have the tools to check them, has the chair write the deliverable directly, and fact-checks the deliverable's claims against the world via the verify-claims workflow. For code review, use /angel instead.
---

# Working with panels

A panel's output is only as good as its worst-informed seat, and the failure you will actually ship is a seat that was confidently wrong about the world. Everything below is arranged around catching that.

For code review, use `/angel`. This is for councils on analysis, research, and design.

## 0. The rule that prevents most of the damage

**A seat that will make empirical claims must have the tools to check them.**

Give every seat whose argument will rest on facts, dates, holdings, institutions, counts, attributions to third parties, actual research access. A seat without tools can still hold a lens: structure, logic, internal consistency, craft, the shape of an argument. It cannot be trusted to assert what happened in the world, and it will not tell you that, because it does not know.

If a seat must run without tools, say so in its prompt: it marks every empirical assertion as unverified and does not build a load-bearing argument on one.

This is not hypothetical. Logged 2026-08-16: a counter-case seat with no research tooling produced a list of seven practices that had supposedly "made the aesthetic case in print and lost." The list was the evidentiary center of its entire argument. Five of the seven were wrong: one had been admitted outright, two never petitioned, one was never a loss in any sense. Nothing downstream caught it, because nothing downstream was looking at the world.

## 1. Ground the brief in primary sources

Before writing a single seat prompt, read the sources yourself, or require each seat to verify its load-bearing claims against them. A panel built on a brief you authored inherits your blind spots, and the errors come back correlated, wearing several models' worth of authority.

Independence between seats is the whole value. Do not let them see each other's outputs.

## 2. Run the council

Compose the seats, lenses, and models for the question at hand. That is your judgment and it stays yours. The workflow only handles dispatch, the tooling gate, and the bookkeeping.

```
Workflow({
  scriptPath: "<plugin root>/workflows/run-panel.js",
  args: {
    question: "<what the council is convened on>",
    reportDir: "/abs/scratch/dir",
    brief: "<shared context, if any>",
    seats: [
      { label: "logic", lens: "argument structure", prompt: "<full seat prompt>",
        model: "opus", empirical: false, tools: false },
      { label: "evidence", lens: "factual record", prompt: "<full seat prompt>",
        model: "sonnet", empirical: true, tools: true }
    ]
  }
})
```

Each seat writes its full report to `reportDir` and returns only a 200-word headline plus **its own list of checkable claims**. Two things fall out of that. The orchestrator context stays small, because the reports live on disk rather than in the return value. And you get the claim ledger for free: a seat already knows which of its assertions are checkable and which it was unsure about, so asking it costs almost nothing and beats re-deriving the same list later by re-reading the finished draft.

Set `empirical: true` on any seat whose argument will rest on facts, and give it `tools: true`. The workflow logs a gate warning for any seat that is empirical without tools, and instructs that seat to mark every outside fact UNVERIFIED rather than arguing from it.

The return value carries `ledger` (every claim, with its seat and whether that seat checked it), `loadBearing`, and `highRisk` — load-bearing, unchecked, from a seat with no tools. `highRisk` is the exact shape of the logged failure; check those before anything else.

Do not summarize yet.

## 3. Write the deliverable yourself

Read the seat reports and write the memo, answer, or document directly from them.

Do not insert a summarizing agent between the seats and the deliverable. Version 0.1.x did exactly that, and it was the plugin's central mistake: it produced a source-attributed digest of the panel, audited *that*, and left the thing that shipped unchecked. Across eleven logged runs the audit returned 30 findings, of which 20 were `overstated` and most of those were attribution bookkeeping in a document nobody would ever read. Meanwhile the substantive errors rode through untouched.

Three rules while drafting, all learned from real runs:

- **A seat's severity label is not yours to reassign.** If some seats labelled their findings and others did not, say so rather than mapping the unlabelled ones onto the same scale and presenting the labels as the seats' own.
- **Do not upgrade a hedge you are relaying.** An item a seat flagged as uncertain stays uncertain in your prose. If you have your own view, label it as yours.
- **Surface disagreement rather than averaging it.** When seats split, name the split and the positions. A panel collapsed into false consensus is worth less than one seat.

## 4. Fact-check the deliverable

Route on the cost of re-derivation:

| The claims rest on | Do this |
|---|---|
| Local files you can open, with `file:line` citations | **Check them yourself.** One `grep` falsifies a claim faster than an agent re-derives it, and you are opening those files anyway. |
| The outside world, external repos, databases, long documents | **Run the workflow.** This is the case it exists for. |
| Both | Check the local half yourself, run the workflow on the rest. |

```
Workflow({
  scriptPath: "<plugin root>/workflows/verify-claims.js",
  args: {
    claims: <the run-panel ledger entries that survived into your draft>,
    sourceHints: "<where primary sources live, how to reach them, which are authoritative>",
    contextPaths: ["/abs/path/seat1-....md", "/abs/path/seat2-....md"],
    scope: "load-bearing"
  }
})
```

**Filter the ledger to what actually survived into your draft before passing it.** This is the largest saving available and the easiest one to skip. A panel raises far more facts than any deliverable uses, and a fact nobody's conclusion rests on is not worth a lookup.

Passing `claims` skips extraction entirely. For a hand-written document with no ledger behind it, pass `draftPath` instead and it extracts first, at the cost of one extra agent and a full read.

**Do not strip the `checked` and `sources` fields when you filter.** They are what stop the pipeline redoing settled work, which is its largest avoidable cost. Measured 2026-08-16: the same handful of facts were verified four separate times in one session, because a tooled evidence seat had already checked them with URLs and nothing downstream consumed the result.

Three reuse paths run before anything is dispatched:

1. **Duplicates collapse.** Two seats asserting the same fact is one lookup; both ids still get the verdict.
2. **Prior verdicts are reused.** Pass `priorVerdicts` and any claim whose text is unchanged is not re-checked. Load and store them like this, since workflows have no filesystem access:

```bash
C="$HOME/.panel-audit/verdicts.jsonl"; mkdir -p "$(dirname "$C")"; touch "$C"
jq -s '.' "$C"                                  # -> pass as args.priorVerdicts
# after the run, append result.verdictCache:
jq -c '.[]' <<<"$VERDICT_CACHE_JSON" >> "$C"
```

3. **Seat-verified claims are inherited.** A claim a *tooled* seat checked and cited sources for is not re-run. It comes back with verdict `inherited`, which is not the same as `confirmed`: it means nobody here checked it, and a named seat with tools said it did. A deterministic sample (`spotCheckRate`, default 0.25) is re-verified anyway, and if a spot-check fails the run says so loudly and marks the whole inherited batch suspect, because a seat that cites a bad source has probably cited others. Set `trustSeats: false` to check everything.

Reuse is the efficiency lever. Budgets are the fallback.

Claims are grouped deterministically rather than by an agent: attribution claims separate out first, since they are checked against different sources, and the rest chunk by seat. Verifiers run in parallel with a suggested lookup budget, and each claim returns `confirmed`, `wrong`, `imprecise`, or `unverifiable` with the sources actually consulted.

`contextPaths` are the seat reports. They exist only so the verifier can check claims *about what a seat said*. **For every other claim they are not sources.** An intermediate document is a claim, not evidence, and treating it as evidence is what version 0.1.x did wrong.

Cost controls: `scope` defaults to `load-bearing`, so claims whose falsity would not change your conclusion are skipped and returned in `uncheckedByScope`; pass `"all"` to check everything. `maxClusters` (8) and `claimsPerCluster` (4) bound the fan-out, and anything dropped comes back in `uncheckedByCap` rather than reading as clean. `searchBudget` (6 per group) tells verifiers to report `unverifiable` rather than guess when they run out.

## 5. Act on the verdicts, do not compress them

Present the findings as they came back. RED FLAG: if you catch yourself about to write "the verifier basically confirmed it" instead of showing the verdicts, stop. That compression is the failure this whole plugin exists to prevent.

Then work `mustFix`, which holds everything that cannot ship as written:

- **`wrong`** — fix the claim to the corrected version, and check whether anything downstream rested on it. A wrong fact usually has an argument standing on top of it.
- **`imprecise`** — fix the wording. This is the most common real finding: the event is real and the claim overstates or mislabels it, almost always in the direction that flatters the argument.
- **`unverifiable` and load-bearing** — either check it yourself or label it in the document as unverified. Shipping one unlabeled is the specific failure the workflow exists to prevent. Do not quietly delete it either; its absence reads as coverage.
- **`uncheckedByCap` and `uncheckedByScope`** — say what was not checked. A cap or a scope filter presented as full coverage is a false claim about your own diligence, and it is the one nobody downstream can detect.

**Edit the deliverable in place.** Do not re-draft it from the seat reports, which would reintroduce the errors you just paid to find. Observed 2026-07-31: a findings document redrafted from raw reports reintroduced three already-corrected figures.

Then re-check anything you rewrote. A fix is new text and nobody has checked it.

## 6. Log the run

Append one record per run, including chair-only passes, or the log becomes a survey of the runs that used the workflow. Write every field every time, including zeros; an absent field and a zero mean different things and no later reader can tell them apart.

```bash
RUNS="$HOME/.panel-audit/runs"; mkdir -p "$RUNS"
jq -cn \
  --arg ts "$(date -u +%FT%TZ)" \
  --arg mode "workflow" \
  --arg question "<the council question, one line>" \
  --argjson seats 0 --argjson seatsWithTools 0 \
  --argjson claimsExtracted 0 --argjson claimsChecked 0 \
  --argjson confirmed 0 --argjson wrong 0 --argjson imprecise 0 \
  --argjson unverifiable 0 --argjson uncheckedByCap 0 \
  --argjson changedTheDeliverable 0 \
  --argjson issues '[]' \
  '{ts:$ts, mode:$mode, question:$question, seats:$seats, seatsWithTools:$seatsWithTools,
    claimsExtracted:$claimsExtracted, claimsChecked:$claimsChecked, confirmed:$confirmed,
    wrong:$wrong, imprecise:$imprecise, unverifiable:$unverifiable,
    uncheckedByCap:$uncheckedByCap, changedTheDeliverable:$changedTheDeliverable,
    issues:$issues}' >> "$RUNS/log.jsonl"
```

`changedTheDeliverable` is the field that matters and the one the 0.1.x schema lacked: how many findings actually altered the shipped text. A run that returns nine findings and changes nothing is a run that cost tokens to reassure you. `seatsWithTools` against `seats` is the leading indicator for section 0; a panel where most seats cannot check anything is a panel about to be confidently wrong.

`issues` holds `{id, verdict, corrected}` per finding, so a later reader can judge whether the catches were substantive without re-running anything.

## Backstop

If you write a summary or findings document to a project file without verifying it, the `audit-summary` hook dispatches `panel-auditor` for a single advisory pass. That is a net, not a substitute. One pass by one agent is not the workflow, and it will tell you so.
