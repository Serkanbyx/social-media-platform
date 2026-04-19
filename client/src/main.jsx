import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import AppToaster from "./components/ui/AppToaster.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import "./index.css";

/**
 * Provider order is intentional:
 *   BrowserRouter
 *     └─ AuthProvider          (owns user/token, must come first)
 *        └─ PreferencesProvider (reads user.preferences from auth)
 *           └─ SocketProvider   (uses auth token for the WS handshake)
 *              └─ NotificationProvider (subscribes to socket events)
 *
 * `<AppToaster />` lives at the root so toasts fired from any context
 * (e.g. NotificationProvider) render above the routed UI. It owns the
 * responsive positioning + max-3 stack contract documented in STEP 37.
 */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PreferencesProvider>
          <SocketProvider>
            <NotificationProvider>
              <App />
              <AppToaster />
            </NotificationProvider>
          </SocketProvider>
        </PreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
