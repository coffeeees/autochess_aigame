(function (root) {
  'use strict';
  // Change only this registry when a character receives new art. Source PNGs stay separate.
  const portraits = {
    C01: {
      thumbnail: 'assets/characters/C01_녹스_thumbnail.png',
      detail: 'assets/characters/C01_녹스.png',
      framing: {
        field: { scale: 3.2, x: 50, y: 40 },
        bench: { scale: 1.9, x: 50, y: 40 },
        shop: { scale: 1.8, x: 50, y: 40 },
      },
    },
  };
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  function render(id, cost, context, fallback) {
    const art = portraits[id],
      frame = art?.framing?.[context],
      style = frame
        ? ` style="--portrait-scale:${frame.scale};--portrait-x:${frame.x}%;--portrait-y:${frame.y}%"`
        : '',
      file = context === 'detail' ? art?.detail : art?.thumbnail;
    if (context === 'detail' && !file) return fallback;
    return `<span class="character-art cost-art-${cost} art-${context}" data-character-art="${escape(id)}" data-art-context="${context}"${style}>${file ? `<img class="avatar character-image" src="${escape(file)}" alt="" draggable="false">` : fallback}</span>`;
  }
  const api = { portraits, render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AutoCharacterArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
