/**
 * v1 tag suggestion (ADR-0009 §1): a plain keyword map from activity
 * title words to unit ids. Suggestions only — the user always confirms
 * or edits the tags before logging.
 */
const KEYWORDS: Record<string, string[]> = {
  "significant-other": ["date", "partner", "wife", "husband", "girlfriend", "boyfriend", "anniversary"],
  family: ["family", "mum", "mom", "dad", "parents", "brother", "sister", "grandma", "grandpa", "cousin", "kids"],
  friendship: ["friend", "friends", "mate", "mates", "catch up", "catchup", "hangout", "party", "golf", "pub", "dinner with"],
  "exercise-fitness": ["run", "running", "gym", "workout", "lift", "lifting", "swim", "cycling", "bike", "hike", "walk", "golf", "tennis", "football", "soccer", "basketball", "climb", "yoga", "sport"],
  nutrition: ["cook", "cooking", "meal prep", "mealprep", "recipe", "baking", "baked"],
  "sleep-recovery": ["nap", "early night", "sauna", "massage", "stretch"],
  "mental-health": ["journal", "journaling", "therapy", "therapist", "meditate", "meditation", "breathwork"],
  spirituality: ["pray", "prayer", "church", "mass", "worship", "meditate", "meditation", "gratitude", "retreat"],
  "giving-service": ["volunteer", "volunteering", "helped", "helping", "donate", "donation", "charity"],
  "job-career": ["work", "shipped", "presentation", "interview", "networking", "side project"],
  "education-learning": ["read", "reading", "course", "study", "studied", "learn", "learned", "learning", "lecture", "practice"],
  finances: ["budget", "budgeting", "invest", "investing", "taxes", "finances"],
  "living-space": ["clean", "cleaning", "tidy", "tidied", "organize", "organized", "declutter", "diy", "garden"],
  "nature-surroundings": ["hike", "hiking", "walk", "park", "beach", "nature", "outdoors", "camping", "sunrise", "sunset"],
  hygiene: ["shower", "shave", "shaved", "haircut", "hair cut", "barber", "floss", "flossed", "dentist", "skincare", "laundry", "washing", "groom", "grooming", "nails"],
  "hobbies-interests": ["paint", "painting", "draw", "drawing", "guitar", "piano", "music practice", "project", "craft", "chess", "photography", "wrote", "writing"],
  "art-media": ["movie", "film", "cinema", "concert", "gig", "museum", "gallery", "album", "book", "podcast", "game", "gaming", "show", "theatre"],
  "adventure-experiences": ["trip", "travel", "flight", "roadtrip", "road trip", "explore", "new place", "first time", "adventure"],
};

/** Up to 3 unit-id suggestions for an activity title, best first. */
export function suggestTags(title: string): string[] {
  const t = title.toLowerCase();
  const scored: { unitId: string; score: number }[] = [];
  for (const [unitId, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const w of words) {
      if (t.includes(w)) score += w.length; // longer matches are stronger signals
    }
    if (score > 0) scored.push({ unitId, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.unitId);
}
