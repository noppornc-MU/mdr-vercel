import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'green' | 'yellow' | 'orange' | 'red' | 'grey' | 'blue' | 'purple';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-800 border-slate-200',
  green: 'bg-green-100 text-green-900 border-green-300',
  yellow: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  orange: 'bg-orange-100 text-orange-900 border-orange-300',
  red: 'bg-red-100 text-red-900 border-red-300',
  grey: 'bg-slate-200 text-slate-700 border-slate-300',
  blue: 'bg-sky-100 text-sky-900 border-sky-300',
  purple: 'bg-violet-100 text-violet-900 border-violet-300',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}
      {...props}
    />
  );
}

export default Badge;
