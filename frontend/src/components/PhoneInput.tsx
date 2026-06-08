'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Country data — all UN-recognised states (Israel excluded)
// Gulf / frequently-used countries pinned at top, rest alphabetical
// ─────────────────────────────────────────────────────────────────────────────

interface Country {
  name: string;
  iso: string;  // ISO 3166-1 alpha-2
  dial: string; // e.g. "+971"
}

const PINNED: Country[] = [
  { name: 'United Arab Emirates', iso: 'AE', dial: '+971' },
  { name: 'Saudi Arabia',         iso: 'SA', dial: '+966' },
  { name: 'Kuwait',               iso: 'KW', dial: '+965' },
  { name: 'Qatar',                iso: 'QA', dial: '+974' },
  { name: 'Bahrain',              iso: 'BH', dial: '+973' },
  { name: 'Oman',                 iso: 'OM', dial: '+968' },
  { name: 'Jordan',               iso: 'JO', dial: '+962' },
  { name: 'Lebanon',              iso: 'LB', dial: '+961' },
  { name: 'Egypt',                iso: 'EG', dial: '+20'  },
  { name: 'India',                iso: 'IN', dial: '+91'  },
  { name: 'Pakistan',             iso: 'PK', dial: '+92'  },
  { name: 'Philippines',          iso: 'PH', dial: '+63'  },
  { name: 'United Kingdom',       iso: 'GB', dial: '+44'  },
  { name: 'United States',        iso: 'US', dial: '+1'   },
];

const PINNED_ISOS = new Set(PINNED.map(c => c.iso));

const ALL_COUNTRIES: Country[] = [
  { name: 'Afghanistan',                        iso: 'AF', dial: '+93'   },
  { name: 'Albania',                            iso: 'AL', dial: '+355'  },
  { name: 'Algeria',                            iso: 'DZ', dial: '+213'  },
  { name: 'Andorra',                            iso: 'AD', dial: '+376'  },
  { name: 'Angola',                             iso: 'AO', dial: '+244'  },
  { name: 'Antigua and Barbuda',                iso: 'AG', dial: '+1268' },
  { name: 'Argentina',                          iso: 'AR', dial: '+54'   },
  { name: 'Armenia',                            iso: 'AM', dial: '+374'  },
  { name: 'Australia',                          iso: 'AU', dial: '+61'   },
  { name: 'Austria',                            iso: 'AT', dial: '+43'   },
  { name: 'Azerbaijan',                         iso: 'AZ', dial: '+994'  },
  { name: 'Bahamas',                            iso: 'BS', dial: '+1242' },
  { name: 'Bangladesh',                         iso: 'BD', dial: '+880'  },
  { name: 'Barbados',                           iso: 'BB', dial: '+1246' },
  { name: 'Belarus',                            iso: 'BY', dial: '+375'  },
  { name: 'Belgium',                            iso: 'BE', dial: '+32'   },
  { name: 'Belize',                             iso: 'BZ', dial: '+501'  },
  { name: 'Benin',                              iso: 'BJ', dial: '+229'  },
  { name: 'Bhutan',                             iso: 'BT', dial: '+975'  },
  { name: 'Bolivia',                            iso: 'BO', dial: '+591'  },
  { name: 'Bosnia and Herzegovina',             iso: 'BA', dial: '+387'  },
  { name: 'Botswana',                           iso: 'BW', dial: '+267'  },
  { name: 'Brazil',                             iso: 'BR', dial: '+55'   },
  { name: 'Brunei',                             iso: 'BN', dial: '+673'  },
  { name: 'Bulgaria',                           iso: 'BG', dial: '+359'  },
  { name: 'Burkina Faso',                       iso: 'BF', dial: '+226'  },
  { name: 'Burundi',                            iso: 'BI', dial: '+257'  },
  { name: 'Cambodia',                           iso: 'KH', dial: '+855'  },
  { name: 'Cameroon',                           iso: 'CM', dial: '+237'  },
  { name: 'Canada',                             iso: 'CA', dial: '+1'    },
  { name: 'Cape Verde',                         iso: 'CV', dial: '+238'  },
  { name: 'Central African Republic',           iso: 'CF', dial: '+236'  },
  { name: 'Chad',                               iso: 'TD', dial: '+235'  },
  { name: 'Chile',                              iso: 'CL', dial: '+56'   },
  { name: 'China',                              iso: 'CN', dial: '+86'   },
  { name: 'Colombia',                           iso: 'CO', dial: '+57'   },
  { name: 'Comoros',                            iso: 'KM', dial: '+269'  },
  { name: 'Congo (Republic)',                   iso: 'CG', dial: '+242'  },
  { name: 'Congo (DR)',                         iso: 'CD', dial: '+243'  },
  { name: 'Costa Rica',                         iso: 'CR', dial: '+506'  },
  { name: 'Croatia',                            iso: 'HR', dial: '+385'  },
  { name: 'Cuba',                               iso: 'CU', dial: '+53'   },
  { name: 'Cyprus',                             iso: 'CY', dial: '+357'  },
  { name: 'Czech Republic',                     iso: 'CZ', dial: '+420'  },
  { name: 'Denmark',                            iso: 'DK', dial: '+45'   },
  { name: 'Djibouti',                           iso: 'DJ', dial: '+253'  },
  { name: 'Dominica',                           iso: 'DM', dial: '+1767' },
  { name: 'Dominican Republic',                 iso: 'DO', dial: '+1809' },
  { name: 'Ecuador',                            iso: 'EC', dial: '+593'  },
  { name: 'El Salvador',                        iso: 'SV', dial: '+503'  },
  { name: 'Equatorial Guinea',                  iso: 'GQ', dial: '+240'  },
  { name: 'Eritrea',                            iso: 'ER', dial: '+291'  },
  { name: 'Estonia',                            iso: 'EE', dial: '+372'  },
  { name: 'Eswatini',                           iso: 'SZ', dial: '+268'  },
  { name: 'Ethiopia',                           iso: 'ET', dial: '+251'  },
  { name: 'Fiji',                               iso: 'FJ', dial: '+679'  },
  { name: 'Finland',                            iso: 'FI', dial: '+358'  },
  { name: 'France',                             iso: 'FR', dial: '+33'   },
  { name: 'Gabon',                              iso: 'GA', dial: '+241'  },
  { name: 'Gambia',                             iso: 'GM', dial: '+220'  },
  { name: 'Georgia',                            iso: 'GE', dial: '+995'  },
  { name: 'Germany',                            iso: 'DE', dial: '+49'   },
  { name: 'Ghana',                              iso: 'GH', dial: '+233'  },
  { name: 'Greece',                             iso: 'GR', dial: '+30'   },
  { name: 'Grenada',                            iso: 'GD', dial: '+1473' },
  { name: 'Guatemala',                          iso: 'GT', dial: '+502'  },
  { name: 'Guinea',                             iso: 'GN', dial: '+224'  },
  { name: 'Guinea-Bissau',                      iso: 'GW', dial: '+245'  },
  { name: 'Guyana',                             iso: 'GY', dial: '+592'  },
  { name: 'Haiti',                              iso: 'HT', dial: '+509'  },
  { name: 'Honduras',                           iso: 'HN', dial: '+504'  },
  { name: 'Hungary',                            iso: 'HU', dial: '+36'   },
  { name: 'Iceland',                            iso: 'IS', dial: '+354'  },
  { name: 'Indonesia',                          iso: 'ID', dial: '+62'   },
  { name: 'Iran',                               iso: 'IR', dial: '+98'   },
  { name: 'Iraq',                               iso: 'IQ', dial: '+964'  },
  { name: 'Ireland',                            iso: 'IE', dial: '+353'  },
  { name: 'Italy',                              iso: 'IT', dial: '+39'   },
  { name: 'Ivory Coast',                        iso: 'CI', dial: '+225'  },
  { name: 'Jamaica',                            iso: 'JM', dial: '+1876' },
  { name: 'Japan',                              iso: 'JP', dial: '+81'   },
  { name: 'Kazakhstan',                         iso: 'KZ', dial: '+7'    },
  { name: 'Kenya',                              iso: 'KE', dial: '+254'  },
  { name: 'Kiribati',                           iso: 'KI', dial: '+686'  },
  { name: 'Kosovo',                             iso: 'XK', dial: '+383'  },
  { name: 'Kyrgyzstan',                         iso: 'KG', dial: '+996'  },
  { name: 'Laos',                               iso: 'LA', dial: '+856'  },
  { name: 'Latvia',                             iso: 'LV', dial: '+371'  },
  { name: 'Lesotho',                            iso: 'LS', dial: '+266'  },
  { name: 'Liberia',                            iso: 'LR', dial: '+231'  },
  { name: 'Libya',                              iso: 'LY', dial: '+218'  },
  { name: 'Liechtenstein',                      iso: 'LI', dial: '+423'  },
  { name: 'Lithuania',                          iso: 'LT', dial: '+370'  },
  { name: 'Luxembourg',                         iso: 'LU', dial: '+352'  },
  { name: 'Madagascar',                         iso: 'MG', dial: '+261'  },
  { name: 'Malawi',                             iso: 'MW', dial: '+265'  },
  { name: 'Malaysia',                           iso: 'MY', dial: '+60'   },
  { name: 'Maldives',                           iso: 'MV', dial: '+960'  },
  { name: 'Mali',                               iso: 'ML', dial: '+223'  },
  { name: 'Malta',                              iso: 'MT', dial: '+356'  },
  { name: 'Marshall Islands',                   iso: 'MH', dial: '+692'  },
  { name: 'Mauritania',                         iso: 'MR', dial: '+222'  },
  { name: 'Mauritius',                          iso: 'MU', dial: '+230'  },
  { name: 'Mexico',                             iso: 'MX', dial: '+52'   },
  { name: 'Micronesia',                         iso: 'FM', dial: '+691'  },
  { name: 'Moldova',                            iso: 'MD', dial: '+373'  },
  { name: 'Monaco',                             iso: 'MC', dial: '+377'  },
  { name: 'Mongolia',                           iso: 'MN', dial: '+976'  },
  { name: 'Montenegro',                         iso: 'ME', dial: '+382'  },
  { name: 'Morocco',                            iso: 'MA', dial: '+212'  },
  { name: 'Mozambique',                         iso: 'MZ', dial: '+258'  },
  { name: 'Myanmar',                            iso: 'MM', dial: '+95'   },
  { name: 'Namibia',                            iso: 'NA', dial: '+264'  },
  { name: 'Nauru',                              iso: 'NR', dial: '+674'  },
  { name: 'Nepal',                              iso: 'NP', dial: '+977'  },
  { name: 'Netherlands',                        iso: 'NL', dial: '+31'   },
  { name: 'New Zealand',                        iso: 'NZ', dial: '+64'   },
  { name: 'Nicaragua',                          iso: 'NI', dial: '+505'  },
  { name: 'Niger',                              iso: 'NE', dial: '+227'  },
  { name: 'Nigeria',                            iso: 'NG', dial: '+234'  },
  { name: 'North Korea',                        iso: 'KP', dial: '+850'  },
  { name: 'North Macedonia',                    iso: 'MK', dial: '+389'  },
  { name: 'Norway',                             iso: 'NO', dial: '+47'   },
  { name: 'Palestine',                          iso: 'PS', dial: '+970'  },
  { name: 'Palau',                              iso: 'PW', dial: '+680'  },
  { name: 'Panama',                             iso: 'PA', dial: '+507'  },
  { name: 'Papua New Guinea',                   iso: 'PG', dial: '+675'  },
  { name: 'Paraguay',                           iso: 'PY', dial: '+595'  },
  { name: 'Peru',                               iso: 'PE', dial: '+51'   },
  { name: 'Poland',                             iso: 'PL', dial: '+48'   },
  { name: 'Portugal',                           iso: 'PT', dial: '+351'  },
  { name: 'Romania',                            iso: 'RO', dial: '+40'   },
  { name: 'Russia',                             iso: 'RU', dial: '+7'    },
  { name: 'Rwanda',                             iso: 'RW', dial: '+250'  },
  { name: 'Saint Kitts and Nevis',              iso: 'KN', dial: '+1869' },
  { name: 'Saint Lucia',                        iso: 'LC', dial: '+1758' },
  { name: 'Saint Vincent and the Grenadines',   iso: 'VC', dial: '+1784' },
  { name: 'Samoa',                              iso: 'WS', dial: '+685'  },
  { name: 'San Marino',                         iso: 'SM', dial: '+378'  },
  { name: 'Sao Tome and Principe',              iso: 'ST', dial: '+239'  },
  { name: 'Senegal',                            iso: 'SN', dial: '+221'  },
  { name: 'Serbia',                             iso: 'RS', dial: '+381'  },
  { name: 'Seychelles',                         iso: 'SC', dial: '+248'  },
  { name: 'Sierra Leone',                       iso: 'SL', dial: '+232'  },
  { name: 'Singapore',                          iso: 'SG', dial: '+65'   },
  { name: 'Slovakia',                           iso: 'SK', dial: '+421'  },
  { name: 'Slovenia',                           iso: 'SI', dial: '+386'  },
  { name: 'Solomon Islands',                    iso: 'SB', dial: '+677'  },
  { name: 'Somalia',                            iso: 'SO', dial: '+252'  },
  { name: 'South Africa',                       iso: 'ZA', dial: '+27'   },
  { name: 'South Korea',                        iso: 'KR', dial: '+82'   },
  { name: 'South Sudan',                        iso: 'SS', dial: '+211'  },
  { name: 'Spain',                              iso: 'ES', dial: '+34'   },
  { name: 'Sri Lanka',                          iso: 'LK', dial: '+94'   },
  { name: 'Sudan',                              iso: 'SD', dial: '+249'  },
  { name: 'Suriname',                           iso: 'SR', dial: '+597'  },
  { name: 'Sweden',                             iso: 'SE', dial: '+46'   },
  { name: 'Switzerland',                        iso: 'CH', dial: '+41'   },
  { name: 'Syria',                              iso: 'SY', dial: '+963'  },
  { name: 'Taiwan',                             iso: 'TW', dial: '+886'  },
  { name: 'Tajikistan',                         iso: 'TJ', dial: '+992'  },
  { name: 'Tanzania',                           iso: 'TZ', dial: '+255'  },
  { name: 'Thailand',                           iso: 'TH', dial: '+66'   },
  { name: 'Timor-Leste',                        iso: 'TL', dial: '+670'  },
  { name: 'Togo',                               iso: 'TG', dial: '+228'  },
  { name: 'Tonga',                              iso: 'TO', dial: '+676'  },
  { name: 'Trinidad and Tobago',                iso: 'TT', dial: '+1868' },
  { name: 'Tunisia',                            iso: 'TN', dial: '+216'  },
  { name: 'Turkey',                             iso: 'TR', dial: '+90'   },
  { name: 'Turkmenistan',                       iso: 'TM', dial: '+993'  },
  { name: 'Tuvalu',                             iso: 'TV', dial: '+688'  },
  { name: 'Uganda',                             iso: 'UG', dial: '+256'  },
  { name: 'Ukraine',                            iso: 'UA', dial: '+380'  },
  { name: 'Uruguay',                            iso: 'UY', dial: '+598'  },
  { name: 'Uzbekistan',                         iso: 'UZ', dial: '+998'  },
  { name: 'Vanuatu',                            iso: 'VU', dial: '+678'  },
  { name: 'Venezuela',                          iso: 'VE', dial: '+58'   },
  { name: 'Vietnam',                            iso: 'VN', dial: '+84'   },
  { name: 'Yemen',                              iso: 'YE', dial: '+967'  },
  { name: 'Zambia',                             iso: 'ZM', dial: '+260'  },
  { name: 'Zimbabwe',                           iso: 'ZW', dial: '+263'  },
].filter(c => !PINNED_ISOS.has(c.iso)).sort((a, b) => a.name.localeCompare(b.name));

// Ordered list: pinned Gulf/common countries first, then rest alphabetically
export const COUNTRIES: Country[] = [...PINNED, ...ALL_COUNTRIES];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Render a flag emoji from an ISO alpha-2 code */
export function flagEmoji(iso: string): string {
  if (iso === 'XK') return '🇽🇰'; // Kosovo — not in Unicode regional indicators
  return iso
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1F1E0 + c.charCodeAt(0) - 65))
    .join('');
}

/**
 * Parse a stored phone string (e.g. "+971 50 1234567") into { country, local }.
 * Returns undefined country if no match found.
 */
export function parsePhone(stored: string): { country: Country | undefined; local: string } {
  if (!stored) return { country: COUNTRIES.find(c => c.iso === 'AE'), local: '' };

  // Sort by dial-code length descending so "+1868" matches before "+1"
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (stored.startsWith(c.dial + ' ') || stored === c.dial) {
      return { country: c, local: stored.slice(c.dial.length).trimStart() };
    }
  }
  // Fallback: value doesn't start with a known code — treat as local
  return { country: COUNTRIES.find(c => c.iso === 'AE'), local: stored };
}

// ─────────────────────────────────────────────────────────────────────────────
// PhoneInput
// ─────────────────────────────────────────────────────────────────────────────

interface PhoneInputProps {
  value: string;             // stored as "+971 50 1234567"
  onChange: (v: string) => void;
  placeholder?: string;      // number field placeholder, e.g. "50 123 4567"
  label?: string;
  className?: string;
  defaultCountryIso?: string; // default 'AE'
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = '50 123 4567',
  label,
  className,
  defaultCountryIso = 'AE',
}: PhoneInputProps) {
  const parsed = parsePhone(value);
  const defaultCountry = COUNTRIES.find(c => c.iso === defaultCountryIso) ?? COUNTRIES[0];

  const [country, setCountry] = useState<Country>(parsed.country ?? defaultCountry);
  const [local, setLocal] = useState(parsed.local);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search box when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  // Keep internal state in sync if parent resets value to empty
  useEffect(() => {
    if (!value) {
      setLocal('');
    }
  }, [value]);

  const emit = useCallback((c: Country, l: string) => {
    const trimmed = l.trim();
    onChange(trimmed ? `${c.dial} ${trimmed}` : '');
  }, [onChange]);

  const handleCountrySelect = (c: Country) => {
    setCountry(c);
    setOpen(false);
    setSearch('');
    emit(c, local);
  };

  const handleLocalChange = (raw: string) => {
    // Allow digits and spaces only
    const v = raw.replace(/[^\d\s]/g, '');
    setLocal(v);
    emit(country, v);
  };

  const handleClear = () => {
    setLocal('');
    onChange('');
  };

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search) ||
    c.iso.toLowerCase().includes(search.toLowerCase())
  );

  // Separate pinned from rest in filtered results
  const filteredPinned = filtered.filter(c => PINNED_ISOS.has(c.iso));
  const filteredRest    = filtered.filter(c => !PINNED_ISOS.has(c.iso));

  return (
    <div className={cn('w-full', className)}>
      {label && <label className="label">{label}</label>}

      <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all bg-white">

        {/* Country code button */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-2 h-full bg-gray-50 border-r border-gray-300 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 whitespace-nowrap"
          >
            <span className="text-base leading-none">{flagEmoji(country.iso)}</span>
            <span className="text-gray-600 font-mono text-xs">{country.dial}</span>
            <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', open && 'rotate-180')} />
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    ref={searchRef}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Search country or code…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* List */}
              <div className="max-h-60 overflow-y-auto">
                {filteredPinned.length > 0 && (
                  <>
                    {filteredPinned.map(c => (
                      <CountryRow
                        key={c.iso}
                        country={c}
                        selected={c.iso === country.iso}
                        onSelect={handleCountrySelect}
                      />
                    ))}
                    {filteredRest.length > 0 && (
                      <div className="border-t border-gray-100 my-0.5" />
                    )}
                  </>
                )}
                {filteredRest.map(c => (
                  <CountryRow
                    key={c.iso}
                    country={c}
                    selected={c.iso === country.iso}
                    onSelect={handleCountrySelect}
                  />
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-4">No results for "{search}"</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Number input */}
        <input
          type="tel"
          inputMode="numeric"
          className="flex-1 px-3 py-2 text-sm focus:outline-none bg-transparent font-mono"
          value={local}
          onChange={e => handleLocalChange(e.target.value)}
          placeholder={placeholder}
        />

        {/* Clear button */}
        {local && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 px-2 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Hint */}
      {local && (
        <p className="text-[10px] text-gray-400 mt-1 font-mono">
          {country.dial} {local}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Country row in dropdown
// ─────────────────────────────────────────────────────────────────────────────

function CountryRow({
  country,
  selected,
  onSelect,
}: {
  country: Country;
  selected: boolean;
  onSelect: (c: Country) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(country)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-indigo-50 transition-colors',
        selected && 'bg-indigo-50 text-indigo-700 font-medium'
      )}
    >
      <span className="text-base leading-none w-6 text-center">{flagEmoji(country.iso)}</span>
      <span className="flex-1 truncate text-gray-800">{country.name}</span>
      <span className="shrink-0 font-mono text-xs text-gray-400">{country.dial}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only phone display
// ─────────────────────────────────────────────────────────────────────────────

export function PhoneDisplay({ value }: { value?: string | null }) {
  if (!value) return <span className="text-gray-300">—</span>;
  const { country } = parsePhone(value);
  return (
    <a href={`tel:${value.replace(/\s/g, '')}`} className="flex items-center gap-1.5 font-mono text-sm hover:text-indigo-600 transition-colors">
      {country && <span>{flagEmoji(country.iso)}</span>}
      <span>{value}</span>
    </a>
  );
}
