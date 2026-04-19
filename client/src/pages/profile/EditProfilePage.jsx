import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AtSign,
  Check,
  ChevronRight,
  ImageUp,
  Trash2,
  User as UserIcon,
} from "lucide-react";

import Avatar from "../../components/ui/Avatar.jsx";
import Banner from "../../components/ui/Banner.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import CharacterCounter from "../../components/ui/CharacterCounter.jsx";
import ConfirmModal from "../../components/ui/ConfirmModal.jsx";
import Input from "../../components/ui/Input.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import Textarea from "../../components/ui/Textarea.jsx";

import { useAuth } from "../../context/useAuth.js";

import useDocumentTitle from "../../hooks/useDocumentTitle.js";
import useUnsavedChangesPrompt from "../../hooks/useUnsavedChangesPrompt.js";

import * as uploadService from "../../services/uploadService.js";
import * as userService from "../../services/userService.js";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_AVATAR_MB,
  MAX_BIO,
  MAX_NAME,
  MAX_USERNAME,
} from "../../utils/constants.js";
import { cn } from "../../utils/cn.js";
import { notify } from "../../utils/notify.js";

/**
 * EditProfilePage — owner-only profile editor (STEP 32).
 *
 * Two independent sections share one page:
 *  1. Profile photo card — pick/preview/upload/remove, decoupled from
 *     the text form so a slow upload never blocks editing the bio.
 *  2. Profile info form  — name, username (@-prefixed), bio with live
 *     character counter and a live "Profile URL" preview row.
 *
 * Security & data discipline:
 *  - Only the three whitelisted fields (`name`, `username`, `bio`) are
 *    sent to `PATCH /users/me`. Email, role and counters are never even
 *    rendered as inputs here — that mirrors the server-side mass-
 *    assignment guard so the contract is symmetric.
 *  - A username change asks for explicit confirmation: it permanently
 *    rewrites the user's profile URL.
 *
 * Dirty-state guard:
 *  - `useUnsavedChangesPrompt` covers both the browser-level
 *    `beforeunload` warning and SPA navigation via React Router's
 *    `useBlocker`. The Cancel header button funnels through the same
 *    flow so all "leave the page" paths converge on one confirm.
 */

const USERNAME_REGEX = /^[a-z0-9_]+$/;
const USERNAME_MIN = 3;

const PROFILE_URL_PREFIX = "pulse.app/u/";

// Server-side validators escape every value with `escape()` (HTML-entity
// encode). When the API echoes the saved profile back, characters like
// `&` become `&amp;`. We decode on read so the text input shows what the
// user typed instead of the encoded form.
const decodeEntities = (value) => {
  if (typeof value !== "string" || value.length === 0) return "";
  if (typeof document === "undefined") return value;
  const el = document.createElement("textarea");
  el.innerHTML = value;
  return el.value;
};

const initialFormFromUser = (user) => ({
  name: decodeEntities(user?.name || ""),
  username: user?.username || "",
  bio: decodeEntities(user?.bio || ""),
});

const validateField = (key, value) => {
  const trimmed = (value || "").trim();
  switch (key) {
    case "name":
      if (trimmed.length === 0) return "Name can't be empty.";
      if (trimmed.length > MAX_NAME)
        return `Name must be at most ${MAX_NAME} characters.`;
      return "";
    case "username":
      if (trimmed.length < USERNAME_MIN)
        return `Username must be at least ${USERNAME_MIN} characters.`;
      if (trimmed.length > MAX_USERNAME)
        return `Username must be at most ${MAX_USERNAME} characters.`;
      if (!USERNAME_REGEX.test(trimmed))
        return "Only lowercase letters, digits, and underscores (_) are allowed.";
      return "";
    case "bio":
      if (trimmed.length > MAX_BIO)
        return `Bio must be at most ${MAX_BIO} characters.`;
      return "";
    default:
      return "";
  }
};

export default function EditProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  useDocumentTitle("Edit profile");

  if (!user) {
    return (
      <div
        className="flex items-center justify-center py-16"
        aria-busy="true"
        aria-label="Loading"
      >
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <EditProfileForm
      key={String(user._id)}
      user={user}
      updateUser={updateUser}
      navigate={navigate}
    />
  );
}

function EditProfileForm({ user, updateUser, navigate }) {
  // ---------- Photo section state ----------
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState(false);

  // ---------- Profile info state ----------
  const [form, setForm] = useState(() => initialFormFromUser(user));
  const [errors, setErrors] = useState({ name: "", username: "", bio: "" });
  const [saving, setSaving] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState(false);
  const [serverError, setServerError] = useState("");
  const [usernameConfirmOpen, setUsernameConfirmOpen] = useState(false);

  const [baseline, setBaseline] = useState(() => initialFormFromUser(user));

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
    },
    []
  );

  const setPreviewFromFile = useCallback((file) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    if (!file) {
      setPreviewUrl("");
      setSelectedFile(null);
      return;
    }
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setSelectedFile(file);
  }, []);

  const onPickPhoto = () => fileInputRef.current?.click();

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setPhotoError("Only JPG, PNG, WEBP or GIF formats are supported.");
      return;
    }
    const maxBytes = MAX_AVATAR_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setPhotoError(`Image is too large (max ${MAX_AVATAR_MB} MB).`);
      return;
    }

    setPhotoError("");
    setPreviewFromFile(file);
  };

  const cancelPhotoPreview = () => {
    setPreviewFromFile(null);
    setPhotoError("");
    setUploadProgress(0);
  };

  const savePhoto = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setUploadProgress(0);
    setPhotoError("");

    try {
      const formData = new FormData();
      formData.append("avatar", selectedFile);

      const data = await uploadService.uploadAvatar(formData, {
        onUploadProgress: (event) => {
          if (!event?.total) return;
          setUploadProgress(
            Math.min(100, Math.round((event.loaded * 100) / event.total))
          );
        },
      });

      const nextAvatar = data?.avatar || { url: "", publicId: "" };
      updateUser({ avatar: nextAvatar });

      setPreviewFromFile(null);
      setPhotoSuccess(true);
      window.setTimeout(() => setPhotoSuccess(false), 320);

      notify.success("Profile photo updated.");
    } catch (error) {
      const message =
        error?.response?.data?.message || "Couldn't upload photo.";
      setPhotoError(message);
      notify.error(message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removePhoto = async () => {
    if (removing || !user.avatar?.url) return;
    setRemoving(true);
    setPhotoError("");
    try {
      await uploadService.deleteAvatar();
      updateUser({ avatar: { url: "", publicId: "" } });
      setPreviewFromFile(null);
      notify.success("Profile photo removed.");
    } catch (error) {
      const message =
        error?.response?.data?.message || "Couldn't remove photo.";
      setPhotoError(message);
      notify.error(message);
    } finally {
      setRemoving(false);
    }
  };

  const handleFieldChange = (key) => (event) => {
    let nextValue = event.target.value;
    if (key === "username") {
      nextValue = nextValue.toLowerCase();
    }
    setForm((prev) => ({ ...prev, [key]: nextValue }));
    setErrors((prev) => ({ ...prev, [key]: validateField(key, nextValue) }));
    if (serverError) setServerError("");
  };

  const trimmedForm = useMemo(
    () => ({
      name: form.name.trim(),
      username: form.username.trim().toLowerCase(),
      bio: form.bio.trim(),
    }),
    [form]
  );

  const baselineTrimmed = useMemo(
    () => ({
      name: baseline.name.trim(),
      username: baseline.username.trim().toLowerCase(),
      bio: baseline.bio.trim(),
    }),
    [baseline]
  );

  const infoDirty =
    trimmedForm.name !== baselineTrimmed.name ||
    trimmedForm.username !== baselineTrimmed.username ||
    trimmedForm.bio !== baselineTrimmed.bio;

  const usernameChanged = trimmedForm.username !== baselineTrimmed.username;

  const liveErrors = useMemo(
    () => ({
      name: validateField("name", form.name),
      username: validateField("username", form.username),
      bio: validateField("bio", form.bio),
    }),
    [form]
  );

  const isFormValid =
    !liveErrors.name && !liveErrors.username && !liveErrors.bio;

  const canSubmit = isFormValid && infoDirty && !saving;

  const performSave = useCallback(async () => {
    setSaving(true);
    setServerError("");
    try {
      const payload = {};
      if (trimmedForm.name !== baselineTrimmed.name) payload.name = trimmedForm.name;
      if (trimmedForm.username !== baselineTrimmed.username) payload.username = trimmedForm.username;
      if (trimmedForm.bio !== baselineTrimmed.bio) payload.bio = trimmedForm.bio;

      const data = await userService.updateProfile(payload);

      const updated = data?.user || {};
      updateUser({
        name: decodeEntities(updated.name || trimmedForm.name),
        username: updated.username || trimmedForm.username,
        bio: decodeEntities(updated.bio || trimmedForm.bio),
      });
      const nextBaseline = {
        name: decodeEntities(updated.name || trimmedForm.name),
        username: updated.username || trimmedForm.username,
        bio: decodeEntities(updated.bio || trimmedForm.bio),
      };
      setBaseline(nextBaseline);
      setForm(nextBaseline);
      setErrors({ name: "", username: "", bio: "" });

      setInfoSuccess(true);
      window.setTimeout(() => setInfoSuccess(false), 320);

      notify.success("Profile updated.");
    } catch (error) {
      const status = error?.response?.status;
      const apiErrors = error?.response?.data?.errors;
      let message =
        error?.response?.data?.message || "Couldn't update profile.";

      if (status === 409) {
        message = "This username is already taken.";
        setErrors((prev) => ({ ...prev, username: message }));
      } else if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        const fieldMap = { name: "", username: "", bio: "" };
        apiErrors.forEach((entry) => {
          if (entry?.path && fieldMap[entry.path] !== undefined) {
            fieldMap[entry.path] = entry.msg || message;
          }
        });
        setErrors((prev) => ({ ...prev, ...fieldMap }));
        message = apiErrors[0]?.msg || message;
      }

      setServerError(message);
      notify.error(message);
    } finally {
      setSaving(false);
    }
  }, [
    baselineTrimmed.bio,
    baselineTrimmed.name,
    baselineTrimmed.username,
    trimmedForm.bio,
    trimmedForm.name,
    trimmedForm.username,
    updateUser,
  ]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    if (usernameChanged) {
      setUsernameConfirmOpen(true);
      return;
    }
    performSave();
  };

  const confirmUsernameChange = async () => {
    setUsernameConfirmOpen(false);
    await performSave();
  };

  const dirty = infoDirty || Boolean(selectedFile);
  const unsaved = useUnsavedChangesPrompt(dirty);

  const [cancelOpen, setCancelOpen] = useState(false);
  const profileHref = `/u/${user.username}`;

  const onClickCancel = () => {
    if (dirty) {
      setCancelOpen(true);
    } else {
      navigate(profileHref);
    }
  };

  const confirmCancel = () => {
    setPreviewFromFile(null);
    setForm(initialFormFromUser(user));
    setErrors({ name: "", username: "", bio: "" });
    setCancelOpen(false);
    window.setTimeout(() => navigate(profileHref), 0);
  };

  const hasAvatar = Boolean(user.avatar?.url);
  const showingPreview = Boolean(selectedFile);

  return (
    <>
      <div className="mx-auto max-w-xl space-y-6">
        {/* ----- Header ----- */}
        <header>
          <nav
            aria-label="Page location"
            className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
          >
            <Link
              to={profileHref}
              className="rounded-md transition-colors duration-fast hover:text-zinc-700 hover:underline dark:hover:text-zinc-200"
            >
              Profile
            </Link>
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <span className="text-zinc-700 dark:text-zinc-300">Edit</span>
          </nav>

          <div className="mt-2 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Edit profile
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClickCancel}
              disabled={uploading || saving || removing}
            >
              Cancel
            </Button>
          </div>
        </header>

        {/* ----- Section 1: Profile photo ----- */}
        <Card padding="lg" as="section" aria-labelledby="photo-heading">
          <h2
            id="photo-heading"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Profile photo
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            JPG, PNG, WEBP or GIF · max {MAX_AVATAR_MB} MB.
          </p>

          <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="relative">
              <div className="relative size-20 sm:size-24">
                <div
                  className={cn(
                    "absolute inset-0 transition-opacity ease-out",
                    showingPreview ? "opacity-0" : "opacity-100"
                  )}
                  style={{ transitionDuration: "180ms" }}
                >
                  <Avatar
                    src={user.avatar?.url}
                    name={user.name}
                    username={user.username}
                    size="xl"
                    className="size-20 sm:size-24"
                  />
                </div>
                <div
                  className={cn(
                    "absolute inset-0 transition-opacity ease-out",
                    showingPreview ? "opacity-100" : "opacity-0"
                  )}
                  style={{ transitionDuration: "180ms" }}
                >
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="New profile photo preview"
                      className="size-20 rounded-full object-cover ring-1 ring-zinc-200 sm:size-24 dark:ring-zinc-800"
                    />
                  )}
                </div>
              </div>

              {uploading && (
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-zinc-950/40 backdrop-blur-[1px]"
                  aria-hidden="true"
                >
                  <Spinner size="md" />
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {showingPreview ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={savePhoto}
                      loading={uploading}
                      leftIcon={photoSuccess ? Check : undefined}
                      disabled={uploading}
                    >
                      {photoSuccess
                        ? "Saved"
                        : uploading
                          ? "Uploading…"
                          : "Save"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelPhotoPreview}
                      disabled={uploading}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={ImageUp}
                      onClick={onPickPhoto}
                      disabled={removing}
                    >
                      Change photo
                    </Button>
                    {hasAvatar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={Trash2}
                        onClick={removePhoto}
                        loading={removing}
                        disabled={removing}
                        className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      >
                        Remove
                      </Button>
                    )}
                  </>
                )}
              </div>

              {uploading && (
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress}
                  aria-label="Upload progress"
                  className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                >
                  <div
                    className="h-full bg-brand-500 transition-[width] duration-base"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {photoError && (
                <p
                  role="alert"
                  className="text-xs font-medium text-rose-600 dark:text-rose-400"
                >
                  {photoError}
                </p>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            onChange={onFileChange}
            className="hidden"
            tabIndex={-1}
            aria-label="Choose profile photo"
          />
        </Card>

        {/* ----- Section 2: Profile info ----- */}
        <Card
          padding="lg"
          as="form"
          onSubmit={handleSubmit}
          aria-labelledby="info-heading"
          noValidate
        >
          <h2
            id="info-heading"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Profile info
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Edit your display name, username, and bio.
          </p>

          {serverError && (
            <Banner variant="danger" className="mt-4">
              {serverError}
            </Banner>
          )}

          <div className="mt-4 space-y-4">
            <Input
              label="Name"
              required
              type="text"
              value={form.name}
              onChange={handleFieldChange("name")}
              error={errors.name || undefined}
              helper={`1–${MAX_NAME} characters.`}
              leftAddon={<UserIcon className="size-4" aria-hidden="true" />}
              maxLength={MAX_NAME}
              autoComplete="name"
              disabled={saving}
            />

            <div>
              <Input
                label="Username"
                required
                type="text"
                inputMode="text"
                value={form.username}
                onChange={handleFieldChange("username")}
                error={errors.username || undefined}
                helper={`Lowercase letters, digits and _ only · ${USERNAME_MIN}–${MAX_USERNAME} characters.`}
                leftAddon={<AtSign className="size-4" aria-hidden="true" />}
                maxLength={MAX_USERNAME}
                autoComplete="username"
                spellCheck={false}
                disabled={saving}
              />
              <p
                aria-live="polite"
                className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate rounded-md bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <span className="text-zinc-400 dark:text-zinc-500">
                  Profile URL:
                </span>
                <span className="truncate font-medium text-zinc-700 dark:text-zinc-200">
                  {PROFILE_URL_PREFIX}
                  <span className="text-brand-600 dark:text-brand-400">
                    {trimmedForm.username || "username"}
                  </span>
                </span>
              </p>
            </div>

            <div>
              <Textarea
                label="Bio"
                value={form.bio}
                onChange={handleFieldChange("bio")}
                error={errors.bio || undefined}
                helper={`Briefly tell people about yourself · max ${MAX_BIO} characters.`}
                rows={4}
                autoResize
                maxHeight={240}
                maxLength={MAX_BIO}
                disabled={saving}
                placeholder="Introduce yourself in a few words…"
              />
              <div className="mt-1 flex justify-end">
                <CharacterCounter
                  value={form.bio}
                  max={MAX_BIO}
                  live={form.bio.length / MAX_BIO >= 0.8}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClickCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={saving}
              disabled={!canSubmit}
              leftIcon={infoSuccess ? Check : undefined}
            >
              {infoSuccess
                ? "Saved"
                : saving
                  ? "Saving…"
                  : "Save"}
            </Button>
          </div>
        </Card>
      </div>

      {/* ----- Username change confirmation ----- */}
      <ConfirmModal
        open={usernameConfirmOpen}
        title="Change username?"
        description={`Your profile link will move from @${baselineTrimmed.username} to @${trimmedForm.username}. Old links may no longer work.`}
        confirmLabel="Yes, change"
        cancelLabel="Cancel"
        onConfirm={confirmUsernameChange}
        onCancel={() => setUsernameConfirmOpen(false)}
      />

      {/* ----- Cancel-with-dirty-form confirmation ----- */}
      <ConfirmModal
        open={cancelOpen}
        title="Discard changes"
        description="Your unsaved changes will be lost. Do you want to continue?"
        confirmLabel="Discard and leave"
        cancelLabel="Keep editing"
        danger
        onConfirm={confirmCancel}
        onCancel={() => setCancelOpen(false)}
      />

      {/* ----- Router-level navigation guard ----- */}
      <ConfirmModal
        open={unsaved.open}
        title="You have unsaved changes"
        description="If you leave the page, your changes will be lost. Leave anyway?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        danger
        onConfirm={unsaved.confirmLeave}
        onCancel={unsaved.cancelLeave}
      />
    </>
  );
}
