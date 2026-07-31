# Changelog

## 0.1.1

Fixes unqualified agent names that made both the loop and its backstop non-functional. Found on the first live council run.

**Fixed:**
- `workflows/panel-audit-loop.js` dispatched bare `panel-summarizer` / `panel-auditor` at lines 84, 95, and 109. Plugin agents register namespaced, so the workflow aborted at the first `agent()` call with "agent type not found" before any round ran.
- `hooks/audit-summary.sh:77` instructed the same bare dispatch for `subagent_type: "panel-auditor"`, so the backstop failed by the same cause as the loop it was covering for.

**Note on how this survived 0.1.0:** the release was verified by dry-running the loop's control flow and validating the hook's JSON output. Neither check dispatches an agent, so the one defect that mattered was outside what the verification could see. A release check for this plugin needs at least one real `agent()` call.

## 0.1.0

Initial release. Packages the enforced summarize-audit loop for non-code councils:

- `working-with-panels` skill (front door + run logging)
- `panel-audit-loop` workflow (summarize → audit → revise, converge-or-3-round-cap)
- `panel-summarizer` agent (Opus) and `panel-auditor` agent (Fable)
- `audit-summary` `PostToolUse` hook backstop

Built and self-verified (dry-run of the loop control flow; hook JSON validated). Not yet run on a live council.
