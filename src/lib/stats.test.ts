import { describe, expect, it } from 'vitest';
import { movingAverage, summarizeWeights } from './stats';

describe('movingAverage', () => {
  it('averages a 7-day trailing window', () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: 200 - i }));
    const ma = movingAverage(pts);
    expect(ma[0].value).toBe(200);
    expect(ma[9].value).toBeCloseTo((191 + 192 + 193 + 194 + 195 + 196 + 197) / 7);
  });
});

describe('summarizeWeights', () => {
  it('reports start, current, lowest and loss', () => {
    const s = summarizeWeights(
      [
        { date: '2026-09-01', value: 220 },
        { date: '2026-09-08', value: 218 },
        { date: '2026-09-15', value: 217.5 },
        { date: '2026-09-29', value: 215 },
      ],
      221,
    );
    expect(s.current).toBe(215);
    expect(s.start).toBe(221);
    expect(s.lowest).toBe(215);
    expect(s.totalLost).toBe(6);
    expect(s.weeklyChange).toBeLessThan(0);
  });
  it('handles empty input', () => {
    expect(summarizeWeights([]).current).toBeNull();
  });
});
