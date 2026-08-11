#!/usr/bin/env bash
# standalone-check.sh — assert kms-docs invokes no external plugin/skill/agent.
# Scans the invoked pieces (agents, skills, commands, scripts). Exit 0 = clean, 1 = external reference.
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"   # -> plugins/kms-docs

# Invoked pieces only. HANDOFF-*.md and STATUS.md (plugin-root maintainer notes) are not invoked, so not scanned.
ROOTS=("$PLUGIN_DIR/agents" "$PLUGIN_DIR/skills" "$PLUGIN_DIR/commands" "$PLUGIN_DIR/scripts")

# Forbidden: other ed3d plugins/agents, the generic-agent fallback, and ANY kms-* sibling.
# kms-docs self-references are stripped before the re-test below, so only siblings (kms-human-voice,
# kms-mcp-patterns, any future kms-*) trip it.
FORBIDDEN='ed3d-|general-purpose|kms-[a-z]'

# Standalone-posture declaration sentences are ALLOWED to name the forbidden tokens (as things NOT invoked).
ALLOW='invokes? no|no external|no other plugin|no general-purpose|not a generic|standalone posture|no cross-plugin|without ed3d'

fail=0
files=()
while IFS= read -r f; do files+=("$f"); done < <(
  find "${ROOTS[@]}" \
    -type d -name node_modules -prune -o \
    \( -name '*.md' -o -name '*.mjs' -o -name '*.sh' \) -type f -print \
  | grep -v '/standalone-check.sh$'
)

for f in "${files[@]}"; do
  while IFS= read -r hit; do
    # hit = "path:lineno:content"
    content="${hit#*:}"; content="${content#*:}"
    # Allow standalone-posture declarations.
    printf '%s' "$content" | grep -qiE "$ALLOW" && continue
    # Strip allowed kms-docs self-references, then re-test the residual.
    residual="$(printf '%s' "$content" | sed 's/kms-docs//g')"
    printf '%s' "$residual" | grep -qiE "$FORBIDDEN" || continue
    echo "EXTERNAL REFERENCE: $hit"
    fail=1
  done < <(grep -nHE "$FORBIDDEN" "$f" || true)
done

if [ "$fail" -ne 0 ]; then
  echo "standalone-check FAILED: external references found above." >&2
  exit 1
fi
echo "standalone-check OK: no external plugin/skill/agent invocations in the bundled pieces."
