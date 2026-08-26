# Cardápio Pesqueiro Santos Reis

Cardápio online do Pesqueiro Santos Reis. Site estático no Cloudflare Pages, com
cardápio e configuração guardados no Supabase.

**No ar:** https://santos-reis.taeerp.com

## Como funciona

O site é um export do editor de design (`Cardapio Pesqueiro Santo Reis.dc.html`),
renderizado no navegador pelo runtime em `support.js`. O cardápio vem do Supabase:
a página carrega os dados ao abrir, e o painel do proprietário grava de volta.

```
Cardapio Pesqueiro Santo Reis.dc.html   página (export do editor)
support.js                              runtime que renderiza as tags <x-dc>
_ds/organic-.../                        design system: styles.css + bundle
assets/                                 fotos (fonte; publicadas no R2)
build.mjs                               monta a pasta dist/
sync-r2.mjs                             sobe assets/ para o bucket R2
icon.jpg / gera-icones.py               logo e o script que gera os favicons
supabase-cardapio.js                    cliente do banco (login + leitura/escrita)
scroll-cardapio.js                      comportamento de rolagem (fora do componente)
```

## Rodar local

```bash
npm run build
npx serve dist          # ou: python -m http.server 8788 --directory dist
```

## Banco de dados

Projeto Supabase `urnnsxywqvngdbpdovcm`, schema `pesqueiro_santos_reis`:

| tabela | o que guarda |
|---|---|
| `categorias` | seções do cardápio |
| `itens` | pratos e bebidas, com preço e preço de meia porção |
| `item_variacoes` | preços por tamanho ("1 pessoa", "2 pessoas") |
| `destaques` | os "mais pedidos"; aponta para um item ou uma seção inteira |
| `configuracao` | horários, dias, avisos (linha única) |
| `informacoes` | os blocos numerados do rodapé |
| `textos` | frases avulsas do site, buscadas por chave |
| `historico_precos` | valor anterior a cada reajuste, com autor e data |
| `proprietarios` | quem pode editar |

### Segurança

Todas as tabelas têm RLS. Visitante anônimo lê o cardápio e não grava nada. Para
gravar não basta estar autenticado: as políticas exigem uma linha em
`proprietarios`, senão qualquer conta do projeto — inclusive de outros sistemas
nesta mesma base — poderia alterar os preços.

Para dar acesso a mais alguém, crie o usuário no Auth e insira o `user_id` em
`proprietarios`. Não há como fazer isso pela API: é operação de administrador.

A chave em `supabase-cardapio.js` é a publicável (anon), feita para ficar no
navegador. **Nunca** troque pela `service_role`: ela ignora o RLS e este
repositório é público.

## Mídias

As fotos não vão no deploy: ficam no bucket R2 `santos-reis-midia`, servido por
https://midia.taeerp.com. O build reescreve as referências `assets/` para lá.

Ao trocar ou adicionar uma foto em `assets/`:

```bash
npm run sync:midia
```

Os arquivos são servidos com cache de um ano. Para trocar uma imagem existente,
use um nome de arquivo novo — senão os navegadores continuam mostrando a antiga.

### Ícones

`gera-icones.py` recorta `icon.jpg` no emblema, aplica a máscara circular e
gera os tamanhos; depois é só subir a pasta `icones/` para o bucket. O ícone do
iOS sai quadrado e opaco de propósito: o iPhone recorta sozinho, e
transparência ali vira fundo preto na tela de início.

O bucket tem CORS liberado para o domínio do site porque o `site.webmanifest`
aponta para ícones em outra origem, e o navegador busca esses com CORS.

## Deploy

Automático: todo push na branch `main` dispara um build no Cloudflare Pages
(projeto `santos-reis`), que roda `npm run build` e publica `dist/`.

Para alterar o cardápio, edite `Cardapio Pesqueiro Santo Reis.dc.html` e faça push.
Não edite `dist/` — ela é gerada e sobrescrita a cada build.

## Notas

- `build.mjs` injeta `<title>` e as tags Open Graph, que o export do editor não traz.
  Por isso a injeção fica no build e não no HTML: ela sobrevive a um novo export.
- O botão do proprietário fica no rodapé, e o login é o do Supabase Auth. O que o
  dono salva no painel vale para todos os visitantes.
- Se o banco estiver fora do ar, o site mostra a última versão que o visitante
  carregou, com um aviso no rodapé, em vez de uma tela de erro.
- `scroll-cardapio.js` fica fora do componente de propósito: rolar não muda
  estado, e o componente redesenha a página inteira a cada `setState`. Com 57
  itens, ligar a rolagem ao estado travaria o scroll.
- A coluna do cardápio usa `overflow-x: clip`, não `overflow: hidden`. O
  `hidden` transforma a coluna em container de rolagem e quebra o
  `position: sticky` da barra de busca.
- A pasta `uploads/` (PDF do cardápio e PNGs originais) está no `.gitignore`: nada ali
  é usado pelo site e este repositório é público.
