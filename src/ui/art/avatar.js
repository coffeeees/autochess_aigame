// 캐릭터에 일러스트·스프라이트가 없을 때 쓰는 SVG 아바타(결정 D6).
// prototype.js의 icon()과 shell-ui.js의 enemyIcon()을 그대로 옮김. SVG 문자열을 돌려준다.
import D from '../../core/data/units.js';
import W from '../../core/encounters.js';

const traitColors = {
  화염: '#d87e59',
  빙결: '#8fc7de',
  번개: '#d6bb60',
  대지: '#b69368',
  바람: '#7eb9a0',
  물: '#6bace0',
  신성: '#d5c480',
  암흑: '#9a87bb',
  독: '#9ab66c',
  혈마법: '#c57a87',
};

// 적(shell-ui.js enemyIcon을 그대로 옮김)
function enemyIcon(id, summonKind = null) {
  const t = W.byId(id),
    color =
      summonKind === 'fire'
        ? '#d68c59'
        : summonKind === 'lightning'
          ? '#dfc966'
          : summonKind === 'plague'
            ? '#98ad72'
            : t.color;
  let shape;
  if (id === 'E04' && !summonKind)
    shape =
      '<path d="M22 25L3 12L6 44L24 39M42 25L61 12L58 44L40 39" fill="' +
      color +
      '" stroke="#17151c" stroke-width="3"/><ellipse cx="32" cy="35" rx="15" ry="19" fill="' +
      color +
      '"/>';
  else if (id === 'E02' && !summonKind)
    shape =
      '<path d="M18 28L6 18M18 37L4 36M20 44L7 54M46 28L58 18M46 37L60 36M44 44L57 54" stroke="' +
      color +
      '" stroke-width="5"/><ellipse cx="32" cy="35" rx="19" ry="20" fill="' +
      color +
      '"/>';
  else if (id === 'E06')
    shape =
      '<rect x="11" y="14" width="42" height="43" rx="7" fill="' +
      color +
      '" stroke="#17151c" stroke-width="4"/><path d="M33 15L29 27L37 33L32 43" fill="none" stroke="#78634e" stroke-width="3"/>';
  else if (id === 'E01')
    shape =
      '<path d="M14 32Q12 9 32 10Q52 9 50 32L44 43V54H20V43Z" fill="' +
      color +
      '" stroke="#17151c" stroke-width="4"/><path d="M26 46V54M33 46V54M40 46V54" stroke="#17151c" stroke-width="3"/>';
  else if (id === 'E03')
    shape =
      '<path d="M17 29L4 19L13 42M47 29L60 19L51 42" fill="' +
      color +
      '"/><ellipse cx="32" cy="35" rx="20" ry="23" fill="' +
      color +
      '"/><path d="M18 18L32 5L46 18Z" fill="#6c7051"/>';
  else if (id === 'E07' || summonKind === 'fire')
    shape =
      '<path d="M13 50Q4 32 25 19L34 4L40 25L51 17Q65 43 50 54Z" fill="' +
      color +
      '" stroke="#17151c" stroke-width="3"/>';
  else if (id === 'E08')
    shape =
      '<path d="M9 52L12 27L20 32L20 10L31 24L43 8L44 31L56 24L55 54Z" fill="' +
      color +
      '" stroke="#17151c" stroke-width="3"/>';
  else
    shape =
      '<path d="M7 50Q5 27 23 25Q31 7 39 25Q60 28 57 51Q33 64 7 50Z" fill="' +
      color +
      '" stroke="#17151c" stroke-width="3"/>';
  return `<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="7" fill="#29272e"/>${shape}<circle cx="24" cy="34" r="3.5" fill="#1a1820"/><circle cx="40" cy="34" r="3.5" fill="#1a1820"/><path d="M28 44H36" stroke="#1a1820" stroke-width="3" stroke-linecap="round"/>${id === 'E99' ? '<circle cx="49" cy="13" r="9" fill="#f7db7f" stroke="#8a692d" stroke-width="2"/><path d="M49 7V19" stroke="#8a692d" stroke-width="2"/>' : ''}</svg>`;
}

export function avatarSvg(id, summonKind = null) {
  if (W.byId(id)) return enemyIcon(id, summonKind);
  const t = D.byId(id),
    color = traitColors[t.trait],
    index = Number(id.slice(1));
  if (summonKind)
    return `<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="7" fill="#22252a"/><path d="M15 50Q8 31 25 17Q29 5 35 17Q58 31 49 50Z" fill="${summonKind === 'fire' ? '#e9a15f' : summonKind === 'lightning' ? '#dcc858' : summonKind === 'specter' ? '#b5c7e8' : '#9dbd77'}" stroke="#14151b" stroke-width="4"/><circle cx="25" cy="33" r="3"/><circle cx="39" cy="33" r="3"/><path d="M27 42h10" stroke="#111" stroke-width="3"/></svg>`;
  const skin =
    t.race === '언데드'
      ? '#dad9ca'
      : t.race === '마족'
        ? '#c29bae'
        : t.race === '용족'
          ? '#a9bca0'
          : index === 10
            ? '#d2af90'
            : '#f0cfb6';
  const hair = [
    '#383139',
    '#a8a5af',
    '#282a36',
    '#d7d5a4',
    '#6b91a0',
    '#b8b1bf',
    '#a78c59',
    '#454657',
    '#74836f',
    '#8d7360',
    '#a67d58',
    '#d2c9b7',
  ][(index - 1) % 12];
  let race = '';
  if (['마족', '용족'].includes(t.race))
    race =
      '<path d="M15 21L12 5L26 17M39 17L52 5L49 24" fill="#c4bca7" stroke="#17151d" stroke-width="3"/>';
  if (t.race === '수인')
    race =
      '<path d="M13 26L11 6L29 19M37 19L54 6L52 26" fill="#b59d82" stroke="#17151d" stroke-width="3"/>';
  if (t.race === '천족')
    race = '<ellipse cx="32" cy="7" rx="14" ry="4" fill="none" stroke="#e4d48c" stroke-width="3"/>';
  const ears =
    t.race === '엘프'
      ? '<path d="M17 29L5 22L15 40M47 29L59 22L49 40" fill="' +
        skin +
        '" stroke="#17151d" stroke-width="3"/>'
      : '';
  const beard =
    t.race === '드워프'
      ? '<path d="M17 38Q32 62 47 38L43 54L32 61L21 54Z" fill="' +
        hair +
        '" stroke="#17151d" stroke-width="2"/>'
      : '';
  let weapon =
    t.job === '궁수'
      ? '<path d="M55 20Q39 36 55 55L55 20M48 39H62" fill="none" stroke="#ddc79b" stroke-width="3"/>'
      : t.job === '기사'
        ? '<path d="M45 37L60 40L59 54L52 61L44 54Z" fill="#9aabb6" stroke="#17151d" stroke-width="3"/>'
        : t.job === '암살자'
          ? '<path d="M8 39L3 55L12 49Z" fill="#d7dce0" stroke="#17151d" stroke-width="2"/>'
          : ['소환사', '주술사', '마법사'].includes(t.job)
            ? '<path d="M56 27V59" stroke="#bca482" stroke-width="4"/><circle cx="56" cy="25" r="6" fill="' +
              color +
              '" stroke="#17151d" stroke-width="3"/>'
            : '<path d="M6 57V31L10 25L14 31V52M2 49H18" fill="#bcc5cf" stroke="#17151d" stroke-width="2"/>';
  return `<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="7" fill="#282830"/>${race}<path d="M10 63Q10 43 32 43Q54 43 54 63Z" fill="${color}" stroke="#17151d" stroke-width="3"/>${ears}<ellipse cx="32" cy="29" rx="18" ry="20" fill="${skin}" stroke="#17151d" stroke-width="3"/><path d="M14 27Q10 8 31 10Q54 8 51 28L42 22L37 26L28 21L22 26Z" fill="${hair}" stroke="#17151d" stroke-width="2"/><circle cx="25" cy="32" r="2.5" fill="#20202a"/><circle cx="39" cy="32" r="2.5" fill="#20202a"/><path d="M29 41H35" stroke="#20202a" stroke-width="2.5" stroke-linecap="round"/>${t.race === '언데드' ? '<path d="M27 45v4M33 45v4M39 44v4" stroke="#48474b" stroke-width="2"/>' : ''}${beard}${weapon}</svg>`;
}
