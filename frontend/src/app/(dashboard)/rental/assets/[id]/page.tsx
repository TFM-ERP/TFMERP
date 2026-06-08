'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { rentalApi, uploadFile } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import {
  ArrowLeft, Wrench, Fuel, AlertTriangle, Package,
  Edit2, Save, X, Upload, Eye, Trash2, Loader2,
  FileText, Camera, Shield, ChevronDown, History,
} from 'lucide-react';
import PlateNumberInput, { PlateDisplay } from '@/components/PlateNumberInput';
import StatusBadge from '@/components/StatusBadge';
import StatusTimeline from '@/components/StatusTimeline';
import StatusChangeModal from '@/components/StatusChangeModal';
import { categoryForType, FEATURES, SPEC_GROUPS, CATEGORIES } from '@/lib/assetCategories';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

const ASSET_TYPE_LABELS: Record<string, string> = {
  ARTIST_TRAILER: 'Artist Trailer', STAR_TRAILER: 'Star Trailer',
  MAKEUP_TRAILER: 'Makeup Trailer', WARDROBE_TRAILER: 'Wardrobe Trailer',
  MOBILE_TOILET: 'Mobile Toilet', GENERATOR: 'Generator',
  WATER_TANK: 'Water Tank', WASTE_TANK: 'Waste Tank',
  SUPPORT_VEHICLE: 'Support Vehicle', CREW_TRANSPORT: 'Crew Transport',
  UTILITY_TRAILER: 'Utility Trailer', TRUCK: 'Truck',
  TOWING_VEHICLE: 'Towing Vehicle', OTHER: 'Other',
};

// ── Doc upload card (reusable) ────────────────────────────────────────────────
function DocUploadCard({
  label, docUrl, onUpload, onRemove, uploading,
}: {
  label: string;
  docUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
  uploading?: boolean;
}) {
  const isPdf = docUrl?.toLowerCase().endsWith('.pdf');
  const fullUrl = docUrl ? `${API_BASE}${docUrl}` : null;
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600">{label}</p>
        {fullUrl && (
          <div className="flex gap-1">
            <a href={fullUrl} target="_blank" rel="noopener noreferrer"
              className="p-1 text-brand-600 hover:text-brand-700 rounded hover:bg-brand-50">
              <Eye size={13} />
            </a>
            <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      {fullUrl && !isPdf && (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer">
          <img src={fullUrl} alt={label} className="w-full h-24 object-cover rounded-lg mb-2 border border-gray-200 hover:opacity-90 transition-opacity" />
        </a>
      )}
      {fullUrl && isPdf && (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg mb-2 text-xs text-brand-700 hover:bg-brand-50">
          <FileText size={14} /> View PDF <Eye size={12} className="ml-auto opacity-60" />
        </a>
      )}
      <label className={cn(
        'flex items-center justify-center gap-2 w-full py-2 rounded-lg border-2 border-dashed text-xs font-medium cursor-pointer transition-colors',
        uploading ? 'border-gray-200 text-gray-400 cursor-not-allowed'
          : fullUrl ? 'border-gray-200 text-gray-400 hover:border-brand-300 hover:text-brand-600'
          : 'border-brand-200 text-brand-600 hover:border-brand-400 hover:bg-brand-50',
      )}>
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {uploading ? 'Uploading...' : fullUrl ? 'Replace' : 'Upload'}
        <input ref={inputRef} type="file" className="hidden" accept="image/*,.pdf,.heic"
          disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); if (inputRef.current) inputRef.current.value = ''; }} />
      </label>
    </div>
  );
}

// ── Photo gallery (multi-upload up to 15, with drag & drop) ─────────────────────
const MAX_PHOTOS = 15;
function PhotoGallery({
  photos, onAddPhotos, onRemovePhoto, uploadingPhoto, progress,
}: {
  photos: string[];
  onAddPhotos: (files: File[]) => Promise<void>;
  onRemovePhoto: (url: string) => void;
  uploadingPhoto: boolean;
  progress?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = (list: FileList | null) => {
    if (!list || uploadingPhoto) return;
    const images = Array.from(list).filter(f => /^image\//.test(f.type) || /\.heic$/i.test(f.name));
    if (images.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { alert(`This asset already has the maximum of ${MAX_PHOTOS} photos. Remove some first.`); return; }
    if (images.length > room) alert(`Only ${room} more photo${room === 1 ? '' : 's'} fit (max ${MAX_PHOTOS}) — uploading the first ${room}.`);
    onAddPhotos(images.slice(0, room));
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!uploadingPhoto) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files); }}
    >
      <div className="grid grid-cols-3 gap-2 mb-3">
        {photos.map((url, i) => {
          const full = `${API_BASE}${url}`;
          return (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-video bg-gray-100">
              <a href={full} target="_blank" rel="noopener noreferrer">
                <img src={full} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              </a>
              <button onClick={() => onRemovePhoto(url)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={11} />
              </button>
            </div>
          );
        })}
        {photos.length === 0 && (
          <div className="col-span-3 flex items-center justify-center h-20 text-gray-300 text-sm bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            No photos yet — drop images here
          </div>
        )}
      </div>
      <label className={cn(
        'flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed text-xs font-medium cursor-pointer transition-colors',
        uploadingPhoto ? 'border-gray-200 text-gray-400 cursor-not-allowed'
          : dragOver ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-brand-200 text-brand-600 hover:border-brand-400 hover:bg-brand-50',
      )}>
        {uploadingPhoto ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
        {uploadingPhoto ? (progress || 'Uploading…') : dragOver ? 'Drop photos to upload' : `Add photos — click or drag & drop (up to ${MAX_PHOTOS - photos.length} more)`}
        <input ref={inputRef} type="file" className="hidden" accept="image/*,.heic" multiple
          disabled={uploadingPhoto}
          onChange={e => { pick(e.target.files); if (inputRef.current) inputRef.current.value = ''; }} />
      </label>
    </div>
  );
}

// ── Trailer Specs Card ────────────────────────────────────────────────────────
const INTERIOR_FEATURES: [string, string][] = [
  ['privateQueenBedroom', 'Private Queen Bedroom'],
  ['theaterRecliners', 'Theater Recliner Seating'],
  ['convertibleDinette', 'Convertible Dinette Bed'],
  ['fireplace', 'Fireplace'],
  ['tvEntertainment', 'TV Entertainment System'],
  ['airConditioning', 'Air Conditioning'],
  ['heating', 'Heating System'],
  ['fullKitchen', 'Full Kitchen'],
  ['oven', 'Oven'],
  ['microwave', 'Microwave'],
  ['refrigerator', 'Refrigerator'],
  ['bathroomWithShower', 'Bathroom with Shower'],
];
const EXTERIOR_FEATURES: [string, string][] = [
  ['dualPowerAwnings', 'Dual Power Awnings'],
  ['ledAwningLighting', 'LED Awning Lighting'],
  ['outdoorGriddle', 'Outdoor Griddle / BBQ Connection'],
  ['exteriorShower', 'Exterior Shower'],
  ['heatedEnclosedUnderbelly', 'Heated & Enclosed Underbelly'],
  ['solarPrep', 'Solar Prep'],
  ['backupCameraPrep', 'Backup Camera Prep'],
];

function SpecRow({ label, value, unit }: { label: string; value?: any; unit?: string }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}{unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

function FeatureBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-400 border border-gray-200 opacity-60',
    )}>
      <span className="text-[10px]">{active ? '✓' : '✗'}</span>
      {label}
    </div>
  );
}

function TrailerSpecsCard({
  specs, editing, editSpecs, onChange,
}: {
  specs: any;
  editing: boolean;
  editSpecs: any;
  onChange: (s: any) => void;
}) {
  const s = editing ? (editSpecs || {}) : (specs || {});
  const set = (key: string, val: any) => onChange({ ...(editSpecs || {}), [key]: val });

  return (
    <div className="card border-brand-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        🚌 Trailer Specifications
      </h3>

      {editing ? (
        <div className="space-y-5">
          {/* Basic Info */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Basic Information</p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Manufacturer</label><input className="input w-full" value={s.manufacturer||''} onChange={e => set('manufacturer', e.target.value)} placeholder="Forest River" /></div>
              <div><label className="label">Model Series</label><input className="input w-full" value={s.modelSeries||''} onChange={e => set('modelSeries', e.target.value)} placeholder="Rockwood Ultra Lite" /></div>
              <div><label className="label">Model</label><input className="input w-full" value={s.model||''} onChange={e => set('model', e.target.value)} placeholder="2906BS" /></div>
              <div><label className="label">Year</label><input type="number" className="input w-full" value={s.year||''} onChange={e => set('year', e.target.value)} /></div>
              <div><label className="label">Trailer Type</label><input className="input w-full" value={s.trailerType||''} onChange={e => set('trailerType', e.target.value)} placeholder="Travel Trailer" /></div>
            </div>
          </div>
          {/* Dimensions */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Dimensions</p>
            <div className="grid grid-cols-4 gap-3">
              <div><label className="label">Length (m)</label><input type="number" step="0.01" className="input w-full" value={s.overallLength||''} onChange={e => set('overallLength', e.target.value)} /></div>
              <div><label className="label">Width (m)</label><input type="number" step="0.01" className="input w-full" value={s.overallWidth||''} onChange={e => set('overallWidth', e.target.value)} /></div>
              <div><label className="label">Height (m)</label><input type="number" step="0.01" className="input w-full" value={s.overallHeight||''} onChange={e => set('overallHeight', e.target.value)} /></div>
              <div><label className="label">Slide-Outs</label><input type="number" className="input w-full" value={s.slideOuts||''} onChange={e => set('slideOuts', e.target.value)} /></div>
            </div>
          </div>
          {/* Weight */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Weight</p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Dry Weight / UVW (kg)</label><input type="number" className="input w-full" value={s.dryWeight||''} onChange={e => set('dryWeight', e.target.value)} /></div>
              <div><label className="label">GVWR (kg)</label><input type="number" className="input w-full" value={s.gvwr||''} onChange={e => set('gvwr', e.target.value)} /></div>
              <div><label className="label">Hitch Weight (kg)</label><input type="number" className="input w-full" value={s.hitchWeight||''} onChange={e => set('hitchWeight', e.target.value)} /></div>
            </div>
          </div>
          {/* Tanks */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tank Capacities</p>
            <div className="grid grid-cols-4 gap-3">
              <div><label className="label">Fresh Water (L)</label><input type="number" className="input w-full" value={s.freshWaterTank||''} onChange={e => set('freshWaterTank', e.target.value)} /></div>
              <div><label className="label">Grey Water (L)</label><input type="number" className="input w-full" value={s.greyWaterTank||''} onChange={e => set('greyWaterTank', e.target.value)} /></div>
              <div><label className="label">Black Water (L)</label><input type="number" className="input w-full" value={s.blackWaterTank||''} onChange={e => set('blackWaterTank', e.target.value)} /></div>
              <div><label className="label">Propane (kg)</label><input type="number" className="input w-full" value={s.propaneCapacity||''} onChange={e => set('propaneCapacity', e.target.value)} /></div>
            </div>
          </div>
          {/* Sleeping */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sleeping & Capacity</p>
            <div className="grid grid-cols-4 gap-3">
              <div><label className="label">Sleeping Capacity</label><input type="number" className="input w-full" value={s.sleepingCapacity||''} onChange={e => set('sleepingCapacity', e.target.value)} /></div>
            </div>
          </div>
          {/* Interior */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Interior Features</p>
            <div className="grid grid-cols-3 gap-2">
              {INTERIOR_FEATURES.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-brand-600"
                    checked={!!s[key]} onChange={e => set(key, e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {/* Exterior */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Exterior Features</p>
            <div className="grid grid-cols-3 gap-2">
              {EXTERIOR_FEATURES.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-brand-600"
                    checked={!!s[key]} onChange={e => set(key, e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {/* Towing */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Towing Requirements</p>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-brand-600"
                  checked={!!s.brakeControllerRequired} onChange={e => set('brakeControllerRequired', e.target.checked)} />
                Brake Controller Required
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-brand-600"
                  checked={!!s.weightDistributionHitch} onChange={e => set('weightDistributionHitch', e.target.checked)} />
                Weight Distribution Hitch Recommended
              </label>
              <div>
                <label className="label">Recommended Tow Vehicle</label>
                <input className="input w-full" value={s.recommendedTowVehicle||''} onChange={e => set('recommendedTowVehicle', e.target.value)} placeholder="e.g. 3/4 Ton Pickup Truck" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ── VIEW MODE ──
        !specs ? (
          <p className="text-xs text-gray-400">No specifications recorded. Click Edit to add trailer specs.</p>
        ) : (
          <div className="space-y-5">
            {/* Basic Info */}
            {(specs.manufacturer || specs.model || specs.year) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Basic Information</p>
                <div className="grid grid-cols-2 gap-x-8">
                  <SpecRow label="Manufacturer" value={specs.manufacturer} />
                  <SpecRow label="Model Series" value={specs.modelSeries} />
                  <SpecRow label="Model" value={specs.model} />
                  <SpecRow label="Year" value={specs.year} />
                  <SpecRow label="Trailer Type" value={specs.trailerType} />
                </div>
              </div>
            )}
            {/* Dimensions */}
            {(specs.overallLength || specs.overallWidth) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Dimensions</p>
                <div className="grid grid-cols-2 gap-x-8">
                  <SpecRow label="Overall Length" value={specs.overallLength} unit="m" />
                  <SpecRow label="Overall Width" value={specs.overallWidth} unit="m" />
                  <SpecRow label="Overall Height" value={specs.overallHeight} unit="m" />
                  <SpecRow label="Slide-Outs" value={specs.slideOuts} />
                </div>
              </div>
            )}
            {/* Weight */}
            {(specs.dryWeight || specs.gvwr) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Weight</p>
                <div className="grid grid-cols-2 gap-x-8">
                  <SpecRow label="Dry Weight (UVW)" value={specs.dryWeight ? Number(specs.dryWeight).toLocaleString() : null} unit="kg" />
                  <SpecRow label="GVWR" value={specs.gvwr ? Number(specs.gvwr).toLocaleString() : null} unit="kg" />
                  <SpecRow label="Hitch Weight" value={specs.hitchWeight ? Number(specs.hitchWeight).toLocaleString() : null} unit="kg" />
                </div>
              </div>
            )}
            {/* Tanks */}
            {(specs.freshWaterTank || specs.greyWaterTank) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tank Capacities</p>
                <div className="grid grid-cols-2 gap-x-8">
                  <SpecRow label="Fresh Water" value={specs.freshWaterTank} unit="L" />
                  <SpecRow label="Grey Water" value={specs.greyWaterTank} unit="L" />
                  <SpecRow label="Black Water" value={specs.blackWaterTank} unit="L" />
                  <SpecRow label="Propane" value={specs.propaneCapacity} unit="kg" />
                </div>
              </div>
            )}
            {/* Sleeping */}
            {specs.sleepingCapacity && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sleeping & Capacity</p>
                <SpecRow label="Sleeping Capacity" value={specs.sleepingCapacity} unit="persons" />
              </div>
            )}
            {/* Interior */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Interior Features</p>
              <div className="flex flex-wrap gap-2">
                {INTERIOR_FEATURES.map(([key, label]) => (
                  <FeatureBadge key={key} active={!!specs[key]} label={label} />
                ))}
              </div>
            </div>
            {/* Exterior */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Exterior Features</p>
              <div className="flex flex-wrap gap-2">
                {EXTERIOR_FEATURES.map(([key, label]) => (
                  <FeatureBadge key={key} active={!!specs[key]} label={label} />
                ))}
              </div>
            </div>
            {/* Towing */}
            {(specs.brakeControllerRequired || specs.weightDistributionHitch || specs.recommendedTowVehicle) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Towing Requirements</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {specs.brakeControllerRequired && <FeatureBadge active label="Brake Controller Required" />}
                  {specs.weightDistributionHitch && <FeatureBadge active label="Weight Distribution Hitch" />}
                </div>
                {specs.recommendedTowVehicle && (
                  <SpecRow label="Recommended Tow Vehicle" value={specs.recommendedTowVehicle} />
                )}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingRegDoc, setUploadingRegDoc] = useState(false);
  const [uploadingInsDoc, setUploadingInsDoc] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = () => {
    rentalApi.assets.get(id)
      .then(r => { setAsset(r.data); setEditForm(r.data); })
      .catch(() => router.push('/rental/assets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleStatusChange = async (status: string, notes: string) => {
    await rentalApi.assets.updateStatus(id, status, notes);
    setAsset((a: any) => ({ ...a, status }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await rentalApi.assets.update(id, {
        name: editForm.name,
        plateNumber: editForm.plateNumber || undefined,
        plateEmirate: editForm.plateEmirate || undefined,
        vinNumber: editForm.vinNumber,
        condition: editForm.condition,
        notes: editForm.notes,
        registrationExpiry: editForm.registrationExpiry || undefined,
        insuranceExpiry: editForm.insuranceExpiry || undefined,
        insurancePolicyRef: editForm.insurancePolicyRef,
        serialNumber: editForm.serialNumber,
        warrantyExpiry: editForm.warrantyExpiry || undefined,
        warrantyProvider: editForm.warrantyProvider,
        purchaseValue: editForm.purchaseValue ? Number(editForm.purchaseValue) : undefined,
        currentValue: editForm.currentValue ? Number(editForm.currentValue) : undefined,
        trailerSpecs: editForm.trailerSpecs ?? asset.trailerSpecs ?? undefined,
        specs: editForm.specs ?? asset.specs ?? undefined,
      });
      setEditing(false);
      load();
    } finally { setSaving(false); }
  };

  // Photo management — batch upload (up to 15 total), one save at the end
  const [photoProgress, setPhotoProgress] = useState('');
  const handleAddPhotos = async (files: File[]) => {
    setUploadingPhoto(true);
    const uploaded: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setPhotoProgress(`Uploading ${i + 1} of ${files.length}…`);
        const result = await uploadFile(files[i]);
        uploaded.push(result.url);
      }
      const newPhotos = [...(asset.photos || []), ...uploaded].slice(0, 15);
      setPhotoProgress('Saving…');
      await rentalApi.assets.update(id, { photos: newPhotos });
      setAsset((a: any) => ({ ...a, photos: newPhotos }));
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Photo upload failed — please try again.');
    } finally { setUploadingPhoto(false); setPhotoProgress(''); }
  };

  const handleRemovePhoto = async (url: string) => {
    try {
      const newPhotos = (asset.photos || []).filter((p: string) => p !== url);
      await rentalApi.assets.update(id, { photos: newPhotos });
      setAsset((a: any) => ({ ...a, photos: newPhotos }));
    } catch (e: any) { alert(e?.response?.data?.message || 'Could not remove the photo.'); }
  };

  // Doc uploads
  const handleRegDocUpload = async (file: File) => {
    setUploadingRegDoc(true);
    try {
      const result = await uploadFile(file);
      await rentalApi.assets.update(id, { registrationDocUrl: result.url });
      setAsset((a: any) => ({ ...a, registrationDocUrl: result.url }));
    } finally { setUploadingRegDoc(false); }
  };

  const handleInsDocUpload = async (file: File) => {
    setUploadingInsDoc(true);
    try {
      const result = await uploadFile(file);
      await rentalApi.assets.update(id, { insuranceDocUrl: result.url });
      setAsset((a: any) => ({ ...a, insuranceDocUrl: result.url }));
    } finally { setUploadingInsDoc(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" />
    </div>
  );
  if (!asset) return null;

  const regExpired = asset.registrationExpiry && new Date(asset.registrationExpiry) < new Date();
  const regWarn = asset.registrationExpiry && !regExpired && new Date(asset.registrationExpiry) < new Date(Date.now() + 60 * 86400000);
  const insExpired = asset.insuranceExpiry && new Date(asset.insuranceExpiry) < new Date();
  const insWarn = asset.insuranceExpiry && !insExpired && new Date(asset.insuranceExpiry) < new Date(Date.now() + 60 * 86400000);
  // Category-driven display: only show fields/sections relevant to this asset's category.
  const assetCat = asset.category || categoryForType(asset.assetType);
  const feat = FEATURES[assetCat as keyof typeof FEATURES] || FEATURES.OTHER;
  const catSpecGroups = SPEC_GROUPS[assetCat as keyof typeof SPEC_GROUPS] || [];
  const warExpired = asset.warrantyExpiry && new Date(asset.warrantyExpiry) < new Date();
  const warWarn = asset.warrantyExpiry && !warExpired && new Date(asset.warrantyExpiry) < new Date(Date.now() + 60 * 86400000);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/rental/assets" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
          <p className="text-sm text-gray-500">
            {ASSET_TYPE_LABELS[asset.assetType] || asset.assetType}
            {asset.plateNumber ? ` · ${asset.plateNumber}` : ''}
            {asset.condition ? ` · ${asset.condition}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn btn-secondary text-sm">
              <Edit2 size={13} className="mr-1" /> Edit
            </button>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm disabled:opacity-50">
                <Save size={13} className="mr-1" /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setEditForm(asset); }} className="btn btn-secondary text-sm">
                <X size={13} />
              </button>
            </>
          )}
          <StatusBadge module="Asset" status={asset.status} size="lg" />
          <button onClick={() => setShowStatusModal(true)} className="btn btn-secondary text-sm">
            <ChevronDown size={13} /> Change Status
          </button>
          <button onClick={() => setShowHistory(h => !h)} className={cn('btn btn-secondary text-sm', showHistory && 'bg-gray-100')}>
            <History size={13} /> History
          </button>
        </div>
      </div>

      {showStatusModal && (
        <StatusChangeModal
          module="Asset"
          currentStatus={asset.status}
          recordRef={asset.name}
          onConfirm={handleStatusChange}
          onClose={() => setShowStatusModal(false)}
        />
      )}

      {showHistory && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><History size={15} /> Status History</h3>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <StatusTimeline module="Asset" recordId={id} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main content */}
        <div className="lg:col-span-2 space-y-5">

          {/* Asset Details */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Package size={15} className="text-brand-600" /> Asset Details
            </h3>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label">Name</label><input className="input w-full" value={editForm.name || ''} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
                <div className="col-span-2">
                  <PlateNumberInput
                    value={editForm.plateNumber || ''}
                    emirate={editForm.plateEmirate || 'DXB'}
                    onChange={v => setEditForm((f: any) => ({ ...f, plateNumber: v }))}
                    onEmirateChange={e => setEditForm((f: any) => ({ ...f, plateEmirate: e }))}
                  />
                </div>
                <div><label className="label">VIN / Chassis No.</label><input className="input w-full font-mono" value={editForm.vinNumber || ''} onChange={e => setEditForm((f: any) => ({ ...f, vinNumber: e.target.value }))} /></div>
                <div>
                  <label className="label">Condition</label>
                  <select className="input w-full" value={editForm.condition || 'GOOD'} onChange={e => setEditForm((f: any) => ({ ...f, condition: e.target.value }))}>
                    <option value="EXCELLENT">Excellent</option><option value="GOOD">Good</option><option value="FAIR">Fair</option><option value="POOR">Poor</option>
                  </select>
                </div>
                <div><label className="label">Insurance Policy Ref</label><input className="input w-full" value={editForm.insurancePolicyRef || ''} onChange={e => setEditForm((f: any) => ({ ...f, insurancePolicyRef: e.target.value }))} /></div>
                <div><label className="label">Purchase Value (AED)</label><input type="number" className="input w-full" value={editForm.purchaseValue || ''} onChange={e => setEditForm((f: any) => ({ ...f, purchaseValue: e.target.value }))} /></div>
                <div><label className="label">Current Value (AED)</label><input type="number" className="input w-full" value={editForm.currentValue || ''} onChange={e => setEditForm((f: any) => ({ ...f, currentValue: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label">Notes</label><textarea className="input w-full" rows={2} value={editForm.notes || ''} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {asset.plateNumber && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-1.5">Plate Number</p>
                    <PlateDisplay plateNumber={asset.plateNumber} plateEmirate={asset.plateEmirate} />
                  </div>
                )}
                {[
                  { label: 'VIN / Chassis', value: asset.vinNumber },
                  { label: 'Condition', value: asset.condition },
                  { label: 'Insurance Policy', value: asset.insurancePolicyRef },
                  { label: 'Purchase Value', value: asset.purchaseValue ? formatCurrency(asset.purchaseValue) : null },
                  { label: 'Current Value', value: asset.currentValue ? formatCurrency(asset.currentValue) : null },
                ].filter(f => f.value).map(f => (
                  <div key={f.label}>
                    <p className="text-xs text-gray-400">{f.label}</p>
                    <p className="font-medium text-gray-800 mt-0.5">{f.value}</p>
                  </div>
                ))}
                {asset.notes && <div className="col-span-2"><p className="text-xs text-gray-400">Notes</p><p className="text-gray-600 mt-0.5">{asset.notes}</p></div>}
              </div>
            )}
          </div>

          {/* Registration & Insurance — vehicles/trailers only */}
          {(feat.registration || feat.insurance) && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Shield size={15} className="text-brand-600" /> Registration & Insurance
            </h3>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Registration Expiry (Mulkiya)</label>
                  <input type="date" className="input w-full" value={editForm.registrationExpiry ? new Date(editForm.registrationExpiry).toISOString().slice(0,10) : ''} onChange={e => setEditForm((f: any) => ({ ...f, registrationExpiry: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Insurance Expiry</label>
                  <input type="date" className="input w-full" value={editForm.insuranceExpiry ? new Date(editForm.insuranceExpiry).toISOString().slice(0,10) : ''} onChange={e => setEditForm((f: any) => ({ ...f, insuranceExpiry: e.target.value }))} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-xs text-gray-400">Registration Expiry (Mulkiya)</p>
                  <p className={cn('font-medium mt-0.5', regExpired ? 'text-red-600' : regWarn ? 'text-amber-600' : 'text-gray-800')}>
                    {asset.registrationExpiry ? formatDate(asset.registrationExpiry) : '—'}
                    {regExpired && ' ⚠ Expired'}
                    {regWarn && !regExpired && ' ⚠ Expiring soon'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Insurance Expiry</p>
                  <p className={cn('font-medium mt-0.5', insExpired ? 'text-red-600' : insWarn ? 'text-amber-600' : 'text-gray-800')}>
                    {asset.insuranceExpiry ? formatDate(asset.insuranceExpiry) : '—'}
                    {insExpired && ' ⚠ Expired'}
                    {insWarn && !insExpired && ' ⚠ Expiring soon'}
                  </p>
                </div>
              </div>
            )}
            {!editing && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <DocUploadCard
                  label="Registration Card (Mulkiya)"
                  docUrl={asset.registrationDocUrl}
                  onUpload={handleRegDocUpload}
                  onRemove={async () => { await rentalApi.assets.update(id, { registrationDocUrl: null }); setAsset((a: any) => ({ ...a, registrationDocUrl: null })); }}
                  uploading={uploadingRegDoc}
                />
                <DocUploadCard
                  label="Insurance Certificate"
                  docUrl={asset.insuranceDocUrl}
                  onUpload={handleInsDocUpload}
                  onRemove={async () => { await rentalApi.assets.update(id, { insuranceDocUrl: null }); setAsset((a: any) => ({ ...a, insuranceDocUrl: null })); }}
                  uploading={uploadingInsDoc}
                />
              </div>
            )}
          </div>
          )}

          {/* Warranty — generators / equipment / mobile offices */}
          {feat.warranty && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Shield size={15} className="text-brand-600" /> Warranty
              </h3>
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Warranty Expiry</label>
                    <input type="date" className="input w-full" value={editForm.warrantyExpiry ? new Date(editForm.warrantyExpiry).toISOString().slice(0,10) : ''} onChange={e => setEditForm((f: any) => ({ ...f, warrantyExpiry: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Warranty Provider</label>
                    <input className="input w-full" value={editForm.warrantyProvider || ''} onChange={e => setEditForm((f: any) => ({ ...f, warrantyProvider: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Warranty Expiry</p>
                    <p className={cn('font-medium mt-0.5', warExpired ? 'text-red-600' : warWarn ? 'text-amber-600' : 'text-gray-800')}>
                      {asset.warrantyExpiry ? formatDate(asset.warrantyExpiry) : '—'}
                      {warExpired && ' ⚠ Expired'}
                      {warWarn && !warExpired && ' ⚠ Expiring soon'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Warranty Provider</p>
                    <p className="font-medium mt-0.5 text-gray-700">{asset.warrantyProvider || '—'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trailer Specifications — rich editor for trailer/caravan */}
          {assetCat === 'TRAILER' && (
            <TrailerSpecsCard
              specs={asset.trailerSpecs}
              editing={editing}
              editSpecs={editForm.trailerSpecs || {}}
              onChange={(specs: any) => setEditForm((f: any) => ({ ...f, trailerSpecs: specs }))}
            />
          )}

          {/* Category-driven specifications (generators, equipment, vehicles…) */}
          {assetCat !== 'TRAILER' && catSpecGroups.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Package size={15} className="text-brand-600" /> {CATEGORIES.find(c => c.value === assetCat)?.label} Specifications
              </h3>
              {catSpecGroups.map(group => (
                <div key={group.title} className="mb-4 last:mb-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.title}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {group.fields.map(fld => {
                      const specsObj = editing ? (editForm.specs || asset.specs || {}) : (asset.specs || {});
                      const val = specsObj[fld.key];
                      if (editing) {
                        return (
                          <div key={fld.key}>
                            <label className="label">{fld.label}</label>
                            {fld.type === 'select' ? (
                              <select className="input w-full" value={val ?? ''}
                                onChange={e => setEditForm((f: any) => ({ ...f, specs: { ...(f.specs || asset.specs || {}), [fld.key]: e.target.value } }))}>
                                <option value="">—</option>
                                {(fld.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input type={fld.type} className="input w-full" value={val ?? ''}
                                onChange={e => setEditForm((f: any) => ({ ...f, specs: { ...(f.specs || asset.specs || {}), [fld.key]: fld.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value } }))} />
                            )}
                          </div>
                        );
                      }
                      return (
                        <div key={fld.key}>
                          <p className="text-xs text-gray-400">{fld.label}</p>
                          <p className="font-medium mt-0.5 text-gray-700 text-sm">{val !== undefined && val !== '' ? String(val) : '—'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Photos */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Camera size={15} className="text-brand-600" /> Photos
              <span className="text-gray-400 font-normal text-xs">({(asset.photos || []).length})</span>
            </h3>
            <PhotoGallery
              photos={asset.photos || []}
              onAddPhotos={handleAddPhotos}
              onRemovePhoto={handleRemovePhoto}
              uploadingPhoto={uploadingPhoto}
              progress={photoProgress}
            />
          </div>

          {/* Maintenance Logs */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Wrench size={15} /> Recent Maintenance
              </h3>
              <Link href={`/rental/maintenance?assetId=${id}`} className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
            {asset.maintenanceLogs?.length > 0 ? (
              <table className="w-full">
                <thead><tr>
                  <th className="table-th">Type</th>
                  <th className="table-th">Scheduled</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-right">Cost</th>
                </tr></thead>
                <tbody>
                  {asset.maintenanceLogs.slice(0, 5).map((log: any) => (
                    <tr key={log.id} className="table-row">
                      <td className="table-td text-sm">{log.maintenanceType.replace(/_/g, ' ')}</td>
                      <td className="table-td text-sm text-gray-600">{formatDate(log.scheduledDate)}</td>
                      <td className="table-td"><span className="badge bg-gray-100 text-gray-600">{log.status}</span></td>
                      <td className="table-td text-right text-sm">{log.cost ? formatCurrency(log.cost) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">No maintenance records</p>
            )}
          </div>

          {/* Fuel Logs */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Fuel size={15} /> Recent Fuel Logs</h3>
              <Link href={`/rental/fuel?assetId=${id}`} className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
            {asset.fuelLogs?.length > 0 ? (
              <table className="w-full">
                <thead><tr>
                  <th className="table-th">Date</th>
                  <th className="table-th text-right">Litres</th>
                  <th className="table-th text-right">Cost</th>
                  <th className="table-th">Odometer</th>
                </tr></thead>
                <tbody>
                  {asset.fuelLogs.slice(0, 5).map((log: any) => (
                    <tr key={log.id} className="table-row">
                      <td className="table-td text-sm">{formatDate(log.logDate)}</td>
                      <td className="table-td text-right text-sm">{Number(log.litres).toFixed(1)}</td>
                      <td className="table-td text-right text-sm">{formatCurrency(log.totalCost)}</td>
                      <td className="table-td text-sm text-gray-600">{log.odometer ? `${log.odometer.toLocaleString()} km` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">No fuel records</p>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Current Status</h3>
            <div className="mb-3"><StatusBadge module="Asset" status={asset.status} size="md" showDot /></div>
            <button onClick={() => setShowStatusModal(true)} className="btn btn-secondary w-full text-sm">
              <ChevronDown size={13} /> Change Status
            </button>
          </div>

          {/* Damage reports */}
          {asset.damageReports?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" /> Damage Reports
              </h3>
              <div className="space-y-2">
                {asset.damageReports.map((dr: any) => (
                  <div key={dr.id} className="p-2 rounded-lg border border-gray-100 hover:border-amber-200 hover:bg-amber-50 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">{dr.reportNumber}</span>
                      <span className={cn('badge text-xs',
                        dr.severity === 'SEVERE' ? 'bg-red-100 text-red-700' :
                        dr.severity === 'MODERATE' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                      )}>{dr.severity}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(dr.reportedAt)}</p>
                    {dr.resolutionNotes && <p className="text-xs text-green-600 mt-0.5">✓ Resolved</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link href={`/rental/maintenance?assetId=${id}`} className="btn btn-secondary w-full text-sm justify-center">
                <Wrench size={13} className="mr-1" /> Schedule Maintenance
              </Link>
              <Link href={`/rental/fuel?assetId=${id}`} className="btn btn-secondary w-full text-sm justify-center">
                <Fuel size={13} className="mr-1" /> Log Fuel
              </Link>
              <Link href={`/rental/damage?assetId=${id}`} className="btn btn-secondary w-full text-sm justify-center">
                <AlertTriangle size={13} className="mr-1" /> Report Damage
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
