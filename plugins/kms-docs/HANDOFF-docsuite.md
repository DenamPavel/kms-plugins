# docsuite design — pickup / handoff

Last updated: 2026-07-01

**Status: design plan drafted and under review. Paused for a Claude Code reboot to run a Sonnet 5 review.**

## What this is

Design work to expand `kms-docs` from a single-page documentation writer into a **multi-document project documentation pipeline**: point it at an app repo, and it produces the full doc set (user guide + maintainer/architecture doc + `AGENTS.md`) that gets any human or their agents up to speed. Must stay standalone for coworkers who don't have ed3d or `kms-human-voice`.

## The document

**`docs/design-plans/2026-07-01-docsuite.md`** (repo root `docs/`, committed). This is the artifact to review and finalize. It has: Summary (placeholder — pending), Definition of Done (confirmed), Acceptance Criteria (written, **not yet finally approved**), Glossary (placeholder — pending), Architecture, Existing Patterns, 8 Implementation Phases, Additional Considerations.

## Where we are in the workflow

Running `ed3d-plan-and-execute:starting-a-design-plan`. Completed: Phase 1 (context), Phase 2 (clarification), Phase 3 (DoD confirmed + file created), Phase 4 (brainstorming — design validated section by section). **Mid Phase 5 (Design Documentation):** body + ACs written; summary/glossary and final commit still pending. Phase 6 (planning handoff) after that.

## Decisions locked (all reflected in the design doc)

- **Doc set (v1 default):** user guide + maintainer/architecture doc + `AGENTS.md`. Ops/runbook and internal-API/reference deferred. Non-app *processes* out of scope for v1 but the mode table + surveyor taxonomy are the extension points.
- **Architecture:** thin project-layer orchestrator (`documenting-a-project` skill + `/document-project`) over a **mode-parameterized** per-doc engine (`documentation-pipeline` + `/write-doc` gain a `user-guide | maintainer | agents-md` mode; `user-guide` default is behavior-preserving).
- **Gate model:** 1 set gate + the existing 2 gates per doc. 3-doc run = 6 gates.
- **Mental model for the doc dependencies:** the internals *investigation* is the unit `AGENTS.md` depends on; the maintainer *doc* is an optional second consumer (Option C). One investigation behavior, no "shallow mode."
- **`AGENTS.md`:** distilled from internals grounding + extracted facts; signal-density enforced by machine-checkable disqualifiers (no line derivable from `cat package.json`; no advice true of every repo); `[TODO]` placeholders; single result gate; optional `CLAUDE.md` bridge with **syntax to be verified** (`@path` form, not `@import`).
- **Shared prose/voice fragment:** one in-plugin file referenced by both `writing-documentation` and `writing-internals` (no duplication; stays standalone).
- **Grounding artifact contract:** `<repo>/docs/.kms-run/internals-grounding.md`, gitignored, run-scoped, pinned schema incl. ✅/⚠️/🚫 boundary block; discarded at run end. Durable link is each doc's page-to-source map.
- **Ledger:** `<repo>/docs/.docsuite-ledger.md`, per-doc status, read-on-entry resume (skip `done`), failure blocks dependent docs.
- **Ask, don't guess:** safe-capture is an explicit question the surveyor asks; `capture.mjs` code-enforced assertion is the backstop.
- **Standalone verified:** no ed3d / no required `kms-human-voice` / no general-purpose agent in the current plugin; `node_modules` gitignored in both plugin and gitlab export, so mode-aware first-run `npm install` detection is correct.

## Review status

- **Opus 4.8** review: SOUND WITH CONCERNS.
- **Sonnet 4.6** review: NEEDS REWORK (severity framing; same findings as Opus).
- Both reviews' accepted findings are **already integrated** into the design doc (the "unchanged engine" reframing, the grounding-artifact contract, failure/resume + ledger, the AGENTS.md-without-maintainer path via Option C, machine-checkable signal-density rules, shared prose fragment, mode-aware npm detection, `@import` syntax caveat).
- **PENDING: Sonnet 5 review** (the reason for the reboot; CC needs updating to expose Sonnet 5).

## NEXT SESSION — do this

1. **Run the Sonnet 5 adversarial review** against `docs/design-plans/2026-07-01-docsuite.md`. Dispatch a `general-purpose` agent with `model: sonnet` (should resolve to Sonnet 5 after the CC update — confirm the model actually used). Use the same adversarial-review prompt shape as before: skeptical, verify claims against `plugins/kms-docs`, output VERDICT / TOP CONCERNS (ranked, with fixes) / SMALLER NOTES / WHAT'S MISSING. The prior two reviews already covered the obvious contract gaps, so ask Sonnet 5 to focus on what those missed.
2. **Integrate accepted findings** into the design doc (rewrite from intent, reject wrong findings).
3. **Get AC approval** from the operator (they had not formally approved when we paused).
4. **Generate Summary + Glossary** via a fresh-context subagent per the `writing-design-plans` skill, replace the placeholders.
5. **Commit the finalized design doc.**
6. **Phase 6 handoff:** give the operator the copy-then-`/clear`-then-`/ed3d-plan-and-execute:start-implementation-plan @docs/design-plans/2026-07-01-docsuite.md .` workflow.

## Notes

- The session-local review scratch file (`.../scratchpad/docsuite-design-for-review.md`) is gone after reboot; the design doc itself now carries everything, so re-review directly against the design doc.
- Minor: the design doc has em-dashes the phrasing hook flagged; do a prose cleanup pass before any external sharing (not needed for internal review).
- Delete this handoff once the design is finalized and handed to implementation planning.
