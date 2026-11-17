(function (root) {
  'use strict';
  const config = { columns: 7, rows: 8, playerFirstRow: 4, maxDeployed: 10, benchSize: 10 };
  const size = () => config.columns * config.rows,
    playerStart = () => config.playerFirstRow * config.columns;
  const point = (pos) => ({
    x: (pos % config.columns) + 0.5,
    y: Math.floor(pos / config.columns) + 0.5,
  });
  const distance = (a, b, columns = config.columns) =>
    Math.abs((a % columns) - (b % columns)) +
    Math.abs(Math.floor(a / columns) - Math.floor(b / columns));
  function convertFormation(units, fromColumns, firstRow, lastRow) {
    const occupied = new Set(),
      ordered = units
        .map((u, i) => ({
          u,
          i,
          row: Math.max(firstRow, Math.min(lastRow, Math.floor(u.pos / fromColumns))),
          col: u.pos % fromColumns,
        }))
        .sort(
          (a, b) => Number(a.col >= config.columns) - Number(b.col >= config.columns) || a.i - b.i,
        );
    for (const { u, row, col } of ordered) {
      const preferred = row * config.columns + Math.min(config.columns - 1, Math.max(0, col));
      let pos = preferred;
      if (occupied.has(pos)) {
        const candidates = Array.from(
          { length: (lastRow - firstRow + 1) * config.columns },
          (_, i) => firstRow * config.columns + i,
        ).filter((p) => !occupied.has(p));
        candidates.sort(
          (a, b) =>
            distance(a, preferred) - distance(b, preferred) ||
            Math.abs(Math.floor(a / config.columns) - row) -
              Math.abs(Math.floor(b / config.columns) - row) ||
            a - b,
        );
        pos = candidates[0];
      }
      if (pos === undefined) throw Error('전장 변환 공간 부족');
      u.pos = pos;
      occupied.add(pos);
    }
    return units;
  }
  function migrate(state) {
    if (state.boardColumns === config.columns) return state;
    const source = state.boardColumns || 8;
    if (source !== 8) throw Error('지원하지 않는 전장 저장 형식');
    convertFormation(
      (state.units || []).filter((u) => u.location === 'board'),
      source,
      config.playerFirstRow,
      config.rows - 1,
    );
    if (state.enemyEncounter?.units)
      convertFormation(state.enemyEncounter.units, source, 0, config.playerFirstRow - 1);
    state.boardColumns = config.columns;
    return state;
  }
  const api = { config, size, playerStart, point, distance, convertFormation, migrate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AutoBoard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
