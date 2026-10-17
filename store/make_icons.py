# Genera todos los íconos de la app y los gráficos de la tienda.
# Uso: python make_icons.py <ruta-del-proyecto>   (requiere Pillow)
# Marca provisional: una "P" de parqueadero blanca sobre el violeta de marca
# (`palette.brand` en theme/palette.ts) con una barra cian (`palette.accent`).
# Si algún día hay un logo de verdad, basta con cambiar `draw_mark`.
import os
import sys
from PIL import Image, ImageDraw, ImageFont

root = sys.argv[1]
A = os.path.join(root, 'assets')
S = os.path.join(root, 'store')
os.makedirs(A, exist_ok=True)
os.makedirs(S, exist_ok=True)

BRAND, BRAND_DEEP, ACCENT = (85, 97, 225), (23, 28, 70), (0, 186, 187)   # brand 600, brand 950, accent 400
BRAND_LIGHT, LIGHT_BG, WHITE = (173, 188, 255), (245, 245, 247), (255, 255, 255)
SS = 4  # supersampling para bordes suaves


def font(size, weight='Heavy'):
    path = '/System/Library/Fonts/Avenir Next.ttc'
    if os.path.exists(path):
        f = ImageFont.truetype(path, size)
        try:
            f.set_variation_by_name(weight)
        except Exception:
            # Avenir Next.ttc es una colección: el índice 8 es Heavy.
            f = ImageFont.truetype(path, size, index=8)
        return f
    return ImageFont.load_default(size)


def draw_mark(canvas, frac, color, bar=ACCENT, bg=None, radius=0.0):
    """La "P" centrada ocupando `frac` del alto del lienzo, con barra de acento debajo."""
    big = canvas * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        d.rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * radius), fill=bg + (255,))

    h = big * frac
    f = font(int(h * 1.32))
    l, t, r, b = d.textbbox((0, 0), 'P', font=f)
    gw, gh = r - l, b - t
    bar_h = h * 0.11
    gap = h * 0.08
    total = gh + gap + bar_h
    x = (big - gw) / 2 - l
    y = (big - total) / 2 - t
    d.text((x, y), 'P', font=f, fill=color + (255,))
    if bar:
        by = (big - total) / 2 + gh + gap
        d.rounded_rectangle(((big - gw) / 2, by, (big + gw) / 2, by + bar_h), radius=bar_h / 2, fill=bar + (255,))
    return img.resize((canvas, canvas), Image.LANCZOS)


def solid(size, color):
    return Image.new('RGB', (size, size), color)


# Ícono principal (iOS y respaldo): cuadrado lleno, las tiendas redondean las esquinas.
draw_mark(1024, 0.52, WHITE, bg=BRAND).convert('RGB').save(f'{A}/icon.png')

# Ícono adaptativo de Android: el primer plano debe caber en la zona segura (66 %).
draw_mark(1024, 0.40, WHITE).save(f'{A}/android-icon-foreground.png')
solid(1024, BRAND).save(f'{A}/android-icon-background.png')
draw_mark(1024, 0.40, WHITE, bar=WHITE).save(f'{A}/android-icon-monochrome.png')

# Pantalla de carga (claro y oscuro).
draw_mark(1024, 0.50, BRAND).save(f'{A}/splash-icon.png')
draw_mark(1024, 0.50, BRAND_LIGHT).save(f'{A}/splash-icon-dark.png')

draw_mark(48, 0.62, WHITE, bg=BRAND, radius=0.22).convert('RGB').save(f'{A}/favicon.png')

# Tienda: ícono 512×512 (sin transparencia) y gráfico destacado 1024×500.
draw_mark(512, 0.52, WHITE, bg=BRAND).convert('RGB').save(f'{S}/play-icon-512.png')

W, H = 1024, 500
fg = Image.new('RGB', (W * SS, H * SS), BRAND_DEEP)
d = ImageDraw.Draw(fg)
for i in range(H * SS):  # degradado vertical sutil hacia el violeta de marca
    t = i / (H * SS)
    c = tuple(int(BRAND_DEEP[k] + (BRAND[k] - BRAND_DEEP[k]) * t * 0.55) for k in range(3))
    d.line([(0, i), (W * SS, i)], fill=c)
fg = fg.resize((W, H), Image.LANCZOS)
mark = draw_mark(300, 0.60, WHITE, bg=BRAND, radius=0.24)
fg.paste(mark, (90, (H - 300) // 2), mark)
d = ImageDraw.Draw(fg)
d.text((440, 165), 'ParkNow', font=font(92), fill=WHITE)
d.text((444, 285), 'Reserva tu parqueadero', font=font(40, 'Medium'), fill=BRAND_LIGHT)
d.text((444, 335), 'y llega directo a tu puesto', font=font(40, 'Medium'), fill=BRAND_LIGHT)
fg.save(f'{S}/feature-graphic-1024x500.png')

print('Íconos generados en', A, 'y', S)
