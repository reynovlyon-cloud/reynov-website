/* REYNOV — suivi des clics (GA4 / Google Ads via gtag). N'envoie rien sans consentement (Consent Mode). */
(function () {
  function send(name, params) {
    if (typeof window.gtag !== 'function') return;
    params = params || {}; params.page_path = location.pathname; params.transport_type = 'beacon';
    window.gtag('event', name, params);
  }
  // Origine publicitaire (gclid, UTM) : conservée le temps de la session, uniquement si le visiteur a accepté la mesure.
  var AK = 'reynov_attr', KEYS = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term'];
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
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var h = a.getAttribute('href') || '';
    if (h.indexOf('tel:') === 0) send('phone_click', { link_url: h });
    else if (h.indexOf('wa.me') > -1 || h.indexOf('whatsapp') > -1) send('whatsapp_click', { link_url: h });
    else if (h.indexOf('mailto:') === 0) send('email_click', { link_url: h });
    else if (/devis\.html(\?|#|$)/.test(h)) send('cta_devis_click', { link_text: (a.textContent || '').trim().slice(0, 40) });
  }, true);
})();
