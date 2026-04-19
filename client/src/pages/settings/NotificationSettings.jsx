import { useCallback } from "react";
import { Lock } from "lucide-react";

import ToggleSwitch from "../../components/ui/ToggleSwitch.jsx";
import SettingsSection from "../../components/settings/SettingsSection.jsx";
import SaveIndicator from "../../components/settings/SaveIndicator.jsx";

import { usePreferences } from "../../context/PreferencesContext.jsx";
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
    label: "Gönderilerine gelen beğeniler",
    description: "Birisi gönderini beğendiğinde bildirim al.",
  },
  {
    key: "notifications.comments",
    label: "Gönderilerine gelen yorumlar",
    description: "Birisi gönderine yorum yaptığında bildirim al.",
  },
  {
    key: "notifications.follows",
    label: "Yeni takipçiler",
    description: "Birisi seni takip etmeye başladığında bildirim al.",
  },
];

const fieldOf = (key) => key.split(".").pop();

export default function NotificationSettings() {
  useDocumentTitle("Bildirimler · Ayarlar");

  const { preferences } = usePreferences();
  const { save, savedKey } = usePreferenceAutoSave();

  const onToggle = useCallback(
    (key) => (checked) => save(key, checked),
    [save]
  );

  return (
    <div className="space-y-6">
      <SettingsSection
        title="E-posta bildirimleri"
        description="Önemli etkinlikler için e-posta gönderelim mi?"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-2xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Lock className="size-3" aria-hidden="true" />
            Yakında
          </span>
        }
      >
        <ToggleSwitch
          checked={false}
          disabled
          label="E-posta bildirimleri"
          description="Bu özellik henüz aktif değil. Hazır olduğunda burada açabileceksin."
        />
      </SettingsSection>

      <SettingsSection
        title="Uygulama içi bildirimler"
        description="Pulse içinde hangi etkinlikler için bildirim almak istediğini seç."
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
