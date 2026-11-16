/* REYNOV CRM — Prospection (démarchage des professionnels). S'appuie sur le pont window.CRM de crm.js : mêmes outils, même identité.
   Tout texte venant des données (SIRENE, OpenStreetMap, saisie) passe par esc() : aucun HTML des données n'est jamais interprété. */
(function () {
  'use strict';
  const C = window.CRM; if (!C) return;
  const { S, api, esc, ico, toast, ago, $, $$ } = C;

  // ── Icônes supplémentaires ──
  C.ICO.target = C.P('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>');
  C.ICO.sms = C.P('<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"/><path d="M8 10h8M8 13h5"/>');
  C.ICO.pin = C.P('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>');
  C.ICO.upload = C.P('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>');
  C.ICO.filter = C.P('<path d="M4 6h16M7 12h10M10 18h4"/>');
  C.ICO.globe = C.P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>');

  // ── Libellés ──
  const SEG = { carrosserie: 'Carrosserie', reconditionnement: 'Reconditionnement', concession: 'Concession', vendeur_vo: 'Vendeur VO', location: 'Location', autre: 'Autre' };
  const REL = { cible: 'Cible', en_discussion: 'En discussion', a_deja_travaille: 'A déjà travaillé', partenaire_actif: 'Partenaire actif', refus: 'Refus', ne_pas_contacter: 'Ne pas contacter' };
  const STAT = { a_contacter: 'À contacter', contacte: 'Contacté', a_rappeler: 'À rappeler', rdv_pris: 'Rendez-vous pris', essai_en_cours: 'Essai en cours', partenaire: 'Partenaire', perdu: 'Perdu' };
  const CHAN = { appel: 'Appel', sms: 'SMS', whatsapp: 'WhatsApp', email: 'E-mail', visite: 'Visite', autre: 'Autre' };
  const RESU = { pas_de_reponse: 'Pas de réponse', rappeler: 'À rappeler', interesse: 'Intéressé', refus: 'Refus', devis_demande: 'Devis demandé', envoye: 'Message envoyé', autre: 'Autre' };
  const TABS = [['overview', 'Vue d\'ensemble'], ['cibles', 'Cibles'], ['discussion', 'En discussion'], ['travaille', 'Déjà travaillé / partenaires'], ['refus', 'Refus / ne pas contacter']];
  const TAB_SORT = { cibles: 'priority', discussion: 'next', travaille: 'recent', refus: 'recent' };
  const REL_COLOR = { cible: 'var(--blue)', en_discussion: 'var(--violet)', a_deja_travaille: 'var(--green)', partenaire_actif: 'var(--emerald)', refus: 'var(--slate)', ne_pas_contacter: 'var(--rose)' };
  const PAGE = 40;

  // ── État (filtres conservés pendant la session) ──
  const P = { tab: 'overview', f: { segment: '', zone: '', priority: '', ville: '', tel: '', status: '', due: '' }, sort: '', items: [], total: 0, loading: false, token: 0, stats: null, sel: new Set(), selMode: false, open: null, dirty: false, built: false };
  try { const sv = JSON.parse(sessionStorage.getItem('crm_pstate') || 'null'); if (sv) { P.tab = sv.tab || 'overview'; Object.assign(P.f, sv.f || {}); P.sort = sv.sort || ''; } } catch (e) { /* ignoré */ }
  const saveState = () => { try { sessionStorage.setItem('crm_pstate', JSON.stringify({ tab: P.tab, f: P.f, sort: P.sort })); } catch (e) { /* ignoré */ } };

  // ── Outils ──
  const telOf = (s) => { const d = String(s || '').replace(/[^\d+]/g, ''); return d.startsWith('0') ? '+33' + d.slice(1) : d; };
  const waOf = (s) => telOf(s).replace(/^\+/, '');
  const day = (d) => (d ? String(d).split('-').reverse().slice(0, 2).join('/') : '');
  const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const plusDays = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const bestTel = (p) => p.contact_phone || p.phone || '';
  const bestMail = (p) => p.contact_email || p.email || '';
  const nf = (n) => Number(n || 0).toLocaleString('fr-FR');
  const toQuery = (o) => Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const opt = (map, cur, all) => (all != null ? `<option value="">${esc(all)}</option>` : '') + Object.entries(map).map(([k, v]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const chipRel = (p) => (p.relation && p.relation !== 'cible' ? `<span class="chip" style="--c:${REL_COLOR[p.relation]}"><span class="dot" style="--c:${REL_COLOR[p.relation]}"></span>${esc(REL[p.relation])}</span>` : '');
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch (e) { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (er) { /* ignoré */ } t.remove(); return ok; } };
  const queryObj = () => {
    const o = {}; if (P.tab !== 'overview') o.tab = P.tab;
    Object.entries(P.f).forEach(([k, v]) => { if (v) o[k] = v; });
    if (S.q) o.q = S.q; o.sort = P.sort || TAB_SORT[P.tab] || 'priority';
    return o;
  };

  // ── Statistiques (compteurs d'onglets, pastille de menu) ──
  async function loadStats() {
    if (!C.isAdmin()) return;                       // Prospection : administrateur uniquement pour l'instant
    try { P.stats = (await api('GET', '/prospects/stats')).data; } catch (e) { return; }
    const due = P.stats.due || 0, b = $('#nav-pbadge'); if (b) { b.hidden = !due; b.textContent = due; }
    const tb = $('#tab-badge-p'); if (tb) { tb.hidden = !due; tb.textContent = due; }
    window.CRM.pDue = due; document.dispatchEvent(new CustomEvent('crm:pdue', { detail: due }));
    renderTabs();
  }

  // ── Structure de la vue ──
  function build() {
    if (P.built) return; P.built = true;
    $('#view-prospection').innerHTML = '<div class="ptabs" id="p-tabs" role="tablist"></div><div id="p-body"></div><div class="pbulk" id="p-bulk" hidden></div>';
    document.body.insertAdjacentHTML('beforeend', `
<dialog id="dlg-pfilters" class="sheet"><div class="dlg" id="pf-box"></div></dialog>
<dialog id="dlg-pimport"><div class="dlg">
  <h3>Importer des prospects</h3>
  <p class="muted" style="margin:0 0 12px">Choisissez le fichier JSON des prospects (par exemple <em>REYNOV_prospects_import_v2.json</em>). Vous verrez d'abord un aperçu : rien n'est enregistré avant que vous ne validiez. Un ré-import ajoute seulement les nouveaux prospects et complète les champs vides : il ne remplace jamais ce que vous avez saisi.</p>
  <input type="file" id="pimp-file" accept=".json,application/json" class="input" />
  <div id="pimp-report" aria-live="polite" style="margin-top:14px"></div>
  <div class="foot"><button class="btn" type="button" data-action="close-dlg">Fermer</button><button class="btn primary" type="button" id="pimp-go" data-action="p-import-go" disabled>Importer</button></div>
</div></dialog>
<dialog id="dlg-pnew"><form method="dialog" class="dlg" id="form-pnew">
  <h3>Nouveau prospect</h3>
  <div class="field"><label>Entreprise *</label><input class="input" name="name" required maxlength="160" autocomplete="off" /></div>
  <div class="two"><div class="field"><label>Segment</label><select class="input" name="segment">${opt(SEG, 'carrosserie')}</select></div><div class="field"><label>Priorité</label><select class="input" name="priority"><option value="A">A</option><option value="B" selected>B</option></select></div></div>
  <div class="two"><div class="field"><label>Téléphone</label><input class="input" name="phone" type="tel" inputmode="tel" autocomplete="off" /></div><div class="field"><label>E-mail</label><input class="input" name="email" type="email" inputmode="email" autocapitalize="none" autocomplete="off" /></div></div>
  <div class="two"><div class="field"><label>Code postal</label><input class="input" name="postcode" inputmode="numeric" maxlength="10" /></div><div class="field"><label>Ville</label><input class="input" name="city" maxlength="100" /></div></div>
  <div class="field"><label>Notes</label><textarea class="input" name="notes" rows="2"></textarea></div>
  <div class="foot"><button class="btn" type="button" data-action="close-dlg">Annuler</button><button class="btn primary" type="submit">Créer</button></div>
</form></dialog>
<dialog id="dlg-pmail" class="wide"><div class="dlg">
  <h3>E-mail de présentation</h3>
  <p class="muted" id="pm-to" style="margin:0 0 10px"></p>
  <div class="field"><label>Objet</label><input class="input" id="pm-subject" maxlength="150" /></div>
  <div class="field"><label>Un mot personnel (facultatif, ajouté en début de message)</label><textarea class="input" id="pm-personal" rows="2" maxlength="400" placeholder="Ex. : Je passe souvent devant votre atelier, rue de…"></textarea></div>
  <iframe id="pm-frame" title="Aperçu de l'e-mail" sandbox="" class="pm-frame"></iframe>
  <p class="faint" style="font-size:12px;margin:8px 0 0" id="pm-note"></p>
  <div class="foot"><button class="btn" type="button" data-action="close-dlg">Fermer</button><button class="btn" type="button" data-action="pm-refresh">Actualiser l'aperçu</button><button class="btn" type="button" data-action="pm-copy">${ico('copy')}Copier le texte</button><button class="btn primary" type="button" id="pm-send" data-action="pm-send">${ico('send')}Envoyer</button></div>
</div></dialog>`);
    $('#form-pnew').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      try { const j = await api('POST', '/prospects', f); $('#dlg-pnew').close(); toast('Prospect créé'); await loadStats(); P.tab = 'cibles'; saveState(); renderView(); openProspect(j.data.id); } catch (er) { toast(er.message, true); }
    });
    $('#pimp-file').addEventListener('change', onImportFile);
    // chargement progressif : la suite de la liste se charge quand on arrive en bas
    if ('IntersectionObserver' in window) P.io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting) && !P.loading && P.items.length < P.total) loadList(false); }, { rootMargin: '400px' });
  }

  // ── Onglets ──
  function renderTabs() {
    const el = $('#p-tabs'); if (!el) return;
    const t = (P.stats && P.stats.tabs) || {}, due = (P.stats && P.stats.due) || 0;
    el.innerHTML = TABS.map(([id, lbl]) => {
      const n = id === 'overview' ? '' : `<span class="n">${nf(t[id] || 0)}</span>`;
      return `<button class="ptab${P.tab === id ? ' on' : ''}" role="tab" aria-selected="${P.tab === id}" data-action="p-tab" data-tab="${id}">${esc(lbl)}${n}</button>`;
    }).join('') + (due ? `<button class="ptab due" data-action="p-due-all">${ico('clock')}À rappeler<span class="n">${due}</span></button>` : '');
  }

  // ── Vue d'ensemble ──
  async function renderOverview() {
    const body = $('#p-body'); body.innerHTML = '<div class="muted" style="padding:20px">Chargement…</div>';
    await loadStats(); const st = P.stats; if (!st) { body.innerHTML = '<div class="empty">Statistiques indisponibles</div>'; return; }
    let due = []; try { due = (await api('GET', '/prospects?due=1&sort=next&limit=15')).data; } catch (e) { /* ignoré */ }
    const card = (c, ic, l, v, sub) => `<div class="card stat" style="--c:${c}"><span class="ico">${ico(ic)}</span><div class="lbl">${esc(l)}</div><div class="val">${v}</div><div class="sub">${sub}</div></div>`;
    const fn = st.funnel, rp = st.response;
    const bars = (rows, max) => rows.map(([l, n, c]) => `<div class="hbar"><span>${esc(l)}</span><div class="track"><div class="fill" style="width:${Math.round(n / Math.max(1, max) * 100)}%;${c ? `background:${c}` : ''}"></div></div><b class="n">${nf(n)}</b></div>`).join('');
    const seg = Object.entries(st.by_segment).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
    const funnel = [['À contacter', fn.a_contacter, 'var(--blue)'], ['Contactés', fn.contactes, 'var(--violet)'], ['Rendez-vous', fn.rdv, 'var(--amber)'], ['Partenaires', fn.partenaires, 'var(--emerald)']];
    const row = (p) => `<div class="prog-item" data-action="p-open" data-id="${p.id}"><span class="avatar" style="--c:var(--amber);width:30px;height:30px;font-size:11px">${esc((p.name || '?').trim()[0] || '?')}</span><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(day(p.next_at))}${p.next_action ? ' · ' + esc(p.next_action) : ''}${p.city ? ' · ' + esc(p.city) : ''}</div></div><div class="acts">${bestTel(p) ? `<a class="mini-btn" href="tel:${esc(telOf(bestTel(p)))}" aria-label="Appeler" data-action="p-call" data-id="${p.id}">${ico('phone')}</a>` : ''}</div></div>`;
    body.innerHTML = `
      <div class="toolbar"><button class="btn primary" data-action="p-new">${ico('plus')}Nouveau prospect</button><button class="btn" data-action="p-import">${ico('upload')}Importer des prospects</button><button class="btn" data-action="p-export">${ico('download')}Exporter en CSV</button><span class="hint">${nf(st.total)} prospects · ${nf(st.without_phone)} sans téléphone à compléter</span></div>
      <div class="grid stats">
        ${card('var(--blue)', 'target', 'Prospects', nf(st.total), nf(st.by_relation.cible) + ' cibles')}
        ${card('var(--violet)', 'phone', 'Contactés cette semaine', nf(st.week.prospects), nf(st.week.contacts) + ' échange(s)')}
        ${card('var(--green)', 'trend', 'Taux de réponse', rp.rate == null ? '—' : rp.rate + ' %', rp.contacted ? rp.answered + ' réponse(s) sur ' + rp.contacted + ' contactés' : 'aucun prospect contacté')}
        ${card('var(--emerald)', 'check', 'Partenaires actifs', nf(st.partners), nf(st.tabs.discussion) + ' en discussion')}
      </div>
      <div class="grid two" style="margin-top:14px">
        <div class="card"><h3>Entonnoir</h3>${bars(funnel, Math.max(...funnel.map((x) => x[1])))}</div>
        <div class="card"><h3>À rappeler aujourd'hui <span class="count">${nf(st.due)}</span></h3>${due.length ? due.map(row).join('') : '<div class="empty">RIEN À RAPPELER AUJOURD\'HUI</div>'}</div>
      </div>
      <div class="grid two" style="margin-top:14px">
        <div class="card"><h3>Par segment</h3>${bars(seg.map(([k, n]) => [SEG[k], n]), seg.length ? seg[0][1] : 1)}</div>
        <div class="card"><h3>Par zone</h3>${bars((st.zones || []).map((z) => [z.zone, z.n]), Math.max(1, ...(st.zones || []).map((z) => z.n)))}</div>
      </div>`;
  }

  // ── Listes ──
  function activeFilters() {
    const f = P.f, out = [];
    if (f.segment) out.push(['segment', SEG[f.segment]]); if (f.zone) out.push(['zone', f.zone]); if (f.priority) out.push(['priority', 'Priorité ' + f.priority]);
    if (f.ville) out.push(['ville', f.ville]); if (f.tel) out.push(['tel', f.tel === 'avec' ? 'Avec téléphone' : 'Sans téléphone']); if (f.status) out.push(['status', STAT[f.status]]);
    return out;
  }
  function renderToolbar() {
    const af = activeFilters(), due = (P.stats && P.stats.due) || 0;
    $('#p-body').innerHTML = `
      <div class="toolbar ptool">
        <button class="btn" data-action="p-filters">${ico('filter')}Filtres${af.length ? ' (' + af.length + ')' : ''}</button>
        <div class="filters"><span class="chip wait${P.f.due ? ' on' : ''}" data-action="p-due">${ico('clock')} À rappeler (${due})</span>${af.map(([k, l]) => `<span class="chip on" data-action="p-unfilter" data-k="${k}">${esc(l)} ✕</span>`).join('')}</div>
        <select class="mini" id="p-sort" aria-label="Tri">${opt({ priority: 'Priorité', distance: 'Distance', name: 'Nom A-Z', recent: 'Récents', contact: 'Dernier contact', next: 'Date de rappel' }, P.sort || TAB_SORT[P.tab] || 'priority')}</select>
        <button class="btn sm${P.selMode ? ' primary' : ''}" data-action="p-select-mode">${ico('check')}${P.selMode ? 'Terminer' : 'Sélectionner'}</button>
        <button class="btn sm" data-action="p-export" aria-label="Exporter">${ico('download')}<span class="lbl">CSV</span></button>
        <span class="hint" id="p-count"></span>
      </div>
      <div id="p-rows" class="prows"></div><div id="p-more" class="p-more"></div>`;
    $('#p-sort').addEventListener('change', (e) => { P.sort = e.target.value; saveState(); loadList(true); });
  }
  // « À savoir » : ce que le fichier d'import dit de ce prospect (lecture seule ; tout est échappé)
  function know(p) {
    const rows = [];
    if (p.angle) rows.push(`<div class="know-angle"><b>Angle d'approche</b><span>${esc(p.angle)}</span></div>`);
    if (p.inhouse) rows.push(`<div class="know-warn">${ico('alert')} Atelier de jantes en interne : ${esc(p.inhouse)}</div>`);
    const kv = [
      p.volume ? ['Volume estimé', esc(p.volume)] : null,
      p.decision_maker ? ['Dirigeant (registre)', esc(p.decision_maker)] : null,
      p.group ? ['Groupe', esc(p.group)] : null,
      p.km != null && p.distance_km != null && p.distance_km !== p.km ? ['Depuis Bellecour', esc(p.distance_km) + ' km'] : null,
      p.contact_page ? ['Page de contact', `<a href="${esc(p.contact_page)}" target="_blank" rel="noopener noreferrer">Ouvrir</a>`] : null,
      p.verified_at ? ['Vérifié le', esc(p.verified_at.split('-').reverse().join('/'))] : null,
    ].filter(Boolean);
    if (kv.length) rows.push(`<dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`);
    if (p.justification) rows.push(`<p class="faint" style="font-size:12px;margin:8px 0 0">${esc(p.justification)}</p>`);
    const src = (p.sources || []).map((u) => { let h = u; try { h = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* adresse déjà nettoyée côté serveur */ } return `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(h)}</a>`; });
    if (src.length) rows.push(`<p class="faint" style="font-size:12px;margin:6px 0 0">Sources : ${src.join(' · ')}</p>`);
    return rows.length ? `<div class="card know"><h4>${ico('sparkle')} À savoir</h4>${rows.join('')}</div>` : '';
  }
  function row(p) {
    const tel = bestTel(p), mail = bestMail(p);
    const sel = P.selMode ? `<label class="pcheck"><input type="checkbox" data-pcheck data-id="${p.id}"${P.sel.has(p.id) ? ' checked' : ''} aria-label="Sélectionner ${esc(p.name)}" /></label>` : '';
    const meta = [SEG[p.segment], p.city, p.km != null ? p.km + ' km' : '', p.brand].filter(Boolean).map(esc).join(' · ');
    const st = p.status !== 'a_contacter' ? `<span class="chip pst-${esc(p.status)}"><span class="dot"></span>${esc(STAT[p.status])}</span>` : '';
    const next = p.next_at ? `<span class="chip ${p.due ? 'urgent' : ''}">${ico('clock')}${esc(day(p.next_at))}${p.next_action ? ' · ' + esc(p.next_action) : ''}</span>` : '';
    const last = p.last_contact_at ? `<span class="chip">${esc(ago(p.last_contact_at))}</span>` : '';
    const alertChip = (p.alerts || []).filter((a) => a.short).map((a) => `<span class="chip warn" title="${esc(a.text)}">${esc(a.short)}</span>`).join('');
    const noTel = !tel ? `<span class="chip warn" data-action="p-open" data-id="${p.id}" data-focus="phone">Téléphone à compléter</span>` : '';
    const acts = [
      tel ? `<a class="btn sm call icon" href="tel:${esc(telOf(tel))}" aria-label="Appeler" data-action="p-call" data-id="${p.id}">${ico('phone')}</a>` : '',
      tel ? `<a class="btn sm wa icon" href="https://wa.me/${esc(waOf(tel))}" target="_blank" rel="noopener" aria-label="WhatsApp" data-action="p-wa" data-id="${p.id}">${ico('wa')}</a>` : '',
      mail && !p.blocked ? `<button class="btn sm mail icon" aria-label="E-mail de présentation" data-action="p-mail" data-id="${p.id}">${ico('mail')}</button>` : '',
    ].join('');
    return `<article class="prow${p.due ? ' due' : ''}${p.blocked ? ' blocked' : ''}" data-id="${p.id}">${sel}
      <div class="pmain" data-action="p-open" data-id="${p.id}"><div class="pname"><span class="pn">${esc(p.name)}</span><span class="chip prio ${esc(p.priority)}">${esc(p.priority)}</span></div><div class="pmeta">${meta}</div><div class="pchips">${st}${chipRel(p)}${alertChip}${next}${last}${noTel}</div></div>
      <div class="pact">${acts}</div></article>`;
  }
  async function loadList(reset) {
    if (reset) { P.items = []; P.total = 0; }
    const token = ++P.token; P.loading = true;
    const q = toQuery(Object.assign(queryObj(), { limit: PAGE, offset: P.items.length }));
    try {
      const j = await api('GET', '/prospects?' + q);
      if (token !== P.token) return;
      P.items = reset ? j.data : P.items.concat(j.data); P.total = j.total;
      const box = $('#p-rows'); if (!box) return;
      if (reset) box.innerHTML = '';
      box.insertAdjacentHTML('beforeend', j.data.map(row).join(''));
      if (!P.items.length) box.innerHTML = '<div class="empty">AUCUN PROSPECT POUR CES FILTRES</div>';
      const c = $('#p-count'); if (c) c.textContent = nf(P.total) + ' prospect' + (P.total > 1 ? 's' : '');
      const more = $('#p-more');
      if (more) { more.innerHTML = P.items.length < P.total ? `<button class="btn" data-action="p-more">Afficher plus (${nf(P.total - P.items.length)})</button>` : ''; if (P.io) { P.io.disconnect(); if (P.items.length < P.total) P.io.observe(more); } }
    } catch (e) { toast(e.message, true); } finally { if (token === P.token) P.loading = false; }
  }
  function renderView() {
    build(); renderTabs();
    if (P.tab === 'overview') { renderOverview(); return; }
    renderToolbar(); loadList(true); loadStats();
  }
  const refreshView = () => { if (S.view === 'prospection') renderView(); else loadStats(); };

  // ── Filtres (feuille qui monte du bas sur téléphone) ──
  function openFilters() {
    const zones = ((P.stats && P.stats.zones) || []).map((z) => [z.zone, z.zone + ' (' + z.n + ')']);
    const f = P.f;
    $('#pf-box').innerHTML = `<h3>Filtres</h3>
      <div class="field"><label>Segment</label><select class="input" id="pfl-segment">${opt(SEG, f.segment, 'Tous')}</select></div>
      <div class="field"><label>Zone</label><select class="input" id="pfl-zone"><option value="">Toutes</option>${zones.map(([v, l]) => `<option value="${esc(v)}"${v === f.zone ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="two"><div class="field"><label>Priorité</label><select class="input" id="pfl-priority"><option value="">Toutes</option><option value="A"${f.priority === 'A' ? ' selected' : ''}>A</option><option value="B"${f.priority === 'B' ? ' selected' : ''}>B</option><option value="C"${f.priority === 'C' ? ' selected' : ''}>C</option></select></div>
      <div class="field"><label>Téléphone</label><select class="input" id="pfl-tel"><option value="">Tous</option><option value="avec"${f.tel === 'avec' ? ' selected' : ''}>Avec téléphone</option><option value="sans"${f.tel === 'sans' ? ' selected' : ''}>Sans téléphone</option></select></div></div>
      <div class="two"><div class="field"><label>Statut</label><select class="input" id="pfl-status">${opt(STAT, f.status, 'Tous')}</select></div>
      <div class="field"><label>Ville</label><input class="input" id="pfl-ville" value="${esc(f.ville)}" maxlength="60" autocomplete="off" /></div></div>
      <div class="foot"><button class="btn" type="button" data-action="p-filters-reset">Réinitialiser</button><button class="btn primary" type="button" data-action="p-filters-apply">Appliquer</button></div>`;
    $('#dlg-pfilters').showModal();
  }

  // ── Actions groupées ──
  function renderBulk() {
    const el = $('#p-bulk'); if (!el) return;
    el.hidden = !(P.selMode && P.sel.size);
    if (el.hidden) return;
    el.innerHTML = `<span class="pbulk-n">${P.sel.size} sélectionné${P.sel.size > 1 ? 's' : ''}</span>
      <select class="mini" id="pb-field" aria-label="Champ à changer"><option value="status">Statut</option><option value="relation">Relation</option><option value="priority">Priorité</option></select>
      <select class="mini" id="pb-val" aria-label="Nouvelle valeur">${opt(STAT, 'contacte')}</select>
      <button class="btn primary sm" data-action="p-bulk-apply">Appliquer</button><button class="btn sm" data-action="p-bulk-clear">Annuler</button>`;
    $('#pb-field').addEventListener('change', (e) => { $('#pb-val').innerHTML = e.target.value === 'status' ? opt(STAT, 'contacte') : e.target.value === 'relation' ? opt(REL, 'cible') : '<option value="A">A</option><option value="B">B</option><option value="C">C</option>'; });
  }

  // ── Fiche prospect (tiroir) ──
  async function openProspect(id, focus) {
    try {
      const j = await api('GET', '/prospects/' + id);
      P.open = j.data; P.dirty = false; S.openId = 'p' + id;
      drawProspect(focus); C.showDrawer();
      if (focus) setTimeout(() => { const el = $('#pf-' + focus) || $('#drawer [name="' + focus + '"]'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { el.focus({ preventScroll: true }); } catch (e) { /* ignoré */ } } }, 260);
    } catch (e) { toast(e.message, true); }
  }
  const fld = (label, name, val, attrs, cls) => `<div class="field ${cls || ''}"><label for="pf-${name}">${esc(label)}</label><input class="input" id="pf-${name}" name="${name}" value="${esc(val || '')}" ${attrs || ''} /></div>`;
  function drawProspect() {
    const p = P.open, tel = bestTel(p), mail = bestMail(p), blocked = p.blocked, b = p.business || {};
    const actions = [
      tel ? `<a class="btn sm call" href="tel:${esc(telOf(tel))}" data-action="p-call" data-id="${p.id}">${ico('phone')}Appeler</a>` : '',
      tel ? `<a class="btn sm wa" href="https://wa.me/${esc(waOf(tel))}" target="_blank" rel="noopener" data-action="p-wa" data-id="${p.id}">${ico('wa')}WhatsApp</a>` : '',
      tel ? `<a class="btn sm" href="sms:${esc(telOf(tel))}" data-action="p-sms" data-id="${p.id}">${ico('sms')}SMS</a>` : '',
      mail && !blocked ? `<button class="btn sm mail" data-action="p-mail" data-id="${p.id}">${ico('mail')}E-mail</button>` : '',
      p.website ? `<a class="btn sm" href="${esc(p.website)}" target="_blank" rel="noopener noreferrer">${ico('globe')}Site</a>` : '',
      `<a class="btn sm" href="${esc(p.maps_link)}" target="_blank" rel="noopener noreferrer">${ico('pin')}Google Maps</a>`,
      `<a class="btn sm" href="${esc(p.route_link)}" target="_blank" rel="noopener noreferrer">${ico('route')}Itinéraire</a>`,
    ].join('');
    const quick = [['Appelé, pas de réponse', 'appel', 'pas_de_reponse'], ['Rappeler…', 'appel', 'rappeler'], ['Intéressé, envoyer des photos', 'appel', 'interesse'], ['Message envoyé', 'whatsapp', 'envoye'], ['Refus', 'appel', 'refus']]
      .map(([l, c, r]) => `<button class="btn sm" type="button" data-action="p-quick" data-channel="${c}" data-result="${r}">${esc(l)}</button>`).join('');
    const hist = (p.interactions || []).map((i) => `<div class="tl"><b>${esc(CHAN[i.channel] || i.channel)}</b> · ${esc(RESU[i.result] || i.result)}${i.note ? ' — ' + esc(i.note) : ''}<small>${esc(new Date(i.ts).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}${i.by ? ' · ' + esc(i.by) : ''}</small></div>`).join('') || '<p class="faint" style="margin:0">Aucun échange noté pour le moment.</p>';
    const msg = p.message;
    $('#drawer').innerHTML = `
    <div class="dr-head">
      <div class="dr-title"><span class="avatar" style="--c:${REL_COLOR[p.relation] || 'var(--blue)'}">${esc((p.name || '?').trim()[0] || '?')}</span><h2>${esc(p.name)}</h2><button class="icon-btn" data-action="close-drawer" aria-label="Fermer">${ico('close')}</button></div>
      <div class="dr-meta"><span class="chip">${esc(SEG[p.segment] || p.segment)}</span><span class="chip prio ${esc(p.priority)}">Priorité ${esc(p.priority)}</span>${p.km != null ? `<span>${esc(p.km)} km de l'atelier</span>` : ''}${p.zone ? `<span>${esc(p.zone)}</span>` : ''}${p.source ? `<span class="faint">Source : ${esc(p.source)}</span>` : ''}</div>
      <div class="dr-actions">${actions}</div>
    </div>
    <div class="dr-body">
      ${blocked ? `<div class="card" style="border-color:var(--rose)"><b>${esc(REL[p.relation])}</b> — ce prospect ne reçoit ni relance ni message.</div>` : ''}
      ${(p.alerts || []).map((a) => `<div class="card know-alert" style="border-color:var(--amber)">${ico('alert')}<span>${esc(a.text)}</span></div>`).join('')}
      ${know(p)}
      <form id="pf" autocomplete="off">
      <div class="card"><h4>Relation et suivi</h4>
        <div class="two"><div class="field"><label>Relation</label><select class="input" id="pf-relation" name="relation" data-pquick>${opt(REL, p.relation)}</select></div><div class="field"><label>Statut</label><select class="input" id="pf-status" name="status" data-pquick>${opt(STAT, p.status)}</select></div></div>
        <div class="two"><div class="field"><label>Priorité</label><select class="input" name="priority"><option value="A"${p.priority === 'A' ? ' selected' : ''}>A</option><option value="B"${p.priority === 'B' ? ' selected' : ''}>B</option><option value="C"${p.priority === 'C' ? ' selected' : ''}>C</option></select></div><div class="field"><label>Responsable</label><select class="input" name="assigned_to">${C.userOptions(p.assigned_to)}</select></div></div>
        <div class="field"><label for="pf-next_action">Prochaine action</label><input class="input" id="pf-next_action" name="next_action" value="${esc(p.next_action)}" maxlength="200" placeholder="Ex. : Rappeler, envoyer des photos…" ${blocked ? 'disabled' : ''} /></div>
        <div class="field"><label for="pf-next_at">Me rappeler le</label><div class="inline"><input class="input" type="date" id="pf-next_at" name="next_at" value="${esc(p.next_at)}" ${blocked ? 'disabled' : ''} />${blocked ? '' : `<button class="btn sm" type="button" data-action="p-date" data-d="1">Demain</button><button class="btn sm" type="button" data-action="p-date" data-d="3">+3 j</button><button class="btn sm" type="button" data-action="p-date" data-d="7">+1 sem.</button>`}</div></div>
      </div>
      <div class="card"><h4>Coordonnées</h4>
        ${fld('Téléphone', 'phone', p.phone, 'type="tel" inputmode="tel" maxlength="40"')}
        <div class="two">${fld('Autre téléphone', 'phone_alt', p.phone_alt, 'type="tel" inputmode="tel" maxlength="60"')}${fld('E-mail', 'email', p.email, 'type="email" inputmode="email" autocapitalize="none" maxlength="200"')}</div>
        ${fld('Site web', 'website', p.website, 'type="url" inputmode="url" autocapitalize="none" maxlength="300"')}
        ${fld('Adresse', 'address', p.address, 'maxlength="200"')}
        <div class="two">${fld('Code postal', 'postcode', p.postcode, 'inputmode="numeric" maxlength="10"')}${fld('Ville', 'city', p.city, 'maxlength="100"')}</div>
        <div class="two">${fld('Marques', 'brand', p.brand, 'maxlength="120"')}${fld('Effectif', 'employees', p.employees, 'maxlength="30"')}</div>
        ${p.legal_name ? `<p class="faint" style="margin:0;font-size:12px">Raison sociale : ${esc(p.legal_name)}${p.siret ? ' · SIRET ' + esc(p.siret) : ''}</p>` : (p.siret ? `<p class="faint" style="margin:0;font-size:12px">SIRET ${esc(p.siret)}</p>` : '')}
      </div>
      <div class="card"><h4>Personne à contacter</h4>
        <div class="two">${fld('Nom', 'contact_name', p.contact_name, 'maxlength="100"')}${fld('Fonction', 'contact_role', p.contact_role, 'maxlength="100"')}</div>
        <div class="two">${fld('Téléphone direct', 'contact_phone', p.contact_phone, 'type="tel" inputmode="tel" maxlength="40"')}${fld('WhatsApp', 'contact_whatsapp', p.contact_whatsapp, 'type="tel" inputmode="tel" maxlength="40"')}</div>
        ${fld('E-mail direct', 'contact_email', p.contact_email, 'type="email" inputmode="email" autocapitalize="none" maxlength="200"')}
      </div>
      <div class="card"><h4>Offre et notes</h4>
        <div class="field"><label for="pf-offer">Offre / conditions proposées</label><textarea class="input" id="pf-offer" name="offer" rows="2" maxlength="1000" placeholder="Tarif partenaire, commission d'apporteur… (rien n'est prérempli)">${esc(p.offer)}</textarea></div>
        <div class="field"><label for="pf-tags">Étiquettes (séparées par des virgules)</label><input class="input" id="pf-tags" name="tags" value="${esc((p.tags || []).join(', '))}" maxlength="200" /></div>
        <div class="field"><label for="pf-notes">Notes</label><textarea class="input" id="pf-notes" name="notes" rows="4" maxlength="4000">${esc(p.notes)}</textarea></div>
        <div class="dr-actions"><button class="btn sm mic" type="button" data-action="mic" data-target="pf-notes">${ico('mic')}<span class="lbl">Dicter une note</span></button></div>
      </div>
      <div class="pf-save" id="pf-save"><span class="faint">Modifications non enregistrées</span><button class="btn primary" type="button" data-action="p-save">Enregistrer</button></div>
      </form>
      <div class="card"><h4>${ico('clock')} Historique des échanges</h4>
        <div class="dr-actions" style="margin-bottom:12px">${quick}</div>
        <div class="two"><div class="field"><label for="pi-channel">Canal</label><select class="input" id="pi-channel">${opt(CHAN, 'appel')}</select></div><div class="field"><label for="pi-result">Résultat</label><select class="input" id="pi-result">${opt(RESU, 'pas_de_reponse')}</select></div></div>
        <div class="field"><label for="pi-note">Note</label><textarea class="input" id="pi-note" rows="2" maxlength="1000" placeholder="Ce qui s'est dit…"></textarea></div>
        <div class="field"><label for="pi-next">Rappel le (facultatif)</label><input class="input" type="date" id="pi-next" /></div>
        <div class="dr-actions"><button class="btn primary sm" type="button" data-action="p-interaction">Ajouter à l'historique</button><button class="btn sm mic" type="button" data-action="mic" data-target="pi-note">${ico('mic')}<span class="lbl">Dicter</span></button></div>
        <div class="timeline" style="margin-top:14px">${hist}</div>
      </div>
      ${blocked ? '' : `<div class="card"><h4>${ico('mail')} Message type</h4>
        <textarea class="input reply" id="pm-text" rows="6" style="min-height:140px">${esc((msg && msg.text) || '')}</textarea>
        <p class="faint" style="font-size:12px;margin:8px 0">Rien n'est envoyé tout seul : copiez le texte, ouvrez-le dans WhatsApp ou par SMS, ou préparez l'e-mail mis en forme avec vos tarifs (aperçu avant envoi).</p>
        <div class="dr-actions"><button class="btn sm" type="button" data-action="p-copy-msg">${ico('copy')}Copier</button>${tel ? `<button class="btn sm wa" type="button" data-action="p-wa-msg" data-id="${p.id}">${ico('wa')}WhatsApp avec ce texte</button><button class="btn sm" type="button" data-action="p-sms-msg" data-id="${p.id}">${ico('sms')}SMS</button>` : ''}${mail ? `<button class="btn primary sm" type="button" data-action="p-mail" data-id="${p.id}">${ico('mail')}Préparer l'e-mail</button>` : ''}</div>
      </div>`}
      ${p.client_id || b.ca_ttc ? `<div class="card"><h4>${ico('bag')} Activité avec REYNOV</h4><dl class="kv"><dt>Jantes confiées</dt><dd>${nf(b.jantes_confiees)}</dd><dt>Chiffre d'affaires</dt><dd>${nf(b.ca_ttc)} € TTC</dd><dt>Devis acceptés</dt><dd>${nf(b.devis_acceptes)}</dd><dt>Interventions</dt><dd>${nf(b.interventions)}</dd></dl></div>` : ''}
      <div class="card"><h4>${ico('alert')} Données personnelles</h4>
        <p class="faint" style="font-size:12px;margin:0 0 10px">Ne stockez que des informations professionnelles. « Ne pas contacter » bloque les relances et les messages. « Supprimer » efface toutes les données de ce prospect (une empreinte sans coordonnée empêche seulement qu'un nouvel import le recrée).</p>
        <div class="dr-actions">${blocked && p.relation === 'ne_pas_contacter' ? '' : `<button class="btn sm" type="button" data-action="p-never">Ne pas contacter</button>`}<button class="btn sm danger" type="button" data-action="p-erase">${ico('trash')}Supprimer toutes les données</button></div>
      </div>
    </div>${C.actionBar({ id: p.id, tel, call: 'p-call', wa: 'p-wa', sms: 'p-sms', mail: mail && !blocked ? 'p-mail' : '' })}`;
    const form = $('#pf');
    form.addEventListener('input', () => { P.dirty = true; $('#pf-save').classList.add('on'); });
  }

  // Valeurs du formulaire → corps d'un PATCH
  function formBody() { const f = $('#pf'); if (!f) return null; const o = {}; for (const [k, v] of new FormData(f).entries()) o[k] = v; ['relation', 'status', 'next_at', 'next_action'].forEach((k) => { if (f.elements[k] && f.elements[k].disabled) delete o[k]; }); return o; }
  async function saveForm(extra, quiet) {
    const body = Object.assign(formBody() || {}, extra || {}); if (!P.open) return;
    try {
      const j = await api('PATCH', '/prospects/' + P.open.id, body);
      P.open = j.data; P.dirty = false; syncItem(j.data); if (!quiet) toast('Prospect enregistré');
      if (S.openId === 'p' + P.open.id) drawProspect(); loadStats();
    } catch (e) { toast(e.message, true); }
  }
  function syncItem(d) {
    const i = P.items.findIndex((x) => x.id === d.id); if (i < 0) return;
    const { interactions, business, message, prices, prices_note, partner_url, ...slim } = d; P.items[i] = Object.assign({}, P.items[i], slim, { interactions_count: (interactions || []).length });
    const el = $('#p-rows .prow[data-id="' + d.id + '"]'); if (el) el.outerHTML = row(P.items[i]);
  }
  async function interaction(body) {
    if (!P.open) return;
    try {
      const j = await api('POST', '/prospects/' + P.open.id + '/interactions', body);
      const keepForm = P.dirty ? formBody() : null;
      P.open = j.data; syncItem(j.data); drawProspect();
      if (keepForm) { const f = $('#pf'); Object.entries(keepForm).forEach(([k, v]) => { if (f.elements[k] && !['relation', 'status', 'next_at', 'next_action'].includes(k)) f.elements[k].value = v; }); P.dirty = true; $('#pf-save').classList.add('on'); }
      toast('Enregistré' + (j.changes && j.changes.length ? ' · ' + j.changes.join(' · ') : '')); loadStats();
      return j;
    } catch (e) { toast(e.message, true); }
  }
  // Enregistre sans perte si on ferme la fiche avec des modifications en cours
  C.on('close', (openId) => { if (String(openId || '').startsWith('p') && P.dirty && P.open) { const body = formBody(); if (body) { api('PATCH', '/prospects/' + P.open.id, body).then((j) => { syncItem(j.data); toast('Modifications enregistrées'); loadStats(); }).catch((e) => toast(e.message, true)); } P.dirty = false; } });

  // ── E-mail de présentation ──
  async function mailPreview() {
    const id = P.mailId; const body = { subject: $('#pm-subject').value, personal: $('#pm-personal').value };
    try {
      const j = await api('POST', '/prospects/' + id + '/email/preview', body); P.mail = j.data;
      $('#pm-to').innerHTML = 'À : <b>' + esc(j.data.to) + '</b>';
      if (!$('#pm-subject').value) $('#pm-subject').value = j.data.subject;
      $('#pm-frame').srcdoc = j.data.html;
      $('#pm-note').textContent = j.data.can_send ? 'Relisez l\'aperçu : l\'e-mail ne part que si vous cliquez sur « Envoyer ». Un seul prospect à la fois ; le message invite le destinataire à répondre « STOP » pour ne plus rien recevoir.' : 'L\'envoi d\'e-mails n\'est pas configuré sur le serveur : utilisez « Copier le texte ».';
      $('#pm-send').disabled = !j.data.can_send;
    } catch (e) { toast(e.message, true); throw e; }
  }
  async function openMail(id) {
    P.mailId = id; $('#pm-subject').value = ''; $('#pm-personal').value = ''; $('#pm-frame').srcdoc = '';
    try { await mailPreview(); $('#dlg-pmail').showModal(); } catch (e) { /* message déjà affiché */ }
  }

  // ── Import ──
  let importItems = null;
  async function onImportFile(e) {
    const f = e.target.files[0]; importItems = null; $('#pimp-go').disabled = true; const rep = $('#pimp-report'); rep.innerHTML = '';
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { rep.innerHTML = '<p class="login-err">Fichier trop gros (3 Mo maximum).</p>'; return; }
    let data; try { data = JSON.parse(await f.text()); } catch (er) { rep.innerHTML = '<p class="login-err">Ce fichier n\'est pas un JSON valide.</p>'; return; }
    const items = Array.isArray(data) ? data : data && data.prospects;
    if (!Array.isArray(items) || !items.length) { rep.innerHTML = '<p class="login-err">Aucun prospect trouvé dans ce fichier.</p>'; return; }
    rep.innerHTML = '<p class="muted">Analyse du fichier…</p>';
    try { const j = await api('POST', '/prospects/import', { prospects: items }); importItems = items; showReport(j, true); $('#pimp-go').disabled = !(j.report.added || j.report.completed); } catch (er) { rep.innerHTML = `<p class="login-err">${esc(er.message)}</p>`; }
  }
  function showReport(j, dry) {
    const r = j.report, seg = Object.entries(r.added_by_segment || {}).map(([k, n]) => `${esc(SEG[k] || k)} : ${n}`).join(' · ');
    $('#pimp-report').innerHTML = `<div class="${dry ? 'alert' : 'alert ok'}"><span><strong>${dry ? 'Aperçu (rien n\'est encore enregistré)' : 'Import terminé'}</strong></span></div>
      <dl class="kv" style="margin-top:10px"><dt>Lignes lues</dt><dd>${nf(r.received)}</dd><dt>${dry ? 'Seront ajoutés' : 'Ajoutés'}</dt><dd><b>${nf(r.added)}</b>${r.added ? ` (dont ${nf(r.added_without_phone)} sans téléphone)` : ''}</dd>${seg ? `<dt>Par segment</dt><dd>${seg}</dd>` : ''}<dt>${dry ? 'Seront complétés' : 'Complétés'}</dt><dd>${nf(r.completed)}</dd><dt>Doublons ignorés</dt><dd>${nf(r.duplicates)}</dd><dt>Lignes inutilisables</dt><dd>${nf(r.skipped)}</dd>${r.blocked ? `<dt>Supprimés à leur demande</dt><dd>${nf(r.blocked)}</dd>` : ''}</dl>
      ${j.duplicates && j.duplicates.length ? `<details style="margin-top:8px"><summary>Doublons (${j.duplicates.length}${r.duplicates > j.duplicates.length ? '+' : ''})</summary><div class="faint" style="font-size:12px;max-height:140px;overflow:auto">${j.duplicates.map((d) => esc(d.name + (d.city ? ' (' + d.city + ')' : '') + ' — même ' + d.by)).join('<br>')}</div></details>` : ''}
      ${j.completed && j.completed.length ? `<details style="margin-top:8px"><summary>Fiches complétées (${j.completed.length})</summary><div class="faint" style="font-size:12px;max-height:140px;overflow:auto">${j.completed.map((d) => esc(d.name + ' : ' + d.changed.join(', '))).join('<br>')}</div></details>` : ''}`;
  }

  // ── Actions ──
  const A = {
    'p-tab': (el) => { P.tab = el.dataset.tab; P.f.due = ''; P.sel.clear(); P.selMode = false; saveState(); renderView(); renderBulk(); },
    'p-due-all': () => { P.tab = 'cibles'; P.f = { segment: '', zone: '', priority: '', ville: '', tel: '', status: '', due: '1' }; P.sort = 'next'; saveState(); renderView(); },
    'p-due': () => { P.f.due = P.f.due ? '' : '1'; saveState(); renderToolbar(); loadList(true); },
    'p-unfilter': (el) => { P.f[el.dataset.k] = ''; saveState(); renderToolbar(); loadList(true); },
    'p-filters': () => openFilters(),
    'p-filters-apply': () => { ['segment', 'zone', 'priority', 'tel', 'status', 'ville'].forEach((k) => { P.f[k] = ($('#pfl-' + k).value || '').trim(); }); $('#dlg-pfilters').close(); saveState(); renderToolbar(); loadList(true); },
    'p-filters-reset': () => { P.f = { segment: '', zone: '', priority: '', ville: '', tel: '', status: '', due: '' }; $('#dlg-pfilters').close(); saveState(); renderToolbar(); loadList(true); },
    'p-more': () => { if (!P.loading) loadList(false); },
    'p-open': (el) => { if (P.selMode) return; openProspect(Number(el.dataset.id), el.dataset.focus); },
    'p-new': () => { $('#form-pnew').reset(); $('#dlg-pnew').showModal(); },
    'p-import': () => { $('#pimp-file').value = ''; $('#pimp-report').innerHTML = ''; $('#pimp-go').disabled = true; importItems = null; $('#dlg-pimport').showModal(); },
    'p-import-go': async (el) => {
      if (!importItems) return; el.disabled = true;
      try { const j = await api('POST', '/prospects/import', { prospects: importItems, confirm: true }); showReport(j, false); importItems = null; toast(nf(j.report.added) + ' prospect(s) ajouté(s)'); await loadStats(); refreshView(); }
      catch (e) { toast(e.message, true); el.disabled = false; }
    },
    'p-export': async () => {
      try {
        const r = await fetch('/api/crm/prospects/export?' + toQuery(Object.assign(queryObj(), { sort: P.sort || 'priority' })), { headers: { Authorization: 'Bearer ' + S.token } });
        if (!r.ok) throw new Error('Export impossible'); const blob = await r.blob();
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reynov-prospects-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      } catch (e) { toast(e.message, true); }
    },
    'p-select-mode': () => { P.selMode = !P.selMode; if (!P.selMode) P.sel.clear(); renderToolbar(); loadList(true); renderBulk(); },
    'p-bulk-clear': () => { P.sel.clear(); $$('#p-rows [data-pcheck]').forEach((c) => { c.checked = false; }); renderBulk(); },
    'p-bulk-apply': async () => {
      const f = $('#pb-field').value, v = $('#pb-val').value; if (!P.sel.size) return;
      if (f === 'relation' && (v === 'ne_pas_contacter' || v === 'refus') && !confirm('Classer ' + P.sel.size + ' prospect(s) en « ' + REL[v] + ' » ? Ils ne seront plus relancés.')) return;
      try { const j = await api('POST', '/prospects/bulk', { ids: [...P.sel], patch: { [f]: v } }); toast(j.updated + ' prospect(s) mis à jour'); P.sel.clear(); renderBulk(); await loadStats(); loadList(true); } catch (e) { toast(e.message, true); }
    },
    'p-call': (el) => { C.pendingCall = { kind: 'prospect', id: Number(el.dataset.id), name: nameOf(Number(el.dataset.id)), at: Date.now() }; },
    'p-wa': () => { /* le lien WhatsApp s'ouvre tout seul */ },
    'p-sms': () => { /* le lien SMS s'ouvre tout seul */ },
    'p-mail': (el) => openMail(Number(el.dataset.id)),
    'pm-refresh': () => mailPreview().catch(() => {}),
    'pm-copy': async () => { toast(await copy(P.mail ? P.mail.text : '') ? 'Texte copié' : 'Copie impossible', false); },
    'pm-send': async (el) => {
      if (!P.mail || !confirm('Envoyer cet e-mail à ' + P.mail.to + ' ?')) return;
      el.disabled = true;
      try {
        const j = await api('POST', '/prospects/' + P.mailId + '/email', { subject: $('#pm-subject').value, personal: $('#pm-personal').value });
        $('#dlg-pmail').close(); toast('E-mail envoyé à ' + P.mail.to + (j.changes && j.changes.length ? ' · ' + j.changes.join(' · ') : ''));
        if (P.open && P.open.id === P.mailId) { P.open = j.data; drawProspect(); } syncItem(j.data); loadStats();
      } catch (e) { toast(e.message, true); } finally { el.disabled = false; }
    },
    'p-save': () => saveForm(),
    'p-date': (el) => { const i = $('#pf-next_at'); if (i) { i.value = plusDays(Number(el.dataset.d)); P.dirty = true; $('#pf-save').classList.add('on'); } },
    'p-quick': (el) => {
      const res = el.dataset.result;
      if (res === 'rappeler') { const d = $('#pi-next').value; return interaction({ channel: el.dataset.channel, result: 'rappeler', note: $('#pi-note').value, next_at: d || plusDays(2) }); }
      interaction({ channel: el.dataset.channel, result: res, note: $('#pi-note').value, next_at: $('#pi-next').value || undefined });
    },
    'p-interaction': () => interaction({ channel: $('#pi-channel').value, result: $('#pi-result').value, note: $('#pi-note').value, next_at: $('#pi-next').value || undefined }),
    'p-copy-msg': async () => { toast(await copy($('#pm-text').value) ? 'Message copié' : 'Copie impossible'); },
    'p-wa-msg': (el) => { const t = bestTel(P.open); window.open('https://wa.me/' + waOf(t) + '?text=' + encodeURIComponent($('#pm-text').value), '_blank', 'noopener'); toast('WhatsApp ouvert : touchez ici une fois le message envoyé pour le noter', false, () => interaction({ channel: 'whatsapp', result: 'envoye', note: 'Message type envoyé' })); },
    'p-sms-msg': () => { const t = bestTel(P.open); location.href = 'sms:' + telOf(t) + '?&body=' + encodeURIComponent($('#pm-text').value); toast('Touchez ici une fois le SMS envoyé pour le noter', false, () => interaction({ channel: 'sms', result: 'envoye', note: 'Message type envoyé' })); },
    'p-never': async () => { if (!confirm('Ne plus jamais contacter ce prospect ? Il sera retiré des relances et des messages.')) return; await saveForm({ relation: 'ne_pas_contacter' }); },
    'p-erase': async () => {
      if (!P.open || !confirm('Supprimer TOUTES les données de « ' + P.open.name + ' » ? Cette action est définitive.')) return;
      try { await api('DELETE', '/prospects/' + P.open.id); P.dirty = false; P.items = P.items.filter((x) => x.id !== P.open.id); P.open = null; C.closeDrawer(); toast('Prospect supprimé'); await loadStats(); refreshView(); } catch (e) { toast(e.message, true); }
    },
  };
  const nameOf = (id) => { const x = P.items.find((i) => i.id === id) || (P.open && P.open.id === id ? P.open : null); return x ? x.name : ''; };
  Object.assign(C.actions, A);

  // Champs « relation » et « statut » de la fiche : enregistrés tout de suite, avec les autres saisies en cours
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches && t.matches('[data-pquick]') && P.open && $('#pf') && $('#pf').contains(t)) { saveForm({ [t.name]: t.value }); }
    else if (t.matches && t.matches('[data-pcheck]')) { const id = Number(t.dataset.id); if (t.checked) P.sel.add(id); else P.sel.delete(id); renderBulk(); }
  });

  // Résultat d'un appel (feuille affichée au retour dans l'appli : voir mobile.js)
  C.callResult = C.callResult || {};
  C.callResult.prospect = async (id, result) => {
    const labels = { pas_de_reponse: 'Appelé, pas de réponse', rappeler: 'À rappeler', interesse: 'Intéressé', refus: 'Refus' };
    const body = { channel: 'appel', result, note: labels[result] || '' }; if (result === 'rappeler') body.next_at = plusDays(2);
    try {
      const before = result === 'refus' ? (await api('GET', '/prospects/' + id)).data : null;      // pour pouvoir annuler un « refus » tapé par erreur
      const j = await api('POST', '/prospects/' + id + '/interactions', body);
      if (before) toast('Classé « Refus » : touchez ici pour annuler', false, async () => { try { await api('PATCH', '/prospects/' + id, { relation: before.relation, status: before.status, next_at: before.next_at, next_action: before.next_action }); toast('Refus annulé'); loadStats(); refreshView(); } catch (e) { toast(e.message, true); } });
      if (P.open && P.open.id === id) { P.open = j.data; drawProspect(); } syncItem(j.data);
      toast('Enregistré' + (j.changes && j.changes.length ? ' · ' + j.changes.join(' · ') : '')); loadStats();
    } catch (e) { toast(e.message, true); }
  };

  // Le bouton principal de la barre du haut devient « Nouveau prospect » dans cette vue
  C.on('view', (v) => { const b = $('.top-right .btn.primary'); if (!b) return; const pros = v === 'prospection'; b.dataset.action = pros ? 'p-new' : 'new-lead'; b.setAttribute('aria-label', pros ? 'Nouveau prospect' : 'Nouveau lead'); const l = b.querySelector('.lbl'); if (l) l.textContent = pros ? 'Nouveau prospect' : 'Nouveau lead'; });
  C.addView('prospection', { title: 'Prospection', admin: true, render: renderView });
  C.on('ready', loadStats); C.on('poll', loadStats);
  C.prospects = { open: openProspect, newDialog: () => A['p-new'](), refresh: refreshView, state: P };
})();
