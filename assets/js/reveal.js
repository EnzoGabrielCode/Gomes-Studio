// Reveal ao rolar: os blocos aparecem aos poucos (sobem e desfocam para nítido)
// quando entram na tela, em cascata dentro de cada grupo.
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const GROUPS = [
    '.hero-sub, .hero .btn-proposta',
    '.strip-text, .client-logos li',
    '.section-title',
    '.project-tile',
    '.projetos .center',
    '.ent-card, .ent-row2 .btn',
    '.accordion-item',
    '.site-footer > *'
  ];
  const STAGGER = 90; // ms entre itens do mesmo grupo

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  GROUPS.forEach(selector => {
    document.querySelectorAll(selector).forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', `${(i % 6) * STAGGER}ms`);
      // depois de aparecer, devolve o elemento aos estilos normais (hover etc.)
      el.addEventListener('transitionend', function done(event) {
        if (event.target !== el || !el.classList.contains('is-visible')) return;
        el.classList.remove('reveal', 'is-visible');
        el.style.removeProperty('--reveal-delay');
        el.removeEventListener('transitionend', done);
      });
      observer.observe(el);
    });
  });
})();
