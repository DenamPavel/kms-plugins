# docsuite Implementation Plan — Phase 5: `AGENTS.md` distillation flow

**Goal:** A gated `AGENTS.md` distilled from the internals grounding artifact plus its extracted facts. Content comes only from real investigation; a deterministic mechanical filter drops manifest-derivable lines; an opus judgment filter drops generic filler; human-judgment sections are `[TODO]` placeholders; the file passes a single result gate before being written; and an optional `CLAUDE.md` bridge (using the verified `@path` syntax) is offered, not forced. The standalone (`agents-md`-alone, no maintainer doc, no surveyor) path works via a full internals investigation whose extracted facts supply the commands.

**Architecture:** A new bundled agent `doc-agents-md` (opus, for the judgment filter) consumes the Phase 3 grounding artifact and assembles a conventional `AGENTS.md`. The deterministic mechanical filter is a new bundled Node script (`scripts/agents-md-filter.mjs`), sibling to `capture.mjs`, so AC4.2 is a real automated string check with a smoke test rather than model discretion. `doc-agents-md` invokes it via Bash. No writer/editor/reviser pass; the single result gate is the review. Under `/document-project` (Phase 7), set-gate corrections override investigation-derived facts on conflict; standalone, the investigation's facts stand.

**Tech Stack:** Claude Code plugin — a Markdown agent (opus) + one ESM Node script using only Node built-ins (`node:fs`, `node:util`, `node:path`; string-distance implemented inline). **No new npm dependency** (the existing `scripts/package.json` only has playwright; the filter does not need it). `AGENTS.md` is free-form Markdown per the cross-tool convention. Claude Code does not read `AGENTS.md` natively — the `@AGENTS.md` bridge is genuinely required for Claude Code users (verified against Claude Code 2.1.197).

**Scope:** Phases 1–5 of the 8-phase design (this plan). This is the last phase of this plan; Phases 6–8 (survey, project orchestration, release) are a separate later plan.

**Codebase verified:** 2026-07-01 via codebase-investigator against `plugins/kms-docs` v2.1.0; AGENTS.md convention and `@path` syntax verified via research (see below).

> **Verification model:** See phase_01.md. The mechanical filter is deterministic code and gets a real automated smoke test (success + failure paths, mirroring `capture.mjs`). The judgment filter and the assembled file are verified via subagent runs against a small ad-hoc labeled fixture; the durable hand-labeled fixture and formal standalone acceptance are Phase 8.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### docsuite.AC4: AGENTS.md is a non-generic, gated distillation
- **docsuite.AC4.1 Success:** Generated `AGENTS.md` contains build/test commands taken verbatim from the investigation's extracted facts and the ✅/⚠️/🚫 boundaries distilled from the investigation.
- **docsuite.AC4.2 Failure (mechanical):** Any line equal to a manifest field value (`package.json` script, `Makefile` target, etc.) after normalizing whitespace and case, or within a small fixed edit distance, is filtered out by a deterministic string check.
- **docsuite.AC4.3 Failure (judgment):** Advice that would hold for an arbitrary repo (generic filler) is rejected by the opus distiller and the result gate. This is a judgment oracle, tested against a fixture with hand-labeled must-reject lines, not a mechanical check.
- **docsuite.AC4.4 Success:** Human-judgment sections appear as `[TODO]` placeholders; the file passes through its result gate before being written.
- **docsuite.AC4.5 Success:** Requesting `AGENTS.md` without a maintainer doc runs a full internals investigation (not a shallow variant) + its own GATE 1 + result gate. Its build/test/run commands come from the investigation's extracted facts, so the standalone path needs no surveyor.
- **docsuite.AC4.6 Edge:** The optional `CLAUDE.md` bridge uses the syntax Claude Code actually supports (the `@path` form, verified against the installed Claude Code), and is offered, not forced.
- **docsuite.AC4.7 Failure:** For a fixture whose investigation surfaced a secret/internal hostname, `doc-agents-md` does not reproduce that instance in the generated `AGENTS.md`, in a distilled section or a ✅/⚠️/🚫 boundary line. (Leak coverage for the committed file, symmetric to AC3.4.)

---

## Reference: verified facts driving this phase

- **Bundled-script pattern** (`scripts/capture.mjs`): `#!/usr/bin/env node`, ESM (`"type": "module"`), imports from `playwright` + `node:fs`/`node:path`/`node:util`; arg parsing via `parseArgs` from `node:util` (`--spec`, `--out-dir`, `--manifest`); Node 16+; writes a JSON manifest; non-zero exit on refusal. `scripts/package.json`: name `kms-docs-capture`, only dep `playwright@^1.48.0`, no `scripts` section, `bin` maps `capture.mjs`. `scripts/.gitignore`: `node_modules/`, `package-lock.json`. Invoked from `capturing-screenshots/SKILL.md:58-59` as `node <plugin>/scripts/capture.mjs --spec … --out-dir … --manifest …`.
- **Grounding artifact** (Phase 3 pinned schema): `facts.{build,test,run}[]` (each `{command, source}`), `machineryMap[]`, `invertedLeakList[]` (`{instance, kind, sourcePath}`), `agentBoundaryBlock.{always,askFirst,never}[]`, plus the `writing-internals` leak model.
- **AGENTS.md convention** (verified): free-form Markdown, uppercase filename, repo root, nearest-ancestor discovery. Six conventional high-signal sections: Commands, Testing, Project Structure, Code Style, Git Workflow, Boundaries. Evidence: auto-generated/generic AGENTS.md *reduces* task success; useful files are specific, concise (<150 lines), pair prohibitions with alternatives, and contain only non-obvious project-specific guidance. This is the empirical basis for the two filters + `[TODO]` scaffolding + result gate.
- **`@path` (Claude Code 2.1.197, verified):** import syntax `@path/to/file`, resolves relative to the importing file, skipped inside backticks/code fences, recursive to depth 4. Claude Code does **not** read `AGENTS.md` natively; a `CLAUDE.md` with `@AGENTS.md` (or a symlink on macOS/Linux) is required. Doc: https://code.claude.com/docs/en/memory.md .

---

<!-- START_SUBCOMPONENT_A (tasks 1-2): the deterministic mechanical filter -->

<!-- START_TASK_1 -->
### Task 1: Implement the mechanical signal-density filter as a bundled Node script

**Verifies:** docsuite.AC4.2

**Files:**
- Create: `plugins/kms-docs/scripts/agents-md-filter.mjs`
- Modify: `plugins/kms-docs/scripts/package.json` (add a `bin` entry; no new dependency)

**Implementation:** A deterministic, dependency-light ESM script mirroring `capture.mjs`'s conventions (shebang, `parseArgs`, Node 16+, no external deps). Contract:
- **Inputs (argv):** `--agents-md <path>` (the drafted AGENTS.md), `--manifest-values <path>` (a JSON array of strings: every manifest field value the investigation extracted — `package.json` script command strings, `Makefile` target names, etc.; produced by `doc-agents-md` from `facts` and any raw manifest values), optional `--max-distance <n>` (default 2), optional `--report <path>` (JSON report out; default stdout).
- **Behavior:** For each non-empty, non-heading line of the AGENTS.md, normalize (trim, collapse internal whitespace, lowercase) and compare against each normalized manifest value. Flag the line as manifest-derivable if it is **equal** to a manifest value (exact match always applies, at any length), **or** within Levenshtein distance ≤ `max-distance` of one **AND both strings are at least `--min-fuzzy-len` characters long (default 8)**. The min-length guard on fuzzy matching prevents false positives where a short, genuinely non-obvious line coincidentally lands within edit distance 2 of a short manifest token (e.g. a 4–7 char command); short lines match only on exact equality. Implement Levenshtein inline (small DP; no dependency). Output a JSON report `{ flaggedLines: [{ line, lineNumber, matchedValue, distance, matchType: "exact"|"fuzzy" }], keptLines: [...] }`. Exit non-zero if any line was flagged (so the agent/gate must resolve them), matching `capture.mjs`'s "non-zero exit on refusal" convention.
- **Do not** mutate the AGENTS.md; the script reports, the agent decides. (Deterministic reporting; the agent removes flagged lines before the gate.)
- Guard: normalization must not strip so aggressively that distinct commands collide; keep it to trim + single-space + lowercase. Skip fenced code blocks? No — a manifest command duplicated inside a fenced block is still low-signal; but a legitimately-shown command example is allowed. Resolve: the filter reports; `doc-agents-md` keeps a command only where it is presented as a real, project-specific instruction (Commands/Testing sections), not as filler prose. Document this in the script header.
- Add a `bin` entry `"kms-docs-agents-md-filter": "./agents-md-filter.mjs"` to `package.json`. Do not add a dependency.

**Testing (AC4.2):** Covered by Task 2 (automated smoke test).

**Verification:** Deferred to Task 2.

**Commit:** `feat(kms-docs): add deterministic agents-md manifest-dedup filter script`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Smoke-test the mechanical filter (success + failure paths)

**Verifies:** docsuite.AC4.2

**Files:** none (verification task; ad-hoc inputs in the scratch dir)

**Verification steps (mirroring the `capture.mjs` smoke-test convention):**
1. **Flag path:** Write a tiny `AGENTS.md` with a line exactly equal to a manifest value (`npm run build`), a line within edit distance 1 (`npm run biuld`), and a genuinely non-obvious line ("The reducer must not emit a rollup before its window closes"). Write a `manifest-values.json` containing `["npm run build", "npm test", "make lint"]`. Run `node scripts/agents-md-filter.mjs --agents-md <f> --manifest-values <m>`. Expected: the exact-match and the distance-1 lines are flagged with their matched value; the invariant line is kept; exit code non-zero.
2. **Clean path:** Run the same script on an AGENTS.md containing only non-manifest lines. Expected: zero flagged lines, exit code zero.
3. **Short-line false-positive guard:** Include a short, legitimate, project-specific line (e.g. `make db`, 7 chars) alongside a short manifest value within edit distance 2 of it (e.g. `make db` vs a manifest `make cd`). Expected: the short line is NOT fuzzy-flagged (below `--min-fuzzy-len`), only exact matches on short lines flag. This proves the min-length guard prevents eroding the "deterministic" guarantee with coincidental short-token collisions.
4. **Determinism:** Run twice; identical report both times.

Expected: flag path flags exactly the two manifest-derivable lines and exits non-zero; clean path exits zero. Record the commands + output in working notes.

**Commit:** none (verification only).
<!-- END_TASK_2 -->

<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (tasks 3-6): the distiller and its gate -->

<!-- START_TASK_3 -->
### Task 3: Author `doc-agents-md` (the distiller)

**Verifies:** docsuite.AC4.1, docsuite.AC4.3, docsuite.AC4.4, docsuite.AC4.7

**Files:**
- Create: `plugins/kms-docs/agents/doc-agents-md.md`

**Implementation:** Mirror the bundled-agent shape. Frontmatter: `name: doc-agents-md`; `model: opus` (pinned, for the judgment filter); `tools: Read, Write, Grep, Bash, Glob` (Bash to run the mechanical-filter script; Write to emit the AGENTS.md into the scratch/working area; `Grep` for parity with the sibling agents and for the leak self-scan in step 6 and manifest-value collection in step 4; no Edit — the file is assembled fresh, then gated). Description: "Use when generating an `AGENTS.md` for a repo — distills the internals grounding artifact and its extracted facts into a conventional, non-generic AGENTS.md, applies a mechanical manifest-dedup filter and an opus generic-filler filter, inserts `[TODO]` placeholders for human judgment, and presents the file at a single result gate."

Body sections:
1. **Required reading** — the grounding artifact (with `facts`, `machineryMap`, `invertedLeakList`, `agentBoundaryBlock`) and the `writing-internals` leak model (read directly). Also the AGENTS.md conventions summary (Task 5 adds a short conventions note it reads, so the sections and quality bar are in-context without an external dependency).
2. **Assemble** — build the conventional sections (Commands, Testing, Project Structure, Code Style, Git Workflow, Boundaries) using:
   - **Commands/Testing:** build/test/run commands taken **verbatim** from `facts.{build,test,run}` (each with the confidence that it came from a manifest; flag any command the investigation could not verify). (AC4.1)
   - **Boundaries:** distill the `agentBoundaryBlock` ✅ always / ⚠️ ask-first / 🚫 never into concrete, project-specific lines. (AC4.1)
   - **Project Structure / Code Style:** distill from `machineryMap`; keep it specific and short.
3. **`[TODO]` placeholders (AC4.4):** for any section that needs human judgment the investigation cannot supply (e.g. team-specific review norms, deploy approvals), insert an explicit `[TODO: …]` placeholder rather than inventing generic advice.
4. **Mechanical filter (AC4.2):** after assembling, collect all manifest field values into a JSON array and run `node <plugin>/scripts/agents-md-filter.mjs --agents-md <draft> --manifest-values <values>`. Remove every flagged line (a line that merely restates a manifest value is noise). Re-run until the filter exits zero, or justify a kept line as a real project-specific instruction per the script's documented rule.
5. **Judgment filter (AC4.3):** as the opus distiller, reject any line that would hold for an arbitrary repo (generic filler: "write clean code", "follow best practices", "use descriptive names"). Keep only non-obvious, project-specific guidance. Where a prohibition is kept, pair it with the alternative ("don't X; do Y").
6. **Leak safety (AC4.7):** `AGENTS.md` is a committed file and a broad leak surface. Do **not** reproduce any `invertedLeakList` instance anywhere — not in a distilled section, not in a ✅/⚠️/🚫 boundary line (a boundary rule naming a real internal hostname is still a leak). Judge new sentences against the `writing-internals` leak model too, not just the list. When a boundary genuinely concerns a sensitive resource, phrase it generically ("never commit credentials for the production database") without naming the secret/hostname.
7. **Output** — the assembled `AGENTS.md` (to the scratch/working area, not committed yet) plus a short summary for the result gate: extracted commands (unverified ones flagged), the `[TODO]`s, the filter report, and the proposed optional `CLAUDE.md` bridge (Task 4).
8. **Constraints** — standalone posture (no external plugin/skill/agent; only the bundled filter script and bundled schema). Content comes only from the real investigation, never a template.

**Verification:** Deferred to Task 6.

**Commit:** `feat(kms-docs): add doc-agents-md distiller agent`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: Wire the `agents-md` result gate and the optional `CLAUDE.md` bridge

**Verifies:** docsuite.AC4.4, docsuite.AC4.6, docsuite.AC4.5 (gate half)

**Files:**
- Modify: `plugins/kms-docs/skills/documentation-pipeline/SKILL.md`

**Implementation:**
1. **Single result gate (AC4.4).** In the `agents-md` branch added in Phase 1, define the result gate: after `doc-agents-md` produces the file, present to the human — the drafted `AGENTS.md`, the extracted commands (with any unverified ones flagged), the `[TODO]` placeholders, the mechanical-filter report, and the proposed `CLAUDE.md` bridge. The file is **written/committed only after this gate passes**. There is no writer/editor/reviser pass and no coverage critic; this gate is the review.
2. **Optional `CLAUDE.md` bridge (AC4.6).** Offer — do not force — a thin `CLAUDE.md` at repo root that imports the AGENTS.md using the verified Claude Code syntax: a line reading `@AGENTS.md` (or `@./AGENTS.md`), NOT inside backticks (backticks suppress the import). State plainly that Claude Code does not read `AGENTS.md` natively, so without this bridge (or a symlink) Claude Code users get nothing; other tools read `AGENTS.md` directly. Present the bridge as a yes/no choice at the gate; if the human declines, write only `AGENTS.md`. If a `CLAUDE.md` already exists, offer to prepend the `@AGENTS.md` import rather than overwrite.
3. **Author the `agents-md`-mode GATE 1 branch (AC4.5) — this content exists nowhere until this step.** Phase 1 fenced the user-guide GATE 1 content to user-guide only and Phase 4 authored the maintainer GATE 1 branch; no phase yet writes GATE 1's presentation for `agents-md` mode, so a `mode=agents-md` run would otherwise reach GATE 1 with nothing to present. In the GATE 1 section of `documentation-pipeline/SKILL.md`, add: "**In `agents-md` mode**, GATE 1 presents the target, the investigation's inverted leak list, and the boundary/coverage scope (the ✅/⚠️/🚫 `agentBoundaryBlock` plus the `machineryMap` coverage, with source paths) — analogous to the maintainer branch, and with no capture/safe-capture plan. Get approval before distillation." Confirm the `agents-md`-alone path runs a **full** internals investigation (not a shallow variant), holds this GATE 1, then distills, then the result gate (step 1). The build/test/run commands come from the investigation's `facts`; no surveyor is involved. (This is the same GATE 1 an `agents-md` doc uses whether run standalone or, later, under `/document-project`.)
4. **Facts precedence note.** Add: "Under `/document-project` (Phase 7), set-gate corrections override investigation-derived facts on conflict. In a standalone `agents-md` run, the investigation's extracted facts stand." (The override mechanism itself is Phase 7; this note records the contract.)

**Verification:** Deferred to Task 6.

**Commit:** `feat(kms-docs): agents-md result gate and optional CLAUDE.md @path bridge`
<!-- END_TASK_4 -->

<!-- START_TASK_5 -->
### Task 5: Add an in-plugin AGENTS.md conventions note

**Verifies:** docsuite.AC4.1, docsuite.AC4.3 (supplies the quality bar in-context)

**Files:**
- Create: `plugins/kms-docs/agents/agents-md-conventions.md` (a short bundled reference the distiller reads)

**Implementation:** A concise, bundled note capturing the verified AGENTS.md convention so the distiller has the sections and the quality bar in-context without any external dependency: free-form Markdown, uppercase filename, repo root; the six conventional sections (Commands, Testing, Project Structure, Code Style, Git Workflow, Boundaries); keep it specific and concise (<150 lines); pair prohibitions with alternatives; include only non-obvious project-specific guidance; auto-generated/generic content hurts. Add `doc-agents-md`'s required-reading to name this file directly (Task 3 step 1 references it). Keep it a plain reference file (not a SKILL.md), read by path.

**Verification:** Deferred to Task 6.

**Commit:** `docs(kms-docs): add bundled AGENTS.md conventions reference for the distiller`
<!-- END_TASK_5 -->

<!-- START_TASK_6 -->
### Task 6: End-to-end standalone `agents-md` run against a labeled ad-hoc fixture

**Verifies:** docsuite.AC4.1, docsuite.AC4.3, docsuite.AC4.4, docsuite.AC4.5, docsuite.AC4.6, docsuite.AC4.7

**Files:** none (verification task; ad-hoc labeled fixture)

**Verification steps:** Build a small ad-hoc fixture repo with hand-labeled expectations (the ad-hoc analogue of the Phase 8 labeled fixture): a `package.json` with real `build`/`test` scripts, a planted secret + internal hostname, and a short list of **must-reject** generic lines (e.g. "write clean, maintainable code") to check the judgment filter. Run `/write-doc "<fixture> AGENTS.md" <fixture-path> agents-md` end to end:
1. **AC4.5:** confirm the run performs a **full** internals investigation (schema-valid artifact with populated `facts`), holds GATE 1, then the result gate — with no surveyor and no maintainer doc. Confirm it is not a shallow/template path.
2. **AC4.1:** the generated `AGENTS.md` contains the fixture's build/test commands **verbatim** from `facts`, and Boundaries lines distilled from the `agentBoundaryBlock`.
3. **AC4.2 (integration):** confirm `doc-agents-md` actually invoked `agents-md-filter.mjs` and removed any manifest-derivable line (seed the draft with a redundant `npm run build` prose line and confirm it is gone from the gated file).
4. **AC4.3:** confirm each hand-labeled must-reject generic line is absent from the gated file (rejected by the opus judgment filter); confirm non-obvious project-specific lines survive.
5. **AC4.4:** confirm human-judgment sections appear as `[TODO]` placeholders, and the file is written only after the result gate passes (verify nothing is committed to the fixture before the gate).
6. **AC4.7:** confirm the planted secret and internal hostname appear **nowhere** in the generated `AGENTS.md` — not in a distilled section, not in a boundary line. (Symmetric to AC3.4.)
7. **AC4.6:** confirm the `CLAUDE.md` bridge is offered as a choice, uses `@AGENTS.md` outside backticks, and is skipped if declined; if accepted and a `CLAUDE.md` exists, the import is prepended, not overwritten. **Verify the import against the installed Claude Code, not the researched fact** (the design requires "verified against the installed Claude Code"): run `claude --version` to record the actual installed version, then create a throwaway `CLAUDE.md` containing `@AGENTS.md` in a scratch repo alongside an `AGENTS.md` with a sentinel line, and confirm the installed Claude Code actually resolves the import (the sentinel reaches context) with the exact syntax the bridge emits. If the installed version's behavior differs from the 2.1.197 research finding (e.g. changed fence-skipping or path resolution), correct the emitted bridge syntax to match the installed version before shipping.

8. **Standalone-cleanliness grep (AC6.2, this phase's new files):** `grep -nE "ed3d|kms-human-voice|general-purpose" doc-agents-md.md agents-md-conventions.md scripts/agents-md-filter.mjs`. Expected: no matches — the distiller, its conventions reference, and the filter script invoke no external plugin/skill/agent. (The bundled cross-plugin static-check script is Phase 8; this is the ad-hoc per-phase analogue.)

Expected: all pass. If a generic line survives, tighten the judgment-filter wording in `doc-agents-md`; if a leak instance appears, tighten the AC4.7 leak-safety instruction; if the bridge uses backticked `@AGENTS.md`, fix per the verified syntax.

**Commit:** none (verification only).
<!-- END_TASK_6 -->

<!-- END_SUBCOMPONENT_B -->

---

**Dependencies:** Phase 3 (grounding artifact + schema + extracted facts). Runs after the maintainer doc when both are in the set; runs after a standalone internals investigation when alone. (Phase 1 already wired the `agents-md` routing.)

**Done when:** `AGENTS.md` is generated with non-obvious content, the mechanical filter drops manifest-derivable lines and the judgment filter drops generic advice on a labeled fixture, the distiller keeps leak-list instances out of the committed file (AC4.7), and the `CLAUDE.md` bridge uses verified syntax (AC4.1–AC4.4, AC4.6, AC4.7); the standalone (no-maintainer-doc, no-surveyor) path works via full investigation and investigation-supplied facts (AC4.5).
