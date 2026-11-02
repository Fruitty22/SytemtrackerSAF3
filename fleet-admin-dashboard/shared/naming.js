// Matching people's names to worksheet names. Used by the server and the app.

// "3SG Chong_3SG Kim Jungwoo" -> "3sgchong3sgkimjungwoo"
export const sheetKey = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// "3SG Chong_3SG Kim Jungwoo" -> ["3sg", "chong", "3sg", "kim", "jungwoo"]
export const nameWords = (value) =>
  String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

// Ranks don't identify a person ("3SG" is in lots of names)
export const RANKS = new Set([
  "pte", "lcp", "cpl", "cfc", "3sg", "2sg", "1sg", "ssg", "msg", "3wo", "2wo", "1wo",
  "mwo", "swo", "cwo", "me1", "me2", "me3", "me4", "2lt", "lta", "cpt", "maj", "ltc", "col",
]);

// Is this person's name in the sheet name? Ranks are ignored, so "3SG Jungwoo"
// and "3SG Chong" are both in "3SG Chong_3SG Kim Jungwoo", and "3WO Firdaus"
// is in "FIRDAUS".
export function nameInSheet(name, sheet) {
  const sheetWords = new Set(nameWords(sheet));
  const words = nameWords(name).filter((w) => !RANKS.has(w));
  return words.some((w) => w.length >= 3) && words.every((w) => sheetWords.has(w));
}
