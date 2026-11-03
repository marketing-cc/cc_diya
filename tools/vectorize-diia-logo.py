#!/usr/bin/env python3
"""
Векторизує офіційне растрове лого Дія (PNG 1024x1024, чорний квадрат із білим написом на прозорому фоні)
у два SVG за брендбуком (https://diia.gov.ua ... Використання_логотипу_Дія_2025.pdf):

  public/diia-logo.svg          — основна версія (чорна заливка, для світлого фону)
  public/diia-logo-outline.svg  — контурна версія (біла обводка + білий напис, для темного фону / чорних кнопок)

Також друкує JS-рядки для вбудовування в скрипт. Потрібні: pip install potracer pillow numpy scipy
  python3 tools/vectorize-diia-logo.py <logo.png>
"""
import sys, os, json
import numpy as np
from PIL import Image
import potrace

src = sys.argv[1]
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
a = np.array(Image.open(src).convert('RGBA')).astype(float)
alpha, lum = a[..., 3], a[..., :3].mean(axis=2)
# «Тіло» лого — непрозорі чорні пікселі. Напис у вихідному PNG — це або прозорі «дірки», або білі пікселі.
body = (alpha > 127) & (lum < 128)
# Силует = усе, що не є зовнішнім фоном. Зовнішній фон = компоненти не-«тіла», що торкаються краю
# (чотири кути — окремі компоненти, а напис всередині краю не торкається).
from scipy import ndimage
labels, _ = ndimage.label(~body)
edge = np.unique(np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]]))
silhouette = ~np.isin(labels, edge[edge != 0])  # квадрат разом із написом
letters = silhouette & ~body                   # напис усередині


def trace(mask, alphamax=1.0, opttol=0.2):
    bm = potrace.Bitmap(~mask)  # potracer малює «темні» (False) пікселі, тому інвертуємо
    return bm.trace(turdsize=4, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=alphamax, opticurve=True, opttolerance=opttol)


def f(v):
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s


def path_d(plist):
    parts = []
    for curve in plist:
        sp = curve.start_point
        parts.append(f'M{f(sp.x)} {f(sp.y)}')
        for seg in curve.segments:
            if seg.is_corner:
                parts.append(f'L{f(seg.c.x)} {f(seg.c.y)}L{f(seg.end_point.x)} {f(seg.end_point.y)}')
            else:
                parts.append(f'C{f(seg.c1.x)} {f(seg.c1.y)} {f(seg.c2.x)} {f(seg.c2.y)} {f(seg.end_point.x)} {f(seg.end_point.y)}')
        parts.append('Z')
    return ''.join(parts)


d_square = path_d(trace(silhouette))
d_letters = path_d(trace(letters))

# Основна версія: чорний квадрат, напис — «дірки» (evenodd), щоб фон просвічував як у оригіналі
filled = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="64" height="64" role="img" aria-label="Дія">'
          f'<path fill="#000" fill-rule="evenodd" d="{d_square}{d_letters}"/></svg>')

# Контурна версія: біла обводка по контуру квадрата (всередині, щоб не вилазити за viewBox) + білий напис
STROKE = 28  # у 1024-системі координат; ≈ товщина контуру з брендбука (стор. 8)
outline = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="64" height="64" role="img" aria-label="Дія">'
           f'<defs><clipPath id="diia-clip"><path d="{d_square}"/></clipPath></defs>'
           f'<path fill="none" stroke="#fff" stroke-width="{STROKE * 2}" clip-path="url(#diia-clip)" d="{d_square}"/>'
           f'<path fill="#fff" d="{d_letters}"/></svg>')

os.makedirs(os.path.join(root, 'public'), exist_ok=True)
open(os.path.join(root, 'public', 'diia-logo.svg'), 'w', encoding='utf-8').write(filled)
open(os.path.join(root, 'public', 'diia-logo-outline.svg'), 'w', encoding='utf-8').write(outline)
json.dump({'filled': filled, 'outline': outline}, open('/tmp/diia-logo-svgs.json', 'w'), ensure_ascii=False)
print('filled', len(filled), 'B; outline', len(outline), 'B')
