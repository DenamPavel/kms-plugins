---
name: working-with-panels
description: Use when running a multi-model council or review panel on non-code work (analysis, research, design) and then summarizing its output. Grounds the brief, keeps council composition flexible, and pipes the raw outputs through an enforced summarize-audit loop instead of summarizing by hand. For code review, use /angel instead.
---

Running a panel is not the risky part. Compressing its output into takeaways is, because a summary of a council is itself a claim, and that is exactly where a sample gets generalized or a review gets mischaracterized. This skill keeps the composition step flexible and puts the compression step under an enforced loop.

For code review, use `/angel`, not this. This is for councils on analysis, research, and design.

## 0. Decide whether the loop is the right instrument

The loop exists because re-deriving a claim can be expensive: the source is a 26k-word document, a database query, an external repo you would have to clone. An agent re-reading that is cheaper than you re-reading it.

**When every claim cites a `file:line` in a local repo, that premise is false.** One `grep` falsifies a claim faster than an auditor re-derives it, and you are going to open those files anyway to act on the findings. Measured on the 2026-07-31 people-as-login run: two catches across two rounds, and both were things `grep` finds in seconds (a count, "four queries not five", and a seat misattribution).

Route on the cost of re-derivation rather than on the fact that a panel ran:

| the panel's sources | what to do |
|---|---|
| A local repo, seats citing `file:line` | **Chair falsification pass.** Check each load-bearing claim yourself against the cited line, then write the synthesis. Skip the loop. |
| A long document, an external repo, a database, anything you cannot cheaply recheck | **Run the loop.** This is the case it was built for. |
| Mixed | Loop it, but pre-verify the local `file:line` claims yourself so the auditor's rounds are spent on the expensive half. |

A chair falsification pass is not skipping the audit. It is the audit, done by the party about to act on the result. Two rules carry over unchanged: check the claim against the source rather than against the seat's reasoning about it, and treat every cross-seat convergence claim as a claim in its own right, because that is the compression and it is where you are most likely to be wrong. Sections 4b and 5 apply either way.

## 1. Ground the brief in primary sources

Before writing a single seat prompt, read the sources yourself, or tell each seat to verify its load-bearing claims against the files. A panel built on a brief you authored inherits your blind spots; the errors come back correlated, wearing several models' worth of authority. Independence between seats is the whole value, so do not let them see each other's outputs.

## 2. Run the council (this stays yours)

Compose the seats and models for the question at hand. This is a judgment call and it is interactive; make it as you see fit. Collect each seat's raw output as text. Do not summarize yet.

## 3. Pipe the raw outputs to the enforced loop

Do not summarize the council by hand.

**First write each seat's raw output to its own file, then pass the paths.** `rawOutputs` is interpolated into the summarizer's prompt on the initial pass *and again on every revision round*, so inlining four 15KB seat reports re-sends roughly 20k tokens per revision, on Opus, carrying no new information. Passing paths makes that a short pointer block the summarizer resolves once with `Read`. It also gives you the durable artifact you want anyway: the raw reports survive as the primary record, which is what section 4b depends on.

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/panel-audit-loop.js",
  args: {
    rawOutputs: "The raw seat reports are on disk. READ ALL OF THEM IN FULL with the Read tool before summarizing; none of their text is reproduced here.\n1. /abs/path/seat1-....md — Seat 1 (Opus), <what it owned>.\n2. /abs/path/seat2-....md — Seat 2 (Sonnet), <what it owned>.\n<...>\nPreserve each seat's own severity labels; do not reassign them across seats. Attribute every claim to its seat number. Where seats independently reached the same conclusion, say so and name which seats.",
    question: "<what the council was convened on>",
    sourceHints: "<where the primary sources live, and how to verify against them>",
    roundCap: 2
  }
})
```

Inline the text only when the outputs are small or there is no filesystem to write to.

`roundCap` is optional and defaults to 2, clamped to 1 through 5. Do not set it to 1 to save tokens: with a cap of 1 the loop audits and exits without ever revising, so you get findings and no corrected claims, which is where most of the value is. Two buys the revision. A third round is available by asking for it, and is worth asking for when the first audit comes back with many `wrong` verdicts rather than a few; the evidence for the lower default is in the changelog for 0.1.2.

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

After you present the result, append one record to the runs log so runs accumulate as evidence of whether the loop earns its keep. **A chair falsification pass under section 0 gets a record too**, with `mode: "chair"` and `rounds: 0`, or the log silently becomes a survey of only the runs that used the loop.

**Write every field, every time, including the ones that are zero or null.** The shape below is fixed. Records written from 2026-07-22 omitted `question`, `issuesCaught` and `unresolvedAtCap` on some runs and populated them on others, so four of the first seven records could not be compared with the rest, and the log could not answer the question it exists for. An absent field and a zero mean different things and the reader cannot tell them apart after the fact.

```bash
RUNS="$HOME/.panel-audit/runs"; mkdir -p "$RUNS"
jq -cn \
  --arg ts "$(date -u +%FT%TZ)" \
  --arg mode "loop" \
  --arg question "<the council question, one line>" \
  --argjson claimsAudited 0 \
  --argjson rounds 0 \
  --argjson converged false \
  --argjson issuesCaught 0 \
  --argjson contested 0 \
  --argjson unverifiable 0 \
  --argjson unresolvedAtCap 0 \
  --argjson proseFindings 0 \
  --argjson issues '[]' \
  '{ts:$ts, mode:$mode, question:$question, claimsAudited:$claimsAudited, rounds:$rounds,
    converged:$converged, issuesCaught:$issuesCaught, contested:$contested,
    unverifiable:$unverifiable, unresolvedAtCap:$unresolvedAtCap,
    proseFindings:$proseFindings, issues:$issues}' >> "$RUNS/log.jsonl"
```

`issues` is an array of `{claimId, verdict, corrected}`, one per issue the auditor raised, so a later reader can judge whether the catches were substantive or cosmetic without re-running anything. `claimsAudited` is round 1's claim count and is what makes a hit rate computable: three catches out of twenty-four audited is a different tool from three out of four.

This is what lets you later answer "how often does it catch something real," which is the only honest way to know whether the loop is worth its tokens — and the only basis on which to change its defaults.

## Backstop

If you summarize a council to a project file by hand instead of using this loop, the `audit-summary` hook fires the `panel-auditor` for a single pass and reminds you the enforced loop exists. That is a net, not a substitute: one audit pass is not the loop.
