// =============================================================
//  GLOW STRIKE : service worker
//  Il garde le jeu en mémoire sur le téléphone pour qu'il marche SANS connexion.
//
//  À FAIRE à chaque mise à jour du jeu : changer le numéro de VERSION ci-dessous
//  (par exemple "glow-strike-v2"). Sinon certains téléphones gardent l'ancienne version plus longtemps.
// =============================================================
const VERSION = "glow-strike-v1";
const PAGE = "./glowstrike.html";

// Les fichiers du jeu, gardés en mémoire dès l'installation
const FICHIERS = [PAGE, "./glowstrike-manifest.json", "./glowstrike-192.png", "./glowstrike-512.png"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(VERSION)
            // un fichier manquant ne bloque pas les autres
            .then((cache) => Promise.all(FICHIERS.map((f) => cache.add(f).catch(() => {}))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            // on supprime les anciennes versions du jeu gardées en mémoire
            .then((noms) => Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const requete = event.request;
    if (requete.method !== "GET") return;

    const url = new URL(requete.url);
    if (url.origin !== self.location.origin) return;      // tout ce qui vient d'ailleurs passe normalement par internet

    event.respondWith(repondre(event, requete));
});

// Principe : on répond tout de suite avec la copie gardée en mémoire (rapide, marche sans internet),
// et en même temps on va chercher la version la plus récente pour la prochaine fois.
async function repondre(event, requete) {
    const cache = await caches.open(VERSION);
    const enMemoire = await cache.match(requete, { ignoreSearch: requete.mode === "navigate" });

    const internet = fetch(requete.url, { cache: "no-cache" })
        .then((reponse) => {
            const utilisable = reponse && reponse.ok && !reponse.redirected;
            if (utilisable) cache.put(requete, reponse.clone()).catch(() => {});
            return reponse;
        })
        .catch(() => null);     // pas d'internet : on ne fait pas d'erreur

    if (enMemoire) {
        event.waitUntil(internet);    // laisse le temps de finir la mise à jour en arrière-plan
        return enMemoire;
    }

    const reponse = await internet;
    if (reponse) return reponse;

    // Pas d'internet et rien en mémoire : pour une page, on montre le jeu
    if (requete.mode === "navigate") {
        const accueil = await cache.match(PAGE);
        if (accueil) return accueil;
    }
    return Response.error();
}
