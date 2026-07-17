/**
 * Unit descriptions and guidelines — the first slice of the ADR-0006
 * content package, keyed by stable unit id (db/taxonomy.ts).
 *
 * Editorial rules (ADR-0006): the DESCRIPTION carries the weight. It
 * defines the unit and why it matters, plainly. The GUIDELINES exist
 * to help the person judge their own satisfaction rating. Their
 * general philosophy is BALANCE. Specificity matches how measurable
 * the domain is: sleep really is 7–9 hours, but relational and
 * subjective units get broad functional dimensions (novelty, real
 * time, reciprocity, room for the rest of your life), never one
 * shape of success — felt experience can rightly override the
 * standard picture. Evidence appears where it earns its place; a
 * line may stand alone where it speaks for itself. Write like a
 * person: short sentences, few dashes, no tidy parallel
 * constructions. No prescriptions, no pampering, no shame framing,
 * no "you should."
 */
export interface UnitInfo {
  description: string;
  guidelines: string[];
}

export const UNIT_INFO: Record<string, UnitInfo> = {
  // ── Relationships ─────────────────────────────────────────────────
  "significant-other": {
    description:
      "Your romantic partnership. If you're single, rate how you feel about that.",
    guidelines: [
      "Conflict happens, but it's handled with grace and complaints get repaired instead of buried.",
      "You still do new things together. Novelty keeps satisfaction alive where routine wears it down.",
      "You spend real time together, on purpose.",
      "It adds to your life without swallowing it. You have a healthy balance of shared and separate friends, interests, and time.",
    ],
  },
  family: {
    description:
      "Parents, siblings, children, chosen family, etc.",
    guidelines: [
      "Contact is regular, even if it's short.",
      "There are rituals. A standing call, a recurring dinner.",
      "Boundaries exist where they're needed.",
    ],
  },
  friendship: {
    description:
      "People you enjoy spending time with, and people who actually know you. Social connection is one of the strongest predictors of health and longevity we have. ",
    guidelines: [
      "Some of your friendships have real depth.",
      "You can be yourself without fear of judgement.",
      "Spending time with others is enjoyable, not draining.",
    ],
  },

  // ── Physical health ───────────────────────────────────────────────
  "exercise-fitness": {
    description:
      "Movement, strength, and what your body can do. Regular activity lowers all-cause mortality, heart disease risk, and rates of depression and anxiety.",
    guidelines: [
      "You move most days. The common benchmark is 150 to 300 minutes of moderate activity a week, and walking counts.",
      "Regular strength training.",
      "Being active is apart of your routine.",
    ],
  },
  nutrition: {
    description:
      "How you fuel yourself. What matters is the balance not any single meal. Long-term health follows the trend.",
    guidelines: [
      "Most of what you eat is minimally processed and makes you feel good afterwards.",
      "Meals are enjoyable, colourful, balanced, and have protein in them.",
      "You have a thoughtful supplement routine.",
    ],
  },
  "sleep-recovery": {
    description:
      "Sleep and real recovery. Running short on sleep degrades mood, thinking, and metabolic health.",
    guidelines: [
      "Most nights begin and end around the same time and last 7 to 9 hours.",
      "You wake up feeling refreshed.",
      "You have healthy routines before and after you sleep.",
    ],
  },

  // ── Mental wellbeing ──────────────────────────────────────────────
  "mental-health": {
    description:
      "How you're actually doing inside: mood, stress load, resilience.",
    guidelines: [
      "Feelings get named. Putting words to an emotion lowers its intensity, and the effect shows up on brain scans.",
      "Stress comes with recovery after it. Load plus rest builds capacity. Load alone wears you down.",
      "Someone knows how you're really doing, whether that's a friend or a professional.",
    ],
  },
  spirituality: {
    description:
      "Being in touch with the universe beyond the everyday, through faith, nature, awe, gratitude, silence, or however you understand it.",
    guidelines: [
      "Some kind of quiet practice recurs. Meditation, prayer, and deliberate stillness all lower stress reactivity.",
      "Awe has room in your life. People who feel it regularly report better wellbeing, and it even shows in inflammation markers.",
      "Gratitude gets noticed, briefly and often. It's one of the most replicated findings in wellbeing research.",
    ],
  },
  "giving-service": {
    description:
      "What you put back: generosity, help, service in any form. Volunteers show lower rates of depression and mortality.",
    guidelines: [
      "Giving happens regularly and by choice. The benefit is strongest when it's voluntary.",
      "You can see some of the effect. Visible impact is what ties giving to meaning.",
      "It comes from whatever you have. Time, skills, presence, resources, or even words all count the same.",
    ],
  },

  // ── Work & money ──────────────────────────────────────────────────
  "job-career": {
    description:
      "The work itself: challenge, progress, respect, direction. Once pay covers your needs, autonomy, competence, and purpose predict satisfaction better than money does.",
    guidelines: [
      "You can point to progress on something that matters. Small visible wins are the strongest daily motivator we know of.",
      "You have real say in how you work. Burnout comes from effort without control, not from effort.",
      "Work ends somewhere, and demand comes with recovery. That boundary protects everything else on this list.",
    ],
  },
  "education-learning": {
    description:
      "Learning and growth in any direction: skills, subjects, crafts. Growth feeds capability and mood, and curiosity itself helps memory form.",
    guidelines: [
      "Learning happens in short sessions spread out over time, with some self-testing. That combination beats rereading by a wide margin.",
      "You follow what actually interests you. Interest improves retention, so it's a strategy, not a detour.",
      "What you learn gets used, or explained to someone. That's what makes it stick.",
    ],
  },
  finances: {
    description:
      "Security, control, and direction with money, the most commonly reported stressor in national surveys. The wellbeing effect comes from security and alignment, not wealth itself.",
    guidelines: [
      "You know your numbers. Looking at the accounts regularly lowers money anxiety more than avoiding them does.",
      "There's a buffer for surprises. It buys calm far beyond its size.",
      "Once needs are covered, spending goes toward values and experiences.",
    ],
  },

  // ── Home & environment ────────────────────────────────────────────
  "living-space": {
    description:
      "Your home, and whether it's comfortable, functional, and feels like yours. Environment shapes mood and behavior more reliably than willpower.",
    guidelines: [
      "The space is ordered enough to rest in. Clutter tracks with higher cortisol, especially at the end of the day.",
      "Rooms are set up for the life you want in them. A space arranged for a habit produces more of it.",
      "There's natural light and something alive in it. Both have small, steady effects on mood and focus.",
    ],
  },
  "nature-surroundings": {
    description:
      "Time outdoors: nature, daylight, your surroundings. About two hours a week in nature tracks with better reported health and wellbeing, and it doesn't require wilderness.",
    guidelines: [
      "You get outside most days, even briefly. Morning daylight sets the rhythm your sleep and mood follow.",
      "Nature comes in any dose. Street trees, a park, even a view from a window lowers stress markers.",
      "Some of the weekly hours come from ordinary places. The neighborhood counts.",
    ],
  },

  // ── Leisure & creativity ──────────────────────────────────────────
  "hobbies-interests": {
    description:
      "Things you do and make for their own sake: projects, crafts, skills.",
    guidelines: [
      "Something in your life pairs clear goals with a challenge just past your skill. That's the recipe for flow.",
      "You make things, not just consume them. Creative activity helps you recover from work.",
      "Leisure has protected time. Scheduled leisure happens. Unscheduled leisure loses to everything.",
    ],
  },
  "art-media": {
    description:
      "The culture you take in: books, film, music, games, podcasts.",
    guidelines: [
      "Some of what you take in challenges you. It makes you think, argue back, or sit with an idea.",
      "It moves you sometimes. Art that brings up real emotion is doing its job.",
      "You learn from it and come away more aware of the world.",
    ],
  },
  "adventure-experiences": {
    description:
      "Novelty, travel, firsts. The experiences that make one season different from the last.",
    guidelines: [
      "Something is on the calendar to look forward to. Anticipation is a big share of the total enjoyment.",
      "Newness shows up at every scale. Unfamiliar routes, foods, and skills register like trips do.",
      "Now and then you pick the slightly uncomfortable option. Novelty is what stretches time, not comfort.",
    ],
  },
};
