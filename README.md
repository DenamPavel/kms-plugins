# kms-plugins

Two Claude Code plugins for writing. `kms-docs` is a documentation pipeline that grounds a page against source before drafting it and reviews it on a different model than wrote it. `kms-human-voice` is the prose rulebook underneath, enforced by hooks that fire on save.

They are independent. Either works without the other.

## Installation

```
claude plugin marketplace add https://github.com/DenamPavel/kms-plugins.git
claude plugin install kms-docs@kms-plugins
claude plugin install kms-human-voice@kms-plugins
```

Restart Claude Code to activate.

## kms-docs

A documentation pipeline built around one idea: the failure mode in generated documentation is fluent prose that is wrong or incomplete, so grounding and review carry more weight than drafting.

`/write-doc` runs a single page through six agents. `doc-investigator` reads the source first and builds a do-not-leak list of secrets, tokens, and internal hostnames it found. `doc-writer` drafts against that grounding. Then `doc-fact-checker`, `doc-editor`, and `doc-coverage-critic` review in parallel, with the editor on a different model than the writer so it has no stake in the draft's choices. `doc-reviser` rewrites from intent rather than patching. Two human gates: scope after grounding, and the finished page before it replaces anything live.

`/document-project` surveys a repo, proposes a doc set at one approval gate, then runs the per-doc engine for each doc with a committed ledger so a long run can resume.

The pipeline writes three kinds of document, each with its own scope rulebook and leak model:

| Mode | Rulebook | Leak model |
|------|----------|------------|
| User guide | `writing-documentation` | Implementation details stay out |
| Maintainer / architecture | `writing-internals` | Inverted: machinery is the subject, only secrets and real data are sensitive |
| `AGENTS.md` | `agents-md-conventions` | Manifest-dedup and generic-filler filters |

Screenshot capture is bundled. `doc-screenshooter` drives a Playwright script that refuses to run unless the target asserts demo mode, so a capture cannot pull real customer data into a doc.

## kms-human-voice

A prose rulebook with fourteen rules: an AI phrase blacklist, a one-em-dash-per-page limit, a ban on `not X, it's Y` contrastive framing, no throat-clearing or hedging, no Victorian transition words, and a set of structural tells (clause barf, hedge-alternative tails, false equations, reassurance sentences, structure-preview sentences).

Two `PostToolUse` hooks fire on write:

- **`check-ai-patterns.sh`** counts em-dashes and flags contrastive phrasing mechanically.
- **`check-intensity.sh`** detects deliverable files, including `.py` files importing `pptx`/`docx` and `.R` files loading `officer`/`rmarkdown`, and dispatches a separate Sonnet agent to review for literary intensity saturation. A fresh reader catches what the model that wrote the prose will defend.

Both are non-blocking warnings. Fix them during finalization, not mid-draft.

The structural-tells section is adapted from Ed Ropple's Polytoken documentation style guide.

## License

MIT
