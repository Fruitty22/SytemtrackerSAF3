// The drawn light utility vehicle and the little animations, shared by the
// login page and the node picker (the first page).
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
  animation: `${spin} 1.8s linear infinite`,
  ...noMotion,
};

const Wheel = ({ cx }) => (
  <g>
    <circle cx={cx} cy={168} r={38} fill="#15171c" />
    <circle cx={cx} cy={168} r={31} fill="none" stroke="#2a2e37" strokeWidth={2} />
    {/* the part that turns: tread blocks, rim, bolts */}
    <Box component="g" sx={wheelSpinSx}>
      <circle cx={cx} cy={168} r={35.5} fill="none" stroke="#0b0c10" strokeWidth={5} strokeDasharray="7 5" />
      <circle cx={cx} cy={168} r={23} fill="url(#lv-rim)" />
      <circle cx={cx} cy={168} r={15} fill="#8a909a" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = ((i * 72 - 90) * Math.PI) / 180;
        return <circle key={i} cx={cx + 9.5 * Math.cos(a)} cy={168 + 9.5 * Math.sin(a)} r={2.2} fill="#3a3f48" />;
      })}
      <circle cx={cx} cy={168} r={4} fill="#3a3f48" />
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
