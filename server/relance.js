// Relances des demandes auxquelles REYNOV a déjà répondu (devis envoyé ou réponse donnée) et qui n'ont pas de suite.
// Ce module ne fait que CALCULER les échéances et PRÉPARER les textes : rien n'est envoyé sans un clic dans le CRM.
//  - 1re relance 3 jours après le dernier message envoyé, 2e relance 4 jours plus tard, dernière relance 7 jours plus tard ;
//  - un message du client (e-mail reçu ou « le client a répondu ») remet le compteur à zéro ;
//  - une demande gagnée, perdue, avec rendez-vous, avec devis accepté ou avec « ne plus relancer » n'est jamais relancée.
const DAY = 86400000;
const DELAYS = [3, 4, 7];                 // jours d'attente avant la 1re, la 2e et la dernière relance
const MAX = DELAYS.length;
const STALE_DAYS = 30;                    // au-delà, la demande est ancienne : pas de rappel automatique (relance manuelle possible)

function compute(l, quotes, rs, now) {
  now = now || Date.now();
  const st = l.relance || {};
  const qs = (quotes || []).filter((q) => q.lead_id === l.id);
  const open = qs.filter((q) => q.status === 'envoye').sort((a, b) => String(b.sent_at || b.created_at).localeCompare(String(a.sent_at || a.created_at)))[0] || null;
  const out = {
    eligible: false, due: false, stale: false, exhausted: false, closeable: false, level: 0, count: 0, wait_days: 0,
    due_at: null, last_at: st.last_at || null, stop: !!st.stop, snooze_until: st.snooze_until || null,
    quote: open ? { id: open.id, number: open.number, valid_until: open.valid_until || null } : null,
  };
  const lastOut = rs && rs.last_out ? Date.parse(rs.last_out) : 0, lastIn = rs && rs.last_in ? Date.parse(rs.last_in) : 0;
  const reminded = st.last_at ? Date.parse(st.last_at) : 0;
  out.count = reminded && lastIn > reminded ? 0 : Math.min(MAX, Number(st.count) || 0);       // le client a écrit depuis la dernière relance : on repart de zéro
  const closed = ['gagne', 'perdu', 'rdv'].includes(l.status) || qs.some((q) => q.status === 'accepte');
  if (closed || !(lastOut && lastOut > lastIn)) return out;                                   // pas de réponse de notre part, ou le client attend la nôtre
  const base = Math.max(lastOut, reminded);
  out.wait_days = Math.max(0, Math.floor((now - base) / DAY));
  out.eligible = !st.stop;
  if (out.count >= MAX) {                                                                     // 3 relances sans réponse : on propose de classer la demande
    out.exhausted = true; out.due_at = new Date(base + DELAYS[MAX - 1] * DAY).toISOString();
    out.closeable = out.eligible && now >= base + DELAYS[MAX - 1] * DAY; return out;
  }
  out.level = out.count + 1;
  out.due_at = new Date(base + DELAYS[out.count] * DAY).toISOString();
  out.stale = out.wait_days > STALE_DAYS;
  const snoozed = st.snooze_until && Date.parse(st.snooze_until) > now;
  const planned = l.reminder_at && Date.parse(l.reminder_at) > now;                           // un rappel est déjà programmé : on le respecte
  out.due = out.eligible && !out.stale && !snoozed && !planned && now >= base + DELAYS[out.count] * DAY;
  return out;
}

const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }); };
const SIGN = 'Cordialement,\nL\'équipe REYNOV\n06 61 45 35 27 · www.reynov-jantes.fr';

// Textes de relance : courts, sans pression, sans prix ni promesse. {{prenom}} est remplacé à l'affichage et à l'envoi.
function draft(l, level, quote, now) {
  now = now || Date.now();
  const lvl = Math.min(MAX, Math.max(1, Number(level) || 1));
  const ref = quote && quote.number ? 'notre devis n° ' + quote.number : 'votre demande de devis';
  const valid = quote && quote.valid_until && Date.parse(quote.valid_until) > now ? '\n\nLe devis reste valable jusqu\'au ' + fmtDate(quote.valid_until) + '.' : '';
  const subject = quote && quote.number ? 'Votre devis REYNOV n° ' + quote.number : 'Votre demande de devis REYNOV';
  const bodies = [
    'Bonjour {{prenom}},\n\nJe me permets de revenir vers vous au sujet de ' + ref + '. Avez-vous eu le temps d\'y jeter un œil ?\n\nSi vous avez une question, ou si vous souhaitez ajuster quelque chose (nombre de jantes, finition, date), répondez simplement à ce message ou appelez-moi au 06 61 45 35 27 : nous regardons cela ensemble.' + valid + '\n\n' + SIGN,
    'Bonjour {{prenom}},\n\nJe reviens vers vous au cas où mon précédent message se serait perdu : ' + ref + ' est toujours à votre disposition.\n\nPour caler l\'intervention, l\'atelier est ouvert tous les jours de 9h à 19h : dites-moi la date qui vous arrange et je regarde la disponibilité. Si des photos supplémentaires peuvent aider à affiner le devis, vous pouvez me les envoyer sur WhatsApp au 06 61 45 35 27.' + valid + '\n\n' + SIGN,
    'Bonjour {{prenom}},\n\nJe n\'ai pas eu de retour concernant ' + ref + '. Je considère donc que votre projet n\'est plus d\'actualité et je ne vous relancerai pas davantage.\n\nSi vous changez d\'avis, il vous suffit de répondre à ce message : nous reprendrons votre dossier avec plaisir.\n\n' + SIGN,
  ];
  const wa = [
    'Bonjour {{prenom}}, c\'est REYNOV. Avez-vous eu le temps de regarder ' + ref + ' ? Je reste disponible pour toute question ou tout ajustement.',
    'Bonjour {{prenom}}, je reviens vers vous au sujet de ' + ref + '. Dites-moi quelle date vous arrangerait et je regarde la disponibilité de l\'atelier (tous les jours, de 9h à 19h).',
    'Bonjour {{prenom}}, sans retour de votre part, je considère que votre projet n\'est plus d\'actualité et je ne vous relancerai plus. N\'hésitez pas à m\'écrire si vous changez d\'avis.',
  ];
  return { level: lvl, subject, body: bodies[lvl - 1], whatsapp: wa[lvl - 1] };
}

module.exports = { compute, draft, DELAYS, MAX, STALE_DAYS };
