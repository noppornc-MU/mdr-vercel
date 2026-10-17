import type { SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  /** Adds a leading empty option with this label (e.g. "ทั้งหมด"). */
  placeholder?: string;
  invalid?: boolean;
}

export function Select({ label, options, placeholder, invalid, className, id, children, ...props }: SelectProps) {
  const select = (
    <select
      id={id}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-md border bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600',
        invalid ? 'border-amber-500 bg-amber-50' : 'border-slate-300',
        className,
      )}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700" htmlFor={id}>
      <span className="font-medium">{label}</span>
      {select}
    </label>
  );
}

export default Select;
