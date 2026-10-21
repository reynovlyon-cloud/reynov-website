const express     = require('express');
const compression = require('compression');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const multer      = require('multer');
const path        = require('path');
const crypto      = require('crypto');
const db          = require('./db');

const app    = express();
app.disable('x-powered-by');
// Railway place UN proxy devant l'appli : sans ceci, tous les visiteurs partagent la même IP
// (limites de débit communes à tout le monde) et req.ip n'est pas fiable.
// TRUST_PROXY_HOPS = nombre de proxys devant l'appli : 1 (Railway seul) ; 2 si Cloudflare est ajouté devant Railway.
app.set('trust proxy', Math.max(1, parseInt(process.env.TRUST_PROXY_HOPS, 10) || 1));
const CANONICAL_HOST = 'www.reynov-jantes.fr';
const PORT   = parseInt(process.env.PORT) || 3000;

// ── Gzip compression ──────────────────────────────────────────
app.use(compression({ level: 6 }));

// ── Security headers (helmet) ─────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'https://www.google-analytics.com', 'https://www.googletagmanager.com', 'https://googleads.g.doubleclick.net', 'https://www.googleadservices.com'],       // inline scripts dans les HTML
      // Directive distincte requise par le diagnostic Google Ads (script-src-elem prime sur script-src pour les balises <script>)
      scriptSrcElem: ["'self'", "'unsafe-inline'", 'https://www.google-analytics.com', 'https://www.googletagmanager.com', 'https://googleads.g.doubleclick.net', 'https://www.googleadservices.com'],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      fontSrc:     ["'self'"],
      imgSrc:      ["'self'", 'data:', 'https:'],
      mediaSrc:    ["'self'"],
      // Domaines nécessaires pour l'envoi effectif des conversions Google Ads (googletagmanager.com ne fait que charger le tag) — liste exacte donnée par le diagnostic "Balise Google" de Google Ads
      connectSrc:  ["'self'",
        // Google Analytics 4 envoie vers un serveur régional (region1.google-analytics.com pour l'Europe) et
        // le mode consentement de Google Ads vers pagead2.googlesyndication.com : sans ces domaines, ces mesures étaient bloquées.
        'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com',
        'https://pagead2.googlesyndication.com', 'https://*.g.doubleclick.net', 'https://ad.doubleclick.net', 'https://td.doubleclick.net',
        'https://www.googleadservices.com', 'https://google.com', 'https://www.google.com', 'https://www.google.fr'],
      frameSrc:    ['https://googleads.g.doubleclick.net', 'https://td.doubleclick.net'],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
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
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  next();
});

// ── Zone d'administration : page jamais indexée ni mise en cache, jamais intégrable dans un cadre.
// Le CRM utilise des gestionnaires d'événements en ligne (onclick=...) que la politique globale
// interdit : on ne les autorise QUE sur /admin (l'API reste protégée par mot de passe).
app.use('/admin', (_req, res, next) => {
  const csp = res.getHeader('Content-Security-Policy');
  if (csp) {
    res.setHeader('Content-Security-Policy', String(csp)
      .replace("script-src-attr 'none'", "script-src-attr 'unsafe-inline'")
      .replace("frame-ancestors 'self'", "frame-ancestors 'none'"));
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});
// Pages internes (maquettes, e-mail pro, landing Ads) et API : jamais dans Google
app.use((req, res, next) => {
  if (/^\/(ads|lp|api)(\/|$)|^\/email-prospection-pro\.html$/.test(req.path)) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

// ── Redirection non-www -> www (évite le duplicate content) ──
app.use((req, res, next) => {
  const host = req.hostname;
  if (host === CANONICAL_HOST || host === 'localhost' || host === '127.0.0.1' || req.path === '/api/health') return next();
  return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
});

// ── Anciennes URL -> nouvelles (301) ─────────────────────────
const MOVED = {
  '/blog/prix-reparation-jante-lyon-2025.html': '/blog/prix-reparation-jante-lyon.html',
};
app.use((req, res, next) => {
  const to = MOVED[req.path];
  if (to) return res.redirect(301, to);
  next();
});

// ── Rate limiting global de l'API (anti-scraping / abus) ─────
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Trop de requêtes.' } }));

// ── Rate limiting — formulaire devis ─────────────────────────
const devisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 heure
  max: 5,                      // max 5 soumissions par IP par heure
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Trop de demandes. Réessayez dans une heure ou appelez le 06 61 45 35 27.' },
});

// ── Multer — images uniquement, 8 Mo max par fichier, 8 photos max ──
// (mémoire limitée : 8 x 8 Mo = 64 Mo au pire, plafonné à 20 Mo au total plus bas)
const MAX_FILE = 8 * 1024 * 1024;
const MAX_TOTAL = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE, files: 8, fields: 40, fieldSize: 20 * 1024, parts: 60 },
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
// express.static serves the whole repo root below, so server code, data
// and build files must be explicitly blocked before it — they are not
// meant to be publicly downloadable.
app.use((req, res, next) => {
  if (/^\/(server|node_modules|\.git)(\/|$)|^\/(package(-lock)?\.json|\.env.*|\.gitignore)$/i.test(req.path)) {
    return res.status(404).sendFile(path.join(__dirname, '..', '404.html'));
  }
  next();
});

// Liste blanche : seules ces extensions peuvent être servies (bloque .md, .toml, .lock, .json,
// scripts, sauvegardes…) même si un fichier de ce type se retrouvait un jour à la racine.
const PUBLIC_EXT = /\.(html|css|js|webp|jpe?g|png|gif|svg|ico|woff2?|ttf|txt|xml|mp4|webm|webmanifest)$/i;
app.use((req, res, next) => {
  const ext = path.extname(req.path);
  if (ext && !PUBLIC_EXT.test(ext)) return res.status(404).sendFile(path.join(__dirname, '..', '404.html'));
  next();
});

// security.txt (RFC 9116) : où signaler une faille
const SECURITY_TXT = [
  'Contact: mailto:reynov.lyon@gmail.com',
  'Expires: 2027-10-18T00:00:00.000Z',
  'Preferred-Languages: fr, en',
  'Canonical: https://www.reynov-jantes.fr/.well-known/security.txt',
].join('\n') + '\n';
app.get(['/.well-known/security.txt', '/security.txt'], (_req, res) => {
  res.type('text/plain; charset=utf-8').send(SECURITY_TXT);
});

const ONE_YEAR = 365 * 24 * 60 * 60;
app.use(express.static(path.join(__dirname, '..'), {
  setHeaders: (res, filePath) => {
    if (filePath.includes(`${path.sep}admin${path.sep}`)) {
      res.setHeader('Cache-Control', 'no-store');
    } else if (filePath.endsWith('.html')) {
      // Revalidation à chaque visite (ETag) : toujours à jour, mais 304 rapide et navigation « retour » instantanée
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
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
function sanitize(str, { multiline = false } = {}) {
  if (typeof str !== 'string') return '';
  str = str.replace(/\r\n?/g, '\n');
  str = multiline ? str.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ') : str.replace(/[\u0000-\u001F\u007F]/g, ' ');
  return str.trim()
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
    REYNOV · 47 chemin du Pras, 69350 Lyon · <a href="https://reynov-jantes.fr" style="color:#aaa;">reynov-jantes.fr</a>
  </div>
</div>
</body></html>`;
}

// ── CRM — auth middleware ─────────────────────────────────────
const CRM_PASSWORD = process.env.CRM_PASSWORD;
if (!CRM_PASSWORD) console.warn('⚠️ CRM_PASSWORD absent : le CRM est verrouillé (aucun accès).');
else if (CRM_PASSWORD.length < 12) console.warn('⚠️ CRM_PASSWORD trop court : utilisez au moins 12 caractères.');
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function crmAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const key  = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-crm-key'] || '';
  if (!CRM_PASSWORD || !safeEqual(key, CRM_PASSWORD)) return res.status(401).json({ ok: false, error: 'Non autorisé' });
  next();
}
// Anti brute-force : 20 tentatives ratées par 15 min et par IP (les connexions réussies ne comptent pas)
const crmLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Trop de tentatives. Réessayez dans 15 minutes.' } });

app.use('/api/crm', crmLimiter, express.json({ limit: '100kb' }), crmAuth);

// Export complet (sauvegarde manuelle) : GET /api/crm/export
app.get('/api/crm/export', (_req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="reynov-crm-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ ok: true, exported_at: new Date().toISOString(), data: db.exportAll() });
});

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

// ── Garde-fous du formulaire devis ────────────────────────────
// Signature réelle du fichier (le type MIME envoyé par le navigateur est falsifiable)
function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.slice(4, 8).toString('latin1') === 'ftyp' && /^(heic|heix|hevc|heim|heis|mif1|msf1)/.test(buf.slice(8, 12).toString('latin1'))) return 'image/heic';
  return null;
}
const emailHits = new Map();   // adresse -> horodatages (24 h)
function emailBudgetOk(email) {
  const k = String(email).toLowerCase(), now = Date.now();
  const hits = (emailHits.get(k) || []).filter(t => now - t < 86400000);
  if (hits.length >= 3) { emailHits.set(k, hits); return false; }
  hits.push(now); emailHits.set(k, hits);
  if (emailHits.size > 5000) for (const [a, h] of emailHits) if (!h.some(t => now - t < 86400000)) emailHits.delete(a);
  return true;
}
let devisDay = '', devisCount = 0;
function devisBudgetOk() {   // 150 demandes par jour maximum, tous visiteurs confondus
  const day = new Date().toISOString().slice(0, 10);
  if (day !== devisDay) { devisDay = day; devisCount = 0; }
  if (devisCount >= 150) return false;
  devisCount++; return true;
}

// ── POST /api/devis ───────────────────────────────────────────
app.post('/api/devis', devisLimiter, (req, res, next) => {
  upload.array('photos', 8)(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'   ? 'Une photo dépasse 8 Mo. Réduisez-la ou envoyez-la ensuite sur WhatsApp.'
                : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Maximum 8 photos par demande.'
                : 'Fichier invalide (photos JPG, PNG, WebP ou HEIC uniquement).';
      return res.status(400).json({ ok: false, error: msg });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('📩 Devis reçu');
    const b = req.body || {};

    // Honeypot anti-spam
    if (b.website) {
      return res.status(400).json({ ok: false, error: 'Requête invalide.' });
    }
    // Piège temporel : un humain met plus de 3 s à remplir le parcours (les robots envoient tout de suite)
    const t0 = Number(b._t);
    if (t0 && Date.now() - t0 < 3000) {
      return res.status(400).json({ ok: false, error: 'Requête invalide.' });
    }
    // Plafond global (protège le quota d'envoi Gmail et ta boîte contre les inondations)
    if (!devisBudgetOk()) {
      return res.status(429).json({ ok: false, error: 'Service momentanément saturé. Appelez le 06 61 45 35 27.' });
    }

    // Validation email basique
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!b.email || typeof b.email !== 'string' || b.email.length > 200 || !emailRe.test(b.email)) {
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
      description:    sanitize(b.description, { multiline: true }),
      source:         sanitize(b.source),
      prenom:         sanitize(b.prenom),
      nom:            sanitize(b.nom),
      email:          b.email.trim().slice(0, 200),
      tel:            sanitize(b.tel),
    };

    // Une même adresse ne peut pas recevoir plus de 3 accusés de réception par jour (anti « e-mail bombing » d'un tiers)
    if (!emailBudgetOk(d.email)) {
      return res.status(429).json({ ok: false, error: 'Une demande a déjà été reçue pour cette adresse. Appelez-nous au 06 61 45 35 27.' });
    }

    // Photos : vraies images uniquement (signature du fichier), nom de fichier assaini, 20 Mo au total
    const files = req.files || [];
    const total = files.reduce((n, f) => n + f.size, 0);
    if (total > MAX_TOTAL) {
      return res.status(400).json({ ok: false, error: 'Photos trop lourdes au total (20 Mo max). Envoyez-en moins ou réduisez-les.' });
    }
    const attachments = [];
    for (const f of files) {
      const type = sniffImage(f.buffer);
      if (!type) continue;   // fichier déguisé : ignoré
      const base = path.basename(String(f.originalname || 'photo')).replace(/[^\w.\- ]+/g, '_').slice(0, 60) || 'photo';
      attachments.push({ filename: base, content: f.buffer, contentType: type });
    }

    console.log(`📎 ${attachments.length} photo(s) jointe(s)`);

    // ── 1) Enregistrement de la demande EN PREMIER (CRM) ───────
    // Une panne Gmail ne doit plus jamais faire perdre un client.
    let saved = false;
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
        statut: 'devis_envoye', montant: null, notes: d.source ? `Source : ${d.source}` : '',
      });
      saved = true;
      console.log('✅ CRM mis à jour');
    } catch (e) {
      console.error('⚠️ CRM save error:', e.message);
    }

    // ── 2) E-mail de notification pour REYNOV ──────────────────
    let ownerSent = false;
    try {
      await sendEmail({
        from:        `"REYNOV Site" <${GMAIL_USER}>`,
        to:          GMAIL_USER,
        subject:     `Nouveau devis - ${d.prenom} ${d.nom}`,
        html:        ownerEmail(d),
        attachments,
      });
      ownerSent = true;
      console.log('✅ Mail owner envoyé');
    } catch (e) {
      console.error('❌ Mail owner NON envoyé (demande', saved ? 'sauvegardée dans le CRM' : 'NON sauvegardée', '):', e.message);
    }

    // ── 3) Accusé de réception client (ne bloque jamais la demande) ──
    try {
      await sendEmail({
        from:    `"REYNOV" <${GMAIL_USER}>`,
        to:      d.email,
        subject: 'Votre demande de devis REYNOV a bien été reçue',
        html:    clientEmail(d),
      });
      console.log('✅ Mail client envoyé');
    } catch (e) {
      console.error('⚠️ Mail client non envoyé:', e.message);
    }

    // Seul cas d'erreur pour le visiteur : la demande n'est ni sauvegardée ni envoyée.
    if (!saved && !ownerSent) throw new Error('Demande ni enregistrée ni envoyée');

    res.json({ ok: true });

  } catch (err) {
    console.error('❌ Erreur envoi mail:', err.message, JSON.stringify(err.response?.data || ''));
    res.status(500).json({ ok: false, error: 'Erreur serveur. Appelez le 06 61 45 35 27.' });
  }
});

// ── Fallback 404 ───────────────────────────────────────────────
// N'importe quelle URL inconnue (fautes de frappe, vieux liens, robots
// qui empilent des segments de chemin relatifs) doit renvoyer un vrai
// 404, pas l'accueil — sinon Google explore un espace infini d'URLs
// bidon qui se déclarent toutes "dupliquées" de la page d'accueil.
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', '404.html'));
});

app.use((err, _req, res, next) => {
  console.error('💥', err && err.message);
  if (res.headersSent) return next(err);
  res.status(err && err.status ? err.status : 500).json({ ok: false, error: 'Erreur serveur.' });
});

process.on('uncaughtException',  err => console.error('💥 uncaughtException:', err.message));
process.on('unhandledRejection', err => console.error('💥 unhandledRejection:', err));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 REYNOV server démarré sur le port ${PORT}`);
});
