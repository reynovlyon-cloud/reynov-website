// Construction d'un e-mail conforme aux normes (RFC 5322 / 2045 / 2047), pour limiter les classements en courrier indésirable :
//  - texte brut ET HTML en alternative (un e-mail « HTML seul » est un signal de spam classique) ;
//  - contenu encodé en quoted-printable avec des lignes de 76 caractères au plus (le HTML d'origine a de très longues lignes) ;
//  - en-têtes complets (Date, MIME-Version, langue) et pièces jointes découpées en lignes de 76 caractères.
const crypto = require('crypto');

// Quoted-printable (UTF-8), lignes de 76 caractères au plus, fins de ligne CRLF.
function qp(str) {
  const bytes = Buffer.from(String(str == null ? '' : str).replace(/\r\n?/g, '\n'), 'utf8');
  const LIMIT = 72;
  let out = '', line = '';
  const flush = (hard) => {
    if (hard && /[ \t]$/.test(line)) line = line.slice(0, -1) + (line.endsWith(' ') ? '=20' : '=09');   // un espace en fin de ligne doit être encodé
    out += line + (hard ? '\r\n' : '=\r\n'); line = '';
  };
  for (const b of bytes) {
    if (b === 10) { flush(true); continue; }
    const tok = (b >= 33 && b <= 126 && b !== 61) || b === 32 || b === 9 ? String.fromCharCode(b) : '=' + b.toString(16).toUpperCase().padStart(2, '0');
    if (line.length + tok.length > LIMIT) flush(false);
    line += tok;
  }
  return out + line;
}

// Mot encodé RFC 2047 pour un en-tête contenant des caractères non ASCII (découpé sans couper un caractère).
function encodeWord(s) {
  s = String(s == null ? '' : s).replace(/[\r\n]+/g, ' ');
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  const words = []; let cur = '';
  for (const ch of s) {
    if (Buffer.byteLength(cur + ch) > 42) { words.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) words.push(cur);
  return words.map((w) => '=?UTF-8?B?' + Buffer.from(w, 'utf8').toString('base64') + '?=').join('\r\n ');
}

const wrap76 = (b64) => b64.replace(/(.{76})/g, '$1\r\n').replace(/\r\n$/, '');
const rand = () => crypto.randomBytes(12).toString('hex');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', laquo: '«', raquo: '»', hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à', ndash: '–', mdash: '—', rsquo: '’', euro: '€' };

// Version texte d'un e-mail HTML : liens écrits « libellé : adresse », blocs séparés par des retours à la ligne, texte caché ignoré.
function htmlToText(html) {
  let t = String(html || '').replace(/<head[\s\S]*?<\/head>/i, '').replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<div[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/gi, '');
  t = t.replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => {
    const label = inner.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!label) return '';
    if (/^(tel|mailto):/i.test(href) || label === href || label === href.replace(/^https?:\/\//, '').replace(/\/$/, '')) return label;
    return label + ' : ' + href;
  });
  t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, '\n').replace(/<\/t[dh]>/gi, ' ').replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');
  t = t.replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] != null ? ENT[n.toLowerCase()] : m));
  return t.split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// from, to, subject, html, text ; attachments : [{ filename, contentType, content: Buffer }] ; headers : lignes « Nom: valeur » supplémentaires
function build({ from, to, subject, html, text, attachments = [], headers = [] }) {
  const alt = 'alt_' + rand(), mix = 'mix_' + rand();
  const alternative = [
    `--${alt}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: quoted-printable', '', qp(text || htmlToText(html)),
    `--${alt}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: quoted-printable', '', qp(html),
    `--${alt}--`,
  ];
  const head = [`From: ${from}`, `To: ${to}`, `Subject: ${encodeWord(subject)}`, `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0', 'Content-Language: fr', ...headers];
  if (!attachments.length) return [...head, `Content-Type: multipart/alternative; boundary="${alt}"`, '', ...alternative].join('\r\n') + '\r\n';
  const parts = [
    `--${mix}`, `Content-Type: multipart/alternative; boundary="${alt}"`, '', ...alternative,
    ...attachments.flatMap((a) => [
      `--${mix}`, `Content-Type: ${a.contentType}; name="${a.filename}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${a.filename}"`, '', wrap76(a.content.toString('base64')),
    ]),
    `--${mix}--`,
  ];
  return [...head, `Content-Type: multipart/mixed; boundary="${mix}"`, '', ...parts].join('\r\n') + '\r\n';
}

module.exports = { build, qp, encodeWord, htmlToText };
