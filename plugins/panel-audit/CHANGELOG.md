# Changelog

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
