import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { startAppUpdates } from "./utils/pwaUpdates";
import { AppUpdateNotice } from "./components/AppUpdateNotice";

startAppUpdates();

const root = document.getElementById("root");
if (!root) {
  throw new Error("No se encontró el contenedor #root");
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <AppUpdateNotice />
    </BrowserRouter>
  </StrictMode>,
);
