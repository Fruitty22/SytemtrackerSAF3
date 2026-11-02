import { Navigate, Route, Routes } from "react-router";
import { Box, CircularProgress, CssBaseline, ThemeProvider } from "@mui/material";
import { ColorModeContext, useMode } from "./theme";
import { useAuth } from "./auth/AuthContext";
import RequireAccess from "./auth/RequireAccess";
import { navItems } from "./navigation";
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
          <Routes>
            {navItems.map((item) => (
              <Route
                key={item.key}
                path={item.to}
                element={
                  <RequireAccess access={item.key}>
                    {pages[item.key] ?? <Placeholder title={item.title} />}
                  </RequireAccess>
                }
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
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
