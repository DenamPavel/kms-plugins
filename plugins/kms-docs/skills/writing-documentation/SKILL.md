---
name: writing-documentation
description: Use when writing or revising product or tool documentation - user manuals, user guides, READMEs, reference pages, or help content. Covers self-contained sections for human and retrieval readers, behavior-not-implementation scope, actor and terminology discipline, code samples, the machine-writing tells checklist, a multi-reviewer review gate, and keeping docs synced to code.
---

# Writing Documentation

A self-contained rulebook for writing documentation that serves both a person and a machine. It restates the doc-relevant prose rules inline so it stands on its own. For fuller prose-voice enforcement, pair it with the `kms-human-voice` skill.

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

- **No implementation detail in the "using" sections.** No internal architecture, no class names, no data structures. Name an internal component only when the user can observe it: it appears in the UI, in CLI output, in an error message, or as a config key. If the user never sees the name, do not use it.
- **Do not publish exact internal limits or counts.** Describe capacity qualitatively unless the exact number is a documented contract.
- **Prefer affirmative phrasing.** Write "X accepts A and B" rather than "X does not accept C" when both say the same thing. Do not omit a limitation a reader needs to predict behavior; document the limit plainly where it applies, and frame it as the boundary of a capability rather than an apology.
- **Document the product, not the project.** A user manual covers the product surface. It does not discuss the project's nature, licensing, or where to file issues unless that is itself a documented feature.

## Actor and terminology discipline

Pick a precise noun for each actor in the system and never blur them. As an example, in a coding agent "the model" produces the token stream and requests a tool call, while "the harness" handles that request, runs the tool, and persists state. Conflating the two produces sentences that are simply wrong about who does what.

For your docs:

- **"You"** is always the reader.
- Establish a **controlled vocabulary** of actor nouns before you write, and use the same noun for the same thing every time. Default to the product name as the actor for most behavior rather than naming internal pieces.
- **Name nested config and identifiers unambiguously.** When prose or a table names a key nested under another, write the full dotted path (`product.model`, `product.transitions.<target>.allowed`) rather than relying on indentation or a "nested under X" sentence. The full path survives being read out of context, which is exactly what a retrieval reader gets.

Record the controlled vocabulary and the structure (sidebar groups, page order) in the docs project itself, not in this skill. See "Per-project setup" below.

## Referring to UI elements

When the docs name something the user acts on, types, or reads on screen, write it the same way every time.

- **Use "select," not "click."** "Select" is input-agnostic: it covers mouse, trackpad, touch, and keyboard. "Click" assumes a mouse and reads wrong on touch and accessible devices. Write "select **Export**," not "click **Export**." Reserve verbs like "tap" or "press" for docs scoped to one specific device.
- **Bold the literal label** of a control the user acts on: select **Export**, open the **Period** dropdown.
- **Write menu paths with a separator**, not prose: **File > Export > CSV**, not "open the File menu, then Export, then CSV."
- **Match the on-screen capitalization and wording** of a label exactly. If the button says "Save changes," do not write "Save Changes."
- **Name the control type** when it is not obvious: the **Store set** toggle, the **Search** field, the **Top movers** list.

## Prose voice and the tells checklist

The prose-voice rules and the machine-writing tells checklist live in the shared `prose-voice-rules` skill, shared with `writing-internals`. Read it in full; it is required reading for the writer, editor, and reviser.

## Page structure

- **Headings name their subject in a consistent grammatical form.** Pick one shape per page and hold it: noun phrases ("Configuration", "Permissions") or gerund task phrases ("Configuring access", "Managing work"), not a mix. Use sentence case unless the project sets title case.
- **A task is a numbered procedure, and every task on a page uses that one shape.** One action per step, in imperative mood, in the order the user performs them. State the result when it is not obvious ("Select **Start**. The daemon begins watching the folder."). State any precondition before step 1. Do not write one task as numbered steps, the next as a prose paragraph, and a third as a bare bullet list; pick the numbered procedure and hold it for every sequence the reader performs in order. Reserve bullets for sets the reader does not perform in sequence (independent options, field enumerations); a field list can sit as sub-bullets under the numbered step that opens the form.
- **Use a list for a set the reader scans, a table for a set with shared attributes.** Options with a name and a meaning are a table (a column each for name and meaning). A sequence of choices or items is a list. Keep list items grammatically parallel.
- **Document a table or grid as a table.** When the page describes a data grid or table in the product, present its columns in a markdown table, one row per column, with a **Column** cell and a **Description** cell. Do not list the columns as an inline comma-separated run ("the columns are: **A**, **B**, **C**") or a bare bullet list. Fold any per-column meaning the surrounding prose would otherwise state into the Description cell, and keep the rows in the on-screen column order.
- **Prose carries the reasoning; lists and tables carry the enumerations.** Do not bury a "why" inside a table cell.

## Code samples

- **Tag every code block with its language** so it highlights and so a retrieval reader knows the format.
- **A sample runs as written, or is marked a fragment.** Do not show a snippet that fails if pasted whole without saying it is partial.
- **Use one placeholder convention** for values the reader supplies, such as `<your-api-key>`, and never paste a real credential or token.
- **Show output only when the reader needs it to confirm success,** and label it as output, separate from the command.
- **Do not include the shell prompt character** (`$`, `>`) in a command the reader will copy.

## Screenshots and images

A screenshot is a visual aid for the reader who learns by seeing. Screenshots are welcome, including of forms and ordinary screens. They are subject to one governing rule and a few hard constraints.

**A screenshot supplements the text; it never carries information alone.** The prose, the numbered steps, and the field or column tables must be complete on their own, so a reader who never sees the image loses nothing. That protects the two readers a picture cannot serve: the retrieval reader (search, a RAG index, an LLM reading one passage) and the reader using a screen reader. When the text is already complete, a screenshot that repeats it is not waste; it serves visual learners, and that redundancy is the point. Never let a fact, a label, a default, the options in a control, or a step live only in an image, or only in its alt text. Naming a control in the steps does not carry its options if those appear only in the picture.

A form, then, still gets its numbered procedure and its field table, and you may add a screenshot of it on top. The text is the source of truth; the image is the aid.

Hard constraints on any screenshot you include:

- **Capture from the running product, never a mockup.** A screenshot is a factual claim about what the product looks like. Take it from the actual build; never hand-edit pixels to show a state the product cannot produce.
- **No real data in the frame.** The DO-NOT-LEAK list extends to pixels. Real names, customer or constituent records, email addresses, tokens, internal hostnames and URLs, and account identifiers must not appear. Capture against a seeded or demo dataset, or redact the region with a solid block before the image ships. Do not blur sensitive data; a blur can be reversed.
- **Crop to the subject.** Show the panel or control the section is about, not the whole desktop. Trim browser chrome and unrelated UI.
- **Write alt text that states what the image shows**, for the retrieval reader and the reader who cannot see it. Describe the meaningful content ("the campaign tracker sorted by **Status** descending"), not the medium ("screenshot of the app"). Describe only what the capture actually contains; do not invent colors, labels, counts, or states you have not confirmed are in the image. Alt text is required on every image.
- **Add a caption only when a sighted reader needs context the alt text does not give** (which build, which state). Most images need none.
- **Name and store images by the surface they show**, in the docs project's image directory. Keep the path and naming convention in the docs repo, not in this skill.

A screenshot ages: a UI change that leaves the words correct can still date the picture. Cosmetic drift (a restyled button, a new color) is an accepted cost, because the text carries the facts. An image that contradicts the current text is a different matter: a dropdown missing an option the steps list, or a renamed control the steps reference, is wrong rather than merely dated, and you recapture or remove it. Treat each screenshot as part of the page-to-source map so the owning screen's changes flag it for a recapture.

## Leak model (user-guide)

User-facing documentation has sensitive categories that should not appear. The leak model for user guides is:

- **Implementation details.** No internal class names, function names, database schemas, or data structures except where the user can see them (in an error message, a config key, or a UI label).
- **Internal architecture and internal component names.** No internal service names, codebase organization, or naming that reveals the product's structure.
- **Internal limits and counts.** No exact performance limits, database row limits, or internal measurements unless they are a documented contract.
- **Framework and library names.** No mention of internal frameworks (e.g., the HTTP framework) unless it is directly observable by the user.
- **Table and column names.** No database table names, column names, or schema details.
- **API routes and endpoints.** No internal API routes or endpoint paths used only by the system.
- **Secrets, tokens, and credentials.** No API keys, tokens, credentials, or authentication material in any form.
- **Internal hostnames and URLs.** No internal hostnames, internal-only URLs, or internal infrastructure domains.
- **Competitive framing.** No claims about how this product compares to competitors; state the capability and let the reader draw their own conclusions.

## Verify claims against source

Documentation states facts about the product, and a confident wrong fact is worse than a vague one. Two classes of claim are easy to get wrong from memory, so check each against the source before you write it:

- **Ordered and positional claims.** The order controls appear in a sidebar, the sequence of steps in a flow, which item is first or last. If you write "in this order" or "the first/last X," open the source that renders it and confirm. When the order is volatile or you cannot confirm it, present the set without sequencing rather than assert a sequence you have not checked.
- **Counts, defaults, and labels.** Exact button labels, which option is the default, how many items a list shows. Quote these from the source, not from memory.
- **Screenshots.** A screenshot is a claim about what the product looks like now. Capture it from the running build, confirm it does not contradict the surrounding text, and recapture or remove it when it does. Never mock or hand-edit one. The text must carry every fact on its own; the image only supplements it.

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

A human must read and correct a machine-written doc change, or rewrite it, before it ships. That step is not optional and not yours to skip or assume done.

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
- The **structure**: sidebar groups and their order, what belongs in "using" vs "reference," sentence case or title case for headings.
- The **page-to-source map**, kept current as pages are added.
- The **image directory and naming convention** for screenshots, and the project's **safe-capture plan**: how each documentable surface is rendered with no real data (a built-in demo mode, a seeded dataset, a demo instance, an empty account, or redaction), how a capture agent confirms the safe state, and any surface that has no safe option (so the capture plan avoids it).
- Any **release-notes/changelog conventions**: where entries live, what level of detail a bug-fix bullet versus a feature bullet gets, how breaking changes are labeled.
- Optional **migration tips** for users coming from a predecessor tool, used only where a real difference exists.

## Quick reference

1. Two readers (human + retrieval) so write self-contained sections: descriptive headings, terms defined in-section, links allowed.
2. Document the surface, not the machinery. Affirmative phrasing, but never omit a limitation the reader needs. No exact internal limits.
3. One precise noun per actor; "you" is the reader; full dotted paths for nested keys; bold literal UI labels.
4. Active voice, clear antecedents, no em-dashes, one spelling per term.
5. Code blocks: language-tagged, runnable or marked partial, placeholders not credentials.
6. Screenshots are a welcome visual aid but never the sole source: the text must be complete without them. Capture from the live product, no real data in frame, crop, required alt text.
7. Hunt the tells checklist in every draft.
8. Review gate: 2+ reviewers, at least one a different model; findings are input, not verdict; rewrite from intent.
9. Flag every doc change to the human in the same turn, and keep docs synced to code both directions.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Drafting and shipping in one pass | Run the review gate. The tells survive a single pass. |
| Patch-editing a flagged sentence | Rewrite it from intent. |
| "Self-contained" read as "no links" | Links to deeper treatment are fine; reliance on reading order is not. |
| Omitting a real limitation to stay positive | Affirmative phrasing is about wording, not about hiding boundaries. |
| Treating a reviewer finding as a verdict | Reject wrong findings; the rules allow it. |
| Changing docs silently inside other work | Flag it to the human in the same turn, by filename. |
| Putting project specifics in this skill | They live in the docs repo; this skill stays generic. |
| Letting a fact live only in a screenshot | The text must be complete without the image; the screenshot supplements, never replaces. |
| Inventing visual detail in alt text | Describe only what the capture shows; do not add colors, labels, or counts you have not confirmed. |
