# Changelog

## [panel-audit] 0.2.1

Adds section 4b to `working-with-panels`: the claim ledger itself needs review, and
verifier runs need controls and isolation. All three items come from a measured run on
2026-09-09 in which a hand-built ledger's author produced more defects than any of the
three verifiers grading against it.

**New:**
- Require verifiers to report ledger defects as a first-class flags output: rows
  ambiguous between a true and false reading, misplaced mechanisms, mutually
  contradictory rows, and absolutes that invite a false rebuttal.
- Require planted control rows (a few false, at least one true-but-unclaimed) with
  answers the orchestrator established first, so rubber-stamping is measurable.
- Require per-verifier working directories, with seat reports, prior results, and any
  answer key kept outside the tree handed to verifiers.

## 0.2.0

The loop verified the wrong property. Every fix through 0.1.3 made a fidelity machine cheaper and better at being a fidelity machine, and fidelity was never the risk.

The premise is stated outright in the code that shipped: `panel-summarizer` was told "Add nothing no seat said," `revisePrompt` labelled the raw seat reports "ground truth for what the seats said," and the auditor's second focus tell was to check any characterization of what a seat "said, found, concluded" against the seat's own text. So the system guaranteed the summary faithfully represented the panel, and had no mechanism that could ask whether the panel was right.

**The traced failure, 2026-08-16.** A four-seat panel on an essay. The counter-case seat, running without research tooling, produced a list of seven practices that had supposedly made the aesthetic case for art status in print and lost. That list was the evidentiary center of its argument and it reached the deliverable intact. Checked afterward: two of seven hold. One had been admitted to documenta in 2007, one was partially admitted via a 2012 museum show, two never petitioned any art institution at all, and one was never a loss in any sense, having run its own internal art-versus-trade distinction since 1896. The loop rated the summary's description of that list clean, correctly: the summary described the seat accurately. Five of that run's seven findings were attribution corrections.

**The aggregate, across eleven logged runs.** 30 findings: 20 `overstated`, 5 `wrong`, 3 `unverifiable`, 2 `understated`. Most of the `overstated` verdicts were provenance bookkeeping ("Seat 4 did not say that," "Seat 3 said most careful, not strongest") inside a claims digest that existed only to be rewritten into a memo. Five of eleven runs never converged.

**Removed:**
- **`panel-summarizer` agent and `panel-audit-loop` workflow, both deleted.** The summarizer produced a disposable intermediate, and auditing it left the document that shipped unchecked. Section 4b of the old skill existed entirely to stop the chair reintroducing errors when drafting the real deliverable afterward, which is a rule made necessary by the architecture rather than by the problem.
- The `claims` / stable-ids / `sources` / `contested` machinery, the revision rounds, `roundCap`, scope narrowing, `pinUnflagged`, and the prose-as-claim-0 audit. All of it was scaffolding for auditing the intermediate.

**New:**
- **`run-panel` workflow.** Dispatches seats in parallel, each writing its full report to disk and returning only a 200-word headline plus its own list of checkable claims. Keeps the orchestrator context small and produces the claim ledger as a by-product: a seat already knows which of its assertions are checkable and which it was unsure about, so asking costs almost nothing and beats re-deriving the list later from the finished draft. Enforces the tooling gate at dispatch and surfaces `highRisk` claims (load-bearing, unchecked, from a seat with no tools), which is the exact shape of the traced failure.
- **`verify-claims` workflow.** Takes a finished deliverable, extracts its checkable empirical claims (facts, attributions, quantities, mechanism claims), groups them deterministically, and fans out tool-equipped verifiers in parallel. Single pass, no rounds. Takes a `run-panel` ledger directly, which skips extraction entirely; `draftPath` still extracts first, for hand-written documents and the hook backstop. Returns per-claim `confirmed` / `wrong` / `imprecise` / `unverifiable` with sources consulted, partitioned into `mustFix`. `scope` defaults to `load-bearing`, since a fact nobody's conclusion rests on is not worth a lookup, and `searchBudget` tells a verifier to report `unverifiable` rather than guess when it runs out. Load-bearing groups run first, so `maxClusters` truncates the claims whose falsity would not change the conclusion; anything dropped returns in `uncheckedByCap` rather than reading as coverage. A verifier that returns nothing marks its cluster `unverifiable`, never clean.
- **`claim-verifier` agent** (Sonnet, tool-equipped). Checks one cluster against the world. Carries the rule the old auditor lacked: an intermediate document is a claim, not a source, with attribution claims the sole exception.

**Measured, 2026-08-16.** Two runs of `verify-claims` over the same 2000-word memo, one unconstrained and one with the cost controls on.

| | no controls | controls on |
|---|---|---|
| tokens | 595,063 | 202,571 |
| tool calls | 250 | 41 |
| duration | 17 min | 4 min |
| evidence field | 1371 avg / 2641 max chars | 373 avg / 452 max |
| claims extracted | 56 | 20 |
| unverifiable | 1 of 26 (4%) | 3 of 12 (25%) |

Three times cheaper, and it cost real coverage. The constrained run missed two of the three genuine errors the unconstrained one found: one claim was never extracted under `extractCap`, and one came back `unverifiable` with the verifier stating that its search budget had run out. It also found one error the unconstrained run never reached, because the two caps truncated different claims. Neither run was complete, and the fixes below come from that comparison rather than from reasoning about it.

**Reuse, which is the real lever.** Budget caps buy cost by not looking, and the constrained run above proves it: three times cheaper, two real errors missed. The larger waste was never a verifier searching too hard, it was the pipeline redoing settled work. In the traced session the same facts (Eldagsen, Mario/MoMA, the Miller doctrine, the Colorado State Fair) were verified four separate times, because the panel's own evidence seat had checked them, cited URLs, and nothing downstream consumed the result. Three paths now run before anything is dispatched:

- **Duplicate claims collapse.** Two seats asserting the same fact is one lookup; every id still receives the verdict, tagged `duplicateOf`.
- **Prior verdicts are reused.** `priorVerdicts` carries verdicts from an earlier run and an unchanged claim is not re-checked. The workflow returns `verdictCache` to append; workflows have no filesystem access, so the chair does the I/O and the skill carries the snippet.
- **Seat-verified claims are inherited, not re-run.** A claim a tooled seat checked and cited sources for returns as `inherited`, a distinct verdict meaning nobody here checked it and a named seat with tools said it did. `run-panel` now requires seats to attach `sources` whenever they set `checked: true`, since a verification with no sources cannot be reused. A deterministic `spotCheckRate` sample (0.25) is re-verified anyway, and a failed spot-check condemns the whole inherited batch rather than the sampled claim alone, because a seat that cites one bad source has probably cited others. `trustSeats: false` disables inheritance.

`searchBudget` returns to 5 per claim now that reuse carries the load. An `inherited` claim is excluded from the unverifiable-rate denominator, since it was never independently checked and would otherwise flatter the rate.

**Tests.** `tests/reuse.test.mjs` stubs `agent()` and `parallel()` and runs the whole reuse and failure surface at zero token cost: duplicate collapse, prior-verdict reuse, inheritance and sampling, the untooled-seat exclusion, spot-check failure propagation, and dead-verifier fail-closed. 16 assertions, run with `node tests/reuse.test.mjs`.

**Tuned from the measurement:**
- **`searchBudget` is per claim (default 3), not per group.** Six lookups shared across a four-claim group is 1.5 per claim, which is what drove the unverifiable rate from 4% to 25%. A four-claim group now gets ~12.
- **A compound claim is `confirmed` only when every component is.** The constrained run returned `confirmed` on a two-part claim while its own evidence read "did not independently verify" the second part. Both the workflow prompt and the `claim-verifier` mandate now say a partially checked claim is `imprecise` or `unverifiable`, never confirmed, and must name the unchecked part.
- **The budget is a ceiling, not a target.** The verifier is told that an `unverifiable` verdict moves work to a human with less context, so hoarding lookups is a false economy.
- **A starved run announces itself.** An unverifiable rate above 15% logs a warning that the budget, rather than the sources, is the likely cause, and `unverifiableRate` is returned. Without it a starved run reads as clean to anyone looking only at the confirmed count.
- **`extractCap` (default 20) bounds extraction, with ranking instructions.** The first run pulled 56 claims from 2000 words, over half of them incidental. Compressed claims ("all", "none", "only N", "no X has ever") rank first, since they are the most confident and least checked assertions in any document. Supporting details merge into the claim they support.

**Changed:**
- **`panel-auditor` rewritten.** Same name, same Fable model, opposite mandate: it now fact-audits a finished document against the world rather than re-deriving a summary against the panel that produced it. Still the hook's backstop.
- **The skill leads with a gate it did not have.** A seat that will make empirical claims must have research tools; a seat without them holds a lens (structure, logic, craft) and marks every empirical assertion unverified. This alone would have prevented the traced failure.
- **The chair writes the deliverable directly from the seat reports.** No summarizing agent between the panel and the document.
- **Run-log schema replaced.** `changedTheDeliverable` records how many findings actually altered shipped text, which is the question the old schema could not answer: nine findings that change nothing is a run that cost tokens to reassure you. `seatsWithTools` against `seats` is the leading indicator for the new gate.
- `audit-summary` hook message repointed at `verify-claims` and the auditor's new mandate.

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
