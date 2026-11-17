// 스킬 등록표: 캐릭터 ID → 스킬 함수(this = 전투).
import cost1 from './cost1.js';
import cost2 from './cost2.js';
import cost3 from './cost3.js';
import cost4 from './cost4.js';
import cost5 from './cost5.js';

export const skills = Object.freeze({
  ...cost1,
  ...cost2,
  ...cost3,
  ...cost4,
  ...cost5,
});

export default skills;
