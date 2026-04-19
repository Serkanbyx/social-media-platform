import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { Calendar, Lock, Pencil, ShieldCheck } from "lucide-react";

import Avatar from "../ui/Avatar.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import FollowButton from "./FollowButton.jsx";
import { cn } from "../../utils/cn.js";
import compactCount from "../../utils/formatCount.js";
import { tokenize } from "../../utils/linkify.js";

/**
 * ProfileHeader — identity surface for the profile page (STEP 31).
 *
 * Composition (top → bottom):
 *  - Brand-tinted cover banner (placeholder for a future cover-image
 *    feature; the layout already reserves the space so adding it later
 *    won't reflow anything below).
 *  - Avatar negatively offset over the banner with a thick page-coloured
 *    ring so it reads as a photo card sitting on top of the gradient.
 *  - Identity row: display name + admin badge, @handle + private lock
 *    icon, optional bio (linkified, preserves newlines), joined date.
 *  - Right slot: primary action button — "Edit profile" for the owner,
 *    `FollowButton` for everyone else, hidden entirely for inactive
 *    accounts (the page renders an EmptyState instead in that case).
 *  - Counters row: Posts (static), Followers / Following (linked).
 *
 * The component is *purely presentational*: data fetching, follow-state
 * reconciliation and counter arithmetic live in `ProfilePage`. Callbacks
 * (`onFollowChange`, `onRequireAuth`) bubble events up so the page can
 * keep its own derived state in sync.
 */

const monthYear = (input) => {
  if (!input) return "";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  // `Intl` keeps locale-aware month names without dragging extra deps.
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(date);
};

const renderBio = (bio) => {
  const tokens = tokenize(bio || "");
  if (tokens.length === 0) return null;

  return tokens.map((token, idx) => {
    const key = `${token.type}-${idx}`;
    switch (token.type) {
      case "mention":
        return (
          <Link
            key={key}
            to={`/u/${token.username}`}
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {token.value}
          </Link>
        );
      case "hashtag":
        return (
          <Link
            key={key}
            to={`/explore?q=${encodeURIComponent(token.value)}`}
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {token.value}
          </Link>
        );
      case "url":
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-600 break-all hover:underline dark:text-brand-400"
          >
            {token.value}
          </a>
        );
      default:
        return <span key={key}>{token.value}</span>;
    }
  });
};

function ProfileHeader({
  user,
  isOwner = false,
  onFollowChange,
  onRequireAuth,
  className = "",
}) {
  const profile = user || {};
  const username = profile.username || "user";
  const displayName = profile.name || `@${username}`;
  const isAdmin = profile.role === "admin";
  const isPrivate = Boolean(
    profile.isPrivate || profile.preferences?.privacy?.privateAccount
  );
  const isInactive = profile.isActive === false;

  const joined = useMemo(() => monthYear(profile.createdAt), [profile.createdAt]);
  const bioContent = useMemo(() => renderBio(profile.bio), [profile.bio]);

  const followersHref = `/u/${username}/followers`;
  const followingHref = `/u/${username}/following`;

  const followersCount = compactCount(profile.followersCount ?? 0);
  const followingCount = compactCount(profile.followingCount ?? 0);
  const postsCount = compactCount(profile.postsCount ?? 0);

  return (
    <header
      className={cn(
        "relative motion-safe:animate-fade-up",
        className
      )}
    >
      {/* Cover banner — pure decoration today, placeholder for future
          cover-image feature so adding one later won't reflow anything. */}
      <div
        aria-hidden="true"
        className={cn(
          "h-32 w-full rounded-b-2xl bg-gradient-to-br from-brand-500 to-brand-700 sm:h-48",
          "shadow-xs"
        )}
      />

      <div className="px-1 sm:px-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-4">
            <Avatar
              src={profile.avatar?.url}
              name={profile.name}
              username={profile.username}
              size="xl"
              className={cn(
                "-mt-12 size-24 ring-4 ring-white sm:-mt-16 sm:size-32 dark:ring-zinc-950",
                "shadow-md"
              )}
            />
          </div>

          {!isInactive && (
            <div className="shrink-0">
              {isOwner ? (
                <Button
                  as={Link}
                  to="/profile/edit"
                  variant="secondary"
                  size="sm"
                  leftIcon={Pencil}
                >
                  Edit profile
                </Button>
              ) : (
                <FollowButton
                  userId={profile._id}
                  isFollowing={Boolean(profile.isFollowing)}
                  size="sm"
                  onChange={onFollowChange}
                  onRequireAuth={onRequireAuth}
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-3 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {displayName}
            </h1>
            {isAdmin && (
              <Badge variant="brand" size="sm" className="gap-1">
                <ShieldCheck className="size-3" aria-hidden="true" />
                Admin
              </Badge>
            )}
          </div>

          <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            <span>@{username}</span>
            {isPrivate && (
              <>
                <span aria-hidden="true" className="text-zinc-400">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <Lock className="size-3" aria-hidden="true" />
                  Private account
                </span>
              </>
            )}
          </p>

          {bioContent && (
            <p className="mt-3 max-w-prose text-sm leading-relaxed whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200">
              {bioContent}
            </p>
          )}

          {joined && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Calendar className="size-3.5" aria-hidden="true" />
              <span>Joined {joined}</span>
            </p>
          )}
        </div>

        <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-600 dark:text-zinc-300">
          <li className="inline-flex items-baseline gap-1">
            <span className="font-semibold text-zinc-900 tnum dark:text-zinc-50">
              {postsCount}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">Posts</span>
          </li>
          <li>
            <Link
              to={followersHref}
              className="inline-flex items-baseline gap-1 rounded-md transition-colors duration-fast hover:underline"
            >
              <span className="font-semibold text-zinc-900 tnum dark:text-zinc-50">
                {followersCount}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">Followers</span>
            </Link>
          </li>
          <li>
            <Link
              to={followingHref}
              className="inline-flex items-baseline gap-1 rounded-md transition-colors duration-fast hover:underline"
            >
              <span className="font-semibold text-zinc-900 tnum dark:text-zinc-50">
                {followingCount}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">Following</span>
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}

export default memo(ProfileHeader);
