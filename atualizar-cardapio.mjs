// Alinha o cardápio do site com o cardápio impresso do pesqueiro — o menu
// laminado que está nas mesas, fotografado em 27/08/2026, mais as correções
// que o Lucas mandou por mensagem no mesmo dia.
//
// O PDF de 05/08/2026 é anterior a esse menu e não serve de referência: não
// tem o torresminho e ainda lista porções que saíram.
//
// O cardápio não está no HTML: vive no schema pesqueiro_santos_reis. O painel
// do dono edita preço e meia porção, mas não tem campo de descrição nem de
// foto — por isso estas mudanças entram por aqui.
//
// Rode com: npm run atualizar:cardapio
//
// Pede o login do proprietário na hora. A senha não fica em arquivo nem no
// histórico do terminal, e o RLS do banco exige uma linha em `proprietarios`
// para gravar: uma conta qualquer do projeto não passa.
//
// É seguro rodar de novo: cada passo confere o estado atual antes de gravar e
// pula o que já está certo.
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

const BASE = 'https://urnnsxywqvngdbpdovcm.supabase.co';
const CHAVE = 'sb_publishable_gWcgWUjfTgybL5LEdHWuJw_M3WF7QJj';
const SCHEMA = 'pesqueiro_santos_reis';
const DOMINIO = '@santos-reis.taeerp.com';
const MIDIA = 'https://midia.taeerp.com/';

// 1. Nomes que o impresso escreve diferente do site.
const RENOMEAR = [
  ['lacarte', 'Traíra à Parmegiana', 'Traíra Espalmada à Parmegiana']
];

// 2. Itens que faltavam. O torresminho está no impresso (meia 44,90 /
//    inteira 68,90); o caipicoco veio por mensagem, a 24,00.
const NOVOS = [
  { categoria_id: 'peixe', nome: 'Torresminho de Tilápia', preco: 68.9, preco_meia: 44.9, grupo: null, descricao: null },
  { categoria_id: 'cerveja', nome: 'Caipicoco', preco: 24, preco_meia: null, grupo: 'Drinks', descricao: 'Caipirinha de coco' }
];

// 3. Preços que faltavam. O impresso tem meia porção nos dois; o site não.
const PRECOS = [
  ['peixe', 'Ceviche de Tilápia', { preco_meia: 35 }],
  ['peixe', 'Sashimi de Tilápia', { preco_meia: 35 }]
];

// 4. Ordem das seções, na sequência do impresso. As outras seções já batem.
const ORDEM = {
  peixe: [
    'Filé de Tilápia', 'Posta de Tilápia', 'Torresminho de Tilápia',
    'Bolinho de Tilápia', 'Bolinho de Camarão', 'Ceviche de Tilápia',
    'Sashimi de Tilápia', 'Camarão Empanado c/ Catupiry'
  ],
  fritas: [
    'Mandioca Frita', 'Mandioca c/ Queijo e Bacon', 'Batata Frita',
    'Batata c/ Queijo e Bacon', 'Anel de Cebola Frito'
  ]
};

// 5. Descrições. O impresso diz "batata frita"; no site tinha ficado só
//    "batata". A frase das traíras é a que o Lucas mandou, igual nos dois.
const PORCAO_TRAIRA = 'O prato é servido com uma ou duas traíras, dependendo do tamanho delas.';
const ACOMPANHA = 'Acompanha arroz, batata frita e salada';
const DESCRICOES = [
  ['lacarte', 'Filé de Tilápia Frito', ACOMPANHA],
  ['lacarte', 'Traíra Espalmada Tradicional', `${ACOMPANHA}. ${PORCAO_TRAIRA}`],
  ['lacarte', 'Traíra Espalmada com Catupiry', `${ACOMPANHA}. ${PORCAO_TRAIRA}`]
];

// 6. Fotos novas (o arquivo tem que estar no bucket: npm run sync:midia).
const FOTOS = [
  ['peixe', 'Filé de Tilápia', 'menu-file-tilapia-novo.jpg'],
  ['peixe', 'Torresminho de Tilápia', 'menu-torresminho-tilapia.jpg'],
  ['peixe', 'Ceviche de Tilápia', 'menu-ceviche-tilapia.jpg'],
  ['peixe', 'Camarão Empanado c/ Catupiry', 'menu-camarao-catupiry.jpg'],
  ['fritas', 'Mandioca Frita', 'menu-mandioca-frita.jpg'],
  ['fritas', 'Batata c/ Queijo e Bacon', 'menu-batata-bacon.jpg'],
  ['frios', 'Tábua de Frios', 'menu-frios-tabua-novo.jpg'],
  ['lacarte', 'Filé de Tilápia à Parmegiana', 'menu-file-parmegiana.jpg'],
  ['lacarte', 'Traíra Espalmada Tradicional', 'menu-traira-tradicional.jpg'],
  ['lacarte', 'Traíra Espalmada à Parmegiana', 'menu-traira-parmegiana.jpg'],
  ['lacarte', 'Traíra Espalmada com Catupiry', 'menu-traira-catupiry.jpg'],
  ['cerveja', 'Soda Italiana', 'menu-soda-italiana.jpg'],
  ['cerveja', 'Caipirinha', 'menu-caipirinha.jpg'],
  ['cerveja', 'Caipicoco', 'menu-caipicoco.jpg']
];

let token = null;

function cabecalhos(escrita) {
  const h = { apikey: CHAVE, Authorization: `Bearer ${token}` };
  if (escrita) {
    h['Content-Type'] = 'application/json';
    h['Content-Profile'] = SCHEMA;
    h.Prefer = 'return=representation';
  } else {
    h['Accept-Profile'] = SCHEMA;
  }
  return h;
}

async function conferir(r) {
  if (r.ok) return r.status === 204 ? null : r.json();
  const texto = await r.text();
  let msg = texto;
  try { msg = JSON.parse(texto).message || texto; } catch {}
  throw new Error(`${r.status} — ${msg}`);
}

const ler = (caminho) =>
  fetch(`${BASE}/rest/v1/${caminho}`, { headers: cabecalhos(false) }).then(conferir);

const gravar = (metodo, caminho, corpo) =>
  fetch(`${BASE}/rest/v1/${caminho}`, {
    method: metodo, headers: cabecalhos(true), body: JSON.stringify(corpo)
  }).then(conferir);

// Pergunta no terminal. Com `escondido`, o que for digitado não aparece na
// tela — senão a senha fica visível para quem estiver do lado.
function perguntar(rotulo, escondido = false) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  return new Promise((resolve) => {
    rl.question(rotulo, (resposta) => { rl.close(); if (escondido) stdout.write('\n'); resolve(resposta.trim()); });
    // O rótulo já foi escrito pelo question() acima; daqui para a frente o
    // readline cala a boca e as teclas da senha não ecoam.
    if (escondido) rl._writeToOutput = () => {};
  });
}

async function entrar() {
  const usuario = process.env.PSR_USUARIO || await perguntar('Usuário do painel: ');
  const senha = process.env.PSR_SENHA || await perguntar('Senha: ', true);
  const email = usuario.includes('@') ? usuario : usuario + DOMINIO;

  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CHAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`login recusado: ${j.error_description || j.msg || j.message || r.status}`);
  token = j.access_token;

  // Estar autenticado não basta: sem linha em `proprietarios` o RLS deixa ler
  // e recusa cada gravação, uma a uma, no meio da execução.
  const donos = await ler('proprietarios?select=user_id&limit=1');
  if (!donos.length) throw new Error('esta conta entra no site mas não é proprietária: não pode gravar.');
}

const dinheiro = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');

async function principal() {
  await entrar();
  console.log('Conectado ao cardápio.\n');

  let itens = await ler('itens?select=id,categoria_id,nome,descricao,foto,preco,preco_meia,ordem,visivel&order=categoria_id,ordem');
  const achar = (cat, nome) => itens.find((i) => i.categoria_id === cat && i.nome === nome);
  let mudou = 0;

  // 1. Renomear antes de tudo: as listas abaixo já usam o nome novo.
  for (const [cat, velho, novo] of RENOMEAR) {
    if (achar(cat, novo)) { console.log(`= ${novo}: nome já está certo`); continue; }
    const item = achar(cat, velho);
    if (!item) { console.log(`! não achei "${velho}" nem "${novo}" em ${cat}`); continue; }
    await gravar('PATCH', `itens?id=eq.${item.id}`, { nome: novo });
    item.nome = novo;
    console.log(`~ "${velho}" → "${novo}"`);
    mudou++;
  }

  // 2. Itens novos. Entram no fim da seção; o passo 4 põe na posição certa.
  for (const novo of NOVOS) {
    if (achar(novo.categoria_id, novo.nome)) { console.log(`= ${novo.nome} já está no cardápio`); continue; }
    const fim = itens.filter((i) => i.categoria_id === novo.categoria_id)
      .reduce((m, i) => Math.max(m, i.ordem), -1);
    const [criado] = await gravar('POST', 'itens', {
      categoria_id: novo.categoria_id, nome: novo.nome, descricao: novo.descricao,
      preco: novo.preco, preco_meia: novo.preco_meia, grupo: novo.grupo,
      ordem: fim + 1, visivel: true
    });
    itens.push(criado);
    console.log(`+ ${novo.nome} — ${dinheiro(novo.preco)}${novo.preco_meia ? ` (meia ${dinheiro(novo.preco_meia)})` : ''}`);
    mudou++;
  }

  // 3. Preços que faltavam.
  for (const [cat, nome, campos] of PRECOS) {
    const item = achar(cat, nome);
    if (!item) { console.log(`! não achei "${nome}" em ${cat}`); continue; }
    const pendente = Object.entries(campos).filter(([k, v]) => Number(item[k]) !== v);
    if (!pendente.length) { console.log(`= ${nome}: preço já está certo`); continue; }
    await gravar('PATCH', `itens?id=eq.${item.id}`, campos);
    Object.assign(item, campos);
    console.log(`~ ${nome}: ${pendente.map(([k, v]) => `${k} = ${dinheiro(v)}`).join(', ')}`);
    mudou++;
  }

  // 4. Ordem das seções, na sequência do impresso.
  for (const [cat, sequencia] of Object.entries(ORDEM)) {
    const naSecao = itens.filter((i) => i.categoria_id === cat);
    const fora = naSecao.filter((i) => !sequencia.includes(i.nome)).map((i) => i.nome);
    if (fora.length) { console.log(`! ${cat}: fora da lista de ordem — ${fora.join(', ')}`); continue; }
    for (const [pos, nome] of sequencia.entries()) {
      const item = achar(cat, nome);
      if (!item) { console.log(`! não achei "${nome}" em ${cat}`); continue; }
      if (item.ordem === pos) continue;
      await gravar('PATCH', `itens?id=eq.${item.id}`, { ordem: pos });
      item.ordem = pos;
      console.log(`~ ${cat}: ${nome} vai para a posição ${pos + 1}`);
      mudou++;
    }
  }

  // 5. Descrições.
  for (const [cat, nome, texto] of DESCRICOES) {
    const item = achar(cat, nome);
    if (!item) { console.log(`! não achei "${nome}" em ${cat}`); continue; }
    if (item.descricao === texto) { console.log(`= ${nome}: descrição já está certa`); continue; }
    await gravar('PATCH', `itens?id=eq.${item.id}`, { descricao: texto });
    item.descricao = texto;
    console.log(`~ ${nome}: "${texto}"`);
    mudou++;
  }

  // 6. Fotos.
  for (const [cat, nome, arquivo] of FOTOS) {
    const item = achar(cat, nome);
    if (!item) { console.log(`! não achei "${nome}" em ${cat}`); continue; }
    const url = MIDIA + arquivo;
    if (item.foto === url) { console.log(`= ${nome}: foto já ligada`); continue; }
    await gravar('PATCH', `itens?id=eq.${item.id}`, { foto: url });
    item.foto = url;
    console.log(`~ ${nome}: foto ${arquivo}`);
    mudou++;
  }

  console.log(mudou ? `\n${mudou} alterações gravadas.` : '\nNada a fazer: o cardápio já está igual ao impresso.');
}

principal().catch((e) => { console.error(`\nFalhou: ${e.message}`); process.exit(1); });
