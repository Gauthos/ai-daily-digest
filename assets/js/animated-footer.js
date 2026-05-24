(function () {
  const footer = document.querySelector('.tw-footer');
  const wave = footer ? footer.querySelector('[data-tw-wave]') : null;
  const segments = wave ? Array.from(wave.querySelectorAll('[data-tw-wave-segment]')) : [];
  const backToTop = footer ? footer.querySelector('.tw-back-to-top') : null;

  if (backToTop) {
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (!footer || segments.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  let frame = 0;
  let t = 0;

  function stopWave() {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  function animateWave() {
    let offset = 0;

    segments.forEach(function (segment, index) {
      offset += Math.max(0, 20 * Math.sin((t + index) * 0.3));
      segment.style.transform = 'translateY(' + (index + offset) + 'px)';
    });

    t += 0.1;
    frame = window.requestAnimationFrame(animateWave);
  }

  const observer = new IntersectionObserver(function (entries) {
    const entry = entries[0];

    if (entry && entry.isIntersecting) {
      if (!frame) {
        animateWave();
      }
    } else {
      stopWave();
    }
  }, { threshold: 0.2 });

  observer.observe(footer);

  window.addEventListener('pagehide', stopWave);
}());
