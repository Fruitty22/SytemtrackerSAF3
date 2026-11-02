// Reading vehicles out of a whole Excel workbook.
// Plain functions (no React), so they're easy to test and adjust.
import { normalizeLevel } from "./vehicle.js";
import { sheetKey, nameInSheet } from "../../shared/naming.js";
import { BLOCK_FIELDS, MAINTENANCE_FIELDS } from "../../shared/config.js";

const MID_HEADER = /\bMID\b/i;
const BLOCK_NAMES = BLOCK_FIELDS.map((f) => f.name);

// "3SG Chong_3SG Kim Jungwoo" -> "3sgchong3sgkimjungwoo"
export const normalizeName = sheetKey;

// 0 -> A, 25 -> Z, 26 -> AA ...
export const columnLetter = (index) => {
  if (index === "" || index == null) return "-";
  let letters = "";
  for (let n = Number(index) + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
};

const cellText = (row, index) =>
  index === "" || index == null ? "" : String(row?.[index] ?? "").trim();

// A MID cell: has a digit, is short, isn't a sentence
const looksLikeMid = (value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 && text.length <= 20 && /\d/.test(text) && !/\s{2,}/.test(text);
};

// a heading that is just "MID", "MID NO.", "MID NUMBER", "MID #"
const PLAIN_MID_HEADER = /^MID\s*(NO\.?|NUMBER|NUM|#)?\s*:?$/i;

// Columns whose heading is a blocked field or maintenance item
// ("VOR STATUS", "OVERSEAS", "MLC", "SAFETY BELTS / STRAP" ...)
// -> { "VOR STATUS": 36, "MLC": 12, ... }
export function findFieldColumns(header) {
  const keys = header.map((h) => sheetKey(h));
  const columns = {};
  for (const field of [...BLOCK_NAMES, ...MAINTENANCE_FIELDS]) {
    const i = keys.indexOf(sheetKey(field));
    if (i >= 0) columns[field] = i;
  }
  return columns;
}

// Find where the vehicle table is on a sheet: the "MID" heading with the most
// MID-looking values under it (looks at the first 40 rows), the type column,
// and any blocked-field / maintenance-item columns on the same header row.
// Returns null if the sheet has no vehicle list.
export function detectLayout(rows) {
  const candidates = [];
  const limit = Math.min(rows.length, 40);
  for (let r = 0; r < limit; r += 1) {
    const row = rows[r] ?? [];
    const filled = row.filter((cell) => String(cell ?? "").trim()).length;
    row.forEach((cell, c) => {
      const heading = String(cell ?? "").trim();
      if (!heading || heading.length > 30 || !MID_HEADER.test(heading)) return;
      let count = 0;
      for (let k = r + 1; k < Math.min(rows.length, r + 31); k += 1) {
        if (looksLikeMid(rows[k]?.[c])) count += 1;
      }
      if (count > 0) {
        candidates.push({ r, c, count, plain: PLAIN_MID_HEADER.test(heading), filled });
      }
    });
  }
  if (candidates.length === 0) return null;
  // prefer a plain "MID" heading, then more MIDs under it, then a fuller header row
  candidates.sort(
    (a, b) => Number(b.plain) - Number(a.plain) || b.count - a.count || b.filled - a.filled
  );
  const best = candidates[0];

  const header = (rows[best.r] ?? []).map((h) => String(h ?? "").trim().toUpperCase());
  const findColumn = (patterns) => {
    for (const re of patterns) {
      const i = header.findIndex((h, index) => index !== best.c && h && re.test(h));
      if (i >= 0) return i;
    }
    return "";
  };
  return {
    headerRow: best.r + 1, // Excel row number
    mid: best.c,
    type: findColumn([/TYPE/, /PLATFORM|MODEL/, /^VEH(ICLE)?S?$/]),
    fixedType: "",
    fields: findFieldColumns(header),
  };
}

// The vehicles on one sheet, using a layout from detectLayout (or set by hand).
// Each vehicle gets the values of every field column found on the sheet
// (blank cells included, so re-importing can clear a value).
export function readVehicles(rows, layout) {
  if (!layout || layout.mid === "" || layout.mid == null) return [];
  const fields = Object.entries(layout.fields ?? {});
  const out = [];
  const seen = new Set();
  rows.slice(layout.headerRow).forEach((row, i) => {
    const mid = cellText(row, layout.mid).toUpperCase();
    if (!looksLikeMid(mid) || seen.has(mid)) return;
    seen.add(mid);
    const maintenance = {};
    const blocks = {};
    for (const [field, col] of fields) {
      if (BLOCK_NAMES.includes(field)) blocks[field] = cellText(row, col);
      else maintenance[field] = normalizeLevel(cellText(row, col));
    }
    out.push({
      mid,
      type: (layout.type === "" ? layout.fixedType ?? "" : cellText(row, layout.type)).toUpperCase(),
      maintenance,
      blocks,
      line: layout.headerRow + i + 1, // Excel row number
    });
  });
  return out;
}

// Which account a worksheet belongs to:
//   1. an account that has this sheet linked (claimed, or set on the Accounts page)
//   2. an account whose display name or username IS the sheet name ("3SG Rizq", "NC")
//   3. exactly one account whose name (ranks ignored) is in the sheet name
//      ("3SG Jungwoo" is in "3SG Chong_3SG Kim Jungwoo", "3WO Firdaus" in "FIRDAUS")
// A sheet linked to several accounts is shared by all of them.
export function matchAccount(sheetName, users) {
  const n = normalizeName(sheetName);
  if (!n) return null;
  const linked = users.find((u) => (u.sheets ?? []).some((s) => normalizeName(s) === n));
  if (linked) return linked;
  const exact = users.find((u) => normalizeName(u.name) === n || normalizeName(u.username) === n);
  if (exact) return exact;
  const partial = users.filter((u) => nameInSheet(u.name, sheetName));
  return partial.length === 1 ? partial[0] : null;
}

// Is this a whole-fleet sheet (Dashboard, MID Details...) rather than a commander's?
export const isGeneralSheet = (sheetName, generalSheets) =>
  generalSheets.some((g) => normalizeName(g) === normalizeName(sheetName));

// Combine every sheet into one list with one row per MID.
// plans: [{ name, vehicles, ownerId, priority }]   (ownerId "" = don't import)
//   priority 3 = a sheet that belongs to an account (linked, matched or chosen)
//   priority 2 = a commander's sheet nobody has claimed yet
//   priority 1 = a general sheet (Dashboard, MID Details...)
// When a MID is on several sheets, the higher-priority sheet decides the owner
// (and is remembered as the vehicle's sheet, so it moves when the sheet is claimed);
// a type or field value missing on that sheet is filled in from the others.
export function mergeSheets(plans, fallbackType = "") {
  const byMid = new Map();
  let duplicates = 0;
  for (const plan of plans) {
    if (!plan.ownerId) continue;
    for (const v of plan.vehicles) {
      const entry = {
        mid: v.mid,
        type: v.type,
        maintenance: v.maintenance ?? {},
        blocks: v.blocks ?? {},
        ownerId: plan.ownerId,
        priority: plan.priority,
        sheet: plan.name,
        line: `${plan.name} row ${v.line}`,
      };
      const existing = byMid.get(v.mid);
      if (!existing) {
        byMid.set(v.mid, entry);
        continue;
      }
      duplicates += 1;
      const [winner, other] = entry.priority > existing.priority ? [entry, existing] : [existing, entry];
      byMid.set(v.mid, {
        ...winner,
        type: winner.type || other.type,
        maintenance: { ...other.maintenance, ...winner.maintenance },
        blocks: { ...other.blocks, ...winner.blocks },
      });
    }
  }
  const fallback = String(fallbackType).trim().toUpperCase();
  const rows = [...byMid.values()].map(({ priority, ...r }) => ({ ...r, type: r.type || fallback }));
  return {
    rows,
    duplicates,
    missingType: rows.filter((r) => !r.type).length,
  };
}
