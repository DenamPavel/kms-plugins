---
name: mcp-code-mode
description: Use when designing or building an MCP server — converts API surfaces into strongly-typed TypeScript interfaces that LLMs write code against, rather than exposing raw tool calls
---

# MCP Code Mode

## Overview

Instead of exposing API operations as native MCP tool calls, generate a strongly-typed TypeScript interface and expose a single `execute(code: string)` tool. The LLM writes code against the interface.

**Core insight:** LLMs have far more training data on real TypeScript than on synthetic tool-calling schemas. Code Mode produces more reliable, readable, and debuggable operations — especially for multi-step or credentialed APIs.

## When to Use

**Use Code Mode when:**
- The API requires multiple sequential calls to fulfill a single user intent
- Credentials or secrets must be isolated from the generated code
- The logic is conditional (different calls depending on intermediate results)
- You want the LLM to express the full operation as readable code rather than a sequence of tool invocations

**Use native tool-calling when:**
- Each MCP tool is a single, atomic operation with no dependencies on other calls
- No secrets are involved
- The caller (LLM) should decide the sequence, not the generated code

## Step 1: Extract the API Surface

Before writing any code, list every operation the server needs to expose as plain method signatures. Group related operations by resource. If a method name needs explanation, rename it — the API is unclear.

## Step 2: Generate the Typed TypeScript Interface

Write a `.d.ts`-style interface. **Rules — no exceptions:**

- Every method has a JSDoc comment with a one-line description, `@param`, and `@returns`
- No `any`. Use specific types or `unknown` with an explanatory comment
- All return types and complex parameter types are defined in the **same file** — never imported from elsewhere or assumed
- Use narrow, specific return types — not `Record<string, unknown>`
- Split by resource: no single interface with more than ~8 methods
- Use discriminated unions for fallible operations — do not use `throws`
- Credentials **never** appear as parameters

```typescript
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

interface PullRequest {
  id: number;
  title: string;
  state: 'open' | 'closed';
  body: string;
}

interface GitHubPRClient {
  /** Fetch all open PRs for a repo.
   * @param owner Repository owner login
   * @param repo Repository name
   * @returns List of open pull requests
   */
  listOpenPRs(owner: string, repo: string): Promise<Result<PullRequest[]>>;

  /** Post a review comment on a specific line.
   * @param prNumber Pull request number
   * @param path File path relative to repo root
   * @param line Line number to comment on
   * @param body Comment text
   */
  addReviewComment(prNumber: number, path: string, line: number, body: string): Promise<Result<void>>;
}
```

The interface is what the LLM writes code against — it must be fully self-documenting.

## Step 3: Set Up the Isolated Sandbox

**Rules — no exceptions:**

- Credentials are bound in the sandbox implementation via environment variables or closure — they never appear in generated code or the interface
- Network access is restricted to only the endpoints the API requires
- Executions are stateless — no shared mutable state between runs
- The sandbox wraps all execution in try/catch and **always** returns structured output — it never throws:

```typescript
type SandboxResult =
  | { ok: true; output: string }
  | { ok: false; error: string; stack?: string };
```

The execution environment is project-specific (Node `vm`, child process, Deno, Bun, Docker) — choose what fits the project. The isolation contract above applies regardless.

## Step 4: Wire into MCP as a Single `execute` Tool

Expose exactly one tool to the MCP client:

```typescript
execute(code: string): Promise<SandboxResult>
```

The sandbox receives the code string, runs it against the bound interface implementation, and returns the result. Include the full interface definition in the tool's description or system prompt so the LLM knows exactly what it can call.

## Step 5: Code Review (Mandatory)

After implementation, invoke the `requesting-code-review` skill from `ed3d-plan-and-execute` with this domain-specific checklist:

- Every method in the interface has a JSDoc comment
- All return types and complex parameter types are defined in the same file
- No credentials appear in the interface, in generated code, or as method parameters
- Credentials are bound in the sandbox implementation only
- All fallible operations return discriminated unions — none use `throws`
- No single interface has more than ~8 methods
- Sandbox wraps execution in try/catch and returns `SandboxResult` — never throws
- Network access is restricted to required endpoints
- Executions are stateless between runs
- MCP exposes exactly one `execute(code: string)` tool
- Interface definition is included in the tool's description or system prompt

## Verification Checklist

Before marking implementation complete:

- [ ] Every method in the interface has a JSDoc comment
- [ ] All return types and complex parameter types defined in the same file
- [ ] No `any` types
- [ ] Narrow, specific return types throughout
- [ ] No single interface exceeds ~8 methods
- [ ] Discriminated unions used for all fallible operations
- [ ] No credentials in the interface or as method parameters
- [ ] Credentials bound in sandbox implementation only
- [ ] Sandbox wraps all execution in try/catch, returns `SandboxResult`
- [ ] Network access restricted to required endpoints
- [ ] Stateless execution between runs
- [ ] MCP exposes exactly one `execute(code: string)` tool
- [ ] Interface definition included in tool context
- [ ] Code review completed via `requesting-code-review`

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "This API is simple enough for native tools" | If it has credentials, use Code Mode. Credential isolation alone justifies it. |
| "I'll define types later" | The LLM writes code now. Undefined types = hallucinated shapes = silent bugs. |
| "One big interface is easier" | Easier to write once, harder to use every time. Split by resource. |
| "Throwing is fine for errors" | The LLM can't catch what it can't see in the type. Use discriminated unions. |
| "I can pass the token as a parameter" | Credentials in generated code = credentials in logs, context, and history. Bind them in the sandbox. |
| "Stateful execution is more efficient" | Shared state between runs = unpredictable behavior at scale. Design explicit persistence if needed. |
