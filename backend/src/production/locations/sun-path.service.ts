import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { computeSunPath, sunPosition } from './sun-path.util';

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

  // Solar math lives in sun-path.util.ts (pure + unit-tested); this service validates inputs and adds DB lookups.

  /** Full sun-path for a date at a coordinate. */
  compute(lat: number, lng: number, dateStr: string, tzMin = 240) {
    if (lat == null || lng == null) throw new BadRequestException('lat and lng are required.');
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date.getTime())) throw new BadRequestException('Invalid date.');
    return computeSunPath(lat, lng, date, tzMin);
  }

  /** Sun azimuth/elevation at a local clock time (HH:MM) on the date. */
  position(lat: number, lng: number, dateStr: string, timeStr: string, tzMin = 240) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) throw new BadRequestException('Invalid date.');
    return sunPosition(lat, lng, date, timeStr, tzMin);
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

  // ── HTTP helper (timeout-guarded, never throws) ───────────────────────────────
  private async getJson(url: string, opts: any = {}, ms = 10000): Promise<any | null> {
    try {
      const res: any = await Promise.race([fetch(url, opts as any), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
      if (!res || !res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  private wmo(code: any): { icon: string; label: string } {
    const c = Number(code);
    if (c === 0) return { icon: '\u2600\ufe0f', label: 'Clear' };
    if (c === 1 || c === 2) return { icon: '\ud83c\udf24\ufe0f', label: 'Partly cloudy' };
    if (c === 3) return { icon: '\u2601\ufe0f', label: 'Overcast' };
    if (c === 45 || c === 48) return { icon: '\ud83c\udf2b\ufe0f', label: 'Fog' };
    if (c >= 51 && c <= 57) return { icon: '\ud83c\udf26\ufe0f', label: 'Drizzle' };
    if (c >= 61 && c <= 67) return { icon: '\ud83c\udf27\ufe0f', label: 'Rain' };
    if (c >= 71 && c <= 77) return { icon: '\ud83c\udf28\ufe0f', label: 'Snow' };
    if (c >= 80 && c <= 82) return { icon: '\ud83c\udf26\ufe0f', label: 'Showers' };
    if (c >= 95) return { icon: '\u26c8\ufe0f', label: 'Thunder' };
    return { icon: '\ud83c\udf21\ufe0f', label: '\u2014' };
  }
  private compass(deg: any): string {
    const d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return d[Math.round(((Number(deg) || 0) % 360) / 22.5) % 16];
  }

  /** Hourly weather forecast for a coordinate + date (Open-Meteo, free, no key). */
  async weatherForecast(lat: number, lng: number, dateStr: string, tzMin = 240) {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return { ok: false, reason: 'no-coords' };
    const date = (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) ? dateStr.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
      + `&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability`
      + `&daily=temperature_2m_max,temperature_2m_min,uv_index_max,wind_speed_10m_max,precipitation_probability_max`
      + `&timezone=auto&start_date=${date}&end_date=${date}`;
    const d = await this.getJson(url, {}, 10000);
    if (!d || !d.hourly) return { ok: false, reason: 'unavailable' };
    const H = d.hourly; const times: string[] = H.time || [];
    const idxAt = (hr: number) => times.findIndex((t) => new Date(t).getHours() === hr);
    const hours = [6, 9, 12, 15, 18, 20].map((hr) => {
      const i = idxAt(hr); if (i < 0) return null; const w = this.wmo(H.weather_code?.[i]);
      return { h: `${String(hr).padStart(2, '0')}h`, temp: Math.round(H.temperature_2m?.[i]), icon: w.icon, label: w.label, wind: Math.round(H.wind_speed_10m?.[i]), dir: this.compass(H.wind_direction_10m?.[i]) };
    }).filter(Boolean);
    const ni = idxAt(12) >= 0 ? idxAt(12) : 0; const daily = d.daily || {};
    return {
      ok: true, date, provider: 'open-meteo', summary: this.wmo(H.weather_code?.[ni]).label,
      tempHigh: Math.round(daily.temperature_2m_max?.[0]), tempLow: Math.round(daily.temperature_2m_min?.[0]),
      windMax: Math.round(daily.wind_speed_10m_max?.[0]), windDir: this.compass(H.wind_direction_10m?.[ni]),
      precipMax: daily.precipitation_probability_max?.[0] ?? null, uvMax: daily.uv_index_max?.[0] ?? null, hours,
    };
  }

  private haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
    const R = 6371, r = Math.PI / 180; const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }
  private static UAE_HOSPITALS = [
    { name: 'Sheikh Khalifa Medical City', phone: '+97123819000', address: 'Al Karamah St, Abu Dhabi', lat: 24.4539, lng: 54.3776 },
    { name: 'Cleveland Clinic Abu Dhabi', phone: '+97126590200', address: 'Al Maryah Island, Abu Dhabi', lat: 24.4988, lng: 54.3899 },
    { name: 'Mediclinic City Hospital', phone: '+97144359999', address: 'Dubai Healthcare City', lat: 25.2310, lng: 55.3270 },
    { name: 'Rashid Hospital', phone: '+97142192000', address: 'Oud Metha, Dubai', lat: 25.2330, lng: 55.3290 },
    { name: 'Tawam Hospital', phone: '+97137677444', address: 'Al Ain', lat: 24.2600, lng: 55.7100 },
  ];
  private addr(t: any): string {
    return [t['addr:housenumber'], t['addr:street'], t['addr:city'] || t['addr:suburb']].filter(Boolean).join(', ') || t['addr:full'] || '';
  }

  /** Nearest hospitals to a pin (OpenStreetMap/Overpass; curated UAE fallback). Always editable downstream. */
  async hospitalsNear(lat: number, lng: number, radiusKm = 20) {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return { ok: false, items: [] };
    const driveMin = (km: number) => Math.round(km * 1.3 / 50 * 60);
    const around = Math.round(radiusKm * 1000);
    const q = `[out:json][timeout:12];(node["amenity"="hospital"](around:${around},${lat},${lng});way["amenity"="hospital"](around:${around},${lat},${lng}););out center 15;`;
    const d = await this.getJson('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }, 12000);
    if (d && Array.isArray(d.elements)) {
      const items = d.elements.map((el: any) => {
        const t = el.tags || {}; const elat = el.lat ?? el.center?.lat; const elng = el.lon ?? el.center?.lon;
        if (!t.name || elat == null) return null; const km = this.haversine(lat, lng, elat, elng);
        return { name: t.name, phone: t.phone || t['contact:phone'] || null, address: this.addr(t), lat: elat, lng: elng, distanceKm: Math.round(km * 10) / 10, driveMin: driveMin(km), source: 'osm' };
      }).filter(Boolean).sort((a: any, b: any) => a.distanceKm - b.distanceKm).slice(0, 5);
      if (items.length) return { ok: true, provider: 'osm', items };
    }
    const items = SunPathService.UAE_HOSPITALS.map((h) => { const km = this.haversine(lat, lng, h.lat, h.lng); return { ...h, distanceKm: Math.round(km * 10) / 10, driveMin: driveMin(km), source: 'curated' }; })
      .sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3);
    return { ok: true, provider: 'curated', items };
  }
}
