# Changelog

## 1.7.0

The rulebook gains rhetorical and analytical tells and closes gaps in the contrastive rule.

**Added:**
- Rule 15, rhetorical and analytical tells: self-answered questions, dramatic fragments, participle tails ("..., highlighting the importance of X"), invented concept labels, vague attribution, stakes inflation, false "from X to Y" ranges, acknowledge-and-dismiss ("Despite these challenges"), listicles written as paragraphs, one-point dilution and the dead metaphor, and bold-first bullets in reader-facing prose. A single deliberate use can stand; vague attribution and stakes inflation cannot.
- Rule 2 covers the two-sentence pivot ("The question isn't X. The question is Y."), the causal pivot ("Not because X. Because Y."), and the countdown ("Not X. Not Y. Z."), and states the exemption for a negation that corrects a likely misconception.
- Rule 7's false-equation entry covers the reverse inflation, "serves as" or "stands as" where "is" is accurate.
- Rule 14 requires the specific figure to come from the source. Rewriting a vague sentence into one with an invented number or citation is the failure this guards against.
- The `check-intensity.sh` review prompt gains an eighth item for the Rule 15 tells, and item 7 lists the new contrastive variants.
- `tests/contrastive/deslop-variants.jsonl`: 15 contrastive variants and 15 legitimate negations, written without seeing the hook's pattern. The regex catches 3 of the 15 variants and flags none of the negations; the review prompt is meant to catch the rest. `run.sh` raises its recall floor to 27 and checks that the review prompt carries the new item.

The patterns were adapted from github.com/stephenturner/skill-deslop (MIT), which draws on tropes.fyi and stop-slop. Its blanket rules were left out: no adverbs, no three-item lists, no passive voice, no em-dashes anywhere, straight quotes only. Each would damage legitimate memo and deck prose, and the em-dash rule conflicts with Rule 1.

## 1.6.0

The contrastive-framing check catches the canonical pivot, and contrastive framing gets a model review.

**Changed:**
- `check-ai-patterns.sh` replaces its contrastive regex. The old pattern allowed exactly one word between the negation and the comma, so an article broke the match. Against 180 labeled sentences it caught 2 of 90 contrastive sentences and flagged 5 of 90 legitimate ones. The new pattern matches a negation followed, after a comma, semicolon, colon, period, or em-dash, by a pronoun asserting the replacement ("X isn't Y, it's Z"), and a second pattern drops lines that open a conditional or a reason. It catches 24 of 90 and flags 1 of 90. It is tuned for precision because a regex cannot tell a rhetorical negation from a real correction; "Less X, more Y", "rather than X, Y", inverted "Y, not X", and two-sentence pivots still pass.
- README files now get the contrastive check. They keep the em-dash exemption.
- The `check-intensity.sh` review prompt gains a seventh item, contrastive framing, so deliverables get a reader that judges by meaning.

**New:**
- `tests/contrastive/`: 120 labeled sentences written by GPT-6.1 Sol and 60 by Claude Opus 5.5, each without seeing the other's set or the pattern, plus `run.sh`, which reads both patterns out of the hook, fails on a recall or false-positive regression, and runs both hooks end to end. The pattern was tuned after both sets existed, so its scores are in-sample.

**Fixed:**
- Adding the seventh item first broke `check-intensity.sh`: the review prompt is spliced into the hook's JSON unescaped, so a double quote ended the string. Caught before release; `run.sh` now parses the hook's output.

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
