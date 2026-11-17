# Pipeline « Riches à Lausanne » — outils pour gérer les données et les cartes sans Rémi

Ce dossier contient de petits programmes (Python) qui font tout ce que le site ne fait pas tout seul :
exporter les points, ajouter de nouveaux contribuables, régénérer les cartes de densité, contrôler les données.
**Ils sont conçus pour être lancés par une personne à l'aise avec l'informatique ou, plus simplement,
par un assistant IA (Claude) à qui on donne ce dossier : voir `INSTRUCTIONS_POUR_CLAUDE.md`.**

## L'idée générale (à comprendre en 1 minute)

* La **source de vérité** est le fichier `js/data.js` du site : il contient tous les points (nom, fortune, adresse,
  lien Catima, position). Le site web (`index.html`) ne fait que l'afficher.
* Chaque position est stockée en *pixels du plan historique* de l'année ; les outils la convertissent en
  coordonnées **MN95** (= LV95 = EPSG:2056 ; E ≈ 2 53x xxx, N ≈ 1 15x xxx).
* Circuit normal : corriger dans le site → exporter `data.js` → le déposer sur GitHub → le site public se met à jour.
  Les scripts ci-dessous couvrent les cas où ce circuit ne suffit pas.

## Installation (une seule fois)

```
pip install -r requirements.txt
```
Il faut Python 3.9 ou plus. Les scripts se lancent depuis le dossier du site (celui qui contient `js/` et `images/`),
par ex. `python3 pipeline/01_exporter_points.py`. Chaque script accepte `--aide`/`-h` et `--data chemin/vers/data.js`.

## Les 5 scripts

| Script | À quoi il sert | Exemple |
|---|---|---|
| `01_exporter_points.py` | Exporte **tous les points en coordonnées MN95** (CSV ; option GeoJSON pour QGIS, option Excel) pour une publication ou une carte ailleurs. | `python3 pipeline/01_exporter_points.py --geojson --xlsx` |
| `02_appliquer_corrections.py` | Applique à `data.js` un fichier de corrections `corrections_manuelles_….csv` exporté du site (utile quand il arrive par e-mail). | `python3 pipeline/02_appliquer_corrections.py corrections.csv` |
| `03_ajouter_points.py` | Ajoute de **nouveaux points** depuis un CSV (modèle dans `exemples/`). Si l'information manque, le point n'est **pas placé** et finit dans `points_non_places.csv`. Option `--geocoder` : géocode l'adresse moderne via swisstopo. | `python3 pipeline/03_ajouter_points.py nouveaux.csv --geocoder` |
| `04_carte_densite.py` | Régénère la **carte de densité** (affiche SVG A3 + aperçu PNG) pour les années et la zone voulues. | `python3 pipeline/04_carte_densite.py --annees 1887 1953 --sortie densite.svg` |
| `05_verifier.py` | **Contrôle qualité** avant publication : doublons, liens Catima manquants, points trop éloignés, positions approximatives. | `python3 pipeline/05_verifier.py` |

Chaque script qui modifie `data.js` en garde d'abord une copie `data.js.sauvegarde`.
Après toute modification : lancer `05_verifier.py`, ouvrir `index.html` pour contrôler, puis déposer `data.js` sur GitHub.

## Règles du projet (à respecter)

1. **Si une information manque, on signale et on ne place pas le point** (jamais de position inventée).
2. **L'adresse moderne l'emporte** sur l'adresse transcrite pour positionner un point.
3. Priorité des positions : correction manuelle > bâtiment le plus proche (swisstopo, ≤ 30 m) > coordonnée brute/géocodée > « coin inconnu ».
4. Le site public ne garde que la carte interactive ; l'éditeur (`admin.html`) reste local.
5. Paramètres exacts de calcul des cartes (noyau gaussien de 180 m, niveaux relatifs, fonds Siegfried) : voir la
   « Fiche méthode : paramètres de calcul des cartes » et les valeurs par défaut en tête de `04_carte_densite.py`.

## Ce que ces outils ne refont PAS

Le calcul **initial** des positions à partir du « superfichier » (géocodage, accrochage aux bâtiments, propagation entre
années) a été fait une fois par Rémi ; ses résultats, y compris toutes les corrections manuelles, sont dans `data.js`.
Les fichiers sources (observations par année, superfichiers, géocodage) sont conservés dans `Assistanat/03_Donnees`.
Pour repartir de zéro depuis le superfichier, il faudrait réécrire cette étape en suivant la fiche méthode ; pour la
gestion courante (corriger, ajouter, exporter, cartographier), les scripts ci-dessus suffisent.

## Dépannage rapide

* « data.js introuvable » → ajouter `--data js/data.js` ou se placer dans le dossier du site.
* La carte de densité ne trouve pas le fond → `--images images` (dossier contenant `1889.jpg`).
* Un point ajouté n'apparaît pas → vérifier `points_non_places.csv` (raison indiquée), puis `05_verifier.py`.
