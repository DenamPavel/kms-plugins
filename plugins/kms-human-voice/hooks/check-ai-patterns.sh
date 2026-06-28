#!/bin/bash
FILE=$(jq -r '.tool_response.filePath // .tool_input.file_path' 2>/dev/null)

if [[ -z "$FILE" ]] || [[ ! -f "$FILE" ]]; then
  exit 0
fi

case "$FILE" in
  *.md|*.txt) ;;
  *) exit 0 ;;
esac

# Skip internal / agent-facing files. The em-dash and contrastive checks only
# apply to people-facing deliverables, not pickup/status/handoff docs.
case "$FILE" in
  */.claude/*) exit 0 ;;
  */docs/design-plans/*) exit 0 ;;
esac
BASENAME_LOWER=$(basename "$FILE" | tr '[:upper:]' '[:lower:]')
case "$BASENAME_LOWER" in
  claude.md|agents.md|memory.md|skill.md|readme.md) exit 0 ;;
  # Internal / agent-facing docs: pickup, status, handoff, progress
  *pickup*|*status*|*handoff*|*progress*) exit 0 ;;
esac

WARNINGS=""

EMDASH_COUNT=$(grep -oE ' — | -- |—' "$FILE" 2>/dev/null | wc -l | tr -d ' ')
EMDASH_COUNT=${EMDASH_COUNT:-0}
if [[ "$EMDASH_COUNT" -gt 1 ]]; then
  WARNINGS="${WARNINGS}Found ${EMDASH_COUNT} em-dashes. Replace with commas, semicolons, or periods. "
fi

CONTRASTIVE=$(grep -ciE '(not [a-z]+, it.s |the [a-z]+ is not |isn.t [a-z]+, it.s )' "$FILE" 2>/dev/null)
CONTRASTIVE=${CONTRASTIVE:-0}
if [[ "$CONTRASTIVE" -gt 0 ]]; then
  WARNINGS="${WARNINGS}Found ${CONTRASTIVE} contrastive phrasing patterns. Rephrase. "
fi

if [[ -n "$WARNINGS" ]]; then
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"[ai-phrasing-check] ${WARNINGS}Do NOT stop current work to fix these. Note them for a cleanup pass when the document is being finalized for sharing.\"}}"
fi
