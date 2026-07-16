# ADR-0008: Contentment calibration and sensitive data

> **Status:** Proposed\
> **Date:** 2026-07-15

## Context

The app's most experimental feature: a weekly "how content did you
feel, 1–10?" check-in stored alongside computed grades, used to surface
grade/contentment mismatches and eventually tune the scoring formula
per user. The end-state success metric is a grade that predicts the
user's own felt contentment. This data — contentment scores plus
ratings on units like mental health, faith, and relationships — is
among the most sensitive a person can record.

## Open questions

- **Calibration mechanism:** start with simple correlation surfaced to
  the user ("your grades and contentment disagree — revisit your
  weights?"), or attempt automatic weight adjustment? How much data is
  needed before saying anything at all (cold-start threshold)?
- **What adjusts:** the gap coefficient in ADR-0003's formula, per-unit
  weights, task recommendations — define the levers calibration is
  allowed to touch, and require user confirmation before any change.
- **Privacy posture:** is contentment/diagnostic data ever transmitted
  off-device (analytics, sync, LLM prompts)? Define encryption at rest,
  export, and delete guarantees. (Coordinates with ADR-0001/0002 and
  ADR-0006's LLM question.)
- **Ethical guardrails:** persistently low contentment is a signal the
  app must handle carefully — decide what the app says and doesn't say
  (it is not a mental-health tool), and whether to surface help
  resources. Per the "gentle by design" principle (vision.md), also
  define the reassurance mechanics: where and how often the app
  restates that scores are guidelines (onboarding, low-grade moments,
  monthly review), and how low-grade periods are presented without
  shame. Calibration itself is the systemic anti-shame lever — when
  grades run below felt contentment, the system loosens, not the
  person. Stored grades are never altered for emotional effect (see
  docs/backburner.md, "Rosy retrospection").
- **Check-in cadence and fatigue:** weekly single question is the
  default — is it skippable, and does skipping affect calibration
  quality reporting?

## Options considered

*To be filled in during review.*

## Decision

*Pending.*

## Consequences

*Pending.*
