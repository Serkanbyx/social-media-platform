import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import App from "./App.jsx";
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
 * `<Toaster />` lives at the root so toasts fired from any context
 * (e.g. NotificationProvider) render above the routed UI.
 */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PreferencesProvider>
          <SocketProvider>
            <NotificationProvider>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  className:
                    "!bg-white !text-zinc-900 dark:!bg-zinc-900 dark:!text-zinc-100",
                }}
              />
            </NotificationProvider>
          </SocketProvider>
        </PreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
