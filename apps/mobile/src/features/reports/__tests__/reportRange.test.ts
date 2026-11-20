import { availablePresets, rangeForPreset } from '../reportRange';
import { lesson } from '../../../test-utils/domainFixtures';

const today = new Date(2026, 10, 19);
const term = { id: 't', title: 'Term 1', kind: 'term' as const, startDate: '2026-09-01', endDate: '2026-12-18', updatedAt: 1 };
const custom = { from: '2026-01-01', to: '2026-01-31' };

describe('report ranges', () => {
  it('offers "this term" only during a term', () => {
    expect(availablePresets([], today)).not.toContain('thisTerm');
    expect(availablePresets([term], today)).toContain('thisTerm');
  });

  it.each([
    ['thisMonth', { from: '2026-11-01', to: '2026-11-30' }],
    ['lastMonth', { from: '2026-10-01', to: '2026-10-31' }],
    ['last30', { from: '2026-10-21', to: '2026-11-19' }],
    ['thisTerm', { from: '2026-09-01', to: '2026-12-18' }],
    ['custom', custom],
  ] as const)('computes %s', (preset, expected) => {
    expect(rangeForPreset(preset, today, [term], [], custom)).toEqual(expected);
  });

  it('spans all lessons for "all time"', () => {
    const lessons = [lesson({ id: 'b', date: '2026-10-05' }), lesson({ id: 'a', date: '2026-02-01' })];
    expect(rangeForPreset('allTime', today, [], lessons, custom)).toEqual({ from: '2026-02-01', to: '2026-10-05' });
  });
});
