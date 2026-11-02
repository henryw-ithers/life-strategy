/**
 * The browser preview's stand-in for `DateTimeField.tsx`: SwiftUI
 * doesn't render on the web, so a plain HTML input takes its place.
 * Same exports and props, so callers never know which one they got.
 * The preview is for looking at UI, never a target (docs/web-preview.md).
 */
import { formatMinutes } from "@glide/scoring";
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { hhmmToMinutes } from "../../lib/pickerValues";
import type { ThemeTokens } from "../../theme/colors";

interface Common {
  label: string;
  accent: string;
  theme: ThemeTokens;
}

/** The native scope closes an open wheel; an input needs none. */
export function FieldScope({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}

/** The native row opens a wheel beneath it; here it's just the row. */
export function TimeFieldRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}

function inputStyle(theme: ThemeTokens, accent: string) {
  return {
    font: "inherit",
    fontSize: 15,
    color: theme.ink,
    background: theme.surface,
    border: `1px solid ${theme.hairline}`,
    borderRadius: 8,
    padding: "4px 8px",
    accentColor: accent,
  } as const;
}

export function TimeField({
  minutes,
  min,
  onChange,
  label,
  accent,
  theme,
}: Common & { minutes: number; min?: number; onChange: (minutes: number) => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}>
      <input
        type="time"
        aria-label={label}
        value={formatMinutes(minutes)}
        min={min !== undefined ? formatMinutes(min) : undefined}
        onChange={(e) => {
          const m = hhmmToMinutes(e.target.value);
          if (m !== null) onChange(m);
        }}
        style={inputStyle(theme, accent)}
      />
      {minutes >= 1440 ? <span style={{ fontSize: 12, color: theme.muted }}>+1</span> : null}
    </span>
  );
}

export function DayField({
  date,
  onChange,
  label,
  accent,
  theme,
}: Common & { date: string; onChange: (date: string) => void }) {
  return (
    <input
      type="date"
      aria-label={label}
      value={date}
      onChange={(e) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onChange(e.target.value);
      }}
      style={inputStyle(theme, accent)}
    />
  );
}
