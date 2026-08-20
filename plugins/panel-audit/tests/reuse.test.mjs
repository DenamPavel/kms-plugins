// Unit tests for the reuse and fail-closed paths in workflows/verify-claims.js.
// Stubs agent()/parallel() so the whole suite runs with zero token cost.
// Run from the plugin root: node tests/reuse.test.mjs

import { readFileSync } from 'fs'
const src = readFileSync('workflows/verify-claims.js','utf8').replace(/^export const meta/m,'const meta')

async function run(args, verifierFn) {
  const logs = []
  const fn = new Function('args','log','phase','agent','parallel', `return (async () => {\n${src}\n})()`)
  return { out: await fn(args, (m)=>logs.push(m), ()=>{},
    async (p,o)=>verifierFn(p,o),
    async (thunks)=>Promise.all(thunks.map(t=>t()))), logs }
}

const L = (id,quote,extra={}) => ({id,quote,kind:'external-fact',loadBearing:true,falsifiedBy:'x',...extra})
let pass=0, fail=0
const ok=(c,m)=>{ if(c){pass++;console.log('  PASS',m)} else {fail++;console.log('  FAIL',m)} }

// verifier stub: confirms everything it is asked about, and records what it was asked
let asked=[]
const stub = async (prompt) => {
  const ids=[...prompt.matchAll(/"id":\s*(\d+)/g)].map(m=>+m[1])
  asked.push(...ids)
  return { results: ids.map(id=>({id,verdict:'confirmed',evidence:'e',corrected:'',sources:'s'})) }
}

console.log('\nTEST 1: duplicate claims collapse to one lookup')
asked=[]
let r = await run({ claims:[L(1,'The sky is blue.'),L(2,'the sky  is BLUE!'),L(3,'Grass is green.')] }, stub)
ok(asked.length===2, `verifier saw 2 unique claims, not 3 (saw ${asked.length})`)
ok(r.out.results.length===3, `all 3 ids still get a verdict (got ${r.out.results.length})`)
ok(r.out.results.find(x=>x.id===2)?.duplicateOf===1, 'id 2 marked duplicateOf 1')

console.log('\nTEST 2: priorVerdicts skip re-checking')
asked=[]
r = await run({ claims:[L(1,'Cached fact.'),L(2,'Fresh fact.')],
  priorVerdicts:[{quote:'cached fact',verdict:'imprecise',corrected:'fixed',sources:'u'}] }, stub)
ok(asked.length===1 && asked[0]===2, `only the fresh claim was checked (saw ${JSON.stringify(asked)})`)
ok(r.out.results.find(x=>x.id===1)?.verdict==='imprecise', 'cached verdict carried through')
ok(r.out.imprecise.length===1, 'cached imprecise lands in mustFix path')

console.log('\nTEST 3: tooled-seat claims inherited, sample spot-checked')
asked=[]
const seatChecked = Array.from({length:8},(_,i)=>L(i+1,`Seat fact ${i+1}.`,{checked:true,seatHadTools:true,sources:'http://s',seat:'evidence'}))
r = await run({ claims:seatChecked, spotCheckRate:0.25 }, stub)
ok(asked.length===2, `2 of 8 spot-checked at rate 0.25 (saw ${asked.length})`)
ok(r.out.inherited.length===6, `6 inherited (got ${r.out.inherited.length})`)
ok(r.out.results.every(x=>x.verdict==='confirmed'||x.verdict==='inherited'), 'all resolved')
ok(r.out.unverifiableRate===0, 'inherited claims excluded from the rate denominator')

console.log('\nTEST 4: untooled seat claims are NOT inherited')
asked=[]
r = await run({ claims:[L(1,'No tools fact.',{checked:true,seatHadTools:false,sources:'',seat:'countercase'})] }, stub)
ok(asked.length===1, 'a seat without tools gets its claim checked regardless of "checked"')

console.log('\nTEST 5: failed spot-check condemns the inherited batch')
asked=[]
const badStub = async (prompt) => {
  const ids=[...prompt.matchAll(/"id":\s*(\d+)/g)].map(m=>+m[1]); asked.push(...ids)
  return { results: ids.map(id=>({id,verdict:'wrong',evidence:'e',corrected:'c',sources:'s'})) }
}
r = await run({ claims:seatChecked, spotCheckRate:0.25 }, badStub)
ok(r.out.failedSpotChecks.length===2, `spot-check failures recorded (${r.out.failedSpotChecks.length})`)
ok(r.out.verified===false, 'verified is false when a spot-check fails')
ok(r.logs.some(l=>l.includes('SPOT-CHECK FAILED')), 'loud warning emitted')

console.log('\nTEST 6: dead verifier fails closed')
r = await run({ claims:[L(1,'x'),L(2,'y')] }, async()=>null)
ok(r.out.results.every(x=>x.verdict==='unverifiable'), 'dead verifier -> unverifiable, never clean')
ok(r.out.verified===false, 'not reported as verified')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail?1:0)
