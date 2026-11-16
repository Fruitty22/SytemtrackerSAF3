// The drawn vehicles (light utility vehicle on the login page, 5-ton truck on
// the node picker) and the little animations they share.
import { Box, keyframes } from "@mui/material";

// ---------- little animations (all switched off for people who prefer less motion) ----------
export const rise = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`;
export const drift = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(28px, -20px) scale(1.08); }
`;
export const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;
export const roll = keyframes`
  from { background-position-x: 0; }
  to { background-position-x: -70px; }
`;
export const glow = keyframes`
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
`;
export const noMotion = { "@media (prefers-reduced-motion: reduce)": { animation: "none" } };

// ---------- the drawn vehicle: a light utility vehicle, side view, driving to the right ----------
const wheelSpinSx = {
  transformBox: "fill-box",
  transformOrigin: "center",
  // speed can be changed with the --wheel-speed CSS variable (the node picker's gear stick)
  animation: `${spin} var(--wheel-speed, 1.8s) linear infinite`,
  animationPlayState: "var(--wheel-play, running)",
  ...noMotion,
};

// r = tyre size; rim = gradient id; bolts = how many wheel nuts
export const Wheel = ({ cx, cy = 168, r = 38, rim = "lv-rim", bolts = 5, tread = "7 5" }) => (
  <g>
    <circle className="tyre" cx={cx} cy={cy} r={r} fill="#15171c" />
    <circle cx={cx} cy={cy} r={r * 0.82} fill="none" stroke="#2a2e37" strokeWidth={2} />
    {/* the part that turns: tread blocks, rim, bolts */}
    <Box component="g" sx={wheelSpinSx}>
      <circle cx={cx} cy={cy} r={r - 2.5} fill="none" stroke="#0b0c10" strokeWidth={5} strokeDasharray={tread} />
      <circle cx={cx} cy={cy} r={r * 0.6} fill={`url(#${rim})`} />
      <circle cx={cx} cy={cy} r={r * 0.4} fill="#8a909a" />
      {Array.from({ length: bolts }, (_, i) => {
        const a = ((i * (360 / bolts) - 90) * Math.PI) / 180;
        return <circle key={i} cx={cx + r * 0.25 * Math.cos(a)} cy={cy + r * 0.25 * Math.sin(a)} r={2.2} fill="#3a3f48" />;
      })}
      <circle cx={cx} cy={cy} r={4} fill="#3a3f48" />
    </Box>
  </g>
);

export const LightUtilityVehicle = () => (
  <Box
    component="svg"
    viewBox="0 0 520 220"
    aria-hidden="true"
    focusable="false"
    sx={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
  >
    <defs>
      <linearGradient id="lv-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#80906f" />
        <stop offset="0.55" stopColor="#5f7052" />
        <stop offset="1" stopColor="#465439" />
      </linearGradient>
      <linearGradient id="lv-box" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7b8b6b" />
        <stop offset="1" stopColor="#4d5b42" />
      </linearGradient>
      <linearGradient id="lv-glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bfd3e0" />
        <stop offset="1" stopColor="#5a7285" />
      </linearGradient>
      <linearGradient id="lv-rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#c8cdd5" />
        <stop offset="1" stopColor="#8a919b" />
      </linearGradient>
      <linearGradient id="lv-beam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff1c9" stopOpacity="0.6" />
        <stop offset="1" stopColor="#fff1c9" stopOpacity="0" />
      </linearGradient>
      <filter id="lv-soft" x="-20%" y="-60%" width="140%" height="220%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>

    {/* shadow on the road */}
    <ellipse cx="270" cy="208" rx="225" ry="7" fill="#000" opacity="0.4" filter="url(#lv-soft)" />

    {/* headlight beam */}
    <Box
      component="path"
      d="M470 121 L585 92 L585 154 L470 133 Z"
      fill="url(#lv-beam)"
      sx={{ animation: `${glow} 3.5s ease-in-out infinite`, ...noMotion }}
    />

    {/* chassis */}
    <rect x="58" y="146" width="422" height="22" rx="6" fill="#1b1e24" />

    {/* rear shelter (the box on the back) */}
    <path d="M62 50 Q62 40 72 40 H280 Q292 40 292 52 V152 H62 Z" fill="url(#lv-box)" />
    <path d="M62 50 Q62 40 72 40 H280 Q292 40 292 52" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.2" />
    {/* roof rails */}
    <rect x="84" y="30" width="190" height="4" rx="2" fill="#2a2f27" />
    <rect x="96" y="33" width="4" height="8" fill="#2a2f27" />
    <rect x="176" y="33" width="4" height="8" fill="#2a2f27" />
    <rect x="256" y="33" width="4" height="8" fill="#2a2f27" />
    {/* panel seams */}
    <path d="M112 44 V150 M202 44 V108" stroke="#000" strokeOpacity="0.2" strokeWidth="1.4" />
    {/* side window with its awning flap */}
    <rect x="126" y="54" width="104" height="8" rx="2" fill="#3a452f" />
    <rect x="128" y="62" width="100" height="42" rx="3" fill="#1d2127" />
    <rect x="132" y="66" width="92" height="34" rx="2" fill="url(#lv-glass)" opacity="0.92" />
    <path d="M150 66 H168 L148 100 H132 V84 Z" fill="#fff" opacity="0.2" />
    {/* storage hatch */}
    <rect x="196" y="114" width="78" height="32" rx="3" fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="1.5" />
    <rect x="236" y="127" width="14" height="4" rx="2" fill="#20242b" />
    {/* tail light and rear bumper */}
    <rect x="62" y="116" width="5" height="18" rx="2" fill="#d9413c" />
    <rect x="54" y="144" width="18" height="10" rx="3" fill="#1b1e24" />

    {/* cab (the front part) */}
    <path
      d="M292 70 H350 Q354 70 357 74 L386 112 Q388 114 392 114 H466 Q480 114 480 128 V152 H292 Z"
      fill="url(#lv-body)"
    />
    <path d="M292 70 H350 Q354 70 357 74 L386 112 Q388 114 392 114 H466" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.2" />
    <path d="M292 70 V152" stroke="#000" strokeOpacity="0.35" strokeWidth="1.6" />
    {/* cab window */}
    <path d="M300 78 H348 L376 110 H300 Z" fill="url(#lv-glass)" stroke="#1d2127" strokeWidth="3" strokeLinejoin="round" />
    <path d="M322 78 H336 L314 110 H300 V92 Z" fill="#fff" opacity="0.22" />
    {/* door */}
    <path d="M368 118 V148 M300 120 V148" stroke="#000" strokeOpacity="0.25" strokeWidth="1.4" />
    <rect x="340" y="124" width="14" height="4" rx="2" fill="#20242b" />
    <rect x="381" y="98" width="10" height="16" rx="3" fill="#1d2127" />
    {/* antenna */}
    <line x1="304" y1="70" x2="297" y2="18" stroke="#1d2127" strokeWidth="1.6" strokeLinecap="round" />

    {/* wheel arches, then the wheels */}
    <path d="M86 168 A44 44 0 0 1 174 168 Z" fill="#101216" />
    <path d="M356 168 A44 44 0 0 1 444 168 Z" fill="#101216" />
    <Wheel cx={130} />
    <Wheel cx={400} />

    {/* bull bar and front bumper */}
    <path d="M468 138 H484 Q490 138 490 146 V152 H468 Z" fill="#14161b" />
    <path d="M474 152 V124 Q474 118 481 118 Q490 118 490 128 V152" fill="none" stroke="#14161b" strokeWidth="5" strokeLinecap="round" />
    <path d="M474 135 H490" stroke="#14161b" strokeWidth="4" strokeLinecap="round" />

    {/* headlight */}
    <circle cx="470" cy="125" r="14" fill="#ffe9a8" opacity="0.4" filter="url(#lv-soft)" />
    <rect x="462" y="120" width="14" height="9" rx="3" fill="#fff7dd" />
    <rect x="462" y="131" width="12" height="4" rx="2" fill="#ffa04a" />
  </Box>
);

// ---------- the drawn 5-ton truck: canvas-covered cargo body, bonneted cab, 6x6, driving to the right ----------
export const FiveTonTruck = () => (
  <Box
    component="svg"
    viewBox="0 0 560 220"
    aria-hidden="true"
    focusable="false"
    sx={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
  >
    <defs>
      <linearGradient id="ft-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7e8e6c" />
        <stop offset="0.55" stopColor="#5d6e50" />
        <stop offset="1" stopColor="#445237" />
      </linearGradient>
      <linearGradient id="ft-canvas" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#808a66" />
        <stop offset="1" stopColor="#58613f" />
      </linearGradient>
      <linearGradient id="ft-bed" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4f5d40" />
        <stop offset="1" stopColor="#3a4530" />
      </linearGradient>
      <linearGradient id="ft-glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bfd3e0" />
        <stop offset="1" stopColor="#5a7285" />
      </linearGradient>
      <linearGradient id="ft-rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7d8a6c" />
        <stop offset="1" stopColor="#4a5640" />
      </linearGradient>
      <linearGradient id="ft-beam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff1c9" stopOpacity="0.6" />
        <stop offset="1" stopColor="#fff1c9" stopOpacity="0" />
      </linearGradient>
      <filter id="ft-soft" x="-20%" y="-60%" width="140%" height="220%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>

    {/* shadow on the road */}
    <ellipse cx="280" cy="208" rx="250" ry="7" fill="#000" opacity="0.4" filter="url(#ft-soft)" />

    {/* headlight beam */}
    <Box
      component="path"
      d="M508 120 L625 90 L625 156 L508 132 Z"
      fill="url(#ft-beam)"
      sx={{ animation: `${glow} 3.5s ease-in-out infinite`, ...noMotion }}
    />

    {/* chassis rail */}
    <rect x="34" y="140" width="476" height="18" rx="5" fill="#1b1e24" />

    {/* canvas canopy over the cargo bed, with its bows and tie-down rope */}
    <path d="M34 112 V40 Q34 22 52 22 H282 Q300 22 300 40 V112 Z" fill="url(#ft-canvas)" />
    <path d="M34 40 Q34 22 52 22 H282 Q300 22 300 40" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="1.2" />
    <path d="M92 24 V110 M150 24 V110 M208 24 V110 M262 24 V110" stroke="#000" strokeOpacity="0.16" strokeWidth="2" />
    <path d="M40 30 Q60 46 40 62 M40 66 V108" stroke="#000" strokeOpacity="0.14" strokeWidth="1.4" fill="none" />
    <path d="M36 106 H298" stroke="#2f3626" strokeWidth="2" strokeDasharray="10 6" />

    {/* cargo bed (drop sides) */}
    <rect x="30" y="110" width="274" height="34" rx="3" fill="url(#ft-bed)" />
    <path d="M32 122 H302 M32 133 H302" stroke="#000" strokeOpacity="0.22" strokeWidth="1.2" />
    <path d="M98 111 V143 M168 111 V143 M236 111 V143" stroke="#000" strokeOpacity="0.3" strokeWidth="2" />
    {/* tail light and rear bumper */}
    <rect x="26" y="116" width="5" height="16" rx="2" fill="#d9413c" />
    <rect x="22" y="142" width="20" height="10" rx="3" fill="#1b1e24" />

    {/* exhaust stack behind the cab */}
    <rect x="303" y="28" width="7" height="86" rx="3" fill="#2a2d33" />
    <rect x="301" y="24" width="11" height="7" rx="2" fill="#1d2025" />

    {/* cab and bonnet */}
    <path
      d="M314 46 Q314 38 322 38 H392 Q400 38 402 46 L412 100 H498 Q510 100 512 112 L514 146 H314 Z"
      fill="url(#ft-body)"
    />
    <path d="M314 46 Q314 38 322 38 H392 Q400 38 402 46 L412 100 H498 Q510 100 512 112" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.2" />
    {/* roof hatch */}
    <rect x="336" y="32" width="34" height="7" rx="2" fill="#3b4632" />
    {/* side window */}
    <path d="M324 50 H390 L398 94 H324 Z" fill="url(#ft-glass)" stroke="#1d2127" strokeWidth="3" strokeLinejoin="round" />
    <path d="M346 50 H360 L338 94 H324 V76 Z" fill="#fff" opacity="0.22" />
    {/* door, handle, step */}
    <path d="M320 100 V144 M404 100 V144" stroke="#000" strokeOpacity="0.25" strokeWidth="1.4" />
    <rect x="384" y="106" width="14" height="4" rx="2" fill="#20242b" />
    <rect x="384" y="150" width="20" height="4" rx="2" fill="#20242b" />
    {/* mirror */}
    <path d="M400 58 L414 54" stroke="#1d2127" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="412" y="42" width="7" height="24" rx="2" fill="#1d2127" />
    {/* bonnet vents */}
    <path d="M436 108 H486 M436 114 H486 M436 120 H486" stroke="#000" strokeOpacity="0.22" strokeWidth="1.6" strokeLinecap="round" />
    {/* grille */}
    <rect x="504" y="104" width="10" height="34" rx="2" fill="#1d2127" />
    <path d="M506 110 H512 M506 116 H512 M506 122 H512 M506 128 H512" stroke="#444a52" strokeWidth="1.4" />
    {/* fuel tank under the cab */}
    <rect x="324" y="144" width="54" height="22" rx="7" fill="#2b3027" />
    <path d="M330 150 H372" stroke="#fff" strokeOpacity="0.12" strokeWidth="2" strokeLinecap="round" />

    {/* wheel arches, then the wheels: two at the back, one at the front */}
    <path d="M76 170 A44 44 0 0 1 164 170 Z" fill="#101216" />
    <path d="M162 170 A44 44 0 0 1 250 170 Z" fill="#101216" />
    <path d="M404 170 A46 46 0 0 1 496 170 Z" fill="#101216" />
    <Wheel cx={120} cy={170} r={36} rim="ft-rim" bolts={8} tread="6 4" />
    <Wheel cx={206} cy={170} r={36} rim="ft-rim" bolts={8} tread="6 4" />
    <Wheel cx={450} cy={170} r={36} rim="ft-rim" bolts={8} tread="6 4" />
    {/* front mudguard */}
    <path d="M402 134 Q406 120 450 120 Q494 120 500 134" fill="none" stroke="#2f3828" strokeWidth="5" strokeLinecap="round" />

    {/* front bumper and tow hook */}
    <rect x="496" y="138" width="26" height="14" rx="3" fill="#14161b" />
    <path d="M512 152 V158 Q512 162 516 162" fill="none" stroke="#c0392b" strokeWidth="3" strokeLinecap="round" />

    {/* headlight */}
    <circle cx="508" cy="126" r="14" fill="#ffe9a8" opacity="0.4" filter="url(#ft-soft)" />
    <rect x="500" y="120" width="13" height="10" rx="3" fill="#fff7dd" />
    <rect x="500" y="132" width="11" height="4" rx="2" fill="#ffa04a" />
  </Box>
);
