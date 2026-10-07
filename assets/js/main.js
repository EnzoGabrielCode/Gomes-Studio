// Menu mobile
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open);
});
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', false);
  });
});

// Accordion da metodologia
document.querySelectorAll('.accordion-item').forEach(item => {
  const trigger = item.querySelector('.accordion-trigger');
  const panel = item.querySelector('.accordion-panel');

  trigger.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');

    // fecha os outros
    document.querySelectorAll('.accordion-item.open').forEach(other => {
      if (other !== item) {
        other.classList.remove('open');
        other.querySelector('.accordion-trigger').setAttribute('aria-expanded', false);
        other.querySelector('.accordion-panel').style.maxHeight = null;
      }
    });

    item.classList.toggle('open', !isOpen);
    trigger.setAttribute('aria-expanded', !isOpen);
    panel.style.maxHeight = isOpen ? null : panel.scrollHeight + 'px';
  });
});
