// ── Asset categories & type-driven field configuration ──────────────────────
// Drives which fields, specs and compliance sections show for each asset.
// Not every asset is a vehicle — generators, trailers, equipment etc. each
// expose only the attributes relevant to their category.

export type AssetCategory =
  | 'VEHICLE' | 'GENERATOR' | 'TRAILER' | 'MOBILE_OFFICE' | 'EQUIPMENT' | 'OTHER';

export const CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: 'VEHICLE',       label: 'Vehicle' },
  { value: 'GENERATOR',     label: 'Generator' },
  { value: 'TRAILER',       label: 'Trailer / Caravan' },
  { value: 'MOBILE_OFFICE', label: 'Mobile Office' },
  { value: 'EQUIPMENT',     label: 'Equipment' },
  { value: 'OTHER',         label: 'Other' },
];

// Asset types available per category (the legacy AssetType enum values).
export const TYPES_BY_CATEGORY: Record<AssetCategory, string[]> = {
  VEHICLE:       ['SUPPORT_VEHICLE', 'CREW_TRANSPORT', 'TRUCK', 'TOWING_VEHICLE'],
  GENERATOR:     ['GENERATOR'],
  TRAILER:       ['ARTIST_TRAILER', 'STAR_TRAILER', 'MAKEUP_TRAILER', 'WARDROBE_TRAILER', 'UTILITY_TRAILER'],
  MOBILE_OFFICE: ['MOBILE_TOILET'],
  EQUIPMENT:     ['WATER_TANK', 'WASTE_TANK'],
  OTHER:         ['OTHER'],
};

export const ASSET_TYPE_LABELS: Record<string, string> = {
  ARTIST_TRAILER: 'Artist Trailer', STAR_TRAILER: 'Star Trailer',
  MAKEUP_TRAILER: 'Makeup Trailer', WARDROBE_TRAILER: 'Wardrobe Trailer',
  MOBILE_TOILET: 'Mobile Toilet', GENERATOR: 'Generator',
  WATER_TANK: 'Water Tank', WASTE_TANK: 'Waste Tank',
  SUPPORT_VEHICLE: 'Support Vehicle', CREW_TRANSPORT: 'Crew Transport',
  UTILITY_TRAILER: 'Utility Trailer', TRUCK: 'Truck',
  TOWING_VEHICLE: 'Towing Vehicle', OTHER: 'Other',
};

// Infer a category from a legacy asset type (for existing records).
export function categoryForType(t?: string): AssetCategory {
  if (!t) return 'OTHER';
  for (const cat of Object.keys(TYPES_BY_CATEGORY) as AssetCategory[]) {
    if (TYPES_BY_CATEGORY[cat].includes(t)) return cat;
  }
  return 'OTHER';
}

// Which standard (top-level) field groups apply per category.
export interface CategoryFeatures {
  plateAndVin: boolean;        // plate number + VIN
  registration: boolean;       // Mulkiya / registration expiry
  insurance: boolean;          // vehicle insurance + expiry
  serialNumber: boolean;       // serial number identifier
  warranty: boolean;           // warranty expiry + provider
}

export const FEATURES: Record<AssetCategory, CategoryFeatures> = {
  VEHICLE:       { plateAndVin: true,  registration: true,  insurance: true,  serialNumber: false, warranty: false },
  TRAILER:       { plateAndVin: true,  registration: true,  insurance: true,  serialNumber: false, warranty: false },
  GENERATOR:     { plateAndVin: false, registration: false, insurance: false, serialNumber: true,  warranty: true },
  MOBILE_OFFICE: { plateAndVin: false, registration: false, insurance: false, serialNumber: true,  warranty: true },
  EQUIPMENT:     { plateAndVin: false, registration: false, insurance: false, serialNumber: true,  warranty: true },
  OTHER:         { plateAndVin: false, registration: false, insurance: false, serialNumber: true,  warranty: false },
};

// Category-specific spec fields (stored in Asset.specs JSON).
export type SpecField =
  | { key: string; label: string; type: 'text' | 'number' | 'date' | 'select'; options?: string[]; placeholder?: string };
export interface SpecGroup { title: string; fields: SpecField[] }

const FUEL_TYPES = ['Diesel', 'Petrol', 'Natural Gas', 'LPG', 'Solar', 'Hybrid', 'Electric'];

export const SPEC_GROUPS: Record<AssetCategory, SpecGroup[]> = {
  GENERATOR: [
    {
      title: 'Engine & Output',
      fields: [
        { key: 'manufacturer', label: 'Manufacturer', type: 'text', placeholder: 'e.g. Caterpillar' },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'powerKva', label: 'Power Rating (kVA)', type: 'number' },
        { key: 'powerKw', label: 'Power Rating (kW)', type: 'number' },
        { key: 'voltage', label: 'Voltage', type: 'text', placeholder: 'e.g. 415V' },
        { key: 'phase', label: 'Phase', type: 'select', options: ['Single Phase', 'Three Phase'] },
        { key: 'engineModel', label: 'Engine Model', type: 'text' },
      ],
    },
    {
      title: 'Fuel & Operation',
      fields: [
        { key: 'fuelType', label: 'Fuel Type', type: 'select', options: FUEL_TYPES },
        { key: 'fuelTankCapacity', label: 'Fuel Tank Capacity (L)', type: 'number' },
        { key: 'runningHours', label: 'Running Hours', type: 'number' },
        { key: 'consumptionPerHour', label: 'Consumption (L/hr)', type: 'number' },
      ],
    },
    {
      title: 'Service Schedule',
      fields: [
        { key: 'lastServiceDate', label: 'Last Service Date', type: 'date' },
        { key: 'nextServiceDate', label: 'Next Service Date', type: 'date' },
        { key: 'serviceIntervalHours', label: 'Service Interval (hours)', type: 'number' },
      ],
    },
  ],
  TRAILER: [
    {
      title: 'Identification',
      fields: [
        { key: 'manufacturer', label: 'Manufacturer', type: 'text', placeholder: 'e.g. Forest River' },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'year', label: 'Year', type: 'number' },
        { key: 'chassisNumber', label: 'Chassis Number', type: 'text' },
      ],
    },
    {
      title: 'Dimensions & Weight',
      fields: [
        { key: 'overallLength', label: 'Length (m)', type: 'number' },
        { key: 'overallWidth', label: 'Width (m)', type: 'number' },
        { key: 'overallHeight', label: 'Height (m)', type: 'number' },
        { key: 'dryWeight', label: 'Dry Weight (kg)', type: 'number' },
        { key: 'gvwr', label: 'GVWR (kg)', type: 'number' },
        { key: 'axles', label: 'Number of Axles', type: 'number' },
      ],
    },
    {
      title: 'Capacity & Power',
      fields: [
        { key: 'sleepingCapacity', label: 'Sleeping Capacity', type: 'number' },
        { key: 'freshWaterTank', label: 'Fresh Water Tank (L)', type: 'number' },
        { key: 'greyWaterTank', label: 'Grey Water Tank (L)', type: 'number' },
        { key: 'powerSystem', label: 'Power System', type: 'select', options: ['Shore Power', 'Generator', 'Solar', 'Battery', 'Hybrid'] },
        { key: 'airConditioning', label: 'Air Conditioning', type: 'select', options: ['Yes', 'No'] },
      ],
    },
  ],
  MOBILE_OFFICE: [
    {
      title: 'Specifications',
      fields: [
        { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'overallLength', label: 'Length (m)', type: 'number' },
        { key: 'overallWidth', label: 'Width (m)', type: 'number' },
        { key: 'capacity', label: 'Occupancy / Capacity', type: 'number' },
        { key: 'powerSystem', label: 'Power System', type: 'select', options: ['Shore Power', 'Generator', 'Solar', 'Battery'] },
        { key: 'airConditioning', label: 'Air Conditioning', type: 'select', options: ['Yes', 'No'] },
      ],
    },
  ],
  EQUIPMENT: [
    {
      title: 'Specifications',
      fields: [
        { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'capacity', label: 'Capacity', type: 'text', placeholder: 'e.g. 5000 L' },
        { key: 'powerSource', label: 'Power Source', type: 'select', options: ['Electric', 'Diesel', 'Manual', 'Hydraulic', 'Pneumatic', 'None'] },
      ],
    },
  ],
  VEHICLE: [
    {
      title: 'Vehicle Specifications',
      fields: [
        { key: 'make', label: 'Make', type: 'text', placeholder: 'e.g. Toyota' },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'year', label: 'Year', type: 'number' },
        { key: 'fuelType', label: 'Fuel Type', type: 'select', options: FUEL_TYPES },
        { key: 'seatingCapacity', label: 'Seating Capacity', type: 'number' },
        { key: 'transmission', label: 'Transmission', type: 'select', options: ['Automatic', 'Manual'] },
      ],
    },
  ],
  OTHER: [
    {
      title: 'Specifications',
      fields: [
        { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'notes', label: 'Spec Notes', type: 'text' },
      ],
    },
  ],
};
