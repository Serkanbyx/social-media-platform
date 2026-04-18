import { Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "./components/layout/AdminLayout.jsx";
import MainLayout from "./components/layout/MainLayout.jsx";
import SettingsLayout from "./components/layout/SettingsLayout.jsx";

import AdminRoute from "./components/guards/AdminRoute.jsx";
import GuestOnlyRoute from "./components/guards/GuestOnlyRoute.jsx";
import ProtectedRoute from "./components/guards/ProtectedRoute.jsx";

import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";

import FeedPage from "./pages/feed/FeedPage.jsx";
import ExplorePage from "./pages/explore/ExplorePage.jsx";

import CreatePostPage from "./pages/post/CreatePostPage.jsx";
import PostDetailPage from "./pages/post/PostDetailPage.jsx";

import EditProfilePage from "./pages/profile/EditProfilePage.jsx";
import FollowersPage from "./pages/profile/FollowersPage.jsx";
import FollowingPage from "./pages/profile/FollowingPage.jsx";
import ProfilePage from "./pages/profile/ProfilePage.jsx";

import NotificationsPage from "./pages/notifications/NotificationsPage.jsx";

import AccountSettings from "./pages/settings/AccountSettings.jsx";
import AppearanceSettings from "./pages/settings/AppearanceSettings.jsx";
import NotificationSettings from "./pages/settings/NotificationSettings.jsx";
import PrivacySettings from "./pages/settings/PrivacySettings.jsx";

import AdminComments from "./pages/admin/AdminComments.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminPosts from "./pages/admin/AdminPosts.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";

import NotFoundPage from "./pages/NotFoundPage.jsx";

/**
 * Top-level route tree (STEP 23).
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
 */
export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<MainLayout />}>
        <Route
          index
          element={
            <ProtectedRoute>
              <FeedPage />
            </ProtectedRoute>
          }
        />
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
