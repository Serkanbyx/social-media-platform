import { useCallback } from "react";
import { Lock, ShieldOff } from "lucide-react";

import ToggleSwitch from "../../components/ui/ToggleSwitch.jsx";
import SettingsSection from "../../components/settings/SettingsSection.jsx";
import SaveIndicator from "../../components/settings/SaveIndicator.jsx";

import { usePreferences } from "../../context/usePreferences.js";
import usePreferenceAutoSave from "../../hooks/usePreferenceAutoSave.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.js";

/**
 * PrivacySettings — controls that govern what other users can see about
 * the signed-in account. Every toggle is server-enforced (see
 * `userController.getUserByUsername` for the privacy gate); the UI here
 * only exposes the switches.
 */
export default function PrivacySettings() {
  useDocumentTitle("Privacy · Settings");

  const { preferences } = usePreferences();
  const { save, savedKey } = usePreferenceAutoSave();

  const onTogglePrivate = useCallback(
    (checked) => save("privacy.privateAccount", checked),
    [save]
  );

  const onToggleShowEmail = useCallback(
    (checked) => save("privacy.showEmail", checked),
    [save]
  );

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Account privacy"
        description="Restrict your account so only approved followers can see it."
        action={
          <SaveIndicator visible={savedKey === "privacy.privateAccount"} />
        }
      >
        <ToggleSwitch
          checked={preferences.privacy?.privateAccount}
          onChange={onTogglePrivate}
          label="Private account"
          description="When on, only approved followers can see your posts. (Approval flow isn't in the MVP — followers are auto-approved, but profile content is still hidden.)"
        />
      </SettingsSection>

      <SettingsSection
        title="Show email on profile"
        description="When on, your email address is visible to other users on your profile page."
        action={<SaveIndicator visible={savedKey === "privacy.showEmail"} />}
      >
        <ToggleSwitch
          checked={preferences.privacy?.showEmail}
          onChange={onToggleShowEmail}
          label="Share email"
          description="When off, only you can see your email address."
        />
      </SettingsSection>

      <SettingsSection
        title="Blocked users"
        description="Users you've blocked will be listed here."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-2xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Lock className="size-3" aria-hidden="true" />
            Coming soon
          </span>
        }
      >
        <div className="flex items-center gap-3 rounded-md bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700">
            <ShieldOff className="size-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 flex-1">
            You haven't blocked anyone yet. The blocking flow is coming soon.
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}
