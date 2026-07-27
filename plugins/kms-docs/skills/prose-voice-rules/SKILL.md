---
name: prose-voice-rules
description: The shared machine-writing tells checklist and prose-voice rules for product documentation. Referenced by both writing-documentation (user guides) and writing-internals (maintainer docs) scope rulebooks. Describes machine-writing tells — passive voice, unclear antecedents, false equations, clause barf, and others — with concrete fixes.
---

# Prose Voice and Writing Tells

Machine-written prose has recognizable tells. Hunt these in every draft and in review.

## Voice

These are hard rules. A first draft will not satisfy them on its own; the review gate exists partly to catch the misses.

- **Active voice, always.** "The product holds the prompt," not "the prompt is held." Use passive only when the actor is unknown, or when the actor is the product and the sentence already names it. Otherwise name the actor.
- **Every pronoun needs a clear antecedent.** A reader landing cold must be able to say what "it," "this," "that," or "they" points to. When the referent is even slightly ambiguous, name the thing instead.
- **No em-dashes.** Every em-dash is a period, a comma, a colon, or parentheses. A sentence built around a pair of them is usually two sentences or a parenthetical. Recast it; do not search-and-replace.
- **Lead with what something does**, then how it does it.
- **One consistent spelling per term.** Pick `frontmatter` or `front matter`, `dropdown` or `drop-down`, and hold it across the whole doc set. Literal file and schema names keep their exact spelling.

## The tells checklist

Machine-written prose has recognizable tells. Hunt these in every draft and in review. Some rows restate the Voice rules above as scan targets; that overlap is deliberate.

| Tell | What it looks like | Fix |
|------|--------------------|-----|
| **Passive voice** | "The prompt is held," "is configured by" | Name the actor: "The product holds the prompt." |
| **Unclear antecedent** | "Understanding it is key," "This lets you..." | Name the thing the pronoun stands for. |
| **Structure-preview sentence** | "This page covers...," "Commands fall into three groups..." | Delete. The headings already say it. |
| **Reassurance/summary tail** | "...so you can queue follow-ups without losing your place" | Delete. It restates what the reader just read. |
| **Repetition rhythm** | Anaphora and triples: "you write there, you reference there, you reach back there" | Collapse to one declarative sentence. |
| **Over-packed list-sentence** | Many examples crammed in so the verb arrives late | Split into separate sentences or a list. |
| **Em-dash** | Any `--` or `—` | Recast as period, comma, colon, or parentheses. |
| **Informal-verb drift** | "wave through," "point at" where "reference" is the established verb | Use the page's established verb. |
| **Salesmanship** | "which those tools do not offer," competitive tails | State the capability; let the reader draw the contrast. |
| **False equation** | "X is Y" equating a thing with the machinery behind it ("That decision is the permission system") | Replace the copula with the real verb: *produces*, *computes*, *controls*. |
| **Spatial metaphor for a named property** | "the wider choices," "broad," "reach" for things with a specific name | Name the actual property: "the persistent choices." |
| **Clause barf** | A string of comma-clauses each adding a sliver ("approve a recurring action once, at the scope you choose, and stop being asked") | Commit to one declarative shape; name the deferred detail inline. Rewrite, don't trim. |
| **Hedge-alternative tail** | "...or [obvious secondary path]" appended to a complete instruction | Cut the tail; keep the primary instruction. |
| **Cross-reference circumlocution** | "rendered the way Templating describes," "as the X page explains" | Write "see [X]" or "as described in [X]." Never leak how the docs were built ("this section mirrors," "the diff against..."). |
| **Mechanism without reason** | A surprising behavior stated as bare mechanism, so the reader balks before the justification | Give the reason *before* the mechanism. Verify the behavior against source first; a confident wrong reason is worse than none. |
| **Comma splice** | Two independent clauses joined by a comma | Period or semicolon. |
| **Repetitive sentence starts** | Multiple sentences in a row opening with the same word (including "The" or the product name) | Vary the openings. |
| **Repetitive sentence structure** | Three same-shape sentences in a row (for example three leading-dependent-clause openers) | Vary the shape. Flag two in a row for a second look. |
| **Mixed instruction formats** | The same kind of step rendered as a numbered list in one section, a prose paragraph in another, a bare bullet list in a third | Convert every sequential task to the same numbered-procedure shape; keep bullets only for non-sequential enumerations. |
| **Table described as a comma list** | A grid's columns written inline ("columns: **A**, **B**, **C**") or as a bare bullet list | Render the columns as a **Column** / **Description** table, in on-screen order. |
| **Unverified positional/ordered claim** | "the controls, in this order: ..." or "the first/last X" written from memory | Open the rendering source and confirm the order, or drop the ordering promise. |
| **Bare or vague link text** | "click here", a raw URL | Use the destination's name as the link text. |
| **Image-only information** | A fact a reader needs (a label, a default, a field, the options in a dropdown, a step) that appears only in a screenshot or its alt text, not in the page's prose, steps, or tables. Naming a control is not enough if its options live only in the picture: "select the **Role** dropdown" while Viewer/Editor/Admin appear only in the image. | Carry the fact in the body text (prose, steps, or a table). The image and its alt text may repeat it; they do not replace it. |
| **Real data in a screenshot** | A captured screen showing real names, records, email addresses, or internal URLs | Recapture against a seeded or demo dataset, or redact the region with a solid block (not a blur). |
| **Missing or medium-naming alt text** | No alt text, or alt text like "screenshot of the dashboard" | Describe the meaningful content the image shows, not the medium. |
