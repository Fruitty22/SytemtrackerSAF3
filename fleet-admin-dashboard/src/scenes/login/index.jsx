import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  alpha,
  keyframes,
  useTheme,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import { themeSettings, tokens } from "../../theme";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../api/client";

const emptySignup = { name: "", username: "", password: "", confirm: "" };

// The login card is always the dark "night" look, whatever mode the app is in,
// so the glass panel and the text on it stay readable.
const d = tokens("dark");

// ---------- little animations (all switched off for people who prefer less motion) ----------
const rise = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`;
const drift = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(28px, -20px) scale(1.08); }
`;
const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;
const roll = keyframes`
  from { background-position-x: 0; }
  to { background-position-x: -70px; }
`;
const glow = keyframes`
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
`;
const noMotion = { "@media (prefers-reduced-motion: reduce)": { animation: "none" } };

// ---------- the drawn vehicle: a light utility vehicle, side view, driving to the right ----------
const wheelSpinSx = {
  transformBox: "fill-box",
  transformOrigin: "center",
  animation: `${spin} 1.8s linear infinite`,
  ...noMotion,
};

const Wheel = ({ cx }) => (
  <g>
    <circle cx={cx} cy={168} r={38} fill="#15171c" />
    <circle cx={cx} cy={168} r={31} fill="none" stroke="#2a2e37" strokeWidth={2} />
    {/* the part that turns: tread blocks, rim, bolts */}
    <Box component="g" sx={wheelSpinSx}>
      <circle cx={cx} cy={168} r={35.5} fill="none" stroke="#0b0c10" strokeWidth={5} strokeDasharray="7 5" />
      <circle cx={cx} cy={168} r={23} fill="url(#lv-rim)" />
      <circle cx={cx} cy={168} r={15} fill="#8a909a" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = ((i * 72 - 90) * Math.PI) / 180;
        return <circle key={i} cx={cx + 9.5 * Math.cos(a)} cy={168 + 9.5 * Math.sin(a)} r={2.2} fill="#3a3f48" />;
      })}
      <circle cx={cx} cy={168} r={4} fill="#3a3f48" />
    </Box>
  </g>
);

const LightUtilityVehicle = () => (
  <Box
    component="svg"
    viewBox="0 0 520 220"
    aria-hidden="true"
    focusable="false"
    sx={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
  >
    <defs>
      <linearGradient id="lv-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#80906f" />
        <stop offset="0.55" stopColor="#5f7052" />
        <stop offset="1" stopColor="#465439" />
      </linearGradient>
      <linearGradient id="lv-box" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7b8b6b" />
        <stop offset="1" stopColor="#4d5b42" />
      </linearGradient>
      <linearGradient id="lv-glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bfd3e0" />
        <stop offset="1" stopColor="#5a7285" />
      </linearGradient>
      <linearGradient id="lv-rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#c8cdd5" />
        <stop offset="1" stopColor="#8a919b" />
      </linearGradient>
      <linearGradient id="lv-beam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff1c9" stopOpacity="0.6" />
        <stop offset="1" stopColor="#fff1c9" stopOpacity="0" />
      </linearGradient>
      <filter id="lv-soft" x="-20%" y="-60%" width="140%" height="220%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>

    {/* shadow on the road */}
    <ellipse cx="270" cy="208" rx="225" ry="7" fill="#000" opacity="0.4" filter="url(#lv-soft)" />

    {/* headlight beam */}
    <Box
      component="path"
      d="M470 121 L585 92 L585 154 L470 133 Z"
      fill="url(#lv-beam)"
      sx={{ animation: `${glow} 3.5s ease-in-out infinite`, ...noMotion }}
    />

    {/* chassis */}
    <rect x="58" y="146" width="422" height="22" rx="6" fill="#1b1e24" />

    {/* rear shelter (the box on the back) */}
    <path d="M62 50 Q62 40 72 40 H280 Q292 40 292 52 V152 H62 Z" fill="url(#lv-box)" />
    <path d="M62 50 Q62 40 72 40 H280 Q292 40 292 52" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.2" />
    {/* roof rails */}
    <rect x="84" y="30" width="190" height="4" rx="2" fill="#2a2f27" />
    <rect x="96" y="33" width="4" height="8" fill="#2a2f27" />
    <rect x="176" y="33" width="4" height="8" fill="#2a2f27" />
    <rect x="256" y="33" width="4" height="8" fill="#2a2f27" />
    {/* panel seams */}
    <path d="M112 44 V150 M202 44 V108" stroke="#000" strokeOpacity="0.2" strokeWidth="1.4" />
    {/* side window with its awning flap */}
    <rect x="126" y="54" width="104" height="8" rx="2" fill="#3a452f" />
    <rect x="128" y="62" width="100" height="42" rx="3" fill="#1d2127" />
    <rect x="132" y="66" width="92" height="34" rx="2" fill="url(#lv-glass)" opacity="0.92" />
    <path d="M150 66 H168 L148 100 H132 V84 Z" fill="#fff" opacity="0.2" />
    {/* storage hatch */}
    <rect x="196" y="114" width="78" height="32" rx="3" fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="1.5" />
    <rect x="236" y="127" width="14" height="4" rx="2" fill="#20242b" />
    {/* tail light and rear bumper */}
    <rect x="62" y="116" width="5" height="18" rx="2" fill="#d9413c" />
    <rect x="54" y="144" width="18" height="10" rx="3" fill="#1b1e24" />

    {/* cab (the front part) */}
    <path
      d="M292 70 H350 Q354 70 357 74 L386 112 Q388 114 392 114 H466 Q480 114 480 128 V152 H292 Z"
      fill="url(#lv-body)"
    />
    <path d="M292 70 H350 Q354 70 357 74 L386 112 Q388 114 392 114 H466" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.2" />
    <path d="M292 70 V152" stroke="#000" strokeOpacity="0.35" strokeWidth="1.6" />
    {/* cab window */}
    <path d="M300 78 H348 L376 110 H300 Z" fill="url(#lv-glass)" stroke="#1d2127" strokeWidth="3" strokeLinejoin="round" />
    <path d="M322 78 H336 L314 110 H300 V92 Z" fill="#fff" opacity="0.22" />
    {/* door */}
    <path d="M368 118 V148 M300 120 V148" stroke="#000" strokeOpacity="0.25" strokeWidth="1.4" />
    <rect x="340" y="124" width="14" height="4" rx="2" fill="#20242b" />
    <rect x="381" y="98" width="10" height="16" rx="3" fill="#1d2127" />
    {/* antenna */}
    <line x1="304" y1="70" x2="297" y2="18" stroke="#1d2127" strokeWidth="1.6" strokeLinecap="round" />

    {/* wheel arches, then the wheels */}
    <path d="M86 168 A44 44 0 0 1 174 168 Z" fill="#101216" />
    <path d="M356 168 A44 44 0 0 1 444 168 Z" fill="#101216" />
    <Wheel cx={130} />
    <Wheel cx={400} />

    {/* bull bar and front bumper */}
    <path d="M468 138 H484 Q490 138 490 146 V152 H468 Z" fill="#14161b" />
    <path d="M474 152 V124 Q474 118 481 118 Q490 118 490 128 V152" fill="none" stroke="#14161b" strokeWidth="5" strokeLinecap="round" />
    <path d="M474 135 H490" stroke="#14161b" strokeWidth="4" strokeLinecap="round" />

    {/* headlight */}
    <circle cx="470" cy="125" r="14" fill="#ffe9a8" opacity="0.4" filter="url(#lv-soft)" />
    <rect x="462" y="120" width="14" height="9" rx="3" fill="#fff7dd" />
    <rect x="462" y="131" width="12" height="4" rx="2" fill="#ffa04a" />
  </Box>
);

const FEATURES = [
  {
    icon: CheckCircleOutlineOutlinedIcon,
    title: "Availability at a glance",
    text: "Available, deployed or unavailable, worked out from your own rules.",
  },
  {
    icon: EventAvailableOutlinedIcon,
    title: "Tasking and bookings",
    text: "Put tasking, servicing and maintenance on the calendar.",
  },
  {
    icon: BuildOutlinedIcon,
    title: "Maintenance tracking",
    text: "See which items are N, and which vehicles they hold back.",
  },
];

// A text box with an icon at the start (and an eye for passwords)
const Field = ({ icon: Icon, password, onCapsLock, sx, ...props }) => {
  const [show, setShow] = useState(false);
  return (
    <TextField
      variant="filled"
      fullWidth
      {...props}
      type={password ? (show ? "text" : "password") : "text"}
      sx={sx}
      slotProps={{
        input: {
          disableUnderline: true,
          startAdornment: (
            <InputAdornment position="start" sx={{ opacity: 0.65 }}>
              <Icon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: password ? (
            <InputAdornment position="end">
              <IconButton
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((s) => !s)}
                edge="end"
                size="small"
                tabIndex={-1}
              >
                {show ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
        htmlInput: password
          ? {
              onKeyUp: (e) => onCapsLock?.(e.getModifierState?.("CapsLock") ?? false),
              onBlur: () => onCapsLock?.(false),
            }
          : undefined,
      }}
    />
  );
};

const Login = () => {
  const appTheme = useTheme();
  const appDark = appTheme.palette.mode === "dark";
  // the card always uses the dark theme (see the note at the top)
  const darkTheme = useMemo(() => createTheme(themeSettings("dark")), []);
  const accent = darkTheme.palette.secondary.main;

  const { login, signup } = useAuth();

  const [tab, setTab] = useState("login");
  const [isFirstAccount, setIsFirstAccount] = useState(false);
  const [signupOpen, setSignupOpen] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState(emptySignup);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  // with no accounts yet, open on "Sign up" (the first account becomes admin)
  useEffect(() => {
    api("/auth/status")
      .then(({ hasUsers, signupOpen: open }) => {
        setSignupOpen(open !== false);
        if (!hasUsers) {
          setIsFirstAccount(true);
          setTab("signup");
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const goTo = (value) => {
    setTab(value);
    setError("");
    setCapsLock(false);
  };

  const setField = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action(); // on success the app switches to the dashboard
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const handleLogin = (event) => {
    event.preventDefault();
    run(() => login(username, password));
  };

  const handleSignup = (event) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError("The two passwords don't match.");
      return;
    }
    run(() => signup(form));
  };

  // ---- look of the text boxes (soft glass fill, green ring when focused) ----
  const fieldBg = "rgba(255,255,255,0.08)";
  const fieldSx = {
    "& .MuiFilledInput-root": {
      borderRadius: "12px",
      backgroundColor: fieldBg,
      transition: "box-shadow 0.15s, background-color 0.15s",
      "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
      "&.Mui-focused": { backgroundColor: "rgba(255,255,255,0.1)", boxShadow: `0 0 0 2px ${accent}` },
    },
    // the label floats above the text; line it up with the text, right of the icon
    "& .MuiInputLabel-root.MuiInputLabel-shrink": { transform: "translate(40px, 7px) scale(0.75)" },
    // stop the browser's autofill from painting a bright box over the field
    "& input:-webkit-autofill": {
      WebkitBoxShadow: `0 0 0 100px ${d.blueAccent[800]} inset`,
      WebkitTextFillColor: "#fff",
      borderRadius: "12px",
    },
  };

  const rowSx = { display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: "16px" };
  const submitSx = {
    py: 1.5,
    borderRadius: "12px",
    fontWeight: 700,
    fontSize: 15,
    textTransform: "none",
    mt: 0.5,
    boxShadow: `0 8px 22px ${alpha(accent, 0.3)}`,
    transition: "transform 0.15s, box-shadow 0.15s",
    "&:hover": { transform: "translateY(-1px)", boxShadow: `0 12px 28px ${alpha(accent, 0.42)}` },
    "&.Mui-disabled": { boxShadow: "none" },
  };

  const logo = (size = 42) => (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "12px",
        display: "grid",
        placeItems: "center",
        color: "#fff",
        background: `linear-gradient(135deg, ${d.blueAccent[500]}, ${d.greenAccent[600]})`,
        boxShadow: `0 6px 18px ${alpha(d.blueAccent[500], 0.45)}`,
        flexShrink: 0,
      }}
    >
      <DirectionsCarOutlinedIcon />
    </Box>
  );

  // a glowing blurred ball of colour behind the glass
  const orb = (sx) => (
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

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 1.5, sm: 3 },
        // soft glows + a faint dot grid behind the card
        backgroundImage: `
          radial-gradient(ellipse at 12% 8%, ${alpha(d.blueAccent[500], appDark ? 0.24 : 0.14)} 0%, transparent 52%),
          radial-gradient(ellipse at 92% 96%, ${alpha(d.greenAccent[500], appDark ? 0.16 : 0.1)} 0%, transparent 48%),
          radial-gradient(${appDark ? "rgba(255,255,255,0.055)" : "rgba(20,27,45,0.07)"} 1px, transparent 1px)`,
        backgroundSize: "auto, auto, 26px 26px",
      }}
    >
      <ThemeProvider theme={darkTheme}>
        <Box
          sx={{
            position: "relative",
            width: "100%",
            maxWidth: 1040,
            borderRadius: "28px",
            overflow: "hidden",
            background: `linear-gradient(150deg, ${d.blueAccent[700]} 0%, ${d.blueAccent[900]} 52%, #0b0d1f 100%)`,
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
            animation: `${rise} 0.5s ease-out`,
            ...noMotion,
          }}
        >
          {/* ---------- the scene behind everything (the glass panel shows it through) ---------- */}
          {orb({ width: 480, height: 480, top: -170, right: -110, background: `radial-gradient(circle, ${alpha(d.blueAccent[400], 0.5)} 0%, transparent 68%)` })}
          {orb({ width: 420, height: 420, bottom: -190, left: -130, background: `radial-gradient(circle, ${alpha(d.greenAccent[500], 0.3)} 0%, transparent 68%)`, animationDelay: "-6s" })}
          {orb({ width: 320, height: 320, top: "34%", left: "42%", background: `radial-gradient(circle, ${alpha(d.blueAccent[500], 0.4)} 0%, transparent 68%)`, animationDelay: "-11s" })}
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
          {/* the road, running right across the card */}
          <Box
            aria-hidden
            sx={{
              display: { xs: "none", md: "block" },
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
              gridTemplateColumns: { xs: "1fr", md: "1.08fr 1fr" },
            }}
          >
            {/* ================= LEFT: brand panel (hidden on phones) ================= */}
            <Box
              sx={{
                display: { xs: "none", md: "flex" },
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 3,
                p: "40px 36px 22px 40px",
                minHeight: 680,
                color: "#fff",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                {logo()}
                <Typography sx={{ fontWeight: 800, letterSpacing: "0.14em", fontSize: 18 }}>FLEET MANAGEMENT</Typography>
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 40, lineHeight: 1.08, letterSpacing: "-0.01em" }}>
                  Know what&rsquo;s
                  <br />
                  ready.
                </Typography>
                <Typography sx={{ mt: 1.5, color: "rgba(255,255,255,0.72)", maxWidth: 380, fontSize: 15 }}>
                  One live view of availability, tasking and maintenance across your whole fleet.
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75, mt: 3.5 }}>
                  {FEATURES.map(({ icon: Icon, title, text }) => (
                    <Box key={title} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: "10px",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          backgroundColor: "rgba(255,255,255,0.09)",
                        }}
                      >
                        <Icon sx={{ fontSize: 19 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{title}</Typography>
                        <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
                          {text}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* the vehicle stands on the road line (the road is positioned to match) */}
              <Box sx={{ mb: "9px" }}>
                <LightUtilityVehicle />
              </Box>
            </Box>

            {/* ================= RIGHT: the frosted glass form ================= */}
            <Box
              sx={{
                m: { xs: "10px", md: "16px" },
                p: { xs: "26px 20px 28px", sm: "40px 44px" },
                borderRadius: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                minWidth: 0,
                background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)",
                backdropFilter: "blur(22px) saturate(150%)",
                WebkitBackdropFilter: "blur(22px) saturate(150%)",
                border: "1px solid rgba(255,255,255,0.16)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 20px 50px rgba(0,0,0,0.3)",
              }}
            >
              {/* logo shows here only on phones (the left panel is hidden there) */}
              <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1.5, mb: 3 }}>
                {logo(38)}
                <Typography sx={{ fontWeight: 800, letterSpacing: "0.14em", fontSize: 16, color: "#fff" }}>
                  FLEET ADMIN
                </Typography>
              </Box>

              <Typography
                variant="h2"
                sx={{ fontWeight: 800, color: "#fff", fontSize: { xs: 28, sm: 34 }, letterSpacing: "-0.01em" }}
              >
                {tab === "login" ? "Welcome back" : "Create your account"}
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.7)", mt: 0.75, mb: 2.5, fontSize: 14.5 }}>
                {tab === "login" ? "Log in to your fleet dashboard." : "It takes less than a minute."}
              </Typography>

              {/* Log in / Sign up switch */}
              {signupOpen && (
                <Box
                  role="tablist"
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    p: "4px",
                    mb: 3,
                    borderRadius: "12px",
                    backgroundColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  {[
                    ["login", "Log in"],
                    ["signup", "Sign up"],
                  ].map(([value, label]) => (
                    <ButtonBase
                      key={value}
                      role="tab"
                      aria-selected={tab === value}
                      onClick={() => goTo(value)}
                      sx={{
                        py: 1,
                        borderRadius: "9px",
                        fontWeight: 700,
                        fontSize: 14,
                        color: tab === value ? "#fff" : "rgba(255,255,255,0.6)",
                        backgroundColor: tab === value ? "rgba(255,255,255,0.18)" : "transparent",
                        boxShadow: tab === value ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      {label}
                    </ButtonBase>
                  ))}
                </Box>
              )}

              {tab === "login" ? (
                <Box component="form" onSubmit={handleLogin} sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <Field
                    icon={PersonOutlinedIcon}
                    label="Username"
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    sx={fieldSx}
                  />
                  <Box>
                    <Field
                      icon={LockOutlinedIcon}
                      password
                      onCapsLock={setCapsLock}
                      label="Password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      sx={fieldSx}
                    />
                    {capsLock && (
                      <Typography sx={{ mt: 0.75, ml: 0.5, fontSize: 12.5, color: darkTheme.palette.warning.main }}>
                        Caps Lock is on
                      </Typography>
                    )}
                  </Box>
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button
                    type="submit"
                    color="secondary"
                    variant="contained"
                    size="large"
                    disabled={busy || !username || !password}
                    endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
                    sx={submitSx}
                  >
                    {busy ? "Logging in" : "Log in"}
                  </Button>
                  <Typography sx={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.55)", mt: 0.5 }}>
                    {signupOpen
                      ? "Forgot your password? Ask your Admin to reset it."
                      : "No account yet, or forgot your password? Ask your Admin."}
                  </Typography>
                </Box>
              ) : (
                <Box component="form" onSubmit={handleSignup} sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {isFirstAccount && (
                    <Alert severity="info">
                      No accounts yet. The first account you create becomes the Admin, who can see every vehicle and
                      manage accounts.
                    </Alert>
                  )}
                  <Box sx={rowSx}>
                    <Field
                      icon={BadgeOutlinedIcon}
                      label="Display name"
                      helperText="e.g. 3SG Rizq"
                      autoFocus
                      value={form.name}
                      onChange={setField("name")}
                      sx={fieldSx}
                    />
                    <Field
                      icon={PersonOutlinedIcon}
                      label="Username"
                      helperText="Letters, numbers, . _ -"
                      autoComplete="username"
                      value={form.username}
                      onChange={setField("username")}
                      sx={fieldSx}
                    />
                  </Box>
                  <Box sx={rowSx}>
                    <Field
                      icon={LockOutlinedIcon}
                      password
                      label="Password"
                      helperText="At least 6 characters"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={setField("password")}
                      sx={fieldSx}
                    />
                    <Field
                      icon={LockOutlinedIcon}
                      password
                      label="Confirm password"
                      autoComplete="new-password"
                      value={form.confirm}
                      onChange={setField("confirm")}
                      sx={fieldSx}
                    />
                  </Box>
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button
                    type="submit"
                    color="secondary"
                    variant="contained"
                    size="large"
                    disabled={busy || !form.name || !form.username || !form.password || !form.confirm}
                    endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
                    sx={submitSx}
                  >
                    {busy ? "Creating account" : "Create account"}
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </ThemeProvider>
    </Box>
  );
};

export default Login;