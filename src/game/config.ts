/** The rules advance in fixed steps so a raid plays the same at any frame rate. */
export const SIM_STEP = 1 / 60;

/** At most this many seconds of simulation per frame, so a stalled tab doesn't fast-forward. */
export const MAX_FRAME_SECONDS = 0.1;

/** Seconds between the raid ending and the results screen. */
export const RESULTS_DELAY = 1.8;

/** Defenses closer than this pull the camera back to show the fight. */
export const COMBAT_ZOOM_DISTANCE = 26;

/** Cameras look north-east from over the landing beach, so square buildings read as diamonds. */
export const VIEW_YAW = -Math.PI / 4;
