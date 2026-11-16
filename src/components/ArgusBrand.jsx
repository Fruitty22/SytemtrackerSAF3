// The ARGUS name: eye badge + "ARGUS" in bold Rajdhani + its caption.
// Used on the node picker, the login page, the sidebar and the phone top bar.
// Argus Panoptes was the hundred-eyed giant of Greek myth who never slept.
import { Box, Typography, alpha } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { tokens } from "../theme";

export const ARGUS_FONT = "'Rajdhani', 'Source Sans Pro', sans-serif";
export const ARGUS_CAPTION = "Eyes on every vehicle.";

const SIZES = {
  //    badge, icon, name, caption, gap
  lg: { badge: 52, icon: 28, name: 40, caption: 16, gap: 1.75 },
  md: { badge: 44, icon: 24, name: 34, caption: 15, gap: 1.5 },
  sm: { badge: 34, icon: 20, name: 28, caption: 13, gap: 1.25 },
};

const ArgusBrand = ({ size = "lg", color = "#fff", captionColor, badge = true, caption = true, sx }) => {
  const d = tokens("dark");
  const s = SIZES[size] ?? SIZES.lg;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: s.gap, minWidth: 0, ...sx }}>
      {badge && (
        <Box
          aria-hidden
          sx={{
            width: s.badge,
            height: s.badge,
            borderRadius: "12px",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: "#fff",
            background: `linear-gradient(135deg, ${d.blueAccent[500]}, ${d.greenAccent[600]})`,
            boxShadow: `0 6px 18px ${alpha(d.blueAccent[500], 0.45)}`,
          }}
        >
          <VisibilityOutlinedIcon sx={{ fontSize: s.icon }} />
        </Box>
      )}
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
