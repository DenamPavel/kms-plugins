#!/bin/bash
FILE=$(jq -r '.tool_response.filePath // .tool_input.file_path' 2>/dev/null)

if [[ -z "$FILE" ]] || [[ ! -f "$FILE" ]]; then
  exit 0
fi

IS_DELIVERABLE=false

# Lowercase the basename for case-insensitive exclusion checks
BASENAME=$(basename "$FILE")
BASENAME_LOWER=$(echo "$BASENAME" | tr '[:upper:]' '[:lower:]')

case "$FILE" in
  *.md|*.txt)
    # Exclude internal/Claude files
    case "$FILE" in
      */.claude/*) exit 0 ;;
      */docs/design-plans/*) exit 0 ;;
    esac
    # Case-insensitive exclusion of known non-deliverable filenames
    case "$BASENAME_LOWER" in
      claude.md|agents.md|memory.md|skill.md|readme.md) exit 0 ;;
      # Internal / agent-facing docs: pickup, status, handoff, progress
      *pickup*|*status*|*handoff*|*progress*) exit 0 ;;
    esac
    IS_DELIVERABLE=true
    ;;
  *.py)
    # Python files that generate PowerPoint or Word documents
    if grep -qE '^(from |import )(pptx|docx)' "$FILE" 2>/dev/null; then
      IS_DELIVERABLE=true
    fi
    ;;
  *.R|*.r|*.Rmd|*.rmd)
    # R files that generate documents via officer or rmarkdown
    if grep -qE '(library\(officer\)|library\(rmarkdown\)|require\(officer\)|require\(rmarkdown\))' "$FILE" 2>/dev/null; then
      IS_DELIVERABLE=true
    fi
    ;;
  *)
    exit 0
    ;;
esac

if [[ "$IS_DELIVERABLE" != "true" ]]; then
  exit 0
fi

# Deduplication: skip if this file was reviewed in the last 5 minutes
COOLDOWN_DIR="/tmp/claude-intensity-review"
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

ESCAPED_FILE=$(echo "$FILE" | sed 's/"/\\"/g')
read -r -d '' MSG << 'AGENT_PROMPT'
[intensity-review] Deliverable file detected. Spawn a sonnet-model agent in the background to review this file for intensity saturation. Do NOT stop current work. The agent should use this prompt:

You are reviewing a draft for literary intensity saturation. Read the file and flag any of these patterns:

1. SENSORY-ABSTRACT PAIRINGS: physical sensations fused with abstract concepts. Flag each instance. One per passage is acceptable; more than that and they stop doing work.

2. ATMOSPHERIC VAGUENESS: words chosen for mood rather than precision. Words like ghosts, echoes, whispers, shadows, hums, pulses, flickering are common examples, but flag any word that is atmospheric rather than specific.

3. COMPULSIVE PERSONIFICATION: objects or abstractions given human agency as a reflex rather than a deliberate choice.

4. STRUCTURAL REPETITION: consecutive sentences following the same syntactic template (e.g., three personified-abstraction openers in a row).

5. REGISTER FLATNESS: passages where every sentence operates at the same intensity with no plain/functional sentences between devices.

6. DENSITY: flag any paragraph with three or more literary devices.

For .py or .R files generating slides or documents, review only the text content (string literals destined for slides/pages), not the code itself.

For each finding, quote the specific passage and suggest a plainer alternative. Rate overall intensity: LOW (fine), MODERATE (a few spots to check), HIGH (significant rework needed).

These are non-blocking warnings, not demands. Be specific and brief.
AGENT_PROMPT

echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"${MSG//$'\n'/\\n} File: ${ESCAPED_FILE}\"}}"
