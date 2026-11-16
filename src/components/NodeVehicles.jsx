// The vehicle drawn on each node's login page (KTN keeps the light utility
// vehicle). Simple side-view drawings, all driving to the right, with their
// tyres standing on the road line like the others in FleetVehicle.jsx.
import { Box } from "@mui/material";
import { FiveTonTruck, LightUtilityVehicle, Wheel, glow, noMotion } from "./FleetVehicle";

// The frame every drawing shares: gradients, shadow on the road, headlight beam.
// p = a short id prefix so gradient names never clash; body = [top, middle, bottom] colours
const Frame = ({ p, body, rim = ["#c8cdd5", "#8a919b"], glass = ["#bfd3e0", "#5a7285"], beam, shadow = [280, 250], children }) => (
  <Box
    component="svg"
    viewBox="0 0 560 220"
    aria-hidden="true"
    focusable="false"
    sx={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
  >
    <defs>
      <linearGradient id={`${p}-body`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={body[0]} />
        <stop offset="0.55" stopColor={body[1]} />
        <stop offset="1" stopColor={body[2]} />
      </linearGradient>
      <linearGradient id={`${p}-glass`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={glass[0]} />
        <stop offset="1" stopColor={glass[1]} />
      </linearGradient>
      <linearGradient id={`${p}-rim`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={rim[0]} />
        <stop offset="1" stopColor={rim[1]} />
      </linearGradient>
      <linearGradient id={`${p}-beam`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff1c9" stopOpacity="0.6" />
        <stop offset="1" stopColor="#fff1c9" stopOpacity="0" />
      </linearGradient>
      <filter id={`${p}-soft`} x="-20%" y="-60%" width="140%" height="220%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>
    <ellipse cx={shadow[0]} cy="208" rx={shadow[1]} ry="7" fill="#000" opacity="0.4" filter={`url(#${p}-soft)`} />
    {beam && (
      <Box
        component="path"
        d={`M${beam[0]} ${beam[1] - 6} L${beam[0] + 115} ${beam[1] - 34} L${beam[0] + 115} ${beam[1] + 32} L${beam[0]} ${beam[1] + 6} Z`}
        fill={`url(#${p}-beam)`}
        sx={{ animation: `${glow} 3.5s ease-in-out infinite`, ...noMotion }}
      />
    )}
    {children}
    {beam && <circle cx={beam[0] - 4} cy={beam[1]} r="13" fill="#ffe9a8" opacity="0.4" filter={`url(#${p}-soft)`} />}
  </Box>
);

const arch = (cx, cy, r) => `M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy} Z`;

// ---------- KRANJI: OUV (7-seat off-road SUV) ----------
export const OffRoadUtilityVehicle = () => (
  <Frame p="ouv" body={["#7f8f6c", "#5e6f50", "#455339"]} beam={[508, 110]}>
    <path
      d="M44 150 L42 104 Q42 84 52 72 L64 54 Q70 46 80 46 L318 44 Q330 44 338 50 L386 90 Q390 93 396 94 L482 100 Q504 103 508 116 L512 150 Z"
      fill="url(#ouv-body)"
    />
    <path d="M64 54 Q70 46 80 46 L318 44 Q330 44 338 50 L386 90 Q390 93 396 94 L482 100" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.2" />
    {/* roof rails */}
    <rect x="96" y="37" width="206" height="5" rx="2" fill="#23272b" />
    <path d="M110 41 V46 M290 41 V45" stroke="#23272b" strokeWidth="4" />
    {/* windows and pillars */}
    <path d="M68 60 Q72 54 82 54 L316 52 Q324 52 330 57 L372 92 H68 Z" fill="url(#ouv-glass)" stroke="#1d2127" strokeWidth="3" strokeLinejoin="round" />
    <rect x="196" y="52" width="8" height="42" fill="#1d2127" />
    <rect x="286" y="52" width="8" height="42" fill="#1d2127" />
    <path d="M310 54 H322 L292 92 H280 Z M220 54 H232 L208 92 H196 Z" fill="#fff" opacity="0.18" />
    {/* body lines, doors, handles, mirror */}
    <path d="M48 112 H506" stroke="#000" strokeOpacity="0.16" strokeWidth="1.4" />
    <path d="M394 96 L482 102" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.2" />
    <path d="M200 94 V134 M290 94 V134 M380 94 V134" stroke="#000" strokeOpacity="0.25" strokeWidth="1.4" />
    <rect x="262" y="100" width="16" height="4" rx="2" fill="#20242b" />
    <rect x="352" y="100" width="16" height="4" rx="2" fill="#20242b" />
    <path d="M368 90 L386 88 L384 97 L368 97 Z" fill="#1d2127" />
    {/* lower cladding and side step */}
    <rect x="44" y="134" width="468" height="16" fill="#262b26" />
    <rect x="178" y="152" width="196" height="6" rx="3" fill="#1b1e24" />
    {/* tail light, grille, bumper, headlight */}
    <rect x="42" y="86" width="6" height="24" rx="2" fill="#d9413c" />
    <rect x="499" y="116" width="12" height="16" rx="2" fill="#1d2127" />
    <path d="M501 121 H509 M501 126 H509" stroke="#4a5058" strokeWidth="1.3" />
    <rect x="488" y="136" width="28" height="15" rx="4" fill="#1b1e24" />
    <path d="M480 102 L508 108 L506 116 L478 112 Z" fill="#fff7dd" />
    {/* wheels */}
    <path d={arch(130, 170, 45)} fill="#101216" />
    <path d={arch(420, 170, 45)} fill="#101216" />
    <Wheel cx={130} cy={170} r={36} rim="ouv-rim" bolts={6} />
    <Wheel cx={420} cy={170} r={36} rim="ouv-rim" bolts={6} />
  </Frame>
);

// ---------- MANDAI HILL: Land Rover 110 (boxy classic 4x4) ----------
export const LandRover110 = () => (
  <Frame p="lr" body={["#7a8a64", "#5d6c4a", "#465236"]} beam={[488, 112]} shadow={[264, 236]}>
    {/* roof rack */}
    <rect x="52" y="38" width="236" height="4" rx="2" fill="#23272b" />
    <path d="M64 41 V47 M170 41 V47 M276 41 V47" stroke="#23272b" strokeWidth="4" />
    {/* the box body, upright windscreen, flat bonnet */}
    <path d="M40 150 V56 Q40 46 50 46 H298 Q305 46 306 52 L316 96 H476 Q486 96 486 106 V150 Z" fill="url(#lr-body)" />
    <path d="M40 56 Q40 46 50 46 H298 Q305 46 306 52 L316 96 H476" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.2" />
    {/* small "alpine" roof windows */}
    <rect x="64" y="49" width="40" height="5" rx="1.5" fill="url(#lr-glass)" />
    <rect x="148" y="49" width="40" height="5" rx="1.5" fill="url(#lr-glass)" />
    {/* side windows */}
    <rect x="54" y="60" width="66" height="34" rx="3" fill="url(#lr-glass)" stroke="#1d2127" strokeWidth="3" />
    <rect x="138" y="60" width="66" height="34" rx="3" fill="url(#lr-glass)" stroke="#1d2127" strokeWidth="3" />
    <path d="M224 60 H296 L303 94 H224 Z" fill="url(#lr-glass)" stroke="#1d2127" strokeWidth="3" strokeLinejoin="round" />
    <path d="M150 62 H160 L146 92 H140 V80 Z M238 62 H250 L232 92 H226 V80 Z" fill="#fff" opacity="0.2" />
    {/* panel seams, hinges and handles */}
    <path d="M130 52 V146 M216 52 V146 M308 96 V146" stroke="#000" strokeOpacity="0.3" strokeWidth="1.6" />
    <rect x="192" y="102" width="14" height="4" rx="2" fill="#20242b" />
    <rect x="282" y="102" width="14" height="4" rx="2" fill="#20242b" />
    <path d="M44 104 H484" stroke="#000" strokeOpacity="0.15" strokeWidth="1.2" />
    {/* spare wheel on the bonnet */}
    <rect x="356" y="88" width="84" height="9" rx="4.5" fill="#15171c" />
    <rect x="384" y="88" width="28" height="9" rx="2" fill="#5d6470" />
    {/* snorkel up the windscreen pillar */}
    <rect x="456" y="60" width="7" height="40" rx="3" fill="#1d2127" />
    <rect x="451" y="54" width="16" height="9" rx="2" fill="#1d2127" />
    {/* tail light, grille, round headlight, bumper */}
    <rect x="40" y="110" width="6" height="18" rx="2" fill="#d9413c" />
    <rect x="478" y="100" width="8" height="34" rx="1" fill="#1d2127" />
    <circle cx="482" cy="112" r="7" fill="#fff7dd" />
    <rect x="474" y="140" width="24" height="10" rx="2" fill="#1b1e24" />
    <rect x="36" y="140" width="16" height="10" rx="2" fill="#1b1e24" />
    {/* wheel flares (flat-topped) and wheels */}
    <path d="M70 150 V128 Q70 120 78 120 H166 Q174 120 174 128 V150 Z" fill="#2c3326" />
    <path d="M358 150 V128 Q358 120 366 120 H454 Q462 120 462 128 V150 Z" fill="#2c3326" />
    <path d={arch(122, 170, 44)} fill="#101216" />
    <path d={arch(410, 170, 44)} fill="#101216" />
    <Wheel cx={122} cy={170} r={36} rim="lr-rim" bolts={5} />
    <Wheel cx={410} cy={170} r={36} rim="lr-rim" bolts={5} />
  </Frame>
);

// ---------- LTC: electric saloon (smooth fastback, no grille) ----------
export const ElectricSedan = () => (
  <Frame p="ev" body={["#f4f6f9", "#d6dbe2", "#a9b1bc"]} rim={["#5a616b", "#2b3038"]} glass={["#43566b", "#141b24"]} beam={[506, 116]}>
    <path
      d="M40 150 Q36 128 46 116 Q60 104 92 100 Q150 56 240 50 Q312 48 356 74 L392 96 Q470 104 500 116 Q514 122 512 138 L508 150 Z"
      fill="url(#ev-body)"
    />
    <path d="M92 100 Q150 56 240 50 Q312 48 356 74 L392 96 Q470 104 500 116" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.2" />
    {/* one-piece tinted glass roof */}
    <path d="M112 100 Q162 64 240 58 Q302 56 346 78 L376 98 Z" fill="url(#ev-glass)" />
    <path d="M190 64 Q214 60 230 59 L196 98 H170 Z" fill="#fff" opacity="0.14" />
    <path d="M246 58 V100" stroke="#0e1319" strokeWidth="4" />
    {/* doors, flush handles, waist line */}
    <path d="M150 102 V140 M250 100 V140 M362 100 V140" stroke="#000" strokeOpacity="0.16" strokeWidth="1.3" />
    <path d="M196 110 H222 M300 110 H326" stroke="#8c949f" strokeWidth="3" strokeLinecap="round" />
    <path d="M50 120 Q260 112 500 122" fill="none" stroke="#000" strokeOpacity="0.08" strokeWidth="1.2" />
    {/* slim lights front and back */}
    <path d="M42 110 L74 106 L74 111 L42 115 Z" fill="#d9413c" />
    <path d="M478 108 L506 117 L505 121 L476 113 Z" fill="#fff7dd" />
    <rect x="46" y="142" width="460" height="8" rx="3" fill="#2b2f36" />
    {/* aero wheels */}
    <path d={arch(136, 176, 38)} fill="#101216" />
    <path d={arch(410, 176, 38)} fill="#101216" />
    <Wheel cx={136} cy={176} r={30} rim="ev-rim" bolts={5} tread="3 2" />
    <Wheel cx={410} cy={176} r={30} rim="ev-rim" bolts={5} tread="3 2" />
  </Frame>
);

// ---------- HQ: luxury saloon (long, black, chrome) ----------
export const LuxurySedan = () => (
  <Frame p="lux" body={["#4a505a", "#22262c", "#0f1114"]} rim={["#e6e9ee", "#9aa2ad"]} glass={["#566a7d", "#1a222c"]} beam={[506, 114]}>
    <path
      d="M36 148 L38 118 Q40 108 52 106 L96 104 Q104 103 110 98 L160 64 Q168 58 180 58 H304 Q316 58 326 64 L380 98 Q386 102 396 102 L490 108 Q508 110 510 124 L512 148 Z"
      fill="url(#lux-body)"
    />
    <path d="M52 106 L96 104 Q104 103 110 98 L160 64 Q168 58 180 58 H304 Q316 58 326 64 L380 98 Q386 102 396 102 L490 108" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" />
    {/* windows with chrome surround */}
    <path d="M122 100 L166 68 Q172 64 180 64 H246 V100 Z" fill="url(#lux-glass)" />
    <path d="M254 64 H302 Q312 64 320 70 L366 100 H254 Z" fill="url(#lux-glass)" />
    <path d="M122 100 L166 68 Q172 64 180 64 H302 Q312 64 320 70 L366 100 Z" fill="none" stroke="#d3d8df" strokeWidth="2" strokeLinejoin="round" />
    <rect x="246" y="64" width="8" height="36" fill="#0f1114" />
    <path d="M190 66 H204 L180 98 H164 Z M270 66 H284 L262 98 H254 V88 Z" fill="#fff" opacity="0.14" />
    {/* chrome lines, doors, handles */}
    <path d="M40 120 H508" stroke="#b9c0ca" strokeOpacity="0.55" strokeWidth="1.5" />
    <path d="M60 140 H492" stroke="#b9c0ca" strokeOpacity="0.4" strokeWidth="1.5" />
    <path d="M250 102 V140 M372 102 V140 M128 104 V140" stroke="#000" strokeOpacity="0.5" strokeWidth="1.3" />
    <path d="M206 112 H226 M330 112 H350" stroke="#c9cfd7" strokeWidth="3" strokeLinecap="round" />
    <path d="M366 98 L380 96 L380 104 L368 104 Z" fill="#0b0c0f" />
    {/* lights, upright chrome grille */}
    <rect x="38" y="110" width="16" height="8" rx="2" fill="#d9413c" />
    <rect x="501" y="112" width="10" height="24" rx="2" fill="#d3d8df" />
    <path d="M503 117 H509 M503 122 H509 M503 127 H509 M503 132 H509" stroke="#2a2e35" strokeWidth="1.3" />
    <path d="M474 108 L502 112 L501 119 L472 116 Z" fill="#fff7dd" />
    {/* chrome multi-spoke wheels */}
    <path d={arch(130, 175, 39)} fill="#08090b" />
    <path d={arch(420, 175, 39)} fill="#08090b" />
    <Wheel cx={130} cy={175} r={31} rim="lux-rim" bolts={10} tread="3 2" />
    <Wheel cx={420} cy={175} r={31} rim="lux-rim" bolts={10} tread="3 2" />
  </Frame>
);

// ---------- ALPHA: VAMTAC (high-mobility tactical 4x4) ----------
export const TacticalVehicle = () => (
  <Frame p="vt" body={["#78876a", "#59684b", "#414d36"]} rim={["#6d7a5d", "#424d38"]} beam={[498, 110]}>
    {/* chassis */}
    <rect x="46" y="138" width="450" height="16" rx="4" fill="#1b1e24" />
    {/* body: hard-top rear, upright cab, long flat bonnet */}
    <path d="M40 144 V62 Q40 50 52 50 H298 Q306 50 310 56 L336 96 H474 Q492 96 494 108 L498 144 Z" fill="url(#vt-body)" />
    <path d="M40 62 Q40 50 52 50 H298 Q306 50 310 56 L336 96 H474" fill="none" stroke="#fff" strokeOpacity="0.26" strokeWidth="1.2" />
    {/* roof hatch ring */}
    <rect x="160" y="40" width="74" height="11" rx="3" fill="#2b3226" />
    <rect x="182" y="34" width="30" height="7" rx="2" fill="#1d2127" />
    {/* small armoured windows */}
    <rect x="168" y="62" width="56" height="30" rx="2" fill="url(#vt-glass)" stroke="#1d2127" strokeWidth="4" />
    <path d="M238 62 H296 L310 92 H238 Z" fill="url(#vt-glass)" stroke="#1d2127" strokeWidth="4" strokeLinejoin="round" />
    <path d="M180 64 H190 L176 90 H170 Z M252 64 H264 L248 90 H240 Z" fill="#fff" opacity="0.18" />
    {/* doors, hinges, handles, rear compartment */}
    <path d="M160 56 V138 M232 56 V138 M314 96 V138" stroke="#000" strokeOpacity="0.32" strokeWidth="2" />
    <rect x="206" y="102" width="16" height="5" rx="2" fill="#20242b" />
    <rect x="290" y="102" width="16" height="5" rx="2" fill="#20242b" />
    <rect x="56" y="62" width="90" height="70" rx="3" fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="1.6" />
    {/* bonnet vents */}
    <path d="M370 104 H440 M370 110 H440" stroke="#000" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />
    {/* antenna */}
    <line x1="60" y1="50" x2="52" y2="4" stroke="#1d2127" strokeWidth="1.6" strokeLinecap="round" />
    {/* grille, square lamps, bumper with winch */}
    <rect x="488" y="100" width="10" height="30" rx="2" fill="#1d2127" />
    <rect x="486" y="104" width="12" height="11" rx="2" fill="#fff7dd" />
    <rect x="482" y="130" width="34" height="16" rx="3" fill="#1b1e24" />
    <rect x="494" y="134" width="14" height="8" rx="2" fill="#3a3f48" />
    <rect x="40" y="108" width="6" height="18" rx="2" fill="#d9413c" />
    {/* wide flat flares and big wheels */}
    <path d="M70 144 V122 Q70 114 78 114 H170 Q178 114 178 122 V144 Z" fill="#2c3326" />
    <path d="M358 144 V122 Q358 114 366 114 H458 Q466 114 466 122 V144 Z" fill="#2c3326" />
    <path d={arch(124, 166, 47)} fill="#101216" />
    <path d={arch(412, 166, 47)} fill="#101216" />
    <Wheel cx={124} cy={166} r={40} rim="vt-rim" bolts={8} tread="8 5" />
    <Wheel cx={412} cy={166} r={40} rim="vt-rim" bolts={8} tread="8 5" />
  </Frame>
);

// ---------- CHARLIE: Light Strike Vehicle (open-frame buggy) ----------
const tube = { stroke: "#2c3327", strokeWidth: 6, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
export const LightStrikeVehicle = () => (
  <Frame p="lsv" body={["#76866a", "#58684c", "#404c37"]} rim={["#6d7a5d", "#424d38"]} beam={[452, 120]} shadow={[264, 230]}>
    {/* spare wheel on the back of the cage */}
    <circle cx="70" cy="86" r="26" fill="#15171c" />
    <circle cx="70" cy="86" r="14" fill="url(#lsv-rim)" />
    {/* engine at the back, exhaust */}
    <rect x="76" y="98" width="62" height="28" rx="4" fill="#23272b" />
    <path d="M84 104 H130 M84 110 H130" stroke="#3a3f48" strokeWidth="2" />
    <path d="M78 100 Q66 96 62 108" stroke="#3a3f48" strokeWidth="5" fill="none" strokeLinecap="round" />
    {/* floor pan / tub */}
    <path d="M60 150 L82 122 H424 L462 140 L468 150 Z" fill="url(#lsv-body)" />
    <path d="M82 122 H424 L462 140" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="1.2" />
    {/* seats */}
    <path d="M196 122 L202 82 Q204 74 212 76 L226 82 L222 122 Z" fill="#1d2127" />
    <path d="M268 122 L274 80 Q276 72 284 74 L298 80 L294 122 Z" fill="#1d2127" />
    {/* steering wheel */}
    <path d="M334 104 L314 90" stroke="#1d2127" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="312" cy="88" rx="4" ry="11" fill="none" stroke="#1d2127" strokeWidth="3" transform="rotate(-30 312 88)" />
    {/* the roll cage */}
    <path d="M100 122 L138 58 L176 46 H306 L392 112 L452 128" {...tube} />
    <path d="M150 122 L176 46 M240 122 V46 M330 122 L306 46" {...tube} />
    <path d="M138 58 L96 66" {...tube} />
    {/* front tube bumper and lamp */}
    <path d="M452 128 L476 134 L478 150" {...tube} />
    <rect x="444" y="114" width="10" height="11" rx="3" fill="#fff7dd" />
    {/* long-travel suspension */}
    <path d="M120 168 L150 124 M400 168 L380 122" stroke="#9aa2ad" strokeWidth="5" strokeLinecap="round" />
    {/* exposed wheels */}
    <Wheel cx={120} cy={168} r={38} rim="lsv-rim" bolts={6} tread="8 5" />
    <Wheel cx={400} cy={168} r={38} rim="lsv-rim" bolts={6} tread="8 5" />
  </Frame>
);

// ---------- CSC: 10-ton recovery truck (tower) ----------
export const RecoveryTruck = () => (
  <Frame p="rec" body={["#7e8e6c", "#5d6e50", "#445237"]} rim={["#7d8a6c", "#4a5640"]} beam={[516, 128]}>
    {/* chassis */}
    <rect x="22" y="146" width="494" height="14" rx="4" fill="#1b1e24" />
    {/* recovery boom with its ram, cable and hook */}
    <path d="M148 96 L58 40" stroke="#4a5640" strokeWidth="14" strokeLinecap="round" />
    <path d="M58 40 L28 22" stroke="#6b7a59" strokeWidth="9" strokeLinecap="round" />
    <path d="M168 98 L112 64" stroke="#b9c0ca" strokeWidth="5" strokeLinecap="round" />
    <path d="M28 24 V92" stroke="#15171c" strokeWidth="2" />
    <path d="M28 92 Q20 92 20 100 Q20 108 28 108 Q34 108 34 102" fill="none" stroke="#c0392b" strokeWidth="4" strokeLinecap="round" />
    <rect x="128" y="76" width="40" height="22" rx="4" fill="#2b3226" />
    {/* underlift arm at the back */}
    <path d="M70 150 L22 156 L16 146" stroke="#2b3226" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {/* equipment body with lockers */}
    <rect x="56" y="96" width="306" height="52" rx="3" fill="url(#rec-body)" />
    <path d="M56 96 H362" stroke="#fff" strokeOpacity="0.25" strokeWidth="1.2" />
    {[66, 164, 262].map((x) => (
      <g key={x}>
        <rect x={x} y="104" width="88" height="36" rx="3" fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="1.5" />
        <rect x={x + 38} y="120" width="12" height="4" rx="2" fill="#20242b" />
      </g>
    ))}
    {/* red and white rear marker */}
    <path d="M56 140 H72 V148 H56 Z" fill="#fff" />
    <path d="M56 140 L64 140 L56 148 Z M66 148 L72 142 V148 Z" fill="#c0392b" />
    {/* flat-fronted cab sitting over the engine */}
    <path d="M372 150 V58 Q372 44 386 44 H488 Q500 44 504 56 L512 102 Q514 110 514 118 V150 Z" fill="url(#rec-body)" />
    <path d="M372 58 Q372 44 386 44 H488 Q500 44 504 56 L512 102" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.2" />
    <rect x="484" y="38" width="24" height="6" rx="2" fill="#2b3226" />
    {/* amber beacon */}
    <rect x="420" y="35" width="16" height="10" rx="3" fill="#ffb02e" />
    <circle cx="428" cy="38" r="12" fill="#ffb02e" opacity="0.35" filter="url(#rec-soft)" />
    {/* windows */}
    <path d="M384 56 H470 Q480 56 482 64 V96 H384 Z" fill="url(#rec-glass)" stroke="#1d2127" strokeWidth="3" strokeLinejoin="round" />
    <path d="M490 54 H500 L508 98 H496 Z" fill="url(#rec-glass)" />
    <path d="M404 58 H418 L396 94 H386 V80 Z" fill="#fff" opacity="0.2" />
    {/* door, handle, steps, grille */}
    <path d="M380 100 V146 M482 100 V146" stroke="#000" strokeOpacity="0.25" strokeWidth="1.4" />
    <rect x="460" y="106" width="16" height="4" rx="2" fill="#20242b" />
    <rect x="452" y="150" width="26" height="4" rx="2" fill="#20242b" />
    <rect x="452" y="160" width="26" height="4" rx="2" fill="#20242b" />
    <path d="M500 112 H512 M500 118 H512 M500 124 H512" stroke="#000" strokeOpacity="0.35" strokeWidth="2" />
    {/* bumper, headlight */}
    <rect x="498" y="138" width="26" height="14" rx="3" fill="#14161b" />
    <rect x="504" y="124" width="11" height="9" rx="2" fill="#fff7dd" />
    {/* wheels: one at the front, two at the back */}
    <path d={arch(150, 172, 42)} fill="#101216" />
    <path d={arch(232, 172, 42)} fill="#101216" />
    <path d={arch(430, 172, 42)} fill="#101216" />
    <Wheel cx={150} cy={172} r={34} rim="rec-rim" bolts={8} tread="6 4" />
    <Wheel cx={232} cy={172} r={34} rim="rec-rim" bolts={8} tread="6 4" />
    <Wheel cx={430} cy={172} r={34} rim="rec-rim" bolts={8} tread="6 4" />
  </Frame>
);

// which vehicle each node's login page shows
const BY_NODE = {
  ktn: LightUtilityVehicle,
  kranji: OffRoadUtilityVehicle,
  "mandai-hill": LandRover110,
  ltc: ElectricSedan,
  hq: LuxurySedan,
  alpha: TacticalVehicle,
  charlie: LightStrikeVehicle,
  csc: RecoveryTruck,
};

export const NodeVehicle = ({ node }) => {
  const Vehicle = BY_NODE[node] ?? FiveTonTruck;
  return <Vehicle />;
};
