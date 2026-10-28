# Changelog

## 1.2.0

The marketplace is licensed and its README covers all four plugins.

**New:**
- A root `LICENSE` (MIT). The README already claimed MIT, but no license file or manifest field backed it. Every `plugin.json` now declares `"license": "MIT"`.

**Changed:**
- The top-level README documents `kms-mcp-patterns` and `panel-audit`, which it previously omitted, and adds a requirements section.
- The marketplace description named panel-audit's summarize-audit loop, which 0.2.0 replaced. It now describes the two-stage fact-check.
- `plugins/kms-docs/README.md` states version 2.2.2, matching the manifest.

Plugin changes since 1.1.0 are recorded per release: `kms-docs` 2.2.2 (contrastive-framing tell), and `panel-audit` 0.2.0 and 0.2.1 in `plugins/panel-audit/CHANGELOG.md`.

## 1.1.0

Adds two plugins that existed locally but had never been pushed, and fixes a defect that made one of them non-functional.

**New:**
- `panel-audit` 0.1.1: enforced summarize-audit loop for multi-model councils on non-code work. An Opus summarizer collapses raw panel outputs into source-attributed claims; a Fable auditor re-derives each against primary sources; they loop until convergence or a 3-round cap, surfacing contested, unverifiable, and unresolved items for human adjudication. Ships the `working-with-panels` skill, the `panel-audit-loop` workflow, the `panel-summarizer` and `panel-auditor` agents, and an `audit-summary` `PostToolUse` hook backstop.
- `kms-mcp-patterns` 1.0.0: the `mcp-code-mode` skill, design patterns for building MCP servers.

**Fixed:**
- `panel-audit` dispatched its agents by bare name in both `workflows/panel-audit-loop.js` (lines 84, 95, 109) and `hooks/audit-summary.sh` (line 77). Plugin agents register namespaced, so the loop aborted at its first `agent()` call with "agent type not found" and ran zero rounds, and the hook backstop failed by the same cause. Both are now qualified as `panel-audit:panel-summarizer` and `panel-audit:panel-auditor`. Verified by an actual dispatch rather than a control-flow dry run, which is what let the defect ship in 0.1.0.
- `panel-audit`'s loop had no null guard on `agent()`, which returns null when a subagent dies on a terminal API error. A dropped auditor connection crashed the run, and the null then made `converged` compute to `true`, so a crashed audit would have been reported as a clean pass. The auditor now retries once, a second failure records an `AUDIT_FAILED` round, and `converged` is false whenever any agent failed.
- `panel-audit` never audited its own summary prose. The verdict schema requires an integer `claimId` and the prose field has no id, so the one part of the output a human reads could not be flagged. It is now audited as `claimId` 0 and returned as `proseFindings`. The first real run demonstrated the gap by passing a prose sentence that credited a finding to four seats when the claims named three.

**Changed:**
- `panel-audit` rounds after the first now audit only the claims the previous round flagged plus any claim the summarizer rewrote, rather than re-deriving all of them every round. Verdicts accumulate across rounds so nothing found earlier is dropped. Measured against the first real run, this is roughly 40 claim-audits instead of 102, where three rounds had cost 704k tokens to produce five catches. `args.roundCap` exposes the cap, default 3.

**Note:** `kms-docs` and `kms-human-voice` are unchanged apart from one comment in `standalone-check.sh` naming `kms-mcp-patterns` among the siblings its guard rejects. Its `FORBIDDEN` pattern matches `kms-[a-z]`, so `panel-audit` is a sibling the guard does not currently catch. Left as-is rather than widened, since that is a behavior change to the check.

## 1.0.0

First release of this marketplace. Ships two plugins:

- `kms-docs` 2.2.0: the DocSuite documentation pipeline. Ships the `writing-documentation`, `writing-internals`, and `agents-md-conventions` rulebooks; the `/write-doc` and `/document-project` commands; eleven bundled agents; Playwright screenshot capture with a demo-mode assertion; and the shared `prose-voice-rules` fragment.
- `kms-human-voice` 1.3.0: the prose rulebook and its two `PostToolUse` hooks (mechanical pattern check, intensity review agent).

Both plugins are self-contained and invoke no external plugin, skill, or agent.
