(function (root) {
  'use strict';
  // Display-only counter. Authoritative run HP is never written here.
  function create({
    paint,
    burst = () => {},
    later = setTimeout,
    clear = clearTimeout,
    reduced = () => false,
    visible = () => true,
  }) {
    let shown = null,
      target = null,
      timer = null,
      cleanup = () => {};
    function cancel() {
      if (timer !== null) clear(timer);
      timer = null;
      cleanup();
      cleanup = () => {};
      if (target !== null) {
        shown = target;
        paint(shown, false);
      }
    }
    function render(value) {
      value = Math.max(0, Math.trunc(value));
      if (value === target) return;
      if (timer !== null) clear(timer);
      timer = null;
      cleanup();
      cleanup = () => {};
      const before = shown;
      target = value;
      if (before === null || value >= before || reduced() || !visible()) {
        shown = value;
        paint(shown, false);
        return;
      }
      cleanup = burst() || (() => {});
      const gap = Math.min(80, 1600 / (before - value));
      function step() {
        shown = Math.max(target, shown - 1);
        paint(shown, true);
        if (shown > target) timer = later(step, gap);
        else {
          timer = null;
          cleanup();
          cleanup = () => {};
        }
      }
      timer = later(step, gap);
    }
    return {
      render,
      cancel,
      get displayed() {
        return shown;
      },
      get target() {
        return target;
      },
    };
  }
  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AutoHealthEffects = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
let healthDisplay = null;
function renderHealth(value) {
  const el = document.getElementById('health');
  if (!healthDisplay) {
    el.innerHTML =
      '<span class="health-heart" aria-hidden="true">♥</span><span class="health-value"></span>';
    const number = el.querySelector('.health-value'),
      heart = el.querySelector('.health-heart');
    let jiggle = null;
    healthDisplay = AutoHealthEffects.create({
      reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
      visible: () => !document.getElementById('gameView').hidden,
      paint: (n, shake) => {
        number.textContent = n;
        el.setAttribute('aria-label', '체력 ' + n);
        if (shake) {
          jiggle?.cancel();
          jiggle = number.animate(
            [{ transform: 'translateY(-1px)' }, { transform: 'translateY(0)' }],
            { duration: 80 },
          );
        }
      },
      burst: () => {
        const nodes = [],
          animations = [
            heart.animate(
              [
                { transform: 'rotate(0)' },
                { transform: 'translateX(-3px) rotate(-12deg)', offset: 0.25 },
                { transform: 'translateX(3px) rotate(10deg)', offset: 0.55 },
                { transform: 'rotate(0)' },
              ],
              { duration: 420 },
            ),
          ];
        for (let i = 0; i < 6; i++) {
          const p = document.createElement('i');
          p.className = 'heart-shard';
          el.appendChild(p);
          nodes.push(p);
          const angle = (i / 6) * Math.PI * 2;
          animations.push(
            p.animate(
              [
                { transform: 'translate(0,0) rotate(0)', opacity: 1 },
                {
                  transform:
                    'translate(' +
                    Math.cos(angle) * 26 +
                    'px,' +
                    (Math.sin(angle) * 23 + 12) +
                    'px) rotate(100deg)',
                  opacity: 0,
                },
              ],
              { duration: 520, fill: 'forwards' },
            ),
          );
        }
        return () => {
          jiggle?.cancel();
          for (const a of animations) a.cancel();
          for (const n of nodes) n.remove();
        };
      },
    });
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener?.('change', cancelHealthEffects);
  }
  healthDisplay.render(value);
}
function cancelHealthEffects() {
  healthDisplay?.cancel();
}
