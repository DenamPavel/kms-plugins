# kms-docs

A documentation pipeline for product docs, maintainer docs, and `AGENTS.md` files. It grounds every page in the source before drafting, reviews the draft on a different model than the one that drafted it, and stops at human gates rather than writing over a live page.

## The problem it addresses

A model writing documentation from a repo it has skimmed produces pages that read well and state things that are not true. The failure is not fluency. It is that nothing checked the claims: a default that changed, a button relabelled, a sidebar reordered, a feature the page never mentions. Those errors survive a proofread, because the prose is fine.

So the pipeline separates grounding from drafting, and review from both. An investigator reads the source and writes down what is true. A writer drafts only from that record. Three reviewers then check the draft against the source, the prose rules, and the product surface for what the page left out. The prose reviewer runs on a different model than the writer, so that review does not share the writer's instincts about its own sentences.

## Commands

### `/write-doc`: one page

```
/write-doc [target page or feature] [repo path] [mode]
```

`mode` is `user-guide` (the default), `maintainer`, or `agents-md`. A run with no mode token documents the user-facing surface. Pass an explicit mode that is not one of the three and the command refuses with an error naming the allowed values. Give it a token that might be a misspelled mode and it asks instead of guessing.

`user-guide` and `maintainer` run six stages:

1. **Ground.** The mode's investigator reads the source and produces a grounding artifact: the surface a user sees, the internal details that must not leak, a page-to-source map.
2. **GATE 1.** You approve the grounding before the writer drafts anything.
3. **Draft.** `doc-writer` writes the page from the artifact and self-reviews against the tells checklist.
4. **Review, in parallel and cross-model.** `doc-fact-checker` verifies every claim against source, `doc-editor` hunts the machine-writing tells, and the mode's coverage critic looks for what the page omits.
5. **Revise.** `doc-reviser` rewrites the affected passages from intent rather than patching sentences, and rejects findings that are wrong.
6. **GATE 2.** You approve before the pipeline overwrites a live page.

`agents-md` mode runs the ground stage, GATE 1, a distill pass through `doc-agents-md`, then a single result gate.

### `/document-project`: a whole repo

```
/document-project [repo path]
```

`doc-surveyor` classifies the repo, inventories the docs that already exist, marks each one write-fresh or audit-existing, and proposes a doc set. You approve that set at one gate. The per-doc engine then runs once per approved doc, in order: user guide, maintainer, `AGENTS.md`.

The engine commits progress to a ledger at `<repo>/docs/.docsuite-ledger.md`, so an interrupted run resumes instead of restarting. `/document-project` is the only entry point that reads or writes that ledger; `/write-doc` never touches it.

## Skills

The rulebooks stand on their own; you can read them without running the pipeline.

| Skill | Covers |
|-------|--------|
| `writing-documentation` | The rulebook for product and tool docs: the two-reader model, self-contained sections, behavior-not-implementation scope, actor and terminology discipline, UI-label conventions, code samples, screenshots, the user-guide leak model, and the review gate. |
| `writing-internals` | The rulebook for maintainer and architecture docs, where the machinery is the subject. Carries an inverted leak model: only secrets, tokens, and real data are sensitive. |
| `prose-voice-rules` | The shared machine-writing tells checklist, referenced by both rulebooks above. Passive voice, unclear antecedents, false equations, clause barf, and the rest, each with a concrete fix. |
| `documentation-pipeline` | The per-page orchestration `/write-doc` follows. |
| `documenting-a-project` | The whole-repo orchestration `/document-project` follows, including the set gate, the scratch lifecycle, and ledger resume. |
| `capturing-screenshots` | The bundled Playwright capture flow, the declarative capture spec, and the safe-mode assertion that prevents a screenshot leaking real data. |

## Agents

Each stage runs in its own context. The editor deliberately does not share a model with the writer; the other two reviewers do.

| Agent | Model | Role |
|-------|-------|------|
| `doc-investigator` | Sonnet | Grounds a user-facing page: maps the surface, lists what must not leak, inventories existing docs, builds the page-to-source map. |
| `doc-internals-investigator` | Sonnet | Grounds a maintainer doc or `AGENTS.md`: module boundaries, data flow, invariants, why-decisions, build and run facts. |
| `doc-surveyor` | Sonnet | Proposes the doc set for a whole repo and extracts the facts bundle for the set gate. |
| `doc-writer` | Sonnet | Drafts or rewrites a page from the grounding artifact. |
| `doc-agents-md` | Opus | Distills an `AGENTS.md`, applying a manifest-dedup filter and a generic-filler filter. |
| `doc-fact-checker` | Sonnet | Checks every factual claim against source, especially ordered and positional claims, defaults, labels, and counts. |
| `doc-editor` | Opus | Editorial and tells review; quotes the offending sentence and proposes a fix for each finding. |
| `doc-coverage-critic` | Sonnet | Finds shipped user-facing behavior a page omits. |
| `doc-internals-critic` | Sonnet | Finds machinery a maintainer doc omits, against the grounding artifact's machinery map. |
| `doc-reviser` | Opus | Applies findings by rewriting from intent, and rejects the ones that are wrong. |
| `doc-screenshooter` | Sonnet | Captures screenshots from the running product and returns a cropped, leak-checked manifest. |

`agents/agents-md-conventions.md` is a bundled reference the distiller reads, not a dispatchable agent. It defines the six conventional `AGENTS.md` sections.

## Scripts

`scripts/` holds the deterministic checks, which run as code rather than as judgment.

| Script | Does |
|--------|------|
| `capture.mjs` | The Playwright screenshot runner behind `doc-screenshooter`. |
| `agents-md-filter.mjs` | Reports which lines of a drafted `AGENTS.md` merely restate a manifest, so a distiller keeps project-specific guidance and drops derivable noise. |
| `standalone-check.sh` | Asserts the plugin invokes no external plugin, skill, or agent. Exit 0 is clean; exit 1 names the external reference. |

```bash
scripts/standalone-check.sh
```

## Design notes

- **Grounding is a separate stage with its own gate.** A writer that investigates while drafting will write around what it failed to find. Splitting them makes the ground truth reviewable before any prose exists.
- **The editor runs on a different model than the writer.** A single-model self-review passes its own tells, because the blind spots are correlated. The fact-checker and the coverage critic do share the writer's model, on the reasoning that their check runs against source and product surface rather than against prose instinct.
- **Findings are input, not verdicts.** `doc-reviser` rejects a finding it can show is wrong. A fact-check verdict is checkable against source, so rejecting one takes a citation.
- **Two leak models, not one.** A user guide hides implementation detail, internal names, and exact internal limits. A maintainer doc is *about* those, so its leak list inverts to secrets, tokens, and real data. Using the user-guide model on a maintainer doc empties the doc.
- **The screenshot guard is code, not an instruction.** A capture run asserts the safe state before it shoots, because "remember not to capture real data" is not a control.
- **Never overwrite a live page without approval.** Every mode ends at a gate.

## Status

Version 2.2.1. The plugin is standalone by construction and `scripts/standalone-check.sh` enforces it, so nothing here depends on a sibling `kms-*` plugin being installed.
