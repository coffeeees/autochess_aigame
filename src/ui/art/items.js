// 아이템 SVG 아이콘 (interaction-ui.js itemIcon을 그대로 옮김). SVG 문자열을 돌려준다.
import P from '../../core/progression.js';

export function itemIconSvg(id) {
  const def = P.itemById(id),
    shapes = {
      sword:
        '<path d="M18 7L24 2L25 10L13 23L9 19Z" fill="#e5deef"/><path d="M6 18L14 26M6 26L11 21" stroke="#ccb581" stroke-width="3"/>',
      armor:
        '<path d="M6 5L12 3Q16 8 20 3L26 5L30 12L24 15V28H8V15L2 12Z" fill="#b0b8cf"/><path d="M16 9V24" stroke="#68627d" stroke-width="3"/>',
      crystal:
        '<path d="M16 2L27 12L21 27L16 31L5 12Z" fill="#b2a0dc"/><path d="M16 2L12 12L16 31L21 12Z" fill="#e4d5fa"/>',
      necklace:
        '<path d="M6 4Q6 22 16 24Q26 22 26 4" fill="none" stroke="#d6b66d" stroke-width="3"/><path d="M16 17L23 24L16 31L9 24Z" fill="#d99aa8"/>',
      glove:
        '<path d="M7 16V8Q9 4 11 8V15V4Q14 1 15 5V14V3Q18 1 19 5V15V6Q22 4 23 9V20L20 29H10L4 20Q3 14 7 16Z" fill="#a1b6c9"/>',
      amulet:
        '<circle cx="16" cy="18" r="11" fill="#b79bdc" stroke="#e1c785" stroke-width="3"/><path d="M12 2L16 7L20 2M16 12V24M11 18H21" fill="none" stroke="#e9ddfa" stroke-width="2"/>',
      cloak:
        '<path d="M16 3L24 9L29 29Q16 23 3 29L8 9Z" fill="#9d92bd"/><path d="M10 8Q16 15 22 8L20 3H12Z" fill="#544763"/>',
      scope:
        '<circle cx="16" cy="16" r="10" fill="#746689" stroke="#d5c78e" stroke-width="3"/><path d="M1 16H31M16 1V31" stroke="#dfd3ed" stroke-width="2"/>',
      ring: '<circle cx="16" cy="21" r="9" fill="none" stroke="#d3b571" stroke-width="5"/><path d="M16 1L23 7L16 14L9 7Z" fill="#d1a3d0"/>',
      feather:
        '<path d="M7 29L25 3Q4 1 6 23L25 3L20 21Z" fill="#bddbd4"/><path d="M5 30L24 4" stroke="#6d8f85" stroke-width="2"/>',
    };
  return `<svg class="item-icon" viewBox="0 0 32 32" aria-hidden="true"><title>${def.name}</title>${shapes[def.iconKey] || shapes.crystal}</svg>`;
}
