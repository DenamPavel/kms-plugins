export const meta = {
  name: 'run-panel',
  description: 'Run a multi-seat council in parallel. Each seat writes its full report to disk and returns only a headline plus its own list of checkable empirical claims, so the orchestrator context stays small and the claim ledger comes free. Enforces the tooling gate: a seat that will assert facts must have research tools or it is told to mark every empirical assertion unverified. Produces the seat reports and a claim ledger for verify-claims.',
  phases: [
    { title: 'Seats', detail: 'each seat reads independently and reports' },
  ],
}

// args: {
//   question: string (required)   what the council is convened on
//   seats: [{                     required, 2+ recommended
//     label: string               short name, used for the filename and progress label
//     lens: string                what this seat owns
//     prompt: string              the full seat prompt; this stays the chair's judgment
//     model?: string              seat model override
//     empirical?: boolean         true if this seat's argument will rest on facts
//     tools?: boolean             true if this seat has research access
//     agentType?: string          a specific subagent type for this seat
//   }]
//   reportDir: string (required)  absolute dir the seats write their reports into
//   brief?: string                shared context prepended to every seat prompt
// }
//
// There is no summarizer. The chair reads the seat reports and writes the deliverable.
// 0.1.x inserted a summarizing agent here, audited its output, and left the document that
// actually shipped unchecked; see the 0.2.0 changelog.
//
// Claims come back from the seats rather than from an extraction pass over the finished
// draft. A seat already knows which of its assertions are checkable and which it was unsure
// about, so asking it costs almost nothing and is better informed than re-deriving later.

const SEAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reportPath: { type: 'string', description: 'Absolute path of the report file you wrote.' },
    headline: { type: 'string', description: 'Your findings in at most 200 words. The chair reads the full report; this is the index entry.' },
    claims: {
      type: 'array',
      description: 'Every empirical assertion in your report that could be checked against a source and found false. Opinions, judgments, and arguments do NOT belong here.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          quote: { type: 'string', description: 'The assertion as your report words it, verbatim.' },
          kind: { type: 'string', enum: ['external-fact', 'attribution', 'quantitative', 'mechanism'] },
          loadBearing: { type: 'boolean', description: 'True if your conclusion changes when this is false.' },
          checked: { type: 'boolean', description: 'True only if you personally verified it against a source during this task.' },
          sources: { type: 'string', description: 'If checked is true, the URLs or file paths you actually consulted. Empty otherwise. Without these your verification cannot be reused and someone will redo it.' },
          falsifiedBy: { type: 'string', description: 'The concrete finding that would refute it.' },
        },
        required: ['quote', 'kind', 'loadBearing', 'checked', 'sources', 'falsifiedBy'],
      },
    },
  },
  required: ['reportPath', 'headline', 'claims'],
}

function seatPrompt(seat, question, brief, reportPath) {
  // The gate. A seat without research access cannot be trusted to assert what happened in
  // the world and will not say so on its own, because it does not know. Logged 2026-08-16:
  // a counter-case seat with no tooling produced a seven-item list of historical cases as
  // the centre of its argument; five were false.
  const gate = seat.tools
    ? `You have research tools. Any empirical assertion you make must be checked against a source before you rely on it, and you set "checked": true for it only if you actually did so.`
    : `YOU HAVE NO RESEARCH TOOLS. You therefore cannot establish what is true in the world. Hold your lens (structure, logic, internal consistency, craft) and make your argument there. Where you must refer to an outside fact, mark it explicitly in your report as UNVERIFIED, do not build a load-bearing argument on it, and list it in "claims" with "checked": false. Asserting an unchecked fact in a confident register is the single most damaging thing you can do here.`

  return `You are a seat on an independent review panel. You are working alone: you cannot see the other seats' outputs and must not speculate about them.

COUNCIL QUESTION: ${question}
${brief ? `\nSHARED BRIEF:\n${brief}\n` : ''}
YOUR LENS: ${seat.lens}

${gate}

${seat.prompt}

OUTPUT PROTOCOL, which is not optional:

1. Write your FULL findings to ${reportPath} using the Write tool. That file is the deliverable and the chair reads all of it, so do not truncate it to save space. Use your own severity labels and say what scale you are using.

2. Return a structured object with three fields.
   - "reportPath": the path above.
   - "headline": at most 200 words. This is an index entry, not the findings.
   - "claims": every assertion in your report that could be checked against a source and found FALSE. Quote your own wording verbatim. Include facts about the world, attributions of what a named person or work said, quantities, and classification claims. Do NOT include opinions, quality judgments, framing, or arguments; those are yours and are not checkable.

When you set "checked": true, put the URLs you consulted in "sources". A verification with no sources attached cannot be reused, so the next stage will simply redo your work; that is the single largest source of waste in this pipeline.

Be honest in the "checked" field. A claim you believe but did not verify is "checked": false, and marking it so costs you nothing. Marking it true when you did not check is how a false statement reaches a document someone acts on.`
}

const A = (typeof args === 'string') ? JSON.parse(args) : (args || {})

if (!A.question) { log('run-panel: missing args.question.'); return { error: 'missing question' } }
if (!A.reportDir) { log('run-panel: missing args.reportDir (absolute dir for seat reports).'); return { error: 'missing reportDir' } }
const seats = Array.isArray(A.seats) ? A.seats.filter((s) => s && s.prompt && s.label) : []
if (!seats.length) { log('run-panel: args.seats must be a non-empty array of {label, lens, prompt}.'); return { error: 'no seats' } }

// Surface gate violations before spending anything on them. This is a warning rather than a
// refusal because a lens-only seat without tools is legitimate; an empirical seat without
// tools is the logged failure mode and the chair should see it named.
const ungated = seats.filter((s) => s.empirical && !s.tools)
for (const s of ungated) {
  log(`GATE: seat "${s.label}" is marked empirical but has no research tools. It will be instructed to mark every outside fact UNVERIFIED and not argue from it. Give it tools or accept that its factual claims are worthless.`)
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const dir = String(A.reportDir).replace(/\/+$/, '')

phase('Seats')
const results = await parallel(seats.map((seat, i) => () => {
  const reportPath = `${dir}/seat${i + 1}-${slug(seat.label)}.md`
  const opts = { phase: 'Seats', label: `seat${i + 1}:${seat.label}`.slice(0, 48), schema: SEAT_SCHEMA }
  if (seat.model) opts.model = seat.model
  if (seat.agentType) opts.agentType = seat.agentType
  return agent(seatPrompt(seat, A.question, A.brief, reportPath), opts)
    .then((r) => ({ seat, index: i, reportPath, result: r }))
}))

const seatResults = []
const deadSeats = []
for (const r of results) {
  if (!r) continue
  if (!r.result) { deadSeats.push(r.seat.label); continue }
  seatResults.push({
    label: r.seat.label,
    lens: r.seat.lens,
    model: r.seat.model || 'inherited',
    hasTools: Boolean(r.seat.tools),
    reportPath: r.result.reportPath || r.reportPath,
    headline: r.result.headline || '',
    claims: Array.isArray(r.result.claims) ? r.result.claims : [],
  })
}

// One flat ledger, ids assigned here so verify-claims never has to renumber. Provenance is
// kept per claim: a claim's seat is how the chair decides whether to trust it before checking.
let nextId = 1
const ledger = []
for (const s of seatResults) {
  for (const c of s.claims) {
    ledger.push({ id: nextId++, seat: s.label, seatHadTools: s.hasTools, ...c })
  }
}

const loadBearing = ledger.filter((c) => c.loadBearing)
const unchecked = ledger.filter((c) => !c.checked)
// The claims most likely to be false: load-bearing, unchecked, and from a seat that had no
// way to check. This is exactly the shape of the 2026-08-16 failure.
const highRisk = ledger.filter((c) => c.loadBearing && !c.checked && !c.seatHadTools)
// Already established by a seat that had the means to establish it, with sources attached.
// Passing these to verify-claims re-does work the panel already paid for.
const alreadyVerified = ledger.filter((c) => c.checked && c.seatHadTools && c.sources)

if (deadSeats.length) log(`INCOMPLETE: ${deadSeats.length} seat(s) returned nothing (${deadSeats.join('; ')}). The panel is short those lenses.`)
log(`${seatResults.length}/${seats.length} seat(s) reported. Ledger: ${ledger.length} claim(s), ${loadBearing.length} load-bearing, ${unchecked.length} unchecked by their own seat, ${highRisk.length} high-risk, ${alreadyVerified.length} already verified with sources.`)
if (alreadyVerified.length) log(`${alreadyVerified.length} claim(s) were already checked by a tooled seat and carry sources. verify-claims will spot-check rather than re-verify these; do not strip the sources when you filter the ledger.`)
if (highRisk.length) log(`${highRisk.length} high-risk claim(s): load-bearing, unchecked, from a seat with no tools. Verify these before using them, whatever else you skip.`)

return {
  question: A.question,
  seats: seatResults.map(({ claims, ...rest }) => ({ ...rest, claimCount: claims.length })),
  reportPaths: seatResults.map((s) => s.reportPath),
  ledger,
  loadBearing,
  highRisk,
  alreadyVerified,
  counts: { seats: seatResults.length, claims: ledger.length, loadBearing: loadBearing.length, unchecked: unchecked.length, highRisk: highRisk.length, alreadyVerified: alreadyVerified.length },
  incomplete: deadSeats.length ? `${deadSeats.length} seat(s) returned nothing` : null,
  // The chair now reads the reports and writes the deliverable, then passes the ledger
  // (filtered to what survived into the draft) to verify-claims.
  next: 'Read the seat reports, write the deliverable, then run verify-claims with the ledger entries that survived into it.',
}
