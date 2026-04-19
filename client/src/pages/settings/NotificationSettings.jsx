import { useCallback } from "react";
import { Lock } from "lucide-react";

import ToggleSwitch from "../../components/ui/ToggleSwitch.jsx";
import SettingsSection from "../../components/settings/SettingsSection.jsx";
import SaveIndicator from "../../components/settings/SaveIndicator.jsx";

import { usePreferences } from "../../context/usePreferences.js";
import usePreferenceAutoSave from "../../hooks/usePreferenceAutoSave.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.js";

/**
 * NotificationSettings — controls which in-app notifications are
 * generated for the signed-in user. The server-side notification
 * dispatcher reads these flags before persisting a row, so toggling
 * "Likes" off truly stops them at the source — there is no client-side
 * filter masking real activity.
 *
 * Email notifications are scaffolded as a single locked toggle to set
 * the right expectation; we'll wire a real flag when transactional
 * email is in scope.
 */

const IN_APP_TOGGLES = [
  {
    key: "notifications.likes",
    label: "Likes on your posts",
    description: "Get notified when someone likes your post.",
  },
  {
    key: "notifications.comments",
    label: "Comments on your posts",
    description: "Get notified when someone comments on your post.",
  },
  {
    key: "notifications.follows",
    label: "New followers",
    description: "Get notified when someone starts following you.",
  },
];

const fieldOf = (key) => key.split(".").pop();

export default function NotificationSettings() {
  useDocumentTitle("Notifications · Settings");

  const { preferences } = usePreferences();
  const { save, savedKey } = usePreferenceAutoSave();

  const onToggle = useCallback(
    (key) => (checked) => save(key, checked),
    [save]
  );

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Email notifications"
        description="Should we email you about important events?"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-2xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Lock className="size-3" aria-hidden="true" />
            Coming soon
          </span>
        }
      >
        <ToggleSwitch
          checked={false}
          disabled
          label="Email notifications"
          description="This feature isn't enabled yet. You'll be able to turn it on here once it's ready."
        />
      </SettingsSection>

      <SettingsSection
        title="In-app notifications"
        description="Pick which in-app events you want to be notified about on Pulse."
      >
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {IN_APP_TOGGLES.map(({ key, label, description }) => {
            const value = Boolean(preferences.notifications?.[fieldOf(key)]);
            return (
              <li
                key={key}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <ToggleSwitch
                  checked={value}
                  onChange={onToggle(key)}
                  label={label}
                  description={description}
                  className="flex-1"
                />
                <SaveIndicator visible={savedKey === key} className="mt-1.5" />
              </li>
            );
          })}
        </ul>
      </SettingsSection>
    </div>
  );
}
