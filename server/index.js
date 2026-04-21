const express    = require('express');
const multer     = require('multer');
const nodemailer = require('nodemailer');
const path       = require('path');

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const PORT   = parseInt(process.env.PORT) || 3000;

// ── Static site ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..')));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── Mailer ────────────────────────────────────────────────────
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

if (!GMAIL_USER || !GMAIL_PASS) {
  console.error('⚠️  GMAIL_USER ou GMAIL_PASS manquant dans les variables d\'environnement');
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
});

// Connexion SMTP vérifiée à la première utilisation

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
    REYNOV · 47 chemin du Pras, 69350 La Mulatière · <a href="https://reynovjantes.fr" style="color:#aaa;">reynovjantes.fr</a>
  </div>
</div>
</body></html>`;
}

// ── POST /api/devis ───────────────────────────────────────────
app.post('/api/devis', upload.array('photos', 20), async (req, res) => {
  try {
    console.log('📩 Devis reçu depuis', req.ip);
    const b = req.body;

    const d = {
      prestation:     b.prestation     || '',
      problemes:      b.problemes      || '',
      nb_jantes:      b.nb_jantes      || '',
      taille:         b.taille         || '',
      marque:         b.marque         || '',
      modele:         b.modele         || '',
      finition:       b.finition       || '',
      mode:           b.mode           || '',
      delai:          b.delai          || '',
      adresse:        b.adresse        || '',
      adresse_client: b.adresse_client || '',
      description:    b.description    || '',
      prenom:         b.prenom         || '',
      nom:            b.nom            || '',
      email:          b.email          || '',
      tel:            b.tel            || '',
    };

    console.log('Client:', d.prenom, d.nom, d.email);

    if (!d.email || !d.prenom) {
      return res.status(400).json({ ok: false, error: 'Prénom et email requis' });
    }

    const attachments = (req.files || []).map(f => ({
      filename:    f.originalname,
      content:     f.buffer,
      contentType: f.mimetype,
    }));

    console.log(`📎 ${attachments.length} photo(s) jointe(s)`);

    await transporter.sendMail({
      from:    `"REYNOV Site" <${GMAIL_USER}>`,
      to:      GMAIL_USER,
      subject: `Nouveau devis - ${d.prenom} ${d.nom}`,
      html:    ownerEmail(d),
      attachments,
    });
    console.log('✅ Mail owner envoyé');

    await transporter.sendMail({
      from:    `"REYNOV" <${GMAIL_USER}>`,
      to:      d.email,
      subject: 'Votre demande de devis REYNOV a bien été reçue',
      html:    clientEmail(d),
    });
    console.log('✅ Mail client envoyé');

    res.json({ ok: true });

  } catch (err) {
    console.error('❌ Erreur envoi mail:', err.message);
    res.status(500).json({ ok: false, error: err.message });
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
