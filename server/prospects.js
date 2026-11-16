// Prospection : démarchage des professionnels (carrosseries, reconditionnement, concessions, vendeurs d'occasion, loueurs).
// Ce module ne fait que NETTOYER, DÉDOUBLONNER, FILTRER et CALCULER : le stockage est dans db.js, les routes dans index.js.
// Toutes les données importées viennent de sources externes (SIRENE, OpenStreetMap) : tout est nettoyé ici avant d'être stocké,
// et l'interface échappe tout ce qu'elle affiche.
const DAY = 86400000;

const SEGMENTS = { carrosserie: 'Carrosserie', reconditionnement: 'Reconditionnement / detailing', concession: 'Concession', vendeur_vo: 'Vendeur d\'occasion', location: 'Location', autre: 'Autre' };
const RELATIONS = { cible: 'Cible', en_discussion: 'En discussion', a_deja_travaille: 'A déjà travaillé', partenaire_actif: 'Partenaire actif', refus: 'Refus', ne_pas_contacter: 'Ne pas contacter' };
const STATUSES = { a_contacter: 'À contacter', contacte: 'Contacté', a_rappeler: 'À rappeler', rdv_pris: 'Rendez-vous pris', essai_en_cours: 'Essai en cours', partenaire: 'Partenaire', perdu: 'Perdu' };
const CHANNELS = ['appel', 'sms', 'whatsapp', 'email', 'visite', 'autre'];
const RESULTS = ['pas_de_reponse', 'rappeler', 'interesse', 'refus', 'devis_demande', 'envoye', 'autre'];
const BLOCKED = ['refus', 'ne_pas_contacter'];                         // jamais relancés ni démarchés
const TABS = { cibles: ['cible'], discussion: ['en_discussion'], travaille: ['a_deja_travaille', 'partenaire_actif'], refus: ['refus', 'ne_pas_contacter'] };
const MAX_INTERACTIONS = 300;
const ATELIER = '47 chemin du Pras, 69350 La Mulatière';

// ── Nettoyage ──
const line = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const text = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g, ' ').trim().slice(0, max);
const fold = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(Date.parse(v));
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) && String(v).trim() !== '' ? n : null; };

function email(v) {
  for (const part of String(v || '').split(/[;,\s]+/)) {
    const e = part.replace(/^mailto:/i, '').trim();
    if (e.length <= 200 && /^[^\s@<>"'()\\]+@[^\s@<>"'()\\]+\.[^\s@<>"'()\\]{2,}$/.test(e)) return e.toLowerCase();
  }
  return '';
}
function url(v) {
  let s = line(v, 300); if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : ''; } catch (e) { return ''; }
}
const MAPS_HOSTS = new Set(['www.google.com', 'google.com', 'maps.google.com', 'www.google.fr', 'maps.app.goo.gl', 'goo.gl', 'www.openstreetmap.org', 'openstreetmap.org']);
function mapsUrl(v) {
  const s = url(v); if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' && MAPS_HOSTS.has(u.hostname) ? u.href : ''; } catch (e) { return ''; }
}
// Numéros : « +33 4 78 72 19 20 », « +33478050940 », « 04.78.72.19.20 », plusieurs séparés par « ; » → 1er numéro + autres
function normPhone(s) {
  const raw = String(s || '').replace(/[^\d+]/g, '');
  let d = raw;
  if (d.startsWith('+33')) d = '0' + d.slice(3); else if (d.startsWith('0033')) d = '0' + d.slice(4); else if (/^33\d{9}$/.test(d)) d = '0' + d.slice(2);
  if (/^0\d{9}$/.test(d)) return d.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  const intl = raw.startsWith('00') ? '+' + raw.slice(2) : raw;
  return /^\+\d{8,15}$/.test(intl) ? intl : '';
}
const phones = (v) => String(v || '').split(/[;/,]|\bou\b/i).map(normPhone).filter(Boolean);
const digits = (s) => String(s || '').replace(/\D/g, '');
const phoneKey = (s) => { const d = digits(s); return d.length >= 9 ? d.slice(-9) : ''; };
const telHref = (s) => { const d = String(s || '').replace(/[^\d+]/g, ''); return d.startsWith('0') ? '+33' + d.slice(1) : d; };
const waDigits = (s) => { const d = telHref(s).replace(/^\+/, ''); return /^\d{8,15}$/.test(d) ? d : ''; };
const siret = (v) => { const d = digits(v); return d.length === 14 ? d : ''; };
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const keyOf = (o, v, def) => (Object.prototype.hasOwnProperty.call(o, v) ? v : def);

// Prospect nettoyé à partir d'une ligne d'import (ou d'une saisie) ; null si l'entreprise n'a pas de nom.
function clean(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const name = line(raw.name, 160); if (!name) return null;
  const ph = phones(raw.phone);
  const p = {
    external_id: /^[A-Za-z0-9_.:-]{1,64}$/.test(String(raw.external_id || '')) ? String(raw.external_id) : '',
    segment: keyOf(SEGMENTS, raw.segment, 'autre'), priority: raw.priority === 'A' ? 'A' : 'B',
    name, legal_name: line(raw.legal_name, 200), address: line(raw.address, 200), postcode: line(raw.postcode, 10), city: line(raw.city, 100), zone: line(raw.zone, 80),
    distance_km: (() => { const n = num(raw.distance_km); return n != null && n >= 0 && n < 2000 ? Math.round(n * 10) / 10 : null; })(),
    phone: ph[0] || '', phone_alt: ph.slice(1, 3).join(' ; '),
    website: url(raw.website), email: email(raw.email), brand: line(String(raw.brand || '').replace(/\s*;\s*/g, ', '), 120), employees: line(raw.employees, 30),
    siret: siret(raw.siret), maps_url: mapsUrl(raw.maps_url), source: line(raw.source, 40),
    relation: keyOf(RELATIONS, raw.relation, 'cible'), status: keyOf(STATUSES, raw.status, 'a_contacter'),
  };
  return p;
}

// ── Dédoublonnage : identifiant du fichier, puis SIRET, puis nom + code postal (si les téléphones ne se contredisent pas) ──
function buildIndex(list) {
  const idx = { ext: new Map(), siret: new Map(), np: new Map() };
  for (const p of list) addToIndex(idx, p);
  return idx;
}
function addToIndex(idx, p) {
  if (p.external_id) idx.ext.set(p.external_id, p);
  if (p.siret) idx.siret.set(p.siret, p);
  if (p.postcode) { const k = fold(p.name) + '|' + p.postcode; if (!idx.np.has(k)) idx.np.set(k, []); idx.np.get(k).push(p); }
}
function findDuplicate(idx, c) {
  if (c.external_id && idx.ext.has(c.external_id)) return { p: idx.ext.get(c.external_id), by: 'identifiant' };
  if (c.siret && idx.siret.has(c.siret)) return { p: idx.siret.get(c.siret), by: 'SIRET' };
  if (c.postcode) {
    for (const o of idx.np.get(fold(c.name) + '|' + c.postcode) || []) {
      const a = phoneKey(c.phone), b = phoneKey(o.phone);
      if (!a || !b || a === b) return { p: o, by: 'nom + code postal' };       // deux établissements avec des numéros différents ne sont pas des doublons
    }
  }
  return null;
}
// Empreinte d'un prospect supprimé à sa demande : sans aucune coordonnée, elle empêche seulement le retour de la fiche à l'import suivant.
const fingerprint = (p) => ({ ext: p.external_id || '', siret: p.siret || '', np: p.postcode ? fold(p.name) + '|' + p.postcode : '' });
function isBlocked(blocks, c) {
  return (blocks || []).some((b) => (b.ext && b.ext === c.external_id) || (b.siret && b.siret === c.siret) || (b.np && c.postcode && b.np === fold(c.name) + '|' + c.postcode));
}
const FILL = ['external_id', 'legal_name', 'address', 'postcode', 'city', 'zone', 'distance_km', 'phone', 'phone_alt', 'website', 'email', 'brand', 'employees', 'siret', 'maps_url', 'source'];
// Un ré-import complète seulement les champs vides : jamais d'écrasement de ce que vous avez saisi.
function fillEmpty(existing, c) {
  const changed = [];
  for (const k of FILL) {
    const cur = existing[k], inc = c[k];
    if ((cur === '' || cur == null) && inc !== '' && inc != null) { existing[k] = inc; changed.push(k); }
  }
  return changed;
}
// Calcule le résultat d'un import SANS rien écrire :
//  add = nouveaux prospects nettoyés ; complete = fiches existantes dont des champs VIDES seraient complétés ({ id, name, patch, changed }) ;
//  duplicates = lignes ignorées car déjà présentes ; skipped = lignes inutilisables ; blocked = entreprises supprimées à leur demande.
function planImport(existing, items, blocks) {
  const idx = buildIndex(existing);
  const out = { add: [], complete: [], duplicates: [], skipped: [], blocked: 0 };
  const added = new Set(), touched = new Map();
  for (let i = 0; i < items.length; i++) {
    const c = clean(items[i]);
    if (!c) { out.skipped.push({ row: i + 1, reason: 'sans nom' }); continue; }
    if (isBlocked(blocks, c)) { out.blocked++; continue; }
    const d = findDuplicate(idx, c);
    if (d) {
      out.duplicates.push({ row: i + 1, name: c.name, city: c.city, by: d.by });
      if (added.has(d.p)) { fillEmpty(d.p, c); continue; }                   // doublon dans le même fichier : on complète la ligne déjà prévue
      const t = touched.get(d.p) || { id: d.p.id, name: d.p.name, patch: {}, changed: [] };
      const merged = { ...d.p, ...t.patch };
      fillEmpty(merged, c).forEach((k) => { t.patch[k] = merged[k]; if (!t.changed.includes(k)) t.changed.push(k); });
      if (t.changed.length) touched.set(d.p, t);
      continue;
    }
    out.add.push(c); added.add(c); addToIndex(idx, c);
  }
  out.complete = [...touched.values()];
  return out;
}

// ── Valeurs dérivées ──
const parisDay = (d) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
const isBlockedRel = (p) => BLOCKED.includes(p.relation);
const isDue = (p, now) => !!p.next_at && !isBlockedRel(p) && !['perdu', 'partenaire'].includes(p.status) && p.next_at <= parisDay(now || Date.now());
const mapsLink = (p) => p.maps_url || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([p.name, p.address, p.postcode, p.city].filter(Boolean).join(' '));
const routeLink = (p) => 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(ATELIER) + '&destination=' + encodeURIComponent([p.address, p.postcode, p.city].filter(Boolean).join(' ') || [p.name, p.city].filter(Boolean).join(' '));
const bestPhone = (p) => p.contact_phone || p.phone || '';
const bestEmail = (p) => p.contact_email || p.email || '';
const lastInteraction = (p) => (p.interactions && p.interactions.length ? p.interactions[p.interactions.length - 1] : null);

// Vue allégée pour les listes (sans l'historique complet)
function slim(p, now) {
  const { interactions, ...rest } = p; const li = lastInteraction(p);
  return { ...rest, interactions_count: (interactions || []).length, last_interaction: li ? { ts: li.ts, channel: li.channel, result: li.result } : null, due: isDue(p, now), blocked: isBlockedRel(p), maps_link: mapsLink(p), route_link: routeLink(p) };
}
function full(p, now) { const s = slim(p, now); s.interactions = (p.interactions || []).slice().reverse(); return s; }

// ── Filtres, tri, pagination ──
function matches(p, q, now) {
  if (q.tab && TABS[q.tab] && !TABS[q.tab].includes(p.relation)) return false;
  if (q.relation && !String(q.relation).split(',').includes(p.relation)) return false;
  if (q.status && !String(q.status).split(',').includes(p.status)) return false;
  if (q.segment && p.segment !== q.segment) return false;
  if (q.priority && p.priority !== q.priority) return false;
  if (q.zone && p.zone !== q.zone) return false;
  if (q.assigned_to && String(p.assigned_to || '') !== String(q.assigned_to)) return false;
  if (q.ville && !fold(p.city).includes(fold(q.ville))) return false;
  const hasTel = !!(p.phone || p.contact_phone), hasMail = !!(p.email || p.contact_email);
  if (q.tel === 'avec' && !hasTel) return false; if (q.tel === 'sans' && hasTel) return false;
  if (q.mail === 'avec' && !hasMail) return false; if (q.mail === 'sans' && hasMail) return false;
  if (q.due === '1' && !isDue(p, now)) return false;
  if (q.q) {
    const n = fold(q.q), d = digits(q.q);
    const hay = fold([p.name, p.legal_name, p.city, p.brand, p.email, p.contact_name, p.contact_email, p.siret, p.address, p.notes, (p.tags || []).join(' ')].join(' '));
    const ph = digits([p.phone, p.phone_alt, p.contact_phone].join(' '));
    if (!(n && hay.includes(n)) && !(d.length >= 3 && ph.includes(d))) return false;
  }
  return true;
}
const prio = (p) => (p.priority === 'A' ? 0 : 1);
const dist = (p) => (p.distance_km == null ? 9999 : p.distance_km);
const SORTS = {
  priority: (a, b) => prio(a) - prio(b) || dist(a) - dist(b) || a.id - b.id,
  distance: (a, b) => dist(a) - dist(b) || a.id - b.id,
  name: (a, b) => fold(a.name).localeCompare(fold(b.name)) || a.id - b.id,
  recent: (a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || b.id - a.id,
  contact: (a, b) => String(b.last_contact_at || '').localeCompare(String(a.last_contact_at || '')) || a.id - b.id,
  next: (a, b) => (a.next_at || '9999').localeCompare(b.next_at || '9999') || prio(a) - prio(b) || a.id - b.id,
};
function select(list, q, now) {
  q = q || {};
  const rows = list.filter((p) => matches(p, q, now));
  rows.sort(SORTS[q.sort] || SORTS.priority);
  return rows;
}
function query(list, q, now) {
  q = q || {};
  const rows = select(list, q, now);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 50)), offset = Math.max(0, parseInt(q.offset, 10) || 0);
  return { total: rows.length, items: rows.slice(offset, offset + limit).map((p) => slim(p, now)) };
}

// ── Historique et automatismes ──
const addDays = (n, now) => parisDay((now || Date.now()) + n * DAY);
// Ajoute un échange à la fiche et applique les conséquences évidentes (renvoie la liste des changements pour l'afficher).
function applyInteraction(p, raw, now, by) {
  now = now || Date.now(); const changes = [];
  const it = {
    id: (p.interactions || []).reduce((m, x) => Math.max(m, x.id || 0), 0) + 1, ts: new Date(now).toISOString(),
    channel: oneOf(raw.channel, CHANNELS, 'autre'), result: oneOf(raw.result, RESULTS, 'autre'), note: text(raw.note, 1000), by: line(by, 60),
  };
  p.interactions = (p.interactions || []).concat(it).slice(-MAX_INTERACTIONS);
  p.last_contact_at = it.ts;
  if (p.status === 'a_contacter') { p.status = 'contacte'; changes.push('Statut : Contacté'); }
  const nextAt = isDate(raw.next_at) ? raw.next_at : '';
  if (it.result === 'rappeler') {
    p.status = 'a_rappeler'; p.next_at = nextAt || addDays(2, now); p.next_action = text(raw.next_action, 200) || p.next_action || 'Rappeler';
    changes.push('À rappeler le ' + p.next_at.split('-').reverse().join('/'));
  } else if (nextAt) { p.next_at = nextAt; if (raw.next_action !== undefined) p.next_action = text(raw.next_action, 200); changes.push('Rappel le ' + nextAt.split('-').reverse().join('/')); }
  if ((it.result === 'interesse' || it.result === 'devis_demande') && p.relation === 'cible') { p.relation = 'en_discussion'; changes.push('Relation : En discussion'); }
  if (it.result === 'refus' && !BLOCKED.includes(p.relation)) { p.relation = 'refus'; p.status = 'perdu'; p.next_at = ''; p.next_action = ''; changes.push('Relation : Refus (plus de relance)'); }
  p.updated_at = it.ts;
  return { interaction: it, changes };
}

// Champs modifiables à la main
function cleanPatch(b) {
  const o = {}; b = b || {};
  const L = { name: 160, legal_name: 200, address: 200, postcode: 10, city: 100, zone: 80, brand: 120, employees: 30, contact_name: 100, contact_role: 100, next_action: 200 };
  for (const [k, max] of Object.entries(L)) if (b[k] !== undefined) o[k] = line(b[k], max);
  if (o.name === '') delete o.name;
  if (b.phone !== undefined) { const ph = phones(b.phone); o.phone = ph[0] || ''; if (b.phone_alt === undefined && ph.length > 1) o.phone_alt = ph.slice(1, 3).join(' ; '); }
  if (b.phone_alt !== undefined) o.phone_alt = phones(b.phone_alt).slice(0, 3).join(' ; ');
  if (b.contact_phone !== undefined) o.contact_phone = phones(b.contact_phone)[0] || '';
  if (b.contact_whatsapp !== undefined) o.contact_whatsapp = phones(b.contact_whatsapp)[0] || '';
  if (b.email !== undefined) o.email = email(b.email);
  if (b.contact_email !== undefined) o.contact_email = email(b.contact_email);
  if (b.website !== undefined) o.website = url(b.website);
  if (b.maps_url !== undefined) o.maps_url = mapsUrl(b.maps_url);
  if (b.siret !== undefined) o.siret = siret(b.siret);
  if (b.notes !== undefined) o.notes = text(b.notes, 4000);
  if (b.offer !== undefined) o.offer = text(b.offer, 1000);
  if (b.tags !== undefined) o.tags = (Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(',')).map((t) => line(t, 30)).filter(Boolean).slice(0, 12);
  if (b.segment !== undefined) o.segment = keyOf(SEGMENTS, b.segment, 'autre');
  if (b.priority !== undefined) o.priority = b.priority === 'A' ? 'A' : 'B';
  if (b.relation !== undefined && RELATIONS[b.relation]) o.relation = b.relation;
  if (b.status !== undefined && STATUSES[b.status]) o.status = b.status;
  if (b.next_at !== undefined) o.next_at = isDate(b.next_at) ? b.next_at : '';
  if (b.assigned_to !== undefined) o.assigned_to = b.assigned_to ? Number(b.assigned_to) || null : null;
  if (b.client_id !== undefined) o.client_id = b.client_id ? Number(b.client_id) || null : null;
  if (b.distance_km !== undefined) { const n = num(b.distance_km); o.distance_km = n != null && n >= 0 && n < 2000 ? n : null; }
  if (o.relation && BLOCKED.includes(o.relation)) { o.next_at = ''; o.next_action = ''; }      // un refus n'est jamais relancé
  return o;
}

// ── Statistiques ──
function stats(list, now) {
  now = now || Date.now();
  const o = { total: list.length, by_relation: {}, by_status: {}, by_segment: {}, tabs: {}, zones: [], with_phone: 0, without_phone: 0, with_email: 0, due: 0, week: { contacts: 0, prospects: 0 }, response: { answered: 0, contacted: 0, rate: null }, partners: 0, funnel: {} };
  Object.keys(RELATIONS).forEach((k) => { o.by_relation[k] = 0; }); Object.keys(STATUSES).forEach((k) => { o.by_status[k] = 0; }); Object.keys(SEGMENTS).forEach((k) => { o.by_segment[k] = 0; });
  Object.keys(TABS).forEach((k) => { o.tabs[k] = 0; });
  const zones = new Map(), since = now - 7 * DAY;
  for (const p of list) {
    o.by_relation[p.relation]++; o.by_status[p.status]++; o.by_segment[p.segment]++;
    for (const [t, rels] of Object.entries(TABS)) if (rels.includes(p.relation)) o.tabs[t]++;
    if (p.phone || p.contact_phone) o.with_phone++; else o.without_phone++;
    if (p.email || p.contact_email) o.with_email++;
    if (isDue(p, now)) o.due++;
    if (p.relation === 'partenaire_actif' || p.status === 'partenaire') o.partners++;
    if (p.zone) { const z = zones.get(p.zone) || { zone: p.zone, n: 0, km: p.distance_km == null ? 999 : p.distance_km }; z.n++; if (p.distance_km != null) z.km = Math.min(z.km, p.distance_km); zones.set(p.zone, z); }
    const its = p.interactions || [];
    const recent = its.filter((i) => Date.parse(i.ts) > since);
    o.week.contacts += recent.length; if (recent.length) o.week.prospects++;
    if (its.some((i) => ['appel', 'sms', 'whatsapp', 'email', 'visite'].includes(i.channel))) {
      o.response.contacted++;
      if (its.some((i) => ['rappeler', 'interesse', 'refus', 'devis_demande'].includes(i.result))) o.response.answered++;
    }
  }
  o.response.rate = o.response.contacted ? Math.round(o.response.answered / o.response.contacted * 100) : null;
  o.zones = [...zones.values()].sort((a, b) => a.km - b.km || b.n - a.n);
  const S = o.by_status;
  o.funnel = { a_contacter: S.a_contacter, contactes: S.contacte + S.a_rappeler, rdv: S.rdv_pris + S.essai_en_cours, partenaires: o.partners };
  return o;
}

// ── Export CSV (Excel : point-virgule, UTF-8 avec BOM) ──
const CSV_COLS = [
  ['ID', (p) => p.id], ['Entreprise', (p) => p.name], ['Raison sociale', (p) => p.legal_name], ['Segment', (p) => SEGMENTS[p.segment]], ['Priorité', (p) => p.priority],
  ['Relation', (p) => RELATIONS[p.relation]], ['Statut', (p) => STATUSES[p.status]], ['Adresse', (p) => p.address], ['Code postal', (p) => p.postcode], ['Ville', (p) => p.city],
  ['Zone', (p) => p.zone], ['Distance (km)', (p) => (p.distance_km == null ? '' : String(p.distance_km).replace('.', ','))], ['Téléphone', (p) => p.phone], ['Autre téléphone', (p) => p.phone_alt],
  ['E-mail', (p) => p.email], ['Site', (p) => p.website], ['Marques', (p) => p.brand], ['Effectif', (p) => p.employees], ['SIRET', (p) => p.siret],
  ['Contact', (p) => p.contact_name], ['Fonction', (p) => p.contact_role], ['Téléphone direct', (p) => p.contact_phone], ['E-mail direct', (p) => p.contact_email], ['WhatsApp', (p) => p.contact_whatsapp],
  ['Dernier contact', (p) => (p.last_contact_at ? p.last_contact_at.slice(0, 10) : '')], ['Prochaine action', (p) => p.next_action], ['Date de rappel', (p) => p.next_at], ['Responsable', (p, ctx) => (p.assigned_to && ctx && ctx.userName ? ctx.userName(p.assigned_to) : '')],
  ['Offre / conditions', (p) => p.offer], ['Notes', (p) => p.notes], ['Étiquettes', (p) => (p.tags || []).join(', ')], ['Source', (p) => p.source],
];
function csvCell(v) {
  let s = v == null ? '' : String(v).replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(s) && !/^\+?[\d ]+$/.test(s)) s = "'" + s;        // une cellule qui commencerait par = + - @ serait lue comme une formule par Excel
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(list, ctx) {
  return '\uFEFF' + [CSV_COLS.map((c) => csvCell(c[0])).join(';')].concat(list.map((p) => CSV_COLS.map((c) => csvCell(c[1](p, ctx))).join(';'))).join('\r\n') + '\r\n';
}

// ── Messages types par segment (jamais envoyés tout seuls : copiés, ouverts dans WhatsApp ou l'e-mail, après relecture) ──
const PARTNER_PAGE = { carrosserie: 'carrosseries', reconditionnement: 'centres-reconditionnement', concession: 'concessions-automobiles', vendeur_vo: 'marchands-vo', location: 'loueurs-flottes' };
const partnerUrl = (segment, medium) => 'https://www.reynov-jantes.fr/professionnels' + (PARTNER_PAGE[segment] ? '/' + PARTNER_PAGE[segment] + '.html' : '.html') + '?utm_source=prospection&utm_medium=' + (medium || 'message') + '&utm_campaign=' + (segment || 'autre');
const INTRO = 'Chams de REYNOV, spécialiste de la rénovation de jantes à Lyon.';
const PITCH = {
  carrosserie: { subject: 'Jantes abîmées : REYNOV intervient pour vos clients', title: 'Des jantes abîmées chez vos clients ?', body: 'Quand vos clients ont des jantes abîmées, nous les récupérons ou intervenons chez vous, avec diagnostic offert et garantie satisfaction 30 jours.', ask: 'Puis-je vous passer quelques photos de nos réalisations ?' },
  reconditionnement: { subject: 'Rénovation de jantes pour vos véhicules : REYNOV', title: 'Une offre jantes pour vos clients', body: 'Nous rénovons les jantes (matière arrachée, bordures abîmées) à Lyon.', ask: 'Intéressé pour proposer ce service à vos clients, ou nous confier les jantes de vos véhicules ?' },
  concession: { subject: 'Jantes de vos véhicules en préparation : REYNOV', title: 'Des jantes remises en état, sans les remplacer', body: 'Nous faisons de la rénovation de jantes à domicile ou en atelier à Lyon. Pour vos véhicules en préparation (reprises, retours de leasing), nous remettons les jantes en état sans les remplacer.', ask: 'Qui s\'occupe de la préparation chez vous ?' },
  vendeur_vo: { subject: 'Jantes de vos véhicules d\'occasion : REYNOV', title: 'Des jantes nettes avant la vente', body: 'Nous rénovons les jantes de véhicules d\'occasion avant la vente, directement chez vous ou en atelier.', ask: 'Je peux vous envoyer un exemple avant/après ?' },
  location: { subject: 'Jantes bordurées sur vos véhicules : REYNOV', title: 'Jantes bordurées : évitez le remplacement', body: 'Pour vos véhicules rentrés avec des jantes bordurées, nous intervenons sur site ou en atelier et vous évitez le remplacement.', ask: 'Qui gère la remise en état de la flotte ?' },
  autre: { subject: 'Rénovation de jantes à Lyon : REYNOV', title: 'Rénovation de jantes à Lyon', body: 'Nous rénovons les jantes des véhicules de professionnels (carrosseries, garages, concessions, loueurs), à domicile ou en atelier.', ask: 'Puis-je vous envoyer quelques photos de nos réalisations ?' },
};
// Tarifs professionnels (HT, par jante) : une seule liste, reprise dans l'e-mail de présentation
const PRICES = [
  { label: 'Rénovation couleur simple', ht: 110 },
  { label: 'Rénovation bi-ton', ht: 130 },
  { label: 'Usinage complet, sans ponçage', ht: 70 },
  { label: 'Usinage complet, avec ponçage', ht: 80 },
  { label: 'Dévoilage', ht: 140 },
  { label: 'Jante fissurée (soudure)', ht: 140 },
];
const PRICES_NOTE = 'Tarifs HT par jante. Ils peuvent varier selon la quantité.';
const PERSON = 'Chams';
function pitchFor(p) { return PITCH[p.segment] || PITCH.autre; }
// Texte court (WhatsApp, SMS, copier) : repris de vos messages types
function messageFor(p) {
  if (isBlockedRel(p)) return null;
  const t = pitchFor(p);
  const body = 'Bonjour, ' + INTRO + ' ' + t.body + ' ' + t.ask;
  return { subject: t.subject, text: body + '\n\nNos conditions et tarifs partenaires : ' + partnerUrl(p.segment, 'message'), short: body };
}

module.exports = {
  SEGMENTS, RELATIONS, STATUSES, CHANNELS, RESULTS, BLOCKED, TABS, PRICES, PRICES_NOTE, PERSON, ATELIER, MAX_INTERACTIONS,
  clean, cleanPatch, planImport, fingerprint, isBlocked, fillEmpty, buildIndex, findDuplicate,
  slim, full, select, query, stats, toCsv, csvCell, applyInteraction, isDue, isBlockedRel, parisDay, addDays,
  messageFor, pitchFor, partnerUrl, mapsLink, routeLink, bestPhone, bestEmail,
  normPhone, phones, phoneKey, telHref, waDigits, email, url, mapsUrl, fold, line, text,
};
