import {
  addDays,
  format,
  parseISO,
  startOfWeek,
  isValid,
} from "date-fns";

/**
 * The app's "today". Uses the real local date. (Set TODAY_OVERRIDE in the env
 * to pin a fixed date — handy for demos/tests.)
 */
export function todayISO(): string {
  return process.env.TODAY_OVERRIDE || format(new Date(), "yyyy-MM-dd");
}

/** Parse a YYYY-MM-DD string as a local date (no TZ shift). */
export function fromISO(iso: string): Date {
  const d = parseISO(iso + "T00:00:00");
  return isValid(d) ? d : new Date();
}

export function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function shiftISO(iso: string, days: number): string {
  return toISO(addDays(fromISO(iso), days));
}

/** Monday-first week containing the given date, returned as 7 ISO strings. */
export function weekOf(iso: string): string[] {
  const start = startOfWeek(fromISO(iso), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => toISO(addDays(start, i)));
}

export const fmt = {
  /** "Sat, Jun 27" */
  dayShort: (iso: string) => format(fromISO(iso), "EEE, MMM d"),
  /** "Saturday, June 27" */
  dayLong: (iso: string) => format(fromISO(iso), "EEEE, MMMM d"),
  /** "27" */
  dom: (iso: string) => format(fromISO(iso), "d"),
  /** "Sat" */
  dow: (iso: string) => format(fromISO(iso), "EEE"),
  /** "Wed, 6/24" */
  histDate: (iso: string) => format(fromISO(iso), "EEE, M/d"),
};
