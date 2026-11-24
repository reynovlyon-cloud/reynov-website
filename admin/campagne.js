/* REYNOV CRM — Campagne e-mail « Black Friday » aux clients (administrateur). S'appuie sur le pont window.CRM de crm.js.
   Rien ne part sans « Envoyer la campagne » + confirmation du nombre de destinataires ; le test ne part que vers reynov.lyon@gmail.com.
   Règles des destinataires et rythme d'envoi : server/campagne.js. */
(function () {
  'use strict';
  const C = window.CRM; if (!C) return;
  const { api, esc, toast, ico, $ } = C;
  let D = null, minuteur = null, occupe = false;
  const quand = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(' ', ' à '); };
  const pluriel = (n, un, plusieurs) => n + ' ' + (n > 1 ? plusieurs : un);

  async function charger() {
    try { D = (await api('GET', '/campagne/bf2026')).data; } catch (e) { toast(e.message || 'Chargement impossible', true); }
    dessiner(); suivre();
  }
  function suivre() { clearTimeout(minuteur); if (D && D.job && D.job.en_cours && C.S.view === 'campagne') minuteur = setTimeout(charger, 3000); }

  function etatLigne(d) {
    if (d.envoye_le) return `<span style="color:var(--green)">${ico('check')} Envoyé le ${esc(quand(d.envoye_le))}</span>${d.simule ? ' <span class="faint">(simulé, mode test)</span>' : ''}`;
    if (d.echec) return `<span style="color:var(--red)">Échec : ${esc(d.echec)}</span> <span class="faint">(nouvel essai au prochain envoi)</span>`;
    return '<span class="muted">À envoyer</span>';
  }
  function tableau(lignes, colonnes, vide) {
    if (!lignes.length) return `<p class="muted" style="padding:6px 14px 14px">${vide}</p>`;
    return `<div class="table-card" style="padding:0 4px 6px"><table class="tbl"><thead><tr>${colonnes.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${lignes.join('')}</tbody></table></div>`;
  }

  function dessiner() {
    const v = $('#view-campagne'); if (!v) return;
    if (!D) { v.innerHTML = '<div class="card"><p class="muted">Chargement…</p></div>'; return; }
    const j = D.job, enCours = !!(j && j.en_cours);
    const exclusNb = D.exclus.length;
    const df = new Date(D.fin);
    const hm = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(df);
    const hh = Number((hm.find((x) => x.type === 'hour') || {}).value), mn = (hm.find((x) => x.type === 'minute') || {}).value || '00';
    const fin = df.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }) + ' à ' + hh + ' h' + (mn !== '00' ? ' ' + mn : '');
    const statut = !D.ouverte ? `<div class="alert"><span>L'offre est terminée : la campagne ne peut plus partir.</span></div>`
      : enCours ? `<div class="alert"><span>${ico('mail')}&nbsp; Envoi en cours : <strong>${j.envoyes}</strong> sur ${j.total}${j.erreurs ? ', ' + pluriel(j.erreurs, 'échec', 'échecs') : ''}. Un e-mail toutes les ${D.intervalle_s} s environ.</span></div>`
      : j && j.fin ? `<div class="alert"><span>Dernier envoi : ${esc(j.motif)} — ${pluriel(j.envoyes, 'e-mail envoyé', 'e-mails envoyés')}${j.erreurs ? ', ' + pluriel(j.erreurs, 'échec', 'échecs') : ''} (${esc(quand(j.fin))}).</span></div>` : '';
    const groupes = [['Intervention confirmée ou réalisée', D.comptes.intervention], ['Demande gagnée', D.comptes.gagne], ['Devis accepté', D.comptes.devis], ['Ajouté à la main', D.comptes.manuel]];

    const lignesDest = D.destinataires.map((d) => `<tr><td><strong>${esc(d.nom || '—')}</strong></td><td>${esc(d.email)}</td><td class="muted">${esc(d.groupes.join(', '))}</td><td>${etatLigne(d)}</td>
      <td style="text-align:center">${d.envoye_le ? '<span class="faint">—</span>' : `<input type="checkbox" checked data-cp-email="${esc(d.email)}" data-cp-mode="retirer" aria-label="Garder ${esc(d.email)} dans l'envoi" ${enCours ? 'disabled' : ''}>`}</td></tr>`);
    const lignesSans = D.sans_achat.map((d) => `<tr><td>${esc(d.nom || '—')}</td><td>${esc(d.email)}</td>
      <td>${d.bloque ? `<span class="faint">${esc(d.bloque)}</span>` : `<label style="display:inline-flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" data-cp-email="${esc(d.email)}" data-cp-mode="ajouter" ${enCours ? 'disabled' : ''}> A déjà été client</label>`}</td></tr>`);
    const lignesExclus = D.exclus.map((d) => `<tr><td>${esc(d.nom || '—')}</td><td>${esc(d.email)}</td><td>${esc(d.raison)}</td>
      <td>${d.manuel ? `<label style="display:inline-flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" data-cp-email="${esc(d.email)}" data-cp-mode="remettre" ${enCours ? 'disabled' : ''}> Remettre</label>` : ''}</td></tr>`);

    v.innerHTML = `
      <div class="card">
        <h3 style="margin-bottom:4px">${esc(D.sujet)}</h3>
        <p class="muted" style="margin:0">Offre valable jusqu'au ${esc(fin)}. Envoyé uniquement aux clients (règle CNIL), avec un lien « se désinscrire » dans chaque message. Rien ne part sans votre confirmation.</p>
        ${D.test_mode ? '<p class="faint" style="margin:8px 0 0">Mode test : aucun e-mail ne part réellement, les envois sont simulés.</p>' : (!D.gmail ? '<p style="margin:8px 0 0;color:var(--red)">Gmail n\'est pas configuré sur le serveur : aucun envoi possible.</p>' : '')}
        ${statut}
        <div class="grid stats" style="margin-top:16px">
          <div class="card stat"><div class="lbl">À envoyer</div><div class="val">${D.a_envoyer}</div><div class="sub">clients, sans doublon</div></div>
          <div class="card stat"><div class="lbl">Déjà envoyés</div><div class="val">${D.deja_envoyes}</div><div class="sub">jamais renvoyé à la même adresse</div></div>
          <div class="card stat"><div class="lbl">Aujourd'hui</div><div class="val">${D.aujourdhui}</div><div class="sub">sur ${D.limite_jour} au plus par jour</div></div>
          <div class="card stat"><div class="lbl">Exclus</div><div class="val">${exclusNb}</div><div class="sub">désinscrits, « ne plus relancer », tests</div></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
          <button class="btn" data-action="cp-test" ${enCours || occupe ? 'disabled' : ''}>${ico('mail')} Envoyer un test à ${esc(D.test_to)}</button>
          ${enCours ? `<button class="btn danger" data-action="cp-arreter">Arrêter l'envoi</button>`
            : `<button class="btn primary" data-action="cp-envoyer" ${!D.ouverte || !D.a_envoyer || occupe || (!D.gmail && !D.test_mode) ? 'disabled' : ''}>Envoyer la campagne (${D.a_envoyer})</button>`}
          <button class="btn" data-action="cp-recharger">Actualiser</button>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>Destinataires par groupe</h3>
        <p class="muted" style="margin:0 0 10px">Une même personne peut être dans plusieurs groupes : elle ne reçoit qu'un seul e-mail.</p>
        <div class="chips">${groupes.map(([l, n]) => `<span class="chip">${esc(l)} : <strong>${n}</strong></span>`).join('')}</div>
      </div>

      <div class="card" style="margin-top:16px;padding-bottom:6px">
        <h3>Liste des destinataires (${D.destinataires.length})</h3>
        <p class="muted" style="margin:0 0 8px">Décochez une ligne pour retirer la personne de l'envoi.</p>
        ${tableau(lignesDest, ['Nom', 'E-mail', 'Groupe', 'État', 'Inclure'], 'Aucun client avec e-mail pour l\'instant.')}
      </div>

      <details class="card" style="margin-top:16px">
        <summary style="cursor:pointer"><strong>Fiches clients sans achat enregistré (${D.sans_achat.length})</strong> <span class="muted">— non incluses</span></summary>
        <p class="muted" style="margin:10px 0">Le CRM crée une fiche client à chaque demande, même sans achat : ces personnes ne sont pas « clientes » au sens de la CNIL. Cochez seulement celles qui ont déjà été clientes (par exemple avant le CRM).</p>
        ${tableau(lignesSans, ['Nom', 'E-mail', 'Ajouter'], 'Aucune.')}
      </details>

      <details class="card" style="margin-top:16px">
        <summary style="cursor:pointer"><strong>Exclus (${exclusNb})</strong></summary>
        ${tableau(lignesExclus, ['Nom', 'E-mail', 'Raison', ''], 'Personne n\'est exclu.')}
      </details>

      <div class="card" style="margin-top:16px">
        <h3>Une réponse « STOP » reçue ?</h3>
        <p class="muted" style="margin:0 0 10px">Le bouton « Se désinscrire » de la messagerie peut aussi envoyer « STOP » à ${esc(D.test_to)}. Saisissez l'adresse : la personne ne recevra plus d'offres, comme avec le lien de l'e-mail.</p>
        <form id="cp-stop" style="display:flex;gap:10px;flex-wrap:wrap"><input class="input" type="email" name="email" required placeholder="adresse@exemple.fr" style="flex:1 1 240px;min-width:0" autocomplete="off"><button class="btn" type="submit">Ne plus lui envoyer d'offres</button></form>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>Image du haut de l'e-mail</h3>
        <p class="muted" style="margin:0 0 12px">Cliquez sur l'image à utiliser : l'aperçu, le test et l'envoi suivent ce choix.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">${(D.images || []).map((im) => `
          <button type="button" class="card" data-action="cp-image" data-image="${esc(im.id)}" ${enCours ? 'disabled' : ''} aria-pressed="${im.id === D.image}"
            style="padding:10px;text-align:left;cursor:pointer;${im.id === D.image ? 'outline:2px solid var(--blue);outline-offset:2px' : ''}">
            <img src="${esc(im.src)}" alt="" style="display:block;width:100%;border-radius:10px">
            <span style="display:block;margin-top:8px;font-weight:600">${im.id === 'sans-texte' ? 'Photos seules, sans texte' : 'Image du brief (titre, dates et logo écrits dessus)'}${im.id === D.image ? ' · choisie' : ''}</span>
          </button>`).join('')}
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>Aperçu de l'e-mail</h3>
        <p style="margin:0"><span class="muted">Objet :</span> ${esc(D.sujet)}</p>
        <p style="margin:2px 0 12px"><span class="muted">Pré-en-tête :</span> ${esc(D.preheader)}</p>
        <iframe id="cp-frame" title="Aperçu de l'e-mail Black Friday" sandbox="" class="pm-frame" style="height:min(78vh,1400px)"></iframe>
        <p class="faint" style="font-size:12px;margin:8px 0 0">Dans l'aperçu, « Prénom » est remplacé par le prénom de chaque client, et le lien « se désinscrire » est propre à chacun.</p>
      </div>`;
    const f = $('#cp-frame'); if (f) f.srcdoc = D.apercu;
  }

  async function choix(email, inclure) {
    try { D = (await api('POST', '/campagne/bf2026/choix', { email, inclure })).data; dessiner(); } catch (e) { toast(e.message, true); charger(); }
  }
  document.addEventListener('submit', async (e) => {
    if (!e.target || e.target.id !== 'cp-stop') return;
    e.preventDefault();
    const email = (e.target.elements.email.value || '').trim(); if (!email) return;
    try { D = (await api('POST', '/campagne/bf2026/stop', { email })).data; dessiner(); toast('C\'est noté : ' + email + ' ne recevra plus d\'offres.'); } catch (er) { toast(er.message, true); }
  });
  document.addEventListener('change', (e) => {
    const cb = e.target.closest && e.target.closest('[data-cp-email]'); if (!cb) return;
    const mode = cb.getAttribute('data-cp-mode'), email = cb.getAttribute('data-cp-email');
    if (mode === 'retirer') choix(email, cb.checked ? null : false);
    else if (mode === 'ajouter') choix(email, cb.checked ? true : null);
    else if (mode === 'remettre') choix(email, cb.checked ? null : false);
  });

  Object.assign(C.actions, {
    'cp-recharger': () => charger(),
    'cp-image': async (el) => {
      try { D = (await api('POST', '/campagne/bf2026/image', { image: el.getAttribute('data-image') })).data; dessiner(); toast('Image du haut choisie'); } catch (e) { toast(e.message, true); }
    },
    'cp-test': async () => {
      if (occupe) return; occupe = true; dessiner();
      try { const r = (await api('POST', '/campagne/bf2026/test')).data; toast(r.simule ? 'Test simulé (mode test) : rien n\'est parti.' : 'Test envoyé à ' + r.to + ' : vérifiez sur téléphone et sur ordinateur.'); }
      catch (e) { toast(e.message, true); }
      occupe = false; dessiner();
    },
    'cp-envoyer': async () => {
      if (occupe || !D) return;
      const n = D.a_envoyer;
      if (!window.confirm('Envoyer l\'e-mail « ' + D.sujet + ' » à ' + pluriel(n, 'client', 'clients') + ' ?\n\nUn e-mail toutes les ' + D.intervalle_s + ' secondes environ, ' + D.limite_jour + ' au plus par jour. Vous pourrez arrêter l\'envoi à tout moment.')) return;
      occupe = true;
      try { const r = (await api('POST', '/campagne/bf2026/envoyer', { attendu: n })).data; toast('Envoi lancé : ' + pluriel(r.total, 'destinataire', 'destinataires') + (r.aujourdhui_max < r.total ? ' (' + r.aujourdhui_max + ' aujourd\'hui, la suite demain)' : '') + '.'); }
      catch (e) { toast(e.message, true); }
      occupe = false; charger();
    },
    'cp-arreter': async () => { try { await api('POST', '/campagne/bf2026/arreter'); toast('Arrêt demandé : l\'e-mail en cours se termine.'); } catch (e) { toast(e.message, true); } charger(); },
  });

  C.addView('campagne', { title: 'Campagne Black Friday', admin: true, render: () => { if (!D) dessiner(); charger(); } });
})();
