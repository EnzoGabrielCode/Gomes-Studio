// Rubber segment (React Bits) em JS puro: a pílula do menu passeia sozinha entre
// os links, esticando como borracha e assentando com mola. Sem seguir o mouse;
// ao clicar num link ela vai até ele. Uso: data-rubber-segment no grupo de links.
(() => {
  const SPEED = 0.75;          // < 1 deixa o movimento mais lento que o original
  const STRETCH = 1;           // 1 = estica até cobrir os dois itens
  const SQUASH = 3;            // px que a borda de trás passa do ponto antes de assentar
  const DILATE = 0.19 / SPEED; // s esticando
  const HANDOFF = 0.15 / SPEED;
  const CYCLE = 2600;          // ms entre um link e outro
  const RESUME = 5000;         // pausa no ciclo depois de um clique

  const springFor = duration => {
    const k = Math.pow((2 * Math.PI) / (duration / SPEED), 2);
    return { k, c: 2 * Math.sqrt(k) };
  };
  const SPRING_UI = springFor(0.3);
  const SPRING_RELAX = springFor(0.16);
  const easeOut = x => 1 - Math.pow(1 - x, 5);

  document.querySelectorAll('[data-rubber-segment]').forEach(track => {
    const items = Array.from(track.children);
    if (items.length < 2) return;

    const thumb = document.createElement('div');
    thumb.className = 'rs-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    items.forEach(item => {
      const copy = document.createElement('span');
      copy.className = 'rs-copy';
      copy.textContent = item.textContent;
      thumb.appendChild(copy);
    });
    track.appendChild(thumb);
    track.classList.add('rs-ready');

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const edges = [{ x: 0, v: 0 }, { x: 0, v: 0 }]; // esquerda, direita
    let slots = [];
    let current = 0;
    let gen = 0;
    let raf = 0;
    let last = 0;
    let handoff = 0;

    const render = () => {
      const w = thumb.offsetWidth;
      thumb.style.clipPath = `inset(0 ${Math.max(0, w - edges[1].x)}px 0 ${Math.max(0, edges[0].x)}px round var(--rs-thumb-radius))`;
    };

    const measure = () => {
      const box = thumb.getBoundingClientRect();
      slots = items.map(item => {
        const r = item.getBoundingClientRect();
        return { l: r.left - box.left, r: r.right - box.left };
      });
      jump(current);
    };

    const jump = i => {
      gen += 1;
      clearTimeout(handoff);
      edges[0] = { x: slots[i].l, v: 0 };
      edges[1] = { x: slots[i].r, v: 0 };
      render();
    };

    const tick = now => {
      raf = 0;
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
      last = now;
      let moving = false;
      edges.forEach(e => {
        if (e.tween) {
          const p = Math.min(1, (now - e.tween.t0) / 1000 / e.tween.dur);
          const x = e.tween.from + (e.tween.to - e.tween.from) * easeOut(p);
          e.v = (x - e.x) / dt;
          e.x = x;
          if (p >= 1) e.tween = null;
          moving = true;
        } else if (e.spring) {
          const { k, c } = e.spring;
          const steps = 4;
          for (let s = 0; s < steps; s++) {
            const a = -k * (e.x - e.target) - c * e.v;
            e.v += a * (dt / steps);
            e.x += e.v * (dt / steps);
          }
          if (Math.abs(e.x - e.target) < 0.05 && Math.abs(e.v) < 2) {
            e.x = e.target;
            e.v = 0;
            e.spring = null;
            if (e.then) {
              const next = e.then;
              e.then = null;
              next();
            }
          }
          moving = true;
        }
      });
      render();
      if (moving || edges.some(e => e.tween || e.spring)) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

    const tweenTo = (e, to, dur) => {
      e.spring = null;
      e.then = null;
      e.tween = { from: e.x, to, dur, t0: performance.now() };
    };
    const springTo = (e, target, spring, then) => {
      e.tween = null;
      e.target = target;
      e.spring = spring;
      e.then = then || null;
    };

    const travel = to => {
      const from = current;
      if (to === from) return;
      current = to;
      const a = slots[from];
      const b = slots[to];
      if (reduce) return jump(to);
      const g = ++gen;
      clearTimeout(handoff);
      // 1) estica cobrindo o caminho
      tweenTo(edges[0], b.l + (Math.min(a.l, b.l) - b.l) * STRETCH, DILATE);
      tweenTo(edges[1], b.r + (Math.max(a.r, b.r) - b.r) * STRETCH, DILATE);
      wake();
      // 2) a borda da frente assenta e a de trás passa um pouco e volta
      handoff = setTimeout(() => {
        if (g !== gen) return;
        const dir = Math.sign((b.l + b.r) / 2 - (a.l + a.r) / 2) || 1;
        const [lead, leadTo, trail, trailTo] = dir > 0 ? [edges[1], b.r, edges[0], b.l] : [edges[0], b.l, edges[1], b.r];
        springTo(lead, leadTo, SPRING_UI);
        springTo(trail, trailTo + dir * SQUASH, SPRING_UI, () => {
          if (g === gen) springTo(trail, trailTo, SPRING_RELAX);
        });
        wake();
      }, HANDOFF * 1000);
    };

    // ciclo automático
    let timer = 0;
    const schedule = delay => {
      clearTimeout(timer);
      if (reduce) return;
      timer = setTimeout(() => {
        if (!document.hidden && track.offsetParent) travel((current + 1) % items.length);
        schedule(CYCLE);
      }, delay);
    };

    items.forEach((item, i) => item.addEventListener('click', () => {
      travel(i);
      schedule(RESUME);
    }));

    new ResizeObserver(measure).observe(track);
    if (document.fonts) document.fonts.ready.then(measure);
    measure();
    schedule(CYCLE);
  });
})();
