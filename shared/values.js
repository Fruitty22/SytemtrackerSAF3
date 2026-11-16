// Making sense of what commanders actually type (and colour) in their sheets.
//
// The real workbook isn't standardised: one commander writes "Deployable" in
// SVC STATUS, another "YES", another only colours the cell green or red; one
// writes "Good" for a Y/N item, another "NA", "NIL" or "X". These rules turn
// all of that into the app's own values, so every sheet is counted the same way.
//
// Used by the import (src/utils/workbook.js) and by the status logic
// (shared/deployability.js), so the browser and the server agree.

// ---------------------------------------------------------------- blocked fields

// In TASKING / SELF DRIVE / TLOAN / OVERSEAS / ICT / STANDBY / WORKSHOP...,
// these mean "no" - the vehicle is NOT on that. They never block.
export const NO_VALUES = ["N", "NO", "NIL", "NA", "N/A", "N.A.", "-", "--", "NONE", "NOT APPLICABLE", "0", "FALSE"];

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const isNoValue = (value) => {
  const text = clean(value).toUpperCase();
  return !text || NO_VALUES.includes(text);
};

// A blocked field's value as stored: "" for the no-values
export const cleanBlockValue = (value) => (isNoValue(value) ? "" : clean(value));

// ---------------------------------------------------------------- Y / N items

// What each value in a Y/N item column means:
//   "Y"  passes            "N"  fails (the vehicle is UNAVAILABLE)
//   ""   not applicable - the vehicle doesn't have / need it, not counted
// Anything not listed here is shown on the import's "Scan criteria" step,
// where the Admin chooses; the choice is saved (Manage Criteria) for next time.
export const DEFAULT_ITEM_MEANINGS = {
  Y: "Y",
  YES: "Y",
  GOOD: "Y",
  OK: "Y",
  NEW: "Y",
  SERVICEABLE: "Y",
  "✓": "Y",
  "✔": "Y",
  N: "N",
  NO: "N",
  BAD: "N",
  FAULTY: "N",
  MISSING: "N",
  "TAG MISSING": "N",
  "UNDER CSW": "N",
  NA: "",
  "N/A": "",
  "N.A.": "",
  NIL: "",
  "-": "",
  X: "", // e.g. staff cars with X for IVC: they don't have one (change it if X means faulty)
};

export const MEANING_LABELS = { Y: "Y (passes)", N: "N (fails)", "": "Not applicable" };

// { value -> meaning } as saved by the Admin, on top of the defaults
export const itemMeanings = (saved = {}) => ({ ...DEFAULT_ITEM_MEANINGS, ...saved });

// "good " -> "Y", "N/A" -> "", "LOCK" -> undefined (unknown)
export function itemLevel(value, meanings = DEFAULT_ITEM_MEANINGS) {
  const text = clean(value).toUpperCase();
  if (!text) return "";
  return Object.prototype.hasOwnProperty.call(meanings, text) ? meanings[text] : undefined;
}

// ---------------------------------------------------------------- SVC STATUS

// The app's own SVC STATUS values (stored in the blocked field "SVC STATUS";
// blank = deployable). Anything else a commander typed is kept as it is.
export const SVC_STATUS_FIELD = "SVC STATUS";
export const SVC_STATUS_OPTIONS = ["VOR", "WORKSHOP", "NOT DEPLOYABLE", "MAINTENANCE", "PENDING AVI"];

const STATUS_OK = /^(DEPLOYABLE|DEPLOYED|AVA|AVAILABLE|YES|Y|OK|SVC|SERVICEABLE|S|GOOD|READY|NIL|-)$/;

// Commander's SVC STATUS text -> { ok: true } or { value: "VOR" } or { loan: "LOANED OUT" }
export function statusFromText(raw) {
  const text = clean(raw).toUpperCase();
  if (!text) return null;
  if (STATUS_OK.test(text)) return { ok: true };
  if (/\bVOR\b/.test(text)) return { value: "VOR" };
  if (/W\/?\s*SHOP|WORKSHOP|WKSP|WSKP/.test(text)) return { value: "WORKSHOP" };
  if (/^(NO|N|NOT DEPLOYABLE|NON[- ]?DEPLOYABLE|U\/?S|UNSERVICEABLE|NOT AVA(ILABLE)?)$/.test(text))
    return { value: "NOT DEPLOYABLE" };
  if (/MAINT/.test(text)) return { value: "MAINTENANCE" };
  if (/LOAN/.test(text)) return { loan: clean(raw).toUpperCase() };
  return { value: clean(raw).toUpperCase().slice(0, 60) };
}

// "FF66FF33" / "66FF33" -> what the colour means in SVC STATUS
//   "ok"     green or blue
//   "out"    red, orange, pink, magenta
//   "black"  the row is crossed out (the vehicle moved to another sheet)
//   null     white / grey / no colour
export function colourMeaning(rgb) {
  const hex = String(rgb ?? "").replace(/^#/, "").slice(-6);
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  if (max < 0.2) return "black";
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
  if (sat < 0.25 || light > 0.93) return null; // white / grey
  let hue;
  if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue >= 70 && hue < 270) return "ok"; // green, cyan, blue
  return "out"; // red, orange, yellow, pink, magenta
}

// "27 Feb 25", "13/Oct/2026", "5 March 26", "14/10/2026", "2026-10-14" -> "2026-10-14" (or "")
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export function looseDate(raw) {
  const text = clean(raw).toUpperCase();
  if (!text) return "";
  const year = (y) => (y.length <= 2 ? 2000 + Number(y) : Number(y));
  const iso = (y, m, d) => {
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return "";
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[\s/.-]+([A-Z]{3,9})[\s/.-]+(\d{2,4})$/.exec(text);
  if (m) {
    const month = MONTHS.findIndex((x) => m[2].startsWith(x));
    return month >= 0 ? iso(year(m[3]), month + 1, Number(m[1])) : "";
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (m) return iso(year(m[3]), Number(m[2]), Number(m[1])); // day first (Singapore)
  return "";
}

const shortDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : "");

// The vehicle's SVC STATUS from everything on its row, in this order:
//   1. the words in SVC STATUS ("VOR", "Deployable", "YES", "WORKSHOP"...)
//   2. the colour of the SVC STATUS cell (green / blue = ok, red / orange = out)
//   3. VOR- DATE IN filled in, or the MID cell coloured cyan (the sheets' VOR mark),
//      or Remarks that just say "VOR"
// in: { text, colour, vorIn, vorOut, midColour, remarks }
// out: { value, loan, sheetSays: "ok" | "out" | "", from, note }
//   value      what goes in SVC STATUS ("" = deployable)
//   loan       "LOANED OUT" etc. -> put in TLOAN (deployed)
//   sheetSays  the commander's own verdict, for the "sheet says / app says" check
export function readStatus({ text, colour, vorIn, vorOut, midColour, remarks }) {
  const vorNote = () => {
    const inText = clean(vorIn);
    const outText = clean(vorOut);
    const inDate = looseDate(inText);
    const outDate = looseDate(outText);
    const parts = [];
    if (inText) parts.push(`VOR date in: ${inDate ? shortDate(inDate) : inText}`);
    if (outText) parts.push(`date out: ${outDate ? shortDate(outDate) : outText}`);
    return parts.join(", ");
  };

  const fromText = statusFromText(text);
  const vorMarked = !!clean(vorIn) || isCyan(midColour);
  if (fromText?.ok) return { value: "", sheetSays: "ok", from: `SVC STATUS "${clean(text)}"` };
  if (fromText?.loan) return { value: "", loan: fromText.loan, sheetSays: "ok", from: `SVC STATUS "${clean(text)}"` };
  if (fromText?.value) {
    // "NO" on a vehicle the sheet also marks as VOR -> VOR
    const value = fromText.value === "NOT DEPLOYABLE" && vorMarked ? "VOR" : fromText.value;
    return {
      value,
      sheetSays: "out",
      from: `SVC STATUS "${clean(text)}"`,
      note: value === "VOR" ? vorNote() : "",
    };
  }

  const fromColour = colourMeaning(colour);
  if (fromColour === "ok") return { value: "", sheetSays: "ok", from: "SVC STATUS coloured green / blue" };
  if (fromColour === "out") {
    return {
      value: vorMarked ? "VOR" : "NOT DEPLOYABLE",
      sheetSays: "out",
      from: "SVC STATUS coloured red",
      note: vorMarked ? vorNote() : "",
    };
  }

  if (clean(vorIn)) return { value: "VOR", sheetSays: "out", from: "VOR- DATE IN filled in", note: vorNote() };
  if (isCyan(midColour)) return { value: "VOR", sheetSays: "out", from: "MID cell coloured cyan (VOR)", note: vorNote() };
  if (/^VOR\b/i.test(clean(remarks))) return { value: "VOR", sheetSays: "out", from: 'Remarks "VOR"' };
  // nothing in SVC STATUS, but Remarks say "AVA" / "Deployable": only used to
  // compare with what the app works out (the import's "sheet says" check)
  if (STATUS_OK.test(clean(remarks).toUpperCase()) && clean(remarks)) return { value: "", sheetSays: "ok", from: "" };
  return { value: "", sheetSays: "", from: "" };
}

// the sheets mark VOR vehicles by colouring the MID cell cyan (00FFFF)
export function isCyan(rgb) {
  const hex = String(rgb ?? "").replace(/^#/, "").slice(-6).toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return r < 90 && g > 200 && b > 200;
}
