/** Sun-path NOAA math — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeSunPath, sunPosition, fmt, declination, gamma, dayOfYear, timeAtElevation } from './sun-path.util';

const DUBAI = { lat: 25.2048, lng: 55.2708, tz: 240 };
const solstice = new Date('2025-06-21T00:00:00Z');

test('fmt() converts UTC minutes + tz offset to HH:MM with wraparound', () => {
  assert.equal(fmt(720, 0), '12:00');
  assert.equal(fmt(0, 0), '00:00');
  assert.equal(fmt(720, 240), '16:00');   // +4h
  assert.equal(fmt(60, -120), '23:00');   // wraps backwards across midnight
  assert.equal(fmt(null, 240), null);
  assert.equal(fmt(Infinity, 0), null);
});

test('declination peaks near +23.44 deg at the June solstice', () => {
  const declDeg = declination(gamma(dayOfYear(solstice))) * (180 / Math.PI);
  assert.ok(Math.abs(declDeg - 23.44) < 0.6, `got ${declDeg}`);
});

test('computeSunPath(Dubai, solstice) is internally consistent', () => {
  const r = computeSunPath(DUBAI.lat, DUBAI.lng, solstice, DUBAI.tz);
  for (const k of ['sunrise', 'sunset', 'solarNoon'] as const) assert.match(r[k] as string, /^\d{2}:\d{2}$/);
  assert.ok((r.sunrise as string) < (r.solarNoon as string), 'sunrise before noon');
  assert.ok((r.solarNoon as string) < (r.sunset as string), 'noon before sunset');
  assert.ok((r.civilDawn as string) < (r.sunrise as string), 'civil dawn before sunrise');
  assert.ok(r.noonElevation! > 80, `near-overhead sun: ${r.noonElevation}`); // |lat-decl| ~ 1.8 deg
  assert.ok(r.sunriseAzimuth! > 0 && r.sunriseAzimuth! < 360);
  assert.match(r.dayLength as string, /^\d+h \d+m$/);
});

test('computeSunPath returns null sun events under the polar midnight sun', () => {
  const r = computeSunPath(78, 15, solstice, 60); // Svalbard, June: sun never sets
  assert.equal(r.sunrise, null);
  assert.equal(r.sunset, null);
  assert.equal(r.dayLength, null);
});

test('sunPosition is deterministic and in-range', () => {
  const a = sunPosition(DUBAI.lat, DUBAI.lng, solstice, '12:00', DUBAI.tz);
  const b = sunPosition(DUBAI.lat, DUBAI.lng, solstice, '12:00', DUBAI.tz);
  assert.deepEqual(a, b);
  assert.ok(a.azimuth >= 0 && a.azimuth <= 360);
  assert.ok(a.elevation >= -90 && a.elevation <= 90);
});

test('timeAtElevation returns null when the sun never reaches the elevation', () => {
  const g = gamma(dayOfYear(solstice)); const decl = declination(g);
  assert.equal(timeAtElevation(89, 0, decl, 0, 6, true), null); // near pole, +6deg unreachable
});
