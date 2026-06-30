# Screenshot capture feature — handoff

Last updated: 2026-06-30

**Status:** feature code committed to `kms-plugins` `master`. Validated (see below). **Not released** — no version bump, no marketplace sync, no `claude plugin update` yet. Skill/agent prose is machine-written and not yet human-reviewed.

This doc lets a fresh session pick up. Delete it once the feature is released and reviewed.

## What this adds

Screenshot support for the kms-docs documentation pipeline: a page can include screenshots captured from the running product, the capture is bundled in the plugin (not delegated to another plugin), and data leakage is prevented structurally.

## Files in this commit

- `skills/writing-documentation/SKILL.md` — screenshot policy + "image-only information" tell.
- `skills/documentation-pipeline/SKILL.md` — Capture stage (1.5), GATE-1 safe-capture plan, dispatches `doc-screenshooter`; agent table now lists 7 agents.
- `skills/capturing-screenshots/SKILL.md` — NEW. Capture rules + the spec format.
- `agents/doc-screenshooter.md` — NEW. Bundled capture agent (builds a spec, runs the script, never disables the safe-mode assertion).
- `agents/doc-investigator.md` — capture plan + per-surface safe-strategy; clip must include the documented controls.
- `agents/doc-writer.md` — embed manifest images as aids; text complete without them.
- `scripts/capture.mjs`, `scripts/package.json`, `scripts/.gitignore` — NEW. Playwright capture CLI. `node_modules` is gitignored.

## Design decisions (locked)

- **Screenshots are an aid, never the sole source.** Text (prose + field/column tables) must stand alone so the retrieval reader and screen-reader reader lose nothing; a screenshot is redundant-on-purpose for visual learners. This *reversed* an earlier "screenshots must earn their place / no form screenshots" rule — testing showed that rule fought every model's prior under pressure, and the operator's call (internal audience) is that aids are fine as long as the text is complete. The enforced failure mode is "image-only information," caught at the review gate.
- **Capture is bundled, not delegated.** `doc-screenshooter` runs `scripts/capture.mjs` (Playwright). Dependency: Node + the `playwright` npm package (reuses any cached chromium); run `npm install` in `scripts/` once. This replaced an earlier plan to call `ed3d-playwright:playwright-explorer`.
- **Leakage prevention is layered, no OCR** (proportionate to an internal audience): (1) capture in the product's safe-capture mode; (2) the script asserts the safe state **in code** before every shot and writes no pixels if it fails; (3) crop; (4) human GATE-2 review, scratch dir gitignored. The safe-capture plan is negotiated with the human at GATE 1 — the pipeline does NOT assume a built-in safe mode exists.

## capture.mjs spec format

`node scripts/capture.mjs --spec <spec.json> --out-dir <dir> --manifest <file>`

- Steps: `goto`, `click`, `fill`, `select`, `press`, `waitForSelector` (`"state":"attached"` for hidden elements), `waitForTimeout`, `eval` (run JS — drive framework widgets), `waitForFunction` (wait until JS truthy — async re-renders).
- `safeMode`, strongest first: `js` (a predicate proving only safe data is on screen), `selector` (+`hasText`), or `hasText` alone. A shot with no safe-mode assertion is refused.
- `clip.selector` crops to an element; pick the container holding the documented controls AND their result, not the result alone.

## How it was validated

- **Rulebook:** RED-GREEN-REFACTOR with subagents (Sonnet at production tier, Haiku one tier down). The "no form" rule failed at both tiers; replaced with the aids policy. The "image-only information" tell is reliably caught at review after one refactor (option-values-count, alt-text-isn't-body-text).
- **capture.mjs:** smoke test against a local fixture — captured on the pass path, refused with no pixels on the safe-mode-fail path.
- **Track B (live, media-hub):** captured the CENSAI Campaign Tracker, leak-free, cropped to filter+grid. **The `doc-screenshooter` agent (plan → spec) was NOT exercised end-to-end** — the capture *mechanism* is proven, the agent's spec-building is the remaining untested layer.

## media-hub capture recipe (for the real pipeline run)

- Run from `~/Documents/GitHub/media-hub`:
  `MEDIA_HUB_DEV_MODE=true local=1 Rscript -e 'shiny::runApp("app.R", port=3838, host="127.0.0.1", launch.browser=FALSE)'`
- Needs `DO_PASSWORD` in `~/.zshenv` (dataops Redshift password; the app connects to **prod** at startup). Auth is bypassed by `MEDIA_HUB_DEV_MODE=true` (dev user resolves to internal/all-verticals).
- **Quirk:** data only populates with `local=1` set; without it the grid is empty despite a clean DB connection (likely a latent media-hub bug — flagged to operator, not fixed).
- **Safe mode = CENSAI vertical** (only vertical with safe/internal data). Set it via selectize, not the native select (which is hidden): `eval` step `window.$('#filterVertical')[0].selectize.setValue('CENSAI')`.
- **Safe-mode assertion (content-based):** every visible `#campaignTable` row's Vertical cell is `CENSAI`.
- **Clip:** `.tab-pane.active` (filter + grid). NOT `.campaign-table` (grid only — omits the filter the section documents).
- **Avoid** (not scoped by vertical → other clients' data): Orphaned Spend, Intake Queue, Admin. Vertical-scoped (safe with CENSAI): Campaign Tracker, Campaign Edits, Channel Report, MCode Editor.
- A working spec was in session scratch (`spec-mediahub.json`); reproduce it from this recipe.
- **Stop the app when done:** `pkill -f "port=3838"` to release the prod connection.

## Next steps (pickup)

1. **Release / make it live** (use the `maintaining-a-marketplace` skill): bump `plugins/kms-docs/.claude-plugin/plugin.json` (2.0.1 → 2.1.0 suggested), sync the `kms-plugins` marketplace manifest, sync the separate `~/Documents/GitHub/documentation-plugin` export, then `claude plugin update`.
2. **Run the real pipeline** on media-hub (`/write-doc`) to produce the full guide with screenshots, exercising `doc-screenshooter` end-to-end. Record the media-hub safe-capture recipe above in media-hub's docs-repo per-project setup.
3. **Human review** of the machine-written skill/agent prose before relying on it.
4. **Optional:** investigate the `local=1` data-load coupling in media-hub.

## Demo artifact (this session, ephemeral)

A hand-written demonstration of the output *shape* (Campaign Tracker section, filter-in-frame): https://claude.ai/code/artifact/af831790-7fca-40aa-9182-7c019caff5a2 (private; the CENSAI screenshot was uploaded to claude.ai with operator approval). It is not pipeline-produced and not committed to media-hub.
