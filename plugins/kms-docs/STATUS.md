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

## How to run

Invoke `/write-doc` and give it the target page and source repo path. The pipeline runs ground → GATE 1 → draft → cross-model review → revise → GATE 2, then writes the page, updates the page-to-source map, and adds a code-to-docs note in the nearest `CLAUDE.md`. Record the result here.
