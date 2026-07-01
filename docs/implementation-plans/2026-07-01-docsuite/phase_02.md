# docsuite Implementation Plan — Phase 2: `writing-internals` scope rulebook

**Goal:** A machinery-is-the-subject scope rulebook (`writing-internals`) with an explicit inverted leak model, read by the writer, editor, and reviser in `maintainer` mode, and supplying the leak model the fact-checker reads. It references the shared prose-voice fragment from Phase 1 rather than duplicating the tells checklist.

**Architecture:** A new self-contained skill file that mirrors the shape of `writing-documentation` but inverts scope and leak semantics: architecture/module boundaries/data flow/invariants are the permitted subject; only secrets, tokens, credentials, internal hostnames, and real production data are sensitive. The editor and reviser, when dispatched in `maintainer` mode (wiring already added in Phase 1), read this in place of `writing-documentation`; the fact-checker reads its leak model.

**Tech Stack:** Claude Code plugin — Markdown skill file. No code, no external dependencies. Verification via subagent RED-GREEN-REFACTOR with ad-hoc inputs.

**Scope:** Phases 1–5 of the 8-phase design (this plan).

**Codebase verified:** 2026-07-01 via codebase-investigator against `plugins/kms-docs` v2.1.0.

> **Verification model:** See phase_01.md ("Verification model for this plan"). No automated test framework; subagent tests + ad-hoc fixtures; durable fixtures and standalone acceptance are Phase 8.

---

## Acceptance Criteria Coverage

This phase implements and (partially) tests:

### docsuite.AC3: The maintainer doc documents machinery
- **docsuite.AC3.3 Success:** The maintainer doc clears GATE 1 and GATE 2, with the editor and reviser applying machinery scope (not user-guide scope).
- **docsuite.AC3.4 Failure:** `doc-fact-checker`, reading the investigation's inverted leak model and list, catches a maintainer doc that leaks a secret/token/internal hostname/real-production-datum, while permitting architecture/module/schema-shape content.

### docsuite.AC1: The per-doc engine is mode-parameterized and backward-compatible
- **docsuite.AC1.4 Edge:** The shared prose-voice tells/rules live in exactly one fragment file; `writing-documentation` (user-guide scope) and `writing-internals` (machinery scope) both reference it. Scope rules are mode-specific and are not shared.

### docsuite.AC6: Standalone integrity and first-run setup
- **docsuite.AC6.2 Failure:** A bundled grep-based static check (written as part of this work, not assumed) finds no invocation of any external plugin, skill, or general-purpose agent from the new pieces.

> **Cross-phase note.** Phase 2 verifies the *rulebook's effect in isolation*: the editor/reviser applying `writing-internals` pass machinery content that user-guide scope rejects (the scope half of AC3.3), and the fact-checker using this leak model permits architecture while catching secrets (the leak half of AC3.4). The *full two-gate end-to-end* AC3.3 (a real maintainer doc clearing GATE 1 + GATE 2) lands in Phase 4, once the internals investigator (Phase 3) supplies a real grounding artifact and leak list. AC6.2's bundled static-check *script* is Phase 8; Phase 2's obligation is only that `writing-internals` itself invokes no external plugin/skill/agent (checked here by grep).

---

## Reference: verified state to mirror

`writing-documentation/SKILL.md` structure (v2.1.0, post-Phase-1): frontmatter (name/description); Scope section ("document the surface, not the machinery", 26–33); describe-and-link rule (L24); user-guide leak model (L93–94, L131: real names, customer/constituent records, emails, tokens, internal hostnames/URLs, account identifiers); review gate (144–159); and — after Phase 1 — a pointer to the shared fragment `prose-voice-rules.md` instead of an inline tells table. `writing-documentation` restates prose rules inline for standalone posture (L8) and has no required external plugin.

Phase 1 already made `doc-writer`/`doc-editor`/`doc-reviser` read "the mode's scope rulebook" and `doc-fact-checker` read "the mode's leak model + list", and added the mode-dispatch table naming `writing-internals` for `maintainer`/`agents-md`. Phase 2 supplies that file.

---

<!-- START_SUBCOMPONENT_A (tasks 1-3) -->

<!-- START_TASK_1 -->
### Task 1: Author `writing-internals/SKILL.md`

**Verifies:** docsuite.AC3.3 (scope half), docsuite.AC3.4 (leak-model half), docsuite.AC1.4

**Files:**
- Create: `plugins/kms-docs/skills/writing-internals/SKILL.md`

**Implementation:** Author a self-contained skill mirroring `writing-documentation`'s shape, with these sections:

1. **Frontmatter** — `name: writing-internals`; a description in the same style as `writing-documentation`, e.g. "Use when writing or revising a maintainer/architecture document — the machinery of a project: data flow, module boundaries, invariants, why-decisions. Covers machinery-is-the-subject scope, an inverted leak model (only secrets/tokens/real-data are sensitive), the shared machine-writing tells checklist, and the review gate."

2. **Scope: document the machinery, not the surface** (the inverse of `writing-documentation`'s Scope). Permitted and expected subject: data flow, module boundaries, component responsibilities, invariants, control flow, why-decisions (rejected alternatives, historical coupling), schema shape, dependency names. Explicitly state that architecture and internal names ARE the subject here — the opposite of the user-guide rulebook. Keep the affirmative-phrasing and "document the thing accurately" discipline.

3. **Leak model (inverted)** — state it as sharp category definitions so a leak-aware agent can judge a newly written sentence:
   - *Sensitive (must never appear):* secrets, tokens, credentials, API keys, passwords; internal hostnames/URLs that are not public; real customer/constituent/production data in examples; personal data.
   - *Not sensitive (permitted subject):* architecture, module and component names, file paths within the repo, schema shape (table/column names as structure), control flow, dependency names and roles.
   This is the leak *model* the fact-checker (and writer/editor/reviser) read in `maintainer`/`agents-md` mode; the repo-specific leak *list* comes from the investigator (Phase 3).

4. **Ambiguous cases, resolved explicitly** — at minimum: dependency version pins (permitted — they are architecture, not secrets, unless a pin encodes a private registry token); internal service names (permitted as architecture unless the name is itself a secret or a non-public hostname); example data (use synthetic/redacted; never paste real records); config keys (permitted; their *values* if secret are not). Decide and state each; do not leave "use judgment".

5. **Reviewer effect** — a short paragraph written so that the editor and reviser, reading this in place of `writing-documentation`, enforce machinery scope (they must NOT flag architecture prose as an implementation leak), and so the fact-checker's leak check reads this leak model rather than the user-guide DO-NOT-LEAK categories.

6. **Prose voice and the tells checklist** — a pointer section identical in mechanism to `writing-documentation`'s (post-Phase-1): "The prose-voice rules and the machine-writing tells checklist live in the shared `prose-voice-rules` skill. Read it in full; it is required reading for the writer, editor, and reviser." Reference it by skill name (the neutral peer skill created in Phase 1 Task 6), not a relative path. Do **not** duplicate the tells table (AC1.4).

7. **Review gate** — reuse the same multi-reviewer / cross-model / rewrite-from-intent gate `writing-documentation` uses (restate it here so the skill is standalone; it is prose-voice-neutral gate mechanics, but the design keeps scope rules per-mode, so restating the gate inline is acceptable and keeps `writing-internals` self-contained). Do not reference `writing-documentation` for it.

**Standalone posture:** `writing-internals` must invoke no external plugin, skill, or agent (no ed3d, no `kms-human-voice`, no general-purpose agent). Restate any prose rules it needs inline or via the shared in-plugin fragment only.

**Verification:** Deferred to Tasks 2–3.

**Commit:** `feat(kms-docs): add writing-internals scope rulebook with inverted leak model`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Verify machinery scope and inverted leak model via subagents

**Verifies:** docsuite.AC3.3 (scope half), docsuite.AC3.4 (leak-model half)

**Files:** none (verification task)

**Verification steps (RED-GREEN with ad-hoc inputs):**
1. **Editor scope (AC3.3 scope half):** Prepare a tiny ad-hoc machinery paragraph (e.g. "The ingester writes to the `events` table, then the reducer folds them into `daily_rollups`; the invariant is that a rollup is never emitted before its window closes."). Dispatch `doc-editor` twice: once dispatched with `writing-documentation` as its scope rulebook (RED — expect it to flag the architecture/table-name content as an implementation-leak / out-of-scope violation), once dispatched with `writing-internals` (GREEN — expect it to NOT flag that content as a scope violation, because machinery is the subject). Confirm the contrast.
2. **Reviser scope (AC3.3 scope half):** Same paragraph; confirm `doc-reviser` under `writing-internals` does not strip the machinery content "from intent," whereas under `writing-documentation` it would.
3. **Fact-checker leak model (AC3.4 leak half):** Give `doc-fact-checker` the `writing-internals` leak model plus an ad-hoc inverted leak list containing one planted secret (e.g. `AWS_SECRET_ACCESS_KEY=AKIA...`) and one internal hostname (`db-prod-01.internal`). Feed it a draft paragraph that (a) names a module and a table (permitted) and (b) pastes the planted secret. Confirm it flags the secret and the hostname as leaks and does NOT flag the module/table names. This is the consumer side of AC3.4, symmetric with the Phase 3 producer test (AC3.5).

Expected: RED cases flag, GREEN cases pass, fact-checker catches secrets while permitting architecture. If a GREEN case still flags machinery, tighten the "Reviewer effect" and Scope wording in `writing-internals` and re-run.

**Commit:** none (verification only).
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Confirm standalone posture and single-source tells

**Verifies:** docsuite.AC6.2 (scoped to Phase 2's file), docsuite.AC1.4

**Files:** none (verification task)

**Verification steps:**
1. Grep `writing-internals/SKILL.md` for any reference to an external plugin/skill/agent (e.g. `ed3d`, `kms-human-voice`, "general-purpose", other-plugin skill names). Expected: none. The only cross-file reference is the in-plugin shared `prose-voice-rules` skill.
2. Confirm `writing-internals` references the shared fragment and does NOT contain its own copy of the tells table (AC1.4 — single source). Grep the plugin: the tells table appears only in `prose-voice-rules.md`; both `writing-documentation` and `writing-internals` point to it.
3. Confirm the Scope sections of the two rulebooks are distinct files and not shared (AC1.4 — scope rules are mode-specific).

Expected: no external references, single-source tells confirmed, distinct scopes.

**Commit:** none (verification only).
<!-- END_TASK_3 -->

<!-- END_SUBCOMPONENT_A -->

---

**Dependencies:** Phase 1 (shared prose-voice fragment; the writer/editor/reviser and fact-checker mode indirection; the mode-dispatch table that names `writing-internals`).

**Done when:** The rulebook exists and is self-contained (no external-plugin dependency), the editor/reviser applying it pass machinery content that user-guide scope would reject, and the fact-checker using its leak model permits architecture content while catching secrets — verified by AC3.3 (scope half), AC3.4 (leak half), and AC6.2 (scoped to this file). Full two-gate AC3.3 is completed in Phase 4.
