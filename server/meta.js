'use strict';
// REYNOV — remontée des étapes du CRM vers Meta (API Conversions, « évènements du CRM »).
//
// Principes :
//  • Rien ne part tant que META_CAPI_TOKEN n'est pas défini sur le serveur (Railway) : sans jeton, ce module ne fait rien.
//  • Seules les demandes arrivées par une annonce Meta ET dont le visiteur a accepté la mesure sont concernées :
//    leur « fbclid » n'est enregistré que dans ce cas (voir assets/js/track.js). Pas de fbclid = rien n'est envoyé.
//  • Nom, e-mail, téléphone et ville sont chiffrés (SHA-256, après normalisation) avant l'envoi ; jamais en clair.
//  • Un échec (réseau, jeton refusé) n'empêche jamais de changer le statut d'une demande : il est noté dans la fiche.
//  • Chaque étape n'est envoyée qu'une fois par demande (et Meta dédoublonne grâce à event_id).
const crypto = require('crypto');

const GRAPH = 'https://graph.facebook.com';
const PIXEL_DEFAULT = '1129575169478650';          // ensemble de données « REYNOV » (Gestionnaire d'évènements)
const CRM_NAME = 'REYNOV CRM';

// Statut du CRM → évènement Meta. « Purchase » exige un montant : celui du devis accepté (HT, en euros).
const STAGES = {
  rdv:   { event: 'Schedule', label: 'Rendez-vous fixé' },
  gagne: { event: 'Purchase', label: 'Devis accepté', value: true },
};

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Normalisation (règles Meta) puis chiffrement ──
function normEmail(v) { const e = String(v || '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : ''; }
function normPhone(v) {
  let d = String(v || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (/^0\d{9}$/.test(d)) d = '33' + d.slice(1);       // 06 12 34 56 78 → 33612345678
  d = d.replace(/\D/g, '');
  if (/^330\d{9}$/.test(d)) d = '33' + d.slice(3);          // +33 (0)6… → 336…
  return d.length >= 8 && d.length <= 15 ? d : '';
}
const normName = (v) => String(v || '').toLowerCase().replace(/[^\p{L}]/gu, '');

// Identifiant de clic Meta de la demande (présent seulement si le visiteur a accepté la mesure).
function fbclidOf(lead) {
  const v = lead && lead.attr && lead.attr.fbclid;
  return typeof v === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(v) ? v : '';
}
const eligible = (lead) => !!fbclidOf(lead);

function userData(lead) {
  const ud = {};
  const em = normEmail(lead.email); if (em) ud.em = [sha(em)];
  const ph = normPhone(lead.tel); if (ph) ud.ph = [sha(ph)];
  const fn = normName(lead.prenom); if (fn) ud.fn = [sha(fn)];
  const ln = normName(lead.nom); if (ln) ud.ln = [sha(ln)];
  const ct = normName(lead.ville); if (ct) ud.ct = [sha(ct)];
  ud.country = [sha('fr')];
  ud.external_id = [sha('reynov-lead-' + lead.id)];
  const created = Date.parse(lead.created_at); const t = Number.isFinite(created) ? created : Date.now();
  ud.fbc = 'fb.1.' + t + '.' + fbclidOf(lead);              // l'identifiant de clic n'est PAS chiffré (règle Meta)
  return ud;
}

function buildEvent(lead, status, { value, nowMs } = {}) {
  const st = STAGES[status]; if (!st || !eligible(lead)) return null;
  const ev = {
    event_name: st.event,
    event_time: Math.floor((nowMs || Date.now()) / 1000),
    event_id: 'reynov-' + lead.id + '-' + st.event,
    action_source: 'system_generated',
    custom_data: { event_source: 'crm', lead_event_source: CRM_NAME },
    user_data: userData(lead),
  };
  if (st.value) { ev.custom_data.currency = 'EUR'; ev.custom_data.value = Math.round(Number(value) * 100) / 100; }
  return ev;
}

function create({ db, log = console, retryMs = 3000 } = {}) {
  let last = null;                                           // dernier envoi (mémoire seulement)

  function cfg() {
    const v = (k) => String(process.env[k] || '').trim();
    const token = /^[A-Za-z0-9_|.-]{20,600}$/.test(v('META_CAPI_TOKEN')) ? v('META_CAPI_TOKEN') : '';
    const pixel = /^\d{8,20}$/.test(v('META_PIXEL_ID')) ? v('META_PIXEL_ID') : PIXEL_DEFAULT;
    const version = /^v\d{1,2}\.\d$/.test(v('META_API_VERSION')) ? v('META_API_VERSION') : 'v23.0';
    const testCode = /^[A-Za-z0-9_-]{3,40}$/.test(v('META_TEST_EVENT_CODE')) ? v('META_TEST_EVENT_CODE') : '';
    // Adresse de l'API : modifiable uniquement par les tests automatiques (jamais en production)
    const base = process.env.CRM_TEST_MODE === '1' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(v('META_GRAPH_URL')) ? v('META_GRAPH_URL') : GRAPH;
    return { token, pixel, version, testCode, base };
  }

  function clip(msg, token) {
    let s = String(msg || 'erreur inconnue');
    if (token) s = s.split(token).join('***');
    return s.replace(/\s+/g, ' ').slice(0, 200);
  }

  // Envoi d'un lot d'évènements. Ne lève jamais d'exception.
  async function post(events, testCode) {
    const c = cfg();
    if (!c.token) return { ok: false, error: 'Jeton Meta absent (META_CAPI_TOKEN).' };
    const url = c.base + '/' + c.version + '/' + c.pixel + '/events';
    const body = JSON.stringify({ data: events, access_token: c.token, ...(testCode ? { test_event_code: testCode } : {}) });
    let out = { ok: false, error: 'inconnu' };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 10000);
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctl.signal }).finally(() => clearTimeout(timer));
        const j = await r.json().catch(() => ({}));
        if (r.ok && Number(j.events_received) >= events.length) return { ok: true, fbtrace_id: j.fbtrace_id || null };
        const e = j && j.error;
        out = { ok: false, status: r.status, error: clip(e ? (e.error_user_msg || e.message || 'refusé') + (e.code ? ' (code ' + e.code + ')' : '') : 'Réponse inattendue de Meta (' + r.status + ')', c.token) };
        if (r.status < 500) return out;                      // refus définitif (jeton, format) : inutile de réessayer
      } catch (e) {
        out = { ok: false, error: clip('Réseau : ' + (e && e.name === 'AbortError' ? 'délai dépassé' : (e && e.message)), c.token) };
      }
      if (attempt === 0) await sleep(retryMs);
    }
    return out;
  }

  // Montant (HT) du dernier devis accepté de la demande.
  function acceptedValue(leadId) {
    const q = db.quotesList({ lead_id: leadId }).find((x) => x.status === 'accepte');
    return q ? db.quoteTotals(q).ht : 0;
  }

  function record(lead, ev, r, testMode) {
    const sent = { ...(lead.meta_sent || {}) };
    sent[ev.event_name] = { ok: r.ok, at: new Date().toISOString(), ...(testMode ? { test: true } : {}), ...(r.ok ? {} : { error: r.error }) };
    db.updateLead(lead.id, { meta_sent: sent });
    db.addLeadEvent(lead.id, 'meta', r.ok
      ? 'Meta : « ' + ev.event_name + ' » envoyé' + (testMode ? ' (mode test, non compté)' : '')
      : 'Meta : envoi de « ' + ev.event_name + ' » échoué — ' + r.error);
    last = { at: new Date().toISOString(), event: ev.event_name, ok: r.ok, ...(r.ok ? {} : { error: r.error }), ...(testMode ? { test: true } : {}) };
    if (!r.ok) log.error('⚠️ Meta (API Conversions) :', r.error);
  }

  // Appelé par la base à chaque changement de statut d'une demande.
  async function onLeadStatus(lead, from, to) {
    try {
      const st = STAGES[to]; if (!st) return;
      const c = cfg(); if (!c.token) return;                 // non configuré : rien
      if (!eligible(lead)) return;                           // pas arrivé par une annonce Meta / pas d'accord
      const prev = lead.meta_sent && lead.meta_sent[st.event];
      if (prev && prev.ok && !prev.test) return;             // déjà envoyé pour de bon
      let value;
      if (st.value) {
        value = acceptedValue(lead.id);
        if (!(value > 0)) { db.addLeadEvent(lead.id, 'meta', 'Meta : pas de devis accepté avec un montant, « ' + st.event + ' » non envoyé'); return; }
      }
      const ev = buildEvent(lead, to, { value });
      if (!ev) return;
      record(lead, ev, await post([ev], c.testCode), !!c.testCode);
    } catch (e) { log.error('⚠️ Meta (étape) :', e && e.message); }
  }

  // Évènement d'essai : n'arrive que dans l'onglet « Évènements de test » de Meta (code à copier depuis cet onglet).
  async function sendTest(testCode) {
    const c = cfg();
    if (!c.token) return { ok: false, error: 'Le jeton Meta n\'est pas encore ajouté sur le serveur (variable META_CAPI_TOKEN).' };
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(String(testCode || ''))) return { ok: false, error: 'Code de test invalide : copiez-le tel quel depuis l\'onglet « Évènements de test » de Meta.' };
    const ev = {
      event_name: 'Lead', event_time: Math.floor(Date.now() / 1000), event_id: 'reynov-test-' + Date.now(),
      action_source: 'system_generated', custom_data: { event_source: 'crm', lead_event_source: CRM_NAME },
      user_data: { em: [sha('test@example.com')], country: [sha('fr')] },
    };
    const r = await post([ev], testCode);
    last = { at: new Date().toISOString(), event: 'Lead (essai)', ok: r.ok, ...(r.ok ? {} : { error: r.error }), test: true };
    return r;
  }

  function status() {
    const c = cfg(); const leads = db.leadsList({});
    const sent = {}; let failed = 0, elig = 0;
    Object.values(STAGES).forEach((s) => { sent[s.event] = 0; });
    leads.forEach((l) => {
      if (eligible(l)) elig++;
      Object.entries(l.meta_sent || {}).forEach(([k, v]) => { if (v && v.ok && !v.test && k in sent) sent[k]++; else if (v && !v.ok) failed++; });
    });
    return {
      configured: !!c.token, pixel_id: c.pixel, api_version: c.version, test_mode: !!c.testCode,
      stages: Object.entries(STAGES).map(([status, s]) => ({ status, event: s.event, label: s.label })),
      eligible: elig, sent, failed, last,
    };
  }

  return { onLeadStatus, sendTest, status, cfg };
}

module.exports = { create, buildEvent, normPhone, normEmail, normName, fbclidOf, eligible, sha, STAGES };
