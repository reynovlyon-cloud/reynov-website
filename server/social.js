// Publications Instagram / TikTok : légendes prêtes (modèles sans IA), planification de la semaine,
// et publication automatique sur Instagram via l'API officielle (« Instagram API with Instagram Login »).
// TikTok : la vidéo est préparée et partagée depuis le téléphone (la publication directe TikTok exige une validation de l'application par TikTok).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TZ = 'Europe/Paris';
const TAGS = {
  base: '#reynov #lyon #renovationjantes #jantes #detailing',
  avant_apres: '#avantapres #wheelrestoration #rimrepair #jantesalu #lyon69',
  conseil: '#conseilauto #entretienauto #jantesalu #auto #lyon',
  avis: '#avisclients #satisfaction #artisan #lyon #renovationjantes',
  coulisses: '#atelier #behindthescenes #savoirfaire #lyon #detailing',
  leasing: '#leasing #retourleasing #lld #jantes #lyon',
};

// ── Légendes : modèles écrits à la main, avec les prix et délais publiés sur le site ──
const TIPS = [
  ['Une jante rayée par un trottoir ?', 'Inutile de la remplacer : la rénovation démarre à 130 € HT par jante, avec un résultat qui retrouve la qualité d\'origine. Comptez 24 à 48 h par jante.', 'conseil'],
  ['Volant qui vibre à 110 km/h ?', 'C\'est souvent une jante voilée. Le dévoilage démarre à 140 € HT par jante, réalisé à l\'atelier.', 'conseil'],
  ['Une fissure sur une jante ?', 'On la répare par soudure TIG à partir de 140 € HT, et si elle n\'est pas réparable en sécurité, on vous le dit avant de commencer.', 'conseil'],
  ['Retour de leasing dans quelques semaines ?', 'Remettez vos jantes en état avant la restitution : vous évitez des pénalités souvent bien plus élevées que le coût de la rénovation.', 'leasing'],
  ['Envie d\'un autre style ?', 'Noir satiné, bi-ton, brossé, diamanté : la personnalisation de vos jantes se fait en 2 à 4 jours selon la finition.', 'conseil'],
  ['On vient chez vous.', 'Notre véhicule atelier se déplace 7j/7, de 9h à 19h, à Lyon et 10 à 15 km autour (dès 3 jantes). Terrain privé, sol plat, prise électrique à proximité. Devis gratuit sous 24 h sur photos.', 'conseil'],
  ['Peinture époxy.', 'Une finition d\'exception, qualité d\'origine comme sortie d\'usine, en 3 jours. La teinte se définit avec vous.', 'conseil'],
];
function captionFor(kind, ctx = {}) {
  const veh = [ctx.marque, ctx.modele].filter(Boolean).join(' ');
  const cta = 'Devis gratuit sous 24 h : 06 61 45 35 27 (lien en bio).';
  if (kind === 'avant_apres') {
    return { caption: `Avant / Après${veh ? ' — ' + veh : ''}.\nRénovation de jantes à l'atelier REYNOV, à Lyon : qualité d'origine, garantie satisfaction 30 jours.\n${cta}`, tags: TAGS.base + ' ' + TAGS.avant_apres };
  }
  if (kind === 'avis') {
    return { caption: `5/5 sur 56 avis Google. Merci à vous tous pour votre confiance.\nVotre avis nous aide à faire connaître notre travail.\n${cta}`, tags: TAGS.base + ' ' + TAGS.avis };
  }
  if (kind === 'coulisses') {
    return { caption: `Dans l'atelier REYNOV : décapage, préparation, peinture, vernis. Chaque jante est traitée avec le même soin.\n${cta}`, tags: TAGS.base + ' ' + TAGS.coulisses };
  }
  const t = TIPS[(ctx.n || 0) % TIPS.length];
  return { caption: `${t[0]}\n${t[1]}\n${cta}`, tags: TAGS.base + ' ' + (TAGS[t[2]] || TAGS.conseil) };
}

// ── Heure de Paris → UTC ──
function parisToUtc(dateStr, hm) {
  const [y, m, d] = dateStr.split('-').map(Number), [h, mi] = hm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(guess));
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  const asParis = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  return new Date(guess - (asParis - guess)).toISOString();
}

// ── Instagram ──
const VIDEO_EXT = /\.(mp4|mov|m4v)$/i;
function create({ db, publicUrl, apiBase }) {
  const BASE = apiBase || process.env.IG_GRAPH_BASE || 'https://graph.instagram.com/v21.0';
  const FILE = path.join(db.DATA_DIR, 'ig.json');
  let st = { token: null, refreshed_at: null, last: null };
  try { st = { ...st, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch (e) { /* premier démarrage */ }
  const token = () => st.token || process.env.IG_ACCESS_TOKEN || '';
  const userId = () => process.env.IG_USER_ID || '';
  const configured = () => !!(token() && userId());
  let running = false, timer = null, statusCache = null;
  const persist = () => { try { fs.writeFileSync(FILE + '.tmp', JSON.stringify(st)); fs.renameSync(FILE + '.tmp', FILE); } catch (e) { /* ignoré */ } };

  async function call(method, p, params = {}) {
    const q = new URLSearchParams({ ...params, access_token: token() });
    const r = await fetch(BASE + p + (method === 'GET' ? '?' + q : ''), method === 'GET' ? {} : { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: q });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) { const e = new Error((j.error && (j.error.error_user_msg || j.error.message)) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  }
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  async function waitReady(id, deadline) {
    while (Date.now() < deadline) {
      const s = await call('GET', '/' + id, { fields: 'status_code' });
      if (s.status_code === 'FINISHED') return true;
      if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error('Instagram a refusé la vidéo (format ou durée).');
      await sleep(4000);
    }
    return false;
  }
  const mediaUrl = (post, m) => publicUrl(post.id, m.file);

  // Crée le conteneur Instagram d'une publication (photo, reel, story ou carrousel)
  async function container(post, deadline) {
    const media = post.media || [];
    if (!media.length) throw new Error('Aucun média dans cette publication.');
    const caption = [post.caption, post.hashtags].filter(Boolean).join('\n\n');
    const U = userId();
    if (post.type === 'carousel' || media.length > 1) {
      if (media.length < 2 || media.length > 10) throw new Error('Un carrousel contient de 2 à 10 médias.');
      const kids = [];
      for (const m of media) {
        const isV = VIDEO_EXT.test(m.file);
        const c = await call('POST', '/' + U + '/media', isV ? { media_type: 'VIDEO', video_url: mediaUrl(post, m), is_carousel_item: 'true' } : { image_url: mediaUrl(post, m), is_carousel_item: 'true' });
        if (isV && !(await waitReady(c.id, deadline))) return { pending: c.id };
        kids.push(c.id);
      }
      const c = await call('POST', '/' + U + '/media', { media_type: 'CAROUSEL', children: kids.join(','), caption });
      return { id: c.id };
    }
    const m = media[0], isV = VIDEO_EXT.test(m.file);
    const params = isV ? { media_type: post.type === 'story' ? 'STORIES' : 'REELS', video_url: mediaUrl(post, m) } : (post.type === 'story' ? { media_type: 'STORIES', image_url: mediaUrl(post, m) } : { image_url: mediaUrl(post, m) });
    if (post.type !== 'story') params.caption = caption;
    const c = await call('POST', '/' + U + '/media', params);
    if (isV && !(await waitReady(c.id, deadline))) return { pending: c.id };
    return { id: c.id };
  }

  async function publishPost(post) {
    const deadline = Date.now() + 100 * 1000;
    let cid = post.ig && post.ig.pending;
    if (cid) { if (!(await waitReady(cid, deadline))) return { pending: cid }; }
    else { const c = await container(post, deadline); if (c.pending) return c; cid = c.id; }
    const pub = await call('POST', '/' + userId() + '/media_publish', { creation_id: cid });
    let permalink = '';
    try { permalink = (await call('GET', '/' + pub.id, { fields: 'permalink' })).permalink || ''; } catch (e) { /* facultatif */ }
    return { id: pub.id, permalink };
  }

  async function refreshToken() {
    if (!token()) return;
    const age = st.refreshed_at ? (Date.now() - Date.parse(st.refreshed_at)) / 86400000 : 99;
    if (age < 20) return;
    try {
      const r = await fetch('https://graph.instagram.com/refresh_access_token?' + new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token() }));
      const j = await r.json();
      if (j.access_token) { st.token = j.access_token; st.refreshed_at = new Date().toISOString(); persist(); }
    } catch (e) { /* on réessaiera */ }
  }

  async function tick() {
    if (running || !configured()) return;
    running = true;
    try {
      await refreshToken();
      const due = db.postsList().filter((p) => p.status === 'approuve' && p.scheduled_at && Date.parse(p.scheduled_at) <= Date.now() && (p.platforms || []).includes('instagram') && !(p.done || {}).instagram && (p.tries || 0) < 3);
      for (const p of due.slice(0, 2)) {
        try {
          const r = await publishPost(p);
          if (r.pending) { db.updatePost(p.id, { ig: { pending: r.pending }, error: '' }); continue; }
          const done = { ...(p.done || {}), instagram: new Date().toISOString() };
          const all = (p.platforms || []).every((pl) => done[pl]);
          db.updatePost(p.id, { done, ig: { id: r.id, permalink: r.permalink }, error: '', status: all ? 'publie' : p.status });
          console.log('📣 Publié sur Instagram : #' + p.id);
        } catch (e) {
          const tries = (p.tries || 0) + 1;
          db.updatePost(p.id, { tries, error: 'Instagram : ' + e.message.slice(0, 160) + (tries >= 3 ? ' — abandon après 3 essais : publiez à la main.' : ' — nouvel essai automatique.') });
          console.error('⚠️ Publication Instagram #' + p.id + ' :', e.message);
        }
      }
    } finally { running = false; schedule(); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => tick(), 2 * 60 * 1000); timer.unref && timer.unref(); }
  function start() { if (!configured()) return; timer = setTimeout(() => tick(), 40 * 1000); timer.unref && timer.unref(); }

  async function status() {
    if (!configured()) return { configured: false };
    if (statusCache && Date.now() - statusCache.at < 10 * 60 * 1000) return statusCache.v;
    let v;
    try { const me = await call('GET', '/me', { fields: 'username,user_id' }); v = { configured: true, ok: true, username: me.username || '' }; }
    catch (e) { v = { configured: true, ok: false, error: e.message.slice(0, 160) }; }
    statusCache = { at: Date.now(), v }; return v;
  }
  return { start, tick, status, configured, publishPost };
}

module.exports = { create, captionFor, parisToUtc, TIPS, VIDEO_EXT };
