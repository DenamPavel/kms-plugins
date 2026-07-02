# docsuite Phases 6–8 — Human Test Plan

Generated after the final code review passed (branch `docsuite-phases-6-8`, HEAD `76ebfc5` at analysis time; docs added in a follow-up commit). Coverage validation against `docs/implementation-plans/2026-07-02-docsuite-phases-6-8/test-requirements.md`:

**Result: PASS** — all 22 in-scope ACs map to a verification; 18 covered (deterministic-automated + behavioral-fixture), 4 pending operator (human-verification, by design), 0 not covered.

`kms-docs` has no automated test runner **by design** (prompt-driven agents/skills/commands + a few Node/shell scripts). "No test runner" is not a coverage gap. Everything in the "Covered" tables was verified **in-session via trace agents and re-run scripts** because the new skill/agents are **not registered mid-session**. This plan lets an operator (a) discharge the human-verification items a person must perform, and (b) re-run the deterministic + behavioral checks against a **real registered plugin** — the only way the behavioral ones move from "traced" to "run for real."

## Coverage summary

| Bucket | Count | ACs |
|--------|-------|-----|
| Covered — deterministic-automated | 6 | AC6.2, AC7.2, AC5.6, AC4.2, AC6.4 (version/export half), AC5.2 (assertion half) |
| Covered — behavioral-fixture (traced in-session) | 12 | AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC5.1, AC5.2, AC5.3, AC5.4, AC5.5, AC6.1 (layers 1–2), AC6.3, AC7.1, AC3.2, AC3.5, AC4.3, AC4.7 |
| Pending operator — human-verification | 4 | AC6.1 layer 3 (clean-profile run), AC6.4 outward pushes, plus the human gates that back AC5.1/AC5.5/AC2.5/AC4.3/AC4.7 |
| Not covered | 0 | — |

## Prerequisites

- Repo: `/Users/kevinstarr/Documents/GitHub/kms-plugins/.worktrees/docsuite`, branch `docsuite-phases-6-8`.
- Node available (`node -v`; v22.x used in analysis).
- `claude` CLI available (`claude plugin validate .` should exit 0).
- Deterministic checks need no install (`standalone-check.sh` is pure shell; `agents-md-filter.mjs`/`capture.mjs` guard are pure JS).
- A real `/document-project` run requires the plugin to be **installed/enabled** in a Claude Code profile so `doc-surveyor` and the other agents/skills register.
- `plugins/kms-docs/scripts/node_modules` must remain **absent** before the AC6.3 first-run test (do not `npm install` until B1 tells you to).

## Section A — Re-run the deterministic checks (registered plugin not required)

| Step | Action (from repo root) | Expected |
|------|-------------------------|----------|
| A1 | `bash plugins/kms-docs/scripts/standalone-check.sh` | `standalone-check OK: …`, exit 0 (AC6.2 positive) |
| A2 | `TMP=$(mktemp -d); cp -R plugins/kms-docs "$TMP/kms-docs"; printf '\nDispatch the ed3d-research-agents:codebase-investigator agent.\nUse the kms-mcp-patterns skill.\n' >> "$TMP"/kms-docs/agents/agents-md-conventions.md; bash "$TMP/kms-docs/scripts/standalone-check.sh"; echo exit=$?; rm -rf "$TMP"` | `EXTERNAL REFERENCE:` for both injected lines, `standalone-check FAILED`, exit 1 (AC6.2 negative — proves detection, not always-pass) |
| A3 | `grep -n 'No safe-mode assertion defined; refusing to capture' plugins/kms-docs/scripts/capture.mjs` | Match at line 108 (AC7.2 guard string) |
| A4 | Read `plugins/kms-docs/scripts/capture.mjs` lines 104–114 | `assertSafeMode()` throws when `safeMode` absent or lacks `selector`/`hasText`/`js` (AC7.2 body) |
| A5 | `grep -ic ledger` on `documentation-pipeline/SKILL.md`, `writing-documentation/SKILL.md`, and the `write-doc` command | All 0 (AC5.6 — engine and `/write-doc` never touch the ledger) |
| A6 | Same grep on `documenting-a-project/SKILL.md` and `document-project` command | Non-zero — ledger owned by orchestrator only (AC5.6) |
| A7 | AC4.2 filter: build a manifest-values JSON of the 6 `fixture-agents-md-labels` `package.json` script values + a candidate `AGENTS.md` with those 6 lines plus one project-specific line; run `node plugins/kms-docs/scripts/agents-md-filter.mjs --agents-md <cand> --manifest-values <mv> --report r1.json` twice | Both runs: all 6 lines in `flaggedLines`, the project-specific line in `keptLines`, exit 1, `diff r1 r2` empty (determinism) |
| A8 | `node -e` parse of `plugin.json` + `marketplace.json`; `grep '## kms-plugins 1.9.0' CHANGELOG.md`; `claude plugin validate .`; `find plugins/kms-docs/scripts -name node_modules -type d` | plugin 2.2.0 / mkt-entry 2.2.0 / mkt 1.9.0; heading present; validate passes; find yields nothing (AC6.4 deterministic half) |

## Section B — Real registered-plugin run against `fixture-webapp`

Run in a profile where `kms-docs` is enabled. This converts the in-session traces into live runs.

**B1 — First-run detection (AC6.3), before any npm install.** Confirm `plugins/kms-docs/scripts/node_modules` is absent, then:
- `/write-doc <target> tests/docsuite-fixtures/fixture-webapp user-guide` → drive to Stage 1.5 with a non-empty capture plan. Expected: pipeline **stops** and prints the exact `(cd <plugin>/scripts && npm install)`, offering install-or-image-less.
- `/write-doc <target> tests/docsuite-fixtures/fixture-webapp maintainer` → **no** first-run check; proceeds.
- `/write-doc <target> tests/docsuite-fixtures/fixture-webapp agents-md` → **no** first-run check; proceeds.

**B2 — Full standalone pipeline (AC6.1 layer 2, live).** After choosing install or image-less, run `/document-project tests/docsuite-fixtures/fixture-webapp` through all three docs. Expected: every dispatched agent is bundled (`doc-surveyor`, `doc-investigator`/`doc-internals-investigator`, `doc-coverage-critic`/`doc-internals-critic`, `doc-writer`, `doc-editor`, `doc-reviser`, `doc-fact-checker`, `doc-screenshooter`, `doc-agents-md`); **no** external Task dispatch.

**B3 — Leak producer + consumer (AC3.5, AC4.7, live).** During B2's maintainer investigation, inspect `grounding.json` (under the orchestrator's `mktemp` scratch dir, outside the repo): its `invertedLeakList` must **contain** every planted secret/token/internal hostname in `tests/docsuite-fixtures/fixture-webapp/LABELS.md` (each with source path + kind) and must **not** list permitted architecture/module/table names. Then grep the generated `AGENTS.md` for each planted-secret string — expected: **zero** matches, in distilled sections and ✅/⚠️/🚫 boundary lines alike.

**B4 — Omitted-subsystem critic (AC3.2, live).** Run `/write-doc <target> tests/docsuite-fixtures/fixture-omitted-subsystem maintainer` (or dispatch `doc-internals-critic`) against a draft that omits the labeled subsystem. Expected: the critic flags exactly the subsystem named in that fixture's `LABELS.md`, checked against the grounding artifact's `machineryMap`, fabricating no omissions the map does not contain.

**B5 — AGENTS.md judgment filter (AC4.3, live).** Run the `doc-agents-md` distiller over `tests/docsuite-fixtures/fixture-agents-md-labels`. Expected: every Category-B generic-advice line in `LABELS.md` is **absent** from the gated file; non-obvious project-specific lines survive. (Model-judgment oracle, backed by the result gate.)

## Section C — Human gates during a live `/document-project` run (AC5.1, AC5.5, AC2.5, AC5.2, AC5.3, AC5.4, AC5.6)

Use a `git init`ed user-facing fixture (`fixture-webapp` works, or an ad-hoc one with real build/test/run scripts and ≥1 subsystem).

| Step | Action | Expected |
|------|--------|----------|
| C1 (AC5.1) | Drive `/document-project <fixture>` through the default 3-doc set, counting human gates | Exactly **6**: set gate + user-guide GATE 1 + user-guide GATE 2 + maintainer GATE 1 + maintainer GATE 2 + AGENTS.md single result gate |
| C2 (AC5.2) | After the run, inspect `<fixture>/docs/.docsuite-ledger.md` | Each doc advanced `pending → grounded`/`investigation-done → gate1-passed → drafted → gate2-passed → done`; file committed into `<fixture>/docs/`; `grounding.json` lived under a `mktemp` dir OUTSIDE the repo; scratch dir + lock gone after the run |
| C3 (AC5.5) | On a fresh run, at the set gate **correct** a build/test/run command so it differs from what the surveyor extracted; proceed through maintainer investigation + AGENTS.md | `$SCRATCH/set-gate-facts.md` carries the correction; generated `AGENTS.md` uses the **set-gate-corrected** command, not the investigation-derived one |
| C4 (AC2.5) | On a fresh `git init`ed fixture with no prior ledger, at the set gate **reject the entire set / cancel** | **No** `.docsuite-ledger.md` written, no doc created, lock released, scratch dir removed, `<repo>/docs/` removed if the orchestrator created it and it is now empty (repo left as found) |
| C5 (AC5.3) | Hand-edit the committed ledger between re-invocations and re-run `/document-project`: (a) set a doc to `done`; (b) set a maintainer doc to `investigation-done` after deleting its scratch `grounding.json`; (c) set a doc to `gate2-passed` | (a) done doc skipped, pipeline not re-run; (b) demoted to `pending` and re-investigated; (c) advanced to `done` and skipped without re-running the pipeline or re-asking gates |
| C6 (AC5.4) | Two controlled runs: (a) force the maintainer investigation to write **no valid** `$SCRATCH/grounding.json`; (b) write a schema-valid `grounding.json` but reject the maintainer doc at GATE 2 | (a) maintainer doc `investigation-failed`, **AGENTS.md halted** (`pending`, not distilled), independent user-guide doc still proceeds; (b) maintainer doc `doc-failed`, **AGENTS.md still runs**, distilling from the valid artifact |
| C7 (AC5.6, live) | Run a direct `/write-doc <target> <fixture> maintainer`; `stat`/`git status` the ledger path before and after | No change to `<fixture>/docs/.docsuite-ledger.md` (or still absent) — `/write-doc` neither creates nor modifies the ledger |

## Section D — Clean-profile end-to-end (AC6.1 layer 3) — the only true standalone proof

Set up a Claude Code profile where **only `kms-docs` is enabled** and both `ed3d-*` plugins and `kms-human-voice` are **disabled**. Run `/document-project tests/docsuite-fixtures/fixture-webapp` and drive the full 3-doc set to completion. Expected: the run **completes end to end** with no dispatched agent reaching for an external skill at runtime (a missing-skill error here would be the failure signal the static check cannot catch). Subsumes a live pass of B2 and C1–C2 under the stripped profile.

## Section E — Outward pushes (AC6.4) — perform last, on explicit confirmation

External and hard to reverse. Do these only after Sections A–D pass and intent is confirmed.

| Step | Action | Expected |
|------|--------|----------|
| E1 | Re-confirm the export sync into `~/Documents/GitHub/documentation-plugin`: `find … -name node_modules -type d` (no output), `git -C … status --porcelain \| grep -i node_modules` (none), export `claude plugin validate .`, and confirm `tests/docsuite-fixtures/` was **not** copied | All deterministic checks clean |
| E2 | `git push` the gitlab export to `origin main` | Push succeeds; remote reflects the 2.2.0 export |
| E3 | Merge/publish `master` of `kms-plugins` (marketplace 1.9.0) | Published |

## Traceability

| AC | Deterministic | Behavioral (traced in-session) | Live manual step |
|----|---------------|--------------------------------|------------------|
| AC2.1 / 2.2 / 2.3 / 2.4 / 7.1 | — | doc-surveyor traces | B2 (surveyor stage) |
| AC2.5 | ledger-absence post-run | reject mechanics | C4 |
| AC5.1 | — | 6-gate trace | C1 |
| AC5.2 | ledger-inspection assertion | ledger-state trace | C2 |
| AC5.3 | — | resume traces | C5 |
| AC5.4 | grounding.json schema-validity | failure-policy traces | C6 |
| AC5.5 | AGENTS.md command check | set-gate-facts trace | C3 |
| AC5.6 | A5 / A6 grep | — | C7 |
| AC6.1 | A1 (static) + agent enum | layers 1–2 traces | B2 + D |
| AC6.2 | A1 (pos) + A2 (neg) | — | — |
| AC6.3 | node_modules absence (A8) | first-run trace | B1 |
| AC6.4 | A8 + E1 | — | E2 / E3 |
| AC7.2 | A3 + A4 | — | — |
| AC3.2 | — | critic trace vs LABELS | B4 |
| AC3.5 | — | producer trace vs LABELS | B3 |
| AC4.2 | A7 (filter, ×2) | — | — |
| AC4.3 | — | distiller trace vs LABELS | B5 |
| AC4.7 | — | consumer trace vs LABELS | B3 |
