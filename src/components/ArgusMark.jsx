// The ARGUS logo: a Greek (Corinthian) helmet in a blue-green hexagon, with
// eyes that blink every few seconds. The same drawing (without the blink) is
// public/favicon.svg, the browser-tab icon.
import { useId } from "react";
import { Box, keyframes } from "@mui/material";

// open ... quick close ... open again (twice, like a real double blink now and then)
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

// the drawing, in a 100 x 100 box
export const HEX = "M50 4 Q52.5 4 55 5.4 L87.5 24.2 Q92 26.8 92 32 V68 Q92 73.2 87.5 75.8 L55 94.6 Q50 97.5 45 94.6 L12.5 75.8 Q8 73.2 8 68 V32 Q8 26.8 12.5 24.2 L45 5.4 Q47.5 4 50 4 Z";
export const PLUME = "M37 27 Q50 9 63 27 Q50 22 37 27 Z";
export const HELMET = "M50 23 C35.5 23 28 34 28 47 L28 71 L40.5 77.5 L44 60.5 L44 76 L56 76 L56 60.5 L59.5 77.5 L72 71 L72 47 C72 34 64.5 23 50 23 Z";
export const VISOR = "M30 44.5 Q50 38 70 44.5 L69 52 Q59 49.5 54.5 54 L54.5 76 L45.5 76 L45.5 54 Q41 49.5 31 52 Z";
export const EYE_L = "M34 47.6 Q38.2 44.9 42.4 47.6 Q38.2 50.3 34 47.6 Z";
export const EYE_R = "M57.6 47.6 Q61.8 44.9 66 47.6 Q61.8 50.3 57.6 47.6 Z";

const ArgusMark = ({ size = 48, animate = true, sx }) => {
  const id = useId().replace(/:/g, "");
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
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      sx={{ width: size, height: size, flexShrink: 0, display: "block", overflow: "visible", ...motion, ...sx }}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6870fa" />
          <stop offset="1" stopColor="#3da58a" />
        </linearGradient>
        <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#6870fa" floodOpacity="0.45" />
        </filter>
      </defs>
      <path d={HEX} fill={`url(#${id}-bg)`} filter={`url(#${id}-shadow)`} />
      <path d={HEX} fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="1.5" transform="translate(50 50) scale(0.9) translate(-50 -50)" />
      <path d={PLUME} fill="#fff" opacity="0.9" />
      <path d={HELMET} fill="#fff" />
      <path d={VISOR} fill="#24336a" />
      {/* soft light around the eyes */}
      <g className="eye-glow" filter={`url(#${id}-soft)`}>
        <path d={EYE_L} fill="#7ef0cf" />
        <path d={EYE_R} fill="#7ef0cf" />
      </g>
      <g className="eyes">
        <path d={EYE_L} fill="#7ef0cf" />
        <path d={EYE_R} fill="#7ef0cf" />
      </g>
    </Box>
  );
};

export default ArgusMark;
