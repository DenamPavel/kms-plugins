---
name: human-voice
description: "Use before writing prose a person will read on its own: a client memo, an essay, an email, slide or deck text, an article, a published document. Not for machine-facing files (implementation plans, findings, briefs, status and pickup docs, CLAUDE.md and skill files), code, or terminal replies. Anti-AI prose rules: phrase blacklist, em-dash limits, contrastive framing bans, hedging and throat-clearing, transition-word overuse, intensity modulation, structural prose tells."
user-invocable: false
---

# Human Voice

A self-contained writing-voice skill: personal anti-AI prose rules from client feedback, plus intensity modulation and structural prose tells. Everything the rules need is in this file; the reference under `references/` covers the intensity catalog and hook mechanics, and is only needed when a review is actually running.

**This is the default voice.** It is the fallback for prose of every kind, including fiction, essays, memos, and chat, whenever no other register has been chosen. Individual rules narrow their own scope where they say so; Rule 6 is the one that does.

**When to load it is a narrower question than what it governs.** Load this file before writing prose that leaves the machine and reaches a person on its own. Machine-facing writing is exempt from the loading step, not from the rules: an implementation plan, a findings file, a status doc, a CLAUDE.md, a commit message, and a terminal reply are all still written in this voice, but none of them is worth loading a rulebook for.

**One thing overrides it, and only for what it covers.** The `kms-docs` scope rulebooks govern product documentation and maintainer docs; `writing-documentation` in particular requires "you" to mean the reader and requires bold literal UI labels. Everywhere else, this skill governs alone.

## Rules

### 1. Em-dash limit

One em-dash per page maximum. Replace extras with commas, semicolons, or periods.

| Before | After |
|--------|-------|
| The data shows growth -- particularly in Q3 -- across all segments -- even underperformers. | The data shows growth, particularly in Q3, across all segments. Even underperformers improved. |

A stricter rule exists and does not contradict this one; it covers narrower ground. Product documentation written under `kms-docs` allows none at all. The narrower rule wins for the documents it covers.

### 2. No contrastive framing

The pattern `[negation] [thing], [pronoun] [other thing]` reads as formulaic AI output. Every LLM defaults to this structure.

| Before | After |
|--------|-------|
| This isn't a conversion signal, it's an acquisition signal. | This is an acquisition signal rather than a conversion signal. |
| It's not about reach, it's about frequency. | Frequency matters more than reach here. |

Alternatives: "rather than," "more than," "instead of," or restructure the sentence entirely.

### 3. No internal codes in client-facing text

Database field names, score thresholds, column names, and system references stay out of anything a client sees. Name the concept the reader cares about and leave the plumbing behind.

| Before | After |
|--------|-------|
| Accounts with `feature_flag_beta_v2 = 1` renew at a higher rate. | Accounts on the beta feature renew at a higher rate. |
| The `usr_dim` join rate is 62%. | We matched 62% of the user records. |
| Segment C scores above the 0.7 propensity cutoff. | Segment C is the most likely to convert. |

### 4. Terminology: "metis" over "tribal knowledge"

Use "metis" when referring to practical, experience-based knowledge that lives in someone's head. Brief gloss on first use is fine: "metis (practical, experience-based knowledge)."

### 5. Direct communication

Skip flattery, compliments, and enthusiasm markers. No "Great question!", "Excellent observation!", "That's a really interesting point!" Brief functional acknowledgments ("Good catch," "Fair point") are fine.

Get to the point. If the answer is three words, the response is three words.


### 6. Intensity review (warning, not ban)

None of these patterns is forbidden. They are legitimate craft used deliberately. The problem is accumulation: stacked up, the writing sounds like it is performing "writing" rather than communicating.

**Applies to:** prose a person reads (client memos, essays, emails, text destined for slides or documents). Plans, findings, briefs, status docs, and skill files are excluded.

Five patterns, in descending order of how often they show up:

- **Sensory-abstract pairings.** A physical sensation fused with an abstract concept: "bruised silence," "timestamp like a scar." One per passage can work. Ask what it accomplishes that a plain statement would not; if the answer is "it sounds literary," flatten it.
- **Atmospheric vagueness.** Words picked for mood over precision: ghosts, echoes, whispers, shadows, hums, flickering. "The room hummed with tension" is atmosphere. "Nobody spoke" is information. Default to information.
- **Compulsive personification.** Agency given to objects or abstractions as a reflex. Reserve it for where attributed intent matters to the point.
- **Structural repetition.** Consecutive sentences on the same syntactic template, whatever the device. Three or more in a row is always wrong; two with leading dependent clauses is often worth breaking up.
- **Register flatness.** Every sentence at the same intensity, heightened or clinical alike. Plain sentences make a striking one land.

**Density guideline:** one literary device per paragraph is fine, two should each be doing clear work, three is too many. Per-paragraph density stays constant regardless of document length.

The fix is almost always to remove or simplify, not to substitute a different device.

**Keep the judgement; drop the attitude, not the position.** Flattening a heated sentence must not cost the claim it was carrying. The cheapest way to clear a flag is to delete the sentence, and that is the wrong fix: it removes a position the writer held. Restate the judgement as a claim with a reason instead.

| Before | After |
|--------|-------|
| Which is a debugging surface we don't need. | Would add a debugging surface with no offsetting benefit. |
| Weighting by raw spend here is exactly backwards. | Weighting by raw spend is counterproductive here; it lets a handful of large accounts set the profile. |

After acting on any flag from this rule, reread the passage and confirm every position in the original is still stated. If a claim is gone, it was deleted rather than flattened. Put it back.

Full pattern catalog, examples, and the automated-review mechanics: `references/intensity-review.md`.

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
| Real-time sync, which competing tools do not offer. | Changes sync within one second. |

**Structure-preview sentences.** "This page covers..." or "The findings fall into three groups..." when a heading already says so. Delete the preview; let the heading carry it.

### 8. Fixing flagged prose: rewrite, do not patch

When you act on any flag from this skill, rewrite the sentence or paragraph from its intended meaning rather than patch-editing in place. Start from what the sentence should say and write it fresh. Editing around a problem tends to extend the sentence and produce clause barf, which is how the structure got bad in the first place.

**Check the length afterward.** A style pass preserves content; it does not shorten a document. Compare the line or word count against the original, and on a document-scale rewrite, diff the two. A content-preserving rewrite lands close to its original length. A large drop means content was lost rather than compressed, and every removed line needs to be accounted for. This is the cheapest available check on the most common damage a style pass does.

## Shared prose rules

Rules 9 through 14 are general-purpose prose rules that apply to all writing, not just voice.

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
