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
import { tokens } from "../theme";

// "How to use ARGUS" - a step-by-step guide that opens over the login page.
//
// To change the guide, edit makeSteps() below. Each step has:
//   icon, title, short (the name in the "All steps" list), who (who it's for),
//   where (how to get there), lead (one line), bullets, visual (what to look for
//   on screen) and an optional tip.
// Add or remove steps freely - the progress bars, "Step 2 of 8" and the list follow.
//
// Moving around: Next / Back, the progress bars, the arrow keys, swiping left /
// right on a phone, or "All steps" to jump straight to one.
//
// Props: open, onClose, nodeName (e.g. "KTN"), signupOpen (can people sign up themselves?)

const d = tokens("dark");

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(14px); }
  to { opacity: 1; transform: translateX(0); }
`;
const noMotion = { "@media (prefers-reduced-motion: reduce)": { animation: "none" } };

// ---- tiny "what you will see on screen" pieces ----
const TONES = {
  plain: { bg: "rgba(255,255,255,0.1)", border: "rgba(255,255,255,0.18)" },
  accent: { bg: alpha(d.greenAccent[500], 0.22), border: alpha(d.greenAccent[500], 0.6) },
  available: { bg: alpha("#4caf50", 0.3), border: alpha("#4caf50", 0.8) },
  deployed: { bg: alpha("#2196f3", 0.3), border: alpha("#2196f3", 0.8) },
  unavailable: { bg: alpha("#f44336", 0.3), border: alpha("#f44336", 0.8) },
  dashed: { bg: "transparent", border: "rgba(255,255,255,0.5)", style: "dashed" },
};

const Pill = ({ children, tone = "plain", sx }) => {
  const t = TONES[tone] ?? TONES.plain;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1.5,
        py: 0.5,
        borderRadius: "999px",
        fontSize: 12.5,
        fontWeight: 800,
        letterSpacing: "0.04em",
        color: "#fff",
        backgroundColor: t.bg,
        border: `1px ${t.style ?? "solid"} ${t.border}`,
        whiteSpace: "nowrap",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

// a "Menu → Page" path, so people know where to click
const Where = ({ path }) => (
  <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
    {path.map((part, i) => (
      <Box key={part} sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
        {i > 0 && <ArrowForwardIcon sx={{ fontSize: 13, opacity: 0.6 }} />}
        <Box
          component="span"
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: "6px",
            fontSize: 12.5,
            fontWeight: 700,
            backgroundColor: "rgba(255,255,255,0.09)",
          }}
        >
          {part}
        </Box>
      </Box>
    ))}
  </Box>
);

// who a step is for
const WHO_STYLE = {
  Everyone: d.greenAccent[500],
  "Fleet Commanders": d.blueAccent[300],
  Admin: "#ffb74d",
};

const makeSteps = ({ nodeName, signupOpen }) => [
  {
    icon: LoginOutlinedIcon,
    title: "Get into ARGUS",
    short: "Log in",
    who: ["Everyone"],
    where: ["Login page"],
    lead: `Log in with the username and password your Admin gave you${nodeName ? ` for the ${nodeName} node` : ""}.`,
    bullets: [
      <>
        Check the <b>NODE</b> badge above the form. Wrong node? Click <b>Change node</b>.
      </>,
      signupOpen ? (
        <>
          No account yet? Choose <b>Sign up</b>, then ask your Admin to link your worksheet.
        </>
      ) : (
        <>
          No account yet? Ask your Admin to create one for you.
        </>
      ),
      <>
        Forgot your password? Your Admin can reset it. Once you're in, change it yourself from the menu at the top
        right → <b>Change password</b>.
      </>,
      <>
        The same menu has <b>My account</b> (your name and username) and the moon icon switches light / dark mode.
      </>,
    ],
    visual: (
      <>
        <Pill tone="accent">NODE: {nodeName || "KTN"}</Pill>
        <Pill>Log in</Pill>
        <Pill>Change password</Pill>
      </>
    ),
    tip: "Caps Lock warnings appear under the password box, so a wrong password is easy to spot.",
  },
  {
    icon: DirectionsCarOutlinedIcon,
    title: "Find your vehicles",
    short: "Your vehicles",
    who: ["Everyone"],
    where: ["Manage Vehicles"],
    lead: "After logging in you land on Manage Vehicles. Fleet Commanders see their own vehicles; the Admin sees the whole node.",
    bullets: [
      <>
        Empty list? Open the menu at the top right → <b>My worksheet</b>, pick your sheet and press{" "}
        <b>This sheet is mine</b>. Its vehicles move to you.
      </>,
      <>
        <b>Add vehicle</b> adds one at a time; the pencil edits MID, type and remarks.
      </>,
      <>
        Admin: <b>Import from Excel</b> brings in the whole workbook. The last screen shows how many vehicles will be
        available, deployed and unavailable before anything is saved, and an import can be undone.
      </>,
      <>
        Admin: tick vehicles and use <b>Assign to</b> to give them to a commander.
      </>,
    ],
    visual: (
      <>
        <Pill>My worksheet</Pill>
        <Pill tone="accent">+ Add vehicle</Pill>
        <Pill>Import from Excel</Pill>
        <Pill>Assign to</Pill>
      </>
    ),
  },
  {
    icon: CheckCircleOutlineOutlinedIcon,
    title: "Read the status",
    short: "Status",
    who: ["Everyone"],
    where: ["Manage Vehicles", "click a vehicle"],
    lead: "Every vehicle is in one of three states, worked out for you from its fields.",
    bullets: [
      <>
        <b>AVAILABLE</b>: nothing is holding it back.
      </>,
      <>
        <b>DEPLOYED</b>: out on a job: tasking, self drive, TLOAN, overseas or ICT.
      </>,
      <>
        <b>UNAVAILABLE</b>: VOR, workshop, standby, a servicing booking, or a maintenance item at N. VOR or workshop
        always wins, even if the vehicle also has a tasking.
      </>,
      <>
        <b>Click any vehicle</b> to see everything about it: why it has that status, its blocked fields, maintenance
        items, bookings and remarks.
      </>,
    ],
    visual: (
      <>
        <Pill tone="available">AVAILABLE</Pill>
        <Pill tone="deployed">DEPLOYED</Pill>
        <Pill tone="unavailable">UNAVAILABLE</Pill>
      </>
    ),
    tip: "Writing N, NIL or NA in TASKING, STANDBY and similar fields means \"no\" - it never counts.",
  },
  {
    icon: EditNoteOutlinedIcon,
    title: "Update a vehicle",
    short: "Update",
    who: ["Everyone"],
    where: ["Edit Blocked Vehicles", "or Edit Maintenance Level"],
    lead: "Pick a vehicle on the left, tick what you want to change, then apply.",
    bullets: [
      <>
        <b>Edit Blocked Vehicles</b>: tick a field (SVC STATUS, TASKING, ICT, STANDBY, WORKSHOP…), choose a value from
        the drop-down or type a new one, then <b>Apply</b>. The bin icon clears it.
      </>,
      <>
        <b>Edit Maintenance Level</b>: tick items (AIRCON, TYRES, FE…), choose <b>Y</b> or <b>N</b>, then{" "}
        <b>Apply</b>.
      </>,
      <>
        Each field has a switch to ignore it for that one vehicle only.
      </>,
      <>
        Shortcut: in a vehicle's details, the <b>Edit</b> buttons open these pages with that vehicle already
        picked.
      </>,
    ],
    visual: (
      <>
        <Pill>SVC STATUS: VOR</Pill>
        <Pill>TASKING: XCS</Pill>
        <Pill tone="unavailable">AIRCON: N</Pill>
        <Pill tone="accent">Apply</Pill>
      </>
    ),
  },
  {
    icon: FilterAltOutlinedIcon,
    title: "Find what you need",
    short: "Filters",
    who: ["Everyone"],
    where: ["Manage Vehicles", "or Serviceable Vehicle"],
    lead: "Use the filter bar to narrow the list down in seconds.",
    bullets: [
      <>
        <b>MID number</b> finds one vehicle; <b>Vehicle type</b> shows one type.
      </>,
      <>
        <b>Availability</b> shows only available, deployed or unavailable vehicles.
      </>,
      <>
        <b>Reason</b> answers "which vehicles are out because of…", e.g. <b>AIRCON (N)</b> or{" "}
        <b>TASKING: DETAIL</b>.
      </>,
      <>
        <b>Serviceable Vehicle</b> is a read-only overview of the same list. <b>Export to Excel</b> downloads what
        you're looking at.
      </>,
    ],
    visual: (
      <>
        <Pill>MID number</Pill>
        <Pill>Availability</Pill>
        <Pill>Reason: AIRCON (N)</Pill>
        <Pill>Export to Excel</Pill>
      </>
    ),
    tip: "The numbers in the boxes at the top always match what the filters show.",
  },
  {
    icon: AssignmentOutlinedIcon,
    title: "See who's out on what",
    short: "Tasking",
    who: ["Everyone"],
    where: ["Tasking"],
    lead: "The Tasking page groups vehicles by what they're doing.",
    bullets: [
      <>
        <b>On tasking</b>: one card per tasking (e.g. XCS, DETAIL) with how many vehicles and their MIDs.
      </>,
      <>
        <b>Not available because</b>: every reason, with how many vehicles have it, from most to fewest.
      </>,
      <>
        Lists show 5 MIDs at first. Press <b>+5 more</b>, or use <b>MIDs shown</b> to show 10, 20 or all.
      </>,
    ],
    visual: (
      <>
        <Pill tone="deployed">XCS · 6</Pill>
        <Pill tone="unavailable">SVC STATUS: VOR · 12</Pill>
        <Pill>+5 more</Pill>
      </>
    ),
  },
  {
    icon: EventAvailableOutlinedIcon,
    title: "Plan ahead with the calendar",
    short: "Calendar",
    who: ["Everyone"],
    where: ["Manage Vehicles", "View: Calendar"],
    lead: "Put tasking, servicing and maintenance on dates. Vehicles change status by themselves on those days.",
    bullets: [
      <>
        <b>Click a day</b> to see how many vehicles are available, deployed or unavailable that day, and which.
      </>,
      <>
        Press <b>+ Booking</b> (or drag across several days), choose the kind, dates and vehicles, then{" "}
        <b>Create</b>. When the booking ends, the vehicles go back to normal.
      </>,
      <>
        Drag a booking to another day to move it. On a phone, press and hold first.
      </>,
      <>
        <b>Dashed bars</b> are statuses set on vehicles without dates. Click one → <b>Put on the calendar</b> to give
        it dates.
      </>,
    ],
    visual: (
      <>
        <Pill>View: Calendar</Pill>
        <Pill tone="accent">+ Booking</Pill>
        <Pill tone="deployed">Tasking</Pill>
        <Pill tone="dashed">OVERSEAS · 5</Pill>
      </>
    ),
    tip: "Month, Week and List views are at the top right of the calendar. List is easiest on a phone.",
  },
  {
    icon: InsightsOutlinedIcon,
    title: "The big picture, rules and help",
    short: "Dashboards & help",
    who: ["Everyone", "Admin"],
    where: ["Fleet Commander Dashboard"],
    lead: "Dashboards sum up the fleet; the rules decide what counts.",
    bullets: [
      <>
        <b>Fleet Commander Dashboard</b>: your vehicles' totals, readiness, what's on tasking and what's held back.
      </>,
      <>
        Admin: <b>NC Dashboard</b> shows the whole node, or any one commander.
      </>,
      <>
        <b>Manage Disregards</b>: tick items a vehicle type doesn't need (e.g. IVC 2), so they stop making it
        unavailable. Admin: <b>Manage Criteria</b> sets which columns count.
      </>,
      <>
        On a phone, the <b>☰</b> button at the top left opens the menu.
      </>,
    ],
    visual: (
      <>
        <Pill>Fleet Commander Dashboard</Pill>
        <Pill>Manage Disregards</Pill>
        <Pill tone="accent">Assistant</Pill>
      </>
    ),
    tip: "Stuck? The round assistant button at the bottom right answers how-to questions and can prepare changes for you to confirm.",
  },
];

const HowToUseDialog = ({ open, onClose, nodeName, signupOpen = true }) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const steps = makeSteps({ nodeName, signupOpen });
  const [step, setStep] = useState(0);
  const [showAll, setShowAll] = useState(false); // the "All steps" list
  const touch = useRef(null);

  // always start at step 1 when it is opened
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

  // swipe left / right on a phone
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
          {showAll ? "Back to step" : "All steps"}
        </Button>
        <IconButton aria-label="Close" onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.8)" }}>
          <CloseOutlinedIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* progress: click a bar to jump to that step */}
      <Box role="tablist" sx={{ display: "flex", gap: 0.75, px: { xs: 2.5, sm: 3.5 }, pt: 2 }}>
        {steps.map((s, i) => (
          <Box
            key={s.title}
            role="tab"
            aria-selected={i === step}
            aria-label={`Step ${i + 1}: ${s.title}`}
            title={`${i + 1}. ${s.short}`}
            tabIndex={0}
            onClick={() => go(i)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && go(i)}
            sx={{
              flex: 1,
              height: 6,
              borderRadius: "3px",
              cursor: "pointer",
              backgroundColor: i === step ? d.greenAccent[500] : i < step ? alpha(d.greenAccent[500], 0.45) : "rgba(255,255,255,0.18)",
              transition: "background-color 0.2s",
              "&:hover": { backgroundColor: i === step ? d.greenAccent[500] : "rgba(255,255,255,0.32)" },
              "&:focus-visible": { outline: `2px solid ${d.greenAccent[500]}`, outlineOffset: 2 },
            }}
          />
        ))}
      </Box>

      {showAll ? (
        /* ---------- every step at a glance: click one to jump to it ---------- */
        <Box
          sx={{
            px: { xs: 2.5, sm: 3.5 },
            pt: 2.5,
            pb: 1,
            minHeight: { sm: 470 },
            flex: { xs: 1, sm: "none" },
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 1.25,
            alignContent: "start",
            overflowY: "auto",
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
                  alignItems: "center",
                  gap: 1.5,
                  p: 1.25,
                  borderRadius: "14px",
                  backgroundColor: i === step ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${i === step ? alpha(d.greenAccent[500], 0.7) : "rgba(255,255,255,0.12)"}`,
                  transition: "background-color 0.15s",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
                  "&:focus-visible": { outline: `2px solid ${d.greenAccent[500]}`, outlineOffset: 2 },
                }}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: "11px",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    background: `linear-gradient(135deg, ${d.blueAccent[500]}, ${d.greenAccent[600]})`,
                  }}
                >
                  <StepIcon sx={{ fontSize: 21 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: d.greenAccent[400] }}>
                    STEP {i + 1}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.25 }}>{s.title}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : (
        /* ---------- one step (slides in each time it changes) ---------- */
        <Box
          key={step}
          sx={{
            px: { xs: 2.5, sm: 3.5 },
            pt: 3,
            pb: 1,
            minHeight: { sm: 470 }, // same height on every step, so the box does not jump
            flex: { xs: 1, sm: "none" },
            overflowY: "auto",
            animation: `${slideIn} 0.25s ease-out`,
            ...noMotion,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.75, mb: 1.5 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: "16px",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                background: `linear-gradient(135deg, ${d.blueAccent[500]}, ${d.greenAccent[600]})`,
                boxShadow: `0 8px 22px ${alpha(d.blueAccent[500], 0.45)}`,
              }}
            >
              <Icon sx={{ fontSize: 28 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: d.greenAccent[400] }}>
                STEP {step + 1} OF {steps.length}
              </Typography>
              <Typography id="howto-title" variant="h3" sx={{ fontWeight: 800, fontSize: { xs: 22, sm: 26 }, lineHeight: 1.15 }}>
                {current.title}
              </Typography>
            </Box>
          </Box>

          {/* who it's for + where to find it */}
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1.75 }}>
            {current.who.map((w) => (
              <Box
                key={w}
                component="span"
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: "6px",
                  fontSize: 11.5,
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  color: WHO_STYLE[w] ?? "#fff",
                  border: `1px solid ${alpha(WHO_STYLE[w] ?? "#fff", 0.6)}`,
                }}
              >
                {w.toUpperCase()}
              </Box>
            ))}
            <Where path={current.where} />
          </Box>

          <Typography sx={{ color: "rgba(255,255,255,0.86)", fontSize: 15, mb: 1.5 }}>{current.lead}</Typography>

          <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.1 }}>
            {current.bullets.map((b, i) => (
              <Box component="li" key={i} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
                <Box
                  sx={{
                    mt: "2px",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#0b0d1f",
                    backgroundColor: d.greenAccent[500],
                  }}
                >
                  {i + 1}
                </Box>
                <Typography sx={{ fontSize: 14.5, lineHeight: 1.5, color: "rgba(255,255,255,0.92)" }}>{b}</Typography>
              </Box>
            ))}
          </Box>

          {/* what it looks like on screen */}
          <Box
            sx={{
              mt: 2.25,
              p: 1.75,
              borderRadius: "14px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1.25,
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px dashed rgba(255,255,255,0.2)",
            }}
          >
            <Typography sx={{ width: "100%", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)" }}>
              LOOK FOR
            </Typography>
            {current.visual}
          </Box>

          {current.tip && (
            <Box
              sx={{
                mt: 2,
                p: 1.25,
                borderRadius: "12px",
                backgroundColor: alpha(d.greenAccent[500], 0.1),
                borderLeft: `3px solid ${d.greenAccent[500]}`,
              }}
            >
              <Typography sx={{ fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.82)" }}>
                <Box component="span" sx={{ fontWeight: 800, color: d.greenAccent[400] }}>
                  Tip:{" "}
                </Box>
                {current.tip}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* back / next */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: { xs: 2.5, sm: 3.5 }, py: 2.5 }}>
        <Button
          onClick={() => go(step - 1)}
          disabled={step === 0 || showAll}
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: "none", fontWeight: 700, color: "rgba(255,255,255,0.85)", "&.Mui-disabled": { opacity: 0.35, color: "#fff" } }}
        >
          Back
        </Button>
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: { xs: "none", sm: "block" } }}>
          Use ← → to move between steps
        </Typography>
        {step < last && !showAll ? (
          <Button
            variant="contained"
            color="secondary"
            onClick={() => go(step + 1)}
            endIcon={<ArrowForwardIcon />}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.5 }}
          >
            Next: {steps[step + 1].short}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="secondary"
            onClick={onClose}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.5 }}
          >
            Got it
          </Button>
        )}
      </Box>
    </Dialog>
  );
};

export default HowToUseDialog;
