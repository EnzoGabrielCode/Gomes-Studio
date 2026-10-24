// Text type (React Bits) em JS puro: o título é digitado letra por letra com um
// cursor piscando. As letras já ocupam o lugar final (só ficam invisíveis), então
// o layout não pula enquanto digita. Uso: data-text-type no elemento.
(() => {
  const TYPING_SPEED = { min: 45, max: 95 };
  const INITIAL_DELAY = 450;

  document.querySelectorAll('[data-text-type]').forEach(el => {
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());

    // troca cada texto por spans de uma letra, mantendo os elementos (ex.: a caixa da "marca")
    const chars = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const frag = document.createDocumentFragment();
      Array.from(node.textContent).forEach(char => {
        const span = document.createElement('span');
        span.className = 'tt-char';
        span.textContent = char;
        span.setAttribute('aria-hidden', 'true');
        frag.appendChild(span);
        chars.push(span);
      });
      node.replaceWith(frag);
    });

    const cursor = document.createElement('span');
    cursor.className = 'tt-cursor';
    cursor.setAttribute('aria-hidden', 'true');

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.classList.add('tt-ready');
    if (reduce) {
      chars.forEach(c => c.classList.add('is-on'));
      el.classList.add('tt-done');
      return;
    }

    chars[0].before(cursor);
    let i = 0;
    const step = () => {
      const char = chars[i];
      char.classList.add('is-on');
      char.after(cursor);
      // a caixa de seleção aparece quando a digitação chega nela
      const box = char.closest('[data-tt-reveal]');
      if (box) box.classList.add('is-on');
      cursor.classList.add('is-typing');
      i += 1;
      if (i < chars.length) {
        const speed = TYPING_SPEED.min + Math.random() * (TYPING_SPEED.max - TYPING_SPEED.min);
        setTimeout(step, char.textContent === ' ' ? speed * 0.6 : speed);
      } else {
        cursor.classList.remove('is-typing');
        el.classList.add('tt-done');
      }
    };
    setTimeout(step, INITIAL_DELAY);
  });
})();
