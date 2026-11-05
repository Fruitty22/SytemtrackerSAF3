// Column-title matching, ported from the Excel macro (modColumnMap.bas).
//
// Different commanders type the same column differently: "Veh No. (MID)" /
// "MID", "Type of Vehicle" / "VEHICLE TYPE", "WHEEL -CHOKE " / "WHEEL-CHOKE",
// "CLEANLINESS" / "CLEANINESS". These rules decide when two titles mean the
// same column - exactly as NormalizeTitle / TitlesMatch / IsCoreField do in
// the workbook, so a file that worked with the macros works here too.

// Columns every fleet sheet has that are NOT criteria (CoreFieldNames)
export const CORE_FIELDS = [
  "S/N",
  "MID",
  "VEHICLE TYPE",
  "PARKING LOT ALLOCATION",
  "LOCATION",
  "PARKING LOT",
  "DATE BOOK IN",
  "DEPLOYABLE",
  "REMARK",
];

// "Veh No.\n(MID)" -> "VEHNOMID"
export const normalizeTitle = (s) =>
  String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

// "  wheel -choke " -> "WHEEL -CHOKE" (what we store as a criteria name)
export const cleanTitle = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const STOP_WORDS = new Set(["OF", "THE", "A", "AN", "TO", "IN", "FOR", "AND"]);

// "Type of Vehicle" -> ["TYPE", "VEHICLE"] (unique words, in order, stop words dropped)
function tokens(s) {
  const words = String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));
  return [...new Set(words)];
}

const isNumeric = (w) => /^\d+(\.\d+)?$/.test(w);

export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
}

// Typo tolerance: same number of words, each word identical, except words of
// 4+ letters may differ by one character (CLEANINESS / CLEANLINESS).
function wordsMatchWithTypos(a, b) {
  const wa = tokens(a);
  const wb = tokens(b);
  if (wa.length !== wb.length || wa.length === 0) return false;
  return wa.every((x, i) => {
    const y = wb[i];
    if (x === y) return true;
    if (x.length < 4 || y.length < 4) return false;
    return levenshtein(x, y) <= 1;
  });
}

const matchCache = new Map();

// Do these two column titles mean the same column? (TitlesMatch)
export function titlesMatch(titleA, titleB) {
  const key = `${titleA}\u0001${titleB}`;
  if (matchCache.has(key)) return matchCache.get(key);
  const result = titlesMatchCore(titleA, titleB);
  if (matchCache.size > 20000) matchCache.clear();
  matchCache.set(key, result);
  return result;
}

function titlesMatchCore(titleA, titleB) {
  const a = normalizeTitle(titleA);
  const b = normalizeTitle(titleB);
  if (!a || !b) return a === b;
  if (a === b) return true;

  // S/N and S/No are the same column
  if ((a === "SN" || a === "SNO") && (b === "SN" || b === "SNO")) return true;

  // "Parking Lot" and "Parking Lot Allocation" are different fields
  if (a.includes("PARKINGLOT") && b.includes("PARKINGLOT")) {
    if (a.includes("ALLOCATION") !== b.includes("ALLOCATION")) return false;
  }

  // One title's words all inside the other's ("Type of Vehicle" = "VEHICLE TYPE",
  // "Veh No. (MID)" ~ "MID"). A number among the extra words ("IVC" vs "IVC 2")
  // means a different column.
  const setA = tokens(titleA);
  const setB = tokens(titleB);
  if (setA.length && setB.length) {
    const [small, large] = setA.length <= setB.length ? [setA, setB] : [setB, setA];
    const largeSet = new Set(large);
    if (small.every((w) => largeSet.has(w))) {
      const smallSet = new Set(small);
      return !large.some((w) => !smallSet.has(w) && isNumeric(w));
    }
  }

  return wordsMatchWithTypos(titleA, titleB);
}

// Is this one of the fixed columns (MID, type, location...)? (IsCoreField)
export const isCoreField = (title) => CORE_FIELDS.some((core) => titlesMatch(title, core));

// The criteria (from the criteria list) that this column title is, or null.
// criteria: [{ name, category }]  (GetCriteriaCategory)
export function matchCriteria(title, criteria) {
  return criteria.find((c) => titlesMatch(c.name, title)) ?? null;
}
