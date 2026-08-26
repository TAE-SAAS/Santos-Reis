# Cardápio Pesqueiro Santo Reis

Cardápio online do Pesqueiro Santo Reis. Site estático, sem backend.

**No ar:** https://santos-reis.taeerp.com

## Como funciona

O site é um export do editor de design (`Cardapio Pesqueiro Santo Reis.dc.html`),
renderizado no navegador pelo runtime em `support.js`. Não há servidor: os dados do
cardápio ficam dentro do próprio HTML.

```
Cardapio Pesqueiro Santo Reis.dc.html   página (export do editor)
support.js                              runtime que renderiza as tags <x-dc>
_ds/organic-.../                        design system: styles.css + bundle
assets/                                 fotos (fonte; publicadas no R2)
build.mjs                               monta a pasta dist/
sync-r2.mjs                             sobe assets/ para o bucket R2
```

## Rodar local

```bash
npm run build
npx serve dist          # ou: python -m http.server 8788 --directory dist
```

## Mídias

As fotos não vão no deploy: ficam no bucket R2 `santos-reis-midia`, servido por
https://midia.taeerp.com. O build reescreve as referências `assets/` para lá.

Ao trocar ou adicionar uma foto em `assets/`:

```bash
npm run sync:midia
```

Os arquivos são servidos com cache de um ano. Para trocar uma imagem existente,
use um nome de arquivo novo — senão os navegadores continuam mostrando a antiga.

## Deploy

Automático: todo push na branch `main` dispara um build no Cloudflare Pages
(projeto `santos-reis`), que roda `npm run build` e publica `dist/`.

Para alterar o cardápio, edite `Cardapio Pesqueiro Santo Reis.dc.html` e faça push.
Não edite `dist/` — ela é gerada e sobrescrita a cada build.

## Notas

- `build.mjs` injeta `<title>` e as tags Open Graph, que o export do editor não traz.
  Por isso a injeção fica no build e não no HTML: ela sobrevive a um novo export.
- O painel de configurações do cardápio tem login de fachada e grava no `localStorage`
  do próprio aparelho. As alterações não são compartilhadas entre visitantes.
- A pasta `uploads/` (PDF do cardápio e PNGs originais) está no `.gitignore`: nada ali
  é usado pelo site e este repositório é público.
