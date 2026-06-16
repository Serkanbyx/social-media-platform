import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import AppToaster from "./components/ui/AppToaster.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import "./index.css";

/**
 * Provider order is intentional:
 *   RouterProvider (data router — required for `useBlocker`)
 *     └─ AuthProvider          (owns user/token, must come first)
 *        └─ PreferencesProvider (reads user.preferences from auth)
 *           └─ SocketProvider   (uses auth token for the WS handshake)
 *              └─ NotificationProvider (subscribes to socket events)
 *
 * `<AppToaster />` lives at the root so toasts fired from any context
 * (e.g. NotificationProvider) render above the routed UI. It owns the
 * responsive positioning + max-3 stack contract documented in STEP 37.
 *
 * Why a *data* router (`createBrowserRouter`) instead of `<BrowserRouter>`:
 *   `useBlocker` (used by `useUnsavedChangesPrompt` for the dirty-form
 *   guard on /profile/edit) only works inside a data router. With the
 *   plain BrowserRouter the EditProfile page crashed on mount with
 *   "useBlocker must be used within a data router". A single catch-all
 *   route hosts the existing nested `<Routes>` tree inside `<App />`,
 *   so no other page-level routing change is required.
 */

// The full provider tree is hosted inside a single catch-all data route so
// `useBlocker` works app-wide. Defined inline (rather than as a named
// component in this entry file) so Fast Refresh stays happy — an entry file
// with no exports can't be refreshed, and a component here would warn.
const router = createBrowserRouter([
  {
    path: "*",
    element: (
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
    ),
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
