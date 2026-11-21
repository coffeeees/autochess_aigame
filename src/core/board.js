// 전장 좌표계(v0.18.0 좌우 대치형). 8열 × 7행 = 56칸, pos = row × 8 + col.
// 아군은 왼쪽 4열(col 0..3), 적은 오른쪽 4열(col 4..7). 전열은 아군 col 3 / 적 col 4,
// 후열은 아군 col 0 / 적 col 7. 거리·이웃은 방향과 무관한 칸 거리(맨해튼)라 회전해도 같다.
// v0.17.x까지는 7열 × 8행 상하 대치(아군 아래 4행)였고, 저장은 rotateOldPos로 한 번만 이관한다.
const config = { columns: 8, rows: 7, allyColumns: 4, maxDeployed: 10, benchSize: 10 };
/** 예전 상하 대치 전장(7열 × 8행, 아군 아래 4행) */
const oldLayout = { columns: 7, rows: 8 };
const size = () => config.columns * config.rows;
const colOf = (pos) => pos % config.columns;
const rowOf = (pos) => Math.floor(pos / config.columns);
const cell = (col, row) => row * config.columns + col;
/** 아군이 배치할 수 있는 칸(왼쪽 4열) */
const isAllyCell = (pos) =>
  Number.isInteger(pos) && pos >= 0 && pos < size() && colOf(pos) < config.allyColumns;
/**
 * 진영 기준 앞쪽 정도: 0 = 후열, 3 = 전열(가운데에 가장 가까운 열). 아군은 col 그대로, 적은 7 − col.
 * 앞줄·뒷줄·전방 2열 같은 증강 판정은 이 값으로 한다(행이 아니라 열).
 */
const depth = (pos, team = 'ally') =>
  team === 'enemy' ? config.columns - 1 - colOf(pos) : colOf(pos);
const point = (pos) => ({ x: colOf(pos) + 0.5, y: rowOf(pos) + 0.5 });
const distance = (a, b, columns = config.columns) =>
  Math.abs((a % columns) - (b % columns)) +
  Math.abs(Math.floor(a / columns) - Math.floor(b / columns));
/**
 * 예전 칸 번호(7열 × 8행) → 새 칸 번호(8열 × 7행). 시계 방향 90도 회전:
 * newRow = oldCol, newCol = 7 − oldRow. 아래쪽 아군(oldRow 4..7)은 왼쪽(newCol 3..0)이 된다.
 */
function rotateOldPos(oldPos) {
  const oldRow = Math.floor(oldPos / oldLayout.columns),
    oldCol = oldPos % oldLayout.columns;
  return cell(oldLayout.rows - 1 - oldRow, oldCol);
}
/** 새 칸 번호 → 예전 칸 번호(되돌리기, 테스트·도구용) */
function unrotatePos(pos) {
  const oldRow = oldLayout.rows - 1 - colOf(pos),
    oldCol = rowOf(pos);
  return oldRow * oldLayout.columns + oldCol;
}
/**
 * 예전 전장(7열) 저장의 칸을 새 좌표계로 한 번 옮긴다(전장 아군·적 편성 캐시).
 * 이미 새 전장(boardColumns 8)이면 그대로 둔다(중복 회전 없음).
 */
function migrate(state) {
  if (state.boardColumns === config.columns) return state;
  if (state.boardColumns !== oldLayout.columns) throw Error('지원하지 않는 전장 저장 형식');
  for (const u of state.units || []) if (u.location === 'board') u.pos = rotateOldPos(u.pos);
  for (const u of state.enemyEncounter?.units || []) u.pos = rotateOldPos(u.pos);
  state.boardColumns = config.columns;
  return state;
}
const api = {
  config,
  oldLayout,
  size,
  colOf,
  rowOf,
  cell,
  isAllyCell,
  depth,
  point,
  distance,
  rotateOldPos,
  unrotatePos,
  migrate,
};

export default api;
