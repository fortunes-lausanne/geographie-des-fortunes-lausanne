#!/usr/bin/env python3
"""Contrôle de qualité de data.js (à lancer avant de publier).

Usage :  python3 05_verifier.py            (--data js/data.js)
Vérifie : identifiants en double, URL Catima absentes, fortunes nulles, points hors du plan,
points « coin inconnu », nombre de points par année, taille des cercles.
"""
import argparse, collections
from carte_lib import *

ap = argparse.ArgumentParser(); ap.add_argument('--data'); a = ap.parse_args()
cfg = charger(trouver_data_js(a.data))
pb, par_an, ids = [], collections.Counter(), collections.Counter()
noms = collections.Counter()
for y, d in points(cfg):
    par_an[y] += 1; ids[(y, str(d['id_obs']))] += 1; noms[(y, d['nom'].strip().lower())] += 1
    if not str(d.get('url', '')).startswith('https://catima.unil.ch'): pb.append((y, d['nom'], 'URL Catima absente ou inhabituelle'))
    if not d['fortune'] or d['fortune'] <= 0: pb.append((y, d['nom'], 'fortune nulle'))
    f = cfg['YR_TO_FOND'][str(y)]; w, h = cfg['IMG_DIMS'][f]
    m = 3000
    if not (-m <= d['x'] <= w + m and -m <= d['y'] <= h + m): pb.append((y, d['nom'], 'très loin du plan historique (coordonnées erronées ?)'))
    if abs(d['taille'] - taille_cercle(cfg, d['fortune'])) > 0.11: pb.append((y, d['nom'], 'taille du cercle incohérente'))
    if d.get('src') == 'position_approximative_coin': pb.append((y, d['nom'], 'position approximative (coin inconnu) : à placer si possible'))
for k, v in ids.items():
    if v > 1: pb.append((k[0], k[1], 'identifiant id_obs en double'))
for k, v in noms.items():
    if v > 1: pb.append((k[0], k[1], f'nom présent {v} fois la même année (homonymes ? doublon ?)'))
print('Points par année :', dict(sorted(par_an.items())), '| total', sum(par_an.values()))
if not pb:
    print('Aucun problème détecté.')
else:
    groupes = collections.defaultdict(list)
    for y, n, w in pb: groupes[w].append((y, n))
    for w, l in groupes.items():
        ex = ' ; '.join(f'{n} ({y})' for y, n in l[:3])
        print(f'- {w} : {len(l)} cas  (ex. {ex})')
    with open('rapport_verification.csv', 'w', encoding='utf-8-sig') as f:
        f.write('annee;nom;probleme\r\n')
        for y, n, w in pb: f.write(f'{y};{csv_champ(n)};{w}\r\n')
    print('Détail de chaque cas : rapport_verification.csv')
