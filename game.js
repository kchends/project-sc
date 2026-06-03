// Project SC — per-part inventory and supplier flow
const STATE_KEY = 'project-sc-v1'
const defaultState = {
  cash: 500,
  demandPerSec: 1,
  pos: [],
  // parts catalog
  parts: [
    {id: 'CPU', name: 'CPU', unitCost: 200},
    {id: 'MB', name: 'Motherboard', unitCost: 150},
    {id: 'DIMM', name: 'Memory DIMM', unitCost: 40},
    {id: 'SSD', name: 'NVMe SSD', unitCost: 120},
    {id: 'GPU', name: 'Accelerator GPU', unitCost: 800},
    {id: 'NIC', name: 'NIC', unitCost: 60},
    {id: 'PSU', name: 'PSU', unitCost: 90},
    {id: 'CHASSIS', name: 'Chassis', unitCost: 250},
    {id: 'FAN', name: 'Fan', unitCost: 10},
    {id: 'CABLE', name: 'Cable', unitCost: 5},
    {id: 'SWITCH', name: 'Top-of-Rack Switch', unitCost: 1000},
    {id: 'PDU', name: 'PDU', unitCost: 200}
  ],
  // synthetic suppliers (which parts they can supply)
  suppliers: [
    {id: 'SUP1', name: 'Integra Compute', parts: ['CPU','GPU'], reliability: 0.9, leadModifier: 1.0},
    {id: 'SUP2', name: 'Amda Labs', parts: ['CPU','GPU'], reliability: 0.85, leadModifier: 1.1},
    {id: 'SUP3', name: 'Micran Memory', parts: ['DIMM'], reliability: 0.95, leadModifier: 1.0},
    {id: 'SUP4', name: 'Samtron Storage', parts: ['SSD'], reliability: 0.9, leadModifier: 1.2},
    {id: 'SUP5', name: 'Broadmax Networking', parts: ['NIC','SWITCH'], reliability: 0.88, leadModifier: 1.1},
    {id: 'SUP6', name: 'Corzar Power', parts: ['PSU','PDU'], reliability: 0.9, leadModifier: 1.0},
    {id: 'SUP7', name: 'Supermicra Chassis', parts: ['CHASSIS','FAN','CABLE'], reliability: 0.92, leadModifier: 1.0}
  ],
  // inventory per part id
  inventory: {},
  log: []
}

// Load state and merge defaults safely
function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(STATE_KEY))
    if (!saved) return JSON.parse(JSON.stringify(defaultState))
    // merge top-level keys
    const merged = Object.assign({}, defaultState, saved)
    // ensure arrays exist
    merged.parts = merged.parts || defaultState.parts.slice()
    merged.suppliers = merged.suppliers || defaultState.suppliers.slice()
    merged.pos = merged.pos || []
    merged.log = merged.log || []
    // ensure inventory has all part keys
    merged.inventory = merged.inventory || {}
    defaultState.parts.forEach(p=>{ if (typeof merged.inventory[p.id] !== 'number') merged.inventory[p.id] = 0 })
    return merged
  }catch(e){ return JSON.parse(JSON.stringify(defaultState)) }
}

let state = loadState()
let nextPoId = (state.pos && state.pos.length) ? Math.max(...state.pos.map(p=>parseInt(p.id)))+1 : 1

// DOM refs
const el = {
  cash: document.getElementById('cash'),
  inventoryList: document.getElementById('inventoryList'),
  demand: document.getElementById('demand'),
  partSelect: document.getElementById('partSelect'),
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
function log(msg){ state.log.push(`${new Date().toLocaleTimeString()} - ${msg}`); render(); save() }

function populateParts(){
  el.partSelect.innerHTML = ''
  state.parts.forEach(p=>{
    const opt = document.createElement('option')
    opt.value = p.id
    opt.textContent = `${p.name} ($${p.unitCost})`
    el.partSelect.appendChild(opt)
  })
}

function populateSuppliers(){
  const partId = el.partSelect.value
  el.supplierSelect.innerHTML = ''
  state.suppliers.filter(s=>s.parts.includes(partId)).forEach(s=>{
    const opt = document.createElement('option')
    opt.value = s.id
    opt.textContent = `${s.name} (rel ${(s.reliability*100).toFixed(0)}%)`
    el.supplierSelect.appendChild(opt)
  })
}

function render(){
  el.cash.textContent = format(state.cash)
  el.demand.textContent = state.demandPerSec
  // inventory list
  el.inventoryList.innerHTML = state.parts.map(p=>`<div>${p.name}: <strong>${state.inventory[p.id]||0}</strong></div>`).join('')

  // POs
  if (state.pos.length===0) { el.posList.textContent = '(none)' } else {
    el.posList.innerHTML = ''
    state.pos.forEach(p=>{
      const s = state.suppliers.find(x=>x.id===p.supplierId) || {name: p.supplierId}
      const part = state.parts.find(x=>x.id===p.partId) || {name: p.partId}
      const div = document.createElement('div')
      const remaining = p.commitEta ? Math.max(0, Math.ceil((p.commitEta - Date.now())/1000)) : (p.arrival ? Math.max(0, Math.ceil((p.arrival - Date.now())/1000)) : '-')
      div.innerHTML = `<strong>PO #${p.id}</strong> [${s.name}] part: ${part.name} qty ${p.qty} - status: ${p.status}` + (p.commitQty? `, commit: ${p.commitQty}` : '') + (p.commitEta? `, ETA ${remaining}s` : '')
      el.posList.appendChild(div)
    })
  }
  el.log.innerHTML = state.log.slice(-100).map(l=>`<div>${l}</div>`).join('')
}

function placePO(){
  const qty = Math.max(1, parseInt(el.poQty.value)||1)
  const lead = parseInt(el.poLead.value)||15
  const supplierId = el.supplierSelect.value
  const partId = el.partSelect.value
  const part = state.parts.find(p=>p.id===partId)
  if (!part){ alert('Select a valid part'); return }
  const unitCost = part.unitCost
  const cost = qty * unitCost
  if (state.cash < cost){ alert('Not enough cash to place PO'); return }
  state.cash -= cost
  const po = { id: nextPoId++, supplierId, partId, qty, placedAt: Date.now(), requestedLead: lead, status: 'pending' }
  state.pos.push(po)
  log(`Placed PO #${po.id} ${part.name} qty ${qty} with ${supplierId} lead ${lead}s cost $${cost}`)
  scheduleSupplierResponse(po)
  save(); render()
}

function scheduleSupplierResponse(po){
  const supplier = state.suppliers.find(s=>s.id===po.supplierId)
  const reviewMs = 1500 + Math.floor(Math.random()*2500)
  setTimeout(()=>{
    const acceptRoll = Math.random()
    if (acceptRoll <= supplier.reliability){
      const fillRatio = 0.6 + Math.random()*0.4
      const commitQty = Math.max(1, Math.floor(po.qty * fillRatio))
      const lead = Math.max(1, Math.round(po.requestedLead * supplier.leadModifier))
      const commitEta = Date.now() + lead*1000
      po.status = 'committed'
      po.commitQty = commitQty
      po.commitEta = commitEta
      log(`${supplier.name} committed PO #${po.id} ${po.partId} qty ${commitQty} ETA ${lead}s`)
      scheduleArrival(po)
    } else {
      po.status = 'rejected'
      const refund = po.qty * (state.parts.find(p=>p.id===po.partId).unitCost || 0)
      state.cash += refund
      log(`${supplier.name} rejected PO #${po.id}; refunded $${refund}`)
    }
    save(); render()
  }, reviewMs)
}

function scheduleArrival(po){
  const arrivalMs = Math.max(0, (po.commitEta || po.arrival) - Date.now())
  setTimeout(()=>{
    const recv = po.commitQty || po.qty
    state.inventory[po.partId] = (state.inventory[po.partId] || 0) + recv
    po.status = 'received'
    po.arrival = Date.now()
    log(`PO #${po.id} received +${recv} ${po.partId}`)
    save(); render()
  }, arrivalMs)
}

// Auto-fulfill demand: consume generic parts (for now consume DIMM/SSD/CPU proportionally)
setInterval(()=>{
  const demand = state.demandPerSec
  // simplistic fulfillment: try to consume DIMM units first then CPU then SSD
  const prefer = ['DIMM','CPU','SSD']
  let sold = 0
  for(const pid of prefer){
    const have = state.inventory[pid] || 0
    const take = Math.min(have, demand - sold)
    if (take>0){ state.inventory[pid] -= take; const revenue = take * (state.parts.find(p=>p.id===pid).unitCost * 1.4); state.cash += revenue; log(`Fulfilled ${take} ${pid} for $${Math.floor(revenue)}`); sold += take }
    if (sold>=demand) break
  }
  render()
}, 1000)

// Restore schedules for committed POs on load
function restoreSchedules(){ state.pos.forEach(p=>{ if (p.status==='committed' && p.commitEta && p.commitEta>Date.now()){ scheduleArrival(p) } }) }

el.placePo.addEventListener('click', placePO)
el.partSelect.addEventListener('change', populateSuppliers)
el.save.addEventListener('click', ()=>{ save(); alert('Saved') })
el.reset.addEventListener('click', ()=>{ if (confirm('Reset game?')){ localStorage.removeItem(STATE_KEY); state = JSON.parse(JSON.stringify(defaultState)); nextPoId = 1; render(); } })

// init
populateParts(); populateSuppliers(); render(); restoreSchedules(); setInterval(()=>save(),15000)
