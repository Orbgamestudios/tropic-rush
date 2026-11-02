// Where the real sun and moon are: their height and bearing for a moment and a place on Earth, when
// the sun rises and sets, and how full the moon is, so the game's sky can follow the one outside.
// The formulas are the Astronomical Almanac's low-precision ones, good to about a minute of sunrise
// and about a degree of moon. No engine imports.

const RADIANS = Math.PI / 180;
const DAY_MS = 86_400_000;
/** 12:00 on 1 January 2000, the epoch these formulas count from. */
const J2000_MS = Date.UTC(2000, 0, 1, 12);
/** The middle of the sun as it touches the horizon, once the air has bent its light. */
const HORIZON = -0.833;

export interface Place {
  /** Degrees north. */
  lat: number;
  /** Degrees east. */
  lon: number;
}

export interface SkyPosition {
  /** Degrees above the horizon; negative once it has set. */
  elevation: number;
  /** Compass bearing in degrees: 0 north, 90 east. */
  azimuth: number;
}

interface SkySpot {
  rightAscension: number;
  declination: number;
}

const tiltAt = (days: number) => (23.439 - 0.00000036 * days) * RADIANS;
const daysSinceEpoch = (ms: number) => (ms - J2000_MS) / DAY_MS;

function fromEcliptic(longitude: number, latitude: number, days: number): SkySpot {
  const tilt = tiltAt(days);
  return {
    rightAscension: Math.atan2(
      Math.sin(longitude) * Math.cos(tilt) - Math.tan(latitude) * Math.sin(tilt),
      Math.cos(longitude),
    ),
    declination: Math.asin(
      Math.sin(latitude) * Math.cos(tilt) +
        Math.cos(latitude) * Math.sin(tilt) * Math.sin(longitude),
    ),
  };
}

/** Turns a spot among the stars into where it stands above a place on Earth. */
function above(spot: SkySpot, days: number, place: Place): SkyPosition {
  const { rightAscension, declination } = spot;
  const siderealDegrees = 280.46061837 + 360.98564736629 * days + place.lon;
  const hourAngle = siderealDegrees * RADIANS - rightAscension;
  const lat = place.lat * RADIANS;
  const elevation = Math.asin(
    Math.sin(lat) * Math.sin(declination) +
      Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
  );
  const azimuth = Math.atan2(
    -Math.cos(declination) * Math.sin(hourAngle),
    Math.sin(declination) * Math.cos(lat) -
      Math.cos(declination) * Math.cos(hourAngle) * Math.sin(lat),
  );
  return {
    elevation: elevation / RADIANS,
    azimuth: (((azimuth / RADIANS) % 360) + 360) % 360,
  };
}

/** The sun's longitude along the ecliptic, in radians. */
function sunLongitude(days: number): number {
  const anomaly = (357.529 + 0.98560028 * days) * RADIANS;
  const meanLongitude = 280.459 + 0.98564736 * days;
  return (meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RADIANS;
}

/** The moon's place along and off the ecliptic, in radians. */
function moonEcliptic(days: number): { longitude: number; latitude: number } {
  const meanLongitude = 218.316 + 13.176396 * days;
  const anomaly = (134.963 + 13.064993 * days) * RADIANS;
  const node = (93.272 + 13.22935 * days) * RADIANS;
  return {
    longitude: (meanLongitude + 6.289 * Math.sin(anomaly)) * RADIANS,
    latitude: 5.128 * Math.sin(node) * RADIANS,
  };
}

export function sunPosition(ms: number, place: Place): SkyPosition {
  const days = daysSinceEpoch(ms);
  return above(fromEcliptic(sunLongitude(days), 0, days), days, place);
}

export function moonPosition(ms: number, place: Place): SkyPosition {
  const days = daysSinceEpoch(ms);
  const { longitude, latitude } = moonEcliptic(days);
  return above(fromEcliptic(longitude, latitude, days), days, place);
}

export interface MoonPhase {
  /** How much of the moon's face is lit: 0 at new moon, 1 at full. */
  lit: number;
  /** Whether it's growing towards full. */
  waxing: boolean;
}

export function moonPhase(ms: number): MoonPhase {
  const days = daysSinceEpoch(ms);
  const { longitude, latitude } = moonEcliptic(days);
  const apart = longitude - sunLongitude(days);
  return {
    lit: (1 - Math.cos(latitude) * Math.cos(apart)) / 2,
    waxing: Math.sin(apart) > 0,
  };
}

/** What the moon is called tonight. */
export function moonName({ lit, waxing }: MoonPhase): string {
  if (lit < 0.03) return "New moon";
  if (lit > 0.97) return "Full moon";
  if (lit < 0.35) return `${waxing ? "Waxing" : "Waning"} crescent`;
  if (lit > 0.65) return `${waxing ? "Waxing" : "Waning"} gibbous`;
  return waxing ? "First quarter" : "Last quarter";
}

/** Whether the sun is climbing: mornings get pinker colors than evenings. */
export function sunRising(ms: number, place: Place): boolean {
  return sunPosition(ms + 60_000, place).elevation > sunPosition(ms, place).elevation;
}

export interface SunTimes {
  /** Milliseconds, or null where the sun doesn't rise that day. */
  rise: number | null;
  /** Milliseconds, or null where the sun doesn't set that day. */
  set: number | null;
}

/** The next time, within the search window, that the sun crosses the horizon going this way. */
function crossing(from: number, place: Place, upward: boolean): number | null {
  const step = 600_000;
  const isUp = (ms: number) => sunPosition(ms, place).elevation > HORIZON;
  for (let t = from; t < from + DAY_MS; t += step) {
    if (isUp(t) === upward || isUp(t + step) !== upward) continue;
    let early = t;
    let late = t + step;
    while (late - early > 1000) {
      const middle = (early + late) / 2;
      if (isUp(middle) === upward) late = middle;
      else early = middle;
    }
    return late;
  }
  return null;
}

/** Sunrise and sunset in the 24 hours from `from`. */
export function sunTimes(from: number, place: Place): SunTimes {
  return { rise: crossing(from, place, true), set: crossing(from, place, false) };
}

/**
 * A rough place for a phone that hasn't shared its location: the clock's standard time gives the
 * longitude, and which half of the year clocks go forward gives the hemisphere. Takes the
 * `Date.getTimezoneOffset()` minutes for January and July.
 */
export function guessPlace(januaryOffset: number, julyOffset: number): Place {
  const standard = Math.max(januaryOffset, julyOffset);
  const lat = januaryOffset === julyOffset ? 20 : januaryOffset > julyOffset ? 40 : -35;
  return { lat, lon: -standard / 4 };
}
