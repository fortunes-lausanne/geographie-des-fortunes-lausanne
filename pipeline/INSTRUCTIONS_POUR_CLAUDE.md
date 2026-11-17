# Instructions pour un assistant IA (Claude) — reprise du projet « Riches à Lausanne »

À lire en premier si on te confie ce dossier. L'utilisateur est probablement un·e chercheur·euse peu à l'aise en informatique :
parle simplement, fais les opérations toi-même, explique ce que tu as fait.

## Contexte
Projet de recherche UNIL sur les contribuables fortunés de Lausanne (8 registres fiscaux : 1867, 1887, 1900, 1913, 1923, 1936, 1953, 1955).
Site public : carte interactive (GitHub Pages), dépôt `fortunes-lausanne/geographie-des-fortunes-lausanne`. Fichiers clés :
`index.html` (public), `admin.html` (éditeur local, jamais publié), `js/data.js` (toutes les données), `js/app.js`, `images/` (fonds de carte).

## Règles impératives
1. Info manquante → la signaler, **ne pas placer** le point. Ne jamais inventer une position.
2. L'adresse **moderne** prime sur l'adresse transcrite.
3. Priorité : correction manuelle > bâtiment swisstopo (≤ 30 m) > coordonnée brute/géocodée > « coin inconnu ».
4. Coordonnées en **MN95 = LV95 = EPSG:2056**.
5. Ne jamais supprimer de données ; garder `data.js.sauvegarde` ; relancer `pipeline/05_verifier.py` avant publication.
6. Ne pas publier sur GitHub à la place de l'utilisateur sans son accord explicite ; lui donner les étapes (GitHub web → Add file → Upload files → `js/data.js`).

## Demandes fréquentes → quoi faire
* « Exporte les points pour ma publication » → `01_exporter_points.py --geojson --xlsx`, livrer le CSV/Excel (colonnes E_MN95, N_MN95).
* « J'ai reçu un fichier de corrections » → `02_appliquer_corrections.py fichier.csv`, puis `05_verifier.py`, puis fournir le nouveau `js/data.js`.
* « Ajoute ces nouveaux contribuables » → mettre les données dans le modèle `exemples/nouveaux_points_modele.csv`, `03_ajouter_points.py ... --geocoder`, lire `points_non_places.csv`, demander les informations manquantes.
* « Refais la carte de chaleur / densité » → `04_carte_densite.py` (voir options ; images dans `images/`).
* « Le site ne se met pas à jour » → vérifier l'onglet Actions du dépôt (workflow `static.yml` doit être vert), attendre 1–2 min, vider le cache du navigateur.
* « Je veux changer l'apparence / ajouter une fonction » → modifier `css/style.css` ou `js/app.js` (et `admin.html` en miroir), tester dans un navigateur, vérifier qu'un clic sur un point ouvre bien la fiche et que le bouton Catima fonctionne.

## Pièges connus
* Une fonction manquante dans `app.js` casse tout le clic sur les points : tester après chaque modification.
* `index.html` public : `body class="public"` et `window.PUBLIC_VIEW=true` masquent l'éditeur ; ne pas les retirer.
* `FOND_TRANSFORM` existe en double (`js/app.js` et `pipeline/carte_lib.py`) : toute recalibration d'un fond doit être faite aux deux endroits.
* Le dossier Git local est lié à GitHub Desktop : ne pas le déplacer ni le renommer.
* Aucun avis juridique n'a été donné sur la phrase de protection affichée sur le site ; ne pas la présenter comme validée.
