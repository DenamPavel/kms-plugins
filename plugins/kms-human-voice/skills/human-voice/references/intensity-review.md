# Intensity review: full catalog and hook mechanics

Reference for Rule 6 of the `human-voice` skill. Load it when running an intensity review or when changing how the review fires. The rule itself, in condensed form, is in `SKILL.md`.

## The patterns in full

**Sensory-abstract pairings.** Fusing a physical sensation with an abstract concept: "bruised silence," "the taste of almost-Friday," "timestamp like a scar." One per passage can work. When you spot one, ask what it accomplishes that a plain statement wouldn't. If the answer is just "it sounds literary," flatten it.

**Atmospheric vagueness.** Words chosen for evocative mood rather than precision. The usual suspects are ghosts, echoes, whispers, shadows, hums, pulses, flickering, but the category is broader: any word picked because it feels atmospheric rather than because it's the right word. "The room hummed with tension" is atmosphere. "Nobody spoke" is information. Default to information.

**Compulsive personification.** Giving agency to objects or abstractions as a reflex. Cursors that convulse, code that smirks, leaves that cling defiantly. Reserve personification for moments where the attribution of intent matters to the point you're making.

**Structural repetition.** Consecutive sentences following the same syntactic template, independent of which device is used. Three sentences in a row opening with a personified abstraction, or three in a row pairing a concrete image with an emotion. The structure itself becomes the tell even when each sentence is individually defensible. This applies to plain prose, not only literary passages: three sentences starting with the same word (including "the"), or a run of clauses built on the same anaphoric rhythm ("you write there, you reference there, you reach back there"), is the same failure. Three or more in a row is always wrong; two with leading dependent clauses is sometimes worth breaking up.

**Register flatness.** Every sentence operating at the same intensity, whether literary-heightened or clinical-detached. Plain sentences create the space that makes a striking image stand out. If every line is reaching for effect, none of them land.

The density guideline and the remove-rather-than-substitute fix are stated in `SKILL.md` and are not repeated here.

## Automated enforcement

This plugin ships two PostToolUse hooks on Write/Edit.

### Mechanical pattern check (`check-ai-patterns.sh`)

Scans `.md` and `.txt` files for:

- **Em-dashes**: flags when more than one appears in a file (README files are exempt)
- **Contrastive phrasing**: flags the canonical pivot, a negation followed by a pronoun that asserts the replacement ("X isn't Y, it's Z"), and drops lines that open a conditional or a reason. README files are checked.

The contrastive check is tuned for precision. Against the 180 labeled sentences in `tests/contrastive/`, written by two model families, it catches about a quarter of the contrastive sentences and flags one legitimate one. It misses "Less X, more Y", "rather than X, Y", "never X, Y", inverted "Y, not X", and two-sentence pivots with a repeated noun subject. The skill rule and the intensity review carry the rest. Run `tests/contrastive/run.sh` after changing the pattern.

Cheap, no agent involved. Violations are non-blocking warnings. Fix them during finalization, not mid-draft.

### Intensity review agent (`check-intensity.sh`)

Detects outward-facing files and instructs Claude to spawn a **sonnet-model agent** for intensity review. A separate agent does it because the model that wrote the prose defends its own choices; an independent reader catches what self-review misses. The review prompt also covers contrastive framing, which a reader can judge by meaning where the regex can only match shapes.

**The gate is an allowlist, and silence is the default.** An earlier version excluded a blocklist and fired on everything else, which meant every findings file, implementation plan, and test-requirements doc triggered an agent. Measured on one working corpus of 1,416 markdown files, the blocklist gate fired on 984 while about 16 of those files were written for a human reader, so a blocklist cannot be extended into correctness. Content shape does not separate the classes either: client memos there ran 0.22 to 0.79 prose-to-structure fraction while CLAUDE.md files ran 0.93. The gate keys on naming and location instead.

Order of evaluation:

1. **Machine-facing locations veto everything**, whatever the filename: `.claude/`, `skills/`, `plugins/`, `agents/`, `commands/`, `docs/design-plans/`, `docs/implementation-plans/`, `tests/`, `testkit/`, `fixtures/`, `examples/`, `council/`, `research/`, `control-corpus/`, `node_modules/`, `scratchpad/`, `backups/`, and anything under `/tmp`. An example memo inside a skill directory documents a memo; it is not one.
2. **`voice: skip` in the first ten lines** ends it.
3. **Pipeline artifacts and working docs are dropped by name**, before the positive markers run, so `STATUS-2026-07-15-segmentation-memo.md` is treated as the status doc it is: `CLAUDE.md`, `AGENTS.md`, `MEMORY.md`, `SKILL.md`, `README.md`, `CHANGELOG.md`, `PROJECT.md`, `TODO.md`, `findings.md`, `brief.md`, `test-requirements.md`, `phase_NN*`, and anything matching pickup, status, handoff, progress, red-team, audit, `-grade`, `-factcheck`, run-log, resume, or ledger.
4. **An outward-facing marker in the filename fires it**, matched on word boundaries so "memory" is not "memo": memo, client, pre-read, email, letter, proposal, deliverable, essay, one-pager, white-paper.
5. **An outward-facing directory fires it**: `deliverables/`, `essays/`, `clients/`, `client-*/`.
6. **Opt-in covers the rest**: `audience: human` (or `client`, `reader`, `review`) in frontmatter within the first ten lines, or a `.human-voice-review` marker file in the directory, which covers every prose file beside it.

`drafts/` is deliberately not a positive marker. A generate-and-select loop writes dozens of drafts and carries its own review battery, so reviewing each one is duplicate work. Opt a finished draft in by hand.

Two file types bypass the naming rules, because the text is bound for a human reader by construction:

- `.py` files that import `pptx` or `docx`
- `.R`/`.Rmd` files that load `officer` or `rmarkdown`

**Deduplication:** the hook records the last review time per file in `/tmp/claude-intensity-review/` and exits silently if that file was reviewed within five minutes, so iterative editing does not stack up reviews.

**The agent prompt lives in the hook script**, and the hook passes it through `additionalContext` when it fires. Spawn a sonnet agent in the background with the prompt the hook hands you; do not reconstruct it from here. Its output is advisory. Address findings during finalization, not mid-draft.
