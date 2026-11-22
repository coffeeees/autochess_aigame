// 장비 SVG 아이콘(v0.20.0). 기본 장비 8종은 모양 하나, 완성 장비는 첫 재료 모양에 두 번째 재료 모양을
// 오른쪽 아래에 작게 겹쳐 그리고 금색 테두리 점으로 완성 장비임을 표시한다. SVG 문자열을 돌려준다.
import P from '../../core/progression.js';

const shapes = {
  sword:
    '<path d="M18 7L24 2L25 10L13 23L9 19Z" fill="#e5deef"/><path d="M6 18L14 26M6 26L11 21" stroke="#ccb581" stroke-width="3"/>',
  staff:
    '<path d="M9 29L21 9" stroke="#b98d5a" stroke-width="3" stroke-linecap="round"/><circle cx="23" cy="7" r="5" fill="#8fb6ff"/><circle cx="23" cy="7" r="2.2" fill="#e8f1ff"/>',
  bow: '<path d="M8 3Q28 16 8 29" fill="none" stroke="#c99b62" stroke-width="3"/><path d="M8 3V29" stroke="#e8e2d4" stroke-width="1.5"/><path d="M4 16H26M22 12L26 16L22 20" fill="none" stroke="#dfe7f2" stroke-width="2"/>',
  crystal:
    '<path d="M16 2L27 12L21 27L16 31L5 12Z" fill="#e58aa0"/><path d="M16 2L12 12L16 31L21 12Z" fill="#ffd3dc"/>',
  armor:
    '<path d="M6 5L12 3Q16 8 20 3L26 5L30 12L24 15V28H8V15L2 12Z" fill="#b0b8cf"/><path d="M16 9V24" stroke="#68627d" stroke-width="3"/>',
  gem: '<path d="M16 3L27 12L16 29L5 12Z" fill="#6a8cff"/><path d="M5 12H27M16 3L11 12L16 29L21 12Z" fill="none" stroke="#cfdcff" stroke-width="1.5"/>',
  glove:
    '<path d="M7 16V8Q9 4 11 8V15V4Q14 1 15 5V14V3Q18 1 19 5V15V6Q22 4 23 9V20L20 29H10L4 20Q3 14 7 16Z" fill="#a1b6c9"/>',
  feather:
    '<path d="M7 29L25 3Q4 1 6 23L25 3L20 21Z" fill="#bddbd4"/><path d="M5 30L24 4" stroke="#6d8f85" stroke-width="2"/>',
};

export function itemIconSvg(id) {
  const def = P.itemById(id);
  if (!def) return '<svg class="item-icon" viewBox="0 0 32 32" aria-hidden="true"></svg>';
  const main = shapes[def.iconKey] || shapes.crystal;
  const sub =
    def.kind === 'complete'
      ? `<g transform="translate(17 17) scale(.5)"><rect x="-2" y="-2" width="36" height="36" rx="8" fill="#0e1320" stroke="#e6c449" stroke-width="3"/>${shapes[def.subIconKey] || ''}</g>`
      : '';
  return `<svg class="item-icon" viewBox="0 0 32 32" aria-hidden="true"><title>${def.name}</title>${main}${sub}</svg>`;
}

/** 회수기(특수 아이템): 갈고리 모양 */
export function recoveryIconSvg() {
  return '<svg class="item-icon" viewBox="0 0 32 32" aria-hidden="true"><title>회수기</title><path d="M16 3V17Q16 26 9 26Q4 26 4 21" fill="none" stroke="#6fd3c7" stroke-width="3.5" stroke-linecap="round"/><path d="M4 21L1 24M4 21L8 23" stroke="#6fd3c7" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="4" r="3" fill="#c8f4ee"/><path d="M20 10H28M24 6V14" stroke="#fff4c9" stroke-width="2.5" stroke-linecap="round"/></svg>';
}
