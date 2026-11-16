// A just-for-fun gear stick (H-pattern: N, 1-5) that sets how fast the truck
// drives on the node picker. Click a gear, or press 0-5 on the keyboard.
import { useEffect } from "react";
import { Box, Typography } from "@mui/material";

// speed of the road lines and wheels for each gear (N = stopped)
export const GEARS = {
  N: { road: null, wheel: null, kmh: 0 },
  1: { road: "2.6s", wheel: "3.2s", kmh: 10 },
  2: { road: "1.5s", wheel: "1.9s", kmh: 25 },
  3: { road: "0.95s", wheel: "1.2s", kmh: 45 },
  4: { road: "0.62s", wheel: "0.8s", kmh: 70 },
  5: { road: "0.34s", wheel: "0.42s", kmh: 100 },
};

// where each gear sits in the gate
const POS = { 1: [20, 18], 2: [20, 78], 3: [48, 18], 4: [48, 78], 5: [76, 18], N: [48, 48] };

const GearStick = ({ gear, onChange }) => {
  // keyboard: 1-5 change gear, 0 or N = neutral
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, [contenteditable]")) return;
      if (/^[1-5]$/.test(e.key)) onChange(Number(e.key));
      else if (e.key === "0" || e.key.toLowerCase() === "n") onChange("N");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onChange]);

  const [kx, ky] = POS[gear];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, userSelect: "none" }}>
      <Box
        component="svg"
        viewBox="-8 -10 112 116"
        role="radiogroup"
        aria-label="Gear stick: choose how fast the truck drives"
        sx={{ width: 104, height: 108, overflow: "visible", filter: "drop-shadow(0 6px 14px rgba(0,0,0,.45))" }}
      >
        <defs>
          <radialGradient id="gs-knob" cx=".35" cy=".3" r=".8">
            <stop offset="0" stopColor="#6b7280" />
            <stop offset=".5" stopColor="#1f2430" />
            <stop offset="1" stopColor="#07090f" />
          </radialGradient>
          <linearGradient id="gs-plate" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2a3150" />
            <stop offset="1" stopColor="#0e1226" />
          </linearGradient>
        </defs>
        {/* the gate plate */}
        <rect x="-6" y="-8" width="108" height="112" rx="18" fill="url(#gs-plate)" stroke="rgba(255,255,255,.18)" />
        {/* the H slots */}
        <path d="M20 18 V78 M48 18 V78 M76 18 V48 M20 48 H76" stroke="#05070f" strokeWidth="9" strokeLinecap="round" />
        <path d="M20 18 V78 M48 18 V78 M76 18 V48 M20 48 H76" stroke="rgba(126,240,207,.25)" strokeWidth="1.2" strokeLinecap="round" />
        {/* gear numbers */}
        {[1, 2, 3, 4, 5].map((g) => {
          const [x, y] = POS[g];
          return (
            <text
              key={g}
              x={x}
              y={y < 48 ? y - 13 : y + 21}
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              fill={gear === g ? "#7ef0cf" : "rgba(255,255,255,.55)"}
              style={{ fontFamily: "Rajdhani, sans-serif" }}
            >
              {g}
            </text>
          );
        })}
        {/* the knob slides to the chosen gear */}
        <g style={{ transform: `translate(${kx}px, ${ky}px)`, transition: "transform .22s cubic-bezier(.4,1.4,.6,1)" }}>
          <circle r="12" fill="url(#gs-knob)" stroke="#7ef0cf" strokeOpacity=".5" />
          <circle r="4" cx="-3.5" cy="-3.5" fill="#fff" opacity=".18" />
          <text textAnchor="middle" y="3.6" fontSize="10" fontWeight="800" fill="#7ef0cf" style={{ fontFamily: "Rajdhani, sans-serif" }}>
            {gear}
          </text>
        </g>
        {/* click targets */}
        {Object.entries(POS).map(([g, [x, y]]) => {
          const value = g === "N" ? "N" : Number(g);
          return (
            <circle
              key={g}
              cx={x}
              cy={y}
              r="12"
              fill="transparent"
              role="radio"
              aria-checked={gear === value}
              aria-label={g === "N" ? "Neutral" : `Gear ${g}`}
              tabIndex={0}
              style={{ cursor: "pointer", outline: "none" }}
              onClick={(e) => {
                e.stopPropagation();
                onChange(value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(value);
                }
              }}
            />
          );
        })}
      </Box>
      <Typography sx={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: ".08em", color: "rgba(255,255,255,.75)" }}>
        {gear === "N" ? "NEUTRAL" : `GEAR ${gear}`} · {GEARS[gear].kmh} km/h
      </Typography>
    </Box>
  );
};

export default GearStick;
