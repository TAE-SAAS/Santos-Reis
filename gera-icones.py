# Gera os ícones do site a partir de icon.jpg.
from PIL import Image, ImageDraw
import os

FONTE = 'icon.jpg'
SAIDA = 'icones'
CREME = (245, 234, 216)   # --color-bg, para o ícone do iOS que não aceita transparência

os.makedirs(SAIDA, exist_ok=True)
im = Image.open(FONTE).convert('RGB')

# 1. Acha o emblema: tudo que não é o branco do fundo.
cinza = im.convert('L')
mascara = cinza.point(lambda v: 255 if v < 244 else 0)
caixa = mascara.getbbox()
print('emblema em', caixa)

# 2. Recorta um quadrado centrado no emblema, com uma folga mínima.
cx = (caixa[0] + caixa[2]) / 2
cy = (caixa[1] + caixa[3]) / 2
lado = max(caixa[2] - caixa[0], caixa[3] - caixa[1])
lado = int(lado * 1.02)
esq = int(cx - lado / 2); topo = int(cy - lado / 2)
quadrado = Image.new('RGB', (lado, lado), (255, 255, 255))
quadrado.paste(im.crop((max(0, esq), max(0, topo), min(im.width, esq + lado), min(im.height, topo + lado))),
               (max(0, -esq), max(0, -topo)))

# 3. Máscara circular desenhada 4x maior e reduzida: é o que dá a borda lisa,
#    sem o serrilhado que aparece ao desenhar o círculo no tamanho final.
def circular(base, tamanho):
    grande = base.resize((tamanho * 4, tamanho * 4), Image.LANCZOS)
    m = Image.new('L', (tamanho * 4, tamanho * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, tamanho * 4 - 1, tamanho * 4 - 1), fill=255)
    out = Image.new('RGBA', (tamanho * 4, tamanho * 4), (0, 0, 0, 0))
    out.paste(grande.convert('RGBA'), (0, 0), m)
    return out.resize((tamanho, tamanho), Image.LANCZOS)

for t in (512, 192, 32):
    circular(quadrado, t).save(f'{SAIDA}/icone-{t}.png')
    print('gerado', f'icone-{t}.png')

# 4. .ico com vários tamanhos, para o que ignora os PNGs declarados.
circular(quadrado, 256).save(f'{SAIDA}/favicon.ico', sizes=[(16,16),(32,32),(48,48),(64,64)])
print('gerado favicon.ico')

# 5. Ícone do iOS: quadrado e opaco. O iOS recorta sozinho, e transparência
#    naquele formato vira fundo preto na tela de início.
ios = Image.new('RGB', (180, 180), CREME)
disco = circular(quadrado, 180)
ios.paste(disco, (0, 0), disco)
ios.save(f'{SAIDA}/icone-ios-180.png')
print('gerado icone-ios-180.png')
