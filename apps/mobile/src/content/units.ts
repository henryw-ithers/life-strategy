/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: docs/content/units.md
 * Regenerate: npm run content:build
 *
 * Edits here are lost on the next build, and `npm run content:check`
 * fails the moment this file and its source disagree.
 */

export interface UnitInfo {
  description: string;
  guidelines: string[];
  /**
   * The app's own thinking about this unit (ADR-0025 §13) — why it
   * behaves differently from the rest. Present on seven units: the
   * three communal ones and the four intrinsic ones.
   *
   * Editorial only. It determines copy and nothing else: no planning
   * rule, no point value, no stored value. Same shape as ADR-0021's
   * treatment of areas.
   */
  note?: string;
}

export const UNIT_INFO: Record<string, UnitInfo> = {
  "significant-other": {
    "description": "Your romantic partnership or relationship with being single.",
    "guidelines": [
      "Conflict happens, but it's handled with grace and complaints get repaired instead of buried.",
      "You still do new things together. Novelty keeps satisfaction alive where routine wears it down.",
      "You spend real time together, on purpose.",
      "It adds to your life without swallowing it. You have a healthy balance of shared and separate friends, interests, and time."
    ],
    "note": "There's no checklist here. A relationship you're keeping score in is a different kind of relationship, and the scorekeeping is what did it. So instead, when you log something you did, you can note who you were with. A day with real time together in it counts in full."
  },
  "family": {
    "description": "Parents, siblings, children, chosen family, etc.",
    "guidelines": [
      "Contact is regular, even if it's short.",
      "There are rituals. A standing call, a recurring dinner.",
      "Boundaries exist where they're needed."
    ],
    "note": "There's no checklist here. Tallying what you give a family turns it into an account, and an account is a strange thing to have with them. So instead, when you log something you did, you can note who you were with. A day with real contact in it counts in full."
  },
  "friendship": {
    "description": "People you enjoy spending time with and people who actually know you.",
    "guidelines": [
      "Some of your friendships have real depth.",
      "You can be yourself without fear of judgement.",
      "Spending time with others is enjoyable, not draining."
    ],
    "note": "There's no checklist here. Friendship measured by how often you reached out stops being about the friends. So instead, when you log something you did, you can note who you were with — most of what people do with friends is something else, done together. A day with real company in it counts in full."
  },
  "exercise-fitness": {
    "description": "Movement, strength, and what your body can do.",
    "guidelines": [
      "You move most days. The common benchmark is 150 to 300 minutes of moderate activity a week, and walking counts.",
      "Regular strength training.",
      "Being active is apart of your routine."
    ]
  },
  "nutrition": {
    "description": "How you fuel yourself.",
    "guidelines": [
      "Most of what you eat is minimally processed and makes you feel good afterwards.",
      "Meals are enjoyable, colourful, balanced, and have protein in them.",
      "You have a thoughtful supplement routine."
    ]
  },
  "sleep-recovery": {
    "description": "Sleep and real recovery. Running short on sleep degrades mood, thinking, and metabolic health.",
    "guidelines": [
      "Most nights begin and end around the same time and last 7 to 9 hours.",
      "You wake up feeling refreshed.",
      "You have healthy routines before and after you sleep."
    ]
  },
  "mental-health": {
    "description": "How you're actually doing inside: mood, stress load, resilience.",
    "guidelines": [
      "Feelings get named. Putting words to an emotion lowers its intensity, and the effect shows up on brain scans.",
      "Stress comes with recovery after it. Load plus rest builds capacity. Load alone wears you down.",
      "Someone knows how you're really doing, whether that's a friend or a professional."
    ]
  },
  "spirituality": {
    "description": "Being in touch with the universe beyond the everyday, through faith, nature, awe, gratitude, silence, or however you understand it.",
    "guidelines": [
      "Some kind of quiet practice recurs. Meditation, prayer, and deliberate stillness all lower stress reactivity.",
      "Awe has room in your life. People who feel it regularly report better wellbeing, and it even shows in inflammation markers.",
      "Gratitude gets noticed, briefly and often. It's one of the most replicated findings in wellbeing research."
    ],
    "note": "Two things are true here and they pull against each other. A practice wants a regular place in the week, or it quietly stops happening. And this is the area where counting it is most likely to empty it out. Keep the rhythm; hold the tally loosely."
  },
  "giving-service": {
    "description": "What you put back: generosity, help, service in any form.",
    "guidelines": [
      "Giving happens regularly and by choice. The benefit is strongest when it's voluntary.",
      "You can see some of the effect. Visible impact is what ties giving to meaning.",
      "It comes from whatever you have. Time, skills, presence, resources, or even words all count the same."
    ]
  },
  "job-career": {
    "description": "The work itself: challenge, progress, respect, direction.",
    "guidelines": [
      "You can point to progress on something that matters. Small visible wins are the strongest daily motivator we know of.",
      "You have real say in how you work. Burnout comes from effort without control, not from effort.",
      "Work ends somewhere, and demand comes with recovery. That boundary protects everything else on this list."
    ]
  },
  "education-learning": {
    "description": "Learning and growth in any direction: skills, subjects, crafts.",
    "guidelines": [
      "Learning happens in short sessions spread out over time, with some self-testing. That combination beats rereading by a wide margin.",
      "You follow what actually interests you. Interest improves retention, so it's a strategy, not a detour.",
      "What you learn gets used, or explained to someone. That's what makes it stick."
    ]
  },
  "finances": {
    "description": "Security, control, and direction with money.",
    "guidelines": [
      "You know your numbers. Looking at the accounts regularly lowers money anxiety more than avoiding them does.",
      "There's a buffer for surprises. It buys calm far beyond its size.",
      "Once needs are covered, spending goes toward values and experiences."
    ]
  },
  "living-space": {
    "description": "Your home, and whether it's comfortable, functional, and feels like yours.",
    "guidelines": [
      "The space is ordered enough to rest in. Clutter tracks with higher cortisol, especially at the end of the day.",
      "Rooms are set up for the life you want in them. A space arranged for a habit produces more of it.",
      "There's natural light and something alive in it. Both have small, steady effects on mood and focus."
    ]
  },
  "nature-surroundings": {
    "description": "Time outdoors: nature, daylight, your surroundings.",
    "guidelines": [
      "You get outside most days, even briefly. Morning daylight sets the rhythm your sleep and mood follow.",
      "Nature comes in any dose. Street trees, a park, even a view from a window lowers stress markers.",
      "Some of the weekly hours come from ordinary places. The neighborhood counts."
    ]
  },
  "hygiene": {
    "description": "The daily upkeep of your body: showers, teeth, grooming, clean clothes. Maintenance, not growth. Small routines with an outsized return in how you feel.",
    "guidelines": [
      "The basics happen without negotiation: teeth, showers, laundry.",
      "You mostly start the day feeling clean and put together, and it shows in how you carry it.",
      "There's a little care past the minimum, whatever that means for you: skincare, a haircut, nails.",
      "A busy stretch dents the routine without erasing it, and the way back is short."
    ]
  },
  "hobbies-interests": {
    "description": "Things you do and make for their own sake: projects, crafts, skills.",
    "guidelines": [
      "Something in your life pairs clear goals with a challenge just past your skill. That's the recipe for flow.",
      "You make things, not just consume them. Creative activity helps you recover from work.",
      "Leisure has protected time. Scheduled leisure happens. Unscheduled leisure loses to everything."
    ],
    "note": "Two things are true here and they pull against each other. Things you do for their own sake are the first to lose to whatever's urgent, because they're never urgent themselves — so it's worth putting them in the week on purpose. They're also the easiest things to spoil by turning them into a list. Plan enough that it happens, not so much that it becomes homework."
  },
  "art-media": {
    "description": "The culture you take in: books, film, music, games, podcasts.",
    "guidelines": [
      "Some of what you take in challenges you. It makes you think, argue back, or sit with an idea.",
      "It moves you sometimes. Art that brings up real emotion is doing its job.",
      "You learn from it and come away more aware of the world."
    ],
    "note": "Two things are true here and they pull against each other. A film or a book is never the urgent thing, so it loses to everything else unless you make room for it. And it's easy to end up working through a list instead of watching anything. Make the room; then let it just be the evening."
  },
  "adventure-experiences": {
    "description": "Novelty, travel, firsts.",
    "guidelines": [
      "Something is on the calendar to look forward to. Anticipation is a big share of the total enjoyment.",
      "Newness shows up at every scale. Unfamiliar routes, foods, and skills register like trips do.",
      "Now and then you pick the slightly uncomfortable option. Novelty is what stretches time, not comfort."
    ],
    "note": "Two things are true here and they pull against each other. Trips and firsts don't happen unless somebody puts a date on them, so this is one place the calendar genuinely helps. But an experience you're working through is a different experience from one you're having. Put it in the diary, then let it be what it turns out to be."
  }
};
