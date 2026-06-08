import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-07 V2 · Slice 7 — Sun-path / light window.
 * Pure NOAA solar-position math (no external dependency): given a date + lat/lng, compute
 * sunrise, sunset, solar noon, civil twilight, golden-hour boundaries, day length, and the
 * sun's azimuth/elevation at any time. Feeds the recce, schedule gating, and call-sheet autofill.
 * Times are returned as local "HH:MM" using a fixed UTC offset (default +240 = Asia/Dubai).
 */
@Injectable()
export class SunPathService {
  constructor(private prisma: PrismaService) {}

  private readonly RAD = Math.PI / 180;
  private readonly DEG = 180 / Math.PI;

  private dayOfYear(d: Date) {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
  }

  /** Fractional-year angle γ (radians) at solar noon for the day. */
  private gamma(doy: number) { return (2 * Math.PI / 365) * (doy - 1 + 0.5); }

  private eqTime(g: number) {
    return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  }
  private declination(g: number) {
    return 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
      + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  }

  private fmt(minutesUtc: number | null, tzMin: number): string | null {
    if (minutesUtc == null || !isFinite(minutesUtc)) return null;
    let m = Math.round(minutesUtc + tzMin);
    m = ((m % 1440) + 1440) % 1440;
    const hh = Math.floor(m / 60), mm = m % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  /** UTC minutes when the sun is at `elevationDeg`, morning (true) or evening (false). null = never. */
  private timeAtElevation(lat: number, lng: number, decl: number, eqtime: number, elevationDeg: number, morning: boolean): number | null {
    const zenith = (90 - elevationDeg) * this.RAD;
    const latR = lat * this.RAD;
    const cosH = (Math.cos(zenith) - Math.sin(latR) * Math.sin(decl)) / (Math.cos(latR) * Math.cos(decl));
    if (cosH < -1 || cosH > 1) return null; // sun never reaches this elevation today
    const haDeg = Math.acos(cosH) * this.DEG;
    // sunrise/morning uses +HA, sunset/evening uses -HA
    return 720 - 4 * (lng + (morning ? haDeg : -haDeg)) - eqtime;
  }

  /** Full sun-path for a date at a coordinate. */
  compute(lat: number, lng: number, dateStr: string, tzMin = 240) {
    if (lat == null || lng == null) throw new BadRequestException('lat and lng are required.');
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date.getTime())) throw new BadRequestException('Invalid date.');
    const g = this.gamma(this.dayOfYear(date));
    const eqtime = this.eqTime(g);
    const decl = this.declination(g);

    const noon = 720 - 4 * lng - eqtime;
    const sunrise = this.timeAtElevation(lat, lng, decl, eqtime, -0.833, true);
    const sunset = this.timeAtElevation(lat, lng, decl, eqtime, -0.833, false);
    const civilDawn = this.timeAtElevation(lat, lng, decl, eqtime, -6, true);
    const civilDusk = this.timeAtElevation(lat, lng, decl, eqtime, -6, false);
    const goldenAmEnd = this.timeAtElevation(lat, lng, decl, eqtime, 6, true);   // sunrise → +6°
    const goldenPmStart = this.timeAtElevation(lat, lng, decl, eqtime, 6, false); // +6° → sunset
    const dayLengthMin = sunrise != null && sunset != null ? Math.round(sunset - sunrise) : null;

    return {
      date: date.toISOString().slice(0, 10),
      lat, lng, tzOffsetMinutes: tzMin,
      solarNoon: this.fmt(noon, tzMin),
      sunrise: this.fmt(sunrise, tzMin),
      sunset: this.fmt(sunset, tzMin),
      civilDawn: this.fmt(civilDawn, tzMin),
      civilDusk: this.fmt(civilDusk, tzMin),
      goldenHourAm: this.fmt(goldenAmEnd, tzMin),   // morning golden hour: sunrise → this
      goldenHourPm: this.fmt(goldenPmStart, tzMin), // evening golden hour: this → sunset
      dayLength: dayLengthMin != null ? `${Math.floor(dayLengthMin / 60)}h ${dayLengthMin % 60}m` : null,
      declination: Math.round(decl * this.DEG * 100) / 100,
    };
  }

  /** Sun azimuth/elevation at a local clock time (HH:MM) on the date. */
  position(lat: number, lng: number, dateStr: string, timeStr: string, tzMin = 240) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) throw new BadRequestException('Invalid date.');
    const [h, m] = (timeStr || '12:00').split(':').map(Number);
    const g = this.gamma(this.dayOfYear(date));
    const eqtime = this.eqTime(g);
    const decl = this.declination(g);
    const localMin = h * 60 + (m || 0);
    // true solar time (minutes): local − tz + 4*lng + eqtime
    const tst = localMin - tzMin + 4 * lng + eqtime;
    const ha = (tst / 4 - 180) * this.RAD; // hour angle (rad)
    const latR = lat * this.RAD;
    const elev = Math.asin(Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha)) * this.DEG;
    let az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(latR) - Math.tan(decl) * Math.cos(latR)) * this.DEG;
    az = (az + 180) % 360; // 0 = north, clockwise
    return { time: timeStr, azimuth: Math.round(az * 10) / 10, elevation: Math.round(elev * 10) / 10 };
  }

  /** Resolve a project Location's coordinates and compute its sun-path for a date. */
  async forLocation(locationId: string, dateStr: string, tzMin = 240) {
    const loc = await this.prisma.location.findUnique({ where: { id: locationId }, select: { id: true, name: true, lat: true, lng: true } });
    if (!loc) throw new NotFoundException('Location not found.');
    if (loc.lat == null || loc.lng == null) return { locationId, name: loc.name, hasCoords: false };
    return { locationId, name: loc.name, hasCoords: true, ...this.compute(Number(loc.lat), Number(loc.lng), dateStr, tzMin) };
  }

  /**
   * Schedule gating — validate a shoot date against the locked location's availability window
   * and permit status, and return the sun window so EXT scenes land in the right light.
   */
  async gating(locationId: string, dateStr: string, tzMin = 240) {
    const loc = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true, name: true, lat: true, lng: true, shootStart: true, shootEnd: true, permitRequired: true, permitStatus: true, permitExpiry: true },
    });
    if (!loc) throw new NotFoundException('Location not found.');
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) throw new BadRequestException('Invalid date.');

    const gates: { ok: boolean; label: string; detail?: string }[] = [];
    // Availability window
    if (loc.shootStart || loc.shootEnd) {
      const afterStart = !loc.shootStart || date >= new Date(loc.shootStart);
      const beforeEnd = !loc.shootEnd || date <= new Date(loc.shootEnd);
      gates.push({ ok: afterStart && beforeEnd, label: 'Within availability window', detail: `${loc.shootStart ? new Date(loc.shootStart).toLocaleDateString('en-GB') : '—'} → ${loc.shootEnd ? new Date(loc.shootEnd).toLocaleDateString('en-GB') : '—'}` });
    }
    // Permit
    if (loc.permitRequired) {
      const approved = loc.permitStatus === 'APPROVED';
      const notExpired = !loc.permitExpiry || new Date(loc.permitExpiry) >= date;
      gates.push({ ok: approved && notExpired, label: 'Permit approved & valid', detail: `${loc.permitStatus || 'NONE'}${loc.permitExpiry ? ` · exp ${new Date(loc.permitExpiry).toLocaleDateString('en-GB')}` : ''}` });
    }
    const sun = loc.lat != null && loc.lng != null ? this.compute(Number(loc.lat), Number(loc.lng), dateStr, tzMin) : null;

    return {
      locationId, name: loc.name, date: date.toISOString().slice(0, 10),
      cleared: gates.every(g => g.ok),
      gates, sun,
    };
  }
}
