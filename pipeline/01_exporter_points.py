#!/usr/bin/env python3
"""Exporte TOUS les points en coordonnées MN95 (CSV, et option GeoJSON / Excel).

Usage simple :   python3 01_exporter_points.py
Options :        --data js/data.js   --sortie points_MN95.csv   --geojson   --xlsx

Le CSV est identique à celui du bouton « Exporter tous les points » du site
(séparateur « ; », ouvrable dans Excel et QGIS, coordonnées E_MN95 / N_MN95).
Les points dont la position n'est qu'un « coin inconnu » n'ont pas de coordonnées.
"""
import argparse, json
from carte_lib import *

ap = argparse.ArgumentParser()
ap.add_argument('--data'); ap.add_argument('--sortie', default='points_MN95.csv')
ap.add_argument('--geojson', action='store_true'); ap.add_argument('--xlsx', action='store_true')
a = ap.parse_args()
cfg = charger(trouver_data_js(a.data))

entete = ['id_obs', 'nom', 'annee', 'fortune_chf', 'profession', 'categorie', 'adresse_transcrite',
          'adresse_moderne', 'url_catima', 'E_MN95', 'N_MN95', 'source_position']
lignes, feats = [], []
for y, d in points(cfg):
    p = position_mn95(cfg, y, d)
    E, N = ('', '') if p is None else (f'{p[0]:.2f}', f'{p[1]:.2f}')
    lignes.append([d['id_obs'], d['nom'], y, d['fortune'], d['prof'], d['cat'], d['adr_hist'],
                   d['adr_mod'], d['url'], E, N, d.get('src', '')])
    if p:
        feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(p[0], 2), round(p[1], 2)]},
                      'properties': dict(zip(entete[:9] + entete[11:], lignes[-1][:9] + lignes[-1][11:]))})
with open(a.sortie, 'w', encoding='utf-8-sig', newline='') as f:
    f.write(';'.join(entete) + '\r\n')
    for l in lignes:
        f.write(';'.join(csv_champ(v) for v in l) + '\r\n')
print(f'{len(lignes)} points écrits dans {a.sortie} ({sum(1 for l in lignes if l[9] == "")} sans coordonnées « coin inconnu »)')
if a.geojson:
    g = a.sortie.rsplit('.', 1)[0] + '.geojson'
    json.dump({'type': 'FeatureCollection', 'name': 'points_MN95',
               'crs': {'type': 'name', 'properties': {'name': 'urn:ogc:def:crs:EPSG::2056'}}, 'features': feats},
              open(g, 'w', encoding='utf-8'), ensure_ascii=False)
    print('GeoJSON (EPSG:2056, lisible dans QGIS) :', g)
if a.xlsx:
    import openpyxl
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'points_MN95'; ws.append(entete)
    for l in lignes:
        ws.append([float(v) if i in (9, 10) and v != '' else v for i, v in enumerate(l)])
    x = a.sortie.rsplit('.', 1)[0] + '.xlsx'; wb.save(x); print('Excel :', x)
