/**
 * Parts of the app set aside for now, with their data and code kept so
 * they can come back.
 *
 * **Windows and working hours are off for launch** (ADR-0051). Every
 * day has no windows, so Today shows it in parts (Morning,
 * Afternoon, Evening, Night, Anytime). The hours tables stay, unread by
 * any screen; the commitment share reads the default hours.
 */
export const WINDOWS = false;

/**
 * **The contentment check-in is archived** (ADR-0052). The weekly
 * question isn't asked anywhere and Calibration leaves Settings; stored
 * answers and the code stay, so it can come back.
 */
export const CONTENTMENT = false;
