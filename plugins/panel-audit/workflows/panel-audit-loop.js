export const meta = {
  name: 'panel-audit-loop',
  description: 'Summarize raw council/panel outputs into a source-attributed summary, then loop a re-deriving adversarial auditor against it until it converges or hits a 3-round cap. Returns the summary plus a full audit trail; contested, unverifiable, and unresolved items surface for human adjudication.',
  phases: [
    { title: 'Summarize', detail: 'collapse raw council outputs into attributed claims' },
    { title: 'Audit', detail: 're-derive each claim against primary sources' },
    { title: 'Revise', detail: 'fix or contest the auditor findings' },
  ],
}

// args: { rawOutputs: string (required), question?: string, sourceHints?: string }

const ROUND_CAP = 3

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
          claimId: { type: 'integer' },
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
  return `Mode 2: revision. Revise the summary using the auditor's findings.\n\n${question ? `Council question: ${question}\n\n` : ''}RAW COUNCIL OUTPUTS (ground truth for what the seats said):\n${raw}\n\nPRIOR SUMMARY:\n${JSON.stringify(prior, null, 2)}\n\nAUDITOR FINDINGS (each references a claimId):\n${JSON.stringify(issues, null, 2)}\n\nFor each finding: FIX the claim to match the auditor's evidence, or CONTEST it (keep the claim, set "contested" to a one-line source-grounded reason). Keep every claim's id stable.`
}

function auditPrompt(summary, hints) {
  return `Audit this council summary. Re-derive each claim against primary sources; do not proofread.\n\nSUMMARY TO AUDIT:\n${JSON.stringify(summary, null, 2)}\n\n${hints ? `SOURCE HINTS (where to look): ${hints}\n\n` : ''}Reference each finding by the claim's id. Handle any claim whose "contested" field is set per your mandate. Follow re-derive-or-flag: anything you cannot reach a source for is "unverifiable", never "clean".`
}

// args may arrive as an object or as a JSON-encoded string depending on how it was passed; normalize.
const A = (typeof args === 'string') ? JSON.parse(args) : (args || {})

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

const auditTrail = []
let round = 0
let verdict = null
let auditFailed = null

while (round < ROUND_CAP) {
  round++
  phase('Audit')
  verdict = await agent(auditPrompt(summary, A.sourceHints), {
    agentType: 'panel-audit:panel-auditor', model: 'fable', phase: 'Audit', label: `audit r${round}`, schema: VERDICT_SCHEMA,
  })

  // One retry: a connection dropped mid-response is transient and worth a second attempt.
  if (!verdict) {
    log(`Round ${round}: auditor returned no result. Retrying once.`)
    verdict = await agent(auditPrompt(summary, A.sourceHints), {
      agentType: 'panel-audit:panel-auditor', model: 'fable', phase: 'Audit', label: `audit r${round} retry`, schema: VERDICT_SCHEMA,
    })
  }

  if (!verdict) {
    auditFailed = `Round ${round}: auditor returned no result twice. This round did not audit, so the summary is unverified.`
    log(auditFailed)
    auditTrail.push({ round, overall: 'AUDIT_FAILED', issues: [], note: auditFailed })
    break
  }

  auditTrail.push({ round, overall: verdict.overall, issues: verdict.issues })

  const unresolved = (verdict.issues || []).filter(
    (i) => (i.verdict === 'wrong' || i.verdict === 'overstated') && i.status !== 'contested'
  )
  log(`Round ${round}: overall ${verdict.overall}, ${unresolved.length} unresolved issue(s).`)

  if (unresolved.length === 0) break
  if (round >= ROUND_CAP) break

  phase('Revise')
  const revised = await agent(revisePrompt(A.rawOutputs, summary, verdict.issues, A.question), {
    agentType: 'panel-audit:panel-summarizer', model: 'opus', phase: 'Revise', label: `revise r${round}`, schema: SUMMARY_SCHEMA,
  })

  if (!revised) {
    auditFailed = `Round ${round}: the summarizer returned no result on revision. The prior summary stands with round ${round}'s issues unaddressed.`
    log(auditFailed)
    break
  }
  summary = revised
}

const finalIssues = (verdict && verdict.issues) || []
const contested = finalIssues.filter((i) => i.status === 'contested')
const unverifiable = finalIssues.filter((i) => i.verdict === 'unverifiable')
const unresolvedAtCap = finalIssues.filter(
  (i) => (i.verdict === 'wrong' || i.verdict === 'overstated') && i.status !== 'contested'
)
// A failed agent leaves finalIssues empty, which would otherwise read as convergence.
const converged = !auditFailed && unresolvedAtCap.length === 0

log(`Done after ${round} round(s). converged=${converged}, contested=${contested.length}, unverifiable=${unverifiable.length}, unresolvedAtCap=${unresolvedAtCap.length}.${auditFailed ? ' INCOMPLETE: ' + auditFailed : ''}`)

return {
  summary,
  auditTrail,
  rounds: round,
  converged,
  incomplete: auditFailed,
  contested,
  unverifiable,
  unresolvedAtCap,
  humanMustAdjudicate: Boolean(auditFailed) || contested.length + unverifiable.length + unresolvedAtCap.length > 0,
}
