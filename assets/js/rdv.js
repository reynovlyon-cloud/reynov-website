/* REYNOV — formulaire « Demander un rendez-vous » (atelier, peinture époxy et thermolaquage).
   Envoie la demande au même traitement serveur que le formulaire de contact (/api/contact) : la demande arrive dans le CRM
   et par e-mail. Erreurs affichées près du champ, double envoi empêché, confirmation affichée seulement après réception. */
(function () {
  'use strict';
  var forms = document.querySelectorAll('form[data-rdv]');
  if (!forms.length) return;
  var t0 = Date.now();
  var RE_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  Array.prototype.forEach.call(forms, function (f) {
    var err = f.querySelector('.form-error'), done = f.querySelector('.rdv__done'), btn = f.querySelector('button[type="submit"]'), sending = false;
    var label = btn.textContent;
    var val = function (n) { var e = f.elements[n]; return e ? String(e.value || '').trim() : ''; };
    var show = function (msg, field) {
      err.textContent = msg; err.classList.add('is-on');
      if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    };
    f.addEventListener('input', function (e) { if (e.target.removeAttribute) e.target.removeAttribute('aria-invalid'); err.classList.remove('is-on'); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      err.classList.remove('is-on');
      if (!val('prenom')) return show('Indiquez votre prénom.', f.elements.prenom);
      if (val('tel').replace(/\D/g, '').length < 8) return show('Indiquez un numéro de téléphone valide : nous vous rappelons pour fixer le rendez-vous.', f.elements.tel);
      if (!RE_MAIL.test(val('email'))) return show('Indiquez une adresse e-mail valide : elle sert à confirmer votre demande.', f.elements.email);
      sending = true; btn.disabled = true; btn.textContent = 'Envoi en cours…';
      var svc = val('prestation') || 'Peinture époxy et thermolaquage';
      var lines = ['Demande de rendez-vous à l’atelier de La Mulatière', 'Prestation : ' + svc];
      if (val('jour')) lines.push('Jour souhaité : ' + val('jour'));
      if (val('message')) lines.push('Projet : ' + val('message'));
      var body = { prenom: val('prenom'), nom: val('nom'), email: val('email'), tel: val('tel'), sujet: 'Rendez-vous atelier : ' + svc, message: lines.join('\n'), website: val('website'), _t: t0 };
      try { var a = window.reynovAttr ? window.reynovAttr() : {}; if (a && Object.keys(a).length) body.attr = a; } catch (x) { /* facultatif */ }
      fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (j) {
          if (j.ok) {
            f.classList.add('is-sent');
            if (window.reynovTrack) window.reynovTrack('rdv_request', { service: svc }); else if (typeof gtag === 'function') gtag('event', 'rdv_request', { service: svc, transport_type: 'beacon' });
            if (window.reynovFbq) window.reynovFbq('Lead', { content_name: 'rendez-vous' });
            done.focus();
          } else {
            sending = false; btn.disabled = false; btn.textContent = label;
            show(j.error || 'Une erreur est survenue. Réessayez, ou appelez le 06 61 45 35 27.');
          }
        })
        .catch(function () {
          sending = false; btn.disabled = false; btn.textContent = label;
          show('Connexion impossible. Vos informations sont conservées : réessayez, ou appelez le 06 61 45 35 27.');
        });
    });
  });
})();
