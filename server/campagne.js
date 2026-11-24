// Campagne e-mail « Black Friday 2026 » envoyée aux clients de REYNOV.
// Règle (CNIL, article L34-5 du code des postes et communications électroniques) : sans consentement, un e-mail commercial ne va
// qu'aux personnes déjà clientes, pour un service du même type, avec dans chaque message un moyen simple de refuser les suivants.
//  - Destinataires : interventions confirmées, en cours, terminées ou payées ; demandes gagnées ; devis acceptés (sans doublon, e-mail en minuscules).
//    Les fiches « clients » créées automatiquement à chaque demande ne prouvent pas un achat : elles restent à part, à cocher une par une.
//  - Jamais : personnes désinscrites, « ne plus relancer », adresses de test ou de REYNOV, retirées à la main ; jamais la base des prospects pros.
//  - Envoi : un e-mail toutes les 5 s environ, 150 au plus par jour (limites de Gmail), reprise sans doublon (date d'envoi gardée par adresse),
//    arrêt possible ; rien ne part sans un clic « Envoyer la campagne » de l'administrateur, et rien du tout en CRM_TEST_MODE (envoi simulé).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ID = 'bf2026';
const FIN = Date.parse('2026-12-05T19:00:00+01:00');
const TEST_TO = 'reynov.lyon@gmail.com';                       // seule adresse autorisée pour l'e-mail de test
const INTER_CLIENT = ['confirme', 'en_cours', 'termine', 'paye']; // « nouveau » = simple demande de devis, « annule » = pas de vente
const GROUPES = { intervention: 'Intervention confirmée ou réalisée', gagne: 'Demande gagnée', devis: 'Devis accepté', manuel: 'Ajouté à la main' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEST_RE = /(^|[.+_-])(test|essai|demo)([.+_-]|\d|@)|@(example|exemple|test|mailinator|yopmail)\.|\.(test|example|invalid|localhost)$/i;
const norm = (e) => String(e || '').trim().toLowerCase();
const jourParis = (ms) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// « jean-pierre » ou « JEAN » → « Jean-Pierre », « Jean » (un prénom déjà bien écrit reste tel quel)
function joliPrenom(p) {
  p = String(p || '').trim().split(/\s+/)[0] || '';
  if (!p || (p !== p.toLowerCase() && p !== p.toUpperCase())) return p;
  return p.toLowerCase().replace(/(^|[-'’])(\p{L})/gu, (m, s, l) => s + l.toUpperCase());
}

function create({ db, mailtpl, sendEmail, gmailUser, host, testMode, dataDir, intervalMs = 5000, dailyMax = 150 }) {
  // Secret de signature des liens de désinscription : variable UNSUB_SECRET, sinon tiré au hasard une fois et gardé sur le serveur
  // (indépendant du mot de passe du CRM : changer de mot de passe ne casse pas les liens déjà envoyés).
  const secret = (() => {
    if (process.env.UNSUB_SECRET) return process.env.UNSUB_SECRET;
    const f = path.join(dataDir, 'campagne-secret.key');
    try { const s = fs.readFileSync(f, 'utf8').trim(); if (s.length >= 32) return s; } catch (e) { /* première fois */ }
    const s = crypto.randomBytes(32).toString('hex');
    try { fs.writeFileSync(f, s, { mode: 0o600 }); } catch (e) { console.error('⚠️ Campagne : secret non enregistré :', e.message); }
    return s;
  })();
  const jeton = (email) => crypto.createHmac('sha256', secret).update('desinscription|' + norm(email)).digest('base64url').slice(0, 32);
  const lienDesinscription = (email) => 'https://' + host + '/desinscription?t=' + jeton(email);
  // L'e-mail n'apparaît jamais dans l'adresse : on retrouve la personne en recalculant la signature de chaque adresse connue.
  function emailDuJeton(t) {
    t = String(t || '');
    if (!/^[A-Za-z0-9_-]{32}$/.test(t)) return null;
    const { leads, clients } = db.campagneSources();
    const vus = new Set([...leads.map((l) => norm(l.email)), ...clients.map((c) => norm(c.email)), ...Object.keys(db.campagneEtat(ID).sent), norm(TEST_TO)]);
    const b = Buffer.from(t);
    for (const e of vus) { if (e && crypto.timingSafeEqual(Buffer.from(jeton(e)), b)) return e; }
    return null;
  }

  function calculer() {
    const { leads, clients, quotes, interventions } = db.campagneSources();
    const etat = db.campagneEtat(ID);
    const propres = new Set([gmailUser, TEST_TO, 'contact@reynov-jantes.fr'].filter(Boolean).map(norm));
    const clientParId = new Map(clients.map((c) => [c.id, c])), leadParId = new Map(leads.map((l) => [l.id, l]));
    const fiches = new Map();
    const prendre = (email, prenom, nom, groupe) => {
      const e = norm(email); if (!EMAIL_RE.test(e)) return;
      let f = fiches.get(e); if (!f) { f = { email: e, prenom: '', nom: '', groupes: new Set() }; fiches.set(e, f); }
      if (!f.prenom && prenom) f.prenom = String(prenom).trim();
      if (!f.nom && nom) f.nom = String(nom).trim();
      f.groupes.add(groupe);
    };
    interventions.forEach((i) => { if (INTER_CLIENT.includes(i.statut)) { const c = clientParId.get(i.client_id); if (c) prendre(c.email, c.prenom, c.nom, 'intervention'); } });
    leads.forEach((l) => { if (l.status === 'gagne') prendre(l.email, l.prenom, l.nom, 'gagne'); });
    quotes.forEach((q) => {
      if (q.status !== 'accepte') return;
      const l = q.lead_id ? leadParId.get(q.lead_id) : null, c = q.client_id ? clientParId.get(q.client_id) : null;
      if (l && l.email) prendre(l.email, l.prenom, l.nom, 'devis'); else if (c) prendre(c.email, c.prenom, c.nom, 'devis');
    });
    const inclure = new Set(etat.inclure.map(norm)), exclure = new Set(etat.exclure.map(norm));
    clients.forEach((c) => { const e = norm(c.email); if (inclure.has(e) && !fiches.has(e)) prendre(c.email, c.prenom, c.nom, 'manuel'); });
    const stop = new Set(leads.filter((l) => l.relance && l.relance.stop).map((l) => norm(l.email)).filter(Boolean));
    const blocage = (e) => db.plusOffresDe(e) ? 'Désinscrit' : stop.has(e) ? '« Ne plus relancer »' : (propres.has(e) || TEST_RE.test(e)) ? 'Adresse de test ou de REYNOV' : '';
    const destinataires = [], exclus = [];
    const comptes = { intervention: 0, gagne: 0, devis: 0, manuel: 0 };
    for (const f of fiches.values()) {
      const raison = blocage(f.email) || (exclure.has(f.email) ? 'Retiré à la main' : '');
      const s = etat.sent[f.email], k = etat.failed[f.email];
      const ligne = { email: f.email, prenom: f.prenom, nom: [f.prenom, f.nom].filter(Boolean).join(' '), groupes: [...f.groupes].map((g) => GROUPES[g]),
        envoye_le: s ? s.at : null, simule: s ? !!s.simule : false, echec: !s && k ? k.error : null };
      if (raison) exclus.push({ ...ligne, raison, manuel: raison === 'Retiré à la main' });
      else { destinataires.push(ligne); f.groupes.forEach((g) => { comptes[g]++; }); }
    }
    // Fiches clients sans achat enregistré (créées automatiquement à chaque demande) : jamais incluses d'office.
    const sansAchat = [], vus = new Set(fiches.keys());
    clients.forEach((c) => {
      const e = norm(c.email); if (!EMAIL_RE.test(e) || vus.has(e)) return; vus.add(e);
      sansAchat.push({ email: e, nom: [c.prenom, c.nom].filter(Boolean).join(' '), bloque: blocage(e) || null });
    });
    const tri = (a, b) => (a.nom || a.email).localeCompare(b.nom || b.email, 'fr');
    destinataires.sort(tri); exclus.sort(tri); sansAchat.sort(tri);
    return { destinataires, exclus, sansAchat, comptes };
  }

  const imageChoisie = () => (db.campagneEtat(ID).image === 'sans-texte' ? 'sans-texte' : 'avec-texte');
  function rendre(d, lien) {
    return { sujet: mailtpl.BF_SUJET, html: mailtpl.bfOffer({ prenom: joliPrenom(d.prenom), unsubscribeUrl: lien, image: imageChoisie() }) };
  }
  const entetes = (lien) => [`List-Unsubscribe: <${lien}>, <mailto:${gmailUser || TEST_TO}?subject=STOP>`, 'List-Unsubscribe-Post: List-Unsubscribe=One-Click'];
  async function envoyerA(to, d) {
    const lien = lienDesinscription(to);
    const { sujet, html } = rendre(d, lien);
    if (testMode) return { simule: true };
    if (!gmailUser) throw new Error('Gmail n\'est pas configuré sur le serveur');
    // origine « crm » : la synchronisation Gmail ne prend pas ces envois pour des réponses (ils sont notés ici)
    await sendEmail({ from: `"REYNOV" <${gmailUser}>`, to, subject: sujet, html, origin: 'crm', headers: entetes(lien) });
    return { simule: false };
  }

  const envoyesLe = (jour) => Object.values(db.campagneEtat(ID).sent).filter((s) => jourParis(Date.parse(s.at)) === jour).length;
  let job = null;
  const etatJob = () => job && { en_cours: job.running, total: job.total, envoyes: job.envoyes, erreurs: job.erreurs, debut: job.debut, fin: job.fin || null, motif: job.motif || '', par: job.par };

  async function boucle(emails) {
    for (let k = 0; k < emails.length; k++) {
      if (job.stop) { job.motif = 'Arrêté à la demande'; break; }
      if (Date.now() >= FIN) { job.motif = 'L\'offre est terminée'; break; }
      if (envoyesLe(jourParis(Date.now())) >= dailyMax) { job.motif = 'Limite du jour atteinte (' + dailyMax + ' e-mails) : reprenez demain'; break; }
      const d = calculer().destinataires.find((x) => x.email === emails[k]);    // revérifié juste avant l'envoi (désinscription entre-temps…)
      if (!d || d.envoye_le) continue;
      try {
        const r = await envoyerA(d.email, d);
        const etat = db.campagneEtat(ID);
        etat.sent[d.email] = { at: new Date().toISOString(), simule: !!r.simule };
        delete etat.failed[d.email];
        db.noterCampagne(d.email, 'E-mail Black Friday envoyé' + (r.simule ? ' (simulation : mode test, rien n\'est parti)' : ''));
        job.envoyes++;
      } catch (e) {
        const etat = db.campagneEtat(ID), f = etat.failed[d.email] || {};
        etat.failed[d.email] = { at: new Date().toISOString(), error: String(e.message || e).slice(0, 200), n: (f.n || 0) + 1 };
        job.erreurs++;
        console.error('❌ Campagne ' + ID + ' :', String(e.message || e).slice(0, 200));
        if (job.erreurs >= 3 && !job.envoyes) { job.motif = 'Arrêté : 3 échecs d\'affilée (vérifiez Gmail dans les paramètres)'; db.campagneSave(); break; }
      }
      db.campagneSave();
      if (k < emails.length - 1) await attendre(intervalMs);
    }
    if (!job.motif) job.motif = 'Terminé';
    job.running = false; job.fin = new Date().toISOString();
  }

  return {
    ID, FIN, TEST_TO,
    etat() {
      const r = calculer(), aujourdHui = envoyesLe(jourParis(Date.now()));
      return {
        id: ID, fin: new Date(FIN).toISOString(), ouverte: Date.now() < FIN, sujet: mailtpl.BF_SUJET, preheader: mailtpl.BF_PREHEADER,
        comptes: r.comptes, destinataires: r.destinataires, exclus: r.exclus, sans_achat: r.sansAchat,
        a_envoyer: r.destinataires.filter((d) => !d.envoye_le).length, deja_envoyes: r.destinataires.filter((d) => d.envoye_le).length,
        aujourdhui: aujourdHui, limite_jour: dailyMax, intervalle_s: Math.round(intervalMs / 1000), job: etatJob(),
        test_to: TEST_TO, test_mode: !!testMode, gmail: !!gmailUser,
        image: imageChoisie(), images: Object.keys(mailtpl.BF_IMAGES).map((k) => ({ id: k, src: mailtpl.BF_IMAGES[k].src.replace(mailtpl.BASE, '') })),
        apercu: rendre({ prenom: 'Prénom' }, 'https://' + host + '/desinscription?t=apercu').html,
      };
    },
    choix(email, inclure) {
      const e = norm(email); if (!EMAIL_RE.test(e)) return { error: 'Adresse invalide.' };
      const etat = db.campagneEtat(ID);
      etat.inclure = etat.inclure.filter((x) => norm(x) !== e); etat.exclure = etat.exclure.filter((x) => norm(x) !== e);
      if (inclure === true) etat.inclure.push(e); else if (inclure === false) etat.exclure.push(e);
      db.campagneSave(); return { ok: true };
    },
    // Réponse « STOP » reçue sur reynov.lyon@gmail.com (lien mailto de l'e-mail) : même effet que le lien « se désinscrire ».
    stop(email) {
      const e = norm(email); if (!EMAIL_RE.test(e)) return { error: 'Adresse e-mail invalide.' };
      db.marquerPlusOffres(e, 'réponse « STOP »'); return { ok: true };
    },
    image(choix) {
      if (!mailtpl.BF_IMAGES[choix]) return { error: 'Image inconnue.' };
      if (job && job.running) return { error: 'Envoi en cours : l\'image ne peut plus changer.' };
      db.campagneEtat(ID).image = choix; db.campagneSave(); return { ok: true };
    },
    async test(prenom) {
      if (job && job.running) return { error: 'Envoi en cours : attendez la fin ou arrêtez-le avant un test.' };
      const r = await envoyerA(TEST_TO, { prenom });
      return { ok: true, to: TEST_TO, simule: r.simule };
    },
    lancer(par, attendu) {
      if (job && job.running) return { error: 'Un envoi est déjà en cours.' };
      if (Date.now() >= FIN) return { error: 'L\'offre est terminée : la campagne ne peut plus partir.' };
      if (!testMode && !gmailUser) return { error: 'Gmail n\'est pas configuré sur le serveur.' };
      const liste = calculer().destinataires.filter((d) => !d.envoye_le);
      if (!liste.length) return { error: 'Tous les destinataires ont déjà reçu l\'e-mail.' };
      if (Number(attendu) !== liste.length) return { error: 'La liste a changé depuis son affichage : rechargez et vérifiez avant d\'envoyer.' };
      const reste = dailyMax - envoyesLe(jourParis(Date.now()));
      if (reste <= 0) return { error: 'Limite de ' + dailyMax + ' e-mails atteinte aujourd\'hui : reprenez demain.' };
      job = { running: true, stop: false, total: liste.length, envoyes: 0, erreurs: 0, debut: new Date().toISOString(), par: par || '' };
      boucle(liste.map((d) => d.email)).catch((e) => { job.running = false; job.motif = 'Erreur : ' + e.message; });
      return { ok: true, total: liste.length, aujourdhui_max: Math.min(reste, liste.length) };
    },
    arreter() { if (job && job.running) { job.stop = true; return { ok: true }; } return { error: 'Aucun envoi en cours.' }; },
    // Désinscription (lien de l'e-mail, ou bouton « Se désinscrire » de la messagerie en un clic). Aucune connexion demandée.
    desinscrire(t) {
      if (t === 'apercu') return { apercu: true };
      const e = emailDuJeton(t); if (!e) return { invalide: true };
      db.marquerPlusOffres(e, 'lien de désinscription');
      return { ok: true };
    },
    page(statut, titre, texte) {
      return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${esc(titre)} · REYNOV</title><link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32.png">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#f4f5f7;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}main{max-width:460px;padding:40px 24px}p.m{margin:0 0 26px;font-size:13px;font-weight:700;letter-spacing:.3em}h1{margin:0 0 12px;font-size:26px;line-height:1.25}p{margin:0 0 14px;color:#b9bcc4}a{color:#fff}</style></head>
<body><main><p class="m">REYNOV</p><h1>${esc(titre)}</h1><p>${texte}</p><p><a href="https://${host}/">reynov-jantes.fr</a></p></main></body></html>`;
    },
  };
}

module.exports = { create, joliPrenom, TEST_RE };
