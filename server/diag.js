// Journal technique : garde la trace des démarrages, arrêts, plantages, blocages et pics de mémoire,
// pour comprendre un « Deploy Crashed » sans avoir besoin des journaux Railway. Consultable dans le CRM (Paramètres).
const fs = require('fs');
const path = require('path');

function create({ dir }) {
  const FILE = path.join(dir, 'diag.json');
  let d = { events: [], last_alive: null, last_rss: null, clean: true, boots: 0 };
  try { d = { ...d, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch (e) { /* premier démarrage */ }
  const mb = () => Math.round(process.memoryUsage().rss / 1048576);
  const save = () => { try { fs.writeFileSync(FILE + '.tmp', JSON.stringify(d)); fs.renameSync(FILE + '.tmp', FILE); } catch (e) { /* le journal ne doit jamais gêner le site */ } };
  const add = (type, text) => { d.events.push({ ts: new Date().toISOString(), type, text: String(text).slice(0, 400), rss: mb() }); d.events = d.events.slice(-80); save(); };
  const stack = (e) => String((e && e.stack) || e).split('\n').slice(0, 4).join(' | ');

  if (d.clean === false) add('arret_anormal', 'Le processus précédent ne s\'est pas arrêté proprement (plantage, manque de mémoire ou arrêt forcé). Dernière activité : ' + d.last_alive + ' · mémoire alors : ' + (d.last_rss || '?') + ' Mo');
  d.clean = false; d.boots = (d.boots || 0) + 1;
  add('demarrage', 'Node ' + process.version + ' · démarrage n° ' + d.boots);

  const hb = setInterval(() => { d.last_alive = new Date().toISOString(); d.last_rss = mb(); save(); }, 60 * 1000); hb.unref();
  // Détection d'un blocage du serveur (calcul trop long) et d'une mémoire trop haute
  let last = Date.now(), lastLag = 0, lastMem = 0;
  const lag = setInterval(() => {
    const now = Date.now(), drift = now - last - 1000; last = now;
    if (drift > 2000 && now - lastLag > 60000) { lastLag = now; add('blocage', 'Le serveur a été bloqué ' + Math.round(drift / 1000) + ' s (calcul trop long)'); }
    if (mb() > 420 && now - lastMem > 600000) { lastMem = now; add('memoire', 'Mémoire élevée : ' + mb() + ' Mo'); }
  }, 1000); lag.unref();

  process.on('uncaughtException', (e) => add('exception', stack(e)));
  process.on('unhandledRejection', (e) => add('promesse_rejetee', stack(e)));
  process.on('exit', (code) => { d.clean = true; add('arret', 'Arrêt du processus (code ' + code + ')'); });

  return { note: add, snapshot: () => ({ node: process.version, uptime_s: Math.round(process.uptime()), rss_mb: mb(), boots: d.boots, events: d.events.slice(-40).reverse() }) };
}
module.exports = { create };
