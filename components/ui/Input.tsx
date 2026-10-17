import type { InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  invalid?: boolean;
  hint?: string;
}

export function Input({ label, invalid, hint, className, id, ...props }: InputProps) {
  const input = (
    <input
      id={id}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600',
        invalid ? 'border-amber-500 bg-amber-50' : 'border-slate-300',
        className,
      )}
      {...props}
    />
  );
  if (!label && !hint) return input;
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700" htmlFor={id}>
      {label && <span className="font-medium">{label}</span>}
      {input}
      {hint && <span className={cn('text-xs', invalid ? 'text-amber-700' : 'text-slate-500')}>{hint}</span>}
    </label>
  );
}

export default Input;
