import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Check,
  Image as ImageIcon,
  Smile,
  X,
} from "lucide-react";

import Avatar from "../ui/Avatar.jsx";
import Banner from "../ui/Banner.jsx";
import Button from "../ui/Button.jsx";
import CharacterCounter from "../ui/CharacterCounter.jsx";
import ConfirmModal from "../ui/ConfirmModal.jsx";
import IconButton from "../ui/IconButton.jsx";
import Popover from "../ui/Popover.jsx";
import Spinner from "../ui/Spinner.jsx";
import Tooltip from "../ui/Tooltip.jsx";

import { useAuth } from "../../context/useAuth.js";
import useAutoResizeTextarea from "../../hooks/useAutoResizeTextarea.js";
import useDebounce from "../../hooks/useDebounce.js";
import useLocalStorage from "../../hooks/useLocalStorage.js";

import * as postService from "../../services/postService.js";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_POST_CONTENT,
  MAX_POST_IMAGE_MB,
} from "../../utils/constants.js";
import { cn } from "../../utils/cn.js";
import { notify } from "../../utils/notify.js";

/**
 * CreatePostForm — composer used both inline at the top of the Feed and
 * on the standalone `/posts/new` page (STEP 27).
 *
 * Two render modes:
 *  - `variant="inline"`   collapses to a single avatar + faux-input row
 *                         and only expands into the full composer on
 *                         click/focus or when the user picks an image.
 *  - `variant="standalone"` always renders the expanded composer with a
 *                         Cancel button and a "Discard draft?" confirm.
 *
 * Image attachments are validated client-side (MIME + size) BEFORE
 * upload — purely as a UX shortcut; the server is the source of truth
 * (multer enforces the same allowlist and 5 MB cap, see STEP 19).
 *
 * Drafts: textarea content is autosaved to localStorage debounced 500ms
 * so an accidental refresh doesn't nuke a long draft. The image itself
 * is intentionally NOT persisted (privacy + storage cost).
 */

const DRAFT_KEY = "draft:post";
const DRAFT_INITIAL = { content: "" };

const PLACEHOLDERS = [
  "Bir şeyler paylaş…",
  "Neler oluyor?",
  "Aklından ne geçiyor?",
];

const QUICK_EMOJIS = [
  "😀", "😂", "🥰", "😍", "🤔", "🙏", "🔥", "✨",
  "🎉", "🚀", "💯", "👍", "❤️", "😎", "👀", "🥳",
];

const pickPlaceholder = () =>
  PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)];

export default function CreatePostForm({
  variant = "inline",
  onCreated,
  onCancel,
  className = "",
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStandalone = variant === "standalone";

  const [draft, setDraft, removeDraft] = useLocalStorage(
    DRAFT_KEY,
    DRAFT_INITIAL
  );

  const [expanded, setExpanded] = useState(isStandalone);
  const [content, setContent] = useState(() => draft?.content || "");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showRestored, setShowRestored] = useState(
    () => !!draft?.content && draft.content.trim().length > 0
  );
  const [discardOpen, setDiscardOpen] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);
  const objectUrlRef = useRef("");
  // Pin a single placeholder per mount so it doesn't flicker on every keystroke.
  const placeholder = useMemo(() => pickPlaceholder(), []);

  const formId = useId();
  const errorId = `${formId}-error`;

  useAutoResizeTextarea(textareaRef, content, { maxHeight: 320 });

  // Autosave — debounced so we don't thrash localStorage on every keystroke.
  const debouncedContent = useDebounce(content, 500);
  useEffect(() => {
    setDraft({ content: debouncedContent || "" });
  }, [debouncedContent, setDraft]);

  // Move keyboard focus into the textarea once the composer expands so
  // a single tap on the inline composer goes straight into typing.
  useEffect(() => {
    if (!expanded || isStandalone) return undefined;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [expanded, isStandalone]);

  // Revoke any blob URL the component created. Prevents the "previous
  // image flashes back" bug on hot reload + plugs an obvious memory leak.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = "";
      }
    };
  }, []);

  const setAttachment = useCallback((nextFile) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
    if (nextFile) {
      const url = URL.createObjectURL(nextFile);
      objectUrlRef.current = url;
      setPreviewUrl(url);
      setFile(nextFile);
    } else {
      setPreviewUrl("");
      setFile(null);
    }
  }, []);

  const validateFile = useCallback((candidate) => {
    if (!candidate) return "Geçersiz dosya.";
    if (!ALLOWED_IMAGE_TYPES.includes(candidate.type)) {
      return "Yalnızca JPG, PNG, WEBP veya GIF formatları desteklenir.";
    }
    const maxBytes = MAX_POST_IMAGE_MB * 1024 * 1024;
    if (candidate.size > maxBytes) {
      return `Görsel çok büyük (en fazla ${MAX_POST_IMAGE_MB} MB).`;
    }
    return "";
  }, []);

  const handleFiles = useCallback(
    (fileList) => {
      const candidate = fileList?.[0];
      if (!candidate) return;
      const error = validateFile(candidate);
      if (error) {
        setFileError(error);
        return;
      }
      setFileError("");
      setAttachment(candidate);
    },
    [setAttachment, validateFile]
  );

  const onPickClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = (event) => {
    handleFiles(event.target.files);
    // Reset so picking the same file twice still fires `change`.
    event.target.value = "";
  };

  const onRemoveAttachment = () => {
    setAttachment(null);
    setFileError("");
    setUploadProgress(0);
  };

  // Drag-and-drop is wired on the form root. We track entries with a
  // counter so child element transitions (e.g. dragging over the
  // textarea inside the form) don't flicker the overlay off.
  const isFileDrag = (event) =>
    Array.from(event.dataTransfer?.types || []).includes("Files");

  const onDragEnter = (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragCounterRef.current += 1;
    setDragActive(true);
  };

  const onDragOver = (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
  };

  const onDragLeave = (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragActive(false);
  };

  const onDrop = (event) => {
    event.preventDefault();
    dragCounterRef.current = 0;
    setDragActive(false);
    const dropped = event.dataTransfer?.files;
    if (dropped && dropped.length > 0) handleFiles(dropped);
  };

  const trimmed = content.trim();
  const overLimit = trimmed.length > MAX_POST_CONTENT;
  const charPercent =
    MAX_POST_CONTENT > 0 ? trimmed.length / MAX_POST_CONTENT : 0;
  const announceCounter = charPercent >= 0.8;

  const canSubmit =
    !submitting &&
    !success &&
    !overLimit &&
    (trimmed.length > 0 || Boolean(file));

  const resetComposer = useCallback(() => {
    setContent("");
    setAttachment(null);
    setFileError("");
    setServerError("");
    setUploadProgress(0);
    setShowRestored(false);
    removeDraft();
  }, [removeDraft, setAttachment]);

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.();
      if (!canSubmit) return;

      setSubmitting(true);
      setServerError("");
      setUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append("content", trimmed);
        if (file) formData.append("image", file);

        const data = await postService.createPost(formData, {
          onUploadProgress: (progress) => {
            if (!progress?.total) return;
            setUploadProgress(
              Math.min(100, Math.round((progress.loaded * 100) / progress.total))
            );
          },
        });

        // Brief checkmark flash on the submit button.
        setSuccess(true);
        window.setTimeout(() => setSuccess(false), 320);

        const created = data?.post || data;
        resetComposer();
        if (!isStandalone) setExpanded(false);

        notify.success("Gönderi paylaşıldı.");
        onCreated?.(created);

        if (isStandalone) navigate("/");
      } catch (error) {
        const errors = error?.response?.data?.errors;
        if (Array.isArray(errors) && errors.length > 0) {
          setServerError(
            errors
              .map((entry) => entry?.msg)
              .filter(Boolean)
              .join(" ")
          );
        } else {
          setServerError(
            error?.response?.data?.message || "Gönderi paylaşılamadı."
          );
        }
        notify.error("Gönderi paylaşılamadı.");
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, file, isStandalone, navigate, onCreated, resetComposer, trimmed]
  );

  const onKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  };

  const requestCancel = () => {
    if (trimmed.length > 0 || file) {
      setDiscardOpen(true);
      return;
    }
    finalizeCancel();
  };

  const finalizeCancel = () => {
    setDiscardOpen(false);
    resetComposer();
    if (typeof onCancel === "function") onCancel();
    else navigate(-1);
  };

  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + emoji.length;
      try {
        el.setSelectionRange(cursor, cursor);
      } catch {
        // Some browsers throw on programmatic selection in detached nodes.
      }
    });
  };

  if (!user) return null;

  // ----- Hidden file input (shared by every code path) -----
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={ALLOWED_IMAGE_TYPES.join(",")}
      onChange={onFileChange}
      className="hidden"
      tabIndex={-1}
      aria-label="Görsel ekle"
    />
  );

  // ----- Inline collapsed view -----
  if (!expanded) {
    const firstName = user.name?.split(" ")[0] || user.username;
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors duration-fast hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700",
          className
        )}
      >
        <Avatar
          src={user.avatar?.url}
          name={user.name}
          username={user.username}
          size="sm"
        />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex-1 cursor-text rounded-full bg-zinc-100 px-4 py-2 text-left text-sm text-zinc-500 transition-colors duration-fast hover:bg-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/70"
        >
          {`${firstName}, aklından ne geçiyor?`}
        </button>
        <Tooltip content="Görsel ekle">
          <IconButton
            icon={ImageIcon}
            aria-label="Görsel ekle"
            variant="ghost"
            size="sm"
            onClick={() => {
              setExpanded(true);
              // Mount the file input first by deferring to the next tick.
              window.setTimeout(() => fileInputRef.current?.click(), 0);
            }}
          />
        </Tooltip>
        {fileInput}
      </div>
    );
  }

  // ----- Expanded composer -----
  return (
    <>
      <form
        onSubmit={handleSubmit}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-busy={submitting || undefined}
        className={cn(
          "relative rounded-xl border border-zinc-200 bg-white p-4 transition-colors duration-fast motion-safe:animate-fade-up dark:border-zinc-800 dark:bg-zinc-900",
          className
        )}
      >
        {showRestored && (
          <Banner
            variant="info"
            className="mb-3"
            onDismiss={() => setShowRestored(false)}
          >
            Önceki taslağın geri yüklendi.
          </Banner>
        )}

        <div className="flex gap-3">
          <Avatar
            src={user.avatar?.url}
            name={user.name}
            username={user.username}
            size="md"
          />

          <div className="min-w-0 flex-1">
            <label htmlFor={`${formId}-content`} className="sr-only">
              Gönderi içeriği
            </label>
            <textarea
              id={`${formId}-content`}
              ref={textareaRef}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              rows={isStandalone ? 4 : 2}
              maxLength={MAX_POST_CONTENT}
              disabled={submitting}
              aria-invalid={overLimit || Boolean(serverError) || undefined}
              aria-describedby={serverError ? errorId : undefined}
              className="block max-h-80 min-h-24 w-full resize-none overflow-auto border-0 bg-transparent text-base leading-relaxed text-zinc-900 placeholder:text-zinc-500 focus:outline-none disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />

            {previewUrl && (
              <div className="relative mt-3 inline-block motion-safe:animate-fade-up">
                <div className="relative aspect-[4/5] w-full max-w-sm overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                  <img
                    src={previewUrl}
                    alt="Eklenen görsel önizlemesi"
                    className={cn(
                      "size-full object-cover transition-opacity duration-base",
                      submitting ? "opacity-60" : "opacity-100"
                    )}
                  />
                  {submitting && (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Spinner size="lg" />
                      </div>
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={uploadProgress}
                        aria-label="Yükleme ilerlemesi"
                        className="absolute bottom-0 left-0 right-0 h-1.5 overflow-hidden bg-black/30"
                      >
                        <div
                          className="h-full bg-brand-500 transition-[width] duration-base"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
                {!submitting && (
                  <button
                    type="button"
                    onClick={onRemoveAttachment}
                    aria-label="Görseli kaldır"
                    className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-zinc-900/70 text-white backdrop-blur-sm transition-colors duration-fast hover:bg-zinc-900/85"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {fileError && (
              <p
                role="alert"
                className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400"
              >
                {fileError}
              </p>
            )}
            {serverError && (
              <p
                id={errorId}
                role="alert"
                className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400"
              >
                {serverError}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Tooltip content="Görsel ekle">
                  <IconButton
                    icon={ImageIcon}
                    aria-label="Görsel ekle"
                    variant="brand"
                    size="sm"
                    onClick={onPickClick}
                    disabled={submitting}
                  />
                </Tooltip>

                <Popover
                  align="start"
                  width="w-64"
                  trigger={
                    <IconButton
                      icon={Smile}
                      aria-label="Emoji ekle"
                      variant="ghost"
                      size="sm"
                      disabled={submitting}
                    />
                  }
                >
                  {({ close }) => (
                    <div className="grid grid-cols-8 gap-1 p-2">
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            insertEmoji(emoji);
                            close();
                          }}
                          aria-label={`Emoji ${emoji} ekle`}
                          className="flex size-8 items-center justify-center rounded-md text-lg transition-colors duration-fast hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </Popover>

                <Tooltip content="Yakında eklenecek">
                  <span className="inline-flex">
                    <IconButton
                      icon={BarChart3}
                      aria-label="Anket oluştur (yakında)"
                      variant="ghost"
                      size="sm"
                      disabled
                    />
                  </span>
                </Tooltip>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <CharacterCounter
                  value={trimmed}
                  max={MAX_POST_CONTENT}
                  live={announceCounter}
                />

                {isStandalone && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={requestCancel}
                    disabled={submitting}
                  >
                    Vazgeç
                  </Button>
                )}

                <Tooltip content="Cmd/Ctrl + Enter ile paylaş">
                  <Button
                    type="submit"
                    variant="primary"
                    size={isStandalone ? "md" : "sm"}
                    loading={submitting}
                    disabled={!canSubmit}
                    leftIcon={success ? Check : undefined}
                  >
                    {success
                      ? "Paylaşıldı"
                      : submitting
                        ? "Paylaşılıyor…"
                        : "Paylaş"}
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Drag-and-drop overlay — only shown while a file is being dragged. */}
        {dragActive && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-brand-500 bg-brand-50/85 backdrop-blur-sm motion-safe:animate-fade-up dark:bg-brand-950/50"
          >
            <p className="text-base font-semibold text-brand-700 dark:text-brand-200">
              Eklemek için bırak
            </p>
          </div>
        )}

        {fileInput}
      </form>

      <ConfirmModal
        open={discardOpen}
        title="Taslağı sil"
        description="Henüz paylaşmadığın içerik silinecek. Devam etmek istiyor musun?"
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        danger
        onConfirm={finalizeCancel}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  );
}
