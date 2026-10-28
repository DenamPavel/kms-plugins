# kms-plugins

`kms-plugins` is a Claude Code plugin marketplace with four plugins, for documentation, prose style, MCP server design, and fact-checking review panels.

| Plugin | What it gives you |
|--------|-------------------|
| `kms-docs` | A documentation pipeline that grounds a page in source, stops for your approval, drafts and reviews the page, and stops again before it replaces a live page. |
| `kms-human-voice` | A prose-voice rulebook that Claude loads before writing for a person, plus two advisory hooks. |
| `kms-mcp-patterns` | A design guide for building MCP servers around a typed interface and a single `execute` tool. |
| `panel-audit` | Fact-checking for multi-model review panels on non-code work: analysis, research, and design. |

Each plugin works without the others installed.

## Installation

1. Add the marketplace:

   ```bash
   claude plugin marketplace add https://github.com/DenamPavel/kms-plugins.git
   ```

   The shorthand `claude plugin marketplace add DenamPavel/kms-plugins` also works.

2. Install the plugins you want, naming each one as `<plugin>@kms-plugins`:

   ```bash
   claude plugin install kms-docs@kms-plugins
   claude plugin install kms-human-voice@kms-plugins
   claude plugin install kms-mcp-patterns@kms-plugins
   claude plugin install panel-audit@kms-plugins
   ```

3. Start a new Claude Code session, or run `/reload-plugins` in a session that is already open. Plugins installed from the shell load at the next session start or on reload.

Claude Code clones the marketplace with the git credentials already on your machine and turns off git's interactive prompts, so a clone that needs you to sign in fails instead of asking. For HTTPS, run `gh auth login` and then `gh auth setup-git` before step 1. For SSH, add the marketplace as `git@github.com:DenamPavel/kms-plugins.git`, using a key that works without a passphrase prompt on a machine that already has `github.com` in its `known_hosts` file. See [Plugin troubleshooting](https://code.claude.com/docs/en/plugins/troubleshooting.md) in the Claude Code docs.

## Requirements

| Requirement | Needed for |
|-------------|------------|
| `jq` on your `PATH` | The hooks in `kms-human-voice` and `panel-audit`. Without `jq`, the hooks do nothing and print no error. |
| Node | Screenshot capture in `kms-docs`. |
| Dynamic workflows turned on | The `run-panel` and `verify-claims` workflows in `panel-audit`. |
| Access to the Fable model | The `panel-auditor` agent in `panel-audit`, which the plugin's `audit-summary` hook asks Claude to start. |

`kms-docs` needs Node only when a page includes screenshots. The first time a page needs them, the pipeline checks for the `playwright` npm package and, if it is missing, offers to run the one-time `npm install` or to produce the page without images. Capture also needs a running instance of the product you are documenting.

Dynamic workflows are available on all paid plans and with Anthropic API access. On Pro, turn them on from the **Dynamic workflows** row in `/config`. See [Dynamic workflows](https://code.claude.com/docs/en/workflows.md) in the Claude Code docs.

The `verify-claims` workflow runs its checks on the `claim-verifier` agent, which uses Sonnet, so `panel-audit`'s main fact-checking path works without Fable.

## kms-docs

Generated documentation tends to read well and state things that are false. `kms-docs` checks each page against the source before drafting it and again in review, and it waits for your approval before it replaces a live page.

- **`/write-doc [target page or feature] [repo path] [mode]`** writes one page, or audits the page if it already exists.
- **`/document-project [repo path]`** surveys a repo and proposes a set of docs for you to approve. It then runs the same per-page pipeline as `/write-doc` once for each approved doc, and records progress in a ledger in the target repo's `docs/` directory, so an interrupted run resumes where it stopped.

In `user-guide` and `maintainer` modes, an investigator agent reads the source first, and you approve what it found before any drafting starts. A writer then drafts the page, three reviewers check its facts, prose, and coverage in parallel, and a reviser applies their findings before you approve the finished page.

`/write-doc` takes its mode as the last argument. Each mode follows its own rulebook and keeps different material out of the page:

| Mode | Rulebook | What stays out of the page |
|------|----------|----------------------------|
| `user-guide` (default) | `writing-documentation` skill | Implementation details. |
| `maintainer` | `writing-internals` skill | Secrets, tokens, and real data. The machinery is the page's subject. |
| `agents-md` | `agents-md-conventions`, a reference file the `doc-agents-md` agent reads | Lines that restate a manifest, and generic filler. |

`agents-md` mode keeps the first approval, then distills the grounding into an `AGENTS.md` file in a single step and stops for your approval of the result.

`kms-docs` bundles screenshot capture. To keep real records out of committed images, the capture script refuses a shot unless its capture spec declares a safe-mode check and that check passes on the live page. You or the agent write the check into the spec, such as an element or text that appears only in a demo or seeded state. The script tests only that declared condition, so review the rest of each frame before it ships.

For the full command reference, the agent roster with models, and the bundled scripts, see the [kms-docs README](plugins/kms-docs/README.md).

## kms-human-voice

`kms-human-voice` holds the `human-voice` skill, a rulebook for prose that reaches a reader without you there to explain it: a memo, an email, an essay, slide text, a published document. Claude loads the skill when Claude judges that its next piece of writing will reach a person. The skill has no slash command.

The rulebook has fourteen numbered rules, including a few house-style preferences. Among them:

- A limit of one em-dash per page. For product and maintainer documentation the `kms-docs` rulebooks take precedence, and they allow none.
- A ban on contrastive framing of the form "not X, it's Y".
- Direct communication, without flattery or enthusiasm markers.
- An intensity review for literary devices, such as sensory-abstract pairings and atmospheric words, that pile up.
- A list of structural tells: clause barf, hedge-alternative tails, false equations, reassurance sentences, and structure-preview sentences.
- A rule to fix flagged prose by rewriting it from its intended meaning.
- An AI phrase blacklist, and bans on throat-clearing, hedging, and overused formal transition words.
- A requirement to give the reason before the mechanism, and specific figures in place of vague quantifiers.

Two `PostToolUse` hooks add mechanical checks after Claude writes or edits a file with its Write or Edit tool. Edits you make in your own editor do not trigger them.

| Hook | What it checks |
|------|----------------|
| `check-ai-patterns.sh` | Markdown and text files. It warns when a file has more than one em-dash. It also flags contrastive framing in its canonical form, a negation followed by a pronoun that asserts the replacement ("X isn't Y, it's Z"), and skips lines that open a conditional or a reason. The contrastive check favors precision, so many contrastive sentences pass it; the skill rule and the intensity review cover the rest. |
| `check-intensity.sh` | Files that look like deliverables: Markdown and text files named or stored like memos, client documents, essays, and similar prose; Python files that import `pptx` or `docx`; and R files that load `officer` or `rmarkdown`. For those files, the hook asks Claude to start a background agent that reviews the prose for stacked literary devices and contrastive framing. |

Neither hook blocks a write. Each adds a note to Claude's context and tells Claude to keep working, and `check-ai-patterns.sh` asks Claude to save its fixes for a cleanup pass before the document is shared. Both hooks skip files written for agents and tooling: `AGENTS`, `CLAUDE`, `SKILL`, and `MEMORY` files, anything under a `.claude/` directory, and pickup, status, handoff, and progress files. README files get only the contrastive check: `check-ai-patterns.sh` skips its em-dash count for them, and `check-intensity.sh` skips them entirely. To opt a Markdown or text file into the intensity review, put `audience: human` in its first ten lines or place a `.human-voice-review` file in its directory; `voice: skip` in the first ten lines opts a file out.

The structural-tells rule is adapted from Ed Ropple's Polytoken documentation style guide. The plugin has no README of its own; the rules are in [the `human-voice` skill](plugins/kms-human-voice/skills/human-voice/SKILL.md).

## kms-mcp-patterns

`kms-mcp-patterns` holds one skill, `mcp-code-mode`, for designing or building an MCP server. Models have seen far more real TypeScript than tool-calling schemas, so the skill recommends a server that exposes a strongly typed TypeScript interface and a single `execute(code: string)` tool. The model writes code against that interface in place of calling one tool per API operation. The skill recommends this design for APIs that need several calls to serve one request, branch on intermediate results, or hold credentials that must stay out of generated code. It recommends native tool calls when each operation is atomic, no secrets are involved, and the caller should decide the sequence.

The skill walks through five steps:

1. Extract the API surface as plain method signatures, grouped by resource.
2. Write a typed interface with a JSDoc comment on every method, no `any`, and discriminated-union results for fallible operations.
3. Set up an isolated sandbox that binds credentials, restricts network access, runs statelessly, and always returns structured output.
4. Expose the sandbox to the MCP client as one `execute` tool, with the interface included in the tool's description.
5. Review the implementation against the skill's domain checklist. The skill marks this review mandatory.

A verification checklist and a table of common objections to the approach, each with the skill's answer, close the skill. Claude loads `mcp-code-mode` when a task involves designing or building an MCP server, and you can also run it as `/kms-mcp-patterns:mcp-code-mode`. The plugin has no README; see [the `mcp-code-mode` skill](plugins/kms-mcp-patterns/skills/mcp-code-mode/SKILL.md).

## panel-audit

`panel-audit` fact-checks the output of a multi-model panel on non-code work. A panel is a set of seats, each an agent with its own lens, and the chair is the agent that writes the final deliverable from the seats' reports. The plugin checks the claims in that deliverable against primary and outside sources at the point where someone is about to rely on them.

- **`working-with-panels` skill** walks the chair through the procedure: ground the brief, run the panel, write the deliverable, verify its claims, and act on the verdicts.
- **`run-panel` workflow** dispatches the seats in parallel and returns their reports plus a ledger of the checkable claims each seat made. A seat that will assert facts needs research tools, and `run-panel` tells a seat without them to mark every outside fact unverified.
- **`verify-claims` workflow** takes the claims that made it into the deliverable, or extracts them from a finished document, and checks them with verifier agents in parallel. It returns one verdict per claim (`confirmed`, `wrong`, `imprecise`, `unverifiable`, or `inherited`) with the sources consulted.
- **`audit-summary` hook** is a backstop for summary-like documents Claude writes outside a panel run. It fires when Claude writes or edits a Markdown or text file whose name contains a word such as summary, findings, report, analysis, or memo, or whose opening lines carry a findings, conclusions, or summary heading. The hook asks Claude to start the `panel-auditor` agent for one advisory pass and points to `verify-claims` as the thorough path. It does not block the write, and it fires on ordinary report and analysis files in any project, so expect it outside panel work too.

For the verdict definitions, claim reuse, and cost controls, see the [panel-audit README](plugins/panel-audit/README.md).

## License

MIT. See [LICENSE](LICENSE).
