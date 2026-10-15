/* REYNOV — section satisfaction clients (note, étoiles une par une, compteurs, cartes) */
(function () {
  var sec = document.querySelector('.sat'); if (!sec) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fmt(n, dec) { return n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function count(el) {
    var target = parseFloat(el.getAttribute('data-sat-count')), dec = parseInt(el.getAttribute('data-sat-dec') || '0', 10);
    var dur = parseInt(el.getAttribute('data-sat-dur') || '1800', 10), pre = el.getAttribute('data-sat-pre') || '';
    var suf = (el.getAttribute('data-sat-suf') || '').replace(/&nbsp;/g, ' '), t0 = null;
    el.textContent = pre + fmt(0, dec) + suf;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1), e = dur > 2000 ? p : 1 - Math.pow(1 - p, 3);
      el.textContent = pre + fmt(target * e, dec) + suf;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function watch(node, opts, fn) {
    if (!node) return;
    if (!('IntersectionObserver' in window) || reduce) { node.classList.add('is-live'); return; }
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { node.classList.add('is-live'); fn && fn(); io.disconnect(); } }, opts);
    io.observe(node);
  }
  var score = sec.querySelector('.sat__score'), stats = sec.querySelector('.sat__stats'), cards = sec.querySelector('.sat__cards');
  watch(score, { threshold: 0.9 }, function () { count(score.querySelector('[data-sat-count]')); });
  watch(stats, { threshold: 0.7 }, function () { stats.querySelectorAll('[data-sat-count]').forEach(count); });
  watch(cards, { threshold: 0.15 });
})();
