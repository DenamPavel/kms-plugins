---
description: Write or revise a product/tool documentation page through the full grounding, draft, cross-model review, and revision pipeline with two human gates
argument-hint: "[target page or feature] [repo path] [mode: user-guide|maintainer|agents-md]"
---

# Write Documentation

Run the documentation pipeline for: $ARGUMENTS

Read the `documentation-pipeline` skill now and follow it as the orchestrator. In short:

1. Confirm the target page and the source repo path. Recognize a trailing `mode` token in `$ARGUMENTS` **only** when the last whitespace-separated token is an exact match for `user-guide`, `maintainer`, or `agents-md`. If the last token is not an exact match, there is no mode token — treat the whole of `$ARGUMENTS` as target + repo path and default `mode` to `user-guide` (this avoids mis-parsing a target or repo path that merely contains a word like 'maintainer'). If a would-be mode token is present but misspelled/unrecognized (e.g. `maintaner`), and the human's intent to pass a mode is ambiguous, ask rather than guess. When the human explicitly passes a mode value that is not one of the three, **refuse with a clear error** naming the allowed values and stop; do not run the pipeline and do not treat it as `user-guide`. Pass the resolved `mode` to the `documentation-pipeline` orchestrator.
2. Run the stages in order: ground (the mode's investigator) → GATE 1 → draft (`doc-writer`) → parallel cross-model review (`doc-fact-checker`, `doc-editor`, the mode's coverage critic) → revise (`doc-reviser`) → GATE 2.
3. Honor both human gates. Do not overwrite a live page without GATE 2 approval.
4. On approval, write the page to its destination, update the page-to-source map and the nearest code-to-docs note, and flag every file you touched.

Track progress with TaskCreate so the run does not lose its place.
