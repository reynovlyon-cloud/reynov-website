// Gabarits d'e-mails REYNOV : un seul habillage premium (logo, bandeau, typographie, signature, pied de page)
// pour tout ce que reçoivent les clients. Mise en page en tableaux + styles en ligne : lisible dans Gmail, Apple Mail, Outlook.
const BASE = 'https://www.reynov-jantes.fr';
const LOGO = BASE + '/assets/images/email-logo.png';
const HERO = BASE + '/assets/images/email-hero.jpg';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";
const INK = '#0b0b0c', TEXT = '#34343a', MUTED = '#7b7b84', LINE = '#e7e5e0', SOFT = '#f6f4ef';
const PHONE = '06 61 45 35 27', TEL = '+33661453527', WA = 'https://wa.me/33661453527';

const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function button(label, url, primary = true) {
  const bg = primary ? INK : '#ffffff', fg = primary ? '#ffffff' : INK;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 8px 10px 0;"><tr><td bgcolor="${bg}" style="border-radius:999px;border:1px solid ${INK};"><a href="${url}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:14px;font-weight:600;line-height:1;color:${fg};text-decoration:none;border-radius:999px;">${label}</a></td></tr></table>`;
}
const eyebrow = (t) => `<p style="margin:0 0 14px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${MUTED};">${t}</p>`;
const h1 = (t) => `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-.4px;color:${INK};">${t}</h1>`;
const para = (t, extra = '') => `<p style="margin:0 0 16px;font-family:${FONT};font-size:15.5px;line-height:1.75;color:${TEXT};${extra}">${t}</p>`;

function signature() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;"><tr><td style="border-top:1px solid ${LINE};padding-top:22px;font-family:${FONT};">
    <p style="margin:0;font-size:15px;font-weight:700;color:${INK};">L'équipe REYNOV</p>
    <p style="margin:3px 0 12px;font-size:13px;color:${MUTED};">Rénovation de jantes · Lyon et alentours · 7j/7</p>
    <p style="margin:0;font-size:13.5px;color:${TEXT};line-height:1.9;">Téléphone / WhatsApp : <a href="${WA}" style="color:${INK};font-weight:600;text-decoration:none;">${PHONE}</a><br>Atelier : 47 chemin du Pras, 69350 La Mulatière</p>
  </td></tr></table>`;
}

// opts : { title, preheader, hero, body, note }
function shell({ title, preheader, hero = false, body, note = '' }) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(title || 'REYNOV')}</title>
<style>@media only screen and (max-width:620px){.px{padding-left:24px!important;padding-right:24px!important}.h1{font-size:24px!important}.stack{display:block!important;width:100%!important}}</style></head>
<body style="margin:0;padding:0;background:#ecebe7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ecebe7"><tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;">
    <tr><td bgcolor="${INK}" align="center" style="padding:36px 24px 30px;">
      <img src="${LOGO}" width="64" height="64" alt="REYNOV" style="display:block;margin:0 auto 16px;border:0;width:64px;height:64px;">
      <div style="font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:8px;color:#ffffff;padding-left:8px;">REYNOV</div>
      <div style="font-family:${FONT};font-size:10px;font-weight:600;letter-spacing:3.5px;color:#9a9aa2;margin-top:10px;text-transform:uppercase;">Rénovation de jantes · Lyon</div>
    </td></tr>
    ${hero ? `<tr><td style="font-size:0;line-height:0;background:${INK};"><img src="${HERO}" width="640" alt="Jante rénovée par REYNOV" style="display:block;width:100%;height:auto;border:0;"></td></tr>` : `<tr><td style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#1b1b1e,#8d8d94,#1b1b1e);" bgcolor="#3a3a40">&nbsp;</td></tr>`}
    <tr><td class="px" style="padding:42px 46px 38px;">${body}</td></tr>
    <tr><td bgcolor="${INK}" class="px" style="padding:30px 46px;font-family:${FONT};">
      <p style="margin:0 0 10px;font-size:12px;line-height:1.8;color:#b9b9c0;">REYNOV · 47 chemin du Pras, 69350 La Mulatière · <a href="tel:${TEL}" style="color:#ffffff;text-decoration:none;">${PHONE}</a></p>
      <p style="margin:0 0 14px;font-size:12px;line-height:1.8;"><a href="${BASE}" style="color:#ffffff;text-decoration:underline;">reynov-jantes.fr</a></p>
      <p style="margin:0;font-size:11px;line-height:1.7;color:#7c7c85;">REYNOV SAS · SIRET 105 819 098 00016. ${esc(note) || 'Vous recevez cet e-mail suite à votre échange avec REYNOV.'}</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ── Accusé de réception d'une demande de devis (les valeurs de d sont déjà échappées) ──
function quoteAck(d) {
  const row = (k, v) => v ? `<tr><td style="padding:9px 0;border-top:1px solid ${LINE};font-family:${FONT};font-size:13px;color:${MUTED};width:38%;vertical-align:top;">${k}</td><td style="padding:9px 0;border-top:1px solid ${LINE};font-family:${FONT};font-size:14px;color:${INK};font-weight:600;vertical-align:top;">${v}</td></tr>` : '';
  const recap = [row('Prestation', d.prestation), row('Problème(s)', d.problemes), row('Jantes', d.nb_jantes ? d.nb_jantes + ' jante(s)' + (d.taille ? ' · ' + d.taille : '') : ''),
    row('Véhicule', d.marque ? d.marque + (d.modele ? ' ' + d.modele : '') : ''), row('Finition', d.finition), row('Intervention', d.mode), row('Délai souhaité', d.delai)].join('');
  const step = (n, t, s) => `<tr><td width="44" valign="top" style="padding:0 0 16px;"><div style="width:30px;height:30px;line-height:30px;border-radius:50%;background:${INK};color:#fff;text-align:center;font-family:${FONT};font-size:13px;font-weight:700;">${n}</div></td><td valign="top" style="padding:3px 0 16px;font-family:${FONT};"><div style="font-size:14.5px;font-weight:700;color:${INK};">${t}</div><div style="font-size:13.5px;color:${MUTED};line-height:1.6;margin-top:2px;">${s}</div></td></tr>`;
  const body = `${eyebrow('Demande de devis reçue')}${h1(`Bonjour ${d.prenom},`)}
    ${para('Merci de votre confiance. Votre demande est bien arrivée : nous l\'étudions et revenons vers vous <strong style="color:' + INK + ';">sous 24 h</strong> avec une estimation personnalisée.')}
    ${recap ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px;background:${SOFT};border-radius:16px;"><tr><td style="padding:22px 24px 14px;"><p style="margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${MUTED};">Récapitulatif de votre demande</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${recap}</table></td></tr></table>` : ''}
    <p style="margin:30px 0 16px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${MUTED};">Et maintenant ?</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${step(1, 'Étude de votre demande', 'Nous analysons vos informations et vos photos.')}${step(2, 'Votre devis personnalisé', 'Envoyé sous 24 h, gratuit et sans engagement.')}${step(3, 'Intervention', 'À domicile ou à l\'atelier de La Mulatière, avec garantie satisfaction de 30 jours.')}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 26px;background:${SOFT};border-radius:16px;"><tr>
      <td class="stack" align="center" style="padding:16px 8px;font-family:${FONT};font-size:12.5px;font-weight:600;color:${INK};">Devis gratuit</td>
      <td class="stack" align="center" style="padding:16px 8px;font-family:${FONT};font-size:12.5px;font-weight:600;color:${INK};border-left:1px solid ${LINE};">Garantie satisfaction 30 jours</td>
      <td class="stack" align="center" style="padding:16px 8px;font-family:${FONT};font-size:12.5px;font-weight:600;color:${INK};border-left:1px solid ${LINE};">Qualité d'origine</td></tr></table>
    ${para('Pour accélérer votre devis, envoyez-nous deux ou trois photos de vos jantes :', 'margin-bottom:14px;')}
    ${button('Envoyer des photos sur WhatsApp', WA)}${button('Appeler ' + PHONE, 'tel:' + TEL, false)}
    ${signature()}`;
  return shell({ title: 'Votre demande de devis REYNOV', preheader: 'Votre demande est bien reçue : devis personnalisé sous 24 h.', hero: false, body, note: 'Vous recevez cet e-mail car vous avez demandé un devis sur reynov-jantes.fr. Pour ne rien manquer, ajoutez reynov.lyon@gmail.com à vos contacts ; si ce message est arrivé dans vos courriers indésirables, marquez-le « Pas un spam ».' });
}

// ── Accusé de réception d'un message de la page Contact ──
function contactAck(l) {
  const body = `${eyebrow('Message reçu')}${h1(`Bonjour ${esc(l.prenom)},`)}
    ${para('Nous avons bien reçu votre message et vous répondons <strong style="color:' + INK + ';">sous 24 h</strong>.')}
    ${para('Pour un devis précis, vous pouvez aussi nous envoyer deux photos de vos jantes sur WhatsApp :', 'margin-bottom:14px;')}
    ${button('Écrire sur WhatsApp', WA)}${button('Appeler ' + PHONE, 'tel:' + TEL, false)}
    ${signature()}`;
  return shell({ title: 'Votre message à REYNOV', preheader: 'Nous avons bien reçu votre message : réponse sous 24 h.', hero: false, body, note: 'Vous recevez cet e-mail car vous avez écrit à REYNOV depuis reynov-jantes.fr. Pour ne rien manquer, ajoutez reynov.lyon@gmail.com à vos contacts ; si ce message est arrivé dans vos courriers indésirables, marquez-le « Pas un spam ».' });
}

// ── Accusé de réception d'une demande professionnelle ──
function proAck(l, company) {
  const body = `${eyebrow('Demande professionnelle reçue')}${h1(`Bonjour ${esc(l.prenom)},`)}
    ${para('Merci pour votre message' + (company ? ' au nom de <strong style="color:' + INK + ';">' + esc(company) + '</strong>' : '') + '. Nous l\'étudions et revenons vers vous en général <strong style="color:' + INK + ';">sous 24 h ouvrées</strong>.')}
    ${para('Pour avancer plus vite, envoyez-nous quelques photos des jantes concernées (et le nombre de véhicules ou de jantes). Nous vous répondrons avec un diagnostic et un devis précisant les modalités avant tout accord : lieu d\'intervention, délais, conditions.', 'margin-bottom:14px;')}
    ${button('Envoyer des photos sur WhatsApp', WA)}${button('Appeler ' + PHONE, 'tel:' + TEL, false)}
    ${signature()}`;
  return shell({ title: 'Votre demande professionnelle — REYNOV', preheader: 'Demande bien reçue : diagnostic et devis avant tout accord.', hero: false, body, note: 'Vous recevez cet e-mail car vous avez écrit à REYNOV depuis la page professionnels de reynov-jantes.fr. Pour ne rien manquer, ajoutez reynov.lyon@gmail.com à vos contacts ; si ce message est arrivé dans vos courriers indésirables, marquez-le « Pas un spam ».' });
}

// ── Réponse rédigée depuis le CRM (texte libre de l'équipe) ──
function reply(text) {
  const paras = String(text).split(/\n{2,}/).map((p) => para(esc(p).replace(/\n/g, '<br>'))).join('');
  // la signature « L'équipe REYNOV » écrite dans le texte est retirée : l'habillage la rajoute proprement
  const clean = paras.replace(/<p[^>]*>\s*(?:Cordialement,?|Bien cordialement,?)?(?:<br>)?\s*L'équipe REYNOV[^<]*(?:<br>[^<]*)*<\/p>\s*$/i, '');
  const body = `${clean}${signature()}`;
  return shell({ title: 'REYNOV', preheader: String(text).replace(/\s+/g, ' ').slice(0, 110), body, note: 'Vous recevez cet e-mail en réponse à votre demande auprès de REYNOV.' });
}

module.exports = { shell, button, eyebrow, h1, para, signature, quoteAck, contactAck, proAck, reply, esc, BASE, LOGO, FONT, INK, MUTED, LINE, SOFT };
