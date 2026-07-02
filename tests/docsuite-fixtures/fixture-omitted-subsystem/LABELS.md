# fixture-omitted-subsystem Test Oracle

## Omitted Subsystem (Must Be Flagged)

The grounding artifact's machinery map includes a **Cache subsystem** (`src/cache.js`, `CacheManager` class) that is deliberately omitted from `draft.md`.

### Expected Detection

When `doc-internals-critic` compares the draft against the grounding artifact's `machineryMap`:

1. It should enumerate all components in the grounding artifact: `DataStore`, `ReportGenerator`, `CacheManager`
2. It should cross-reference against the draft's documented subsystems: Data Store, Reporting
3. It should flag the **CacheManager** component as undocumented in the draft but present in the grounding artifact

### Exact Match for Testing

The subsystem name to flag is:

```
CacheManager
```

Or more specifically, the critic should report:

```
Undocumented subsystem: CacheManager (src/cache.js) found in grounding artifact but not in draft
```

## Why This Fixture Is Structured This Way

- `src/index.js` imports and uses `CacheManager` directly, demonstrating that the machinery depends on it
- `draft.md` explicitly documents only Data Store and Reporting, creating a known omission
- The draft includes a note acknowledging the omission so any reader understands the fixture's purpose
