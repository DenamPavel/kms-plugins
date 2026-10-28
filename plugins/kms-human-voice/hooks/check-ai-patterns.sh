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
  claude.md|agents.md|memory.md|skill.md) exit 0 ;;
  # Internal / agent-facing docs: pickup, status, handoff, progress
  *pickup*|*status*|*handoff*|*progress*) exit 0 ;;
esac

# A README is read by people, so it gets the contrastive check. It keeps its
# em-dash exemption, since READMEs often quote commands and tables that use them.
IS_README=false
[[ "$BASENAME_LOWER" == "readme.md" ]] && IS_README=true

WARNINGS=""

if [[ "$IS_README" != "true" ]]; then
  EMDASH_COUNT=$(grep -oE ' — | -- |—' "$FILE" 2>/dev/null | wc -l | tr -d ' ')
  EMDASH_COUNT=${EMDASH_COUNT:-0}
  if [[ "$EMDASH_COUNT" -gt 1 ]]; then
    WARNINGS="${WARNINGS}Found ${EMDASH_COUNT} em-dashes. Replace with commas, semicolons, or periods. "
  fi
fi

# Contrastive framing: a negation followed, after a comma, semicolon, colon,
# period, or em-dash, by a pronoun that asserts the replacement ("X isn't Y,
# it's Z"). Tuned for precision over recall: a regex cannot tell rhetorical
# negation from a real correction, so it flags only the canonical pivot and
# leaves the rest to the skill and the intensity review. CONTRASTIVE_GUARD drops
# conditionals and reasons ("If the file is not found, it's created").
# tests/contrastive/run.sh scores these two patterns against labeled fixtures.
CONTRASTIVE_RE='((\b(it|this|that)(.s|[[:space:]]+is|[[:space:]]+was)?[[:space:]]*(not|n.t))|([[:space:]](is|are|was)[[:space:]]+not|(isn|aren|wasn).t))[[:space:]]+[^.;:!?,—]{1,80}[,;:.—][[:space:]]*(it|they|this|that)(.s|.re|[[:space:]]+is|[[:space:]]+are|[[:space:]]+was)[[:space:]]'
CONTRASTIVE_GUARD='(^|[^[:alnum:]])(if|when|unless|whether|because|since)[^[:alnum:]]'

CONTRASTIVE=$(grep -iE "$CONTRASTIVE_RE" "$FILE" 2>/dev/null | grep -viEc "$CONTRASTIVE_GUARD")
CONTRASTIVE=${CONTRASTIVE:-0}
if [[ "$CONTRASTIVE" -gt 0 ]]; then
  WARNINGS="${WARNINGS}Found ${CONTRASTIVE} lines with contrastive framing (\\\"X isn't Y, it's Z\\\"). State the positive claim directly. "
fi

if [[ -n "$WARNINGS" ]]; then
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"[ai-phrasing-check] ${WARNINGS}Do NOT stop current work to fix these. Note them for a cleanup pass when the document is being finalized for sharing.\"}}"
fi
