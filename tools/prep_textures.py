#!/usr/bin/env python3
"""
prep_textures.py – erzeugt Avas Texturen aus den Microsoft-Rocketbox-Originalen (MIT).

Ava = Kopf/Haare von "Female_Party_01" (natürlich blond, blaue Augen, Gesichts-Blendshapes)
    + Outfit/Körper von "Female_Party_02" (gemustertes Shirt mit Gürtel, schwarzer Minirock).
Beide Modelle nutzen dasselbe Biped-Skelett (identische Bind-Pose).

Schritte:
  * TGA → JPG/PNG, verkleinert für Handys (Farbe 2048, Normal 1024, Spec 512, Haar-Opacity 1024)
  * Körper-Hautton (Arme/Beine/Hals von Party_02) an den Gesichts-Hautton von Party_01 angleichen
  * Ohrringe von Türkis nach Gold umgefärbt; Haar wärmer (Goldblond)
  * Shirt-Muster von Braun nach Beere/Rosé umgefärbt (stilvoller zum schwarzen Minirock)

Aufruf:  python3 tools/prep_textures.py <Rocketbox-Repo>/Assets/Avatars/Adults
© 2026 Michael Sedlazek
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/rb/Assets/Avatars/Adults'
HEAD = os.path.join(ROOT, 'Female_Party_01', 'Textures', 'f010_')
BODY = os.path.join(ROOT, 'Female_Party_02', 'Textures', 'f022_')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'model')

def f32(im): return np.asarray(im, np.float32) / 255
def u8(a): return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))

def hsv(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn + 1e-6
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, d / (mx + 1e-6), mx

def save_jpg(im, name, size, q=82):
    im.convert('RGB').resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), quality=q, optimize=True, progressive=True)
    print('→', name, size)

def head_texture():
    rgb = f32(Image.open(HEAD + 'head_color.tga').convert('RGB'))
    h, s, v = hsv(rgb)
    # Türkis-Ohrringe → Gold (Farbton ~180° → ~43°, Helligkeit leicht angehoben)
    teal = np.clip((s - 0.06) / 0.12, 0, 1) * ((h > 150) & (h < 215))
    teal = f32(u8(teal).filter(ImageFilter.GaussianBlur(1.5)).convert('L'))
    lum = rgb @ np.array([0.3, 0.59, 0.11], np.float32)
    gold = np.stack([lum * 1.22 + 0.04, lum * 0.98 + 0.03, lum * 0.58], -1)
    rgb = rgb * (1 - teal[..., None]) + np.clip(gold, 0, 1) * teal[..., None]
    return rgb

def skin_stats(rgb, mask):
    sel = rgb[mask > 0.5]
    return sel.mean(0), sel.std(0)

def main():
    os.makedirs(OUT, exist_ok=True)
    # --- Kopf (Party_01) ------------------------------------------------------
    head = head_texture()
    save_jpg(u8(head), 'head_color.jpg', 2048)
    # Haut-Referenz: Hals/Dekolleté (grenzt an den Körper)
    hh, hs, hv = hsv(head)
    ref = np.zeros(hv.shape, np.float32); ref[1070:1390, 670:1390] = 1
    ref *= (hv > 0.35) & (hs > 0.15) & (hs < 0.7) & (hh > 5) & (hh < 45)
    mu_h, sd_h = skin_stats(head, ref)
    # --- Körper (Party_02) ----------------------------------------------------
    body = f32(Image.open(BODY + 'body_color.tga').convert('RGB'))
    bh, bs, bv = hsv(body)
    geo = Image.new('L', (2048, 2048), 255); d = ImageDraw.Draw(geo)
    d.rectangle([640, 0, 1400, 1640], fill=0)        # Shirt + Gürtel (mittlerer Streifen)
    d.rectangle([100, 1030, 580, 1340], fill=0)      # Rock links
    d.rectangle([1460, 1030, 1945, 1340], fill=0)    # Rock rechts
    geo = f32(geo)
    skin = geo * (bv > 0.22) * (bs > 0.12) * (bs < 0.85) * (bh > 3) * (bh < 48)
    mu_b, sd_b = skin_stats(body, skin)
    print('skin head', mu_h.round(3), 'body', mu_b.round(3))
    skin = f32(u8(skin).filter(ImageFilter.GaussianBlur(3)).convert('L'))
    # Farbübertragung (Mittelwert/Streuung je Kanal), 85 % Stärke
    matched = (body - mu_b) * (sd_h / np.maximum(sd_b, 1e-3)) * 0.9 + mu_h
    k = 0.85 * skin[..., None]
    body = body * (1 - k) + np.clip(matched, 0, 1) * k
    # Shirt: altmodisches Braun-Rauten-Muster → elegantes Beere/Rosé (Muster bleibt dezent sichtbar)
    lumb = body @ np.array([0.3, 0.59, 0.11], np.float32)
    strip = np.zeros(lumb.shape, np.float32); strip[0:1640, 640:1400] = 1
    cloth = f32(u8((lumb > 0.09).astype(np.float32)).filter(ImageFilter.GaussianBlur(10)).convert('L'))
    cloth = np.clip((cloth - 0.2) / 0.3, 0, 1) * strip
    t = np.clip((lumb - 0.05) / 0.55, 0, 1) ** 0.9
    stops = np.array([[0.0, 0.13, 0.025, 0.06], [0.45, 0.42, 0.08, 0.17], [1.0, 0.93, 0.70, 0.76]])
    berry = np.stack([np.interp(t, stops[:, 0], stops[:, c + 1]) for c in range(3)], -1)
    body = body * (1 - cloth[..., None]) + berry * cloth[..., None]
    save_jpg(u8(body), 'body_color.jpg', 2048)
    # --- Haar-Opacity (Party_01): leicht wärmer + etwas mehr Kontrast ----------
    op = f32(Image.open(HEAD + 'opacity_color.tga').convert('RGBA'))
    rgb, a = op[..., :3], op[..., 3:]
    lum = rgb @ np.array([0.3, 0.59, 0.11], np.float32)
    # Goldblond statt Strohgelb: Mitteltöne etwas dunkler (Tiefe), wärmer, leicht gesättigter
    l2 = lum ** 1.3
    warm = ((rgb - lum[..., None]) * 1.3 + l2[..., None]) * np.array([1.03, 0.96, 0.84], np.float32)
    rgb = np.clip(warm, 0, 1)
    Image.fromarray((np.dstack([rgb, a]) * 255 + 0.5).astype(np.uint8), 'RGBA') \
        .resize((1024, 1024), Image.LANCZOS) \
        .quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG) \
        .save(os.path.join(OUT, 'opacity_color.png'), optimize=True)   # 256-Farben-PNG: ~280 KB statt 1,2 MB
    print('→ opacity_color.png 1024')
    # --- Normal-/Specular-Maps --------------------------------------------------
    save_jpg(Image.open(HEAD + 'head_normal.tga'), 'head_normal.jpg', 1024, 86)
    save_jpg(Image.open(BODY + 'body_normal.tga'), 'body_normal.jpg', 1024, 86)
    save_jpg(Image.open(HEAD + 'head_specular.tga'), 'head_spec.jpg', 512)
    save_jpg(Image.open(BODY + 'body_specular.tga'), 'body_spec.jpg', 512)

if __name__ == '__main__':
    main()
