# Durable Docsuite Test Fixtures

These are load-bearing test fixtures for docsuite acceptance criteria. Each fixture is a small but real repository with actual manifests, source modules, and a `LABELS.md` oracle that downstream checks compare against. A wrong oracle silently passes a broken filter, so the fixtures must be correct, not merely present.

## Fixture Mapping to ACs

### fixture-webapp

A runnable Node app with a safe/demo mode, a clear machinery map (data flow across multiple modules), and planted secrets/tokens/internal hostnames in realistic locations.

**ACs verified:**
- **AC6.1:** Full pipeline runs with only `kms-docs` installed (the app is runnable, acts as the functional test target).
- **AC6.3:** First-run `npm install` detection — the app's `scripts/` has a real `package.json` with Playwright dependency.
- **AC3.5:** `doc-internals-investigator` produces an inverted leak list containing the planted secret/token/internal hostname from `LABELS.md`.
- **AC4.7:** `doc-agents-md` flow reproduces none of the planted-secret strings from `LABELS.md`.

**Structure:**
- `package.json` — manifest with build/start/demo scripts.
- `src/` — source modules showing data flow (≥2 modules).
- `scripts/` — capture dependencies (package.json with Playwright).
- `LABELS.md` — exact planted strings: the secret, token, and internal hostname that must never appear in any emitted artifact.
- `README.md` — build/run instructions and explanation of safe/demo mode.

### fixture-omitted-subsystem

An app whose machinery includes a subsystem deliberately left undocumented in an included draft, so the internals critic has a known omission to flag.

**ACs verified:**
- **AC3.2:** `doc-internals-critic` flags the omitted subsystem when comparing against the draft.

**Structure:**
- `package.json` — manifest.
- `src/` — source code with multiple modules, including one subsystem intentionally omitted from the draft.
- `draft.md` — incomplete machinery description (missing the named subsystem).
- `LABELS.md` — exact subsystem name that must be flagged as omitted.

### fixture-agents-md-labels

A small repo with real manifest scripts and a `LABELS.md` of hand-labeled must-reject `AGENTS.md` lines: both mechanical (equal to a manifest field value) and judgment-based (generic advice).

**ACs verified:**
- **AC4.2:** Mechanical manifest-line filter drops lines equal to manifest field values.
- **AC4.3:** Judgment filter rejects generic advice that would hold for any repo.

**Structure:**
- `package.json` — manifest with actual scripts.
- `src/` — minimal source code (may be empty or token).
- `LABELS.md` — hand-labeled lines with two categories:
  - Lines EQUAL to a manifest field value (mechanical filter target).
  - Generic advice lines (judgment filter target).
