/* REYNOV v4 — en-tête (capsule qui se resserre au défilement), menu, film d'ouverture, avant/après au curseur,
   avis animés, lien Black Friday. Aucun envoi de données ici : la mesure reste dans track.js (après consentement). */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── En-tête : verre plus dense et capsule resserrée (logo, menu, devis) dès qu'on défile ── */
  var hd = $('#hd');
  if (hd) {
    var cta = $('.hd__cta', hd), halo = false;
    var onScroll = function () {
      var y = window.scrollY; hd.classList.toggle('is-bas', y > 40); hd.classList.toggle('is-compact', y > 120);
      // une seule fois : un halo bleu léger derrière « Devis gratuit » quand la capsule se resserre
      if (!halo && y > 120 && cta && !reduit) { halo = true; cta.classList.add('is-halo'); cta.addEventListener('animationend', function () { cta.classList.remove('is-halo'); }, { once: true }); }
    };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── Menu (bouton « + ») : plein écran sur téléphone, panneau sous la capsule sur ordinateur ── */
  var plus = $('.hd__plus'), menu = $('#menu');
  function fermerMenu(rendreFocus) {
    if (!menu || menu.hidden) return;
    menu.hidden = true; root.classList.remove('menu-ouvert');
    plus.setAttribute('aria-expanded', 'false'); plus.setAttribute('aria-label', 'Ouvrir le menu');
    if (rendreFocus) plus.focus();
  }
  if (plus && menu) {
    plus.addEventListener('click', function () {
      if (!menu.hidden) { fermerMenu(false); return; }
      menu.hidden = false; root.classList.add('menu-ouvert');
      plus.setAttribute('aria-expanded', 'true'); plus.setAttribute('aria-label', 'Fermer le menu');
      var premier = $('a', menu); if (premier) premier.focus({ preventScroll: true });
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) fermerMenu(false); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermerMenu(true); });
    d.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target) && !plus.contains(e.target) && window.innerWidth >= 1024) fermerMenu(false); });
    window.addEventListener('scroll', function () { if (!menu.hidden && window.innerWidth >= 1024 && window.scrollY < 120) fermerMenu(false); }, { passive: true });
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
    var charge = false, voulu = !(reduit || economie);
    var charger = function () { if (charge) return; charge = true; sources.forEach(function (s) { var so = d.createElement('source'); so.src = s[0]; so.type = s[1]; v.appendChild(so); }); v.load(); };
    var etat = function (enPause) { if (!pause) return; pause.setAttribute('aria-pressed', enPause ? 'true' : 'false'); pause.setAttribute('aria-label', enPause ? 'Lire la vidéo' : 'Mettre la vidéo en pause'); };
    var lire = function () { charger(); var p = v.play(); if (p && p.catch) p.catch(function () { etat(true); }); };
    v.addEventListener('playing', function () { v.classList.add('is-on'); etat(false); });
    v.addEventListener('pause', function () { etat(true); });
    if (pause) { pause.hidden = false; pause.addEventListener('click', function () { if (v.paused) { voulu = true; lire(); } else { voulu = false; v.pause(); } }); }
    if (!voulu) etat(true);
    else { var go = function () { setTimeout(lire, 150); }; if (d.readyState === 'complete') go(); else window.addEventListener('load', go); }
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
  }
  // aperçu forcé : le devis lié garde le contexte de l'offre même avant le 24 novembre
  if (bfForce === 'apercu' || bfForce === 'ouvert') $$('a[href*="offre=black-friday"], a[href="/black-friday.html"]').forEach(function (a) { a.setAttribute('href', a.getAttribute('href') + (a.getAttribute('href').indexOf('?') < 0 ? '?' : '&') + 'bf=apercu'); });

  /* ── Avant / après au curseur : glisser n'importe où sur la photo, ou toucher pour placer le trait ; clavier via le curseur caché ── */
  $$('.cmp').forEach(function (cmp) {
    var r = $('.cmp__range', cmp), x0 = 0, y0 = 0, actif = false, bouge = false;
    var poser = function (p) { p = Math.max(0, Math.min(100, p)); cmp.style.setProperty('--pos', p + '%'); if (r) r.value = Math.round(p); };
    var depuisX = function (x) { var b = cmp.getBoundingClientRect(); poser((x - b.left) / b.width * 100); };
    cmp.addEventListener('pointerdown', function (e) { actif = true; bouge = false; x0 = e.clientX; y0 = e.clientY; try { cmp.setPointerCapture(e.pointerId); } catch (x) { /* facultatif */ } if (e.pointerType === 'mouse') { bouge = true; depuisX(e.clientX); } });
    cmp.addEventListener('pointermove', function (e) { if (!actif) return; if (!bouge && Math.abs(e.clientX - x0) > 4 && Math.abs(e.clientX - x0) > Math.abs(e.clientY - y0)) bouge = true; if (bouge) depuisX(e.clientX); });
    cmp.addEventListener('pointerup', function (e) { if (actif && !bouge) depuisX(e.clientX); actif = false; });
    cmp.addEventListener('pointercancel', function () { actif = false; });
    if (r) r.addEventListener('input', function () { poser(+r.value); });
  });
  var ba = $('[data-ba]');
  if (ba) {
    var slides = $$('.ba__slide', ba), i = 0, n = $('[data-ba-n]', ba), tt = $('[data-ba-titre]', ba), ss = $('[data-ba-sous]', ba);
    var tot = $('[data-ba-total]', ba); if (tot) tot.textContent = String(slides.length).padStart(2, '0');
    var aller = function (k) {
      slides[i].classList.remove('is-on');
      i = (k + slides.length) % slides.length;
      var s = slides[i]; s.classList.add('is-on');
      var c = $('.cmp', s); if (c) { c.style.setProperty('--pos', '50%'); var rr = $('.cmp__range', c); if (rr) rr.value = 50; }
      n.textContent = String(i + 1).padStart(2, '0'); tt.textContent = s.getAttribute('data-titre'); ss.textContent = s.getAttribute('data-sous');
      $$('img', s).forEach(function (im) { im.loading = 'eager'; });
    };
    $('[data-ba-prec]', ba).addEventListener('click', function () { aller(i - 1); });
    $('[data-ba-suiv]', ba).addEventListener('click', function () { aller(i + 1); });
    // la réalisation suivante se charge pendant qu'on regarde la première
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { $$('img', slides[1] || ba).forEach(function (im) { im.loading = 'eager'; }); o.disconnect(); } }).observe(ba);
  }

  /* ── Avant/après : à la première apparition, le curseur glisse une fois tout seul (50 → 28 → 72 → 50 %)
        pour montrer qu'on peut le tirer. S'arrête dès que le visiteur touche l'image. Mouvement réduit respecté. ── */
  var demo = $('[data-ba] .ba__slide.is-on .cmp') || $('.cmp');
  if (demo && !reduit && 'IntersectionObserver' in window && window.requestAnimationFrame) {
    var touche = false, rDemo = $('.cmp__range', demo);
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { demo.addEventListener(ev, function () { touche = true; }, { passive: true }); });
    var POINTS = [[0, 50], [600, 28], [1350, 72], [1950, 50]];
    var adoucir = function (x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
    new IntersectionObserver(function (es, o) {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      setTimeout(function () {
        var t0 = null;
        var pas = function (ts) {
          if (touche) return;
          if (t0 === null) t0 = ts;
          var t = ts - t0, k = 1;
          while (k < POINTS.length - 1 && t > POINTS[k][0]) k++;
          var a = POINTS[k - 1], b = POINTS[k], u = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])));
          var p = a[1] + (b[1] - a[1]) * adoucir(u);
          demo.style.setProperty('--pos', p + '%'); if (rDemo) rDemo.value = Math.round(p);
          if (t < POINTS[POINTS.length - 1][0]) requestAnimationFrame(pas);
        };
        if (!touche) requestAnimationFrame(pas);
      }, 400);
    }, { threshold: 0.6 }).observe(demo);
  }

  /* ── Avis : la note monte jusqu'à 5,0, les étoiles s'allument une à une, les cartes arrivent (une seule fois) ── */
  var avis = $('[data-avis]');
  if (avis && 'IntersectionObserver' in window && !reduit) {
    avis.classList.add('anim');
    var nEl = $('[data-compte]', avis), cible = nEl ? parseFloat(nEl.getAttribute('data-compte')) : 0;
    if (nEl) nEl.textContent = '0,0';
    new IntersectionObserver(function (es, o) {
      if (!es[0].isIntersecting) return;
      o.disconnect(); avis.classList.add('is-vu');
      if (!nEl) return;
      var t0 = null, duree = 1100;
      var pas = function (t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / duree), e = 1 - Math.pow(1 - k, 3); nEl.textContent = (cible * e).toFixed(1).replace('.', ','); if (k < 1) requestAnimationFrame(pas); };
      requestAnimationFrame(pas);
    }, { threshold: 0.25 }).observe(avis);
  }
})();
