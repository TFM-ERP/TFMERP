'use client';

import { useState } from 'react';
import { X, ArrowRight, AlertCircle } from 'lucide-react';
import {
  StatusModule,
  getStatusDef,
  getAllowedTransitions,
  noteRequired,
} from '@/lib/statusConfig';

interface Props {
  module: StatusModule;
  currentStatus: string;
  recordRef?: string;
  onConfirm: (newStatus: string, notes: string) => Promise<void>;
  onClose: () => void;
}

export default function StatusChangeModal({
  module,
  currentStatus,
  recordRef,
  onConfirm,
  onClose,
}: Props) {
  const allowed = getAllowedTransitions(module, currentStatus);
  const [selected, setSelected] = useState('');
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const needsNote = selected ? noteRequired(module, selected) : false;
  const currentDef  = getStatusDef(module, currentStatus);
  const selectedDef = selected ? getStatusDef(module, selected) : null;

  const canConfirm = selected && (!needsNote || notes.trim().length >= 3);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setError('');
    setSaving(true);
    try {
      await onConfirm(selected, notes);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Status change failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Change Status</h2>
            {recordRef && <p className="text-xs text-gray-500 mt-0.5">{module} · {recordRef}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Current status */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1">Current Status</p>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border
                  ${currentDef.color} ${currentDef.textColor} ${currentDef.borderColor}`}
              >
                <span>{currentDef.icon}</span> {currentDef.label}
              </span>
            </div>
            {selectedDef && (
              <>
                <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1">New Status</p>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border
                      ${selectedDef.color} ${selectedDef.textColor} ${selectedDef.borderColor}`}
                  >
                    <span>{selectedDef.icon}</span> {selectedDef.label}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Status options */}
          {allowed.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-3 bg-gray-50 rounded-xl">
              No further status transitions available.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select new status</p>
              <div className="grid grid-cols-2 gap-2">
                {allowed.map(s => {
                  const def = getStatusDef(module, s);
                  const isSelected = selected === s;
                  return (
                    <button
                      key={s}
                      onClick={() => { setSelected(s); setNotes(''); setError(''); }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left text-xs font-semibold transition-all
                        ${isSelected
                          ? `${def.color} ${def.textColor} ${def.borderColor} shadow-sm`
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      <span>{def.icon}</span>
                      <span className="leading-tight">{def.label}</span>
                    </button>
                  );
                })}
              </div>
              {selectedDef?.description && (
                <p className="text-[11px] text-gray-400 mt-1">{selectedDef.description}</p>
              )}
            </div>
          )}

          {/* Notes */}
          {selected && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Notes / Comment
                {needsNote ? <span className="text-red-500 ml-1">* Required</span> : <span className="text-gray-400 ml-1">(optional)</span>}
              </label>
              <textarea
                className="input w-full h-20 resize-none text-sm"
                placeholder={needsNote ? 'Provide a reason for this status change…' : 'Add any relevant notes…'}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || saving}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Confirm Change'}
          </button>
        </div>
      </div>
    </div>
  );
}
