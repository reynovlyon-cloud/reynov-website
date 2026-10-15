/* REYNOV — suivi des clics (GA4 / Google Ads via gtag). N'envoie rien sans consentement (Consent Mode). */
(function () {
  function send(name, params) {
    if (typeof window.gtag !== 'function') return;
    params = params || {}; params.page_path = location.pathname; params.transport_type = 'beacon';
    window.gtag('event', name, params);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var h = a.getAttribute('href') || '';
    if (h.indexOf('tel:') === 0) send('phone_click', { link_url: h });
    else if (h.indexOf('wa.me') > -1 || h.indexOf('whatsapp') > -1) send('whatsapp_click', { link_url: h });
    else if (h.indexOf('mailto:') === 0) send('email_click', { link_url: h });
    else if (/devis\.html(\?|#|$)/.test(h)) send('cta_devis_click', { link_text: (a.textContent || '').trim().slice(0, 40) });
  }, true);
})();
