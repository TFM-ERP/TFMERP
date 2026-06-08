'use client';

import { FILM_DEPARTMENTS, rolesFor } from '@/lib/filmCrew';

/**
 * Cascading Department → Role picker. Department is a select; Role lists only that
 * department's jobs, with an always-available "Other (type…)" free-text escape hatch.
 * Stores plain strings via onChange.
 */
export default function DepartmentRolePicker({
  department, role, onChange, compact, labels = true, allowOther = true,
}: {
  department?: string;
  role?: string;
  onChange: (patch: { department?: string; role?: string }) => void;
  compact?: boolean;
  labels?: boolean;
  /** false = taxonomy only, no free-text escape hatch (unified naming for search/sort) */
  allowOther?: boolean;
}) {
  const roles = rolesFor(department);
  const knownRole = !!role && roles.includes(role);
  const isOther = allowOther && !!role && !knownRole; // custom role typed
  const inputCls = compact ? 'input text-sm h-8 w-full' : 'input w-full';

  return (
    <>
      <div>
        {labels && <label className="label">Department</label>}
        <select className={inputCls} value={department || ''} onChange={(e) => onChange({ department: e.target.value, role: '' })}>
          <option value="">— Department —</option>
          {FILM_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div>
        {labels && <label className="label">Role / position</label>}
        <select
          className={inputCls}
          value={isOther ? '__other__' : (role || '')}
          disabled={!department}
          onChange={(e) => onChange({ role: e.target.value === '__other__' ? ' ' : e.target.value })}
        >
          <option value="">{department ? '— Role —' : 'Pick a department first'}</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          {/* keep a stale custom value selectable so existing records don't blank out */}
          {!allowOther && role && !knownRole && role.trim() && <option value={role}>{role} (legacy)</option>}
          {allowOther && department && <option value="__other__">Other (type…)</option>}
        </select>
        {isOther && (
          <input
            className={`${inputCls} mt-1`}
            value={role?.trim() === '' ? '' : role}
            autoFocus
            placeholder="Custom role / position"
            onChange={(e) => onChange({ role: e.target.value })}
          />
        )}
      </div>
    </>
  );
}
