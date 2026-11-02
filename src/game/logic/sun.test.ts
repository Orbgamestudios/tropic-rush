import { describe, expect, it } from "vitest";
import {
  guessPlace,
  moonName,
  moonPhase,
  moonPosition,
  sunPosition,
  sunRising,
  sunTimes,
} from "./sun";

const LONDON = { lat: 51.5, lon: -0.13 };
const NEW_YORK = { lat: 40.71, lon: -74.01 };
const SYDNEY = { lat: -33.87, lon: 151.21 };
const TROMSO = { lat: 69.65, lon: 18.96 };

const utc = (text: string) => Date.parse(`${text}Z`);
const minutesApart = (a: number | null, b: number) => Math.abs((a ?? 0) - b) / 60_000;

describe("the sun", () => {
  it("stands overhead at the equator on the equinox", () => {
    const noon = sunPosition(utc("2024-03-20T12:07:00"), { lat: 0, lon: 0 });
    expect(noon.elevation).toBeGreaterThan(89);
  });

  it("reaches the height it should at noon", () => {
    expect(sunPosition(utc("2024-06-20T12:01:00"), LONDON).elevation).toBeCloseTo(62, 0);
    expect(sunPosition(utc("2024-12-21T11:58:00"), LONDON).elevation).toBeCloseTo(15, 0);
  });

  it("is due south at northern noon and due north at southern noon", () => {
    expect(sunPosition(utc("2024-06-20T12:01:00"), LONDON).azimuth).toBeCloseTo(180, -1);
    const sydney = sunPosition(utc("2024-06-20T01:57:00"), SYDNEY).azimuth;
    expect(Math.min(sydney, 360 - sydney)).toBeLessThan(5);
  });

  it("rises in the east and sets in the west", () => {
    expect(sunPosition(utc("2024-03-20T06:00:00"), { lat: 0, lon: 0 }).azimuth).toBeCloseTo(90, -1);
    expect(sunPosition(utc("2024-03-20T18:15:00"), { lat: 0, lon: 0 }).azimuth).toBeCloseTo(
      270,
      -1,
    );
  });

  it("knows when it's climbing", () => {
    expect(sunRising(utc("2024-06-20T08:00:00"), LONDON)).toBe(true);
    expect(sunRising(utc("2024-06-20T16:00:00"), LONDON)).toBe(false);
  });

  it("rises and sets within a couple of minutes of the almanac", () => {
    const london = sunTimes(utc("2024-06-20T00:00:00"), LONDON);
    expect(minutesApart(london.rise, utc("2024-06-20T03:43:00"))).toBeLessThan(3);
    expect(minutesApart(london.set, utc("2024-06-20T20:21:00"))).toBeLessThan(3);
    const newYork = sunTimes(utc("2024-12-21T05:00:00"), NEW_YORK);
    expect(minutesApart(newYork.rise, utc("2024-12-21T12:17:00"))).toBeLessThan(3);
    expect(minutesApart(newYork.set, utc("2024-12-21T21:32:00"))).toBeLessThan(3);
  });

  it("has no sunset in the midnight sun and no sunrise in the polar night", () => {
    const summer = sunTimes(utc("2024-06-20T00:00:00"), TROMSO);
    expect(summer).toEqual({ rise: null, set: null });
    const winter = sunTimes(utc("2024-12-21T00:00:00"), TROMSO);
    expect(winter).toEqual({ rise: null, set: null });
  });

  it("follows the moon's phases through a real month", () => {
    expect(moonPhase(utc("2024-04-08T18:21:00")).lit).toBeLessThan(0.01);
    expect(moonPhase(utc("2024-04-23T23:49:00")).lit).toBeGreaterThan(0.99);
    const firstQuarter = moonPhase(utc("2024-04-15T19:13:00"));
    expect(firstQuarter.lit).toBeCloseTo(0.5, 1);
    expect(firstQuarter.waxing).toBe(true);
    const lastQuarter = moonPhase(utc("2024-05-01T11:27:00"));
    expect(lastQuarter.lit).toBeCloseTo(0.5, 1);
    expect(lastQuarter.waxing).toBe(false);
  });

  it("puts the moon over the sun in an eclipse, and opposite it when full", () => {
    const dallas = { lat: 32.78, lon: -96.8 };
    const eclipse = utc("2024-04-08T18:40:00");
    const sun = sunPosition(eclipse, dallas);
    const moon = moonPosition(eclipse, dallas);
    expect(Math.abs(sun.elevation - moon.elevation)).toBeLessThan(2);
    expect(Math.abs(sun.azimuth - moon.azimuth)).toBeLessThan(3);

    const full = utc("2024-04-23T23:49:00");
    const atFull = { sun: sunPosition(full, NEW_YORK), moon: moonPosition(full, NEW_YORK) };
    expect(Math.abs(atFull.sun.elevation + atFull.moon.elevation)).toBeLessThan(6);
    expect(Math.abs(Math.abs(atFull.sun.azimuth - atFull.moon.azimuth) - 180)).toBeLessThan(6);
  });

  it("names the moon", () => {
    expect(moonName({ lit: 0, waxing: true })).toBe("New moon");
    expect(moonName({ lit: 0.2, waxing: true })).toBe("Waxing crescent");
    expect(moonName({ lit: 0.5, waxing: true })).toBe("First quarter");
    expect(moonName({ lit: 0.5, waxing: false })).toBe("Last quarter");
    expect(moonName({ lit: 0.8, waxing: false })).toBe("Waning gibbous");
    expect(moonName({ lit: 1, waxing: false })).toBe("Full moon");
  });

  it("guesses a place from the clock alone", () => {
    // Los Angeles: UTC-8 in January and UTC-7 in July.
    expect(guessPlace(480, 420)).toEqual({ lat: 40, lon: -120 });
    // Sydney: clocks go forward in January.
    expect(guessPlace(-660, -600)).toEqual({ lat: -35, lon: 150 });
    // Tokyo: no change all year.
    expect(guessPlace(-540, -540)).toEqual({ lat: 20, lon: 135 });
  });
});
