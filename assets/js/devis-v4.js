/* REYNOV — devis en 5 écrans, tout au clic : problème → véhicule (+ nombre de jantes) → atelier ou domicile + code postal → photos → coordonnées.
   Professionnels (?pro=1) : activité → quantité → échéance → photos → société + code postal → coordonnées.
   Black Friday (?offre=black-friday, du 24 au 28 novembre 2026, heure de Paris) : véhicule → code postal (atelier) → photos → coordonnées.
   Envoi vers /api/devis avec les mêmes champs qu'avant (serveur et tri du CRM inchangés). Retour arrière sans rien perdre. */
(function () {
  'use strict';
  var form = document.getElementById('dv');
  if (!form) return;
  var d = document, t0 = Date.now();
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MAX_PHOTOS = 8, MAX_FILE = 8 * 1024 * 1024, MAX_TOTAL = 18 * 1024 * 1024, EDGE = 1600, QUALITE = 0.82;
  var RE_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, RE_CP = /^\d{5}$/;

  // intitulés envoyés au CRM : les mêmes qu'avant (reconnus par le tri automatique)
  var BESOINS = {
    renovation: { p: 'Rénovation', pb: 'Rayures / trottoir', t: 'Jante rayée' },
    fissure: { p: 'Soudure / fissure', pb: 'Fissure / cassure', t: 'Fissure, soudure' },
    devoilage: { p: 'Dévoilage', pb: 'Jante voilée / vibrations', t: 'Dévoilage' },
    perso: { p: 'Personnalisation', pb: 'Changement de couleur', t: 'Personnalisation' }
  };
  var ATELIER_SEUL = ['fissure', 'devoilage'];
  var S = { besoin: '', nombre: '', lieu: '', activite: '', echeance: '', plusTard: false, offre: '', pro: false, lieuDemande: '' };
  var photos = [], seq = 0, envoi = false, courant = '';
  var champ = { vehicule: $('#dv-vehicule'), cp: $('#dv-cp'), societe: $('#dv-societe'), cpPro: $('#dv-cp-pro') };

  function track(nom, p) { try { if (typeof gtag === 'function') gtag('event', nom, Object.assign({ transport_type: 'beacon' }, p || {})); } catch (e) { /* facultatif */ } }

  /* ── Réponses connues par le lien d'arrivée ── */
  (function () {
    var q = new URLSearchParams(location.search);
    var alias = { personnalisation: 'perso', soudure: 'fissure', fissures: 'fissure', rayure: 'renovation', rayures: 'renovation' };
    var b = q.get('besoin') || q.get('prestation'); b = b && (alias[b] || b);
    var bfOk = /[?&]bf=apercu\b/.test(location.search) || (Date.now() >= Date.parse('2026-11-24T00:00:00+01:00') && Date.now() < Date.parse('2026-11-29T00:00:00+01:00'));
    if (q.get('offre') === 'black-friday' && bfOk) { S.offre = 'bf'; S.besoin = 'renovation'; S.nombre = '4'; S.lieu = 'atelier'; $('[data-offre]').hidden = false; $('[data-nb]').hidden = true; }
    else if (q.get('pro') === '1' || q.get('lot') === '1') S.pro = true;
    else if (b && BESOINS[b]) S.besoin = b;
    var l = q.get('lieu'); if (!S.offre && (l === 'atelier' || l === 'domicile')) { S.lieu = l; S.lieuDemande = l; }
  })();

  function domicilePossible() { return !S.offre && ATELIER_SEUL.indexOf(S.besoin) < 0 && S.nombre !== '1' && S.nombre !== '2'; }
  function parcours() {
    if (S.offre) return ['vehicule', 'lieu', 'photos', 'contact'];
    if (S.pro) return ['activite', 'nombre', 'echeance', 'photos', 'societe', 'contact'];
    return ['besoin', 'vehicule', 'lieu', 'photos', 'contact'];
  }
  function val(c) { return c ? c.value.trim() : ''; }
  function repondu(q) {
    switch (q) {
      case 'besoin': return !!S.besoin;
      case 'vehicule': return val(champ.vehicule).length > 1 && !!S.nombre;
      case 'lieu': return !!S.lieu && RE_CP.test(val(champ.cp));
      case 'photos': return photos.length > 0 || S.plusTard;
      case 'societe': return RE_CP.test(val(champ.cpPro));
      case 'contact': return false;
      default: return !!S[q];
    }
  }

  /* ── Affichage d'une question ── */
  var barre = $('.dvh__barre span'), compteur = $('.dvh__n'), retourBtn = $('[data-retour]');
  function montrer(q, sens) {
    var p = parcours(), i = p.indexOf(q); if (i < 0) { q = p[0]; i = 0; }
    courant = q;
    $$('.dvq').forEach(function (f) { var on = f.getAttribute('data-q') === q; f.hidden = !on; if (on) f.classList.toggle('is-retour', sens < 0); });
    $$('.dvq[data-q="' + q + '"] .ch').forEach(function (b) {
      var k = b.closest('[data-nb]') ? 'nombre' : q, v = b.getAttribute('data-v');
      b.setAttribute('aria-pressed', S[k] && S[k] === v ? 'true' : 'false');
    });
    if (q === 'lieu') majLieu();
    if (q === 'photos') majPhotosUI();
    if (q === 'contact') recap();
    barre.style.width = Math.max(8, Math.round((i + 1) / p.length * 100)) + '%';
    compteur.textContent = 'Étape ' + (i + 1) + ' sur ' + p.length;
    retourBtn.hidden = i === 0;
    window.scrollTo(0, 0);
    var t = $('.dvq[data-q="' + q + '"] .dvq__t');
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
  function plusTard(fn) { setTimeout(fn, reduit ? 0 : 160); }
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

  function erreur(cle, champEl, ok) {
    var e = $('[data-err="' + cle + '"]'); if (e) e.hidden = ok;
    if (champEl) { if (ok) champEl.removeAttribute('aria-invalid'); else champEl.setAttribute('aria-invalid', 'true'); }
    return ok;
  }

  /* ── Choix : un clic = réponse enregistrée (+ question suivante quand l'écran est complet) ── */
  form.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.ch') : null; if (!b || envoi) return;
    if (b.getAttribute('aria-disabled') === 'true') return;
    var fs = b.closest('.dvq'), q = fs.getAttribute('data-q'), v = b.getAttribute('data-v');
    var groupe = b.closest('[data-nb]') ? b.closest('[data-nb]') : fs;
    var cle = b.closest('[data-nb]') ? 'nombre' : q;
    S[cle] = v;
    $$('.ch', groupe).forEach(function (x) { if (!x.closest('[data-nb]') === !b.closest('[data-nb]')) x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    if (q === 'vehicule') {   // nombre choisi : on passe si le modèle est déjà écrit
      erreur('nb', null, true);
      if (val(champ.vehicule).length > 1) plusTard(avancer); else champ.vehicule.focus();
      return;
    }
    if (q === 'lieu') {
      if (RE_CP.test(val(champ.cp))) plusTard(avancer); else champ.cp.focus();
      return;
    }
    plusTard(avancer);
  });

  /* ── Véhicule ── */
  function vehiculeOk() {
    var a = erreur('vehicule', champ.vehicule, val(champ.vehicule).length > 1);
    var b = erreur('nb', null, !!S.nombre);
    if (!a) champ.vehicule.focus();
    return a && b;
  }
  $('[data-suite="vehicule"]').addEventListener('click', function () { if (vehiculeOk()) avancer(); });

  /* ── Lieu + code postal ── */
  function majLieu() {
    var dom = $('.dvq[data-q="lieu"] .ch[data-v="domicile"]'), note = $('[data-dom-note]');
    var ok = domicilePossible();
    dom.setAttribute('aria-disabled', ok ? 'false' : 'true');
    note.textContent = ok ? 'Lyon et alentours, dès 3 jantes' : S.offre ? 'L’offre se fait à l’atelier' : ATELIER_SEUL.indexOf(S.besoin) >= 0 ? 'Cette réparation se fait à l’atelier' : 'À partir de 3 jantes';
    if (!ok && S.lieu !== 'atelier') S.lieu = 'atelier';
    $$('.dvq[data-q="lieu"] .ch').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === S.lieu ? 'true' : 'false'); });
  }
  champ.cp.addEventListener('input', function () {
    var v = champ.cp.value.replace(/\D/g, '').slice(0, 5); if (v !== champ.cp.value) champ.cp.value = v;
    if (RE_CP.test(v)) { erreur('cp', champ.cp, true); if (S.lieu && courant === 'lieu') plusTard(avancer); }
  });
  function lieuOk() { var ok = erreur('cp', champ.cp, RE_CP.test(val(champ.cp))); if (!S.lieu) { S.lieu = 'atelier'; majLieu(); } if (!ok) champ.cp.focus(); return ok; }
  $('[data-suite="lieu"]').addEventListener('click', function () { if (lieuOk()) avancer(); });

  /* ── Société (pros) ── */
  champ.cpPro.addEventListener('input', function () { var v = champ.cpPro.value.replace(/\D/g, '').slice(0, 5); if (v !== champ.cpPro.value) champ.cpPro.value = v; if (RE_CP.test(v)) erreur('cp-pro', champ.cpPro, true); });
  function societeOk() { var ok = erreur('cp-pro', champ.cpPro, RE_CP.test(val(champ.cpPro))); if (!ok) champ.cpPro.focus(); return ok; }
  $('[data-suite="societe"]').addEventListener('click', function () { if (societeOk()) avancer(); });

  /* ── Entrée = suite sur les écrans à saisir ── */
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.type === 'submit') return;
    if (courant === 'vehicule') { e.preventDefault(); if (vehiculeOk()) avancer(); }
    else if (courant === 'lieu') { e.preventDefault(); if (lieuOk()) avancer(); }
    else if (courant === 'societe') { e.preventDefault(); if (societeOk()) avancer(); }
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
        c.toBlob(function (b) { if (!b) return ko(new Error('encodage')); ok(file.type === 'image/jpeg' && file.size <= b.size && k === 1 ? file : b); }, 'image/jpeg', QUALITE);
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

  /* ── Récapitulatif ── */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function jantes(n) { return !n ? '—' : /^\d+$/.test(n) ? n + (n === '1' ? ' jante' : ' jantes') : n === 'Récurrent' ? 'Lots réguliers' : n; }
  function lignes() {
    var r = [];
    if (S.offre) r.push(['Offre', 'Black Friday : la 4e jante offerte']);
    if (S.pro) {
      r.push(['Activité', S.activite || '—'], ['Quantité', jantes(S.nombre)], ['Échéance', S.echeance || '—']);
      if (val(champ.societe)) r.push(['Société', val(champ.societe)]);
      r.push(['Code postal', val(champ.cpPro) || '—']);
    } else {
      if (!S.offre) r.push(['Problème', S.besoin ? BESOINS[S.besoin].t : '—']);
      r.push(['Véhicule', (val(champ.vehicule) || '—') + (S.nombre ? ', ' + jantes(S.nombre) : '')]);
      r.push(['Lieu', (S.lieu === 'domicile' ? 'À domicile' : 'À l’atelier') + (val(champ.cp) ? ', ' + val(champ.cp) : '')]);
    }
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
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (envoi || courant !== 'contact') return;
    var pr = $('#dv-prenom'), no = $('#dv-nom'), te = $('#dv-tel'), em = $('#dv-email');
    var ok1 = erreur('prenom', pr, val(pr).length > 0), ok2 = erreur('tel', te, chiffres(te.value).length >= 8), ok3 = erreur('email', em, RE_MAIL.test(val(em)));
    if (!(ok1 && ok2 && ok3)) { (!ok1 ? pr : !ok2 ? te : em).focus(); return; }
    var manque = parcours().filter(function (q) { return q !== 'contact' && !repondu(q); })[0];
    if (manque) { montrer(manque, -1); return; }

    var bfo = !!S.offre, pro = S.pro, desc = [], vehicule = val(champ.vehicule), mots = vehicule.split(/\s+/);
    var fd = new FormData();
    fd.append('_t', String(t0));
    fd.append('website', $('input[name="website"]').value);
    try { var a = window.reynovAttr ? window.reynovAttr() : {}; if (a && Object.keys(a).length) fd.append('attr', JSON.stringify(a)); } catch (x) { /* facultatif */ }
    if (bfo) desc.push('Offre Black Friday 2026 : 3 jantes rénovées, la 4e offerte (face avant, à l’atelier).');
    if (val($('#dv-message'))) desc.push(val($('#dv-message')));
    if (pro && val(champ.societe)) desc.push('Société : ' + val(champ.societe));
    if (pro && S.nombre === 'Récurrent') desc.push('Besoin : lots réguliers');
    if (!pro && S.lieuDemande === 'domicile' && S.lieu === 'atelier') desc.push('Demande à domicile, orientée vers l’atelier (moins de 3 jantes ou réparation d’atelier).');
    if (S.plusTard && !photos.length) desc.push('Photos : envoyées plus tard (WhatsApp ou e-mail).');
    fd.append('prestation', bfo ? 'Black Friday · rénovation face avant (4 jantes, la 4e offerte)' : pro ? 'Lot professionnel : ' + S.activite : BESOINS[S.besoin].p);
    fd.append('problemes', pro || bfo ? '' : BESOINS[S.besoin].pb);
    fd.append('nb_jantes', S.nombre);
    fd.append('marque', pro ? '' : mots[0] || '');
    fd.append('modele', pro ? '' : mots.slice(1).join(' '));
    fd.append('mode', pro ? '' : S.lieu === 'domicile' ? 'À domicile' : 'En atelier (REYNOV)');
    fd.append('delai', pro ? S.echeance : '');
    fd.append('adresse', pro ? val(champ.cpPro) : val(champ.cp));
    fd.append('description', desc.join('\n'));
    fd.append('prenom', val(pr)); fd.append('nom', val(no));
    fd.append('email', val(em)); fd.append('tel', val(te));
    photos.forEach(function (p, i) { var ext = /png/.test(p.blob.type) ? 'png' : /heic|heif/i.test(p.blob.type + p.nom) ? 'heic' : /webp/.test(p.blob.type) ? 'webp' : 'jpg'; fd.append('photos', p.blob, 'photo-' + (i + 1) + '.' + ext); });

    envoi = true; bouton.disabled = true; errEnvoi.hidden = true; libelle.textContent = 'Envoi en cours…'; statut.textContent = 'Envoi de votre demande…';
    var remettre = function () { envoi = false; bouton.disabled = false; libelle.textContent = 'Envoyer ma demande'; };
    var echec = function (m) { remettre(); errEnvoi.textContent = m; errEnvoi.hidden = false; statut.textContent = ''; };
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
      } else echec((j && j.error) || 'L’envoi n’a pas abouti. Vos réponses et vos photos sont conservées : réessayez, ou appelez le 06 61 45 35 27.');
    };
    xhr.onerror = xhr.ontimeout = function () { echec('Connexion impossible. Vos réponses et vos photos sont conservées : réessayez, ou appelez le 06 61 45 35 27.'); };
    xhr.send(fd);
  });

  /* ── Démarrage : première question sans réponse ── */
  var p0 = parcours(), debut = p0.filter(function (q) { return !repondu(q); })[0] || p0[0];
  try { history.replaceState({ dv: debut, n: 0 }, '', location.pathname + location.search); } catch (e) { /* facultatif */ }
  montrer(debut, 0);
  window.__devisT0 = t0;
  track('devis_start', { step_name: debut });
})();
