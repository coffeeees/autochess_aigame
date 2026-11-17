// Skill registry: character id -> skill function (this = battle).
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
