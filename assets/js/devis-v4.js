/* REYNOV — devis en étapes courtes : une question par écran, passage automatique à la suivante dès le clic.
   Parcours particulier : vous êtes → problème → nombre → lieu (si utile) → photos → ville → coordonnées.
   Parcours professionnel : vous êtes → activité → nombre → échéance → photos → société et ville → coordonnées.
   Envoi vers /api/devis avec les mêmes champs qu'avant (serveur inchangé, tri du CRM inchangé).
   Retour arrière (bouton ou navigateur) sans rien perdre ; la confirmation ne s'affiche qu'après la réponse du serveur. */
(function () {
  'use strict';
  var form = document.getElementById('dv');
  if (!form) return;
  var d = document, t0 = Date.now();
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MAX_PHOTOS = 8, MAX_FILE = 8 * 1024 * 1024, MAX_TOTAL = 18 * 1024 * 1024, EDGE = 1600, QUALITE = 0.82;
  var RE_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var BESOINS = {
    renovation: { p: 'Rénovation', pb: 'Rayures / trottoir', t: 'Rayée ou frottée' },
    diamantee: { p: 'Jante diamantée', pb: 'Jante diamantée abîmée', t: 'Diamantée abîmée' },
    devoilage: { p: 'Dévoilage', pb: 'Jante voilée / vibrations', t: 'Voilée' },
    fissure: { p: 'Soudure / fissure', pb: 'Fissure / cassure', t: 'Fissurée ou cassée' },
    epoxy: { p: 'Peinture époxy et thermolaquage', pb: '', t: 'Époxy ou thermolaquage' },
    perso: { p: 'Personnalisation', pb: 'Changement de couleur', t: 'Changer de couleur' },
    inconnu: { p: 'À préciser', pb: 'Je ne sais pas', t: 'Je ne sais pas' }
  };
  var ATELIER_SEUL = ['devoilage', 'fissure', 'epoxy'];
  var S = { qui: '', besoin: '', activite: '', nombre: '', lieu: '', echeance: '', plusTard: false, offre: '' };
  var photos = [], seq = 0, envoi = false, courant = '';

  function track(nom, p) { try { if (typeof gtag === 'function') gtag('event', nom, Object.assign({ transport_type: 'beacon' }, p || {})); } catch (e) { /* facultatif */ } }

  /* ── Réponses déjà connues par le lien d'arrivée ── */
  (function () {
    var q = new URLSearchParams(location.search);
    var alias = { personnalisation: 'perso', soudure: 'fissure', fissures: 'fissure', thermolaquage: 'epoxy', 'jante-diamantee': 'diamantee' };
    var b = q.get('besoin') || q.get('prestation'); b = b && (alias[b] || b);
    // offre valable pour les réservations du 24 au 28 novembre 2026 inclus (heure de Paris) ; hors période : devis normal
    var bfOk = /[?&]bf=apercu\b/.test(location.search) || (Date.now() >= Date.parse('2026-11-24T00:00:00+01:00') && Date.now() < Date.parse('2026-11-29T00:00:00+01:00'));
    if (q.get('offre') === 'black-friday' && bfOk) { S.offre = 'bf'; S.qui = 'part'; S.besoin = 'renovation'; S.nombre = '4'; S.lieu = 'atelier'; $('[data-offre]').hidden = false; }
    else if (q.get('pro') === '1' || q.get('lot') === '1') S.qui = 'pro';
    else if (b && BESOINS[b]) { S.qui = 'part'; S.besoin = b; }
    var l = q.get('lieu'); if (l === 'atelier' || l === 'domicile') S.lieu = l;
  })();

  function lieuFinal() {
    if (S.qui === 'pro') return '';
    if (ATELIER_SEUL.indexOf(S.besoin) >= 0 || S.nombre === '1' || S.nombre === '2') return 'atelier';
    return S.lieu;
  }
  function parcours() {
    if (S.offre === 'bf') return ['photos', 'ville', 'contact'];
    if (S.qui === 'pro') return ['qui', 'activite', 'nombre', 'echeance', 'photos', 'ville', 'contact'];
    var p = ['qui', 'besoin', 'nombre'];
    if (ATELIER_SEUL.indexOf(S.besoin) < 0 && S.nombre !== '1' && S.nombre !== '2') p.push('lieu');
    return p.concat(['photos', 'ville', 'contact']);
  }
  function repondu(q) {
    if (q === 'photos') return photos.length > 0 || S.plusTard;
    if (q === 'ville') return $('#dv-ville').value.trim().length > 1;
    if (q === 'contact') return false;
    return !!S[q === 'qui' ? 'qui' : q];
  }

  /* ── Affichage d'une question ── */
  var barre = $('.dvh__barre span'), compteur = $('.dvh__n'), retourBtn = $('[data-retour]');
  function montrer(q, sens) {
    var p = parcours(), i = p.indexOf(q); if (i < 0) { q = p[0]; i = 0; }
    courant = q;
    $$('.dvq').forEach(function (f) {
      var on = f.getAttribute('data-q') === q; f.hidden = !on;
      if (on) { f.classList.toggle('is-retour', sens < 0); }
    });
    $$('[data-only]').forEach(function (n) { n.hidden = n.getAttribute('data-only') !== (S.qui || 'part'); });
    $$('.dvq[data-q="' + q + '"] .ch').forEach(function (b) {
      var k = q, v = b.getAttribute('data-v');
      b.setAttribute('aria-pressed', S[k] && S[k] === v ? 'true' : 'false');
    });
    barre.style.width = Math.max(6, Math.round((i + 1) / p.length * 100)) + '%';
    compteur.textContent = 'Question ' + (i + 1) + ' sur ' + p.length;
    retourBtn.hidden = i === 0;
    if (q === 'contact') recap();
    if (q === 'photos') majPhotosUI();
    var t = $('.dvq[data-q="' + q + '"] .dvq__t');
    window.scrollTo(0, 0);
    if (t && sens !== 0) t.focus({ preventScroll: true });
    track('devis_step', { step: i + 1, step_name: q });
  }
  // n = profondeur dans l'historique de cette page : le retour ne quitte jamais le formulaire par erreur
  function avancer() {
    var p = parcours(), i = p.indexOf(courant), n = p[i + 1];
    if (!n) return;
    var prof = (history.state && history.state.n) || 0;
    try { history.pushState({ dv: n, n: prof + 1 }, '', '#' + n); } catch (e) { /* facultatif */ }
    montrer(n, 1);
  }
  function reculer() {
    if (history.state && history.state.n > 0) { history.back(); return; }
    var p = parcours(), i = p.indexOf(courant);
    if (i > 0) { try { history.replaceState({ dv: p[i - 1], n: 0 }, '', location.pathname + location.search); } catch (e) { /* facultatif */ } montrer(p[i - 1], -1); }
  }
  retourBtn.addEventListener('click', reculer);
  window.addEventListener('popstate', function (e) {
    if (envoi) return;
    var q = e.state && e.state.dv, p = parcours();
    montrer(q && p.indexOf(q) >= 0 ? q : p[0], -1);
  });

  /* ── Choix : un clic = réponse enregistrée + question suivante ── */
  form.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.ch') : null; if (!b || envoi) return;
    var q = b.closest('.dvq').getAttribute('data-q'), v = b.getAttribute('data-v');
    if (q === 'qui' && v !== S.qui) { S.nombre = ''; }
    S[q] = v;
    $$('.ch', b.closest('.dvq')).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    setTimeout(avancer, reduit ? 0 : 160);
  });

  /* ── Photos : réduites sur l'appareil (1600 px, qualité 0,82) pour un envoi rapide ── */
  var input = $('#dv-photos'), liste = $('#dv-vignettes'), etat = $('#dv-photo-etat'), depot = $('.depot');
  var btnSuitePh = $('[data-suite="photos"]'), btnPlusTard = $('[data-plus-tard]');
  function dire(m) { etat.textContent = m; }
  function taille(n) { return n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.round(n / 1024) + ' Ko'; }
  function total() { return photos.reduce(function (n, p) { return n + (p.blob ? p.blob.size : 0); }, 0); }
  function reduire(file) {
    return new Promise(function (ok, ko) {
      var dessiner = function (src, w, h) {
        var k = Math.min(1, EDGE / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
        var c = d.createElement('canvas'); c.width = cw; c.height = ch;
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cw, ch); x.drawImage(src, 0, 0, cw, ch);
        c.toBlob(function (b) {
          if (!b) return ko(new Error('encodage'));
          ok(file.type === 'image/jpeg' && file.size <= b.size && k === 1 ? file : b);
        }, 'image/jpeg', QUALITE);
      };
      var parImg = function () {
        var u = URL.createObjectURL(file), im = new Image();
        im.onload = function () { try { dessiner(im, im.naturalWidth, im.naturalHeight); } catch (e) { ko(e); } URL.revokeObjectURL(u); };
        im.onerror = function () { URL.revokeObjectURL(u); ko(new Error('lecture')); };
        im.src = u;
      };
      if (window.createImageBitmap) createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bm) { try { dessiner(bm, bm.width, bm.height); } catch (e) { ko(e); } if (bm.close) bm.close(); }, parImg);
      else parImg();
    });
  }
  function ajouter(list) {
    var files = Array.prototype.slice.call(list || []); if (!files.length) return;
    var place = MAX_PHOTOS - photos.length, refus = 0, doublon = 0, lourde = 0;
    files.forEach(function (f) {
      if (!(/^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name))) { refus++; return; }
      var cle = f.name + '|' + f.size + '|' + f.lastModified;
      if (photos.some(function (p) { return p.cle === cle; })) { doublon++; return; }
      if (place <= 0) { refus++; return; }
      place--;
      var p = { id: ++seq, cle: cle, nom: f.name, blob: null, url: '', brut: false, prep: true };
      photos.push(p); majPhotosUI();
      reduire(f).then(function (b) { p.blob = b; p.url = URL.createObjectURL(b); }, function () {
        if (f.size <= MAX_FILE) { p.blob = f; p.brut = true; } else { lourde++; photos = photos.filter(function (x) { return x !== p; }); }
      }).then(function () {
        p.prep = false;
        if (total() > MAX_TOTAL) { photos = photos.filter(function (x) { return x !== p; }); dire('Ces photos sont trop lourdes au total. Retirez-en une ou envoyez-la ensuite sur WhatsApp.'); }
        majPhotosUI();
        if (!photos.some(function (x) { return x.prep; })) {
          var m = photos.length + (photos.length > 1 ? ' photos prêtes' : ' photo prête') + ' (' + taille(total()) + ').';
          if (lourde) m += ' Une photo trop lourde n’a pas pu être lue : envoyez-la ensuite sur WhatsApp.';
          dire(m);
        }
      });
    });
    var notes = [];
    if (doublon) notes.push('Cette photo est déjà ajoutée.');
    if (refus) notes.push(photos.length >= MAX_PHOTOS ? 'Maximum ' + MAX_PHOTOS + ' photos.' : 'Seules les photos sont acceptées.');
    dire(notes.length ? notes.join(' ') : 'Préparation des photos…');
    input.value = '';
  }
  input.addEventListener('change', function () { ajouter(input.files); });
  function majPhotosUI() {
    liste.innerHTML = '';
    photos.forEach(function (p, i) {
      var li = d.createElement('li'); li.className = 'vg';
      if (p.url && !p.brut) { var im = d.createElement('img'); im.src = p.url; im.alt = 'Photo ' + (i + 1); li.appendChild(im); }
      else { var r = d.createElement('div'); r.className = 'vg__brut'; r.textContent = p.prep ? '' : 'Photo ' + (i + 1); li.appendChild(r); }
      if (p.prep) { var z = d.createElement('div'); z.className = 'vg__prep'; z.textContent = 'Préparation…'; li.appendChild(z); }
      var x = d.createElement('button'); x.type = 'button'; x.className = 'vg__x'; x.setAttribute('aria-label', 'Retirer la photo ' + (i + 1));
      x.innerHTML = '<span><svg class="ico" aria-hidden="true"><use href="#i-x"/></svg></span>';
      x.addEventListener('click', function () {
        if (p.url) URL.revokeObjectURL(p.url);
        photos = photos.filter(function (y) { return y !== p; });
        majPhotosUI(); dire('Photo retirée. ' + photos.length + ' photo' + (photos.length > 1 ? 's' : '') + ' restante' + (photos.length > 1 ? 's' : '') + '.');
        (liste.querySelector('.vg__x') || input).focus();
      });
      li.appendChild(x); liste.appendChild(li);
    });
    var plein = photos.length >= MAX_PHOTOS, prep = photos.some(function (p) { return p.prep; });
    depot.setAttribute('aria-disabled', plein ? 'true' : 'false'); input.disabled = plein;
    depot.querySelector('span').textContent = photos.length ? 'Ajouter d’autres photos' : 'Prendre ou choisir des photos';
    btnSuitePh.hidden = !photos.length; btnSuitePh.disabled = prep;
    btnSuitePh.firstChild.textContent = prep ? 'Préparation des photos…' : 'Continuer';
    btnPlusTard.hidden = photos.length > 0;
  }
  btnSuitePh.addEventListener('click', function () { if (!photos.some(function (p) { return p.prep; })) { S.plusTard = false; avancer(); } });
  btnPlusTard.addEventListener('click', function () { S.plusTard = true; avancer(); });

  /* ── Ville : une puce = réponse + suite ; sinon saisie puis « Continuer » ou Entrée ── */
  var ville = $('#dv-ville');
  function villeOk() {
    var ok = ville.value.trim().length > 1, e = $('[data-err="ville"]');
    e.hidden = ok; if (ok) ville.removeAttribute('aria-invalid'); else ville.setAttribute('aria-invalid', 'true');
    return ok;
  }
  $$('.puce').forEach(function (b) { b.addEventListener('click', function () { ville.value = b.getAttribute('data-ville'); villeOk(); setTimeout(avancer, reduit ? 0 : 120); }); });
  $('[data-suite="ville"]').addEventListener('click', function () { if (villeOk()) avancer(); else ville.focus(); });
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
    if (courant === 'ville') { e.preventDefault(); if (villeOk()) avancer(); }
  });

  /* ── Récapitulatif avant envoi ── */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lignes() {
    var r = [];
    if (S.offre === 'bf') r.push(['Offre', 'Black Friday : 3 jantes, la 4e offerte']);
    else if (S.qui === 'pro') { r.push(['Activité', S.activite || '—']); if ($('#dv-societe').value.trim()) r.push(['Société', $('#dv-societe').value.trim()]); }
    else r.push(['Problème', S.besoin ? BESOINS[S.besoin].t : '—']);
    var n = S.nombre; r.push(['Jantes', !n ? '—' : /^\d+$/.test(n) ? n + (n === '1' ? ' jante' : ' jantes') : n === 'Récurrent' ? 'Lots réguliers' : n]);
    if (S.qui === 'pro') r.push(['Échéance', S.echeance || '—']);
    var l = lieuFinal(); if (l) r.push(['Lieu', l === 'atelier' ? 'Atelier, La Mulatière' : 'À domicile']);
    r.push(['Ville', $('#dv-ville').value.trim() || '—']);
    r.push(['Photos', photos.length ? photos.length + (photos.length > 1 ? ' photos' : ' photo') : 'Envoyées plus tard']);
    return r;
  }
  function recap() {
    var h = '<dl>' + lignes().map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>';
    var ph = photos.filter(function (p) { return p.url && !p.brut; });
    if (ph.length) h += '<div class="recap__ph">' + ph.map(function (p, i) { return '<img src="' + p.url + '" alt="Photo ' + (i + 1) + '">'; }).join('') + '</div>';
    $('#dv-recap').innerHTML = h;
  }

  /* ── Envoi ── */
  var bouton = $('#dv-envoyer'), libelle = bouton.querySelector('span'), errEnvoi = $('#dv-err-envoi'), statut = $('#dv-statut');
  function chiffres(s) { return String(s || '').replace(/\D/g, ''); }
  function erreurChamp(cle, champ, ok) {
    $('[data-err="' + cle + '"]').hidden = ok;
    if (ok) champ.removeAttribute('aria-invalid'); else champ.setAttribute('aria-invalid', 'true');
    return ok;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (envoi) return;
    if (courant !== 'contact') { if (courant === 'ville' && villeOk()) avancer(); return; }
    var pr = $('#dv-prenom'), te = $('#dv-tel'), em = $('#dv-email');
    var ok1 = erreurChamp('prenom', pr, pr.value.trim().length > 0), ok2 = erreurChamp('tel', te, chiffres(te.value).length >= 8), ok3 = erreurChamp('email', em, RE_MAIL.test(em.value.trim()));
    if (!(ok1 && ok2 && ok3)) { (!ok1 ? pr : !ok2 ? te : em).focus(); return; }
    var manque = parcours().filter(function (q) { return q !== 'contact' && !repondu(q); })[0];
    if (manque) { montrer(manque, -1); return; }

    var pro = S.qui === 'pro', bfo = S.offre === 'bf', l = lieuFinal(), desc = [];
    var fd = new FormData();
    fd.append('_t', String(t0));
    fd.append('website', $('input[name="website"]').value);
    try { var a = window.reynovAttr ? window.reynovAttr() : {}; if (a && Object.keys(a).length) fd.append('attr', JSON.stringify(a)); } catch (x) { /* facultatif */ }
    if (bfo) desc.push('Offre Black Friday 2026 : 3 jantes rénovées, la 4e offerte (face avant, à l’atelier).');
    if ($('#dv-message').value.trim()) desc.push($('#dv-message').value.trim());
    if (pro && $('#dv-societe').value.trim()) desc.push('Société : ' + $('#dv-societe').value.trim());
    if (pro && S.nombre === 'Récurrent') desc.push('Besoin : lots réguliers');
    if (!pro && l === 'atelier' && S.lieu === 'domicile') desc.push('Demande à domicile, orientée vers l’atelier (moins de 3 jantes ou prestation d’atelier).');
    if (S.plusTard && !photos.length) desc.push('Photos : envoyées plus tard (WhatsApp ou e-mail).');
    fd.append('prestation', bfo ? 'Black Friday · rénovation face avant (4 jantes, la 4e offerte)' : pro ? 'Lot professionnel : ' + S.activite : BESOINS[S.besoin].p);
    fd.append('problemes', pro || bfo ? '' : BESOINS[S.besoin].pb);
    fd.append('nb_jantes', S.nombre);
    fd.append('mode', l === 'atelier' ? 'En atelier (REYNOV)' : l === 'domicile' ? 'À domicile' : '');
    fd.append('delai', pro ? S.echeance : '');
    fd.append('adresse', $('#dv-ville').value.trim());
    fd.append('description', desc.join('\n'));
    fd.append('prenom', pr.value.trim()); fd.append('nom', $('#dv-nom').value.trim());
    fd.append('email', em.value.trim()); fd.append('tel', te.value.trim());
    photos.forEach(function (p, i) { var ext = /png/.test(p.blob.type) ? 'png' : /heic|heif/i.test(p.blob.type + p.nom) ? 'heic' : /webp/.test(p.blob.type) ? 'webp' : 'jpg'; fd.append('photos', p.blob, 'photo-' + (i + 1) + '.' + ext); });

    envoi = true; bouton.disabled = true; errEnvoi.hidden = true; libelle.textContent = 'Envoi en cours…'; statut.textContent = 'Envoi de votre demande…';
    var remettre = function () { envoi = false; bouton.disabled = false; libelle.textContent = 'Envoyer ma demande'; };
    var erreur = function (m) { remettre(); errEnvoi.textContent = m; errEnvoi.hidden = false; statut.textContent = ''; };
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/devis'); xhr.timeout = 120000;
    xhr.upload.onprogress = function (ev) { if (ev.lengthComputable && photos.length) statut.textContent = 'Envoi de vos photos : ' + Math.round(ev.loaded / ev.total * 100) + ' %'; };
    xhr.onload = function () {
      var j = null; try { j = JSON.parse(xhr.responseText); } catch (x) { /* réponse illisible */ }
      if (j && j.ok) {
        statut.textContent = 'Demande reçue.';
        try { if (window.reynovFbq) window.reynovFbq('Lead', { content_name: bfo ? 'black_friday' : pro ? 'lot_pro' : 'devis' }); } catch (x) { /* facultatif */ }
        var parti = false, aller = function () { if (parti) return; parti = true; location.href = '/devis-confirmation.html'; };
        if (typeof gtag === 'function' && window.google_tag_manager) { gtag('event', 'conversion', { send_to: 'AW-18189889040/7zKmCNbLnMwcEJDczuFD', event_callback: aller }); setTimeout(aller, 1200); } else aller();
      } else erreur((j && j.error) || 'L’envoi n’a pas abouti. Vos réponses et vos photos sont conservées : réessayez, ou appelez le 06 61 45 35 27.');
    };
    xhr.onerror = xhr.ontimeout = function () { erreur('Connexion impossible. Vos réponses et vos photos sont conservées : réessayez, ou appelez le 06 61 45 35 27.'); };
    xhr.send(fd);
  });

  /* ── Démarrage : première question sans réponse ── */
  var p0 = parcours(), debut = p0.filter(function (q) { return !repondu(q); })[0] || p0[0];
  try { history.replaceState({ dv: debut, n: 0 }, '', location.pathname + location.search); } catch (e) { /* facultatif */ }
  montrer(debut, 0);
  window.__devisT0 = t0;
  track('devis_start', { step_name: debut });
})();
