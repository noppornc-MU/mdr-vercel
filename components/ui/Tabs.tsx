'use client';

import { useId, useState, type ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem {
  id: string;
  label: ReactNode;
  content?: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Controlled value (optional). */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  className?: string;
}

/** Accessible tabs (role=tablist). Renders `content` of the active tab when provided. */
export function Tabs({ tabs, value, defaultValue, onChange, className }: TabsProps) {
  const baseId = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs[0]?.id);
  const active = value ?? inner;
  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onChange?.(id);
  };
  const activeTab = tabs.find((t) => t.id === active);
  return (
    <div className={className}>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              id={`${baseId}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              onClick={() => select(t.id)}
              className={cn(
                '-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600',
                selected ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-600 hover:text-slate-900',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {activeTab?.content !== undefined && (
        <div role="tabpanel" id={`${baseId}-panel-${activeTab.id}`} aria-labelledby={`${baseId}-tab-${activeTab.id}`} className="pt-4">
          {activeTab.content}
        </div>
      )}
    </div>
  );
}

export default Tabs;
