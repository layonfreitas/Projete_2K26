import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AvisosProvider } from "./components/AvisosContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AvisosProvider>
        <App />
      </AvisosProvider>
    </BrowserRouter>
  </StrictMode>
);