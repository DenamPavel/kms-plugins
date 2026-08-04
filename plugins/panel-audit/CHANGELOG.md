# Changelog

## 0.1.3

The round scoping shipped in 0.1.1 does not work. Observed on the 2026-08-04 admin-plan run: rounds 2 and 3 each re-derived all 24 claims instead of the handful flagged, because the summarizer rewrote every claim on revision and `nextScope` treats changed text as in-scope. That run cost 591,885 subagent tokens over 3 rounds to produce 4 catches, and roughly two thirds of the claim-audits were re-derivations of claims already rated clean. It is the same defect 0.1.1 tried to fix with prompt wording; the wording did not hold.

**Fixed:**
- **`pinUnflagged` enforces "do not rewrite what was not flagged" instead of asking for it.** After each revision the loop restores every unflagged claim to its prior text verbatim, keeping the summarizer's new text only for claims the auditor actually flagged. `nextScope`'s diff then reports only sanctioned edits, so a gratuitous rewrite cannot cost a round. A claim the revision dropped entirely is also restored, so the claim set cannot silently shrink. When drift is detected the loop logs how many claims it restored, which makes the failure visible instead of silent.

**Why this matters beyond cost:** gratuitous rewrites manufacture findings. On the same run, round 2 flagged claim 21 `overstated` — a claim round 1 had rated clean and nobody had asked the summarizer to touch. The 0.1.1 changelog records the identical pattern on the first run ("round 2 overcorrected a fix and round 3 had to restore the accurate half"). Unflagged churn is not merely wasted tokens; it is a source of new errors that then need their own round.

## 0.1.2

Cuts the loop's cost and stops running it where a `grep` is cheaper. Driven by the runs log, which had to be repaired first because four of its seven records were unreadable.

**Changed:**
- **`roundCap` defaults to 2, was 3.** Of the three well-formed runs logged, both that reached round 3 still escalated open items to the human at the cap (`unresolvedAtCap` 1 and 2); only one of the three converged there. Round 3 mostly buys an Opus revise and a Fable audit before handing over the problem anyway. Three is still available by asking, and the skill says when to ask: a first audit returning many `wrong` verdicts rather than a few.
- **The skill now tells you to pass `rawOutputs` as file paths, not inlined text.** `revisePrompt` embeds the full raw panel output in the summarizer's prompt again on every revision round. Four 15KB seat reports is ~20k tokens re-sent per round, on Opus, carrying nothing new. Paths make it a pointer block the summarizer resolves once with `Read`, and the reports survive on disk as the primary record section 4b already depends on. The workflow's arg comment says so too.

**New:**
- **Section 0: decide whether the loop is the right instrument.** The loop's premise is that re-deriving a claim is expensive. When every claim cites a `file:line` in a local repo that premise is false, and the chair should falsify the claims directly. Evidence: the 2026-07-31 people-as-login run caught two issues in two rounds and both were `grep`-findable (a count, "four queries not five", and a seat misattribution). Two of the three well-formed runs were fiction, where an agent genuinely is the cheapest way to re-derive against a 26k-word source — that is the case the loop is for. A chair pass is still an audit and still gets a runs-log record, now with `mode: "chair"`.

**Fixed:**
- **The runs log had no fixed schema, so it could not answer the question it exists for.** Records written 2026-07-22 omitted `question`, `issuesCaught` and `unresolvedAtCap`; later ones populated them. Four of seven records were therefore incomparable, and a reader could not distinguish an absent field from a zero. Section 5 now ships an exact `jq -cn` template with every field written every time, adds `mode` and `claimsAudited`, and says to log chair passes too — without which the log becomes a survey of only the runs that used the loop. `claimsAudited` is what makes a hit rate computable: the 2026-08-04 admin-plan run audited 24 claims in round 1 and flagged 3 (one `wrong`, two `overstated`, one of those the prose), which is a materially different tool from three catches out of four.

**Not changed, and why:** the prose field keeps driving revision rounds. Prose churn looked like a plausible cause of the two non-converging runs, but `proseFindings` was 0 on every run before 2026-08-04, so the data does not support it. Left alone rather than fixed on a theory.

## 0.1.1

Fixes unqualified agent names that made both the loop and its backstop non-functional. Found on the first live council run.

**Fixed:**
- `workflows/panel-audit-loop.js` dispatched bare `panel-summarizer` / `panel-auditor` at lines 84, 95, and 109. Plugin agents register namespaced, so the workflow aborted at the first `agent()` call with "agent type not found" before any round ran.
- `hooks/audit-summary.sh:77` instructed the same bare dispatch for `subagent_type: "panel-auditor"`, so the backstop failed by the same cause as the loop it was covering for.
- The loop dereferenced `verdict.overall` without guarding the null that `agent()` returns when a subagent dies on a terminal API error. A fable auditor whose connection dropped mid-response crashed the run and discarded a completed summary and a completed audit round. Worse and latent one line further on: `finalIssues` fell back to `[]` when `verdict` was null, leaving `unresolvedAtCap` empty and computing `converged = true`, so a crashed audit would have been reported as a clean pass. The auditor now gets one retry on a null return; a second null records an `AUDIT_FAILED` round in the trail and breaks. `converged` is false whenever any agent failed, and the return carries an `incomplete` reason and forces `humanMustAdjudicate`. Both summarizer calls are guarded the same way.

**Note on how this survived 0.1.0:** the release was verified by dry-running the loop's control flow and validating the hook's JSON output. Neither check dispatches an agent, so the one defect that mattered was outside what the verification could see. A release check for this plugin needs at least one real `agent()` call.

**New, from measuring the first real run:**
- **The prose field is now audited.** It never was. The verdict schema requires an integer `claimId` and the prose has no id, so the one field a human actually reads was unauditable by construction. `claimId` 0 now addresses it, the auditor is told explicitly to check it against both the claims and the sources, and findings on it come back as `proseFindings`. The first run proved this gap: the prose asserted a finding was reached by four seats while its own claim attributions named three, and the loop passed it clean.
- **Rounds after the first are scoped.** Round 1 audits everything. Later rounds audit only what the previous round flagged plus any claim the summarizer rewrote, computed by diffing claim text between revisions. Verdicts accumulate in a map keyed by id, so narrowing cannot drop an unverifiable or contested item an earlier round found outside the new scope. On the first run's shape this is about 40 claim-audits instead of 102: three rounds cost 704k tokens to produce five catches, and 96 of the 102 audits were clean verdicts re-derived over and over.
- **`args.roundCap`** makes the cap explicit, defaulting to 3 and clamped to 1 through 5. The skill now warns against setting it to 1: with one round the loop audits and exits without revising, so the corrected claims are never produced, and the corrections were most of the first run's value.
- The revise prompt now forbids rewriting unflagged claims and warns against overcorrecting, because the first run's round 2 overcorrected a fix and round 3 had to restore the accurate half.
- The `working-with-panels` skill gains a rule with evidence attached: draft every downstream file from the corrected claims, never from the raw seat reports. A findings document written partly from the raw reports reintroduced three figures the loop had already corrected, which made the run worthless and took a second audit pass to discover.

## 0.1.0

Initial release. Packages the enforced summarize-audit loop for non-code councils:

- `working-with-panels` skill (front door + run logging)
- `panel-audit-loop` workflow (summarize → audit → revise, converge-or-3-round-cap)
- `panel-summarizer` agent (Opus) and `panel-auditor` agent (Fable)
- `audit-summary` `PostToolUse` hook backstop

Built and self-verified (dry-run of the loop control flow; hook JSON validated). Not yet run on a live council.
