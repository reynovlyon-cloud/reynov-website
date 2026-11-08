// Synchronisation de la boîte Gmail avec le CRM (lecture seule).
//  1) retrouve tous les anciens e-mails « Nouveau devis » et recrée les leads manquants ;
//  2) range chaque échange avec un client (reçu / envoyé) dans la fiche du lead, à sa vraie date ;
//  3) en déduit qui a déjà reçu une réponse et qui attend encore.
// Aucun e-mail n'est modifié, supprimé ni envoyé ici. Inactif tant que le droit « lecture Gmail » n'est pas accordé.
const fs = require('fs');
const path = require('path');

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TICK_MS = 5 * 60 * 1000;
const BUDGET_MS = 40 * 1000;

// ── Lecture d'un e-mail ──────────────────────────────────────
const decodeEntities = (s) => String(s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const un = (s) => decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const addrs = (h) => ((String(h || '').match(EMAIL_RE)) || []).map((e) => e.toLowerCase());

function header(payload, name) {
  const h = (payload.headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}
function walk(part, fn) { if (!part) return; fn(part); (part.parts || []).forEach((p) => walk(p, fn)); }
function b64(d) { return Buffer.from(String(d || ''), 'base64url').toString('utf8'); }

// Message Gmail → objet simple { id, ts, from, to, subject, snippet, html, text, photos, origin }
function normalize(g) {
  const p = g.payload || {};
  const o = { id: g.id, threadId: g.threadId, snippet: decodeEntities(g.snippet || ''), html: '', text: '', photos: 0, atts: [] };
  o.subject = decodeEntities(header(p, 'Subject'));
  o.from = addrs(header(p, 'From'))[0] || '';
  o.to = [...addrs(header(p, 'To')), ...addrs(header(p, 'Cc')), ...addrs(header(p, 'Delivered-To'))].filter((e, i, a) => a.indexOf(e) === i);
  o.origin = header(p, 'X-Reynov-Origin').trim().toLowerCase();
  const d = g.internalDate ? new Date(Number(g.internalDate)) : new Date(header(p, 'Date'));
  o.ts = isNaN(d) ? new Date().toISOString() : d.toISOString();
  walk(p, (x) => {
    if (x.body && x.body.data) {
      if (x.mimeType === 'text/html' && !o.html) o.html = b64(x.body.data);
      else if (x.mimeType === 'text/plain' && !o.text) o.text = b64(x.body.data);
    }
    if (x.filename && /^image\//.test(x.mimeType || '')) { o.photos++; if (x.body && x.body.attachmentId) o.atts.push({ id: x.body.attachmentId, mime: x.mimeType, size: Number(x.body.size) || 0 }); }
  });
  return o;
}

// ── Notification « Nouveau devis » envoyée par le site → lead ──
const ROWS = { 'Prestation': 'prestation', 'Problème(s)': 'problemes', 'Nb jantes': 'nb_jantes', 'Taille': 'taille', 'Véhicule': 'vehicule', 'Finition': 'finition', 'Mode': 'mode', 'Délai': 'delai', 'Ville / CP': 'ville' };
const TEL_RE = /(?:\+33|0033|0)\s?[1-9](?:[\s.\-]?\d{2}){4}/;
function parseDevis(m, owner) {
  const h = m.html || '';
  const plain = un(h.replace(/<\/(p|tr|div)>/gi, '\n')) || m.text;
  const lead = { source: 'devis', form: {}, created_at: m.ts };
  let name = '', email = '', tel = '';
  const c = h.match(/Contact<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/);
  if (c) { name = un(c[1]); email = un(c[2]); tel = un(c[3]); }
  if (!name) { const n = m.subject.match(/(?:devis|demande)\s*[-–:]\s*(.+)$/i); name = n ? n[1].trim() : ''; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = (addrs(plain).filter((e) => e !== owner)[0]) || '';
  if (!tel) { const t = plain.match(TEL_RE); tel = t ? t[0] : ''; }
  const parts = name.split(/\s+/).filter(Boolean);
  lead.prenom = parts[0] || ''; lead.nom = parts.slice(1).join(' '); lead.email = email; lead.tel = tel;
  const a = h.match(/Adresse\s*:\s*([\s\S]*?)<\/p>/); if (a) lead.adresse = un(a[1]);
  for (const [label, key] of Object.entries(ROWS)) {
    const r = h.match(new RegExp('<td[^>]*>\\s*' + label.replace(/[()/]/g, '\\$&') + '\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>', 'i'));
    if (!r) continue;
    const v = un(r[1]);
    if (key === 'vehicule') { const i = v.indexOf(' '); lead.form.marque = i < 0 ? v : v.slice(0, i); lead.form.modele = i < 0 ? '' : v.slice(i + 1); }
    else if (key === 'ville') lead.ville = v;
    else lead.form[key] = v;
  }
  const ms = h.match(/>Message<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/);
  lead.message = ms ? un(ms[1]) : (c ? '' : plain.slice(0, 1500));
  lead.form.photos = m.photos;
  return lead;
}

// ── Module ──────────────────────────────────────────────────
function create({ db, getAccessToken, owner, importLeadItem, enabled, apiBase, photoSaver }) {
  const BASE = apiBase || GMAIL;
  owner = String(owner || '').toLowerCase();
  const FILE = path.join(db.DATA_DIR, 'mailsync.json');
  let st = { since: null, devis_page: null, devis_done: false, photo_scan: false, photo_page: null, pdone: [], seen: [], synced: {}, last_run: null, last_ok: null, state: 'idle', error: '', counts: { devis: 0, in: 0, out: 0 } };
  try { st = { ...st, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch (e) { /* premier démarrage */ }
  const seen = new Set(st.seen);
  const pdone = new Set(st.pdone || []);
  let running = false, timer = null, token = null, tokenAt = 0;

  function persist() {
    st.seen = [...seen].slice(-30000); st.pdone = [...pdone].slice(-5000);
    try { fs.writeFileSync(FILE + '.tmp', JSON.stringify(st)); fs.renameSync(FILE + '.tmp', FILE); } catch (e) { console.error('⚠️ mailsync save:', e.message); }
  }

  async function api(p, retry = 0) {
    if (!token || Date.now() - tokenAt > 45 * 60 * 1000) { token = await getAccessToken(); tokenAt = Date.now(); }
    const r = await fetch(BASE + p, { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 401 && retry < 1) { token = null; return api(p, retry + 1); }
    if ((r.status === 429 || r.status >= 500) && retry < 3) { await new Promise((z) => setTimeout(z, 1500 * (retry + 1))); return api(p, retry + 1); }
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((body.error && body.error.message) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return body;
  }
  async function listAll(q, pageToken, max) {
    return api('/messages?maxResults=' + (max || 100) + '&q=' + encodeURIComponent(q) + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''));
  }

  // Range un e-mail dans le CRM. Renvoie 'devis' | 'in' | 'out' | null
  function process(m) {
    if (!m || m.origin === 'ack' || m.origin === 'crm') return null;                       // nos envois automatiques ne comptent pas
    const fromOwner = m.from === owner;
    if (fromOwner && /a bien été reçu/i.test(m.subject)) return null;                      // anciens accusés de réception (avant l'étiquette)
    if (fromOwner && /^\s*Nouveau devis\b/i.test(m.subject)) {                              // notification du site → lead
      const item = parseDevis(m, owner);
      const age = Date.now() - Date.parse(m.ts);
      const r = importLeadItem(item, age < 36 * 3600 * 1000 ? 'nouveau' : 'a_rappeler', 'Demande retrouvée dans vos e-mails.');
      if (r === 'added') st.counts.devis++;
      return r === 'added' ? 'devis' : null;
    }
    if (/^\s*Nouveau message\b/i.test(m.subject) && fromOwner) return null;                // notification de contact : déjà en base
    const text = (m.subject ? m.subject + ' — ' : '') + (m.snippet || '');
    const pick = (email) => {                                                              // lead le plus récent créé avant ce mail, sinon le plus ancien
      const L = db.leadsByEmail(email);
      if (!L.length) return null;
      const t = Date.parse(m.ts);
      return [...L].reverse().find((l) => Date.parse(l.created_at) <= t + 60000) || L[0];
    };
    if (fromOwner) {
      let n = 0;
      for (const to of m.to.filter((e) => e !== owner)) { const l = pick(to); if (l && db.addMailEvent(l.id, { gid: m.id, dir: 'out', ts: m.ts, text: 'E-mail envoyé : ' + text.slice(0, 280) })) n++; }
      if (n) { st.counts.out++; return 'out'; }
      return null;
    }
    const l = pick(m.from);
    if (l && db.addMailEvent(l.id, { gid: m.id, dir: 'in', ts: m.ts, text: 'E-mail reçu : ' + text.slice(0, 280) })) { st.counts.in++; return 'in'; }
    return null;
  }

  // Photos jointes à une notification « Nouveau devis » : rangées sur la fiche du lead (sans doublon)
  async function attachPhotos(m) {
    if (!photoSaver || !m.atts || !m.atts.length || m.from !== owner || !/^\s*Nouveau devis\b/i.test(m.subject)) return 0;
    const email = parseDevis(m, owner).email; const lead = email ? db.findLeadNear(email, m.ts) : null; if (!lead) return 0;
    let n = 0;
    for (const a of m.atts.slice(0, 8)) {
      if (a.size > 12 * 1024 * 1024) continue;
      try {
        const r = await api('/messages/' + m.id + '/attachments/' + a.id);
        if (r.data && photoSaver(lead.id, Buffer.from(r.data, 'base64url'), { src: 'gmail:' + m.id, by: 'Client' })) n++;
      } catch (e) { if (e.status === 401 || e.status === 403) throw e; }
    }
    return n;
  }
  async function fetchAndProcess(id, full) {
    if (seen.has(id)) return;
    const g = await api('/messages/' + id + '?format=' + (full ? 'full' : 'metadata') + (full ? '' : '&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=X-Reynov-Origin'));
    let m = normalize(g);
    if (!full && m.from === owner && /^\s*Nouveau devis\b/i.test(m.subject)) m = normalize(await api('/messages/' + id + '?format=full'));
    process(m);
    if (full || m.atts.length) { try { await attachPhotos(m); pdone.add(id); } catch (e) { if (e.status === 403 || e.status === 401) throw e; } }
    seen.add(id);
  }
  async function batch(ids, full, deadline) {
    const todo = ids.filter((i) => !seen.has(i));
    for (let i = 0; i < todo.length && Date.now() < deadline; i += 5) await Promise.all(todo.slice(i, i + 5).map((id) => fetchAndProcess(id, full)));
  }

  async function tick(manual) {
    if (!enabled() || running) return;
    running = true;
    const deadline = Date.now() + BUDGET_MS;
    try {
      st.last_run = new Date().toISOString();
      if (!st.since) st.since = Math.floor(Date.now() / 1000) - 3600;
      // 1) anciens devis (tout l'historique, par pages)
      if (!st.devis_done) {
        while (Date.now() < deadline) {
          const r = await listAll('from:me subject:"Nouveau devis"', st.devis_page, 50);
          await batch((r.messages || []).map((x) => x.id), true, deadline);
          if (Date.now() >= deadline && (r.messages || []).some((x) => !seen.has(x.id))) break;
          st.devis_page = r.nextPageToken || null;
          if (!st.devis_page) { st.devis_done = true; break; }
        }
      }
      // 1b) photos jointes aux anciens devis (une seule fois)
      if (st.devis_done && !st.photo_scan) {
        while (Date.now() < deadline) {
          const r = await listAll('from:me subject:"Nouveau devis" has:attachment', st.photo_page, 50);
          const ids = (r.messages || []).map((x) => x.id).filter((i) => !pdone.has(i));
          for (let i = 0; i < ids.length && Date.now() < deadline; i += 3) {
            await Promise.all(ids.slice(i, i + 3).map(async (mid) => { const m = normalize(await api('/messages/' + mid + '?format=full')); await attachPhotos(m); pdone.add(mid); }));
          }
          if (ids.some((i) => !pdone.has(i))) break;
          st.photo_page = r.nextPageToken || null;
          if (!st.photo_page) { st.photo_scan = true; break; }
        }
      }
      // 2) historique d'échanges de chaque lead (une recherche par adresse e-mail)
      if (st.devis_done) {
        const todo = db.allLeads().filter((l) => l.email && !st.synced[l.email.toLowerCase()]);
        const emails = [...new Set(todo.map((l) => l.email.toLowerCase()))];
        for (const e of emails) {
          if (Date.now() >= deadline) break;
          let pt = null, done = true;
          do {
            const r = await listAll('{from:' + e + ' to:' + e + '} -label:spam', pt, 100);
            await batch((r.messages || []).map((x) => x.id), false, deadline);
            pt = r.nextPageToken || null;
            if (Date.now() >= deadline && (r.messages || []).some((x) => !seen.has(x.id))) { done = false; break; }
          } while (pt);
          if (done) st.synced[e] = 1;
        }
      }
      // 3) nouveaux e-mails depuis la dernière passe
      const from = st.since - 1800;
      let pt = null, pages = 0;
      do {
        const r = await listAll('after:' + from + ' -label:spam -category:promotions', pt, 100);
        await batch((r.messages || []).map((x) => x.id), false, deadline);
        pt = r.nextPageToken || null; pages++;
      } while (pt && pages < 5 && Date.now() < deadline);
      if (!pt || pages >= 5) st.since = Math.floor(Date.now() / 1000) - 60;
      st.state = 'ok'; st.error = ''; st.last_ok = new Date().toISOString();
    } catch (e) {
      if (e.status === 403 && /scope|insufficient|permission/i.test(e.message)) { st.state = 'scope_missing'; st.error = e.message; }
      else if (/invalid_grant|Token error/i.test(e.message)) { st.state = 'token_error'; st.error = e.message.slice(0, 200); }
      else { st.state = 'error'; st.error = e.message; }
      if (st.state !== 'scope_missing') console.error('⚠️ mailsync:', e.message);
    } finally {
      persist();
      running = false;
      schedule();
    }
  }

  function backlog() {
    if (!st.devis_done) return true;
    return db.allLeads().some((l) => l.email && !st.synced[l.email.toLowerCase()]);
  }
  function schedule() {
    clearTimeout(timer);
    const delay = st.state === 'scope_missing' || st.state === 'token_error' ? 60 * 60 * 1000 : (st.state === 'ok' && backlog() ? 20 * 1000 : TICK_MS);
    timer = setTimeout(() => tick(), delay);
    timer.unref && timer.unref();
  }

  function status() {
    const leads = db.allLeads();
    const total = leads.filter((l) => l.email).length;
    const done = leads.filter((l) => l.email && st.synced[l.email.toLowerCase()]).length;
    return { enabled: enabled(), state: running ? 'running' : st.state, error: st.error, last_run: st.last_run, last_ok: st.last_ok, devis_done: st.devis_done, leads_total: total, leads_synced: done, counts: st.counts, seen: seen.size };
  }

  // Bilan global : qui attend une réponse, qui n'en a jamais reçu, délai moyen
  function report() {
    const L = db.allLeads().map((l) => ({ l, r: db.replyState(l) }));
    const open = L.filter((x) => x.l.status !== 'gagne' && x.l.status !== 'perdu');
    const brief = (x) => ({ id: x.l.id, name: ((x.l.prenom || '') + ' ' + (x.l.nom || '')).trim(), email: x.l.email, tel: x.l.tel, created_at: x.l.created_at, since: x.r.since, status: x.l.status, primary: x.l.triage && x.l.triage.primary, summary: x.l.triage && x.l.triage.summary });
    const delays = L.filter((x) => x.l.first_contact_at).map((x) => Date.parse(x.l.first_contact_at) - Date.parse(x.l.created_at)).filter((d) => d >= 0 && d < 90 * 86400000);
    const waiting = open.filter((x) => x.r.waiting).sort((a, b) => Date.parse(a.r.since) - Date.parse(b.r.since));
    return {
      total: L.length, open: open.length,
      answered: L.filter((x) => !x.r.never).length,
      never_answered: open.filter((x) => x.r.never).length,
      waiting: waiting.length,
      waiting_over_3d: waiting.filter((x) => Date.now() - Date.parse(x.r.since) > 3 * 86400000).length,
      avg_first_reply_hours: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length / 360000) / 10 : null,
      oldest_waiting: waiting.slice(0, 15).map(brief),
    };
  }

  function start() {
    if (!enabled()) return;
    timer = setTimeout(() => tick(), 25 * 1000);
    timer.unref && timer.unref();
  }
  return { start, tick, status, report, process, normalize, parseDevis };
}

module.exports = { create, normalize, parseDevis };
