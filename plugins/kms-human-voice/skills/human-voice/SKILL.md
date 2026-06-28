---
name: human-voice
description: Use when writing any prose, documentation, client-facing text, or commit messages - enforces personal anti-AI phrasing rules, em-dash limits, contrastive framing bans, terminology preferences, intensity modulation, and direct communication style
user-invocable: false
---

# Human Voice

Complements `writing-for-a-technical-audience` (ed3d-house-style), which covers broad AI-pattern avoidance: phrase blacklists, hedging, throat-clearing, transition words. This skill covers specific enforcement rules from client feedback, plus intensity modulation for prose.

## Rules

### 1. Em-dash limit

One em-dash per page maximum. Replace extras with commas, semicolons, or periods.

| Before | After |
|--------|-------|
| The data shows growth -- particularly in Q3 -- across all segments -- even underperformers. | The data shows growth, particularly in Q3, across all segments. Even underperformers improved. |

### 2. No contrastive framing

The pattern `[negation] [thing], [pronoun] [other thing]` reads as formulaic AI output. Every LLM defaults to this structure.

| Before | After |
|--------|-------|
| This isn't a conversion signal, it's an acquisition signal. | This is an acquisition signal rather than a conversion signal. |
| It's not about reach, it's about frequency. | Frequency matters more than reach here. |

Alternatives: "rather than," "more than," "instead of," or restructure the sentence entirely.

### 3. No internal codes in client-facing text

Database field names, score thresholds, column names, and system references stay out of anything a client sees.

| Before | After |
|--------|-------|
| Guests with lifestyle_sports_golf > 0.7 over-index significantly. | Guests with high golf affinity over-index significantly. |
| The dmi_commercial match rate is 62%. | The commercial match rate is 62%. |

### 4. Terminology: "metis" over "tribal knowledge"

Use "metis" when referring to practical, experience-based knowledge that lives in someone's head. Brief gloss on first use is fine: "metis (practical, experience-based knowledge)."

### 5. Direct communication

Skip flattery, compliments, and enthusiasm markers. No "Great question!", "Excellent observation!", "That's a really interesting point!" Brief functional acknowledgments ("Good catch," "Fair point") are fine.

Get to the point. If the answer is three words, the response is three words.

### 6. Intensity review (warning, not ban)

None of the patterns below are forbidden. They're legitimate craft when used deliberately. The problem is accumulation: when they stack up, the writing sounds like it's performing "writing" rather than communicating.

**Applies to:** deliverable prose (client-facing `.md`/`.txt`, text destined for PowerPoint slides or Word documents). Internal docs, skill files, and design plans are excluded.

**Patterns to watch for:**

**Sensory-abstract pairings.** Fusing a physical sensation with an abstract concept: "bruised silence," "the taste of almost-Friday," "timestamp like a scar." One per passage can work. When you spot one, ask what it accomplishes that a plain statement wouldn't. If the answer is just "it sounds literary," flatten it.

**Atmospheric vagueness.** Words chosen for evocative mood rather than precision. The usual suspects are ghosts, echoes, whispers, shadows, hums, pulses, flickering, but the category is broader: any word picked because it feels atmospheric rather than because it's the right word. "The room hummed with tension" is atmosphere. "Nobody spoke" is information. Default to information.

**Compulsive personification.** Giving agency to objects or abstractions as a reflex. Cursors that convulse, code that smirks, leaves that cling defiantly. Reserve personification for moments where the attribution of intent matters to the point you're making.

**Structural repetition.** Consecutive sentences following the same syntactic template, independent of which device is used. Three sentences in a row opening with a personified abstraction, or three in a row pairing a concrete image with an emotion. The structure itself becomes the tell even when each sentence is individually defensible.

**Register flatness.** Every sentence operating at the same intensity, whether literary-heightened or clinical-detached. Plain sentences create the space that makes a striking image stand out. If every line is reaching for effect, none of them land.

**Density guideline:** In a single paragraph, one literary device is fine. Two should each be doing clear work. Three is almost certainly too many. This scales naturally with length: a ten-page report has more room than a three-paragraph email, but the per-paragraph density stays the same.

These are warnings. The fix is almost always to remove or simplify, not to replace with a different device.

**Automated review:** A PostToolUse hook detects deliverable files and triggers a separate sonnet-model agent to review intensity. The reviewing agent comes in cold with no attachment to the draft. Its findings are non-blocking warnings. See the "Intensity review agent" section below.

## Automated enforcement

This plugin ships PostToolUse hooks that fire on Write/Edit:

### Mechanical pattern check (`check-ai-patterns.sh`)

Scans `.md` and `.txt` files for:

- **Em-dashes**: flags when more than one ` -- ` appears in a file
- **Contrastive phrasing**: flags "not X, it's Y" patterns

Violations are non-blocking warnings. Fix them during finalization, not mid-draft.

### Intensity review agent (`check-intensity.sh`)

Detects deliverable files and instructs Claude to spawn a **sonnet-model agent** for intensity review. A separate agent does this review because the model that wrote the prose will defend its own choices; an independent reader catches what self-review misses.

**Deliverable detection:**
- `.md` and `.txt` files that are NOT in `.claude/` directories, NOT named `CLAUDE.md`/`AGENTS.md`/`MEMORY.md`/`SKILL.md`/`README.md` (case-insensitive), and NOT under `docs/design-plans/`
- `.py` files that import `pptx` or `docx` (deck and document generators)
- `.R`/`.Rmd` files that load `officer` or `rmarkdown` (R document generators)

**Deduplication:** the hook tracks the last review time per file in `/tmp/claude-intensity-review/`. If a file was reviewed within the last 5 minutes, the hook silently exits. This prevents repeated reviews during iterative editing.

**When the hook fires, it embeds the full agent prompt in `additionalContext`.** Spawn a sonnet agent in the background using the prompt provided by the hook. The prompt structure:

```
You are reviewing a draft for literary intensity saturation. Read the file
and flag any of these patterns:

1. SENSORY-ABSTRACT PAIRINGS: physical sensations fused with abstract
   concepts. Flag each instance. One per passage is acceptable; more
   than that and they stop doing work.

2. ATMOSPHERIC VAGUENESS: words chosen for mood rather than precision.
   Words like ghosts, echoes, whispers, shadows, hums, pulses, flickering
   are common examples, but flag any word that's atmospheric rather than
   specific.

3. COMPULSIVE PERSONIFICATION: objects or abstractions given human agency
   as a reflex rather than a deliberate choice.

4. STRUCTURAL REPETITION: consecutive sentences following the same
   syntactic template (e.g., three personified-abstraction openers in
   a row).

5. REGISTER FLATNESS: passages where every sentence operates at the
   same intensity with no plain/functional sentences between devices.

6. DENSITY: flag any paragraph with three or more literary devices.

For .py or .R files generating slides or documents, review only the text
content (string literals destined for slides/pages), not the code itself.

For each finding, quote the specific passage and suggest a plainer
alternative. Rate overall intensity: LOW (fine), MODERATE (a few spots
to check), HIGH (significant rework needed).

These are non-blocking warnings, not demands. Be specific and brief.
```

The agent's output is advisory. Address findings during finalization, not mid-draft.

## When this fires vs. when writing-for-a-technical-audience fires

| Concern | Covered by |
|---------|-----------|
| "Delve," "leverage," "robust" | writing-for-a-technical-audience |
| Throat-clearing, hedging | writing-for-a-technical-audience |
| Transition word overuse | writing-for-a-technical-audience |
| Progressive disclosure, code examples | writing-for-a-technical-audience |
| Em-dash counting | human-voice (this skill + hook) |
| Contrastive framing ban | human-voice (this skill + hook) |
| Internal codes in client text | human-voice (this skill) |
| "Metis" terminology | human-voice (this skill) |
| Direct communication style | human-voice (this skill) |
| Intensity saturation review | human-voice (this skill + hook + agent) |
