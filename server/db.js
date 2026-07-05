const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'crm.json');

let _db = { clients: [], interventions: [], _cid: 1, _iid: 1 };

if (fs.existsSync(DB_FILE)) {
  try { _db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch(e) { console.error('CRM load error:', e.message); }
}

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(_db));
}

function now() { return new Date().toISOString(); }

// ── Clients ───────────────────────────────────────────────────
function clientsList(search) {
  const s = (search || '').toLowerCase();
  return _db.clients
    .filter(c => !s || [c.prenom, c.nom, c.email, c.tel, c.ville]
      .some(v => v && v.toLowerCase().includes(s)))
    .map(c => {
      const inters = _db.interventions.filter(i => i.client_id === c.id);
      const last   = inters.sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
      return {
        ...c,
        nb_interventions:      inters.length,
        derniere_intervention: last ? last.created_at : null,
        dernier_statut:        last ? last.statut : null,
      };
    })
    .sort((a,b) => {
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
      .sort((a,b) => b.created_at.localeCompare(a.created_at)),
  };
}

function findByEmail(email) {
  return _db.clients.find(c => c.email && c.email.toLowerCase() === email.toLowerCase()) || null;
}

function createClient(data) {
  const id = _db._cid++;
  const client = { id, created_at: now(), notes: '', ...data };
  _db.clients.push(client);
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
  _db.clients        = _db.clients.filter(c => c.id !== Number(id));
  _db.interventions  = _db.interventions.filter(i => i.client_id !== Number(id));
  save();
}

// ── Interventions ─────────────────────────────────────────────
function allInterventions() {
  return _db.interventions
    .sort((a,b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 200)
    .map(i => {
      const c = _db.clients.find(c => c.id === i.client_id) || {};
      return { ...i, prenom: c.prenom || '', nom: c.nom || '', email: c.email || '', tel: c.tel || '' };
    });
}

function createIntervention(data) {
  const id = _db._iid++;
  const inter = { id, created_at: now(), updated_at: now(), statut: 'nouveau', notes: '', montant: null, ...data };
  _db.interventions.push(inter);
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
  const ym = new Date().toISOString().slice(0, 7);
  const paid = _db.interventions.filter(i => i.statut === 'paye');
  return {
    total_clients:       _db.clients.length,
    total_interventions: _db.interventions.length,
    en_cours:            _db.interventions.filter(i => !['termine','paye','annule'].includes(i.statut)).length,
    nouveaux:            _db.interventions.filter(i => i.statut === 'nouveau').length,
    ca_total:            paid.reduce((s,i) => s + (Number(i.montant) || 0), 0),
    ca_mois:             paid.filter(i => i.created_at.startsWith(ym)).reduce((s,i) => s + (Number(i.montant) || 0), 0),
  };
}

module.exports = {
  stats, clientsList, clientById, findByEmail,
  createClient, updateClient, deleteClient,
  allInterventions, createIntervention, updateIntervention, deleteIntervention,
};
