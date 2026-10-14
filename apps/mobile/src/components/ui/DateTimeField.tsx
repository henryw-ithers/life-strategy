/**
 * The app's one date and time control: iOS's compact picker, from
 * `@expo/ui` (ADR-0043 §1).
 *
 * **It exists because the old pickers closed themselves.** Each of four
 * places opened a spinner and shut it in `onChange`, which on iOS fires
 * on every turn of the wheel, so a picker closed as soon as you let go
 * of it. The compact picker shows its value as a button, opens in
 * place, and stays open until you tap somewhere else, which is what the
 * spec asks for (§5.8).
 *
 * It holds the app's stored forms, never a `Date`: minutes from local
 * midnight for a time, `YYYY-MM-DD` for a day. The crossing lives in
 * `lib/pickerValues.ts`. The label is the caller's, so the picker's
 * own is hidden and kept for VoiceOver.
 *
 * The browser preview gets `DateTimeField.web.tsx`, a plain input,
 * because SwiftUI doesn't render there.
 */
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { accessibilityLabel, datePickerStyle, labelsHidden } from "@expo/ui/swift-ui/modifiers";

import {
  dateToLocalDate,
  dateToMinutes,
  localDateToDate,
  minutesToDate,
} from "../../lib/pickerValues";
import type { ThemeTokens } from "../../theme/colors";

interface Common {
  /** What VoiceOver reads; the row shows its own label beside it. */
  label: string;
  accent: string;
  theme: ThemeTokens;
}

export function TimeField({
  minutes,
  min,
  onChange,
  label,
  accent,
  theme,
}: Common & {
  minutes: number;
  /** The earliest time it offers. Set it rather than clamping after the
   *  pick: the picker keeps its own value, and a pick undone in JS can
   *  leave it showing a time that wasn't saved. */
  min?: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <Host matchContents colorScheme={theme.name} seedColor={accent}>
      <DatePicker
        title={label}
        selection={minutesToDate(minutes)}
        range={min !== undefined ? { start: minutesToDate(min) } : undefined}
        displayedComponents={["hourAndMinute"]}
        onDateChange={(at) => onChange(dateToMinutes(at))}
        modifiers={[datePickerStyle("compact"), labelsHidden(), accessibilityLabel(label)]}
      />
    </Host>
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
    <Host matchContents colorScheme={theme.name} seedColor={accent}>
      <DatePicker
        title={label}
        selection={localDateToDate(date)}
        displayedComponents={["date"]}
        onDateChange={(at) => onChange(dateToLocalDate(at))}
        modifiers={[datePickerStyle("compact"), labelsHidden(), accessibilityLabel(label)]}
      />
    </Host>
  );
}
