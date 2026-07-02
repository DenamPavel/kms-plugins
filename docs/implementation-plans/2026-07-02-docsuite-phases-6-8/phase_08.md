# docsuite Phases 6–8 Implementation Plan — Phase 8: Standalone integrity, first-run setup, and release

**Goal:** Ship docsuite Phases 6–8: a bundled grep-based standalone check that proves no external plugin/skill/agent is invoked, durable curated fixtures that harden the Phase 3–5 leak/coverage ACs, mode-aware first-run `npm install` detection for the capture path, a standalone acceptance run, and the release (version bump + marketplace + CHANGELOG + gitlab export sync, `node_modules`-free).

**Architecture:** A POSIX-shell static check (`scripts/standalone-check.sh`, no npm dependency, so it runs standalone) greps the invoked pieces for external references, excluding the standalone-posture declaration sentences and `kms-docs` self-references. Durable fixtures live at repo-level `tests/docsuite-fixtures/` (outside `plugins/kms-docs/`, so they never ship in the plugin or the gitlab export). First-run detection is an instruction added to the capture path (`capturing-screenshots` skill + `documentation-pipeline` Stage 1.5), inherently mode-aware because Stage 1.5 only runs in `user-guide` mode. Release follows the marketplace release checklist: `plugin.json` → `marketplace.json` → `CHANGELOG.md`, validate, commit; then sync the gitlab export and verify it ships no `node_modules`.

**Tech Stack:** POSIX shell + grep (static check); markdown (skill/pipeline instruction edits, fixtures' docs); JSON (version files); the existing `scripts/` Node tooling is unchanged.

**Scope:** Phases 6–8 of the docsuite design; Phases 1–5 shipped on `master`.

**Codebase verified:** 2026-07-02 via codebase-investigator.

**Task ordering note:** the `executing-an-implementation-plan` harness dispatches tasks in numeric order. Fixtures are built in **Task 3** so that every task consuming them (Task 4 re-verification, Task 6 first-run verification, Task 7 standalone acceptance run) comes after they exist. Do not reorder.

**Key grounding facts (verified):**
- No standalone check exists yet; it is written here (`HANDOFF-docsuite.md:52,54`). The lines carrying a forbidden token that must be excluded as standalone-posture *declarations* are `doc-internals-investigator.md:79` ("You invoke no external plugin, skill, or agent. No `ed3d-*`, `kms-*`…") and `documentation-pipeline/SKILL.md:26` ("no other plugin and no general-purpose agent…"), plus the two new declaration lines in the Phase 6/7 files. Note: `doc-agents-md.md:61` declares standalone posture too but contains **no** forbidden token, so it never triggers the check and needs no exemption.
- `plugins/kms-docs/scripts/`: `package.json` (dep `playwright ^1.48.0`), `capture.mjs`, `agents-md-filter.mjs`. `node_modules/` is **ABSENT** (correct). `scripts/.gitignore` excludes `node_modules/` and `package-lock.json`.
- `capture.mjs` `assertSafeMode()` (function spanning ~lines 104-114) throws when the safe-mode assertion is absent; the guard string ("No safe-mode assertion defined; refusing to capture.") is at ~line 108. This is the AC7.2 backstop, unchanged by this work; Task 8 confirms no regression.
- First-run detection does NOT exist. `capturing-screenshots/SKILL.md:16-18` documents the dependency in prose only. Stage 1.5 (capture) already runs only in `user-guide` mode (`documentation-pipeline/SKILL.md:88-90`), so detection placed there is mode-aware for free.
- Version surfaces: `plugins/kms-docs/.claude-plugin/plugin.json:3` = `2.1.0`; root `.claude-plugin/marketplace.json` top-level marketplace `version` = `1.8.0` (line ~4) and its `kms-docs` plugin entry `version` = `2.1.0` (line ~19); root `CHANGELOG.md` entries are headed `## kms-plugins X.Y.Z` (verified: `## kms-plugins 1.8.0`, `## kms-plugins 1.7.0`).
- gitlab export: `~/Documents/GitHub/documentation-plugin` (remote `git@gitlab.com:i-360/analytics/commercial/tools/documentation-plugin.git`, branch `main`). It has its **own** marketplace versioning (currently `1.1.0`) and its own `CHANGELOG.md`; its `kms-docs` plugin.json is at `2.1.0`. `node_modules` ABSENT there; `scripts/.gitignore` present. Sync is manual (no sync script found).
- Durable fixtures do NOT exist. Only an ad-hoc testbed at `~/Documents/GitHub/docsuite-testbed/fixture-app/` (outside repo) was used to verify Phases 1–5 (`docs/implementation-plans/2026-07-01-docsuite/test-requirements.md:11`). Phase 8 builds durable versions under repo-level `tests/docsuite-fixtures/`.
- `agents-md-filter.mjs` is the mechanical manifest-line filter `doc-agents-md` uses (`doc-agents-md.md` references it).
- Release conventions (`ed3d-extending-claude:maintaining-a-marketplace`): bump `plugin.json` then the matching `marketplace.json` entry to the SAME value, add a `CHANGELOG.md` entry, `claude plugin validate .`, single commit for all sync files. Verify `plugin.json` version == `marketplace.json` entry version.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### docsuite.AC6: Standalone integrity and first-run setup
- **docsuite.AC6.1 Success:** The full pipeline runs with only `kms-docs` installed (no ed3d, no `kms-human-voice`).
- **docsuite.AC6.2 Failure:** A bundled grep-based static check (written as part of this work, not assumed) finds no invocation of any external plugin, skill, or general-purpose agent from the new pieces.
- **docsuite.AC6.3 Success:** First-run `npm install` detection fires only when a capture stage is in scope, and prints the exact command; it does not fire for `maintainer`/`agents-md`.
- **docsuite.AC6.4 Success:** `kms-docs` and the marketplace are version-bumped, and the gitlab export is synced and confirmed to ship no `node_modules`.

### docsuite.AC7: Cross-cutting — ask, don't guess
- **docsuite.AC7.2 Failure:** `capture.mjs` still refuses any shot whose safe-mode assertion is absent (code-enforced backstop retained).

### Re-verified with durable fixtures (owned/completed in Phases 3–5; hardened here)
- **docsuite.AC3.2** (internals critic flags an omitted subsystem), **docsuite.AC3.5** (investigator emits an inverted leak list containing a planted secret), **docsuite.AC4.2** (mechanical manifest-line filter), **docsuite.AC4.3** (judgment filter rejects generic advice), **docsuite.AC4.7** (`doc-agents-md` keeps leak-list instances out of the committed `AGENTS.md`). These were verified in Phases 1–5 against *ad-hoc* fixtures; Phase 8 supplies the *durable, hand-labeled* fixtures the design requires and re-confirms each, because "each AC depends on the fixture being correct, not merely present."

---

<!-- START_SUBCOMPONENT_A (tasks 1-2) -->

<!-- START_TASK_1 -->
### Task 1: Write the bundled standalone static check

**Verifies:** docsuite.AC6.2 (deliverable; tested in Task 2)

**Files:**
- Create: `plugins/kms-docs/scripts/standalone-check.sh` (executable)

**Implementation:**

Create the script with this content, then `chmod +x` it. It scans only the *invoked* pieces (agents, skills, commands, scripts), not the maintainer notes at plugin root (`HANDOFF-*.md`, `STATUS.md`). It excludes itself, the standalone-posture declaration sentences, and `kms-docs` self-references, while catching `ed3d-*`, the generic-agent fallback, and **any** `kms-*` sibling plugin.

```bash
#!/usr/bin/env bash
# standalone-check.sh — assert kms-docs invokes no external plugin/skill/agent.
# Scans the invoked pieces (agents, skills, commands, scripts). Exit 0 = clean, 1 = external reference.
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"   # -> plugins/kms-docs

# Invoked pieces only. HANDOFF-*.md and STATUS.md (plugin-root maintainer notes) are not invoked, so not scanned.
ROOTS=("$PLUGIN_DIR/agents" "$PLUGIN_DIR/skills" "$PLUGIN_DIR/commands" "$PLUGIN_DIR/scripts")

# Forbidden: other ed3d plugins/agents, the generic-agent fallback, and ANY kms-* sibling.
# kms-docs self-references are stripped before the re-test below, so only siblings (kms-human-voice,
# kms-mcp-patterns, any future kms-*) trip it.
FORBIDDEN='ed3d-|general-purpose|kms-[a-z]'

# Standalone-posture declaration sentences are ALLOWED to name the forbidden tokens (as things NOT invoked).
ALLOW='invokes? no|no external|no other plugin|no general-purpose|not a generic|standalone posture|no cross-plugin|without ed3d'

fail=0
files=()
while IFS= read -r f; do files+=("$f"); done < <(
  find "${ROOTS[@]}" \
    -type d -name node_modules -prune -o \
    \( -name '*.md' -o -name '*.mjs' -o -name '*.sh' \) -type f -print \
  | grep -v '/standalone-check.sh$'
)

for f in "${files[@]}"; do
  while IFS= read -r hit; do
    # hit = "path:lineno:content"
    content="${hit#*:}"; content="${content#*:}"
    # Allow standalone-posture declarations.
    printf '%s' "$content" | grep -qiE "$ALLOW" && continue
    # Strip allowed kms-docs self-references, then re-test the residual.
    residual="$(printf '%s' "$content" | sed 's/kms-docs//g')"
    printf '%s' "$residual" | grep -qiE "$FORBIDDEN" || continue
    echo "EXTERNAL REFERENCE: $hit"
    fail=1
  done < <(grep -nHE "$FORBIDDEN" "$f" || true)
done

if [ "$fail" -ne 0 ]; then
  echo "standalone-check FAILED: external references found above." >&2
  exit 1
fi
echo "standalone-check OK: no external plugin/skill/agent invocations in the bundled pieces."
```

**Verification:**

Run: `chmod +x plugins/kms-docs/scripts/standalone-check.sh && plugins/kms-docs/scripts/standalone-check.sh`
Expected: exits 0 and prints `standalone-check OK: …` against the current tree (all agents/skills/commands/scripts, including the new `doc-surveyor`, `documenting-a-project`, and `document-project`, are clean or excluded; `kms-docs:` self-references and declaration sentences do not trip it).

If it reports a false positive on a standalone-posture declaration, tune the `ALLOW` pattern to match that sentence's stable wording (Task 2's negative test is the oracle) — do not weaken `FORBIDDEN`.

**Commit:** `feat(kms-docs): add bundled standalone static check`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Test the standalone check (positive + negative) (AC6.2)

**Verifies:** docsuite.AC6.2

**Implementation / test procedure:**

The check needs real negative cases, not just a passing tree:

1. **Positive (clean tree):** run `plugins/kms-docs/scripts/standalone-check.sh`; confirm exit 0 and the OK message.
2. **Negative — ed3d invocation:** copy the plugin to a scratch dir (`cp -r plugins/kms-docs "$(mktemp -d)/kms-docs-dirty"`), then in the copy append a genuine external invocation to one agent body: `Dispatch the ed3d-research-agents:codebase-investigator agent to help.` (a real invocation, NOT a negation). Run the copy's check; confirm it **exits 1** and prints the injected line.
3. **Negative — kms-* sibling:** in the same dirty copy, append `Use the kms-mcp-patterns skill for guidance.` to another agent body. Run the check; confirm this line is ALSO flagged (proving the broadened `kms-*` coverage works and that `kms-docs` self-refs elsewhere in the file are NOT flagged).
4. Discard the scratch copy.

**Testing:**
- **docsuite.AC6.2:** the check passes on the clean tree and fails on both a planted `ed3d-*` invocation and a planted `kms-*` sibling reference — proving it detects, not merely always-passes, and covers the full external surface.

**Verification:** Positive run clean; both negative injections flagged. If either negative case does not fail, the `FORBIDDEN`/`ALLOW`/strip logic is wrong — fix Task 1's script.

**Commit:** none (test only; the scratch copy is discarded).
<!-- END_TASK_2 -->

<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (tasks 3-4) -->

<!-- START_TASK_3 -->
### Task 3: Build the durable curated fixtures

**Verifies:** docsuite.AC3.2, docsuite.AC3.5, docsuite.AC4.2, docsuite.AC4.3, docsuite.AC4.7 (via durable fixtures; tested in Task 4), and supplies the runnable app for docsuite.AC6.1 (Task 7) and docsuite.AC6.3 (Task 6)

**Files (create under repo-level `tests/docsuite-fixtures/`, which is NOT under `plugins/kms-docs/` and so never ships in the plugin or the gitlab export):**
- Create: `tests/docsuite-fixtures/README.md` — explains these are load-bearing test fixtures for docsuite ACs, and how each maps to an AC.
- Create: `tests/docsuite-fixtures/fixture-webapp/` — a **runnable** app with a safe/demo mode (for capture, AC6.1/AC6.3), a clear machinery map (a data-flow across ≥2 modules), and a **planted secret + token + internal hostname** in a realistic location (for the leak producer/consumer tests AC3.5/AC4.7). Include a `LABELS.md` listing the exact planted-secret strings that must never appear in any emitted artifact.
- Create: `tests/docsuite-fixtures/fixture-omitted-subsystem/` — an app whose machinery includes a subsystem that is **deliberately left undocumented** relative to an included draft, so the internals critic has a known omission to flag (AC3.2). Include a `LABELS.md` naming the subsystem that must be flagged.
- Create: `tests/docsuite-fixtures/fixture-agents-md-labels/` — a small repo with real manifest scripts (so manifest-derivable lines exist) plus a `LABELS.md` of **hand-labeled must-reject `AGENTS.md` lines**: (a) lines equal to a manifest field value (mechanical filter, AC4.2) and (b) generic advice that would hold for any repo (judgment filter, AC4.3).

**Implementation:**

Build three distinct fixtures (the design lists four bullets; the runnable app doubles as the capture app AND the planted-secret app, giving three builds). Each fixture is small but real: actual manifests with actual commands, actual source modules, and a `LABELS.md` that is the test oracle. The fixtures must be correct, not merely present — a wrong oracle silently passes a broken filter.

Because `tests/docsuite-fixtures/` lives at the repo root, outside `plugins/kms-docs/`, it is structurally excluded from the gitlab export sync (Task 10's rsync source is `plugins/kms-docs/`). No extra exclude flag is needed; Task 10 only confirms it stayed out.

**Verification:**

Run: `ls tests/docsuite-fixtures/ && for d in fixture-webapp fixture-omitted-subsystem fixture-agents-md-labels; do test -f "tests/docsuite-fixtures/$d/LABELS.md" && echo "$d ok"; done`
Expected: all three fixtures exist with a `LABELS.md` oracle.

Run (fixture-webapp is runnable): follow its README to build/run it and confirm the safe/demo mode renders no real data.

**Commit:** `test(kms-docs): add durable docsuite fixtures (webapp, omitted-subsystem, agents-md-labels)`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: Re-verify Phase 3–5 leak/coverage ACs against the durable fixtures

**Verifies:** docsuite.AC3.2, docsuite.AC3.5, docsuite.AC4.2, docsuite.AC4.3, docsuite.AC4.7

**Implementation / test procedure:**

Run the already-shipped agents against the durable fixtures and check each against its `LABELS.md` oracle:

1. **AC3.5 (producer):** dispatch `doc-internals-investigator` on `fixture-webapp`; confirm its `invertedLeakList` in `grounding.json` contains the planted secret/token/internal hostname from `LABELS.md` and does NOT list permitted architecture/module names.
2. **AC4.7 (consumer):** run the `agents-md` flow on `fixture-webapp`; confirm the generated `AGENTS.md` reproduces none of the `LABELS.md` planted-secret strings, in a distilled section or a ✅/⚠️/🚫 boundary line.
3. **AC3.2:** with `fixture-omitted-subsystem`, run `doc-internals-critic` against a draft that omits the labeled subsystem; confirm it flags that subsystem (checked against the grounding artifact's enumerated machinery map).
4. **AC4.2 (mechanical):** run `scripts/agents-md-filter.mjs` (the mechanical filter) over `fixture-agents-md-labels`; confirm every manifest-equal line in `LABELS.md` is dropped. (Note: `agents-md-filter.mjs` requires `node`; the plugin's `scripts/` uses Node — no npm install is needed for this pure-JS filter unless it imports a dependency, in which case run `npm install` in `scripts/` first.)
5. **AC4.3 (judgment):** run the `doc-agents-md` distiller over `fixture-agents-md-labels`; confirm the generic-advice lines in `LABELS.md` are rejected and do not reach the result gate.

**Testing:** each AC passes against its durable oracle.

**Verification:** For each of the five, compare output to the fixture's `LABELS.md`. Any miss means either the fixture oracle is wrong (fix the fixture) or a Phase 3–5 agent regressed (fix the agent). Record results.

**Commit:** none (verification only; fixes, if any, commit under their own message).
<!-- END_TASK_4 -->

<!-- END_SUBCOMPONENT_B -->

<!-- START_SUBCOMPONENT_C (tasks 5-6) -->

<!-- START_TASK_5 -->
### Task 5: Add mode-aware first-run `npm install` detection

**Verifies:** docsuite.AC6.3 (deliverable; tested in Task 6)

**Files:**
- Modify: `plugins/kms-docs/skills/capturing-screenshots/SKILL.md` (add a first-run dependency-check instruction near the existing `## Dependency` heading at line 16)
- Modify: `plugins/kms-docs/skills/documentation-pipeline/SKILL.md` (wire the check into Stage 1.5, the capture stage, so it runs before any capture is attempted)

**Implementation:**

1. In `capturing-screenshots/SKILL.md`, after the existing `## Dependency` prose, add a `## First-run dependency check` section:

```markdown
## First-run dependency check

Before running the capture script, check whether Playwright is installed:

    test -d "<this plugin>/scripts/node_modules"

If `node_modules` is **absent**, stop and present the exact command to install it:

    (cd "<this plugin>/scripts" && npm install)

Then offer the runner two choices, and do not proceed until they pick:

1. Install now (run the command above), then continue with screenshots.
2. Proceed **image-less**: skip the capture stage entirely and produce the doc without screenshots.

This check runs only when a capture stage is in scope — that is, `user-guide` mode with a non-empty capture plan. It never runs in `maintainer` or `agents-md` mode, which produce no capture plan.
```

2. In `documentation-pipeline/SKILL.md`, at the start of Stage 1.5 (the capture stage, which already runs only in `user-guide` mode with a non-empty capture plan per `SKILL.md:88-90`), add a first line instructing: run the first-run dependency check from the `capturing-screenshots` skill before dispatching `doc-screenshooter`; if `node_modules` is absent, follow that skill's stop-and-offer procedure (install, or proceed image-less by skipping Stage 1.5).

**Verification:**

Run: `grep -n 'First-run dependency check' plugins/kms-docs/skills/capturing-screenshots/SKILL.md`
Expected: the new section is present.

Run: `grep -ni 'first-run' plugins/kms-docs/skills/documentation-pipeline/SKILL.md`
Expected: Stage 1.5 references the first-run check.

**Commit:** `feat(kms-docs): mode-aware first-run npm install detection for capture`
<!-- END_TASK_5 -->

<!-- START_TASK_6 -->
### Task 6: Verify first-run detection is mode-aware (AC6.3)

**Verifies:** docsuite.AC6.3

**Implementation / test procedure:**

Precondition: `plugins/kms-docs/scripts/node_modules` is ABSENT (confirm with `test -d … && echo EXISTS || echo ABSENT`). Do NOT run `npm install` for this test.

1. **Fires for user-guide capture:** run `/write-doc <target> tests/docsuite-fixtures/fixture-webapp user-guide` (or via `/document-project`) far enough to reach Stage 1.5 with a non-empty capture plan. Confirm the pipeline **stops and prints the exact command** `(cd <plugin>/scripts && npm install)` and offers install-or-image-less.
2. **Does not fire for maintainer:** run `/write-doc <target> tests/docsuite-fixtures/fixture-webapp maintainer`. Confirm the first-run check **does not fire** (no capture stage) and the run proceeds.
3. **Does not fire for agents-md:** run `/write-doc <target> tests/docsuite-fixtures/fixture-webapp agents-md`. Confirm no first-run check fires.

**Testing:**
- **docsuite.AC6.3:** detection fires only in the `user-guide` capture path, prints the exact command, and never fires for `maintainer`/`agents-md`.

**Verification:** Confirm the three behaviors. If detection fires in maintainer/agents-md, the check is mis-placed (must be inside Stage 1.5, not earlier); fix Task 5.

**Commit:** none (verification only).
<!-- END_TASK_6 -->

<!-- END_SUBCOMPONENT_C -->

<!-- START_TASK_7 -->
### Task 7: Standalone acceptance run — full pipeline, kms-docs only (AC6.1)

**Verifies:** docsuite.AC6.1

**Implementation / test procedure:**

AC6.1 asserts the full pipeline runs with only `kms-docs` installed. Three layers of evidence, all required for sign-off:

1. **Static guarantee:** Task 1's check passing (no external references in the invoked pieces) is the standing static proof.
2. **Functional guarantee:** run `/document-project` on `tests/docsuite-fixtures/fixture-webapp/` (built in Task 3) through all three docs, and confirm every dispatched agent is a **bundled** one (`doc-surveyor`, `doc-investigator`/`doc-internals-investigator`, `doc-coverage-critic`/`doc-internals-critic`, `doc-writer`, `doc-editor`, `doc-reviser`, `doc-fact-checker`, `doc-screenshooter`, `doc-agents-md`) — no external Task dispatch, no `kms-human-voice`, no general-purpose fallback.
3. **Clean-profile run (REQUIRED — this is the only true end-to-end standalone proof):** repeat the functional run in a Claude Code profile where only `kms-docs` is enabled (ed3d and kms-human-voice disabled). Confirm it completes the 3-doc run end-to-end. Do not treat this as optional; the static check and agent-enumeration are proxies, and only the clean-profile run proves no dispatched agent reaches for an external skill at runtime.

**Testing:**
- **docsuite.AC6.1:** the pipeline completes the 3-doc run using only bundled agents, confirmed by the static check, the agent-dispatch record, AND a clean-profile end-to-end run.

**Verification:** Record which agents were dispatched during the run and confirm all are bundled; record that the clean-profile run completed. Depends on Task 3 (the runnable fixture), which precedes this task.

**Commit:** none (verification only).
<!-- END_TASK_7 -->

<!-- START_TASK_8 -->
### Task 8: Confirm the capture.mjs safe-mode backstop is retained (AC7.2)

**Verifies:** docsuite.AC7.2

**Implementation / test procedure:**

1. Run: `grep -n 'No safe-mode assertion defined; refusing to capture' plugins/kms-docs/scripts/capture.mjs`
   Expected: the guard string (~`capture.mjs:108`) is present and unchanged.
2. Read the `assertSafeMode()` function (~`capture.mjs:104-114`) and confirm it still throws when `safeMode` is absent or has none of `selector`/`hasText`/`js`.

**Testing:**
- **docsuite.AC7.2:** the code-enforced backstop still refuses any shot whose safe-mode assertion is absent. (No behavior change is introduced by Phases 6–8; this is a no-regression confirmation.)

**Verification:** guard present and intact.

**Commit:** none (confirmation only).
<!-- END_TASK_8 -->

<!-- START_TASK_9 -->
### Task 9: Version bump + marketplace + CHANGELOG (AC6.4, part 1)

**Verifies:** docsuite.AC6.4 (version bump + marketplace)

**Files:**
- Modify: `plugins/kms-docs/.claude-plugin/plugin.json` — `version` `2.1.0` → `2.2.0`
- Modify: `.claude-plugin/marketplace.json` — the `kms-docs` plugin entry `version` `2.1.0` → `2.2.0` (must match `plugin.json`), and the top-level marketplace `version` `1.8.0` → `1.9.0`
- Modify: `CHANGELOG.md` (repo root) — add an entry at the top

**Implementation:**

1. Bump `plugin.json` version to `2.2.0` (minor: new `/document-project` orchestration, `doc-surveyor`, standalone check, first-run detection — additive, backward-compatible with existing `/write-doc`).
2. Update the `kms-docs` entry in `marketplace.json` to `2.2.0` and the top-level marketplace version to `1.9.0`.
3. Add a `CHANGELOG.md` entry matching the repo's actual heading convention `## kms-plugins X.Y.Z`:

```markdown
## kms-plugins 1.9.0

kms-docs 2.2.0 — docsuite project documentation pipeline (Phases 6–8).

**New:**
- `/document-project` command and `documenting-a-project` skill: survey a repo, approve the doc set at one set gate, then run the per-doc engine for the user guide, maintainer doc, and `AGENTS.md`, with a committed per-project ledger, resume, run-scoped grounding-artifact isolation, and a concurrent-run lock.
- `doc-surveyor` agent: classifies a repo, inventories existing docs (write-fresh vs audit-existing), proposes the doc set, extracts a set-gate facts bundle, and asks the safe-capture questions.
- Bundled `scripts/standalone-check.sh`: greps the invoked pieces to prove no external plugin/skill/agent is invoked.
- Mode-aware first-run `npm install` detection on the capture path (fires only for `user-guide` screenshots).

**Changed:**
- The per-doc engine now accepts an explicit `write`/`audit` execution intent (defaulting to the prior infer-from-page-existence behavior, so `/write-doc` is unchanged).
```

4. Verify version sync (robust JSON parse rather than a positional grep):

Run: `python3 -c "import json; p=json.load(open('plugins/kms-docs/.claude-plugin/plugin.json')); m=json.load(open('.claude-plugin/marketplace.json')); e=[x for x in m['plugins'] if x['name']=='kms-docs'][0]; print('plugin', p['version']); print('mkt-entry', e['version']); print('mkt', m.get('version') or m.get('metadata',{}).get('version'))"`
Expected: `plugin 2.2.0`, `mkt-entry 2.2.0`, `mkt 1.9.0`.

5. Validate:

Run: `claude plugin validate .` (from repo root)
Expected: validation passes with no errors.

**Testing:**
- **docsuite.AC6.4 (part):** `plugin.json` and the `marketplace.json` entry show the same bumped version (`2.2.0`); marketplace version bumped to `1.9.0`; CHANGELOG entry added with the correct `## kms-plugins 1.9.0` heading; validation clean.

**Commit:** `release(kms-docs): 2.2.0 — docsuite Phases 6–8 (marketplace 1.9.0)` (single commit for plugin.json + marketplace.json + CHANGELOG.md, per the marketplace release checklist)
<!-- END_TASK_9 -->

<!-- START_TASK_10 -->
### Task 10: Sync the gitlab export and confirm it ships no node_modules (AC6.4, part 2)

**Verifies:** docsuite.AC6.4 (export synced, node_modules-free)

**Files (in the export repo at `~/Documents/GitHub/documentation-plugin`):**
- Sync: `plugins/kms-docs/` content from this repo into the export (agents, skills, commands, scripts — but NOT `scripts/node_modules`, and NOT the repo-level `tests/docsuite-fixtures/`, which lives outside `plugins/kms-docs/` and never belongs in the export)
- Modify (export): its `plugins/kms-docs/.claude-plugin/plugin.json` → `2.2.0`, its `.claude-plugin/marketplace.json` (export's own marketplace versioning — bump from `1.1.0` to the next appropriate value, and its `kms-docs` entry to `2.2.0`), and its `CHANGELOG.md`

**Implementation:**

1. Copy the updated `plugins/kms-docs/` tree into the export, excluding `node_modules` and any `package-lock.json`: `rsync -a --delete --exclude node_modules --exclude package-lock.json plugins/kms-docs/ ~/Documents/GitHub/documentation-plugin/plugins/kms-docs/`. Because the rsync source is `plugins/kms-docs/`, the repo-level `tests/docsuite-fixtures/` is never copied.
2. Bump the export's `plugin.json`, `marketplace.json` (export marketplace version + kms-docs entry `2.2.0`), and add its `CHANGELOG.md` entry mirroring Task 9's.
3. Confirm no `node_modules` anywhere in the export:

Run: `find ~/Documents/GitHub/documentation-plugin -name node_modules -type d`
Expected: no output (none present).

Run: `git -C ~/Documents/GitHub/documentation-plugin status --porcelain | grep -i node_modules || echo "no node_modules staged"`
Expected: `no node_modules staged`.

4. Validate the export: `claude plugin validate ~/Documents/GitHub/documentation-plugin`.
5. Commit in the export repo.

**Outward-facing step (confirm before doing):** pushing the export to gitlab (`git push` to `origin main`) and publishing the main repo (merging `docsuite-phases-6-8` to `master` and pushing `origin`) are external, hard-to-reverse actions. **Do NOT push automatically.** Prepare the commits locally, report readiness, and push only after the operator confirms (or defer the pushes to the branch-finish step). AC6.4's "published + synced + node_modules-free" is satisfied once these confirmed pushes complete.

**Testing:**
- **docsuite.AC6.4:** export synced to `kms-docs 2.2.0`, validated, and confirmed to contain no `node_modules`; pushes performed only with operator confirmation.

**Verification:** export version matches; no `node_modules`; validation clean; pushes gated on confirmation.

**Commit:** in the export repo, a single release commit; do not push without confirmation.
<!-- END_TASK_10 -->

<!-- START_TASK_11 -->
### Task 11: Update STATUS / HANDOFF / plugin docs

**Verifies:** (docs; no AC — supports docsuite.AC6.4 release completeness)

**Files:**
- Modify: `plugins/kms-docs/STATUS.md` — record that feature Phases 6–8 shipped (survey, `/document-project` multi-doc orchestration, release), and that `kms-docs` is at `2.2.0`.
- Modify: `plugins/kms-docs/HANDOFF-docsuite.md` — mark Phases 6–8 complete; note the standalone check exists at `scripts/standalone-check.sh` (and retire the line-54 housekeeping note about excluding the declaration line, now handled by the script's ALLOW pattern); correct the stale line 28 (`<repo>/docs/.kms-run/internals-grounding.md`) to reflect that the grounding artifact is created OUTSIDE the target repo via `mktemp -d` as `grounding.json` (superseded decision).

**Implementation:** update both docs to reflect shipped state. Keep STATUS.md's ledger of documented runs intact; append the mode/version note.

**Verification:**

Run: `grep -n '2.2.0\|Phases 6' plugins/kms-docs/STATUS.md`
Expected: STATUS.md reflects the new version and phase completion.

**Commit:** `docs(kms-docs): mark docsuite Phases 6–8 shipped; fix stale grounding-artifact path note`
<!-- END_TASK_11 -->

---

**Phase 8 done when:** the bundled standalone check passes on the clean tree and fails on both a planted `ed3d-*` invocation and a planted `kms-*` sibling reference (AC6.2); durable fixtures exist and re-confirm AC3.2/AC3.5/AC4.2/AC4.3/AC4.7; first-run detection fires only on the `user-guide` capture path with the exact command and never for `maintainer`/`agents-md` (AC6.3); the full pipeline runs using only bundled agents, confirmed by a required clean-profile end-to-end run (AC6.1); the capture.mjs backstop is intact (AC7.2); `plugin.json` + `marketplace.json` + `CHANGELOG.md` are bumped (with the `## kms-plugins 1.9.0` heading) and validate cleanly, and the gitlab export is synced, validated, and confirmed `node_modules`-free, with outward pushes performed only on operator confirmation (AC6.4).
