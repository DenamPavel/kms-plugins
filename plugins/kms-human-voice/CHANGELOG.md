# Changelog

## 1.5.0

The intensity review stops firing on machine-facing files.

**Changed:**
- `check-intensity.sh` now gates on an allowlist and stays silent by default. It previously excluded a short blocklist and fired on everything else, which dispatched a review agent for findings files, implementation plans, test-requirements docs, and essentially every other markdown file written. Measured on one working corpus of 1,416 markdown files, the old gate fired on 984 and the new gate fires on 16, each a document written for a human reader. Filename markers are matched on word boundaries, so "memory-called-empire.md" is no longer read as a memo, and pipeline artifacts are dropped by name before the markers run, so `STATUS-...-segmentation-memo.md` is treated as the status doc it is.
- Two escape hatches, since no naming rule catches everything: `audience: human` in frontmatter (or `voice: skip` to silence a file), and a `.human-voice-review` marker file that opts in every prose file in its directory.
- `drafts/` is deliberately not an opt-in marker. A generate-and-select loop writes dozens of drafts and carries its own review battery.
- The `.py`/`.R` deck-and-document-generator detection is unchanged; an `import pptx` or `library(officer)` is already a precise signal.
- The skill description now scopes to prose that leaves the machine and names what is exempt, so the skill stops loading for plans, findings, status docs, and commit messages. A new paragraph in `SKILL.md` separates the two questions: what the voice governs (everything) from when the file is worth loading (outward-facing prose only).
- `SKILL.md` drops from 275 to 211 lines. Rule 6's full pattern catalog and the hook mechanics moved to `references/intensity-review.md`, which also removes a duplicate copy of the review-agent prompt that the hook script already carries. Rules 1 through 14 now run in unbroken order; the automated-enforcement section no longer sits between rules 6 and 7.

The hook, the reference, and `check-ai-patterns.sh` are byte-identical to the upstream copy, where this change was made first. The two copies still differ in their examples: this one is genericized, the upstream one uses real column names.
