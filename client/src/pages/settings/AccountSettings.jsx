import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Trash2 } from "lucide-react";

import Banner from "../../components/ui/Banner.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import PasswordInput from "../../components/ui/PasswordInput.jsx";
import Tooltip from "../../components/ui/Tooltip.jsx";

import SettingsSection from "../../components/settings/SettingsSection.jsx";
import PasswordStrengthMeter from "../../components/settings/PasswordStrengthMeter.jsx";

import { useAuth } from "../../context/AuthContext.jsx";
import * as authService from "../../services/authService.js";
import { isStrongEnough, scorePassword } from "../../utils/passwordStrength.js";
import notify from "../../utils/notify.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.js";

/**
 * AccountSettings — email read-out, change-password form, sign-out
 * everywhere placeholder, and the delete-account flow.
 *
 * Security choices echoed from the server contract:
 *  - Password change requires the current password (server enforces).
 *  - Delete account requires the username typed exactly AND the
 *    current password (server enforces password; username typing is
 *    pure client-side friction so a fat-finger Enter can't nuke the
 *    account).
 *
 * The delete confirmation deliberately uses the bare `Modal` rather
 * than `ConfirmModal` because the body needs interactive inputs.
 */

const FALLBACK_PW_ERROR = "Şifre güncellenemedi. Lütfen tekrar dene.";
const FALLBACK_DELETE_ERROR = "Hesap silinemedi. Lütfen tekrar dene.";

const initialPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function AccountSettings() {
  useDocumentTitle("Hesap · Ayarlar");

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ---------- Change password ----------
  const [pwForm, setPwForm] = useState(initialPasswordForm);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwFieldError, setPwFieldError] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const passwordScore = useMemo(
    () => scorePassword(pwForm.newPassword),
    [pwForm.newPassword]
  );

  const pwDirty =
    pwForm.currentPassword.length > 0 ||
    pwForm.newPassword.length > 0 ||
    pwForm.confirmPassword.length > 0;

  const pwValid =
    pwForm.currentPassword.length > 0 &&
    isStrongEnough(pwForm.newPassword) &&
    pwForm.newPassword === pwForm.confirmPassword &&
    pwForm.newPassword !== pwForm.currentPassword;

  const setPwField = (key, value) => {
    setPwForm((prev) => ({ ...prev, [key]: value }));
    if (pwFieldError[key]) {
      setPwFieldError((prev) => ({ ...prev, [key]: "" }));
    }
    if (pwError) setPwError("");
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (!pwValid || pwSaving) return;

    setPwSaving(true);
    setPwError("");
    setPwFieldError({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    try {
      await authService.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwForm(initialPasswordForm);
      notify.success("Şifren güncellendi.");
    } catch (error) {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.message || FALLBACK_PW_ERROR;
      if (status === 401) {
        setPwFieldError((prev) => ({
          ...prev,
          currentPassword: "Mevcut şifre yanlış.",
        }));
      } else if (status === 400) {
        setPwFieldError((prev) => ({
          ...prev,
          newPassword: message,
        }));
      } else {
        setPwError(message);
      }
    } finally {
      setPwSaving(false);
    }
  };

  // ---------- Delete account ----------
  const [deleteOpen, setDeleteOpen] = useState(false);
  const cancelDeleteRef = useRef(null);

  const onRequestDelete = useCallback(() => setDeleteOpen(true), []);
  const onCloseDelete = useCallback(() => setDeleteOpen(false), []);

  const onAccountDeleted = useCallback(() => {
    setDeleteOpen(false);
    logout();
    navigate("/login", { replace: true });
    notify.success("Hesabın silindi. Pulse'a olan katkıların için teşekkürler.");
  }, [logout, navigate]);

  return (
    <div className="space-y-6">
      <SettingsSection
        title="E-posta"
        description="Hesabın bu adres üzerinden tanımlanır. E-posta değişikliği henüz desteklenmiyor."
      >
        <Input
          type="email"
          value={user?.email || ""}
          readOnly
          aria-readonly="true"
          leftAddon={<Mail className="size-4" aria-hidden="true" />}
          rightAddon={
            <Tooltip content="E-posta değişikliği yakında">
              <span className="inline-flex size-7 items-center justify-center rounded-md text-zinc-400">
                <Lock className="size-3.5" aria-hidden="true" />
              </span>
            </Tooltip>
          }
          helper="E-posta adresini değiştirmek için yakında bir akış ekleyeceğiz."
        />
      </SettingsSection>

      <SettingsSection
        title="Şifreyi değiştir"
        description="Şifren en az 8 karakter olmalı ve harf + rakam içermelidir."
      >
        {pwError && (
          <Banner variant="danger" className="mb-4">
            {pwError}
          </Banner>
        )}

        <form
          onSubmit={handleChangePassword}
          noValidate
          className="space-y-4"
          autoComplete="off"
        >
          <PasswordInput
            id="acc-current-password"
            name="currentPassword"
            label="Mevcut şifre"
            autoComplete="current-password"
            required
            value={pwForm.currentPassword}
            onChange={(event) =>
              setPwField("currentPassword", event.target.value)
            }
            errorText={pwFieldError.currentPassword || undefined}
          />

          <div>
            <PasswordInput
              id="acc-new-password"
              name="newPassword"
              label="Yeni şifre"
              autoComplete="new-password"
              required
              value={pwForm.newPassword}
              onChange={(event) => setPwField("newPassword", event.target.value)}
              errorText={pwFieldError.newPassword || undefined}
              helperText="En az 8 karakter, harf ve rakam içermeli."
            />
            <PasswordStrengthMeter score={passwordScore} />
          </div>

          <PasswordInput
            id="acc-confirm-password"
            name="confirmPassword"
            label="Yeni şifre (tekrar)"
            autoComplete="new-password"
            required
            value={pwForm.confirmPassword}
            onChange={(event) =>
              setPwField("confirmPassword", event.target.value)
            }
            errorText={
              pwForm.confirmPassword &&
              pwForm.newPassword !== pwForm.confirmPassword
                ? "Şifreler eşleşmiyor."
                : pwFieldError.confirmPassword || undefined
            }
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                setPwForm(initialPasswordForm);
                setPwError("");
                setPwFieldError({
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                });
              }}
              disabled={!pwDirty || pwSaving}
            >
              Temizle
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={pwSaving}
              disabled={!pwValid || pwSaving}
            >
              {pwSaving ? "Kaydediliyor…" : "Şifreyi güncelle"}
            </Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Tüm cihazlardan çıkış"
        description="Diğer tüm cihazlardaki oturumları kapatır."
      >
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tüm cihazlardan tek seferde çıkış yapma desteği yakında geliyor.
          </p>
          <Tooltip content="Yakında">
            <span>
              <Button variant="secondary" size="md" disabled>
                Tüm cihazlardan çık
              </Button>
            </span>
          </Tooltip>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Hesabı sil"
        description="Profilini, gönderilerini, yorumlarını ve takiplerini kalıcı olarak siler. Bu işlem geri alınamaz."
        className="border-rose-200/80 dark:border-rose-900/60"
      >
        <div className="space-y-4">
          <Banner variant="danger">
            <div className="font-medium">Bu işlem geri alınamaz</div>
            <p className="mt-1 text-xs">
              Hesabını silmek; tüm gönderilerini, yorumlarını, beğenilerini,
              takiplerini ve bildirimlerini kalıcı olarak kaldırır.
            </p>
          </Banner>

          <div className="flex justify-end">
            <Button
              variant="danger"
              size="md"
              leftIcon={Trash2}
              onClick={onRequestDelete}
            >
              Hesabı sil…
            </Button>
          </div>
        </div>
      </SettingsSection>

      <DeleteAccountModal
        open={deleteOpen}
        onClose={onCloseDelete}
        username={user?.username || ""}
        onDeleted={onAccountDeleted}
        cancelRef={cancelDeleteRef}
      />
    </div>
  );
}

function DeleteAccountModal({ open, onClose, username, onDeleted, cancelRef }) {
  // Only mount the inner form while the modal is open so reopening always
  // starts from a clean slate without an effect that resets state.
  if (!open) return null;
  return (
    <DeleteAccountModalContent
      onClose={onClose}
      username={username}
      onDeleted={onDeleted}
      cancelRef={cancelRef}
    />
  );
}

function DeleteAccountModalContent({ onClose, username, onDeleted, cancelRef }) {
  const [confirmName, setConfirmName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const usernameMatches = confirmName.trim().toLowerCase() === username;
  const canSubmit = usernameMatches && password.length > 0 && !busy;

  const handleDelete = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await authService.deleteAccount({ password });
      onDeleted();
    } catch (err) {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message || FALLBACK_DELETE_ERROR;
      if (status === 401) {
        setError("Şifre yanlış.");
      } else if (status === 403) {
        setError(message);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="Hesabı kalıcı olarak sil"
      description="Bu işlem geri alınamaz. Devam etmek için kullanıcı adını ve şifreni gir."
      size="md"
      initialFocusRef={cancelRef}
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button
            ref={cancelRef}
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            Vazgeç
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!canSubmit}
            leftIcon={Trash2}
            onClick={handleDelete}
          >
            {busy ? "Siliniyor…" : "Hesabı sil"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Banner variant="danger">
          <div className="font-medium">Tüm verilerin silinecek</div>
          <p className="mt-0.5 text-xs">
            Profilin, gönderilerin, yorumların, beğenilerin ve takiplerin
            kalıcı olarak kaldırılır.
          </p>
        </Banner>

        <Input
          label="Kullanıcı adını yaz"
          required
          value={confirmName}
          onChange={(event) => setConfirmName(event.target.value)}
          placeholder={username}
          autoComplete="off"
          spellCheck={false}
          helper={`Onaylamak için "${username}" yaz.`}
          error={
            confirmName && !usernameMatches
              ? "Kullanıcı adı eşleşmiyor."
              : undefined
          }
        />

        <PasswordInput
          id="delete-account-password"
          name="deleteAccountPassword"
          label="Mevcut şifren"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          errorText={error || undefined}
        />
      </div>
    </Modal>
  );
}
