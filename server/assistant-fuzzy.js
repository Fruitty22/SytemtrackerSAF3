// Typo-tolerant matching for the assistant: "aircond", "p platee", "vamtacc",
// "agillis", "cleanliness" -> the real field / vehicle type names.
//
// Kept strict on purpose so everyday words never turn into a field:
//   - only words of 5+ letters are corrected (1 typo; 8+ letters: 2 typos)
//   - only targets of 5+ letters can be matched
//   - a list of common English words is never corrected ("types" is not TYRES)
//   - if two targets are equally close, nothing is guessed

export const compact = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// words that are 1 typo away from a field or type name but mean something else
const COMMON = new Set(
  [
    "types", "type", "typed", "asking", "taking", "making", "baking", "tasting", "basking", "talking",
    "status", "better", "letter", "batter", "bitter", "cleaner", "cleaners", "cleared", "clearness",
    "stands", "standing", "stand", "tower", "power", "lower", "tours", "store", "stores", "story",
    "system", "staff", "stuff", "crane", "crate", "craft", "steps", "stops", "shops", "workshops",
    "canopies", "cushions", "covers", "seated", "battle", "cattle", "vehicle", "vehicles", "loans",
    "overseer", "overseen", "standby", "tyred", "tires", "tyres", "today", "total", "totals", "those",
    "these", "there", "where", "which", "while", "would", "could", "should", "about", "after",
    "again", "every", "all", "list", "show", "count", "counts", "counted", "ignore", "ignored",
    "disregard", "criteria", "commander", "commanders", "available", "deployed", "unavailable",
  ].map(compact)
);

// Levenshtein distance, giving up early once it is above `max`
export function distance(a, b, max = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const allowed = (len) => (len >= 8 ? 2 : len >= 5 ? 1 : 0);

// closest target for a word: targets = [{ key: "AIRCON", value: anything }]
// -> { value, key, d } or null (too far, too short, a common word, or a tie)
export function closest(word, targets) {
  const w = compact(word);
  const max = allowed(w.length);
  if (!max || COMMON.has(w) || /^\d+$/.test(w)) return null;
  let best = null;
  let tie = false;
  for (const t of targets) {
    if (t.key.length < 5) continue;
    const d = distance(w, t.key, max);
    if (d > max || d === 0) continue; // d === 0 is an exact match: not a typo, handled elsewhere
    if (!best || d < best.d) {
      best = { ...t, d };
      tie = false;
    } else if (d === best.d && best.value !== t.value) {
      tie = true;
    }
  }
  return best && !tie ? best : null;
}
