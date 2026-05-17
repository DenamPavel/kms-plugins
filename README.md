# kms-plugins: Claude Code Plugin Marketplace

**Better MCP servers through better design patterns.**

This is a personal Claude Code plugin marketplace. Current focus: patterns for building MCP servers that produce reliable, readable, debuggable LLM-generated code.

## Installation

Add the marketplace:

```
claude plugin marketplace add https://github.com/DenamPavel/kms-plugins.git
```

Install a plugin:

```
claude plugin install kms-mcp-patterns@kms-plugins
```

Restart Claude Code to activate.

## Plugins

### kms-mcp-patterns

Design patterns for building MCP servers. Starts with the Code Mode pattern — more patterns to come.

```
claude plugin install kms-mcp-patterns@kms-plugins
```

## Why Code Mode?

When building MCP servers, the default approach is to expose each API operation as a native tool call. The LLM selects tools and calls them one by one. This works, but it has a ceiling.

The insight behind Code Mode: **LLMs are better at writing TypeScript than at calling tool schemas.** Tool-calling syntax is synthetic — LLMs encounter it rarely in training data. Real TypeScript interfaces backed by JSDoc are everywhere. When you convert your API surface into a strongly-typed interface and ask the LLM to write code against it, you get more reliable operations, better error handling, and logic the developer can actually read and debug.

This is particularly true for:
- Multi-step operations where intermediate results feed into subsequent calls
- APIs where credentials must be isolated from the generated code
- Any operation complex enough to benefit from being expressed as readable code rather than a sequence of tool invocations

The pattern was validated in production by Cloudflare's AI team. This plugin distills it into a step-by-step skill — implementation-agnostic, no Cloudflare required.

## How the `mcp-code-mode` Skill Works

When invoked, the skill guides Claude through:

1. **Extracting the API surface** — listing operations as method signatures before writing any code
2. **Generating a typed TypeScript interface** — with JSDoc on every method, discriminated unions for fallible operations, credentials never as parameters, all types defined in the same file
3. **Setting up an isolated sandbox** — credentials bound via environment/closure, stateless execution, structured `{ ok, output/error }` return — the sandbox never throws
4. **Wiring into MCP** — a single `execute(code: string)` tool with the interface definition included in its context
5. **Code review** — mandatory review pass checking interface completeness, credential isolation, and sandbox safety

The execution environment is project-specific. The isolation contract is not.

## License

MIT
