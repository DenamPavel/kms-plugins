export const meta = {
  name: 'panel-audit-loop',
  description: 'Summarize raw council/panel outputs into a source-attributed summary, then loop a re-deriving adversarial auditor against it until it converges or hits the round cap (2 by default, set with args.roundCap). Round 1 audits every claim and the prose; later rounds audit only what was flagged or rewritten. Returns the summary plus a full audit trail; contested, unverifiable, unresolved, and prose findings surface for human adjudication.',
  phases: [
    { title: 'Summarize', detail: 'collapse raw council outputs into attributed claims' },
    { title: 'Audit', detail: 're-derive each claim against primary sources' },
    { title: 'Revise', detail: 'fix or contest the auditor findings' },
  ],
}

// args: { rawOutputs: string (required), question?: string, sourceHints?: string, roundCap?: number }
// rawOutputs is re-sent to the summarizer on EVERY revision round. Prefer passing absolute
// file paths to the seat reports plus an instruction to Read them, not the inlined text.

// The prose field carries no claim id, so it was previously unauditable: the verdict schema
// requires an integer claimId. Reserve 0 for it. Claim ids start at 1, so 0 cannot collide.
const PROSE_ID = 0

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    prose: { type: 'string', description: 'Human-readable summary / takeaways rendered from the claims.' },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'integer', description: 'Stable id; keep identical across revisions for the same claim.' },
          text: { type: 'string' },
          sources: { type: 'string', description: 'Which seat/model/memo/dataset supports this claim.' },
          contested: { type: 'string', description: 'Empty unless disputing an auditor finding; then a one-line source-grounded reason.' },
        },
        required: ['id', 'text', 'sources', 'contested'],
      },
    },
  },
  required: ['prose', 'claims'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overall: { type: 'string', enum: ['CLEAN', 'MINOR', 'MATERIAL'] },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claimId: { type: 'integer', description: 'The claim id this finding is about, or 0 for the summary\'s "prose" field.' },
          verdict: { type: 'string', enum: ['wrong', 'overstated', 'unverifiable', 'clean'] },
          evidence: { type: 'string', description: 'What the primary source supports, and how you re-derived it.' },
          corrected: { type: 'string', description: 'The claim as the source supports it, or empty.' },
          status: { type: 'string', enum: ['open', 'contested'], description: 'contested = genuine standoff after evaluating the summarizer dispute; send to human.' },
        },
        required: ['claimId', 'verdict', 'evidence', 'corrected', 'status'],
      },
    },
  },
  required: ['overall', 'issues'],
}

function summarizePrompt(raw, question) {
  return `Mode 1: initial summary. Collapse the raw council/panel outputs below into a source-attributed summary.\n\n${question ? `The council was convened on: ${question}\n\n` : ''}RAW COUNCIL OUTPUTS:\n${raw}\n\nYour structured output MUST include a populated "claims" array (roughly the 10-20 most load-bearing, source-attributed claims) — never return prose without claims. Keep "prose" to a few short paragraphs. Assign each claim a stable integer id starting at 1. Leave every "contested" field empty on this pass.`
}

function revisePrompt(raw, prior, issues, question) {
  return `Mode 2: revision. Revise the summary using the auditor's findings.\n\n${question ? `Council question: ${question}\n\n` : ''}RAW COUNCIL OUTPUTS (ground truth for what the seats said):\n${raw}\n\nPRIOR SUMMARY:\n${JSON.stringify(prior, null, 2)}\n\nAUDITOR FINDINGS (each references a claimId; claimId 0 means the finding is about the "prose" field, not a claim):\n${JSON.stringify(issues, null, 2)}\n\nFor each finding: FIX the claim to match the auditor's evidence, or CONTEST it (keep the claim, set "contested" to a one-line source-grounded reason). Keep every claim's id stable. A finding on claimId 0 means rewriting the affected sentence of "prose"; you cannot contest a prose finding by setting a field, so either fix the prose or say why in the prose itself.\n\nDo not rewrite a claim the auditor did not flag. Leave every other claim byte-identical, because the next round audits only what changed and what was flagged, and a gratuitous edit costs a re-derivation. Do not overcorrect either: fix exactly what the evidence supports and keep the part of the claim that was accurate.`
}

function auditPrompt(summary, hints, scopeIds) {
  const scoped = Array.isArray(scopeIds)
  const scopeNote = scoped
    ? `\n\nSCOPE FOR THIS ROUND: audit ONLY these ids: ${scopeIds.join(', ')}. Every other claim was re-derived clean in an earlier round and must not be re-audited; return no issue for it, not even a "clean" one. The scoped ids are the ones a previous round flagged plus the ones the summarizer rewrote in response. Exception: if a scoped claim's new wording contradicts an unscoped claim, flag the scoped one and name the contradiction in your evidence.`
    : ''
  return `Audit this council summary. Re-derive each claim against primary sources; do not proofread.\n\nSUMMARY TO AUDIT:\n${JSON.stringify(summary, null, 2)}\n\n${hints ? `SOURCE HINTS (where to look): ${hints}\n\n` : ''}Reference each finding by the claim's id.${scopeNote}\n\nTHE PROSE FIELD IS IN SCOPE AND IS REPORTED AS claimId 0. The "prose" field is what a human actually reads, and it is where a compression error does the most damage: a generalisation the claims do not support, a count that contradicts a claim, an attribution to more sources than the claims list, or a hedge that has been laundered into a confident statement. Audit it against the claims array and against the primary sources, and report any finding on it as claimId 0. Do not skip it because it has no id of its own.\n\nHandle any claim whose "contested" field is set per your mandate. Follow re-derive-or-flag: anything you cannot reach a source for is "unverifiable", never "clean".`
}

// args may arrive as an object or as a JSON-encoded string depending on how it was passed; normalize.
const A = (typeof args === 'string') ? JSON.parse(args) : (args || {})

// Round 1 audits every claim. Later rounds audit only what the previous round flagged plus any
// claim the revision rewrote, because re-deriving an already-clean claim three times is where
// this loop spent most of its tokens. A cap of 1 audits without ever revising, so the corrected
// claims never get produced; 2 is the default because it buys exactly one revision. Round 3 was
// the default until 0.1.2: both logged runs that reached it still escalated open items at the
// cap, so it mostly bought an Opus revise and a Fable audit before handing over the problem.
const ROUND_CAP = Math.max(1, Math.min(5, Number(A.roundCap) || 2))

if (!A.rawOutputs) {
  log('panel-audit-loop: missing args.rawOutputs (the raw council/panel outputs to summarize and audit).')
  return { error: 'missing rawOutputs', converged: false }
}

// agent() returns null when a subagent dies on a terminal API error after retries.
// Every call below is guarded: a dead agent must never be mistaken for a clean result,
// because an empty issue list computes to converged=true and reports a silent pass.

phase('Summarize')
let summary = await agent(summarizePrompt(A.rawOutputs, A.question), {
  agentType: 'panel-audit:panel-summarizer', model: 'opus', phase: 'Summarize', label: 'summarize', schema: SUMMARY_SCHEMA,
})

if (!summary) {
  log('panel-audit-loop: the summarizer returned no result. Nothing to audit; aborting without a summary.')
  return { error: 'summarizer returned no result', summary: null, auditTrail: [], rounds: 0, converged: false, humanMustAdjudicate: true }
}

// What the next round needs to look at: whatever this round flagged, plus whatever the
// summarizer actually rewrote. A claim nobody touched and nobody flagged does not need a
// third re-derivation. Prose is always included once anything changed, because a claim fix
// leaves the prose still asserting the old version, and prose is what a human reads.
function nextScope(prior, revised, issues) {
  const ids = new Set((issues || []).map((i) => i.claimId))
  const before = new Map((prior.claims || []).map((c) => [c.id, c.text]))
  for (const c of revised.claims || []) {
    if (!before.has(c.id) || before.get(c.id) !== c.text) ids.add(c.id)
  }
  ids.add(PROSE_ID)
  return [...ids].sort((a, b) => a - b)
}

// Enforce "do not rewrite what was not flagged" rather than asking for it. The revise prompt
// has said so since 0.1.1 and the summarizer does not comply: observed 2026-08-04, round 2
// re-derived all 24 claims because every claim's text had drifted, which is precisely the
// re-derivation the scoping exists to avoid. It also manufactures work -- that run's round 2
// flagged a claim round 1 had rated clean, a claim nobody had asked it to touch.
//
// So restore every unflagged claim to its prior text verbatim. nextScope's diff then reports
// only genuine, sanctioned edits, and a gratuitous rewrite cannot cost a round. Claims the
// auditor DID flag keep the summarizer's new text, which is the whole point of revising.
// A claim the revision dropped entirely is also restored, so the set cannot silently shrink.
function pinUnflagged(prior, revised, issues) {
  const flagged = new Set((issues || []).map((i) => i.claimId))
  const priorById = new Map((prior.claims || []).map((c) => [c.id, c]))
  const kept = (revised.claims || []).map((c) =>
    flagged.has(c.id) || !priorById.has(c.id) ? c : priorById.get(c.id)
  )
  const seen = new Set(kept.map((c) => c.id))
  for (const c of prior.claims || []) if (!seen.has(c.id)) kept.push(c)
  const restored = kept.length - (revised.claims || []).filter((c) => flagged.has(c.id)).length
  return { ...revised, claims: kept.sort((a, b) => a.id - b.id), _restored: restored }
}

const auditTrail = []
// Verdicts accumulate across rounds keyed by id, so narrowing a later round cannot silently
// drop an unverifiable or contested item that an earlier round found outside the new scope.
const merged = new Map()
let round = 0
let verdict = null
let auditFailed = null
let scopeIds = null // null means audit every claim; round 1 always does

while (round < ROUND_CAP) {
  round++
  phase('Audit')
  const scopeLabel = scopeIds ? ` (${scopeIds.length} scoped)` : ''
  verdict = await agent(auditPrompt(summary, A.sourceHints, scopeIds), {
    agentType: 'panel-audit:panel-auditor', model: 'fable', phase: 'Audit', label: `audit r${round}${scopeLabel}`, schema: VERDICT_SCHEMA,
  })

  // One retry: a connection dropped mid-response is transient and worth a second attempt.
  if (!verdict) {
    log(`Round ${round}: auditor returned no result. Retrying once.`)
    verdict = await agent(auditPrompt(summary, A.sourceHints, scopeIds), {
      agentType: 'panel-audit:panel-auditor', model: 'fable', phase: 'Audit', label: `audit r${round} retry`, schema: VERDICT_SCHEMA,
    })
  }

  if (!verdict) {
    auditFailed = `Round ${round}: auditor returned no result twice. This round did not audit, so the summary is unverified.`
    log(auditFailed)
    auditTrail.push({ round, overall: 'AUDIT_FAILED', scope: scopeIds || 'all', issues: [], note: auditFailed })
    break
  }

  auditTrail.push({ round, overall: verdict.overall, scope: scopeIds || 'all', issues: verdict.issues })
  for (const i of verdict.issues || []) merged.set(i.claimId, { ...i, round })

  // Unresolved is computed across all rounds, not just this one, so a narrowed round cannot
  // declare convergence while an earlier flagged claim is still open.
  const unresolved = [...merged.values()].filter(
    (i) => (i.verdict === 'wrong' || i.verdict === 'overstated') && i.status !== 'contested'
  )
  log(`Round ${round}: overall ${verdict.overall}, ${unresolved.length} unresolved issue(s) outstanding.`)

  if (unresolved.length === 0) break
  if (round >= ROUND_CAP) break

  phase('Revise')
  const prior = summary
  const revised = await agent(revisePrompt(A.rawOutputs, prior, verdict.issues, A.question), {
    agentType: 'panel-audit:panel-summarizer', model: 'opus', phase: 'Revise', label: `revise r${round}`, schema: SUMMARY_SCHEMA,
  })

  if (!revised) {
    auditFailed = `Round ${round}: the summarizer returned no result on revision. The prior summary stands with round ${round}'s issues unaddressed.`
    log(auditFailed)
    break
  }
  const pinned = pinUnflagged(prior, revised, verdict.issues)
  const drifted = (revised.claims || []).filter(
    (c) => !((verdict.issues || []).some((i) => i.claimId === c.id)) &&
      (prior.claims || []).some((p) => p.id === c.id && p.text !== c.text)
  ).length
  if (drifted > 0) {
    log(`Round ${round}: the summarizer rewrote ${drifted} unflagged claim(s); restored to prior text so they are not re-audited.`)
  }
  summary = pinned
  scopeIds = nextScope(prior, summary, verdict.issues)
}

const finalIssues = [...merged.values()]
const contested = finalIssues.filter((i) => i.status === 'contested')
const unverifiable = finalIssues.filter((i) => i.verdict === 'unverifiable')
const unresolvedAtCap = finalIssues.filter(
  (i) => (i.verdict === 'wrong' || i.verdict === 'overstated') && i.status !== 'contested'
)
const proseFindings = finalIssues.filter((i) => i.claimId === PROSE_ID && i.verdict !== 'clean')
// A failed agent leaves the merged map without this round's verdicts, which would otherwise
// read as convergence.
const converged = !auditFailed && unresolvedAtCap.length === 0

log(`Done after ${round} round(s). converged=${converged}, contested=${contested.length}, unverifiable=${unverifiable.length}, unresolvedAtCap=${unresolvedAtCap.length}, proseFindings=${proseFindings.length}.${auditFailed ? ' INCOMPLETE: ' + auditFailed : ''}`)

return {
  summary,
  auditTrail,
  rounds: round,
  roundCap: ROUND_CAP,
  converged,
  incomplete: auditFailed,
  contested,
  unverifiable,
  unresolvedAtCap,
  // Findings against the prose field rather than a single claim. These matter out of proportion
  // to their count: the prose is the part a human reads, and it is where a generalisation the
  // claims do not support survives even when every claim is individually clean.
  proseFindings,
  humanMustAdjudicate: Boolean(auditFailed) || contested.length + unverifiable.length + unresolvedAtCap.length > 0,
}
