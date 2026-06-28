---
name: writing-documentation
description: Use when writing or revising product/tool documentation, user manuals, READMEs, or reference pages - covers the two-reader model (human plus retrieval), self-contained sections, behavior-not-implementation scope, actor and terminology discipline, the machine-writing tells checklist, a mandatory multi-reviewer cross-model review gate, flagging doc changes for human review, and keeping docs synced to code
---

# Writing Documentation

A self-contained rulebook for writing documentation that serves both a person and a machine. It pairs with `kms-human-voice` (fuller anti-AI prose enforcement) and ed3d-house-style's `writing-for-a-technical-audience` (code-example design, progressive disclosure, API-reference structure), and depends on neither. The voice rules that overlap with those skills are restated here on purpose so this skill stays portable on its own.

Scope: how to write docs that describe a product or tool to its users. Not for design docs, internal architecture notes, or commit messages.

## The two readers

Every page has two readers. The first is a person using the product. The second is a retrieval system: site search, a RAG index, or an LLM agent that loads one passage to answer a question. Write for both.

The consequence is **self-contained sections**. A reader who lands in the middle, human or machine, must make sense of a section without having read the ones before it.

- Give every section a descriptive heading that names its subject.
- Define a term where it is first used *in that section*, not "as described above."
- Do not rely on reading order. No back-references that only resolve if the reader started at the top.

**Self-contained does not mean link-free.** A section may describe something briefly and link to its full treatment elsewhere. That is correct for a feature list where each item has a deeper home. The test is whether the section stands on its own, not whether it avoids links. "`/compact` summarizes your working context (see Sessions)" stands on its own; it does not depend on reading order. A brief-description-plus-link is not a violation.

**One page owns each reference; do not copy it.** When another page owns a reference table (the full config-key table, the complete API surface), describe inline only the part this section's reader needs, then link to the owner. Do not reproduce the owned table. A second copy is a second thing to keep in sync, and the copies drift. Describe-and-link, never duplicate-and-link.

## Scope: document the surface, not the machinery

Describe behavior as a user experiences it from outside.

- **No implementation detail in the "using" sections.** No internal architecture, no class names, no data structures. Name an internal component only when a user-visible behavior genuinely cannot be explained without it, and mark that as the deliberate exception it is.
- **Do not publish exact internal limits or counts.** Describe capacity qualitatively unless the exact number is a documented contract.
- **Frame in positive terms.** Document what the product does. Omit limitations unless they bear on security or data safety, where the reader must know.
- **Document the product, not the project.** A user manual covers the product surface. It does not discuss the project's nature, licensing, or where to file issues unless that is itself a documented feature.

## Actor and terminology discipline

Pick a precise noun for each actor in the system and never blur them. The gist this skill generalizes drew a hard line between "the model" (produces the token stream, requests a tool call) and "Polytoken" (handles the request, runs tools, persists state). Conflating them produced wrong sentences.

For your docs:

- **"You"** is always the reader.
- Establish a **controlled vocabulary** of actor nouns before you write, and use the same noun for the same thing every time. Default to the product name as the actor for most behavior rather than naming internal pieces.
- **Name nested config and identifiers unambiguously.** When prose or a table names a key nested under another, write the full dotted path (`product.model`, `product.transitions.<target>.allowed`) rather than relying on indentation or a "nested under X" sentence. The full path survives being read out of context, which is exactly what a retrieval reader gets.

Record the controlled vocabulary and the structure (sidebar groups, page order) in the docs project itself, not in this skill. See "Per-project setup" below.

## Voice

These are hard rules. A first draft will not satisfy them on its own; the review gate exists partly to catch the misses.

- **Active voice, always.** "The product holds the prompt," not "the prompt is held." Use passive only when the actor is genuinely unknown or irrelevant and no active phrasing reads naturally.
- **Every pronoun needs a clear antecedent.** A reader landing cold must be able to say what "it," "this," "that," or "they" points to. When the referent is even slightly ambiguous, name the thing instead.
- **No em-dashes.** Every em-dash is a period, a comma, a colon, or parentheses. A sentence built around a pair of them is usually two sentences or a parenthetical. Recast it; do not search-and-replace.
- **Lead with what something does**, then how it does it.
- **One consistent spelling per term.** Pick `frontmatter` or `front matter`, `dropdown` or `drop-down`, and hold it across the whole doc set. Literal file and schema names keep their exact spelling.

## The tells checklist

Machine-written prose has recognizable tells. Hunt these in every draft and in review. This is the operational core of the skill.

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
| **Repetitive sentence structure** | Two leading-dependent-clause sentences in a row is sometimes wrong; three same-shape sentences in a row is always wrong | Vary the shape. |
| **Unverified positional/ordered claim** | "the controls, in this order: ..." or "the first/last X" written from memory | Open the rendering source and confirm the order, or drop the ordering promise. |

## Verify claims against source

Documentation states facts about the product, and a confident wrong fact is worse than a vague one. Two classes of claim are easy to get wrong from memory, so check each against the source before you write it:

- **Ordered and positional claims.** The order controls appear in a sidebar, the sequence of steps in a flow, which item is first or last. If you write "in this order" or "the first/last X," open the source that renders it and confirm. When the order is volatile or you cannot confirm it, do not promise an order: present the set without sequencing rather than assert a sequence you have not checked.
- **Counts, defaults, and labels.** Exact button labels, which option is the default, how many items a list shows. Quote these from the source, not from memory.

The review gate re-checks every positional, ordered, default, and label claim against source, not only the prose.

## The review gate

A first draft is not a finished page. You will not remove the tells in one pass.

After drafting, send the page to **independent reviewers**:

- Use **more than one** reviewer.
- **At least one reviewer must be a different model** from the one that drafted.
- Reviewers check the page against this skill's rules and hunt the tells above.

Then revise. Two rules for revising:

1. **A reviewer finding is input, not a verdict.** Reject a finding that is wrong. The self-contained-vs-link distinction above is a worked example of a finding worth rejecting (a brief-description-plus-link is fine, not a violation).
2. **Rewrite from intent, do not patch-edit.** Editing in place extends a sentence (you append a qualifier, splice a clause), which is what produces clause barf in the first place. Start from what the sentence should say and write it fresh.

To run the gate with subagents, dispatch the page to two or more reviewer agents with an explicit instruction to flag every tell from the checklist and to quote the offending sentence. Make at least one a different model than you used to draft.

## Flag every doc change to the human

When you change documentation, **here or as a side effect of other work**, flag it to the human prominently and proactively in the same turn you make the change. Name the files you touched and say plainly that the change needs human review.

Machine-written doc changes are a starting point, not a finished product. They will need to be read and corrected, or rewritten, by a human. That step is not optional and not yours to skip or assume done.

## Keeping docs current

Docs are load-bearing. A page documents a behavior, and readers use that page as the product contract. When the behavior changes, the page changes with it. Treat the docs as part of the acceptance criteria for an observable product change, not an optional follow-up.

Observable changes include UI/CLI behavior, API routes and payloads, config keys and their meaning, permission semantics, built-in tool behavior, and anything named in the page-to-source map. When a change touches one of those, propose the matching doc change in the same work. If the right page does not exist, say so and name the page that should be created.

Wire the code/docs link in **both directions**:

- **Code to docs.** Near the code that owns a documented behavior, leave a note in the nearest `AGENTS.md` or `CLAUDE.md`: "if you change this, update `<page>`."
- **Docs to code.** Maintain a page-to-source map so the link is discoverable from the docs side.

Page-to-source map template (lives in the docs repo, populated as pages are written):

| Page | Documents | Source of truth |
|------|-----------|-----------------|
| `using/feature-x.md` | The behaviors a user sees on feature X | `src/path/to/feature_x` |

## Per-project setup

This skill is the generic rulebook. Each docs project pins down its own specifics in the docs repo (a `CONTRIBUTING.md`, `AGENTS.md`, or a top-of-tree docs guide), not here:

- The **controlled vocabulary** of actor nouns and the one chosen spelling per term.
- The **structure**: sidebar groups and their order, what belongs in "using" vs "reference."
- The **page-to-source map**, kept current as pages are added.
- Any **release-notes/changelog conventions**: where entries live, what level of detail a bug-fix bullet versus a feature bullet gets, how breaking changes are labeled.
- Optional **migration tips** for users coming from a predecessor tool, used only where a real difference exists.

## Quick reference

1. Two readers (human + retrieval) → self-contained sections, descriptive headings, terms defined in-section, links allowed.
2. Document the surface, not the machinery. Positive framing. No exact internal limits.
3. One precise noun per actor; "you" is the reader; full dotted paths for nested keys.
4. Active voice, clear antecedents, no em-dashes, one spelling per term.
5. Hunt the tells checklist in every draft.
6. Review gate: 2+ reviewers, at least one a different model; findings are input, not verdict; rewrite from intent.
7. Flag every doc change to the human in the same turn.
8. Keep docs synced to code, wired both directions.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Drafting and shipping in one pass | Run the review gate. The tells survive a single pass. |
| Patch-editing a flagged sentence | Rewrite it from intent. |
| "Self-contained" read as "no links" | Links to deeper treatment are fine; reliance on reading order is not. |
| Treating a reviewer finding as a verdict | Reject wrong findings; the rules allow it. |
| Changing docs silently inside other work | Flag it to the human in the same turn, by filename. |
| Putting project specifics in this skill | They live in the docs repo; this skill stays generic. |
