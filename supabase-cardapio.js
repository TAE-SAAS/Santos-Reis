// Cliente do Supabase para o cardápio.
//
// A biblioteca oficial passa de 100 KB e usaríamos uma fração dela, então aqui
// vai só o necessário: login por senha, sessão que sobrevive ao recarregar, e
// leitura/escrita nas tabelas do schema pesqueiro_santos_reis.
//
// A chave abaixo é publicável (anon) — ela é feita para ficar no navegador. O
// que protege os dados é o RLS no banco: qualquer visitante lê o cardápio, e
// só quem está na tabela proprietarios consegue gravar.
(function () {
  'use strict';

  var BASE = 'https://urnnsxywqvngdbpdovcm.supabase.co';
  var CHAVE = 'sb_publishable_gWcgWUjfTgybL5LEdHWuJw_M3WF7QJj';
  var SCHEMA = 'pesqueiro_santos_reis';
  var GUARDA = 'psr_sessao_v1';
  var CACHE = 'psr_cardapio_cache_v1';
  // Contas do painel usam usuário curto; o Supabase exige e-mail, então
  // completamos com este domínio quando o dono digita só "santosreis".
  var DOMINIO = '@santos-reis.taeerp.com';

  var sessao = null;
  try {
    var bruto = window.localStorage.getItem(GUARDA);
    if (bruto) sessao = JSON.parse(bruto);
  } catch (e) {}

  function guarda(nova) {
    sessao = nova;
    try {
      if (nova) window.localStorage.setItem(GUARDA, JSON.stringify(nova));
      else window.localStorage.removeItem(GUARDA);
    } catch (e) {}
  }

  function expiraEm(s) {
    return s && s.expires_at ? s.expires_at * 1000 : 0;
  }

  // Renova o token um minuto antes de vencer, para uma gravação não morrer no
  // meio por token expirado.
  function tokenValido() {
    if (!sessao) return Promise.resolve(null);
    if (Date.now() < expiraEm(sessao) - 60000) return Promise.resolve(sessao.access_token);
    return fetch(BASE + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: CHAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: sessao.refresh_token })
    }).then(function (r) {
      if (!r.ok) { guarda(null); return null; }
      return r.json().then(function (j) { guarda(j); return j.access_token; });
    }).catch(function () { return null; });
  }

  function cabecalhos(token, escrita) {
    var h = { apikey: CHAVE };
    if (token) h.Authorization = 'Bearer ' + token;
    if (escrita) {
      h['Content-Type'] = 'application/json';
      h['Content-Profile'] = SCHEMA;
      h.Prefer = 'return=representation';
    } else {
      h['Accept-Profile'] = SCHEMA;
    }
    return h;
  }

  function erro(r) {
    return r.text().then(function (t) {
      var msg = t;
      try { msg = JSON.parse(t).message || t; } catch (e) {}
      throw new Error(msg || ('HTTP ' + r.status));
    });
  }

  var PSR = {
    logado: function () { return !!sessao; },

    usuario: function () {
      return sessao && sessao.user ? sessao.user.email : '';
    },

    entrar: function (usuario, senha) {
      var email = usuario.indexOf('@') > -1 ? usuario.trim() : usuario.trim() + DOMINIO;
      return fetch(BASE + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: CHAVE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: senha })
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) {
            // A mensagem crua do Supabase vem em inglês e técnica demais.
            var m = (j.error_description || j.msg || j.message || '').toLowerCase();
            if (m.indexOf('invalid') > -1) throw new Error('Usuário ou senha incorretos.');
            throw new Error(j.error_description || j.msg || 'Não foi possível entrar.');
          }
          guarda(j);
          return j;
        });
      });
    },

    sair: function () {
      var token = sessao && sessao.access_token;
      guarda(null);
      if (!token) return Promise.resolve();
      return fetch(BASE + '/auth/v1/logout', {
        method: 'POST',
        headers: { apikey: CHAVE, Authorization: 'Bearer ' + token }
      }).catch(function () {});
    },

    // Confere no banco se a conta logada é dona do cardápio. O RLS já barra a
    // escrita, mas checar aqui evita abrir o painel para quem não pode salvar.
    eProprietario: function () {
      return tokenValido().then(function (token) {
        if (!token) return false;
        return fetch(BASE + '/rest/v1/proprietarios?select=user_id&limit=1', {
          headers: cabecalhos(token, false)
        }).then(function (r) {
          if (!r.ok) return false;
          return r.json().then(function (linhas) { return linhas.length > 0; });
        });
      }).catch(function () { return false; });
    },

    ler: function (caminho) {
      return tokenValido().then(function (token) {
        return fetch(BASE + '/rest/v1/' + caminho, { headers: cabecalhos(token, false) });
      }).then(function (r) { return r.ok ? r.json() : erro(r); });
    },

    gravar: function (metodo, caminho, corpo) {
      return tokenValido().then(function (token) {
        if (!token) throw new Error('Sua sessão expirou. Entre de novo.');
        return fetch(BASE + '/rest/v1/' + caminho, {
          method: metodo,
          headers: cabecalhos(token, true),
          body: corpo === undefined ? undefined : JSON.stringify(corpo)
        });
      }).then(function (r) {
        if (!r.ok) return erro(r);
        return r.status === 204 ? null : r.json().catch(function () { return null; });
      });
    },

    // Busca o cardápio inteiro de uma vez e devolve no formato que a tela usa.
    // Guarda uma cópia: se o banco estiver fora do ar, o cliente ainda vê o
    // cardápio da última visita em vez de uma tela de erro.
    carregar: function () {
      var p = function (c) { return PSR.ler(c); };
      return Promise.all([
        p('categorias?select=*&order=ordem'),
        p('itens?select=*&order=categoria_id,ordem'),
        p('item_variacoes?select=*&order=ordem'),
        p('destaques?select=*&order=ordem'),
        p('configuracao?select=*&limit=1'),
        p('informacoes?select=*&visivel=is.true&order=ordem'),
        p('textos?select=*')
      ]).then(function (r) {
        if (!r[4] || !r[4][0]) throw new Error('Configuração do cardápio não encontrada.');
        var bruto = { c: r[0], i: r[1], v: r[2], d: r[3], cf: r[4][0], inf: r[5], t: r[6] };
        try { window.localStorage.setItem(CACHE, JSON.stringify(bruto)); } catch (e) {}
        return PSR.montar(bruto.c, bruto.i, bruto.v, bruto.d, bruto.cf, bruto.inf, bruto.t);
      }).catch(function (e) {
        var salvo = null;
        try { salvo = JSON.parse(window.localStorage.getItem(CACHE)); } catch (x) {}
        if (!salvo) throw e;
        var dados = PSR.montar(salvo.c, salvo.i, salvo.v, salvo.d, salvo.cf, salvo.inf, salvo.t);
        dados.doCache = true;
        return dados;
      });
    },

    montar: function (categorias, itens, variacoes, destaques, conf, informacoes, textos) {
      var porItem = {};
      variacoes.forEach(function (v) {
        (porItem[v.item_id] = porItem[v.item_id] || []).push({ label: v.rotulo, price: Number(v.preco), dbId: v.id });
      });

      // Mantém o id posicional "categoria-índice" que a tela já usava, e leva
      // junto o dbId para as gravações saberem qual linha alterar.
      var menu = categorias.map(function (c) {
        var lista = itens.filter(function (i) { return i.categoria_id === c.id; });
        return {
          id: c.id, dbId: c.id, name: c.nome, photo: c.foto || '', note: c.nota || '',
          items: lista.map(function (i, pos) {
            return {
              dbId: i.id, posId: c.id + '-' + pos, name: i.nome,
              desc: i.descricao || '', sub: i.sub || '', photo: i.foto || '',
              group: i.grupo || '',
              price: i.preco == null ? null : Number(i.preco),
              half: i.preco_meia == null ? null : Number(i.preco_meia),
              visivel: i.visivel,
              variants: porItem[i.id] || null
            };
          })
        };
      });

      var porDb = {};
      menu.forEach(function (c) { c.items.forEach(function (i) { porDb[i.dbId] = i; }); });

      var featured = destaques.map(function (d) {
        if (d.categoria_id) return 'cat:' + d.categoria_id;
        var it = porDb[d.item_id];
        return it ? it.posId : null;
      }).filter(Boolean);

      // Itens escondidos viram a lista "removidos" do painel, que é como o
      // dono os traz de volta.
      var removed = [];
      menu.forEach(function (c) {
        c.items.forEach(function (i) { if (!i.visivel) removed.push(i.posId); });
      });

      var frases = {};
      (textos || []).forEach(function (t) { frases[t.chave] = t.valor; });

      return {
        menu: menu,
        infos: (informacoes || []).map(function (i) {
          return { n: i.numero, title: i.titulo, body: i.corpo, dbId: i.id };
        }),
        textos: frases,
        cfg: {
          open: (conf.abre || '08:00').slice(0, 5),
          close: (conf.fecha || '18:00').slice(0, 5),
          days: conf.dias || [],
          obs: conf.observacao || '',
          aviso: { on: conf.aviso_ativo, text: conf.aviso_texto || '' },
          avisoFim: { on: conf.aviso_fim_ativo, title: conf.aviso_fim_titulo || '', text: conf.aviso_fim_texto || '' },
          featured: featured,
          removed: removed,
          prices: {}, added: [], cats: []
        }
      };
    }
  };

  window.PSR = PSR;
})();
