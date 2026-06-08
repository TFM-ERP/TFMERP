// Client-side mirror of the backend Visa SLA engine (travel.service.ts VISA_RULES).
// Shared by the standalone Travel page and the per-project TravelPanel.

const SCHENGEN = ['AT','BE','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','SK','SI','ES','SE','CH'];
const GCC = ['AE','SA','BH','KW','OM','QA'];
const EU_EEA = [...SCHENGEN, 'IE','RO','BG','CY'];

export const VISA_RULES: Record<string, { visaType: string; slaDays: number; exempt: string[] }> = {
  US: { visaType: 'US_O1', slaDays: 90, exempt: ['US'] },
  GB: { visaType: 'UK_CREATIVE_WORKER', slaDays: 21, exempt: ['GB', 'IE'] },
  AE: { visaType: 'UAE_EMPLOYMENT', slaDays: 15, exempt: GCC },
  IN: { visaType: 'INDIA_BUSINESS_EVISA', slaDays: 10, exempt: ['IN'] },
};
for (const c of SCHENGEN) VISA_RULES[c] = { visaType: 'SCHENGEN_C', slaDays: 15, exempt: EU_EEA };

export const DESTINATIONS = [
  { label: 'United States', code: 'US' }, { label: 'United Kingdom', code: 'GB' },
  { label: 'France (Schengen)', code: 'FR' }, { label: 'Germany (Schengen)', code: 'DE' },
  { label: 'Spain (Schengen)', code: 'ES' }, { label: 'Italy (Schengen)', code: 'IT' },
  { label: 'United Arab Emirates', code: 'AE' }, { label: 'India', code: 'IN' },
  { label: 'Saudi Arabia', code: 'SA' }, { label: 'Qatar', code: 'QA' }, { label: 'Jordan', code: 'JO' },
  { label: 'Other / no visa', code: '' },
];

export const DOC_LABEL: Record<string, string> = {
  passport: 'Passport scan (bio page)', photo: 'Passport-style photo', LOA: 'Letter of Authorization (LOA)',
  petition: 'USCIS petition (I-129)', certificate_of_sponsorship: 'Certificate of Sponsorship',
  medical: 'Medical certificate', corporate_letter: 'Corporate invitation letter',
  itinerary: 'Confirmed travel itinerary', sponsor_letter: 'Sponsor letter', insurance: 'Travel insurance',
};

export function docsFor(visaType: string): string[] {
  const base = ['passport', 'photo'];
  if (visaType.startsWith('US_')) return [...base, 'LOA', 'petition'];
  if (visaType.startsWith('UK_')) return [...base, 'certificate_of_sponsorship'];
  if (visaType.startsWith('UAE_')) return [...base, 'LOA', 'medical'];
  if (visaType.startsWith('INDIA_')) return [...base, 'LOA', 'corporate_letter', 'itinerary'];
  if (visaType === 'SCHENGEN_C') return [...base, 'itinerary', 'sponsor_letter', 'insurance'];
  return base;
}

export function evalVisa(nationality?: string, destCode?: string) {
  if (!destCode || !nationality) return { required: false as const };
  const nat = nationality.length === 2
    ? nationality.toUpperCase()
    : ({ uae: 'AE', uk: 'GB', usa: 'US', india: 'IN', emirati: 'AE' } as any)[nationality.toLowerCase()] || nationality.toUpperCase();
  const rule = VISA_RULES[destCode];
  if (!rule || rule.exempt.includes(nat)) return { required: false as const };
  return { required: true as const, ...rule, docs: docsFor(rule.visaType) };
}
