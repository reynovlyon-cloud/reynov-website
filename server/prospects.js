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
const TABS = { cibles: ['cible'], premier: ['cible'], discussion: ['en_discussion'], travaille: ['a_deja_travaille', 'partenaire_actif'], refus: ['refus', 'ne_pas_contacter'] };
const MAX_INTERACTIONS = 300;
const ATELIER = '47 chemin du Pras, 69350 La Mulatière';

// ── Nettoyage ──
const line = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const text = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g, ' ').trim().slice(0, max);
const fold = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(Date.parse(v));
const num = (v) => { if (v == null) return null; const t = String(v).trim().replace(',', '.'); if (t === '') return null; const n = Number(t); return isFinite(n) ? n : null; };      // une valeur absente reste vide (et non 0)

function email(v) {
  for (const part of String(v || '').split(/[;,\s]+/)) {
    const e = part.replace(/^mailto:/i, '').trim();
    // adresse ASCII uniquement : une adresse avec accent est presque toujours une faute de saisie et ne serait jamais livrée
    if (e.length <= 200 && /^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(e)) return e.toLowerCase();
  }
  return '';
}
function url(v) {
  let s = line(String(v == null ? '' : v).replace(/&amp;/gi, '&'), 300); if (!s) return '';
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
const prio3 = (v) => { const s = String(v == null ? '' : v).trim().toUpperCase(); return s === 'A' || s === 'C' ? s : 'B'; };
const km = (v) => { const n = num(v); return n != null && n >= 0 && n < 2000 ? Math.round(n * 10) / 10 : null; };
const geo = (v, lo, hi) => { const n = num(v); return n != null && n >= lo && n <= hi ? Math.round(n * 1e5) / 1e5 : null; };
// ── Zones (ordre fixe) et communes ──
const ZONES = [
  { code: 'lyon_villeurbanne', label: 'Lyon et Villeurbanne' },
  { code: 'ouest_monts_dor', label: 'Ouest lyonnais et Monts d’Or' },
  { code: 'nord_val_de_saone', label: 'Nord lyonnais et Val de Saône' },
  { code: 'est_nord_est', label: 'Est et Nord-Est lyonnais' },
  { code: 'sud_est', label: 'Sud-Est lyonnais' },
  { code: 'sud', label: 'Sud lyonnais' },
  { code: 'sud_ouest', label: 'Sud-Ouest lyonnais' },
];
const ZONE_BY_CODE = {}; ZONES.forEach((z, i) => { z.i = i; ZONE_BY_CODE[z.code] = z; });
const NO_ZONE = { code: '', label: 'Hors zones (à classer)', i: 99 };
const zoneCode = (v) => { const c = String(v == null ? '' : v).trim(); return Object.prototype.hasOwnProperty.call(ZONE_BY_CODE, c) ? c : ''; };
const zoneFromLabel = (v) => { const f = fold(v); const z = f && ZONES.find((x) => fold(x.label) === f); return z ? z.code : ''; };
// « Lyon 3Eme », « St Priest », « Décines-Charpieu » / « Decines Charpieu » : une seule commune
const communeKey = (c) => { let k = fold(c); if (/^lyon( \d{1,2}( ?(er|e|eme))?)?( arrondissement| arr)?( cedex( \d{1,2})?)?$/.test(k)) k = 'lyon'; return k.replace(/^st /, 'saint ').replace(/^ste /, 'sainte '); };
const toBool = (v) => v === true || v === 1 || /^(1|true|oui|on|yes)$/i.test(String(v == null ? '' : v).trim());
const isoOrEmpty = (v) => { const t = String(v == null ? '' : v).trim(); return /^\d{4}-\d{2}-\d{2}/.test(t) && !isNaN(Date.parse(t)) ? new Date(t).toISOString() : ''; };
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const keyOf = (o, v, def) => (Object.prototype.hasOwnProperty.call(o, v) ? v : def);

// Prospect nettoyé à partir d'une ligne d'import (ou d'une saisie) ; null si l'entreprise n'a pas de nom.
function clean(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const name = line(raw.name, 160); if (!name) return null;
  const ph = phones(raw.phone);
  const zc = zoneCode(raw.zone_code) || zoneFromLabel(raw.zone);
  const st = String(raw.prospection_status == null ? '' : raw.prospection_status).trim();
  const p = {
    external_id: /^[A-Za-z0-9_.:-]{1,64}$/.test(String(raw.external_id || '')) ? String(raw.external_id) : '',
    segment: keyOf(SEGMENTS, raw.segment, 'autre'), priority: prio3(raw.priority),
    name, legal_name: line(raw.legal_name, 200), address: line(raw.address, 200), postcode: line(raw.postcode, 10), city: line(raw.city, 100), zone: zc ? ZONE_BY_CODE[zc].label : line(raw.zone, 80), zone_code: zc,
    distance_km: km(raw.distance_km), distance_atelier_km: km(raw.distance_atelier_km),
    phone: ph[0] || '', phone_alt: ph.slice(1, 3).join(' ; '),
    website: url(raw.website), email: email(raw.email), brand: line(String(raw.brand || '').replace(/\s*;\s*/g, ', '), 120), employees: line(raw.employees, 30),
    siret: siret(raw.siret), maps_url: mapsUrl(raw.maps_url), source: line(raw.source, 40),
    relation: keyOf(RELATIONS, raw.relation, 'cible'), status: keyOf(STATUSES, raw.status, 'a_contacter'),
    prospected: toBool(raw.prospected) || (st !== '' && st !== 'non_prospecte'), first_contacted_at: isoOrEmpty(raw.first_contacted_at),
    // informations du fichier d'import, en lecture seule dans la fiche (elles ne remplacent jamais ce que vous saisissez)
    group: line(raw.group, 120), volume: line(raw.volume_estimate || raw.volume, 120), justification: line(raw.justification, 500), angle: line(raw.commercial_angle || raw.angle, 400),
    decision_maker: line(raw.decision_maker, 200), inhouse: (() => { const v = line(raw.wheel_workshop_inhouse || raw.inhouse, 200); return /^(non|no|false|0)\b/i.test(v) ? '' : v; })(), contact_page: url(raw.contact_page),
    lat: geo(raw.lat, -90, 90), lon: geo(raw.lon, -180, 180), verified_at: isDate(raw.verified_at) ? String(raw.verified_at) : '',
    sources: (Array.isArray(raw.sources) ? raw.sources : []).map(url).filter((u, i, a) => u && a.indexOf(u) === i).slice(0, 6),
  };
  return p;
}

// ── Dédoublonnage : identifiant du fichier, puis SIRET, puis nom + code postal (si les téléphones ne se contredisent pas) ──
function buildIndex(list) {
  const idx = { ext: new Map(), siret: new Map(), np: new Map(), nm: new Map() };
  for (const p of list) addToIndex(idx, p);
  return idx;
}
function addToIndex(idx, p) {
  if (p.external_id) idx.ext.set(p.external_id, p);
  if (p.siret) idx.siret.set(p.siret, p);
  if (p.postcode) { const k = fold(p.name) + '|' + p.postcode; if (!idx.np.has(k)) idx.np.set(k, []); idx.np.get(k).push(p); }
  const n = fold(p.name); if (n) { if (!idx.nm.has(n)) idx.nm.set(n, []); idx.nm.get(n).push(p); }
}
// Distance à vol d'oiseau (km) quand les deux fiches ont des coordonnées ; au-delà de 2 km ce ne sont pas les mêmes lieux
function far(a, b) {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return false;
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h)) > 2;
}
function findDuplicate(idx, c) {
  if (c.external_id && idx.ext.has(c.external_id)) return { p: idx.ext.get(c.external_id), by: 'identifiant' };
  if (c.siret && idx.siret.has(c.siret)) return { p: idx.siret.get(c.siret), by: 'SIRET' };
  if (c.postcode) {
    for (const o of idx.np.get(fold(c.name) + '|' + c.postcode) || []) {
      if (c.siret && o.siret && c.siret !== o.siret) continue;          // deux SIRET différents : deux établissements distincts, même s'ils portent le même nom
      if (far(c, o)) continue;                                          // deux adresses éloignées : deux établissements, même nom et même code postal
      const a = phoneKey(c.phone), b = phoneKey(o.phone);
      if (!a || !b || a === b) return { p: o, by: 'nom + code postal' };       // deux établissements avec des numéros différents ne sont pas des doublons
    }
  }
  // Fiche sans code postal (anciennes listes) : même nom et même téléphone, ou nom unique sans téléphone contradictoire
  const cands = (idx.nm.get(fold(c.name)) || []).filter((o) => !(c.siret && o.siret && c.siret !== o.siret));
  const a = phoneKey(c.phone), postOk = (o) => !c.postcode || !o.postcode || c.postcode === o.postcode;
  if (a) { const o = cands.find((x) => phoneKey(x.phone) === a && postOk(x)); if (o) return { p: o, by: 'nom + téléphone' }; }
  // Même nom, code postal manquant d'un côté, et même distance depuis l'atelier (à 200 m près) : c'est le même lieu.
  // (Un nom seul ne suffit pas : « Fiat », « Avis », « Ada »… existent à plusieurs endroits.)
  const near = cands.filter((o) => (!c.postcode || !o.postcode) && kmOf(c) != null && kmOf(o) != null && Math.abs(kmOf(c) - kmOf(o)) <= 0.2 && (!a || !phoneKey(o.phone) || a === phoneKey(o.phone)));
  if (near.length === 1) return { p: near[0], by: 'nom + distance' };
  return null;
}
// Empreinte d'un prospect supprimé à sa demande : sans aucune coordonnée, elle empêche seulement le retour de la fiche à l'import suivant.
const fingerprint = (p) => ({ ext: p.external_id || '', siret: p.siret || '', np: p.postcode ? fold(p.name) + '|' + p.postcode : '' });
function isBlocked(blocks, c) {
  return (blocks || []).some((b) => (b.ext && b.ext === c.external_id) || (b.siret && b.siret === c.siret) || (b.np && c.postcode && b.np === fold(c.name) + '|' + c.postcode));
}
// Champs que vous pouvez modifier : un ré-import les complète seulement s'ils sont vides, jamais d'écrasement.
const FILL = ['external_id', 'legal_name', 'address', 'postcode', 'city', 'zone', 'phone', 'phone_alt', 'website', 'email', 'brand', 'employees', 'siret', 'maps_url', 'source'];
// Informations fournies par le fichier (en lecture seule dans la fiche) : le fichier le plus récent les met à jour.
const REFRESH = ['distance_km', 'distance_atelier_km', 'group', 'volume', 'justification', 'angle', 'decision_maker', 'inhouse', 'contact_page', 'lat', 'lon', 'verified_at', 'sources'];
const blank = (v) => v === '' || v == null || (Array.isArray(v) && !v.length);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// opt.refresh : met aussi à jour la zone et les informations du fichier ; opt.priority : la priorité du fichier remplace l'ancienne
// (sauf si vous l'avez changée vous-même). Renvoie la liste des champs modifiés.
function fillEmpty(existing, c, opt) {
  opt = opt || {}; const changed = [];
  for (const k of FILL) if (blank(existing[k]) && !blank(c[k])) { existing[k] = c[k]; changed.push(k); }
  if (opt.refresh) {
    for (const k of REFRESH) if (!blank(c[k]) && !same(existing[k], c[k])) { existing[k] = c[k]; changed.push(k); }
    if (c.zone_code && !existing.zone_manual && existing.zone_code !== c.zone_code) { existing.zone_code = c.zone_code; existing.zone = c.zone; changed.push('zone', 'zone_code'); }
    if (opt.priority && !existing.priority_manual && c.priority && existing.priority !== c.priority) { existing.priority = c.priority; changed.push('priority'); }
  }
  return changed;
}
// Calcule le résultat d'un import SANS rien écrire :
//  add = nouveaux prospects nettoyés ; complete = fiches existantes dont des champs VIDES seraient complétés ({ id, name, patch, changed }) ;
//  duplicates = lignes ignorées car déjà présentes ; skipped = lignes inutilisables ; blocked = entreprises supprimées à leur demande.
function planImport(existing, items, blocks) {
  const idx = buildIndex(existing);
  const out = { add: [], complete: [], duplicates: [], skipped: [], blocked: 0, summary: {} };
  const added = new Set(), touched = new Map(), seen = [], refreshed = new Set();
  for (let i = 0; i < items.length; i++) {
    const c = clean(items[i]);
    if (!c) { out.skipped.push({ row: i + 1, reason: 'sans nom' }); continue; }
    seen.push(c);
    if (isBlocked(blocks, c)) { out.blocked++; continue; }
    const d = findDuplicate(idx, c);
    if (d) {
      out.duplicates.push({ row: i + 1, name: c.name, city: c.city, by: d.by });
      if (added.has(d.p)) { fillEmpty(d.p, c); continue; }                   // doublon dans le même fichier : on complète la ligne déjà prévue
      const t = touched.get(d.p) || { id: d.p.id, name: d.p.name, patch: {}, changed: [] };
      const merged = { ...d.p, ...t.patch };
      const given = /^[abc]$/i.test(String((items[i] || {}).priority == null ? '' : items[i].priority).trim());
      const first = !refreshed.has(d.p); refreshed.add(d.p);               // une seule ligne du fichier met la fiche à jour (sinon deux lignes presque identiques la feraient changer à chaque import)
      const older = !!d.p.verified_at && (!c.verified_at || c.verified_at < d.p.verified_at);        // un fichier plus ancien (ex. la 1re liste après la 2e) ne remplace jamais les infos d'un fichier plus récent
      fillEmpty(merged, c, first && !older ? { refresh: true, priority: given } : {}).forEach((k) => { t.patch[k] = merged[k]; if (!t.changed.includes(k)) t.changed.push(k); });
      if (t.changed.length) touched.set(d.p, t);
      continue;
    }
    out.add.push(c); added.add(c); addToIndex(idx, c);
  }
  // Fiches sans zone : celle de leur commune (déduite des autres fiches et du fichier)
  const cx = context(existing.concat(seen));
  for (const c of out.add) if (!c.zone_code) { const z = cx.zone(c); if (z) { c.zone_code = z; c.zone = ZONE_BY_CODE[z].label; } }
  for (const p of existing) {
    const t = touched.get(p);
    if ((t && t.patch.zone_code) || p.zone_code) continue;
    const z = cx.zone(t ? { ...p, ...t.patch } : p); if (!z) continue;
    const tt = t || { id: p.id, name: p.name, patch: {}, changed: [] };
    tt.patch.zone_code = z; tt.patch.zone = ZONE_BY_CODE[z].label; ['zone', 'zone_code'].forEach((k) => { if (!tt.changed.includes(k)) tt.changed.push(k); }); touched.set(p, tt);
  }
  out.complete = [...touched.values()];
  out.complete.forEach((x) => x.changed.forEach((k) => { if (k !== 'zone_code') out.summary[k] = (out.summary[k] || 0) + 1; }));
  return out;
}

// ── Regroupement par commune et par zone ──
// Commune nettoyée (variantes d'écriture), libellé le plus soigné de chaque commune, et zone par défaut d'une commune
// (celle de la majorité des autres fiches) pour les fiches qui n'ont pas de zone.
function context(list) {
  const ck = new Map(), variants = new Map(), zones = new Map(), pcz = new Map();
  for (const p of list) {
    const k = communeKey(p.city); ck.set(p, k);
    if (!variants.has(k)) variants.set(k, new Map());
    const v = variants.get(k), city = line(p.city, 100); v.set(city, (v.get(city) || 0) + 1);
    const z = zoneCode(p.zone_code);
    if (z && k) { if (!zones.has(k)) zones.set(k, new Map()); const m = zones.get(k); m.set(z, (m.get(z) || 0) + 1); }
    if (z && p.postcode) { if (!pcz.has(p.postcode)) pcz.set(p.postcode, new Map()); const m = pcz.get(p.postcode); m.set(z, (m.get(z) || 0) + 1); }
  }
  const labels = new Map();
  for (const [k, v] of variants) {
    if (!k) { labels.set(k, 'Commune non renseignée'); continue; }
    if (k === 'lyon') { labels.set(k, 'Lyon'); continue; }
    let best = '', bs = -1;
    for (const [name, n] of v) { const sc = name.replace(/[\x00-\x7F]/g, '').length * 1000 + n * 10 + (name.includes('-') ? 1 : 0); if (sc > bs) { bs = sc; best = name; } }
    labels.set(k, best);
  }
  const major = (m) => { let b = '', bn = 0; for (const [z, n] of m) if (n > bn) { bn = n; b = z; } return b; };
  const zdef = new Map(), pdef = new Map();
  for (const [k, m] of zones) zdef.set(k, major(m));
  for (const [c, m] of pcz) pdef.set(c, major(m));
  const key = (p) => (ck.has(p) ? ck.get(p) : communeKey(p.city));
  const zone = (p) => zoneCode(p.zone_code) || zdef.get(key(p)) || pdef.get(p.postcode) || '';           // sinon par code postal
  // « Lieu » = commune, ou arrondissement pour Lyon (ex. « Lyon 9e ») : c'est ce qu'on choisit et ce qui regroupe les fiches
  const pk = new Map(), pst = new Map(); let hasArr = false;
  for (const p of list) {
    const k = key(p), a = k === 'lyon' ? arrOf(p) : 0; if (a) hasArr = true;
    const kk = a ? 'lyon-' + a : (k === 'lyon' ? 'lyon-0' : k); pk.set(p, kk);
    const s = pst.get(kk) || { key: kk, ck: k, arr: a, d: [], la: 0, lo: 0, c: 0, n: 0 }; s.n++;
    const d = kmOf(p); if (d != null && isFinite(d)) s.d.push(d);
    const la = num(p.lat), lo = num(p.lon); if (la != null && lo != null) { s.la += la; s.lo += lo; s.c++; }
    pst.set(kk, s);
  }
  for (const s of pst.values()) {
    s.d.sort((x, y) => x - y); s.km = s.d.length ? s.d[Math.floor(s.d.length / 2)] : null; s.rank = s.km == null ? 9999 : s.km;      // distance médiane depuis l'atelier : sert à ranger du plus proche au plus loin
    s.lat = s.c ? Math.round(s.la / s.c * 1e5) / 1e5 : null; s.lon = s.c ? Math.round(s.lo / s.c * 1e5) / 1e5 : null;
    s.label = s.arr ? 'Lyon ' + (s.arr === 1 ? '1er' : s.arr + 'e') : (s.key === 'lyon-0' ? (hasArr ? 'Lyon (arrondissement non précisé)' : 'Lyon') : (labels.get(s.key) || s.key || 'Commune non renseignée'));
  }
  const pkey = (p) => (pk.has(p) ? pk.get(p) : key(p)), pinfo = (k) => pst.get(k) || null;
  return { key, zone, pkey, pinfo, place: (p) => (pinfo(pkey(p)) || { label: line(p.city, 100) }).label, prank: (p) => (pinfo(pkey(p)) || { rank: 9999 }).rank, places: () => [...pst.values()],
    label: (p) => labels.get(key(p)) || line(p.city, 100), zoneLabel: (p) => { const z = zone(p); return z ? ZONE_BY_CODE[z].label : (p.zone || ''); } };
}
// Arrondissement de Lyon (1 à 9) d'une fiche, ou 0 s'il n'est pas connu. Le code postal 69001 est celui que le fichier donne par défaut
// aux fiches « Lyon » sans précision : il ne vaut que s'il est confirmé par la position. Sans position fiable, on ne devine pas.
const ARR_CENTRES = [[1, 45.7676, 4.8330], [2, 45.7522, 4.8280], [3, 45.7540, 4.8720], [4, 45.7793, 4.8280], [5, 45.7590, 4.8040], [6, 45.7700, 4.8530], [7, 45.7370, 4.8420], [8, 45.7320, 4.8700], [9, 45.7790, 4.8010]];
function arrOf(p) {
  const c = /\blyon\s*0?([1-9])\s*(?:er|e|eme)?\b/.exec(fold(p.city)); if (c) return Number(c[1]);
  const pc = /^690(0[1-9])$/.exec(String(p.postcode || '').trim());
  if (pc && pc[1] !== '01') return Number(pc[1]);
  const la = num(p.lat), lo = num(p.lon);
  if (la != null && lo != null && la > 45.70 && la < 45.81 && lo > 4.76 && lo < 4.91) {
    let best = 0, bd = Infinity; for (const [n, a, o] of ARR_CENTRES) { const d = (la - a) ** 2 + ((lo - o) * 0.7) ** 2; if (d < bd) { bd = d; best = n; } }
    return best;
  }
  return 0;
}
// « À appeler en premier » : priorité A, pas encore prospecté, avec un téléphone, encore à démarcher
const isFirst = (p) => p.relation === 'cible' && p.priority === 'A' && !p.prospected && !!(p.phone || p.contact_phone) && !['perdu', 'partenaire'].includes(p.status);

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
// Signaux tirés du registre : à vérifier avant de démarcher (rien n'est bloqué automatiquement)
function alerts(p) {
  const a = [], dm = p.decision_maker || '';
  if (/liquidateur/i.test(dm)) a.push({ k: 'liquidation', short: 'Liquidation ?', text: 'Le registre cite un liquidateur : l\'entreprise est peut-être en liquidation. À vérifier avant de la démarcher.' });
  if (/commissaire aux comptes/i.test(dm)) a.push({ k: 'cac', short: '', text: 'Le registre cite un commissaire aux comptes, pas un dirigeant : le vrai décideur est à trouver.' });
  return a;
}
function slim(p, now, x) {
  const { interactions, justification, angle, sources, lat, lon, ...rest } = p; const li = lastInteraction(p);
  return { ...rest, ...(x || {}), alerts: alerts(p), km: kmOf(p) == null ? null : kmOf(p), interactions_count: (interactions || []).length, last_interaction: li ? { ts: li.ts, channel: li.channel, result: li.result } : null, due: isDue(p, now), blocked: isBlockedRel(p), maps_link: mapsLink(p), route_link: routeLink(p) };
}
function full(p, now, cx) { const s = slim(p, now, cx ? { ckey: cx.key(p), pkey: cx.pkey(p), commune: cx.label(p), place: cx.place(p), zone_code: cx.zone(p), zone: cx.zoneLabel(p) } : null); s.justification = p.justification || ''; s.angle = p.angle || ''; s.sources = p.sources || []; s.interactions = (p.interactions || []).slice().reverse(); return s; }

// ── Filtres, tri, pagination ──
function matches(p, q, now, cx) {
  if (q.tab && TABS[q.tab] && !TABS[q.tab].includes(p.relation)) return false;
  if (q.tab === 'premier' && !isFirst(p)) return false;
  if (q.prospected === 'no' && p.prospected) return false; if (q.prospected === 'yes' && !p.prospected) return false;
  if (cx && q.zone_code) { const z = cx.zone(p); if (q.zone_code === 'none' ? z !== '' : z !== q.zone_code) return false; }
  if (cx && q.commune && cx.key(p) !== q.commune && cx.pkey(p) !== q.commune) return false;           // « lyon » = tous les arrondissements, « lyon-9 » = le 9e seulement
  if (q.relation && !String(q.relation).split(',').includes(p.relation)) return false;
  if (q.status && !String(q.status).split(',').includes(p.status)) return false;
  if (q.segment && p.segment !== q.segment) return false;
  if (q.priority && p.priority !== q.priority) return false;
  if (q.zone && (cx ? cx.zoneLabel(p) : p.zone) !== q.zone) return false;
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
const prio = (p) => ({ A: 0, B: 1, C: 2 }[p.priority] ?? 1);
const kmOf = (p) => (p.distance_atelier_km != null ? p.distance_atelier_km : p.distance_km);          // les trajets partent de l'atelier
const dist = (p) => (kmOf(p) == null ? 9999 : kmOf(p));
const SORTS = {
  priority: (a, b) => prio(a) - prio(b) || dist(a) - dist(b) || a.id - b.id,
  distance: (a, b) => dist(a) - dist(b) || a.id - b.id,
  name: (a, b) => fold(a.name).localeCompare(fold(b.name)) || a.id - b.id,
  recent: (a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || b.id - a.id,
  contact: (a, b) => String(b.last_contact_at || '').localeCompare(String(a.last_contact_at || '')) || a.id - b.id,
  next: (a, b) => (a.next_at || '9999').localeCompare(b.next_at || '9999') || prio(a) - prio(b) || a.id - b.id,
};
const SEG_ORDER = Object.keys(SEGMENTS);
const zi = (cx, p) => { const z = cx.zone(p); return z ? ZONE_BY_CODE[z].i : 99; };
// Zone (ordre fixe), puis commune, puis priorité A, B, C, puis catégorie : toutes les carrosseries, concessions… d'une commune sont ensemble
function sortZone(rows, cx) {
  const dec = new Map(rows.map((p) => [p, [zi(cx, p), cx.prank(p), cx.pkey(p) || '~']]));          // zone, puis du lieu le plus proche de l'atelier au plus loin
  rows.sort((a, b) => {
    const x = dec.get(a), y = dec.get(b);
    return x[0] - y[0] || x[1] - y[1] || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0) || prio(a) - prio(b) || SEG_ORDER.indexOf(a.segment) - SEG_ORDER.indexOf(b.segment) || dist(a) - dist(b) || fold(a.name).localeCompare(fold(b.name)) || a.id - b.id;
  });
}
function select(list, q, now) {
  q = q || {}; const cx = context(list);
  const rows = list.filter((p) => matches(p, q, now, cx));
  if (q.sort === 'zone') sortZone(rows, cx); else rows.sort(SORTS[q.sort] || SORTS.priority);
  return rows;
}
function query(list, q, now) {
  q = q || {}; const cx = context(list);
  const rows = list.filter((p) => matches(p, q, now, cx));
  if (q.sort === 'zone') sortZone(rows, cx); else rows.sort(SORTS[q.sort] || SORTS.priority);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 50)), offset = Math.max(0, parseInt(q.offset, 10) || 0);
  return { total: rows.length, items: rows.slice(offset, offset + limit).map((p) => slim(p, now, { ckey: cx.key(p), pkey: cx.pkey(p), commune: cx.label(p), place: cx.place(p), zone_code: cx.zone(p), zone: cx.zoneLabel(p) })) };
}
// Zones dans l'ordre fixe, avec compteurs (non prospectés / déjà prospectés / total) et communes de la sélection courante.
// Les compteurs ignorent le filtre « prospecté » pour que les trois nombres restent visibles ; les communes suivent ce filtre.
function groups(list, q, now) {
  q = { ...(q || {}) }; delete q.zone_code; delete q.commune;
  const sel = q.prospected === 'no' || q.prospected === 'yes' ? q.prospected : 'all'; delete q.prospected;
  const cx = context(list), Z = new Map([...ZONES, NO_ZONE].map((z) => [z.code, { code: z.code, label: z.label, total: 0, not_prospected: 0, prospected: 0, shown: 0, a: 0, communes: new Map() }]));
  let shown = 0;
  for (const p of list) {
    if (!matches(p, q, now, cx)) continue;
    const g = Z.get(cx.zone(p)) || Z.get('');
    g.total++; if (p.prospected) g.prospected++; else g.not_prospected++;
    if ((sel === 'no' && p.prospected) || (sel === 'yes' && !p.prospected)) continue;
    g.shown++; shown++; if (p.priority === 'A') g.a++;
    const k = cx.pkey(p), pi = cx.pinfo(k) || {}, c = g.communes.get(k) || { key: k, ck: cx.key(p), label: cx.place(p), km: pi.km == null ? null : pi.km, rank: cx.prank(p), n: 0, a: 0, by_segment: {} };
    c.n++; if (p.priority === 'A') c.a++; c.by_segment[p.segment] = (c.by_segment[p.segment] || 0) + 1; g.communes.set(k, c);
  }
  const zs = [...Z.values()].map((g) => ({ ...g, communes: [...g.communes.values()].sort((a, b) => a.rank - b.rank || ((a.key || '~') < (b.key || '~') ? -1 : 1)).map(({ rank, ...c }) => c) }));
  return { selected: sel, total: shown, zones: zs.filter((g) => g.code || g.total) };
}

// Points pour la carte : chaque fiche de la sélection avec sa position (ou, à défaut, le centre de son lieu), et un cercle par lieu.
// Rien d'autre que ce qui est déjà dans la fiche ; aucune donnée ne part vers un service extérieur.
function mapData(list, q, now) {
  q = { ...(q || {}) }; delete q.zone_code; if (!q.commune) delete q.commune;
  const cx = context(list), rows = list.filter((p) => matches(p, q, now, cx));
  const pts = [], pl = new Map(); let approx = 0, unplaced = 0;
  for (const p of rows) {
    const k = cx.pkey(p), pi = cx.pinfo(k) || {}; let la = num(p.lat), lo = num(p.lon), x = 0;
    const s = pl.get(k) || { k, l: cx.place(p), ck: cx.key(p), z: cx.zone(p), n: 0, a: 0, la: pi.lat == null ? null : pi.lat, lo: pi.lon == null ? null : pi.lon, km: pi.km == null ? null : pi.km };
    s.n++; if (p.priority === 'A') s.a++; pl.set(k, s);
    if (la == null || lo == null) { if (pi.lat == null) { unplaced++; continue; } la = pi.lat; lo = pi.lon; x = 1; approx++; }
    if (pts.length < 3000) pts.push({ i: p.id, n: p.name, la: Math.round(la * 1e5) / 1e5, lo: Math.round(lo * 1e5) / 1e5, s: p.segment, p: p.priority, d: p.prospected ? 1 : 0, k, x, t: p.phone || p.contact_phone ? 1 : 0 });
  }
  return { total: rows.length, shown: pts.length, approx, unplaced, points: pts, places: [...pl.values()].sort((a, b) => (a.km == null ? 9999 : a.km) - (b.km == null ? 9999 : b.km)) };
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
  if (!p.prospected) p.prospected = true;                                // un premier échange = déjà prospecté
  if (!p.first_contacted_at) p.first_contacted_at = it.ts;
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
  if (b.priority !== undefined) o.priority = prio3(b.priority);
  if (b.prospected !== undefined) o.prospected = toBool(b.prospected);
  if (b.zone_code !== undefined) { const z = zoneCode(b.zone_code); o.zone_code = z; o.zone = z ? ZONE_BY_CODE[z].label : ''; }
  if (b.relation !== undefined && RELATIONS[b.relation]) o.relation = b.relation;
  if (b.status !== undefined && STATUSES[b.status]) o.status = b.status;
  if (b.next_at !== undefined) o.next_at = isDate(b.next_at) ? b.next_at : '';
  if (b.assigned_to !== undefined) o.assigned_to = b.assigned_to ? Number(b.assigned_to) || null : null;
  if (b.client_id !== undefined) o.client_id = b.client_id ? Number(b.client_id) || null : null;
  if (b.distance_km !== undefined) o.distance_km = km(b.distance_km);
  if (o.relation && BLOCKED.includes(o.relation)) { o.next_at = ''; o.next_action = ''; }      // un refus n'est jamais relancé
  return o;
}

// Conséquences d'une modification à la main : priorité changée par vous = elle ne sera plus remplacée par un import ;
// prospecté passe à vrai tout seul quand le statut quitte « À contacter » (sauf si vous venez de le régler vous-même).
function afterChange(p, before, patch, now) {
  const at = new Date(now || Date.now()).toISOString();
  if (patch.priority !== undefined && patch.priority !== before.priority) p.priority_manual = true;
  if (patch.zone_code !== undefined && patch.zone_code !== (before.zone_code || '')) p.zone_manual = true;                  // zone choisie à la main : un ré-import ne la change plus
  if (patch.prospected !== undefined) {
    if (p.prospected && !p.first_contacted_at) p.first_contacted_at = at;
    if (!p.prospected) p.first_contacted_at = '';
  } else if (before.status === 'a_contacter' && p.status !== 'a_contacter' && !p.prospected) { p.prospected = true; if (!p.first_contacted_at) p.first_contacted_at = at; }
}
// Fiches enregistrées avant l'arrivée des zones et du suivi « prospecté » : valeurs par défaut sûres
function migrate(p) {
  if (typeof p.prospected !== 'boolean') {
    const its = p.interactions || []; p.prospected = p.status !== 'a_contacter' || its.length > 0;
    if (p.prospected && !p.first_contacted_at) p.first_contacted_at = (its[0] && its[0].ts) || p.last_contact_at || '';
  }
  if (p.first_contacted_at === undefined) p.first_contacted_at = '';
  if (p.priority_manual === undefined) p.priority_manual = false;
  if (p.zone_manual === undefined) p.zone_manual = false;
  if (p.zone_code === undefined) p.zone_code = zoneFromLabel(p.zone);
  ['group', 'volume', 'justification', 'angle', 'decision_maker', 'inhouse', 'contact_page', 'verified_at'].forEach((k) => { if (p[k] === undefined) p[k] = ''; });
  if (!Array.isArray(p.sources)) p.sources = [];
  ['distance_atelier_km', 'lat', 'lon'].forEach((k) => { if (p[k] === undefined) p[k] = null; });
}

// ── Statistiques ──
function stats(list, now) {
  now = now || Date.now();
  const cx = context(list), byZone = new Map([...ZONES, NO_ZONE].map((z) => [z.code, { code: z.code, zone: z.label, n: 0, not_prospected: 0, prospected: 0 }]));
  const o = { total: list.length, prospected: 0, not_prospected: 0, by_relation: {}, by_status: {}, by_segment: {}, tabs: {}, zones: [], with_phone: 0, without_phone: 0, with_email: 0, due: 0, week: { contacts: 0, prospects: 0 }, response: { answered: 0, contacted: 0, rate: null }, partners: 0, funnel: {} };
  Object.keys(RELATIONS).forEach((k) => { o.by_relation[k] = 0; }); Object.keys(STATUSES).forEach((k) => { o.by_status[k] = 0; }); Object.keys(SEGMENTS).forEach((k) => { o.by_segment[k] = 0; });
  Object.keys(TABS).forEach((k) => { o.tabs[k] = 0; });
  const since = now - 7 * DAY;
  for (const p of list) {
    o.by_relation[p.relation]++; o.by_status[p.status]++; o.by_segment[p.segment]++;
    for (const [t, rels] of Object.entries(TABS)) if (t === 'premier' ? isFirst(p) : rels.includes(p.relation)) o.tabs[t]++;
    if (p.prospected) o.prospected++; else o.not_prospected++;
    { const g = byZone.get(cx.zone(p)) || byZone.get(''); g.n++; if (p.prospected) g.prospected++; else g.not_prospected++; }
    if (p.phone || p.contact_phone) o.with_phone++; else o.without_phone++;
    if (p.email || p.contact_email) o.with_email++;
    if (isDue(p, now)) o.due++;
    if (p.relation === 'partenaire_actif' || p.status === 'partenaire') o.partners++;
    const its = p.interactions || [];
    const recent = its.filter((i) => Date.parse(i.ts) > since);
    o.week.contacts += recent.length; if (recent.length) o.week.prospects++;
    if (its.some((i) => ['appel', 'sms', 'whatsapp', 'email', 'visite'].includes(i.channel))) {
      o.response.contacted++;
      if (its.some((i) => ['rappeler', 'interesse', 'refus', 'devis_demande'].includes(i.result))) o.response.answered++;
    }
  }
  o.response.rate = o.response.contacted ? Math.round(o.response.answered / o.response.contacted * 100) : null;
  o.zones = [...byZone.values()].filter((z) => z.code || z.n);                // les 7 zones dans l'ordre fixe (+ « hors zones » s'il y en a)
  const S = o.by_status;
  o.funnel = { a_contacter: S.a_contacter, contactes: S.contacte + S.a_rappeler, rdv: S.rdv_pris + S.essai_en_cours, partenaires: o.partners };
  return o;
}

// ── Export CSV (Excel : point-virgule, UTF-8 avec BOM) ──
const CSV_COLS = [
  ['ID', (p) => p.id], ['Entreprise', (p) => p.name], ['Raison sociale', (p) => p.legal_name], ['Segment', (p) => SEGMENTS[p.segment]], ['Priorité', (p) => p.priority],
  ['Relation', (p) => RELATIONS[p.relation]], ['Statut', (p) => STATUSES[p.status]], ['Adresse', (p) => p.address], ['Code postal', (p) => p.postcode], ['Ville', (p) => p.city],
  ['Commune', (p, c) => (c && c.cx ? c.cx.place(p) : p.city)], ['Zone', (p, c) => (c && c.cx ? c.cx.zoneLabel(p) : p.zone)], ['Distance atelier (km)', (p) => (kmOf(p) == null ? '' : String(kmOf(p)).replace('.', ','))], ['Téléphone', (p) => p.phone], ['Autre téléphone', (p) => p.phone_alt],
  ['E-mail', (p) => p.email], ['Site', (p) => p.website], ['Marques', (p) => p.brand], ['Effectif', (p) => p.employees], ['SIRET', (p) => p.siret],
  ['Contact', (p) => p.contact_name], ['Fonction', (p) => p.contact_role], ['Téléphone direct', (p) => p.contact_phone], ['E-mail direct', (p) => p.contact_email], ['WhatsApp', (p) => p.contact_whatsapp],
  ['Dernier contact', (p) => (p.last_contact_at ? p.last_contact_at.slice(0, 10) : '')], ['Prochaine action', (p) => p.next_action], ['Date de rappel', (p) => p.next_at], ['Responsable', (p, ctx) => (p.assigned_to && ctx && ctx.userName ? ctx.userName(p.assigned_to) : '')],
  ['Offre / conditions', (p) => p.offer], ['Notes', (p) => p.notes], ['Étiquettes', (p) => (p.tags || []).join(', ')], ['Source', (p) => p.source],
  ['Prospecté', (p) => (p.prospected ? 'Oui' : 'Non')], ['Première prise de contact', (p) => (p.first_contacted_at ? p.first_contacted_at.slice(0, 10) : '')], ['Volume estimé', (p) => p.volume], ['Groupe', (p) => p.group], ['Dirigeant (registre)', (p) => p.decision_maker], ['Pourquoi ce prospect', (p) => p.justification], ['Angle d\'approche', (p) => p.angle],
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
  ZONES, NO_ZONE, ZONE_BY_CODE, context, groups, mapData, arrOf, isFirst, afterChange, migrate, communeKey, zoneCode,
  slim, full, select, query, stats, toCsv, csvCell, applyInteraction, isDue, isBlockedRel, parisDay, addDays,
  messageFor, pitchFor, partnerUrl, mapsLink, routeLink, bestPhone, bestEmail,
  normPhone, phones, phoneKey, telHref, waDigits, email, url, mapsUrl, fold, line, text,
};
