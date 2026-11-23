/* REYNOV v4 — en-tête et menu, film d'ouverture, visionneuse avant/après, barre de contact, lien Black Friday.
   Aucun envoi de données ici : la mesure reste dans track.js (après consentement). */
(function () {
  'use strict';
  var d = document, root = d.documentElement, body = d.body;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── En-tête : verre plus dense après le haut de page ── */
  var hd = $('#hd');
  if (hd) {
    var onScroll = function () { hd.classList.toggle('is-bas', window.scrollY > 40); };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── Menu téléphone ── */
  var burger = $('.hd__burger'), menu = $('#menu');
  function fermerMenu(rendreFocus) {
    if (!menu || menu.hidden) return;
    menu.hidden = true; body.classList.remove('menu-ouvert'); root.classList.remove('menu-ouvert');
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Ouvrir le menu');
    if (rendreFocus) burger.focus();
  }
  if (burger && menu) {
    burger.addEventListener('click', function () {
      if (!menu.hidden) { fermerMenu(false); return; }
      menu.hidden = false; body.classList.add('menu-ouvert'); root.classList.add('menu-ouvert');
      burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Fermer le menu');
      var premier = $('a', menu); if (premier) premier.focus({ preventScroll: true });
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) fermerMenu(false); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermerMenu(true); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1024) fermerMenu(false); });
  }

  /* ── Sous-menu Prestations (ordinateur) : clic, clavier et survol ── */
  $$('.hd__lien[aria-controls]').forEach(function (b) {
    var p = d.getElementById(b.getAttribute('aria-controls')); if (!p) return;
    var li = b.parentNode, t = null;
    var ouvrir = function () { clearTimeout(t); p.hidden = false; b.setAttribute('aria-expanded', 'true'); };
    var fermer = function () { p.hidden = true; b.setAttribute('aria-expanded', 'false'); };
    b.addEventListener('click', function () { p.hidden ? ouvrir() : fermer(); });
    li.addEventListener('mouseenter', function () { if (matchMedia('(hover: hover)').matches) ouvrir(); });
    li.addEventListener('mouseleave', function () { t = setTimeout(fermer, 160); });
    li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget)) fermer(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !p.hidden) { fermer(); b.focus(); } });
  });

  /* ── Film : une version par appareil, lancé après l'affichage, pause possible, mouvement réduit respecté ── */
  var film = $('.film'), v = film && $('video', film), pause = film && $('.film__pause', film);
  if (v) {
    var c = navigator.connection || {};
    var economie = c.saveData || /(^|-)2g$/.test(c.effectiveType || '');
    var tel = matchMedia('(max-width: 767px) and (orientation: portrait)').matches;
    var sources = tel ? [['/assets/videos/hero-mobile.mp4', 'video/mp4']] : [['/assets/videos/hero.webm', 'video/webm'], ['/assets/videos/hero.mp4', 'video/mp4']];
    var charge = false;
    var charger = function () {
      if (charge) return; charge = true;
      sources.forEach(function (s) { var so = d.createElement('source'); so.src = s[0]; so.type = s[1]; v.appendChild(so); });
      v.load();
    };
    var lire = function () { charger(); var p = v.play(); if (p && p.catch) p.catch(function () { etat(true); }); };
    var etat = function (enPause) {
      if (!pause) return;
      pause.setAttribute('aria-pressed', enPause ? 'true' : 'false');
      pause.setAttribute('aria-label', enPause ? 'Lire la vidéo' : 'Mettre la vidéo en pause');
    };
    // voulu : la personne veut voir le film (faux si elle l'a arrêté, ou si le mouvement réduit / l'économie de données est demandé)
    var voulu = !(reduit || economie);
    v.addEventListener('playing', function () { v.classList.add('is-on'); etat(false); });
    v.addEventListener('pause', function () { etat(true); });
    if (pause) {
      pause.hidden = false;
      pause.addEventListener('click', function () { if (v.paused) { voulu = true; lire(); } else { voulu = false; v.pause(); } });
    }
    if (!voulu) etat(true);
    else {
      var go = function () { setTimeout(lire, 150); };
      if (d.readyState === 'complete') go(); else window.addEventListener('load', go);
    }
    // hors écran : pause automatique (batterie), reprise au retour si la personne ne l'a pas arrêtée
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!charge) return; if (!e.isIntersecting) v.pause(); else if (voulu) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } });
    }, { threshold: 0.05 }).observe(film);
  }

  /* ── Black Friday : réservations du 24 au 28 novembre 2026 inclus, heure de Paris (UTC+1 en novembre).
        Aperçu : ?bf=apercu (lien d'accueil visible), ?bf=avant | ouvert | fin (états de la page d'offre). ── */
  var BF_DEBUT = Date.parse('2026-11-24T00:00:00+01:00'), BF_FIN = Date.parse('2026-11-29T00:00:00+01:00');
  var bfForce = (location.search.match(/[?&]bf=(apercu|avant|ouvert|fin)\b/) || [])[1];
  var bfEtat = bfForce === 'apercu' ? 'ouvert' : bfForce || (Date.now() < BF_DEBUT ? 'avant' : Date.now() < BF_FIN ? 'ouvert' : 'fin');
  var bf = $('[data-bf]');
  if (bf && bfEtat === 'ouvert') bf.hidden = false;
  if ($('[data-bf-page]')) {
    $$('[data-bf-ouvert]').forEach(function (n) { n.hidden = bfEtat !== 'ouvert'; });
    $$('[data-bf-ferme]').forEach(function (n) { n.hidden = bfEtat !== 'fin'; });
    $$('[data-bf-bientot]').forEach(function (n) { n.hidden = bfEtat !== 'avant'; });
    if (bfEtat !== 'ouvert') $$('.dock [data-cta]').forEach(function (a) { a.setAttribute('href', '/devis.html'); a.firstChild.textContent = 'Devis gratuit'; });
  }
  // aperçu forcé : le devis lié garde le contexte de l'offre même avant le 24 novembre
  if (bfForce === 'apercu' || bfForce === 'ouvert') $$('a[href*="offre=black-friday"], a[href="/black-friday.html"]').forEach(function (a) { a.setAttribute('href', a.getAttribute('href') + (a.getAttribute('href').indexOf('?') < 0 ? '?' : '&') + 'bf=apercu'); });

  /* ── Barre de contact (téléphone) et bouton de l'en-tête (ordinateur) : visibles quand l'action principale quitte l'écran ── */
  var principal = $('[data-cta-principal]'), fin = $('#fin');
  if ('IntersectionObserver' in window) {
    if (principal) new IntersectionObserver(function (es) { root.classList.toggle('cta-hors', !es[0].isIntersecting && es[0].boundingClientRect.top < 0); }).observe(principal);
    else root.classList.add('cta-hors');
    if (fin) new IntersectionObserver(function (es) { root.classList.toggle('fin-vue', es[0].isIntersecting); }, { threshold: 0.15 }).observe(fin);
  } else root.classList.add('cta-hors');
  // clavier ouvert (champ actif) : la barre s'efface pour ne rien recouvrir
  d.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches('input, textarea, select')) root.classList.add('clavier'); });
  d.addEventListener('focusout', function () { root.classList.remove('clavier'); });

  /* ── Visionneuse : Avant / Après / Terminée par boutons, sans geste précis ── */
  var I = '/assets/images/';
  var CAS = {
    mercedes: { t: 'Mercedes · jante alliage', v: [['avant', 'Avant', 'mercedes-jante-avant-900.webp', 'Avant : bord extérieur arraché par un trottoir'], ['apres', 'Après', 'mercedes-jante-apres-900.webp', 'Après : bord repris, noir brillant et liseré poli'], ['fini', 'Terminée', 'mercedes-jante-finale-900.webp', 'La jante terminée, vue entière']] },
    audi: { t: 'Audi Q6', v: [['avant', 'Avant', 'audi-q6-avant-900.webp', 'Avant : frottement de trottoir et rayures profondes'], ['apres', 'Après', 'audi-q6-apres-900.webp', 'Après : finition noire d’origine']] },
    golf: { t: 'Golf 7 GTI', v: [['avant', 'Avant', 'gti-avant-600.webp', 'Avant : perte de matière sur la lèvre'], ['apres', 'Après', 'gti-apres-600.webp', 'Après : jante remise en état']] },
    macan: { t: 'Porsche Macan', v: [['avant', 'Avant', 'macan-avant-900.webp', 'Avant : finition argent marquée par l’usage'], ['apres', 'Après', 'macan-apres-900.webp', 'Après : finition argent retrouvée']] },
    diamantee: { t: 'Jante diamantée bi-ton', v: [['apres', 'Après', 'jante-apres-monts-dor-900.webp', 'Jante diamantée bi-ton aux faces polies, après rénovation']] }
  };
  var vis = $('#vis');
  if (vis) {
    var vImg = $('.vis__img img', vis), vT = $('#vis-titre'), vB = $('.bascule', vis), vX = $('.vis__x', vis), retour = null;
    var montrer = function (cas, cle) {
      var e = cas.v.filter(function (x) { return x[0] === cle; })[0] || cas.v[0];
      vImg.src = I + e[2]; vImg.alt = e[3];
      $$('button', vB).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-k') === e[0] ? 'true' : 'false'); });
    };
    var ouvrirVis = function (id, cle, depuis) {
      var cas = CAS[id]; if (!cas) return;
      retour = depuis; vT.textContent = cas.t; vB.innerHTML = '';
      vB.parentNode.hidden = cas.v.length < 2;
      cas.v.forEach(function (x) {
        var b = d.createElement('button'); b.type = 'button'; b.textContent = x[1]; b.setAttribute('data-k', x[0]); b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () { montrer(cas, x[0]); }); vB.appendChild(b);
      });
      montrer(cas, cle || cas.v[0][0]);
      vis.hidden = false; root.classList.add('fige');
      vX.focus();
    };
    var fermerVis = function () { if (vis.hidden) return; vis.hidden = true; root.classList.remove('fige'); if (retour) retour.focus(); };
    $$('[data-vis]').forEach(function (b) { b.addEventListener('click', function () { ouvrirVis(b.getAttribute('data-vis'), b.getAttribute('data-etat'), b); }); });
    vX.addEventListener('click', fermerVis);
    vis.addEventListener('click', function (e) { if (e.target === vis || e.target.classList.contains('vis__img')) fermerVis(); });
    d.addEventListener('keydown', function (e) {
      if (vis.hidden) return;
      if (e.key === 'Escape') fermerVis();
      if (e.key === 'Tab') { var f = $$('button', vis).filter(function (x) { return x.offsetParent; }); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
  }
})();
