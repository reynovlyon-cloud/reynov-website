const express  = require('express');
const multer   = require('multer');
const nodemailer = require('nodemailer');
const path     = require('path');

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const PORT   = process.env.PORT || 3000;

// Serve static site
app.use(express.static(path.join(__dirname, '..')));

// ── Mailer ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ── Templates ─────────────────────────────────────────────────
function ownerEmail(d) {
  const row = (label, val) => val
    ? `<tr><td style="padding:8px 0;color:#888;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;padding-right:24px;">${label}</td><td style="padding:8px 0;color:#111;font-size:14px;">${val}</td></tr>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,Arial,sans-serif;">
<div style="max-width:620px;margin:32px auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <div style="background:#060606;padding:28px 40px;display:flex;align-items:center;gap:16px;">
    <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:4px;">REYNOV</span>
    <span style="color:rgba(255,255,255,0.3);font-size:13px;margin-left:8px;">— Nouveau devis reçu</span>
  </div>

  <div style="padding:36px 40px;">

    <h2 style="margin:0 0 4px;font-size:22px;color:#111;">Demande de <strong>${d.prenom} ${d.nom}</strong></h2>
    <p style="margin:0 0 28px;color:#888;font-size:13px;">Reçue le ${new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>

    <div style="background:#f7f7f7;border-radius:4px;padding:20px 24px;margin-bottom:28px;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;">Contact client</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:#111;">${d.prenom} ${d.nom}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#444;"><a href="mailto:${d.email}" style="color:#444;">${d.email}</a></p>
      <p style="margin:4px 0 0;font-size:14px;color:#444;"><a href="tel:${d.tel}" style="color:#444;">${d.tel}</a></p>
      ${d.adresse_client ? `<p style="margin:4px 0 0;font-size:14px;color:#444;">📍 ${d.adresse_client}</p>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;">
      ${row('Prestation', d.prestation)}
      ${row('Problème(s)', d.problemes)}
      ${row('Nb de jantes', d.nb_jantes)}
      ${row('Taille', d.taille)}
      ${row('Véhicule', [d.marque, d.modele].filter(Boolean).join(' '))}
      ${row('Finition actuelle', d.finition)}
      ${row('Mode intervention', d.mode)}
      ${row('Délai souhaité', d.delai)}
      ${row('Ville / CP', d.adresse)}
    </table>

    ${d.description ? `
    <div style="margin-top:24px;padding:16px 20px;background:#f7f7f7;border-left:3px solid #ddd;border-radius:0 4px 4px 0;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;">Message</p>
      <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">${d.description}</p>
    </div>` : ''}

  </div>

  <div style="background:#f7f7f7;padding:20px 40px;font-size:12px;color:#aaa;">
    REYNOV · 47 chemin du Pras, 69350 La Mulatière · reynov.lyon@gmail.com
  </div>
</div>
</body></html>`;
}

function clientEmail(d) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,Arial,sans-serif;">
<div style="max-width:620px;margin:32px auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <div style="background:#060606;padding:28px 40px;">
    <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:4px;">REYNOV</span>
  </div>

  <div style="padding:40px;">
    <h2 style="margin:0 0 8px;font-size:24px;color:#111;">Bonjour ${d.prenom},</h2>
    <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.7;">
      Votre demande de devis a bien été reçue. Nous l'étudions et vous recontactons sous <strong style="color:#111;">24h</strong> avec une estimation personnalisée.
    </p>

    <div style="background:#f7f7f7;border-radius:4px;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;">Récapitulatif de votre demande</p>
      ${d.prestation   ? `<p style="margin:0 0 8px;font-size:13px;color:#444;"><span style="color:#111;font-weight:600;">Prestation :</span> ${d.prestation}</p>` : ''}
      ${d.problemes    ? `<p style="margin:0 0 8px;font-size:13px;color:#444;"><span style="color:#111;font-weight:600;">Problème(s) :</span> ${d.problemes}</p>` : ''}
      ${d.nb_jantes    ? `<p style="margin:0 0 8px;font-size:13px;color:#444;"><span style="color:#111;font-weight:600;">Jantes :</span> ${d.nb_jantes} jante(s)${d.taille ? ` — ${d.taille}` : ''}</p>` : ''}
      ${d.marque       ? `<p style="margin:0 0 8px;font-size:13px;color:#444;"><span style="color:#111;font-weight:600;">Véhicule :</span> ${d.marque}${d.modele ? ` ${d.modele}` : ''}</p>` : ''}
      ${d.mode         ? `<p style="margin:0 0 8px;font-size:13px;color:#444;"><span style="color:#111;font-weight:600;">Mode :</span> ${d.mode}</p>` : ''}
      ${d.delai        ? `<p style="margin:0;font-size:13px;color:#444;"><span style="color:#111;font-weight:600;">Délai :</span> ${d.delai}</p>` : ''}
    </div>

    <p style="margin:0 0 28px;font-size:14px;color:#777;line-height:1.7;">
      En attendant, n'hésitez pas à nous contacter directement si vous avez des questions.
    </p>

    <div style="display:flex;gap:16px;flex-wrap:wrap;">
      <a href="tel:+33661453527" style="display:inline-block;padding:12px 24px;background:#060606;color:#fff;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:1px;border-radius:2px;">
        📞 06 61 45 35 27
      </a>
      <a href="mailto:reynov.lyon@gmail.com" style="display:inline-block;padding:12px 24px;border:1px solid #ddd;color:#333;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:1px;border-radius:2px;">
        reynov.lyon@gmail.com
      </a>
    </div>
  </div>

  <div style="background:#f7f7f7;padding:20px 40px;font-size:12px;color:#aaa;">
    REYNOV · 47 chemin du Pras, 69350 La Mulatière · <a href="https://reynovjantes.fr" style="color:#aaa;">reynovjantes.fr</a>
  </div>
</div>
</body></html>`;
}

// ── POST /api/devis ───────────────────────────────────────────
app.post('/api/devis', upload.array('photos', 20), async (req, res) => {
  try {
    const b = req.body;
    const d = {
      prestation:    b.prestation   || '',
      problemes:     b.problemes    || '',
      nb_jantes:     b.nb_jantes    || '',
      taille:        b.taille       || '',
      marque:        b.marque       || '',
      modele:        b.modele       || '',
      finition:      b.finition     || '',
      mode:          b.mode         || '',
      delai:         b.delai        || '',
      adresse:       b.adresse      || '',
      adresse_client:b.adresse_client || '',
      description:   b.description  || '',
      prenom:        b.prenom       || '',
      nom:           b.nom          || '',
      email:         b.email        || '',
      tel:           b.tel          || '',
    };

    if (!d.email || !d.prenom) {
      return res.status(400).json({ ok: false, error: 'Données manquantes' });
    }

    // Attach photos
    const attachments = (req.files || []).map(f => ({
      filename: f.originalname,
      content:  f.buffer,
      contentType: f.mimetype,
    }));

    // Mail to owner
    await transporter.sendMail({
      from: `"REYNOV Site" <${process.env.GMAIL_USER}>`,
      to:   process.env.GMAIL_USER,
      subject: `🔔 Nouveau devis — ${d.prenom} ${d.nom} (${d.prestation || 'non précisé'})`,
      html: ownerEmail(d),
      attachments,
    });

    // Accusé de réception au client
    await transporter.sendMail({
      from: `"REYNOV" <${process.env.GMAIL_USER}>`,
      to:   d.email,
      subject: 'Votre demande de devis REYNOV a bien été reçue',
      html: clientEmail(d),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Mail error:', err);
    res.status(500).json({ ok: false, error: 'Erreur envoi email' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => console.log(`REYNOV server on :${PORT}`));
