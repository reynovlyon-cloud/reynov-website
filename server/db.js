const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'crm.json');

let _db = { clients: [], interventions: [], visits: {}, _cid: 1, _iid: 1 };

if (fs.existsSync(DB_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    _db = { ..._db, ...loaded };
    if (!_db.visits) _db.visits = {};
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
  return { clients: _db.clients, interventions: _db.interventions };
}

module.exports = {
  exportAll,
  stats, visitsByDay, logVisit,
  clientsList, clientById, findByEmail,
  createClient, updateClient, deleteClient,
  allInterventions, createIntervention, updateIntervention, deleteIntervention,
};
