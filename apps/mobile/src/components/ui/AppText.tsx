import { Text, type TextProps } from "react-native";

import { type TypeVariant, type as typeScale } from "../../theme/tokens";

interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  /** Required: no unthemed text. Pass a theme token. */
  color: string;
  /** Tabular numerals for aligned figures. */
  tabular?: boolean;
}

/** The app's only Text. Variants come from the type scale. */
export function AppText({
  variant = "body",
  color,
  tabular,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      style={[
        typeScale[variant],
        { color },
        tabular && { fontVariant: ["tabular-nums"] },
        style,
      ]}
      {...rest}
    />
  );
}
