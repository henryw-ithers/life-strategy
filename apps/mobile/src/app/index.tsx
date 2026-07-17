/**
 * Temporary scaffold home. Proves the vertical slice (scoring engine →
 * SQLite → query) and links to the real surfaces. Replaced by the
 * daily checklist once feature work starts.
 */
import {
  DAILY_BUDGET,
  deriveWeights,
  FORMULA_VERSION,
  taskPointValues,
} from "@life-strategy/scoring";
import { Link, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/ui/AppText";
import { Backdrop, constellation } from "../components/ui/Backdrop";
import { db } from "../db/client";
import { getTheme } from "../theme/colors";
import { space, type as typeScale } from "../theme/tokens";

// ADR-0003's worked example.
const demoWeights = deriveWeights([
  { unitId: "exercise-fitness", importance: 9, satisfaction: 4 },
  { unitId: "friendship", importance: 7, satisfaction: 7 },
  { unitId: "art-media", importance: 3, satisfaction: 6 },
]);
const demoTaskPoints = taskPointValues(demoWeights[0]?.weight ?? 0, 3);

interface TaxonomyRow {
  areaName: string;
  unitCount: number;
}

export default function ScaffoldHome() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<TaxonomyRow[] | null>(null);

  useEffect(() => {
    (async () => {
      const areas = await db.query.lifeArea.findMany({
        where: (a, { isNull }) => isNull(a.archivedAt),
        orderBy: (a, { asc }) => asc(a.sortOrder),
      });
      const units = await db.query.lifeUnit.findMany({
        where: (u, { isNull }) => isNull(u.archivedAt),
      });
      setRows(
        areas.map((area) => ({
          areaName: area.name,
          unitCount: units.filter((u) => u.areaId === area.id).length,
        })),
      );
    })();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas)} />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + space.xxl }]}
      >
        <AppText variant="display" color={theme.ink}>
          Life Strategy
        </AppText>
        <AppText variant="caption" color={theme.muted}>
          Scaffold build · formula v{FORMULA_VERSION}
        </AppText>

        <View style={styles.links}>
          <Link href={"/diagnostic" as Href} style={[typeScale.headline, { color: theme.accent }]}>
            Run diagnostic →
          </Link>
          <Link href={"/plan" as Href} style={[typeScale.headline, { color: theme.accent }]}>
            Plan your tasks →
          </Link>
          <Link href="/dev/graph" style={[typeScale.headline, { color: theme.accent }]}>
            Portfolio graph spike →
          </Link>
        </View>

        <Section label="Scoring engine" theme={theme}>
          {demoWeights.map((w) => (
            <Row key={w.unitId} left={w.unitId} right={`${w.weight} pts`} theme={theme} />
          ))}
          <Row
            left="sum"
            right={`${demoWeights.reduce((a, w) => a + w.weight, 0)} / ${DAILY_BUDGET}`}
            theme={theme}
          />
          <Row left="task points (rank 1–3)" right={demoTaskPoints.join(" / ")} theme={theme} />
        </Section>

        <Section label="Database (synced taxonomy)" theme={theme}>
          {rows === null ? (
            <AppText variant="caption" color={theme.muted}>
              Loading…
            </AppText>
          ) : (
            rows.map((r) => (
              <Row key={r.areaName} left={r.areaName} right={`${r.unitCount} units`} theme={theme} />
            ))
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  label,
  theme,
  children,
}: {
  label: string;
  theme: ReturnType<typeof getTheme>;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { borderTopColor: theme.hairline }]}>
      <AppText variant="caption" color={theme.muted} style={styles.sectionLabel}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

function Row({
  left,
  right,
  theme,
}: {
  left: string;
  right: string;
  theme: ReturnType<typeof getTheme>;
}) {
  return (
    <View style={styles.row}>
      <AppText color={theme.ink} style={styles.rowLeft} numberOfLines={1}>
        {left}
      </AppText>
      <AppText color={theme.ink} tabular>
        {right}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  container: {
    paddingHorizontal: space.screen,
    paddingBottom: space.xxl,
    gap: space.xs,
  },
  links: { marginTop: space.xl, marginBottom: space.lg, gap: space.md },
  section: {
    marginTop: space.lg,
    paddingTop: space.md,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: { marginBottom: space.xs },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.md,
  },
  rowLeft: { flexShrink: 1 },
});
