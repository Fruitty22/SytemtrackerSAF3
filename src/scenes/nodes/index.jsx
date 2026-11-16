import { Box, ButtonBase, Typography, alpha, useTheme } from "@mui/material";
import ArgusBrand from "../../components/ArgusBrand";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { tokens } from "../../theme";
import { useAuth } from "../../auth/AuthContext";
import { NODES } from "../../../shared/nodes.js";
import { FiveTonTruck, drift, noMotion, rise, roll } from "../../components/FleetVehicle";

// The card is always the dark "night" look, like the login page
const d = tokens("dark");

// a glowing blurred ball of colour behind the glass
const Orb = ({ sx }) => (
  <Box
    aria-hidden
    sx={{
      position: "absolute",
      borderRadius: "50%",
      pointerEvents: "none",
      animation: `${drift} 16s ease-in-out infinite`,
      ...noMotion,
      ...sx,
    }}
  />
);

// The first page: pick your node, then log in to it.
// Each node is a separate fleet with its own accounts and data.
const NodePicker = () => {
  const appTheme = useTheme();
  const appDark = appTheme.palette.mode === "dark";
  const accent = d.greenAccent[500];
  const { chooseNode } = useAuth();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 1.5, sm: 3 },
        backgroundImage: `
          radial-gradient(ellipse at 12% 8%, ${alpha(d.blueAccent[500], appDark ? 0.24 : 0.14)} 0%, transparent 52%),
          radial-gradient(ellipse at 92% 96%, ${alpha(d.greenAccent[500], appDark ? 0.16 : 0.1)} 0%, transparent 48%),
          radial-gradient(${appDark ? "rgba(255,255,255,0.055)" : "rgba(20,27,45,0.07)"} 1px, transparent 1px)`,
        backgroundSize: "auto, auto, 26px 26px",
      }}
    >
      <Box
        component="main"
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 1100,
          borderRadius: "28px",
          overflow: "hidden",
          color: "#fff",
          background: `linear-gradient(150deg, ${d.blueAccent[700]} 0%, ${d.blueAccent[900]} 52%, #0b0d1f 100%)`,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          animation: `${rise} 0.5s ease-out`,
          ...noMotion,
        }}
      >
        {/* the scene behind everything */}
        <Orb sx={{ width: 480, height: 480, top: -170, right: -110, background: `radial-gradient(circle, ${alpha(d.blueAccent[400], 0.5)} 0%, transparent 68%)` }} />
        <Orb sx={{ width: 420, height: 420, bottom: -190, left: -130, background: `radial-gradient(circle, ${alpha(d.greenAccent[500], 0.3)} 0%, transparent 68%)`, animationDelay: "-6s" }} />
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        {/* the road along the bottom, with its moving centre line */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 32,
            borderTop: "1px solid rgba(255,255,255,0.22)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.32))",
            "&::after": {
              content: '""',
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 11,
              height: 3,
              borderRadius: "2px",
              backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.55) 30px, transparent 30px)",
              backgroundSize: "70px 100%",
              backgroundRepeat: "repeat-x",
              animation: `${roll} 0.62s linear infinite`,
              ...noMotion,
            },
          }}
        />

        <Box
          sx={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "0.95fr 1.05fr" },
            gap: { xs: 2, md: 0 },
            minHeight: { md: 620 },
          }}
        >
          {/* ================= LEFT: name, words, and the vehicle on the road ================= */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 3,
              p: { xs: "28px 22px 0", md: "40px 28px 0 40px" },
            }}
          >
            <Box>
              <ArgusBrand size="lg" />
              <Typography
                component="h1"
                sx={{
                  mt: { xs: 3, md: 6 },
                  fontWeight: 800,
                  fontSize: { xs: 32, sm: 40, md: 46 },
                  lineHeight: 1.06,
                  letterSpacing: "-0.01em",
                }}
              >
                Every node.
                <br />
                One fleet tracker.
              </Typography>
              <Typography sx={{ mt: 1.5, color: "rgba(255,255,255,0.72)", maxWidth: 400, fontSize: 15 }}>
                Choose your node to log in. Each node keeps its own vehicles, accounts and Excel imports.
              </Typography>
            </Box>

            {/* the 5-ton truck stands on the road line (hidden on small phones to keep the tiles in view) */}
            <Box sx={{ display: { xs: "none", sm: "block" }, mb: "9px", maxWidth: { sm: 420, md: "none" } }}>
              <FiveTonTruck />
            </Box>
          </Box>

          {/* ================= RIGHT: the node tiles on glass ================= */}
          <Box sx={{ p: { xs: "8px 14px 54px", md: "36px 36px 60px 12px" }, display: "flex", alignItems: "center" }}>
            <Box
              component="section"
              aria-labelledby="choose-node"
              sx={{
                width: "100%",
                p: { xs: "20px 16px", sm: "28px 28px" },
                borderRadius: "20px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)",
                backdropFilter: "blur(22px) saturate(150%)",
                WebkitBackdropFilter: "blur(22px) saturate(150%)",
                border: "1px solid rgba(255,255,255,0.16)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 20px 50px rgba(0,0,0,0.3)",
              }}
            >
              <Typography
                id="choose-node"
                component="h2"
                sx={{ fontWeight: 800, fontSize: { xs: 24, sm: 28 }, letterSpacing: "-0.01em" }}
              >
                Choose your node
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.7)", mt: 0.5, mb: 2.5, fontSize: 14.5 }}>
                You&rsquo;ll log in to that node next.
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: { xs: 1.25, sm: 1.5 },
                }}
              >
                {NODES.map((n, i) => (
                  <ButtonBase
                    key={n.key}
                    onClick={() => chooseNode(n.key)}
                    aria-label={`Log in to ${n.name}`}
                    sx={{
                      position: "relative",
                      justifyContent: "space-between",
                      gap: 1,
                      minHeight: { xs: 64, sm: 76 },
                      px: { xs: 1.75, sm: 2.25 },
                      borderRadius: "14px",
                      textAlign: "left",
                      color: "#fff",
                      backgroundColor: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      animation: `${rise} 0.45s ease-out both`,
                      animationDelay: `${0.04 * i}s`,
                      transition: "transform 0.15s, border-color 0.15s, background-color 0.15s, box-shadow 0.15s",
                      "& .go": { opacity: 0.35, transition: "opacity 0.15s, transform 0.15s" },
                      "&:hover, &.Mui-focusVisible": {
                        transform: "translateY(-2px)",
                        borderColor: alpha(accent, 0.8),
                        backgroundColor: alpha(accent, 0.16),
                        boxShadow: `0 10px 26px ${alpha(accent, 0.22)}`,
                        "& .go": { opacity: 1, transform: "translateX(2px)" },
                      },
                      "@media (prefers-reduced-motion: reduce)": {
                        animation: "none",
                        transition: "none",
                        "&:hover": { transform: "none" },
                      },
                    }}
                  >
                    <Typography sx={{ fontWeight: 800, letterSpacing: "0.06em", fontSize: { xs: 16, sm: 19 }, lineHeight: 1.15 }}>
                      {n.name}
                    </Typography>
                    <ArrowForwardIcon className="go" sx={{ fontSize: 20, flexShrink: 0 }} />
                  </ButtonBase>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default NodePicker;
