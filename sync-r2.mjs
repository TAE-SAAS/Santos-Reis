// Sobe assets/ para o bucket R2 que serve as mídias do site.
// Rode com: npm run sync:midia
import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const BUCKET = 'santos-reis-midia';
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
// Imutável: cada arquivo tem nome fixo e conteúdo estável, então o navegador
// pode guardar por um ano. Ao trocar uma foto, mude o nome do arquivo.
// Sem espaços: com shell no Windows, argumentos espaçados quebram a chamada.
const CACHE = 'public,max-age=31536000,immutable';

const files = await readdir('assets');
let ok = 0;
for (const f of files) {
  const ext = f.slice(f.lastIndexOf('.')).toLowerCase();
  const type = TYPES[ext];
  if (!type) { console.log(`ignorado (tipo desconhecido): ${f}`); continue; }
  execFileSync('npx', ['--yes', 'wrangler@latest', 'r2', 'object', 'put',
    `${BUCKET}/${f}`, '--file', `assets/${f}`,
    '--content-type', type, '--cache-control', CACHE, '--remote'
  ], { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
  ok++;
  console.log(`enviado ${ok}/${files.length}: ${f}`);
}
console.log(`\n${ok} arquivos no bucket ${BUCKET}`);
