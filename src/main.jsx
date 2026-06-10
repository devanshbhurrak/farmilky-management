import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { PortalDataProvider } from "./context/PortalDataContext";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PortalDataProvider>
          <App />
        </PortalDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
