(function (root) {
  'use strict';
  function water(hp, time) {
    const y = 89 * (1 - hp / 100),
      points = [];
    for (let x = 0; x <= 100; x += 2)
      points.push((x ? 'L' : 'M') + x + ' ' + (y + Math.sin(x * 0.12 + time * 0.005) * 2));
    return points.join(' ') + ' L100 100 L0 100Z';
  }
  function create(doc, reduced) {
    let job = null;
    function cancel() {
      if (!job) return;
      const old = job;
      job = null;
      cancelAnimationFrame(old.raf);
      for (const timer of old.timers) clearTimeout(timer);
      for (const a of old.animations) a.cancel();
      old.node.remove();
      old.resolve(false);
    }
    function play(receipt) {
      cancel();
      const after = Math.max(0, Math.min(100, receipt.health)),
        before = Math.max(
          0,
          Math.min(
            100,
            receipt.healthBefore ?? after + (receipt.loss || 0) - (receipt.healing || 0),
          ),
        ),
        delta = after - before,
        small = reduced(),
        duration = small ? 500 : 3000,
        node = doc.createElement('div');
      node.className = 'impact-health ' + (receipt.win ? 'impact-win' : 'impact-loss');
      node.setAttribute('role', 'status');
      node.setAttribute('aria-label', '체력 ' + before + ' → ' + after);
      node.innerHTML = `<section class="impact-heart-body"><i class="impact-ring"></i><svg viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="impact-heart-clip"><path d="M50 89 12 52C-8 27 17 1 39 20L50 30 61 20C83 1 108 27 88 52Z"/></clipPath></defs><path fill="#233c41" d="M50 89 12 52C-8 27 17 1 39 20L50 30 61 20C83 1 108 27 88 52Z"/><g clip-path="url(#impact-heart-clip)"><path class="impact-fill" data-water-y="${89 * (1 - before / 100)}" d="${water(before, 0)}" fill="${receipt.win ? '#65e2b7' : '#ee6d86'}"/></g><path fill="none" stroke="#eafff2" stroke-width="2" d="M50 89 12 52C-8 27 17 1 39 20L50 30 61 20C83 1 108 27 88 52Z"/></svg><strong class="impact-number">${before}</strong>${delta ? '<b class="impact-delta">' + (delta > 0 ? '+' : '−') + Math.abs(delta) + ' HP</b>' : ''}</section>`;
      doc.body.appendChild(node);
      let resolve;
      const promise = new Promise((r) => (resolve = r)),
        start = performance.now(),
        j = { node, resolve, animations: [], timers: [], raf: 0 };
      job = j;
      const body = node.querySelector('.impact-heart-body'),
        ring = node.querySelector('.impact-ring');
      j.animations.push(
        body.animate(
          small
            ? [{ opacity: 1 }, { opacity: 1 }]
            : [
                { transform: 'translateY(90px) scale(.2)' },
                { transform: 'translateY(-8px) scale(1.08)', offset: 345 / 3000 },
                { transform: 'translateY(0) scale(1)', offset: 517.5 / 3000 },
                { transform: 'scale(1)', offset: 2800 / 3000 },
                { transform: 'scale(.05)' },
              ],
          { duration, easing: 'ease-out' },
        ),
      );
      if (!small) {
        j.animations.push(
          node
            .querySelector('svg')
            .animate(
              receipt.win
                ? [
                    { filter: 'brightness(1)' },
                    { filter: 'brightness(1.8)' },
                    { filter: 'brightness(1)' },
                  ]
                : [
                    { transform: 'translateX(0)' },
                    { transform: 'translateX(-5px)', offset: 0.25 },
                    { transform: 'translateX(4px)', offset: 0.6 },
                    { transform: 'translateX(0)' },
                  ],
              { duration: 400, delay: 500 },
            ),
        );
        j.animations.push(
          ring.animate(
            [
              { transform: 'scale(.4)', opacity: 0 },
              { transform: 'scale(1)', opacity: 1, offset: 0.25 },
              { transform: 'scale(1.8)', opacity: 0 },
            ],
            { duration: 450, delay: 500 },
          ),
        );
        for (let i = 0; i < 24; i++) {
          const dot = doc.createElement('i');
          dot.className = 'impact-dot';
          body.appendChild(dot);
          const angle = i * 2.39996,
            x = Math.cos(angle) * (55 + (i % 5) * 12),
            y = Math.sin(angle) * (55 + (i % 4) * 12),
            life = 260 + (i % 6) * 50,
            delay = i < 18 ? 520 : 2800;
          dot.style.animationDelay = delay + 'ms';
          j.animations.push(
            dot.animate(
              [{ transform: 'translate(0,0)' }, { transform: `translate(${x}px,${y}px)` }],
              { duration: life, delay, fill: 'none' },
            ),
          );
          j.timers.push(setTimeout(() => dot.remove(), delay + life));
        }
      }
      function frame(now) {
        if (job !== j) return;
        const elapsed = now - start,
          t = small ? 1 : Math.max(0, Math.min(1, (elapsed - 900) / 800)),
          smooth = t * t * (3 - 2 * t),
          value = before + (after - before) * smooth;
        node.querySelector('.impact-number').textContent = String(Math.round(value));
        node
          .querySelector('.impact-fill')
          .setAttribute('data-water-y', String(89 * (1 - value / 100)));
        node.querySelector('.impact-fill').setAttribute('d', water(value, small ? 0 : elapsed));
        if (elapsed >= duration) {
          job = null;
          for (const timer of j.timers) clearTimeout(timer);
          node.remove();
          resolve(true);
          return;
        }
        j.raf = requestAnimationFrame(frame);
      }
      j.raf = requestAnimationFrame(frame);
      return promise;
    }
    return {
      play,
      cancel,
      get active() {
        return !!job;
      },
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
  else root.AutoImpactHealth = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
