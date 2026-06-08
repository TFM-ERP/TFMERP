// ── Shared dropdown option lists for Company Management ──────────────────────
// Used by the setup wizard and the Company Management pages so values stay
// consistent across the whole system.

export const CLASSIFICATIONS = [
  { value: 'Mainland', label: 'Mainland UAE Company' },
  { value: 'FreeZone', label: 'Free Zone Company' },
  { value: 'Government', label: 'Government Entity' },
  { value: 'Branch', label: 'Branch Office' },
  { value: 'Representative', label: 'Representative Office' },
  { value: 'Other', label: 'Other' },
];

export const EMIRATES = [
  'Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah',
];

// Mainland licensing authorities (Departments of Economic Development).
export const MAINLAND_AUTHORITIES = [
  'Abu Dhabi Department of Economic Development (ADDED)',
  'Dubai Department of Economy & Tourism (DET)',
  'Sharjah Economic Development Department (SEDD)',
  'Ajman Department of Economic Development',
  'Ras Al Khaimah Department of Economic Development',
  'Fujairah Department of Industry & Economy',
  'Umm Al Quwain Department of Economic Development',
  'Other',
];

// Free zone authorities, grouped (Abu Dhabi first, then other emirates).
export const FREE_ZONE_GROUPS: { group: string; options: string[] }[] = [
  {
    group: 'Abu Dhabi Free Zones',
    options: [
      'Yas Creative Hub / twofour54',
      'Abu Dhabi Global Market (ADGM)',
      'Khalifa Economic Zones Abu Dhabi (KEZAD)',
      'Masdar City Free Zone',
      'Abu Dhabi Airports Free Zone (ADAFZ)',
      'Industrial City of Abu Dhabi (ICAD)',
      'ZonesCorp',
      'Hub71',
    ],
  },
  {
    group: 'Other UAE Free Zones',
    options: [
      'DMCC', 'DIFC', 'JAFZA',
      'Dubai Media City', 'Dubai Studio City', 'Dubai Production City',
      'Dubai Internet City', 'Dubai Knowledge Park', 'Dubai Design District (d3)',
      'Dubai Healthcare City', 'Dubai South',
      'IFZA', 'RAKEZ', 'Sharjah Media City', 'Hamriyah Free Zone',
      'Ajman Free Zone', 'Fujairah Free Zone', 'Creative City Fujairah',
      'Umm Al Quwain Free Trade Zone',
    ],
  },
  { group: 'Other', options: ['Other'] },
];

// Flat list of every free zone (for plain selects).
export const FREE_ZONES = FREE_ZONE_GROUPS.flatMap((g) => g.options);

export const LICENSE_TYPES = [
  'Commercial', 'Professional', 'Industrial', 'Tourism',
  'Agricultural', 'Craftsmanship', 'Freelance Permit', 'Service',
  'E-Commerce', 'Heavy Machinery', 'Rental', 'Entertainment', 'Other',
];

export const LICENSE_STATUS = [
  'Active', 'Under Renewal', 'Expired', 'Suspended', 'Cancelled',
];

export const VAT_STATUS = ['Registered', 'Not Registered', 'Exempt', 'Pending'];
export const CORPORATE_TAX_STATUS = ['Registered', 'Not Registered', 'Exempt', 'Pending'];

// Attachment / document types — selection required (with "Other").
export const DOCUMENT_TYPES = [
  'Trade License',
  'Certificate of Incorporation',
  'Company Registration Documents',
  'License Renewals',
  'Amendments',
  'MOHRE Documents',
  'Establishment Card',
  'Immigration Documents',
  'Chamber Registration',
  'Free Zone License',
  'Registration Certificate',
  'VAT Certificate',
  'Corporate Tax Certificate',
  'Insurance Policy',
  'Bank Letter / Confirmation',
  'Other',
];

export const LOCATION_TYPES = [
  'Head Office', 'Warehouse', 'Yard', 'Vehicle Depot', 'Workshop', 'Storage Facility', 'Other',
];

// Which classifications show the Mainland vs Free Zone regulatory blocks.
export const showsMainland = (c?: string) =>
  ['Mainland', 'Government', 'Branch', 'Representative', 'Other', undefined, ''].includes(c);
export const showsFreeZone = (c?: string) =>
  ['FreeZone', 'Branch', 'Representative', 'Other'].includes(c || '');
