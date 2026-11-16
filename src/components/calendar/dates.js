// Date helpers for the calendar (dates are "YYYY-MM-DD" strings, see shared/schedule.js)
import { addDays, parseIso } from "../../../shared/schedule.js";

// Weeks start on Monday. Change to 0 for Sunday.
export const WEEK_START = 1;

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const weekdayNames = () => [...DAY_NAMES.slice(WEEK_START), ...DAY_NAMES.slice(0, WEEK_START)];

export const startOfWeek = (iso) => {
  const day = parseIso(iso).getDay();
  return addDays(iso, -((day - WEEK_START + 7) % 7));
};

export const startOfMonth = (iso) => `${iso.slice(0, 7)}-01`;

export const addMonths = (iso, n) => {
  const d = parseIso(startOfMonth(iso));
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export const endOfMonth = (iso) => addDays(addMonths(iso, 1), -1);

// the 6 (or 5) weeks shown for a month: [weekStartIso, ...]
export const monthWeeks = (iso) => {
  const first = startOfWeek(startOfMonth(iso));
  const last = endOfMonth(iso);
  const weeks = [];
  for (let w = first; w <= last; w = addDays(w, 7)) weeks.push(w);
  return weeks;
};

const fmt = (iso, options) => parseIso(iso).toLocaleDateString("en-SG", options);

export const formatMonth = (iso) => fmt(iso, { month: "long", year: "numeric" });
export const formatDay = (iso) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });
export const formatLongDay = (iso) => fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// "4 Nov", "4 – 6 Nov", "30 Nov – 2 Dec 2026"
export const formatRange = (start, end) => {
  const a = parseIso(start);
  const b = parseIso(end);
  if (start === end) return fmt(start, { day: "numeric", month: "short" });
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} – ${fmt(end, { day: "numeric", month: "short" })}`;
  }
  return `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`;
};

export const formatWeek = (weekStart) => {
  const end = addDays(weekStart, 6);
  const text = formatRange(weekStart, end);
  return /\d{4}$/.test(text) ? text : `${text} ${end.slice(0, 4)}`;
};
