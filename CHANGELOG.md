# Changelog

## 1.0.0

First release of this marketplace. Ships two plugins:

- `kms-docs` 2.2.0: the DocSuite documentation pipeline. Ships the `writing-documentation`, `writing-internals`, and `agents-md-conventions` rulebooks; the `/write-doc` and `/document-project` commands; eleven bundled agents; Playwright screenshot capture with a demo-mode assertion; and the shared `prose-voice-rules` fragment.
- `kms-human-voice` 1.3.0: the prose rulebook and its two `PostToolUse` hooks (mechanical pattern check, intensity review agent).

Both plugins are self-contained and invoke no external plugin, skill, or agent.
