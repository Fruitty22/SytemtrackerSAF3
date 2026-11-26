import { createContext, useState, useMemo } from "react";
import { usePrefs } from "./prefs/PrefsContext";
import { createTheme, alpha } from "@mui/material/styles";

// ARGUS theme: "Abyss Teal" - near-black sea-teal background, deep teal accents.
// To change the theme, change BRAND (used by the logo, sidebar, calendar, guide,
// node switch) and the primary / greenAccent / blueAccent shades below
// (500 = the base colour; 100-400 lighter, 600-900 darker). index.html has the
// page background too (shown before the app loads).
export const BRAND = {
  bg: "#020a0b", // page background            (= primary[500])
  panel: "#0a181a", // sidebar, cards, boxes    (= primary[400])
  accent: "#2f9c90", // buttons, highlights     (= greenAccent[500])
  accent2: "#1a4a52", // table headers           (= blueAccent[700])
  accentText: "#4fb3bb", // accent as text on the dark background (= blueAccent[400])
  deep: "#010607", // deepest shade, for gradients
  glow: "#0d3236", // soft glow behind the node-switch cover
  logoFrom: "#3fb6ad", // logo hexagon gradient
  logoTo: "#174f55",
  logoVisor: "#0d2a2e",
};

// color design tokens export
export const tokens = (mode) => ({
  ...(mode === "dark"
    ? {
        grey: {
          100: "#e0e0e0",
          200: "#c2c2c2",
          300: "#a3a3a3",
          400: "#858585",
          500: "#666666",
          600: "#525252",
          700: "#3d3d3d",
          800: "#292929",
          900: "#141414",
        },
        primary: {
          100: "#cfd8d9",
          200: "#9fb1b3",
          300: "#6f8a8d",
          400: "#0a181a",
          500: "#020a0b",
          600: "#02090a",
          700: "#010607",
          800: "#010405",
          900: "#000202",
        },
        greenAccent: {
          100: "#d5efec",
          200: "#acdfd9",
          300: "#82cfc6",
          400: "#59bfb3",
          500: "#2f9c90",
          600: "#267d73",
          700: "#1c5e56",
          800: "#133e3a",
          900: "#091f1d",
        },
        redAccent: {
          100: "#f8dcdb",
          200: "#f1b9b7",
          300: "#e99592",
          400: "#e2726e",
          500: "#db4f4a",
          600: "#af3f3b",
          700: "#832f2c",
          800: "#58201e",
          900: "#2c100f",
        },
        blueAccent: {
          100: "#d2eef0",
          200: "#a6dde1",
          300: "#79ccd2",
          400: "#4fb3bb",
          500: "#2f8d96",
          600: "#24707a",
          700: "#1a4a52",
          800: "#12353b",
          900: "#0a1f23",
        },
      }
    : {
        grey: {
          100: "#141414",
          200: "#292929",
          300: "#3d3d3d",
          400: "#525252",
          500: "#666666",
          600: "#858585",
          700: "#a3a3a3",
          800: "#c2c2c2",
          900: "#e0e0e0",
        },
        primary: {
          100: "#040509",
          200: "#080b12",
          300: "#0c101b",
          400: "#f2f0f0", // manually changed
          500: "#141b2d",
          600: "#1F2A40",
          700: "#727681",
          800: "#a1a4ab",
          900: "#d0d1d5",
        },
        greenAccent: {
          100: "#091f1d",
          200: "#133e3a",
          300: "#1c5e56",
          400: "#267d73",
          500: "#2f9c90",
          600: "#59bfb3",
          700: "#82cfc6",
          800: "#acdfd9",
          900: "#d5efec",
        },
        redAccent: {
          100: "#2c100f",
          200: "#58201e",
          300: "#832f2c",
          400: "#af3f3b",
          500: "#db4f4a",
          600: "#e2726e",
          700: "#e99592",
          800: "#f1b9b7",
          900: "#f8dcdb",
        },
        blueAccent: {
          100: "#0a1f23",
          200: "#12353b",
          300: "#1a4a52",
          400: "#24707a",
          500: "#2f8d96",
          600: "#4fb3bb",
          700: "#79ccd2",
          800: "#a6dde1",
          900: "#d2eef0",
        },
      }),
});

// ---------------------------------------------------------------- glass look
// "Glass effect" in the account menu: see-through frosted panels and pop-ups
// over a soft teal glow, with a thin light edge and a highlight on top (like
// iOS). Pop-ups are frosted more than page panels so text behind them never
// shows through. Phones get a lighter blur.
const GLASS = {
  dark: {
    glow: `radial-gradient(900px 620px at 8% 6%, rgba(47,156,144,.42), transparent 60%),
      radial-gradient(760px 640px at 92% 12%, rgba(36,112,122,.55), transparent 62%),
      radial-gradient(820px 620px at 55% 100%, rgba(79,179,187,.26), transparent 60%),
      ${BRAND.bg}`,
    panel: "rgba(12, 34, 37, 0.40)",
    popup: "rgba(7, 24, 27, 0.80)",
    well: "rgba(1, 8, 9, 0.50)",
    sheen: "linear-gradient(140deg, rgba(255,255,255,.08), rgba(255,255,255,.015) 55%, rgba(255,255,255,.04))",
    edge: "rgba(255, 255, 255, 0.11)",
    shadow: "inset 0 1px 0 rgba(255,255,255,.16), 0 10px 28px rgba(0,0,0,.35)",
    popupShadow: "inset 0 1px 0 rgba(255,255,255,.20), 0 24px 60px rgba(0,0,0,.55)",
    dim: "rgba(0, 0, 0, 0.35)",
  },
  light: {
    glow: `radial-gradient(900px 620px at 8% 6%, rgba(47,156,144,.22), transparent 60%),
      radial-gradient(760px 640px at 92% 12%, rgba(79,179,187,.22), transparent 62%),
      radial-gradient(820px 620px at 55% 100%, rgba(26,74,82,.12), transparent 60%),
      #eef4f3`,
    panel: "rgba(255, 255, 255, 0.55)",
    popup: "rgba(255, 255, 255, 0.82)",
    well: "rgba(255, 255, 255, 0.55)",
    sheen: "linear-gradient(140deg, rgba(255,255,255,.55), rgba(255,255,255,.1) 55%, rgba(255,255,255,.3))",
    edge: "rgba(255, 255, 255, 0.85)",
    shadow: "inset 0 1px 0 rgba(255,255,255,.9), 0 8px 24px rgba(20,60,60,.12)",
    popupShadow: "inset 0 1px 0 rgba(255,255,255,.95), 0 24px 60px rgba(20,60,60,.22)",
    dim: "rgba(10, 30, 30, 0.18)",
  },
};
const glassOf = (t) => (t.argus?.glass ? GLASS[t.palette.mode] : null);
const blur = (px) => ({ backdropFilter: `blur(${px}px) saturate(165%)`, WebkitBackdropFilter: `blur(${px}px) saturate(165%)` });

// A frosted surface as sx (empty when the glass look is off).
// kind: "panel" (page boxes) | "popup" (pop-ups, menus, the chat)
export const glassSurface = (theme, kind = "panel") => {
  const g = glassOf(theme);
  if (!g) return {};
  const popup = kind === "popup";
  return {
    backgroundColor: popup ? g.popup : g.panel,
    backgroundImage: g.sheen,
    ...blur(popup ? 30 : 16),
    border: `1px solid ${g.edge}`,
    boxShadow: popup ? g.popupShadow : g.shadow,
    [theme.breakpoints.down("sm")]: blur(popup ? 18 : 10),
  };
};

// Use instead of backgroundColor: colors.primary[400] for a page box ("panel"):
// the normal panel colour, or frosted glass when the glass look is on.
export const PANEL = {
  backgroundColor: (t) => (glassOf(t) ? glassOf(t).panel : tokens(t.palette.mode).primary[400]),
  backgroundImage: (t) => glassOf(t)?.sheen,
  backdropFilter: (t) => (glassOf(t) ? "blur(16px) saturate(165%)" : undefined),
  WebkitBackdropFilter: (t) => (glassOf(t) ? "blur(16px) saturate(165%)" : undefined),
  border: (t) => (glassOf(t) ? `1px solid ${glassOf(t).edge}` : undefined),
  boxShadow: (t) => glassOf(t)?.shadow,
  borderRadius: (t) => (glassOf(t) ? "14px" : "4px"),
};

// mui theme settings
export const themeSettings = (mode, { glass = false } = {}) => {
  const colors = tokens(mode);
  const g = glass ? GLASS[mode] : null;
  return {
    argus: { glass },
    palette: {
      mode: mode,
      ...(mode === "dark"
        ? {
            // palette values for dark mode
            primary: {
              main: colors.primary[500],
            },
            secondary: {
              main: colors.greenAccent[500],
            },
            neutral: {
              dark: colors.grey[700],
              main: colors.grey[500],
              light: colors.grey[100],
            },
            background: {
              default: g ? g.well : colors.primary[500],
            },
            // MUI X Data Grid (v8+) reads its colors from palette.DataGrid
            DataGrid: {
              bg: g ? "transparent" : colors.primary[400],
              headerBg: colors.blueAccent[700],
              pinnedBg: g ? "#0b2226" : colors.primary[400],
            },
          }
        : {
            // palette values for light mode
            primary: {
              main: colors.primary[100],
            },
            secondary: {
              main: colors.greenAccent[500],
            },
            neutral: {
              dark: colors.grey[700],
              main: colors.grey[500],
              light: colors.grey[100],
            },
            background: {
              default: g ? g.well : "#fcfcfc",
            },
            DataGrid: {
              bg: g ? "transparent" : colors.primary[400],
              headerBg: colors.blueAccent[700],
              pinnedBg: g ? "#f4f8f8" : colors.primary[400],
            },
          }),
    },
    // Ticks, radio buttons and switches use the green accent, so a ticked box
    // is easy to see in both dark and light mode (the "primary" colour is
    // almost the same as the background in dark mode).
    components: {
      MuiCheckbox: { defaultProps: { color: "secondary" } },
      MuiRadio: { defaultProps: { color: "secondary" } },
      MuiSwitch: { defaultProps: { color: "secondary" } },
      MuiTextField: { defaultProps: { color: "secondary" } },
      // Buttons without their own colour (EDIT, BOOK, ...) use the teal accent:
      // MUI's default "primary" is the page background colour here, so they
      // were nearly invisible in dark mode. Text / outlined ones use the
      // brighter teal so they stand out on dark panels and glass.
      MuiButton: {
        defaultProps: { color: "secondary" },
        styleOverrides: {
          ...(g ? { contained: { borderRadius: 12, boxShadow: "inset 0 1px 0 rgba(255,255,255,.35), 0 6px 16px rgba(47,156,144,.28)" }, outlined: { borderRadius: 12 } } : {}),
          root: {
            variants: [
              {
                // EDIT, BOOK, ...: a light teal pill, bold, so they read as buttons on dark panels and glass
                props: { variant: "text", color: "secondary" },
                style: {
                  color: mode === "dark" ? BRAND.accentText : "#1c6f68",
                  fontWeight: 700,
                  backgroundColor: alpha(mode === "dark" ? BRAND.accentText : "#1c6f68", 0.12),
                  borderRadius: 10,
                  paddingLeft: 12,
                  paddingRight: 12,
                  "&:hover": { backgroundColor: alpha(mode === "dark" ? BRAND.accentText : "#1c6f68", 0.22) },
                },
              },
              {
                props: { variant: "outlined", color: "secondary" },
                style: { color: mode === "dark" ? BRAND.accentText : "#1c6f68", borderColor: alpha(mode === "dark" ? BRAND.accentText : "#1c6f68", 0.6), fontWeight: 700 },
              },
            ],
          },
        },
      },
      // The page colour is on <html> too: on phones the page is taller than
      // <body>, and below it the browser showed the dark loading colour.
      // The glass glow sits on a fixed layer behind everything, because
      // phones (Android Chrome, iOS Safari) ignore background-attachment: fixed.
      MuiCssBaseline: {
        styleOverrides: {
          html: { backgroundColor: mode === "dark" ? colors.primary[500] : g ? "#eef4f3" : "#fcfcfc" },
          ...(g
            ? {
                body: {
                  backgroundColor: "transparent",
                  "&::before": {
                    content: '""',
                    position: "fixed",
                    inset: 0,
                    zIndex: -1,
                    pointerEvents: "none",
                    background: g.glow,
                  },
                },
              }
            : {}),
        },
      },
      ...(g
        ? {
            // pop-ups: heavily frosted, rounder, the page behind slightly blurred
            MuiDialog: {
              styleOverrides: {
                root: { "& .MuiBackdrop-root": { backgroundColor: g.dim, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" } },
                paper: {
                  backgroundColor: g.popup,
                  backgroundImage: g.sheen,
                  backdropFilter: "blur(30px) saturate(165%)",
                  WebkitBackdropFilter: "blur(30px) saturate(165%)",
                  border: `1px solid ${g.edge}`,
                  borderRadius: 20,
                  boxShadow: g.popupShadow,
                  "@media (max-width:600px)": { backdropFilter: "blur(18px) saturate(165%)", WebkitBackdropFilter: "blur(18px) saturate(165%)" },
                },
              },
            },
            MuiPopover: {
              styleOverrides: {
                paper: {
                  backgroundColor: g.popup,
                  backgroundImage: g.sheen,
                  backdropFilter: "blur(24px) saturate(165%)",
                  WebkitBackdropFilter: "blur(24px) saturate(165%)",
                  border: `1px solid ${g.edge}`,
                  borderRadius: 14,
                  boxShadow: g.popupShadow,
                },
              },
            },
            MuiDataGrid: {
              styleOverrides: {
                root: {
                  backgroundColor: g.panel,
                  backgroundImage: g.sheen,
                  backdropFilter: "blur(16px) saturate(165%)",
                  WebkitBackdropFilter: "blur(16px) saturate(165%)",
                  border: `1px solid ${g.edge} !important`,
                  borderRadius: 14,
                  boxShadow: g.shadow,
                  overflow: "hidden",
                },
              },
            },
            MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12 } } },
          }
        : {}),
    },
    typography: {
      fontFamily: ["Source Sans Pro", "sans-serif"].join(","),
      fontSize: 12,
      h1: {
        fontFamily: ["Source Sans Pro", "sans-serif"].join(","),
        fontSize: 40,
      },
      h2: {
        fontFamily: ["Source Sans Pro", "sans-serif"].join(","),
        fontSize: 32,
      },
      h3: {
        fontFamily: ["Source Sans Pro", "sans-serif"].join(","),
        fontSize: 24,
      },
      h4: {
        fontFamily: ["Source Sans Pro", "sans-serif"].join(","),
        fontSize: 20,
      },
      h5: {
        fontFamily: ["Source Sans Pro", "sans-serif"].join(","),
        fontSize: 16,
      },
      h6: {
        fontFamily: ["Source Sans Pro", "sans-serif"].join(","),
        fontSize: 14,
      },
    },
  };
};

// context for color mode
export const ColorModeContext = createContext({
  toggleColorMode: () => {},
});

export const useMode = () => {
  const [mode, setMode] = useState("dark");

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () =>
        setMode((prev) => (prev === "light" ? "dark" : "light")),
    }),
    []
  );

  const { glass } = usePrefs();
  const theme = useMemo(() => createTheme(themeSettings(mode, { glass })), [mode, glass]);
  return [theme, colorMode];
};
