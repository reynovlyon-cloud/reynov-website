/* REYNOV — consentement cookies (CNIL / Google Consent Mode v2)
   Par défaut tout est refusé (voir le snippet dans <head>). Choix conservé 6 mois. */
(function () {
  var KEY = 'reynov_consent', TTL = 15552000000;
  function read() { try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && c.t && Date.now() - c.t < TTL) return c; } catch (e) {} return null; }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {} }
  function update(v) { if (typeof window.gtag === 'function') window.gtag('consent', 'update', { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v }); }
  function purge() {
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (/^(_ga|_gid|_gcl|_gac|_fbp)/.test(n)) {
        var host = location.hostname.replace(/^www\./, '');
        ['', '; domain=' + location.hostname, '; domain=.' + host].forEach(function (d) { document.cookie = n + '=; Max-Age=0; path=/' + d; });
      }
    });
  }

  // Bandeau aux couleurs du site : verre sombre, police Inter, deux boutons de même poids (refuser aussi simple qu'accepter).
  var css = '.rc-banner{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));z-index:100000;width:min(420px,calc(100vw - 24px));' +
    'background:rgba(14,16,19,.94);-webkit-backdrop-filter:blur(22px) saturate(1.5);backdrop-filter:blur(22px) saturate(1.5);border:1px solid rgba(255,255,255,.22);border-radius:22px;' +
    'padding:18px 18px 16px;color:#F5F6F7;font:400 15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.18);' +
    'opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .25s ease,transform .25s ease}' +
    '.rc-banner.is-open{opacity:1;transform:none;pointer-events:auto}' +
    '.rc-title{font-size:17px;font-weight:650;letter-spacing:-.01em;line-height:1.3;margin:0 0 6px}' +
    '.rc-text{margin:0 0 14px;color:#B4BAC2}.rc-text a{color:#fff;text-decoration:underline;text-underline-offset:3px}' +
    '.rc-actions{display:flex;flex-wrap:wrap;gap:8px}' +
    '.rc-btn{flex:1 1 110px;min-height:46px;padding:0 16px;font:600 15px/1 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:0;text-transform:none;' +
    'border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;border-radius:999px;cursor:pointer;transition:background-color .15s,border-color .15s}' +
    '.rc-btn:hover{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.45)}.rc-btn:focus-visible{outline:3px solid #F6F3EC;outline-offset:3px}' +
    '.rc-manage{background:none;border:0;padding:0;margin-left:1.25rem;min-height:44px;font:inherit;color:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:3px}' +
    '@media (prefers-reduced-transparency: reduce){.rc-banner{background:#17191D;-webkit-backdrop-filter:none;backdrop-filter:none}}';

  function init() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var b = document.createElement('div');
    b.className = 'rc-banner'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Gestion des cookies');
    b.innerHTML = '<p class="rc-title">Cookies et mesure</p>' +
      '<p class="rc-text">Nous utilisons des cookies de mesure d’audience et de publicité (Google et Meta) pour améliorer le site et mesurer nos annonces. Vous choisissez, et pouvez changer d’avis à tout moment. <a href="/politique-de-confidentialite.html">En savoir plus</a></p>' +
      '<div class="rc-actions"><button type="button" class="rc-btn" data-rc="denied">Refuser</button><button type="button" class="rc-btn" data-rc="granted">Accepter</button></div>';
    document.body.appendChild(b);
    function open() { requestAnimationFrame(function () { b.classList.add('is-open'); }); }
    function close() { b.classList.remove('is-open'); }
    b.addEventListener('click', function (e) {
      var v = e.target && e.target.getAttribute && e.target.getAttribute('data-rc'); if (!v) return;
      write(v); update(v); if (v === 'denied') { purge(); if (window.reynovRevokePixel) window.reynovRevokePixel(); if (window.reynovForgetAttr) window.reynovForgetAttr(); } else { if (window.reynovCaptureAttr) window.reynovCaptureAttr(); if (window.reynovPixel) window.reynovPixel(); } close();
    });
    var fb = document.querySelector('.footer__bottom');
    if (fb) { var m = document.createElement('button'); m.type = 'button'; m.className = 'rc-manage'; m.textContent = 'Gérer les cookies'; m.addEventListener('click', open); fb.appendChild(m); }
    // pages sans pied de page (devis, confirmation) : tout élément [data-rc-manage] ouvre aussi le choix
    Array.prototype.forEach.call(document.querySelectorAll('[data-rc-manage]'), function (el) { el.addEventListener('click', open); });
    if (!read()) setTimeout(open, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
