// Remove identifiers from free text before it reaches the model (MR13.8).

export const REDACTED = '[ลบตัวระบุ]';

export interface RedactResult {
  text: string;
  redacted: boolean;
  count: number;
}

const RULES: RegExp[] = [
  // "HN 0000123", "HN: 12-34", "hn#123"
  /\bHN\s*[:#.\-]?\s*[0-9][0-9\- ]*/gi,
  // Lab / Order / AN numbers
  /\b(?:Lab\s*No|Order\s*No|AN)\s*[:#.\-]?\s*[0-9][0-9\- ]*/gi,
  // e-mail
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  // Thai person titles + name ("นาย สมชาย", "นางสาวสมหญิง", "ด.ช.xxx")
  /(?:นางสาว|นาย|นาง|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)\s*[\u0E00-\u0E7F]+(?:\s+[\u0E00-\u0E7F]+)?/g,
  // any run of >= 6 digits (allowing separators: phone, national id, long HN)
  /\d(?:[\s\-]?\d){5,}/g,
];

export function redact(input: string | null | undefined): RedactResult {
  let text = String(input ?? '');
  let count = 0;
  for (const re of RULES) {
    text = text.replace(re, (m: string) => {
      count++;
      return REDACTED + (/\s$/.test(m) ? ' ' : '');
    });
  }
  text = text.replace(/\s{2,}/g, ' ').trim();
  return { text, redacted: count > 0, count };
}
