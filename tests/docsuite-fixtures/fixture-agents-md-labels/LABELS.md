# fixture-agents-md-labels Test Oracle

Hand-labeled lines that must be rejected by the agents-md distiller. These lines are divided into two categories for testing different filters.

## Category A: Mechanical Manifest-Line Filter (AC4.2)

Lines that are **exactly equal to a manifest field value** and must be dropped by the mechanical filter.

These lines should be dropped because they replicate the manifest directly; they add no new information and would be redundant in AGENTS.md.

```
node src/index.js
echo 'No build'
node --input-type=module -e "console.log('Tests pass')"
echo 'Linting'
echo 'Formatting'
echo 'Deploying'
```

### Manifest Source

From `package.json`:
- `scripts.start`: `"node src/index.js"`
- `scripts.build`: `"echo 'No build'"`
- `scripts.test`: `"node --input-type=module -e \"console.log('Tests pass')\""`
- `scripts.lint`: `"echo 'Linting'"`
- `scripts.format`: `"echo 'Formatting'"`
- `scripts.deploy`: `"echo 'Deploying'"`

## Category B: Judgment Filter (AC4.3)

Lines containing generic advice that would hold for **any repo**, regardless of specific machinery. These must be rejected by the judgment filter because they are not specific to this project.

```
Always run tests before committing.
Use a linter to check code style.
Follow the project's coding standards.
Keep your dependencies up to date.
Document your changes in the CHANGELOG.
Use semantic versioning for releases.
Write clear commit messages.
Run the build before deploying.
```

### Why These Are Rejected

Each line is generic advice that applies to any JavaScript/Node project, not specific to this fixture's machinery. The judgment filter identifies such advice as unhelpful in a project-specific AGENTS.md and rejects it.

## Test Procedure

1. **AC4.2 (mechanical):** Run `scripts/agents-md-filter.mjs` (the Node filter) over candidate AGENTS.md content. Every line in Category A must be dropped.
2. **AC4.3 (judgment):** Run the `doc-agents-md` distiller over this fixture. Every line in Category B must be rejected and not reach the result gate.

## Verification

- Mechanical filter: verify each Category A line is removed by `agents-md-filter.mjs`
- Judgment filter: verify each Category B line is not present in the final `AGENTS.md` output
