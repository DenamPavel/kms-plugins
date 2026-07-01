# Screenshot capture feature — handoff

Last updated: 2026-07-01

**Status: SHIPPED and validated end-to-end.**

- **kms-docs 2.1.0** released in the `kms-plugins` marketplace (1.7.0), pushed to `origin/master`. On-disk cache updated; all 7 agents load (a Claude Code restart was required after the release for the new agents to register).
- **External export synced.** `~/Documents/GitHub/documentation-plugin` bumped to kms-docs 2.1.0 / marketplace 1.1.0 and pushed to gitlab (`i-360/analytics/commercial/tools/documentation-plugin`, branch `main`).
- **`doc-screenshooter` exercised end-to-end** on media-hub (fresh session after the reload): it builds its own capture spec, drives `capture.mjs`, and the content-based safe-mode assertion is verified in code before any pixels. The full pipeline ran with both human gates.
- **media-hub user guide illustrated.** The Campaign Tracker section was rewritten and **6 screenshots** were added across the guide (Campaign Tracker full/dropdown/search, Campaign Edits, Channel Report, MCode Editor). Committed and pushed to media-hub `dev`. **Human review passed; out for external review.** Recorded in `STATUS.md`.

The review gate proved its worth twice: the fact-checker caught a draft that had named seven real client verticals (fixed before write), and the code-enforced leak guard **refused** the New Campaign shot because the app leaks a real campaign code (finding #1 below).

## Remaining follow-ups

1. **External review outcome** on the media-hub guide (out for review; nothing to do until it returns).
2. **Two media-hub app findings** for the media-hub team to triage (below) — not fixed here.
3. **Optional:** human review of the machine-written skill/agent prose in this plugin, if not already covered.

Delete this doc once the external review lands and the two findings are triaged.

## Findings surfaced (media-hub app, not fixed here)

1. **New Campaign form leaks a real campaign code.** The "Copy from Existing Campaign" selectize placeholder is set to a real non-CENSAI campaign code ("AFPF-IL …") on every prod load, so the New Campaign screen cannot be safely captured (the leak guard refused it). The placeholder appears to be set to the last-loaded option text instead of staying at "Select a campaign...". New Campaign will get a screenshot once this is fixed (or that control is redacted at capture).
2. **Two distinct unsaved-changes modals.** "Back to List" shows *"…Going back will discard them"*; selecting another row shows *"…Switching campaigns will discard them."* The guide documents only the row-switch variant.

## What this adds

Screenshot support for the kms-docs documentation pipeline: a page can include screenshots captured from the running product, the capture is bundled in the plugin (not delegated to another plugin), and data leakage is prevented structurally.

## Design decisions (locked)

- **Screenshots are an aid, never the sole source.** Text (prose + field/column tables) must stand alone so the retrieval reader and screen-reader reader lose nothing; a screenshot is redundant-on-purpose for visual learners. This *reversed* an earlier "screenshots must earn their place / no form screenshots" rule — testing showed that rule fought every model's prior under pressure, and the operator's call (internal audience) is that aids are fine as long as the text is complete. The enforced failure mode is "image-only information," caught at the review gate.
- **Capture is bundled, not delegated.** `doc-screenshooter` runs `scripts/capture.mjs` (Playwright). Dependency: Node + the `playwright` npm package (reuses any cached chromium); run `npm install` in `scripts/` once. `node_modules` is gitignored, so a freshly fetched copy of the plugin needs that `npm install` before capture works.
- **Leakage prevention is layered, no OCR** (proportionate to an internal audience): (1) capture in the product's safe-capture mode; (2) the script asserts the safe state **in code** before every shot and writes no pixels if it fails; (3) crop; (4) human GATE-2 review, scratch dir gitignored. The safe-capture plan is negotiated with the human at GATE 1 — the pipeline does NOT assume a built-in safe mode exists.
- **Policy (operator call): vertical/form-type NAMES are fine in an internal doc; only client DATA is sensitive** (campaign codes, advertiser records, budgets, contacts). The Campaign Tracker vertical list names the real verticals; the New Campaign refusal stands because "AFPF-IL" is a campaign code (data), not a category name.

## capture.mjs spec format

`node scripts/capture.mjs --spec <spec.json> --out-dir <dir> --manifest <file>`

- Steps: `goto`, `click`, `fill`, `select`, `press`, `waitForSelector` (`"state":"attached"` for hidden elements), `waitForTimeout`, `eval` (run JS — drive framework widgets), `waitForFunction` (wait until JS truthy — async re-renders).
- `safeMode`, strongest first: `js` (a predicate proving only safe data is on screen), `selector` (+`hasText`), or `hasText` alone. A shot with no safe-mode assertion is refused.
- `clip.selector` crops to an element; pick the container holding the documented controls AND their result, not the result alone.

## media-hub capture recipe

Also recorded in `media-hub/docs/_meta/safe-capture.md` for the media-hub repo.

- Run from `~/Documents/GitHub/media-hub`:
  `MEDIA_HUB_DEV_MODE=true local=1 Rscript -e 'shiny::runApp("app.R", port=3838, host="127.0.0.1", launch.browser=FALSE)'`
- Needs `DO_PASSWORD` in `~/.zshenv` (dataops Redshift password; the app connects to **prod** at startup). Auth is bypassed by `MEDIA_HUB_DEV_MODE=true` (dev user resolves to internal/all-verticals).
- **Quirk:** data only populates with `local=1` set; without it the grid is empty despite a clean DB connection (latent media-hub bug — flagged, not fixed).
- **Safe mode = CENSAI vertical** (only vertical with safe/internal data). Set it via selectize, not the native select (which is hidden): `eval` step `window.$('#filterVertical')[0].selectize.setValue('CENSAI')`. MCode Editor has its OWN filter, `#filterMcodeVertical`.
- **Safe-mode assertion (content-based):** every visible grid row's Vertical cell is `CENSAI`. For per-campaign tabs (Campaign Edits, Channel Report), reach a CENSAI campaign from the CENSAI-filtered tracker and assert the open campaign is CENSAI. New Campaign uses an empty-form predicate (all inputs empty, dropdowns closed) — NOT the CENSAI-rows one.
- **Clip:** the active tab pane (controls + result), which also crops the dev-mode impersonation bar. Not the grid element alone.
- **Avoid** (not scoped by vertical → other clients' data): Orphaned Spend, Intake Queue, Admin. Vertical-scoped (safe with CENSAI): Campaign Tracker, Campaign Edits, Channel Report, MCode Editor.
- **Stop the app when done:** `pkill -f "port=3838"` to release the prod connection.

## How it was validated

- **Rulebook:** RED-GREEN-REFACTOR with subagents (Sonnet at production tier, Haiku one tier down). The "no form" rule failed at both tiers; replaced with the aids policy. The "image-only information" tell is reliably caught at review.
- **capture.mjs:** smoke test against a local fixture — captured on the pass path, refused with no pixels on the safe-mode-fail path.
- **End-to-end (live, media-hub):** `doc-screenshooter` built the spec and captured leak-free CENSAI shots across five tabs; two conditional shots were correctly skipped on missing data, and the New Campaign shot was correctly refused on the app leak. The agent's spec-building — the previously-untested layer — is now proven.
