'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Standard, permissive email shape: something@something.tld
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (v: string) => EMAIL_RE.test((v || '').trim());

/**
 * Drop-in replacement for a plain email <input>. Keeps the same value/onChange/
 * className/placeholder API, but renders type="email" and flags an invalid format
 * on blur (red ring + hint). Frontend validation only — does not mutate the value.
 * Usage: swap `<input ... />` for `<EmailInput ... />` with no other change.
 */
export default function EmailInput({ className = '', onBlur, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const [bad, setBad] = useState(false);
  return (
    <>
      <input
        {...rest}
        type="email"
        inputMode="email"
        autoCapitalize="off"
        spellCheck={false}
        onBlur={(e) => {
          const v = e.target.value.trim();
          setBad(!!v && !isValidEmail(v));
          onBlur?.(e);
        }}
        className={cn(className, bad && '!border-red-400 focus:!border-red-500')}
        aria-invalid={bad || undefined}
      />
      {bad && <p className="text-[10px] text-red-500 mt-0.5">Enter a valid email address (name@domain.com).</p>}
    </>
  );
}
