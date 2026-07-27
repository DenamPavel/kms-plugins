#!/usr/bin/env node
// Deterministic manifest-dedup filter for AGENTS.md distillation.
//
// Reads a drafted AGENTS.md and a JSON array of manifest field values
// (extracted from package.json scripts, Makefile targets, etc.) and reports
// which lines in AGENTS.md are manifest-derivable (noise that duplicates
// extracted facts rather than project-specific guidance).
//
// A line is flagged if it matches a manifest value exactly (after normalization),
// or within a small fixed edit distance (Levenshtein ≤ max-distance), provided
// both strings are at least min-fuzzy-len characters. The min-length guard
// prevents false positives on short tokens; short lines match only on equality.
//
// The distiller applies this rule: keep a command only where it is presented
// as real, project-specific guidance (Commands/Testing sections), not as
// filler prose. A manifest command repeated in fenced code or prose is still
// low-signal. The filter reports candidates; the distiller decides.
//
// Usage:
//   node agents-md-filter.mjs --agents-md <path> --manifest-values <path> \
//     [--max-distance 2] [--min-fuzzy-len 8] [--report <path>]
//
// Exit code: non-zero if any line was flagged (mirroring capture.mjs),
// zero if clean.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    'agents-md': { type: 'string' },
    'manifest-values': { type: 'string' },
    'max-distance': { type: 'string', default: '2' },
    'min-fuzzy-len': { type: 'string', default: '8' },
    report: { type: 'string' },
  },
});

if (!values['agents-md'] || !values['manifest-values']) {
  console.error(
    'Usage: node agents-md-filter.mjs --agents-md <path> --manifest-values <path> ' +
    '[--max-distance 2] [--min-fuzzy-len 8] [--report <path>]'
  );
  process.exit(2);
}

const agentsMdPath = resolve(values['agents-md']);
const manifestValuesPath = resolve(values['manifest-values']);
const maxDistance = parseInt(values['max-distance'], 10);
const minFuzzyLen = parseInt(values['min-fuzzy-len'], 10);
const reportPath = values.report ? resolve(values.report) : null;

// Levenshtein distance (inline, no dependency).
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[0][i] = i;
  for (let j = 0; j <= n; j++) dp[j][0] = j;

  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      if (a[i - 1] === b[j - 1]) {
        dp[j][i] = dp[j - 1][i - 1];
      } else {
        dp[j][i] = 1 + Math.min(dp[j - 1][i], dp[j][i - 1], dp[j - 1][i - 1]);
      }
    }
  }

  return dp[n][m];
}

// Normalize: trim, collapse internal whitespace, lowercase.
function normalize(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Read inputs.
const agentsMdContent = readFileSync(agentsMdPath, 'utf8');
const manifestValues = JSON.parse(readFileSync(manifestValuesPath, 'utf8'));

// Validate manifest-values is an array of strings.
if (!Array.isArray(manifestValues) || !manifestValues.every((v) => typeof v === 'string')) {
  console.error('manifest-values must be a JSON array of strings');
  process.exit(2);
}

// Normalize manifest values once.
const normalizedManifest = manifestValues.map(normalize);

// Process AGENTS.md line by line.
const lines = agentsMdContent.split('\n');
const flaggedLines = [];
const keptLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // Skip empty lines and headings.
  if (!trimmed || trimmed.startsWith('#')) {
    keptLines.push({ line, lineNumber: i + 1 });
    continue;
  }

  const normalized = normalize(line);
  let matched = null;

  // Check each manifest value.
  for (const manifestValue of normalizedManifest) {
    // Exact match always applies.
    if (normalized === manifestValue) {
      matched = {
        matchedValue: manifestValue,
        distance: 0,
        matchType: 'exact',
      };
      break;
    }

    // Fuzzy match: only if both are at least min-fuzzy-len chars.
    if (normalized.length >= minFuzzyLen && manifestValue.length >= minFuzzyLen) {
      const dist = levenshteinDistance(normalized, manifestValue);
      if (dist <= maxDistance) {
        matched = {
          matchedValue: manifestValue,
          distance: dist,
          matchType: 'fuzzy',
        };
        break;
      }
    }
  }

  if (matched) {
    flaggedLines.push({
      line,
      lineNumber: i + 1,
      ...matched,
    });
  } else {
    keptLines.push({ line, lineNumber: i + 1 });
  }
}

// Build report.
const report = {
  flaggedLines,
  keptLines,
};

// Output report.
const reportJson = JSON.stringify(report, null, 2);
if (reportPath) {
  writeFileSync(reportPath, reportJson);
} else {
  console.log(reportJson);
}

// Exit non-zero if any lines were flagged.
process.exit(flaggedLines.length > 0 ? 1 : 0);
