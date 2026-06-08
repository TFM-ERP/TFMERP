'use client';

import { NATIONALITIES } from '@/lib/countries';

/**
 * Searchable nationality dropdown — lists every world nationality (excluding
 * Israel) via a native datalist, so the user can type to filter or pick.
 * Drop-in replacement for a nationality text input.
 */
export default function NationalitySelect({
  value,
  onChange,
  className = 'input w-full',
  placeholder = 'Search nationality…',
  id = 'nationality-options',
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
}) {
  return (
    <>
      <input
        list={id}
        className={className}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={id}>
        {NATIONALITIES.map((n) => <option key={n} value={n} />)}
      </datalist>
    </>
  );
}
