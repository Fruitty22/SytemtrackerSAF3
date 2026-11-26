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
  useTheme,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import { themeSettings, tokens, BRAND } from "../../theme";
import { MAIN_NODE } from "../../../shared/nodes.js";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../api/client";
import { drift, noMotion, rise, roll } from "../../components/FleetVehicle";
import { NodeVehicle } from "../../components/NodeVehicles";
import ArgusBrand from "../../components/ArgusBrand";
import HowToUseDialog from "../../components/HowToUseDialog";

const emptySignup = { name: "", username: "", password: "", confirm: "" };

// The login card is always the dark "night" look, whatever mode the app is in,
// so the glass panel and the text on it stay readable.
const d = tokens("dark");

// animations and the drawn vehicle: src/components/FleetVehicle.jsx

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

  const { login, signup, node, leaveNode } = useAuth();

  const [tab, setTab] = useState("login");
  const [isFirstAccount, setIsFirstAccount] = useState(false);
  const [emptyNode, setEmptyNode] = useState(false); // a node nobody has set up yet
  const [signupOpen, setSignupOpen] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState(emptySignup);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false); // the "How to use ARGUS" guide

  // with no accounts yet, open on "Sign up" (the first account becomes admin)
  useEffect(() => {
    api("/auth/status")
      .then(({ hasUsers, signupOpen: open, node: statusNode }) => {
        setSignupOpen(open !== false);
        // only the main node's very first account becomes Admin; other
        // nodes are set up by the Super Admin
        if (!hasUsers && (statusNode?.key ?? MAIN_NODE) === MAIN_NODE) {
          setIsFirstAccount(true);
          setTab("signup");
        } else if (!hasUsers) {
          setEmptyNode(true);
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

  const helpSx = {
    alignSelf: "flex-end",
    mt: 3,
    position: { xs: "static", md: "absolute" },
    right: { md: 30 },
    bottom: { md: 24 },
    textTransform: "none",
    fontWeight: 600,
    fontSize: 13.5,
    color: "rgba(255,255,255,0.85)",
    borderRadius: "999px",
    px: 1.75,
    py: 0.6,
    border: "1px solid rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.07)",
    transition: "background-color 0.15s, border-color 0.15s",
    "&:hover": { backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.4)" },
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
            background: `linear-gradient(150deg, ${d.blueAccent[700]} 0%, ${d.blueAccent[900]} 52%, ${BRAND.deep} 100%)`,
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
              <ArgusBrand size="xl" node={node?.key} />

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

              {/* each node's own vehicle (src/components/NodeVehicles.jsx) stands on the road line (the road is positioned to match) */}
              <Box sx={{ mb: "9px" }}>
                <NodeVehicle node={node?.key} />
              </Box>
            </Box>

            {/* ================= RIGHT: the frosted glass form ================= */}
            <Box
              sx={{
                m: { xs: "10px", md: "16px" },
                p: { xs: "26px 20px 20px", sm: "40px 44px 64px" },
                position: "relative",
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
              {/* name shows here only on phones (the left panel is hidden there) */}
              <ArgusBrand size="xl" stack node={node?.key} sx={{ display: { xs: "flex", md: "none" }, mb: 3, "& svg": { width: 128, height: 128 } }} />

              {/* which node this login is for */}
              {node && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      borderRadius: "999px",
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      fontSize: 13,
                      color: "#fff",
                      backgroundColor: alpha(accent, 0.22),
                      border: `1px solid ${alpha(accent, 0.6)}`,
                    }}
                  >
                    NODE: {node.name}
                  </Box>
                  <Box
                    component="button"
                    type="button"
                    onClick={leaveNode}
                    sx={{
                      background: "none",
                      border: 0,
                      p: 0,
                      cursor: "pointer",
                      color: "rgba(255,255,255,0.75)",
                      fontSize: 13,
                      textDecoration: "underline",
                      "&:hover": { color: "#fff" },
                    }}
                  >
                    Change node
                  </Box>
                </Box>
              )}
              <Typography
                variant="h2"
                sx={{ fontWeight: 800, color: "#fff", fontSize: { xs: 28, sm: 34 }, letterSpacing: "-0.01em" }}
              >
                {tab === "login" ? "Welcome back" : "Create your account"}
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.7)", mt: 0.75, mb: 2.5, fontSize: 14.5 }}>
                {tab === "login"
                  ? `Log in to ${node ? `the ${node.name}` : "your"} fleet dashboard.`
                  : "It takes less than a minute."}
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
                  {emptyNode && (
                    <Alert severity="info">
                      This node has no accounts yet. The Super Admin logs in here to set it up and create its Admin.
                    </Alert>
                  )}
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

              <Button
                type="button"
                onClick={() => setHelpOpen(true)}
                startIcon={<HelpOutlineOutlinedIcon fontSize="small" />}
                aria-haspopup="dialog"
                sx={helpSx}
              >
                How to use ARGUS
              </Button>
            </Box>
          </Box>
        </Box>

        {/* the step-by-step guide (src/components/HowToUseDialog.jsx) */}
        <HowToUseDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      </ThemeProvider>
    </Box>
  );
};

export default Login;