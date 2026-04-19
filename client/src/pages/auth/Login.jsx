import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/useAuth.js";
import AuthShell from "../../components/layout/AuthShell.jsx";
import Banner from "../../components/ui/Banner.jsx";
import PasswordInput from "../../components/ui/PasswordInput.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FALLBACK_ERROR = "Couldn't sign in. Please try again.";

const extractServerError = (err) => {
  const data = err?.response?.data;
  if (!data) return FALLBACK_ERROR;
  if (typeof data.errors === "object" && data.errors) {
    const first = Object.values(data.errors)[0];
    if (first) return String(first);
  }
  return data.message || FALLBACK_ERROR;
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = location.state?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  const canSubmit = useMemo(
    () => EMAIL_REGEX.test(email.trim()) && password.length > 0 && !submitting,
    [email, password, submitting]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setServerError(null);
    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(extractServerError(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your account and pick up where you left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Create one now
          </Link>
        </>
      }
    >
      {serverError && (
        <Banner variant="danger" className="mb-5" role="alert">
          {serverError}
        </Banner>
      )}

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-xs transition-colors duration-fast placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400"
          />
        </div>

        <PasswordInput
          id="login-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <div className="flex items-center justify-end">
          <span
            className="cursor-not-allowed text-xs text-zinc-400 dark:text-zinc-500"
            title="Coming soon"
            aria-disabled="true"
          >
            Forgot password
          </span>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition-colors duration-fast hover:bg-brand-700 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          {submitting ? (
            <>
              <Spinner size="sm" className="!text-white" />
              <span>Signing in…</span>
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
