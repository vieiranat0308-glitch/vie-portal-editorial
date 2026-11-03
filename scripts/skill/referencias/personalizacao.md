# Ajustes por empresa e nicho

O `personalizar.py` já troca nome, artigos, cores, fontes, logos, ícones e os textos de nicho do login e da métrica. Revise também:

## Serviços padrão
`api/clientes.js → SERVICOS_PADRAO` (id, nome, cor, abas). Exemplos:
- Agência de restaurantes: Gestão de Instagram, Produção de conteúdo (foto e vídeo), Tráfego pago, Cardápio digital.
- Assessoria de imprensa: troque abas que não fazem sentido (ex.: sem `evolucao`).
Ids só com letras minúsculas, números e hífen. A divisão do cronograma (`cronogramaVie`) costuma ficar no serviço de gestão de redes.

## Cliente de exemplo
`lib/exemplo.js` cria um cliente de demonstração (uma médica, com linha editorial, ideias, métricas e evolução). Para outro nicho, reescreva os textos (objetivo, pilares, bio, ideias) com um caso do nicho novo, ou mantenha e avise que é só para testar.

## Palavras do nicho
```bash
grep -rn "pacientes\|consultório\|saúde\|médic" public api lib --include=*.js
```
- `pacientes` aparece como nome de campo das métricas (`m.pacientes`): **não renomeie o campo**, só os rótulos que o usuário vê (o `resultado` do marca.json já cuida do principal: “Novos pacientes”).
- Placeholders e dicas em `public/js/paginas/*.js` podem citar Instagram, reels, consultório: ajuste o tom.

## Cores
`public/css/estilo.css` (`:root`): `--terracota`/`--acc` = principal, `--choc` = escura, `--creme` = clara, `--bg` = fundo. Os nomes das variáveis ficaram os originais; só os valores mudam. Cores de status e formato (reel, carrossel…) são neutras e podem ficar.
Use só cores sólidas (sem texturas) e mantenha contraste: texto escuro no fundo claro, logo claro no menu escuro.

## Fontes
Com arquivos da fonte da marca (com licença para web): coloque em `public/fonts/`, crie `@font-face` no topo do `estilo.css` com o mesmo nome usado em `fontes.titulo`/`fontes.texto`. As do Google ficam como reserva.

## Logos e ícones
`public/img/logo-clara.png` (fundo escuro: menu, login, carregamento), `logo-escura.png` (fundo claro), ícones `app-192.png`, `app-512.png`, `app-maskable-512.png`, `apple-touch-icon.png`, `icone.png`. Para refazer os ícones com o logo definitivo, rode o `personalizar.py` de novo numa pasta nova ou gere à mão (símbolo centralizado em quadrado da cor escura, ~66% da largura; maskable ~50%).

## Textos que mencionam a agência
O nome curto entra em frases como “Cronograma da agência”, “A agência vai publicar”, “equipe X”. Se alguma frase ficar estranha com o nome novo (ex.: nomes no plural), ajuste à mão com `grep -rn "<marca>" public api`.
