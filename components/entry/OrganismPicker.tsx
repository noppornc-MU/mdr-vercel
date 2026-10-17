'use client';
// Organism autocomplete from master (name + aliases).
import { useId, useMemo, useState } from 'react';
import type { MasterOrganism } from './shared';
import { GROUP_LABEL } from '@/components/isolates/format';

interface Props {
  inputId: string;
  organisms: MasterOrganism[];
  value: number | null;
  onChange: (id: number | null) => void;
  invalid?: boolean;
  describedBy?: string;
}

export default function OrganismPicker({ inputId, organisms, value, onChange, invalid, describedBy }: Props) {
  const selected = organisms.find((o) => o.id === value) ?? null;
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [lastValue, setLastValue] = useState(value);
  const listId = useId();

  // Sync the text when the value is changed from outside (e.g. OCR result).
  if (value !== lastValue) {
    setLastValue(value);
    if (selected) setQuery(selected.name);
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? organisms.filter((o) => o.name.toLowerCase().includes(q) || o.aliases.some((a) => a.toLowerCase().includes(q)))
      : organisms;
    return list.slice(0, 8);
  }, [query, organisms]);

  function pick(o: MasterOrganism) {
    onChange(o.id);
    setQuery(o.name);
    setOpen(false);
  }

  function onInput(v: string) {
    setQuery(v);
    setOpen(true);
    setActive(0);
    const t = v.trim().toLowerCase();
    const exact = organisms.find((o) => o.name.toLowerCase() === t || o.aliases.some((a) => a.toLowerCase() === t));
    onChange(exact ? exact.id : null);
  }

  const showList = open && matches.length > 0;

  return (
    <div className="relative">
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder="พิมพ์ชื่อเชื้อ เช่น Klebsiella"
        value={query}
        onChange={(e) => onInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && showList) {
            e.preventDefault();
            const o = matches[active];
            if (o) pick(o);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={`h-11 w-full rounded-md border px-3 text-base ${
          invalid ? 'border-amber-500 bg-amber-50' : 'border-slate-300 bg-white'
        }`}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg"
        >
          {matches.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 ${
                i === active ? 'bg-sky-50' : ''
              }`}
            >
              <span className="italic">{o.name}</span>
              <span className="text-xs text-slate-500">{GROUP_LABEL[o.group] ?? o.group}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
