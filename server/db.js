const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'crm.json');

let _db = { clients: [], interventions: [], visits: {}, leads: [], _cid: 1, _iid: 1, _lid: 1 };

if (fs.existsSync(DB_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    _db = { ..._db, ...loaded };
    if (!_db.visits) _db.visits = {};
    if (!Array.isArray(_db.leads)) _db.leads = [];
    if (!_db._lid) _db._lid = 1 + _db.leads.reduce((m, l) => Math.max(m, l.id || 0), 0);
  } catch(e) { console.error('CRM load error:', e.message); }
}

// Écriture atomique : fichier temporaire puis renommage, pour qu'une coupure en plein enregistrement
// (redéploiement, plantage) ne laisse jamais un crm.json tronqué.
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_db));
  fs.renameSync(tmp, DB_FILE);
}

// Les compteurs de visites s'enregistrent par lots (toutes les 15 s) au lieu d'une écriture disque par page vue.
let _dirty = false, _timer = null;
function saveSoon() {
  _dirty = true;
  if (_timer) return;
  _timer = setTimeout(() => {
    _timer = null;
    if (!_dirty) return;
    _dirty = false;
    try { save(); } catch (e) { console.error('CRM save error:', e.message); }
  }, 15000);
}
function flush() {
  if (_dirty) { _dirty = false; try { save(); } catch (e) { console.error('CRM flush error:', e.message); } }
}
process.on('SIGTERM', () => { flush(); process.exit(0); });
process.on('SIGINT',  () => { flush(); process.exit(0); });

// Sauvegarde quotidienne (14 jours conservés) à côté de la base
function backup() {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    const f = path.join(DATA_DIR, `crm-backup-${new Date().toISOString().slice(0, 10)}.json`);
    if (!fs.existsSync(f)) fs.copyFileSync(DB_FILE, f);
    const olds = fs.readdirSync(DATA_DIR).filter(n => /^crm-backup-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().slice(0, -14);
    olds.forEach(n => fs.unlinkSync(path.join(DATA_DIR, n)));
  } catch (e) { console.error('CRM backup error:', e.message); }
}
backup();
setInterval(backup, 24 * 3600 * 1000).unref();

function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }

// ── Visites ───────────────────────────────────────────────────
function logVisit() {
  const d = today();
  _db.visits[d] = (_db.visits[d] || 0) + 1;
  saveSoon();
}

function visitsByDay(days = 30) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    result.push({ date: d, visits: _db.visits[d] || 0 });
  }
  return result;
}

// ── Clients ───────────────────────────────────────────────────
function clientsList(search) {
  const s = (search || '').toLowerCase();
  return _db.clients
    .filter(c => !s || [c.prenom, c.nom, c.email, c.tel, c.ville]
      .some(v => v && v.toLowerCase().includes(s)))
    .map(c => {
      const inters = _db.interventions.filter(i => i.client_id === c.id);
      const sorted = [...inters].sort((a, b) => b.created_at.localeCompare(a.created_at));
      return {
        ...c,
        nb_interventions:      inters.length,
        derniere_intervention: sorted[0] ? sorted[0].created_at : null,
        dernier_statut:        sorted[0] ? sorted[0].statut : null,
      };
    })
    .sort((a, b) => {
      const ta = a.derniere_intervention || a.created_at;
      const tb = b.derniere_intervention || b.created_at;
      return tb.localeCompare(ta);
    });
}

function clientById(id) {
  const c = _db.clients.find(c => c.id === Number(id));
  if (!c) return null;
  return {
    ...c,
    interventions: _db.interventions
      .filter(i => i.client_id === c.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

function findByEmail(email) {
  return _db.clients.find(c => c.email && c.email.toLowerCase() === (email || '').toLowerCase()) || null;
}

function createClient(data) {
  const id = _db._cid++;
  _db.clients.push({ id, created_at: now(), notes: '', ...data });
  save();
  return id;
}

function updateClient(id, data) {
  const i = _db.clients.findIndex(c => c.id === Number(id));
  if (i === -1) return;
  _db.clients[i] = { ..._db.clients[i], ...data };
  save();
}

function deleteClient(id) {
  _db.clients       = _db.clients.filter(c => c.id !== Number(id));
  _db.interventions = _db.interventions.filter(i => i.client_id !== Number(id));
  save();
}

// ── Interventions ─────────────────────────────────────────────
function allInterventions() {
  return [..._db.interventions]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 200)
    .map(i => {
      const c = _db.clients.find(c => c.id === i.client_id) || {};
      return { ...i, prenom: c.prenom || '', nom: c.nom || '', email: c.email || '', tel: c.tel || '' };
    });
}

function createIntervention(data) {
  const id = _db._iid++;
  _db.interventions.push({ id, created_at: now(), updated_at: now(), statut: 'nouveau', notes: '', montant: null, ...data });
  save();
  return id;
}

function updateIntervention(id, data) {
  const i = _db.interventions.findIndex(x => x.id === Number(id));
  if (i === -1) return;
  _db.interventions[i] = { ..._db.interventions[i], ...data, updated_at: now() };
  save();
}

function deleteIntervention(id) {
  _db.interventions = _db.interventions.filter(i => i.id !== Number(id));
  save();
}


// ── Leads (demandes entrantes : devis, contact, pages publicitaires) ──
const LEAD_STATUS = ['nouveau', 'a_rappeler', 'contacte', 'rdv', 'gagne', 'perdu'];

function addEventRaw(l, type, text) {
  l.events = l.events || [];
  l.events.push({ ts: now(), type, text: String(text || '').slice(0, 600) });
  if (l.events.length > 200) l.events = l.events.slice(-200);
}

function createLead(data) {
  const id = _db._lid++;
  const l = {
    id, created_at: now(), updated_at: now(), source: 'manuel',
    prenom: '', nom: '', email: '', tel: '', ville: '', adresse: '', sujet: '', message: '', form: {},
    status: 'nouveau', contacted: false, contacted_at: null, first_contact_at: null, last_channel: null,
    reminder_at: null, client_id: null, intervention_id: null, triage: null, notes: '', events: [],
    ...data,
  };
  if (!l.events.length) addEventRaw(l, 'created', 'Demande reçue (' + l.source + ')');
  _db.leads.push(l);
  save();
  return l;
}

function leadById(id) { return _db.leads.find(l => l.id === Number(id)) || null; }

function updateLead(id, patch) {
  const l = leadById(id);
  if (!l) return null;
  const allowed = ['prenom', 'nom', 'email', 'tel', 'ville', 'adresse', 'sujet', 'message', 'notes', 'form', 'reminder_at', 'client_id', 'intervention_id', 'created_at'];
  allowed.forEach(k => { if (patch[k] !== undefined) l[k] = patch[k]; });
  if (patch.status !== undefined && LEAD_STATUS.includes(patch.status) && patch.status !== l.status) {
    addEventRaw(l, 'status', 'Statut : ' + l.status + ' → ' + patch.status);
    l.status = patch.status;
    if (patch.status === 'contacte' || patch.status === 'rdv') markContactedRaw(l, null, true);
    if (patch.status !== 'a_rappeler') l.reminder_at = patch.reminder_at !== undefined ? patch.reminder_at : null;
  }
  if (patch.triage) l.triage = patch.triage;
  if (patch.categories && l.triage) l.triage.categories = patch.categories;
  l.updated_at = now();
  save();
  return l;
}

function markContactedRaw(l, channel, silent) {
  const t = now();
  if (!l.first_contact_at) l.first_contact_at = t;
  l.contacted = true; l.contacted_at = t;
  if (channel) l.last_channel = channel;
  if (!silent) addEventRaw(l, 'contact', 'Contact : ' + (channel || 'autre'));
}

function logContact(id, channel, note) {
  const l = leadById(id);
  if (!l) return null;
  markContactedRaw(l, channel, false);
  if (note) addEventRaw(l, 'note', note);
  if (l.status === 'nouveau' || l.status === 'a_rappeler') { addEventRaw(l, 'status', 'Statut : ' + l.status + ' → contacte'); l.status = 'contacte'; l.reminder_at = null; }
  l.updated_at = now();
  save();
  return l;
}

function addLeadEvent(id, type, text) {
  const l = leadById(id);
  if (!l) return null;
  addEventRaw(l, type, text);
  l.updated_at = now();
  save();
  return l;
}

function deleteLead(id) {
  const n = _db.leads.length;
  _db.leads = _db.leads.filter(l => l.id !== Number(id));
  if (_db.leads.length !== n) save();
  return _db.leads.length !== n;
}

function leadsList({ status, q, cat } = {}) {
  const s = (q || '').toLowerCase();
  return [..._db.leads]
    .filter(l => !status || l.status === status)
    .filter(l => !cat || (l.triage && (l.triage.categories || []).includes(cat)))
    .filter(l => !s || [l.prenom, l.nom, l.email, l.tel, l.ville, l.message, (l.form || {}).marque, (l.form || {}).modele, l.triage && l.triage.summary].some(v => v && String(v).toLowerCase().includes(s)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function findRecentDuplicate(email, message, minutes = 10) {
  const e = (email || '').toLowerCase();
  const m = (message || '').trim();
  const since = Date.now() - minutes * 60000;
  return _db.leads.find(l => (l.email || '').toLowerCase() === e && (l.message || '').trim() === m && Date.parse(l.created_at) > since) || null;
}

function leadExists(email, createdIso) {
  const e = (email || '').toLowerCase();
  const t = Date.parse(createdIso);
  return _db.leads.some(l => (l.email || '').toLowerCase() === e && Math.abs(Date.parse(l.created_at) - t) < 10 * 60000);
}

function leadStats() {
  const L = _db.leads;
  const byStatus = {}; LEAD_STATUS.forEach(s => { byStatus[s] = 0; });
  L.forEach(l => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });
  const d7 = Date.now() - 7 * 86400000;
  const d30 = Date.now() - 30 * 86400000;
  const delays = L.filter(l => l.first_contact_at && Date.parse(l.created_at) > d30).map(l => (Date.parse(l.first_contact_at) - Date.parse(l.created_at)) / 60000).filter(x => x >= 0);
  const perDay = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    perDay.push({ date: d, leads: L.filter(l => l.created_at.startsWith(d)).length });
  }
  const cats = {};
  L.filter(l => Date.parse(l.created_at) > d30).forEach(l => ((l.triage && l.triage.categories) || ['autre']).forEach(c => { cats[c] = (cats[c] || 0) + 1; }));
  const sources = {};
  L.filter(l => Date.parse(l.created_at) > d30).forEach(l => { sources[l.source] = (sources[l.source] || 0) + 1; });
  const stale = L.filter(l => l.status === 'nouveau' && !l.contacted && Date.now() - Date.parse(l.created_at) > 24 * 3600000).length;
  const due = L.filter(l => l.status === 'a_rappeler' && l.reminder_at && Date.parse(l.reminder_at) <= Date.now()).length;
  const converted = L.filter(l => l.status === 'gagne' && Date.parse(l.created_at) > d30).length;
  return {
    total: L.length, by_status: byStatus,
    last7: L.filter(l => Date.parse(l.created_at) > d7).length,
    last30: L.filter(l => Date.parse(l.created_at) > d30).length,
    avg_first_contact_min: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
    uncontacted: L.filter(l => !l.contacted && !['gagne', 'perdu'].includes(l.status)).length,
    stale_24h: stale, reminders_due: due, converted30: converted,
    per_day: perDay, categories: cats, sources,
  };
}

// ── Stats ─────────────────────────────────────────────────────
function stats() {
  const ym   = new Date().toISOString().slice(0, 7);
  const paid = _db.interventions.filter(i => i.statut === 'paye');
  return {
    total_clients:       _db.clients.length,
    total_interventions: _db.interventions.length,
    en_cours:            _db.interventions.filter(i => !['termine', 'paye', 'annule'].includes(i.statut)).length,
    nouveaux:            _db.interventions.filter(i => i.statut === 'nouveau').length,
    ca_total:            paid.reduce((s, i) => s + (Number(i.montant) || 0), 0),
    ca_mois:             paid.filter(i => i.created_at.startsWith(ym)).reduce((s, i) => s + (Number(i.montant) || 0), 0),
    visites_aujourd_hui: _db.visits[today()] || 0,
    visites_total:       Object.values(_db.visits).reduce((s, v) => s + v, 0),
  };
}

function exportAll() {
  return { clients: _db.clients, interventions: _db.interventions, leads: _db.leads };
}

module.exports = {
  exportAll, LEAD_STATUS,
  createLead, leadById, updateLead, logContact, addLeadEvent, deleteLead, leadsList, findRecentDuplicate, leadExists, leadStats,
  stats, visitsByDay, logVisit,
  clientsList, clientById, findByEmail,
  createClient, updateClient, deleteClient,
  allInterventions, createIntervention, updateIntervention, deleteIntervention,
};
