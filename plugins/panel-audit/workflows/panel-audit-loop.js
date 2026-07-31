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

phase('Summarize')
let summary = await agent(summarizePrompt(A.rawOutputs, A.question), {
  agentType: 'panel-audit:panel-summarizer', model: 'opus', phase: 'Summarize', label: 'summarize', schema: SUMMARY_SCHEMA,
})

const auditTrail = []
let round = 0
let verdict = null

while (round < ROUND_CAP) {
  round++
  phase('Audit')
  verdict = await agent(auditPrompt(summary, A.sourceHints), {
    agentType: 'panel-audit:panel-auditor', model: 'fable', phase: 'Audit', label: `audit r${round}`, schema: VERDICT_SCHEMA,
  })
  auditTrail.push({ round, overall: verdict.overall, issues: verdict.issues })

  const unresolved = (verdict.issues || []).filter(
    (i) => (i.verdict === 'wrong' || i.verdict === 'overstated') && i.status !== 'contested'
  )
  log(`Round ${round}: overall ${verdict.overall}, ${unresolved.length} unresolved issue(s).`)

  if (unresolved.length === 0) break
  if (round >= ROUND_CAP) break

  phase('Revise')
  summary = await agent(revisePrompt(A.rawOutputs, summary, verdict.issues, A.question), {
    agentType: 'panel-audit:panel-summarizer', model: 'opus', phase: 'Revise', label: `revise r${round}`, schema: SUMMARY_SCHEMA,
  })
}

const finalIssues = (verdict && verdict.issues) || []
const contested = finalIssues.filter((i) => i.status === 'contested')
const unverifiable = finalIssues.filter((i) => i.verdict === 'unverifiable')
const unresolvedAtCap = finalIssues.filter(
  (i) => (i.verdict === 'wrong' || i.verdict === 'overstated') && i.status !== 'contested'
)
const converged = unresolvedAtCap.length === 0

log(`Done after ${round} round(s). converged=${converged}, contested=${contested.length}, unverifiable=${unverifiable.length}, unresolvedAtCap=${unresolvedAtCap.length}.`)

return {
  summary,
  auditTrail,
  rounds: round,
  converged,
  contested,
  unverifiable,
  unresolvedAtCap,
  humanMustAdjudicate: contested.length + unverifiable.length + unresolvedAtCap.length > 0,
}
