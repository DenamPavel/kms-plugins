---
name: working-with-panels
description: Use when running a multi-model council or review panel on non-code work (analysis, research, design) and then summarizing its output. Grounds the brief, keeps council composition flexible, and pipes the raw outputs through an enforced summarize-audit loop instead of summarizing by hand. For code review, use /angel instead.
---

Running a panel is not the risky part. Compressing its output into takeaways is, because a summary of a council is itself a claim, and that is exactly where a sample gets generalized or a review gets mischaracterized. This skill keeps the composition step flexible and puts the compression step under an enforced loop.

For code review, use `/angel`, not this. This is for councils on analysis, research, and design.

## 1. Ground the brief in primary sources

Before writing a single seat prompt, read the sources yourself, or tell each seat to verify its load-bearing claims against the files. A panel built on a brief you authored inherits your blind spots; the errors come back correlated, wearing several models' worth of authority. Independence between seats is the whole value, so do not let them see each other's outputs.

## 2. Run the council (this stays yours)

Compose the seats and models for the question at hand. This is a judgment call and it is interactive; make it as you see fit. Collect each seat's raw output as text. Do not summarize yet.

## 3. Pipe the raw outputs to the enforced loop

Do not summarize the council by hand. Invoke the loop:

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/panel-audit-loop.js",
  args: {
    rawOutputs: "<every seat's raw output, concatenated>",
    question: "<what the council was convened on>",
    sourceHints: "<where the primary sources live, if you know>",
    roundCap: 3
  }
})
```

`roundCap` is optional and defaults to 3, clamped to 1 through 5. Do not set it to 1 to save tokens: with a cap of 1 the loop audits and exits without ever revising, so you get findings and no corrected claims, which is where most of the value is. Scoping (below) is what makes the later rounds cheap.

The loop runs in isolated agent contexts, so your window stays clean:
- `panel-summarizer` (Opus) collapses the raw outputs into source-attributed claims.
- `panel-auditor` (Fable, a different model so blind spots are not correlated) re-derives each claim against primary sources.
- Round 1 audits every claim **and the prose field**, reported as `claimId` 0. Prose is where a compression error survives even when every individual claim is clean: a generalisation the claims do not support, a count that contradicts a claim, or an attribution to more seats than the claims list.
- If the auditor finds `wrong`/`overstated` issues, the summarizer revises (fix, or contest with a source-grounded reason) and the auditor re-checks.
- **Later rounds audit only what the previous round flagged plus any claim the summarizer rewrote**, never the whole set again. Verdicts accumulate across rounds, so narrowing cannot drop an earlier unverifiable or contested item. A 34-claim summary that converges in three rounds costs about 40 claim-audits rather than 102.
- The loop runs until it converges or hits the cap, then escalates to you.

## 4. Present the result, do not compress it

When the workflow returns, present the `auditTrail` as it stands. Do not paraphrase it into your own tidier version. RED FLAG: if you catch yourself about to write "the auditor basically confirmed it" instead of showing the trail, stop. Compressing the audit into your own summary is the exact failure this whole loop exists to prevent.

Then adjudicate everything under `humanMustAdjudicate`:
- **unverifiable** — the auditor lacked access (usually a database claim with no `DATABASE_URL` in the workflow). Re-run the check yourself, then fix or keep with the true number.
- **contested** — a genuine standoff between summarizer and auditor. Read both against the source and decide.
- **unresolvedAtCap** — issues still open at the cap. The loop did not converge; resolve them yourself and say so, rather than presenting a clean pass.
- **proseFindings** — findings against the prose rather than a claim. Read these before you quote the prose anywhere, because the prose is the part that ends up in your reply and in any file you write.

Also check `incomplete`. It is set when an agent died and the round did not really run, and `converged` is false whenever it is set.

Only after that is the summary ready to hand to the operator, with a short note of what the auditor flagged and how it resolved.

## 4b. Draft everything downstream from the corrected claims, never from the raw seat reports

Once the loop returns, the raw seat reports are superseded. Treat them as read-only history. Every file, memo, artifact, and reply you write must be built from the corrected `summary.claims`.

This is not a style preference. Observed 2026-07-31: a findings document drafted partly from the raw reports reintroduced three figures the loop had already corrected, including a word count the auditor had fixed in round 1. A single audit pass on that document found five outright errors and ten overstatements. The loop had done its job and the drafting undid it, which makes the whole run worthless and costs a second audit to discover.

Two specific traps from that run:
- **A seat's severity label is not yours to reassign.** If some seats labelled their findings and others did not, say so explicitly rather than mapping the unlabelled ones onto the same scale and calling the labels the seats' own. That is a false provenance claim, which is the exact class of error this loop exists to catch.
- **Do not upgrade a hedge you are relaying.** An item the auditor held `unverifiable` stays unverifiable in your prose. Writing that it is "sound" or "solid" inside a section about audit provenance reads as audit-backed when nothing backed it. If you have your own view, label it as yours.

## 5. Log the run (tracking)

After you present the result, append one record to the runs log so runs accumulate as evidence of whether the loop earns its keep:

```bash
RUNS="$HOME/.panel-audit/runs"; mkdir -p "$RUNS"
```

Append a single JSON line to `$RUNS/log.jsonl` capturing: an ISO timestamp (`date -u +%FT%TZ`), the `question`, `rounds`, `converged`, the count and text of the issues the auditor caught (each `verdict` + `corrected`), and the `contested`/`unverifiable` counts. Build the line with `jq -cn` so it is valid JSON, and append with `>>`.

This is what lets you later answer "how often does it catch something real," which is the only honest way to know whether the loop is worth its tokens.

## Backstop

If you summarize a council to a project file by hand instead of using this loop, the `audit-summary` hook fires the `panel-auditor` for a single pass and reminds you the enforced loop exists. That is a net, not a substitute: one audit pass is not the loop.
