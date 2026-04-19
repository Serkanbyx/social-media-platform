import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  EyeOff,
  Heart,
  MessageSquare,
  Newspaper,
  Sparkles,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import Avatar from "../../components/ui/Avatar.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";

import { useAuth } from "../../context/useAuth.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.js";

import * as adminService from "../../services/adminService.js";
import compactCount from "../../utils/formatCount.js";
import { cn } from "../../utils/cn.js";

/**
 * AdminDashboard — overview screen for the admin panel (STEP 36).
 *
 * Single round-trip via `getDashboardStats`: the backend already
 * `Promise.all`s every count + leaderboard query, so we keep the page
 * "render once" and skip incremental loaders. A failure renders a
 * Banner with a "Tekrar dene" action so the moderator never sits in
 * front of an empty page wondering whether the server is down.
 *
 * The greeting uses the signed-in admin's first name when available;
 * the AdminRoute guard guarantees `user` is present here, so we can
 * read it without optional-chain spaghetti.
 */

const STAT_GRID_SKELETON = 8;

const STATS_FALLBACK = {
  users: { total: 0, active: 0, newLast7Days: 0 },
  posts: { total: 0, hidden: 0, newLast7Days: 0 },
  comments: { total: 0 },
  likes: { total: 0 },
  topUsers: [],
};

const STAT_TONES = {
  brand:
    "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300",
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  sky:
    "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  amber:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  rose:
    "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  violet:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  zinc:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const firstName = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
};

export default function AdminDashboard() {
  useDocumentTitle("Yönetim · Panel");

  const { user } = useAuth();

  const [stats, setStats] = useState(STATS_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminService.getDashboardStats();
      setStats(data?.stats || STATS_FALLBACK);
    } catch {
      setError("Panel verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const greetingName = firstName(user?.name) || user?.username || "moderatör";

  const cards = [
    {
      key: "users-total",
      label: "Toplam kullanıcı",
      value: stats.users.total,
      icon: Users,
      tone: "brand",
    },
    {
      key: "users-active",
      label: "Aktif kullanıcı",
      value: stats.users.active,
      icon: UserCheck,
      tone: "emerald",
    },
    {
      key: "posts-total",
      label: "Toplam gönderi",
      value: stats.posts.total,
      icon: Newspaper,
      tone: "sky",
    },
    {
      key: "posts-hidden",
      label: "Gizlenmiş gönderi",
      value: stats.posts.hidden,
      icon: EyeOff,
      tone: stats.posts.hidden > 0 ? "rose" : "zinc",
    },
    {
      key: "comments-total",
      label: "Toplam yorum",
      value: stats.comments.total,
      icon: MessageSquare,
      tone: "violet",
    },
    {
      key: "likes-total",
      label: "Toplam beğeni",
      value: stats.likes.total,
      icon: Heart,
      tone: "rose",
    },
    {
      key: "posts-7d",
      label: "Son 7 günde gönderi",
      value: stats.posts.newLast7Days,
      icon: Sparkles,
      tone: "amber",
    },
    {
      key: "users-7d",
      label: "Son 7 günde kullanıcı",
      value: stats.users.newLast7Days,
      icon: UserPlus,
      tone: "emerald",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Tekrar hoş geldin, <span className="font-medium text-zinc-700 dark:text-zinc-200">{greetingName}</span>.
        </p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Genel bakış
        </h2>
      </header>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={fetchStats}>
            Tekrar dene
          </Button>
        </div>
      )}

      <section
        aria-label="Özet istatistikler"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        {loading
          ? Array.from({ length: STAT_GRID_SKELETON }).map((_, idx) => (
              <StatCardSkeleton key={`stat-skel-${idx}`} />
            ))
          : cards.map((card) => <StatCard key={card.key} {...card} />)}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopUsersPanel users={stats.topUsers} loading={loading} />
        <RecentActivityPanel />
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function StatCard({ label, value, icon: Icon, tone = "zinc" }) {
  return (
    <Card padding="md" className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-lg",
          STAT_TONES[tone] || STAT_TONES.zinc
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 tnum dark:text-zinc-50">
          {compactCount(value)}
        </p>
      </div>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card padding="md" className="flex items-start gap-3">
      <Skeleton className="size-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton height={10} width="60%" />
        <Skeleton height={20} width="40%" />
      </div>
    </Card>
  );
}

function TopUsersPanel({ users, loading }) {
  return (
    <Card padding="md">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          <Trophy className="size-4 text-amber-500" aria-hidden="true" />
          Takipçisi en çok olan kullanıcılar
        </h3>
        <Link
          to="/admin/users"
          className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Hepsini gör
        </Link>
      </header>

      {loading ? (
        <ul className="space-y-3" aria-busy="true">
          {Array.from({ length: 5 }).map((_, idx) => (
            <li key={idx} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton height={10} width="50%" />
                <Skeleton height={8} width="30%" />
              </div>
              <Skeleton height={10} width={40} />
            </li>
          ))}
        </ul>
      ) : users.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Henüz gösterilecek kullanıcı yok.
        </p>
      ) : (
        <ol className="space-y-2">
          {users.map((person, index) => (
            <li
              key={person._id}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-fast hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-2xs font-semibold text-zinc-600 tnum dark:bg-zinc-800 dark:text-zinc-300"
              >
                {index + 1}
              </span>
              <Avatar
                src={person.avatar?.url}
                name={person.name}
                username={person.username}
                size="sm"
              />
              <Link
                to={`/u/${person.username}`}
                className="flex min-w-0 flex-1 flex-col"
              >
                <span className="truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                  {person.name || `@${person.username}`}
                </span>
                <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  @{person.username}
                </span>
              </Link>
              <span className="shrink-0 text-xs font-semibold text-zinc-700 tnum dark:text-zinc-200">
                {compactCount(person.followersCount ?? 0)} takipçi
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function RecentActivityPanel() {
  return (
    <Card padding="md">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Son etkinlikler
        </h3>
        <span className="text-2xs font-semibold uppercase tracking-wide text-zinc-400">
          Yakında
        </span>
      </header>
      <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Moderasyon hareketleri (gizleme, silme, rol değişikliği) burada
        zaman çizelgesi olarak listelenecek.
      </p>
    </Card>
  );
}
