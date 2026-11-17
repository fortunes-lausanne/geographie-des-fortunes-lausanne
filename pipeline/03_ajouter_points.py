#!/usr/bin/env python3
"""Ajoute de NOUVEAUX points (nouveaux contribuables / nouvelles années) à data.js.

Usage :  python3 03_ajouter_points.py nouveaux_points.csv
Options : --data js/data.js   --geocoder   --force

Le CSV (modèle : exemples/nouveaux_points_modele.csv) a une ligne par point :
  nom ; annee ; fortune ; profession ; adresse_transcrite ; adresse_moderne ; url_catima ; E_MN95 ; N_MN95 ; id_obs (facultatif)

RÈGLE DU PROJET : si l'information manque, le point n'est PAS placé.
  - E_MN95 / N_MN95 remplis  -> le point est placé là.
  - E/N vides + option --geocoder -> l'adresse MODERNE est géocodée (swisstopo, adresse précise exigée).
  - sinon -> le point est écrit dans points_non_places.csv avec la raison ; rien n'est inventé.
"""
import argparse, shutil, json, urllib.parse, urllib.request
from carte_lib import *

def geocoder(adresse):
    """Adresse moderne -> (E, N) via l'API de recherche de swisstopo, ou None."""
    q = urllib.parse.urlencode({'searchText': adresse + ' Lausanne', 'type': 'locations',
                                'origins': 'address', 'sr': 2056, 'limit': 1})
    try:
        r = json.load(urllib.request.urlopen('https://api3.geo.admin.ch/rest/services/api/SearchServer?' + q, timeout=15))
        a = r['results'][0]['attrs']
        return a['y'], a['x']          # swisstopo renvoie y = Est, x = Nord
    except Exception:
        return None

ap = argparse.ArgumentParser()
ap.add_argument('csv'); ap.add_argument('--data'); ap.add_argument('--geocoder', action='store_true')
ap.add_argument('--force', action='store_true', help='ajouter même si (nom, année) existe déjà')
a = ap.parse_args()
chemin = trouver_data_js(a.data)
cfg = charger(chemin)
existants = {(d['nom'].strip().lower(), y) for y, d in points(cfg)}
ids = {str(d['id_obs']) for _, d in points(cfg)}
prochain = max([int(i) for i in ids if i.isdigit()] + [0]) + 1
ajoutes, refuses = 0, []

def num(v):
    try: return float(str(v).replace(',', '.').replace("'", '').replace('’', '').strip())
    except ValueError: return None

for r in lire_csv(a.csv):
    nom = (r.get('nom') or '').strip()
    annee = int(num(r.get('annee')) or 0)
    fortune = num(r.get('fortune'))
    def non(raison): refuses.append({**r, 'raison': raison})
    if not nom or annee not in cfg['YEARS'] or not fortune:
        non('nom, année (parmi %s) ou fortune manquant' % cfg['YEARS']); continue
    if (nom.lower(), annee) in existants and not a.force:
        non('existe déjà (même nom, même année) ; utiliser --force pour forcer'); continue
    E, N, src = num(r.get('E_MN95')), num(r.get('N_MN95')), 'nouveau_coordonnees_fournies'
    if (E is None or N is None) and a.geocoder and (r.get('adresse_moderne') or '').strip() not in ('', '?'):
        g = geocoder(r['adresse_moderne'])
        if g: E, N, src = g[0], g[1], 'nouveau_geocode_swisstopo'
    if E is None or N is None:
        non('position inconnue (pas de coordonnées, adresse moderne absente ou non géocodée)'); continue
    fond = cfg['YR_TO_FOND'][str(annee)]
    x, y = mn95_vers_pixel(E, N, fond)
    w, h = cfg['IMG_DIMS'][fond]
    if not (-1500 <= x <= w + 1500 and -1500 <= y <= h + 1500):
        non('hors du plan historique de %s (vérifier les coordonnées)' % fond); continue
    idobs = (r.get('id_obs') or '').strip() or str(prochain)
    if idobs in ids: idobs = str(prochain)
    prochain = max(prochain, int(idobs) + 1) if idobs.isdigit() else prochain; ids.add(idobs)
    prof = (r.get('profession') or '').strip()
    cfg['PTS'][str(annee)].append({
        'x': round(x, 2), 'y': round(y, 2), 'fortune': int(fortune), 'nom': nom, 'prof': prof or 'inconnu',
        'cat': categorie_de(cfg, prof), 'adr_hist': (r.get('adresse_transcrite') or '').strip(),
        'adr_mod': (r.get('adresse_moderne') or '').strip(), 'url': (r.get('url_catima') or '').strip(),
        'taille': taille_cercle(cfg, fortune), 'id_obs': idobs, 'src': src})
    cfg['FORTUNE_MAX'] = max(cfg['FORTUNE_MAX'], float(fortune))
    ajoutes += 1
if ajoutes:
    shutil.copy(chemin, chemin + '.sauvegarde'); sauver(cfg, chemin)
print(f'{ajoutes} point(s) ajouté(s)' + (f' ; ancienne version : {chemin}.sauvegarde' if ajoutes else ''))
if refuses:
    with open('points_non_places.csv', 'w', encoding='utf-8-sig', newline='') as f:
        cols = list(refuses[0].keys()); f.write(';'.join(cols) + '\r\n')
        for l in refuses: f.write(';'.join(csv_champ(l.get(c)) for c in cols) + '\r\n')
    print(f'{len(refuses)} point(s) NON placé(s) -> points_non_places.csv (raison dans la dernière colonne)')
