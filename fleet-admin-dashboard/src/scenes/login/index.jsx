import { useEffect, useState } from "react";
import { Alert, Box, Button, Tab, Tabs, TextField, Typography, useTheme } from "@mui/material";
import { tokens } from "../../theme";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../api/client";

const emptySignup = { name: "", username: "", password: "", confirm: "" };

const Login = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { login, signup } = useAuth();

  const [tab, setTab] = useState("login");
  const [isFirstAccount, setIsFirstAccount] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState(emptySignup);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // with no accounts yet, open on "Sign up" (the first account becomes admin)
  useEffect(() => {
    api("/auth/status")
      .then(({ hasUsers }) => {
        if (!hasUsers) {
          setIsFirstAccount(true);
          setTab("signup");
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const switchTab = (_, value) => {
    setTab(value);
    setError("");
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

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 420,
          p: { xs: "24px", sm: "40px" },
          backgroundColor: colors.primary[400],
          borderRadius: "4px",
        }}
      >
        <Typography variant="h2" sx={{ color: colors.grey[100], fontWeight: "bold" }}>
          FLEET ADMIN
        </Typography>
        <Typography variant="h5" sx={{ color: colors.greenAccent[400], mb: 2 }}>
          Fleet commander dashboard
        </Typography>

        <Tabs
          value={tab}
          onChange={switchTab}
          textColor="secondary"
          indicatorColor="secondary"
          variant="fullWidth"
          sx={{ mb: 3 }}
        >
          <Tab value="login" label="Log in" />
          <Tab value="signup" label="Sign up" />
        </Tabs>

        {tab === "login" ? (
          <Box
            component="form"
            onSubmit={handleLogin}
            sx={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <TextField
              label="Username"
              variant="filled"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              variant="filled"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              type="submit"
              color="secondary"
              variant="contained"
              size="large"
              disabled={busy || !username || !password}
            >
              Log In
            </Button>
          </Box>
        ) : (
          <Box
            component="form"
            onSubmit={handleSignup}
            sx={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {isFirstAccount && (
              <Alert severity="info">
                No accounts yet. The first account you create becomes the Admin,
                who can see every vehicle and manage accounts.
              </Alert>
            )}
            <TextField
              label="Display name"
              helperText="How you appear in the app, e.g. 3SG Rizq"
              variant="filled"
              autoFocus
              value={form.name}
              onChange={setField("name")}
            />
            <TextField
              label="Username"
              helperText="For logging in: letters, numbers, . _ -"
              variant="filled"
              autoComplete="username"
              value={form.username}
              onChange={setField("username")}
            />
            <TextField
              label="Password"
              helperText="At least 6 characters"
              type="password"
              variant="filled"
              autoComplete="new-password"
              value={form.password}
              onChange={setField("password")}
            />
            <TextField
              label="Confirm password"
              type="password"
              variant="filled"
              autoComplete="new-password"
              value={form.confirm}
              onChange={setField("confirm")}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              type="submit"
              color="secondary"
              variant="contained"
              size="large"
              disabled={busy || !form.name || !form.username || !form.password || !form.confirm}
            >
              Create account
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Login;
