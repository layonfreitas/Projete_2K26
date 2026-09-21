import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./components/ui/ui.css";
import App from "./App.jsx";
import { AvisosProvider } from "./components/AvisosContext.jsx";
import { ToastProvider } from "./components/ui/Toast.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AvisosProvider>
          <App />
        </AvisosProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
