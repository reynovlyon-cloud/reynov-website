/* REYNOV — mesure (GA4 / Google Ads via gtag), Pixel Meta et origine des demandes (v4).
   Rien n'est chargé ni conservé sans consentement : le Pixel Meta n'est chargé qu'après « Accepter »,
   l'origine n'est enregistrée dans le navigateur qu'après « Accepter ». Sans consentement, l'origine reste « inconnue ».

   Origine d'une demande (lue dans le CRM) :
   • première visite : la toute première arrivée connue sur le site (conservée 90 jours ; une visite directe ne l'efface pas) ;
   • visite qui a abouti : l'arrivée de la session pendant laquelle la demande est envoyée ;
   • moyen de contact : formulaire devis, rendez-vous, contact, professionnels (enregistré par le serveur), appel ou WhatsApp.
   Canaux : Google Ads, fiche Google, recherche naturelle, Facebook payant, Instagram payant, réseaux sociaux (organique),
   site référent, accès direct ou inconnu. Un fbclid seul ne suffit pas à classer une visite en publicité payante.
   Aucune donnée personnelle (nom, e-mail, téléphone) n'est placée dans une adresse ni envoyée à Analytics. */
(function () {
  'use strict';
  function send(name, params) {
    if (typeof window.gtag !== 'function') return;
    params = params || {}; params.page_path = location.pathname; params.transport_type = 'beacon';
    window.gtag('event', name, params);
  }
  // Pixels Meta (IDs 1385475270132092 et 1129575169478650) : chargés uniquement si le visiteur a accepté la mesure et la publicité.
  var PIXEL_IDS = ['1385475270132092', '1129575169478650'];
  function loadPixel() {
    if (window.fbq || !consented()) return;
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    PIXEL_IDS.forEach(function (id) {
      window.fbq('set', 'autoConfig', false, id);   // pas de détection automatique de boutons ni de champs de formulaire
      window.fbq('init', id);
    });
    window.fbq('track', 'PageView');
  }
  window.reynovPixel = loadPixel;
  window.reynovRevokePixel = function () { if (typeof window.fbq === 'function') window.fbq('consent', 'revoke'); };
  window.reynovFbq = function (name, params) { if (typeof window.fbq === 'function') window.fbq('track', name, params || {}); };

  /* ── Origine ── */
  var VISIT = 'reynov_attr', FIRST = 'reynov_first', FIRST_TTL = 90 * 864e5;
  var IDS = ['gclid', 'gbraid', 'wbraid', 'fbclid'], UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  function consented() { try { var c = JSON.parse(localStorage.getItem('reynov_consent') || 'null'); return !!(c && c.v === 'granted' && Date.now() - c.t < 15552000000); } catch (e) { return false; } }
  var clip = function (v) { return String(v || '').slice(0, 120); };

  function classify(q, ref) {
    var src = (q.utm_source || '').toLowerCase(), med = (q.utm_medium || '').toLowerCase(), camp = (q.utm_campaign || '').toLowerCase();
    var host = ''; try { host = ref ? new URL(ref).hostname.replace(/^www\./, '') : ''; } catch (e) { host = ''; }
    if (host === location.hostname.replace(/^www\./, '')) host = '';             // navigation interne : pas une origine
    var paid = /^(cpc|ppc|paid|paid_social|paidsocial|paid-social|display|cpm|ads?)$/.test(med);
    if (q.gclid || q.gbraid || q.wbraid) return ['Google Ads', camp || 'clic sur une annonce Google'];
    if (src === 'google' && /business|gbp|maps|fiche/.test(camp + ' ' + med)) return ['Fiche Google', q.utm_content || 'fiche'];
    if (src === 'google' && paid) return ['Google Ads', camp || 'annonce'];
    if (/^(instagram|ig)$/.test(src)) return paid ? ['Instagram payant', camp || 'annonce'] : ['Réseaux sociaux (organique)', 'Instagram'];
    if (/^(facebook|fb|meta)$/.test(src)) return paid ? ['Facebook payant', camp || 'annonce'] : ['Réseaux sociaux (organique)', 'Facebook'];
    if (src) return [paid ? 'Publicité (autre)' : 'Campagne (autre)', [src, med, camp].filter(Boolean).join(' / ')];
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return ['Recherche naturelle', 'Google'];
    if (/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.[a-z.]+|qwant\.com|ecosia\.org|startpage\.com|search\.brave\.com)$/.test(host)) return ['Recherche naturelle', host];
    if (/(^|\.)(facebook\.com|fb\.com|instagram\.com|l\.instagram\.com|tiktok\.com|linkedin\.com|lnkd\.in|youtube\.com|pinterest\.[a-z.]+|t\.co|x\.com|twitter\.com|snapchat\.com)$/.test(host))
      return ['Réseaux sociaux (organique)', host + (q.fbclid ? ' (fbclid sans paramètre de campagne)' : '')];
    if (host) return ['Site référent', host];
    if (q.fbclid) return ['Réseaux sociaux (organique)', 'fbclid sans paramètre de campagne ni site d’origine'];
    return ['Accès direct ou inconnu', ''];
  }
  function touch() {
    var p = new URLSearchParams(location.search), q = {};
    IDS.concat(UTM).forEach(function (k) { var v = p.get(k); if (v) q[k] = clip(v); });
    var c = classify(q, document.referrer), landing = location.pathname;
    // origine transmise par le lien cliqué sur la page précédente (visiteur sans cookies, voir plus bas) : canal|précision|page d'arrivée
    var o = (p.get('origine') || '').split('|');
    if (c[0] === 'Accès direct ou inconnu' && o[0]) { c = [o[0], o[1] || '']; landing = o[2] || landing; }
    return { canal: c[0], detail: clip(c[1]), landing: clip(landing), date: new Date().toISOString().slice(0, 10), q: q };
  }
  function capture() {
    if (!consented()) return;
    try {
      var t = touch();
      if (!sessionStorage.getItem(VISIT)) sessionStorage.setItem(VISIT, JSON.stringify(t));              // arrivée de la session
      var f = null; try { f = JSON.parse(localStorage.getItem(FIRST) || 'null'); } catch (e) { f = null; }
      if (!f || !f.t || Date.now() - f.t > FIRST_TTL) localStorage.setItem(FIRST, JSON.stringify({ v: t, t: Date.now() })); // première visite connue
    } catch (e) { /* stockage indisponible */ }
  }
  window.reynovCaptureAttr = capture;
  window.reynovForgetAttr = function () { try { sessionStorage.removeItem(VISIT); localStorage.removeItem(FIRST); } catch (e) { /* rien */ } };
  // Données transmises avec une demande : identifiants publicitaires et paramètres de campagne de la visite qui aboutit,
  // plus le canal de la première visite et de la visite qui aboutit. Objet vide sans consentement (origine « inconnue »).
  window.reynovAttr = function () {
    // Sans cookies : rien n'est conservé sur l'appareil. On transmet seulement le canal de la visite en cours, lu dans l'adresse
    // de la page (paramètres de campagne) et le site d'origine — sans identifiant publicitaire (gclid, fbclid…), donc rien
    // n'est renvoyé à Google ni à Meta pour ces demandes.
    if (!consented()) {
      try {
        var t = touch(), o0 = {};
        if (t.canal === 'Accès direct ou inconnu') return {};
        UTM.forEach(function (k) { if (t.q[k]) o0[k] = t.q[k]; });
        o0.visit_canal = t.canal; o0.visit_detail = t.detail; o0.visit_landing = t.landing; o0.visit_date = t.date;
        return o0;
      } catch (e) { return {}; }
    }
    try {
      var v = JSON.parse(sessionStorage.getItem(VISIT) || 'null'), fw = JSON.parse(localStorage.getItem(FIRST) || 'null'), f = fw && fw.v;
      var o = {};
      if (v && v.q) Object.keys(v.q).forEach(function (k) { o[k] = v.q[k]; });
      if (f) { o.first_canal = f.canal; o.first_detail = f.detail; o.first_landing = f.landing; o.first_date = f.date; }
      if (v) { o.visit_canal = v.canal; o.visit_detail = v.detail; o.visit_landing = v.landing; o.visit_date = v.date; }
      return o;
    } catch (e) { return {}; }
  };
  capture();
  loadPixel();

  // Appel, WhatsApp, e-mail : mesurés comme « contact » (pas comme demande reçue).
  // Sur WhatsApp, le message prérempli indique l'origine connue (aucune donnée personnelle) pour la noter dans le CRM.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var h = a.getAttribute('href') || '';
    if (h.indexOf('tel:') === 0) { send('phone_click', { link_url: h }); window.reynovFbq('Contact', { content_name: 'telephone' }); }
    else if (h.indexOf('wa.me') > -1 || h.indexOf('whatsapp') > -1) {
      send('whatsapp_click', { link_url: h.split('?')[0] }); window.reynovFbq('Contact', { content_name: 'whatsapp' });
      try {
        var at = window.reynovAttr(), canal = at.first_canal && at.first_canal !== 'Accès direct ou inconnu' ? at.first_canal : (at.visit_canal || '');
        if (canal && canal !== 'Accès direct ou inconnu' && /^https:\/\/wa\.me\//.test(h)) {
          var u = new URL(h), txt = u.searchParams.get('text') || 'Bonjour, je souhaite un devis pour mes jantes.';
          // encodage %20 (et non « + ») : WhatsApp affiche le message tel quel
          if (txt.indexOf('(origine :') === -1) a.setAttribute('href', u.origin + u.pathname + '?text=' + encodeURIComponent(txt + ' (origine : ' + canal + ')'));
        }
      } catch (x) { /* lien laissé tel quel */ }
    }
    else if (h.indexOf('mailto:') === 0) { send('email_click', { link_url: 'mailto' }); window.reynovFbq('Contact', { content_name: 'email' }); }
    else if (/devis\.html(\?|#|$)/.test(h)) send('cta_devis_click', { link_text: (a.textContent || '').trim().slice(0, 40) });
    // Visiteur sans cookies : l'origine de sa visite suit le lien qu'il clique vers une autre page du site
    // (paramètre « origine », sans identifiant publicitaire, rien n'est stocké sur l'appareil).
    if (!consented() && h && h.charAt(0) !== '#' && !/^(tel:|mailto:|sms:|javascript:)/i.test(h)) {
      try {
        var u2 = new URL(a.href, location.href);
        if (u2.origin === location.origin && !u2.searchParams.has('origine') && !/\.(pdf|jpe?g|png|webp|mp4)$/i.test(u2.pathname)) {
          var t2 = touch();
          if (t2.canal !== 'Accès direct ou inconnu') {
            u2.searchParams.set('origine', [t2.canal, t2.detail, t2.landing].map(function (x) { return String(x || '').replace(/\|/g, ' ').slice(0, 60); }).join('|'));
            a.setAttribute('href', u2.pathname + u2.search + u2.hash);
          }
        }
      } catch (x) { /* lien laissé tel quel */ }
    }
  }, true);
})();
