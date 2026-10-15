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

  var css = '.rc-banner{position:fixed;left:clamp(12px,2vw,28px);bottom:clamp(12px,2vw,28px);z-index:100000;width:min(440px,calc(100vw - 24px));background:#0d0d0d;border:1px solid rgba(248,248,246,.16);border-radius:8px;padding:1.3rem 1.4rem 1.2rem;color:#f8f8f6;font:400 13px/1.65 Inter,"Helvetica Neue",Arial,sans-serif;box-shadow:0 24px 70px rgba(0,0,0,.65);opacity:0;transform:translateY(14px);pointer-events:none;transition:opacity .5s cubic-bezier(.22,.61,.36,1),transform .5s cubic-bezier(.22,.61,.36,1)}' +
    '.rc-banner.is-open{opacity:1;transform:none;pointer-events:auto}' +
    '.rc-title{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.4rem;font-weight:400;line-height:1.2;margin:0 0 .45rem}' +
    '.rc-text{margin:0 0 1.1rem;color:rgba(248,248,246,.62)}.rc-text a{color:#f8f8f6;text-decoration:underline;text-underline-offset:3px}' +
    '.rc-actions{display:flex;gap:.6rem}' +
    '.rc-btn{flex:1;padding:.8rem 1rem;font:600 11px/1 Inter,"Helvetica Neue",Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;border:1px solid rgba(248,248,246,.45);background:transparent;color:#f8f8f6;border-radius:2px;cursor:pointer;transition:background .25s,color .25s,border-color .25s}' +
    '.rc-btn:hover,.rc-btn:focus-visible{background:#f8f8f6;color:#060606;border-color:#f8f8f6;outline:none}' +
    '.rc-manage{background:none;border:0;padding:0;margin-left:1.25rem;font:inherit;color:inherit;opacity:.55;cursor:pointer;text-decoration:underline;text-underline-offset:3px}.rc-manage:hover{opacity:1}';

  function init() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var b = document.createElement('div');
    b.className = 'rc-banner'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Gestion des cookies');
    b.innerHTML = '<p class="rc-title">Votre vie privée</p>' +
      '<p class="rc-text">Nous utilisons des cookies de mesure d’audience et de publicité (Google) pour améliorer le site et mesurer nos annonces. Vous choisissez, et pouvez changer d’avis à tout moment. <a href="/politique-de-confidentialite.html">En savoir plus</a></p>' +
      '<div class="rc-actions"><button type="button" class="rc-btn" data-rc="denied">Refuser</button><button type="button" class="rc-btn" data-rc="granted">Accepter</button></div>';
    document.body.appendChild(b);
    function open() { requestAnimationFrame(function () { b.classList.add('is-open'); }); }
    function close() { b.classList.remove('is-open'); }
    b.addEventListener('click', function (e) {
      var v = e.target && e.target.getAttribute && e.target.getAttribute('data-rc'); if (!v) return;
      write(v); update(v); if (v === 'denied') purge(); close();
    });
    var fb = document.querySelector('.footer__bottom');
    if (fb) { var m = document.createElement('button'); m.type = 'button'; m.className = 'rc-manage'; m.textContent = 'Gérer les cookies'; m.addEventListener('click', open); fb.appendChild(m); }
    if (!read()) setTimeout(open, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
