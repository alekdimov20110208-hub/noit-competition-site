import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { PreferencesProvider } from "./preferences/index.ts";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("BudoGraph could not find its application root.");
}

createRoot(rootElement).render(
  <StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </StrictMode>,
);
