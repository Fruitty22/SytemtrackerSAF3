import { Activity, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { Box, CircularProgress, CssBaseline, ThemeProvider } from "@mui/material";
import { ColorModeContext, useMode } from "./theme";
import { useAuth } from "./auth/AuthContext";
import RequireAccess from "./auth/RequireAccess";
import { canOpen, navItems } from "./navigation";
import Topbar from "./scenes/global/Topbar";
import Sidebar from "./scenes/global/Sidebar";
import Login from "./scenes/login";
import Vehicles from "./scenes/vehicles";
import Serviceable from "./scenes/serviceable";
import Maintenance from "./scenes/maintenance";
import Blocked from "./scenes/blocked";
import Accounts from "./scenes/accounts";
import CommanderDashboard from "./scenes/commander-dashboard";
import Disregards from "./scenes/disregards";
import Tasking from "./scenes/tasking";
import Criteria from "./scenes/criteria";
import Assistant from "./components/assistant/Assistant";
import Placeholder from "./scenes/placeholder";

// Pages that are really built. Everything else in src/navigation.js
// falls back to the "not built yet" page.
const pages = {
  vehicles: <Vehicles />,
  "serviceable-vehicle": <Serviceable />,
  "edit-maintenance": <Maintenance />,
  "edit-blocked": <Blocked />,
  "commander-dashboard": <CommanderDashboard key="own" />,
  "nc-dashboard": <CommanderDashboard key="nc" fleetWide />,
  accounts: <Accounts />,
  "manage-disregards": <Disregards />,
  tasking: <Tasking />,
  "manage-criteria": <Criteria />,
};

// FAST PAGE SWITCHING
// Instead of throwing a page away when you leave it and building it again when
// you come back, every page is kept alive in a React <Activity>:
//   - the page you're on is "visible"
//   - pages you've left are "hidden" (kept, with their filters and scroll
//     state, and only updated when the phone is idle)
//   - right after login, the other pages are built one by one in the
//     background while nothing else is happening
// So switching tabs only has to *show* a page that is already built.
const Pages = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const allowed = navItems.filter((item) => canOpen(user, item.key));
  const active = allowed.find((item) => item.to === pathname);
  const [built, setBuilt] = useState(() => (active ? [active.key] : []));

  // the page being opened is always built
  if (active && !built.includes(active.key)) setBuilt([...built, active.key]);

  // build the rest in the background, one page per idle moment
  const next = allowed.find((item) => !built.includes(item.key));
  useEffect(() => {
    if (!next) return undefined;
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = idle(() => setBuilt((b) => (b.includes(next.key) ? b : [...b, next.key])), { timeout: 2000 });
    return () => cancel(id);
  }, [next]);

  if (!active) {
    // a page this account can't open, or an unknown address
    const known = navItems.find((item) => item.to === pathname);
    return known ? (
      <RequireAccess access={known.key}>{null}</RequireAccess>
    ) : (
      <Navigate to="/" replace />
    );
  }

  return allowed
    .filter((item) => built.includes(item.key))
    .map((item) => (
      <Activity key={item.key} mode={item.key === active.key ? "visible" : "hidden"}>
        <RequireAccess access={item.key}>{pages[item.key] ?? <Placeholder title={item.title} />}</RequireAccess>
      </Activity>
    ));
};

function App() {
  const [theme, colorMode] = useMode();
  const { user, checking } = useAuth();

  let content;
  if (checking) {
    content = (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  } else if (!user) {
    content = <Login />;
  } else {
    content = (
      <div className="app">
        <Sidebar />
        <main className="content">
          <Topbar />
          {/* key: a different account starts with fresh pages */}
          <Pages key={user.id} />
        </main>
        {/* the AI assistant: a chat button on every page */}
        <Assistant key={`assistant-${user.id}`} />
      </div>
    );
  }

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {content}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
