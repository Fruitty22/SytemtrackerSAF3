import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { VehiclesProvider } from "./data/VehiclesContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <VehiclesProvider>
          <App />
        </VehiclesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
