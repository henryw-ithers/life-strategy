/**
 * Temporary scaffold smoke screen. Proves the vertical slice:
 * workspace package import → scoring engine → SQLite schema →
 * migration → seed → query. Replaced by the real daily checklist
 * once feature work starts.
 */
import {
  DAILY_BUDGET,
  deriveWeights,
  FORMULA_VERSION,
  taskPointValues,
} from "@life-strategy/scoring";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { db } from "../db/client";

// ADR-0003's worked example.
const demoWeights = deriveWeights([
  { unitId: "physical-health", importance: 9, satisfaction: 4 },
  { unitId: "friendship", importance: 7, satisfaction: 7 },
  { unitId: "online-entertainment", importance: 3, satisfaction: 6 },
]);
const demoTaskPoints = taskPointValues(demoWeights[0]?.weight ?? 0, 3);

interface TaxonomyRow {
  areaName: string;
  unitCount: number;
}

export default function ScaffoldCheck() {
  const [rows, setRows] = useState<TaxonomyRow[] | null>(null);

  useEffect(() => {
    (async () => {
      const areas = await db.query.lifeArea.findMany({
        orderBy: (a, { asc }) => asc(a.sortOrder),
      });
      const units = await db.query.lifeUnit.findMany();
      setRows(
        areas.map((area) => ({
          areaName: area.name,
          unitCount: units.filter((u) => u.areaId === area.id).length,
        })),
      );
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Life Strategy</Text>
      <Text style={styles.subtitle}>Scaffold check</Text>

      <Section label={`Scoring engine (formula v${FORMULA_VERSION})`}>
        {demoWeights.map((w) => (
          <Row key={w.unitId} left={w.unitId} right={`${w.weight} pts`} />
        ))}
        <Row
          left="sum"
          right={`${demoWeights.reduce((a, w) => a + w.weight, 0)} / ${DAILY_BUDGET}`}
        />
        <Row left="task points (rank 1–3)" right={demoTaskPoints.join(" / ")} />
      </Section>

      <Link href="/dev/graph" style={styles.devLink}>
        Open portfolio graph spike →
      </Link>

      <Section label="Database (seeded taxonomy)">
        {rows === null ? (
          <Text style={styles.dim}>Loading…</Text>
        ) : (
          rows.map((r) => (
            <Row key={r.areaName} left={r.areaName} right={`${r.unitCount} units`} />
          ))
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLeft}>{left}</Text>
      <Text style={styles.rowRight}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 80, gap: 8 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 15, opacity: 0.6, marginBottom: 16 },
  section: { marginTop: 16, gap: 6 },
  sectionLabel: { fontSize: 13, fontWeight: "600", opacity: 0.5, marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowLeft: { fontSize: 15 },
  rowRight: { fontSize: 15, fontVariant: ["tabular-nums"] },
  dim: { opacity: 0.5 },
  devLink: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 16,
    paddingVertical: 12,
  },
});
