# fixture-omitted-subsystem Test Oracle

## Omitted Subsystem (Must Be Flagged)

The actual source code includes a **Cache subsystem** (`src/cache.js`, `CacheManager` class) that is deliberately omitted from `draft.md`.

### Expected Detection

When `doc-internals-critic` compares the draft against the actual source machinery:

1. It should enumerate all modules in the source: `data-store.js`, `reporting.js`, `cache.js`
2. It should cross-reference against the draft's documented subsystems: Data Store, Reporting
3. It should flag the **Cache** subsystem as undocumented in the draft

### Exact Match for Testing

The subsystem name to flag is:

```
Cache
```

Or more specifically, the critic should report:

```
Undocumented subsystem: CacheManager (src/cache.js) found in source but not in draft
```

## Why This Fixture Is Structured This Way

- `src/index.js` imports and uses `CacheManager` directly, demonstrating that the machinery depends on it
- `draft.md` explicitly documents only Data Store and Reporting, creating a known omission
- The draft includes a note acknowledging the omission so any reader understands the fixture's purpose
