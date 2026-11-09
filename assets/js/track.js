/* REYNOV — suivi des clics (GA4 / Google Ads via gtag) et Pixel Meta. N'envoie rien sans consentement : le Pixel Meta n'est même pas chargé tant que le visiteur n'a pas accepté. */
(function () {
  function send(name, params) {
    if (typeof window.gtag !== 'function') return;
    params = params || {}; params.page_path = location.pathname; params.transport_type = 'beacon';
    window.gtag('event', name, params);
  }
  // Pixel Meta (ID 1385475270132092) : chargé uniquement si le visiteur a accepté la mesure et la publicité.
  var PIXEL_ID = '1385475270132092';
  function loadPixel() {
    if (window.fbq || !consented()) return;
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('set', 'autoConfig', false, PIXEL_ID);   // pas de détection automatique de boutons ni de champs de formulaire
    window.fbq('init', PIXEL_ID); window.fbq('track', 'PageView');
  }
  window.reynovPixel = loadPixel;
  window.reynovRevokePixel = function () { if (typeof window.fbq === 'function') window.fbq('consent', 'revoke'); };
  // Événement Meta (Lead, Contact…) : sans effet si le Pixel n'est pas chargé (pas de consentement).
  window.reynovFbq = function (name, params) { if (typeof window.fbq === 'function') window.fbq('track', name, params || {}); };
  // Origine publicitaire (gclid, UTM) : conservée le temps de la session, uniquement si le visiteur a accepté la mesure.
  var AK = 'reynov_attr', KEYS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  function consented() { try { var c = JSON.parse(localStorage.getItem('reynov_consent') || 'null'); return !!(c && c.v === 'granted' && Date.now() - c.t < 15552000000); } catch (e) { return false; } }
  function capture() {
    if (!consented()) return;
    try {
      if (sessionStorage.getItem(AK)) return;                                   // première visite de la session : on la garde
      var q = new URLSearchParams(location.search), o = {};
      KEYS.forEach(function (k) { var v = q.get(k); if (v) o[k] = v.slice(0, 120); });
      if (Object.keys(o).length) sessionStorage.setItem(AK, JSON.stringify(o));
    } catch (e) { /* stockage indisponible */ }
  }
  window.reynovCaptureAttr = capture;
  window.reynovAttr = function () { try { return consented() ? JSON.parse(sessionStorage.getItem(AK) || '{}') : {}; } catch (e) { return {}; } };
  capture();
  loadPixel();
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var h = a.getAttribute('href') || '';
    if (h.indexOf('tel:') === 0) { send('phone_click', { link_url: h }); window.reynovFbq('Contact', { content_name: 'telephone' }); }
    else if (h.indexOf('wa.me') > -1 || h.indexOf('whatsapp') > -1) { send('whatsapp_click', { link_url: h }); window.reynovFbq('Contact', { content_name: 'whatsapp' }); }
    else if (h.indexOf('mailto:') === 0) { send('email_click', { link_url: h }); window.reynovFbq('Contact', { content_name: 'email' }); }
    else if (/devis\.html(\?|#|$)/.test(h)) send('cta_devis_click', { link_text: (a.textContent || '').trim().slice(0, 40) });
  }, true);
})();
