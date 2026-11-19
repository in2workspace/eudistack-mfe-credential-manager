import {
  AUDIT_DEFAULT_DAYS,
  defaultAuditPeriod,
  oldestAuditDateValue,
  parseDateInput,
  periodFromDates,
  toDateInputValue,
  validateAuditPeriod
} from './audit-period.helpers';

const DAY_MS = 24 * 60 * 60 * 1000;
// 2026-11-18 12:30, local time: the helpers work with the day the user picks in the browser.
const NOW = new Date(2026, 10, 18, 12, 30);
const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * DAY_MS);

describe('audit period helpers', () => {

  describe('defaultAuditPeriod', () => {
    it('is the last 30 days, up to now', () => {
      const period = defaultAuditPeriod(NOW);

      expect(period.to).toBe(NOW);
      expect(period.from.getTime()).toBe(NOW.getTime() - AUDIT_DEFAULT_DAYS * DAY_MS);
    });
  });

  describe('toDateInputValue / parseDateInput', () => {
    it('formats a local date as yyyy-MM-dd with leading zeros', () => {
      expect(toDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('parses a yyyy-MM-dd value as the start of that local day', () => {
      const date = parseDateInput('2026-11-18')!;

      expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()])
        .toEqual([2026, 10, 18, 0, 0]);
    });

    it.each(['', '18/11/2026', '2026-13-01', '2026-02-30', '2026-1-1', 'tomorrow'])(
      'does not parse "%s"', value => {
        expect(parseDateInput(value)).toBeNull();
      });
  });

  describe('periodFromDates', () => {
    it('runs from the start of the first day to the end of the second', () => {
      const period = periodFromDates('2026-10-01', '2026-10-10', NOW)!;

      expect(period.from).toEqual(new Date(2026, 9, 1));
      expect(period.to).toEqual(new Date(2026, 9, 11));
    });

    it('ends now when the last day is today', () => {
      const period = periodFromDates('2026-11-01', '2026-11-18', NOW)!;

      expect(period.to).toBe(NOW);
    });

    it('ends now when the last day is in the future', () => {
      const period = periodFromDates('2026-11-01', '2026-12-31', NOW)!;

      expect(period.to).toBe(NOW);
    });

    it('is null when a day is missing or not a date', () => {
      expect(periodFromDates('', '2026-11-18', NOW)).toBeNull();
      expect(periodFromDates('2026-11-01', 'x', NOW)).toBeNull();
    });
  });

  // The same limits as the audit API (PRD EUD-331 FR-04, EUD-329): from before to, at most 31 days, not before 90 days ago.
  describe('validateAuditPeriod', () => {
    it('accepts the default period', () => {
      expect(validateAuditPeriod(defaultAuditPeriod(NOW), NOW)).toBeNull();
    });

    it('accepts exactly 31 days', () => {
      expect(validateAuditPeriod({ from: daysAgo(31), to: NOW }, NOW)).toBeNull();
    });

    it('refuses a period of 40 days (AC-04)', () => {
      expect(validateAuditPeriod({ from: daysAgo(40), to: NOW }, NOW)).toBe('tooLong');
    });

    it('refuses a period that starts 100 days ago (AC-04)', () => {
      expect(validateAuditPeriod({ from: daysAgo(100), to: daysAgo(99) }, NOW)).toBe('tooOld');
    });

    it('accepts a short period that starts exactly 90 days ago', () => {
      expect(validateAuditPeriod({ from: daysAgo(90), to: daysAgo(89) }, NOW)).toBeNull();
    });

    it('accepts a period of 20 days that includes events of 45 days ago (AC-04)', () => {
      expect(validateAuditPeriod({ from: daysAgo(55), to: daysAgo(35) }, NOW)).toBeNull();
    });

    it('refuses a period that ends before it starts or is empty', () => {
      expect(validateAuditPeriod({ from: daysAgo(1), to: daysAgo(2) }, NOW)).toBe('invalid');
      expect(validateAuditPeriod({ from: NOW, to: NOW }, NOW)).toBe('invalid');
    });
  });

  describe('oldestAuditDateValue', () => {
    it('is the first day that starts within the 90 days the API serves', () => {
      const oldest = parseDateInput(oldestAuditDateValue(NOW))!;
      const dayBefore = new Date(oldest.getFullYear(), oldest.getMonth(), oldest.getDate() - 1);
      const limit = NOW.getTime() - 90 * DAY_MS;

      expect(oldest.getTime()).toBeGreaterThanOrEqual(limit);
      expect(dayBefore.getTime()).toBeLessThan(limit);
    });

    it('is a period the validation accepts', () => {
      const oldest = oldestAuditDateValue(NOW);
      const period = periodFromDates(oldest, oldest, NOW)!;

      expect(validateAuditPeriod(period, NOW)).toBeNull();
    });
  });
});
