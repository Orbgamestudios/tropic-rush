// Where the phone is, for the sky and nothing else. It's rounded to about 10 km, asked for once at
// low accuracy so the GPS stays off, and stays on the phone: see `savePlace`.

import { guessPlace, moonName, moonPhase, type Place, sunTimes } from "./logic/sun";

const DAY_MS = 86_400_000;
const WAIT_MS = 15_000;

const coarse = (degrees: number) => Math.round(degrees * 10) / 10;

/** A rough place from the phone's clock, for when it hasn't shared a better one. */
export function guessedPlace(now = new Date()): Place {
  const year = now.getFullYear();
  return guessPlace(
    new Date(year, 0, 1).getTimezoneOffset(),
    new Date(year, 6, 1).getTimezoneOffset(),
  );
}

/** Asks the phone where it is; null if the player says no or it can't tell. */
export function locate(): Promise<Place | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coarse(coords.latitude), lon: coarse(coords.longitude) }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: DAY_MS, timeout: WAIT_MS },
    );
  });
}

/** The next sunrise and sunset in the phone's own clock format, and the moon, for the settings. */
export function skyText(now: number, place: Place): string {
  const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const { rise, set } = sunTimes(now, place);
  const moon = moonName(moonPhase(now));
  if (rise === null || set === null) return `No sunrise or sunset today · ${moon}`;
  return `Sunrise ${clock(rise)} · Sunset ${clock(set)} · ${moon}`;
}
