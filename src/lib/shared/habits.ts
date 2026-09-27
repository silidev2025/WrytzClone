/** Calendar math uses UTC only as a representation of date-only keys (no DST drift). */
const DAY = 86_400_000;
const key = (value: number) => new Date(value).toISOString().slice(0, 10);
const time = (value: string) => Date.parse(`${value}T00:00:00Z`);

export function validTimeZone(value: unknown): string {
  if (typeof value !== "string" || value.length > 100) return "UTC";
  try { return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone; }
  catch { return "UTC"; }
}

export function dateInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: validTimeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map((type) => parts.find((p) => p.type === type)!.value).join("-");
}

/** Daily/weekday goals count scheduled days; 3/week counts completed Monday-based weeks. */
export function habitStreak(dates: Iterable<string>, goal: string, today: string): number {
  const days = new Set(Array.from(dates).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today && Number.isFinite(time(d))));
  let cursor = time(today);
  if (!Number.isFinite(cursor)) return 0;
  if (goal === "3 times a week") {
    const week = (t: number) => t - ((new Date(t).getUTCDay() + 6) % 7) * DAY;
    const counts = new Map<number, number>();
    for (const date of days) { const w = week(time(date)); counts.set(w, (counts.get(w) || 0) + 1); }
    cursor = week(cursor);
    if ((counts.get(cursor) || 0) < 3) cursor -= 7 * DAY;
    let streak = 0;
    while ((counts.get(cursor) || 0) >= 3) { streak++; cursor -= 7 * DAY; }
    return streak;
  }
  const scheduled = (t: number) => goal !== "Weekdays" || ![0, 6].includes(new Date(t).getUTCDay());
  while (!scheduled(cursor)) cursor -= DAY;
  if (cursor === time(today) && !days.has(key(cursor))) {
    cursor -= DAY;
    while (!scheduled(cursor)) cursor -= DAY;
  }
  let streak = 0;
  while (days.has(key(cursor))) {
    streak++;
    do { cursor -= DAY; } while (!scheduled(cursor));
  }
  return streak;
}
