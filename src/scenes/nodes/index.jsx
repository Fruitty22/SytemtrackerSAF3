import { Box, ButtonBase, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { useAuth } from "../../auth/AuthContext";
import { NODES } from "../../../shared/nodes.js";

// The first page: pick your node (like a school picker), then log in to it.
// Each node is a separate fleet with its own accounts and data.
const NodePicker = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const dark = theme.palette.mode === "dark";
  const { chooseNode } = useAuth();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: { xs: 4, md: 7 },
        px: { xs: 2, sm: 4 },
        py: { xs: 5, md: 8 },
      }}
    >
      {/* the name, big, where a logo would be */}
      <Box sx={{ textAlign: "center" }}>
        <Typography
          component="h1"
          sx={{
            fontWeight: 800,
            letterSpacing: "0.06em",
            lineHeight: 1,
            fontSize: { xs: 44, sm: 64, md: 84 },
            color: dark ? colors.grey[100] : colors.blueAccent[600],
          }}
        >
          FLEET ADMIN
        </Typography>
        <Typography sx={{ mt: 1.5, fontSize: { xs: 15, sm: 18 }, color: colors.greenAccent[500], fontWeight: 600 }}>
          Fleet serviceability tracker
        </Typography>
      </Box>

      {/* the node tiles */}
      <Box
        component="section"
        aria-labelledby="choose-node"
        sx={{
          width: "100%",
          maxWidth: 1000,
          border: `1px solid ${dark ? alpha("#fff", 0.18) : colors.blueAccent[700]}`,
          borderRadius: "16px",
          p: { xs: 2, sm: 3 },
          backgroundColor: dark ? alpha(colors.primary[400], 0.6) : "background.paper",
        }}
      >
        <Typography id="choose-node" sx={{ color: "text.secondary", fontSize: 15, mb: 2 }}>
          Choose your node to log in:
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" },
            gap: { xs: 1.5, sm: 2 },
          }}
        >
          {NODES.map((n) => (
            <ButtonBase
              key={n.key}
              onClick={() => chooseNode(n.key)}
              aria-label={`Log in to ${n.name}`}
              sx={{
                minHeight: { xs: 84, sm: 104 },
                borderRadius: "12px",
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: dark ? alpha("#fff", 0.04) : alpha(colors.blueAccent[500], 0.03),
                px: 1.5,
                transition: "transform 0.15s, border-color 0.15s, background-color 0.15s, box-shadow 0.15s",
                "&:hover, &.Mui-focusVisible": {
                  transform: "translateY(-2px)",
                  borderColor: colors.greenAccent[500],
                  backgroundColor: alpha(colors.greenAccent[500], dark ? 0.12 : 0.08),
                  boxShadow: `0 8px 22px ${alpha(colors.greenAccent[500], 0.18)}`,
                },
                "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
              }}
            >
              <Typography
                sx={{
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  fontSize: { xs: 19, sm: 24 },
                  textAlign: "center",
                  color: dark ? colors.grey[100] : colors.blueAccent[600],
                }}
              >
                {n.name}
              </Typography>
            </ButtonBase>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default NodePicker;
