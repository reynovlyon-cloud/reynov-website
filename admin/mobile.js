/* REYNOV CRM — confort sur téléphone : feuilles « Plus » et « + », résultat d'appel en un appui, libellés des tableaux,
   clavier. S'appuie sur le pont window.CRM de crm.js (aucune dépendance). */
(function () {
  'use strict';
  const C = window.CRM; if (!C) return;
  const { S, api, esc, ico, toast, $, $$ } = C;

  // ── Feuilles qui montent du bas ──
  const item = (icon, label, attrs) => `<button class="btn" ${attrs}>${ico(icon)}${esc(label)}</button>`;
  function build() {
    ['dlg-more', 'dlg-quick', 'dlg-call'].forEach((id) => { const o = document.getElementById(id); if (o) o.remove(); });
    const admin = C.isAdmin();
    document.body.insertAdjacentHTML('beforeend', `
<dialog id="dlg-more" class="sheet"><div class="dlg"><h3>Plus</h3><div class="sheet-list" data-sheet>
  ${item('calendar', 'Planning', 'data-nav="planning"')}${item('wrench', 'Chantiers', 'data-nav="chantiers"')}${item('share', 'Publications', 'data-nav="publications"')}
  ${admin ? item('doc', 'Devis', 'data-nav="devis"') + item('bag', 'Interventions', 'data-nav="interventions"') + item('chart', 'Statistiques', 'data-nav="stats"') + item('gear', 'Paramètres', 'data-nav="settings"') : ''}
  <a class="btn" href="/" target="_blank" rel="noopener">${ico('external')}Voir le site</a>
  ${item('moon', 'Thème clair / sombre', 'data-action="theme"')}${item('logout', 'Déconnexion', 'data-action="logout"')}
</div></div></dialog>
<dialog id="dlg-quick" class="sheet"><div class="dlg"><h3>Ajouter</h3><div class="sheet-list" data-sheet>
  ${item('funnel', 'Nouveau lead', 'data-action="new-lead"')}
  ${admin ? item('target', 'Nouveau prospect', 'data-action="p-new"') : ''}
  ${item('users', 'Nouveau client', 'data-action="new-client"')}
  ${item('calendar', 'Nouveau rendez-vous', 'data-action="new-event"')}
  ${admin ? item('doc', 'Nouveau devis', 'data-action="new-quote"') : ''}
</div></div></dialog>
<dialog id="dlg-call" class="sheet"><div class="dlg"><h3 id="call-title">Résultat de l'appel</h3><p class="muted" style="margin:-8px 0 14px">Un appui suffit : c'est noté dans l'historique.</p><div class="sheet-list" id="call-btns"></div>
  <div class="foot"><button class="btn" type="button" data-action="close-dlg">Plus tard</button></div></div></dialog>`);
    // un appui sur une entrée referme la feuille avant que l'action ne s'exécute
    $$('[data-sheet]').forEach((box) => box.addEventListener('click', (e) => { if (e.target.closest('button, a')) box.closest('dialog').close(); }));
  }
  Object.assign(C.actions, {
    'more-open': () => { const d = $('#dlg-more'); if (d && !d.open) d.showModal(); },
    'quick-open': () => { const d = $('#dlg-quick'); if (d && !d.open) d.showModal(); },
  });

  // ── Résultat d'un appel : au retour dans l'appli, un appui note l'échange et fixe la suite ──
  const tomorrow10 = () => { const d = new Date(Date.now() + 86400000); d.setHours(10, 0, 0, 0); return d.toISOString(); };
  C.callResult = C.callResult || {};
  C.callResult.lead = async (id, result) => {
    const note = { pas_de_reponse: 'Appelé : pas de réponse', rappeler: 'Appelé : à rappeler', interesse: 'Appelé : intéressé', refus: 'Appelé : refus' }[result];
    try {
      await api('POST', '/leads/' + id + '/contact', { channel: 'appel', note });
      if (result === 'pas_de_reponse' || result === 'rappeler') await api('PATCH', '/leads/' + id, { status: 'a_rappeler', reminder_at: tomorrow10() });
      let undo = null;
      if (result === 'refus') { const l0 = (await api('GET', '/leads/' + id)).data; undo = { status: l0.status === 'perdu' ? 'contacte' : l0.status, reminder_at: l0.reminder_at }; await api('PATCH', '/leads/' + id, { status: 'perdu' }); }
      const l = (await api('GET', '/leads/' + id)).data; const i = S.leads.findIndex((x) => x.id === id); if (i >= 0) S.leads[i] = Object.assign(S.leads[i], l);
      if (undo) toast('Demande classée perdue : touchez ici pour annuler', false, async () => { try { await api('PATCH', '/leads/' + id, undo); const l2 = (await api('GET', '/leads/' + id)).data; const k = S.leads.findIndex((x) => x.id === id); if (k >= 0) S.leads[k] = Object.assign(S.leads[k], l2); toast('Annulé'); if (['leads', 'dashboard'].includes(S.view)) C.render(); } catch (e) { toast(e.message, true); } });
      else toast('Appel noté' + (result === 'pas_de_reponse' || result === 'rappeler' ? ' · rappel demain à 10 h' : ''));
      if (['leads', 'dashboard'].includes(S.view)) C.render();
    } catch (e) { toast(e.message, true); }
  };
  const RES_BTN = [['pas_de_reponse', 'phone', 'Pas de réponse'], ['rappeler', 'clock', 'Rappeler plus tard'], ['interesse', 'check', 'Intéressé'], ['refus', 'close', 'Refus']];
  function showCallSheet(pc) {
    const d = $('#dlg-call'); if (!d || d.open || !C.callResult[pc.kind]) return;
    $('#call-title').textContent = 'Appel' + (pc.name ? ' avec ' + pc.name : '') + ' : et alors ?';
    $('#call-btns').innerHTML = RES_BTN.map(([r, ic, l]) => `<button class="btn" data-callres="${r}">${ico(ic)}${esc(l)}</button>`).join('');
    $$('[data-callres]', d).forEach((b) => b.addEventListener('click', () => { const r = b.dataset.callres; d.close(); C.callResult[pc.kind](pc.id, r); }));
    C.pendingCall = null; d.showModal();
  }
  C.showCallSheet = showCallSheet;
  const back = () => {
    const pc = C.pendingCall; if (!pc) return;
    const dt = Date.now() - pc.at;
    if (dt > 30 * 60000) { C.pendingCall = null; return; }
    if (dt > 4000) showCallSheet(pc);                         // un vrai appel dure plus de quelques secondes
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') back(); });
  window.addEventListener('pageshow', back);
  // l'appel d'un lead déclenché depuis une fiche ou une liste
  const callLead = C.actions.call;
  C.actions.call = (el, e) => { const id = Number(el.dataset.id), l = S.leads.find((x) => x.id === id); C.pendingCall = { kind: 'lead', id, name: l ? C.fullName(l) : '', at: Date.now() }; if (callLead) callLead(el, e); };

  // ── Tableaux : chaque cellule reprend le libellé de sa colonne (affiché dans les cartes du téléphone) ──
  function labelTables() {
    $$('table.tbl').forEach((t) => {
      const heads = $$('thead th', t).map((h) => h.textContent.trim());
      $$('tbody tr', t).forEach((tr) => { $$('td', tr).forEach((td, i) => { if (!td.hasAttribute('data-label') && heads[i]) td.setAttribute('data-label', heads[i]); }); });
    });
  }
  let lt = 0; new MutationObserver(() => { clearTimeout(lt); lt = setTimeout(labelTables, 60); }).observe($('.content'), { childList: true, subtree: true });

  // ── Clavier ouvert : la barre du bas s'efface pour ne rien masquer ──
  const field = (e) => e.target && e.target.matches && e.target.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select');
  document.addEventListener('focusin', (e) => { if (field(e) && matchMedia('(max-width: 900px)').matches) document.body.classList.add('kb'); });
  document.addEventListener('focusout', (e) => { if (field(e)) setTimeout(() => { if (!document.activeElement || !document.activeElement.matches || !document.activeElement.matches('input, textarea, select')) document.body.classList.remove('kb'); }, 120); });

  C.on('ready', build);
})();
