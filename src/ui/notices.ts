// Notice policy for the rebuilt UI: the same lists as src/legacy/notice-policy.js
// (kept equal by tests/ui-next/store.test.js until the legacy UI is removed).
// Only these notices are shown; every other notice id stays silent.

/** v0.15.7 audit: notices that are shown (T01-T41). */
export const RETAINED = [
  'T02',
  'T03',
  'T04',
  'T05',
  'T06',
  'T15',
  'T16',
  'T19',
  'T23',
  'T25',
  'T34',
  'T39',
] as const;
/** T28: item discard refusals with cause-specific wording (approved). */
export const APPROVED = ['T28'] as const;
/** Added in the rebuild: save failed, damaged save backed up, battle cancelled by reload. */
export const ADDED = ['T42', 'T43', 'T44'] as const;

const shown = new Set<string>([...RETAINED, ...APPROVED, ...ADDED]);

export function allows(id: string): boolean {
  return shown.has(id);
}

/** How long a shown notice stays (v0.15.18: 3 seconds, restarted by a new notice). */
export const NOTICE_MS = 3000;
