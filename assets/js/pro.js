/* REYNOV — pages professionnels : formulaire de contact pro et calcul de marge. */
(function () {
  'use strict';

  // ── Calcul de marge : marge additionnelle HT = prix facturé HT − coût de sous-traitance HT − coûts supplémentaires ──
  var calc = document.getElementById('marge-calc');
  if (calc) {
    var ids = ['m-prix', 'm-cout', 'm-extra', 'm-nb'];
    var out = document.getElementById('m-result');
    var fmt = function (n) { return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'; };
    var run = function () {
      var v = ids.map(function (i) { return parseFloat((document.getElementById(i).value || '').replace(',', '.')); });
      var prix = v[0], cout = v[1], extra = isNaN(v[2]) ? 0 : v[2], nb = isNaN(v[3]) || v[3] < 1 ? 1 : v[3];
      if (isNaN(prix) || isNaN(cout)) { out.textContent = 'Renseignez le prix facturé et le coût de sous-traitance pour voir le résultat.'; return; }
      var m = prix - cout - extra;
      out.textContent = 'Marge additionnelle HT : ' + fmt(m) + ' par jante, soit ' + fmt(m * nb) + ' pour ' + nb + ' jante' + (nb > 1 ? 's' : '') + (m < 0 ? ' — inférieure à vos coûts : ajustez votre prix de vente.' : '.');
    };
    ids.forEach(function (i) { document.getElementById(i).addEventListener('input', run); });
  }

  // ── Formulaire de contact professionnel ──
  var f = document.getElementById('pro-form');
  if (!f) return;
  var status = document.getElementById('pro-status');
  var t0 = Date.now();
  var sending = false;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function fail(msg, field) {
    status.textContent = msg;
    status.style.color = '#ffb4a8';
    if (field && field.focus) field.focus();
  }
  function reset() {
    sending = false;
    var btn = f.querySelector('button[type=submit]');
    btn.disabled = false; btn.querySelector('span').textContent = 'Envoyer ma demande';
  }

  f.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    status.style.color = ''; status.textContent = '';
    var el = function (n) { return f.elements[n]; };
    if (!el('entreprise').value.trim()) return fail('Indiquez le nom de votre entreprise.', el('entreprise'));
    if (!el('activite').value) return fail('Choisissez votre type d\'activité.', el('activite'));
    if (!el('contact').value.trim()) return fail('Indiquez votre nom.', el('contact'));
    if (!el('commune').value.trim()) return fail('Indiquez votre commune ou code postal.', el('commune'));
    if (el('tel').value.replace(/\D/g, '').length < 8) return fail('Indiquez un numéro de téléphone valide.', el('tel'));
    if (!EMAIL.test(el('email').value.trim())) return fail('Indiquez une adresse e-mail valide.', el('email'));
    var files = el('photos').files;
    if (files.length > 6) return fail('6 photos maximum.', el('photos'));
    for (var i = 0; i < files.length; i++) if (files[i].size > 8 * 1024 * 1024) return fail('Une photo dépasse 8 Mo : réduisez-la ou envoyez-la sur WhatsApp.', el('photos'));

    var fd = new FormData();
    ['website', 'entreprise', 'activite', 'contact', 'commune', 'tel', 'email', 'volume', 'message'].forEach(function (n) { fd.append(n, el(n).value); });
    try { var at = window.reynovAttr ? window.reynovAttr() : {}; if (at && Object.keys(at).length) fd.append('attr', JSON.stringify(at)); } catch (e) { /* facultatif */ }
    fd.append('_t', String(t0)); fd.append('page', f.getAttribute('data-page') || location.pathname);
    for (var j = 0; j < files.length; j++) fd.append('photos', files[j]);

    sending = true;
    var btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.querySelector('span').textContent = 'Envoi en cours…';
    status.textContent = 'Envoi en cours…';

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 40000);
    fetch('/api/pro', { method: 'POST', body: fd, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        clearTimeout(timer);
        if (res.j && res.j.ok) {
          // la réussite n'est affichée (et mesurée) qu'après confirmation du serveur
          f.hidden = true; var done = document.getElementById('pro-done'); done.hidden = false;
          if (window.reynovFbq) window.reynovFbq('Lead', { content_name: 'professionnel', content_category: el('activite').value });
          if (typeof window.gtag === 'function') window.gtag('event', 'pro_contact_submit', { activity: el('activite').value, page_path: location.pathname, transport_type: 'beacon' });
          window.scrollTo({ top: Math.max(0, done.getBoundingClientRect().top + window.scrollY - 140), behavior: 'smooth' });
        } else {
          reset();
          fail((res.j && res.j.error) || 'Une erreur est survenue. Appelez-nous au 06 61 45 35 27 ou écrivez-nous sur WhatsApp.');
        }
      })
      .catch(function () {
        clearTimeout(timer); reset();
        fail('Envoi impossible (connexion ou délai dépassé). Vérifiez votre connexion et réessayez, ou appelez le 06 61 45 35 27.');
      });
  });
})();
