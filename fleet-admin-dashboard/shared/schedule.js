// Calendar bookings ("events"): tasking, servicing, maintenance... on dates.
//
// An event: {
//   id, kind ("tasking" | "servicing" | "maintenance" | "other"),
//   title, field + tasking (tasking events only: which DEPLOYED_FIELDS field -
//   TASKING, SELF DRIVE, TLOAN, OVERSEAS - and the value it shows),
//   start "YYYY-MM-DD", end "YYYY-MM-DD" (inclusive, whole days),
//   startTime / endTime "HH:MM" or "" (shown only; status works by whole days),
//   vehicleIds [...], notes, createdBy, createdByName, createdAt, updatedAt, updatedBy
// }
// Dates are plain "YYYY-MM-DD" strings in local time, so there are no time-zone
// surprises: 2026-11-04 is 4 Nov wherever the app is opened.
import { DEPLOYED_FIELDS, SCHEDULE_KINDS } from "./config.js";

export const kindOf = (key) => SCHEDULE_KINDS.find((k) => k.key === key) ?? SCHEDULE_KINDS[SCHEDULE_KINDS.length - 1];

const pad = (n) => String(n).padStart(2, "0");

// Date -> "YYYY-MM-DD" (local)
export const isoDate = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const isIsoDate = (text) => {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

// the blocked-style field a booking fills while it's on ("" = none)
export const eventField = (e) => {
  const kind = kindOf(e.kind);
  if (kind.key === "tasking") return DEPLOYED_FIELDS.includes(e.field) ? e.field : "TASKING";
  return kind.field;
};

// Dates written inside a value, e.g. "XCS (26/09 - 16/10)" or "EX X 3/11-7/11/2026".
// Returns { start, end } or null. A missing year is the one that puts the start
// closest to `today`; an end before the start is in the next year.
export function datesInText(text, today = isoDate()) {
  const m = /(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\s*(?:-|–|to)\s*(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/i.exec(
    String(text ?? "")
  );
  if (!m) return null;
  const [, d1, m1, y1, d2, m2, y2] = m;
  const fullYear = (y) => (y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : null);
  const make = (y, mo, d) => `${y}-${pad(mo)}-${pad(d)}`;
  const base = Number(today.slice(0, 4));
  let startYear = fullYear(y1) ?? fullYear(y2);
  if (!startYear) {
    startYear = [base - 1, base, base + 1]
      .map((y) => ({ y, gap: isIsoDate(make(y, m1, d1)) ? Math.abs(daysBetween(today, make(y, m1, d1))) : Infinity }))
      .sort((a, b) => a.gap - b.gap)[0].y;
  }
  const start = make(startYear, m1, d1);
  let end = make(fullYear(y2) ?? startYear, m2, d2);
  if (!isIsoDate(start) || !isIsoDate(end)) return null;
  if (end < start && !y2) end = make(startYear + 1, m2, d2);
  if (end < start || daysBetween(start, end) > 366) return null;
  return { start, end };
}

export const isTime = (text) => typeof text === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(text);

// "YYYY-MM-DD" -> Date at local midnight
export const parseIso = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso, days) => {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return isoDate(date);
};

// whole days from a to b (b - a)
export const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 86400000);

export const onDate = (event, iso) => event.start <= iso && iso <= event.end;

export const overlaps = (a, b) => a.start <= b.end && b.start <= a.end;

// Which events are on today, per vehicle: Map(vehicleId -> [event, ...])
export function eventsByVehicleOn(events, iso) {
  const map = new Map();
  for (const e of events) {
    if (!onDate(e, iso)) continue;
    for (const id of e.vehicleIds ?? []) map.set(id, [...(map.get(id) ?? []), e]);
  }
  return map;
}

// Other events that book the same vehicle on overlapping dates
export function clashes(event, events) {
  const ids = new Set(event.vehicleIds ?? []);
  return events
    .filter((e) => e.id !== event.id && overlaps(e, event) && kindOf(e.kind).effect !== "none")
    .map((e) => ({ event: e, vehicleIds: (e.vehicleIds ?? []).filter((id) => ids.has(id)) }))
    .filter((c) => c.vehicleIds.length > 0);
}
