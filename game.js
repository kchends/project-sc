// Project SC — supplier acceptance/commit flow (MVP)
const STATE_KEY = 'project-sc-v1'
const defaultState = {
  cash: 500,
  inventory: 0,
  demandPerSec: 1,
  pos: [],         // placed orders {id, supplierId, qty, placedAt, requestedLead, status, commitQty, commitEta}
  suppliers: [
    {id: 'S1', name: 'Alpha Supplies', reliability: 0.95, leadModifier: 1.0},
    {id: 'S2', name: 'Beta Manufacturing', reliability: 0.8, leadModifier: 1.2},
    {id: 'S3', name: 'Gamma Parts', reliability: 0.6, leadModifier: 0.9}
  ],
  log: []
}
let state = loadState()
let nextPoId = (state.pos && state.pos.length) ? Math.max(...state.pos.map(p=>p.id))+1 : 1

// DOM refs
const el = {
  cash: document.getElementById('cash'),
  inventory: document.getElementById('inventory'),
  demand: document.getElementById('demand'),
  supplierSelect: document.getElementById('supplierSelect'),
  poQty: document.getElementById('poQty'),
  poLead: document.getElementById('poLead'),
  placePo: document.getElementById('placePo'),
  posList: document.getElementById('posList'),
  log: document.getElementById('log'),
  save: document.getElementById('save'),
  reset: document.getElementById('reset')
}

function format(n){ return Math.floor(n).toLocaleString() }
function save(){ localStorage.setItem(STATE_KEY, JSON.stringify(state)) }
function loadState(){ try{ const s = JSON.parse(localStorage.getItem(STATE_KEY)); return s ? s : JSON.parse(JSON.stringify(defaultState)) }catch(e){ return JSON.parse(JSON.stringify(defaultState)) } }
function log(msg){ state.log.push(`${new Date().toLocaleTimeString()} - ${msg}`); render(); save() }

function populateSuppliers(){
  el.supplierSelect.innerHTML = ''
  state.suppliers.forEach(s=>{
    const opt = document.createElement('option')
    opt.value = s.id
    opt.textContent = `${s.name} (rel ${(s.reliability*100).toFixed(0)}%)`
    el.supplierSelect.appendChild(opt)
  })
}

function render(){
  el.cash.textContent = format(state.cash)
  el.inventory.textContent = format(state.inventory)
  el.demand.textContent = state.demandPerSec

  // POs
  if (state.pos.length===0) { el.posList.textContent = '(none)' } else {
    el.posList.innerHTML = ''
    state.pos.forEach(p=>{
      const s = state.suppliers.find(x=>x.id===p.supplierId)
      const div = document.createElement('div')
      const remaining = p.commitEta ? Math.max(0, Math.ceil((p.commitEta - Date.now())/1000)) : (p.arrival ? Math.max(0, Math.ceil((p.arrival - Date.now())/1000)) : '-')
      div.innerHTML = `<strong>PO #${p.id}</strong> [${s.name}] qty ${p.qty} - status: ${p.status}` + (p.commitQty? `, commit: ${p.commitQty}` : '') + (p.commitEta? `, ETA ${remaining}s` : '')
      el.posList.appendChild(div)
    })
  }
  el.log.innerHTML = state.log.slice(-100).map(l=>`<div>${l}</div>`).join('')
}

function placePO(){
  const qty = Math.max(1, parseInt(el.poQty.value)||1)
  const lead = parseInt(el.poLead.value)||15
  const supplierId = el.supplierSelect.value
  const unitCost = 5
  const cost = qty * unitCost
  if (state.cash < cost){ alert('Not enough cash to place PO'); return }
  state.cash -= cost
  const po = { id: nextPoId++, supplierId, qty, placedAt: Date.now(), requestedLead: lead, status: 'pending' }
  state.pos.push(po)
  log(`Placed PO #${po.id} qty ${qty} with ${supplierId} lead ${lead}s cost $${cost}`)
  scheduleSupplierResponse(po)
  save(); render()
}

function scheduleSupplierResponse(po){
  // Simulate supplier reviewing PO and either accepting/rejecting/partial commit
  const supplier = state.suppliers.find(s=>s.id===po.supplierId)
  const reviewMs = 2000 + Math.floor(Math.random()*3000) // 2-5s
  setTimeout(()=>{
    const acceptRoll = Math.random()
    if (acceptRoll <= supplier.reliability){
      // accept, may be partial
      const fillRatio = 0.6 + Math.random()*0.4 // commit between 60-100%
      const commitQty = Math.max(1, Math.floor(po.qty * fillRatio))
      const lead = Math.max(1, Math.round(po.requestedLead * supplier.leadModifier))
      const commitEta = Date.now() + lead*1000
      po.status = 'committed'
      po.commitQty = commitQty
      po.commitEta = commitEta
      log(`Supplier ${supplier.name} committed PO #${po.id} qty ${commitQty} ETA ${lead}s`)
      scheduleArrival(po)
    } else {
      // reject
      po.status = 'rejected'
      // refund cost proportional to rejected qty
      const unitCost = 5
      const refund = po.qty * unitCost
      state.cash += refund
      log(`Supplier ${supplier.name} rejected PO #${po.id}; refunded $${refund}`)
    }
    save(); render()
  }, reviewMs)
}

function scheduleArrival(po){
  const arrivalMs = Math.max(0, (po.commitEta || po.arrival) - Date.now())
  setTimeout(()=>{
    const recv = po.commitQty || po.qty
    state.inventory += recv
    po.status = 'received'
    po.arrival = Date.now()
    log(`PO #${po.id} received +${recv} inventory`)
    save(); render()
  }, arrivalMs)
}

// Auto-fulfill demand
setInterval(()=>{
  const sell = Math.min(state.inventory, state.demandPerSec)
  if (sell>0){ state.inventory -= sell; const revenue = sell * 8; state.cash += revenue; log(`Sold ${sell} for $${revenue}`) }
  render()
}, 1000)

// Restore schedules for committed POs on load
function restoreSchedules(){ state.pos.forEach(p=>{ if (p.status==='committed' && p.commitEta && p.commitEta>Date.now()){ scheduleArrival(p) } }) }

el.placePo.addEventListener('click', placePO)
el.save.addEventListener('click', ()=>{ save(); alert('Saved') })
el.reset.addEventListener('click', ()=>{ if (confirm('Reset game?')){ localStorage.removeItem(STATE_KEY); state = JSON.parse(JSON.stringify(defaultState)); nextPoId = 1; render(); } })

// init
populateSuppliers(); render(); restoreSchedules(); setInterval(()=>save(),15000)
