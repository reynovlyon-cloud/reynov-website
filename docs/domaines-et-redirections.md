# Domaines, www / sans www et ancien domaine — état au 8 novembre 2026

## 1. Ce qui a été contrôlé
| Test (réseau réel) | Résultat |
|---|---|
| `https://www.reynov-jantes.fr/…` | 200, certificat valide |
| `http://www.reynov-jantes.fr/…` | 301 vers `https://www…` (chemin conservé) |
| `http://reynov-jantes.fr/<page>?a=1` | 301 vers `https://www.reynov-jantes.fr/<page>?a=1` (chemin et paramètres conservés) |
| **`https://reynov-jantes.fr/…` (sans www, en HTTPS)** | **ÉCHEC : connexion refusée (port 443 fermé)** |
| `reynovjantes.fr` (ancien domaine) | ne résout plus (DNS vide) |

### Cause de l'échec HTTPS sans www
`reynov-jantes.fr` (sans www) pointe vers `213.186.33.5`, un serveur de **redirection OVH** (en-tête `server: openresty`). Il ne répond qu'en HTTP : la 301 fonctionne, mais en HTTPS la connexion est refusée **avant** toute redirection. Les liens, backlinks ou saisies en `https://reynov-jantes.fr` aboutissent donc à une erreur.
Le serveur du site (Railway) redirige déjà correctement tout hôte non canonique (`server/redirects.js`), mais il ne reçoit jamais ce trafic : **le réglage se fait chez OVH / dans le DNS, pas dans le dépôt.**

## 2. Corriger le HTTPS sans www (à faire une seule fois)
**Option A (recommandée) — Cloudflare gratuit**
1. Créer un compte Cloudflare (le même que celui de l'ancien domaine, qui l'utilise déjà), « Ajouter un site » : `reynov-jantes.fr`.
2. Chez OVH (Domaines → reynov-jantes.fr → Serveurs DNS), remplacer `dns103.ovh.net / ns103.ovh.net` par les deux serveurs Cloudflare indiqués.
3. Dans Cloudflare → DNS :
   - `www` : CNAME vers l'adresse fournie par Railway (Service → Settings → Networking → domaine personnalisé `www.reynov-jantes.fr`), **nuage gris (DNS seul)**.
   - `@` (racine) : enregistrement A `192.0.2.1`, **nuage orange (proxifié)** — il ne sert qu'à recevoir la requête.
4. Cloudflare → Rules → Redirect Rules → créer : *Si le nom d'hôte est égal à `reynov-jantes.fr`* → Redirection dynamique : `concat("https://www.reynov-jantes.fr", http.request.uri.path)`, code **301**, option **« Conserver la chaîne de requête »** cochée.
5. SSL/TLS → mode « Full ». Cloudflare présente alors un certificat valide sur la racine.

**Option B — rester chez OVH** : dans la zone DNS / Redirections du domaine, modifier la redirection de la racine vers `https://www.reynov-jantes.fr` et activer l'option HTTPS / SSL de la redirection si OVH la propose pour ce domaine (le libellé exact dépend de l'offre ; vérifier avec les commandes ci-dessous).

### Vérification (copier-coller)
```
curl -sI https://reynov-jantes.fr/prestations/renovation.html?x=1   # attendu : 301 + Location: https://www.reynov-jantes.fr/prestations/renovation.html?x=1
curl -sI http://reynov-jantes.fr/blog/                               # attendu : 301 vers https://www.reynov-jantes.fr/blog/
echo | openssl s_client -connect reynov-jantes.fr:443 -servername reynov-jantes.fr 2>/dev/null | openssl x509 -noout -subject -dates
```

## 3. Ce que fait déjà le site (dépôt, déployé)
`server/redirects.js` : **une seule 301** (jamais de chaîne) vers `https://www.reynov-jantes.fr` pour tout hôte non canonique, avec le chemin et les paramètres. Il retire aussi `/index.html` (`/blog/index.html` devient `/blog/`) et renvoie les pages renommées :
| Ancienne adresse | Nouvelle adresse |
|---|---|
| `/blog/prix-reparation-jante-lyon-2025.html` | `/blog/prix-reparation-jante-lyon.html` |
| `/blog/epoxy-ou-peinture-pistolet-jante-difference-lyon.html` | `/blog/peinture-epoxy-jantes-haut-de-gamme-collection.html` |
| `/blog/reconditionnement-jante-mercedes-lyon.html` | `/blog/renovation-jante-mercedes-lyon.html` |
| `/a-propos.html` (page retirée en avril 2026) | `/` (aucune page équivalente : décision à confirmer) |

## 4. Ancien domaine `reynovjantes.fr`
**Constat (registre AFNIC, 8/11/2026)** : statut « redemption period » et « pending delete », serveurs DNS Cloudflare (`anton` / `harmony`), aucun enregistrement DNS actif. Les anciennes pages ne répondent donc plus : aucune redirection n'est possible tant que le domaine n'est pas rétabli.
**Le plus urgent : faire restaurer le domaine auprès du bureau d'enregistrement avant la suppression définitive** (la restauration en période de « redemption » est généralement payante et limitée dans le temps ; la date limite exacte dépend du bureau — la demander immédiatement). Conserver ensuite le domaine plusieurs années.

**Redirections prêtes (une fois le domaine rétabli)** — l'ancien site avait la même arborescence : chaque ancienne page est renvoyée vers **la même page** du nouveau domaine, sans renvoi généralisé vers l'accueil.
- Même chemin conservé : `/devis.html`, `/realisations.html`, `/avis-clients.html`, `/professionnels.html`, `/professionnels/*.html`, `/prestations/*.html`, `/marques/*.html`, `/zones/*.html`, `/blog/*.html`, `/faq.html`, `/contact.html`, `/service-mobile.html`, `/sitemap.xml`, images…
- Pages renommées : voir tableau §3.
- Adresses fantômes de l'ancien site (liens relatifs cassés, ex. `/blog/blog/marques/prestations/index.html`) : renvoyées vers leur **rubrique** (`/blog/`, `/marques/`, `/prestations/`, `/zones/`, `/professionnels.html`), jamais vers l'accueil.
- Page inconnue : même chemin sur le nouveau domaine, qui répond 404.
- Testé en local avec `Host: reynovjantes.fr` : 1 redirection par URL, aucune boucle.

**Deux façons de la mettre en service**
1. *Sans serveur (Cloudflare, déjà utilisé par l'ancien domaine)* : Redirect Rule `http.host in {"reynovjantes.fr" "www.reynovjantes.fr"}` → `concat("https://www.reynov-jantes.fr", http.request.uri.path)`, 301, chaîne de requête conservée ; plus une liste « Bulk Redirect » pour les 3 pages renommées du §3.
2. *Via le site* : ajouter `reynovjantes.fr` et `www.reynovjantes.fr` comme domaines personnalisés du service Railway (les enregistrements DNS demandés par Railway sont à créer dans Cloudflare ; la racine demande la « CNAME flattening » de Cloudflare). `server/redirects.js` s'applique alors automatiquement.

## 5. Search Console (accès non disponible ici)
1. Ajouter une propriété **Domaine** pour `reynov-jantes.fr` et une pour `reynovjantes.fr` (validation par enregistrement TXT dans le DNS).
2. Une fois les redirections en ligne : propriété ancienne → Paramètres → **Changement d'adresse** → choisir `reynov-jantes.fr`. Le renvoi doit être en 301 page par page (c'est le cas).
3. Soumettre `https://www.reynov-jantes.fr/sitemap.xml` ; demander l'indexation de l'accueil, des pages professionnels et de `/zones/lyon.html`.
4. Conserver les redirections **au moins 12 mois**.
5. Ne pas considérer la migration comme seule cause de la baisse : l'indisponibilité, un domaine créé le 15/10/2026 et un historique court pèsent aussi. Mesurer avant/après dans Search Console.

*Limites* : la liste des anciennes URL provient de l'historique du dépôt et des résultats Google observés ; la compléter avec l'export « Pages » de la propriété ancienne dans Search Console (ou la Wayback Machine) dès que le domaine est rétabli.
