'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Emirates plate configuration
// ─────────────────────────────────────────────────────────────────────────────

export type EmirateCode = 'DXB' | 'AUH' | 'SHJ' | 'AJM' | 'RAK' | 'FUJ' | 'UAQ';

interface EmirateConfig {
  code: EmirateCode;
  name: string;
  shortName: string;
  codeType: 'letter' | 'number' | 'letter+number';
  codeLetters?: string[];
  codeDoubles?: string[];
  codeMaxDigits?: number;
  codeOptional?: boolean;
  headerColor: string;
  headerText: string;
  codeBlockColor: string;
  codeBlockText: string;
  plateFont: string;
  validate: (plate: string) => boolean;
  formatHint: string;
  example: string;
}

export const EMIRATES: EmirateConfig[] = [
  {
    code: 'DXB',
    name: 'Dubai',
    shortName: 'DUBAI',
    codeType: 'letter',
    codeLetters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    codeDoubles: ['AA', 'BB', 'CC', 'DD', 'EE'],
    headerColor: '#1B3F8B',
    headerText: '#ffffff',
    codeBlockColor: '#1B3F8B',
    codeBlockText: '#ffffff',
    plateFont: 'font-bold',
    validate: (p) => /^([A-Z]{1,2})\s+\d{1,5}$/.test(p.toUpperCase()),
    formatHint: 'Letter (A–Z or AA/BB/CC/DD/EE) + 1–5 digits',
    example: 'A 12345',
  },
  {
    code: 'AUH',
    name: 'Abu Dhabi',
    shortName: 'ABU DHABI',
    codeType: 'number',
    codeMaxDigits: 2,
    headerColor: '#006C35',
    headerText: '#ffffff',
    codeBlockColor: '#8B0000',
    codeBlockText: '#ffffff',
    plateFont: 'font-bold',
    validate: (p) => /^\d{1,2}\s+\d{1,5}$/.test(p),
    formatHint: 'Code (1–99) + 1–5 digits',
    example: '12 12345',
  },
  {
    code: 'SHJ',
    name: 'Sharjah',
    shortName: 'SHARJAH',
    codeType: 'letter+number',
    codeLetters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    codeOptional: true,
    headerColor: '#8B4513',
    headerText: '#ffffff',
    codeBlockColor: '#CD853F',
    codeBlockText: '#1a1a1a',
    plateFont: 'font-bold',
    validate: (p) => /^(?:\d{1,2}\s+)?[A-Z]\s+\d{1,5}$/.test(p.toUpperCase()),
    formatHint: 'Optional category (1–99) + letter (A–Z) + 1–5 digits',
    example: '1 A 1234  or  A 1234',
  },
  {
    code: 'AJM',
    name: 'Ajman',
    shortName: 'AJMAN',
    codeType: 'letter',
    codeLetters: ['A', 'B', 'C', 'D', 'E', 'H'],
    headerColor: '#006400',
    headerText: '#ffffff',
    codeBlockColor: '#228B22',
    codeBlockText: '#ffffff',
    plateFont: 'font-bold',
    validate: (p) => /^[ABCDEH]\s+\d{1,5}$/.test(p.toUpperCase()),
    formatHint: 'Letter (A, B, C, D, E, or H) + 1–5 digits',
    example: 'A 1234',
  },
  {
    code: 'RAK',
    name: 'Ras Al Khaimah',
    shortName: 'RAK',
    codeType: 'letter',
    codeLetters: ['A', 'C', 'D', 'I', 'K', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    headerColor: '#4169E1',
    headerText: '#ffffff',
    codeBlockColor: '#1E40AF',
    codeBlockText: '#ffffff',
    plateFont: 'font-bold',
    validate: (p) => /^[ACDIKMNOPQRSTUVWXYZ]\s+\d{1,5}$/.test(p.toUpperCase()),
    formatHint: 'Letter (A,C,D,I,K,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z) + 1–5 digits',
    example: 'A 1234',
  },
  {
    code: 'FUJ',
    name: 'Fujairah',
    shortName: 'FUJAIRAH',
    codeType: 'letter',
    codeLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'K', 'M', 'P', 'R', 'S'],
    headerColor: '#B8860B',
    headerText: '#ffffff',
    codeBlockColor: '#DAA520',
    codeBlockText: '#1a1a1a',
    plateFont: 'font-bold',
    validate: (p) => /^[ABCDEFGKMPRS]\s+\d{1,5}$/.test(p.toUpperCase()),
    formatHint: 'Letter (A–G, K, M, P, R, S) + 1–5 digits',
    example: 'A 1234',
  },
  {
    code: 'UAQ',
    name: 'Umm Al Quwain',
    shortName: 'UAQ',
    codeType: 'letter',
    codeLetters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    headerColor: '#6B21A8',
    headerText: '#ffffff',
    codeBlockColor: '#7C3AED',
    codeBlockText: '#ffffff',
    plateFont: 'font-bold',
    validate: (p) => /^[A-Z]\s+\d{1,5}$/.test(p.toUpperCase()),
    formatHint: 'Any letter (A–Z) + 1–5 digits',
    example: 'A 1234',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true when the stored plate string represents a trailer plate */
export function isTrailerPlate(plate: string) {
  return plate.toUpperCase().startsWith('TRAILER ');
}

/** Strip the "TRAILER " prefix to get just the numeric portion */
function trailerNum(plate: string) {
  return plate.toUpperCase().replace(/^TRAILER\s+/, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Plate visual preview
// ─────────────────────────────────────────────────────────────────────────────

function PlatePreview({
  emirate,
  plateNumber,
  trailer,
}: {
  emirate: EmirateConfig;
  plateNumber: string;
  trailer: boolean;
}) {
  const isEmpty = !plateNumber.trim();

  let codeDisplay = '';
  let numDisplay = '';

  if (trailer) {
    codeDisplay = 'TRAILER';
    numDisplay = trailerNum(plateNumber) || '';
  } else {
    const parts = plateNumber.trim().toUpperCase().split(/\s+/);
    if (emirate.code === 'AUH') {
      codeDisplay = parts[0] || '';
      numDisplay = parts.slice(1).join(' ') || '';
    } else if (emirate.code === 'SHJ' && parts.length === 3) {
      codeDisplay = `${parts[0]} ${parts[1]}`;
      numDisplay = parts[2] || '';
    } else {
      codeDisplay = parts[0] || '';
      numDisplay = parts.slice(1).join('') || '';
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative rounded-lg overflow-hidden shadow-md border border-gray-300"
        style={{ width: trailer ? 300 : 260, height: 56, background: '#f8f8f0' }}
      >
        {/* Top emirate strip */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-2"
          style={{ height: 13, background: emirate.headerColor }}
        >
          <span style={{ color: emirate.headerText, fontSize: 7, fontWeight: 700, letterSpacing: '0.08em' }}>
            {emirate.shortName}
          </span>
          <div className="flex h-full overflow-hidden rounded-sm" style={{ gap: 1.5, alignItems: 'center' }}>
            <div style={{ width: 3, height: 8, background: '#00732F' }} />
            <div style={{ width: 3, height: 8, background: '#fff' }} />
            <div style={{ width: 3, height: 8, background: '#000' }} />
            <div style={{ width: 3, height: 8, background: '#FF0000' }} />
          </div>
        </div>

        {/* Abu Dhabi: code in red block on far left */}
        {emirate.code === 'AUH' && !trailer ? (
          <div
            className="absolute left-0 bottom-0 flex items-end justify-center pb-1"
            style={{ width: 36, background: emirate.codeBlockColor, top: 13 }}
          >
            <span style={{ color: emirate.codeBlockText, fontSize: 20, fontWeight: 900, lineHeight: 1 }}>
              {codeDisplay || '?'}
            </span>
          </div>
        ) : null}

        {/* Main area */}
        <div
          className="absolute flex items-end justify-center gap-3 pb-1"
          style={{
            top: 13,
            left: emirate.code === 'AUH' && !trailer ? 40 : 0,
            right: 0,
            bottom: 0,
          }}
        >
          {(emirate.code !== 'AUH' || trailer) && (
            <span style={{
              fontSize: trailer ? 13 : 22,
              fontWeight: 900,
              lineHeight: 1,
              background: codeDisplay ? (trailer ? '#555' : emirate.codeBlockColor) : 'transparent',
              color: codeDisplay ? (trailer ? '#fff' : emirate.codeBlockText) : '#ccc',
              padding: codeDisplay ? (trailer ? '1px 5px' : '0 4px') : 0,
              borderRadius: 3,
              letterSpacing: trailer ? '0.06em' : undefined,
            }}>
              {codeDisplay || (isEmpty ? '' : '?')}
            </span>
          )}
          <span style={{
            fontSize: 22,
            fontWeight: 900,
            color: numDisplay ? '#1a1a1a' : '#ccc',
            lineHeight: 1,
            letterSpacing: '0.04em',
          }}>
            {numDisplay || (isEmpty ? 'PLATE' : '?????')}
          </span>
        </div>
      </div>
      {isEmpty && (
        <p className="text-xs text-gray-400 mt-1">Enter plate details above to preview</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Input Component
// ─────────────────────────────────────────────────────────────────────────────

interface PlateNumberInputProps {
  value: string;
  emirate: string;
  onChange: (plate: string) => void;
  onEmirateChange: (emirate: string) => void;
  className?: string;
}

export default function PlateNumberInput({
  value, emirate, onChange, onEmirateChange, className,
}: PlateNumberInputProps) {
  const config = EMIRATES.find(e => e.code === emirate) || EMIRATES[0];

  // Determine initial plate type from stored value
  const [plateType, setPlateType] = useState<'private' | 'trailer'>(
    isTrailerPlate(value) ? 'trailer' : 'private'
  );
  const [error, setError] = useState('');

  // Parse value → code + num for private plates
  const parts = value.trim().toUpperCase().split(/\s+/);
  let initCode = '';
  let initNum = '';

  if (isTrailerPlate(value)) {
    initCode = '';
    initNum = trailerNum(value);
  } else if (config.code === 'AUH') {
    initCode = parts[0] || '';
    initNum = parts.slice(1).join('') || '';
  } else if (config.code === 'SHJ' && parts.length === 3) {
    initCode = `${parts[0]} ${parts[1]}`;
    initNum = parts[2] || '';
  } else {
    initCode = parts[0] || '';
    initNum = parts.slice(1).join('') || '';
  }

  const [code, setCode] = useState(initCode);
  const [num, setNum] = useState(initNum);

  const handleEmirateChange = (newEmirate: string) => {
    onEmirateChange(newEmirate);
    setCode('');
    setNum('');
    onChange('');
    setError('');
  };

  const handlePlateTypeChange = (type: 'private' | 'trailer') => {
    setPlateType(type);
    setCode('');
    setNum('');
    onChange('');
    setError('');
  };

  // Combine for private plates
  const combinePrivate = (c: string, n: string) => {
    const combined = [c, n].filter(Boolean).join(' ').toUpperCase();
    onChange(combined);
    if (combined && !config.validate(combined)) {
      setError(`Format: ${config.formatHint}`);
    } else {
      setError('');
    }
  };

  // Combine for trailer plates
  const combineTrailer = (n: string) => {
    if (n) {
      onChange(`TRAILER ${n}`);
      setError('');
    } else {
      onChange('');
    }
  };

  const handleCodeChange = (raw: string) => {
    const v = config.codeType === 'number'
      ? raw.replace(/\D/g, '').slice(0, config.codeMaxDigits || 2)
      : raw.replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, config.codeType === 'letter+number' ? 5 : 2);
    setCode(v);
    combinePrivate(v, num);
  };

  const handleNumChange = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 5);
    setNum(v);
    if (plateType === 'trailer') {
      combineTrailer(v);
    } else {
      combinePrivate(code, v);
    }
  };

  const isValid = !value || plateType === 'trailer'
    ? /^TRAILER\s+\d{1,5}$/.test(value.toUpperCase()) || !value
    : config.validate(value);

  return (
    <div className={cn('space-y-3', className)}>

      {/* Emirate selector */}
      <div>
        <label className="label">Emirate</label>
        <div className="flex gap-1.5 flex-wrap">
          {EMIRATES.map(em => (
            <button
              key={em.code}
              type="button"
              onClick={() => handleEmirateChange(em.code)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                emirate === em.code
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              )}
              style={emirate === em.code ? { background: em.headerColor } : {}}
            >
              {em.code}
            </button>
          ))}
        </div>
      </div>

      {/* Plate type toggle */}
      <div>
        <label className="label">Vehicle Category</label>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => handlePlateTypeChange('private')}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold transition-colors',
              plateType === 'private'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            Private / Regular
          </button>
          <button
            type="button"
            onClick={() => handlePlateTypeChange('trailer')}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold transition-colors border-l border-gray-200',
              plateType === 'trailer'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            Trailer
          </button>
        </div>
      </div>

      {/* Plate number inputs */}
      <div>
        <label className="label">
          Plate Number{' '}
          <span className="text-gray-400 font-normal text-[10px] ml-1">
            {plateType === 'trailer' ? 'City · TRAILER · 1–5 digits' : config.formatHint}
          </span>
        </label>

        <div className="flex gap-2 items-center">
          {/* Emirate badge */}
          <div
            className="shrink-0 flex items-center justify-center rounded-lg text-[10px] font-bold px-2 py-2"
            style={{ background: config.headerColor, color: config.headerText, minWidth: 44 }}
          >
            {config.code}
          </div>

          {plateType === 'trailer' ? (
            /* Trailer: fixed "TRAILER" badge + number only */
            <>
              <div className="flex items-center justify-center rounded-lg px-3 py-2 text-xs font-bold tracking-widest bg-gray-700 text-white shrink-0">
                TRAILER
              </div>
              <span className="text-gray-400 text-sm font-bold">·</span>
              <input
                className={cn(
                  'input text-center font-mono font-bold flex-1',
                  !isValid && value ? 'border-red-300 bg-red-50' : ''
                )}
                value={num}
                onChange={e => handleNumChange(e.target.value)}
                placeholder="12345"
                maxLength={5}
                inputMode="numeric"
              />
            </>
          ) : (
            /* Private: code + number */
            <>
              <input
                className={cn(
                  'input text-center font-mono font-bold uppercase',
                  config.codeType === 'number' ? 'w-20'
                  : config.codeType === 'letter+number' ? 'w-28'
                  : 'w-20',
                  !isValid && value ? 'border-red-300 bg-red-50' : ''
                )}
                value={code}
                onChange={e => handleCodeChange(e.target.value)}
                placeholder={
                  config.code === 'AUH' ? '12'
                  : config.code === 'SHJ' ? '1 A or A'
                  : config.codeLetters && config.codeLetters.length < 10
                    ? config.codeLetters.slice(0, 3).join('/') + '…'
                    : 'A'
                }
                maxLength={config.codeType === 'letter+number' ? 5 : 2}
              />
              <span className="text-gray-400 text-sm font-bold">·</span>
              <input
                className={cn(
                  'input text-center font-mono font-bold flex-1',
                  !isValid && value ? 'border-red-300 bg-red-50' : ''
                )}
                value={num}
                onChange={e => handleNumChange(e.target.value)}
                placeholder="12345"
                maxLength={5}
                inputMode="numeric"
              />
            </>
          )}
        </div>

        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        {!error && (
          <p className="text-[10px] text-gray-400 mt-1">
            {plateType === 'trailer' ? (
              <>Example: <span className="font-mono">TRAILER 12345</span></>
            ) : (
              <>
                Example: <span className="font-mono">{config.example}</span>
                {config.codeLetters && config.codeLetters.length < 20 && (
                  <> · Valid letters: <span className="font-mono">{config.codeLetters.join(', ')}</span></>
                )}
                {config.codeDoubles && (
                  <> · Also valid double: <span className="font-mono">{config.codeDoubles.join(', ')}</span></>
                )}
              </>
            )}
          </p>
        )}
      </div>

      {/* Live plate preview */}
      <div>
        <label className="label">Preview</label>
        <PlatePreview emirate={config} plateNumber={value} trailer={plateType === 'trailer'} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only plate display (for detail pages)
// ─────────────────────────────────────────────────────────────────────────────

export function PlateDisplay({
  plateNumber,
  plateEmirate,
}: {
  plateNumber?: string | null;
  plateEmirate?: string | null;
}) {
  if (!plateNumber) return <span className="text-gray-300">—</span>;
  const config = EMIRATES.find(e => e.code === plateEmirate) || null;
  if (!config) return <span className="font-mono font-medium text-gray-800">{plateNumber}</span>;
  const trailer = isTrailerPlate(plateNumber);
  return (
    <div className="inline-block">
      <PlatePreview emirate={config} plateNumber={plateNumber} trailer={trailer} />
    </div>
  );
}
