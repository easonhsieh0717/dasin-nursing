import { describe, it, expect } from 'vitest';
import { roundClockIn, roundClockOut, fmtRoundedTime } from './utils';

describe('roundClockIn (上班進位到整點/半點)', () => {
  it('07:31 → 08:00', () => {
    expect(roundClockIn(new Date('2026-03-10T07:31:00'))).toEqual({ hours: 8, minutes: 0 });
  });

  it('08:01 → 08:30', () => {
    expect(roundClockIn(new Date('2026-03-10T08:01:00'))).toEqual({ hours: 8, minutes: 30 });
  });

  it('08:30 → 08:30 (不變)', () => {
    expect(roundClockIn(new Date('2026-03-10T08:30:00'))).toEqual({ hours: 8, minutes: 30 });
  });

  it('08:00 → 08:00 (不變)', () => {
    expect(roundClockIn(new Date('2026-03-10T08:00:00'))).toEqual({ hours: 8, minutes: 0 });
  });

  it('08:31 → 09:00', () => {
    expect(roundClockIn(new Date('2026-03-10T08:31:00'))).toEqual({ hours: 9, minutes: 0 });
  });

  it('23:45 → 00:00 (跨日)', () => {
    expect(roundClockIn(new Date('2026-03-10T23:45:00'))).toEqual({ hours: 0, minutes: 0 });
  });

  it('20:00 → 20:00 (不變)', () => {
    expect(roundClockIn(new Date('2026-03-10T20:00:00'))).toEqual({ hours: 20, minutes: 0 });
  });
});

describe('roundClockOut (下班捨去到整點/半點)', () => {
  it('08:00 → 08:00', () => {
    expect(roundClockOut(new Date('2026-03-10T08:00:00'))).toEqual({ hours: 8, minutes: 0 });
  });

  it('08:29 → 08:00', () => {
    expect(roundClockOut(new Date('2026-03-10T08:29:00'))).toEqual({ hours: 8, minutes: 0 });
  });

  it('08:30 → 08:30', () => {
    expect(roundClockOut(new Date('2026-03-10T08:30:00'))).toEqual({ hours: 8, minutes: 30 });
  });

  it('08:59 → 08:30', () => {
    expect(roundClockOut(new Date('2026-03-10T08:59:00'))).toEqual({ hours: 8, minutes: 30 });
  });

  it('20:00 → 20:00', () => {
    expect(roundClockOut(new Date('2026-03-10T20:00:00'))).toEqual({ hours: 20, minutes: 0 });
  });
});

describe('fmtRoundedTime', () => {
  it('formats correctly', () => {
    expect(fmtRoundedTime(8, 0)).toBe('0800');
    expect(fmtRoundedTime(8, 30)).toBe('0830');
    expect(fmtRoundedTime(20, 0)).toBe('2000');
    expect(fmtRoundedTime(0, 0)).toBe('0000');
  });
});
