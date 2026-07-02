# Changelog

## kms-plugins 1.9.0

kms-docs 2.2.0 — docsuite project documentation pipeline (Phases 6–8).

**New:**
- `/document-project` command and `documenting-a-project` skill: survey a repo, approve the doc set at one set gate, then run the per-doc engine for the user guide, maintainer doc, and `AGENTS.md`, with a committed per-project ledger, resume, run-scoped grounding-artifact isolation, and a concurrent-run lock.
- `doc-surveyor` agent: classifies a repo, inventories existing docs (write-fresh vs audit-existing), proposes the doc set, extracts a set-gate facts bundle, and asks the safe-capture questions.
- Bundled `scripts/standalone-check.sh`: greps the invoked pieces to prove no external plugin/skill/agent is invoked.
- Mode-aware first-run `npm install` detection on the capture path (fires only for `user-guide` screenshots).

**Changed:**
- The per-doc engine now accepts an explicit `write`/`audit` execution intent (defaulting to the prior infer-from-page-existence behavior, so `/write-doc` is unchanged).

## kms-plugins 1.8.0

**Removed:**
- `insight-essay-bot`: dropped from the marketplace catalog and the README. It lives on in its own repo at `DenamPavel/InsightEssayBot`; it is no longer cataloged or installable via `@kms-plugins`.

## kms-plugins 1.7.0

kms-docs gains screenshot capture.

**New:**
- `kms-docs` 2.1.0: the documentation pipeline can now capture screenshots from a running product. A seventh agent, `doc-screenshooter`, builds a declarative capture spec and drives a bundled Playwright script (`scripts/capture.mjs`); no other plugin is required. Data-leak prevention is layered and code-enforced: every shot must assert a safe-mode indicator before any pixels are written, so a forgotten safe-mode toggle produces a refused shot rather than a leaked image. The orchestrator adds a Capture stage (1.5) and negotiates a per-surface safe-capture plan with the human at GATE 1. The `writing-documentation` rulebook now treats a screenshot as an aid the text must not depend on, and adds an "image-only information" tell to the review gate. `doc-investigator` returns a capture plan; `doc-writer` embeds approved shots with alt text.

## kms-plugins 1.6.1

**Changed:**
- `kms-docs` 2.0.1: make the pipeline self-contained for any user. The orchestrator now states that its six agents ship with the plugin and are dispatched by name via the Task tool, with no general-purpose substitute and no other plugin required. Removed the external ed3d reference from the rulebook.

## kms-plugins 1.6.0

kms-docs grows from a single skill into a documentation pipeline.

**Changed:**
- `kms-docs` 2.0.0: adds a `/write-doc` command and an orchestrator skill (`documentation-pipeline`) that runs six agents around the rulebook: `doc-investigator` (ground truth plus a do-not-leak list), `doc-writer`, `doc-fact-checker`, `doc-editor` (opus, cross-model), `doc-coverage-critic`, and `doc-reviser`. Two human gates: scope after grounding, and the finished page before it replaces a live doc. The `writing-documentation` skill was revised from a technical-editor pass: affirmative-phrasing rule replaces the old positive-framing rule, testable scope and structure rules, a code-samples section, UI-element conventions, and a tightened trigger description.

## kms-plugins 1.5.0

New plugin.

**New:**
- `kms-docs` 1.0.0: a documentation-writing skill (`writing-documentation`). Generalizes a product-manual rulebook into a reusable skill covering the two-reader model (human plus retrieval), self-contained sections, behavior-not-implementation scope, actor and terminology discipline, a machine-writing tells checklist, a multi-reviewer cross-model review gate, flagging doc changes for human review, and keeping docs synced to code. Self-contained; pairs with `kms-human-voice` without depending on it.

## kms-plugins 1.1.0

Catalog additions.

**New:**
- insight-essay-bot 0.1.0: kontextmaschine-style analytical essay skills (explore, write, edit), hosted in its own repo at `DenamPavel/InsightEssayBot` and referenced via a github source.

**Changed:**
- README now lists all marketplace plugins (added the previously undocumented `kms-human-voice`) and broadened the marketplace description beyond MCP patterns.

## kms-plugins 1.0.0

Initial marketplace.

**New:**
- `kms-mcp-patterns` 1.0.0: design patterns for building MCP servers, starting with Code Mode.
- `kms-human-voice` 1.0.0: personal writing-style enforcement with PostToolUse phrasing hooks.
