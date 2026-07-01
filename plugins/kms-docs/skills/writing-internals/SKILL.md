---
name: writing-internals
description: Use when writing or revising a maintainer or architecture document about the machinery of a project: data flow, module boundaries, invariants, why-decisions. Covers machinery-is-the-subject scope, an inverted leak model (only secrets/tokens/real-data are sensitive), the shared machine-writing tells checklist, and the review gate.
---

# Writing Internals

A self-contained rulebook for writing maintainer and architecture documentation that describes the machinery of a system. It restates prose rules inline so it stands on its own. The leak model and scope rules are the inverse of `writing-documentation`: architecture, module boundaries, and data flow are the permitted and expected subject; only secrets, tokens, and real production data are sensitive.

Scope: how to write docs that describe the internal machinery, architecture, and design of a system. For engineers, maintainers, and future authors reading how the system is built and why. Not for user-facing documentation or public guides.

## The reader

Every maintainer doc has one reader: a future engineer (yourself in six months, a colleague, a new team member) trying to understand how the system works, why it was built this way, and what will break if they change it.

This reader needs **self-contained sections** and **clear linkage to source**. They will jump to a section mid-document and must understand what they are reading without having read everything before it.

- Give every section a descriptive heading that names its subject.
- Define a term where it is first used *in that section*, not "as described above."
- Do not rely on reading order. When a section depends on another, link to it explicitly.
- Cite source code or commit hashes where the reader can verify the machinery you describe.

## Scope: document the machinery, not the surface

Describe the system as it is built and why. Architecture, module boundaries, data flow, invariants, and design decisions are the expected subject here: the opposite of user-guide scope.

- **Architecture and module names are the subject.** Name internal services, data structures, and components. Readers need to know how the system is organized to understand what they are reading.
- **Data flow and control flow are the subject.** How data moves through the system, which components own which transformations, when invariants must hold.
- **Why-decisions are the subject.** Rejected alternatives, historical coupling, tradeoffs. If you changed the system and later readers wonder "but why not do it the other way," document the constraint or the reason.
- **Schema shape and internal structure are the subject.** Table names, column names, field shapes, nested structures. Readers need the exact names to grep the codebase and reason about migrations.
- **Dependency names and their roles are the subject.** Which libraries the system uses, what each one is responsible for, why that choice was made.
- **Implementation limits and performance characteristics are the subject.** Not as a marketing claim, but as a constraint on what the code can do and how future authors should think about it.

Prefer affirmative phrasing. Write "the reducer owns the rollup transform and guarantees idempotence by hashing input" rather than "the reducer does not emit duplicate rollups." Both say the same thing; the first names the actor and the invariant.

## Leak model (inverted)

Machinery documentation has sensitive categories that should not appear. The leak model for maintainer docs is the inverse of user guides:

**Sensitive (must never appear):**
- Secrets, tokens, credentials, API keys, and passwords in any form.
- Internal hostnames and URLs that are not public (e.g., internal orchestration systems, private registries, non-routable IPs).
- Real customer, constituent, or production data used as examples (names, email addresses, account identifiers, records).
- Personal data of employees or internal teams.

**Not sensitive (permitted and expected subject):**
- Architecture, module names, and component names.
- File paths within the repository.
- Schema shape: table names, column names, field names, nested structure.
- Control flow: function names, method names, entrypoint names.
- Data flow: how data moves through the system, which component produces what and which consumes it.
- Dependency names and their roles in the system.
- Internal service names (internal to the org, not secrets themselves).
- Configuration key names (their values, if secret, are not; the keys themselves are architecture).

## Ambiguous cases, resolved explicitly

These edge cases appear often in maintainer docs. The rule for each:

**Dependency version pins:** Permitted. A version pin is architecture. If a specific version is pinned because it contains a fix the system depends on, name the fix and the bug number if there is one. A version pin that encodes a private registry token is sensitive; the token is not (the pin is).

**Internal service names:** Permitted as architecture unless the name is itself a secret or a non-public hostname (e.g., `db-prod-01.internal` is not public; `postgres-primary` is internal jargon). The rule: if a reader can learn this name by searching the codebase or the internal docs, it is architecture. If they cannot, if it is a registered secret or a non-routable hostname, then it is sensitive.

**Example data:** Synthetic or redacted only. Never paste real records, real email addresses, or real account identifiers. A schema example can name the columns by their real names; it cannot populate them with real data. Use anonymized/redacted examples: `user_id=123`, `account_name="acme_demo"`, `created_at=2024-01-15T00:00:00Z`.

**Config keys:** Permitted. The key name is architecture. Its value, if a secret (API key, password, token), is not; describe it as `<secret>` or name its role. Example: "The `STRIPE_API_KEY` environment variable holds the Stripe API key."

**README preambles that describe the project's nature:** Permitted. A maintainer doc may name the project, its purpose, and how it fits into the larger system. User-guide docs avoid this; maintainer docs include it.

## Reviewer effect

The editor and reviser, reading this in place of `writing-documentation`, apply machinery scope. They must NOT flag architecture prose as a scope violation or an implementation leak. A sentence naming a module, a table, a function, or a data-flow detail is on-scope for a maintainer doc; the same sentence would be out of scope in a user guide.

A reviser must not strip machinery content "from intent" to match user-guide phrasing. A phrase like "the ingester writes to the `events` table" is not an implementation detail to be hidden; it is the core subject.

The fact-checker, reading this leak model rather than the user-guide leak categories, permits architecture content while catching secrets. A sentence naming a module and a table will not trigger a leak flag. A sentence containing an API key, a real account name, or an internal hostname will.

## Prose voice and the tells checklist

The prose-voice rules and the machine-writing tells checklist live in the shared `prose-voice-rules` skill. Read it in full; it is required reading for the writer, editor, and reviser.

## The review gate

A first draft is not a finished page. You will not remove the tells in one pass.

After drafting, send the page to **independent reviewers**:

- Use **more than one** reviewer.
- **At least one reviewer must be a different model** from the one that drafted.
- Reviewers check the page against this skill's rules and hunt the tells from `prose-voice-rules`.

Then revise. Two rules for revising:

1. **A reviewer finding is input, not a verdict.** Reject a finding that is wrong.
2. **Rewrite from intent, do not patch-edit.** Editing in place extends a sentence, which produces clause barf. Start from what the sentence should say and write it fresh.

To run the gate with subagents, dispatch the page to two or more reviewer agents with an explicit instruction to flag every tell from the prose-voice checklist and to quote the offending sentence. Make at least one a different model than you used to draft.

## Verify claims against source

Maintainer docs state facts about the system, and a confident wrong fact is worse than a vague one. Two classes of claim are easy to get wrong:

- **Ordered and positional claims.** The order modules are initialized, the sequence of steps in a data-flow diagram, which component runs first. If you write "in this order" or "the first/last X," open the source and confirm.
- **Exact names and signatures.** Function names, table names, field names, configuration keys. Quote these from the source, not from memory.
- **Invariants and guarantees.** A claim that "the reducer guarantees idempotence" or "the cache is invalidated on every write" must be verified against the code that enforces it.

The review gate re-checks every ordered, named, and guaranteed claim against source, not only the prose.

## Quick reference

1. Self-contained sections: descriptive headings, terms defined in-section, links to deeper treatment allowed.
2. Document the machinery. Architecture, modules, data flow, why-decisions, schema shape. Affirmative phrasing.
3. Leak model inverted: secrets/tokens/real-data forbidden; architecture/names/structure permitted.
4. One precise noun per actor; cite source for exact names and sequences; link to source code.
5. Active voice, clear antecedents, no em-dashes, one spelling per term.
6. Hunt the tells checklist in every draft.
7. Review gate: 2+ reviewers, at least one a different model; findings are input, not verdict; rewrite from intent.
8. Verify claims about names, order, and invariants against source.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Mixing user-guide and machinery scope | Pick machinery scope for this doc. User surface details are out of scope. |
| Naming a module but not explaining its role | Name it and say what it does and why. |
| Stating an invariant without citing the code that enforces it | Cite the source: "See `src/reducer.rs` lines 42–58." |
| Swallowing implementation detail to seem simple | Machinery docs are for engineers; name the detail. |
| Treating a reviewer finding as a verdict | Reject wrong findings; the rules allow it. |
| Patch-editing a flagged sentence | Rewrite it from intent. |
| Drafting and shipping in one pass | Run the review gate. The tells survive a single pass. |
| Citing a fact from memory | Open the source and confirm. |
