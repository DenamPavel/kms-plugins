# Grounding Artifact Schema

The grounding artifact is a machine-checkable JSON file (`grounding.json`) emitted by `doc-internals-investigator` when documenting a project's machinery. It serves as the single source of truth for machinery maps, invariants, design decisions, build/test/run facts, sensitive instances (inverted leak list), and agent boundary rules. Both the investigator (writer) and the consumers (`doc-internals-critic` and the maintainer doc processor) read this pinned schema.

## Required Top-Level Fields

A valid grounding artifact contains these eight required fields, each with the specified type and structure:

### 1. `whatItIs` (string)

A one-paragraph plain-text description of what the system does, who maintains it, and why it matters. This is the entry point to the machinery: what a future reader should understand before diving into the components.

**Example:**
```json
"whatItIs": "The event ingester consumes raw application events, validates them against the event schema, and writes them to the events store. It is maintained by the data platform team and is responsible for the single point of entry for all event data."
```

### 2. `machineryMap` (array of objects)

An enumerated, finite list of the system's components, their responsibilities, and how data flows between them. This is the bounded surface the critic checks against; it is **not** an attempt to list every function or module, but rather the top-level machinery a maintainer needs to know about.

Each component object contains:

- `name` (string): The canonical name of the component (e.g., "event-ingester", "rollup-reducer").
- `responsibility` (string): One sentence describing what this component does.
- `sourcePaths` (array of strings): File paths or file#line references where this component is defined or implemented (e.g., `["src/ingest.js"]`, `["src/reduce.js#42-58"]`).
- `dataFlowIn` (array of strings): The names of components or external systems that send data to this component (e.g., `["application", "event-source"]`).
- `dataFlowOut` (array of strings): The names of components or external systems that receive data from this component (e.g., `["events-store", "metrics-emitter"]`).

**Example:**
```json
"machineryMap": [
  {
    "name": "event-ingester",
    "responsibility": "Validates and writes incoming events to the events store.",
    "sourcePaths": ["src/ingest.js"],
    "dataFlowIn": ["application"],
    "dataFlowOut": ["events-store"]
  },
  {
    "name": "rollup-reducer",
    "responsibility": "Folds events into time-windowed rollups, emitting one rollup per closed window.",
    "sourcePaths": ["src/reduce.js"],
    "dataFlowIn": ["events-store"],
    "dataFlowOut": ["rollups-store", "metrics"]
  }
]
```

### 3. `invariants` (array of objects)

Statements of correctness that must always be true; violations are bugs. Each invariant should be tied to the code that enforces it.

Each invariant object contains:

- `statement` (string): A plain-language statement of the invariant (e.g., "a rollup is never emitted before its window closes").
- `sourcePaths` (array of strings): File paths or file#line references where this invariant is enforced or checked (e.g., `["src/reduce.js#85-92"]`).

**Example:**
```json
"invariants": [
  {
    "statement": "A rollup is never emitted before its window closes.",
    "sourcePaths": ["src/reduce.js#85-92"]
  },
  {
    "statement": "All events in a rollup belong to the same time window.",
    "sourcePaths": ["src/reduce.js#45-60"]
  }
]
```

### 4. `whyDecisions` (array of objects)

Design decisions that might not be obvious to future readers, especially where the chosen approach is not the first one that comes to mind. This field may be sparse; the investigator sources what it can from code history or comments and flags what needs authored narrative.

Each why-decision object contains:

- `decision` (string): The choice made (e.g., "We emit rollups by window close time, not by event arrival time").
- `rejectedAlternatives` (string): Brief description of other approaches considered and why they were rejected.
- `sourceOrEvidence` (string): Where this decision is visible or recorded (commit hash, code comment, ADR file, etc.). The investigator may write `"[authored-narrative needed]"` when the code shows *what* was decided but not *why*.

**Example:**
```json
"whyDecisions": [
  {
    "decision": "Rollups are emitted by window close time, not by event arrival latency.",
    "rejectedAlternatives": "Event-arrival-based emission would make late-arriving events retroactively change closed rollups, violating the invariant.",
    "sourceOrEvidence": "src/reduce.js#45-60; see comment 'Why window close, not arrival'"
  },
  {
    "decision": "We use hash-based deduplication for idempotence.",
    "rejectedAlternatives": "[authored-narrative needed] — code shows the choice but commit history is unclear",
    "sourceOrEvidence": "[authored-narrative needed]"
  }
]
```

### 5. `facts` (object with `build`, `test`, `run` arrays)

Extracted commands that future readers need to build, test, and run the system. These come from manifests (package.json, Makefile, etc.) and are copied verbatim.

The `facts` object contains three arrays, each containing fact objects:

- `build` (array): Commands that build or compile the system.
- `test` (array): Commands that run the test suite.
- `run` (array): Commands that start or run the system.

Each fact object contains:

- `command` (string): The exact command (e.g., `"npm run build"`, `"npm test"`), copied verbatim from source.
- `source` (string): Where the command was read from (e.g., `"package.json#scripts.build"`, `"Makefile:12"`).

**Example:**
```json
"facts": {
  "build": [
    {
      "command": "npm run build",
      "source": "package.json#scripts.build"
    }
  ],
  "test": [
    {
      "command": "npm test",
      "source": "package.json#scripts.test"
    }
  ],
  "run": [
    {
      "command": "npm start",
      "source": "package.json#scripts.start"
    }
  ]
}
```

### 6. `invertedLeakList` (array of objects)

Repo-specific instances of sensitive content that must stay out of any emitted artifact (doc prose, `AGENTS.md`, or other outputs). This is the producer counterpart to the `writing-internals` leak model's consumer check.

Each leak instance is an object containing:

- `instance` (string): The sensitive value or name (e.g., `"sk-live-abc123"`, `"db-internal.corp.local"`, `"customer_id_12345"`).
- `kind` (string): One of `secret`, `token`, `credential`, `internal-hostname`, or `real-data`. Kinds are defined by the `writing-internals` leak model.
- `sourcePath` (string): File path and line reference where this instance was found (e.g., `"config.js#7"`).

**Note:** This list contains repo-specific secrets and hostnames, not architecture names, module names, or table names. A module named `ingest` or a table named `events` are **not** included; only genuine secrets and internal hostnames are.

**Example:**
```json
"invertedLeakList": [
  {
    "instance": "sk-live-abc123",
    "kind": "token",
    "sourcePath": "config.js#7"
  },
  {
    "instance": "db-internal.corp.local",
    "kind": "internal-hostname",
    "sourcePath": "config.js#12"
  }
]
```

### 7. `agentBoundaryBlock` (object with `always`, `askFirst`, `never` arrays)

Explicit rules governing what agents that consume this artifact may do. This is the ✅/⚠️/🚫 structure that phase 5's `doc-agents-md` agent distills into a Claude system prompt. The block is **separate from the leak list** — the leak list governs doc prose, while this block governs agent actions and permissions.

The `agentBoundaryBlock` object contains three arrays, each containing rule strings:

- `always` (array of strings): Actions agents are always permitted to take (e.g., `"Read source files"`, `"Reference module names in AGENTS.md"`).
- `askFirst` (array of strings): Actions that require asking the user first before taking (e.g., `"Execute arbitrary code from package.json scripts"`).
- `never` (array of strings): Actions agents must never take (e.g., `"Emit the plaintext token sk-live-abc123"`, `"Emit the internal hostname db-internal.corp.local"`).

**Example:**
```json
"agentBoundaryBlock": {
  "always": [
    "Read source files",
    "Reference module names and data-flow components in output",
    "Cite source paths and line numbers"
  ],
  "askFirst": [
    "Execute build, test, or run commands from facts"
  ],
  "never": [
    "Emit the token sk-live-abc123 or any secret from the invertedLeakList",
    "Emit the internal hostname db-internal.corp.local",
    "Modify source files in the target repo"
  ]
}
```

### 8. `schemaVersion` (string)

A semantic version (or other version string) for the schema itself. This allows a resumed run to detect schema drift and decide whether to reuse a previous artifact or re-generate it.

**Example:**
```json
"schemaVersion": "1.0.0"
```

## Validation Rules

An artifact is **schema-valid** if and only if:

1. It parses as valid JSON.
2. All eight required top-level fields are present.
3. Each field has the correct type:
   - `whatItIs`: non-empty string
   - `machineryMap`: array (may be empty)
   - `invariants`: array (may be empty)
   - `whyDecisions`: array (may be empty)
   - `facts`: object with `build`, `test`, `run` keys, each an array (arrays may be empty)
   - `invertedLeakList`: array (may be empty)
   - `agentBoundaryBlock`: object with `always`, `askFirst`, `never` keys, each an array (arrays may be empty)
   - `schemaVersion`: non-empty string
4. For object arrays (`machineryMap`, `invariants`, `whyDecisions`, facts entries, `invertedLeakList`), each object has all required fields as specified above; fields are non-null and have the correct type.

Empty arrays are permitted (e.g., a system with no documented invariants may have `"invariants": []`).

## Claim-to-Source Grounding

Fields 2–5 (`machineryMap`, `invariants`, `whyDecisions`, `facts`) carry source references as part of their structure:

- `machineryMap[].sourcePaths`
- `invariants[].sourcePaths`
- `whyDecisions[].sourceOrEvidence`
- `facts.*[].source`

These references collectively **ARE the maintainer doc's claim-to-source grounding**. The doc processor and fact-checker verify machinery claims against these per-claim source paths. **No separate `pageToSourceMap` field is required in this artifact**; the grounding is distributed across the object fields.

Note: The maintainer doc itself emits a durable, committed **page-to-source map** as part of its final output (at GATE 2), which persists as a doc artifact beyond the run. That map serves a different purpose (tying doc sections to source files for human readers). This artifact's inline source references enable the orchestrator and critic to verify without a separate map.

## Full Example

```json
{
  "whatItIs": "The event ingester consumes raw application events, validates them against the event schema, and writes them to the events store. Maintained by the data platform team; it is the single point of entry for all event data into the system.",
  "machineryMap": [
    {
      "name": "event-ingester",
      "responsibility": "Validates and writes incoming events to the events store.",
      "sourcePaths": ["src/ingest.js"],
      "dataFlowIn": ["application"],
      "dataFlowOut": ["events-store"]
    },
    {
      "name": "rollup-reducer",
      "responsibility": "Folds events into time-windowed rollups, emitting one rollup per closed window.",
      "sourcePaths": ["src/reduce.js"],
      "dataFlowIn": ["events-store"],
      "dataFlowOut": ["rollups-store"]
    }
  ],
  "invariants": [
    {
      "statement": "A rollup is never emitted before its window closes.",
      "sourcePaths": ["src/reduce.js#85-92"]
    }
  ],
  "whyDecisions": [
    {
      "decision": "Rollups are emitted by window close time, not by event arrival latency.",
      "rejectedAlternatives": "Event-arrival-based emission would make late-arriving events retroactively change closed rollups.",
      "sourceOrEvidence": "src/reduce.js#45-60"
    }
  ],
  "facts": {
    "build": [
      {
        "command": "npm run build",
        "source": "package.json#scripts.build"
      }
    ],
    "test": [
      {
        "command": "npm test",
        "source": "package.json#scripts.test"
      }
    ],
    "run": [
      {
        "command": "npm start",
        "source": "package.json#scripts.start"
      }
    ]
  },
  "invertedLeakList": [
    {
      "instance": "sk-live-abc123",
      "kind": "token",
      "sourcePath": "config.js#7"
    },
    {
      "instance": "db-internal.corp.local",
      "kind": "internal-hostname",
      "sourcePath": "config.js#12"
    }
  ],
  "agentBoundaryBlock": {
    "always": [
      "Read source files",
      "Reference module names and data-flow components"
    ],
    "askFirst": [
      "Execute build, test, or run commands"
    ],
    "never": [
      "Emit the token sk-live-abc123",
      "Emit the internal hostname db-internal.corp.local"
    ]
  },
  "schemaVersion": "1.0.0"
}
```
