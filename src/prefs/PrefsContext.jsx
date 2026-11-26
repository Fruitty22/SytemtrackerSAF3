import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Look-and-feel choices each person makes for themselves (account menu).
// Kept in this browser only; nothing goes to the server.
//   glass        - frosted-glass panels and pop-ups over a soft glow
//   colorLabels  - stat boxes with coloured status labels
const KEY = "argus.prefs";

const reducedTransparency = () => {
  try {
    return window.matchMedia?.("(prefers-reduced-transparency: reduce)").matches ?? false;
  } catch {
    return false;
  }
};

const read = () => {
  const defaults = { glass: !reducedTransparency(), colorLabels: true };
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {}) };
  } catch {
    return defaults; // storage blocked: defaults every visit
  }
};

const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(read);
  const set = useCallback((name, value) => {
    setPrefs((p) => {
      const next = { ...p, [name]: typeof value === "function" ? value(p[name]) : value };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage blocked: the choice lasts until the page is closed */
      }
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({
      ...prefs,
      toggleGlass: () => set("glass", (v) => !v),
      toggleColorLabels: () => set("colorLabels", (v) => !v),
    }),
    [prefs, set]
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext) ?? { glass: false, colorLabels: true, toggleGlass() {}, toggleColorLabels() {} };
