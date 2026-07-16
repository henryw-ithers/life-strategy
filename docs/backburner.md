# Backburner

Ideas deliberately parked — recorded so they aren't lost, with the
concerns that parked them.

## Rosy retrospection: softening past scores

*Parked 2026-07-15.*

**The idea:** over time, slightly boost past scores at random —
mirroring how human memory genuinely works (rosy retrospection /
fading affect bias). A hard month, viewed from a year away, shouldn't
sting the way it did in the moment.

**Why it's parked, not rejected:** the insight is good; the mechanism
as stated has problems worth solving first:

- **It corrupts the calibration experiment.** ADR-0008 needs true
  grades to correlate against felt contentment; silently inflated
  grades poison the ground truth.
- **It breaks reproducible history**, the principle the entire data
  model (ADR-0002) is built on.
- **It risks all trust in the log.** If a user notices numbers
  drifting upward, every number becomes suspect — and the "log of your
  life" is only valuable while the log is true.

**The likely honest version (presentation-layer kindness):** keep
stored grades true; render distance softly. Older periods display as
coarser, kinder summaries ("a solid week" instead of "71"); zoomed-out
views foreground trends, bests, and special days rather than
individual low numbers; year-in-review reads like memory does, not
like an audit. Same emotional effect, no falsified data. Partially
adopted already in vision.md ("Scores are guidelines, not judgments");
the fuller treatment (grade "fading" into display bands with age)
stays here until the core loop ships.
