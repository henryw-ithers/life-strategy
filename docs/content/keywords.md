# Activity keyword map

**Source of truth.** `npm run content:build` regenerates
`apps/mobile/src/content/tagKeywords.ts`.

When you log an activity, its title is matched against these words to
*suggest* unit tags (ADR-0009 §1). Suggestions only — the user always
confirms or edits before logging, so a wrong guess costs a tap, never
a wrong record.

## Format

    ## <unit-id> — <Display name>

    word, another word, a phrase

Comma-separated, lowercase. Multi-word phrases are fine ("meal prep",
"road trip"). A word may appear under several units — "golf" suggests
both Exercise & fitness and Friendship, which is the point.

## Adding words

Bias toward how people actually write a log entry, not toward
completeness. "shipped" earns its place under Job/career because people
type it; "employment" does not because nobody logs that.

---

## significant-other — Significant other

date, partner, wife, husband, girlfriend, boyfriend, anniversary

## family — Family

family, mum, mom, dad, parents, brother, sister, grandma, grandpa, cousin, kids

## friendship — Friendship

friend, friends, mate, mates, catch up, catchup, hangout, party, golf, pub, dinner with

## exercise-fitness — Exercise & fitness

run, running, gym, workout, lift, lifting, swim, cycling, bike, hike, walk, golf, tennis, football, soccer, basketball, climb, yoga, sport

## nutrition — Nutrition

cook, cooking, meal prep, mealprep, recipe, baking, baked

## sleep-recovery — Sleep & recovery

nap, early night, sauna, massage, stretch

## mental-health — Mental & emotional health

journal, journaling, therapy, therapist, meditate, meditation, breathwork

## spirituality — Spirituality

pray, prayer, church, mass, worship, meditate, meditation, gratitude, retreat

## giving-service — Giving & service

volunteer, volunteering, helped, helping, donate, donation, charity

## job-career — Job/career

work, shipped, presentation, interview, networking, side project

## education-learning — Learning & growth

read, reading, course, study, studied, learn, learned, learning, lecture, practice

## finances — Finances

budget, budgeting, invest, investing, taxes, finances

## living-space — Living space

clean, cleaning, tidy, tidied, organize, organized, declutter, diy, garden

## nature-surroundings — Nature

hike, hiking, walk, park, beach, nature, outdoors, camping, sunrise, sunset

## hygiene — Hygiene

shower, shave, shaved, haircut, hair cut, barber, floss, flossed, dentist, skincare, laundry, washing, groom, grooming, nails

## hobbies-interests — Hobbies & projects

paint, painting, draw, drawing, guitar, piano, music practice, project, craft, chess, photography, wrote, writing

## art-media — Art & media

movie, film, cinema, concert, gig, museum, gallery, album, book, podcast, game, gaming, show, theatre

## adventure-experiences — Adventure & experiences

trip, travel, flight, roadtrip, road trip, explore, new place, first time, adventure
