import { AuditPeriod } from '../models/audit-event.model';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;

export const AUDIT_DEFAULT_DAYS = 30;
/** Longest period the audit API serves in one query. */
export const AUDIT_MAX_PERIOD_DAYS = 31;
/** How far back the audit API serves; older events are archived. */
export const AUDIT_ONLINE_DAYS = 90;

export type AuditPeriodError = 'invalid' | 'tooLong' | 'tooOld';

/** The last 30 days, up to now. */
export function defaultAuditPeriod(now: Date): AuditPeriod {
  return { from: new Date(now.getTime() - AUDIT_DEFAULT_DAYS * DAY_MS), to: now };
}

/** `yyyy-MM-dd` in local time, the value of an `input[type=date]`. */
export function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Local midnight of an `input[type=date]` value, or null when it is empty or not a real date. */
export function parseDateInput(value: string): Date | null {
  const match = DATE_INPUT.exec(value);
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/**
 * The period of two chosen days: from the start of the first to the end of the second, or to now when
 * that day is today (or later).
 */
export function periodFromDates(fromValue: string, toValue: string, now: Date): AuditPeriod | null {
  const from = parseDateInput(fromValue);
  const toDay = parseDateInput(toValue);
  if (!from || !toDay) {
    return null;
  }
  const endOfToDay = new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1);
  return { from, to: endOfToDay.getTime() > now.getTime() ? now : endOfToDay };
}

/** The same limits as the audit API: `from` before `to`, at most 31 days, not before 90 days ago. */
export function validateAuditPeriod(period: AuditPeriod, now: Date): AuditPeriodError | null {
  if (period.from.getTime() >= period.to.getTime()) {
    return 'invalid';
  }
  if (period.to.getTime() - period.from.getTime() > AUDIT_MAX_PERIOD_DAYS * DAY_MS) {
    return 'tooLong';
  }
  if (period.from.getTime() < now.getTime() - AUDIT_ONLINE_DAYS * DAY_MS) {
    return 'tooOld';
  }
  return null;
}

/** First day whose start is still within the 90 days the API serves, as an `input[type=date]` value. */
export function oldestAuditDateValue(now: Date): string {
  const limit = new Date(now.getTime() - AUDIT_ONLINE_DAYS * DAY_MS);
  const startOfLimitDay = new Date(limit.getFullYear(), limit.getMonth(), limit.getDate());
  const firstDay = startOfLimitDay.getTime() >= limit.getTime()
    ? startOfLimitDay
    : new Date(limit.getFullYear(), limit.getMonth(), limit.getDate() + 1);
  return toDateInputValue(firstDay);
}
