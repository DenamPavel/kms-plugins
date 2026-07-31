#!/bin/bash
# audit-summary.sh — PostToolUse (Write|Edit) fact-auditor for multi-source summaries.
# Fires on project-tree summary/findings/memo docs and dispatches a cold, re-deriving
# auditor to catch second-order errors (over-compressed takeaways, sample-to-general
# leaps, mischaracterized reviews). Non-blocking. Mirrors the human-voice intensity hook.
# Deliberately does NOT fire on angel output (~/.angel, ~/.claude) — angel has its own
# integrator; this targets the non-angel councils.

FILE=$(jq -r '.tool_response.filePath // .tool_input.file_path' 2>/dev/null)

if [[ -z "$FILE" ]] || [[ ! -f "$FILE" ]]; then
  exit 0
fi

# Only prose files
case "$FILE" in
  *.md|*.txt) ;;
  *) exit 0 ;;
esac

# Exclude internal / non-project locations
case "$FILE" in
  */.claude/*) exit 0 ;;
  */.angel/*) exit 0 ;;
  /tmp/*|/private/tmp/*) exit 0 ;;
  */docs/design-plans/*) exit 0 ;;
esac

BASENAME=$(basename "$FILE")
BASENAME_LOWER=$(echo "$BASENAME" | tr '[:upper:]' '[:lower:]')

# Exclude known non-deliverable / internal filenames
case "$BASENAME_LOWER" in
  claude.md|agents.md|memory.md|skill.md|readme.md) exit 0 ;;
  *pickup*|*status*|*handoff*|*progress*) exit 0 ;;
esac

# Trigger only on summary-shaped documents: filename keyword OR a findings-type heading.
IS_SUMMARY=false
case "$BASENAME_LOWER" in
  *findings*|*summary*|*takeaway*|*memo*|*synthesis*|*council*|*analysis*|*report*)
    IS_SUMMARY=true ;;
esac

if [[ "$IS_SUMMARY" != "true" ]]; then
  if head -n 80 "$FILE" 2>/dev/null | grep -qiE '^#{1,4}[[:space:]]+(key )?(findings|takeaways|conclusions|executive summary|summary)\b'; then
    IS_SUMMARY=true
  fi
fi

if [[ "$IS_SUMMARY" != "true" ]]; then
  exit 0
fi

# Deduplication: skip if this file was audited in the last 5 minutes
COOLDOWN_DIR="/tmp/claude-audit-summary"
mkdir -p "$COOLDOWN_DIR" 2>/dev/null
HASH=$(echo "$FILE" | md5 -q 2>/dev/null || echo "$FILE" | md5sum 2>/dev/null | cut -d' ' -f1)
STAMP_FILE="$COOLDOWN_DIR/$HASH"

if [[ -f "$STAMP_FILE" ]]; then
  LAST_REVIEW=$(cat "$STAMP_FILE" 2>/dev/null)
  NOW=$(date +%s)
  ELAPSED=$(( NOW - LAST_REVIEW ))
  if [[ "$ELAPSED" -lt 300 ]]; then
    exit 0
  fi
fi

date +%s > "$STAMP_FILE"

read -r -d '' MSG << 'AGENT_PROMPT'
[audit-summary] You wrote a summary/findings document by hand.

The enforced path for a council/panel summary is the working-with-panels skill, which pipes the raw council outputs through the panel-audit-loop workflow: a re-deriving auditor loops against the summary until it converges. You skipped it.

As a backstop, spawn the panel-auditor agent in the background for a single audit pass on this file: Agent(subagent_type: "panel-audit:panel-auditor", model: fable, prompt: "Audit the summary at <the File path below>. Re-derive each load-bearing claim against primary sources in the project per your mandate; re-derive or flag."). Do NOT stop current work; this pass is advisory. One audit pass is not the loop — if this came from a council you ran, re-run it through the working-with-panels skill.
AGENT_PROMPT

# Build the JSON with jq so all escaping (quotes, newlines) is handled correctly.
CONTEXT="$MSG
File: $FILE"
jq -cn --arg ctx "$CONTEXT" \
  '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'
