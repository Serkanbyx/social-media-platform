import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Filter,
  MoreHorizontal,
  Shield,
  ShieldOff,
  Trash2,
  Users as UsersIcon,
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
import ToggleSwitch from "../../components/ui/ToggleSwitch.jsx";
import Tooltip from "../../components/ui/Tooltip.jsx";
import AdminTableRowSkeleton from "../../components/ui/skeletons/AdminTableRowSkeleton.jsx";

import { useAuth } from "../../context/useAuth.js";
import useDebounce from "../../hooks/useDebounce.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.js";

import * as adminService from "../../services/adminService.js";
import { ADMIN_PAGE_SIZE } from "../../services/adminService.js";
import compactCount from "../../utils/formatCount.js";
import { formatAbsolute } from "../../utils/formatDate.js";
import { cn } from "../../utils/cn.js";
import notify from "../../utils/notify.js";

/**
 * AdminUsers — moderation table for the user collection (STEP 36).
 *
 * Filtering / pagination contract:
 *  - `q`, `role`, `isActive` map 1:1 to the backend filters.
 *  - Search is debounced (350ms) and resets to page 1 on every change.
 *  - Pagination is page-based (server response includes totalPages).
 *
 * Mutations are optimistic where the server contract makes that safe:
 *  - role change & active toggle PATCH back the fresh user; we reflect
 *    the new value in local state immediately and roll back on error.
 *  - delete pops a confirm modal first (irreversible cascade).
 *
 * Self / last-admin protections are enforced server-side; the UI mirrors
 * them by disabling controls and surfacing a tooltip explaining why so
 * the admin doesn't waste a click on a guaranteed 400.
 */

const SEARCH_DEBOUNCE_MS = 350;

const ROLE_OPTIONS = [
  { value: "all", label: "All roles" },
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "true", label: "Active" },
  { value: "false", label: "Disabled" },
];

const ROW_COLUMNS = 7;

export default function AdminUsers() {
  useDocumentTitle("Admin · Users");

  const { user: viewer } = useAuth();
  const viewerId = viewer ? String(viewer._id) : "";

  // ---------- Filters ----------
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const debouncedSearch = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);

  const hasActiveFilters =
    debouncedSearch.length > 0 || role !== "all" || status !== "all";

  // ---------- Data ----------
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  // Filter changes always reset to page 1 — a moderator searching from page
  // 17 should not stay on page 17 of the new filter context. Doing it in
  // the change handlers (instead of an effect) avoids cascading renders.
  const handleSearchFilterChange = useCallback((next) => {
    setSearch(next);
    setPage(1);
  }, []);

  const handleRoleFilterChange = useCallback((next) => {
    setRole(next);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((next) => {
    setStatus(next);
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearch("");
    setRole("all");
    setStatus("all");
    setPage(1);
  }, []);

  const retryUsers = useCallback(() => {
    setLoading(true);
    setError("");
    setRetryToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminService.listUsers({
          page,
          limit: ADMIN_PAGE_SIZE,
          q: debouncedSearch || undefined,
          role: role === "all" ? undefined : role,
          isActive: status === "all" ? undefined : status,
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
        setError("Couldn't load users.");
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
  }, [debouncedSearch, page, role, status, retryToken]);

  // Track admin head-count locally so the UI can mirror the
  // "at least one active admin must remain" server rule. We only know
  // the admins on the *current page*, so the safest approximation is
  // "if there's a single active admin in the visible rows AND it's a
  // demote/disable, warn". The server is still authoritative.
  const activeAdminCount = useMemo(
    () => items.filter((u) => u.role === "admin" && u.isActive).length,
    [items]
  );

  // ---------- Mutations ----------
  const updateLocalUser = useCallback((id, patch) => {
    setItems((prev) =>
      prev.map((row) => (String(row._id) === String(id) ? { ...row, ...patch } : row))
    );
  }, []);

  // Role / status changes are persisted only after a confirm step. This
  // protects against the "menu fat-finger" failure where one stray click
  // would otherwise instantly promote, demote, disable or re-enable an
  // account. Optimistic UI still applies *after* the user confirms.
  const [pendingRoleChange, setPendingRoleChange] = useState(null);
  const closeRoleChange = useCallback(() => setPendingRoleChange(null), []);

  const requestRoleChange = useCallback((target, nextRole) => {
    if (!target || target.role === nextRole) return;
    setPendingRoleChange({ target, nextRole });
  }, []);

  const handleConfirmRoleChange = useCallback(async () => {
    if (!pendingRoleChange) return;
    const { target, nextRole } = pendingRoleChange;
    const previousRole = target.role;
    updateLocalUser(target._id, { role: nextRole });
    try {
      await adminService.updateUserRole(target._id, nextRole);
      notify.success(
        nextRole === "admin"
          ? `@${target.username} promoted to admin.`
          : `@${target.username} changed to user.`
      );
    } catch (err) {
      updateLocalUser(target._id, { role: previousRole });
      const message =
        err?.response?.data?.message || "Couldn't change role.";
      notify.error(message);
    } finally {
      closeRoleChange();
    }
  }, [closeRoleChange, pendingRoleChange, updateLocalUser]);

  const [pendingActiveToggle, setPendingActiveToggle] = useState(null);
  const closeActiveToggle = useCallback(() => setPendingActiveToggle(null), []);

  const requestActiveToggle = useCallback((target, nextActive) => {
    if (!target || target.isActive === nextActive) return;
    setPendingActiveToggle({ target, nextActive });
  }, []);

  const handleConfirmActiveToggle = useCallback(async () => {
    if (!pendingActiveToggle) return;
    const { target, nextActive } = pendingActiveToggle;
    const previousActive = target.isActive;
    updateLocalUser(target._id, { isActive: nextActive });
    try {
      await adminService.setUserActive(target._id, nextActive);
      notify.success(
        nextActive
          ? `@${target.username} re-enabled.`
          : `@${target.username} disabled.`
      );
    } catch (err) {
      updateLocalUser(target._id, { isActive: previousActive });
      const message =
        err?.response?.data?.message || "Couldn't change account status.";
      notify.error(message);
    } finally {
      closeActiveToggle();
    }
  }, [closeActiveToggle, pendingActiveToggle, updateLocalUser]);

  // ---------- Delete confirmation ----------
  const [pendingDelete, setPendingDelete] = useState(null);
  const closeDelete = useCallback(() => setPendingDelete(null), []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await adminService.deleteUser(pendingDelete._id);
      setItems((prev) => prev.filter((row) => row._id !== pendingDelete._id));
      setTotal((prev) => Math.max(0, prev - 1));
      notify.success(`@${pendingDelete.username} deleted.`);
      closeDelete();
    } catch (err) {
      const message =
        err?.response?.data?.message || "Couldn't delete user.";
      notify.error(message);
      closeDelete();
    }
  }, [closeDelete, pendingDelete]);

  // ---------- Render ----------
  return (
    <div className="space-y-4">
      <AdminFiltersBar
        search={search}
        onSearchChange={handleSearchFilterChange}
        searchPlaceholder="Search by username or name"
        searchAriaLabel="Search users"
        searchPending={search.trim() !== debouncedSearch}
        hasActiveFilters={hasActiveFilters}
        onReset={handleResetFilters}
        extras={
          <>
            <span
              className="hidden items-center gap-1 text-xs font-medium text-zinc-500 sm:inline-flex dark:text-zinc-400"
              aria-hidden="true"
            >
              <Filter className="size-3.5" />
              Filter
            </span>
            <AdminSelect
              label="Role"
              inline
              value={role}
              onChange={handleRoleFilterChange}
              options={ROLE_OPTIONS}
            />
            <AdminSelect
              label="Status"
              inline
              value={status}
              onChange={handleStatusFilterChange}
              options={STATUS_OPTIONS}
            />
          </>
        }
      />

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={retryUsers}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {/* ------------- Desktop table ------------- */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50/80 backdrop-blur dark:bg-zinc-900/80">
                <tr className="text-left text-2xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Posts</th>
                  <th className="px-4 py-3 text-right">Followers</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <AdminTableRowSkeleton
                      key={`u-skel-${idx}`}
                      columns={ROW_COLUMNS + 1}
                    />
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={ROW_COLUMNS + 1} className="px-4 py-12">
                      <EmptyState
                        icon={UsersIcon}
                        title={
                          hasActiveFilters
                            ? "No users match these filters"
                            : "No users found"
                        }
                        description={
                          hasActiveFilters
                            ? "Adjust your search or reset the filters."
                            : "There are no registered users yet."
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
                    <UserRow
                      key={row._id}
                      row={row}
                      viewerId={viewerId}
                      activeAdminCount={activeAdminCount}
                      onRoleChange={requestRoleChange}
                      onActiveToggle={requestActiveToggle}
                      onDelete={(target) => setPendingDelete(target)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ------------- Mobile / tablet card list ------------- */}
          <div className="lg:hidden">
            {loading ? (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <li key={`u-card-skel-${idx}`} className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title={
                  hasActiveFilters
                    ? "No users match these filters"
                    : "No users found"
                }
                description={
                  hasActiveFilters
                    ? "Adjust your search or reset the filters."
                    : "There are no registered users yet."
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
                  <UserCardRow
                    key={row._id}
                    row={row}
                    viewerId={viewerId}
                    activeAdminCount={activeAdminCount}
                    onRoleChange={requestRoleChange}
                    onActiveToggle={requestActiveToggle}
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
        open={Boolean(pendingRoleChange)}
        title={
          pendingRoleChange?.nextRole === "admin"
            ? "Promote to admin"
            : "Revoke admin access"
        }
        description={
          pendingRoleChange
            ? pendingRoleChange.nextRole === "admin"
              ? `Grant administrator privileges to @${pendingRoleChange.target.username}? They'll be able to moderate users, posts and comments.`
              : `Revoke administrator privileges from @${pendingRoleChange.target.username}? They'll lose access to the admin panel.`
            : ""
        }
        confirmLabel={
          pendingRoleChange?.nextRole === "admin" ? "Make admin" : "Revoke admin"
        }
        cancelLabel="Cancel"
        busyLabel="Saving…"
        danger={pendingRoleChange?.nextRole !== "admin"}
        onConfirm={handleConfirmRoleChange}
        onCancel={closeRoleChange}
      />

      <ConfirmModal
        open={Boolean(pendingActiveToggle)}
        title={
          pendingActiveToggle?.nextActive
            ? "Re-enable account"
            : "Disable account"
        }
        description={
          pendingActiveToggle
            ? pendingActiveToggle.nextActive
              ? `Re-enable @${pendingActiveToggle.target.username}? They'll regain access to sign in and post.`
              : `Disable @${pendingActiveToggle.target.username}? They won't be able to sign in until you re-enable the account.`
            : ""
        }
        confirmLabel={
          pendingActiveToggle?.nextActive ? "Re-enable" : "Disable account"
        }
        cancelLabel="Cancel"
        busyLabel="Saving…"
        danger={pendingActiveToggle?.nextActive === false}
        onConfirm={handleConfirmActiveToggle}
        onCancel={closeActiveToggle}
      />

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete user"
        description={
          pendingDelete
            ? `You're about to delete @${pendingDelete.username}. All of their posts, comments, follows and notifications will be permanently removed. This action cannot be undone.`
            : ""
        }
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

function useRowProtections(row, viewerId, activeAdminCount) {
  return useMemo(() => {
    const isSelf = viewerId && String(row._id) === viewerId;
    const isLastAdmin =
      row.role === "admin" && row.isActive && activeAdminCount <= 1;

    return {
      isSelf,
      isLastAdmin,
      cannotChangeRole: isSelf || isLastAdmin,
      cannotDisable: isSelf || isLastAdmin,
      cannotDelete: isSelf || isLastAdmin,
      cannotChangeRoleReason: isSelf
        ? "You can't change your own role."
        : isLastAdmin
          ? "At least one active admin must remain."
          : "",
      cannotDisableReason: isSelf
        ? "You can't disable your own account."
        : isLastAdmin
          ? "You can't disable the last active admin."
          : "",
      cannotDeleteReason: isSelf
        ? "You can't delete your own account."
        : isLastAdmin
          ? "You can't delete the last active admin."
          : "",
    };
  }, [activeAdminCount, row._id, row.isActive, row.role, viewerId]);
}

function RoleBadge({ role }) {
  return role === "admin" ? (
    <Badge variant="brand" size="sm">
      <Shield className="mr-1 size-3" aria-hidden="true" />
      Admin
    </Badge>
  ) : (
    <Badge variant="default" size="sm">
      User
    </Badge>
  );
}

function StatusBadge({ active }) {
  return active ? (
    <Badge variant="success" size="sm">
      Active
    </Badge>
  ) : (
    <Badge variant="default" size="sm">
      Disabled
    </Badge>
  );
}

function RowActions({
  row,
  protections,
  onRoleChange,
  onActiveToggle,
  onDelete,
}) {
  const items = [
    {
      key: "toggle-role",
      label:
        row.role === "admin" ? "Revoke admin" : "Make admin",
      icon: row.role === "admin" ? ShieldOff : Shield,
      disabled: protections.cannotChangeRole,
      onClick: () =>
        onRoleChange(row, row.role === "admin" ? "user" : "admin"),
    },
    {
      key: "toggle-active",
      label: row.isActive ? "Disable account" : "Re-enable account",
      icon: row.isActive ? ShieldOff : Shield,
      disabled: protections.cannotDisable,
      onClick: () => onActiveToggle(row, !row.isActive),
    },
    { divider: true },
    {
      key: "delete",
      label: "Delete user",
      icon: Trash2,
      danger: true,
      disabled: protections.cannotDelete,
      onClick: () => onDelete(row),
    },
  ];

  return (
    <Dropdown
      align="end"
      width="w-56"
      trigger={
        <IconButton
          icon={MoreHorizontal}
          variant="ghost"
          size="sm"
          aria-label={`Actions for @${row.username}`}
        />
      }
      items={items}
    />
  );
}

function UserRow({
  row,
  viewerId,
  activeAdminCount,
  onRoleChange,
  onActiveToggle,
  onDelete,
}) {
  const protections = useRowProtections(row, viewerId, activeAdminCount);

  return (
    <tr
      className={cn(
        "border-t border-zinc-100 transition-colors duration-fast hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40",
        !row.isActive && "bg-zinc-50/50 dark:bg-zinc-900/40"
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar
            src={row.avatar?.url}
            name={row.name}
            username={row.username}
            size="sm"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <Link
                to={`/u/${row.username}`}
                className="truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
              >
                {row.name || `@${row.username}`}
              </Link>
              {protections.isSelf && (
                <Badge variant="info" size="sm">
                  You
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              @{row.username}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="block max-w-[18ch] truncate text-zinc-700 dark:text-zinc-300">
          {row.email}
        </span>
      </td>
      <td className="px-4 py-3">
        <Tooltip content={protections.cannotChangeRoleReason}>
          <span>
            <AdminSelect
              inline
              label="Role"
              value={row.role}
              disabled={protections.cannotChangeRole}
              onChange={(value) => onRoleChange(row, value)}
              options={[
                { value: "user", label: "User" },
                { value: "admin", label: "Admin" },
              ]}
            />
          </span>
        </Tooltip>
      </td>
      <td className="px-4 py-3">
        <Tooltip content={protections.cannotDisableReason}>
          <span className="inline-flex items-center gap-3">
            <ToggleSwitch
              checked={row.isActive}
              disabled={protections.cannotDisable}
              onChange={(next) => onActiveToggle(row, next)}
            />
            <StatusBadge active={row.isActive} />
          </span>
        </Tooltip>
      </td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
        <time dateTime={row.createdAt} className="tnum">
          {formatAbsolute(row.createdAt)}
        </time>
      </td>
      <td className="px-4 py-3 text-right tnum text-zinc-700 dark:text-zinc-300">
        {compactCount(row.postsCount ?? 0)}
      </td>
      <td className="px-4 py-3 text-right tnum text-zinc-700 dark:text-zinc-300">
        {compactCount(row.followersCount ?? 0)}
      </td>
      <td className="px-4 py-3 text-right">
        <RowActions
          row={row}
          protections={protections}
          onRoleChange={onRoleChange}
          onActiveToggle={onActiveToggle}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

function UserCardRow({
  row,
  viewerId,
  activeAdminCount,
  onRoleChange,
  onActiveToggle,
  onDelete,
}) {
  const protections = useRowProtections(row, viewerId, activeAdminCount);

  return (
    <li
      className={cn(
        "px-4 py-4",
        !row.isActive && "bg-zinc-50/60 dark:bg-zinc-900/40"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          src={row.avatar?.url}
          name={row.name}
          username={row.username}
          size="md"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              to={`/u/${row.username}`}
              className="truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
            >
              {row.name || `@${row.username}`}
            </Link>
            {protections.isSelf && (
              <Badge variant="info" size="sm">
                You
              </Badge>
            )}
            <RoleBadge role={row.role} />
            <StatusBadge active={row.isActive} />
          </div>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            @{row.username} · {row.email}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div>
              <dt className="text-2xs uppercase tracking-wide text-zinc-400">
                Posts
              </dt>
              <dd className="tnum text-zinc-800 dark:text-zinc-200">
                {compactCount(row.postsCount ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-wide text-zinc-400">
                Followers
              </dt>
              <dd className="tnum text-zinc-800 dark:text-zinc-200">
                {compactCount(row.followersCount ?? 0)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-2xs uppercase tracking-wide text-zinc-400">
                Joined
              </dt>
              <dd className="tnum text-zinc-800 dark:text-zinc-200">
                {formatAbsolute(row.createdAt)}
              </dd>
            </div>
          </dl>
        </div>
        <RowActions
          row={row}
          protections={protections}
          onRoleChange={onRoleChange}
          onActiveToggle={onActiveToggle}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}
