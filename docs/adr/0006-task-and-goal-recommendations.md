# ADR-0006: Task and goal recommendation source

> **Status:** Accepted\
> **Date:** 2026-07-15\
> **Deciders:** Henry

## Context

Tasks and goals are a blend of app recommendations and user-created
entries, with recommendations informed by each unit's
importance/satisfaction profile. The data recommendations would
personalize against (ratings on mental health, faith, relationships)
is the most sensitive data in the app; the stack is local-first
(ADR-0001/0002); and the original "suggest a point value" question is
moot — point values derive from rank (ADR-0003), so recommendations
only ever suggest *what*, never *how much*.

## Decisions

### 1. Source: curated on-device library (v1); LLM later, opt-in

A hand-curated **content package ships inside the app** — no network,
no per-user cost, no diagnostic data leaving the device:

- Per SLU: **3–5 goal templates** (with suggested milestones) and
  **6–10 tasks** (cadence-tagged daily/weekly), each tagged by the
  profile it suits: *gap-closing* (importance well above
  satisfaction), *maintenance* (satisfied and important), or *light*
  (low weight — weekly-cadence suggestions, per the ADR-0003 bands).
- The package also carries ADR-0009's **keyword map** for activity tag
  suggestions ("golf" → Physical health, Friendship, Offline
  entertainment) — recommendations and tagging are one content
  artifact, versioned (`content_version`) and updated via app
  releases.
- **Editorial register** (refined 2026-07-16): direct, factual,
  concise. Descriptions carry the weight — what the unit is and why it
  matters. Guidelines exist to help the person judge their own
  satisfaction rating, and their general philosophy is **balance**.
  Specificity matches measurability: concrete domains get honest
  benchmarks (sleep: 7–9 hours), relational and subjective domains get
  broad functional dimensions (novelty, real time, reciprocity, room
  for the rest of life) — how success *functions*, never one shape of
  it. Felt experience can rightly override the standard picture.
  Evidence appears where it earns its place; a line may stand alone
  where it speaks for itself. Not prescriptions, not pampering. Gentleness lives in what's
  omitted: no shame framing, no "you should," no implication the
  reader is behind. **Sensitive units** (mental health, spirituality,
  significant other) additionally carry no clinical, therapeutic, or
  theological advice. Every entry is hand-reviewed; this is a place
  where a curated library *beats* generation.

**LLM personalization is deferred, not rejected.** When it comes, it
arrives behind an explicit opt-in with plain disclosure of exactly
what leaves the device, and gets its own ADR (provider, redaction,
cost). Nothing in v1 assumes it.

### 2. Proactivity: auto-proposed starter plan

After the first diagnostic, the app drafts a **complete starter
plan**: for each unit, goals and tasks drawn from the library to match
its profile, task counts per the ADR-0003 weight bands. The user
edits/accepts — **nothing is created until accepted**, and accepting
untouched is a first-class path ("strong defaults, full
customization").

Proposed tasks arrive **pre-ranked** (the library defines a default
order within each unit), so onboarding needs no Beli comparisons; the
ranking flow first appears when the user inserts their own task.

### 3. Refresh: recommendations follow the diagnostic, never push

Recommendations recompute from the latest snapshot but only surface at
natural moments — the post-diagnostic diff prompts (ADR-0005: "
Friendship rose to 12 points — add a second task?") and the monthly
review. In-flight goals and tasks are **never modified automatically**
(carry-over rule, ADR-0005). Outside those moments, recommendations
are pull, not push: available when a unit is opened, silent otherwise
(a tool, not a taskmaster).

### 4. Launch content bar

~~v1 ships only when every one of the 18 SLUs has at least 3 goal
templates and 6 tasks across all three profile tags~~, and the keyword
map covers common activities. Content is a launch deliverable with the
same weight as code.

**Amended 2026-08-16: the numeric bar is dropped.** Writing to a quota
is how a library fills with padding, and padding is the thing that
reads as generated. Henry, mid-writing: *"they don't need 3 or some
number, just put as many relevant generic ones we need to give people
ideas."* What still holds is **coverage** — every unit has something,
and every unit offers something to each of the three profiles.
`scripts/content/build.mjs` reports against that instead of a count.

**Two rules the writing itself produced**, now recorded in
[library.md](../content/library.md):

- **Never characterise the reader.** "Ship the thing you keep not
  shipping" assumes the person is behind; the app does not get to
  imply that. This is the never-shames invariant reaching content.
- **No em dashes in app copy.** The clearest single tell that a line
  was generated rather than written.

## Consequences

- **Easier:** the privacy story stays absolute in v1 ("nothing leaves
  your device — nothing to disclose"); recommendations are
  deterministic and testable; sensitive units are guarded by editorial
  judgment rather than prompt engineering; the app is useful in
  minute one via the starter plan.
- **Harder:** writing ~150 quality library entries is real editorial
  work on the critical path to launch; content updates ride app
  releases (no server push); recommendations can't reference the
  user's own phrasing or history until the LLM path exists.
- **Revisit when:** the LLM opt-in is designed (new ADR); if library
  entries feel generic in practice, that's the signal to prioritize
  it; if the starter plan is heavily edited by most users, the
  profile tags need tuning.

## Action items

1. [x] Define the content-package schema (goal templates, tasks,
       profile tags, default ranks, keyword map, content_version).
       (Shipped: `docs/content/library.md` is the source of truth and
       `scripts/content/build.mjs` generates
       `apps/mobile/src/content/library.ts` from it.)
2. [x] Write the library, with a hand-review pass on sensitive units.
       (Shipped 2026-08-16: **71 goals and 110 tasks** across all 18
       units, written line by line with Henry. Mental & emotional
       health, Spirituality and Significant other took the sensitive
       pass; Finances carries no investment advice. Numbers are
       grounded in real recommendations rather than folklore, which
       moved steps from 10,000 to 8,000 and set the habit ladder at
       7/30/66 from Lally.)
3. [ ] Implement starter-plan generation (profile matching + ADR-0003
       bands) as a pure function in the `scoring`/content layer.
4. [ ] Wire recommendation surfacing into the post-diagnostic diff and
       monthly review flows (ADR-0005).
