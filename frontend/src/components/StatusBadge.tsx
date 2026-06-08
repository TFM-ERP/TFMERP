'use client';

import { getStatusDef, StatusModule } from '@/lib/statusConfig';

interface Props {
  module: StatusModule;
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showDot?: boolean;
  className?: string;
}

export default function StatusBadge({
  module,
  status,
  size = 'md',
  showIcon = true,
  showDot = false,
  className = '',
}: Props) {
  const def = getStatusDef(module, status);

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${def.color} ${def.textColor} ${def.borderColor} ${sizeClasses} ${className}`}
      title={def.description}
    >
      {showDot && (
        <span
          className="rounded-full flex-shrink-0"
          style={{ width: size === 'sm' ? 5 : 6, height: size === 'sm' ? 5 : 6, background: def.dot }}
        />
      )}
      {showIcon && <span>{def.icon}</span>}
      {def.label}
    </span>
  );
}
