(function (root) {
  'use strict';
  const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));
  function healthModel(receipt) {
    const after = clamp(receipt.health),
      before = clamp(receipt.healthBefore ?? after + (receipt.loss || 0) - (receipt.healing || 0));
    return { before, after, delta: after - before, win: !!receipt.win };
  }
  function healthMarkup(m) {
    return `<section class="health-scene ${m.delta < 0 ? 'health-loss' : 'health-gain'}"><svg class="scene-heart" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="scene-heart-clip"><path d="M50 89 12 52C-8 27 17 1 39 20L50 30 61 20C83 1 108 27 88 52Z"/></clipPath></defs><path class="heart-empty" d="M50 89 12 52C-8 27 17 1 39 20L50 30 61 20C83 1 108 27 88 52Z"/><g clip-path="url(#scene-heart-clip)"><rect class="scene-heart-fill" x="0" y="0" width="100" height="89" style="transform:scaleY(${m.before / 100})"/></g><path class="heart-outline" d="M50 89 12 52C-8 27 17 1 39 20L50 30 61 20C83 1 108 27 88 52Z"/></svg><div class="health-scene-value" aria-label="현재 체력 ${m.after}">${m.after}</div>`;
  }
  function create({ document: doc, reduced = () => false }) {
    let active = null,
      epoch = 0;
    const impact =
      typeof AutoImpactHealth !== 'undefined' ? AutoImpactHealth.create(doc, reduced) : null;
    function cancel(kind) {
      if (!kind || kind === 'health') impact?.cancel();
      if (!active || (kind && active.kind !== kind)) return;
      const job = active;
      active = null;
      epoch++;
      for (const a of job.animations) a.cancel();
      job.node.close?.();
      job.node.remove();
      job.resolve(false);
    }
    function play(kind, payload) {
      cancel();
      if (kind === 'health' && impact) return impact.play(payload);
      const small = reduced(),
        stageOnly = kind === 'stage',
        node = doc.createElement(stageOnly ? 'div' : 'dialog'),
        generation = ++epoch;
      node.className =
        'screen-overlay ' +
        (stageOnly ? 'stage-cover' : kind === 'round' ? 'round-cover' : 'health-cover');
      node.setAttribute(
        'aria-label',
        stageOnly ? '다음 스테이지 안내' : kind === 'round' ? '다음 라운드 안내' : '전투 체력 변화',
      );
      node.setAttribute('tabindex', '-1');
      node.innerHTML = stageOnly
        ? `<section class="stage-scene"><strong>STAGE ${payload.stage}-${payload.round}</strong></section>`
        : kind === 'round'
          ? `<section class="round-scene"><span>AUTOCHESS · NEXT ROUND</span><strong>ROUND ${Math.max(1, Math.trunc(payload.stage) || 1)}</strong><b>${payload.stage}-${payload.round} · ${payload.type === 'SUPPLY' ? '보급' : payload.type === 'BOSS' ? '보스전' : '전투 준비'}</b></section>`
          : healthMarkup(healthModel(payload));
      if (stageOnly) {
        node.setAttribute('role', 'status');
        node.setAttribute('aria-live', 'polite');
      } else {
        for (const type of ['click', 'pointerdown', 'pointerup'])
          node.addEventListener(type, (e) => e.stopPropagation());
        node.addEventListener('cancel', (e) => e.preventDefault());
      }
      doc.body.appendChild(node);
      if (!stageOnly) node.showModal?.();
      const duration = small
        ? stageOnly
          ? 350
          : kind === 'round'
            ? 600
            : 500
        : stageOnly
          ? 1600
          : kind === 'round'
            ? 2200
            : 1500;
      let resolve;
      const promise = new Promise((r) => (resolve = r)),
        job = { node, kind, animations: [], resolve, generation };
      active = job;
      const frames = small
        ? [
            { opacity: 0 },
            { opacity: 1, offset: 0.12 },
            { opacity: 1, offset: 0.8 },
            { opacity: 0 },
          ]
        : kind === 'round'
          ? [
              { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
              { clipPath: 'inset(0 0% 0 0)', opacity: 1, offset: 0.3 },
              { clipPath: 'inset(0 0% 0 0)', opacity: 1, offset: 0.8 },
              { clipPath: 'inset(0 0% 0 0)', opacity: 0 },
            ]
          : [
              { opacity: 0 },
              { opacity: 1, offset: 0.14 },
              { opacity: 1, offset: 0.85 },
              { opacity: 0 },
            ];
      job.animations.push(node.animate(frames, { duration, easing: 'ease-out' }));
      if (kind === 'health') {
        const m = healthModel(payload),
          options = {
            duration: small ? 1 : 900,
            delay: small ? 0 : 150,
            easing: 'ease-in-out',
            fill: 'forwards',
          },
          tracks = [];
        for (const [selector, from, to] of [
          ['.scene-heart-fill', `scaleY(${m.before / 100})`, `scaleY(${m.after / 100})`],
        ]) {
          const el = node.querySelector(selector);
          if (el) tracks.push(el.animate([{ transform: from }, { transform: to }], options));
        }
        job.animations.push(...tracks);
        Promise.all(tracks.map((a) => a.finished.catch(() => {}))).then(() => {
          if (active === job) node.setAttribute('data-fill-complete', 'true');
        });
      } else if (kind === 'round' && !small) {
        const title = node.querySelector('.round-scene');
        if (title)
          job.animations.push(
            title.animate(
              [
                { transform: 'translateY(16px)', opacity: 0 },
                { transform: 'translateY(0)', opacity: 1, offset: 0.3 },
                { transform: 'translateY(0)', opacity: 1, offset: 0.8 },
                { transform: 'translateY(-12px)', opacity: 0 },
              ],
              { duration, easing: 'ease-out' },
            ),
          );
      }
      Promise.all(job.animations.map((a) => a.finished.catch(() => {}))).then(() => {
        if (active !== job || generation !== epoch) return;
        active = null;
        node.close?.();
        node.remove();
        resolve(true);
      });
      return promise;
    }
    return {
      round: (p) => play('round', p),
      stage: (p) => play('stage', p),
      health: (p) => play('health', p),
      cancel,
      get active() {
        return impact?.active ? 'health' : active?.kind || null;
      },
    };
  }
  const api = { create, healthModel, healthMarkup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.AutoScreenEffects = create({
      document: root.document,
      reduced: () => root.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    const cancel = () => root.AutoScreenEffects.cancel();
    root.addEventListener('resize', cancel);
    root.document.addEventListener('visibilitychange', () => {
      if (root.document.hidden) cancel();
    });
    root.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', cancel);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
