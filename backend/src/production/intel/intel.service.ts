import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../../ai/ai.service';

/**
 * Production Intel — the AI "situation room" widget engine.
 *
 * Watches the real world around each project's shoot LOCATIONS and shoot DATES and warns the
 * production team before something stops the day. It fuses THREE keyless structured feeds with
 * an AI synthesis pass:
 *   • Weather   — Open-Meteo forecast (+ geocoding), no key.
 *   • Holidays  — Nager.Date public holidays by ISO country, no key.
 *   • News      — the AI gateway's web-search (regional disruptions: unrest, strikes, road
 *                 closures, major events/festivals, curfews, permits, severe-weather warnings).
 * The AI ranks everything into role-targeted alerts (severity + suggested action) for the
 * Producer, Line Producer, UPM, PM, Location Manager and 2nd Unit Director.
 *
 * Result is cached in-memory for 30 minutes per project (concurrent callers share one in-flight
 * analysis); `refresh` forces a fresh run. Env-swappable to premium keyed feeds later
 * (INTEL_WEATHER_URL / INTEL_HOLIDAYS_URL). Everything degrades gracefully — a dead feed or a
 * missing AI key never throws; the widget still shows whatever could be gathered.
 */

export const INTEL_ROLES = ['PRODUCER', 'LINE_PRODUCER', 'UPM', 'PM', 'LOCATION_MANAGER', 'SECOND_UNIT_DIRECTOR'] as const;
const ROLE_SET = new Set<string>(INTEL_ROLES as unknown as string[]);
const CATEGORIES = new Set(['WEATHER', 'HOLIDAY', 'CIVIL', 'LOGISTICS', 'PERMIT', 'EVENT', 'HEALTH', 'OTHER']);
const SEVERITIES = new Set(['CRITICAL', 'WARNING', 'WATCH', 'INFO']);
const TTL_MS = 30 * 60 * 1000; // 30-minute cache (matches the widget's auto-refresh cadence)

// Countries where the Islamic (Hijri) calendar drives public holidays — we compute Eid/Ramadan/etc.
const MUSLIM_MAJORITY = new Set(['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'EG', 'JO', 'IQ', 'SY', 'PS', 'LB', 'YE', 'LY', 'TN', 'DZ', 'MA', 'MR', 'SD', 'SO', 'DJ', 'KM', 'TR', 'IR', 'PK', 'BD', 'ID', 'MY', 'BN', 'AF', 'KZ', 'KG', 'TJ', 'TM', 'UZ', 'AZ', 'NG', 'SN', 'ML', 'NE']);
// Fixed-date national holidays that the free Nager feed misses (Gulf + Egypt). md = 'MM-DD'.
const NATIONAL_DAYS: Record<string, { md: string; name: string }[]> = {
  AE: [{ md: '12-01', name: 'Commemoration Day (UAE)' }, { md: '12-02', name: 'UAE National Day' }, { md: '12-03', name: 'UAE National Day (holiday)' }, { md: '01-01', name: "New Year's Day" }],
  SA: [{ md: '09-23', name: 'Saudi National Day' }, { md: '02-22', name: 'Saudi Founding Day' }],
  QA: [{ md: '12-18', name: 'Qatar National Day' }],
  KW: [{ md: '02-25', name: 'Kuwait National Day' }, { md: '02-26', name: 'Kuwait Liberation Day' }],
  BH: [{ md: '12-16', name: 'Bahrain National Day' }, { md: '12-17', name: 'Bahrain National Day' }],
  OM: [{ md: '11-18', name: 'Oman National Day' }],
  EG: [{ md: '07-23', name: 'Revolution Day (Egypt)' }, { md: '10-06', name: 'Armed Forces Day (Egypt)' }],
};

type CacheEntry = { at: number; result: any; inFlight?: Promise<any> };

// Compact WMO weather-code → label (Open-Meteo `weather_code`).
const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Heavy showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Severe thunderstorm',
};

@Injectable()
export class IntelService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  private cache = new Map<string, CacheEntry>();

  /** Public entry — cached 30 min; `force` bypasses the cache (the ↻ button). */
  async getIntel(projectId: string, force = false): Promise<any> {
    const now = Date.now();
    const hit = this.cache.get(projectId);
    if (!force && hit && now - hit.at < TTL_MS) {
      return { ...hit.result, ageMinutes: Math.round((now - hit.at) / 60000), ttlMinutes: 30 };
    }
    // Deduplicate concurrent regenerations (AI + web search is slow).
    if (hit?.inFlight) return hit.inFlight;
    const p = this.analyze(projectId)
      .then((result) => { this.cache.set(projectId, { at: Date.now(), result }); return { ...result, ageMinutes: 0, ttlMinutes: 30 }; })
      .catch((e) => {
        const stale = this.cache.get(projectId);
        if (stale?.result) return { ...stale.result, ageMinutes: Math.round((Date.now() - stale.at) / 60000), ttlMinutes: 30, degraded: 'Refresh failed — showing the last result.' };
        return this.emptyResult(projectId, 'Could not analyze right now: ' + String(e?.message || e).slice(0, 160));
      })
      .finally(() => { const c = this.cache.get(projectId); if (c) c.inFlight = undefined; });
    this.cache.set(projectId, { at: hit?.at || 0, result: hit?.result, inFlight: p });
    return p;
  }

  // ── The analysis ────────────────────────────────────────────────────────────
  private async analyze(projectId: string): Promise<any> {
    const project: any = await this.prisma.productionProject.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, projectType: true, shootStartDate: true, shootEndDate: true, productionCountry: { select: { name: true, code: true } } },
    }).catch(() => null);
    const locations: any[] = await (this.prisma as any).location.findMany({
      where: { projectId },
      select: { name: true, country: true, emirate: true, area: true, fullAddress: true, lat: true, lng: true, status: true, shootStart: true, shootEnd: true },
    }).catch(() => []);

    const loc = await this.resolveLocation(project, locations);
    const degraded: string[] = [];

    // No usable location → return a deterministic prompt instead of inviting ungrounded AI guesses.
    if (loc.lat == null && loc.lng == null && !loc.country && !loc.countryCode) {
      return {
        projectId, generatedAt: new Date().toISOString(),
        location: { label: loc.label, country: loc.country, lat: null, lng: null },
        shootWindow: this.windowLabel(project), weather: null, holidays: [], news: [],
        summary: 'No shoot location set — add a location (with dates) to unlock weather, holiday and local-news risk analysis.',
        items: this.normalizeItems([], null, null), degraded: 'no location set',
      };
    }

    const [weather, holidays, news] = await Promise.all([
      loc.lat != null && loc.lng != null ? this.fetchWeather(loc.lat, loc.lng).catch(() => null) : Promise.resolve(null),
      this.gatherHolidays(loc.countryCode).catch(() => null),
      this.fetchNews(loc).catch(() => null),
    ]);
    if (!weather) degraded.push('weather feed unavailable');
    if (!holidays || !holidays.length) degraded.push('no public holidays in range');
    if (!news || !news.length) degraded.push('news feed empty — AI web-search only');

    const synth = await this.synthesize(project, loc, weather, holidays, news).catch((e) => ({ summary: '', items: [], note: String(e?.message || e).slice(0, 160) }));
    if (synth?.note) degraded.push('AI: ' + synth.note);

    return {
      projectId,
      generatedAt: new Date().toISOString(),
      location: { label: loc.label, country: loc.country, lat: loc.lat, lng: loc.lng },
      shootWindow: this.windowLabel(project),
      weather: weather ? { summary: weather.summary, days: weather.days } : null,
      holidays: (holidays || []).slice(0, 8),
      news: (news || []).slice(0, 6),
      summary: synth?.summary || '',
      items: this.normalizeItems(synth?.items, weather, holidays),
      degraded: degraded.length ? degraded.join(' · ') : undefined,
    };
  }

  private emptyResult(projectId: string, note: string) {
    return { projectId, generatedAt: new Date().toISOString(), location: null, weather: null, holidays: [], summary: '', items: [], degraded: note, ageMinutes: 0, ttlMinutes: 30 };
  }

  // ── Location resolution ──────────────────────────────────────────────────────
  private async resolveLocation(project: any, locations: any[]) {
    const now = Date.now();
    const withGeo = locations.filter((l) => l.lat != null && l.lng != null);
    // Prefer a geo-tagged location that is in/near its shoot window; else the first geo-tagged; else any.
    const score = (l: any) => {
      const s = l.shootStart ? new Date(l.shootStart).getTime() : 0;
      const e = l.shootEnd ? new Date(l.shootEnd).getTime() : s;
      if (s && now >= s - 3 * 864e5 && now <= (e || s) + 864e5) return 0; // active/imminent
      if (s && s > now) return Math.abs(s - now); // upcoming (nearer = better)
      return 9e15 + (s ? now - s : 1e14); // past / undated last
    };
    const pick = withGeo.slice().sort((a, b) => score(a) - score(b))[0] || locations[0];

    let lat: number | null = pick?.lat != null ? Number(pick.lat) : null;
    let lng: number | null = pick?.lng != null ? Number(pick.lng) : null;
    let countryCode: string | null = (project?.productionCountry?.code || '').toString().toUpperCase().slice(0, 2) || null;
    const countryName: string = pick?.country || project?.productionCountry?.name || '';
    const label = [pick?.name, pick?.area, pick?.emirate, countryName].filter(Boolean).join(', ') || project?.productionCountry?.name || 'Unknown location';

    // No coordinates on any location → geocode the best place string we have.
    if (lat == null || lng == null) {
      const q = [pick?.fullAddress, pick?.area, pick?.emirate, countryName].filter(Boolean).join(', ') || countryName;
      const geo = q ? await this.geocode(q).catch(() => null) : null;
      if (geo) { lat = geo.lat; lng = geo.lng; if (!countryCode && geo.countryCode) countryCode = geo.countryCode; }
    }
    return { label, country: countryName, lat, lng, countryCode };
  }

  // ── Feeds (keyless) ──────────────────────────────────────────────────────────
  private async geocode(name: string) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
    const j: any = await this.getJson(url, 8000);
    const r = j?.results?.[0];
    if (!r) return null;
    return { lat: Number(r.latitude), lng: Number(r.longitude), countryCode: (r.country_code || '').toUpperCase() || null, name: r.name };
  }

  private async fetchWeather(lat: number, lng: number) {
    const base = process.env.INTEL_WEATHER_URL || 'https://api.open-meteo.com/v1/forecast';
    const url = `${base}?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max&forecast_days=7&timezone=auto`;
    const j: any = await this.getJson(url, 9000);
    const d = j?.daily;
    if (!d?.time?.length) return null;
    const days = d.time.map((date: string, i: number) => ({
      date, code: d.weather_code?.[i], text: WMO[d.weather_code?.[i]] || '—',
      tMax: Math.round(d.temperature_2m_max?.[i]), tMin: Math.round(d.temperature_2m_min?.[i]),
      precipProb: d.precipitation_probability_max?.[i] ?? null, windMax: Math.round(d.wind_speed_10m_max?.[i]),
    }));
    const highs = days.map((x: any) => x.tMax).filter((n: any) => Number.isFinite(n));
    const flags: string[] = [];
    if (days.some((x: any) => x.tMax >= 40)) flags.push('extreme heat (≥40°C)');
    if (days.some((x: any) => x.tMin <= 2)) flags.push('near-freezing nights');
    if (days.some((x: any) => (x.precipProb ?? 0) >= 60 || (x.code >= 61 && x.code <= 99))) flags.push('rain/storms likely');
    if (days.some((x: any) => x.windMax >= 45)) flags.push('high wind (≥45 km/h)');
    const summary = `7-day highs ${highs.length ? Math.min(...highs) + '–' + Math.max(...highs) + '°C' : 'n/a'}${flags.length ? ' · ' + flags.join(', ') : ' · settled'}`;
    return { summary, days };
  }

  /** Holidays = civil (Nager) + Islamic (Umm al-Qura, computed) + Gulf/Egypt national days. All keyless. */
  private async gatherHolidays(cc: string | null) {
    const now = Date.now(), horizon = now + 90 * 864e5, floor = now - 864e5;
    const inRange = (iso: string) => { const t = new Date(iso).getTime(); return t >= floor && t <= horizon; };
    const out: { date: string; name: string }[] = [];

    // 1) Civil/public holidays via Nager (covers most Gregorian-calendar countries; may 404 for the Gulf).
    if (cc) {
      const base = process.env.INTEL_HOLIDAYS_URL || 'https://date.nager.at/api/v3/PublicHolidays';
      const y = new Date().getFullYear();
      const pull = async (yr: number) => (await this.getJson(`${base}/${yr}/${cc}`, 8000).catch(() => null)) as any[] | null;
      for (const h of [ ...((await pull(y)) || []), ...((await pull(y + 1)) || []) ]) {
        if (h?.date && inRange(h.date)) out.push({ date: h.date, name: h.localName && h.localName !== h.name ? `${h.localName} (${h.name})` : (h.name || h.localName) });
      }
    }
    // 2) Islamic (Hijri) holidays for Muslim-majority countries — real Umm al-Qura dates, no key, no AI guess.
    if (cc && MUSLIM_MAJORITY.has(cc)) for (const h of this.islamicHolidays(120)) if (inRange(h.date)) out.push(h);
    // 3) Fixed national days Nager misses (Gulf + Egypt).
    if (cc && NATIONAL_DAYS[cc]) for (const nd of NATIONAL_DAYS[cc]) for (const yr of [new Date().getFullYear(), new Date().getFullYear() + 1]) { const iso = `${yr}-${nd.md}`; if (inRange(iso)) out.push({ date: iso, name: nd.name }); }

    const seen = new Set<string>();
    return out
      .filter((h) => { const k = h.date + '|' + h.name; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /** Major Islamic holidays over the next `days`, from the official Umm al-Qura calendar (ICU, keyless). */
  private islamicHolidays(days: number): { date: string; name: string }[] {
    const TARGETS: Record<string, string> = {
      '9-1': 'Ramadan begins (reduced/night hours, iftar breaks)',
      '10-1': 'Eid al-Fitr (multi-day public holiday)',
      '12-9': 'Day of Arafah',
      '12-10': 'Eid al-Adha (multi-day public holiday)',
      '1-1': 'Islamic New Year (Hijri)',
      '3-12': 'Mawlid al-Nabi (Prophet’s Birthday)',
    };
    const out: { date: string; name: string }[] = [];
    let fmt: Intl.DateTimeFormat;
    try { fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch { return out; }
    const seen = new Set<string>();
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() + i * 864e5);
      try {
        const parts = fmt.formatToParts(d);
        const mo = Number(parts.find((p) => p.type === 'month')?.value);
        const day = Number(parts.find((p) => p.type === 'day')?.value);
        const key = `${mo}-${day}`;
        if (TARGETS[key] && !seen.has(key)) { seen.add(key); out.push({ date: d.toISOString().slice(0, 10), name: TARGETS[key] }); }
      } catch { /* ICU without umalqura — skip */ }
    }
    return out;
  }

  /** Keyless local-news feed — Google News RSS by default (broad, reliable); GDELT when INTEL_NEWS_URL points at it. */
  private async fetchNews(loc: any): Promise<{ title: string; domain: string; date: string }[] | null> {
    const place = String(loc?.country || loc?.label || '').split(',')[0].trim();
    if (!place) return null;
    const terms = '(weather OR storm OR flood OR heatwave OR sandstorm OR protest OR strike OR "road closure" OR curfew OR festival OR holiday OR unrest OR advisory OR closure)';
    const base = process.env.INTEL_NEWS_URL || '';
    try {
      // GDELT JSON path (only if explicitly configured).
      if (base.includes('gdelt')) {
        const url = `${base}?query=${encodeURIComponent(`${place} ${terms}`)}&mode=ArtList&maxrecords=15&sort=DateDesc&timespan=21d&format=json`;
        const j: any = await this.getJson(url, 9000);
        return this.dedupeNews((j?.articles || []).map((a: any) => ({ title: String(a.title || ''), domain: String(a.domain || ''), date: String(a.seendate || '').slice(0, 8) })));
      }
      // Google News RSS (default) — parse <item> titles + source.
      const rssBase = base || 'https://news.google.com/rss/search';
      const url = `${rssBase}?q=${encodeURIComponent(`${place} ${terms} when:21d`)}&hl=en-US&gl=US&ceid=US:en`;
      const xml = await this.getText(url, 9000);
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15).map((m) => {
        const blk = m[1];
        const title = (blk.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || ['', ''])[1].trim();
        const src = (blk.match(/<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/) || ['', ''])[1].trim();
        const pub = (blk.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || ['', ''])[1].trim();
        const clean = src && title.endsWith(' - ' + src) ? title.slice(0, -(src.length + 3)) : title; // Google titles are "Headline - Source"
        let date = ''; try { date = pub ? new Date(pub).toISOString().slice(0, 10) : ''; } catch { /* */ }
        return { title: clean.slice(0, 160), domain: src, date };
      });
      return this.dedupeNews(items);
    } catch { return null; }
  }

  private dedupeNews(items: { title: string; domain: string; date: string }[]) {
    const seen = new Set<string>();
    const out = items.filter((a) => a.title && !seen.has(a.title) && !!seen.add(a.title)).slice(0, 10);
    return out.length ? out : null;
  }

  private async getText(url: string, timeoutMs: number): Promise<string> {
    const ctrl: any = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer: any = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch { /* */ } }, timeoutMs) : null;
    try { const res: any = await fetch(url, { signal: ctrl?.signal } as any); if (!res.ok) throw new Error('HTTP ' + res.status); return await res.text(); }
    finally { if (timer) clearTimeout(timer); }
  }

  // ── AI synthesis (+ web-search news) ─────────────────────────────────────────
  private async synthesize(project: any, loc: any, weather: any, holidays: any, news: any) {
    const roles = INTEL_ROLES.join(', ');
    const ctx = [
      `PROJECT: ${project?.title || 'Untitled'} (${project?.projectType || 'production'}).`,
      `SHOOT WINDOW: ${this.windowLabel(project) || 'dates TBC'}.`,
      `PRIMARY LOCATION: ${loc.label}${loc.lat != null ? ` [${loc.lat.toFixed?.(3)}, ${loc.lng.toFixed?.(3)}]` : ''}.`,
      weather ? `WEATHER (next 7 days): ${weather.summary}. Daily: ${weather.days.map((d: any) => `${d.date.slice(5)} ${d.text} ${d.tMin}/${d.tMax}°C${d.precipProb != null ? ` ${d.precipProb}%rain` : ''}${d.windMax >= 35 ? ` wind${d.windMax}` : ''}`).join('; ')}.` : 'WEATHER: unavailable.',
      holidays?.length ? `UPCOMING PUBLIC HOLIDAYS (incl. computed Islamic Umm al-Qura dates): ${holidays.map((h: any) => `${h.date} ${h.name}`).join('; ')}.` : 'PUBLIC HOLIDAYS: none in range — still infer local/religious holidays yourself.',
      news?.length ? `RECENT LOCAL NEWS HEADLINES (last ~3 weeks, via GDELT — corroborate, keep only production-relevant items, and add anything you find via web search):\n${news.map((n: any) => `- ${n.title}${n.domain ? ` [${n.domain}]` : ''}`).join('\n')}` : 'LOCAL NEWS FEED: none returned — rely on your own web search for local news.',
    ].join('\n');

    const system = `You are the early-warning "situation room" analyst for a film production, working for the Line Producer. Given a shoot location and window, weather, and public holidays — and by SEARCHING THE WEB for current local conditions — identify anything in the real world that could DELAY, DISRUPT, INCREASE THE COST OF, or STOP filming at that location during the shoot window.
Consider: severe/extreme weather, public holidays & weekend/prayer closures, civil unrest/protests/strikes, road closures & transport disruption, major events/festivals/sports that crowd locations or hotels, permit/curfew/filming-restriction changes, security advisories, and health/air-quality advisories.
Web-search for RECENT, location-specific news (last ~30 days and upcoming) — do not invent events.
Return ONLY a JSON object, no prose outside it:
{"summary":"one-sentence headline of the overall picture","items":[{"category":"WEATHER|HOLIDAY|CIVIL|LOGISTICS|PERMIT|EVENT|HEALTH|OTHER","severity":"CRITICAL|WARNING|WATCH|INFO","title":"short label","detail":"1-2 sentences, concrete","window":"when it applies, e.g. 'Fri 12 Jul' or 'this week'","affectedRoles":["one or more of: ${roles}"],"suggestion":"a specific recommended action","source":"publisher or feed name (optional)"}]}
Rules: 4–8 items max, most severe first. Assign each item to the roles who must act (Location Manager for permits/road/site; Line Producer/UPM for cost/schedule/holidays; PM for logistics/transport; 2nd Unit Director for weather/daylight windows; Producer for anything critical). If nothing is notable, return one INFO item saying conditions look clear. Never output an empty items array.`;

    // Prefer a web-search-enabled call (Anthropic) so "news" is real; fall back to feeds-only JSON synthesis.
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const r = await this.ai.raw({
          task: 'production.intel',
          system,
          messages: [{ role: 'user', content: `Analyze production risk for this shoot and return the JSON.\n\n${ctx}` }],
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
          maxTokens: 3000, temperature: 0.2, timeoutMs: 90000, projectId: project?.id,
        });
        const parsed = this.parseJson(r.text);
        if (parsed) return parsed;
      } catch { /* fall through to feeds-only synthesis */ }
    }
    // Feeds-only fallback (no web search): still ranks weather + holidays through the routed model.
    const j = await this.ai.json({
      task: 'production.intel', system: system + '\n(NOTE: web search is unavailable — reason from the weather and holidays provided; flag that live-news coverage is limited.)',
      user: `Analyze production risk for this shoot and return the JSON.\n\n${ctx}`,
      maxTokens: 2500, temperature: 0.2, timeoutMs: 60000, projectId: project?.id,
    }).catch(() => null);
    return j || { summary: '', items: [], note: 'AI unavailable' };
  }

  // ── Normalization + helpers ──────────────────────────────────────────────────
  private normalizeItems(items: any, weather: any, holidays: any): any[] {
    const rank: Record<string, number> = { CRITICAL: 0, WARNING: 1, WATCH: 2, INFO: 3 };
    let list: any[] = Array.isArray(items) ? items : [];
    list = list.map((it, i) => {
      const category = CATEGORIES.has(String(it?.category).toUpperCase()) ? String(it.category).toUpperCase() : 'OTHER';
      const severity = SEVERITIES.has(String(it?.severity).toUpperCase()) ? String(it.severity).toUpperCase() : 'WATCH';
      const affectedRoles = (Array.isArray(it?.affectedRoles) ? it.affectedRoles : [])
        .map((r: any) => String(r).toUpperCase().replace(/\s+/g, '_').replace('2ND_UNIT_DIRECTOR', 'SECOND_UNIT_DIRECTOR'))
        .filter((r: string) => ROLE_SET.has(r));
      return {
        id: 'i' + i,
        category, severity,
        title: String(it?.title || 'Notice').slice(0, 120),
        detail: String(it?.detail || '').slice(0, 400),
        window: String(it?.window || '').slice(0, 60),
        affectedRoles: affectedRoles.length ? affectedRoles : ['LINE_PRODUCER'],
        suggestion: String(it?.suggestion || '').slice(0, 300),
        source: it?.source ? String(it.source).slice(0, 80) : undefined,
      };
    });
    // Safety net: if the model returned nothing, synthesize a baseline from the feeds so the widget is never blank.
    if (!list.length) {
      if (weather?.days?.length) list.push({ id: 'w0', category: 'WEATHER', severity: 'INFO', title: 'Weather outlook', detail: weather.summary, window: 'next 7 days', affectedRoles: ['SECOND_UNIT_DIRECTOR', 'LINE_PRODUCER'], suggestion: 'Plan exterior/daylight-dependent scenes around the forecast.' });
      if (holidays?.length) list.push({ id: 'h0', category: 'HOLIDAY', severity: 'WATCH', title: 'Upcoming public holiday', detail: `${holidays[0].name} on ${holidays[0].date} — expect closures, permit-office downtime and premium crew rates.`, window: holidays[0].date, affectedRoles: ['LINE_PRODUCER', 'UPM'], suggestion: 'Confirm vendor/office availability and any holiday-rate uplift.' });
      if (!list.length) list.push({ id: 'x0', category: 'OTHER', severity: 'INFO', title: 'No signals yet', detail: 'Add a shoot location with coordinates and dates to unlock weather, holiday and local-news risk analysis.', window: '', affectedRoles: ['LINE_PRODUCER'], suggestion: 'Set the shoot location and dates on the project.' });
    }
    return list.sort((a, b) => (rank[a.severity] - rank[b.severity]));
  }

  private windowLabel(project: any): string {
    const s = project?.shootStartDate ? new Date(project.shootStartDate) : null;
    const e = project?.shootEndDate ? new Date(project.shootEndDate) : null;
    const f = (d: Date) => d.toISOString().slice(0, 10);
    if (s && e) return `${f(s)} → ${f(e)}`;
    if (s) return `from ${f(s)}`;
    return '';
  }

  private parseJson(text: string): any {
    if (!text) return null;
    const s = text.indexOf('{'); if (s < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = s; i < text.length; i++) {
      const ch = text[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(text.slice(s, i + 1)); } catch { return null; } } }
    }
    return null;
  }

  private async getJson(url: string, timeoutMs: number): Promise<any> {
    const ctrl: any = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer: any = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch { /* */ } }, timeoutMs) : null;
    try {
      const res: any = await fetch(url, { signal: ctrl?.signal, headers: { accept: 'application/json' } } as any);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally { if (timer) clearTimeout(timer); }
  }
}
