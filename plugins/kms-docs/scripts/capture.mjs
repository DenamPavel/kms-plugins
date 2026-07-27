#!/usr/bin/env node
// Bundled screenshot capture for the kms-docs documentation pipeline.
//
// Reads a declarative capture spec, enforces a mandatory safe-mode assertion
// before every shot, captures cropped images, and writes a manifest. The
// safe-mode assertion is the structural leakage guard: a shot whose safe
// indicator is absent produces no pixels and a non-zero exit, so a forgotten
// safe-mode toggle cannot leak real data into a committed image.
//
// Usage:
//   node capture.mjs --spec <spec.json> --out-dir <dir> [--manifest <file>]
//
// Spec shape:
//   {
//     "baseUrl": "http://localhost:3838",
//     "viewport": { "width": 1280, "height": 900 },
//     "safeMode": { "selector": "#vertical-label", "hasText": "Censai" },
//     "shots": [
//       {
//         "name": "campaign-tracker",
//         "surface": "Campaign Tracker grid",
//         "state": "sorted by Status descending",
//         "steps": [ { "action": "goto", "url": "/" },
//                    { "action": "waitForSelector", "selector": "#tracker" } ],
//         "clip": { "selector": "#tracker" },
//         "filename": "campaign-tracker.png"
//       }
//     ]
//   }
//
// safeMode may be set globally and/or overridden per shot. Supported step
// actions: goto, click, fill, select, press, waitForSelector, waitForTimeout.

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    spec: { type: 'string' },
    'out-dir': { type: 'string' },
    manifest: { type: 'string' },
  },
});

if (!values.spec || !values['out-dir']) {
  console.error('Usage: node capture.mjs --spec <spec.json> --out-dir <dir> [--manifest <file>]');
  process.exit(2);
}

const spec = JSON.parse(readFileSync(values.spec, 'utf8'));
const outDir = resolve(values['out-dir']);
mkdirSync(outDir, { recursive: true });
const manifestPath = values.manifest ? resolve(values.manifest) : join(outDir, 'manifest.json');
const baseUrl = spec.baseUrl ?? '';

function urlFor(u) {
  if (!u) return baseUrl;
  if (/^[a-z]+:\/\//i.test(u)) return u;
  return baseUrl.replace(/\/$/, '') + (u.startsWith('/') ? u : '/' + u);
}

async function runStep(page, step) {
  switch (step.action) {
    case 'goto':
      await page.goto(urlFor(step.url), { waitUntil: step.waitUntil ?? 'load' });
      break;
    case 'click':
      await page.click(step.selector);
      break;
    case 'fill':
      await page.fill(step.selector, step.value ?? '');
      break;
    case 'select':
      await page.selectOption(step.selector, step.value);
      break;
    case 'press':
      await page.press(step.selector ?? 'body', step.key);
      break;
    case 'waitForSelector':
      // state defaults to 'visible'; use 'attached' for present-but-hidden
      // elements (e.g. a native <select> hidden behind a selectize widget).
      await page.waitForSelector(step.selector, { timeout: step.timeout ?? 15000, state: step.state ?? 'visible' });
      break;
    case 'waitForTimeout':
      await page.waitForTimeout(step.ms ?? 500);
      break;
    case 'eval':
      // Run a JS expression in the page (e.g. drive a framework widget the
      // native form actions cannot, like a Shiny selectize input).
      await page.evaluate(step.expr);
      break;
    case 'waitForFunction':
      // Wait until a JS predicate is truthy (e.g. an async grid finished
      // re-rendering after a filter change).
      await page.waitForFunction(step.fn, null, { timeout: step.timeout ?? 15000 });
      break;
    default:
      throw new Error(`Unknown step action: ${step.action}`);
  }
}

// The structural leakage guard. No safe-mode assertion, or an assertion that
// does not hold, means the shot is refused before any pixels are written.
async function assertSafeMode(page, safeMode) {
  if (!safeMode || (!safeMode.selector && !safeMode.hasText && !safeMode.js)) {
    throw new Error('No safe-mode assertion defined; refusing to capture. Every shot must declare how its safe state is confirmed.');
  }
  // Strongest form: a JS predicate that proves only safe data is on screen
  // (e.g. every visible row belongs to the safe vertical). Must return truthy.
  if (safeMode.js) {
    const ok = await page.evaluate(safeMode.js).catch(() => false);
    if (!ok) throw new Error(`Safe-mode JS assertion failed: ${safeMode.js}`);
    return;
  }
  if (safeMode.selector) {
    const el = await page
      .waitForSelector(safeMode.selector, { timeout: safeMode.timeout ?? 10000 })
      .catch(() => null);
    if (!el) throw new Error(`Safe-mode selector not found: ${safeMode.selector}`);
    if (safeMode.hasText) {
      const txt = (await el.textContent()) ?? '';
      if (!txt.includes(safeMode.hasText)) {
        throw new Error(`Safe-mode text "${safeMode.hasText}" not present in ${safeMode.selector} (found: "${txt.trim().slice(0, 80)}")`);
      }
    }
    return;
  }
  const body = (await page.textContent('body').catch(() => '')) ?? '';
  if (!body.includes(safeMode.hasText)) {
    throw new Error(`Safe-mode text "${safeMode.hasText}" not found on page`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: spec.viewport ?? { width: 1280, height: 900 } });
const page = await context.newPage();

const manifest = [];
let failures = 0;

for (const shot of spec.shots ?? []) {
  const entry = {
    name: shot.name,
    filename: shot.filename,
    surface: shot.surface ?? null,
    state: shot.state ?? null,
    status: 'pending',
  };
  try {
    for (const step of shot.steps ?? []) await runStep(page, step);
    await assertSafeMode(page, shot.safeMode ?? spec.safeMode);
    const outPath = join(outDir, shot.filename);
    if (shot.clip?.selector) {
      await page.waitForSelector(shot.clip.selector, { timeout: 15000 });
      await page.locator(shot.clip.selector).first().screenshot({ path: outPath });
    } else {
      await page.screenshot({ path: outPath, fullPage: shot.fullPage ?? false });
    }
    entry.status = 'captured';
    entry.safeModeVerified = true;
  } catch (err) {
    entry.status = 'failed';
    entry.error = String(err?.message ?? err);
    failures++;
    console.error(`[capture] shot "${shot.name}" refused/failed: ${entry.error}`);
  }
  manifest.push(entry);
}

writeFileSync(manifestPath, JSON.stringify({ generatedShots: manifest }, null, 2));
await browser.close();

const captured = manifest.filter((m) => m.status === 'captured').length;
console.log(`[capture] ${captured}/${manifest.length} captured; manifest at ${manifestPath}`);
process.exit(failures > 0 ? 1 : 0);
