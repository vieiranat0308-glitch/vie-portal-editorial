#!/usr/bin/env python3
"""Gera a skill "portal-assessoria" a partir deste portal.

Uso (na raiz do projeto):  python3 scripts/gerar-skill.py
Saída: dist/portal-assessoria.zip (e a pasta dist/portal-assessoria/).

O código do portal vira o "modelo": tudo o que é da Vie (nome, cores, fontes,
logos, textos do nicho) é trocado por marcadores como {{EMPRESA}}, que o
scripts/personalizar.py da skill preenche com os dados da empresa nova.
Rode de novo sempre que o portal mudar, para a skill acompanhar.
"""
import os
import re
import shutil
import subprocess
import sys
import zipfile

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SKILL = os.path.join(RAIZ, 'scripts', 'skill')
DIST = os.path.join(RAIZ, 'dist')
SAIDA = os.path.join(DIST, 'portal-assessoria')
TEXTO = ('.js', '.mjs', '.html', '.css', '.json', '.webmanifest', '.md', '.gitignore')

# Arquivos que não vão para o modelo: a própria skill, o gerador e as imagens da Vie
# (o personalizar.py cria os logos e ícones da empresa nova).
FORA = re.compile(r'^(scripts/skill/|scripts/gerar-skill\.py$|public/img/)')

# Ordem importa: do mais específico para o mais geral.
TROCAS = [
    # Textos com nomes de pessoas e do exemplo.
    (r'Criar com o exemplo da Dra\. Izabella', 'Criar com um cliente de exemplo'),
    (r'use \*\*Criar com o exemplo da Dra\. Izabella\*\*', 'use **Criar com um cliente de exemplo**'),
    (r' \(como o da Dra\. Izabella\)', ''),
    (r'pelo exemplo da Dra\. Izabella', 'por um cliente de exemplo'),
    (r'Ex\.: Dra\. Izabella Rebello', 'Ex.: Clínica Bem Estar'),
    (r'Ex\.: Izabella', 'Ex.: Ana'),
    (r' \(como o da Due Medicina\)', ''),
    (r'traz a linha editorial da Dra\. Izabella como exemplo', 'traz um cliente de exemplo (linha editorial, ideias, métricas)'),
    (r"process\.env\.ADMIN_NOME \|\|= 'Natalia'", "process.env.ADMIN_NOME ||= '{{NOME_ADMIN}}'"),
    (r'\(ex\.: Natalia\)', '(ex.: {{NOME_ADMIN}})'),
    (r'admin@vie\.local', 'admin@portal.local'),
    (r'contato@viecompany\.com\.br', '{{EMAIL_CONTATO}}'),
    (r'portal\.viecompany\.com\.br', '{{DOMINIO}}'),
    # Identidade visual.
    (r'Cores da marca: terracota `#8a391b` e creme `#f1e6b2`, com chocolate e areia de apoio',
     'Cores da marca: principal `{{COR_PRINCIPAL}}`, clara `{{COR_CLARA}}`, escura `{{COR_ESCURA}}` e fundo `{{COR_FUNDO}}`'),
    (r'logo-creme\.png', 'logo-clara.png'),
    (r'logo-terracota\.png', 'logo-escura.png'),
    (r'https://fonts\.googleapis\.com/css2\?[^"\s)]+', '{{GOOGLE_FONTES_URL}}'),
    (r"'Black Mango', 'Bodoni Moda'", "'{{FONTE_TITULO}}', '{{GOOGLE_TITULO}}'"),
    (r"'BW Modelica', 'Bw Modelica', 'Outfit'", "'{{FONTE_TEXTO}}', '{{GOOGLE_TEXTO}}'"),
    (r"'BW Modelica', 'Outfit'", "'{{FONTE_TEXTO}}', '{{GOOGLE_TEXTO}}'"),
    (r'Bodoni Moda e Outfit', '{{GOOGLE_TITULO}} e {{GOOGLE_TEXTO}}'),
    (r'Black Mango', '{{FONTE_TITULO}}'),
    (r'BW Modelica', '{{FONTE_TEXTO}}'),
    # Nicho (saúde) e nomes.
    (r'O marketing do seu consultório, mês a mês, em um só lugar\.', '{{FRASE_LOGIN}}'),
    (r'Marketing para a área da saúde', '{{NICHO}}'),
    (r'Novos pacientes', '{{RESULTADO}}'),
    (r'Portal Assessoria<br>de Marketing', '{{PORTAL}}'),
    (r'Portal Assessoria de Marketing', '{{PORTAL}}'),
    (r'(?<![A-Za-zÀ-ÿ])da Vie Company', '{{DA_EMPRESA}}'),
    (r'Vie Company', '{{EMPRESA}}'),
    (r'(?<![A-Za-zÀ-ÿ])Da Vie(?![A-Za-z])', '{{DA_MARCA_M}}'),
    (r'(?<![A-Za-zÀ-ÿ])da Vie(?![A-Za-z])', '{{DA_MARCA}}'),
    (r'(?<![A-Za-zÀ-ÿ])pela Vie(?![A-Za-z])', '{{PELA_MARCA}}'),
    (r'(?<![A-Za-zÀ-ÿ])A Vie(?![A-Za-z])', '{{A_MARCA_M}}'),
    (r'(?<![A-Za-zÀ-ÿ])a Vie(?![A-Za-z])', '{{A_MARCA}}'),
    # "Vie" sozinho, fora de nomes de código como cronogramaVie ou driveVie.
    (r'(?<![A-Za-z])Vie(?![A-Za-z])', '{{MARCA}}'),
]

# Paleta: as cores da Vie viram marcadores (o personalizar.py calcula as derivadas).
CORES = {
    '#8a391b': 'COR_PRINCIPAL', '#22150f': 'COR_ESCURA', '#2e1d15': 'COR_ESCURA_2', '#3f281d': 'COR_ESCURA_3',
    '#f1e6b2': 'COR_CLARA', '#d4c28c': 'COR_CLARA_2', '#efe9e3': 'COR_FUNDO', '#f6f1ec': 'COR_SUPERFICIE',
    '#fcfaf7': 'COR_CARTAO', '#e3d9ce': 'COR_LINHA', '#d0c2b4': 'COR_LINHA_2', '#2b1a14': 'COR_TEXTO',
    '#7d6a60': 'COR_APAGADO', '#a8988e': 'COR_APAGADO_2',
}

# O que não pode sobrar no modelo (fora o cliente de exemplo, que é só demonstração).
SOBRAS = re.compile(r'(?<![A-Za-z])Vie(?![A-Za-z])|viecompany|Natalia|consultório|terracota `|Izabella')


def tokenizar(texto, caminho):
    for padrao, troca in TROCAS:
        texto = re.sub(padrao, troca, texto)
    if not caminho.startswith('lib/exemplo.js'):
        for cor, nome in CORES.items():
            texto = re.sub(re.escape(cor), '{{' + nome + '}}', texto, flags=re.I)
    return texto


def main():
    arquivos = subprocess.run(['git', 'ls-files'], cwd=RAIZ, capture_output=True, text=True, check=True).stdout.split()
    if os.path.exists(SAIDA):
        shutil.rmtree(SAIDA)
    modelo = os.path.join(SAIDA, 'modelo')
    avisos = []
    for rel in arquivos:
        if FORA.match(rel):
            continue
        origem = os.path.join(RAIZ, rel)
        alvo = os.path.join(modelo, rel)
        os.makedirs(os.path.dirname(alvo), exist_ok=True)
        if rel.endswith(TEXTO) and not rel.startswith('public/vendor/') and rel != 'package-lock.json':
            with open(origem, encoding='utf-8') as f:
                conteudo = tokenizar(f.read(), rel)
            if not rel.startswith('lib/exemplo.js'):
                for n, linha in enumerate(conteudo.splitlines(), 1):
                    if SOBRAS.search(linha):
                        avisos.append(f'{rel}:{n}: {linha.strip()[:120]}')
            with open(alvo, 'w', encoding='utf-8') as f:
                f.write(conteudo)
        else:
            shutil.copy2(origem, alvo)

    # Arquivos da skill (SKILL.md, referências, scripts e o exemplo de marca.json).
    for raiz, _, nomes in os.walk(SKILL):
        for nome in nomes:
            origem = os.path.join(raiz, nome)
            rel = os.path.relpath(origem, SKILL)
            alvo = os.path.join(SAIDA, rel)
            os.makedirs(os.path.dirname(alvo), exist_ok=True)
            shutil.copy2(origem, alvo)

    zip_caminho = os.path.join(DIST, 'portal-assessoria.zip')
    with zipfile.ZipFile(zip_caminho, 'w', zipfile.ZIP_DEFLATED) as z:
        for raiz, _, nomes in os.walk(SAIDA):
            for nome in nomes:
                caminho = os.path.join(raiz, nome)
                z.write(caminho, os.path.join('portal-assessoria', os.path.relpath(caminho, SAIDA)))

    if avisos:
        print('! Ainda há marcas da Vie no modelo (ajuste o TROCAS deste script):')
        print('\n'.join('  ' + a for a in avisos))
    print(f'✓ Skill gerada: {os.path.relpath(zip_caminho, RAIZ)} ({os.path.getsize(zip_caminho) // 1024} KB)')
    return 1 if avisos else 0


if __name__ == '__main__':
    sys.exit(main())
