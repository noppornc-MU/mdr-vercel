// Name matching helpers shared by domain modules (pure).

/** Lower-case, collapse dots/underscores/hyphens/whitespace into single spaces. */
export function normName(s: string | null | undefined): string {
  return String(s ?? '').toLowerCase().replace(/[.\s_\-]+/g, ' ').trim();
}

/** "klebsiella pneumoniae" → "k pneumoniae" (genus abbreviated). */
function abbreviate(n: string): string {
  const parts = n.split(' ');
  if (parts.length >= 2 && parts[0].length > 1) return [parts[0][0], ...parts.slice(1)].join(' ');
  return n;
}

/**
 * True when an organism name matches a pattern written either in full or with an
 * abbreviated genus ("K. pneumoniae"), or when the name extends the pattern
 * ("Acinetobacter baumannii complex" matches "Acinetobacter baumannii").
 */
export function organismMatches(name: string | null | undefined, pattern: string | null | undefined): boolean {
  const a = normName(name);
  const b = normName(pattern);
  if (!a || !b) return false;
  if (a === b) return true;
  const aa = abbreviate(a);
  const bb = abbreviate(b);
  if (aa === bb) return true;
  return a.startsWith(b + ' ') || aa.startsWith(bb + ' ');
}

/** Case/whitespace-insensitive key for canonical drug names. */
export function drugKey(s: string | null | undefined): string {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}
