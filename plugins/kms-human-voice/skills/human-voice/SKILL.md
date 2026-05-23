---
name: human-voice
description: Use when writing any prose, documentation, client-facing text, or commit messages - enforces personal anti-AI phrasing rules, em-dash limits, contrastive framing bans, terminology preferences, and direct communication style
user-invocable: false
---

# Human Voice

Complements `writing-for-a-technical-audience` (ed3d-house-style), which covers broad AI-pattern avoidance: phrase blacklists, hedging, throat-clearing, transition words. This skill covers specific enforcement rules from client feedback.

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

## Automated enforcement

This plugin ships a PostToolUse hook that scans `.md` and `.txt` files after every Write/Edit. It catches:

- **Em-dashes**: flags when more than one ` -- ` appears in a file
- **Contrastive phrasing**: flags "not X, it's Y" patterns

Violations are non-blocking warnings. Fix them during finalization, not mid-draft.

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
