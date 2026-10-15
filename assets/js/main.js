/* ============================================================
   REYNOV — Main JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Autoplay vidéo hero ────────────────────────────────────
  const heroVid = document.querySelector('.hero__video');
  if (heroVid) heroVid.play().catch(() => {});

  // ── Curseur personnalisé sur galeries / comparateurs ────────
  (function initCursorHint() {
    const targets = document.querySelectorAll('[data-cursor-text]');
    if (!targets.length || window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
    const hint = document.createElement('div');
    hint.className = 'cursor-hint';
    document.body.appendChild(hint);
    let active = null;
    document.addEventListener('mousemove', (e) => {
      hint.style.transform = `translate(${e.clientX}px, ${e.clientY}px) scale(${active ? 1 : 0.6})`;
    });
    targets.forEach((el) => {
      el.addEventListener('mouseenter', () => {
        hint.textContent = el.getAttribute('data-cursor-text') || '';
        hint.classList.add('is-active');
        active = el;
      });
      el.addEventListener('mouseleave', () => {
        hint.classList.remove('is-active');
        active = null;
      });
    });
  })();

  // ── Nav scroll effect ──────────────────────────────────────
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Mobile menu ────────────────────────────────────────────
  const burger = document.querySelector('.nav__burger');
  const mobileMenu = document.querySelector('.nav__mobile');
  const burgerSpans = burger?.querySelectorAll('span');

  if (burger && mobileMenu) {
    let open = false;
    const toggle = () => {
      open = !open;
      mobileMenu.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
      if (burgerSpans) {
        if (open) {
          burgerSpans[0].style.transform = 'translateY(6px) rotate(45deg)';
          burgerSpans[1].style.opacity = '0';
          burgerSpans[2].style.transform = 'translateY(-6px) rotate(-45deg)';
        } else {
          burgerSpans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
        }
      }
    };
    burger.addEventListener('click', toggle);
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { if (open) toggle(); }));
  }

  // ── Scroll reveal ──────────────────────────────────────────
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => obs.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('revealed'));
  }

  // ── FAQ accordion ──────────────────────────────────────────
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  // ── Multi-step devis form ──────────────────────────────────
  const devisForm = document.querySelector('.devis-form');
  if (devisForm) initDevisForm(devisForm);

  // ── Counter animation ──────────────────────────────────────
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const countObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animateCount(e.target);
          countObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(c => countObs.observe(c));
  }

  // ── Smooth horizontal scroll for overflows ────────────────
  document.querySelectorAll('.scroll-x').forEach(el => {
    let isDown = false, startX, scrollLeft;
    el.addEventListener('mousedown', e => { isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; });
    el.addEventListener('mouseleave', () => isDown = false);
    el.addEventListener('mouseup', () => isDown = false);
    el.addEventListener('mousemove', e => { if (!isDown) return; e.preventDefault(); const x = e.pageX - el.offsetLeft; el.scrollLeft = scrollLeft - (x - startX) * 1.5; });
  });
});

// ── Counter helper ─────────────────────────────────────────
function animateCount(el) {
  const target = parseInt(el.dataset.count, 10);
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const start = performance.now();
  const update = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(eased * target) + suffix;
    if (t < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ── Parcours devis guidé : une étape = une question, l'étape suivante se débloque quand la précédente est remplie ──
function initDevisForm(form) {
  form.addEventListener('submit', e => e.preventDefault());

  const MARK = 'rgba(248,248,246,0.7)';
  const steps = Array.from(form.querySelectorAll('.devis-step'));
  const totalSteps = steps.length;
  const segsBox = form.querySelector('.devis-progress2__segs');
  const pctEl = form.querySelector('[data-pct]');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const get = (id) => document.getElementById(id);
  const val = (id) => { const el = get(id); return el ? el.value.trim() : ''; };
  const picked = (group) => form.querySelectorAll(`[data-group="${group}"].selected`);
  const modeIs = (m) => { const b = form.querySelector('[data-group="mode"].selected'); return !!b && b.dataset.mode === m; };
  const hasPhoto = () => { const i = get('photos'); return !!(i && i.files && i.files.length); };

  let currentStep = 1;
  let shownPct = 0;

  // Barre segmentée : un segment par étape
  const segs = steps.map(() => {
    const s = document.createElement('span');
    s.appendChild(document.createElement('i'));
    if (segsBox) segsBox.appendChild(s);
    return s;
  });

  // Étape complète ? (sans rien afficher)
  const isComplete = (n) => {
    switch (n) {
      case 1: return picked('raison').length > 0;
      case 2: return picked('probleme').length > 0 && picked('nb').length > 0;
      case 3: return val('marque').length >= 2;
      case 4: return hasPhoto();
      case 5: return picked('mode').length > 0 && picked('delai').length > 0 && val('adresse').length > 0
                     && (!modeIs('domicile') || val('adresse-client').length > 0);
      case 6: return val('prenom').length > 0 && val('nom').length > 0
                     && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email'))
                     && val('tel').replace(/\D/g, '').length >= 8;
    }
    return true;
  };

  const setPct = (target) => {
    if (!pctEl) return;
    const box = form.querySelector('.devis-progress2__segs');
    if (box) box.setAttribute('aria-valuenow', target);
    if (reduceMotion) { pctEl.textContent = target; shownPct = target; return; }
    const from = shownPct, t0 = performance.now(), dur = 650;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      shownPct = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      pctEl.textContent = shownPct;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  let lastTarget = -1;

  // Met à jour : blocs débloqués, bouton Continuer, barre de progression
  const refresh = () => {
    form.querySelectorAll('[data-unlock]').forEach(b => {
      const open = picked(b.dataset.unlock).length > 0;
      const wasOpen = b.classList.contains('is-open');
      b.classList.toggle('is-open', open);
      // Un bloc qui vient de se débloquer : on le ramène à l'écran s'il est sous la ligne de flottaison
      if (open && !wasOpen && !reduceMotion) setTimeout(() => {
        const r = b.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 24) window.scrollBy({ top: Math.min(r.bottom - window.innerHeight + 96, r.top - 140), behavior: 'smooth' });
      }, 120);
    });
    const cur = steps[currentStep - 1];
    const complete = isComplete(currentStep);
    const next = cur.querySelector('[data-next]');
    if (next) {
      const lock = !complete && currentStep !== 4;
      next.classList.toggle('is-locked', lock);
      next.setAttribute('aria-disabled', lock ? 'true' : 'false');
    }
    if (complete) {
      const er = cur.querySelector('[data-step-error]'); if (er) er.style.display = 'none';
      if (currentStep === 4) { const pe = get('photos-error'); if (pe) pe.style.display = 'none'; }
    }
    segs.forEach((s, i) => {
      const n = i + 1;
      s.classList.toggle('is-full', n < currentStep || (n === currentStep && complete));
      s.classList.toggle('is-current', n === currentStep);
    });
    const done = (currentStep - 1) + (complete ? 1 : 0);
    const target = Math.round(done / totalSteps * 100);
    if (target !== lastTarget) { lastTarget = target; setPct(target); }
  };

  const buildRecap = () => {
    const el = get('devis-recap');
    if (!el) return;
    const txt = (group) => Array.from(picked(group)).map(b => (b.dataset.value || b.textContent).trim());
    const nb = txt('nb')[0];
    const parts = [
      txt('raison').join(', '),
      txt('probleme').join(', '),
      nb ? `${nb} jante${nb === '1' ? '' : 's'}` : '',
      [val('marque'), val('modele')].filter(Boolean).join(' '),
      txt('mode').join(''),
    ].filter(Boolean);
    el.textContent = parts.join('  ·  ');
  };

  const showStep = (n) => {
    steps.forEach((s, i) => s.classList.toggle('current', i === n - 1));
    currentStep = n;
    const cur = steps[n - 1];
    const set = (sel, v) => { const el = form.querySelector(sel); if (el) el.textContent = v; };
    set('[data-step-current]', n);
    set('[data-step-total]', totalSteps);
    set('[data-step-name]', cur.dataset.name || '');
    if (n === totalSteps) buildRecap();
    lastTarget = -1;
    refresh();
    if (n > 1) {
      const r = form.getBoundingClientRect();
      if (r.top < 0) window.scrollBy({ top: r.top - 90, behavior: reduceMotion ? 'auto' : 'smooth' });
      const h = cur.querySelector('.devis-step__title');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    if (typeof gtag === 'function') gtag('event', n === 1 ? 'devis_start' : 'devis_step', { step: n, step_name: cur.dataset.name || '', transport_type: 'beacon' });
  };

  // Cartes de choix (radio ou multi jusqu'à 3)
  form.querySelectorAll('.choice-btn').forEach(btn => {
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      if (btn.hasAttribute('data-multi')) {
        if (!btn.classList.contains('selected') && picked(group).length >= 3) return;
        btn.classList.toggle('selected');
      } else {
        if (group) form.querySelectorAll(`[data-group="${group}"]`).forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('selected');
      }
      btn.setAttribute('aria-pressed', btn.classList.contains('selected') ? 'true' : 'false');
      // Conditions selon le mode d'intervention
      if (btn.dataset.mode) {
        const domicileInfo = get('domicile-info');
        const atelierInfo  = get('atelier-info');
        if (domicileInfo) domicileInfo.classList.toggle('visible', btn.dataset.mode === 'domicile');
        if (atelierInfo)  atelierInfo.classList.toggle('visible',  btn.dataset.mode === 'atelier');
        const adresseRow   = get('adresse-row');
        const adresseInput = get('adresse-client');
        if (adresseRow && adresseInput) {
          const isDomicile = btn.dataset.mode === 'domicile';
          adresseRow.style.display = isDomicile ? '' : 'none';
          adresseInput.required    = isDomicile;
        }
      }
      refresh();
      // Choix unique sur une étape à une seule question : on avance tout seul
      if (btn.hasAttribute('data-auto-advance') && !btn.hasAttribute('data-multi')) {
        const from = currentStep;
        setTimeout(() => { if (currentStep === from && isComplete(from)) goNext(); }, 420);
      }
    });
  });

  const fail = (stepEl, fields) => {
    const er = stepEl.querySelector('[data-step-error]');
    if (er) er.style.display = 'block';
    let first = null;
    (fields || []).forEach(([id, ok]) => {
      const el = get(id);
      if (!el) return;
      el.style.borderColor = ok ? '' : MARK;
      if (!ok && !first) first = el;
    });
    if (first) first.focus();
  };

  const validate = (n) => {
    const cur = steps[n - 1];
    if (n === 4) {
      // Non bloquant : on prévient une fois, puis on laisse continuer (photos possibles ensuite par WhatsApp)
      if (hasPhoto()) return true;
      if (!form.dataset.photoWarned) {
        form.dataset.photoWarned = '1';
        const pe = get('photos-error'); if (pe) pe.style.display = 'block';
        const drop = get('upload-drop'); if (drop) drop.style.borderColor = MARK;
        const lbl = cur.querySelector('[data-next] span'); if (lbl) lbl.textContent = 'Continuer sans photo';
        return false;
      }
      return true;
    }
    if (isComplete(n)) return true;
    if (n === 3) fail(cur, [['marque', val('marque').length >= 2]]);
    else if (n === 5) fail(cur, [['adresse', val('adresse').length > 0], ['adresse-client', !modeIs('domicile') || val('adresse-client').length > 0]]);
    else if (n === 6) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email'));
      const telOk = val('tel').replace(/\D/g, '').length >= 8;
      const ee = get('email-error'); if (ee) ee.style.display = emailOk ? 'none' : 'block';
      const te = get('tel-error');   if (te) te.style.display = telOk ? 'none' : 'block';
      fail(cur, [['prenom', val('prenom').length > 0], ['nom', val('nom').length > 0], ['email', emailOk], ['tel', telOk]]);
    } else fail(cur, []);
    return false;
  };

  const goNext = () => {
    if (!validate(currentStep)) return;
    if (currentStep < totalSteps) showStep(currentStep + 1); else submitForm();
  };
  const goPrev = () => { if (currentStep > 1) showStep(currentStep - 1); };

  form.querySelectorAll('[data-next]').forEach(btn => btn.addEventListener('click', goNext));
  form.querySelectorAll('[data-prev]').forEach(btn => btn.addEventListener('click', goPrev));

  // Saisie : on efface le surlignage du champ et on rafraîchit l'état de l'étape
  form.addEventListener('input', (e) => {
    if (e.target && e.target.style) e.target.style.borderColor = '';
    if (e.target && e.target.id === 'email') { const x = get('email-error'); if (x) x.style.display = 'none'; }
    if (e.target && e.target.id === 'tel')   { const x = get('tel-error');   if (x) x.style.display = 'none'; }
    refresh();
  });
  form.addEventListener('change', refresh);
  // Entrée dans un champ texte = étape suivante
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && e.target.type === 'text' && e.target.name !== 'website') {
      e.preventDefault();
      goNext();
    }
  });

  // Zone d'upload (#upload-drop + #photos)
  const uploadDrop  = get('upload-drop');
  const uploadInput = get('photos');
  if (uploadDrop && uploadInput) {
    uploadDrop.addEventListener('dragover', e => {
      e.preventDefault();
      uploadDrop.style.borderColor = 'rgba(255,255,255,0.5)';
    });
    uploadDrop.addEventListener('dragleave', () => {
      uploadDrop.style.borderColor = '';
    });
    uploadDrop.addEventListener('drop', e => {
      e.preventDefault();
      uploadDrop.style.borderColor = '';
      if (e.dataTransfer.files.length) {
        const dt = new DataTransfer();
        Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
        uploadInput.files = dt.files;
        updateUploadLabel(uploadInput);
        const lbl = form.querySelector('.devis-step[data-step="4"] [data-next] span'); if (lbl) lbl.textContent = 'Continuer';
        refresh();
      }
    });
    uploadInput.addEventListener('change', () => {
      updateUploadLabel(uploadInput);
      uploadDrop.style.borderColor = '';
      const lbl = form.querySelector('.devis-step[data-step="4"] [data-next] span'); if (lbl) lbl.textContent = 'Continuer';
    });
  }

  showStep(1);
}

function updateUploadLabel(input) {
  const labelText = document.getElementById('upload-label-text');
  const preview   = document.getElementById('upload-previews');
  const drop      = document.getElementById('upload-drop');
  if (!input || !input.files.length) return;
  if (labelText) labelText.textContent = `${input.files.length} fichier(s) ajouté(s)`;
  if (drop) drop.classList.add('has-files');
  if (preview) {
    preview.innerHTML = '';
    Array.from(input.files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.className = 'upload-thumb';
        img.alt = file.name;
        const reader = new FileReader();
        reader.onload = e => { img.src = e.target.result; };
        reader.readAsDataURL(file);
        preview.appendChild(img);
      } else {
        const div = document.createElement('div');
        div.className = 'upload-file-name';
        div.textContent = file.name;
        preview.appendChild(div);
      }
    });
  }
}

function submitForm() {
  console.log('[REYNOV] submitForm called');
  const form = document.querySelector('.devis-form');
  if (!form) return;

  // Collect choice buttons
  const groups = {};
  form.querySelectorAll('.choice-btn.selected').forEach(btn => {
    const g = btn.dataset.group;
    const v = (btn.dataset.value || btn.textContent).trim();
    if (!groups[g]) groups[g] = [];
    groups[g].push(v);
  });

  const fd = new FormData();
  fd.append('prestation',    (groups.raison   || []).join(', '));
  fd.append('problemes',     (groups.probleme || []).join(', '));
  fd.append('nb_jantes',     (groups.nb       || []).join(''));
  fd.append('mode',          (groups.mode     || []).join(''));
  fd.append('delai',         (groups.delai    || []).join(''));

  ['taille','marque','modele','finition','adresse','prenom','nom','email','tel','description'].forEach(id => {
    const el = document.getElementById(id);
    if (el) fd.append(id, el.value);
  });

  const adresseClient = document.getElementById('adresse-client');
  if (adresseClient) fd.append('adresse_client', adresseClient.value);

  const photosInput = document.getElementById('photos');
  if (photosInput && photosInput.files) {
    Array.from(photosInput.files).forEach(f => fd.append('photos', f));
  }

  const allNextBtns = form.querySelectorAll('[data-next]');
  const submitBtn = allNextBtns[allNextBtns.length - 1];
  if (submitBtn) {
    submitBtn.disabled = true;
    const span = submitBtn.querySelector('span');
    if (span) span.textContent = 'Envoi en cours…';
  }

  const resetBtn = () => {
    if (submitBtn) {
      submitBtn.disabled = false;
      const span = submitBtn.querySelector('span');
      if (span) span.textContent = 'Envoyer ma demande';
    }
  };

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/devis');
  xhr.onload = () => {
    try {
      const data = JSON.parse(xhr.responseText);
      if (data.ok) {
        // Snippet officiel Google Ads : déclenche la conversion puis redirige une fois l'envoi confirmé
        // (gtag.js applique lui-même un délai de sécurité si le callback ne répond pas)
        if (typeof gtag === 'function') {
          gtag('event', 'conversion', {
            'send_to': 'AW-18189889040/7zKmCNbLnMwcEJDczuFD',
            'event_callback': function () { window.location.href = '/devis-confirmation.html'; }
          });
        } else {
          window.location.href = '/devis-confirmation.html';
        }
      } else {
        resetBtn();
        alert('Erreur : ' + (data.error || 'Erreur serveur'));
      }
    } catch (e) {
      resetBtn();
      alert('Erreur inattendue. Contactez-nous : 06 61 45 35 27');
    }
  };
  xhr.onerror = () => {
    resetBtn();
    console.error('XHR error status:', xhr.status);
    alert('Erreur réseau. Vérifiez votre connexion et réessayez.');
  };
  xhr.send(fd);
}
