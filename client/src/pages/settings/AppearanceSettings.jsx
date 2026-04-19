import { useCallback } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import SelectableCard from "../../components/ui/SelectableCard.jsx";
import SegmentedControl from "../../components/ui/SegmentedControl.jsx";
import ToggleSwitch from "../../components/ui/ToggleSwitch.jsx";
import SettingsSection from "../../components/settings/SettingsSection.jsx";
import SaveIndicator from "../../components/settings/SaveIndicator.jsx";

import { usePreferences } from "../../context/PreferencesContext.jsx";
import usePreferenceAutoSave from "../../hooks/usePreferenceAutoSave.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.js";
import { cn } from "../../utils/cn.js";

/**
 * AppearanceSettings — theme, font size, motion and density controls.
 *
 * Every control here is auto-save: the optimistic update happens in
 * `PreferencesContext` (and immediately reflects on `<html>` via the
 * applied classes) while the network round trip is debounced by
 * `usePreferenceAutoSave`. A subtle "Saved" indicator appears next to the
 * affected control on success — toasts are reserved for errors so the
 * page never feels noisy.
 */

const FONT_SIZE_OPTIONS = [
  { value: "sm", label: "Küçük" },
  { value: "md", label: "Orta" },
  { value: "lg", label: "Büyük" },
];

const THEME_OPTIONS = [
  {
    value: "light",
    title: "Açık",
    description: "Aydınlık, temiz arayüz.",
    icon: Sun,
  },
  {
    value: "dark",
    title: "Koyu",
    description: "Gözleri yormayan koyu mod.",
    icon: Moon,
  },
  {
    value: "system",
    title: "Sistem",
    description: "İşletim sistemini takip eder.",
    icon: Monitor,
  },
];

/**
 * Tiny stylised "thumbnail" preview rendered inside each theme card.
 * Pure CSS so we don't ship an image asset just to suggest the look.
 */
function ThemeThumbnail({ value, selected }) {
  const isLight = value === "light";
  const isDark = value === "dark";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "mt-3 flex h-16 w-full items-stretch overflow-hidden rounded-md border transition-colors duration-fast",
        selected
          ? "border-brand-300 dark:border-brand-700"
          : "border-zinc-200 dark:border-zinc-700"
      )}
    >
      <div
        className={cn(
          "flex-1 p-2",
          isLight && "bg-white",
          isDark && "bg-zinc-900",
          !isLight && !isDark && "bg-white"
        )}
      >
        <div
          className={cn(
            "h-1.5 w-3/4 rounded",
            isDark ? "bg-zinc-700" : "bg-zinc-200"
          )}
        />
        <div
          className={cn(
            "mt-1.5 h-1.5 w-1/2 rounded",
            isDark ? "bg-zinc-800" : "bg-zinc-100"
          )}
        />
      </div>
      {value === "system" && (
        <div className="flex-1 bg-zinc-900 p-2">
          <div className="h-1.5 w-3/4 rounded bg-zinc-700" />
          <div className="mt-1.5 h-1.5 w-1/2 rounded bg-zinc-800" />
        </div>
      )}
    </div>
  );
}

export default function AppearanceSettings() {
  useDocumentTitle("Görünüm · Ayarlar");

  const { preferences } = usePreferences();
  const { save, savedKey } = usePreferenceAutoSave();

  const onPickTheme = useCallback(
    (value) => {
      if (value === preferences.theme) return;
      save("theme", value);
    },
    [preferences.theme, save]
  );

  const onPickFontSize = useCallback(
    (value) => {
      if (value === preferences.fontSize) return;
      save("fontSize", value);
    },
    [preferences.fontSize, save]
  );

  const onToggleReduceMotion = useCallback(
    (checked) => save("reduceMotion", checked),
    [save]
  );

  const onToggleCompactMode = useCallback(
    (checked) => save("compactMode", checked),
    [save]
  );

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Tema"
        description="Pulse'un renk şemasını seç. Sistem seçeneği işletim sisteminin tercihini takip eder."
        action={<SaveIndicator visible={savedKey === "theme"} />}
      >
        <div
          role="radiogroup"
          aria-label="Tema seçimi"
          className="grid gap-3 sm:grid-cols-3"
        >
          {THEME_OPTIONS.map((option) => {
            const selected = preferences.theme === option.value;
            return (
              <SelectableCard
                key={option.value}
                selected={selected}
                onSelect={() => onPickTheme(option.value)}
                icon={option.icon}
                title={option.title}
                description={option.description}
                ariaLabel={`Tema: ${option.title}`}
              >
                <ThemeThumbnail value={option.value} selected={selected} />
              </SelectableCard>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Yazı boyutu"
        description="Tüm arayüzdeki metin ölçeği. Değişiklik anında uygulanır."
        action={<SaveIndicator visible={savedKey === "fontSize"} />}
      >
        <div className="flex flex-col gap-4">
          <SegmentedControl
            ariaLabel="Yazı boyutu"
            options={FONT_SIZE_OPTIONS}
            value={preferences.fontSize}
            onChange={onPickFontSize}
          />
          <p
            aria-live="polite"
            className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          >
            Hızlı kahverengi tilki, tembel köpeğin üzerinden atlar.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Hareketi azalt"
        description="Sistem tercihinden bağımsız olarak geçişleri ve animasyonları en aza indirir."
        action={<SaveIndicator visible={savedKey === "reduceMotion"} />}
      >
        <ToggleSwitch
          checked={preferences.reduceMotion}
          onChange={onToggleReduceMotion}
          label="Hareketi azalt"
          description="Açıldığında tüm animasyon ve geçişler 0,01 ms'ye indirgenir."
        />
      </SettingsSection>

      <SettingsSection
        title="Kompakt mod"
        description="Liste ve akış öğelerinde daha sıkı bir aralık kullanır."
        action={<SaveIndicator visible={savedKey === "compactMode"} />}
      >
        <ToggleSwitch
          checked={preferences.compactMode}
          onChange={onToggleCompactMode}
          label="Kompakt görünüm"
          description="Yoğun bilgi tüketenler için ideal; aralıklar ve dolgular daraltılır."
        />
      </SettingsSection>
    </div>
  );
}
