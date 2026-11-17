#!/usr/bin/env python3
"""Applique un fichier de corrections (CSV exporté du site) à data.js.

Usage :  python3 02_appliquer_corrections.py corrections_manuelles_2026-10-20.csv
Options : --data js/data.js   --sortie js/data.js (par défaut : remplace data.js, après copie data.js.sauvegarde)

À utiliser si quelqu'un a envoyé son fichier de corrections par mail au lieu de
déposer lui-même un data.js. Colonnes lues : ID observation, Année,
LV95_E_corrige, LV95_N_corrige.
"""
import argparse, shutil
from carte_lib import *

ap = argparse.ArgumentParser()
ap.add_argument('csv'); ap.add_argument('--data'); ap.add_argument('--sortie')
a = ap.parse_args()
chemin = trouver_data_js(a.data)
cfg = charger(chemin)
index = {(str(y), str(d['id_obs'])): d for y, d in points(cfg)}
ok, ko = 0, []
for r in lire_csv(a.csv):
    cle = (str(r.get('Année') or r.get('annee')).strip(), str(r.get('ID observation') or r.get('id_obs')).strip())
    try:
        E = float(str(r.get('LV95_E_corrige') or r.get('E_MN95')).replace(',', '.'))
        N = float(str(r.get('LV95_N_corrige') or r.get('N_MN95')).replace(',', '.'))
    except (TypeError, ValueError):
        ko.append((cle, 'coordonnées illisibles')); continue
    d = index.get(cle)
    if not d:
        ko.append((cle, 'point introuvable (année / id_obs)')); continue
    x, y = mn95_vers_pixel(E, N, cfg['YR_TO_FOND'][cle[0]])
    d['x'], d['y'], d['src'] = round(x, 2), round(y, 2), 'correction_manuelle'
    ok += 1
shutil.copy(chemin, chemin + '.sauvegarde')
sauver(cfg, a.sortie or chemin)
print(f'{ok} correction(s) appliquée(s). Ancienne version : {chemin}.sauvegarde')
for cle, why in ko:
    print('  IGNORÉ', cle, why)
