import FollowListView from "./FollowListView.jsx";

/**
 * FollowersPage — `/u/:username/followers` route shell (STEP 33).
 *
 * The page itself is intentionally trivial: all of the data fetching,
 * tab switching and list logic lives in `FollowListView`, which is
 * shared with `FollowingPage` so the two surfaces stay visually and
 * behaviourally identical.
 */
export default function FollowersPage() {
  return <FollowListView tab="followers" />;
}
