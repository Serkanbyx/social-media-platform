import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  ExternalLink,
  Heart,
  ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Newspaper,
  Trash2,
} from "lucide-react";

import AdminFiltersBar from "../../components/admin/AdminFiltersBar.jsx";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminSelect from "../../components/admin/AdminSelect.jsx";

import Avatar from "../../components/ui/Avatar.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import ConfirmModal from "../../components/ui/ConfirmModal.jsx";
import Dropdown from "../../components/ui/Dropdown.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import IconButton from "../../components/ui/IconButton.jsx";
import AdminTableRowSkeleton from "../../components/ui/skeletons/AdminTableRowSkeleton.jsx";

import useDebounce from "../../hooks/useDebounce.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.js";

import * as adminService from "../../services/adminService.js";
import { ADMIN_PAGE_SIZE } from "../../services/adminService.js";
import { cldUrl } from "../../utils/cldUrl.js";
import compactCount from "../../utils/formatCount.js";
import { formatAbsolute, formatRelative } from "../../utils/formatDate.js";
import { truncate } from "../../utils/helpers.js";
import { cn } from "../../utils/cn.js";
import notify from "../../utils/notify.js";

/**
 * AdminPosts — moderation table for the post collection (STEP 36).
 *
 * Toggle visibility (hide/unhide) is optimistic + immediate: the row
 * gets the muted "hidden" treatment as soon as the user clicks, and we
 * roll back if the server rejects. Delete pops a confirm modal first
 * (the cascade hook removes related comments/notifications/the
 * Cloudinary asset, and that's irreversible).
 */

const SEARCH_DEBOUNCE_MS = 350;

const STATUS_OPTIONS = [
  { value: "all", label: "All posts" },
  { value: "false", label: "Visible" },
  { value: "true", label: "Hidden" },
];

const ROW_COLUMNS = 7;
const PREVIEW_LENGTH = 80;

export default function AdminPosts() {
  useDocumentTitle("Admin · Posts");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const debouncedSearch = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);

  const hasActiveFilters =
    debouncedSearch.length > 0 || status !== "all";

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  const handleSearchChange = useCallback((next) => {
    setSearch(next);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((next) => {
    setStatus(next);
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearch("");
    setStatus("all");
    setPage(1);
  }, []);

  const retryPosts = useCallback(() => {
    setLoading(true);
    setError("");
    setRetryToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminService.listAllPosts({
          page,
          limit: ADMIN_PAGE_SIZE,
          q: debouncedSearch || undefined,
          isHidden: status === "all" ? undefined : status,
        });
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(typeof data?.total === "number" ? data.total : 0);
        setTotalPages(
          typeof data?.totalPages === "number" ? data.totalPages : 1
        );
        setError("");
      } catch {
        if (cancelled) return;
        setError("Couldn't load posts.");
        setItems([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, status, retryToken]);

  const updateLocalPost = useCallback((id, patch) => {
    setItems((prev) =>
      prev.map((row) =>
        String(row._id) === String(id) ? { ...row, ...patch } : row
      )
    );
  }, []);

  const handleToggleHidden = useCallback(
    async (target) => {
      if (!target) return;
      const previous = target.isHidden;
      const next = !previous;
      updateLocalPost(target._id, { isHidden: next });
      try {
        await adminService.hidePost(target._id);
        notify.success(next ? "Post hidden." : "Post is visible again.");
      } catch (err) {
        updateLocalPost(target._id, { isHidden: previous });
        const message =
          err?.response?.data?.message || "Couldn't change post status.";
        notify.error(message);
      }
    },
    [updateLocalPost]
  );

  const [pendingDelete, setPendingDelete] = useState(null);
  const closeDelete = useCallback(() => setPendingDelete(null), []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await adminService.deletePost(pendingDelete._id);
      setItems((prev) => prev.filter((row) => row._id !== pendingDelete._id));
      setTotal((prev) => Math.max(0, prev - 1));
      notify.success("Post deleted.");
      closeDelete();
    } catch (err) {
      const message = err?.response?.data?.message || "Couldn't delete post.";
      notify.error(message);
      closeDelete();
    }
  }, [closeDelete, pendingDelete]);

  return (
    <div className="space-y-4">
      <AdminFiltersBar
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search post content"
        searchAriaLabel="Search post content"
        searchPending={search.trim() !== debouncedSearch}
        hasActiveFilters={hasActiveFilters}
        onReset={handleResetFilters}
        extras={
          <AdminSelect
            label="Status"
            inline
            value={status}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
          />
        }
      />

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={retryPosts}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50/80 backdrop-blur dark:bg-zinc-900/80">
                <tr className="text-left text-2xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-3">Post</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Likes</th>
                  <th className="px-4 py-3 text-right">Comments</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <AdminTableRowSkeleton
                      key={`p-skel-${idx}`}
                      columns={ROW_COLUMNS}
                    />
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={ROW_COLUMNS} className="px-4 py-12">
                      <EmptyState
                        icon={Newspaper}
                        title={
                          hasActiveFilters
                            ? "No posts match these filters"
                            : "No posts found"
                        }
                        description={
                          hasActiveFilters
                            ? "Adjust your search or reset the filters."
                            : "No posts have been shared yet."
                        }
                        action={
                          hasActiveFilters
                            ? {
                                label: "Reset filters",
                                onClick: handleResetFilters,
                              }
                            : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <PostRow
                      key={row._id}
                      row={row}
                      onToggleHidden={handleToggleHidden}
                      onDelete={(target) => setPendingDelete(target)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden">
            {loading ? (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <li key={`p-card-skel-${idx}`} className="px-4 py-4">
                    <div className="space-y-2">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Newspaper}
                title={
                  hasActiveFilters
                    ? "No posts match these filters"
                    : "No posts found"
                }
                description={
                  hasActiveFilters
                    ? "Adjust your search or reset the filters."
                    : "No posts have been shared yet."
                }
                action={
                  hasActiveFilters
                    ? {
                        label: "Reset filters",
                        onClick: handleResetFilters,
                      }
                    : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((row) => (
                  <PostCardRow
                    key={row._id}
                    row={row}
                    onToggleHidden={handleToggleHidden}
                    onDelete={(target) => setPendingDelete(target)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        loading={loading}
        onPageChange={(next) => setPage(next)}
      />

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete post"
        description="You're about to permanently delete this post. All of its comments, likes and related notifications will also be removed. This action cannot be undone."
        confirmLabel="Delete permanently"
        cancelLabel="Cancel"
        busyLabel="Deleting…"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={closeDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Row components                                                            */
/* -------------------------------------------------------------------------- */

function PostThumb({ url, alt }) {
  if (!url) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
      >
        <ImageIcon className="size-5" />
      </span>
    );
  }
  return (
    <img
      src={cldUrl(url, { w: 96, h: 96, c: "fill", q: "auto", f: "auto" })}
      alt={alt || ""}
      loading="lazy"
      decoding="async"
      className="size-12 shrink-0 rounded-md object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
    />
  );
}

function PostRow({ row, onToggleHidden, onDelete }) {
  const author = row.author || {};
  const preview = row.content
    ? truncate(row.content, PREVIEW_LENGTH)
    : "(empty post)";

  const items = [
    {
      key: "view",
      label: "Open in new tab",
      icon: ExternalLink,
      onClick: () => window.open(`/posts/${row._id}`, "_blank"),
    },
    {
      key: "toggle",
      label: row.isHidden ? "Show post" : "Hide post",
      icon: row.isHidden ? Eye : EyeOff,
      onClick: () => onToggleHidden(row),
    },
    { divider: true },
    {
      key: "delete",
      label: "Delete post",
      icon: Trash2,
      danger: true,
      onClick: () => onDelete(row),
    },
  ];

  return (
    <tr
      className={cn(
        "border-t border-zinc-100 transition-colors duration-fast hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40",
        row.isHidden && "bg-zinc-50/70 text-zinc-500 dark:bg-zinc-900/40 dark:text-zinc-400"
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-start gap-3">
          <PostThumb url={row.image?.url} alt={preview} />
          <div className="min-w-0 max-w-md">
            <Link
              to={`/posts/${row._id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "block text-sm font-medium hover:underline",
                row.isHidden
                  ? "text-zinc-500 line-through dark:text-zinc-400"
                  : "text-zinc-900 dark:text-zinc-50"
              )}
            >
              {preview}
            </Link>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar
            src={author.avatar?.url}
            name={author.name}
            username={author.username}
            size="xs"
          />
          <Link
            to={`/u/${author.username || ""}`}
            className="truncate text-zinc-700 hover:underline dark:text-zinc-300"
          >
            @{author.username || "deleted"}
          </Link>
        </div>
      </td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
        <time dateTime={row.createdAt} title={formatAbsolute(row.createdAt)} className="tnum">
          {formatRelative(row.createdAt)}
        </time>
      </td>
      <td className="px-4 py-3 text-right tnum text-zinc-700 dark:text-zinc-300">
        {compactCount(row.likesCount ?? 0)}
      </td>
      <td className="px-4 py-3 text-right tnum text-zinc-700 dark:text-zinc-300">
        {compactCount(row.commentsCount ?? 0)}
      </td>
      <td className="px-4 py-3">
        {row.isHidden ? (
          <Badge variant="warning" size="sm">
            <EyeOff className="mr-1 size-3" aria-hidden="true" />
            Hidden
          </Badge>
        ) : (
          <Badge variant="success" size="sm">
            Visible
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <Dropdown
          align="end"
          width="w-56"
          trigger={
            <IconButton
              icon={MoreHorizontal}
              variant="ghost"
              size="sm"
              aria-label="Post actions"
            />
          }
          items={items}
        />
      </td>
    </tr>
  );
}

function PostCardRow({ row, onToggleHidden, onDelete }) {
  const author = row.author || {};
  const preview = row.content
    ? truncate(row.content, 140)
    : "(empty post)";

  return (
    <li
      className={cn(
        "px-4 py-4",
        row.isHidden && "bg-zinc-50/60 dark:bg-zinc-900/40"
      )}
    >
      <div className="flex items-start gap-3">
        <PostThumb url={row.image?.url} alt={preview} />
        <div className="min-w-0 flex-1 space-y-2">
          <Link
            to={`/posts/${row._id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "block text-sm hover:underline",
              row.isHidden
                ? "text-zinc-500 line-through dark:text-zinc-400"
                : "text-zinc-900 dark:text-zinc-50"
            )}
          >
            {preview}
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <Avatar
                src={author.avatar?.url}
                name={author.name}
                username={author.username}
                size="xs"
              />
              @{author.username || "deleted"}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tnum">{formatRelative(row.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 tnum">
              <Heart className="size-3" aria-hidden="true" />
              {compactCount(row.likesCount ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1 tnum">
              <MessageCircle className="size-3" aria-hidden="true" />
              {compactCount(row.commentsCount ?? 0)}
            </span>
            {row.isHidden && (
              <Badge variant="warning" size="sm">
                Hidden
              </Badge>
            )}
          </div>
        </div>
        <Dropdown
          align="end"
          width="w-56"
          trigger={
            <IconButton
              icon={MoreHorizontal}
              variant="ghost"
              size="sm"
              aria-label="Post actions"
            />
          }
          items={[
            {
              key: "view",
              label: "Open in new tab",
              icon: ExternalLink,
              onClick: () => window.open(`/posts/${row._id}`, "_blank"),
            },
            {
              key: "toggle",
              label: row.isHidden ? "Show post" : "Hide post",
              icon: row.isHidden ? Eye : EyeOff,
              onClick: () => onToggleHidden(row),
            },
            { divider: true },
            {
              key: "delete",
              label: "Delete post",
              icon: Trash2,
              danger: true,
              onClick: () => onDelete(row),
            },
          ]}
        />
      </div>
    </li>
  );
}
