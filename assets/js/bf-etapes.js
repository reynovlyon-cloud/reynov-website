/* REYNOV — Black Friday, « Réservez en 3 étapes » : pendant le défilement, la scène reste en place ;
   l'anneau se remplit comme une jante, le chiffre roule de 1 à 3 et le texte de chaque étape apparaît au même endroit.
   Sans ce script, ou si l'appareil demande moins d'animations, les 3 cartes restent affichées telles quelles. */
(function () {
  'use strict';
  var bloc = document.querySelector('[data-bfx]');
  if (!bloc || !window.requestAnimationFrame) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var etapes = bloc.querySelectorAll('[data-bfx-etape]'), n = etapes.length;
  if (n < 2) return;
  var arc = bloc.querySelector('[data-bfx-arc]'), traits = bloc.querySelectorAll('.bfx__rail i');
  var section = bloc.closest ? bloc.closest('section') : null;
  bloc.classList.add('is-anime');
  if (section) section.classList.add('is-anime');

  var actuelle = -1, prevu = false;
  function borne(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function maj() {
    prevu = false;
    var r = bloc.getBoundingClientRect(), vh = window.innerHeight || document.documentElement.clientHeight;
    var course = r.height - vh, p = course > 0 ? borne(-r.top / course) : 0;
    bloc.style.setProperty('--p', p.toFixed(3));
    if (arc) arc.style.strokeDashoffset = (100 - p * 100).toFixed(2);
    for (var k = 0; k < traits.length; k++) traits[k].style.transform = 'scaleX(' + borne(p * n - k).toFixed(3) + ')';
    var i = Math.min(n - 1, Math.floor(p * n));
    if (i !== actuelle) {
      actuelle = i;
      bloc.setAttribute('data-etape', String(i + 1));
      for (var e = 0; e < n; e++) { etapes[e].classList.toggle('is-on', e === i); etapes[e].classList.toggle('is-passe', e < i); }
    }
  }
  function demander() { if (!prevu) { prevu = true; window.requestAnimationFrame(maj); } }
  window.addEventListener('scroll', demander, { passive: true });
  window.addEventListener('resize', demander);
  maj();
})();
