'use strict';
const { spawnSync } = require('node:child_process');
const tests = [
  'test-prototype.cjs',
  'test-progression.cjs',
  'test-higher-drafts.cjs',
  'test-preparation.cjs',
  'test-home-enemies.cjs',
  'test-two-cost.cjs',
  'test-items.cjs',
  'test-combat-visuals.cjs',
  'test-interface.cjs',
  'test-augments.cjs',
  'test-board.cjs',
  'test-drag-sales.cjs',
  'test-ui-refinement.cjs',
  'test-v0159.cjs',
  'test-v01510.cjs',
  'test-v01511.cjs',
  'test-v01512.cjs',
  'test-v01515.cjs',
  'test-v01516.cjs',
  'test-v01517.cjs',
  'test-motion17.cjs',
  'test-v01518.cjs',
  'test-vfx18.cjs',
];
for (const test of tests) {
  const result = spawnSync(process.execPath, [test], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('\nAll 23 suites passed (337 tests).');
