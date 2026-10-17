import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Tone = 'info' | 'warning' | 'danger' | 'success' | 'draft';

const TONES: Record<Tone, string> = {
  info: 'border-sky-300 bg-sky-50 text-sky-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  danger: 'border-red-300 bg-red-50 text-red-900',
  success: 'border-green-300 bg-green-50 text-green-900',
  draft: 'border-violet-300 bg-violet-50 text-violet-900',
};

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  title?: string;
}

export function Banner({ tone = 'info', title, className, children, ...props }: BannerProps) {
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('rounded-md border px-3 py-2 text-sm', TONES[tone], className)}
      {...props}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export default Banner;
