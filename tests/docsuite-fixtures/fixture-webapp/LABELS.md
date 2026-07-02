# fixture-webapp Test Oracle

These are the exact planted strings that the leak investigator must detect and the leak filter must exclude.

## Planted Secrets (Must Appear in Leak List)

The following strings are intentionally placed in `src/config.js` as real configuration that machinery uses:

```
PLANTED_FAKE_APISECRET_2f9c3a2b1e8d4f5a6b9c
api-internal-prod.example.local
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
```

## Leak Filter Verification (Must NOT Appear in Output)

When the full pipeline runs on this fixture:

1. **AC3.5 producer test:** `doc-internals-investigator` must emit these three strings in its `invertedLeakList` in `grounding.json`.
2. **AC4.7 consumer test:** `doc-agents-md` pipeline must NOT emit any of these three strings in the final `AGENTS.md`.

## Notes

- These strings are planted in `src/config.js` in production-mode locations (the `config` object, not the demo-mode function).
- The machinery (`src/auth.js`) depends on config and would use these secrets if production mode were active.
- Demo mode (`DEMO_MODE=true`) substitutes fake "[FIXTURE_*_NOT_REAL]" placeholders, making the app safe for capture.
