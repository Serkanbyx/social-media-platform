import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import AdminRoute from "./components/guards/AdminRoute.jsx";
import GuestOnlyRoute from "./components/guards/GuestOnlyRoute.jsx";
import ProtectedRoute from "./components/guards/ProtectedRoute.jsx";

import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import Spinner from "./components/ui/Spinner.jsx";

import { useAuth } from "./context/useAuth.js";

/**
 * Top-level route tree (STEP 23, refined in STEP 38).
 *
 * Layout strategy:
 *  - Auth pages render without any chrome (no navbar/footer) so the user
 *    isn't distracted by app-level navigation while signing in.
 *  - Everything else is grouped under one of three layouts (Main /
 *    Settings / Admin) so chrome stays consistent across siblings.
 *
 * Guard strategy:
 *  - `GuestOnlyRoute` keeps signed-in users out of `/login` and `/register`.
 *  - `ProtectedRoute` wraps any route that mutates user state or shows
 *    private data (feed, composer, notifications, settings, profile edit).
 *  - `AdminRoute` is stricter still: signed in AND `role === 'admin'`.
 *
 * Read-only public surfaces (post detail, public profile, explore) stay
 * outside `ProtectedRoute` so deep links keep working for unauthenticated
 * visitors.
 *
 * Performance: every page-level route is wrapped with `React.lazy`, and
 * each layout is split into its own chunk. The initial JS bundle keeps
 * only routing, guards, the error boundary and the spinner — anything
 * the user actually navigates to is fetched on demand. A shared
 * `<Suspense>` boundary renders a full-screen spinner while a chunk is
 * being loaded so the layout doesn't flash empty content.
 */

// Layouts — small but split out so changing the feed page doesn't
// invalidate the cached settings/admin layout chunks.
const MainLayout = lazy(() => import("./components/layout/MainLayout.jsx"));
const SettingsLayout = lazy(
  () => import("./components/layout/SettingsLayout.jsx")
);
const AdminLayout = lazy(() => import("./components/layout/AdminLayout.jsx"));

// Auth — visited at most once per session, perfect lazy candidates.
const Login = lazy(() => import("./pages/auth/Login.jsx"));
const Register = lazy(() => import("./pages/auth/Register.jsx"));

// Main app surfaces.
const LandingPage = lazy(() => import("./pages/landing/LandingPage.jsx"));
const FeedPage = lazy(() => import("./pages/feed/FeedPage.jsx"));
const ExplorePage = lazy(() => import("./pages/explore/ExplorePage.jsx"));
const CreatePostPage = lazy(() => import("./pages/post/CreatePostPage.jsx"));
const PostDetailPage = lazy(() => import("./pages/post/PostDetailPage.jsx"));
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage.jsx"));
const FollowersPage = lazy(() => import("./pages/profile/FollowersPage.jsx"));
const FollowingPage = lazy(() => import("./pages/profile/FollowingPage.jsx"));
const EditProfilePage = lazy(
  () => import("./pages/profile/EditProfilePage.jsx")
);
const NotificationsPage = lazy(
  () => import("./pages/notifications/NotificationsPage.jsx")
);

// Settings — unlikely to be opened on the first visit, so isolating it
// keeps the feed bundle lean.
const AccountSettings = lazy(
  () => import("./pages/settings/AccountSettings.jsx")
);
const AppearanceSettings = lazy(
  () => import("./pages/settings/AppearanceSettings.jsx")
);
const NotificationSettings = lazy(
  () => import("./pages/settings/NotificationSettings.jsx")
);
const PrivacySettings = lazy(
  () => import("./pages/settings/PrivacySettings.jsx")
);

// Admin — only ever loaded for users with `role === 'admin'`.
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.jsx"));
const AdminPosts = lazy(() => import("./pages/admin/AdminPosts.jsx"));
const AdminComments = lazy(() => import("./pages/admin/AdminComments.jsx"));

const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));

/**
 * HomeRoute — branches the index route on auth state instead of forcing
 * unauthenticated visitors straight into `/login`. Signed-in users keep
 * landing on the feed (the historical home), while guests see the
 * marketing/preview landing page that doubles as a live tour of the
 * product (trending posts grid + sign-up CTAs).
 *
 * While the auth bootstrap is in flight we render a full-screen spinner
 * so a logged-in user does not get a brief flash of the landing page on
 * a hard refresh before `getMe()` resolves.
 */
function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner fullScreen />;
  return user ? <FeedPage /> : <LandingPage />;
}

export default function App() {
  // Re-key the boundary on pathname so a render-time crash on one
  // page doesn't keep the recovery card stuck in place after the user
  // navigates somewhere else (e.g. clicks the Pulse logo).
  const { pathname } = useLocation();

  return (
    <ErrorBoundary key={pathname}>
      <Suspense fallback={<Spinner fullScreen label="Sayfa yükleniyor" />}>
        <AppRoutes />
      </Suspense>
    </ErrorBoundary>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<MainLayout />}>
        <Route index element={<HomeRoute />} />
        <Route path="explore" element={<ExplorePage />} />

        <Route
          path="posts/new"
          element={
            <ProtectedRoute>
              <CreatePostPage />
            </ProtectedRoute>
          }
        />
        <Route path="posts/:id" element={<PostDetailPage />} />

        <Route path="u/:username" element={<ProfilePage />} />
        <Route path="u/:username/followers" element={<FollowersPage />} />
        <Route path="u/:username/following" element={<FollowingPage />} />

        <Route
          path="notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="profile/edit"
          element={
            <ProtectedRoute>
              <EditProfilePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        path="settings"
        element={
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="account" replace />} />
        <Route path="account" element={<AccountSettings />} />
        <Route path="appearance" element={<AppearanceSettings />} />
        <Route path="privacy" element={<PrivacySettings />} />
        <Route path="notifications" element={<NotificationSettings />} />
      </Route>

      <Route
        path="admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="posts" element={<AdminPosts />} />
        <Route path="comments" element={<AdminComments />} />
      </Route>
    </Routes>
  );
}
