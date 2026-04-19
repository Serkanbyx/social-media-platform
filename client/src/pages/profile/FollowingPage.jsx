import FollowListView from "./FollowListView.jsx";

/**
 * FollowingPage — `/u/:username/following` route shell (STEP 33).
 *
 * Mirror of `FollowersPage`: both routes simply mount the shared
 * `FollowListView` with the right tab, so navigating between
 * `/followers` and `/following` always lands on the same layout with
 * just the active tab — and its data — swapped out.
 */
export default function FollowingPage() {
  return <FollowListView tab="following" />;
}
