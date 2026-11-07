// Synchronisation du planning du CRM avec Google Agenda, dans les deux sens.
//  - un rendez-vous créé / modifié / supprimé dans le CRM est envoyé à Google ;
//  - un événement créé / modifié / supprimé dans Google Agenda apparaît dans le CRM ;
//  - en cas de modification des deux côtés, la plus récente l'emporte.
// Inactif tant que le droit « Google Agenda » n'est pas accordé (variable GOOGLE_CALENDAR_REFRESH_TOKEN).
const fs = require('fs');
const path = require('path');

const API = 'https://www.googleapis.com/calendar/v3';
const TZ = 'Europe/Paris';
const TICK_MS = 3 * 60 * 1000;
const DAY = 86400000;

const enc = encodeURIComponent;
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (s, n) => ymd(Date.parse(s + 'T00:00:00Z') + n * DAY);

// CRM → Google
function toGoogle(e, lead) {
  const o = {
    summary: e.title || 'Rendez-vous REYNOV',
    location: e.location || undefined,
    description: [e.notes || '', lead ? ('— CRM REYNOV : ' + [lead.prenom, lead.nom].filter(Boolean).join(' ') + (lead.tel ? ' · ' + lead.tel : '')) : ''].filter(Boolean).join('\n\n') || undefined,
    extendedProperties: { private: { reynov_event: String(e.id), reynov_lead: e.lead_id ? String(e.lead_id) : '' } },
  };
  if (e.all_day) { o.start = { date: e.start.slice(0, 10) }; o.end = { date: addDays((e.end || e.start).slice(0, 10), 1) }; }
  else {
    const end = e.end && Date.parse(e.end) > Date.parse(e.start) ? e.end : new Date(Date.parse(e.start) + 3600000).toISOString();
    o.start = { dateTime: new Date(e.start).toISOString(), timeZone: TZ }; o.end = { dateTime: new Date(end).toISOString(), timeZone: TZ };
  }
  return o;
}
// Google → CRM (champs modifiables seulement)
function fromGoogle(g) {
  const f = { title: g.summary || '(sans titre)', location: g.location || '', notes: String(g.description || '').replace(/\n*— CRM REYNOV :.*$/s, '').trim() };
  if (g.start && g.start.date) { f.all_day = true; f.start = g.start.date; f.end = addDays(g.end && g.end.date ? g.end.date : addDays(g.start.date, 1), -1); }
  else { f.all_day = false; f.start = new Date(g.start && g.start.dateTime).toISOString(); f.end = new Date((g.end && g.end.dateTime) || (g.start && g.start.dateTime)).toISOString(); }
  return f;
}

function create({ db, getAccessToken, enabled, apiBase }) {
  const BASE = apiBase || API;
  const FILE = path.join(db.DATA_DIR, 'calsync.json');
  let st = { calendar: 'primary', calendar_name: '', token: null, last_run: null, last_ok: null, state: 'idle', error: '', counts: { pulled: 0, pushed: 0, deleted: 0 } };
  try { st = { ...st, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch (e) { /* premier démarrage */ }
  let running = false, timer = null, push_timer = null, tok = null, tokAt = 0;

  function persist() { try { fs.writeFileSync(FILE + '.tmp', JSON.stringify(st)); fs.renameSync(FILE + '.tmp', FILE); } catch (e) { console.error('⚠️ calsync save:', e.message); } }

  async function api(method, p, body, retry = 0) {
    if (!tok || Date.now() - tokAt > 45 * 60 * 1000) { tok = await getAccessToken(); tokAt = Date.now(); }
    const r = await fetch(BASE + p, { method, headers: { Authorization: 'Bearer ' + tok, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 && retry < 1) { tok = null; return api(method, p, body, retry + 1); }
    if ((r.status === 429 || r.status >= 500) && retry < 3) { await new Promise((z) => setTimeout(z, 1500 * (retry + 1))); return api(method, p, body, retry + 1); }
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((j.error && (j.error.message || j.error)) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  }
  const cal = () => '/calendars/' + enc(st.calendar || 'primary');

  // ── Google → CRM ──
  function applyRemote(g) {
    const mine = db.eventByGid(g.id);
    if (g.status === 'cancelled') { if (mine) { db.deleteEvent(mine.id, { remote: true }); st.counts.deleted++; } return; }
    if (!g.start) return;
    const link = { cal: st.calendar, id: g.id, updated: g.updated };
    if (!mine) {
      const rid = g.extendedProperties && g.extendedProperties.private && g.extendedProperties.private.reynov_event;
      const ex = rid ? db.eventById(rid) : null;                                   // notre événement dont le lien n'a pas été enregistré
      if (ex && !ex.g) { db.setEventLink(ex.id, link); return; }
      const lid = g.extendedProperties && g.extendedProperties.private && Number(g.extendedProperties.private.reynov_lead);
      db.createEvent({ ...fromGoogle(g), lead_id: lid || null, g: link }, { remote: true });
      st.counts.pulled++; return;
    }
    if (mine.g.updated === g.updated) return;                                      // écho de notre propre envoi
    if (mine.dirty && Date.parse(mine.updated_at) > Date.parse(g.updated)) return; // le CRM est plus récent : il sera envoyé
    db.updateEvent(mine.id, fromGoogle(g), { remote: true });
    db.setEventLink(mine.id, link);
    st.counts.pulled++;
  }
  async function pull() {
    for (let attempt = 0; attempt < 2; attempt++) {
      let pageToken = null, next = null;
      try {
        do {
          const qs = st.token
            ? 'syncToken=' + enc(st.token) + '&showDeleted=true'
            : 'timeMin=' + enc(new Date(Date.now() - 60 * DAY).toISOString()) + '&timeMax=' + enc(new Date(Date.now() + 400 * DAY).toISOString());
          const r = await api('GET', cal() + '/events?singleEvents=true&maxResults=250&' + qs + (pageToken ? '&pageToken=' + enc(pageToken) : ''));
          (r.items || []).forEach(applyRemote);
          pageToken = r.nextPageToken || null; if (r.nextSyncToken) next = r.nextSyncToken;
        } while (pageToken);
        st.token = next || st.token; return;
      } catch (e) {
        if (e.status === 410 && attempt === 0) { st.token = null; continue; }      // jeton de synchro périmé : on repart de zéro
        throw e;
      }
    }
  }

  // ── CRM → Google ──
  async function pushDeletes() {
    for (const t of [...db.eventTombs()]) {
      try { await api('DELETE', '/calendars/' + enc(t.cal || st.calendar) + '/events/' + enc(t.id)); st.counts.deleted++; } catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
      db.clearTomb(t.id);
    }
  }
  async function push() {
    for (const e of [...db.allEvents()]) {
      if (!e.dirty && e.g) continue;
      const lead = e.lead_id ? (db.leadById(e.lead_id) || null) : null;
      const body = toGoogle(e, lead);
      let r;
      if (e.g && e.g.id) {
        try { r = await api('PATCH', '/calendars/' + enc(e.g.cal || st.calendar) + '/events/' + enc(e.g.id), body); }
        catch (er) { if (er.status === 404 || er.status === 410) { r = await api('POST', cal() + '/events', body); } else throw er; }
      } else r = await api('POST', cal() + '/events', body);
      db.setEventLink(e.id, { cal: st.calendar, id: r.id, updated: r.updated });
      st.counts.pushed++;
    }
  }

  async function tick() {
    if (!enabled() || running) return;
    running = true;
    try {
      st.last_run = new Date().toISOString();
      await pushDeletes();                // 1) nos suppressions d'abord, sinon la lecture recréerait l'événement
      await pull();                       // 2) ce qui a changé dans Google (la modification la plus récente l'emporte)
      await push();                       // 3) nos créations et modifications
      st.state = 'ok'; st.error = ''; st.last_ok = new Date().toISOString();
    } catch (e) {
      if (e.status === 403 && /insufficient|scope|permission/i.test(e.message)) { st.state = 'scope_missing'; st.error = e.message; }
      else if (e.status === 403 && /not been used|disabled|accessNotConfigured/i.test(e.message)) { st.state = 'api_disabled'; st.error = e.message; }
      else if (/invalid_grant|Token error/i.test(e.message)) { st.state = 'token_error'; st.error = e.message.slice(0, 200); }
      else { st.state = 'error'; st.error = e.message; }
      if (!['scope_missing', 'api_disabled'].includes(st.state)) console.error('⚠️ calsync:', e.message);
    } finally { persist(); running = false; schedule(); }
  }

  function schedule() {
    clearTimeout(timer);
    const slow = ['scope_missing', 'api_disabled', 'token_error'].includes(st.state);
    timer = setTimeout(() => tick(), slow ? 60 * 60 * 1000 : TICK_MS);
    timer.unref && timer.unref();
  }
  // Une modification dans le CRM part vers Google après 2 secondes (regroupe les changements successifs)
  function kick() {
    if (!enabled()) return;
    clearTimeout(push_timer);
    push_timer = setTimeout(() => tick(), 2000);
    push_timer.unref && push_timer.unref();
  }
  function start() {
    db.onEventChange(kick);
    if (!enabled()) return;
    timer = setTimeout(() => tick(), 30 * 1000);
    timer.unref && timer.unref();
  }

  async function calendars() {
    const r = await api('GET', '/users/me/calendarList?minAccessRole=writer&maxResults=100');
    return (r.items || []).map((c) => ({ id: c.id, name: c.summaryOverride || c.summary, primary: !!c.primary }));
  }
  async function select(id) {
    const list = await calendars();
    const c = list.find((x) => x.id === id);
    if (!c) { const e = new Error('Agenda introuvable ou sans droit d\'écriture.'); e.status = 400; throw e; }
    if (st.calendar !== id) { st.calendar = id; st.calendar_name = c.name; st.token = null; persist(); kick(); }
    return c;
  }
  function status() {
    return { enabled: enabled(), state: running ? 'running' : st.state, error: st.error, calendar: st.calendar, calendar_name: st.calendar_name, last_run: st.last_run, last_ok: st.last_ok, counts: st.counts, pending: db.allEvents().filter((e) => e.dirty || !e.g).length + db.eventTombs().length };
  }
  return { start, tick, status, calendars, select, kick, applyRemote, toGoogle, fromGoogle };
}

module.exports = { create, toGoogle, fromGoogle };
