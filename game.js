// Project SC — minimal PO → receive → fulfill loop (MVP)
const STATE_KEY = 'project-sc-v1'
const defaultState = {
  cash: 500,
  inventory: 0,
  demandPerSec: 1,
  pos: [],
  log: []
}
let state = loadState()

// DOM refs
const el = {
  cash: document.getElementById('cash'),
  inventory: document.getElementById('inventory'),
  demand: document.getElementById('demand'),
  poQty: document.getElementById('poQty'),
  poLead: document.getElementById('poLead'),
  placePo: document.getElementById('placePo'),
  posList: document.getElementById('posList'),
  log: document.getElementById('log'),
  save: document.getElementById('save'),
  reset: document.getElementById('reset')
}

function format(n){ return Math.floor(n).toLocaleString() }
function save(){ localStorage.setItem(STATE_KEY, JSON.stringify(state)); renderLog('Game saved') }
function loadState(){ try{ const s = JSON.parse(localStorage.getItem(STATE_KEY)); return s ? s : JSON.parse(JSON.stringify(defaultState)) }catch(e){ return JSON.parse(JSON.stringify(defaultState)) } }

function render(){
  el.cash.textContent = format(state.cash)
  el.inventory.textContent = format(state.inventory)
  el.demand.textContent = state.demandPerSec
  // POs
  if (state.pos.length===0) { el.posList.textContent = '(none)'; } else {
    el.posList.innerHTML = ''
    state.pos.forEach(p => {
      const d = document.createElement('div')
      d.textContent = `PO #${p.id}: qty ${p.qty} arriving in ${Math.max(0, Math.ceil((p.arrival - Date.now())/1000))}s`
      el.posList.appendChild(d)
    })
  }
  // Log
  el.log.innerHTML = state.log.slice(-50).map(l=>`<div>${l}</div>`).join('')
}

function log(msg){ state.log.push(`${new Date().toLocaleTimeString()} - ${msg}`); render() }

let nextPoId = 1
function placePO(){
  const qty = Math.max(1, parseInt(el.poQty.value)||1)
  const lead = parseInt(el.poLead.value)||15
  const unitCost = 5
  const cost = qty * unitCost
  if (state.cash < cost){ alert('Not enough cash to place PO'); return }
  state.cash -= cost
  const arrival = Date.now() + lead*1000
  const po = { id: nextPoId++, qty: qty, arrival: arrival }
  state.pos.push(po)
  scheduleArrival(po)
  log(`Placed PO #${po.id} qty ${qty} lead ${lead}s cost $${cost}`)
  save()
  render()
}

function scheduleArrival(po){
  const ms = Math.max(0, po.arrival - Date.now())
  setTimeout(()=>{
    // receive
    state.inventory += po.qty
    state.pos = state.pos.filter(p => p.id !== po.id)
    log(`PO #${po.id} received: +${po.qty} inventory`)
    save(); render()
  }, ms)
}

// Auto-sell to simulate fulfilling demand
setInterval(()=>{
  const sell = Math.min(state.inventory, state.demandPerSec)
  if (sell>0){ state.inventory -= sell; const revenue = sell * 8; state.cash += revenue; log(`Sold ${sell} units for $${revenue}`); save(); }
  render()
}, 1000)

// Restore any scheduled arrivals after load
function restoreSchedules(){
  state.pos.forEach(p => {
    scheduleArrival(p)
  })
}

el.placePo.addEventListener('click', placePO)
el.save.addEventListener('click', ()=>{ save(); alert('Saved') })
el.reset.addEventListener('click', ()=>{ if (confirm('Reset game?')){ localStorage.removeItem(STATE_KEY); state = JSON.parse(JSON.stringify(defaultState)); nextPoId = 1; render(); } })

// init
render()
restoreSchedules()
setInterval(()=>save(), 15000)
