// Redirections 301 : une seule étape vers l'adresse canonique (https://www.reynov-jantes.fr), sans chaîne ni boucle.
//  - hôte non canonique (sans www, ancien domaine reynovjantes.fr) -> même page sur www.reynov-jantes.fr
//  - /index.html et /dossier/index.html -> /  et  /dossier/
//  - pages renommées ou supprimées -> page équivalente
// Les paramètres de l'adresse (?utm_source=…) sont conservés.
const fs = require('fs');
const path = require('path');

const CANONICAL = 'www.reynov-jantes.fr';
const OLD_HOST = /^(www\.)?reynovjantes\.fr$/i;
const ROOT = path.join(__dirname, '..');

// Pages renommées ou retirées : chemin d'origine -> équivalent actuel
const MOVED = {
  '/blog/prix-reparation-jante-lyon-2025.html': '/blog/prix-reparation-jante-lyon.html',
  '/blog/epoxy-ou-peinture-pistolet-jante-difference-lyon.html': '/blog/peinture-epoxy-jantes-haut-de-gamme-collection.html',
  '/blog/reconditionnement-jante-mercedes-lyon.html': '/blog/renovation-jante-mercedes-lyon.html',
  '/a-propos.html': '/',   // page « à propos » retirée en avril 2026 : la présentation de l'entreprise est sur l'accueil
};
// Rubriques : une ancienne page introuvable renvoie vers sa rubrique (jamais vers l'accueil)
const SECTIONS = { blog: '/blog/', marques: '/marques/', prestations: '/prestations/', zones: '/zones/', professionnels: '/professionnels.html' };

function exists(p) {
  const full = path.normalize(path.join(ROOT, p));
  if (!full.startsWith(ROOT + path.sep)) return false;
  try { const s = fs.statSync(full); return s.isDirectory() ? fs.existsSync(path.join(full, 'index.html')) : s.isFile(); } catch (e) { return false; }
}
// /dossier/index.html -> /dossier/
const stripIndex = (p) => p.replace(/index\.html$/, '');

// Adresse (chemin) vers laquelle une demande doit être renvoyée ; null = rien à faire
function targetPath(pathname, fromOldDomain) {
  let p = stripIndex(pathname);
  if (MOVED[p]) return MOVED[p];
  if (!fromOldDomain) return p !== pathname ? p : null;
  // ancien domaine : même page si elle existe encore
  const norm = p.replace(/\/{2,}/g, '/');
  if (norm === '/' || exists(norm) || /^\/(assets|api)\//.test(norm) || /^\/(sitemap\.xml|robots\.txt|llms\.txt)$/.test(norm)) return norm;
  // adresses fantômes de l'ancien site (ex. /blog/blog/marques/prestations/index.html) : on retient la première rubrique reconnue
  const first = norm.split('/').filter(Boolean)[0];
  if (SECTIONS[first]) return SECTIONS[first];
  return norm;   // inconnue : même chemin sur le nouveau domaine, qui répondra 404 (pas de renvoi en masse vers l'accueil)
}

function middleware(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path === '/api/health') return next();
  const host = req.hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  const q = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  if (OLD_HOST.test(host)) { const t = targetPath(req.path, true) || req.path; return res.redirect(301, 'https://' + CANONICAL + t + q); }
  if (local || host === CANONICAL) { const t = targetPath(req.path, false); return t ? res.redirect(301, (local ? '' : 'https://' + CANONICAL) + t + q) : next(); }
  const t = targetPath(req.path, false) || req.path;                     // autre hôte (sans www, adresse Railway…)
  return res.redirect(301, 'https://' + CANONICAL + t + q);
}
module.exports = { middleware, targetPath, MOVED, OLD_HOST, CANONICAL };
