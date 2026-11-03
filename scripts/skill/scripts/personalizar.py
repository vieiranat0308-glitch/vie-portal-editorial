#!/usr/bin/env python3
"""Cria um portal novo a partir do modelo, com a marca de outra empresa.

Uso:
  python3 personalizar.py --marca marca.json --destino ./portal-novo

O modelo (pasta ../modelo) tem marcadores como {{EMPRESA}} e {{COR_PRINCIPAL}}.
Este script troca os marcadores pelos dados do marca.json, monta a paleta de
cores derivada, copia os logos e gera os ícones do app.
"""
import argparse
import json
import os
import re
import shutil
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
MODELO = os.path.join(AQUI, '..', 'modelo')
TEXTO = ('.js', '.mjs', '.html', '.css', '.json', '.webmanifest', '.md', '.txt', '.gitignore')


def falhar(msg):
    sys.exit(f'\n✗ {msg}\n')


# ---------- cores ----------
def hex_para_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_para_hex(rgb):
    return '#' + ''.join(f'{max(0, min(255, round(c))):02x}' for c in rgb)


def misturar(a, b, quanto):
    """Mistura a cor a com b: quanto=0 é a, quanto=1 é b."""
    ra, rb = hex_para_rgb(a), hex_para_rgb(b)
    return rgb_para_hex([x + (y - x) * quanto for x, y in zip(ra, rb)])


def paleta(cores):
    principal, escura, clara, fundo = (cores[k] for k in ('principal', 'escura', 'clara', 'fundo'))
    return {
        'COR_PRINCIPAL': principal,
        'COR_ESCURA': escura,
        'COR_ESCURA_2': misturar(escura, '#ffffff', 0.05),
        'COR_ESCURA_3': misturar(escura, '#ffffff', 0.12),
        'COR_CLARA': clara,
        'COR_CLARA_2': misturar(clara, escura, 0.2),
        'COR_FUNDO': fundo,
        'COR_SUPERFICIE': misturar(fundo, '#ffffff', 0.4),
        'COR_CARTAO': misturar(fundo, '#ffffff', 0.8),
        'COR_LINHA': misturar(fundo, escura, 0.07),
        'COR_LINHA_2': misturar(fundo, escura, 0.17),
        'COR_TEXTO': misturar(escura, '#ffffff', 0.05),
        'COR_APAGADO': misturar(escura, fundo, 0.45),
        'COR_APAGADO_2': misturar(escura, fundo, 0.62),
    }


# ---------- validação ----------
SEGURO = re.compile(r"^[\w À-ÿ.,&+!?:()\-–]+$")


def validar(m):
    obrigatorios = ['empresa', 'marca', 'genero', 'portal', 'nicho', 'frase_login', 'resultado', 'cores', 'fontes']
    faltando = [k for k in obrigatorios if not m.get(k)]
    if faltando:
        falhar(f'Faltam no marca.json: {", ".join(faltando)}')
    for k in ['empresa', 'marca', 'portal', 'nicho', 'frase_login', 'resultado']:
        # Os textos entram dentro de código JavaScript e HTML: nada de aspas, crases, < > ou $.
        if not SEGURO.match(m[k]):
            falhar(f'"{k}" tem caracteres que não podem entrar no código (aspas, crase, < > ou $): {m[k]!r}')
    if m['genero'] not in ('a', 'o'):
        falhar('"genero" deve ser "a" (da Vie, a Vie) ou "o" (do Studio, o Studio).')
    for k in ['principal', 'escura', 'clara', 'fundo']:
        if not re.match(r'^#[0-9a-fA-F]{6}$', m['cores'].get(k, '')):
            falhar(f'cores.{k} precisa ser um hex de 6 dígitos, como #8a391b.')
    for k in ['titulo', 'texto', 'google_titulo', 'google_texto']:
        if not re.match(r"^[\w À-ÿ\-]+$", m['fontes'].get(k, '')):
            falhar(f'fontes.{k} precisa ser só o nome da fonte (ex.: Playfair Display).')
    if len(m['marca']) > 12:
        print(f'! "marca" ({m["marca"]}) tem mais de 12 letras: no celular, o nome embaixo do ícone pode ser cortado.')


def substituicoes(m):
    g = m['genero']
    nome = m['marca']
    fontes = m['fontes']
    url = 'https://fonts.googleapis.com/css2?' + '&'.join([
        'family=' + fontes['google_titulo'].replace(' ', '+'),
        'family=DM+Mono:wght@400;500',
        'family=' + fontes['google_texto'].replace(' ', '+'),
        'display=swap',
    ])
    s = {
        'EMPRESA': m['empresa'],
        'DA_EMPRESA': f'd{g} {m["empresa"]}',
        'MARCA': nome,
        'DA_MARCA': f'd{g} {nome}',
        'DA_MARCA_M': f'D{g} {nome}',
        'A_MARCA': f'{g} {nome}',
        'A_MARCA_M': f'{g.upper()} {nome}',
        'PELA_MARCA': f'pel{g} {nome}',
        'PORTAL': m['portal'],
        'NICHO': m['nicho'],
        'FRASE_LOGIN': m['frase_login'],
        'RESULTADO': m['resultado'],
        'FONTE_TITULO': fontes['titulo'],
        'FONTE_TEXTO': fontes['texto'],
        'GOOGLE_TITULO': fontes['google_titulo'],
        'GOOGLE_TEXTO': fontes['google_texto'],
        'GOOGLE_FONTES_URL': url,
        'EMAIL_CONTATO': m.get('email') or 'contato@exemplo.com.br',
        'DOMINIO': m.get('dominio') or 'portal.suaempresa.com.br',
        'NOME_ADMIN': m.get('nome_admin') or 'Equipe',
    }
    s.update(paleta(m['cores']))
    return s


# ---------- imagens ----------
def preparar_imagens(m, destino):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print('! Sem a biblioteca Pillow (pip install pillow): copie os logos e ícones à mão para public/img/.')
        return
    img = os.path.join(destino, 'public', 'img')
    os.makedirs(img, exist_ok=True)
    logos = m.get('logos') or {}
    escura = hex_para_rgb(m['cores']['escura']) + (255,)
    clara = hex_para_rgb(m['cores']['clara']) + (255,)

    def fonte(tamanho):
        for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/Library/Fonts/Arial Bold.ttf', 'C:/Windows/Fonts/arialbd.ttf']:
            if os.path.exists(f):
                return ImageFont.truetype(f, tamanho)
        return ImageFont.load_default()

    def logo_de_texto(cor):
        # Sem logo: escreve o nome da marca (troque depois pelo logo de verdade).
        f = fonte(120)
        caixa = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textbbox((0, 0), m['marca'], font=f)
        im = Image.new('RGBA', (caixa[2] - caixa[0] + 20, caixa[3] - caixa[1] + 20), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((10 - caixa[0], 10 - caixa[1]), m['marca'], font=f, fill=cor)
        return im

    def abrir(chave, cor_texto):
        caminho = logos.get(chave)
        if caminho and os.path.exists(caminho):
            im = Image.open(caminho).convert('RGBA')
            return im.crop(im.getbbox() or (0, 0, im.width, im.height)), True
        return logo_de_texto(cor_texto), False

    clara_im, tem_clara = abrir('clara', clara)
    escura_im, tem_escura = abrir('escura', escura)

    def salvar_logo(im, nome):
        largura = 640
        im = im.resize((largura, max(1, round(im.height * largura / im.width))), Image.LANCZOS) if im.width > largura else im
        im.save(os.path.join(img, nome), optimize=True)

    salvar_logo(clara_im, 'logo-clara.png')
    salvar_logo(escura_im, 'logo-escura.png')

    # Ícone do app: o símbolo (ou o logo claro) centralizado no fundo escuro da marca.
    simbolo, tem_icone = abrir('icone', clara)
    if not tem_icone:
        simbolo = clara_im if tem_clara else logo_de_texto(clara)

    def icone(tamanho, escala, nome, opaco=True):
        base = Image.new('RGBA', (tamanho, tamanho), escura)
        w = round(tamanho * escala)
        h = round(simbolo.height * w / simbolo.width)
        if h > tamanho * escala:
            h = round(tamanho * escala)
            w = round(simbolo.width * h / simbolo.height)
        s = simbolo.resize((max(1, w), max(1, h)), Image.LANCZOS)
        base.alpha_composite(s, ((tamanho - w) // 2, (tamanho - h) // 2))
        (base.convert('RGB') if opaco else base).save(os.path.join(img, nome), optimize=True)

    icone(192, 0.66, 'app-192.png')
    icone(512, 0.66, 'app-512.png')
    icone(512, 0.5, 'app-maskable-512.png')  # margem para o recorte redondo do Android
    icone(180, 0.66, 'apple-touch-icon.png')
    icone(192, 0.7, 'icone.png')
    if not (tem_clara and tem_escura):
        print('! Logo não informado: gerei um logo provisório com o nome da marca. Troque em public/img/ (logo-clara.png e logo-escura.png) e rode de novo para refazer os ícones.')


def main():
    p = argparse.ArgumentParser(description='Cria um portal novo a partir do modelo.')
    p.add_argument('--marca', required=True, help='arquivo marca.json com os dados da empresa')
    p.add_argument('--destino', required=True, help='pasta do portal novo (será criada)')
    p.add_argument('--sobrescrever', action='store_true', help='apaga a pasta de destino se ela já existir')
    a = p.parse_args()

    with open(a.marca, encoding='utf-8') as f:
        marca = json.load(f)
    validar(marca)
    if os.path.exists(a.destino):
        if not a.sobrescrever:
            falhar(f'A pasta {a.destino} já existe. Use outra ou passe --sobrescrever.')
        shutil.rmtree(a.destino)

    subs = substituicoes(marca)
    marcador = re.compile(r'\{\{([A-Z_0-9]+)\}\}')
    sobrou = set()
    for raiz, _, arquivos in os.walk(MODELO):
        for nome in arquivos:
            origem = os.path.join(raiz, nome)
            relativo = os.path.relpath(origem, MODELO)
            if relativo == 'marca.exemplo.json':
                continue
            alvo = os.path.join(a.destino, relativo)
            os.makedirs(os.path.dirname(alvo), exist_ok=True)
            if nome.endswith(TEXTO) and not relativo.startswith(os.path.join('public', 'vendor')):
                with open(origem, encoding='utf-8') as f:
                    conteudo = f.read()
                conteudo = marcador.sub(lambda mt: subs.get(mt.group(1), mt.group(0)), conteudo)
                sobrou.update(marcador.findall(conteudo))
                with open(alvo, 'w', encoding='utf-8') as f:
                    f.write(conteudo)
            else:
                shutil.copy2(origem, alvo)

    preparar_imagens(marca, a.destino)
    if sobrou:
        print(f'! Marcadores sem valor: {", ".join(sorted(sobrou))}')
    print(f'\n✓ Portal criado em {a.destino}')
    print('  Próximos passos: cd para a pasta, npm install, npm run dev (http://localhost:3000, login admin@portal.local / vie12345).')


if __name__ == '__main__':
    main()
