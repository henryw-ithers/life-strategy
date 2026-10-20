/**
 * The diagnostic is Priorities now (ADR-0041): four tiers, no ranking
 * and no satisfaction steps. This route stays so the links that still
 * name it, onboarding's first among them until Phase 11, open the
 * tiers screen, which on a first run starts with every unit in
 * Important. Going back returns to whoever pushed it.
 */
import { Redirect, type Href } from "expo-router";

export default function DiagnosticRedirect() {
  return <Redirect href={"/priorities" as Href} />;
}
