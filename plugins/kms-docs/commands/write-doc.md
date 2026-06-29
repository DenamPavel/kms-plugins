---
description: Write or revise a product/tool documentation page through the full grounding, draft, cross-model review, and revision pipeline with two human gates
argument-hint: "[target page or feature] [repo path]"
---

# Write Documentation

Run the documentation pipeline for: $ARGUMENTS

Read the `documentation-pipeline` skill now and follow it as the orchestrator. In short:

1. Confirm the target page and the source repo path. Ask if `$ARGUMENTS` does not make both clear.
2. Run the stages in order: ground (`doc-investigator`) → GATE 1 → draft (`doc-writer`) → parallel cross-model review (`doc-fact-checker`, `doc-editor`, `doc-coverage-critic`) → revise (`doc-reviser`) → GATE 2.
3. Honor both human gates. Do not overwrite a live page without GATE 2 approval.
4. On approval, write the page to its destination, update the page-to-source map and the nearest code-to-docs note, and flag every file you touched.

Track progress with TaskCreate so the run does not lose its place.
