export const meta = {
  name: 'verify-claims',
  description: 'Fact-check claims against primary and external sources. Takes a claim ledger straight from run-panel (no extraction pass needed) or, for a hand-written document, extracts the claims first. Groups claims and fans out tool-equipped verifiers in parallel. Returns per-claim confirmed / wrong / imprecise / unverifiable / inherited with sources, partitioned into what must be fixed before the deliverable ships. An inherited verdict means nobody here checked the claim and a tooled seat said it did. Single pass, no rounds.',
  phases: [
    { title: 'Extract', detail: 'only when given a draft instead of a ledger' },
    { title: 'Verify', detail: 'one tool-equipped researcher per claim group' },
  ],
}

// args, one of the first two is required:
//   claims?: [{id, quote, kind, loadBearing, seat?, falsifiedBy?}]
//                            a ledger from run-panel. Skips extraction entirely, which is
//                            the cheap path: the seats already knew what was checkable.
//   draftPath?: string       a finished document to extract claims from first. Costs one
//                            extra agent and a full read; use it for hand-written docs and
//                            the audit-summary hook backstop.
//   scope?: 'load-bearing' | 'all'   default 'load-bearing'. Checking facts nobody's
//                            conclusion rests on is the easiest place to waste tokens.
//   sourceHints?: string     where primary sources live and how to reach them
//   contextPaths?: string[]  seat reports / source memos. Primary sources for claims of kind
//                            'attribution' ONLY; for every other kind they are claims, not
//                            evidence, and treating them as evidence is the 0.1.x mistake.
//   claimsPerCluster?: number  default 4
//   maxClusters?: number     default 8, caps parallel verifiers
//   searchBudget?: number    default 5, suggested lookups PER CLAIM (a 4-claim group
//                            therefore gets ~20). Measured 2026-08-16: 6 shared across a group
//                            drove the unverifiable rate from 4% to 25%.
//   extractCap?: number      default 20, ceiling on claims pulled from a draft
//   priorVerdicts?: [{quote, verdict, corrected, sources}]
//                            verdicts from an earlier run. A claim whose normalized quote
//                            matches one of these is not re-checked. Workflows have no
//                            filesystem access, so the chair loads these from the verdict
//                            cache and appends the new ones after; the skill has the snippet.
//   spotCheckRate?: number   default 0.25. Fraction of seat-verified claims re-checked anyway,
//                            sampled deterministically. A failed spot-check condemns the batch.
//   trustSeats?: boolean     default true. Claims a TOOLED seat already checked WITH sources
//                            are inherited rather than re-verified. Set false to check everything.
//   model?: string           verifier model override (default: the agent definition's Sonnet)

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'integer', description: 'Unique, starting at 1.' },
          quote: { type: 'string', description: 'The claim as the document words it, verbatim.' },
          kind: { type: 'string', enum: ['external-fact', 'attribution', 'quantitative', 'mechanism'] },
          loadBearing: { type: 'boolean', description: 'True if the document\'s conclusion changes when this is false.' },
          falsifiedBy: { type: 'string', description: 'The concrete finding that would refute it.' },
        },
        required: ['id', 'quote', 'kind', 'loadBearing', 'falsifiedBy'],
      },
    },
    skipped: { type: 'string', description: 'What you did not extract and why (opinion, framing, argument). Never empty.' },
  },
  required: ['claims', 'skipped'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'integer' },
          verdict: { type: 'string', enum: ['confirmed', 'wrong', 'imprecise', 'unverifiable'] },
          evidence: { type: 'string', description: 'What the source actually says and how you reached it. Two sentences, 400 characters max. Detail belongs in sources, not here.' },
          corrected: { type: 'string', description: 'The claim as the record supports it. Empty only when confirmed.' },
          sources: { type: 'string', description: 'URLs or file paths actually consulted. On unverifiable, what you tried.' },
        },
        required: ['id', 'verdict', 'evidence', 'corrected', 'sources'],
      },
    },
  },
  required: ['results'],
}

function extractPrompt(draftPath, contextPaths, cap) {
  const ctx = (contextPaths && contextPaths.length)
    ? `\n\nSupporting documents are at:\n${contextPaths.map((p) => `- ${p}`).join('\n')}\nThey are relevant ONLY to claims of kind "attribution" (what one of them said). For every other claim they are not sources; the world is. Do not treat a claim as checkable just because one of them asserts it.`
    : ''
  return `Read the document at ${draftPath} in full with the Read tool. Extract every claim in it that could be checked against a source and found false.${ctx}

Extract: facts about the world (events, dates, names, institutions, holdings, publications, rulings); attributions (what a named person, seat, memo, court, or paper said or found); quantities; and mechanism claims (what something contains, how it is classified).

Do NOT extract opinions, quality judgments, framing, arguments, recommendations, or predictions. Those are the author's and are not checkable. Say in "skipped" what you left out on those grounds.

Quote the document's actual wording verbatim rather than paraphrasing, because the checker needs the exact assertion including its qualifiers and their absence. Set loadBearing true only when the conclusion would change if the claim were false.

**Extract at most ${cap} claims, and fewer is better.** You are not indexing the document. You are picking the assertions whose falsity would actually hurt, and every one you extract costs a researcher a set of lookups. A first pass on a 2000-word memo produced 56 claims, of which more than half were incidental detail nobody's conclusion touched; that run cost more than the panel it was checking.

Rank ruthlessly, and prefer in this order:

1. **Compressed claims.** A sentence turning several cases into one rule ("all", "none", "only N", "every time", "no X has ever"). That sentence is a claim about the whole set, it is the most confident thing in the document, and it is the least likely to have been checked. These are your highest-value extractions.
2. Specific facts a conclusion rests on: the named institution, the date, the holding, the capacity in which something happened.
3. Attributions that carry argumentative weight.

Do not extract a supporting detail when you have already extracted the claim it supports. If the document says a thing happened at an institution in a year and then names three people involved, that is one claim, not four. Merge them into a single quote covering the whole assertion.

Set loadBearing sparingly and honestly; if you mark everything load-bearing the field is useless.

Number ids uniquely from 1.`
}

function verifyPrompt(group, hints, contextPaths, budget) {
  const kinds = [...new Set(group.map((c) => c.kind))]
  const attributionNote = kinds.includes('attribution') && contextPaths && contextPaths.length
    ? `\n\nThis group contains "attribution" claims, which are statements about what a named source said. For those, the source documents ARE the primary source and you check the quoted text in them:\n${contextPaths.map((p) => `- ${p}`).join('\n')}\nFor every claim NOT of kind "attribution", those documents are worthless as evidence: an intermediate document is a claim, not a source. Check those against the world.`
    : ''
  return `Verify the following claims, taken verbatim from a document that is about to be relied on.

CLAIMS:
${JSON.stringify(group, null, 2)}

${hints ? `SOURCE HINTS: ${hints}\n` : ''}${attributionNote}

Return exactly one result per claim id above, including ids you could not settle, which are "unverifiable" and never "confirmed".

**A compound claim is confirmed only when every component is.** Several of these quotes assert two or three things at once (a practice AND a date, a person AND an institution AND a capacity). If you checked one part and not the others, the verdict is "imprecise" or "unverifiable", never "confirmed", and you say in the evidence which part went unchecked. Observed 2026-08-16: a verifier returned "confirmed" on a two-part claim while its own evidence read "did not independently verify the second component."

Each claim's "falsifiedBy" field names what would refute it. Search for that specifically rather than for confirmation of the claim as written.

BUDGET: roughly ${budget} lookups for this group. Spend them on the load-bearing claims first. If you run out with claims still unsettled, report those "unverifiable" and say the budget ran out; that is correct and far better than a guess dressed as a verdict. But do not treat the budget as a reason to stop early on a claim you are close to settling: an unverifiable verdict costs the reader a manual check, so it is cheap for you and expensive for them. Keep "evidence" to two sentences and under 400 characters; put the URLs in "sources" instead. A long evidence field costs the reader nothing and the budget a great deal. Observed on the first run: evidence fields averaged 1371 characters and one reached 2641.`
}

const A = (typeof args === 'string') ? JSON.parse(args) : (args || {})

const PER_CLUSTER = Math.max(1, Math.min(10, Number(A.claimsPerCluster) || 4))
const MAX_CLUSTERS = Math.max(1, Math.min(24, Number(A.maxClusters) || 8))
const PER_CLAIM_BUDGET = Math.max(1, Math.min(12, Number(A.searchBudget) || 5))
const SCOPE = A.scope === 'all' ? 'all' : 'load-bearing'
const EXTRACT_CAP = Math.max(5, Math.min(60, Number(A.extractCap) || 20))
const SPOT_RATE = Math.max(0, Math.min(1, A.spotCheckRate === undefined ? 0.25 : Number(A.spotCheckRate)))
const TRUST_SEATS = A.trustSeats !== false

// Redoing settled work is the largest avoidable cost in this pipeline, ahead of any budget
// cap. Measured 2026-08-16: the same facts (Eldagsen, Mario/MoMA, the Miller doctrine, the
// Colorado State Fair) were verified four separate times in one session because the panel's
// own evidence seat had checked them, cited URLs, and nothing downstream consumed the result.
// Normalizing to a comparable key is what makes all three reuse paths below possible.
const key = (q) => String(q || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

let claims = Array.isArray(A.claims) ? A.claims.filter((c) => c && c.quote) : null
let skipped = ''

if (!claims && !A.draftPath) {
  log('verify-claims: give it either args.claims (a ledger from run-panel, the cheap path) or args.draftPath (a document to extract from).')
  return { error: 'missing claims and draftPath', verified: false }
}

if (!claims) {
  phase('Extract')
  const extraction = await agent(extractPrompt(A.draftPath, A.contextPaths, EXTRACT_CAP), {
    phase: 'Extract', label: 'extract claims', schema: EXTRACT_SCHEMA, effort: 'medium',
  })
  if (!extraction || !Array.isArray(extraction.claims)) {
    log('verify-claims: the extractor returned no result. Nothing was checked.')
    return { error: 'extractor returned no result', verified: false, humanMustAdjudicate: true }
  }
  claims = extraction.claims
  skipped = extraction.skipped || ''
} else {
  log(`Using the supplied ledger of ${claims.length} claim(s); no extraction pass needed.`)
}

// Ids must be unique and present; a ledger merged by hand may not satisfy that.
let fallbackId = 1
claims = claims.map((c) => ({ ...c, id: Number.isInteger(c.id) ? c.id : fallbackId++ }))

const totalClaims = claims.length
if (!totalClaims) {
  log('verify-claims: no checkable claims. If that is surprising, the document may be all argument and no evidence, which is itself worth knowing.')
  return { results: [], totalClaims: 0, verified: true, humanMustAdjudicate: false, skipped }
}

// ---- Reuse pass. Everything removed here is work already done, not work skipped. ----

// 1. Deduplicate. Two seats asserting the same fact is one lookup, not two. Aliases map the
//    single verdict back onto every id that shared the claim.
const canonical = new Map()
const aliases = new Map()
for (const c of claims) {
  const k = key(c.quote)
  if (!canonical.has(k)) { canonical.set(k, c); aliases.set(k, []) }
  else {
    aliases.get(k).push(c.id)
    // A duplicate inherits the stronger flags: if either copy was load-bearing, the fact is.
    const keep = canonical.get(k)
    if (c.loadBearing) keep.loadBearing = true
    if (c.checked && c.sources && !keep.sources) { keep.checked = true; keep.sources = c.sources; keep.seatHadTools = c.seatHadTools }
  }
}
const deduped = [...canonical.values()]
const dupesRemoved = claims.length - deduped.length
if (dupesRemoved) log(`Deduplicated ${dupesRemoved} repeated claim(s); their verdicts are copied from the canonical claim.`)

// 2. Prior verdicts from an earlier run. An unchanged claim does not need re-checking.
const prior = new Map((Array.isArray(A.priorVerdicts) ? A.priorVerdicts : []).filter((v) => v && v.quote).map((v) => [key(v.quote), v]))
const cached = []
let afterCache = deduped
if (prior.size) {
  afterCache = deduped.filter((c) => {
    const hit = prior.get(key(c.quote))
    if (!hit) return true
    cached.push({ ...c, verdict: hit.verdict, corrected: hit.corrected || '', sources: hit.sources || '', evidence: 'Verdict reused from an earlier run; the claim text is unchanged.', reused: true })
    return false
  })
  if (cached.length) log(`Reused ${cached.length} verdict(s) from priorVerdicts; those claims were not re-checked.`)
}

// 3. Claims a TOOLED seat already verified and cited sources for. These are inherited rather
//    than re-run, but a deterministic sample is re-checked anyway: a seat that fabricates a
//    source would otherwise launder its claims straight through. A failed spot-check
//    condemns the whole inherited batch rather than just the sampled claim.
const inherited = []
const spotIds = new Set()
let queue = afterCache
if (TRUST_SEATS) {
  const eligible = afterCache.filter((c) => c.checked && c.seatHadTools && c.sources)
  const spotEvery = SPOT_RATE > 0 ? Math.max(1, Math.round(1 / SPOT_RATE)) : 0
  eligible.forEach((c, i) => { if (spotEvery && i % spotEvery === 0) spotIds.add(c.id) })
  queue = afterCache.filter((c) => {
    const isEligible = c.checked && c.seatHadTools && c.sources
    if (!isEligible || spotIds.has(c.id)) return true
    inherited.push({ ...c, verdict: 'inherited', corrected: '', evidence: `Checked by seat "${c.seat || 'unknown'}", which had research tools and cited sources. Not independently re-verified.`, reused: true })
    return false
  })
  if (inherited.length) log(`Inherited ${inherited.length} seat-verified claim(s) with sources; spot-checking ${spotIds.size} of them.`)
}

const reusedCount = cached.length + inherited.length + dupesRemoved
if (reusedCount) log(`Reuse saved ${reusedCount} of ${claims.length} claim(s) from being re-checked.`)

const inScope = SCOPE === 'all' ? queue : queue.filter((c) => c.loadBearing)
const outOfScope = queue.filter((c) => !inScope.includes(c))
if (SCOPE === 'load-bearing' && outOfScope.length) {
  log(`Scope is load-bearing: ${outOfScope.length} of ${totalClaims} claim(s) are NOT being checked. Pass scope:"all" to check them.`)
}
if (!inScope.length) {
  log('verify-claims: no load-bearing claims in the ledger. Nothing to check under the current scope.')
  return { results: [], totalClaims, verified: false, humanMustAdjudicate: true, skipped, uncheckedByScope: outOfScope.map((c) => c.id), note: 'Every claim was marked not-load-bearing. Check whether that is true before trusting it.' }
}

// Group deterministically instead of paying an agent to cluster. Attribution claims are
// separated first because they are checked against different sources than everything else;
// within a partition, claims from the same seat tend to be topically adjacent.
function groupClaims(list) {
  const attribution = list.filter((c) => c.kind === 'attribution')
  const rest = list.filter((c) => c.kind !== 'attribution')
  const bySeat = new Map()
  for (const c of rest) {
    const k = c.seat || '_'
    if (!bySeat.has(k)) bySeat.set(k, [])
    bySeat.get(k).push(c)
  }
  const partitions = [...bySeat.values()]
  if (attribution.length) partitions.unshift(attribution)
  const out = []
  for (const p of partitions) {
    for (let i = 0; i < p.length; i += PER_CLUSTER) out.push(p.slice(i, i + PER_CLUSTER))
  }
  return out
}

const allGroups = groupClaims(inScope)
// Load-bearing groups first, so a cap truncates the least consequential work.
const ordered = [...allGroups].sort((a, b) => (b.filter((c) => c.loadBearing).length) - (a.filter((c) => c.loadBearing).length))
const groups = ordered.slice(0, MAX_CLUSTERS)
const droppedGroups = ordered.slice(groups.length)
const uncheckedByCap = droppedGroups.flat().map((c) => c.id)

if (uncheckedByCap.length) {
  // Never let a cap read as full coverage.
  log(`Capped at ${MAX_CLUSTERS} group(s): ${uncheckedByCap.length} claim(s) NOT checked. Raise maxClusters or claimsPerCluster.`)
}

log(`Verifying ${groups.flat().length} claim(s) in ${groups.length} group(s), ~${PER_CLAIM_BUDGET} lookups per claim.`)

phase('Verify')
const verifyOpts = { phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'panel-audit:claim-verifier' }
if (A.model) verifyOpts.model = A.model

const batches = await parallel(groups.map((group, i) => () =>
  agent(verifyPrompt(group, A.sourceHints, A.contextPaths, PER_CLAIM_BUDGET * group.length), {
    ...verifyOpts, label: `verify:g${i + 1}(${group.length})`,
  }).then((r) => ({ group, result: r }))
))

// A verifier that died must not read as a clean group: its claims become unverifiable.
const byId = new Map()
const deadGroups = []
for (const b of batches) {
  if (!b) continue
  if (!b.result || !Array.isArray(b.result.results)) { deadGroups.push(b.group.map((c) => c.id)); continue }
  for (const r of b.result.results) byId.set(r.id, r)
}
for (const b of batches) {
  if (!b) continue
  for (const c of b.group) {
    if (!byId.has(c.id)) byId.set(c.id, { id: c.id, verdict: 'unverifiable', corrected: '', sources: '', evidence: 'The verifier for this group returned nothing, so this claim was never checked.' })
  }
}

const claimById = new Map(claims.map((c) => [c.id, c]))
const checkedResults = [...byId.values()].map((r) => {
  const c = claimById.get(r.id) || {}
  return { ...r, quote: c.quote || '', loadBearing: Boolean(c.loadBearing), seat: c.seat || '', kind: c.kind || '' }
})

// A spot-check that fails means a tooled seat cited sources for a claim that does not hold,
// which makes every OTHER claim inherited on that seat's word suspect. Say so loudly; a
// quiet pass here would launder the whole batch.
const failedSpotChecks = checkedResults.filter((r) => spotIds.has(r.id) && (r.verdict === 'wrong' || r.verdict === 'imprecise'))
if (failedSpotChecks.length && inherited.length) {
  log(`SPOT-CHECK FAILED on ${failedSpotChecks.length} of ${spotIds.size} sampled claim(s). ${inherited.length} claim(s) were inherited on seat verification and are now suspect. Re-run with trustSeats:false.`)
}

// Duplicates take the canonical claim's verdict rather than a second lookup.
const expanded = []
for (const r of [...checkedResults, ...cached, ...inherited]) {
  expanded.push(r)
  for (const dupId of (aliases.get(key(r.quote)) || [])) {
    const d = claimById.get(dupId) || {}
    expanded.push({ ...r, id: dupId, quote: d.quote || r.quote, seat: d.seat || '', duplicateOf: r.id })
  }
}
const results = expanded.sort((a, b) => a.id - b.id)

const wrong = results.filter((r) => r.verdict === 'wrong')
const imprecise = results.filter((r) => r.verdict === 'imprecise')
const unverifiable = results.filter((r) => r.verdict === 'unverifiable')
const confirmed = results.filter((r) => r.verdict === 'confirmed')
const inheritedResults = results.filter((r) => r.verdict === 'inherited')
const reused = results.filter((r) => r.reused)
// What cannot ship as written. Load-bearing unverifiable claims are included: shipping one
// unlabeled is the failure this exists to prevent.
const mustFix = [...wrong, ...imprecise, ...unverifiable.filter((r) => r.loadBearing)]

if (deadGroups.length) log(`INCOMPLETE: ${deadGroups.length} verifier(s) returned nothing. Their claims are unverifiable, not clean.`)
const independentlyChecked = results.filter((r) => !r.reused)
const unverifiableRate = independentlyChecked.length ? unverifiable.length / independentlyChecked.length : 0
log(`${results.length} claim(s) resolved (${independentlyChecked.length} checked now, ${reused.length} reused): ${confirmed.length} confirmed, ${wrong.length} wrong, ${imprecise.length} imprecise, ${unverifiable.length} unverifiable. ${mustFix.length} must be fixed or labeled before this ships.`)
if (unverifiableRate > 0.15) {
  // A high unverifiable rate is usually a starved budget rather than genuinely unreachable
  // sources, and it looks like a clean run to anyone reading only the confirmed count.
  log(`WARNING: ${Math.round(unverifiableRate * 100)}% of claims came back unverifiable. That is usually too small a searchBudget, not genuinely unreachable sources. Re-run the unverifiable ids with a higher searchBudget before treating this as checked.`)
}

return {
  totalClaims,
  scope: SCOPE,
  skipped,
  results,
  confirmed,
  wrong,
  imprecise,
  unverifiable,
  mustFix,
  uncheckedByCap,
  uncheckedByScope: outOfScope.map((c) => c.id),
  unverifiableRate: Number(unverifiableRate.toFixed(2)),
  inherited: inheritedResults,
  reusedCount,
  failedSpotChecks,
  // Feed these back as priorVerdicts on the next run over the same material.
  verdictCache: results.filter((r) => !r.duplicateOf && r.verdict !== 'unverifiable').map((r) => ({ quote: r.quote, verdict: r.verdict, corrected: r.corrected, sources: r.sources })),
  incomplete: deadGroups.length ? `${deadGroups.length} verifier group(s) returned nothing` : null,
  verified: mustFix.length === 0 && uncheckedByCap.length === 0 && deadGroups.length === 0 && failedSpotChecks.length === 0,
  humanMustAdjudicate: mustFix.length > 0 || uncheckedByCap.length > 0 || deadGroups.length > 0 || failedSpotChecks.length > 0,
}
