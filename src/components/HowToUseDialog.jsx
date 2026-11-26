import { useEffect, useRef, useState } from "react";
import { Box, Button, Dialog, IconButton, Typography, alpha, keyframes, useMediaQuery, useTheme } from "@mui/material";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import CheckIcon from "@mui/icons-material/Check";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import { tokens, BRAND } from "../theme";

// "How to use ARGUS" - the PICTURE version of the guide.
//
// Each step is a little drawing of the screen (made from boxes, no image
// files) with numbered markers on it, and up to three short captions that
// match the numbers. Fewer words, more "this is where you click".
//
// To change it, edit makeSteps(): each step has an icon, title, one-line
// `lead`, a `scene` (the drawing - the Scene* components below) and
// `notes` (the captions for markers 1, 2, 3).
//
// Same props as HowToUseDialog.jsx, so the two can be swapped:
//   open, onClose, nodeName (e.g. "KHATIB"), signupOpen

const d = tokens("dark");

// ---------------------------------------------------------------- motion
const slideIn = keyframes`
  from { opacity: 0; transform: translateX(14px); }
  to { opacity: 1; transform: translateX(0); }
`;
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(76, 206, 172, 0.7); }
  70% { box-shadow: 0 0 0 9px rgba(76, 206, 172, 0); }
  100% { box-shadow: 0 0 0 0 rgba(76, 206, 172, 0); }
`;
const tap = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  45% { transform: translate(-6px, -6px) scale(1); }
  55% { transform: translate(-6px, -6px) scale(0.85); }
`;
const grow = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`;
const drag = keyframes`
  0%, 15% { transform: translateX(0); }
  55%, 75% { transform: translateX(calc(100% + 6px)); }
  100% { transform: translateX(0); }
`;
const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`;
const noMotion = { "@media (prefers-reduced-motion: reduce)": { animation: "none" } };

// ---------------------------------------------------------------- colours
const C = {
  available: "#4caf50",
  deployed: "#2196f3",
  unavailable: "#f44336",
  warning: "#ff9800",
  accent: d.greenAccent[500],
  line: "rgba(255,255,255,0.14)",
  soft: "rgba(255,255,255,0.07)",
  text: "rgba(255,255,255,0.85)",
  dim: "rgba(255,255,255,0.45)",
};

// ---------------------------------------------------------------- drawing pieces

// a pretend app window
const Screen = ({ children, sx }) => (
  <Box
    sx={{
      position: "relative",
      height: { xs: 200, sm: 232 },
      borderRadius: "14px",
      overflow: "hidden",
      backgroundColor: BRAND.bg,
      border: `1px solid ${C.line}`,
      boxShadow: "0 14px 40px rgba(0,0,0,0.4)",
      ...sx,
    }}
  >
    <Box sx={{ display: "flex", gap: "5px", px: 1.25, py: 0.9, borderBottom: `1px solid ${C.line}`, backgroundColor: "rgba(255,255,255,0.03)" }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <Box key={c} sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c, opacity: 0.8 }} />
      ))}
    </Box>
    <Box sx={{ position: "relative", height: "calc(100% - 27px)", p: 1.25 }}>{children}</Box>
  </Box>
);

// a coloured status chip
const Tag = ({ tone = "plain", children, sx }) => {
  const color = { available: C.available, deployed: C.deployed, unavailable: C.unavailable, warning: C.warning, accent: C.accent }[tone];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.4,
        px: 0.9,
        height: 18,
        borderRadius: "9px",
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
        color: "#fff",
        backgroundColor: color ? alpha(color, 0.85) : "rgba(255,255,255,0.12)",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

// a pretend button
const Btn = ({ children, filled, sx }) => (
  <Box
    component="span"
    sx={{
      display: "inline-flex",
      alignItems: "center",
      gap: 0.4,
      px: 1,
      height: 22,
      borderRadius: "6px",
      fontSize: 10,
      fontWeight: 700,
      whiteSpace: "nowrap",
      color: filled ? "#0b0d1f" : "#fff",
      backgroundColor: filled ? C.accent : "transparent",
      border: filled ? "none" : `1px solid ${C.line}`,
      ...sx,
    }}
  >
    {children}
  </Box>
);

// a grey bar standing in for text
const Bar = ({ w = "60%", h = 6, color, sx }) => (
  <Box sx={{ width: w, height: h, borderRadius: h, backgroundColor: color ?? "rgba(255,255,255,0.16)", ...sx }} />
);

// a numbered marker that points at something; its number matches a caption
// inline: sits in the flow next to the thing it points at (instead of absolute)
const Marker = ({ n, top, left, right, bottom, inline }) => (
  <Box
    component="span"
    sx={{
      position: inline ? "relative" : "absolute",
      display: inline ? "inline-grid" : "grid",
      flexShrink: 0,
      verticalAlign: "middle",
      top: inline ? undefined : top,
      left: inline ? undefined : left,
      right: inline ? undefined : right,
      bottom: inline ? undefined : bottom,
      zIndex: 3,
      width: 22,
      height: 22,
      borderRadius: "50%",
      placeItems: "center",
      fontSize: 12,
      fontWeight: 900,
      color: "#0b0d1f",
      backgroundColor: C.accent,
      border: "2px solid #0b0d1f",
      animation: `${pulse} 1.8s ease-out infinite`,
      animationDelay: `${(n - 1) * 0.4}s`,
      ...noMotion,
    }}
  >
    {n}
  </Box>
);

// an animated finger tapping something
const Finger = ({ top, left, right }) => (
  <Box sx={{ position: "absolute", top, left, right, zIndex: 4, pointerEvents: "none" }}>
    <TouchAppOutlinedIcon
      sx={{
        fontSize: 26,
        color: "#fff",
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
        animation: `${tap} 2.4s ease-in-out infinite`,
        ...noMotion,
      }}
    />
  </Box>
);

// a table row: MID, type, status
const Row = ({ mid, status, reason }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "44px 1fr auto",
      alignItems: "center",
      gap: 1,
      py: 0.6,
      px: 0.75,
      borderBottom: `1px solid ${C.line}`,
      fontSize: 10.5,
      color: C.text,
    }}
  >
    <b>{mid}</b>
    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", minWidth: 0, overflow: "hidden" }}>
      <Bar w={40} />
      {reason && (
        <Tag tone={status === "deployed" ? "deployed" : status === "unavailable" ? "unavailable" : "warning"} sx={{ opacity: 0.75 }}>
          {reason}
        </Tag>
      )}
    </Box>
    <Tag tone={status}>{status.toUpperCase()}</Tag>
  </Box>
);

// ---------------------------------------------------------------- the 8 scenes

const SceneLogin = ({ nodeName }) => (
  <Screen sx={{ background: `linear-gradient(150deg, ${d.blueAccent[700]}, ${BRAND.deep})` }}>
    <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
      <Box sx={{ width: "62%", p: 1.5, borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.09)", border: `1px solid ${C.line}` }}>
        <Tag tone="accent" sx={{ mb: 1 }}>
          NODE: {nodeName || "KHATIB"}
        </Tag>
        <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1 }}>Welcome back</Typography>
        {[PersonOutlinedIcon, LockOutlinedIcon].map((Icon, i) => (
          <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.75, height: 24, px: 0.75, mb: 0.75, borderRadius: "6px", backgroundColor: C.soft }}>
            <Icon sx={{ fontSize: 13, opacity: 0.6 }} />
            <Bar w={i ? "35%" : "50%"} />
          </Box>
        ))}
        <Btn filled sx={{ width: "100%", justifyContent: "center", mt: 0.25 }}>
          Log in →
        </Btn>
      </Box>
    </Box>
    <Box sx={{ position: "absolute", top: 8, right: 10, display: "flex", alignItems: "center", gap: 0.5, opacity: 0.85 }}>
      <AccountCircleOutlinedIcon sx={{ fontSize: 18 }} />
    </Box>
    <Marker n={1} top="22%" left="12%" />
    <Marker n={2} top="54%" left="12%" />
    <Marker n={3} top={2} right={30} />
  </Screen>
);

const SceneVehicles = () => (
  <Screen>
    <Box sx={{ display: "grid", gridTemplateColumns: "54px 1fr", gap: 1, height: "100%" }}>
      {/* sidebar */}
      <Box sx={{ borderRadius: "8px", backgroundColor: C.soft, p: 0.75, display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Box sx={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: d.blueAccent[500], mx: "auto", mb: 0.5 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <Bar key={i} w="100%" h={5} color={i === 1 ? alpha(C.accent, 0.8) : undefined} />
        ))}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 12 }}>MANAGE VEHICLES</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Marker n={1} inline />
            <AccountCircleOutlinedIcon sx={{ fontSize: 18, opacity: 0.85 }} />
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5, mb: 0.75, flexWrap: "wrap", alignItems: "center" }}>
          <Btn filled>+ Add vehicle</Btn>
          <Marker n={2} inline />
          <Btn sx={{ ml: 0.75 }}>Import from Excel</Btn>
          <Marker n={3} inline />
        </Box>
        <Row mid="21714" status="available" />
        <Row mid="21717" status="deployed" reason="XCS" />
        <Row mid="21861" status="unavailable" reason="VOR" />
        <Row mid="22022" status="available" />
      </Box>
    </Box>
  </Screen>
);

const SceneStatus = () => {
  const card = (tone, Icon, label, example) => (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        p: 1,
        borderRadius: "10px",
        textAlign: "center",
        backgroundColor: alpha(C[tone], 0.14),
        border: `1.5px solid ${alpha(C[tone], 0.7)}`,
      }}
    >
      <Icon sx={{ fontSize: 30, color: C[tone] }} />
      <Typography sx={{ fontWeight: 900, fontSize: { xs: 9.5, sm: 11 }, letterSpacing: "0.04em", color: "#fff" }}>{label}</Typography>
      <Typography sx={{ fontSize: 9.5, color: C.dim, mt: 0.25 }}>{example}</Typography>
    </Box>
  );
  return (
    <Screen>
      <Box sx={{ display: "flex", gap: 1, mb: 1.25 }}>
        {card("available", CheckIcon, "AVAILABLE", "ready to go")}
        {card("deployed", LocalShippingOutlinedIcon, "DEPLOYED", "tasking · TLOAN · ICT")}
        {card("unavailable", BuildOutlinedIcon, "UNAVAILABLE", "VOR · workshop · N")}
      </Box>
      {/* tasking + VOR = unavailable */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, flexWrap: "wrap" }}>
        <Marker n={2} inline />
        <Tag tone="deployed">TASKING: XCS</Tag>
        <Typography sx={{ fontWeight: 900, color: C.dim }}>+</Typography>
        <Tag tone="unavailable">SVC STATUS: VOR</Tag>
        <Typography sx={{ fontWeight: 900, color: C.dim }}>=</Typography>
        <Tag tone="unavailable" sx={{ height: 22, fontSize: 11 }}>
          UNAVAILABLE
        </Tag>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, mt: 1 }}>
        <Marker n={3} inline />
        <Tag>TASKING: N</Tag>
        <Typography sx={{ fontWeight: 900, color: C.dim }}>=</Typography>
        <Tag tone="available">doesn&apos;t count</Tag>
      </Box>
      <Marker n={1} top={4} left={4} />
    </Screen>
  );
};

const SceneUpdate = () => (
  <Screen>
    <Box sx={{ display: "grid", gridTemplateColumns: "34% 1fr", gap: 1, height: "100%" }}>
      {/* vehicle list */}
      <Box sx={{ borderRadius: "8px", backgroundColor: C.soft, p: 0.75 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
          <Marker n={1} inline />
          <Typography sx={{ fontSize: 9, color: C.dim }}>vehicles</Typography>
        </Box>
        {["21714", "21717", "21861", "22022"].map((mid, i) => (
          <Box
            key={mid}
            sx={{
              fontSize: 10.5,
              fontWeight: 700,
              px: 0.75,
              py: 0.5,
              mb: 0.4,
              borderRadius: "5px",
              backgroundColor: i === 1 ? alpha(C.accent, 0.25) : "transparent",
              border: i === 1 ? `1px solid ${alpha(C.accent, 0.7)}` : "1px solid transparent",
            }}
          >
            {mid}
          </Box>
        ))}
      </Box>
      {/* fields */}
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", gap: 0.75, mb: 0.75, alignItems: "center" }}>
          <Box sx={{ flex: 1, height: 22, borderRadius: "6px", border: `1px solid ${C.line}`, display: "flex", alignItems: "center", px: 0.75, fontSize: 10, justifyContent: "space-between" }}>
            XCS <span style={{ opacity: 0.6 }}>▾</span>
          </Box>
          <Marker n={3} inline />
          <Btn filled sx={{ backgroundColor: C.unavailable, color: "#fff" }}>
            Apply
          </Btn>
        </Box>
        {[
          ["SVC STATUS", false, ""],
          ["TASKING", true, "XCS"],
          ["ICT", false, ""],
          ["STANDBY", false, ""],
        ].map(([field, ticked, value]) => (
          <Box key={field} sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.45, borderBottom: `1px solid ${C.line}` }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "3px",
                display: "grid",
                placeItems: "center",
                border: `1.5px solid ${ticked ? C.accent : C.dim}`,
                backgroundColor: ticked ? C.accent : "transparent",
              }}
            >
              {ticked && <CheckIcon sx={{ fontSize: 10, color: "#0b0d1f" }} />}
            </Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, flex: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
              {field}
              {ticked && <Marker n={2} inline />}
            </Typography>
            {value ? <Tag tone="deployed">{value}</Tag> : <Bar w={22} h={4} />}
            <Box sx={{ width: 18, height: 10, borderRadius: 5, backgroundColor: alpha(C.accent, 0.6) }} />
          </Box>
        ))}
      </Box>
    </Box>
    <Finger top={34} right={2} />
  </Screen>
);

const SceneFilters = () => (
  <Screen>
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75, mb: 1 }}>
      {[
        ["MID number", "217"],
        ["Availability", "UNAVAILABLE"],
        ["Reason", "AIRCON (N)"],
      ].map(([label, value], i) => (
        <Box key={label} sx={{ position: "relative", height: 26, pr: i === 1 ? 0 : 2.5, borderRadius: "6px", border: `1px solid ${i ? alpha(C.accent, 0.7) : C.line}`, px: 0.75, display: "flex", alignItems: "center" }}>
          <Typography sx={{ position: "absolute", top: -7, left: 6, px: 0.4, fontSize: 8, backgroundColor: BRAND.bg, color: C.dim }}>{label}</Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{value}</Typography>
          {i !== 1 && <Marker n={i === 0 ? 1 : 2} top={1} right={1} />}
        </Box>
      ))}
    </Box>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
      <FilterAltOutlinedIcon sx={{ fontSize: 16, color: C.accent }} />
      <Typography sx={{ fontSize: 10, color: C.text }}>
        <b>3</b> of 49 vehicles
      </Typography>
      <Box sx={{ flex: 1 }} />
      <Marker n={3} inline />
      <Btn>Export to Excel</Btn>
    </Box>
    <Row mid="21714" status="unavailable" reason="AIRCON (N)" />
    <Row mid="21718" status="unavailable" reason="AIRCON (N)" />
    <Row mid="21765" status="unavailable" reason="AIRCON (N)" />
  </Screen>
);

const SceneTasking = () => {
  const reasons = [
    ["SVC STATUS: VOR", 85, C.unavailable],
    ["AIRCON (N)", 36, C.warning],
    ["TASKING: XCS", 13, C.deployed],
  ];
  return (
    <Screen>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75, mb: 1 }}>
        {[
          ["XCS", 6, ["59039", "59055", "59154"]],
          ["ICT", 2, ["20554", "20560"]],
        ].map(([name, n, mids]) => (
          <Box key={name} sx={{ p: 0.9, borderRadius: "8px", backgroundColor: C.soft, borderLeft: `3px solid ${C.deployed}` }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 12 }}>{name}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 12, color: C.deployed }}>{n}</Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 0.4, flexWrap: "wrap" }}>
              {mids.map((m) => (
                <Box key={m} sx={{ fontSize: 9, px: 0.6, borderRadius: "8px", border: `1px solid ${C.line}` }}>
                  {m}
                </Box>
              ))}
              {n > mids.length && <Tag tone="accent" sx={{ height: 14, fontSize: 8.5 }}>+{n - mids.length} more</Tag>}
            </Box>
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: 10, fontWeight: 800, mb: 0.5 }}>Not available because</Typography>
      {reasons.map(([label, n, color], i) => (
        <Box key={label} sx={{ display: "grid", gridTemplateColumns: "92px 1fr 22px", alignItems: "center", gap: 0.75, mb: 0.5 }}>
          <Typography sx={{ fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Typography>
          <Box sx={{ height: 9, borderRadius: 5, backgroundColor: C.soft }}>
            <Box
              sx={{
                width: `${(n / 85) * 100}%`,
                height: "100%",
                borderRadius: 5,
                backgroundColor: color,
                transformOrigin: "left",
                animation: `${grow} 0.9s ease-out both`,
                animationDelay: `${i * 0.15}s`,
                ...noMotion,
              }}
            />
          </Box>
          <Typography sx={{ fontSize: 9.5, fontWeight: 800, textAlign: "right" }}>{n}</Typography>
        </Box>
      ))}
      <Marker n={1} top={-4} left={-4} />
      <Marker n={2} top={46} right={6} />
      <Marker n={3} bottom={42} left={-4} />
    </Screen>
  );
};

const SceneCalendar = () => {
  const days = Array.from({ length: 14 }, (_, i) => i + 9);
  return (
    <Screen>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 12, flex: 1 }}>November 2026</Typography>
        <Tag>Month</Tag>
        <Marker n={2} inline />
        <Btn filled>+ Booking</Btn>
      </Box>
      {[0, 1].map((week) => (
        <Box key={week} sx={{ position: "relative", height: 62, borderTop: `1px solid ${C.line}` }}>
          {/* day cells */}
          <Box sx={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {days.slice(week * 7, week * 7 + 7).map((day, i) => {
              const today = day === 11;
              return (
                <Box key={day} sx={{ borderLeft: i ? `1px solid ${C.line}` : 0, p: "3px", backgroundColor: today ? alpha(C.accent, 0.12) : "transparent" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box
                      sx={{
                        fontSize: 9,
                        fontWeight: 800,
                        width: 15,
                        height: 15,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        backgroundColor: today ? BRAND.accentText : "transparent",
                      }}
                    >
                      {day}
                    </Box>
                    <Box sx={{ display: { xs: "none", sm: "flex" }, gap: "2px", fontSize: 7.5, fontWeight: 800 }}>
                      <span style={{ color: C.available }}>20</span>
                      <span style={{ color: C.deployed }}>9</span>
                      <span style={{ color: C.unavailable }}>20</span>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
          {/* bookings */}
          <Box sx={{ position: "absolute", left: 0, right: 0, top: 21, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: "3px" }}>
            {week === 0 ? (
              <>
                <Box sx={{ gridColumn: "2 / 5", mx: "2px", height: 15, borderRadius: "4px", backgroundColor: C.deployed, fontSize: 8.5, fontWeight: 700, px: 0.5, display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap" }}>
                  XCS support · 6
                </Box>
                <Box
                  sx={{
                    gridColumn: "6 / 7",
                    gridRow: 1,
                    mx: "2px",
                    height: 15,
                    borderRadius: "4px",
                    backgroundColor: "#ab47bc",
                    fontSize: 8.5,
                    fontWeight: 700,
                    px: 0.5,
                    display: "flex",
                    alignItems: "center",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
                    animation: `${drag} 3.2s ease-in-out infinite`,
                    ...noMotion,
                  }}
                >
                  Service
                </Box>
                <Box sx={{ gridColumn: "1 / 4", gridRow: 2, mx: "2px", height: 15, borderRadius: "4px", border: `1.5px dashed ${C.deployed}`, color: C.deployed, fontSize: 8.5, fontWeight: 700, px: 0.5, display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap" }}>
                  OVERSEAS · 5
                </Box>
              </>
            ) : (
              <Box sx={{ gridColumn: "3 / 8", mx: "2px", height: 15, borderRadius: "4px", backgroundColor: C.warning, fontSize: 8.5, fontWeight: 700, px: 0.5, display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap" }}>
                Maintenance · 3
              </Box>
            )}
          </Box>
        </Box>
      ))}
      <Marker n={1} top={78} left="27%" />
      <Marker n={3} top={64} left="67%" />
      <Finger top={46} left="30%" />
    </Screen>
  );
};

const SceneDashboard = () => (
  <Screen>
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.75, mb: 1 }}>
      {[
        ["49", "Vehicles", BRAND.accentText],
        ["20", "AVAILABLE", C.available],
        ["9", "DEPLOYED", C.deployed],
        ["20", "UNAVAILABLE", C.unavailable],
      ].map(([n, label, color]) => (
        <Box key={label} sx={{ p: 0.75, borderRadius: "6px", backgroundColor: C.soft, borderLeft: `3px solid ${color}` }}>
          <Typography sx={{ fontWeight: 900, fontSize: 15, lineHeight: 1.1 }}>{n}</Typography>
          <Typography sx={{ fontSize: 7.5, color: C.dim, whiteSpace: "nowrap", overflow: "hidden" }}>{label}</Typography>
        </Box>
      ))}
    </Box>
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
      {/* readiness ring */}
      <Box
        sx={{
          width: 74,
          height: 74,
          borderRadius: "50%",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          background: `conic-gradient(${C.available} 0 41%, ${C.deployed} 41% 59%, ${C.unavailable} 59% 100%)`,
        }}
      >
        <Box sx={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: BRAND.bg, display: "grid", placeItems: "center" }}>
          <Typography sx={{ fontWeight: 900, fontSize: 13 }}>41%</Typography>
        </Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 800, mb: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
          <Marker n={2} inline />
          Manage Disregards
        </Typography>
        {["IVC 2", "P-PLATE"].map((item, i) => (
          <Box key={item} sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.4 }}>
            <Box sx={{ width: 11, height: 11, borderRadius: "3px", backgroundColor: i ? "transparent" : C.accent, border: `1.5px solid ${i ? C.dim : C.accent}`, display: "grid", placeItems: "center" }}>
              {!i && <CheckIcon sx={{ fontSize: 9, color: "#0b0d1f" }} />}
            </Box>
            <Typography sx={{ fontSize: 9.5 }}>{item}</Typography>
            <Typography sx={{ fontSize: 8.5, color: i ? C.dim : C.accent }}>{i ? "counted" : "ignored"}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
    {/* assistant bubble */}
    <Box sx={{ position: "absolute", right: 10, bottom: 10, display: "flex", alignItems: "flex-end", gap: 0.75 }}>
      <Box sx={{ px: 1, py: 0.5, borderRadius: "10px 10px 2px 10px", backgroundColor: "rgba(255,255,255,0.12)", fontSize: 9, maxWidth: 110, animation: `${blink} 2.6s ease-in-out infinite`, ...noMotion }}>
        How many are deployed?
      </Box>
      <Box sx={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", backgroundColor: C.accent }}>
        <SmartToyOutlinedIcon sx={{ fontSize: 18, color: "#0b0d1f" }} />
      </Box>
    </Box>
    <Marker n={1} top={-2} left={-2} />
    <Marker n={3} bottom={36} right={4} />
  </Screen>
);

// ---------------------------------------------------------------- the steps

const makeSteps = ({ nodeName, signupOpen }) => [
  {
    icon: LoginOutlinedIcon,
    title: "Log in",
    lead: `Use the username and password from your Admin${nodeName ? ` (${nodeName} node)` : ""}.`,
    scene: <SceneLogin nodeName={nodeName} />,
    notes: [
      "Check the node. Wrong one? Change node.",
      signupOpen ? "No account? Sign up, or ask your Admin." : "No account or forgot it? Ask your Admin.",
      "Top-right menu: change password, light / dark.",
    ],
  },
  {
    icon: DirectionsCarOutlinedIcon,
    title: "Find your vehicles",
    lead: "You start on Manage Vehicles.",
    scene: <SceneVehicles />,
    notes: [
      "Empty? Menu → My worksheet → This sheet is mine.",
      "Add one vehicle at a time.",
      "Admin: bring in the whole Excel workbook.",
    ],
  },
  {
    icon: CheckCircleOutlineOutlinedIcon,
    title: "Read the status",
    lead: "Three colours tell you everything. Click a vehicle to see why.",
    scene: <SceneStatus />,
    notes: ["Green ready · blue out on a job · red held back.", "VOR or workshop always wins over tasking.", "N, NIL or NA mean \"no\" and never count."],
  },
  {
    icon: EditNoteOutlinedIcon,
    title: "Update a vehicle",
    lead: "Edit Blocked Vehicles or Edit Maintenance Level.",
    scene: <SceneUpdate />,
    notes: ["Pick the vehicle.", "Tick the field (or item).", "Choose a value (or Y / N) → Apply."],
  },
  {
    icon: FilterAltOutlinedIcon,
    title: "Find what you need",
    lead: "The filter bar narrows the list in seconds.",
    scene: <SceneFilters />,
    notes: ["Type a MID to find one vehicle.", "Reason: e.g. everything with AIRCON (N).", "Export what you see to Excel."],
  },
  {
    icon: AssignmentOutlinedIcon,
    title: "Who's out on what",
    lead: "The Tasking page groups vehicles by job and by reason.",
    scene: <SceneTasking />,
    notes: ["One card per tasking, with its MIDs.", "+5 more shows the rest.", "Why the others are not available."],
  },
  {
    icon: EventAvailableOutlinedIcon,
    title: "Plan with the calendar",
    lead: "Manage Vehicles → View: Calendar.",
    scene: <SceneCalendar />,
    notes: [
      "Click a day: what's available, deployed, unavailable.",
      "+ Booking: tasking, servicing, maintenance on dates.",
      "Drag a booking to move it (phone: hold first).",
    ],
  },
  {
    icon: InsightsOutlinedIcon,
    title: "Big picture & help",
    lead: "Dashboards, rules, and an assistant when you're stuck.",
    scene: <SceneDashboard />,
    notes: [
      "Fleet Commander Dashboard: your totals. Admin: NC Dashboard.",
      "Manage Disregards: ignore items a type doesn't have.",
      "Ask the assistant (bottom right).",
    ],
  },
];

// ---------------------------------------------------------------- the dialog

const HowToUseDialogVisual = ({ open, onClose, nodeName, signupOpen = true }) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const steps = makeSteps({ nodeName, signupOpen });
  const [step, setStep] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const touch = useRef(null);

  useEffect(() => {
    if (open) {
      setStep(0);
      setShowAll(false);
    }
  }, [open]);

  const last = steps.length - 1;
  const current = steps[Math.min(step, last)];
  const Icon = current.icon;
  const go = (n) => {
    setShowAll(false);
    setStep(Math.max(0, Math.min(last, n)));
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") go(step + 1);
    if (e.key === "ArrowLeft") go(step - 1);
  };
  const onTouchStart = (e) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!touch.current || showAll) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(step + (dx < 0 ? 1 : -1));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={phone}
      aria-labelledby="howto-title"
      onKeyDown={onKeyDown}
      slotProps={{
        backdrop: { sx: { backgroundColor: "rgba(6,8,24,0.62)", backdropFilter: "blur(4px)" } },
        paper: {
          onTouchStart,
          onTouchEnd,
          sx: {
            borderRadius: phone ? 0 : "24px",
            color: "#fff",
            backgroundImage: `linear-gradient(155deg, ${alpha(d.blueAccent[700], 0.96)} 0%, ${alpha(d.blueAccent[900], 0.98)} 60%, #0b0d1f 100%)`,
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          },
        },
      }}
    >
      {/* top bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 2.5, sm: 3.5 }, pt: 2.5 }}>
        <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,0.7)" }}>
          HOW TO USE ARGUS{nodeName ? ` · ${nodeName}` : ""}
        </Typography>
        <Button
          size="small"
          onClick={() => setShowAll((s) => !s)}
          startIcon={<ViewListOutlinedIcon fontSize="small" />}
          aria-pressed={showAll}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            color: "#fff",
            borderRadius: "999px",
            px: 1.5,
            backgroundColor: showAll ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)",
            "&:hover": { backgroundColor: "rgba(255,255,255,0.16)" },
          }}
        >
          {showAll ? "Back" : "All steps"}
        </Button>
        <IconButton aria-label="Close" onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.8)" }}>
          <CloseOutlinedIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* progress */}
      <Box role="tablist" sx={{ display: "flex", gap: 0.75, px: { xs: 2.5, sm: 3.5 }, pt: 2 }}>
        {steps.map((s, i) => (
          <Box
            key={s.title}
            role="tab"
            aria-selected={i === step}
            aria-label={`Step ${i + 1}: ${s.title}`}
            title={`${i + 1}. ${s.title}`}
            tabIndex={0}
            onClick={() => go(i)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && go(i)}
            sx={{
              flex: 1,
              height: 6,
              borderRadius: "3px",
              cursor: "pointer",
              backgroundColor: i === step ? C.accent : i < step ? alpha(C.accent, 0.45) : "rgba(255,255,255,0.18)",
              transition: "background-color 0.2s",
              "&:hover": { backgroundColor: i === step ? C.accent : "rgba(255,255,255,0.32)" },
              "&:focus-visible": { outline: `2px solid ${C.accent}`, outlineOffset: 2 },
            }}
          />
        ))}
      </Box>

      {showAll ? (
        /* every step as a picture card */
        <Box
          sx={{
            px: { xs: 2.5, sm: 3.5 },
            pt: 2.5,
            pb: 1,
            minHeight: { sm: 470 },
            flex: { xs: 1, sm: "none" },
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
            gap: 1.25,
            alignContent: "start",
            animation: `${slideIn} 0.25s ease-out`,
            ...noMotion,
          }}
        >
          {steps.map((s, i) => {
            const StepIcon = s.icon;
            return (
              <Box
                key={s.title}
                component="button"
                type="button"
                onClick={() => go(i)}
                sx={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 1,
                  p: 1.5,
                  borderRadius: "16px",
                  backgroundColor: i === step ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${i === step ? alpha(C.accent, 0.7) : "rgba(255,255,255,0.12)"}`,
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
                  "&:focus-visible": { outline: `2px solid ${C.accent}`, outlineOffset: 2 },
                }}
              >
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: "14px",
                    display: "grid",
                    placeItems: "center",
                    background: `linear-gradient(135deg, ${d.blueAccent[500]}, ${d.greenAccent[600]})`,
                  }}
                >
                  <StepIcon sx={{ fontSize: 25 }} />
                </Box>
                <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: d.greenAccent[400] }}>{i + 1}</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.2 }}>{s.title}</Typography>
              </Box>
            );
          })}
        </Box>
      ) : (
        /* one step: picture first, then the numbered captions */
        <Box
          key={step}
          sx={{
            px: { xs: 2.5, sm: 3.5 },
            pt: 2.5,
            pb: 1,
            minHeight: { sm: 470 },
            flex: { xs: 1, sm: "none" },
            overflowY: "auto",
            animation: `${slideIn} 0.25s ease-out`,
            ...noMotion,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.75 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "14px",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                background: `linear-gradient(135deg, ${d.blueAccent[500]}, ${d.greenAccent[600]})`,
              }}
            >
              <Icon sx={{ fontSize: 24 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.12em", color: d.greenAccent[400] }}>
                STEP {step + 1} OF {steps.length}
              </Typography>
              <Typography id="howto-title" variant="h3" sx={{ fontWeight: 800, fontSize: { xs: 21, sm: 24 }, lineHeight: 1.15 }}>
                {current.title}
              </Typography>
            </Box>
          </Box>

          {/* the picture */}
          {current.scene}

          <Typography sx={{ color: "rgba(255,255,255,0.8)", fontSize: 14, mt: 1.75, mb: 1.25 }}>{current.lead}</Typography>

          {/* captions: number = marker on the picture */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1 }}>
            {current.notes.map((note, i) => (
              <Box
                key={i}
                sx={{
                  display: "flex",
                  gap: 1,
                  alignItems: "flex-start",
                  p: 1,
                  borderRadius: "10px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                }}
              >
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 900,
                    color: "#0b0d1f",
                    backgroundColor: C.accent,
                  }}
                >
                  {i + 1}
                </Box>
                <Typography sx={{ fontSize: 12.5, lineHeight: 1.4, color: "rgba(255,255,255,0.9)" }}>{note}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* back / next */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: { xs: 2.5, sm: 3.5 }, py: 2.25 }}>
        <Button
          onClick={() => go(step - 1)}
          disabled={step === 0 || showAll}
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: "none", fontWeight: 700, color: "rgba(255,255,255,0.85)", "&.Mui-disabled": { opacity: 0.35, color: "#fff" } }}
        >
          Back
        </Button>
        {step < last && !showAll ? (
          <Button
            variant="contained"
            color="secondary"
            onClick={() => go(step + 1)}
            endIcon={<ArrowForwardIcon />}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.5 }}
          >
            Next
          </Button>
        ) : (
          <Button variant="contained" color="secondary" onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.5 }}>
            Got it
          </Button>
        )}
      </Box>
    </Dialog>
  );
};

export default HowToUseDialogVisual;