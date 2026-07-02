# Documentation coverage status

Tracks which apps have had a user guide generated through the `/write-doc` pipeline. Update this file whenever a run completes or a new app is added to the backlog.

Status values: **done** (page written, both gates passed), **in progress** (a run is underway), **needs review** (page written but awaiting human sign-off), **backlog** (not started).

## Completed

| App | Page | Source repo | Run date | Notes |
|-----|------|-------------|----------|-------|
| counts-builder | `docs/counts-builder-guide.md` | `i-360/analytics/political/counts-builder` (branch `dev`) | 2026-06-29 | End-user guide. Page-to-source map at `docs/page-to-source-map.md`; code-to-docs note in repo `CLAUDE.md`. Tags counts limited to AFP and NRA orgs. |
| media-hub | `docs/user-guide.md` (Campaign Tracker section) | `i-360/analytics/media-hub` (branch `dev`) | 2026-06-30 | Rewrote the Campaign Tracker section and added 6 screenshots across the guide (Campaign Tracker, Campaign Edits, Channel Report, MCode Editor); first run to exercise `doc-screenshooter`. Safe-capture recipe at `docs/_meta/safe-capture.md`. Human review passed; out for external review. New Campaign shot blocked by an app-level copy-from placeholder leak (see repo issue). |

## Backlog

Candidate app repos under `~/Documents/GitHub`. Triage column marks whether each is a user-facing app worth a guide; some are tooling or plugins that do not need one. Confirm before running.

| App | Has docs/ already | Triage | Notes |
|-----|-------------------|--------|-------|
| profile_builder | yes | app | Web app (client/server). Was the other candidate this session. |
| political-profiles | yes | app | |
| adsentryform | yes | app | |
| construction-heatmap | yes | app | |
| dmv-retention | yes | app | |
| voter-contact-planner | yes | app | |
| legal-timeline | yes | app | |
| Investability | yes | app | |
| building_products_indices | yes | app | |
| movers_metrics | no | app | No docs/ yet. |
| cffe-automation | yes | confirm | Automation tooling; may not need an end-user guide. |
| Demographics-Analysis-Claude | yes | confirm | Likely tooling. |
| data-science-apps-docs | yes | skip | The docs site itself, not an app. |
| clustering-segmentation | yes | skip | Plugin. |
| i360-branding | yes | skip | Plugin. |
| InsightEssayBot | yes | skip | Plugin. |
| claude-local-skills | yes | skip | Skills repo. |
| kms-plugins | yes | skip | This plugin marketplace. |

## Pipeline modes

As of the docsuite implementation (feature Phases 1–5, merged to `master` 2026-07-01), the pipeline is mode-parameterized. `/kms-docs:write-doc` takes an optional trailing `mode` argument (`user-guide` | `maintainer` | `agents-md`); omitting it defaults to `user-guide` and reproduces the original single-page behavior. An unrecognized mode is refused, not silently defaulted.

- **`user-guide`** (default) — a user-facing product page. Full flow with screenshots: ground → GATE 1 → capture → draft → cross-model review → revise → GATE 2.
- **`maintainer`** — a machinery/architecture doc. Grounds via `doc-internals-investigator` (schema-pinned grounding artifact + inverted leak list), writer/editor/reviser apply the `writing-internals` scope, no capture stage. GATE 1 → draft → review → revise → GATE 2.
- **`agents-md`** — a distilled `AGENTS.md`. Full internals investigation, no writer/editor/reviser and no coverage critic; `doc-agents-md` distills, a deterministic manifest-dedup filter runs, and a single result gate precedes writing. Optional `@AGENTS.md` `CLAUDE.md` bridge offered.

This ledger tracks `user-guide` runs against real apps. Feature Phases 6–8 (survey, `/document-project` multi-doc orchestration, release) shipped 2026-07-02; kms-docs is now at version 2.2.0.

## How to run

Invoke `/kms-docs:write-doc "<target> <repo-path> [mode]"`. For a user-guide page (no mode), the pipeline runs ground → GATE 1 → capture → draft → cross-model review → revise → GATE 2, then writes the page, updates the page-to-source map, and adds a code-to-docs note in the nearest `CLAUDE.md`. Record the result here. For `maintainer`/`agents-md` runs, see the mode descriptions above.
