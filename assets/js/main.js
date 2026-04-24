/* ============================================================
   REYNOV — Main JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Autoplay vidéo hero ────────────────────────────────────
  const heroVid = document.querySelector('.hero__video');
  if (heroVid) heroVid.play().catch(() => {});

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

// ── Multi-step devis form logic ────────────────────────────
function initDevisForm(form) {
  form.addEventListener('submit', e => e.preventDefault());

  let currentStep = 1;
  const steps = form.querySelectorAll('.devis-step');
  const progress = form.querySelectorAll('.devis-progress__step');
  const totalSteps = steps.length;

  const showStep = (n) => {
    steps.forEach((s, i) => s.classList.toggle('current', i === n - 1));
    progress.forEach((p, i) => {
      p.classList.toggle('active', i === n - 1);
      p.classList.toggle('done', i < n - 1);
    });
    currentStep = n;
    form.querySelector('[data-step-current]') && (form.querySelector('[data-step-current]').textContent = n);
    form.querySelector('[data-step-total]') && (form.querySelector('[data-step-total]').textContent = totalSteps);
  };

  // Choice buttons (radio-like)
  form.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      if (btn.hasAttribute('data-multi')) {
        btn.classList.toggle('selected');
      } else {
        if (group) form.querySelectorAll(`[data-group="${group}"]`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      }
      // Intervention info toggle
      if (btn.dataset.mode) {
        const domicileInfo = document.getElementById('domicile-info');
        const atelierInfo  = document.getElementById('atelier-info');
        if (domicileInfo) domicileInfo.classList.toggle('visible', btn.dataset.mode === 'domicile');
        if (atelierInfo)  atelierInfo.classList.toggle('visible',  btn.dataset.mode === 'atelier');
        const adresseRow   = document.getElementById('adresse-row');
        const adresseInput = document.getElementById('adresse-client');
        if (adresseRow && adresseInput) {
          const isDomicile = btn.dataset.mode === 'domicile';
          adresseRow.style.display  = isDomicile ? '' : 'none';
          adresseInput.required     = isDomicile;
        }
      }
      // Auto-advance if single choice group and not multi
      if (btn.dataset.autoAdvance && !btn.dataset.multi) {
        setTimeout(() => goNext(), 300);
      }
    });
  });

  const validate = (step) => {
    if (step === 5) {
      const input = form.querySelector('input[name="photos"]');
      const error = document.getElementById('photos-error');
      const drop  = document.getElementById('upload-drop');
      if (error) error.style.display = 'none';
      if (drop)  drop.style.borderColor = '';
    }
    if (step === 6) {
      let ok = true;
      const prenom = document.getElementById('prenom');
      const email  = document.getElementById('email');
      const tel    = document.getElementById('tel');
      const emailErr = document.getElementById('email-error');
      const telErr   = document.getElementById('tel-error');

      if (!email || !email.value.trim()) {
        if (emailErr) emailErr.style.display = 'block';
        if (email) email.style.borderColor = 'rgba(255,100,100,0.45)';
        ok = false;
      } else {
        if (emailErr) emailErr.style.display = 'none';
        if (email) email.style.borderColor = '';
      }
      if (!tel || !tel.value.trim()) {
        if (telErr) telErr.style.display = 'block';
        if (tel) { tel.style.borderColor = 'rgba(255,100,100,0.45)'; if (ok) tel.focus(); }
        ok = false;
      } else {
        if (telErr) telErr.style.display = 'none';
        if (tel) tel.style.borderColor = '';
      }
      if (!ok) return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validate(currentStep)) return;
    if (currentStep < totalSteps) showStep(currentStep + 1); else submitForm();
  };
  const goPrev = () => { if (currentStep > 1) showStep(currentStep - 1); };

  form.querySelectorAll('[data-next]').forEach(btn => btn.addEventListener('click', goNext));
  form.querySelectorAll('[data-prev]').forEach(btn => btn.addEventListener('click', goPrev));

  // Upload zone (#upload-drop label + #photos input)
  const uploadDrop  = document.getElementById('upload-drop');
  const uploadInput = document.getElementById('photos');
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
      }
    });
    uploadInput.addEventListener('change', () => updateUploadLabel(uploadInput));
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
    const v = btn.textContent.trim();
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
        form.querySelectorAll('.devis-step').forEach(s => s.classList.remove('current'));
        const success = form.querySelector('.devis-success');
        if (success) success.style.display = 'block';
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
