#!/bin/bash
# Scores the contrastive-framing check in hooks/check-ai-patterns.sh against
# labeled sentences, then runs the hook end to end on a README.
#
# Fixtures, one JSON object per line, {"label":"pos"|"neg","text":"..."}:
#   gpt-6.1-sol.jsonl      written by GPT-6.1 Sol, 60 pos / 60 neg
#   claude-opus-5.5.jsonl  written by Claude Opus 5.5, 30 pos / 30 neg
# Each model wrote its set without seeing the other's or the hook's pattern.
# The pattern was tuned after both sets existed, so the scores are in-sample.
#
# Fails if recall drops below MIN_RECALL or false positives exceed MAX_FP.
# Raise MIN_RECALL when a change catches more; never raise MAX_FP to pass.
set -u
MIN_RECALL=24
MAX_FP=1

DIR=$(cd "$(dirname "$0")" && pwd)
HOOK="$DIR/../../hooks/check-ai-patterns.sh"

# Read the two patterns out of the hook so this test cannot drift from it.
eval "$(grep -E '^CONTRASTIVE_(RE|GUARD)=' "$HOOK")"
if [[ -z "${CONTRASTIVE_RE:-}" || -z "${CONTRASTIVE_GUARD:-}" ]]; then
  echo "FAIL: could not read CONTRASTIVE_RE / CONTRASTIVE_GUARD from $HOOK"
  exit 1
fi

flagged() { grep -iE "$CONTRASTIVE_RE" | grep -viE "$CONTRASTIVE_GUARD"; }

TP=0; P=0; FP=0; N=0
for f in "$DIR"/*.jsonl; do
  pos=$(jq -r 'select(.label=="pos").text' "$f")
  neg=$(jq -r 'select(.label=="neg").text' "$f")
  p=$(printf '%s\n' "$pos" | grep -c .); n=$(printf '%s\n' "$neg" | grep -c .)
  tp=$(printf '%s\n' "$pos" | flagged | grep -c .); fp=$(printf '%s\n' "$neg" | flagged | grep -c .)
  printf '%-24s recall %3d/%-3d  false positives %2d/%-3d\n' "$(basename "$f")" "$tp" "$p" "$fp" "$n"
  if [[ -n "${VERBOSE:-}" ]]; then
    printf '%s\n' "$neg" | flagged | sed 's/^/  false positive: /'
    printf '%s\n' "$pos" | grep -viE "$CONTRASTIVE_RE" | sed 's/^/  missed: /'
  fi
  TP=$((TP + tp)); P=$((P + p)); FP=$((FP + fp)); N=$((N + n))
done
printf '%-24s recall %3d/%-3d  false positives %2d/%-3d\n' "total" "$TP" "$P" "$FP" "$N"

STATUS=0
if (( TP < MIN_RECALL )); then echo "FAIL: recall $TP is below $MIN_RECALL"; STATUS=1; fi
if (( FP > MAX_FP )); then echo "FAIL: $FP false positives exceeds $MAX_FP"; STATUS=1; fi

# End to end: the hook must check README files and emit valid JSON.
TMP=$(mktemp -d)
printf '# Demo\n\nThis cache is not an optimization, it is a requirement.\n' > "$TMP/README.md"
OUT=$(printf '{"tool_input":{"file_path":"%s"}}' "$TMP/README.md" | bash "$HOOK")
if ! printf '%s' "$OUT" | jq -e '.hookSpecificOutput.additionalContext | test("contrastive")' >/dev/null 2>&1; then
  echo "FAIL: hook did not emit a valid contrastive warning for README.md"; echo "  output: $OUT"; STATUS=1
fi
printf '# Demo\n\nIf the file is not found, it is created.\n' > "$TMP/notes.md"
OUT=$(printf '{"tool_input":{"file_path":"%s"}}' "$TMP/notes.md" | bash "$HOOK")
if [[ -n "$OUT" ]]; then echo "FAIL: hook flagged a conditional"; echo "  output: $OUT"; STATUS=1; fi

# The intensity review prompt is spliced into JSON unescaped, so a double quote
# in it breaks the hook. Check it still parses and still asks for the contrastive pass.
INTENSITY="$DIR/../../hooks/check-intensity.sh"
printf 'audience: human\n\nHello.\n' > "$TMP/memo-$$.md"
OUT=$(printf '{"tool_input":{"file_path":"%s"}}' "$TMP/memo-$$.md" | bash "$INTENSITY")
if ! printf '%s' "$OUT" | jq -e '.hookSpecificOutput.additionalContext | test("CONTRASTIVE FRAMING")' >/dev/null 2>&1; then
  echo "FAIL: check-intensity.sh did not emit valid JSON with the contrastive item"; STATUS=1
fi
rm -rf "$TMP"

(( STATUS == 0 )) && echo "PASS"
exit $STATUS
