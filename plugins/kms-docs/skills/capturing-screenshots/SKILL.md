---
name: capturing-screenshots
description: Use when a documentation pipeline captures screenshots from a running product - covers the bundled Playwright capture script, the declarative capture spec, the mandatory safe-mode assertion that prevents data leakage, cropping, the scratch-directory workflow, and the manifest. Used by the doc-screenshooter agent.
---

# Capturing Screenshots

How the documentation pipeline captures screenshots from a running product without leaking real data. The capture is bundled in this plugin (`scripts/capture.mjs`), not delegated to another tool. The `doc-screenshooter` agent drives it.

## The principle: leakage prevention is enforced in code, not by discretion

A screenshot of a running product can put real data into a committed image. The defense is not a reminder to be careful; it is a guard the capture script enforces. Every shot must assert a **safe-mode indicator** before any pixels are written. If the indicator is absent, the script writes no file for that shot and exits non-zero. A forgotten safe-mode toggle therefore cannot leak: it produces a refused shot, not a leaked image.

This is the structural form of the `writing-documentation` rule "no real data in the frame." Read that rule; this skill is how the pipeline carries it out.

## Dependency

Capture needs Node and the `playwright` npm package. Install once with `npm install` in this plugin's `scripts/` directory; Playwright reuses any chromium already in the local browser cache, so this is the npm package, not a fresh browser download. The capture depends on Node and Playwright, not on any other plugin.

## The capture spec

The agent describes the capture declaratively in a JSON spec, rather than writing browser code. The script executes it.

```json
{
  "baseUrl": "http://localhost:3838",
  "viewport": { "width": 1280, "height": 900 },
  "safeMode": { "selector": "#vertical-label", "hasText": "Censai" },
  "shots": [
    {
      "name": "campaign-tracker",
      "surface": "Campaign Tracker grid",
      "state": "sorted by Status descending",
      "steps": [
        { "action": "goto", "url": "/" },
        { "action": "click", "selector": "#sort-status" },
        { "action": "waitForSelector", "selector": "#tracker-grid" }
      ],
      "clip": { "selector": "#tracker-grid" },
      "filename": "campaign-tracker.png"
    }
  ]
}
```

- **`safeMode`** is the assertion that proves the app is showing safe data. Three forms, strongest first:
  - `js`: a JavaScript expression that must return truthy. Prefer this when the safe condition is about *what is on screen*, for example "every visible row belongs to the safe vertical": `{ "js": "(()=>{const v=[...document.querySelectorAll('#grid tbody tr')].map(r=>r.children[2]?.textContent?.trim());return v.length>0 && v.every(x=>x==='CENSAI');})()" }`. A content check like this is stronger than a control's value, because it proves no unsafe row is showing rather than that a filter is merely set.
  - `selector` (optionally with `hasText` to require specific text inside it).
  - `hasText` alone, to require text anywhere on the page.

  Set it globally and override per shot when surfaces differ. A shot with no safe-mode assertion is refused.
- **`steps`** navigate and set state. Supported actions: `goto`, `click`, `fill`, `select`, `press`, `waitForSelector` (add `"state": "attached"` for a present-but-hidden element, such as a native `<select>` behind a selectize widget), `waitForTimeout`, `eval` (run a JS `expr` to drive a framework widget the native actions cannot, e.g. `window.$('#filterVertical')[0].selectize.setValue('CENSAI')`), and `waitForFunction` (wait until a JS `fn` is truthy, e.g. an async grid finished re-rendering after a filter change).
- **`clip.selector`** crops the shot to one element, which also trims browser chrome and unrelated panels. Choose a container that includes the controls the section documents, not only their result: a section about a filter clips to the panel holding the filter *and* the grid, not the grid element alone. Omit it only for a deliberate full-page shot.
- **`filename`** is the image name; keep it to the surface it shows.

## Running it

```bash
node <plugin>/scripts/capture.mjs --spec <spec.json> --out-dir <scratch-image-dir> --manifest <manifest.json>
```

Write images to a **scratch directory**, never straight into the docs repo. The script writes a manifest listing each shot's name, surface, state, and status (`captured` or `failed`, with the reason). Exit code is non-zero if any shot was refused.

## After capture

- Read the manifest. Report refused shots with their reasons. Do not edit the spec to skip a safe-mode assertion so a refused shot will pass; a refusal means the surface was not in a safe state.
- Only the screenshots a human approves at GATE 2 move from the scratch directory into the docs image directory and the repo. Keep the scratch directory out of version control.

## What this skill does not do

- It does not decide which surfaces deserve a screenshot. That is the capture plan from `doc-investigator`, approved at GATE 1.
- It does not write alt text or embed images. That is `doc-writer`, applying the `writing-documentation` rules.
- It does not define a project's safe-capture plan (which dataset or mode is safe, and the safe-mode indicator). That lives in the docs repo and is settled with the human at GATE 1.
