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
    share: P('<path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
    image: P('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>'),
    doc: P('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
    speaker: P('<path d="M4 10v4h4l5 4V6L8 10zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>'),
    route: P('<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/>'),
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
  const SRC = { devis: 'Formulaire devis', contact: 'Page contact', 'lp-renovation': 'Page pub rénovation', 'lp-reparation': 'Page pub réparation', pro: 'Formulaire professionnels', manuel: 'Ajout manuel' };
  const INTER_ST = { nouveau: 'Nouveau devis', devis_envoye: 'Devis envoyé', confirme: 'Confirmé', en_cours: 'En cours', termine: 'Terminé', paye: 'Payé', annule: 'Annulé' };
  const AV_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#16a34a', '#ca8a04', '#6366f1', '#ef4444', '#0ea5e9'];

  const S = { token: '', cfg: { ai: false, email: false, categories: {}, statuses: [] }, leads: [], stats: null, biz: null, clients: [], inters: [], view: 'dashboard', cats: new Set(), q: '', openId: null, seen: new Set(), polled: false, visitDays: 30, lastNew: 0, wait: false, mail: null, events: [], cal: null, calStatus: null, calList: null, today: null, quotes: [], leadQuotes: [], qSel: null, user: null, users: [], mine: false, chMine: false, chantiers: [], chSel: null, posts: [], postSel: null, igStatus: null, photoCache: {}, team: [] };

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
    if (!silent) { $('#pwd').value = ''; $('#usr').value = ''; }
  }
  async function start(token) {
    S.token = token;
    const cfg = await api('GET', '/config');
    S.cfg = cfg.data; S.user = S.cfg.user || { id: 0, name: 'Administrateur', role: 'admin' };
    document.body.classList.toggle('role-employe', S.user.role !== 'admin');
    $('#who-me').textContent = S.user.name + (S.user.role === 'admin' ? ' · administrateur' : '');
    try { S.users = (await api('GET', '/users/basic')).data; } catch (e) { S.users = []; }
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
    const [l, st, biz] = await Promise.all([api('GET', '/leads'), api('GET', '/leads/stats'), isAdmin() ? api('GET', '/stats') : Promise.resolve({ data: null })]);
    S.leads = l.data; S.stats = st.data; S.biz = biz.data;
    S.leads.forEach((x) => S.seen.add(x.id));
    loadMail();
    loadCal().then(() => { if (S.view === 'settings') renderSettings(); });
    updateBadge();
  }
  async function loadMail() {
    if (!isAdmin()) return;
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
  const ADMIN_VIEWS = ['devis', 'interventions', 'stats', 'settings'];
  const isAdmin = () => !S.user || S.user.role === 'admin';
  const TITLES = { dashboard: 'Tableau de bord', leads: 'Leads', clients: 'Clients', interventions: 'Interventions', stats: 'Statistiques', planning: 'Planning', chantiers: 'Chantiers', publications: 'Publications', devis: 'Devis', settings: 'Paramètres' };
  function go(view) {
    if (!TITLES[view] || (ADMIN_VIEWS.includes(view) && !isAdmin())) view = 'dashboard';
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
    ({ dashboard: renderDashboard, leads: renderLeads, clients: renderClients, interventions: renderInters, stats: renderStats, planning: renderPlanning, chantiers: renderChantiers, publications: renderPublications, devis: renderDevis, settings: renderSettings }[S.view] || renderDashboard)();
  }

  // ── Tableau de bord ───────────────────────────────────────
  function statCard(color, icon, label, val, sub) {
    return `<div class="card stat" style="--c:${color}"><span class="ico">${ico(icon)}</span><div class="lbl">${esc(label)}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;
  }
  function renderDashboard() {
    const st = S.stats || { by_status: {}, per_day: [], categories: {} };
    const nNew = S.leads.filter((l) => l.status === 'nouveau' && !l.contacted).length;
    const hr = new Date().getHours();
    $('#dash-hello').textContent = hr < 5 || hr >= 18 ? 'Bonsoir.' : (hr < 12 ? 'Bonjour.' : 'Bon après-midi.');
    $('#dash-sub').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    renderTodayCard(); loadToday().then(renderTodayCard);
    let alert = '';
    if (st.stale_24h) alert = `<div class="alert"><span>${ico('alert')}&nbsp; <strong>${st.stale_24h}</strong> lead${st.stale_24h > 1 ? 's' : ''} sans réponse depuis plus de 24 h.</span><button class="btn sm" data-nav="leads">Voir les leads</button></div>`;
    else if (st.reminders_due) alert = `<div class="alert"><span>${ico('clock')}&nbsp; <strong>${st.reminders_due}</strong> rappel${st.reminders_due > 1 ? 's' : ''} à faire aujourd'hui.</span><button class="btn sm" data-nav="leads">Voir les leads</button></div>`;
    else if (nNew) alert = `<div class="alert"><span>${ico('funnel')}&nbsp; <strong>${nNew}</strong> nouveau${nNew > 1 ? 'x' : ''} lead${nNew > 1 ? 's' : ''} à traiter.</span><button class="btn sm" data-nav="leads">Voir les leads</button></div>`;
    else alert = `<div class="alert ok"><span>${ico('check')}&nbsp; Aucun lead en attente.</span></div>`;
    const rp = S.mail && S.mail.report, ms = S.mail && S.mail.status;
    if (rp && ms && ms.state === 'ok' && rp.waiting) alert += `<div class="alert" style="margin-top:10px"><span>${ico('mail')}&nbsp; <strong>${rp.waiting}</strong> client${rp.waiting > 1 ? 's' : ''} attend${rp.waiting > 1 ? 'ent' : ''} une réponse${rp.waiting_over_3d ? ' (dont <strong>' + rp.waiting_over_3d + '</strong> depuis plus de 3 jours)' : ''}.</span><button class="btn sm" data-action="show-wait">Voir</button></div>`;
    $('#dash-alert').innerHTML = '';   // tout est dans le « programme du jour »
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
    if (isAdmin()) $('#dash-biz').innerHTML =
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
      if (S.mine && S.user && l.assigned_to !== S.user.id) return false;
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
      <div class="chips">${cats}${urgent}<span class="chip src">${esc(SRC[l.source] || l.source)}</span>${(l.photos || []).length ? `<span class="chip">${ico('image')}${(l.photos || []).length}</span>` : ''}</div>
      ${state}${replyBadge(l)}${rem}${l.assigned_to ? `<div style="margin-bottom:8px">${whoChip(l.assigned_to)}</div>` : ''}<div class="card-actions">${actions}</div></article>`;
  }
  function colHtml(c, list) {
    return `<div class="col" data-status="${c.id}" style="--c:${stColor(c.id)}"><div class="col-h"><span class="dot" style="--c:${stColor(c.id)}"></span>${esc(c.label)}<span class="count">${list.length}</span></div>${list.map(leadCard).join('') || `<div class="empty">${esc(c.empty)}</div>`}</div>`;
  }
  function renderLeads() {
    const fl = filteredLeads();
    const present = Object.keys(S.cfg.categories).filter((c) => S.leads.some((l) => ((l.triage && l.triage.categories) || []).includes(c)));
    const nWait = S.leads.filter((l) => waiting(l)).length;
    $('#lead-filters').innerHTML = `<span class="chip wait${S.wait ? ' on' : ''}" data-action="filter-wait">Sans réponse (${nWait})</span><span class="chip st-rdv${S.mine ? ' on' : ''}" data-action="filter-mine">Mes leads</span>` + present.map((c) => `<span class="chip cat-${esc(c)}${S.cats.has(c) ? ' on' : ''}" data-action="filter-cat" data-cat="${esc(c)}">${esc(catLabel(c))}</span>`).join('');
    $('#board').innerHTML = COLS.map((c) => colHtml(c, fl.filter((l) => l.status === c.id))).join('');
    const done = fl.filter((l) => l.status === 'gagne' || l.status === 'perdu');
    $('#archived-sum').textContent = 'Terminés (' + done.length + ')';
    $('#board-done').innerHTML = [{ id: 'gagne', label: 'Gagnés', empty: 'Aucun' }, { id: 'perdu', label: 'Perdus', empty: 'Aucun' }].map((c) => colHtml(c, done.filter((l) => l.status === c.id))).join('');
  }

  // ── Fiche lead (tiroir) ───────────────────────────────────
  async function openLead(id, focus) {
    try {
      const j = await api('GET', '/leads/' + id);
      try { S.leadQuotes = (await api('GET', '/quotes?lead_id=' + id)).data; } catch (e) { S.leadQuotes = []; }
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
        <dl class="kv">${kv('E-mail', l.email)}${kv('Téléphone', l.tel)}${kv('Ville / CP', l.ville)}${kv('Adresse', l.adresse)}${kv('Prestation', f.prestation)}${kv('Problèmes', f.problemes)}${kv('Nombre de jantes', f.nb_jantes)}${kv('Véhicule', [f.marque, f.modele].filter(Boolean).join(' '))}${kv('Taille', f.taille)}${kv('Finition', f.finition)}${kv('Intervention', f.mode)}${kv('Délai souhaité', f.delai)}${l.attr && (l.attr.utm_campaign || l.attr.gclid || l.attr.utm_source) ? kv('Origine publicitaire', [l.attr.utm_source, l.attr.utm_medium, l.attr.utm_campaign].filter(Boolean).join(' / ') + (l.attr.gclid ? ' · clic Google Ads (gclid)' : '') + (l.attr.fbclid ? ' · clic Meta (fbclid)' : '')) : ''}${f.photos ? kv('Photos jointes', f.photos + ' (galerie ci-dessous)') : ''}</dl>
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
      <div class="card"><h4>${ico('image')} Photos du client (${(l.photos || []).length})</h4><div class="ch-photos" id="lead-photos"></div><p class="faint" id="lead-photos-hint" style="font-size:12px;margin:8px 0 0"></p><div class="dr-actions" style="margin-top:8px"><button class="btn sm" data-action="lead-photo-add" data-id="${l.id}">${ico('image')}Ajouter des photos</button></div></div>
      <div class="card"><h4>${ico('mail')} Réponse proposée</h4>
        <div class="field"><label>Modèle</label><select class="input" id="reply-tpl" data-id="${l.id}">${options}</select></div>
        <div class="field"><label>Objet</label><input class="input" id="reply-subject" value="${esc(fill(cur.subject, l))}" /></div>
        <div class="voice-box">
          <label for="ai-instr">${ico('mic')} Parlez, l'assistant rédige</label>
          <p class="faint" style="font-size:12px;margin:0 0 8px">Cliquez sur « Dicter mon message », dites par exemple « propose un rendez-vous jeudi à 10 h, 130 € HT la jante », puis cliquez sur « Arrêter » : le message se rédige tout seul. Relisez-le avant d'envoyer.</p>
          <textarea class="input" id="ai-instr" rows="2" placeholder="Ex. : propose-lui un rendez-vous jeudi à 10 h, précise que c'est 130 € la jante, ton plus chaleureux"></textarea>
          <div class="dr-actions">
            <button class="btn primary sm mic" data-action="mic" data-target="ai-instr" data-auto="1">${ico('mic')}<span class="lbl">Dicter mon message</span></button>
            <button class="btn sm" data-action="ai-rewrite" data-id="${l.id}" ${S.cfg.ai ? '' : 'disabled title="Assistant IA non activé"'}>Réécrire</button>
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
        <div class="field"><label>Responsable</label><select class="input" id="lead-assign" data-id="${l.id}">${userOptions(l.assigned_to)}</select></div>
        <div class="field" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-action="new-event-lead" data-id="${l.id}">${ico('calendar')}Fixer un rendez-vous</button><button class="btn sm primary admin-only" data-action="new-quote-lead" data-id="${l.id}">${ico('doc')}Créer un devis</button></div>
        ${(S.leadQuotes || []).length ? '<div class="rows">' + S.leadQuotes.map((q) => `<div class="row" data-action="open-quote" data-id="${q.id}"><span class="time-pill">${esc(q.number.replace('DV-', ''))}</span><div class="grow"><div class="t">${esc(eur(q.totals.ttc))} TTC</div><div class="s">${esc(Q_LABEL[q.status])}</div></div></div>`).join('') + '</div>' : ''}
        <div class="field"><label>Notes internes</label><textarea class="input" id="lead-notes" data-id="${l.id}" rows="3" placeholder="Ex. : rappeler après 18 h, veut le noir mat…">${esc(l.notes || '')}</textarea></div>
        <div class="dr-actions"><button class="btn sm" data-action="set-status" data-status="rdv" data-id="${l.id}">Rendez-vous confirmé</button><button class="btn sm" data-action="set-status" data-status="gagne" data-id="${l.id}">Marquer gagné</button><button class="btn sm" data-action="set-status" data-status="perdu" data-id="${l.id}">Marquer perdu</button></div>
      </div>
      <div class="card"><h4>Historique</h4><div class="timeline">${events || '<div class="muted">Aucun événement</div>'}</div></div>
      <div><button class="btn sm danger admin-only" data-action="delete-lead" data-id="${l.id}">${ico('trash')}Supprimer ce lead</button></div>
    </div>`;
    drawLeadPhotos(l);
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
      const bl = (t, arr) => (arr.length ? `<strong>${t}</strong>` + arr.join('') : '');
      $('#client-inters').innerHTML = '<div class="c360">' +
        bl('Demandes', (c.leads || []).map((l) => `<a data-action="open" data-id="${l.id}">· ${esc(dt(l.created_at))} — ${esc(ST_LABEL[l.status] || l.status)}${l.summary ? ' — ' + esc(l.summary.slice(0, 60)) : ''}</a>`)) +
        bl('Devis', (c.quotes || []).map((q) => `<a data-action="open-quote" data-id="${q.id}">· ${esc(q.number)} — ${esc(eur(q.ttc))} — ${esc(Q_LABEL[q.status])}</a>`)) +
        bl('Rendez-vous', (c.events || []).map((e) => `<span>· ${esc(e.all_day ? e.start : new Date(e.start).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))} — ${esc(e.title)}</span>`)) +
        bl('Chantiers', (c.interventions || []).map((i) => `<span>· ${esc(dec(i.prestation) || 'Intervention')} ${esc(dec([i.marque, i.modele].filter(Boolean).join(' ')))} — ${esc(INTER_ST[i.statut] || i.statut)}${i.montant ? ' — ' + esc(i.montant) + ' €' : ''}</span>`)) + '</div>';
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
    renderRoi(); renderGoals();
    $('#visit-range').innerHTML = [7, 30, 90].map((d) => `<span class="chip${S.visitDays === d ? ' on' : ''}" data-action="visit-range" data-days="${d}">${d} j</span>`).join('');
    try {
      const v = (await api('GET', '/visits?days=' + S.visitDays)).data;
      const max = Math.max(1, ...v.map((x) => x.visits));
      $('#visit-chart').innerHTML = `<div class="bars">${v.map((d) => `<div class="b" data-v="${d.visits}" style="height:${Math.max(2, Math.round(d.visits / max * 100))}%" title="${esc(d.date)} : ${d.visits}"></div>`).join('')}</div><div class="bar-axis"><span>${esc(v[0] ? v[0].date : '')}</span><span>aujourd'hui</span></div>`;
    } catch (e) { /* ignoré */ }
  }


  // ── Planning (rendez-vous) ────────────────────────────────
  const pad2 = (n) => String(n).padStart(2, '0');
  const dkey = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function evDays(e) {                       // jours (locaux) couverts par un rendez-vous
    const a = e.all_day ? new Date(e.start + 'T00:00:00') : new Date(e.start);
    let b = e.all_day ? new Date((e.end || e.start) + 'T00:00:00') : new Date(e.end || e.start);
    if (!e.all_day && b > a && b.getHours() === 0 && b.getMinutes() === 0) b = new Date(b.getTime() - 60000);
    const out = []; const d = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    for (let i = 0; i < 60 && d <= b; i++) { out.push(dkey(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  const evTime = (e) => (e.all_day ? '' : new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' ');
  function monthRange() {
    const c = S.cal || (S.cal = { y: new Date().getFullYear(), m: new Date().getMonth() });
    const first = new Date(c.y, c.m, 1); const off = (first.getDay() + 6) % 7;
    const start = new Date(c.y, c.m, 1 - off); const end = new Date(start); end.setDate(end.getDate() + 42);
    return { start, end };
  }
  async function loadEvents() {
    const { start, end } = monthRange();
    try { S.events = (await api('GET', '/events?from=' + encodeURIComponent(start.toISOString()) + '&to=' + encodeURIComponent(end.toISOString()))).data; } catch (e) { S.events = []; }
  }
  async function renderPlanning() {
    await Promise.all([loadEvents(), loadCal()]);
    const c = S.cal; const { start } = monthRange(); const today = dkey(new Date());
    $('#cal-title').textContent = MONTHS[c.m].charAt(0).toUpperCase() + MONTHS[c.m].slice(1) + ' ' + c.y;
    $('#cal-head').innerHTML = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((d) => `<span>${d}</span>`).join('');
    const byDay = {}; S.events.forEach((e) => evDays(e).forEach((k) => { (byDay[k] = byDay[k] || []).push(e); }));
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i); const k = dkey(d); const list = byDay[k] || [];
      const chips = list.slice(0, 3).map((e) => `<button class="ev-chip${e.lead_id ? ' lead' : (e.origin === 'google' ? ' goog' : '')}" data-action="open-event" data-id="${e.id}" title="${esc(e.title)}">${esc(evTime(e))}${esc(e.title)}</button>`).join('');
      cells += `<div class="cal-day${d.getMonth() !== c.m ? ' dim' : ''}${k === today ? ' today' : ''}" data-action="new-event" data-date="${k}"><span class="dn">${d.getDate()}</span>${chips}${list.length > 3 ? `<span class="more">+${list.length - 3} autre(s)</span>` : ''}</div>`;
    }
    $('#cal-grid').innerHTML = cells;
    const cs = S.calStatus;
    $('#cal-sync-hint').textContent = cs && cs.enabled ? (cs.state === 'ok' || cs.state === 'running' ? 'Synchronisé avec Google Agenda' + (cs.calendar_name ? ' (' + cs.calendar_name + ')' : '') + '.' : 'Google Agenda : ' + (cs.state === 'scope_missing' ? 'autorisation manquante (voir Paramètres)' : 'voir Paramètres')) : 'Google Agenda non connecté (voir Paramètres).';
    const now = new Date().toISOString();
    let up = S.events.filter((e) => (e.all_day ? e.end || e.start : e.end || e.start) >= (e.all_day ? now.slice(0, 10) : now)).slice(0, 10);
    $('#cal-upcoming').innerHTML = up.length ? up.map((e) => `<div class="row" data-action="open-event" data-id="${e.id}"><span class="avatar" style="--c:${e.lead_id ? 'var(--violet)' : 'var(--blue)'};width:30px;height:30px;font-size:11px">${e.all_day ? 'J' : new Date(e.start).getDate()}</span><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${esc(e.all_day ? new Date(e.start + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · journée' : new Date(e.start).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}${e.location ? ' · ' + esc(e.location) : ''}</div></div></div>`).join('') : '<div class="empty">AUCUN RENDEZ-VOUS À VENIR</div>';
  }
  async function loadCal() { try { S.calStatus = (await api('GET', '/calendar/status')).data; } catch (e) { /* facultatif */ } }
  function fillLeadSelect(sel, cur) {
    $('#ev-lead').innerHTML = '<option value="">— aucun —</option>' + S.leads.slice().sort((a, b) => fullName(a).localeCompare(fullName(b))).map((l) => `<option value="${l.id}"${l.id === cur ? ' selected' : ''}>${esc(fullName(l))}${l.form && l.form.marque ? ' — ' + esc(dec(l.form.marque)) : ''}</option>`).join('');
  }
  function setAllDay(on) {
    const s = $('#ev-start'), e = $('#ev-end'); const ps = s.value, pe = e.value;
    s.type = e.type = on ? 'date' : 'datetime-local';
    s.value = on ? (ps || '').slice(0, 10) : (ps.length === 10 ? ps + 'T09:00' : ps);
    e.value = on ? (pe || '').slice(0, 10) : (pe.length === 10 ? pe + 'T10:00' : pe);
  }
  function openEventDialog(ev, preset) {
    const f = $('#form-event'); f.reset();
    const e = ev || {};
    f.elements.id.value = e.id || '';
    $('#event-title-h').textContent = e.id ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous';
    f.elements.title.value = e.title || (preset && preset.title) || '';
    f.elements.location.value = e.location || (preset && preset.location) || '';
    f.elements.notes.value = e.notes || (preset && preset.notes) || '';
    f.elements.all_day.checked = !!e.all_day; setAllDay(!!e.all_day);
    if (e.id) { $('#ev-start').value = e.all_day ? e.start.slice(0, 10) : toLocalInput(e.start); $('#ev-end').value = e.all_day ? (e.end || e.start).slice(0, 10) : toLocalInput(e.end || e.start); }
    else { const d = (preset && preset.date) || dkey(new Date()); $('#ev-start').value = d + 'T09:00'; $('#ev-end').value = d + 'T10:00'; }
    fillLeadSelect(null, e.lead_id || (preset && preset.lead_id) || null);
    $('#ev-assign').innerHTML = userOptions(e.assigned_to || (!e.id && S.user && S.user.id) || null);
    $('#btn-del-event').hidden = !e.id;
    const cs = S.calStatus; $('#event-sync').textContent = e.g ? 'Synchronisé avec Google Agenda.' : (cs && cs.enabled ? 'Sera envoyé dans Google Agenda.' : 'Google Agenda non connecté : ce rendez-vous reste dans le CRM.');
    $('#dlg-event').showModal();
  }


  // ── Programme du jour ─────────────────────────────────────
  async function loadToday() { try { S.today = (await api('GET', '/today')).data; } catch (e) { /* facultatif */ } }
  function renderTodayCard() {
    const el = $('#today-card'); if (!el) return; const t = S.today;
    if (!t) { el.innerHTML = '<div class="muted">Chargement du programme du jour…</div>'; return; }
    const tel = (x) => (x ? `<a class="mini-btn" href="tel:${esc(String(x).replace(/[^\d+]/g, ''))}" aria-label="Appeler" data-action="noop">${ico('phone')}</a>` : '');
    const wa = (x) => (x ? `<a class="mini-btn" href="https://wa.me/${esc(waNum(x))}" target="_blank" rel="noopener" aria-label="WhatsApp" data-action="noop">${ico('wa')}</a>` : '');
    const ev = t.events.map((e) => `<div class="prog-item"${e.lead_id ? ` data-action="open" data-id="${e.lead_id}"` : ''}><span class="time-pill">${e.time ? esc(e.time) : 'Journée'}</span><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${esc([e.client, e.location].filter(Boolean).join(' · '))}</div></div><div class="acts">${e.maps ? `<a class="mini-btn" href="${esc(e.maps)}" target="_blank" rel="noopener" aria-label="Itinéraire" data-action="noop">${ico('route')}</a>` : ''}${tel(e.tel)}</div></div>`).join('') || '<div class="prog-empty">Aucun rendez-vous aujourd\'hui.</div>';
    const call = t.to_call.map((c) => `<div class="prog-item" data-action="open" data-id="${c.id}"><span class="avatar" style="--c:${c.urgent ? 'var(--rose)' : 'var(--blue)'};width:30px;height:30px;font-size:11px">${esc(initials({ prenom: c.name.split(' ')[0], nom: c.name.split(' ')[1] || '' }))}</span><div class="grow"><div class="t">${esc(c.name)}${c.urgent ? ' · urgent' : ''}</div><div class="s">${esc(c.summary || ('reçu il y a ' + c.since_h + ' h'))}</div></div><div class="acts">${tel(c.tel)}${wa(c.tel)}</div></div>`).join('') || '<div class="prog-empty">Rien en attente.</div>';
    const wait = t.waiting.map((c) => `<div class="prog-item" data-action="open" data-id="${c.id}" data-focus="reply"><span class="avatar" style="--c:var(--amber);width:30px;height:30px;font-size:11px">${esc(initials({ prenom: c.name.split(' ')[0], nom: c.name.split(' ')[1] || '' }))}</span><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">attend une réponse depuis ${c.days} j</div></div><div class="acts">${wa(c.tel)}</div></div>`).join('') + (t.quotes_follow.length ? t.quotes_follow.map((q) => `<div class="prog-item" data-action="open-quote" data-id="${q.id}"><span class="time-pill">${esc(q.number.replace('DV-', ''))}</span><div class="grow"><div class="t">${esc(q.client)}</div><div class="s">devis sans réponse depuis ${q.days} j</div></div></div>`).join('') : '') || '<div class="prog-empty">Personne n\'attend de réponse.</div>';
    el.innerHTML = `<div class="hero-head"><h3>Programme du jour</h3><span class="eng ia">${ico('sparkle')} Assistant</span><div class="sp"><button class="btn sm" data-action="speak-brief">${ico('speaker')}Écouter</button><button class="btn sm" data-action="today-refresh" aria-label="Actualiser">↻</button></div></div>
      <p class="brief">${esc(t.brief)}</p>
      <div class="prog-cols">
        <div class="prog-col"><h4>${ico('calendar')} Rendez-vous<span class="n">${t.events.length}</span></h4>${ev}${t.tomorrow ? `<div class="prog-empty">Demain : ${t.tomorrow} rendez-vous</div>` : ''}</div>
        <div class="prog-col"><h4>${ico('phone')} À traiter<span class="n">${t.to_call.length}</span></h4>${call}</div>
        <div class="prog-col"><h4>${ico('mail')} Relances<span class="n">${t.waiting_total + t.quotes_follow.length}</span></h4>${wait}</div>
        <div class="prog-col"><h4>${ico('share')} Publications<span class="n">${(t.posts_today || []).length}</span></h4>${(t.posts_today || []).map((p) => `<div class="prog-item" data-action="open-post-id" data-id="${p.id}"><span class="time-pill">${esc(p.time)}</span><div class="grow"><div class="t">${esc(p.title)}</div><div class="s">${esc(p.platforms.map((x) => PF[x]).join(' + '))} · ${p.media} média(s)</div></div></div>`).join('') || '<div class="prog-empty">Rien à publier aujourd\'hui.</div>'}${t.posts_to_validate ? `<div class="prog-empty" style="cursor:pointer" data-nav="publications">${t.posts_to_validate} à valider</div>` : ''}</div>
      </div>`;
  }
  function speakBrief(btn) {
    if (!window.speechSynthesis) return toast('La lecture vocale n\'est pas disponible sur ce navigateur.', true);
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); btn.classList.remove('speaking'); return; }
    if (!S.today) return;
    const u = new SpeechSynthesisUtterance(S.today.brief); u.lang = 'fr-FR'; u.rate = 1.02;
    const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith('fr')); if (v) u.voice = v;
    u.onend = u.onerror = () => btn.classList.remove('speaking');
    btn.classList.add('speaking'); speechSynthesis.speak(u);
  }

  // ── Devis ─────────────────────────────────────────────────
  const Q_LABEL = { brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé' };
  const eur = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const leadName = (id) => { const l = S.leads.find((x) => x.id === Number(id)); return l ? fullName(l) : '—'; };
  async function loadQuotes() { try { S.quotes = (await api('GET', '/quotes')).data; } catch (e) { S.quotes = []; } }
  async function renderDevis() {
    await loadQuotes();
    const sel = $('#quote-filter'); if (sel.options.length < 2) sel.innerHTML = '<option value="">Tous les statuts</option>' + Object.entries(Q_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    const list = S.quotes.filter((q) => !sel.value || q.status === sel.value);
    const sum = S.quotes.filter((q) => q.status === 'accepte').reduce((t, q) => t + q.totals.ttc, 0), pend = S.quotes.filter((q) => q.status === 'envoye').reduce((t, q) => t + q.totals.ttc, 0);
    $('#quotes-hint').textContent = S.quotes.length ? 'Acceptés : ' + eur(sum) + ' TTC · en attente de réponse : ' + eur(pend) + ' TTC' : '';
    $('#quotes-body').innerHTML = list.map((q) => `<tr class="click" data-action="open-quote" data-id="${q.id}"><td><strong>${esc(q.number)}</strong></td><td>${esc(leadName(q.lead_id))}</td><td class="muted">${esc((q.lines[0] && q.lines[0].label || '').slice(0, 46))}</td><td><strong>${esc(eur(q.totals.ttc))}</strong></td><td><span class="chip st-${esc(q.status)}"><span class="dot"></span>${esc(Q_LABEL[q.status])}</span></td><td class="muted">${esc(dt(q.created_at))}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">AUCUN DEVIS — CRÉEZ-EN UN DEPUIS UNE FICHE CLIENT</td></tr>';
  }
  function qLineRow(l) {
    return `<div class="qline"><input class="input" data-q="label" value="${esc(l.label || '')}" placeholder="Prestation" /><input class="input" data-q="qty" type="number" min="0" step="1" value="${esc(l.qty)}" /><input class="input" data-q="unit_ht" type="number" min="0" step="1" value="${esc(l.unit_ht)}" placeholder="Prix HT" /><button class="icon-btn" type="button" data-action="q-del-line" aria-label="Retirer" style="width:30px;height:30px">×</button></div>`;
  }
  function qCollect() {
    return [...document.querySelectorAll('#q-lines .qline')].map((r) => ({ label: r.querySelector('[data-q=label]').value.trim(), qty: Number(r.querySelector('[data-q=qty]').value) || 0, unit_ht: Number(r.querySelector('[data-q=unit_ht]').value) || 0 })).filter((x) => x.label);
  }
  function qTotals() {
    const f = $('#form-quote').elements; const rate = Number(f.tva_rate.value);
    const lines = qCollect(); const ht = Math.round(lines.reduce((t, l) => t + l.qty * l.unit_ht, 0) * 100) / 100; const tva = Math.round(ht * rate) / 100;
    $('#q-totals').innerHTML = `<span class="muted">Total HT ${esc(eur(ht))}</span><span class="muted">TVA ${rate} % : ${esc(eur(tva))}</span><strong>Total TTC ${esc(eur(ht + tva))}</strong>`;
    const zero = lines.filter((l) => !l.unit_ht);
    $('#q-warn').textContent = zero.length ? 'Une ou plusieurs lignes n\'ont pas de prix (« à chiffrer ») : complétez-les avant d\'envoyer.' : '';
  }
  function openQuoteDialog(q, preset) {
    const f = $('#form-quote'); f.reset(); S.qSel = q || null;
    $('#quote-title-h').textContent = q ? 'Devis ' + q.number : 'Nouveau devis';
    f.elements.id.value = q ? q.id : '';
    $('#q-lead').innerHTML = '<option value="">— choisir un client —</option>' + S.leads.slice().sort((a, b) => fullName(a).localeCompare(fullName(b))).map((l) => `<option value="${l.id}"${q && q.lead_id === l.id || (preset && preset.lead_id === l.id) ? ' selected' : ''}>${esc(fullName(l))}${l.form && l.form.marque ? ' — ' + esc(dec(l.form.marque)) : ''}</option>`).join('');
    $('#q-status').innerHTML = Object.entries(Q_LABEL).map(([k, v]) => `<option value="${k}"${q && q.status === k ? ' selected' : ''}>${v}</option>`).join('');
    f.elements.valid_until.value = q ? q.valid_until : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    f.elements.tva_rate.value = String(q ? q.tva_rate : 20);
    f.elements.notes.value = q ? q.notes : '';
    $('#q-lines').innerHTML = q ? q.lines.map(qLineRow).join('') : '';
    ['q-del', 'q-print', 'q-send'].forEach((i) => { $('#' + i).hidden = !q; });
    $('#q-lead').disabled = !!q;
    drawQuotePhotos(q ? q.lead_id : (preset && preset.lead_id)); qTotals(); $('#dlg-quote').showModal();
  }
  async function qSave(silent) {
    const f = $('#form-quote').elements; const id = f.id.value; if (!id) { toast('Choisissez d\'abord un client.', true); return null; }
    const body = { lines: qCollect(), notes: f.notes.value, tva_rate: Number(f.tva_rate.value), valid_until: f.valid_until.value };
    if (f.status.value !== (S.qSel && S.qSel.status)) body.status = f.status.value;
    if (body.status === 'accepte' && !confirm('Marquer ce devis comme accepté ? Le lead passera en « gagné » et une intervention sera créée.')) return null;
    const j = await api('PUT', '/quotes/' + id, body); S.qSel = j.data; if (!silent) toast('Devis enregistré'); return j.data;
  }


  // ── Équipe et affectations ────────────────────────────────
  const userName = (id) => { const u = S.users.find((x) => x.id === Number(id)); return u ? u.name : ''; };
  const whoChip = (id) => { const n = userName(id); return n ? `<span class="who"><span class="avatar" style="--c:${avColor({ prenom: n })}">${esc(initials({ prenom: n }))}</span>${esc(n.split(' ')[0])}</span>` : ''; };
  const userOptions = (cur, none) => `<option value="">${none || '— personne —'}</option>` + S.users.map((u) => `<option value="${u.id}"${u.id === cur ? ' selected' : ''}>${esc(u.name)}</option>`).join('');

  // ── Chantiers (atelier) ───────────────────────────────────
  const CH_COLS = [
    { id: 'confirme', label: 'À faire', color: 'var(--blue)', next: 'en_cours', btn: 'Démarrer' },
    { id: 'en_cours', label: 'En cours', color: 'var(--amber)', next: 'termine', btn: 'Terminé' },
    { id: 'termine', label: 'Prêt à récupérer', color: 'var(--violet)', next: 'paye', btn: 'Livré' },
    { id: 'paye', label: 'Livré', color: 'var(--emerald)', next: null, btn: '' },
  ];
  async function renderChantiers() {
    try { S.chantiers = (await api('GET', '/interventions')).data; } catch (e) { toast(e.message, true); return; }
    $('#ch-mine').classList.toggle('on', S.chMine);
    const q = S.q.toLowerCase();
    const list = S.chantiers.filter((i) => CH_COLS.some((c) => c.id === i.statut)).filter((i) => !S.chMine || i.assigned_to === (S.user && S.user.id))
      .filter((i) => !q || [i.prenom, i.nom, i.marque, i.modele, i.prestation].some((v) => v && dec(v).toLowerCase().includes(q)));
    $('#chantier-board').innerHTML = CH_COLS.map((c) => {
      const items = list.filter((i) => i.statut === c.id).sort((a, b) => (a.date_prevue || '9').localeCompare(b.date_prevue || '9'));
      return `<div class="ccol" data-status="${c.id}" style="--c:${c.color}"><div class="col-h"><span class="dot" style="--c:${c.color}"></span>${esc(c.label)}<span class="count">${items.length}</span></div>${items.map((i) => chCard(i, c)).join('') || '<div class="empty">Aucun</div>'}</div>`;
    }).join('');
  }
  function chCard(i, c) {
    const veh = dec([i.marque, i.modele].filter(Boolean).join(' '));
    const d = i.date_prevue ? new Date(i.date_prevue + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const late = i.date_prevue && i.date_prevue < new Date().toISOString().slice(0, 10) && i.statut !== 'paye' && i.statut !== 'termine';
    return `<article class="chantier-card" draggable="true" data-id="${i.id}"><div class="nm">${txt(fullName(i))}</div><div class="meta">${esc(dec(i.prestation) || 'Intervention')}${veh ? ' · ' + esc(veh) : ''}${i.nb_jantes ? ' · ' + esc(i.nb_jantes) + ' jante(s)' : ''}</div>
      <div class="line">${d ? `<span class="chip${late ? ' urgent' : ''}">${ico('calendar')}${esc(d)}${late ? ' · en retard' : ''}</span>` : ''}${whoChip(i.assigned_to)}${(i.photos || []).length ? `<span class="faint">${(i.photos || []).length} photo(s)</span>` : ''}</div>
      <div class="card-actions">${c.next ? `<button class="btn sm primary" data-action="ch-next" data-id="${i.id}" data-next="${c.next}">${esc(c.btn)}</button>` : ''}<button class="btn sm" data-action="ch-open" data-id="${i.id}">Ouvrir</button></div></article>`;
  }
  async function chSetStatus(id, statut) {
    await api('PUT', '/interventions/' + id, { statut });
    const i = S.chantiers.find((x) => x.id === id); if (i) i.statut = statut;
    renderChantiers();
  }
  function chMessage(i, kind) {
    const pr = dec(i.prenom || '');
    if (kind === 'ready') return 'Bonjour ' + pr + ', vos jantes sont prêtes ! Vous pouvez passer les récupérer à l\'atelier REYNOV (47 chemin du Pras, La Mulatière) tous les jours, de 9 h à 19 h. Merci de nous prévenir de votre heure de passage. L\'équipe REYNOV';
    return 'Bonjour ' + pr + ', merci pour votre confiance ! Si vous êtes satisfait du résultat, un avis Google nous aiderait beaucoup (30 secondes) : ' + (S.cfg.review_url || '') + ' — L\'équipe REYNOV';
  }
  async function photoUrl(iid, file) {
    const k = iid + '/' + file; if (S.photoCache[k]) return S.photoCache[k];
    const r = await fetch('/api/crm/photos/' + k, { headers: { Authorization: 'Bearer ' + S.token } }); if (!r.ok) return '';
    return (S.photoCache[k] = URL.createObjectURL(await r.blob()));
  }
  function drawChPhotos(i) {
    const box = $('#ch-photos'); const ph = i.photos || [];
    box.innerHTML = ph.length ? ph.map((p) => `<div class="ch-photo"><img alt="${esc(p.kind)}" data-p="${i.id}/${esc(p.file)}" /><span class="tag">${esc({ avant: 'Avant', apres: 'Après', autre: 'Autre' }[p.kind] || p.kind)}</span><button type="button" class="del" data-action="ch-photo-del" data-file="${esc(p.file)}" aria-label="Supprimer">×</button></div>`).join('') : '<div class="ch-empty">Aucune photo pour l\'instant.</div>';
    box.querySelectorAll('img[data-p]').forEach(async (im) => { const [a, b] = im.dataset.p.split('/'); im.src = await photoUrl(a, b); });
  }
  function openChantier(i) {
    S.chSel = i; const f = $('#form-chantier'); f.reset();
    f.elements.id.value = i.id; $('#ch-title').textContent = fullName(i);
    $('#ch-sub').textContent = [dec(i.prestation), dec([i.marque, i.modele].filter(Boolean).join(' ')), i.nb_jantes ? i.nb_jantes + ' jante(s)' : ''].filter(Boolean).join(' · ');
    $('#ch-statut').innerHTML = Object.entries(INTER_ST).map(([k, v]) => `<option value="${k}"${k === i.statut ? ' selected' : ''}>${esc(v)}</option>`).join('');
    $('#ch-assign').innerHTML = userOptions(i.assigned_to);
    f.elements.date_prevue.value = i.date_prevue || ''; f.elements.notes.value = dec(i.notes || ''); if (f.elements.montant) f.elements.montant.value = i.montant || '';
    const tel = i.tel ? waNum(i.tel) : '';
    $('#ch-msgs').innerHTML = tel ? `<a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/${esc(tel)}?text=${encodeURIComponent(chMessage(i, 'ready'))}">${ico('wa')}Prévenir : jantes prêtes</a>${S.cfg.review_url ? `<a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/${esc(tel)}?text=${encodeURIComponent(chMessage(i, 'review'))}">${ico('wa')}Demander un avis Google</a>` : ''}<a class="btn sm call" href="tel:${esc(i.tel.replace(/[^\d+]/g, ''))}">${ico('phone')}Appeler</a>` : '<span class="faint" style="font-size:12px">Pas de téléphone pour ce client.</span>';
    drawChPhotos(i); $('#dlg-chantier').showModal();
  }
  async function shrink(file) {   // réduit les photos de téléphone (plus rapide à envoyer, moins de place sur le volume)
    try {
      const bmp = await createImageBitmap(file); const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86)); return b && b.size < file.size ? new File([b], 'photo.jpg', { type: 'image/jpeg' }) : file;
    } catch (e) { return file; }
  }
  async function uploadPhotos(files, kind) {
    const i = S.chSel; if (!i || !files.length) return;
    const fd = new FormData(); fd.append('kind', kind);
    for (const f of files) fd.append('photos', await shrink(f));
    toast('Envoi des photos…');
    const r = await fetch('/api/crm/interventions/' + i.id + '/photos', { method: 'POST', headers: { Authorization: 'Bearer ' + S.token }, body: fd });
    const j = await r.json().catch(() => ({ ok: false, error: 'Envoi impossible' }));
    if (!j.ok) return toast(j.error || 'Envoi impossible', true);
    S.chSel = j.data; const k = S.chantiers.findIndex((x) => x.id === j.data.id); if (k >= 0) S.chantiers[k] = Object.assign(S.chantiers[k], { photos: j.data.photos });
    drawChPhotos(S.chSel); toast(j.added + ' photo(s) ajoutée(s)');
  }

  // ── Équipe (réglages) ─────────────────────────────────────
  async function loadTeam() { try { S.team = (await api('GET', '/users')).data; } catch (e) { S.team = []; } const el = $('#set-team'); if (!el) return;
    el.innerHTML = S.team.length ? S.team.map((u) => `<div class="team-row" data-action="edit-user" data-id="${u.id}"><span class="avatar" style="--c:${avColor({ prenom: u.name })};width:32px;height:32px;font-size:12px">${esc(initials({ prenom: u.name }))}</span><div class="grow"><div class="t">${esc(u.name)}${u.active === false ? ' · désactivé' : ''}</div><div class="s">@${esc(u.username)} · ${u.role === 'admin' ? 'administrateur' : 'employé'}</div></div></div>`).join('') : '<p class="muted">Personne pour l\'instant : ajoutez vos collègues.</p>'; }
  function openUserDialog(u) {
    const f = $('#form-user'); f.reset(); f.elements.id.value = u ? u.id : '';
    $('#user-title').textContent = u ? u.name : 'Nouvelle personne';
    f.elements.name.value = u ? u.name : ''; f.elements.username.value = u ? u.username : ''; f.elements.username.disabled = !!u; f.elements.role.value = u ? u.role : 'employe';
    $('#user-pw-l').textContent = u ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe * (8 caractères minimum)'; f.elements.password.required = !u;
    $('#user-del').hidden = !u; $('#dlg-user').showModal();
  }
  async function renderGoals() {
    const body = $('#stats-goals'), pb = $('#stats-partners'); if (!body) return;
    try {
      const d = (await api('GET', '/stats/objectifs')).data, P = d.periodes;
      const rows = [['Demandes reçues', 'demandes'], ['dont retour de leasing', 'leasing'], ['dont revente', 'revente'], ['dont professionnels', 'pro'], ['Devis envoyés', 'devis_envoyes'], ['Devis acceptés', 'devis_acceptes'], ['Devis professionnels acceptés', 'devis_pro_acceptes'], ['Jantes confiées par les professionnels', 'jantes_pros']];
      body.innerHTML = rows.map(([lbl, k]) => `<tr><td>${esc(lbl)}</td><td><strong>${P[30][k]}</strong></td><td>${P[60][k]}</td><td>${P[90][k]}</td></tr>`).join('');
      pb.innerHTML = d.partenaires.length ? d.partenaires.map((p) => `<tr><td><strong>${esc(p.entreprise)}</strong></td><td>${esc(p.contact)}</td><td>${p.devis}</td><td>${p.jantes}</td><td>${esc(p.ca_ttc.toLocaleString('fr-FR'))} €</td><td>${p.actif ? 'Partenaire actif' : 'Premier devis'}</td></tr>`).join('') : '<tr><td colspan="6" class="faint">Aucun partenaire pour l\'instant : un devis professionnel accepté apparaîtra ici.</td></tr>';
    } catch (e) { /* facultatif */ }
  }
  async function renderRoi() {
    const body = $('#stats-roi'); if (!body) return;
    try {
      const rows = (await api('GET', '/stats/sources')).data;
      body.innerHTML = rows.map((r) => `<tr><td><strong>${esc(SRC[r.source] || r.source)}</strong></td><td>${r.leads}<span class="faint"> (${r.leads30} sur 30 j)</span></td><td>${r.gagnes}</td><td>${r.conversion} %</td><td>${r.devis}</td><td>${r.acceptes}</td><td><strong>${esc(r.ca_ttc.toLocaleString('fr-FR'))} €</strong></td></tr>`).join('') || '<tr><td colspan="7" class="empty">PAS ENCORE DE DONNÉES</td></tr>';
    } catch (e) { /* facultatif */ }
  }


  // ── Photos des demandes (clients) ─────────────────────────
  async function blobAt(rel) {            // rel = « photos/lead/12/xxx.jpg » : image protégée, récupérée avec la session puis affichée localement
    if (S.photoCache[rel]) return S.photoCache[rel];
    const r = await fetch('/api/crm/' + rel, { headers: { Authorization: 'Bearer ' + S.token } }); if (!r.ok) return '';
    return (S.photoCache[rel] = URL.createObjectURL(await r.blob()));
  }
  function leadPhotoTiles(l, del) {
    return (l.photos || []).map((p) => {
      const rel = 'photos/lead/' + l.id + '/' + p.file;
      return `<div class="ch-photo"><img alt="Photo du client" data-rel="${esc(rel)}" data-action="view-photo" />${del ? `<button type="button" class="del" data-action="lead-photo-del" data-id="${l.id}" data-file="${esc(p.file)}" aria-label="Supprimer">×</button>` : ''}${p.src === 'form' || (p.src || '').startsWith('gmail') ? '<span class="tag">Client</span>' : ''}</div>`;
    }).join('');
  }
  function loadThumbs(root) {
    root.querySelectorAll('img[data-rel]').forEach(async (im) => { const u = await blobAt(im.dataset.rel); if (u) im.src = u; else { im.alt = 'Format non affichable (HEIC) : cliquez pour télécharger'; im.removeAttribute('src'); } });
  }
  async function viewPhoto(rel) {
    const u = await blobAt(rel); if (!u) return toast('Impossible d\'afficher cette photo.', true);
    $('#photo-big').src = u; const a = $('#photo-dl'); a.href = u; a.download = rel.split('/').pop(); $('#dlg-photo').showModal();
  }
  function drawLeadPhotos(l) {
    const box = $('#lead-photos'); if (!box) return;
    box.innerHTML = (l.photos || []).length ? leadPhotoTiles(l, true) : '<div class="ch-empty">Aucune photo conservée pour cette demande.</div>';
    loadThumbs(box);
    const f = (l.form || {}).photos, n = (l.photos || []).length; const hint = $('#lead-photos-hint');
    if (hint) hint.textContent = f && f > n ? 'Le client a joint ' + f + ' photo(s) à sa demande, ' + n + ' conservée(s) ici.' : '';
  }
  async function uploadLeadPhotos(id, files) {
    const fd = new FormData(); for (const f of files) fd.append('photos', await shrink(f));
    toast('Envoi des photos…');
    const r = await fetch('/api/crm/leads/' + id + '/photos', { method: 'POST', headers: { Authorization: 'Bearer ' + S.token }, body: fd });
    const j = await r.json().catch(() => ({ ok: false, error: 'Envoi impossible' })); if (!j.ok) return toast(j.error || 'Envoi impossible', true);
    const l = S.leads.find((x) => x.id === id); if (l) l.photos = j.data; drawLeadPhotos({ id, photos: j.data, form: (l && l.form) || {} }); toast(j.added + ' photo(s) ajoutée(s)'); render();
  }
  function drawQuotePhotos(leadId) {
    const l = S.leads.find((x) => x.id === Number(leadId)); const box = $('#q-photos'); const has = l && (l.photos || []).length;
    $('#q-photos-f').hidden = !has; if (!has) return; box.innerHTML = leadPhotoTiles(l, false); loadThumbs(box);
  }


  // ── Publications Instagram / TikTok ───────────────────────
  const PCOLS = [
    { id: 'idee', label: 'Idées', color: 'var(--slate)' },
    { id: 'a_valider', label: 'À valider', color: 'var(--amber)' },
    { id: 'approuve', label: 'Programmé', color: 'var(--blue)' },
    { id: 'publie', label: 'Publié', color: 'var(--emerald)' },
  ];
  const PF = { instagram: 'Instagram', tiktok: 'TikTok' };
  const ptime = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sans date');
  async function loadPosts() { try { S.posts = (await api('GET', '/posts')).data; } catch (e) { S.posts = []; } }
  async function renderPublications() {
    await loadPosts();
    api('GET', '/interventions').then((j) => {
      const sel = $('#post-from-ch'); if (!sel) return;
      const ok = j.data.filter((i) => ['termine', 'paye'].includes(i.statut) && !i.post_id && (i.photos || []).some((p) => p.kind === 'avant' && /\.jpg$/.test(p.file)) && (i.photos || []).some((p) => p.kind === 'apres' && /\.jpg$/.test(p.file)));
      sel.innerHTML = '<option value="">Créer depuis un chantier' + (ok.length ? ' (' + ok.length + ' avec photos avant/après)' : '') + '…</option>' + ok.map((i) => `<option value="${i.id}">${esc(fullName(i))} — ${esc(dec([i.marque, i.modele].filter(Boolean).join(' ')) || dec(i.prestation) || 'chantier')}</option>`).join('');
    }).catch(() => {});
    if (isAdmin() && !S.igStatus) api('GET', '/social/status').then((j) => { S.igStatus = j.data; renderPublications(); }).catch(() => {});
    const ig = S.igStatus; $('#posts-hint').textContent = !isAdmin() ? 'Publiez en un geste avec « Partager depuis ce téléphone ».' : (ig && ig.configured ? (ig.ok ? 'Instagram connecté (@' + ig.username + ') : les publications approuvées partent toutes seules à l\'heure prévue.' : 'Instagram : connexion à vérifier (' + (ig.error || '') + ').') : 'Instagram non connecté : publication par partage depuis le téléphone (voir Paramètres pour la connexion automatique).');
    $('#post-board').innerHTML = PCOLS.map((c) => {
      const items = S.posts.filter((p) => p.status === c.id || (c.id === 'idee' && p.status === 'refuse'));
      return `<div class="ccol" style="--c:${c.color}"><div class="col-h"><span class="dot" style="--c:${c.color}"></span>${esc(c.label)}<span class="count">${items.length}</span></div>${items.map(postCard).join('') || '<div class="empty">Aucune</div>'}</div>`;
    }).join('');
    $('#post-board').querySelectorAll('img[data-rel]').forEach(async (im) => { const u = await blobAt(im.dataset.rel); if (u) im.src = u; });
  }
  function postCard(p) {
    const m = (p.media || [])[0]; const rel = m && m.kind === 'image' ? 'media/post/' + p.id + '/' + m.file : '';
    const chips = (p.platforms || []).map((x) => `<span class="chip ${(p.done || {})[x] ? 'st-gagne' : ''}">${(p.done || {})[x] ? ico('check') : ''}${esc(PF[x])}</span>`).join('');
    const late = p.status === 'approuve' && p.scheduled_at && Date.parse(p.scheduled_at) < Date.now() && !(p.platforms || []).every((x) => (p.done || {})[x]);
    return `<article class="chantier-card" style="cursor:pointer" data-action="open-post" data-id="${p.id}">
      ${rel ? `<div class="ch-photo" style="margin-bottom:10px;aspect-ratio:16/9"><img data-rel="${esc(rel)}" alt="" /></div>` : (m ? `<div class="ch-photo" style="margin-bottom:10px;aspect-ratio:16/9;display:grid;place-items:center;font-size:26px">▶</div>` : '')}
      <div class="nm">${esc(p.title)}</div><div class="meta">${esc({ reel: 'Reel', photo: 'Photo', carousel: 'Carrousel', story: 'Story' }[p.type] || p.type)} · ${esc(ptime(p.scheduled_at))}${p.status === 'refuse' ? ' · refusé' : ''}</div>
      <div class="line">${chips}${p.assigned_to ? whoChip(p.assigned_to) : ''}${late ? '<span class="chip urgent">À publier</span>' : ''}${p.error ? '<span class="chip urgent" title="' + esc(p.error) + '">Erreur</span>' : ''}</div></article>`;
  }
  async function toJpeg(file, max) {      // Instagram n'accepte que le JPEG : on convertit toute photo avant l'envoi
    if (!/^image\//.test(file.type)) return file;
    try {
      const bmp = await createImageBitmap(file); const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9)); return b ? new File([b], 'photo.jpg', { type: 'image/jpeg' }) : file;
    } catch (e) { return file; }
  }
  function drawPostMedia(p) {
    const box = $('#post-media'); const md = p.media || [];
    box.innerHTML = md.length ? md.map((m) => `<div class="ch-photo">${m.kind === 'image' ? `<img data-rel="media/post/${p.id}/${esc(m.file)}" alt="" data-action="view-photo" />` : '<div style="display:grid;place-items:center;height:100%;font-size:26px">▶</div><span class="tag">Vidéo</span>'}<button type="button" class="del" data-action="post-media-del" data-file="${esc(m.file)}" aria-label="Retirer">×</button></div>`).join('') : '<div class="ch-empty">Aucun média : ajoutez des photos ou une vidéo.</div>';
    box.querySelectorAll('img[data-rel]').forEach(async (im) => { const u = await blobAt(im.dataset.rel); if (u) im.src = u; });
  }
  function drawPostState(p) {
    const st = { idee: 'Idée (brouillon)', a_valider: 'En attente de validation', approuve: 'Approuvée et programmée', publie: 'Publiée', refuse: 'Refusée' }[p.status] || p.status;
    $('#post-state').textContent = st + (p.approved_by ? ' · approuvée par ' + p.approved_by : '') + (p.error ? ' · ' + p.error : '') + (p.ig && p.ig.permalink ? ' · ' + p.ig.permalink : '');
    $('#post-done').innerHTML = (p.platforms || []).map((x) => `<button type="button" class="btn sm ${(p.done || {})[x] ? 'st-gagne' : ''}" data-action="post-done" data-pf="${x}">${(p.done || {})[x] ? ico('check') + ' Publié sur ' + esc(PF[x]) + ' (annuler)' : 'Marquer publié sur ' + esc(PF[x])}</button>`).join('');
    $('#post-approve').hidden = p.status === 'approuve' || p.status === 'publie'; $('#post-validate').hidden = p.status !== 'idee' && p.status !== 'refuse';
    $('#post-del').hidden = !p.id;
  }
  function openPostDialog(p) {
    const f = $('#form-post'); f.reset(); S.postSel = p || null; const e = p || { platforms: ['instagram'], type: 'reel', status: 'idee' };
    $('#post-h').textContent = p ? p.title || 'Publication' : 'Nouvelle publication';
    f.elements.id.value = p ? p.id : ''; f.elements.title.value = e.title || ''; f.elements.type.value = e.type; f.elements.caption.value = e.caption || ''; f.elements.hashtags.value = e.hashtags || '';
    f.elements.pf_instagram.checked = (e.platforms || []).includes('instagram'); f.elements.pf_tiktok.checked = (e.platforms || []).includes('tiktok');
    f.elements.scheduled_at.value = e.scheduled_at ? toLocalInput(e.scheduled_at) : '';
    $('#post-assign').innerHTML = userOptions(e.assigned_to);
    drawPostMedia(p || { id: '', media: [] }); drawPostState(p || { status: 'idee', platforms: e.platforms, done: {} });
    $('#post-share').hidden = !p || !(p.media || []).length; $('#dlg-post').showModal();
  }
  function postBody() {
    const f = $('#form-post').elements; const pl = []; if (f.pf_instagram.checked) pl.push('instagram'); if (f.pf_tiktok.checked) pl.push('tiktok');
    return { title: f.title.value.trim(), type: f.type.value, platforms: pl, caption: f.caption.value, hashtags: f.hashtags.value.trim(), scheduled_at: f.scheduled_at.value ? new Date(f.scheduled_at.value).toISOString() : null, assigned_to: f.assigned_to.value || null };
  }
  async function savePost(status) {
    const id = $('#form-post').elements.id.value; const body = postBody(); if (status) body.status = status;
    const j = id ? await api('PUT', '/posts/' + id, body) : await api('POST', '/posts', body);
    S.postSel = j.data; $('#form-post').elements.id.value = j.data.id; drawPostState(j.data); $('#post-share').hidden = !(j.data.media || []).length; return j.data;
  }
  async function uploadPostMedia(files) {
    let p = S.postSel; if (!p) p = await savePost(); toast('Envoi en cours…');
    const fd = new FormData(); for (const f of files) fd.append('media', await toJpeg(f, 1440));
    const r = await fetch('/api/crm/posts/' + p.id + '/media', { method: 'POST', headers: { Authorization: 'Bearer ' + S.token }, body: fd });
    const j = await r.json().catch(() => ({ ok: false, error: 'Envoi impossible' })); if (!j.ok) return toast(j.error || 'Envoi impossible', true);
    S.postSel = j.data; drawPostMedia(j.data); $('#post-share').hidden = false; toast(j.added + ' média(s) ajouté(s)');
  }
  async function sharePost(p) {
    const files = [];
    for (const m of p.media || []) { const r = await fetch('/api/crm/media/post/' + p.id + '/' + m.file, { headers: { Authorization: 'Bearer ' + S.token } }); if (r.ok) files.push(new File([await r.blob()], m.file, { type: m.kind === 'video' ? (/\.mov$/.test(m.file) ? 'video/quicktime' : 'video/mp4') : 'image/jpeg' })); }
    const text = [p.caption, p.hashtags].filter(Boolean).join('\n\n');
    if (navigator.canShare && navigator.canShare({ files }) && navigator.share) { try { await navigator.share({ files, text }); return toast('Choisissez Instagram ou TikTok, puis revenez ici cocher « publié ».'); } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); } catch (e) { /* copie manuelle */ }
    files.forEach((f) => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
    toast('Médias téléchargés et légende copiée : collez-la dans Instagram / TikTok.');
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
    loadTeam();
    api('GET', '/social/status').then((j) => {
      const g = j.data; S.igStatus = g;
      $('#set-ig').innerHTML = !g.configured ? '<p><span class="chip"><span class="dot" style="--c:var(--amber)"></span>Non connecté</span></p><p class="muted">Sans connexion, vos équipes publient en un geste depuis le téléphone (bouton « Partager »). Pour la publication automatique à l\'heure programmée, suivez le guide « Connecter Instagram » puis ajoutez les variables <strong>IG_ACCESS_TOKEN</strong> et <strong>IG_USER_ID</strong> dans Railway.</p>'
        : (g.ok ? `<p><span class="chip st-rdv"><span class="dot"></span>Connecté</span></p><p class="muted">Compte @${esc(g.username)} : les publications approuvées partent automatiquement à l'heure prévue (Reels, photos, carrousels, stories). TikTok : partage depuis le téléphone.</p>` : `<p><span class="chip"><span class="dot" style="--c:var(--rose)"></span>Connexion à vérifier</span></p><p class="muted">${esc(g.error || '')}</p>`);
    }).catch(() => {});
    api('GET', '/diag').then((j) => {
      const d = j.data, lab = { demarrage: 'Démarrage', arret: 'Arrêt', arret_anormal: 'Arrêt anormal', exception: 'Erreur', promesse_rejetee: 'Erreur', blocage: 'Blocage', memoire: 'Mémoire' };
      $('#set-diag').innerHTML = `<p class="muted">Serveur actif depuis ${Math.round(d.uptime_s / 60)} min · mémoire ${d.rss_mb} Mo · ${esc(d.node)} · ${d.boots} démarrage(s) au total.</p>` + d.events.slice(0, 12).map((e) => `<div class="team-row" style="cursor:default"><span class="chip ${['arret_anormal', 'exception', 'promesse_rejetee', 'blocage', 'memoire'].includes(e.type) ? 'urgent' : ''}">${esc(lab[e.type] || e.type)}</span><div class="grow"><div class="s">${esc(dt(e.ts))} · ${e.rss} Mo</div><div class="t" style="font-weight:500;font-size:12.5px;word-break:break-word">${esc(e.text)}</div></div></div>`).join('');
    }).catch(() => {});
    const cs = S.calStatus; let ch;
    if (!cs) ch = '<p class="muted">Chargement…</p>';
    else if (!cs.enabled) ch = '<p><span class="chip"><span class="dot" style="--c:var(--amber)"></span>Non connecté</span></p><p class="muted">Le planning du CRM n\'est pas encore relié à Google Agenda. Suivez le guide « Connecter le planning Google », puis ajoutez la variable <strong>GOOGLE_CALENDAR_REFRESH_TOKEN</strong> dans Railway.</p>';
    else if (cs.state === 'scope_missing') ch = '<p><span class="chip"><span class="dot" style="--c:var(--amber)"></span>Autorisation manquante</span></p><p class="muted">Le jeton n\'a pas le droit « Google Agenda ». Refaites l\'autorisation avec le droit <strong>calendar</strong> (voir le guide).</p>';
    else if (cs.state === 'api_disabled') ch = '<p><span class="chip"><span class="dot" style="--c:var(--amber)"></span>API non activée</span></p><p class="muted">Activez « Google Calendar API » dans Google Cloud (bibliothèque d\'API), puis réessayez.</p>';
    else if (cs.state === 'token_error') ch = '<p><span class="chip"><span class="dot" style="--c:var(--rose)"></span>Connexion expirée</span></p><p class="muted">Générez un nouveau jeton (voir le guide) et remplacez <strong>GOOGLE_CALENDAR_REFRESH_TOKEN</strong>.</p>';
    else ch = `<p><span class="chip st-rdv"><span class="dot"></span>${cs.state === 'error' ? 'Erreur temporaire' : 'Connecté'}</span></p><p class="muted">Les rendez-vous du CRM et de Google Agenda sont synchronisés dans les deux sens (toutes les 3 minutes, et tout de suite après une modification dans le CRM).${cs.last_ok ? ' Dernière synchro ' + esc(ago(cs.last_ok)) + '.' : ''}${cs.pending ? ' ' + cs.pending + ' en attente d\'envoi.' : ''}${cs.error ? '<br>' + esc(cs.error) : ''}</p>
      <div class="field"><label>Agenda synchronisé</label><select class="input" id="cal-select">${S.calList ? S.calList.map((c) => `<option value="${esc(c.id)}"${(c.id === cs.calendar || (c.primary && cs.calendar === 'primary')) ? ' selected' : ''}>${esc(c.name)}${c.primary ? ' (principal)' : ''}</option>`).join('') : '<option>Chargement…</option>'}</select></div>
      <button class="btn" data-action="cal-sync">${ico('calendar')}Synchroniser maintenant</button>`;
    $('#set-cal').innerHTML = ch;
    if (cs && cs.enabled && !S.calList && cs.state !== 'scope_missing' && cs.state !== 'api_disabled' && cs.state !== 'token_error') api('GET', '/calendar/list').then((j) => { S.calList = j.data; if (S.view === 'settings') renderSettings(); }).catch(() => { S.calList = []; });
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
    const forMessage = btn.dataset.target === 'reply-body' || btn.dataset.target === 'post-caption';
    const startVal = target.value;
    const base = target.value + (target.value && !/\s$/.test(target.value) ? ' ' : '');
    const r = new SR(); r.lang = 'fr-FR'; r.continuous = true; r.interimResults = true;
    btn.dataset.lbl = btn.dataset.lbl || (btn.querySelector('.lbl') || {}).textContent || '';
    r.onresult = (e) => {
      let txt = ''; for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript + ' ';
      target.value = base + speechFix(txt.trim(), forMessage);
    };
    r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Micro refusé. Cliquez sur le cadenas à côté de l\'adresse du site, autorisez le micro, puis réessayez.', true); else if (e.error === 'no-speech') toast('Je n\'ai rien entendu. Réessayez.', true); else if (e.error !== 'aborted') toast('Dictée interrompue (' + e.error + ').', true); };
    r.onend = () => {
      resetMicBtn(btn); if (rec === r) { rec = null; recBtn = null; }
      // dictée de la consigne terminée : l'assistant rédige le message tout seul
      if (btn.dataset.auto && target.value.trim().length >= 4 && target.value !== startVal) { const rb = document.querySelector('[data-action="ai-rewrite"]'); if (rb && !rb.disabled) rb.click(); }
    };
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
    noop: () => {},
    'new-post': () => openPostDialog(null),
    'open-post-id': async (el) => { await loadPosts(); const p = S.posts.find((x) => x.id === Number(el.dataset.id)); if (p) openPostDialog(p); },
    'open-post': (el) => { const p = S.posts.find((x) => x.id === Number(el.dataset.id)); if (p) openPostDialog(p); },
    'plan-week': async () => { try { const j = await api('POST', '/posts/plan-week', {}); toast(j.data.length ? j.data.length + ' publication(s) proposée(s) pour la semaine' : 'La semaine est déjà planifiée'); renderPublications(); } catch (e) { toast(e.message, true); } },
    'post-media-add': () => { const f = $('#post-file'); f.value = ''; f.click(); },
    'post-media-del': async (el) => { const p = S.postSel; if (!p) return; try { await api('DELETE', '/posts/' + p.id + '/media/' + el.dataset.file); p.media = (p.media || []).filter((m) => m.file !== el.dataset.file); drawPostMedia(p); $('#post-share').hidden = !(p.media || []).length; } catch (e) { toast(e.message, true); } },
    'post-validate': async () => { try { const p = await savePost('a_valider'); toast('Envoyée à valider'); if (S.view === 'publications') renderPublications(); drawPostState(p); } catch (e) { toast(e.message, true); } },
    'post-approve': async () => { try { const p = await savePost('approuve'); toast(S.igStatus && S.igStatus.ok ? 'Approuvée : elle partira sur Instagram à l\'heure prévue' : 'Approuvée et programmée'); if (S.view === 'publications') renderPublications(); drawPostState(p); } catch (e) { toast(e.message, true); } },
    'post-share': async () => { try { const p = await savePost(); await sharePost(p); } catch (e) { toast(e.message, true); } },
    'post-done': async (el) => { const p = S.postSel; if (!p) return; try { const j = await api('POST', '/posts/' + p.id + '/done', { platform: el.dataset.pf, done: !(p.done || {})[el.dataset.pf] }); S.postSel = j.data; drawPostState(j.data); if (S.view === 'publications') renderPublications(); } catch (e) { toast(e.message, true); } },
    'post-delete': async () => { const p = S.postSel; if (!p || !confirm('Supprimer cette publication et ses médias ?')) return; try { await api('DELETE', '/posts/' + p.id); $('#dlg-post').close(); renderPublications(); toast('Publication supprimée'); } catch (e) { toast(e.message, true); } },
    'view-photo': (el) => viewPhoto(el.dataset.rel),
    'lead-photo-add': (el) => { const f = $('#lead-file'); f.dataset.id = el.dataset.id; f.value = ''; f.click(); },
    'lead-photo-del': async (el) => { if (!confirm('Supprimer cette photo ?')) return; try { await api('DELETE', '/photos/lead/' + el.dataset.id + '/' + el.dataset.file); const l = S.leads.find((x) => x.id === Number(el.dataset.id)); if (l) l.photos = (l.photos || []).filter((p) => p.file !== el.dataset.file); drawLeadPhotos(l || { id: Number(el.dataset.id), photos: [], form: {} }); render(); } catch (e) { toast(e.message, true); } },
    'filter-mine': () => { S.mine = !S.mine; renderLeads(); },
    'ch-mine': () => { S.chMine = !S.chMine; renderChantiers(); },
    'ch-open': (el) => { const i = S.chantiers.find((x) => x.id === Number(el.dataset.id)); if (i) openChantier(i); },
    'ch-next': async (el) => { try { await chSetStatus(Number(el.dataset.id), el.dataset.next); toast('Chantier mis à jour'); } catch (e) { toast(e.message, true); } },
    'ch-photo': (el) => { const f = $('#ch-file'); f.dataset.kind = el.dataset.kind; f.value = ''; f.click(); },
    'ch-photo-del': async (el) => { if (!S.chSel || !confirm('Supprimer cette photo ?')) return; try { await api('DELETE', '/photos/' + S.chSel.id + '/' + el.dataset.file); S.chSel.photos = (S.chSel.photos || []).filter((p) => p.file !== el.dataset.file); drawChPhotos(S.chSel); } catch (e) { toast(e.message, true); } },
    'ch-delete': async () => { if (!S.chSel || !confirm('Supprimer ce chantier et ses photos ?')) return; try { await api('DELETE', '/interventions/' + S.chSel.id); $('#dlg-chantier').close(); renderChantiers(); toast('Chantier supprimé'); } catch (e) { toast(e.message, true); } },
    'new-user': () => openUserDialog(null),
    'edit-user': (el) => { const u = S.team.find((x) => x.id === Number(el.dataset.id)); if (u) openUserDialog(u); },
    'user-delete': async () => { const id = $('#form-user').elements.id.value; if (!id || !confirm('Supprimer cette personne ? Ses affectations seront retirées.')) return; try { await api('DELETE', '/users/' + id); $('#dlg-user').close(); S.users = (await api('GET', '/users/basic')).data; loadTeam(); toast('Compte supprimé'); } catch (e) { toast(e.message, true); } },
    'speak-brief': (el) => speakBrief(el),
    'today-refresh': async () => { await loadToday(); renderTodayCard(); toast('Programme actualisé'); },
    'new-quote': () => openQuoteDialog(null),
    'new-quote-lead': async (el) => {
      try { const j = await api('POST', '/quotes', { lead_id: Number(el.dataset.id) }); closeDrawer(); await loadQuotes(); openQuoteDialog(j.data); toast('Devis préparé d\'après la demande : vérifiez les lignes'); } catch (e) { toast(e.message, true); }
    },
    'open-quote': async (el) => { try { const j = await api('GET', '/quotes/' + el.dataset.id); if (S.openId) closeDrawer(); openQuoteDialog(j.data); } catch (e) { toast(e.message, true); } },
    'q-add-line': () => { $('#q-lines').insertAdjacentHTML('beforeend', qLineRow({ label: '', qty: 1, unit_ht: 0 })); qTotals(); },
    'q-del-line': (el) => { el.closest('.qline').remove(); qTotals(); },
    'q-delete': async () => { const id = $('#form-quote').elements.id.value; if (!id || !confirm('Supprimer ce devis ?')) return; try { await api('DELETE', '/quotes/' + id); $('#dlg-quote').close(); if (S.view === 'devis') renderDevis(); toast('Devis supprimé'); } catch (e) { toast(e.message, true); } },
    'q-print': async () => {
      try {
        const q = await qSave(true); if (!q) return;
        const r = await fetch('/api/crm/quotes/' + q.id + '/html', { headers: { Authorization: 'Bearer ' + S.token } });
        const url = URL.createObjectURL(new Blob([await r.text()], { type: 'text/html' })); const w = window.open(url, '_blank');
        if (!w) toast('Autorisez les fenêtres pop-up pour imprimer le devis.', true); else setTimeout(() => { try { w.print(); } catch (e) { /* impression manuelle */ } }, 700);
      } catch (e) { toast(e.message, true); }
    },
    'q-send': async (el) => {
      const q = await qSave(true).catch((e) => { toast(e.message, true); return null; }); if (!q) return;
      if (q.totals.ht <= 0 || (q.lines || []).some((l) => !l.unit_ht)) return toast('Complétez les prix de toutes les lignes avant d\'envoyer.', true);
      if (!confirm('Envoyer le devis ' + q.number + ' (' + eur(q.totals.ttc) + ' TTC) à ' + leadName(q.lead_id) + ' ?')) return;
      el.disabled = true;
      try { const j = await api('POST', '/quotes/' + q.id + '/send'); S.qSel = j.data; $('#q-status').value = 'envoye'; toast('Devis envoyé'); await refreshAll(); if (S.view === 'devis') renderDevis(); } catch (e) { toast(e.message, true); }
      el.disabled = false;
    },
    'new-event': (el) => openEventDialog(null, { date: el.dataset.date }),
    'open-event': (el) => { const e = S.events.find((x) => x.id === Number(el.dataset.id)); if (e) openEventDialog(e); },
    'cal-prev': () => { S.cal.m--; if (S.cal.m < 0) { S.cal.m = 11; S.cal.y--; } renderPlanning(); },
    'cal-next': () => { S.cal.m++; if (S.cal.m > 11) { S.cal.m = 0; S.cal.y++; } renderPlanning(); },
    'cal-today': () => { const n = new Date(); S.cal = { y: n.getFullYear(), m: n.getMonth() }; renderPlanning(); },
    'delete-event': async () => {
      const id = $('#form-event').elements.id.value; if (!id || !confirm('Supprimer ce rendez-vous' + (S.calStatus && S.calStatus.enabled ? ' (il sera aussi supprimé de Google Agenda)' : '') + ' ?')) return;
      try { await api('DELETE', '/events/' + id); $('#dlg-event').close(); renderPlanning(); toast('Rendez-vous supprimé'); } catch (e) { toast(e.message, true); }
    },
    'new-event-lead': (el) => {
      const l = S.leads.find((x) => x.id === Number(el.dataset.id)); if (!l) return; const f = l.form || {};
      const veh = [dec(f.marque || ''), dec(f.modele || '')].filter(Boolean).join(' ');
      closeDrawer();
      go('planning');
      openEventDialog(null, { title: 'RDV ' + fullName(l) + (veh ? ' — ' + veh : ''), lead_id: l.id, location: dec(l.adresse || l.ville || ''), notes: ((l.triage && l.triage.summary) || '') + (l.tel ? '\nTél. ' + l.tel : '') });
    },
    'cal-sync': async () => { try { await api('POST', '/calendar/sync'); toast('Synchronisation lancée'); setTimeout(async () => { await loadCal(); if (S.view === 'settings') renderSettings(); if (S.view === 'planning') renderPlanning(); }, 4000); } catch (e) { toast(e.message, true); } },
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
    else if (t.id === 'lead-file') { try { await uploadLeadPhotos(Number(t.dataset.id), [...t.files]); } catch (er) { toast(er.message, true); } t.value = ''; }
    else if (t.id === 'q-lead' && t.value && !$('#form-quote').elements.id.value) {
      try { const j = await api('POST', '/quotes', { lead_id: Number(t.value) }); openQuoteDialog(j.data); toast('Devis préparé d\'après la demande : vérifiez les lignes'); if (S.view === 'devis') renderDevis(); } catch (er) { toast(er.message, true); }
    }
    else if (t.id === 'lead-assign') { try { const j = await api('PATCH', '/leads/' + t.dataset.id, { assigned_to: t.value || null }); replaceLead(j.data); toast(t.value ? 'Assigné à ' + userName(t.value) : 'Affectation retirée'); render(); } catch (er) { toast(er.message, true); } }
    else if (t.id === 'ch-file') { try { await uploadPhotos([...t.files], t.dataset.kind || 'autre'); } catch (er) { toast(er.message, true); } t.value = ''; }
    else if (t.id === 'post-file') { try { await uploadPostMedia([...t.files]); } catch (er) { toast(er.message, true); } t.value = ''; }
    else if (t.id === 'post-tpl' && t.value) {
      const T = { avant_apres: ['Avant / Après.\nRénovation de jantes à l\'atelier REYNOV, à Lyon : qualité d\'origine, garantie satisfaction 30 jours.\nDevis gratuit sous 24 h : 06 61 45 35 27 (lien en bio).', '#reynov #lyon #renovationjantes #jantes #detailing #avantapres #wheelrestoration'], conseil: ['Une jante rayée par un trottoir ?\nInutile de la remplacer : la rénovation démarre à 130 € HT par jante, avec un résultat qui retrouve la qualité d\'origine. Comptez 24 à 48 h par jante.\nDevis gratuit sous 24 h : 06 61 45 35 27 (lien en bio).', '#reynov #lyon #renovationjantes #jantes #detailing #conseilauto #entretienauto'], avis: ['5/5 sur 56 avis Google. Merci à vous tous pour votre confiance.\nDevis gratuit sous 24 h : 06 61 45 35 27 (lien en bio).', '#reynov #lyon #renovationjantes #avisclients #artisan'], coulisses: ['Dans l\'atelier REYNOV : décapage, préparation, peinture, vernis. Chaque jante est traitée avec le même soin.\nDevis gratuit sous 24 h : 06 61 45 35 27 (lien en bio).', '#reynov #lyon #renovationjantes #atelier #behindthescenes #detailing'] }[t.value];
      const f = $('#form-post').elements; if (!f.caption.value || confirm('Remplacer la légende actuelle par ce modèle ?')) { f.caption.value = T[0]; f.hashtags.value = T[1]; } t.value = '';
    }
    else if (t.id === 'post-from-ch' && t.value) { try { const j = await api('POST', '/posts/from-chantier/' + t.value, {}); t.value = ''; await renderPublications(); openPostDialog(j.data); toast('Brouillon créé avec les photos avant/après'); } catch (er) { toast(er.message, true); t.value = ''; } }
    else if (t.id === 'ev-allday') setAllDay(t.checked);
    else if (t.id === 'cal-select') { try { await api('POST', '/calendar/select', { id: t.value }); toast('Agenda sélectionné : synchronisation en cours'); S.calList = null; setTimeout(async () => { await loadCal(); if (S.view === 'settings') renderSettings(); }, 4000); } catch (er) { toast(er.message, true); } }
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
  document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('.chantier-card'); if (!c) return; e.dataTransfer.setData('text/plain', 'ch:' + c.dataset.id); e.dataTransfer.effectAllowed = 'move'; c.classList.add('dragging'); });
  document.addEventListener('dragend', (e) => { const c = e.target.closest && e.target.closest('.chantier-card'); if (c) c.classList.remove('dragging'); $$('.ccol.over').forEach((x) => x.classList.remove('over')); });
  document.addEventListener('dragover', (e) => { const col = e.target.closest && e.target.closest('.ccol'); if (!col) return; e.preventDefault(); $$('.ccol.over').forEach((x) => { if (x !== col) x.classList.remove('over'); }); col.classList.add('over'); });
  document.addEventListener('drop', async (e) => {
    const col = e.target.closest && e.target.closest('.ccol'); if (!col) return; e.preventDefault(); col.classList.remove('over');
    const m = /^ch:(\d+)$/.exec(e.dataTransfer.getData('text/plain')); if (!m) return;
    try { await chSetStatus(Number(m[1]), col.dataset.status); } catch (er) { toast(er.message, true); }
  });
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
    try {
      const r = await fetch('/api/crm/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('#usr').value.trim(), password: $('#pwd').value }) });
      if (r.status === 429) throw new Error('Trop de tentatives. Réessayez dans 15 minutes.');
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.error || 'Identifiant ou mot de passe incorrect');
      await start(j.token);
    } catch (er) { $('#login-err').textContent = er.message; S.token = ''; }
  });
  $('#dlg-quote').addEventListener('input', () => qTotals());
  $('#dlg-quote').addEventListener('change', (e) => { if (e.target.name === 'tva_rate') qTotals(); });
  $('#form-quote').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const q = await qSave(false); if (q) { $('#dlg-quote').close(); await refreshAll(); if (S.view === 'devis') renderDevis(); if (S.view === 'dashboard') renderDashboard(); } } catch (er) { toast(er.message, true); }
  });
  $('#form-post').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await savePost(); $('#dlg-post').close(); toast('Publication enregistrée'); if (S.view === 'publications') renderPublications(); } catch (er) { toast(er.message, true); }
  });
  $('#form-chantier').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = $('#form-chantier').elements;
    const body = { statut: f.statut.value, assigned_to: f.assigned_to.value || null, date_prevue: f.date_prevue.value || null, notes: f.notes.value };
    if (isAdmin() && f.montant) body.montant = f.montant.value;
    try { await api('PUT', '/interventions/' + f.id.value, body); $('#dlg-chantier').close(); toast('Chantier enregistré'); if (S.view === 'chantiers') renderChantiers(); } catch (er) { toast(er.message, true); }
  });
  $('#form-user').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = $('#form-user').elements; const id = f.id.value;
    const body = { name: f.name.value.trim(), role: f.role.value }; if (f.password.value) body.password = f.password.value;
    if (!id) body.username = f.username.value.trim();
    try { await api(id ? 'PUT' : 'POST', '/users' + (id ? '/' + id : ''), body); $('#dlg-user').close(); S.users = (await api('GET', '/users/basic')).data; loadTeam(); toast(id ? 'Compte mis à jour' : 'Compte créé : donnez l\'identifiant et le mot de passe à la personne'); } catch (er) { toast(er.message, true); }
  });
  $('#form-event').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = $('#form-event').elements; const all = f.all_day.checked;
    const body = { title: f.title.value.trim(), all_day: all, location: f.location.value.trim(), notes: f.notes.value.trim(), lead_id: f.lead_id.value ? Number(f.lead_id.value) : null, assigned_to: f.assigned_to.value ? Number(f.assigned_to.value) : null,
      start: all ? f.start.value : (f.start.value ? new Date(f.start.value).toISOString() : ''), end: all ? (f.end.value || f.start.value) : (f.end.value ? new Date(f.end.value).toISOString() : '') };
    if (!body.start) return toast('Choisissez une date de début.', true);
    try {
      if (f.id.value) await api('PUT', '/events/' + f.id.value, body); else await api('POST', '/events', body);
      $('#dlg-event').close(); toast('Rendez-vous enregistré');
      if (body.lead_id) { await refreshAll(); }
      if (S.view === 'planning') renderPlanning();
    } catch (er) { toast(er.message, true); }
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
    try { await api('POST', '/interventions', Object.assign({ statut: 'confirme' }, f)); $('#dlg-inter').close(); if (S.view === 'chantiers') renderChantiers(); else renderInters(); toast('Chantier créé'); } catch (er) { toast(er.message, true); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.openId) closeDrawer(); });
  window.addEventListener('hashchange', () => { if (S.token) go(location.hash.replace(/^#\/?/, '')); });

  // ── Démarrage ─────────────────────────────────────────────
  applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
  let saved = ''; try { saved = sessionStorage.getItem('crm_token') || ''; } catch (e) { /* ignoré */ }
  if (saved) start(saved).catch(() => logout(true));
})();
