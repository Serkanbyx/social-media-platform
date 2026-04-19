import { memo } from "react";
import { Link } from "react-router-dom";

import Avatar from "../ui/Avatar.jsx";
import FollowButton from "./FollowButton.jsx";
import { cn } from "../../utils/cn.js";

/**
 * UserCard — single-row representation of a user.
 *
 * Used by Explore (people search results) and the followers / following
 * lists. The same component everywhere keeps row heights, hover styles
 * and the follow CTA visually consistent across the app.
 *
 * Composition:
 *  - Avatar (size scales with the `dense` prop)
 *  - Identity column: name (or @username fallback) + @username + bio
 *  - Trailing slot: `FollowButton` by default, swappable via `action`
 *    (e.g. an "Unfollow" confirm flow on the Following tab).
 *
 * Avatar and identity links target `/u/:username` so the whole row is
 * navigable without nesting anchors. The follow button intentionally
 * lives outside any anchor so a click on it never bubbles into a
 * profile navigation.
 */
function UserCard({
  user,
  dense = false,
  showBio = true,
  action,
  onFollowChange,
  onRequireAuth,
  className = "",
}) {
  if (!user) return null;

  const username = user.username || "user";
  const displayName = user.name || `@${username}`;
  const profileHref = `/u/${username}`;
  const bio = typeof user.bio === "string" ? user.bio.trim() : "";

  const trailing =
    typeof action !== "undefined" ? (
      action
    ) : (
      <FollowButton
        userId={user._id}
        isFollowing={Boolean(user.isFollowing)}
        size="sm"
        onChange={onFollowChange}
        onRequireAuth={onRequireAuth}
      />
    );

  return (
    <li
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors duration-fast",
        "hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-900/60",
        className
      )}
    >
      <Link
        to={profileHref}
        className="shrink-0 rounded-full"
        aria-label={`@${username} profili`}
      >
        <Avatar
          src={user.avatar?.url}
          name={user.name}
          username={user.username}
          size={dense ? "sm" : "md"}
        />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1.5 text-sm">
          <Link
            to={profileHref}
            className="truncate font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            {displayName}
          </Link>
          {user.name && (
            <Link
              to={profileHref}
              className="truncate text-zinc-500 hover:underline dark:text-zinc-400"
            >
              @{username}
            </Link>
          )}
        </div>
        {showBio && bio && (
          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {bio}
          </p>
        )}
      </div>

      {trailing && <div className="shrink-0">{trailing}</div>}
    </li>
  );
}

export default memo(UserCard);
