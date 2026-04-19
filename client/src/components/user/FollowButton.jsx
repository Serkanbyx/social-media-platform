import { memo, useCallback, useState } from "react";
import { UserCheck, UserMinus, UserPlus } from "lucide-react";

import Button from "../ui/Button.jsx";
import { useAuth } from "../../context/useAuth.js";
import { cn } from "../../utils/cn.js";
import { notify } from "../../utils/notify.js";
import * as userService from "../../services/userService.js";

/**
 * FollowButton — atomic, self-contained follow/unfollow toggle.
 *
 * Design notes:
 *  - Optimistic UI: click flips local state immediately, then reconciles
 *    with the server response and rolls back on failure (mirrors the
 *    `PostCard` like contract so they feel consistent).
 *  - Concurrency-safe: extra clicks during the in-flight request are
 *    ignored; the component never fires two `toggleFollow` requests
 *    against the same user in parallel.
 *  - Auth-aware: when no viewer is signed in we delegate to the
 *    `onRequireAuth` callback so the parent page can decide between
 *    redirecting to `/login` or opening a centered prompt modal
 *    (Explore's "Sign in to interact" pattern).
 *  - Self-aware: viewing your own card never renders a follow button.
 *  - Three visual states: not following → primary "Follow", following
 *    → secondary "Following" that morphs to a danger "Unfollow" on hover
 *    so the destructive action is always discoverable yet never accidental.
 *
 * The component intentionally accepts a flat `userId` + `isFollowing`
 * pair rather than the full user document so it stays decoupled from any
 * particular API shape and trivially re-mountable.
 */
function FollowButton({
  userId,
  isFollowing = false,
  size = "sm",
  fullWidth = false,
  className = "",
  onChange,
  onRequireAuth,
}) {
  const { user } = useAuth();

  const [following, setFollowing] = useState(Boolean(isFollowing));
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isSelf = Boolean(user) && String(user._id) === String(userId);

  const handleClick = useCallback(async () => {
    if (busy) return;

    if (!user) {
      if (typeof onRequireAuth === "function") {
        onRequireAuth();
      }
      return;
    }

    if (!userId) return;

    const nextFollowing = !following;
    setFollowing(nextFollowing);
    setBusy(true);

    try {
      const data = await userService.toggleFollow(userId);
      const serverFollowing =
        typeof data?.following === "boolean" ? data.following : nextFollowing;

      setFollowing(serverFollowing);
      onChange?.({
        userId,
        isFollowing: serverFollowing,
        followersCount:
          typeof data?.followersCount === "number"
            ? data.followersCount
            : undefined,
      });
    } catch {
      setFollowing(!nextFollowing);
      notify.error("Couldn't update follow status.");
    } finally {
      setBusy(false);
      setHovered(false);
    }
  }, [busy, following, onChange, onRequireAuth, user, userId]);

  if (isSelf) return null;

  const showUnfollowAffordance = following && hovered;

  let variant = "primary";
  let label = "Follow";
  let Icon = UserPlus;

  if (following) {
    if (showUnfollowAffordance) {
      variant = "danger";
      label = "Unfollow";
      Icon = UserMinus;
    } else {
      variant = "secondary";
      label = "Following";
      Icon = UserCheck;
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      loading={busy}
      leftIcon={!busy ? Icon : undefined}
      fullWidth={fullWidth}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-pressed={following}
      aria-label={
        following ? "Unfollow" : "Follow"
      }
      className={cn("min-w-[88px]", className)}
    >
      {label}
    </Button>
  );
}

export default memo(FollowButton);
