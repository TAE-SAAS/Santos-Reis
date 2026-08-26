// Comportamento de rolagem do cardápio.
//
// Fica fora do componente de propósito: rolar não muda estado, então nada aqui
// dispara re-render. O componente redesenha a página inteira a cada setState, e
// com 57 itens isso travaria a rolagem.
//
// O que faz:
//   1. marca quando a página saiu do topo, para a barra fixa ganhar sombra só aí;
//   2. acompanha em que seção o cliente está e acende o atalho correspondente;
//   3. mostra o botão de voltar ao topo depois da primeira dobra;
//   4. desloca a foto do topo devagar enquanto rola.
(function () {
  'use strict';

  var raiz = document.documentElement;
  var foto = null;
  var paradoParaMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // --- botão de voltar ao topo ---------------------------------------------
  // Criado fora da árvore do componente para os re-renders não o apagarem.
  var subir = document.createElement('button');
  subir.type = 'button';
  subir.className = 'psr-subir';
  subir.setAttribute('aria-label', 'Voltar ao topo do cardápio');
  subir.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6"></path><path d="M6 12l6-6 6 6"></path></svg>';
  subir.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: paradoParaMotion.matches ? 'auto' : 'smooth' });
  });
  document.body.appendChild(subir);

  // --- estado de rolagem ----------------------------------------------------
  var pendente = false;
  var saiuDoTopo = false;
  var longe = false;

  function medir() {
    pendente = false;
    var y = window.scrollY || window.pageYOffset || 0;

    var agoraSaiu = y > 8;
    if (agoraSaiu !== saiuDoTopo) {
      saiuDoTopo = agoraSaiu;
      raiz.classList.toggle('psr-rolou', saiuDoTopo);
    }

    // Só aparece depois que o cardápio já cobriu a tela: antes disso o topo
    // está logo ali e o botão seria ruído.
    var agoraLonge = y > window.innerHeight * 0.9;
    if (agoraLonge !== longe) {
      longe = agoraLonge;
      subir.classList.toggle('psr-visivel', longe);
    }

    if (foto && !paradoParaMotion.matches) {
      // Metade da velocidade da página. O teto é a folga que a foto tem no
      // quadro (ela nasce 80px acima); passar disso abriria uma faixa vazia.
      var desloca = Math.min(y * 0.5, 80);
      foto.style.transform = 'translate3d(0,' + desloca.toFixed(1) + 'px,0)';
    }
  }

  function aoRolar() {
    if (pendente) return;
    pendente = true;
    window.requestAnimationFrame(medir);
  }

  window.addEventListener('scroll', aoRolar, { passive: true });
  window.addEventListener('resize', aoRolar, { passive: true });

  // --- seção atual ----------------------------------------------------------
  var atual = '';
  var observador = null;

  function pinta() {
    var atalhos = document.querySelectorAll('[data-secao]');
    var aceso = null;
    for (var i = 0; i < atalhos.length; i++) {
      var eEsse = atalhos[i].getAttribute('data-secao') === atual;
      atalhos[i].toggleAttribute('data-ativo', eEsse);
      if (eEsse) aceso = atalhos[i];
    }
    if (aceso) rolaAtalho(aceso);
  }

  // Move a régua de atalhos na horizontal na mão, em vez de scrollIntoView:
  // aquele arrastaria a página junto e brigaria com a rolagem do cliente.
  function rolaAtalho(el) {
    var trilho = el.parentElement;
    if (!trilho) return;
    var margem = 18;
    var esq = el.offsetLeft - margem;
    var dir = el.offsetLeft + el.offsetWidth + margem - trilho.clientWidth;
    var alvo = trilho.scrollLeft;
    if (esq < trilho.scrollLeft) alvo = esq;
    else if (dir > trilho.scrollLeft) alvo = dir;
    if (alvo === trilho.scrollLeft) return;
    trilho.scrollTo({ left: Math.max(0, alvo), behavior: paradoParaMotion.matches ? 'auto' : 'smooth' });
  }

  // Faixa fina logo abaixo da barra fixa: a seção que a cruza é a que o cliente
  // está lendo. Observador em vez de conta no evento de scroll — o navegador
  // avisa só quando muda.
  function observa() {
    if (observador) observador.disconnect();
    var secoes = document.querySelectorAll('section[id]');
    if (!secoes.length) return;

    observador = new IntersectionObserver(function (entradas) {
      var candidata = null;
      for (var i = 0; i < entradas.length; i++) {
        if (!entradas[i].isIntersecting) continue;
        if (!candidata || entradas[i].boundingClientRect.top < candidata.boundingClientRect.top) {
          candidata = entradas[i];
        }
      }
      if (!candidata) return;
      var id = candidata.target.id;
      if (id === atual) return;
      atual = id;
      pinta();
    }, { rootMargin: '-118px 0px -72% 0px', threshold: 0 });

    for (var i = 0; i < secoes.length; i++) observador.observe(secoes[i]);
  }

  // O componente redesenha a lista de atalhos e as seções (busca, edição no
  // painel). Quando isso acontece, reapontamos o observador e repintamos.
  var repor = null;
  new MutationObserver(function () {
    clearTimeout(repor);
    repor = setTimeout(function () {
      foto = document.querySelector('[data-psr-foto]');
      observa();
      pinta();
      medir();
    }, 60);
  }).observe(document.body, { childList: true, subtree: true });

  foto = document.querySelector('[data-psr-foto]');
  observa();
  medir();
})();
