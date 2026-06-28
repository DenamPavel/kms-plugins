---
name: human-voice
description: Use when writing any prose, documentation, client-facing text, or commit messages - a self-contained set of anti-AI prose rules: phrase blacklist, em-dash limits, contrastive framing bans, hedging and throat-clearing, transition-word overuse, terminology preferences, intensity modulation, structural prose tells, and direct communication style
user-invocable: false
---

# Human Voice

A self-contained writing-voice skill: personal anti-AI prose rules from client feedback, plus intensity modulation and structural prose tells. It pairs with `writing-for-a-technical-audience` (ed3d-house-style) and does not depend on it. The prose rules that overlap with that skill are duplicated here on purpose, so this skill stays portable on its own. It does not duplicate ed3d's technical-documentation craft (code-example design, progressive disclosure, API-reference structure); reach for that skill when you need those.

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

**Structural repetition.** Consecutive sentences following the same syntactic template, independent of which device is used. Three sentences in a row opening with a personified abstraction, or three in a row pairing a concrete image with an emotion. The structure itself becomes the tell even when each sentence is individually defensible. This applies to plain prose, not only literary passages: three sentences starting with the same word (including "the"), or a run of clauses built on the same anaphoric rhythm ("you write there, you reference there, you reach back there"), is the same failure. Three or more in a row is always wrong; two with leading dependent clauses is sometimes worth breaking up.

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

### 7. Structural prose tells

These are sentence-level constructions that read as machine-written. They are distinct from the literary patterns in Rule 6: this is plain expository prose that has gone wrong structurally. Adapted from Ed Ropple's Polytoken documentation style guide.

**Clause barf.** Comma-clause strings that force the reader to assemble the meaning. Commit to one declarative shape and name the concrete detail inline.

| Before | After |
|--------|-------|
| Approve a recurring action once, at the scope you choose, and stop being asked. | Approve a recurring action once and Claude stops asking. You set the scope when you approve. |

**Hedge-alternative tails.** An obvious secondary path bolted onto a sentence with "...or". Cut the tail; state the primary path.

| Before | After |
|--------|-------|
| Type `/` as the first character of an empty prompt, or type a command in full. | Type `/` to open the command menu. |

**Over-packed list-sentences.** Many examples crammed in before the verb, delaying it. Split into separate sentences or a list.

| Before | After |
|--------|-------|
| Sessions, tool runs, context windows, permission grants, and skill activations all persist across restarts. | These persist across restarts: sessions, tool runs, context windows, permission grants, and skill activations. |

**Reassurance / summary sentences.** A sentence that restates the list or fact the reader just read. Delete it.

| Before | After |
|--------|-------|
| The queue holds follow-up prompts. This means you can line up work without losing your place. | The queue holds follow-up prompts. |

**Pronoun antecedent clarity.** Every "it," "this," "that," or "they" needs an unambiguous referent a reader can identify cold. Use the noun when the referent is even slightly unclear.

| Before | After |
|--------|-------|
| Understanding it is the first step. | Understanding the permission system is the first step. |

**False equations.** Equating things of different kinds with "is." Replace with an accurate verb.

| Before | After |
|--------|-------|
| That decision is the permission system. | The permission system produces that decision. |

**Salesmanship.** State capabilities plainly. Cut competitive comparison, especially in client-facing text.

| Before | After |
|--------|-------|
| Daily refresh, which the other vendors do not offer. | Data refreshes daily. |

**Structure-preview sentences.** "This page covers..." or "The findings fall into three groups..." when a heading already says so. Delete the preview; let the heading carry it.

### 8. Fixing flagged prose: rewrite, do not patch

When you act on any flag from this skill, rewrite the sentence or paragraph from its intended meaning rather than patch-editing in place. Start from what the sentence should say and write it fresh. Editing around a problem tends to extend the sentence and produce clause barf, which is how the structure got bad in the first place.

## Shared prose rules (duplicated for portability)

Rules 9 through 14 overlap with `writing-for-a-technical-audience`. They live here so this skill works without that one installed.

### 9. AI phrase blacklist

These words and phrases read as machine-generated. Replace them.

| Phrase | Use instead |
|--------|-------------|
| "delve into" | "explore," "examine," "look at" |
| "leverage" | "use," "take advantage of" |
| "robust" / "seamless" | be specific about what you mean |
| "at its core" | "fundamentally" (rarely) or delete |
| "cutting-edge" / "revolutionary" | describe the actual feature |
| "streamline" / "optimize" | "speed up," "reduce," "improve" |
| "foster" / "cultivate" | a direct action verb |
| "unlock the potential" | state the specific outcome |
| "in today's fast-paced world" | delete |
| "needless to say" | delete |

### 10. No throat-clearing

Start with substance. Delete the preamble. Never open with "Let me explain...", "It's important to note that...", "It's worth noting...", "In essence...", or "Let's explore..."

### 11. No hedging

Hedging makes you sound uncertain even when you are correct. State facts directly.

| Hedged | Direct |
|--------|--------|
| "I think we should..." | "We should..." |
| "It would be great if..." | "Please do X" |
| "Should be able to..." | "Can complete..." |
| "Basically..." | delete |
| "Generally speaking..." | be specific or remove |
| "One might argue..." | "This indicates..." |

### 12. No transition-word overuse

LLMs default to formal Victorian connectors. Use plain ones or break the paragraph.

| Overused | Better |
|----------|--------|
| Moreover / Furthermore | Plus, also, and |
| However / Nevertheless | But, though, still |
| Additionally | And, plus |
| Consequently / As a result | So, then |
| That being said | But (or delete) |
| Indeed / Interestingly | usually delete |
| In conclusion | end cleanly, do not announce it |

### 13. Give the reason, not just the mechanism

When a claim is non-obvious or surprising, state why before the how, and do not strip the justifying clause when tightening a passage. Explain why for design decisions with tradeoffs, non-obvious patterns, and breaks from convention. For mechanical steps with no alternatives ("Click Save"), the how is enough.

| Before | After |
|--------|-------|
| Enable RLS on all tables. | Enable RLS on all tables; it enforces access at the database level, so direct SQL cannot bypass it. |

### 14. Be specific

Vague quantifiers and abstract substitutes read as filler. Name the concrete figure or property. This includes spatial metaphors ("wide," "narrow," "broad," "reach") standing in for things that have specific names.

| Vague | Specific |
|-------|----------|
| This approach offers significant benefits. | Latency dropped from 450ms to 120ms. |
| The wider choices persist. | The persistent choices remain across restarts. |

## Relationship to writing-for-a-technical-audience

This skill is standalone; everything above is enforced here with no dependency on the ed3d skill. When `writing-for-a-technical-audience` is also installed, it adds technical-documentation craft this skill does not cover.

| Concern | Covered by |
|---------|-----------|
| Em-dash limit, contrastive framing, internal codes, metis, direct communication | human-voice |
| Intensity saturation review | human-voice (+ hook + agent) |
| Structural prose tells, rewrite-don't-patch | human-voice |
| AI phrase blacklist, throat-clearing, hedging, transition words, reason-not-mechanism, be-specific | human-voice (duplicated for portability) |
| Code-example design, progressive disclosure, API-reference structure | writing-for-a-technical-audience only |
