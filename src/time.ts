// All date logic is anchored to the configured IANA timezone so DST is handled
// correctly. We never rely on the runner's clock zone.

export interface LocalNow {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;
  dateString: string; // YYYY-MM-DD in that zone
}

export function localNow(tz: string, now: Date = new Date()): LocalNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  // "24" appears at midnight in some locales; normalise.
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const minute = Number(get("minute"));

  const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, hour, minute, dateString };
}

export function yesterdayString(tz: string, now: Date = new Date()): string {
  const today = localNow(tz, now);
  const [y, m, d] = [today.year, today.month, today.day];
  // Build a UTC anchor for midnight that day and subtract 24h — good enough
  // for yyyy-mm-dd arithmetic without a full tz library.
  const anchor = Date.UTC(y, m - 1, d);
  const prev = new Date(anchor - 24 * 3600 * 1000);
  const yy = prev.getUTCFullYear();
  const mm = prev.getUTCMonth() + 1;
  const dd = prev.getUTCDate();
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function previousMonth(tz: string, now: Date = new Date()): { year: number; month: number } {
  const { year, month } = localNow(tz, now);
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthName(month: number): string {
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][month - 1];
}
