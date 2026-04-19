import { useCallback } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import SelectableCard from "../../components/ui/SelectableCard.jsx";
import SegmentedControl from "../../components/ui/SegmentedControl.jsx";
import ToggleSwitch from "../../components/ui/ToggleSwitch.jsx";
import SettingsSection from "../../components/settings/SettingsSection.jsx";
import SaveIndicator from "../../components/settings/SaveIndicator.jsx";

import { usePreferences } from "../../context/usePreferences.js";
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
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
];

const THEME_OPTIONS = [
  {
    value: "light",
    title: "Light",
    description: "Bright, clean interface.",
    icon: Sun,
  },
  {
    value: "dark",
    title: "Dark",
    description: "Easy-on-the-eyes dark mode.",
    icon: Moon,
  },
  {
    value: "system",
    title: "System",
    description: "Follows your operating system.",
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
  useDocumentTitle("Appearance · Settings");

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
        title="Theme"
        description="Choose Pulse's color scheme. The system option follows your OS preference."
        action={<SaveIndicator visible={savedKey === "theme"} />}
      >
        <div
          role="radiogroup"
          aria-label="Theme selection"
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
                ariaLabel={`Theme: ${option.title}`}
              >
                <ThemeThumbnail value={option.value} selected={selected} />
              </SelectableCard>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Font size"
        description="Text scale across the entire interface. Changes apply instantly."
        action={<SaveIndicator visible={savedKey === "fontSize"} />}
      >
        <div className="flex flex-col gap-4">
          <SegmentedControl
            ariaLabel="Font size"
            options={FONT_SIZE_OPTIONS}
            value={preferences.fontSize}
            onChange={onPickFontSize}
          />
          <p
            aria-live="polite"
            className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          >
            The quick brown fox jumps over the lazy dog.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Reduce motion"
        description="Minimizes transitions and animations regardless of system preference."
        action={<SaveIndicator visible={savedKey === "reduceMotion"} />}
      >
        <ToggleSwitch
          checked={preferences.reduceMotion}
          onChange={onToggleReduceMotion}
          label="Reduce motion"
          description="When on, all animations and transitions are reduced to 0.01 ms."
        />
      </SettingsSection>

      <SettingsSection
        title="Compact mode"
        description="Uses tighter spacing for list and feed items."
        action={<SaveIndicator visible={savedKey === "compactMode"} />}
      >
        <ToggleSwitch
          checked={preferences.compactMode}
          onChange={onToggleCompactMode}
          label="Compact view"
          description="Ideal for power users; spacing and padding are reduced."
        />
      </SettingsSection>
    </div>
  );
}
