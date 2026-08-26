// Gera dist/ a partir dos arquivos-fonte exportados pelo editor de design.
// Rode com: npm run build
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const SRC_HTML = 'Cardapio Pesqueiro Santo Reis.dc.html';
const DS_DIR = '_ds/organic-1bf0bab7-cb6f-46e0-92eb-f01de88a73fd';
const DS_FILES = ['styles.css', '_ds_bundle.js', '_ds_manifest.json'];
const SITE_URL = 'https://santos-reis.taeerp.com';
const CHARSET = '<meta charset="utf-8">';

// As fotos ficam no bucket R2 (veja sync-r2.mjs), não no deploy do site.
const MEDIA_URL = 'https://midia.taeerp.com/';
const LOCAL_MEDIA = 'assets/';

// O export do editor não traz <head> nenhum: sem title a aba mostra a URL crua e
// o link compartilhado no WhatsApp vem sem miniatura. Injetamos no build para que
// isso sobreviva a um novo export do design.
const HEAD = `
<title>Cardápio · Pesqueiro Santo Reis</title>
<meta name="description" content="Cardápio online do Pesqueiro Santo Reis: peixes, porções, almoço e bebidas. Consulte pratos e preços atualizados.">
<meta name="theme-color" content="#201e1d">
<link rel="preconnect" href="${MEDIA_URL.replace(/\/$/, '')}">
<link rel="icon" href="${MEDIA_URL}menu-logo.png">
<link rel="apple-touch-icon" href="${MEDIA_URL}menu-logo.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Pesqueiro Santo Reis">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="Cardápio · Pesqueiro Santo Reis">
<meta property="og:description" content="Peixes, porções, almoço e bebidas. Cardápio online do Pesqueiro Santo Reis.">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:image" content="${MEDIA_URL}up-img3.jpg">
<meta property="og:image:alt" content="Vista aérea do Pesqueiro Santo Reis">
<meta name="twitter:card" content="summary_large_image">
`.trim();

await rm('dist', { recursive: true, force: true });
await mkdir(`dist/${DS_DIR}`, { recursive: true });

let html = await readFile(SRC_HTML, 'utf8');

// Ancoramos no charset em vez do <head>: o título tem acentos e a declaração de
// codificação precisa vir antes dele para o parser não errar a decodificação.
const anchor = html.includes(CHARSET) ? CHARSET : '<head>';
if (!html.includes(anchor)) throw new Error(`${anchor} não encontrado em ${SRC_HTML}`);
if (!html.includes('<title>')) html = html.replace(anchor, `${anchor}\n${HEAD}`);

// Aponta as fotos para o R2. Falha o build se o editor passar a referenciar as
// mídias de outro jeito, em vez de publicar um site com imagens quebradas.
const refs = (html.match(/assets\//g) || []).length;
if (refs === 0) throw new Error(`nenhuma referência "${LOCAL_MEDIA}" encontrada — o export mudou de formato?`);
html = html.replaceAll(LOCAL_MEDIA, MEDIA_URL);
console.log(`${refs} referências de mídia apontadas para ${MEDIA_URL}`);

// index.html porque o Cloudflare serve esse nome na raiz do site.
await writeFile('dist/index.html', html);

await cp('support.js', 'dist/support.js');
await cp('supabase-cardapio.js', 'dist/supabase-cardapio.js');
for (const f of DS_FILES) await cp(`${DS_DIR}/${f}`, `dist/${DS_DIR}/${f}`);

console.log('dist/ gerado');
