// The cover shown while moving between nodes (and to / from the node picker):
// the night-blue background fades in over the page, the node's badge rises
// with a soft glow, then everything fades out on the new node. No white flash.
import { Box, Typography, keyframes } from "@mui/material";
import ArgusMark from "./ArgusMark";
import { nodeByKey } from "../../shared/nodes.js";

const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const fadeOut = keyframes`from { opacity: 1; } to { opacity: 0; }`;
const rise = keyframes`
  from { opacity: 0; transform: translateY(18px) scale(0.82); }
  to { opacity: 1; transform: none; }
`;
const growAway = keyframes`to { opacity: 0; transform: scale(1.18); }`;
const halo = keyframes`
  0%, 100% { opacity: 0.45; transform: scale(0.95); }
  50% { opacity: 0.9; transform: scale(1.08); }
`;
const bar = keyframes`from { transform: scaleX(0); } to { transform: scaleX(1); }`;

const NodeTransition = ({ transition }) => {
  if (!transition) return null;
  const { to, phase } = transition;
  const leaving = phase === "reveal";
  const name = to ? nodeByKey(to)?.name : null;
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(ellipse at 50% 40%, #2a3070 0%, #141b2d 55%, #0b0e1d 100%)",
        animation: `${leaving ? fadeOut : fadeIn} ${leaving ? 0.48 : 0.38}s ease both`,
        "@media (prefers-reduced-motion: reduce)": { animation: "none", "& *": { animation: "none !important" } },
      }}
    >
      <Box sx={{ textAlign: "center", animation: leaving ? `${growAway} .48s ease both` : `${rise} .5s cubic-bezier(.2,1.2,.4,1) both` }}>
        <Box sx={{ position: "relative", width: 132, height: 132, mx: "auto" }}>
          <Box
            sx={{
              position: "absolute",
              inset: -24,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(126,240,207,.35) 0%, transparent 65%)",
              animation: `${halo} 1.6s ease-in-out infinite`,
            }}
          />
          <ArgusMark node={to || undefined} size={132} sx={{ position: "relative" }} />
        </Box>
        <Typography
          sx={{
            mt: 2.5,
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 700,
            letterSpacing: ".18em",
            fontSize: 15,
            color: "rgba(255,255,255,.7)",
          }}
        >
          {name ? "ENTERING" : "BACK TO"}
        </Typography>
        <Typography
          sx={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, letterSpacing: ".16em", fontSize: 30, color: "#fff", lineHeight: 1.1 }}
        >
          {name ?? "ALL NODES"}
        </Typography>
        <Box sx={{ mt: 2, mx: "auto", width: 140, height: 3, borderRadius: 2, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
          <Box
            sx={{
              height: "100%",
              background: "linear-gradient(90deg, #6870fa, #4cceac)",
              transformOrigin: "left",
              animation: `${bar} .9s ease-out both`,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default NodeTransition;
