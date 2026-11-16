// The ARGUS name: blinking helmet hexagon (ArgusMark) + "ARGUS" in bold Rajdhani + its caption.
// Used on the node picker, the login page, the sidebar and the phone top bar.
// Argus Panoptes was the hundred-eyed giant of Greek myth who never slept.
import { Box, Typography, alpha } from "@mui/material";
import ArgusMark from "./ArgusMark";
import { tokens } from "../theme";

export const ARGUS_FONT = "'Rajdhani', 'Source Sans Pro', sans-serif";
export const ARGUS_CAPTION = "Eyes on every vehicle.";

const SIZES = {
  //    badge, icon, name, caption, gap
  lg: { badge: 60, icon: 28, name: 40, caption: 16, gap: 1.75 },
  md: { badge: 50, icon: 24, name: 34, caption: 15, gap: 1.5 },
  sm: { badge: 38, icon: 20, name: 28, caption: 12, gap: 1.1 },
  xs: { badge: 32, icon: 18, name: 24, caption: 11, gap: 0.9 },
};

const ArgusBrand = ({ size = "lg", color = "#fff", captionColor, badge = true, caption = true, sx }) => {
  const d = tokens("dark");
  const s = SIZES[size] ?? SIZES.lg;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: s.gap, minWidth: 0, ...sx }}>
      {badge && <ArgusMark size={s.badge} />}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="span"
          sx={{
            display: "block",
            fontFamily: ARGUS_FONT,
            fontWeight: 700,
            fontSize: s.name,
            lineHeight: 1,
            letterSpacing: "0.2em",
            color,
            textShadow: `0 0 18px ${alpha(d.greenAccent[500], 0.35)}`,
          }}
        >
          ARGUS
        </Typography>
        {caption && (
          <Typography
            component="span"
            noWrap
            sx={{
              display: "block",
              mt: 0.6,
              fontFamily: ARGUS_FONT,
              fontWeight: 700,
              fontSize: s.caption,
              lineHeight: 1.2,
              letterSpacing: "0.06em",
              color: captionColor ?? d.greenAccent[400],
            }}
          >
            {ARGUS_CAPTION}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ArgusBrand;
