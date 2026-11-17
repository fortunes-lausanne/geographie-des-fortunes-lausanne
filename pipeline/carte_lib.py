"""Fonctions communes du pipeline « Riches à Lausanne ».

Rien à lancer ici : ce fichier est utilisé par les scripts 01 à 05.

Principe : le fichier js/data.js du site est la SOURCE DE VÉRITÉ des positions.
Chaque point y est stocké en pixels du plan historique d'origine de son année
(« fond natif »). Les fonctions ci-dessous convertissent ces pixels en
coordonnées suisses MN95 (= LV95 = EPSG:2056) et inversement.
"""
import json
import math
import os
import sys

ENTETE = ("// Donnees de la carte (genere par le pipeline) : positions, fortunes, "
          "transformations des fonds.\n")

# Transformation affine pixel -> MN95 :  E = p1*x + p2*y + c ;  N = p3*x + p4*y + d
# (identique à FOND_TRANSFORM dans js/app.js ; si l'un change, changer l'autre.)
FOND_TRANSFORM = {
    '1867': dict(p1=1.1711883120033941, p2=-0.0021619134859065525, p3=-7.411121508652979e-05, p4=-1.1911788278618474, c=2535423.7445432455, d=1155188.8149150808),
    '1896': dict(p1=1.306114, p2=-2.25e-05, p3=-2.25e-05, p4=-1.306121, c=2535403.0, d=1155051.843),
    '1937': dict(p1=1.306672, p2=-2.55e-05, p3=-2.55e-05, p4=-1.306681, c=2535402.522, d=1155049.059),
    '1959': dict(p1=1.306277, p2=-0.00011325, p3=-0.00011325, p4=-1.306289, c=2535402.57, d=1155048.384),
    '1873': dict(p1=1.25, p2=0.0, p3=0.0, p4=-1.25, c=2533700.0, d=1160400.0),
    '1889': dict(p1=1.25, p2=0.0, p3=0.0, p4=-1.25, c=2533700.0, d=1160400.0),
    '1894': dict(p1=1.24840396, p2=1.30804816e-05, p3=0.000265509241, p4=-1.24619279, c=2533703.11, d=1160375.32),
    '1926': dict(p1=1.252663441576222, p2=-0.0015753254169226238, p3=-0.0027840611364838975, p4=-1.2448770902657316, c=2533703.1077493024, d=1160379.2847383746),
    '1934': dict(p1=1.25, p2=0.0, p3=0.0, p4=-1.25, c=2533700.0, d=1160400.0),
    '1945': dict(p1=1.25, p2=0.0, p3=0.0, p4=-1.25, c=2533700.0, d=1160400.0),
}


def pixel_vers_mn95(x, y, fond):
    t = FOND_TRANSFORM[str(fond)]
    return t['p1'] * x + t['p2'] * y + t['c'], t['p3'] * x + t['p4'] * y + t['d']


def mn95_vers_pixel(E, N, fond):
    t = FOND_TRANSFORM[str(fond)]
    det = t['p1'] * t['p4'] - t['p2'] * t['p3']
    dE, dN = E - t['c'], N - t['d']
    return (t['p4'] * dE - t['p2'] * dN) / det, (-t['p3'] * dE + t['p1'] * dN) / det


def trouver_data_js(chemin=None):
    """Cherche js/data.js automatiquement si aucun chemin n'est donné."""
    if chemin:
        return chemin
    for c in ('js/data.js', '../js/data.js', 'data.js', '../data.js'):
        if os.path.exists(c):
            return c
    sys.exit("data.js introuvable : indiquer son chemin avec --data chemin/vers/data.js")


def charger(chemin):
    s = open(chemin, encoding='utf-8').read()
    return json.loads(s[s.index('{'):s.rindex('}') + 1])


def sauver(cfg, chemin):
    """Écrit data.js au même format que l'export du site (JSON compact)."""
    with open(chemin, 'w', encoding='utf-8') as f:
        f.write(ENTETE + 'const CONFIG = ' + json.dumps(cfg, ensure_ascii=False, separators=(',', ':')) + ';\n')


def points(cfg):
    """Itère (année:int, point:dict) pour tous les points."""
    for y in cfg['YEARS']:
        for d in cfg['PTS'].get(str(y), []):
            yield y, d


def position_mn95(cfg, annee, d):
    """(E, N) du point, ou None si la position n'est qu'un « coin inconnu »."""
    if d.get('src') == 'position_approximative_coin':
        return None
    return pixel_vers_mn95(d['x'], d['y'], cfg['YR_TO_FOND'][str(annee)])


def taille_cercle(cfg, fortune):
    """Rayon du cercle affiché sur la carte (même formule que le site)."""
    return round(55 * math.sqrt(max(fortune, 0) / cfg['FORTUNE_MAX']), 1)


def categorie_de(cfg, profession):
    """Catégorie professionnelle d'après les professions déjà connues dans data.js."""
    table = {}
    for _, d in points(cfg):
        table.setdefault(d['prof'].strip().lower(), d['cat'])
    return table.get((profession or '').strip().lower(), 'Inconnu' if not profession else 'Autre')


def csv_champ(v):
    s = '' if v is None else str(v)
    if any(ch in s for ch in ';"\n'):
        s = '"' + s.replace('"', '""') + '"'
    return s


def lire_csv(chemin):
    """Lit un CSV (séparateur ; ou ,) en liste de dictionnaires, quel que soit l'encodage Excel."""
    import csv
    for enc in ('utf-8-sig', 'cp1252'):
        try:
            texte = open(chemin, encoding=enc, newline='').read()
            break
        except UnicodeDecodeError:
            continue
    sep = ';' if texte.split('\n', 1)[0].count(';') >= texte.split('\n', 1)[0].count(',') else ','
    return list(csv.DictReader(texte.splitlines(), delimiter=sep))
