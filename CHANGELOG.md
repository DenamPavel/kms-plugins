# Changelog

## kms-plugins 1.5.0

New plugin.

**New:**
- `kms-docs` 1.0.0: a documentation-writing skill (`writing-documentation`). Generalizes a product-manual rulebook into a reusable skill covering the two-reader model (human plus retrieval), self-contained sections, behavior-not-implementation scope, actor and terminology discipline, a machine-writing tells checklist, a multi-reviewer cross-model review gate, flagging doc changes for human review, and keeping docs synced to code. Self-contained; pairs with `kms-human-voice` without depending on it.

## kms-plugins 1.1.0

Catalog additions.

**New:**
- insight-essay-bot 0.1.0: kontextmaschine-style analytical essay skills (explore, write, edit), hosted in its own repo at `DenamPavel/InsightEssayBot` and referenced via a github source.

**Changed:**
- README now lists all marketplace plugins (added the previously undocumented `kms-human-voice`) and broadened the marketplace description beyond MCP patterns.

## kms-plugins 1.0.0

Initial marketplace.

**New:**
- `kms-mcp-patterns` 1.0.0: design patterns for building MCP servers, starting with Code Mode.
- `kms-human-voice` 1.0.0: personal writing-style enforcement with PostToolUse phrasing hooks.
