// The main ARGUS logo: a Greek (Corinthian) helmet in a hexagon, with eyes that
// blink every few seconds. Every node has its own version: blue-green or gold,
// with its own emblem (see NODE_LOGOS below). With no node it's the main ARGUS
// logo, the same drawing as public/favicon.svg (the browser-tab icon).
import { useId } from "react";
import { Box, keyframes } from "@mui/material";

// open ... quick close ... open again (a double blink every few seconds)
const blink = keyframes`
  0%, 88%, 93%, 100% { transform: scaleY(1); }
  90.5% { transform: scaleY(0.08); }
  95.5% { transform: scaleY(0.08); }
  97% { transform: scaleY(1); }
`;
const glow = keyframes`
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
`;

// ---- the drawing, in a 100 x 100 box
export const HEX = "M50 4 Q52.5 4 55 5.4 L87.5 24.2 Q92 26.8 92 32 V68 Q92 73.2 87.5 75.8 L55 94.6 Q50 97.5 45 94.6 L12.5 75.8 Q8 73.2 8 68 V32 Q8 26.8 12.5 24.2 L45 5.4 Q47.5 4 50 4 Z";
export const PLUME = "M37 27 Q50 9 63 27 Q50 22 37 27 Z";
export const HELMET = "M50 23 C35.5 23 28 34 28 47 L28 71 L40.5 77.5 L44 60.5 L44 76 L56 76 L56 60.5 L59.5 77.5 L72 71 L72 47 C72 34 64.5 23 50 23 Z";
export const VISOR = "M30 44.5 Q50 38 70 44.5 L69 52 Q59 49.5 54.5 54 L54.5 76 L45.5 76 L45.5 54 Q41 49.5 31 52 Z";
export const EYE_L = "M34 47.6 Q38.2 44.9 42.4 47.6 Q38.2 50.3 34 47.6 Z";
export const EYE_R = "M57.6 47.6 Q61.8 44.9 66 47.6 Q61.8 50.3 57.6 47.6 Z";

const WHITE = "#fff";
const NAVY = "#141b2d";

// two short bars under the helmet (Charlie's style)
const bars = (c) =>
  `<path d="M40 85 H60" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><path d="M44 90 H56" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`;

// a howitzer barrel lying along the x axis (KTN supports artillery)
const barrel = (p) => {
  const ink = "#5e420f";
  return `<g stroke="${ink}" stroke-width=".6" stroke-linejoin="round">
<rect x="-30" y="-6.6" width="23" height="2.4" rx="1.1" fill="url(#${p}-brl)"/><rect x="-30" y="4.2" width="23" height="2.4" rx="1.1" fill="url(#${p}-brl)"/>
<path d="M-7 -3.1 L34 -2.2 V2.2 L-7 3.1 Z" fill="url(#${p}-brl)"/>
<ellipse cx="13" cy="0" rx="5.5" ry="3.7" fill="url(#${p}-brl)"/>
<rect x="-31" y="-4.4" width="25" height="8.8" rx="1.4" fill="url(#${p}-brl)"/>
<rect x="-45" y="-6.2" width="15" height="12.4" rx="2.2" fill="url(#${p}-brl)"/>
<rect x="33.5" y="-4.6" width="11" height="9.2" rx="1.2" fill="url(#${p}-brl)"/></g>
<path d="M-41 -6.2 V6.2" stroke="${ink}" stroke-width="1"/><circle cx="-37.5" cy="0" r="1.6" fill="${ink}"/>
<rect x="35.8" y="-4.6" width="2.3" height="9.2" fill="${NAVY}"/><rect x="40.1" y="-4.6" width="2.3" height="9.2" fill="${NAVY}"/>
<path d="M-6 -2.2 L32 -1.5" stroke="#fffbe6" stroke-width=".7" opacity=".9"/><path d="M-44 -4.8 H-31" stroke="#fffbe6" stroke-width=".6" opacity=".8"/>`;
};

const eagleWing = (sd) =>
  `<path d="M${50 + sd * 20} 50 Q${50 + sd * 36} 34 ${50 + sd * 44} 18 Q${50 + sd * 40} 30 ${50 + sd * 46} 28 Q${50 + sd * 40} 38 ${50 + sd * 45} 40 Q${50 + sd * 38} 46 ${50 + sd * 42} 52 Q${50 + sd * 32} 54 ${50 + sd * 22} 60 Z" fill="${WHITE}"/>`;

const gear = (c, hole) => {
  let t = "";
  for (let i = 0; i < 8; i += 1) {
    t += `<rect x="48.3" y="72.5" width="3.4" height="4" rx=".8" fill="${c}" transform="rotate(${i * 45} 50 82.5)"/>`;
  }
  return `${t}<circle cx="50" cy="82.5" r="6.8" fill="${c}"/><circle cx="50" cy="82.5" r="2.6" fill="${hole}"/>`;
};

// Each node: gold or blue-green, the helmet's size/position, what goes behind
// the helmet (back) and in front of / under it (front). p = gradient id prefix.
export const NODE_LOGOS = {
  ktn: {
    meaning: "Crossed howitzers: Khatib supports artillery",
    gold: false,
    goldRim: true,
    helmet: { scale: 0.74, y: 46 },
    back: (p) =>
      `<g transform="translate(50 52) rotate(-33)">${barrel(p)}</g><g transform="translate(50 52) rotate(213) scale(1 -1)">${barrel(p)}</g>`,
    front: (p) => bars(`url(#${p}-gold)`),
  },
  kranji: {
    meaning: "Waves: the Kranji reservoir and marshlands",
    gold: true,
    front: () =>
      `<path d="M34 78 q4 -3 8 0 t8 0 t8 0 t8 0 M36 84 q3.5 -3 7 0 t7 0 t7 0 t7 0 M40 90 q2.5 -2.5 5 0 t5 0 t5 0 t5 0" fill="none" stroke="${NAVY}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  "mandai-hill": {
    meaning: "Twin peaks: the high ground that watches all",
    gold: false,
    front: () =>
      `<path d="M30 90 L42 75 L48 82 L56 72 L70 90 Z" fill="${WHITE}"/><path d="M53.5 75.2 L56 72 L58.6 75.5 L56 74.3 Z" fill="#7ef0cf"/>`,
  },
  ltc: {
    meaning: "Lightning bolt: power and speed",
    gold: true,
    front: () => `<path d="M53 72 L42 84 L49 84 L46 93 L58 80 L51 80 Z" fill="${NAVY}"/>`,
  },
  hq: {
    meaning: "Eagle wings: Zeus' eagle, the highest command",
    gold: false,
    back: () => eagleWing(-1) + eagleWing(1),
    front: () => bars(WHITE),
  },
  alpha: {
    meaning: "Alpha: the first letter of the Greek alphabet",
    gold: true,
    front: () =>
      `<text x="50" y="91" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="800" font-size="17" fill="${NAVY}">Α</text>`,
  },
  charlie: {
    meaning: "Hermes' wings: speed, like the Light Strike Vehicles",
    gold: false,
    back: () =>
      `<path d="M27 50 Q14 44 10 34 Q20 40 26 40 Q17 34 16 26 Q24 34 30 36 Z M73 50 Q86 44 90 34 Q80 40 74 40 Q83 34 84 26 Q76 34 70 36 Z" fill="${WHITE}"/>`,
    front: () => bars(WHITE),
  },
  csc: {
    meaning: "Gear: combat support, recovery and repair",
    gold: true,
    front: () => gear(NAVY, "#d4a73a"),
  },
};

// The whole logo as SVG markup (also used to make the PNG icons)
export function logoMarkup(nodeKey, p = "am", { glowLayer = true } = {}) {
  const n = NODE_LOGOS[nodeKey];
  const gold = !!n?.gold;
  const isNode = !!n;
  const h = n?.helmet ?? (isNode ? { scale: 0.84, y: 44 } : { scale: 1, y: 46 });
  const helmetFill = gold ? "#1b2340" : WHITE;
  const visorFill = gold ? "#06080f" : "#24336a";
  const rim = gold || !n?.goldRim ? `stroke="#fff" stroke-opacity="${gold ? 0.3 : 0.22}"` : `stroke="url(#${p}-gold)" stroke-opacity=".9"`;
  const eyes = `<path d="${EYE_L}" fill="#7ef0cf"/><path d="${EYE_R}" fill="#7ef0cf"/>`;
  return `<defs>
<linearGradient id="${p}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6870fa"/><stop offset="1" stop-color="#3da58a"/></linearGradient>
<linearGradient id="${p}-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8e19a"/><stop offset=".5" stop-color="#d4a73a"/><stop offset="1" stop-color="#8f661a"/></linearGradient>
<linearGradient id="${p}-brl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".35" stop-color="#ecc55c"/><stop offset=".75" stop-color="#b98a2a"/><stop offset="1" stop-color="#7a5615"/></linearGradient>
<filter id="${p}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>
</defs>
<path d="${HEX}" fill="url(#${p}-${gold ? "gold" : "bg"})"/>
<path d="${HEX}" fill="none" ${rim} stroke-width="1.6" transform="translate(50 50) scale(.9) translate(-50 -50)"/>
${n?.back ? n.back(p) : ""}
<g transform="translate(50 ${h.y}) scale(${h.scale}) translate(-50 -46)">
<path d="${PLUME}" fill="${helmetFill}" opacity="0.92"/>
<path d="${HELMET}" fill="${helmetFill}"/>
<path d="${VISOR}" fill="${visorFill}"/>
${glowLayer ? `<g class="eye-glow" filter="url(#${p}-soft)">${eyes}</g>` : ""}
<g class="eyes">${eyes}</g>
</g>
${n?.front ? n.front(p) : ""}`;
}


// ---- Company badges: each node's own animal (from the company insignia) in
// the ARGUS hexagon, with a glow in the animal's colour, a white rim light, a
// drop shadow, and the top of the animal breaking out over the frame.
// Pictures are in public/nodes/<node>.webp (background already removed).
const STEEL = ["0.04 0.20 0.50 0.82 1", "0.07 0.30 0.62 0.90 1", "0.14 0.45 0.80 0.97 1"];
export const NODE_BADGES = {
  ktn: { w: 440, h: 434, accent: "#38e1ff", fit: 76, bottom: 88, wind: true, eye: [0.327, 0.389] },
  kranji: { w: 362, h: 420, accent: "#dfe8f5" },
  "mandai-hill": { w: 352, h: 420, accent: "#ff4040" },
  ltc: { w: 386, h: 420, accent: "#ff8a2a" },
  hq: { w: 420, h: 327, accent: "#e7ad52" },
  alpha: { w: 420, h: 372, accent: "#f7c440" },
  charlie: { w: 380, h: 420, accent: "#f0a868" },
  csc: { w: 420, h: 316, accent: "#7fb2ff", fit: 100, bottom: 90, tint: STEEL },
};

// soft wind ribbons behind the KTN horse
const wind = (p) => `<defs>
<linearGradient id="${p}-rb" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#38e1ff" stop-opacity="0"/><stop offset=".45" stop-color="#38e1ff" stop-opacity=".85"/><stop offset="1" stop-color="#a8f3ff" stop-opacity=".95"/></linearGradient>
<linearGradient id="${p}-rb2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#a8f3ff" stop-opacity="0"/><stop offset=".6" stop-color="#a8f3ff" stop-opacity=".7"/><stop offset="1" stop-color="#ffffff" stop-opacity=".9"/></linearGradient>
<filter id="${p}-rbf" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".5"/></filter></defs>
<g filter="url(#${p}-rbf)">
<path d="M14 84 C30 60 52 44 96 30 C70 46 48 60 30 84 Z" fill="url(#${p}-rb)"/>
<path d="M22 92 C44 70 70 58 104 52 C80 62 58 74 40 92 Z" fill="url(#${p}-rb)" opacity=".8"/>
<path d="M30 20 C52 10 78 8 102 16 C80 14 58 18 40 26 Z" fill="url(#${p}-rb2)" opacity=".75"/>
<path d="M60 96 C74 82 88 74 106 70 C92 78 80 86 72 96 Z" fill="url(#${p}-rb2)" opacity=".7"/>
<path d="M4 62 C18 44 34 34 56 28 C40 38 26 48 16 64 Z" fill="url(#${p}-rb2)" opacity=".55"/></g>
<g fill="#a8f3ff"><circle cx="88" cy="22" r=".9"/><circle cx="96" cy="40" r=".7"/><circle cx="80" cy="12" r=".6"/><circle cx="100" cy="58" r=".8"/><circle cx="12" cy="40" r=".6"/></g>`;

export const BADGE_VIEWBOX = "-4 -14 108 116";

export function badgeMarkup(nodeKey, p = "nb") {
  const b = NODE_BADGES[nodeKey];
  const gold = !!NODE_LOGOS[nodeKey]?.gold;
  const fit = b.fit ?? 82;
  const bottom = b.bottom ?? 86;
  const sc = fit / Math.max(b.w, b.h);
  const W = b.w * sc;
  const H = b.h * sc;
  const x = 50 - W / 2;
  const y = bottom - H;
  const href = `/nodes/${nodeKey}.webp`;
  const img = (extra = "") =>
    `<image href="${href}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" ${extra}/>`;
  const inner = `transform="translate(50 50) scale(.92) translate(-50 -50)"`;
  const tint = b.tint
    ? `<filter id="${p}-mt" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".33 .5 .17 0 0 .33 .5 .17 0 0 .33 .5 .17 0 0 0 0 0 1 0"/><feComponentTransfer><feFuncR type="table" tableValues="${b.tint[0]}"/><feFuncG type="table" tableValues="${b.tint[1]}"/><feFuncB type="table" tableValues="${b.tint[2]}"/></feComponentTransfer></filter>`
    : "";
  const glowOpacity = b.wind ? 0.4 : 0.8;
  const eye = b.eye
    ? `<g class="eye-glow"><circle cx="${(x + b.eye[0] * W).toFixed(1)}" cy="${(y + b.eye[1] * H).toFixed(1)}" r="4" fill="#9ff3ff" opacity=".6" filter="url(#${p}-eg)"/></g>`
    : "";
  return `<defs>
<linearGradient id="${p}-th" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f95ff"/><stop offset="1" stop-color="#4cceac"/></linearGradient>
<linearGradient id="${p}-au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe7a6"/><stop offset=".5" stop-color="#d9ac40"/><stop offset="1" stop-color="#8f661a"/></linearGradient>
<radialGradient id="${p}-in" cx=".5" cy=".45" r=".62"><stop offset="0" stop-color="${b.accent}" stop-opacity=".38"/><stop offset=".38" stop-color="#16204a"/><stop offset="1" stop-color="#060914"/></radialGradient>
<linearGradient id="${p}-gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
<pattern id="${p}-gr" width="7" height="12.12" patternUnits="userSpaceOnUse"><path d="M3.5 0 L7 2 V6 L3.5 8 L0 6 V2 Z M3.5 8 V12.12" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width=".4"/></pattern>
<clipPath id="${p}-pop"><path d="${HEX}"/><rect x="-10" y="-20" width="120" height="52"/></clipPath>
<filter id="${p}-sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2.2" stdDeviation="1.8" flood-color="#000" flood-opacity=".7"/></filter>
<filter id="${p}-glo" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="b"/><feFlood flood-color="${b.accent}" flood-opacity="${glowOpacity}" result="f"/><feComposite in="f" in2="b" operator="in"/></filter>
<filter id="${p}-rim" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius=".8" result="d"/><feFlood flood-color="#fff" flood-opacity=".9" result="f"/><feComposite in="f" in2="d" operator="in"/></filter>
<filter id="${p}-bs" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".55"/></filter>
<filter id="${p}-eg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
${tint}</defs>
<g filter="url(#${p}-bs)"><path d="${HEX}" fill="url(#${p}-${gold ? "au" : "th"})"/></g>
<path d="${HEX}" ${inner} fill="url(#${p}-in)"/>
<path d="${HEX}" ${inner} fill="url(#${p}-gr)"/>
${b.wind ? wind(p) : ""}
<g clip-path="url(#${p}-pop)">
<g filter="url(#${p}-glo)">${img()}</g>
<g filter="url(#${p}-rim)" opacity=".55">${img()}</g>
<g filter="url(#${p}-sh)">${img(b.tint ? `filter="url(#${p}-mt)"` : "")}</g>
</g>
${eye}
<path d="${HEX}" ${inner} fill="url(#${p}-gl)"/>
<path d="${HEX}" ${inner} fill="none" stroke="#fff" stroke-opacity=".18" stroke-width=".8"/>`;
}

// node = a key from shared/nodes.js, or nothing for the main ARGUS logo
const ArgusMark = ({ size = 48, node, animate = true, title, sx }) => {
  const id = `am${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const motion = animate
    ? {
        "& .eyes": {
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: `${blink} 5s ease-in-out infinite`,
        },
        "& .eye-glow": { animation: `${glow} 2.5s ease-in-out infinite` },
        "@media (prefers-reduced-motion: reduce)": { "& .eyes, & .eye-glow": { animation: "none" } },
      }
    : {};
  return (
    <Box
      component="svg"
      viewBox={NODE_BADGES[node] ? BADGE_VIEWBOX : "0 0 100 100"}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "block",
        overflow: "visible",
        filter: "drop-shadow(0 4px 10px rgba(80, 90, 230, 0.35))",
        ...motion,
        ...sx,
      }}
      // fixed drawing from this file (no user text in it)
      dangerouslySetInnerHTML={{ __html: NODE_BADGES[node] ? badgeMarkup(node, id) : logoMarkup(node, id) }}
    />
  );
};

export default ArgusMark;
