import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { VehiclesProvider } from "./data/VehiclesContext";
import { PrefsProvider } from "./prefs/PrefsContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <PrefsProvider>
      <AuthProvider>
        <VehiclesProvider>
          <App />
        </VehiclesProvider>
      </AuthProvider>
      </PrefsProvider>
    </BrowserRouter>
  </StrictMode>
);
