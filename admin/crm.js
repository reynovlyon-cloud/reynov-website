/* REYNOV CRM — interface (aucun gestionnaire d'événement « en ligne » : tout passe par data-action) */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dec = (v) => String(v == null ? '' : v).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
  const txt = (v) => esc(dec(v));

  // ── Icônes ────────────────────────────────────────────────
  const P = (d, extra) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${extra || ''}>${d}</svg>`;
  const ICO = {
    grid: P('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    funnel: P('<path d="M3 5h18l-7 8v6l-4-2v-4z"/>'),
    users: P('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14.4c2.3.2 3.7 1.5 4.2 4"/>'),
    wrench: P('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.5-.5-.5-2.5z"/>'),
    chart: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    external: P('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    logout: P('<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9"/>'),
    menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    search: P('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    moon: P('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
    sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    download: P('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'),
    bell: P('<path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0"/>'),
    phone: P('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    wa: P('<path d="M3 21l1.6-4.6A8.5 8.5 0 1 1 8 19.5z"/><path d="M9 9.5c.3 2 2.2 3.9 4.5 4.5l1.2-1.2 2 1c-.3 1.4-1.6 2-2.7 1.8C9.8 15 7.7 11.7 8 9.9c.2-.9 1-1.7 2-1.4z"/>'),
    mail: P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    check: P('<path d="m5 12 5 5 9-10"/>'),
    sparkle: P('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'),
    trend: P('<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>'),
    calendar: P('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    userplus: P('<circle cx="10" cy="8" r="3.4"/><path d="M3.5 20c.6-3.6 3.2-5.4 6.5-5.4M18 9v6M15 12h6"/>'),
    bag: P('<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>'),
    alert: P('<path d="M12 3 2 20h20zM12 10v4M12 17.5v.1"/>'),
    copy: P('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
    send: P('<path d="M21 3 3 10.5l7 2.5 2.5 7zM21 3 10 13"/>'),
    mic: P('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    trash: P('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    close: P('<path d="M6 6l12 12M18 6 6 18"/>'),
  };
  const ico = (n) => ICO[n] || '';

  // ── Constantes ────────────────────────────────────────────
  const COLS = [
    { id: 'nouveau', label: 'Nouveaux leads', empty: 'Aucun nouveau lead' },
    { id: 'a_rappeler', label: 'À rappeler', empty: 'Rien à rappeler' },
    { id: 'contacte', label: 'Déjà contactés', empty: 'Aucun lead contacté' },
    { id: 'rdv', label: 'Rendez-vous confirmés', empty: 'Aucun rendez-vous' },
  ];
  const ST_LABEL = { nouveau: 'Nouveau', a_rappeler: 'À rappeler', contacte: 'Contacté', rdv: 'Rendez-vous confirmé', gagne: 'Gagné', perdu: 'Perdu' };
  const MISSING = { photos: 'Photos des jantes (vue d\'ensemble + gros plan)', vehicule: 'Marque et modèle du véhicule', taille: 'Taille des jantes', ville: 'Ville / code postal', nombre: 'Nombre de jantes', telephone: 'Téléphone (réponse par e-mail uniquement)' };
  const SRC = { devis: 'Formulaire devis', contact: 'Page contact', 'lp-renovation': 'Page pub rénovation', 'lp-reparation': 'Page pub réparation', manuel: 'Ajout manuel' };
  const INTER_ST = { nouveau: 'Nouveau devis', devis_envoye: 'Devis envoyé', confirme: 'Confirmé', en_cours: 'En cours', termine: 'Terminé', paye: 'Payé', annule: 'Annulé' };
  const AV_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#16a34a', '#ca8a04', '#6366f1', '#ef4444', '#0ea5e9'];

  const S = { token: '', cfg: { ai: false, email: false, categories: {}, statuses: [] }, leads: [], stats: null, biz: null, clients: [], inters: [], view: 'dashboard', cats: new Set(), q: '', openId: null, seen: new Set(), polled: false, visitDays: 30, lastNew: 0, wait: false, mail: null };

  // ── Utilitaires ───────────────────────────────────────────
  const fullName = (l) => ((l.prenom || '') + ' ' + (l.nom || '')).trim() || l.email || 'Sans nom';
  const initials = (l) => (((l.prenom || '?')[0] || '?') + ((l.nom || '')[0] || '')).toUpperCase();
  const avColor = (l) => AV_COLORS[(fullName(l).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AV_COLORS.length];
  const ago = (iso) => {
    if (!iso) return '';
    const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return 'à l\'instant';
    if (m < 60) return 'il y a ' + m + ' min';
    const h = Math.round(m / 60);
    if (h < 24) return 'il y a ' + h + ' h';
    const d = Math.round(h / 24);
    return d === 1 ? 'hier' : 'il y a ' + d + ' j';
  };
  const dt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const waNum = (tel) => {
    let d = String(tel || '').replace(/[^\d+]/g, '');
    if (d.startsWith('+')) d = d.slice(1);
    else if (d.startsWith('00')) d = d.slice(2);
    else if (d.startsWith('0')) d = '33' + d.slice(1);
    return d;
  };
  const catLabel = (id) => (S.cfg.categories[id] && S.cfg.categories[id].label) || id;
  const chip = (id) => `<span class="chip cat-${esc(id)}">${esc(catLabel(id))}</span>`;
  const stColor = (s) => ({ nouveau: 'var(--blue)', a_rappeler: 'var(--amber)', contacte: 'var(--violet)', rdv: 'var(--green)', gagne: 'var(--emerald)', perdu: 'var(--slate)' }[s] || 'var(--slate)');
  const prenomOf = (l) => l.prenom || '';
  const fill = (s, l) => String(s || '').replace(/\{\{prenom\}\}/g, prenomOf(l));

  function toast(msg, err, onclick) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    if (onclick) t.addEventListener('click', () => { onclick(); t.remove(); });
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), err ? 6000 : 4200);
  }

  async function api(method, path, body) {
    const r = await fetch('/api/crm' + path, {
      method,
      headers: Object.assign({ Authorization: 'Bearer ' + S.token }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 401) { logout(true); throw new Error('Session expirée'); }
    if (r.status === 429) throw new Error('Trop de requêtes, patientez un instant.');
    const j = await r.json().catch(() => ({ ok: false, error: 'Réponse invalide' }));
    if (!j.ok) throw new Error(j.error || 'Erreur');
    return j;
  }

  // ── Thème ─────────────────────────────────────────────────
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('crm_theme', t); } catch (e) { /* ignoré */ }
    const i = $('#theme-ico'); if (i) i.innerHTML = ico(t === 'dark' ? 'sun' : 'moon');
  }

  // ── Connexion ─────────────────────────────────────────────
  function logout(silent) {
    S.token = '';
    try { sessionStorage.removeItem('crm_token'); } catch (e) { /* ignoré */ }
    $('#app').hidden = true; $('#login').hidden = false;
    if (!silent) $('#pwd').value = '';
  }
  async function start(token) {
    S.token = token;
    const cfg = await api('GET', '/config');
    S.cfg = cfg.data;
    try { sessionStorage.setItem('crm_token', token); } catch (e) { /* ignoré */ }
    $('#login').hidden = true; $('#app').hidden = false;
    $$('[data-ico]').forEach((n) => { n.innerHTML = ico(n.getAttribute('data-ico')); });
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
    await refreshAll();
    S.polled = true;
    go((location.hash.replace(/^#\/?/, '') || 'dashboard'));
    setInterval(poll, 30000);
  }

  // ── Données ───────────────────────────────────────────────
  async function refreshAll() {
    const [l, st, biz] = await Promise.all([api('GET', '/leads'), api('GET', '/leads/stats'), api('GET', '/stats')]);
    S.leads = l.data; S.stats = st.data; S.biz = biz.data;
    S.leads.forEach((x) => S.seen.add(x.id));
    loadMail();
    updateBadge();
  }
  async function loadMail() {
    try { const [a, b] = await Promise.all([api('GET', '/mail/status'), api('GET', '/mail/report')]); S.mail = { status: a.data, report: b.data }; } catch (e) { /* facultatif */ }
  }
  async function poll() {
    try {
      const l = await api('GET', '/leads');
      const fresh = l.data.filter((x) => !S.seen.has(x.id));
      S.leads = l.data;
      l.data.forEach((x) => S.seen.add(x.id));
      S.stats = (await api('GET', '/leads/stats')).data;
      await loadMail();
      if (fresh.length) {
        fresh.slice(0, 3).forEach((x) => toast('Nouveau lead : ' + fullName(x), false, () => openLead(x.id)));
        if (window.Notification && Notification.permission === 'granted') {
          try { new Notification('REYNOV — nouveau lead', { body: fullName(fresh[0]) + ' · ' + ((fresh[0].triage && fresh[0].triage.summary) || '') }); } catch (e) { /* ignoré */ }
        }
      }
      updateBadge();
      if (!S.openId && (S.view === 'leads' || S.view === 'dashboard')) render();
    } catch (e) { /* silencieux */ }
  }
  function updateBadge() {
    const n = S.leads.filter((l) => l.status === 'nouveau' && !l.contacted).length;
    const b = $('#nav-badge'); b.hidden = !n; b.textContent = n;
    document.title = (n ? '(' + n + ') ' : '') + 'REYNOV — CRM';
  }

  // ── Navigation ────────────────────────────────────────────
  const TITLES = { dashboard: 'Tableau de bord', leads: 'Leads', clients: 'Clients', interventions: 'Interventions', stats: 'Statistiques', settings: 'Paramètres' };
  function go(view) {
    if (!TITLES[view]) view = 'dashboard';
    S.view = view;
    if (location.hash !== '#/' + view) history.replaceState(null, '', '#/' + view);
    $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + view; });
    $$('[data-nav]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-nav') === view));
    $('#view-title').textContent = TITLES[view];
    $('#global-search').placeholder = view === 'clients' ? 'Rechercher un client…' : 'Rechercher un lead, un client…';
    $('#sidebar').classList.remove('on');
    render();
  }
  function render() {
    ({ dashboard: renderDashboard, leads: renderLeads, clients: renderClients, interventions: renderInters, stats: renderStats, settings: renderSettings }[S.view] || renderDashboard)();
  }

  // ── Tableau de bord ───────────────────────────────────────
  function statCard(color, icon, label, val, sub) {
    return `<div class="card stat" style="--c:${color}"><span class="ico">${ico(icon)}</span><div class="lbl">${esc(label)}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;
  }
  function renderDashboard() {
    const st = S.stats || { by_status: {}, per_day: [], categories: {} };
    const nNew = S.leads.filter((l) => l.status === 'nouveau' && !l.contacted).length;
    $('#dash-sub').textContent = nNew ? 'Voici votre journée : ' + nNew + ' lead' + (nNew > 1 ? 's' : '') + ' à traiter.' : 'Voici votre journée : tout est à jour.';
    let alert = '';
    if (st.stale_24h) alert = `<div class="alert"><span>${ico('alert')}&nbsp; <strong>${st.stale_24h}</strong> lead${st.stale_24h > 1 ? 's' : ''} sans réponse depuis plus de 24 h.</span><button class="btn sm" data-nav="leads">Voir les leads</button></div>`;
    else if (st.reminders_due) alert = `<div class="alert"><span>${ico('clock')}&nbsp; <strong>${st.reminders_due}</strong> rappel${st.reminders_due > 1 ? 's' : ''} à faire aujourd'hui.</span><button class="btn sm" data-nav="leads">Voir les leads</button></div>`;
    else if (nNew) alert = `<div class="alert"><span>${ico('funnel')}&nbsp; <strong>${nNew}</strong> nouveau${nNew > 1 ? 'x' : ''} lead${nNew > 1 ? 's' : ''} à traiter.</span><button class="btn sm" data-nav="leads">Voir les leads</button></div>`;
    else alert = `<div class="alert ok"><span>${ico('check')}&nbsp; Aucun lead en attente.</span></div>`;
    const rp = S.mail && S.mail.report, ms = S.mail && S.mail.status;
    if (rp && ms && ms.state === 'ok' && rp.waiting) alert += `<div class="alert" style="margin-top:10px"><span>${ico('mail')}&nbsp; <strong>${rp.waiting}</strong> client${rp.waiting > 1 ? 's' : ''} attend${rp.waiting > 1 ? 'ent' : ''} une réponse${rp.waiting_over_3d ? ' (dont <strong>' + rp.waiting_over_3d + '</strong> depuis plus de 3 jours)' : ''}.</span><button class="btn sm" data-action="show-wait">Voir</button></div>`;
    $('#dash-alert').innerHTML = alert;
    const avg = st.avg_first_contact_min;
    const avgTxt = avg == null ? '—' : (avg < 60 ? avg + ' min' : Math.round(avg / 60 * 10) / 10 + ' h');
    $('#dash-stats').innerHTML =
      statCard('var(--blue)', 'funnel', 'Nouveaux leads à traiter', nNew, 'pas encore contactés') +
      statCard('var(--amber)', 'clock', 'À rappeler', st.by_status.a_rappeler || 0, (st.reminders_due || 0) + ' rappel(s) dû(s)') +
      statCard('var(--violet)', 'trend', 'Demandes reçues (7 jours)', st.last7 || 0, (st.last30 || 0) + ' sur 30 jours') +
      statCard('var(--green)', 'check', 'Délai moyen de 1er contact', avgTxt, (st.converted30 || 0) + ' lead(s) gagné(s) ce mois');
    // Graphique
    const days = st.per_day || [];
    const max = Math.max(1, ...days.map((d) => d.leads));
    $('#dash-chart').innerHTML = `<div class="bars">${days.map((d) => `<div class="b" data-v="${d.leads}" style="height:${Math.max(2, Math.round(d.leads / max * 100))}%" title="${esc(d.date)} : ${d.leads}"></div>`).join('')}</div><div class="bar-axis"><span>${esc((days[0] || {}).date || '')}</span><span>aujourd'hui</span></div>`;
    // Types
    const cats = Object.entries(st.categories || {}).sort((a, b) => b[1] - a[1]);
    const cmax = Math.max(1, ...cats.map((c) => c[1]));
    $('#dash-cats').innerHTML = cats.length ? cats.map(([c, n]) => `<div class="hbar cat-${esc(c)}"><span>${esc(catLabel(c))}</span><div class="track"><div class="fill" style="width:${Math.round(n / cmax * 100)}%"></div></div><span class="n">${n}</span></div>`).join('') : '<div class="empty">Pas encore de demandes</div>';
    // À traiter
    const due = S.leads.filter((l) => (l.status === 'nouveau' && !l.contacted) || (l.status === 'a_rappeler' && l.reminder_at && Date.parse(l.reminder_at) <= Date.now())).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 6);
    $('#dash-todo').innerHTML = due.length ? due.map(rowHtml).join('') : '<div class="empty">RIEN À TRAITER — TOUT EST À JOUR</div>';
    $('#dash-recent').innerHTML = S.leads.slice(0, 6).map(rowHtml).join('') || '<div class="empty">AUCUN LEAD</div>';
    const b = S.biz || {};
    $('#dash-biz').innerHTML =
      statCard('var(--slate)', 'users', 'Clients', b.total_clients || 0, 'dans la base') +
      statCard('var(--rose)', 'wrench', 'Interventions en cours', b.en_cours || 0, (b.nouveaux || 0) + ' nouveau(x) devis') +
      statCard('var(--emerald)', 'bag', 'Chiffre d\'affaires (mois)', (b.ca_mois || 0).toLocaleString('fr-FR') + ' €', (b.ca_total || 0).toLocaleString('fr-FR') + ' € au total (payé)') +
      statCard('var(--blue)', 'chart', 'Visites aujourd\'hui', b.visites_aujourd_hui || 0, (b.visites_total || 0).toLocaleString('fr-FR') + ' au total');
  }
  function rowHtml(l) {
    const t = l.triage || {};
    return `<div class="row" data-action="open" data-id="${l.id}"><span class="avatar" style="--c:${avColor(l)}">${esc(initials(l))}</span><div class="grow"><div class="t">${esc(fullName(l))}</div><div class="s">${esc(t.summary || (l.message || '').slice(0, 60))}</div></div><span class="faint" style="font-size:12px">${esc(ago(l.created_at))}</span></div>`;
  }

  // ── Leads (tableau) ───────────────────────────────────────
  function filteredLeads() {
    const q = S.q.toLowerCase();
    return S.leads.filter((l) => {
      if (S.wait && !waiting(l)) return false;
      if (S.cats.size && !((l.triage && l.triage.categories) || []).some((c) => S.cats.has(c))) return false;
      if (!q) return true;
      return [l.prenom, l.nom, l.email, l.tel, l.ville, l.message, (l.form || {}).marque, (l.form || {}).modele, l.triage && l.triage.summary].some((v) => v && String(v).toLowerCase().includes(q));
    });
  }
  const waiting = (l) => !!(l.reply && l.reply.waiting);
  function replyBadge(l) {
    const r = l.reply;
    if (!r || !r.waiting) return r && r.n_out ? `<div class="contact-state yes">${ico('mail')} ${r.n_out} réponse${r.n_out > 1 ? 's' : ''} envoyée${r.n_out > 1 ? 's' : ''}</div>` : '';
    return `<div class="contact-state wait">${ico('alert')} ${r.never ? 'Jamais répondu' : 'Attend une réponse'} · ${esc(ago(r.since))}</div>`;
  }
  function leadCard(l) {
    const t = l.triage || {};
    const cats = (t.categories || []).map(chip).join('');
    const urgent = t.urgency === 'haute' ? '<span class="chip urgent">Urgent</span>' : '';
    const state = l.contacted
      ? `<div class="contact-state yes">${ico('check')} Contacté${l.last_channel ? ' (' + esc({ email: 'e-mail', appel: 'appel', whatsapp: 'WhatsApp', sms: 'SMS' }[l.last_channel] || l.last_channel) + ')' : ''} · ${esc(ago(l.contacted_at))}</div>`
      : '<div class="contact-state no"><span class="dot" style="--c:var(--amber)"></span> Pas encore contacté</div>';
    const rem = l.status === 'a_rappeler' && l.reminder_at ? `<div class="contact-state no">${ico('clock')} Rappel : ${esc(dt(l.reminder_at))}</div>` : '';
    const actions = [
      l.tel ? `<a class="btn sm call" title="Appeler" aria-label="Appeler" href="tel:${esc(l.tel.replace(/[^\d+]/g, ''))}" data-action="call" data-id="${l.id}">${ico('phone')}<span class="lbl">Appeler</span></a>` : '',
      l.tel ? `<a class="btn sm wa" title="WhatsApp" aria-label="WhatsApp" href="https://wa.me/${esc(waNum(l.tel))}" target="_blank" rel="noopener" data-action="wa" data-id="${l.id}">${ico('wa')}<span class="lbl">WhatsApp</span></a>` : '',
      l.email ? `<button class="btn sm mail" title="Répondre par e-mail" aria-label="Répondre par e-mail" data-action="open" data-id="${l.id}" data-focus="reply">${ico('mail')}<span class="lbl">E-mail</span></button>` : '',
      `<button class="btn sm" data-action="open" data-id="${l.id}">Ouvrir</button>`,
    ].join('');
    return `<article class="lead-card" draggable="true" data-id="${l.id}" style="--c:${stColor(l.status)}">
      <div class="lead-top"><span class="avatar" style="--c:${avColor(l)};width:32px;height:32px">${esc(initials(l))}</span><span class="nm">${esc(fullName(l))}</span><span class="when">${esc(ago(l.created_at))}</span></div>
      <div class="lead-sum">${esc(t.summary || (l.message || '').slice(0, 120) || 'Sans détail')}</div>
      <div class="chips">${cats}${urgent}<span class="chip src">${esc(SRC[l.source] || l.source)}</span></div>
      ${state}${replyBadge(l)}${rem}<div class="card-actions">${actions}</div></article>`;
  }
  function colHtml(c, list) {
    return `<div class="col" data-status="${c.id}" style="--c:${stColor(c.id)}"><div class="col-h"><span class="dot" style="--c:${stColor(c.id)}"></span>${esc(c.label)}<span class="count">${list.length}</span></div>${list.map(leadCard).join('') || `<div class="empty">${esc(c.empty)}</div>`}</div>`;
  }
  function renderLeads() {
    const fl = filteredLeads();
    const present = Object.keys(S.cfg.categories).filter((c) => S.leads.some((l) => ((l.triage && l.triage.categories) || []).includes(c)));
    const nWait = S.leads.filter((l) => waiting(l)).length;
    $('#lead-filters').innerHTML = `<span class="chip wait${S.wait ? ' on' : ''}" data-action="filter-wait">Sans réponse (${nWait})</span>` + present.map((c) => `<span class="chip cat-${esc(c)}${S.cats.has(c) ? ' on' : ''}" data-action="filter-cat" data-cat="${esc(c)}">${esc(catLabel(c))}</span>`).join('');
    $('#board').innerHTML = COLS.map((c) => colHtml(c, fl.filter((l) => l.status === c.id))).join('');
    const done = fl.filter((l) => l.status === 'gagne' || l.status === 'perdu');
    $('#archived-sum').textContent = 'Terminés (' + done.length + ')';
    $('#board-done').innerHTML = [{ id: 'gagne', label: 'Gagnés', empty: 'Aucun' }, { id: 'perdu', label: 'Perdus', empty: 'Aucun' }].map((c) => colHtml(c, done.filter((l) => l.status === c.id))).join('');
  }

  // ── Fiche lead (tiroir) ───────────────────────────────────
  async function openLead(id, focus) {
    try {
      const j = await api('GET', '/leads/' + id);
      S.openId = id;
      drawLead(j.data, focus);
      $('#drawer').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('on');
      if (focus === 'reply') setTimeout(() => { const el = $('#reply-body'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250);
    } catch (e) { toast(e.message, true); }
  }
  function closeDrawer() {
    stopMic(); S.undo = null;
    S.openId = null;
    $('#drawer').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#overlay').classList.remove('on');
  }
  function kv(k, v) { return v ? `<dt>${esc(k)}</dt><dd>${esc(dec(v))}</dd>` : ''; }
  function drawLead(l, focus) {
    const t = l.triage || {};
    const f = l.form || {};
    const drafts = t.drafts || {};
    const cur = t.reply || drafts[t.primary] || { subject: '', body: '' };
    const allCats = Object.keys(S.cfg.categories);
    const wa = l.tel ? 'https://wa.me/' + waNum(l.tel) + '?text=' + encodeURIComponent(fill(t.whatsapp, l)) : '';
    const missing = (t.missing || []).filter((m) => MISSING[m]);
    const options = ['<option value="__auto">Réponse proposée (selon l\'analyse)</option>'].concat((t.categories || []).map((c) => `<option value="${esc(c)}">Modèle : ${esc(catLabel(c))}</option>`)).concat(allCats.filter((c) => !(t.categories || []).includes(c) && drafts[c]).map((c) => `<option value="${esc(c)}">Modèle : ${esc(catLabel(c))}</option>`)).join('');
    const events = (l.events || []).slice().reverse().map((e) => `<div class="tl ${esc(e.type)}">${esc(e.text)}<small>${esc(dt(e.ts))} · ${esc(ago(e.ts))}</small></div>`).join('');
    const stSel = db_status_options(l.status);
    const canMail = l.email && S.cfg.email;
    $('#drawer').innerHTML = `
    <div class="dr-head">
      <div class="dr-title"><span class="avatar" style="--c:${avColor(l)}">${esc(initials(l))}</span><h2>${esc(fullName(l))}</h2><button class="icon-btn" data-action="close-drawer" aria-label="Fermer">${ico('close')}</button></div>
      <div class="dr-meta"><span class="chip st-${esc(l.status)}"><span class="dot"></span>${esc(ST_LABEL[l.status] || l.status)}</span><span class="chip src">${esc(SRC[l.source] || l.source)}</span><span>Reçu ${esc(ago(l.created_at))}</span>${l.contacted ? `<span style="color:var(--violet)">· ${ico('check')} contacté ${esc(ago(l.contacted_at))}</span>` : '<span style="color:var(--amber)">· pas encore contacté</span>'}</div>
      <div class="dr-actions">
        ${l.tel ? `<a class="btn sm call" href="tel:${esc(l.tel.replace(/[^\d+]/g, ''))}" data-action="call" data-id="${l.id}">${ico('phone')}Appeler</a><a class="btn sm wa" href="${esc(wa)}" target="_blank" rel="noopener" data-action="wa" data-id="${l.id}">${ico('wa')}WhatsApp</a>` : ''}
        ${l.email ? `<button class="btn sm mail" data-action="scroll-reply">${ico('mail')}E-mail</button>` : ''}
        <button class="btn sm" data-action="mark-contacted" data-id="${l.id}">${ico('check')}Marquer contacté</button>
        <select class="mini" id="dr-status" data-id="${l.id}" aria-label="Statut">${stSel}</select>
      </div>
    </div>
    <div class="dr-body">
      <div class="card"><h4>Demande</h4>
        ${l.sujet ? `<div class="muted" style="margin-bottom:8px">${esc(l.sujet)}</div>` : ''}
        <div class="msg">${esc(l.message || '(aucun message — voir les informations ci-dessous)')}</div>
        <dl class="kv">${kv('E-mail', l.email)}${kv('Téléphone', l.tel)}${kv('Ville / CP', l.ville)}${kv('Adresse', l.adresse)}${kv('Prestation', f.prestation)}${kv('Problèmes', f.problemes)}${kv('Nombre de jantes', f.nb_jantes)}${kv('Véhicule', [f.marque, f.modele].filter(Boolean).join(' '))}${kv('Taille', f.taille)}${kv('Finition', f.finition)}${kv('Intervention', f.mode)}${kv('Délai souhaité', f.delai)}${f.photos ? kv('Photos jointes', f.photos + ' (reçues par e-mail)') : ''}</dl>
      </div>
      <div class="card ai-card"><h4>${ico('sparkle')} Analyse <span class="eng ${esc(t.engine || 'regles')}">${t.engine === 'ia' ? 'IA' : 'Automatique'}</span></h4>
        <div style="font-weight:650;margin-bottom:10px">${esc(t.summary || '—')}${t.urgency === 'haute' ? ' <span class="chip urgent">Urgent</span>' : ''}</div>
        <div class="seg" id="seg-cats">${allCats.filter((c) => c !== 'autre' || (t.categories || []).includes('autre')).map((c) => `<span class="chip cat-${esc(c)}${(t.categories || []).includes(c) ? ' on' : ''}" data-action="toggle-cat" data-cat="${esc(c)}">${esc(catLabel(c))}</span>`).join('')}</div>
        ${(t.price_hint || []).length ? `<p class="price" style="margin:14px 0 4px">Tarif indicatif</p><div class="muted">${(t.price_hint || []).map(esc).join('<br>')}</div>` : ''}
        ${missing.length ? `<p class="price" style="margin:14px 0 0">À demander au client</p><ul class="todo">${missing.map((m) => `<li>${esc(MISSING[m])}</li>`).join('')}</ul>` : '<p class="muted" style="margin:12px 0 0">Informations complètes pour établir le devis.</p>'}
        <div class="dr-actions" style="margin-top:14px">
          <button class="btn sm" data-action="analyze" data-engine="regles" data-id="${l.id}">Relancer l'analyse</button>
          ${S.cfg.ai ? `<button class="btn sm" data-action="analyze" data-engine="auto" data-id="${l.id}">${ico('sparkle')}Analyser avec l'IA</button>` : '<span class="faint" style="font-size:12px;align-self:center">IA non activée (voir Paramètres)</span>'}
        </div>
        ${t.ai_error ? `<p class="faint" style="font-size:12px;margin:8px 0 0">L'IA n'a pas répondu (${esc(t.ai_error)}) : analyse automatique utilisée.</p>` : ''}
      </div>
      <div class="card"><h4>${ico('mail')} Réponse proposée</h4>
        <div class="field"><label>Modèle</label><select class="input" id="reply-tpl" data-id="${l.id}">${options}</select></div>
        <div class="field"><label>Objet</label><input class="input" id="reply-subject" value="${esc(fill(cur.subject, l))}" /></div>
        <div class="voice-box">
          <label for="ai-instr">${ico('mic')} Dites à l'assistant ce que vous voulez</label>
          <textarea class="input" id="ai-instr" rows="2" placeholder="Ex. : propose-lui un rendez-vous jeudi à 10 h, précise que c'est 130 € la jante, ton plus chaleureux"></textarea>
          <div class="dr-actions">
            <button class="btn sm mic" data-action="mic" data-target="ai-instr">${ico('mic')}<span class="lbl">Dicter</span></button>
            <button class="btn primary sm" data-action="ai-rewrite" data-id="${l.id}" ${S.cfg.ai ? '' : 'disabled title="Assistant IA non activé"'}>Réécrire le message</button>
            <button class="btn sm" data-action="draft-undo" id="draft-undo" hidden>Revenir au texte précédent</button>
          </div>
          ${S.cfg.ai ? '' : '<p class="faint" style="font-size:12px;margin:8px 0 0">L\'assistant IA n\'est pas activé : la dictée directe dans le message ci-dessous fonctionne quand même (voir Paramètres pour l\'activer).</p>'}
        </div>
        <div class="field"><label>Message (modifiable)</label><textarea class="input reply" id="reply-body">${esc(fill(cur.body, l))}</textarea></div>
        <div class="dr-actions" style="margin-top:-4px"><button class="btn sm mic" data-action="mic" data-target="reply-body">${ico('mic')}<span class="lbl">Dicter dans le message</span></button><button class="btn sm" data-action="check-reply" data-id="${l.id}">${ico('check')}Vérifier le message</button></div>
        <div id="reply-checks" aria-live="polite"></div>
        <div class="dr-actions">
          <button class="btn primary sm" data-action="send-reply" data-id="${l.id}" ${canMail ? '' : 'disabled'}>${ico('send')}Envoyer par e-mail</button>
          <button class="btn sm" data-action="copy-reply">${ico('copy')}Copier</button>
          ${l.tel ? `<button class="btn sm wa" data-action="wa-reply" data-id="${l.id}">${ico('wa')}WhatsApp avec ce texte</button>` : ''}
        </div>
        ${!l.email ? '<p class="faint" style="font-size:12px;margin:10px 0 0">Pas d\'adresse e-mail pour ce lead : utilisez WhatsApp ou l\'appel.</p>' : (!S.cfg.email ? '<p class="faint" style="font-size:12px;margin:10px 0 0">Envoi d\'e-mails non configuré sur le serveur (voir Paramètres).</p>' : `<p class="faint" style="font-size:12px;margin:10px 0 0">Envoyé depuis votre adresse REYNOV à ${esc(l.email)}. Rien ne part sans votre clic.</p>`)}
      </div>
      <div class="card"><h4>${ico('calendar')} Rappel et notes</h4>
        <div class="field"><label>Me rappeler le</label><div style="display:flex;gap:8px"><input class="input" type="datetime-local" id="rem-at" value="${esc(l.reminder_at ? toLocalInput(l.reminder_at) : '')}" /><button class="btn sm" data-action="set-reminder" data-id="${l.id}">Programmer</button></div></div>
        <div class="field"><label>Notes internes</label><textarea class="input" id="lead-notes" data-id="${l.id}" rows="3" placeholder="Ex. : rappeler après 18 h, veut le noir mat…">${esc(l.notes || '')}</textarea></div>
        <div class="dr-actions"><button class="btn sm" data-action="set-status" data-status="rdv" data-id="${l.id}">Rendez-vous confirmé</button><button class="btn sm" data-action="set-status" data-status="gagne" data-id="${l.id}">Marquer gagné</button><button class="btn sm" data-action="set-status" data-status="perdu" data-id="${l.id}">Marquer perdu</button></div>
      </div>
      <div class="card"><h4>Historique</h4><div class="timeline">${events || '<div class="muted">Aucun événement</div>'}</div></div>
      <div><button class="btn sm danger" data-action="delete-lead" data-id="${l.id}">${ico('trash')}Supprimer ce lead</button></div>
    </div>`;
  }
  function db_status_options(cur) {
    return ['nouveau', 'a_rappeler', 'contacte', 'rdv', 'gagne', 'perdu'].map((s) => `<option value="${s}"${s === cur ? ' selected' : ''}>${esc(ST_LABEL[s])}</option>`).join('');
  }
  function toLocalInput(iso) {
    const d = new Date(iso); const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function replaceLead(l) {
    const i = S.leads.findIndex((x) => x.id === l.id);
    const slim = Object.assign({}, l);
    if (slim.triage) { slim.triage = Object.assign({}, slim.triage); delete slim.triage.drafts; delete slim.triage.reply; delete slim.triage.whatsapp; }
    if (i >= 0) S.leads[i] = Object.assign({}, S.leads[i], slim); else S.leads.unshift(slim);
    updateBadge();
  }
  async function patchLead(id, body, quiet) {
    const j = await api('PATCH', '/leads/' + id, body);
    replaceLead(j.data);
    if (!quiet) toast('Enregistré');
    return j.data;
  }
  async function logContact(id, channel) {
    try { const j = await api('POST', '/leads/' + id + '/contact', { channel }); replaceLead(j.data); if (S.view === 'leads' || S.view === 'dashboard') render(); } catch (e) { /* silencieux */ }
  }

  // ── Clients ───────────────────────────────────────────────
  async function renderClients() {
    try {
      const j = await api('GET', '/clients?q=' + encodeURIComponent(S.q || ''));
      S.clients = j.data;
      $('#clients-count').textContent = S.clients.length + ' client' + (S.clients.length > 1 ? 's' : '');
      $('#clients-body').innerHTML = S.clients.map((c) => `<tr class="click" data-action="open-client" data-id="${c.id}"><td><span style="display:flex;gap:10px;align-items:center"><span class="avatar" style="--c:${avColor(c)};width:30px;height:30px;font-size:12px">${esc(initials(c))}</span><strong>${txt(fullName(c))}</strong></span></td><td>${txt(c.email) || '—'}</td><td>${txt(c.tel) || '—'}</td><td>${txt(c.ville) || '—'}</td><td>${c.nb_interventions || 0}</td><td>${c.dernier_statut ? `<span class="chip">${esc(INTER_ST[c.dernier_statut] || c.dernier_statut)}</span>` : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">AUCUN CLIENT</td></tr>';
    } catch (e) { toast(e.message, true); }
  }
  async function openClient(id) {
    const f = $('#form-client'); f.reset();
    if (id) {
      const j = await api('GET', '/clients/' + id);
      const c = j.data;
      $('#client-title').textContent = fullName(c);
      ['id', 'prenom', 'nom', 'email', 'tel', 'ville', 'adresse', 'notes'].forEach((k) => { if (f.elements[k]) f.elements[k].value = dec(c[k] || ''); });
      $('#client-inters').innerHTML = (c.interventions || []).length ? '<strong style="color:var(--text)">Interventions</strong><br>' + c.interventions.map((i) => `· ${esc(dec(i.prestation) || 'Intervention')} ${esc(dec([i.marque, i.modele].filter(Boolean).join(' ')))} — ${esc(INTER_ST[i.statut] || i.statut)}${i.montant ? ' — ' + esc(i.montant) + ' €' : ''}`).join('<br>') : '';
      $('#btn-del-client').hidden = false;
    } else {
      $('#client-title').textContent = 'Nouveau client'; f.elements.id.value = ''; $('#client-inters').innerHTML = ''; $('#btn-del-client').hidden = true;
    }
    $('#dlg-client').showModal();
  }

  // ── Interventions ─────────────────────────────────────────
  async function renderInters() {
    try {
      const j = await api('GET', '/interventions');
      S.inters = j.data;
      const sel = $('#inter-filter');
      if (sel.options.length === 1) Object.entries(INTER_ST).forEach(([k, v]) => sel.insertAdjacentHTML('beforeend', `<option value="${k}">${esc(v)}</option>`));
      const fl = S.inters.filter((i) => !sel.value || i.statut === sel.value).filter((i) => !S.q || [i.prenom, i.nom, i.marque, i.modele, i.prestation].some((v) => v && dec(v).toLowerCase().includes(S.q.toLowerCase())));
      $('#inter-body').innerHTML = fl.map((i) => `<tr><td><strong>${txt(fullName(i))}</strong></td><td>${txt(i.prestation) || '—'}</td><td>${txt([i.marque, i.modele].filter(Boolean).join(' ')) || '—'}</td><td><select class="mini" data-action="inter-status" data-id="${i.id}">${Object.entries(INTER_ST).map(([k, v]) => `<option value="${k}"${k === i.statut ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></td><td><input class="mini money" type="number" min="0" value="${esc(i.montant || '')}" data-action="inter-money" data-id="${i.id}" /></td><td class="muted">${esc(dt(i.created_at))}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">AUCUNE INTERVENTION</td></tr>';
    } catch (e) { toast(e.message, true); }
  }

  // ── Statistiques ──────────────────────────────────────────
  async function renderStats() {
    const b = S.biz || {}; const st = S.stats || { sources: {}, by_status: {} };
    $('#stats-top').innerHTML =
      statCard('var(--violet)', 'funnel', 'Leads (30 jours)', st.last30 || 0, (st.total || 0) + ' au total') +
      statCard('var(--green)', 'check', 'Leads gagnés (30 jours)', st.converted30 || 0, 'taux : ' + (st.last30 ? Math.round((st.converted30 || 0) / st.last30 * 100) : 0) + ' %') +
      statCard('var(--emerald)', 'bag', 'Chiffre d\'affaires (mois)', (b.ca_mois || 0).toLocaleString('fr-FR') + ' €', 'interventions payées') +
      statCard('var(--blue)', 'chart', 'Visites (total)', (b.visites_total || 0).toLocaleString('fr-FR'), (b.visites_aujourd_hui || 0) + ' aujourd\'hui');
    const src = Object.entries(st.sources || {}).sort((a, b2) => b2[1] - a[1]); const smax = Math.max(1, ...src.map((s) => s[1]));
    $('#stats-sources').innerHTML = src.length ? src.map(([k, n]) => `<div class="hbar" style="--c:var(--violet)"><span>${esc(SRC[k] || k)}</span><div class="track"><div class="fill" style="width:${Math.round(n / smax * 100)}%"></div></div><span class="n">${n}</span></div>`).join('') : '<div class="empty">Pas encore de données</div>';
    $('#visit-range').innerHTML = [7, 30, 90].map((d) => `<span class="chip${S.visitDays === d ? ' on' : ''}" data-action="visit-range" data-days="${d}">${d} j</span>`).join('');
    try {
      const v = (await api('GET', '/visits?days=' + S.visitDays)).data;
      const max = Math.max(1, ...v.map((x) => x.visits));
      $('#visit-chart').innerHTML = `<div class="bars">${v.map((d) => `<div class="b" data-v="${d.visits}" style="height:${Math.max(2, Math.round(d.visits / max * 100))}%" title="${esc(d.date)} : ${d.visits}"></div>`).join('')}</div><div class="bar-axis"><span>${esc(v[0] ? v[0].date : '')}</span><span>aujourd'hui</span></div>`;
    } catch (e) { /* ignoré */ }
  }

  // ── Paramètres ────────────────────────────────────────────
  function renderSettings() {
    $('#set-ai').innerHTML = S.cfg.ai
      ? '<p><span class="chip st-rdv"><span class="dot"></span>Activée</span></p><p class="muted">Les messages sont analysés et une réponse est rédigée par l\'IA. Le nom, l\'e-mail et le téléphone du client ne lui sont jamais transmis. Rien n\'est envoyé sans votre clic.</p>'
      : '<p><span class="chip"><span class="dot" style="--c:var(--amber)"></span>Non activée</span></p><p class="muted">Le tri et les réponses proposées fonctionnent déjà sans IA (règles automatiques). Pour ajouter l\'IA : créez une clé sur console.anthropic.com, puis ajoutez la variable <strong>ANTHROPIC_API_KEY</strong> dans Railway (Variables) et redéployez.</p>';
    $('#set-mail').innerHTML = S.cfg.email
      ? '<p><span class="chip st-rdv"><span class="dot"></span>Prêt</span></p><p class="muted">Les réponses partent de votre adresse REYNOV (Gmail) et apparaissent dans vos « Envoyés ».</p>'
      : '<p><span class="chip"><span class="dot" style="--c:var(--amber)"></span>Non configuré</span></p><p class="muted">Variables Gmail manquantes sur le serveur : l\'envoi depuis le CRM est désactivé (appel et WhatsApp restent disponibles).</p>';
    const ms = S.mail && S.mail.status, rp = S.mail && S.mail.report;
    let h;
    if (!ms) h = '<p class="muted">Chargement…</p>';
    else if (!ms.enabled) h = '<p><span class="chip"><span class="dot" style="--c:var(--amber)"></span>Indisponible</span></p><p class="muted">Gmail n\'est pas configuré sur le serveur.</p>';
    else if (ms.state === 'scope_missing') h = '<p><span class="chip"><span class="dot" style="--c:var(--amber)"></span>En attente d\'autorisation</span></p><p class="muted">Le CRM n\'a pas encore le droit de <strong>lire</strong> votre boîte Gmail. Suivez le guide « Connecter Gmail » puis remplacez la variable <strong>GMAIL_REFRESH_TOKEN</strong> dans Railway.</p>';
    else if (ms.state === 'token_error') h = '<p><span class="chip"><span class="dot" style="--c:var(--rose)"></span>Connexion expirée</span></p><p class="muted">Google a refusé le jeton de connexion. Il faut en générer un nouveau (voir le guide) et remplacer <strong>GMAIL_REFRESH_TOKEN</strong> dans Railway.</p>';
    else {
      const pct = ms.leads_total ? Math.round(ms.leads_synced / ms.leads_total * 100) : 100;
      h = `<p><span class="chip st-rdv"><span class="dot"></span>${ms.state === 'error' ? 'Erreur temporaire' : 'Connecté'}</span></p><p class="muted">${ms.devis_done ? 'Historique analysé : ' + pct + ' % (' + ms.leads_synced + ' / ' + ms.leads_total + ' clients).' : 'Recherche des anciens devis dans votre boîte…'} ${ms.counts.in} e-mail(s) reçus et ${ms.counts.out} envoyés rattachés aux fiches. ${ms.last_ok ? 'Dernière synchro ' + esc(ago(ms.last_ok)) + '.' : ''}${ms.error ? ' <br>' + esc(ms.error) : ''}</p>` +
        (rp ? `<p class="muted"><strong>${rp.waiting}</strong> client(s) attendent une réponse · <strong>${rp.never_answered}</strong> jamais répondu(s)${rp.avg_first_reply_hours != null ? ' · délai moyen de 1re réponse : <strong>' + rp.avg_first_reply_hours + ' h</strong>' : ''}</p>` : '');
    }
    $('#set-sync').innerHTML = h + (ms && ms.enabled && ms.state !== 'scope_missing' ? `<button class="btn" data-action="sync-now">${ico('mail')}Synchroniser maintenant</button>` : '');
    const nb = $('#notif-btn'); if (window.Notification && Notification.permission === 'granted') nb.innerHTML = ico('bell') + 'Notifications activées';
  }

  // ── Dictée vocale (navigateur) et contrôle des messages ──
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, recBtn = null;
  function stopMic() {
    if (rec) { try { rec.stop(); } catch (e) { /* déjà arrêté */ } }
  }
  function resetMicBtn(btn) { if (btn) { btn.classList.remove('rec'); const l = btn.querySelector('.lbl'); if (l && btn.dataset.lbl) l.textContent = btn.dataset.lbl; } }
  function speechFix(t, forMessage) {
    t = t.replace(/\s+/g, ' ');
    if (forMessage) t = t.replace(/\s*\bpoint d'interrogation\b/gi, ' ?').replace(/\s*\bpoint final\b/gi, '.').replace(/\s*\bdeux points\b/gi, ' :').replace(/\s*\bvirgule\b/gi, ',').replace(/\s*\b(?:à la ligne|nouvelle ligne)\b\s*/gi, '\n').replace(/\s*\bnouveau paragraphe\b\s*/gi, '\n\n');
    return t;
  }
  function micToggle(btn) {
    if (!SR) return toast('La dictée n\'est pas disponible sur ce navigateur. Utilisez Chrome ou Safari.', true);
    if (rec && recBtn === btn) { stopMic(); return; }
    stopMic();
    const target = $('#' + btn.dataset.target); if (!target) return;
    const forMessage = btn.dataset.target === 'reply-body';
    const base = target.value + (target.value && !/\s$/.test(target.value) ? ' ' : '');
    const r = new SR(); r.lang = 'fr-FR'; r.continuous = true; r.interimResults = true;
    btn.dataset.lbl = btn.dataset.lbl || (btn.querySelector('.lbl') || {}).textContent || '';
    r.onresult = (e) => {
      let txt = ''; for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript + ' ';
      target.value = base + speechFix(txt.trim(), forMessage);
    };
    r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Micro refusé. Cliquez sur le cadenas à côté de l\'adresse du site, autorisez le micro, puis réessayez.', true); else if (e.error === 'no-speech') toast('Je n\'ai rien entendu. Réessayez.', true); else if (e.error !== 'aborted') toast('Dictée interrompue (' + e.error + ').', true); };
    r.onend = () => { resetMicBtn(btn); if (rec === r) { rec = null; recBtn = null; } };
    try { r.start(); } catch (e) { return toast('Impossible de démarrer le micro.', true); }
    rec = r; recBtn = btn; btn.classList.add('rec'); const lb = btn.querySelector('.lbl'); if (lb) lb.textContent = 'Arrêter';
  }
  function showChecks(list, announce) {
    const box = $('#reply-checks'); if (!box) return;
    box.innerHTML = list.length ? list.map((c) => `<div class="chk ${c.level === 'warn' ? 'warn' : 'info'}">${ico(c.level === 'warn' ? 'alert' : 'check')}<span>${esc(c.text)}</span></div>`).join('') : (announce ? `<div class="chk ok">${ico('check')}<span>Rien à signaler : prix, garantie et prénom sont cohérents.</span></div>` : '');
  }

  // ── Actions (délégation) ──────────────────────────────────
  async function setStatus(id, status) {
    const l = S.leads.find((x) => x.id === Number(id));
    if (l && l.status === status) return;
    const body = { status };
    if (status !== 'a_rappeler') body.reminder_at = null;
    await patchLead(id, body, true);
    toast(ST_LABEL[status]);
    refreshStatsSoon(); render();
    if (S.openId === Number(id)) openLead(id);
  }
  let statsT; function refreshStatsSoon() { clearTimeout(statsT); statsT = setTimeout(async () => { try { S.stats = (await api('GET', '/leads/stats')).data; if (S.view === 'dashboard') render(); } catch (e) { /* ignoré */ } }, 400); }

  const actions = {
    nav: (el) => go(el.getAttribute('data-nav')),
    menu: () => $('#sidebar').classList.toggle('on'),
    theme: () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'),
    logout: () => logout(),
    open: (el) => openLead(Number(el.dataset.id), el.dataset.focus),
    'close-drawer': () => closeDrawer(),
    'scroll-reply': () => { const e = $('#reply-body'); if (e) { e.scrollIntoView({ behavior: 'smooth', block: 'center' }); e.focus(); } },
    'new-lead': () => { $('#form-lead').reset(); $('#dlg-lead').showModal(); },
    'close-dlg': (el) => el.closest('dialog').close(),
    'show-wait': () => { S.wait = true; go('leads'); },
    'filter-wait': () => { S.wait = !S.wait; renderLeads(); },
    'sync-now': async () => { try { await api('POST', '/mail/sync'); toast('Synchronisation lancée'); setTimeout(async () => { await loadMail(); if (S.view === 'settings') renderSettings(); }, 4000); } catch (e) { toast(e.message, true); } },
    'filter-cat': (el) => { const c = el.dataset.cat; S.cats.has(c) ? S.cats.delete(c) : S.cats.add(c); renderLeads(); },
    call: (el) => { logContact(Number(el.dataset.id), 'appel'); },
    wa: (el) => { logContact(Number(el.dataset.id), 'whatsapp'); },
    'mark-contacted': async (el) => { await logContact(Number(el.dataset.id), 'autre'); toast('Marqué comme contacté'); openLead(Number(el.dataset.id)); },
    'set-status': (el) => setStatus(Number(el.dataset.id), el.dataset.status),
    'toggle-cat': async (el) => {
      const l = S.leads.find((x) => x.id === S.openId); if (!l) return;
      const cur = new Set((l.triage && l.triage.categories) || []);
      const c = el.dataset.cat; cur.has(c) ? cur.delete(c) : cur.add(c);
      const arr = Array.from(cur); if (!arr.length) arr.push('autre');
      try { await patchLead(S.openId, { categories: arr }, true); openLead(S.openId); render(); } catch (e) { toast(e.message, true); }
    },
    analyze: async (el) => {
      const id = Number(el.dataset.id); el.disabled = true; el.textContent = 'Analyse…';
      try { const j = await api('POST', '/leads/' + id + '/analyze', { engine: el.dataset.engine }); replaceLead(j.data); toast(j.data.triage && j.data.triage.engine === 'ia' ? 'Analyse IA terminée' : 'Analyse mise à jour'); openLead(id); render(); } catch (e) { toast(e.message, true); el.disabled = false; }
    },
    'send-reply': async (el) => {
      const id = Number(el.dataset.id); const l = S.leads.find((x) => x.id === id);
      const subject = $('#reply-subject').value.trim(); const body = $('#reply-body').value.trim();
      if (!subject || body.length < 10) return toast('Objet et message requis.', true);
      let warns = [];
      try { warns = (await api('POST', '/leads/' + id + '/check', { subject, body, instruction: ($('#ai-instr') || {}).value || '' })).data.filter((c) => c.level === 'warn'); showChecks(await Promise.resolve(warns)); } catch (e) { /* contrôle facultatif */ }
      if (!confirm((warns.length ? 'Attention, ' + warns.length + ' point(s) à vérifier :\n- ' + warns.map((c) => c.text).join('\n- ') + '\n\n' : '') + 'Envoyer cet e-mail à ' + (l && l.email) + ' ?')) return;
      el.disabled = true;
      try { const j = await api('POST', '/leads/' + id + '/reply', { subject, body }); replaceLead(j.data); toast('E-mail envoyé'); openLead(id); render(); } catch (e) { toast(e.message, true); el.disabled = false; }
    },
    mic: (el) => micToggle(el),
    'check-reply': async (el) => { try { const j = await api('POST', '/leads/' + el.dataset.id + '/check', { subject: $('#reply-subject').value, body: $('#reply-body').value, instruction: $('#ai-instr').value }); showChecks(j.data, true); } catch (e) { toast(e.message, true); } },
    'ai-rewrite': async (el) => {
      const instruction = $('#ai-instr').value.trim();
      if (instruction.length < 4) return toast('Dites ou écrivez d\'abord ce que vous voulez changer.', true);
      stopMic(); el.disabled = true; const old = el.textContent; el.textContent = 'Réécriture…';
      try {
        const prev = { subject: $('#reply-subject').value, body: $('#reply-body').value };
        const j = await api('POST', '/leads/' + el.dataset.id + '/draft', { instruction, subject: prev.subject, body: prev.body });
        S.undo = prev; $('#reply-subject').value = j.data.subject; $('#reply-body').value = j.data.body;
        $('#draft-undo').hidden = false; showChecks((j.data.notes || []).map((n) => ({ level: 'info', text: 'Assistant : ' + n })).concat(j.data.checks || []), true);
        toast('Message réécrit : relisez-le avant d\'envoyer');
      } catch (e) { toast(e.message, true); }
      el.disabled = false; el.textContent = old;
    },
    'draft-undo': (el) => { if (!S.undo) return; $('#reply-subject').value = S.undo.subject; $('#reply-body').value = S.undo.body; S.undo = null; el.hidden = true; showChecks([], false); },
    'copy-reply': async () => { try { await navigator.clipboard.writeText($('#reply-body').value); toast('Texte copié'); } catch (e) { $('#reply-body').select(); document.execCommand('copy'); toast('Texte copié'); } },
    'wa-reply': (el) => { const l = S.leads.find((x) => x.id === Number(el.dataset.id)); if (!l) return; window.open('https://wa.me/' + waNum(l.tel) + '?text=' + encodeURIComponent($('#reply-body').value), '_blank', 'noopener'); logContact(l.id, 'whatsapp'); },
    'set-reminder': async (el) => {
      const v = $('#rem-at').value; if (!v) return toast('Choisissez une date.', true);
      try { await patchLead(Number(el.dataset.id), { status: 'a_rappeler', reminder_at: new Date(v).toISOString() }); render(); openLead(Number(el.dataset.id)); } catch (e) { toast(e.message, true); }
    },
    'delete-lead': async (el) => {
      if (!confirm('Supprimer définitivement ce lead ?')) return;
      try { await api('DELETE', '/leads/' + el.dataset.id); S.leads = S.leads.filter((x) => x.id !== Number(el.dataset.id)); closeDrawer(); updateBadge(); render(); toast('Lead supprimé'); } catch (e) { toast(e.message, true); }
    },
    'new-client': () => openClient(null),
    'open-client': (el) => openClient(Number(el.dataset.id)),
    'delete-client': async () => {
      const id = $('#form-client').elements.id.value; if (!id || !confirm('Supprimer ce client et ses interventions ?')) return;
      try { await api('DELETE', '/clients/' + id); $('#dlg-client').close(); renderClients(); toast('Client supprimé'); } catch (e) { toast(e.message, true); }
    },
    'new-inter': async () => {
      const j = await api('GET', '/clients'); $('#inter-client').innerHTML = '<option value="">—</option>' + j.data.map((c) => `<option value="${c.id}">${txt(fullName(c))}</option>`).join('');
      $('#form-inter').reset(); $('#dlg-inter').showModal();
    },
    'visit-range': (el) => { S.visitDays = Number(el.dataset.days); renderStats(); },
    export: async () => {
      try {
        const r = await fetch('/api/crm/export', { headers: { Authorization: 'Bearer ' + S.token } });
        const b = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'reynov-crm-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch (e) { toast('Export impossible', true); }
    },
    import: () => { const f = $('#import-file'); f.value = ''; f.click(); },
    notif: async () => {
      if (!window.Notification) return toast('Notifications non disponibles sur ce navigateur.', true);
      const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Notifications activées' : 'Notifications refusées'); renderSettings();
    },
  };

  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); return go(nav.getAttribute('data-nav')); }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = actions[el.getAttribute('data-action')];
    if (!fn) return;
    // Les liens tel:/WhatsApp gardent leur comportement natif (on journalise seulement)
    if (!(el.tagName === 'A' && /^(call|wa)$/.test(el.getAttribute('data-action')))) e.stopPropagation();
    // clic sur un bouton d'une carte : ne pas ouvrir la fiche en plus
    fn(el, e);
  });
  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'dr-status') { try { await setStatus(Number(t.dataset.id), t.value); } catch (er) { toast(er.message, true); } }
    else if (t.id === 'reply-tpl') {
      const l = await api('GET', '/leads/' + t.dataset.id).then((j) => j.data);
      const tri = l.triage || {}; const d = t.value === '__auto' ? (tri.reply || tri.drafts[tri.primary]) : tri.drafts[t.value];
      if (d) { $('#reply-subject').value = fill(d.subject, l); $('#reply-body').value = fill(d.body, l); }
    } else if (t.id === 'import-file') {
      const file = t.files && t.files[0]; if (!file) return;
      const out = $('#import-result'); out.textContent = 'Lecture du fichier…';
      try {
        const data = JSON.parse(await file.text());
        const leads = Array.isArray(data) ? data : data.leads;
        if (!Array.isArray(leads) || !leads.length) throw new Error('Fichier vide ou invalide.');
        if (!confirm('Importer ' + leads.length + ' demande(s) dans « ' + $('#import-status').selectedOptions[0].textContent + ' » ?')) { out.textContent = ''; return; }
        out.textContent = 'Import en cours…';
        const j = await api('POST', '/leads/import', { leads, status: $('#import-status').value });
        out.innerHTML = '<strong style="color:var(--text)">' + j.added + ' ajoutée(s)</strong> · ' + j.duplicates + ' déjà présente(s) · ' + j.skipped + ' ignorée(s)';
        toast(j.added + ' demande(s) importée(s)');
        await refreshAll(); render();
      } catch (er) { out.textContent = ''; toast(er.message || 'Import impossible', true); }
    } else if (t.id === 'inter-filter') renderInters();
    else if (t.getAttribute('data-action') === 'inter-status') { try { const i = S.inters.find((x) => x.id === Number(t.dataset.id)); await api('PUT', '/interventions/' + t.dataset.id, { statut: t.value, montant: i && i.montant, notes: (i && i.notes) || '' }); if (i) i.statut = t.value; toast('Statut mis à jour'); } catch (er) { toast(er.message, true); } }
    else if (t.getAttribute('data-action') === 'inter-money') { try { const i = S.inters.find((x) => x.id === Number(t.dataset.id)); await api('PUT', '/interventions/' + t.dataset.id, { statut: i && i.statut, montant: t.value || null, notes: (i && i.notes) || '' }); if (i) i.montant = t.value; toast('Montant enregistré'); } catch (er) { toast(er.message, true); } }
  });
  document.addEventListener('focusout', async (e) => {
    if (e.target.id === 'lead-notes') { try { await patchLead(Number(e.target.dataset.id), { notes: e.target.value }, true); } catch (er) { toast(er.message, true); } }
  });

  // Cartes : clic sur la carte = ouvrir la fiche
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.lead-card');
    if (card && !e.target.closest('a,button,select')) openLead(Number(card.dataset.id));
  });

  // Glisser-déposer des fiches
  document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('.lead-card'); if (!c) return; e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'move'; c.classList.add('dragging'); });
  document.addEventListener('dragend', (e) => { const c = e.target.closest && e.target.closest('.lead-card'); if (c) c.classList.remove('dragging'); $$('.col.over').forEach((x) => x.classList.remove('over')); });
  document.addEventListener('dragover', (e) => { const col = e.target.closest && e.target.closest('.col'); if (!col) return; e.preventDefault(); $$('.col.over').forEach((x) => { if (x !== col) x.classList.remove('over'); }); col.classList.add('over'); });
  document.addEventListener('drop', async (e) => {
    const col = e.target.closest && e.target.closest('.col'); if (!col) return;
    e.preventDefault(); col.classList.remove('over');
    const id = Number(e.dataTransfer.getData('text/plain')); if (!id) return;
    try { await setStatus(id, col.dataset.status); } catch (er) { toast(er.message, true); }
  });

  // Recherche globale
  let qT;
  $('#global-search').addEventListener('input', (e) => { S.q = e.target.value.trim(); clearTimeout(qT); qT = setTimeout(() => { if (S.view === 'clients') renderClients(); else if (S.view === 'interventions') renderInters(); else if (S.view === 'dashboard') { if (S.q) go('leads'); } else render(); }, 220); });

  // Formulaires
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#login-err').textContent = '';
    try { await start($('#pwd').value.trim()); } catch (er) { $('#login-err').textContent = /Trop/.test(er.message) ? er.message : 'Mot de passe incorrect'; S.token = ''; }
  });
  $('#form-lead').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    try { const j = await api('POST', '/leads', f); $('#dlg-lead').close(); replaceLead(j.data); S.seen.add(j.data.id); go('leads'); toast('Lead créé et analysé'); openLead(j.data.id); } catch (er) { toast(er.message, true); }
  });
  $('#form-client').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    try { if (f.id) await api('PUT', '/clients/' + f.id, f); else await api('POST', '/clients', f); $('#dlg-client').close(); renderClients(); toast('Client enregistré'); } catch (er) { toast(er.message, true); }
  });
  $('#form-inter').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    if (!f.client_id) return toast('Choisissez un client.', true);
    try { await api('POST', '/interventions', Object.assign({ statut: 'confirme' }, f)); $('#dlg-inter').close(); renderInters(); toast('Intervention créée'); } catch (er) { toast(er.message, true); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.openId) closeDrawer(); });
  window.addEventListener('hashchange', () => { if (S.token) go(location.hash.replace(/^#\/?/, '')); });

  // ── Démarrage ─────────────────────────────────────────────
  applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
  let saved = ''; try { saved = sessionStorage.getItem('crm_token') || ''; } catch (e) { /* ignoré */ }
  if (saved) start(saved).catch(() => logout(true));
})();
