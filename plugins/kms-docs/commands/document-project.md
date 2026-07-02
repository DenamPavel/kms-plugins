---
description: Document a whole project - survey the repo, approve the doc set at one set gate, then run the per-doc engine for each doc (user guide, maintainer, AGENTS.md) with a committed ledger and resume
argument-hint: "[repo path]"
---

Run the `documenting-a-project` skill for the repo in `$ARGUMENTS`.

Parse `$ARGUMENTS` as the target repo path. If it is empty or not an existing directory, stop and ask the runner for a valid repo path; do not guess.

The skill owns the whole run: it dispatches `doc-surveyor`, holds the set gate, runs the per-doc engine once per approved doc (user guide → maintainer → `AGENTS.md`) in the right mode, owns the run-scoped grounding-artifact scratch dir and the concurrent-run lock, and maintains the committed ledger at `<repo>/docs/.docsuite-ledger.md` with resume. This command is the sole entry point that reads or writes that ledger; `/write-doc` never touches it.

Do not accept a `mode` argument here — a project run always covers the approved set, and each doc's mode is decided by the surveyor's proposal and the set gate.
