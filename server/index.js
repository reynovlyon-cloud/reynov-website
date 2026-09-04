const express     = require('express');
const compression = require('compression');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const multer      = require('multer');
const path        = require('path');
const db          = require('./db');

const app    = express();
const PORT   = parseInt(process.env.PORT) || 3000;

// ── Gzip compression ──────────────────────────────────────────
app.use(compression({ level: 6 }));

// ── Security headers (helmet) ─────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'https://www.google-analytics.com', 'https://www.googletagmanager.com'],       // inline scripts dans les HTML
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'https:'],
      mediaSrc:    ["'self'"],
      connectSrc:  ["'self'", 'https://www.google-analytics.com', 'https://www.googletagmanager.com'],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,   // évite de casser les fonts
  permittedCrossDomainPolicies: false,
}));

// ── HSTS — force HTTPS pendant 1 an ──────────────────────────
app.use((_req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});

// ── Permissions-Policy ────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── Rate limiting — formulaire devis ─────────────────────────
const devisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 heure
  max: 5,                      // max 5 soumissions par IP par heure
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Trop de demandes. Réessayez dans une heure ou appelez le 06 61 45 35 27.' },
});

// ── Multer — images uniquement, 10 MB max par fichier ────────
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME.has(file.mimetype));
  },
});

// ── Tracking visites pages HTML ───────────────────────────────
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/admin')) {
    const ext = path.extname(req.path);
    if (ext === '.html' || ext === '') db.logVisit();
  }
  next();
});

// ── Static site ───────────────────────────────────────────────
const ONE_YEAR = 365 * 24 * 60 * 60;
app.use(express.static(path.join(__dirname, '..'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (/\.(jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── Gmail API (OAuth2 via fetch natif — bypass gaxios) ───────
const GMAIL_USER          = process.env.GMAIL_USER;
const GMAIL_CLIENT_ID     = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

console.log('ENV CHECK — GMAIL_USER:', !!GMAIL_USER,
  '| CLIENT_ID:', !!GMAIL_CLIENT_ID,
  '| CLIENT_SECRET:', !!GMAIL_CLIENT_SECRET,
  '| REFRESH_TOKEN:', !!GMAIL_REFRESH_TOKEN);

async function getAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function sendEmail({ from, to, subject, html, attachments = [] }) {
  const accessToken = await getAccessToken();

  let rawParts;
  if (attachments.length === 0) {
    rawParts = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
    ];
  } else {
    const boundary = `boundary_${Date.now()}`;
    rawParts = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
      ...attachments.flatMap(a => [
        `--${boundary}`,
        `Content-Type: ${a.contentType}`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${a.filename}"`,
        '',
        a.content.toString('base64'),
      ]),
      `--${boundary}--`,
    ];
  }

  const raw = Buffer.from(rawParts.join('\r\n')).toString('base64url');
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(`Gmail send error: ${JSON.stringify(result)}`);
}


// ── Sanitisation — supprime les balises HTML des champs texte ─
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 500);   // longueur max par champ
}

// ── Email : owner ─────────────────────────────────────────────
function ownerEmail(d) {
  const row = (label, val) => val
    ? `<tr>
        <td style="padding:8px 0;color:#888;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;padding-right:24px;vertical-align:top">${label}</td>
        <td style="padding:8px 0;color:#111;font-size:14px;">${val}</td>
       </tr>`
    : '';

  const date = new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Nouveau devis</title></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,sans-serif;">
<div style="max-width:620px;margin:32px auto;background:#fff;border-radius:4px;overflow:hidden;">

  <div style="background:#060606;padding:28px 40px;">
    <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:4px;">REYNOV</span>
    <span style="color:rgba(255,255,255,0.4);font-size:13px;margin-left:12px;">Nouveau devis reçu</span>
  </div>

  <div style="padding:36px 40px;">
    <h2 style="margin:0 0 4px;font-size:20px;color:#111;">Demande de ${d.prenom} ${d.nom}</h2>
    <p style="margin:0 0 24px;color:#888;font-size:12px;">${date}</p>

    <div style="background:#f7f7f7;padding:20px 24px;margin-bottom:28px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;">Contact</p>
      <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#111;">${d.prenom} ${d.nom}</p>
      <p style="margin:0 0 2px;font-size:13px;color:#444;">${d.email}</p>
      <p style="margin:0 0 2px;font-size:13px;color:#444;">${d.tel}</p>
      ${d.adresse_client ? `<p style="margin:4px 0 0;font-size:13px;color:#444;">Adresse : ${d.adresse_client}</p>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;">
      ${row('Prestation',       d.prestation)}
      ${row('Problème(s)',      d.problemes)}
      ${row('Nb jantes',        d.nb_jantes)}
      ${row('Taille',           d.taille)}
      ${row('Véhicule',         [d.marque, d.modele].filter(Boolean).join(' '))}
      ${row('Finition',         d.finition)}
      ${row('Mode',             d.mode)}
      ${row('Délai',            d.delai)}
      ${row('Ville / CP',       d.adresse)}
    </table>

    ${d.description ? `
    <div style="margin-top:24px;padding:16px 20px;background:#f7f7f7;border-left:3px solid #ccc;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;">Message</p>
      <p style="margin:0;font-size:13px;color:#333;line-height:1.6;">${d.description}</p>
    </div>` : ''}
  </div>

  <div style="background:#f5f5f5;padding:16px 40px;font-size:11px;color:#aaa;">
    REYNOV · reynov.lyon@gmail.com · 06 61 45 35 27
  </div>
</div>
</body></html>`;
}

// ── Email : client ────────────────────────────────────────────
function clientEmail(d) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Votre devis REYNOV</title></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,sans-serif;">
<div style="max-width:620px;margin:32px auto;background:#fff;border-radius:4px;overflow:hidden;">

  <div style="background:#060606;padding:28px 40px;">
    <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:4px;">REYNOV</span>
  </div>

  <div style="padding:40px;">
    <h2 style="margin:0 0 12px;font-size:22px;color:#111;">Bonjour ${d.prenom},</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Votre demande de devis a bien été reçue. Nous vous recontactons sous <strong>24h</strong> avec une estimation personnalisée.
    </p>

    <div style="background:#f7f7f7;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;">Votre demande</p>
      ${d.prestation ? `<p style="margin:0 0 6px;font-size:13px;color:#444;"><b style="color:#111;">Prestation :</b> ${d.prestation}</p>` : ''}
      ${d.problemes  ? `<p style="margin:0 0 6px;font-size:13px;color:#444;"><b style="color:#111;">Problème(s) :</b> ${d.problemes}</p>` : ''}
      ${d.nb_jantes  ? `<p style="margin:0 0 6px;font-size:13px;color:#444;"><b style="color:#111;">Jantes :</b> ${d.nb_jantes} jante(s)${d.taille ? ` — ${d.taille}` : ''}</p>` : ''}
      ${d.marque     ? `<p style="margin:0 0 6px;font-size:13px;color:#444;"><b style="color:#111;">Véhicule :</b> ${d.marque}${d.modele ? ` ${d.modele}` : ''}</p>` : ''}
      ${d.mode       ? `<p style="margin:0 0 6px;font-size:13px;color:#444;"><b style="color:#111;">Mode :</b> ${d.mode}</p>` : ''}
      ${d.delai      ? `<p style="margin:0;font-size:13px;color:#444;"><b style="color:#111;">Délai :</b> ${d.delai}</p>` : ''}
    </div>

    <p style="margin:0 0 28px;font-size:14px;color:#777;line-height:1.7;">
      Une question ? Contactez-nous directement :
    </p>
    <p style="margin:0;">
      <a href="tel:+33661453527" style="display:inline-block;padding:12px 24px;background:#060606;color:#fff;text-decoration:none;font-size:13px;font-weight:600;margin-right:12px;">06 61 45 35 27</a>
      <a href="mailto:reynov.lyon@gmail.com" style="display:inline-block;padding:12px 24px;border:1px solid #ddd;color:#333;text-decoration:none;font-size:13px;">reynov.lyon@gmail.com</a>
    </p>
  </div>

  <div style="background:#f5f5f5;padding:16px 40px;font-size:11px;color:#aaa;">
    REYNOV · 47 chemin du Pras, 69350 Lyon · <a href="https://reynovjantes.fr" style="color:#aaa;">reynovjantes.fr</a>
  </div>
</div>
</body></html>`;
}

// ── CRM — auth middleware ─────────────────────────────────────
const CRM_PASSWORD = process.env.CRM_PASSWORD;
function crmAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const key  = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-crm-key'] || '';
  if (!CRM_PASSWORD || key !== CRM_PASSWORD) return res.status(401).json({ ok: false, error: 'Non autorisé' });
  next();
}

app.use('/api/crm', express.json(), crmAuth);

// GET /api/crm/stats
app.get('/api/crm/stats', (req, res) => {
  res.json({ ok: true, data: db.stats() });
});

// GET /api/crm/clients?q=search
app.get('/api/crm/clients', (req, res) => {
  res.json({ ok: true, data: db.clientsList(req.query.q || '') });
});

// GET /api/crm/clients/:id
app.get('/api/crm/clients/:id', (req, res) => {
  const client = db.clientById(req.params.id);
  if (!client) return res.status(404).json({ ok: false, error: 'Client introuvable' });
  res.json({ ok: true, data: client });
});

// POST /api/crm/clients
app.post('/api/crm/clients', (req, res) => {
  const b = req.body;
  const id = db.createClient({
    prenom: b.prenom || '', nom: b.nom || '', email: b.email || '',
    tel: b.tel || '', adresse: b.adresse || '', ville: b.ville || '', notes: b.notes || '',
  });
  res.json({ ok: true, id });
});

// PUT /api/crm/clients/:id
app.put('/api/crm/clients/:id', (req, res) => {
  const b = req.body;
  db.updateClient(req.params.id, {
    prenom: b.prenom || '', nom: b.nom || '', email: b.email || '',
    tel: b.tel || '', adresse: b.adresse || '', ville: b.ville || '', notes: b.notes || '',
  });
  res.json({ ok: true });
});

// DELETE /api/crm/clients/:id
app.delete('/api/crm/clients/:id', (req, res) => {
  db.deleteClient(req.params.id);
  res.json({ ok: true });
});

// GET /api/crm/interventions
app.get('/api/crm/interventions', (req, res) => {
  res.json({ ok: true, data: db.allInterventions() });
});

// POST /api/crm/interventions
app.post('/api/crm/interventions', (req, res) => {
  const b = req.body;
  const id = db.createIntervention({
    client_id: Number(b.client_id), prestation: b.prestation || '',
    problemes: b.problemes || '', nb_jantes: b.nb_jantes || '',
    taille: b.taille || '', marque: b.marque || '', modele: b.modele || '',
    finition: b.finition || '', mode: b.mode || '',
    adresse_intervention: b.adresse_intervention || '',
    statut: b.statut || 'nouveau', montant: b.montant || null, notes: b.notes || '',
  });
  res.json({ ok: true, id });
});

// PUT /api/crm/interventions/:id
app.put('/api/crm/interventions/:id', (req, res) => {
  const b = req.body;
  db.updateIntervention(req.params.id, {
    statut: b.statut, montant: b.montant || null, notes: b.notes || '',
  });
  res.json({ ok: true });
});

// DELETE /api/crm/interventions/:id
app.delete('/api/crm/interventions/:id', (req, res) => {
  db.deleteIntervention(req.params.id);
  res.json({ ok: true });
});

// GET /api/crm/visits?days=30
app.get('/api/crm/visits', (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 365);
  res.json({ ok: true, data: db.visitsByDay(days) });
});

// ── POST /api/devis ───────────────────────────────────────────
app.post('/api/devis', devisLimiter, (req, res, next) => {
  upload.array('photos', 10)(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: 'Fichier invalide (images uniquement, 10 MB max).' });
    next();
  });
}, async (req, res) => {
  try {
    console.log('📩 Devis reçu depuis', req.ip);
    const b = req.body;

    // Honeypot anti-spam
    if (b.website) {
      return res.status(400).json({ ok: false, error: 'Requête invalide.' });
    }

    // Validation email basique
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!b.email || !emailRe.test(b.email)) {
      return res.status(400).json({ ok: false, error: 'Adresse email invalide.' });
    }
    if (!b.prenom || !b.tel) {
      return res.status(400).json({ ok: false, error: 'Prénom et téléphone requis.' });
    }

    // Sanitisation de tous les champs texte
    const d = {
      prestation:     sanitize(b.prestation),
      problemes:      sanitize(b.problemes),
      nb_jantes:      sanitize(b.nb_jantes),
      taille:         sanitize(b.taille),
      marque:         sanitize(b.marque),
      modele:         sanitize(b.modele),
      finition:       sanitize(b.finition),
      mode:           sanitize(b.mode),
      delai:          sanitize(b.delai),
      adresse:        sanitize(b.adresse),
      adresse_client: sanitize(b.adresse_client),
      description:    sanitize(b.description),
      prenom:         sanitize(b.prenom),
      nom:            sanitize(b.nom),
      email:          b.email.trim().slice(0, 200),
      tel:            sanitize(b.tel),
    };

    console.log('Client:', d.prenom, d.nom, d.email);

    const attachments = (req.files || []).map(f => ({
      filename:    f.originalname,
      content:     f.buffer,
      contentType: f.mimetype,
    }));

    console.log(`📎 ${attachments.length} photo(s) jointe(s)`);

    await sendEmail({
      from:        `"REYNOV Site" <${GMAIL_USER}>`,
      to:          GMAIL_USER,
      subject:     `Nouveau devis - ${d.prenom} ${d.nom}`,
      html:        ownerEmail(d),
      attachments,
    });
    console.log('✅ Mail owner envoyé');

    await sendEmail({
      from:    `"REYNOV" <${GMAIL_USER}>`,
      to:      d.email,
      subject: 'Votre demande de devis REYNOV a bien été reçue',
      html:    clientEmail(d),
    });
    console.log('✅ Mail client envoyé');

    // ── Auto-save dans le CRM ──────────────────────────────────
    try {
      let client = d.email ? db.findByEmail(d.email) : null;
      const clientId = client
        ? client.id
        : db.createClient({ prenom: d.prenom, nom: d.nom, email: d.email, tel: d.tel, adresse: d.adresse || '', ville: d.adresse || '', notes: '' });
      db.createIntervention({
        client_id: clientId,
        prestation: d.prestation, problemes: d.problemes,
        nb_jantes: d.nb_jantes, taille: d.taille,
        marque: d.marque, modele: d.modele,
        finition: d.finition, mode: d.mode,
        adresse_intervention: d.adresse_client || d.adresse,
        statut: 'devis_envoye', montant: null, notes: '',
      });
      console.log('✅ CRM mis à jour');
    } catch (e) {
      console.error('⚠️ CRM save error:', e.message);
    }

    res.json({ ok: true });

  } catch (err) {
    console.error('❌ Erreur envoi mail:', err.message, JSON.stringify(err.response?.data || ''));
    res.status(500).json({ ok: false, error: 'Erreur serveur. Appelez le 06 61 45 35 27.' });
  }
});

// ── Fallback HTML ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

process.on('uncaughtException',  err => console.error('💥 uncaughtException:', err.message));
process.on('unhandledRejection', err => console.error('💥 unhandledRejection:', err));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 REYNOV server démarré sur le port ${PORT}`);
});
