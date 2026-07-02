# Application Architecture (Draft)

This document describes the machinery of the application.

## Subsystems

The application is composed of the following subsystems:

### Data Store

Manages persistent data. Exposed via the `DataStore` class in `src/data-store.js`.
- `fetch()`: Retrieve all records
- `save(record)`: Persist a new record

### Reporting

Generates reports from the stored data. Exposed via `ReportGenerator` in `src/reporting.js`.
- Depends on `DataStore`
- `generate()`: Produce a report object

## Entry Point

The entry point (`src/index.js`) initializes the data store and reporting subsystems, then orchestrates their use.

---

**Note:** This draft is intentionally incomplete. The actual source includes a cache subsystem not documented here, which the internals critic should flag.
