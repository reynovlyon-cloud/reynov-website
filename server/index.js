const express     = require('express');
const compression = require('compression');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const multer      = require('multer');
const path        = require('path');
const mailtpl     = require('./mailtpl');
const fs          = require('fs');
const crypto      = require('crypto');
const db          = require('./db');
const triage      = require('./triage');

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
      imgSrc:      ["'self'", 'data:', 'blob:', 'https:'],
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
  // Micro autorisé uniquement dans l'administration (dictée des messages) ; fermé partout ailleurs
  const mic = _req.path.startsWith('/admin') ? 'microphone=(self)' : 'microphone=()';
  res.setHeader('Permissions-Policy', `camera=(), ${mic}, geolocation=(), payment=(), usb=(), interest-cohort=()`);
  next();
});

// ── Zone d'administration : page jamais indexée ni mise en cache, jamais intégrable dans un cadre.
app.use('/admin', (_req, res, next) => {
  const csp = res.getHeader('Content-Security-Policy');
  if (csp) {
    res.setHeader('Content-Security-Policy', String(csp).replace("frame-ancestors 'self'", "frame-ancestors 'none'"));
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

// ── /index.html et /dossier/index.html -> adresse propre (/ et /dossier/) ──
app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && /\/index\.html$/.test(req.path)) {
    return res.redirect(301, req.originalUrl.replace(/index\.html(?=\?|$)/, ''));
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
  '/blog/epoxy-ou-peinture-pistolet-jante-difference-lyon.html': '/blog/peinture-epoxy-jantes-haut-de-gamme-collection.html',
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
// Jeton séparé, en lecture seule, pour la synchronisation de la boîte (facultatif : sinon on réutilise le jeton d'envoi)
const GMAIL_READ_TOKEN    = process.env.GMAIL_READ_REFRESH_TOKEN;
// Jeton Google Agenda (droit « calendar »), pour synchroniser le planning du CRM
const GOOGLE_CAL_TOKEN   = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

console.log('ENV CHECK — GMAIL_USER:', !!GMAIL_USER,
  '| CLIENT_ID:', !!GMAIL_CLIENT_ID,
  '| CLIENT_SECRET:', !!GMAIL_CLIENT_SECRET,
  '| REFRESH_TOKEN:', !!GMAIL_REFRESH_TOKEN);

async function getAccessToken(refreshToken = GMAIL_REFRESH_TOKEN) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function sendEmail({ from, to, subject, html, attachments = [], origin = '' }) {
  const accessToken = await getAccessToken();
  // X-Reynov-Origin : permet à la synchronisation Gmail de ne pas confondre nos envois automatiques avec une vraie réponse
  const tag = origin ? [`X-Reynov-Origin: ${origin}`] : [];

  let rawParts;
  if (attachments.length === 0) {
    rawParts = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      ...tag,
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
      ...tag,
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
  const F = mailtpl.FONT;
  const row = (label, val) => val
    ? `<tr>
        <td style="padding:9px 0;color:#7b7b84;font-family:${F};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;padding-right:24px;vertical-align:top;border-top:1px solid #eeece7;">${label}</td>
        <td style="padding:9px 0;color:#0b0b0c;font-family:${F};font-size:14px;font-weight:600;border-top:1px solid #eeece7;">${val}</td>
       </tr>`
    : '';
  const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nouveau devis</title></head>
<body style="margin:0;padding:0;background:#ecebe7;font-family:${F};">
<div style="max-width:640px;margin:28px auto;background:#fff;border-radius:20px;overflow:hidden;">
  <div style="background:#0b0b0c;padding:26px 40px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:16px;"><img src="${mailtpl.LOGO}" width="44" height="44" alt="REYNOV" style="display:block;border:0;"></td>
      <td><div style="color:#fff;font-family:${F};font-size:15px;font-weight:700;letter-spacing:6px;">REYNOV</div><div style="color:#9a9aa2;font-family:${F};font-size:11px;letter-spacing:2.5px;text-transform:uppercase;margin-top:4px;">Nouveau devis reçu</div></td>
    </tr></table>
  </div>
  <div style="padding:34px 40px 30px;">
    <h2 style="margin:0 0 4px;font-family:${F};font-size:22px;letter-spacing:-.3px;color:#0b0b0c;">Demande de ${d.prenom} ${d.nom}</h2>
    <p style="margin:0 0 22px;color:#7b7b84;font-family:${F};font-size:12px;">${date}</p>

    <div style="background:#f6f4ef;border-radius:16px;padding:20px 24px;margin-bottom:26px;">
      <p style="margin:0 0 8px;font-family:${F};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7b7b84;">Contact</p>
      <p style="margin:0 0 4px;font-family:${F};font-size:16px;font-weight:700;color:#0b0b0c;">${d.prenom} ${d.nom}</p>
      <p style="margin:0 0 2px;font-family:${F};font-size:13.5px;color:#34343a;">${d.email}</p>
      <p style="margin:0 0 2px;font-family:${F};font-size:13.5px;color:#34343a;">${d.tel}</p>
      ${d.adresse_client ? `<p style="margin:4px 0 0;font-family:${F};font-size:13.5px;color:#34343a;">Adresse : ${d.adresse_client}</p>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;">
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
    <div style="margin-top:24px;padding:18px 22px;background:#f6f4ef;border-left:3px solid #0b0b0c;border-radius:0 12px 12px 0;">
      <p style="margin:0 0 6px;font-family:${F};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7b7b84;">Message</p>
      <p style="margin:0;font-family:${F};font-size:14px;color:#34343a;line-height:1.7;">${d.description}</p>
    </div>` : ''}

    <p style="margin:28px 0 0;"><a href="https://www.reynov-jantes.fr/admin/crm.html#/leads" style="display:inline-block;background:#0b0b0c;color:#fff;padding:13px 24px;border-radius:999px;font-family:${F};text-decoration:none;font-size:13.5px;font-weight:600;">Ouvrir dans le CRM</a></p>
  </div>
  <div style="background:#0b0b0c;padding:16px 40px;font-family:${F};font-size:11px;color:#9a9aa2;">
    REYNOV · reynov.lyon@gmail.com · 06 61 45 35 27
  </div>
</div>
</body></html>`;
}

// ── Email : client ────────────────────────────────────────────
function clientEmail(d) { return mailtpl.quoteAck(d); }

// ── CRM — auth middleware ─────────────────────────────────────
const CRM_PASSWORD = process.env.CRM_PASSWORD;
if (!CRM_PASSWORD) console.warn('⚠️ CRM_PASSWORD absent : le CRM est verrouillé (aucun accès).');
else if (CRM_PASSWORD.length < 12) console.warn('⚠️ CRM_PASSWORD trop court : utilisez au moins 12 caractères.');
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
// Sessions : jeton signé (HMAC) lié à un compte ; le mot de passe administrateur brut reste accepté (scripts, rétrocompatibilité).
const MASTER = { id: 0, name: 'Administrateur', role: 'admin' };
const SESSION_KEY = crypto.createHash('sha256').update('reynov-crm-session|' + (process.env.CRM_PASSWORD || '')).digest();
const sessionSig = (body) => crypto.createHmac('sha256', SESSION_KEY).update(body).digest('hex').slice(0, 40);
function signSession(uid) { const body = 'u.' + uid + '.' + (Date.now() + 12 * 3600 * 1000); return body + '.' + sessionSig(body); }
function userFromToken(tok) {
  if (!CRM_PASSWORD || !tok) return null;
  if (safeEqual(tok, CRM_PASSWORD)) return MASTER;
  const m = /^(u\.(\d+)\.(\d+))\.([0-9a-f]{40})$/.exec(tok);
  if (!m || !safeEqual(m[4], sessionSig(m[1])) || Number(m[3]) < Date.now()) return null;
  if (Number(m[2]) === 0) return MASTER;
  const u = db.userById(m[2]);
  return u && u.active !== false ? { id: u.id, name: u.name, role: u.role === 'admin' ? 'admin' : 'employe' } : null;
}
function crmAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const key  = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-crm-key'] || '';
  const user = userFromToken(key);
  if (!user) return res.status(401).json({ ok: false, error: 'Non autorisé' });
  req.user = user;
  next();
}
// Droits : un « employé » ne voit ni les chiffres d'affaires, ni les devis, ni les réglages, et ne supprime rien (sauf ses rendez-vous et photos).
function roleGuard(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  const blocked = /^\/(stats|export|diag|users(?!\/basic)|mail\/|calendar\/(list|select|sync)|quotes|leads\/import)/.test(req.path)
    || (req.method === 'DELETE' && !/^\/(events|photos)\//.test(req.path));
  if (blocked) return res.status(403).json({ ok: false, error: 'Réservé à l\'administrateur.' });
  next();
}
const hashPass = (pw) => { const salt = crypto.randomBytes(16).toString('hex'); return salt + '$' + crypto.scryptSync(String(pw), salt, 64).toString('hex'); };
const checkPass = (pw, stored) => { const [salt, h] = String(stored || '').split('$'); if (!salt || !h) return false; try { return crypto.timingSafeEqual(Buffer.from(h, 'hex'), crypto.scryptSync(String(pw), salt, 64)); } catch (e) { return false; } };
// Anti brute-force : 20 tentatives ratées par 15 min et par IP (les connexions réussies ne comptent pas)
const crmLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Trop de tentatives. Réessayez dans 15 minutes.' } });

// ── Import d'anciennes demandes (fichier ou synchronisation Gmail) ──
// Renvoie 'added' | 'duplicate' | 'skipped'.
function importLeadItem(it, status, note) {
  try {
    const email = cleanLine(it.email, 200);
    const tel = cleanLine(it.tel, 40);
    if ((!email || !EMAIL_RE.test(email)) && !tel) return 'skipped';
    const created = it.created_at && !isNaN(Date.parse(it.created_at)) ? new Date(it.created_at).toISOString() : new Date().toISOString();
    if (db.leadExists(email, created)) return 'duplicate';
    const f = it.form || {};
    const lead = db.createLead({
      created_at: created, updated_at: created, status,
      source: cleanLine(it.source || 'devis', 40) || 'devis',
      prenom: cleanLine(it.prenom, 80), nom: cleanLine(it.nom, 80), email: EMAIL_RE.test(email) ? email : '', tel,
      ville: cleanLine(it.ville, 120), adresse: cleanLine(it.adresse, 200), sujet: cleanLine(it.sujet, 120), message: clean(it.message, 4000),
      form: {
        prestation: cleanLine(f.prestation, 100), problemes: cleanLine(f.problemes, 200), nb_jantes: cleanLine(f.nb_jantes, 10),
        taille: cleanLine(f.taille, 40), marque: cleanLine(f.marque, 60), modele: cleanLine(f.modele, 60), finition: cleanLine(f.finition, 60),
        mode: cleanLine(f.mode, 60), delai: cleanLine(f.delai, 60), photos: Number(f.photos) || 0,
      },
      notes: note,
      events: [{ ts: created, type: 'created', text: 'Demande reçue (' + note.toLowerCase().replace(/\.$/, '') + ')' }],
    });
    const tri = triage.withDrafts(lead, triage.analyzeRules(lead));
    db.updateLead(lead.id, { triage: tri, created_at: created });
    ensureClient(db.leadById(lead.id));
    return 'added';
  } catch (e) { return 'skipped'; }
}
// Déclaré AVANT le montage général : authentification d'abord, puis lecture d'un corps plus volumineux.
app.post('/api/crm/leads/import', crmLimiter, crmAuth, express.json({ limit: '8mb' }), (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Réservé à l\'administrateur.' });
  const b = req.body || {};
  const items = Array.isArray(b.leads) ? b.leads : (Array.isArray(b) ? b : null);
  if (!items || !items.length) return res.status(400).json({ ok: false, error: 'Aucune demande dans le fichier.' });
  if (items.length > 2000) return res.status(400).json({ ok: false, error: 'Maximum 2000 demandes par import.' });
  const status = db.LEAD_STATUS.includes(b.status) ? b.status : 'a_rappeler';
  const c = { added: 0, duplicate: 0, skipped: 0 };
  for (const it of items) c[importLeadItem(it, status, 'Ancienne demande importée de vos e-mails.')]++;
  console.log(`📥 Import CRM : ${c.added} ajoutées, ${c.duplicate} déjà présentes, ${c.skipped} ignorées`);
  res.json({ ok: true, added: c.added, duplicates: c.duplicate, skipped: c.skipped });
});

const diag = require('./diag').create({ dir: db.DATA_DIR });
const mailsync = require('./mailsync').create({
  db, getAccessToken: () => getAccessToken(GMAIL_READ_TOKEN || GMAIL_REFRESH_TOKEN), owner: GMAIL_USER, importLeadItem, photoSaver: (leadId, buf, meta) => saveLeadPhoto(leadId, buf, meta),
  enabled: () => !!(GMAIL_USER && GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && (GMAIL_READ_TOKEN || GMAIL_REFRESH_TOKEN)) && process.env.CRM_TEST_MODE !== '1' && process.env.MAIL_SYNC !== '0',
});

const calsync = require('./calsync').create({
  db, getAccessToken: () => getAccessToken(GOOGLE_CAL_TOKEN),
  enabled: () => !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GOOGLE_CAL_TOKEN) && process.env.CRM_TEST_MODE !== '1' && process.env.CAL_SYNC !== '0',
});

// Connexion : identifiant vide (ou « admin ») + mot de passe administrateur, ou identifiant + mot de passe d'un membre de l'équipe
app.post('/api/crm/login', crmLimiter, express.json({ limit: '10kb' }), (req, res) => {
  const b = req.body || {}; const name = String(b.username || '').trim().toLowerCase(); const pw = String(b.password || '');
  const fail = () => res.status(401).json({ ok: false, error: 'Identifiant ou mot de passe incorrect' });
  if (!pw) return fail();
  if (!name || name === 'admin') {
    if (!CRM_PASSWORD || !safeEqual(pw, CRM_PASSWORD)) return fail();
    return res.json({ ok: true, token: signSession(0), user: MASTER });
  }
  const u = db.userByUsername(name);
  if (!u || u.active === false || !checkPass(pw, u.pass)) return fail();
  res.json({ ok: true, token: signSession(u.id), user: { id: u.id, name: u.name, role: u.role === 'admin' ? 'admin' : 'employe' } });
});

app.use('/api/crm', crmLimiter, express.json({ limit: '100kb' }), crmAuth, roleGuard);

// ── CRM : planning (rendez-vous), synchronisé avec Google Agenda ──
function eventFields(b, cur) {
  const f = {};
  const all = b.all_day !== undefined ? !!b.all_day : !!(cur && cur.all_day);
  if (b.title !== undefined) f.title = cleanLine(b.title, 200);
  if (b.location !== undefined) f.location = cleanLine(b.location, 200);
  if (b.notes !== undefined) f.notes = clean(b.notes, 2000);
  if (b.lead_id !== undefined) f.lead_id = b.lead_id && db.leadById(b.lead_id) ? Number(b.lead_id) : null;
  if (b.assigned_to !== undefined) f.assigned_to = assignee(b.assigned_to);
  const day = (v) => /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null;
  const iso = (v) => { const t = Date.parse(v); return isNaN(t) ? null : new Date(t).toISOString(); };
  if (b.start !== undefined || b.end !== undefined || b.all_day !== undefined) {
    const s0 = b.start !== undefined ? b.start : cur && cur.start, e0 = b.end !== undefined ? b.end : (cur && cur.end) || s0;
    const s = all ? day(s0) : iso(s0), e = all ? day(e0) : iso(e0);
    if (!s) return { error: 'Date de début invalide.' };
    f.all_day = all; f.start = s; f.end = e && e >= s ? e : (all ? s : new Date(Date.parse(s) + 3600000).toISOString());
  }
  return { f };
}
app.get('/api/crm/events', (req, res) => res.json({ ok: true, data: db.eventsList({ from: req.query.from, to: req.query.to }) }));
app.post('/api/crm/events', (req, res) => {
  const b = req.body || {}; const r = eventFields({ title: 'Rendez-vous', ...b }, null);
  if (r.error || !r.f.start) return res.status(400).json({ ok: false, error: r.error || 'Date de début requise.' });
  if (!r.f.title) r.f.title = 'Rendez-vous';
  const e = db.createEvent(r.f);
  if (e.lead_id) {
    const l = db.leadById(e.lead_id);
    if (l && ['nouveau', 'a_rappeler', 'contacte'].includes(l.status)) db.updateLead(l.id, { status: 'rdv' });
    db.addLeadEvent(e.lead_id, 'status', 'Rendez-vous fixé : ' + e.title + ' (' + (e.all_day ? e.start : new Date(e.start).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + ')');
  }
  res.json({ ok: true, data: e });
});
app.put('/api/crm/events/:id', (req, res) => {
  const cur = db.eventById(req.params.id); if (!cur) return res.status(404).json({ ok: false, error: 'Introuvable' });
  const r = eventFields(req.body || {}, cur); if (r.error) return res.status(400).json({ ok: false, error: r.error });
  res.json({ ok: true, data: db.updateEvent(cur.id, r.f) });
});
app.delete('/api/crm/events/:id', (req, res) => res.json({ ok: db.deleteEvent(req.params.id) }));
app.get('/api/crm/diag', (_req, res) => res.json({ ok: true, data: diag.snapshot() }));
app.get('/api/crm/calendar/status', (_req, res) => res.json({ ok: true, data: calsync.status() }));
app.post('/api/crm/calendar/sync', (_req, res) => { calsync.tick(true); res.json({ ok: true, data: calsync.status() }); });
app.get('/api/crm/calendar/list', async (_req, res) => {
  try { res.json({ ok: true, data: await calsync.calendars() }); } catch (e) { res.status(502).json({ ok: false, error: 'Lecture des agendas impossible : ' + e.message.slice(0, 120) }); }
});
app.post('/api/crm/calendar/select', async (req, res) => {
  try { res.json({ ok: true, data: await calsync.select(cleanLine((req.body || {}).id, 200)) }); } catch (e) { res.status(e.status === 400 ? 400 : 502).json({ ok: false, error: e.message.slice(0, 150) }); }
});

// ── CRM : devis ──
const QUOTE_LABEL = { brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé' };
const eur = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
function quoteLinesFromLead(l) {
  const t = l.triage || {}, cats = t.categories || [], f = l.form || {};
  const n = Number(t.wheels) || Number(String(f.nb_jantes || '').replace(/\D/g, '')) || 0, qty = n >= 1 && n <= 8 ? n : 1;
  const lines = [];
  if (cats.includes('fissure')) lines.push({ label: 'Soudure de jante fissurée (TIG) et reprise', qty, unit_ht: triage.PRIX.fissure });
  if (cats.includes('devoilage')) lines.push({ label: 'Dévoilage de jante', qty, unit_ht: triage.PRIX.devoilage });
  const perso = cats.filter(c => ['biton', 'diamantee', 'epoxy', 'perso'].includes(c));
  if (cats.some(c => ['renovation', 'monochrome'].includes(c)) || perso.length || !lines.length) lines.push({ label: 'Rénovation de jante : décapage, préparation, peinture et vernis', qty, unit_ht: triage.PRIX.renovation });
  if (perso.length) lines.push({ label: 'Option finition personnalisée (' + perso.map(c => triage.CATEGORIES[c].label.toLowerCase()).join(', ') + ') : à chiffrer', qty: 1, unit_ht: 0 });
  return lines;
}
function quoteNotesFor(l) {
  const cats = ((l.triage || {}).categories) || [];
  const delai = cats.includes('epoxy') ? '3 jours' : (cats.some(c => ['biton', 'diamantee', 'perso'].includes(c)) ? '2 à 4 jours (jusqu\'à 5 pour une finition poli diamant ou bi-ton)' : '24 à 48 h par jante');
  return 'Délai indicatif : ' + delai + ' en atelier à La Mulatière.\nGarantie 30 jours sur la prestation.\nDevis valable 30 jours. Règlement à la livraison.';
}
function cleanLines(raw) {
  if (!Array.isArray(raw)) return null;
  return raw.slice(0, 30).map(x => ({ label: cleanLine(x && x.label, 200), qty: Math.min(100, Math.max(0, Number(x && x.qty) || 0)), unit_ht: Math.min(100000, Math.max(0, Math.round((Number(x && x.unit_ht) || 0) * 100) / 100)) })).filter(x => x.label);
}
function quoteHtml(q, l) {
  const M = mailtpl, F = M.FONT;
  const t = db.quoteTotals(q);
  const name = l ? [l.prenom, l.nom].filter(Boolean).join(' ') : '';
  const date = (iso) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'long', year: 'numeric' });
  const th = (txt, al) => `<th align="${al}" style="white-space:nowrap;padding:10px 8px;font-family:${F};font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${M.MUTED};border-bottom:2px solid ${M.INK};">${txt}</th>`;
  const rows = (q.lines || []).map(x => `<tr><td style="padding:14px 8px;border-bottom:1px solid ${M.LINE};font-family:${F};font-size:14px;color:${M.INK};font-weight:600;">${escHtml(x.label)}</td><td align="center" style="padding:14px 8px;border-bottom:1px solid ${M.LINE};font-family:${F};font-size:14px;color:#34343a;">${escHtml(x.qty)}</td><td align="right" style="padding:14px 8px;border-bottom:1px solid ${M.LINE};font-family:${F};font-size:14px;color:#34343a;white-space:nowrap;">${x.unit_ht ? eur(x.unit_ht) : 'sur devis'}</td><td align="right" style="padding:14px 8px;border-bottom:1px solid ${M.LINE};font-family:${F};font-size:14px;color:${M.INK};font-weight:600;white-space:nowrap;">${x.unit_ht ? eur(x.qty * x.unit_ht) : '—'}</td></tr>`).join('');
  const sub = encodeURIComponent('Devis ' + q.number + ' accepté'), mailBody = encodeURIComponent('Bonjour, j\'accepte le devis ' + q.number + '. Merci de me proposer une date d\'intervention.');
  const body = `${M.eyebrow('Votre devis')}${M.h1('Devis ' + escHtml(q.number))}
    ${M.para('Émis le ' + date(q.created_at) + ' · valable jusqu\'au ' + date(q.valid_until + 'T12:00:00Z'), 'color:' + M.MUTED + ';margin-bottom:22px;')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:26px;background:${M.SOFT};border-radius:16px;"><tr>
      <td class="stack" valign="top" style="padding:18px 22px;font-family:${F};font-size:13.5px;line-height:1.7;color:#34343a;"><div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${M.MUTED};margin-bottom:4px;">Destinataire</div><strong style="color:${M.INK};font-size:15px;">${escHtml(name) || 'Client'}</strong><br>${l && l.adresse ? escHtml(l.adresse) + '<br>' : ''}${l && l.ville ? escHtml(l.ville) + '<br>' : ''}${l && l.email ? escHtml(l.email) + '<br>' : ''}${l && l.tel ? escHtml(l.tel) : ''}</td>
      <td class="stack" valign="top" style="padding:18px 22px;font-family:${F};font-size:13.5px;line-height:1.7;color:#34343a;"><div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${M.MUTED};margin-bottom:4px;">Prestataire</div><strong style="color:${M.INK};font-size:15px;">REYNOV</strong><br>47 chemin du Pras<br>69350 La Mulatière<br>06 61 45 35 27</td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><thead><tr>${th('Prestation', 'left')}${th('Qté', 'center')}${th('Prix HT', 'right')}${th('Total HT', 'right')}</tr></thead><tbody>${rows || `<tr><td colspan="4" style="padding:16px;color:#888;font-family:${F};">Aucune ligne</td></tr>`}</tbody></table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="margin:18px 0 0;"><tr><td style="padding:5px 22px 5px 0;font-family:${F};font-size:13.5px;color:${M.MUTED};">Total HT</td><td align="right" style="padding:5px 0;font-family:${F};font-size:14px;color:#34343a;">${eur(t.ht)}</td></tr><tr><td style="padding:5px 22px 5px 0;font-family:${F};font-size:13.5px;color:${M.MUTED};">TVA ${t.rate} %</td><td align="right" style="padding:5px 0;font-family:${F};font-size:14px;color:#34343a;">${eur(t.tva)}</td></tr><tr><td colspan="2" style="padding-top:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${M.INK}" style="border-radius:12px;padding:12px 18px;font-family:${F};font-size:13px;color:#cfcfd6;">Total TTC</td><td bgcolor="${M.INK}" align="right" style="border-radius:12px;padding:12px 18px;font-family:${F};font-size:19px;font-weight:700;color:#ffffff;white-space:nowrap;">${eur(t.ttc)}</td></tr></table></td></tr></table>
    <div style="clear:both;"></div>
    ${q.notes ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:34px;background:${M.SOFT};border-radius:16px;"><tr><td style="padding:18px 22px;font-family:${F};font-size:13px;color:#34343a;line-height:1.8;white-space:pre-wrap;"><div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${M.MUTED};margin-bottom:6px;">Conditions</div>${escHtml(q.notes)}</td></tr></table>` : '<div style="height:30px;"></div>'}
    ${M.para('Pour accepter ce devis, répondez simplement à cet e-mail ou utilisez le bouton ci-dessous.', 'margin:26px 0 14px;')}
    ${M.button('Accepter ce devis', 'mailto:reynov.lyon@gmail.com?subject=' + sub + '&body=' + mailBody)}${M.button('Une question ? WhatsApp', 'https://wa.me/33661453527', false)}
    ${M.signature()}`;
  return M.shell({ title: 'Devis ' + q.number + ' — REYNOV', preheader: 'Votre devis ' + q.number + ' : ' + eur(t.ttc) + ' TTC, valable 30 jours.', body, note: 'Vous recevez ce devis suite à votre demande auprès de REYNOV.' });
}
const fullQuote = (q) => ({ ...q, totals: db.quoteTotals(q) });
app.get('/api/crm/quotes', (req, res) => res.json({ ok: true, data: db.quotesList({ lead_id: req.query.lead_id }) }));
app.get('/api/crm/quotes/:id', (req, res) => { const q = db.quoteById(req.params.id); if (!q) return res.status(404).json({ ok: false, error: 'Introuvable' }); res.json({ ok: true, data: fullQuote(q) }); });
app.post('/api/crm/quotes', (req, res) => {
  const b = req.body || {}; const l = b.lead_id ? db.leadById(b.lead_id) : null;
  if (b.lead_id && !l) return res.status(404).json({ ok: false, error: 'Lead introuvable' });
  const lines = cleanLines(b.lines) || (l ? quoteLinesFromLead(l) : []);
  const q = db.createQuote({ lead_id: l ? l.id : null, client_id: l ? ensureClient(l) : null, lines, notes: l ? quoteNotesFor(l) : 'Devis valable 30 jours. Garantie 30 jours sur la prestation.' });
  if (l) db.addLeadEvent(l.id, 'status', 'Devis ' + q.number + ' créé');
  res.json({ ok: true, data: fullQuote(q) });
});
app.put('/api/crm/quotes/:id', (req, res) => {
  const cur = db.quoteById(req.params.id); if (!cur) return res.status(404).json({ ok: false, error: 'Introuvable' });
  const b = req.body || {}; const patch = {};
  if (b.lines !== undefined) { const ln = cleanLines(b.lines); if (!ln) return res.status(400).json({ ok: false, error: 'Lignes invalides.' }); patch.lines = ln; }
  if (b.notes !== undefined) patch.notes = clean(b.notes, 2000);
  if (b.tva_rate !== undefined) patch.tva_rate = [0, 10, 20].includes(Number(b.tva_rate)) ? Number(b.tva_rate) : 20;
  if (b.valid_until !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(b.valid_until)) patch.valid_until = b.valid_until;
  if (b.status !== undefined) patch.status = b.status;
  const was = cur.status; const q = db.updateQuote(cur.id, patch);
  const l = q.lead_id ? db.leadById(q.lead_id) : null;
  if (l && patch.status && patch.status !== was) {
    db.addLeadEvent(l.id, 'status', 'Devis ' + q.number + ' : ' + QUOTE_LABEL[patch.status].toLowerCase());
    if (patch.status === 'accepte') {
      db.updateLead(l.id, { status: 'gagne' });
      const cid = ensureClient(db.leadById(l.id)); const f = l.form || {}; const t = db.quoteTotals(q);
      if (cid) db.createIntervention({ client_id: cid, prestation: (q.lines[0] && q.lines[0].label) || f.prestation || 'Rénovation', nb_jantes: f.nb_jantes || '', marque: f.marque || '', modele: f.modele || '', mode: f.mode || '', montant: t.ttc, statut: 'confirme', notes: 'Devis ' + q.number });
    } else if (patch.status === 'refuse') db.updateLead(l.id, { status: 'perdu' });
  }
  res.json({ ok: true, data: fullQuote(q) });
});
app.delete('/api/crm/quotes/:id', (req, res) => res.json({ ok: db.deleteQuote(req.params.id) }));
app.get('/api/crm/quotes/:id/html', (req, res) => {
  const q = db.quoteById(req.params.id); if (!q) return res.status(404).send('Introuvable');
  res.type('html').send(quoteHtml(q, q.lead_id ? db.leadById(q.lead_id) : null));
});
const quoteSendLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Trop d\'envois. Réessayez plus tard.' } });
app.post('/api/crm/quotes/:id/send', quoteSendLimiter, async (req, res) => {
  const q = db.quoteById(req.params.id); if (!q) return res.status(404).json({ ok: false, error: 'Introuvable' });
  const l = q.lead_id ? db.leadById(q.lead_id) : null;
  if (!l || !l.email || !EMAIL_RE.test(l.email)) return res.status(400).json({ ok: false, error: 'Ce devis n\'est lié à aucun client avec une adresse e-mail valide.' });
  if (!(q.lines || []).length || db.quoteTotals(q).ht <= 0) return res.status(400).json({ ok: false, error: 'Ajoutez au moins une ligne avec un prix avant d\'envoyer.' });
  try {
    if (process.env.CRM_TEST_MODE !== '1') {
      if (!GMAIL_USER) throw new Error('Gmail non configuré sur le serveur');
      await sendEmail({ from: `"REYNOV" <${GMAIL_USER}>`, to: l.email, subject: 'Votre devis REYNOV n° ' + q.number, html: quoteHtml(q, l), origin: 'crm' });
    }
    db.updateQuote(q.id, { status: 'envoye' });
    db.logContact(l.id, 'email', null);
    db.addLeadEvent(l.id, 'reply_sent', 'Devis ' + q.number + ' envoyé par e-mail (' + eur(db.quoteTotals(q).ttc) + ' TTC)');
    res.json({ ok: true, data: fullQuote(db.quoteById(q.id)) });
  } catch (e) { console.error('❌ Envoi devis:', e.message); res.status(502).json({ ok: false, error: 'Envoi impossible : ' + e.message }); }
});

// ── CRM : programme du jour ──
const TZ_PARIS = 'Europe/Paris';
const parisDay = (d) => new Date(d).toLocaleDateString('sv-SE', { timeZone: TZ_PARIS });
const parisTime = (d) => new Date(d).toLocaleTimeString('fr-FR', { timeZone: TZ_PARIS, hour: '2-digit', minute: '2-digit' }).replace(':', ' h ').replace(/ h 00$/, ' h');
function dailyProgram(user) {
  const mine = user && user.role !== 'admin' ? user.id : null;
  const mineOk = (x) => !mine || x.assigned_to == null || x.assigned_to === mine;
  const now = new Date(), today = parisDay(now), tomorrow = parisDay(now.getTime() + 86400000);
  const evs = db.eventsList({ from: new Date(now.getTime() - 2 * 86400000).toISOString(), to: new Date(now.getTime() + 3 * 86400000).toISOString() });
  const covers = (e, day) => e.all_day ? (e.start.slice(0, 10) <= day && (e.end || e.start).slice(0, 10) >= day) : parisDay(e.start) === day;
  const nameOf = (l) => l ? ([l.prenom, l.nom].filter(Boolean).join(' ') || l.email || 'Client') : '';
  const mapEv = (e) => { const l = e.lead_id ? db.leadById(e.lead_id) : null; return { id: e.id, title: e.title, all_day: e.all_day, time: e.all_day ? null : parisTime(e.start), end_time: e.all_day ? null : parisTime(e.end || e.start), location: e.location || '', lead_id: e.lead_id, client: nameOf(l), tel: l ? l.tel : '', maps: e.location ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(e.location) : '' }; };
  const events = evs.filter(e => mineOk(e) && covers(e, today)).map(mapEv);
  const tomorrowN = evs.filter(e => covers(e, tomorrow)).length;
  const L = db.allLeads().filter(mineOk);
  const brief = (l) => { const t = l.triage || {}; return { id: l.id, name: nameOf(l), tel: l.tel, summary: t.summary || '', urgent: t.urgency === 'haute', since_h: Math.round((Date.now() - Date.parse(l.created_at)) / 3600000) }; };
  const toCall = L.filter(l => (l.status === 'nouveau' && !l.contacted) || (l.status === 'a_rappeler' && l.reminder_at && Date.parse(l.reminder_at) <= Date.now()))
    .sort((a, b) => ((b.triage && b.triage.urgency === 'haute') - (a.triage && a.triage.urgency === 'haute')) || a.created_at.localeCompare(b.created_at)).slice(0, 8).map(brief);
  const waiting = L.map(l => ({ l, r: db.replyState(l) })).filter(x => x.r.waiting && !toCall.some(c => c.id === x.l.id) && x.l.status !== 'nouveau')
    .sort((a, b) => Date.parse(a.r.since) - Date.parse(b.r.since));
  const waitingList = waiting.slice(0, 6).map(x => ({ ...brief(x.l), days: Math.max(0, Math.floor((Date.now() - Date.parse(x.r.since)) / 86400000)) }));
  const quotes = mine ? [] : db.quotesList();
  const qFollow = quotes.filter(q => q.status === 'envoye' && Date.now() - Date.parse(q.sent_at) > 3 * 86400000).map(q => ({ id: q.id, number: q.number, client: nameOf(q.lead_id ? db.leadById(q.lead_id) : null), ttc: q.totals.ttc, days: Math.floor((Date.now() - Date.parse(q.sent_at)) / 86400000) }));
  const qDraft = quotes.filter(q => q.status === 'brouillon').length;
  // Texte du programme (règles locales : aucune donnée client n'est envoyée à un service externe)
  const jour = new Date().toLocaleDateString('fr-FR', { timeZone: TZ_PARIS, weekday: 'long', day: 'numeric', month: 'long' });
  const parts = ['Bonjour ! Nous sommes ' + jour + '.'];
  if (events.length) parts.push('Au planning aujourd\'hui : ' + events.map(e => (e.time ? 'à ' + e.time + ' ' : 'toute la journée ') + e.title + (e.location ? ' (' + e.location + ')' : '')).join(' ; ') + '.');
  else parts.push('Aucun rendez-vous au planning aujourd\'hui.');
  if (tomorrowN) parts.push('Demain : ' + tomorrowN + ' rendez-vous.');
  if (toCall.length) parts.push((toCall.length > 1 ? toCall.length + ' demandes à traiter en priorité : ' : 'Une demande à traiter en priorité : ') + toCall.slice(0, 4).map(c => c.name + (c.urgent ? ' (urgent)' : '')).join(', ') + '.');
  else parts.push('Aucune nouvelle demande en attente.');
  if (waiting.length) parts.push(waiting.length + ' client' + (waiting.length > 1 ? 's attendent' : ' attend') + ' une réponse, le plus ancien depuis ' + waitingList[0].days + ' jour' + (waitingList[0].days > 1 ? 's' : '') + '.');
  if (qFollow.length) parts.push(qFollow.length + ' devis envoyé' + (qFollow.length > 1 ? 's' : '') + ' sans réponse depuis plus de 3 jours : ' + qFollow.slice(0, 3).map(q => q.client).join(', ') + '. Pensez à les relancer.');
  if (qDraft) parts.push(qDraft + ' devis en brouillon à terminer.');
  parts.push('Bonne journée !');
  return { date: today, events, tomorrow: tomorrowN, to_call: toCall, waiting: waitingList, waiting_total: waiting.length, quotes_follow: qFollow, quotes_draft: qDraft, brief: parts.join(' ') };
}
app.get('/api/crm/today', (req, res) => res.json({ ok: true, data: dailyProgram(req.user) }));

// ── CRM : équipe ──
app.get('/api/crm/users/basic', (_req, res) => res.json({ ok: true, data: db.usersList().filter(u => u.active !== false).map(u => ({ id: u.id, name: u.name, role: u.role })) }));
app.get('/api/crm/users', (_req, res) => res.json({ ok: true, data: db.usersList() }));
function userBody(b, creating) {
  const name = cleanLine(b.name, 60), username = cleanLine(b.username, 40).toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (creating && (name.length < 2 || username.length < 3)) return { error: 'Nom (2 caractères minimum) et identifiant (3 caractères minimum, lettres/chiffres) requis.' };
  if (b.password !== undefined && b.password !== '' && String(b.password).length < 8) return { error: 'Mot de passe : 8 caractères minimum.' };
  if (creating && !b.password) return { error: 'Mot de passe requis.' };
  return { name, username, role: b.role === 'admin' ? 'admin' : 'employe' };
}
app.post('/api/crm/users', (req, res) => {
  const r = userBody(req.body || {}, true); if (r.error) return res.status(400).json({ ok: false, error: r.error });
  if (r.username === 'admin' || db.userByUsername(r.username)) return res.status(409).json({ ok: false, error: 'Cet identifiant existe déjà.' });
  const u = db.createUser({ name: r.name, username: r.username, role: r.role, pass: hashPass(req.body.password) });
  const { pass, ...pub } = u; res.json({ ok: true, data: pub });
});
app.put('/api/crm/users/:id', (req, res) => {
  const cur = db.userById(req.params.id); if (!cur) return res.status(404).json({ ok: false, error: 'Introuvable' });
  const b = req.body || {}; const r = userBody(b, false); if (r.error) return res.status(400).json({ ok: false, error: r.error });
  const patch = {}; if (b.name !== undefined && r.name) patch.name = r.name; if (b.role !== undefined) patch.role = r.role; if (b.active !== undefined) patch.active = !!b.active;
  if (b.password) patch.pass = hashPass(b.password);
  const u = db.updateUser(cur.id, patch); const { pass, ...pub } = u; res.json({ ok: true, data: pub });
});
app.delete('/api/crm/users/:id', (req, res) => res.json({ ok: db.deleteUser(req.params.id) }));

// ── CRM : photos de chantier (avant / après), stockées sur le volume ──
const PHOTO_DIR = path.join(db.DATA_DIR, 'photos');
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 6 } });
function imageExt(buf) {
  if (buf.length > 12 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  if (buf.length > 12 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}
app.post('/api/crm/interventions/:id/photos', (req, res) => {
  const it = db.interventionById(req.params.id); if (!it) return res.status(404).json({ ok: false, error: 'Chantier introuvable' });
  photoUpload.array('photos', 6)(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'Photo trop lourde (10 Mo maximum).' : 'Envoi impossible.' });
    const files = req.files || []; if (!files.length) return res.status(400).json({ ok: false, error: 'Aucune photo reçue.' });
    if ((it.photos || []).length + files.length > 40) return res.status(400).json({ ok: false, error: 'Maximum 40 photos par chantier.' });
    const kind = ['avant', 'apres', 'autre'].includes(req.body && req.body.kind) ? req.body.kind : 'autre';
    const dir = path.join(PHOTO_DIR, String(it.id)); fs.mkdirSync(dir, { recursive: true });
    let added = 0, refused = 0;
    for (const f of files) {
      const ext = imageExt(f.buffer); if (!ext) { refused++; continue; }
      const name = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
      fs.writeFileSync(path.join(dir, name), f.buffer);
      db.addInterventionPhoto(it.id, { file: name, kind, at: new Date().toISOString(), by: req.user.name });
      added++;
    }
    if (!added) return res.status(400).json({ ok: false, error: 'Format non reconnu : utilisez des photos JPEG, PNG ou WebP.' });
    res.json({ ok: true, added, refused, data: db.interventionById(it.id) });
  });
});
const photoPath = (iid, file) => (/^[0-9]+-[0-9a-f]{8}\.(jpg|png|webp)$/.test(file) && /^\d+$/.test(String(iid))) ? path.join(PHOTO_DIR, String(iid), file) : null;
app.get('/api/crm/photos/:iid/:file', (req, res) => {
  const it = db.interventionById(req.params.iid); const p = photoPath(req.params.iid, req.params.file);
  if (!it || !p || !(it.photos || []).some(x => x.file === req.params.file) || !fs.existsSync(p)) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(p);
});
app.delete('/api/crm/photos/:iid/:file', (req, res) => {
  const p = photoPath(req.params.iid, req.params.file); if (!p) return res.status(400).json({ ok: false, error: 'Photo invalide' });
  const ok = db.removeInterventionPhoto(req.params.iid, req.params.file);
  if (ok) { try { fs.unlinkSync(p); } catch (e) { /* déjà supprimée */ } }
  res.json({ ok });
});

// ── CRM : rentabilité par origine des demandes (administrateur) ──
app.get('/api/crm/stats/sources', (_req, res) => {
  const quotes = db.quotesList(); const out = {}; const since = Date.now() - 30 * 86400000;
  for (const l of db.allLeads()) {
    const k = l.source || 'autre'; const o = out[k] = out[k] || { source: k, leads: 0, leads30: 0, devis: 0, acceptes: 0, gagnes: 0, ca_ttc: 0 };
    o.leads++; if (Date.parse(l.created_at) > since) o.leads30++; if (l.status === 'gagne') o.gagnes++;
    for (const q of quotes.filter(x => x.lead_id === l.id)) { if (q.status !== 'brouillon') o.devis++; if (q.status === 'accepte') { o.acceptes++; o.ca_ttc += q.totals.ttc; } }
  }
  const rows = Object.values(out).map(o => ({ ...o, conversion: o.leads ? Math.round(o.gagnes / o.leads * 100) : 0, ca_ttc: Math.round(o.ca_ttc) })).sort((a, b) => b.leads - a.leads);
  res.json({ ok: true, data: rows });
});

// ── Photos des demandes (envoyées par le client ou ajoutées à la main) ──
const LEAD_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };
function saveLeadPhoto(leadId, buf, meta = {}) {
  const type = sniffImage(buf); if (!type || buf.length > 12 * 1024 * 1024) return false;
  const l = db.leadById(leadId); if (!l || (l.photos || []).length >= 40) return false;
  const sha = crypto.createHash('sha1').update(buf).digest('hex');
  if ((l.photos || []).some(p => p.sha === sha)) return false;
  const dir = path.join(PHOTO_DIR, 'l' + l.id); fs.mkdirSync(dir, { recursive: true });
  const name = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.' + LEAD_EXT[type];
  fs.writeFileSync(path.join(dir, name), buf);
  return db.addLeadPhoto(l.id, { file: name, kind: meta.kind || 'client', at: new Date().toISOString(), by: meta.by || '', src: meta.src || '', sha });
}
const leadPhotoPath = (id, file) => (/^[0-9]+-[0-9a-f]{8}\.(jpg|png|webp|heic)$/.test(file) && /^\d+$/.test(String(id))) ? path.join(PHOTO_DIR, 'l' + id, file) : null;
app.post('/api/crm/leads/:id/photos', (req, res) => {
  const l = db.leadById(req.params.id); if (!l) return res.status(404).json({ ok: false, error: 'Lead introuvable' });
  photoUpload.array('photos', 6)(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'Photo trop lourde (10 Mo maximum).' : 'Envoi impossible.' });
    const files = req.files || []; if (!files.length) return res.status(400).json({ ok: false, error: 'Aucune photo reçue.' });
    let added = 0; for (const f of files) { if (saveLeadPhoto(l.id, f.buffer, { src: 'crm', by: req.user.name })) added++; }
    if (!added) return res.status(400).json({ ok: false, error: 'Aucune photo ajoutée (format JPEG, PNG, WebP ou HEIC, ou déjà présente).' });
    res.json({ ok: true, added, data: db.leadById(l.id).photos });
  });
});
app.get('/api/crm/photos/lead/:id/:file', (req, res) => {
  const l = db.leadById(req.params.id); const p = leadPhotoPath(req.params.id, req.params.file);
  if (!l || !p || !(l.photos || []).some(x => x.file === req.params.file) || !fs.existsSync(p)) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(p);
});
app.delete('/api/crm/photos/lead/:id/:file', (req, res) => {
  const p = leadPhotoPath(req.params.id, req.params.file); if (!p) return res.status(400).json({ ok: false, error: 'Photo invalide' });
  const ok = db.removeLeadPhoto(req.params.id, req.params.file);
  if (ok) { try { fs.unlinkSync(p); } catch (e) { /* déjà supprimée */ } }
  res.json({ ok });
});

// ── CRM : suivi des e-mails (lecture de la boîte Gmail) ──
app.get('/api/crm/mail/status', (_req, res) => res.json({ ok: true, data: mailsync.status() }));
app.get('/api/crm/mail/report', (_req, res) => res.json({ ok: true, data: mailsync.report() }));
app.post('/api/crm/mail/sync', (_req, res) => { mailsync.tick(true); res.json({ ok: true, data: mailsync.status() }); });

// Export complet (sauvegarde manuelle) : GET /api/crm/export
app.get('/api/crm/export', (_req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="reynov-crm-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ ok: true, exported_at: new Date().toISOString(), data: db.exportAll() });
});

// ── CRM : leads ──────────────────────────────────────────────
const slimLead = (l) => {
  const t = l.triage ? { ...l.triage } : null;
  if (t) { delete t.drafts; delete t.reply; delete t.whatsapp; }
  const { events, ...rest } = l;
  return { ...rest, triage: t, events_count: (events || []).length };
};
const replyLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Trop d\'envois. Réessayez plus tard.' } });

app.get('/api/crm/config', (_req, res) => {
  res.json({ ok: true, data: { user: _req.user, review_url: process.env.GOOGLE_REVIEW_URL || '', ai: triage.aiAvailable(), email: !!(GMAIL_USER && GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN) || process.env.CRM_TEST_MODE === '1', categories: triage.CATEGORIES, statuses: db.LEAD_STATUS } });
});
app.get('/api/crm/leads/stats', (_req, res) => res.json({ ok: true, data: db.leadStats() }));
app.get('/api/crm/leads', (req, res) => {
  res.json({ ok: true, data: db.leadsList({ status: req.query.status, q: req.query.q, cat: req.query.cat }).slice(0, 2500).map(slimLead) });
});
app.get('/api/crm/leads/:id', (req, res) => {
  const l = db.leadById(req.params.id);
  if (!l) return res.status(404).json({ ok: false, error: 'Introuvable' });
  const client = l.client_id ? db.clientById(l.client_id) : null;
  res.json({ ok: true, data: { ...l, client: client ? { id: client.id, interventions: client.interventions.length } : null } });
});
app.post('/api/crm/leads', async (req, res) => {
  const b = req.body || {};
  if (!cleanLine(b.prenom, 80) && !cleanLine(b.nom, 80)) return res.status(400).json({ ok: false, error: 'Nom ou prénom requis.' });
  const email = cleanLine(b.email, 200);
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'E-mail invalide.' });
  const r = ingestLead({ source: 'manuel', prenom: b.prenom, nom: b.nom, email, tel: b.tel, ville: b.ville, message: b.message, sujet: b.sujet, form: b.form || {} });
  if (r.duplicate) return res.json({ ok: true, data: r.lead, duplicate: true });
  res.json({ ok: true, data: r.lead });
});
app.patch('/api/crm/leads/:id', (req, res) => {
  const b = req.body || {};
  const l = db.leadById(req.params.id);
  if (!l) return res.status(404).json({ ok: false, error: 'Introuvable' });
  const patch = {};
  ['prenom', 'nom', 'tel', 'ville', 'adresse'].forEach(k => { if (b[k] !== undefined) patch[k] = cleanLine(b[k], 200); });
  if (b.email !== undefined) {
    const e = cleanLine(b.email, 200);
    if (e && !EMAIL_RE.test(e)) return res.status(400).json({ ok: false, error: 'E-mail invalide.' });
    patch.email = e;
  }
  if (b.notes !== undefined) patch.notes = clean(b.notes, 4000);
  if (b.status !== undefined) {
    if (!db.LEAD_STATUS.includes(b.status)) return res.status(400).json({ ok: false, error: 'Statut inconnu.' });
    patch.status = b.status;
  }
  if (b.reminder_at !== undefined) patch.reminder_at = b.reminder_at ? new Date(b.reminder_at).toISOString() : null;
  if (b.assigned_to !== undefined) { patch.assigned_to = assignee(b.assigned_to); const who = patch.assigned_to ? (db.userById(patch.assigned_to) || {}).name : null; db.addLeadEvent(l.id, 'status', who ? 'Assigné à ' + who + (req.user.name ? ' (par ' + req.user.name + ')' : '') : 'Affectation retirée'); }
  if (Array.isArray(b.categories)) patch.categories = b.categories.filter(c => triage.CATEGORIES[c]).slice(0, 4);
  const out = db.updateLead(l.id, patch);
  if (patch.categories && out.triage) {
    out.triage = triage.withDrafts(out, { ...out.triage, categories: patch.categories, primary: patch.categories[0] || 'autre', engine: out.triage.engine === 'ia' ? 'regles' : out.triage.engine });
    db.updateLead(l.id, { triage: out.triage });
  }
  res.json({ ok: true, data: db.leadById(l.id) });
});
app.post('/api/crm/leads/:id/analyze', async (req, res) => {
  const l = db.leadById(req.params.id);
  if (!l) return res.status(404).json({ ok: false, error: 'Introuvable' });
  const engine = req.body && req.body.engine === 'regles' ? 'regles' : 'auto';
  const tri = await triage.analyze(l, { engine });
  db.updateLead(l.id, { triage: tri });
  db.addLeadEvent(l.id, 'analysis', (tri.engine === 'ia' ? 'Analyse IA : ' : 'Analyse automatique : ') + tri.summary);
  res.json({ ok: true, data: db.leadById(l.id), ai_error: tri.ai_error || null });
});
app.post('/api/crm/leads/:id/contact', (req, res) => {
  const channel = ['appel', 'whatsapp', 'email', 'sms', 'autre'].includes((req.body || {}).channel) ? req.body.channel : 'autre';
  const l = db.logContact(req.params.id, channel, cleanLine((req.body || {}).note, 300));
  if (!l) return res.status(404).json({ ok: false, error: 'Introuvable' });
  res.json({ ok: true, data: l });
});
const draftLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Trop de demandes à l\'assistant. Réessayez dans un moment.' } });
// Contrôle d'un message avant envoi (sans IA)
app.post('/api/crm/leads/:id/check', (req, res) => {
  const l = db.leadById(req.params.id);
  if (!l) return res.status(404).json({ ok: false, error: 'Introuvable' });
  res.json({ ok: true, data: triage.checkDraft(l, cleanLine((req.body || {}).subject, 160), clean((req.body || {}).body, 5000), clean((req.body || {}).instruction, 1500)) });
});
// Réécriture à partir d'une consigne (dictée ou écrite) : rien n'est envoyé, le texte revient dans le champ du message
app.post('/api/crm/leads/:id/draft', draftLimiter, async (req, res) => {
  const l = db.leadById(req.params.id);
  if (!l) return res.status(404).json({ ok: false, error: 'Introuvable' });
  const instruction = clean((req.body || {}).instruction, 1500);
  if (instruction.length < 4) return res.status(400).json({ ok: false, error: 'Dites ou écrivez ce que vous voulez changer.' });
  const subject = cleanLine((req.body || {}).subject, 160), body = clean((req.body || {}).body, 5000);
  try {
    const d = await triage.reviseDraft(l, { instruction, subject, body });
    db.addLeadEvent(l.id, 'analysis', 'Message retravaillé avec l\'assistant (consigne : ' + instruction.slice(0, 120) + ')');
    res.json({ ok: true, data: { ...d, checks: triage.checkDraft(l, d.subject, d.body, instruction) } });
  } catch (e) {
    if (e.code === 'no_ai') return res.status(409).json({ ok: false, error: e.message });
    console.error('⚠️ Assistant IA (réécriture) :', e.message);
    res.status(502).json({ ok: false, error: 'L\'assistant n\'a pas pu répondre (' + e.message.slice(0, 80) + '). Réessayez.' });
  }
});
app.post('/api/crm/leads/:id/reply', replyLimiter, async (req, res) => {
  const l = db.leadById(req.params.id);
  if (!l) return res.status(404).json({ ok: false, error: 'Introuvable' });
  if (!l.email || !EMAIL_RE.test(l.email)) return res.status(400).json({ ok: false, error: 'Ce lead n\'a pas d\'adresse e-mail valide.' });
  const subject = cleanLine((req.body || {}).subject, 160);
  const body = clean((req.body || {}).body, 5000).replace(/\{\{prenom\}\}/g, l.prenom || '');
  if (!subject || body.length < 10) return res.status(400).json({ ok: false, error: 'Objet et message requis.' });
  try {
    if (process.env.CRM_TEST_MODE !== '1') {
      if (!GMAIL_USER) throw new Error('Gmail non configuré sur le serveur');
      await sendEmail({ from: `"REYNOV" <${GMAIL_USER}>`, to: l.email, subject, html: replyEmail(body), origin: 'crm' });
    }
    db.logContact(l.id, 'email', null);
    db.addLeadEvent(l.id, 'reply_sent', 'E-mail envoyé : ' + subject);
    res.json({ ok: true, data: db.leadById(l.id) });
  } catch (e) {
    console.error('❌ Envoi réponse CRM:', e.message);
    res.status(502).json({ ok: false, error: 'Envoi impossible : ' + e.message });
  }
});
app.delete('/api/crm/leads/:id', (req, res) => {
  res.json({ ok: db.deleteLead(req.params.id) });
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
  const admin = req.user.role === 'admin';
  const leads = db.allLeads().filter(l => l.client_id === client.id).map(l => ({ id: l.id, created_at: l.created_at, status: l.status, source: l.source, summary: (l.triage && l.triage.summary) || '' })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const quotes = admin ? db.quotesList().filter(q => q.client_id === client.id).map(q => ({ id: q.id, number: q.number, status: q.status, ttc: q.totals.ttc, created_at: q.created_at })) : [];
  const leadIds = new Set(leads.map(l => l.id));
  const events = db.allEvents().filter(e => e.lead_id && leadIds.has(e.lead_id)).map(e => ({ id: e.id, title: e.title, start: e.start, all_day: e.all_day })).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 10);
  const interventions = admin ? client.interventions : client.interventions.map(({ montant, ...i }) => i);
  res.json({ ok: true, data: { ...client, interventions, leads, quotes, events } });
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
  const admin = req.user.role === 'admin';
  res.json({ ok: true, data: db.allInterventions().map(i => { if (admin) return i; const { montant, ...r } = i; return r; }) });
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
    statut: INTER_STATUS.includes(b.statut) ? b.statut : 'nouveau', montant: req.user.role === 'admin' ? (b.montant || null) : null, notes: b.notes || '',
    assigned_to: assignee(b.assigned_to), date_prevue: /^\d{4}-\d{2}-\d{2}/.test(String(b.date_prevue || '')) ? String(b.date_prevue).slice(0, 10) : null,
  });
  res.json({ ok: true, id });
});

// PUT /api/crm/interventions/:id
const INTER_STATUS = ['nouveau', 'devis_envoye', 'confirme', 'en_cours', 'termine', 'paye', 'annule'];
const assignee = (v) => { if (v === '' || v == null) return null; const u = db.userById(v); return u ? u.id : null; };
app.put('/api/crm/interventions/:id', (req, res) => {
  const cur = db.interventionById(req.params.id); if (!cur) return res.status(404).json({ ok: false, error: 'Introuvable' });
  const b = req.body || {}; const d = {};
  if (b.statut !== undefined && INTER_STATUS.includes(b.statut)) d.statut = b.statut;
  if (b.notes !== undefined) d.notes = clean(b.notes, 2000);
  if (b.montant !== undefined && req.user.role === 'admin') d.montant = b.montant === '' || b.montant == null ? null : (Number(b.montant) || null);
  if (b.assigned_to !== undefined) d.assigned_to = assignee(b.assigned_to);
  if (b.date_prevue !== undefined) d.date_prevue = /^\d{4}-\d{2}-\d{2}/.test(String(b.date_prevue || '')) ? String(b.date_prevue).slice(0, 10) : null;
  db.updateIntervention(cur.id, d);
  res.json({ ok: true, data: db.interventionById(cur.id) });
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


// ── Leads : réception, tri automatique, notifications ─────────
const clean = (v, max = 4000) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ').trim().slice(0, max);
const cleanLine = (v, max = 200) => clean(v, max).replace(/\n+/g, ' ');
const escHtml = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ensureClient(lead) {
  try {
    if (lead.client_id) return lead.client_id;
    if (!lead.email) return null;
    let c = db.findByEmail(lead.email);
    const id = c ? c.id : db.createClient({ prenom: lead.prenom, nom: lead.nom, email: lead.email, tel: lead.tel, adresse: lead.adresse || '', ville: lead.ville || '', notes: '' });
    db.updateLead(lead.id, { client_id: id });
    return id;
  } catch (e) { console.error('⚠️ ensureClient:', e.message); return null; }
}

// Enregistre une demande, la trie tout de suite (règles) puis l'enrichit par IA en arrière-plan si disponible.
function ingestLead(src) {
  const email = cleanLine(src.email, 200);
  const message = clean(src.message, 4000);
  const dup = db.findRecentDuplicate(email, message);
  if (dup) return { lead: dup, duplicate: true };
  const f = src.form || {};
  const lead = db.createLead({
    source: cleanLine(src.source || 'devis', 40) || 'devis',
    prenom: cleanLine(src.prenom, 80), nom: cleanLine(src.nom, 80), email, tel: cleanLine(src.tel, 40),
    ville: cleanLine(src.ville, 120), adresse: cleanLine(src.adresse, 200), sujet: cleanLine(src.sujet, 120), message,
    form: {
      prestation: cleanLine(f.prestation, 100), problemes: cleanLine(f.problemes, 200), nb_jantes: cleanLine(f.nb_jantes, 10),
      taille: cleanLine(f.taille, 40), marque: cleanLine(f.marque, 60), modele: cleanLine(f.modele, 60), finition: cleanLine(f.finition, 60),
      mode: cleanLine(f.mode, 60), delai: cleanLine(f.delai, 60), photos: Number(f.photos) || 0,
    },
    client_id: src.client_id || null, intervention_id: src.intervention_id || null,
  });
  const tri = triage.withDrafts(lead, triage.analyzeRules(lead));
  db.updateLead(lead.id, { triage: tri });
  db.addLeadEvent(lead.id, 'analysis', 'Analyse automatique : ' + tri.summary);
  ensureClient(lead);
  if (triage.aiAvailable()) {
    triage.analyze(lead).then(r => {
      if (r.engine === 'ia') { db.updateLead(lead.id, { triage: r }); db.addLeadEvent(lead.id, 'analysis', 'Analyse IA : ' + r.summary); }
    }).catch(() => {});
  }
  return { lead: db.leadById(lead.id), duplicate: false };
}

function contactOwnerEmail(l) {
  const t = l.triage || {}; const F = mailtpl.FONT;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#ecebe7;font-family:${F};">
<div style="max-width:640px;margin:28px auto;background:#fff;border-radius:20px;overflow:hidden;">
  <div style="background:#0b0b0c;padding:26px 40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right:16px;"><img src="${mailtpl.LOGO}" width="44" height="44" alt="REYNOV" style="display:block;border:0;"></td><td><div style="color:#fff;font-size:15px;font-weight:700;letter-spacing:6px;">REYNOV</div><div style="color:#9a9aa2;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;margin-top:4px;">Nouveau message de contact</div></td></tr></table></div>
  <div style="padding:30px 40px;font-size:14px;color:#34343a;line-height:1.7;">
    <p style="margin:0 0 4px;font-size:20px;color:#0b0b0c;"><strong>${escHtml(l.prenom)} ${escHtml(l.nom)}</strong></p>
    <p style="margin:0 0 16px;color:#7b7b84;">${l.email ? `<a href="mailto:${escHtml(l.email)}" style="color:#0b0b0c;">${escHtml(l.email)}</a>` : ''}${l.tel ? ' · ' + escHtml(l.tel) : ''}${l.sujet ? ' · ' + escHtml(l.sujet) : ''}</p>
    <div style="background:#f6f4ef;border-left:3px solid #0b0b0c;border-radius:0 12px 12px 0;padding:16px 20px;white-space:pre-wrap;">${escHtml(l.message)}</div>
    <p style="margin:18px 0 4px;"><strong>Analyse :</strong> ${escHtml(t.summary || '')}${t.urgency === 'haute' ? ' <span style="color:#c00;">· urgent</span>' : ''}</p>
    <p style="margin:0 0 4px;color:#555;">${(t.price_hint || []).map(escHtml).join('<br>')}</p>
    <p style="margin:20px 0 0;"><a href="https://www.reynov-jantes.fr/admin/crm.html#/leads" style="display:inline-block;background:#0b0b0c;color:#fff;padding:13px 24px;border-radius:999px;text-decoration:none;font-size:13.5px;font-weight:600;">Ouvrir dans le CRM (réponse prête)</a></p>
  </div>
</div></body></html>`;
}

function contactAckEmail(l) { return mailtpl.contactAck(l); }

function replyEmail(body) { return mailtpl.reply(body); }

// ── POST /api/contact : formulaire de la page Contact ─────────
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Trop de messages. Réessayez dans une heure ou appelez le 06 61 45 35 27.' },
});
app.post('/api/contact', contactLimiter, express.json({ limit: '20kb' }), async (req, res) => {
  try {
    const b = req.body || {};
    if (b.website) return res.status(400).json({ ok: false, error: 'Requête invalide.' });
    const t0 = Number(b._t);
    if (t0 && Date.now() - t0 < 3000) return res.status(400).json({ ok: false, error: 'Requête invalide.' });
    if (!devisBudgetOk()) return res.status(429).json({ ok: false, error: 'Service momentanément saturé. Appelez le 06 61 45 35 27.' });
    const email = typeof b.email === 'string' ? b.email.trim() : '';
    if (!email || email.length > 200 || !EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'Adresse email invalide.' });
    if (!cleanLine(b.prenom, 80)) return res.status(400).json({ ok: false, error: 'Prénom requis.' });
    const message = clean(b.message, 4000);
    if (message.length < 5) return res.status(400).json({ ok: false, error: 'Merci de décrire votre demande.' });
    if (!emailBudgetOk(email)) return res.status(429).json({ ok: false, error: 'Un message a déjà été reçu pour cette adresse. Appelez-nous au 06 61 45 35 27.' });

    const { lead, duplicate } = ingestLead({ source: 'contact', prenom: b.prenom, nom: b.nom, email, tel: b.tel, sujet: b.sujet, message, form: {} });
    if (duplicate) return res.json({ ok: true });
    console.log('📩 Message de contact enregistré (lead #' + lead.id + ')');
    // Notifications : n'empêchent jamais l'enregistrement
    sendEmail({ from: `"REYNOV Site" <${GMAIL_USER}>`, to: GMAIL_USER, subject: `Nouveau message - ${lead.prenom} ${lead.nom}`.trim(), html: contactOwnerEmail(lead), origin: 'owner' })
      .catch(e => console.error('⚠️ Mail owner (contact) non envoyé:', e.message));
    sendEmail({ from: `"REYNOV" <${GMAIL_USER}>`, to: email, subject: 'Votre message à REYNOV a bien été reçu', html: contactAckEmail(lead), origin: 'ack' })
      .catch(e => console.error('⚠️ Accusé (contact) non envoyé:', e.message));
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ /api/contact:', err.message);
    res.status(500).json({ ok: false, error: 'Erreur serveur. Appelez le 06 61 45 35 27.' });
  }
});

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
      const interId = db.createIntervention({
        client_id: clientId,
        prestation: d.prestation, problemes: d.problemes,
        nb_jantes: d.nb_jantes, taille: d.taille,
        marque: d.marque, modele: d.modele,
        finition: d.finition, mode: d.mode,
        adresse_intervention: d.adresse_client || d.adresse,
        statut: 'nouveau', montant: null, notes: d.source ? `Source : ${d.source}` : '',
      });
      const un = triage.entitiesToText;
      const r = ingestLead({
        source: d.source || 'devis', prenom: un(d.prenom), nom: un(d.nom), email: d.email, tel: un(d.tel),
        ville: un(d.adresse), adresse: un(d.adresse_client), message: un(d.description),
        form: { prestation: un(d.prestation), problemes: un(d.problemes), nb_jantes: d.nb_jantes, taille: un(d.taille), marque: un(d.marque), modele: un(d.modele), finition: un(d.finition), mode: un(d.mode), delai: un(d.delai), photos: attachments.length },
        client_id: clientId, intervention_id: interId,
      });
      if (r.lead) {
        db.updateLead(r.lead.id, { client_id: clientId, intervention_id: interId });
        for (const a of attachments) { try { saveLeadPhoto(r.lead.id, a.content, { src: 'form', by: 'Client' }); } catch (e) { console.error('⚠️ Photo non conservée :', e.message); } }   // les photos restent consultables dans le CRM
      }
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
        attachments, origin: 'owner',
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
        html:    clientEmail(d), origin: 'ack',
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
  mailsync.start();
  calsync.start();
  console.log(`🚀 REYNOV server démarré sur le port ${PORT}`);
});
