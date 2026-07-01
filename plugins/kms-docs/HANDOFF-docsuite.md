# docsuite design — pickup / handoff

Last updated: 2026-07-01

**Status: design plan FINALIZED (2026-07-01). ACs approved by the operator; Summary + Glossary generated; committed. Next action is the Phase 6 implementation-plan handoff (below). Delete this handoff once that handoff is done.**

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
- **Standalone verified:** no ed3d / no required `kms-human-voice` / no general-purpose agent in the current plugin; `node_modules` gitignored in the plugin's `scripts/.gitignore` (confirmed). The gitlab export being `node_modules`-free is a release-time check, not yet verified, so mode-aware first-run `npm install` detection must be confirmed against the synced export.

## Review status

- **Opus 4.8** review: SOUND WITH CONCERNS.
- **Sonnet 4.6** review: NEEDS REWORK (severity framing; same findings as Opus).
- Both reviews' accepted findings are **already integrated** into the design doc (the "unchanged engine" reframing, the grounding-artifact contract, failure/resume + ledger, the AGENTS.md-without-maintainer path via Option C, machine-checkable signal-density rules, shared prose fragment, mode-aware npm detection, `@import` syntax caveat).
- **Sonnet 5 + Opus 4.8 second review (2026-07-01, post-reboot):** done. Sonnet 5 = SOUND WITH CONCERNS; Opus 4.8 = NEEDS REWORK. They found two load-bearing errors the first round missed: (1) `doc-editor`/`doc-reviser` hardcode `writing-documentation` and its surface-not-machinery scope, so calling them "mode-agnostic, shared as-is" was false — they must read the mode's scope rulebook; (2) the grounding artifact was claimed gitignored in the target repo but nothing gitignored it — relocated to the plugin scratch dir. Also: "machine-checkable disqualifiers" oversold (split into mechanical + judgment filters), "no shallow mode" now justified, facts-bundle source specified for the `AGENTS.md`-alone path, phase-split seam corrected, backward-compat sequenced into two steps, ledger ownership/failure-granularity/concurrency specified, internals-critic bounded to the artifact's machinery map, set-gate reject path added, monorepo + fixture work called out. **All accepted findings integrated into the design doc.**
- **Second review round (2026-07-01, on the revised doc):** fresh adversarial pair (Sonnet 5 = NEEDS REWORK, Opus 4.8 = SOUND WITH CONCERNS) + technical-editor pair (Sonnet + Opus). Adversarial pair found one major new error the first round and the first fix both missed: `doc-fact-checker` enforces the investigator's *user-guide* DO-NOT-LEAK list (`doc-fact-checker.md:17,24`), which is inverted under maintainer mode, so it would flag the whole maintainer doc as leaking — the fact-checker is not fully mode-agnostic. Also: the grounding-artifact "plugin scratch dir" was an invented mechanism (plugins run from a shared read-only root); fixed to an orchestrator-chosen path threaded into each dispatch, with run-id keying/cleanup called out as net-new. "No shallow mode" reframed from a false equivalence to an honest lower-bound + superset-schema + explicit scope choice. `agents-md` mode clarified (no writer/editor/reviser). Editors added AC1.6 (agents-md dispatch), AC4.6 citation in Phase 5, ledger enum/wording fixes, terminology consistency, and prose cleanups. **All accepted findings integrated (second revision).**
- **Leak-flow trace (2026-07-01, third fix):** followed the operator's hunch that the leak-model bug might extend past the fact-checker. It does. The leak set is two parts — the *model* (categories, defined by the scope rulebook) and the *list* (repo-specific instances, produced by the mode's investigator). The design had no producer for the maintainer-mode leak *list*: `doc-investigator` produces the DO-NOT-LEAK list in user-guide mode, but `doc-internals-investigator`'s schema only had the ✅/⚠️/🚫 agent-boundary block (a different artifact — agent-action permissions for AGENTS.md, not doc-prose leak control). Fixed: added an inverted leak list to the grounding-artifact schema and the internals investigator's output, kept distinct from the boundary block; made every consumer (writer/editor/reviser/fact-checker) read "the mode's leak list" instead of the hardcoded DO-NOT-LEAK/implementation-leak wording in their prompt bodies; added a maintainer GATE 1 presentation of the leak list symmetric with the user-guide GATE 1. ACs 1.2 and 3.4 updated to reference the investigation's leak list.
- **Leak-flow re-review (2026-07-01, fourth fix — Opus, targeted):** found four more gaps on the same fault line, all now fixed. (1) `doc-agents-md` emits a *committed* `AGENTS.md` but had zero leak coverage, and the leak list was scoped to "doc prose," structurally excluding it — added it as a leak consumer, broadened the leak-list definition to "any emitted artifact," added AC4.7. (2) The model/list split I introduced left the fact-checker with the *list* but not the *model*, degrading its leak check to string-matching — now every leak-aware consumer reads both model (categories) and list (instances). (3) The capture-plan leak producer was severed for maintainer/agents-md only by an empty-plan accident; now the capture stage + GATE 1 safe-capture negotiation are gated on mode explicitly. (4) No AC tested that the investigator *produces* the leak list (only consumption) — added AC3.5. Dispatch table, DoD, Phases 1/3/4/5/8 updated.
- **PENDING: AC approval** from the operator, then Summary + Glossary generation, then final commit. Note: four consecutive review rounds each found one adjacent gap on the leak/mode fault line; the fourth found four (one self-inflicted by the model/list split). The leak surface now appears fully enumerated (producers, consumers, model+list routing, producer+consumer ACs), but that is a judgment call, not a proof.

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
