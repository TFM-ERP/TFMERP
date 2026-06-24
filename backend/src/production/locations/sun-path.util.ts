/**
 * Pure NOAA solar-position math (no Nest/Prisma imports, so unit-testable in isolation).
 * Canonical implementation for the sun-path feature; SunPathService validates inputs + adds DB
 * lookups then delegates here. Times are local "HH:MM" using a fixed UTC offset in minutes (tzMin).
 */
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export function dayOfYear(d: Date) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
}
export function gamma(doy: number) { return (2 * Math.PI / 365) * (doy - 1 + 0.5); }
export function eqTime(g: number) {
  return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
}
export function declination(g: number) {
  return 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
}
export function fmt(minutesUtc: number | null, tzMin: number): string | null {
  if (minutesUtc == null || !isFinite(minutesUtc)) return null;
  let m = Math.round(minutesUtc + tzMin);
  m = ((m % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60), mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
export function timeAtElevation(lat: number, lng: number, decl: number, eqtime: number, elevationDeg: number, morning: boolean): number | null {
  const zenith = (90 - elevationDeg) * RAD;
  const latR = lat * RAD;
  const cosH = (Math.cos(zenith) - Math.sin(latR) * Math.sin(decl)) / (Math.cos(latR) * Math.cos(decl));
  if (cosH < -1 || cosH > 1) return null;
  const haDeg = Math.acos(cosH) * DEG;
  return 720 - 4 * (lng + (morning ? haDeg : -haDeg)) - eqtime;
}
export function sunPosition(lat: number, lng: number, date: Date, timeStr: string, tzMin = 240) {
  const [h, m] = (timeStr || '12:00').split(':').map(Number);
  const g = gamma(dayOfYear(date));
  const eqtime = eqTime(g);
  const decl = declination(g);
  const localMin = h * 60 + (m || 0);
  const tst = localMin - tzMin + 4 * lng + eqtime;
  const ha = (tst / 4 - 180) * RAD;
  const latR = lat * RAD;
  const elev = Math.asin(Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha)) * DEG;
  let az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(latR) - Math.tan(decl) * Math.cos(latR)) * DEG;
  az = (az + 180) % 360;
  return { time: timeStr, azimuth: Math.round(az * 10) / 10, elevation: Math.round(elev * 10) / 10 };
}
export function computeSunPath(lat: number, lng: number, date: Date, tzMin = 240) {
  const g = gamma(dayOfYear(date));
  const eqtime = eqTime(g);
  const decl = declination(g);
  const noon = 720 - 4 * lng - eqtime;
  const sunrise = timeAtElevation(lat, lng, decl, eqtime, -0.833, true);
  const sunset = timeAtElevation(lat, lng, decl, eqtime, -0.833, false);
  const civilDawn = timeAtElevation(lat, lng, decl, eqtime, -6, true);
  const civilDusk = timeAtElevation(lat, lng, decl, eqtime, -6, false);
  const goldenAmEnd = timeAtElevation(lat, lng, decl, eqtime, 6, true);
  const goldenPmStart = timeAtElevation(lat, lng, decl, eqtime, 6, false);
  const dayLengthMin = sunrise != null && sunset != null ? Math.round(sunset - sunrise) : null;
  const sunriseStr = fmt(sunrise, tzMin), sunsetStr = fmt(sunset, tzMin), noonStr = fmt(noon, tzMin);
  const riseAz = sunriseStr ? sunPosition(lat, lng, date, sunriseStr, tzMin).azimuth : null;
  const setAz = sunsetStr ? sunPosition(lat, lng, date, sunsetStr, tzMin).azimuth : null;
  const noonElev = noonStr ? sunPosition(lat, lng, date, noonStr, tzMin).elevation : null;
  return {
    date: date.toISOString().slice(0, 10),
    lat, lng, tzOffsetMinutes: tzMin,
    solarNoon: fmt(noon, tzMin),
    sunrise: fmt(sunrise, tzMin),
    sunset: fmt(sunset, tzMin),
    civilDawn: fmt(civilDawn, tzMin),
    civilDusk: fmt(civilDusk, tzMin),
    goldenHourAm: fmt(goldenAmEnd, tzMin),
    goldenHourPm: fmt(goldenPmStart, tzMin),
    dayLength: dayLengthMin != null ? `${Math.floor(dayLengthMin / 60)}h ${dayLengthMin % 60}m` : null,
    declination: Math.round(decl * DEG * 100) / 100,
    sunriseAzimuth: riseAz, sunsetAzimuth: setAz, noonElevation: noonElev,
  };
}
