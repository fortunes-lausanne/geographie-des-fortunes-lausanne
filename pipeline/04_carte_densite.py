#!/usr/bin/env python3
"""Carte de densité de la fortune (affiche SVG A3 + aperçu PNG).

Usage simple :   python3 04_carte_densite.py --images ../images
Options :
  --annees 1887 1953       années à comparer (de 1 à 4)
  --fond 1889              carte Siegfried servant de fond (fichier images/<fond>.jpg)
  --cadre E0 E1 N0 N1      fenêtre en MN95 (défaut : zone élargie lac–Pully–Renens)
  --bw 180                 écart-type du lissage en mètres (plus grand = plus flou)
  --sortie poster2_densite.svg
Les paramètres exacts de calcul sont décrits dans la « Fiche méthode ».
"""
import argparse, os
import numpy as np, matplotlib
matplotlib.use('Agg')
import logging; logging.getLogger('matplotlib.font_manager').setLevel(logging.ERROR)
import matplotlib.pyplot as plt
from matplotlib import rcParams
from PIL import Image
from carte_lib import *
Image.MAX_IMAGE_PIXELS = None

ap = argparse.ArgumentParser()
ap.add_argument('--data'); ap.add_argument('--images', default='images')
ap.add_argument('--annees', type=int, nargs='+', default=[1887, 1953])
ap.add_argument('--fond', default='1889')
ap.add_argument('--cadre', type=float, nargs=4, default=[2533900., 2542300., 1149900., 1156700.])
ap.add_argument('--bw', type=float, default=180.)
ap.add_argument('--sortie', default='poster_densite.svg')
a = ap.parse_args()
cfg = charger(trouver_data_js(a.data))
E0, E1, N0, N1 = a.cadre; BW = a.bw
LABELS = {1867: '1867 — Plan Lebet', 1887: '1887 — Belle Époque', 1900: '1900', 1913: '1913 — Avant-guerre',
          1923: '1923', 1936: '1936 — Entre-deux-guerres', 1953: '1953 — Après-guerre', 1955: '1955'}
rcParams['svg.fonttype'] = 'none'
rcParams['font.family'] = ['Liberation Serif', 'DejaVu Serif']

# ----- fond de carte désaturé (Siegfried, georef. sans rotation)
t = FOND_TRANSFORM[a.fond]
im = Image.open(os.path.join(a.images, a.fond + '.jpg')).convert('L'); W, H = im.size
sx0, sx1 = int((E0 - t['c']) / t['p1']), int((E1 - t['c']) / t['p1'])
sy0, sy1 = int((N1 - t['d']) / t['p4']), int((N0 - t['d']) / t['p4'])
crop = Image.new('L', (sx1 - sx0, sy1 - sy0), 255)
crop.paste(im.crop((max(sx0, 0), max(sy0, 0), min(sx1, W), min(sy1, H))), (max(-sx0, 0), max(-sy0, 0)))
tw = 2100; crop = crop.resize((tw, int(tw * crop.size[1] / crop.size[0])), Image.LANCZOS)
arr = 1 - 0.55 * (1 - np.asarray(crop).astype(float) / 255); arr = np.where(arr > 0.97, 1, arr)
base = (arr * 255).astype(np.uint8)

# ----- densité gaussienne pondérée par la fortune
GX, GY = np.meshgrid(np.linspace(E0, E1, 420), np.linspace(N0, N1, 340))
def densite(annee):
    pts = [(p[0], p[1], d['fortune']) for _, d in [(annee, d) for d in cfg['PTS'][str(annee)]]
           for p in [position_mn95(cfg, annee, d)] if p]
    D = np.zeros_like(GX)
    for E, N, f in pts:
        D += f * np.exp(-((GX - E) ** 2 + (GY - N) ** 2) / (2 * BW ** 2))
    return D, pts
res = {y: densite(y) for y in a.annees}
FR = np.array([0.04, 0.09, 0.17, 0.28, 0.42, 0.60, 0.80]); cols = plt.cm.Blues(np.linspace(0.25, 0.95, len(FR)))

# ----- mise en page (points PostScript, A3 portrait)
PWpg, PHpg = 841.889764, 1190.551181
n = len(a.annees); PW = 560. if n <= 2 else 430.
PH = PW * (N1 - N0) / (E1 - E0); left = (PWpg - PW) / 2
LY = 122 + n * (PH + 24) - 8
H_tot = max(PHpg, LY + 54.7 + 4 * 14.9 + 8)
if H_tot - PHpg < 2: H_tot = PHpg
fig = plt.figure(figsize=(PWpg / 72, H_tot / 72), facecolor='#faf9f6')
INK, GR = '#0b0b0b', '#726f68'
T = lambda x, y, s, **k: fig.text(x / PWpg, 1 - y / H_tot, s, **k)
T(46.3, 41.7, 'CARTE DE DENSITÉ', fontsize=10.5, color=GR)
T(46.3, 66.7, 'Dessiner les « beaux quartiers » plutôt que les supposer', fontsize=25, fontweight='bold', color=INK)
T(46.3, 92.9, 'Lissage spatial de la fortune déclarée (kernel density, pondérée) — ' + ' et '.join(map(str, a.annees)) + ' en regard',
  fontsize=12, style='italic', color='#3a3a38')
ext = [E0, E1, N0, N1]; top = 122.
for k, y in enumerate(a.annees):
    D, pts = res[y]; mx = D.max(); LV = FR * mx
    ax = fig.add_axes([left / PWpg, 1 - (top + PH) / H_tot, PW / PWpg, PH / H_tot])
    ax.imshow(base, extent=ext, origin='upper', cmap='gray', vmin=0, vmax=255, interpolation='bilinear', aspect='equal')
    ax.contourf(GX, GY, D, levels=list(LV) + [mx * 10], colors=cols, alpha=0.55, antialiased=True)
    ax.contour(GX, GY, D, levels=LV, colors='#1f4e8c', linewidths=0.35, alpha=0.7)
    dedans = [p for p in pts if E0 <= p[0] <= E1 and N0 <= p[1] <= N1]
    ax.scatter([p[0] for p in dedans], [p[1] for p in dedans], s=1.6, c='#111', linewidths=0, zorder=5)
    ax.set_xlim(E0, E1); ax.set_ylim(N0, N1); ax.axis('off')
    ax.text(E0 + 160, N1 - 190, LABELS.get(y, str(y)), fontsize=14, fontweight='bold', color=INK, va='top', bbox=dict(fc='white', ec='none', alpha=0.75, pad=2.5))
    hors = len(pts) - len(dedans)
    ax.text(E1 - 120, N1 - 130, 'n = %d contribuables' % len(pts) + (' (dont %d hors cadre)' % hors if hors else ''), fontsize=8, color='#4a4843', ha='right', va='top', bbox=dict(fc='white', ec='none', alpha=0.75, pad=2))
    if k == 0:
        ax.annotate('', xy=(E1 - 380, N1 - 560), xytext=(E1 - 380, N1 - 1000), arrowprops=dict(arrowstyle='-|>', color=INK, lw=1.2))
        ax.text(E1 - 380, N1 - 1120, 'N', fontsize=9, ha='center', va='top', color=INK)
        ax.plot([E0 + 250, E0 + 2250], [N0 + 260, N0 + 260], color=INK, lw=2.2, solid_capstyle='butt')
        for e in (E0 + 250, E0 + 1250, E0 + 2250): ax.plot([e, e], [N0 + 260, N0 + 380], color=INK, lw=1)
        ax.text(E0 + 1250, N0 + 470, '2 km', fontsize=8, ha='center', color=INK)
    top += PH + 24
ly = top - 8
T(left, ly + 10, 'Densité de fortune (niveaux relatifs au maximum de chaque date) :', fontsize=8, color=GR)
for i, c in enumerate(cols):
    ax = fig.add_axes([(left + 270 + i * 26) / PWpg, 1 - (ly + 12) / H_tot, 24 / PWpg, 10 / H_tot]); ax.set_facecolor(c); ax.set_xticks([]); ax.set_yticks([])
    for s in ax.spines.values(): s.set_visible(False)
T(left + 270, ly + 22, 'faible', fontsize=7, color=GR, va='top'); T(left + 270 + len(cols) * 26, ly + 22, 'forte', fontsize=7, color=GR, ha='right', va='top')
foot = ['Estimation par noyau gaussien (kernel density estimation, écart-type de %d m) de la fortune déclarée, pondérée par le montant de fortune de chaque contribuable ;' % BW,
        'niveaux de densité relatifs au maximum de chaque date. Points noirs : position réelle de chaque contribuable.',
        'Fond de carte : Siegfried %s, désaturé. Sources : Superfichier Catima · swisstopo.' % a.fond,
        'Rémi Luthi — « Les beaux quartiers : riches et richesse à Lausanne, 1890–1970 » — UNIL']
for i, s in enumerate(foot): T(46.3, LY + 54.7 + i * 14.9, s, fontsize=7.3, color=GR)
fig.savefig(a.sortie, facecolor=fig.get_facecolor())
fig.savefig(a.sortie.rsplit('.', 1)[0] + '_apercu.png', dpi=110, facecolor=fig.get_facecolor())
print('Carte écrite :', a.sortie, {y: len(res[y][1]) for y in res}, 'points')
