import { z } from "zod";
import type { TimeWindow } from "./domain";

const madridFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const madridOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Madrid",
  timeZoneName: "longOffset",
  hour: "2-digit",
});

function madridLocalDateTimeToDate(value: string) {
  const match =
    /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})$/.exec(
      value,
    );
  if (!match?.groups) return null;
  const { year, month, day, hour, minute } = match.groups;
  const wallClockUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const offsetName = madridOffsetFormatter
    .formatToParts(new Date(wallClockUtc))
    .find((part) => part.type === "timeZoneName")?.value;
  const offsetMatch =
    /^GMT(?<sign>[+-])(?<hours>\d{2}):(?<minutes>\d{2})$/.exec(
      offsetName || "",
    );
  if (!offsetMatch?.groups) return null;
  const offsetMinutes =
    (Number(offsetMatch.groups.hours) * 60 +
      Number(offsetMatch.groups.minutes)) *
    (offsetMatch.groups.sign === "+" ? 1 : -1);
  const date = new Date(wallClockUtc - offsetMinutes * 60_000);
  const rendered = madridFormatter
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  const roundTrip = `${rendered.year}-${rendered.month}-${rendered.day}T${rendered.hour}:${rendered.minute}`;
  return roundTrip === value ? date : null;
}

export const madridLocalDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .refine((value) => madridLocalDateTimeToDate(value) !== null)
  .transform((value) => madridLocalDateTimeToDate(value)!);

function madridParts(value: Date) {
  return madridFormatter
    .formatToParts(value)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
}

function calendarDay(
  parts: Record<string, string>,
  days: number,
  hour = 0,
  minute = 0,
) {
  const date = new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day) + days,
    ),
  );
  const local = `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(
    hour,
  ).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return madridLocalDateTimeToDate(local)!;
}

export function windowBounds(
  window: TimeWindow,
  now = new Date(),
): [Date, Date] {
  const parts = madridParts(now);
  if (window === "now") return [now, now];
  if (window === "all") return [now, new Date("9999-12-31T23:59:59.999Z")];
  if (window === "tonight") {
    const beforeCutoff = Number(parts.hour) < 4;
    return [
      calendarDay(parts, beforeCutoff ? -1 : 0, 18),
      calendarDay(parts, beforeCutoff ? 0 : 1, 4),
    ];
  }
  if (window === "tomorrow")
    return [calendarDay(parts, 1), calendarDay(parts, 2)];

  const localDate = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  );
  const weekday = localDate.getUTCDay();
  const daysToSaturday = weekday === 0 ? -1 : (6 - weekday + 7) % 7;
  return [
    calendarDay(parts, daysToSaturday),
    calendarDay(parts, daysToSaturday + 2),
  ];
}

export function occurrenceMatches(
  startsAt: string,
  endsAt: string,
  window: TimeWindow,
  now = new Date(),
) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()))
    return false;
  if (window === "now") return start <= now && end > now;
  const [from, to] = windowBounds(window, now);
  return start < to && end > from;
}
