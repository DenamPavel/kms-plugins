#!/bin/bash
# Intensity review gate.
#
# Polarity: silence by default. A file has to look outward-facing to earn an
# agent dispatch. The earlier version excluded a blocklist and fired on
# everything else, which meant every findings.md, implementation plan, and
# test-requirements file triggered a review. Measured against one working
# corpus of 1,416 markdown files, the old gate fired on 984; about 16 of those
# were written for a human reader. Content shape does not separate the two
# classes either (client memos run 0.22-0.79 prose fraction while CLAUDE.md
# runs 0.93), so the gate keys on naming and location instead, with an explicit
# opt-in for anything it misses.

FILE=$(jq -r '.tool_response.filePath // .tool_input.file_path' 2>/dev/null)

if [[ -z "$FILE" ]] || [[ ! -f "$FILE" ]]; then
  exit 0
fi

PATH_LOWER=$(echo "$FILE" | tr '[:upper:]' '[:lower:]')
BASENAME_LOWER=$(basename "$PATH_LOWER")

# Machine-facing locations, checked for every file type. These veto even an
# outward-looking filename: an example memo shipped inside a skill directory is
# documentation of a memo, not a memo.
case "$PATH_LOWER" in
  */.claude/*|*/skills/*|*/plugins/*|*/agents/*|*/commands/*) exit 0 ;;
  */docs/design-plans/*|*/docs/implementation-plans/*) exit 0 ;;
  */node_modules/*|*/scratchpad/*|*/backups/*|*/.git/*|/tmp/*|/private/tmp/*) exit 0 ;;
  */tests/*|*/test/*|*/testkit/*|*/fixtures/*|*/examples/*) exit 0 ;;
  */council/*|*/research/*|*/control-corpus/*) exit 0 ;;
esac

IS_DELIVERABLE=false

case "$PATH_LOWER" in
  *.md|*.txt)
    # An explicit opt-out ends it before anything else is considered.
    if head -10 "$FILE" | grep -qiE '^voice:[[:space:]]*(skip|none|off)'; then
      exit 0
    fi

    # Pipeline artifacts and working docs that carry an outward-facing word in
    # the name. A file called STATUS-2026-07-15-segmentation-memo.md is a status
    # doc, so these are checked before the positive markers below.
    case "$BASENAME_LOWER" in
      claude.md|agents.md|memory.md|skill.md|readme.md|changelog.md|project.md|todo.md) exit 0 ;;
      *pickup*|*status*|*handoff*|*progress*) exit 0 ;;
      findings.md|brief.md|test-requirements.md|phase_[0-9]*) exit 0 ;;
      *red-team*|*audit*|*-grade.md|*-factcheck*) exit 0 ;;
      *run-log*|*resume*|*ledger*) exit 0 ;;
    esac

    # Outward-facing markers: written for someone who is not an agent. Matched on
    # word boundaries, so "memory-called-empire.md" is not a memo.
    if echo "$BASENAME_LOWER" | grep -qE '(^|[^a-z])(memo|client|pre-?read|email|letter|proposal|deliverable|essay|one-?pager|white-?paper)([^a-z]|$)'; then
      IS_DELIVERABLE=true
    fi
    case "$PATH_LOWER" in
      */deliverables/*|*/essays/*|*/client-*/*|*/clients/*) IS_DELIVERABLE=true ;;
    esac
    # Note: */drafts/* is deliberately NOT a positive marker. A generate-and-select
    # loop writes dozens of drafts and carries its own review battery; reviewing
    # each one is duplicate work. Opt a finished draft in with frontmatter or a
    # .human-voice-review marker file in its directory.

    # Opt-in for anything the markers miss: a frontmatter key, or a marker file
    # in the directory that covers every prose file beside it.
    if head -10 "$FILE" | grep -qiE '^(audience|voice):[[:space:]]*(human|client|reader|review)'; then
      IS_DELIVERABLE=true
    fi
    if [[ -f "$(dirname "$FILE")/.human-voice-review" ]]; then
      IS_DELIVERABLE=true
    fi
    ;;
  *.py)
    # Deck and document generators: the text is destined for a human reader by
    # construction, so the import is signal enough.
    if grep -qE '^(from |import )(pptx|docx)' "$FILE" 2>/dev/null; then
      IS_DELIVERABLE=true
    fi
    ;;
  *.r|*.rmd)
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

You are reviewing a draft for literary intensity saturation and contrastive framing. Read the file and flag any of these patterns:

1. SENSORY-ABSTRACT PAIRINGS: physical sensations fused with abstract concepts. Flag each instance. One per passage is acceptable; more than that and they stop doing work.

2. ATMOSPHERIC VAGUENESS: words chosen for mood rather than precision. Words like ghosts, echoes, whispers, shadows, hums, pulses, flickering are common examples, but flag any word that is atmospheric rather than specific.

3. COMPULSIVE PERSONIFICATION: objects or abstractions given human agency as a reflex rather than a deliberate choice.

4. STRUCTURAL REPETITION: consecutive sentences following the same syntactic template (e.g., three personified-abstraction openers in a row).

5. REGISTER FLATNESS: passages where every sentence operates at the same intensity with no plain/functional sentences between devices.

6. DENSITY: flag any paragraph with three or more literary devices.

7. CONTRASTIVE FRAMING: a sentence or sentence pair that negates something the reader never believed and then pivots to the real claim ('It's not X, it's Y', 'This isn't X. It's Y.', 'not just X, but also Y', 'Y, not X' as a flourish, 'Less X, more Y'). Flag every instance; there is no acceptable quota. Do not flag a negation that corrects a misconception the reader is likely to hold, a warning, a conditional, or a plain statement of what something does not support.

For .py or .R files generating slides or documents, review only the text content (string literals destined for slides/pages), not the code itself.

For each finding, quote the specific passage and suggest a plainer alternative. Rate overall intensity: LOW (fine), MODERATE (a few spots to check), HIGH (significant rework needed).

These are non-blocking warnings, not demands. Be specific and brief.
AGENT_PROMPT

echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"${MSG//$'\n'/\\n} File: ${ESCAPED_FILE}\"}}"
