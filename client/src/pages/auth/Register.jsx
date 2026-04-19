import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../context/useAuth.js";
import AuthShell from "../../components/layout/AuthShell.jsx";
import Banner from "../../components/ui/Banner.jsx";
import PasswordInput from "../../components/ui/PasswordInput.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const FALLBACK_ERROR = "Couldn't create your account. Please try again.";

const sanitizeUsername = (raw) =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);

/**
 * Score a password 0–5 against rules that mirror the server validator
 * (`server/validators/authValidator.js`) plus a couple of UX bonuses
 * (symbol, length≥12) so the meter rewards stronger inputs without
 * lying about the minimum requirement.
 */
const scorePassword = (pw) => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Za-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return score;
};

const STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"];
const STRENGTH_COLORS = [
  "bg-zinc-200 dark:bg-zinc-800",
  "bg-rose-500",
  "bg-amber-500",
  "bg-amber-400",
  "bg-emerald-500",
  "bg-emerald-600",
];

function StrengthMeter({ score }) {
  const colorClass = STRENGTH_COLORS[score] ?? STRENGTH_COLORS[0];
  const filled = Math.max(score, 0);

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={[
              "h-1.5 flex-1 rounded-full transition-colors duration-fast",
              i < filled ? colorClass : "bg-zinc-200 dark:bg-zinc-800",
            ].join(" ")}
          />
        ))}
      </div>
      <p
        className="mt-1 text-2xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        aria-live="polite"
      >
        Password strength: {STRENGTH_LABELS[score] ?? STRENGTH_LABELS[0]}
      </p>
    </div>
  );
}

const initialFieldErrors = { name: "", username: "", email: "", password: "" };

const validateField = (field, value) => {
  switch (field) {
    case "name": {
      const trimmed = value.trim();
      if (!trimmed) return "Display name is required.";
      if (trimmed.length > 60) return "Display name can be at most 60 characters.";
      return "";
    }
    case "username": {
      if (!value) return "Username is required.";
      if (!USERNAME_REGEX.test(value))
        return "3–20 characters; lowercase letters, digits and underscore.";
      return "";
    }
    case "email": {
      if (!value.trim()) return "Email is required.";
      if (!EMAIL_REGEX.test(value.trim()))
        return "Enter a valid email address.";
      return "";
    }
    case "password": {
      if (!value) return "Password is required.";
      if (value.length < 8) return "Password must be at least 8 characters.";
      if (!/[A-Za-z]/.test(value) || !/\d/.test(value))
        return "Password must include at least one letter and one digit.";
      return "";
    }
    default:
      return "";
  }
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState(initialFieldErrors);
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordScore = useMemo(() => scorePassword(form.password), [form.password]);

  const allValid = useMemo(
    () =>
      Object.entries(form).every(
        ([field, value]) => validateField(field, value) === ""
      ),
    [form]
  );

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleBlur = (field) => () => {
    const message = validateField(field, form[field]);
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const handleServerError = (err) => {
    const data = err?.response?.data;
    const nextErrors = { ...initialFieldErrors };
    let banner = null;

    if (data?.errors && typeof data.errors === "object") {
      for (const [field, msg] of Object.entries(data.errors)) {
        if (field in nextErrors) nextErrors[field] = String(msg);
      }
      const hasFieldError = Object.values(nextErrors).some(Boolean);
      if (!hasFieldError) banner = data.message || FALLBACK_ERROR;
    } else if (Array.isArray(data?.errors)) {
      for (const item of data.errors) {
        const field = item?.field || item?.path;
        if (field && field in nextErrors) {
          nextErrors[field] = String(item.msg || item.message || "");
        }
      }
      const hasFieldError = Object.values(nextErrors).some(Boolean);
      if (!hasFieldError) banner = data.message || FALLBACK_ERROR;
    } else {
      banner = data?.message || FALLBACK_ERROR;
    }

    setFieldErrors(nextErrors);
    setServerError(banner);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = Object.fromEntries(
      Object.entries(form).map(([field, value]) => [
        field,
        validateField(field, value),
      ])
    );
    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    setServerError(null);

    try {
      const user = await register({
        name: form.name.trim(),
        username: form.username,
        email: form.email.trim(),
        password: form.password,
      });
      toast.success(`Welcome, ${user?.name || user?.username || "to Pulse"}!`);
      navigate("/", { replace: true });
    } catch (err) {
      handleServerError(err);
      setSubmitting(false);
    }
  };

  const inputClass = (hasError) =>
    [
      "block w-full rounded-md border bg-white py-2.5 text-sm text-zinc-900 shadow-xs transition-colors duration-fast",
      "placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none",
      "dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400",
      hasError
        ? "border-rose-300 dark:border-rose-800"
        : "border-zinc-200 dark:border-zinc-800",
    ].join(" ");

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join Pulse in just a few seconds."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Sign in
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
            htmlFor="reg-name"
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Display name
          </label>
          <input
            id="reg-name"
            name="name"
            type="text"
            autoComplete="name"
            autoFocus
            required
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            onBlur={handleBlur("name")}
            placeholder="Your name"
            aria-invalid={fieldErrors.name ? "true" : undefined}
            aria-describedby={
              fieldErrors.name ? "reg-name-error" : "reg-name-helper"
            }
            className={`${inputClass(Boolean(fieldErrors.name))} px-3`}
          />
          {fieldErrors.name ? (
            <p
              id="reg-name-error"
              className="mt-1.5 text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.name}
            </p>
          ) : (
            <p
              id="reg-name-helper"
              className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400"
            >
              This is how others will see you.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="reg-username"
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Username
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-zinc-400"
            >
              @
            </span>
            <input
              id="reg-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={form.username}
              onChange={(e) => setField("username", sanitizeUsername(e.target.value))}
              onBlur={handleBlur("username")}
              placeholder="username"
              aria-invalid={fieldErrors.username ? "true" : undefined}
              aria-describedby={
                fieldErrors.username
                  ? "reg-username-error"
                  : "reg-username-helper"
              }
              className={`${inputClass(Boolean(fieldErrors.username))} pl-7 pr-3`}
            />
          </div>
          {fieldErrors.username ? (
            <p
              id="reg-username-error"
              className="mt-1.5 text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.username}
            </p>
          ) : (
            <p
              id="reg-username-helper"
              className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400"
            >
              Lowercase letters, digits and underscore. 3–20 characters.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="reg-email"
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Email
          </label>
          <input
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            onBlur={handleBlur("email")}
            placeholder="you@example.com"
            aria-invalid={fieldErrors.email ? "true" : undefined}
            aria-describedby={fieldErrors.email ? "reg-email-error" : undefined}
            className={`${inputClass(Boolean(fieldErrors.email))} px-3`}
          />
          {fieldErrors.email && (
            <p
              id="reg-email-error"
              className="mt-1.5 text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <PasswordInput
            id="reg-password"
            name="password"
            label="Password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            onBlur={handleBlur("password")}
            placeholder="At least 8 characters"
            errorText={fieldErrors.password || undefined}
            helperText="At least 8 characters, including a letter and a digit."
          />
          <StrengthMeter score={passwordScore} />
        </div>

        <button
          type="submit"
          disabled={!allValid || submitting}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition-colors duration-fast hover:bg-brand-700 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          {submitting ? (
            <>
              <Spinner size="sm" className="!text-white" />
              <span>Creating account…</span>
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
