import type { AllowedValue, AllowedValueUnit } from './types';

// Default tolerances (absolute) per unit
const DEFAULT_TOLERANCE: Record<AllowedValueUnit, number> = {
  RM: 1,        // ± RM 1
  pct: 0.1,     // ± 0.1 percentage points
  days: 0.1,    // ± 0.1 days
  count: 0.5,   // counts must round to integer
};

// Numbers that are dates / years and should never be flagged.
// Pre-filter applies before scanning candidates.
const DATE_LIKE = [
  /\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g,         // 2025-04-12
  /\b(?:19|20)\d{2}-\d{2}\b/g,                // 2025-04
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2}\b/gi,
];
const YEAR_TOKEN = /^(?:19|20)\d{2}$/;
const SAFE_INTEGERS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 30, 60, 80, 90, 100, 120, 365]);

export type FoundNumber = {
  raw: string;        // exact text matched in the prompt
  value: number;      // normalized numeric value (RM, pct, days, count)
  unit: AllowedValueUnit;
  index: number;      // start index in the source text
};

export type GuardResult = {
  ok: boolean;
  unmatched: FoundNumber[];
  found: FoundNumber[];
};

// ─── Number extraction ───────────────────────────────────────────────────────

// Order matters — RM amounts must be tried before bare numbers.
// Multi-value patterns return an array of values; single-value patterns return a number.
type ParseResult = number | number[];
const NUMBER_PATTERNS: { unit: AllowedValueUnit; regex: RegExp; parse: (m: RegExpExecArray) => ParseResult }[] = [
  // RM range with shared M/K suffix: "RM 7–8M per month" → {7M, 8M}
  {
    unit: 'RM',
    regex: /RM\s*(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*([MK])/gi,
    parse: (m) => {
      const mult = m[3].toUpperCase() === 'M' ? 1_000_000 : 1_000;
      return [parseFloat(m[1]) * mult, parseFloat(m[2]) * mult];
    },
  },
  // RM 2.3M / RM 2.3K
  {
    unit: 'RM',
    regex: /-?\s*RM\s*(-?\d+(?:\.\d+)?)\s*([MK])/gi,
    parse: (m) => {
      let n = parseFloat(m[1]);
      if (m[0].trimStart().startsWith('-') && n >= 0) n = -n;
      const mult = m[2].toUpperCase() === 'M' ? 1_000_000 : 1_000;
      return n * mult;
    },
  },
  // -RM 1,234,567.89 — but skip when followed by a dash+digit (it's a range, handled above)
  {
    unit: 'RM',
    regex: /-?\s*RM\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?)(?!\s*[-–—]\s*\d)/g,
    parse: (m) => {
      let n = parseFloat(m[1].replace(/,/g, ''));
      if (m[0].trimStart().startsWith('-') && n >= 0) n = -n;
      return n;
    },
  },
  // 84.7%
  {
    unit: 'pct',
    regex: /(-?\d+(?:\.\d+)?)\s*(?:%|percent|pp|percentage points?)/gi,
    parse: (m) => parseFloat(m[1]),
  },
  // 52 days
  {
    unit: 'days',
    regex: /(-?\d+(?:\.\d+)?)\s*days?\b/gi,
    parse: (m) => parseFloat(m[1]),
  },
  // bare integer counts: "29 customers", "12 of 12 months", "top 5"
  {
    unit: 'count',
    regex: /\b(\d{1,4})\s+(?:customers?|months?|invoices?|breachers?|outlets?|agents?|products?|of)\b/gi,
    parse: (m) => parseFloat(m[1]),
  },
];

function stripDates(text: string): string {
  let out = text;
  for (const re of DATE_LIKE) out = out.replace(re, ' ');
  return out;
}

export function extractNumbers(text: string): FoundNumber[] {
  const cleaned = stripDates(text);
  const found: FoundNumber[] = [];
  const claimed: Array<[number, number]> = [];

  const overlaps = (a: number, b: number) =>
    claimed.some(([s, e]) => !(b <= s || a >= e));

  for (const pat of NUMBER_PATTERNS) {
    pat.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.regex.exec(cleaned)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      const result = pat.parse(m);
      const values = Array.isArray(result) ? result : [result];
      const valid = values.filter(v => !Number.isNaN(v));
      if (valid.length === 0) continue;
      if (pat.unit === 'count' && YEAR_TOKEN.test(m[1])) continue;
      claimed.push([start, end]);
      for (const value of valid) {
        found.push({ raw: m[0].trim(), value, unit: pat.unit, index: start });
      }
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found;
}

// ─── Matching ────────────────────────────────────────────────────────────────

function tolerance(av: AllowedValue): number {
  if (av.tolerance != null) return av.tolerance;
  return DEFAULT_TOLERANCE[av.unit ?? 'RM'];
}

function matchesAllowed(found: FoundNumber, allowed: AllowedValue[]): boolean {
  for (const av of allowed) {
    if (av.unit && av.unit !== found.unit) continue;
    const tol = tolerance(av);
    // Direct match
    if (Math.abs(found.value - av.value) <= tol) return true;
    // RM: also match by absolute value (credit notes / refunds are stored
    // unsigned in the whitelist but displayed as "-RM ...").
    if (found.unit === 'RM') {
      if (Math.abs(Math.abs(found.value) - Math.abs(av.value)) <= tol) return true;
      // Display-rounding: M/K suffixes — relative tolerance ±0.05 (5%)
      const rel = av.value !== 0 ? Math.abs(Math.abs(found.value) - Math.abs(av.value)) / Math.abs(av.value) : Infinity;
      if (rel <= 0.05) return true;
    }
  }
  return false;
}

function isDerivedPercentage(found: FoundNumber, allowed: AllowedValue[]): boolean {
  if (found.unit !== 'pct') return false;
  for (const a of allowed) {
    for (const b of allowed) {
      if (a === b) continue;
      if (b.value === 0) continue;
      const ratio = (a.value / b.value) * 100;
      if (Math.abs(ratio - found.value) <= 0.2) return true;
    }
  }
  return false;
}

export function runNumericGuard(text: string, allowed: AllowedValue[]): GuardResult {
  const found = extractNumbers(text);
  const unmatched: FoundNumber[] = [];

  for (const f of found) {
    // Safe small integers (counts) — 0..12, plus 30/60/80/90/100/120/365
    if (f.unit === 'count' && SAFE_INTEGERS.has(f.value)) continue;
    if (matchesAllowed(f, allowed)) continue;
    if (isDerivedPercentage(f, allowed)) continue;
    unmatched.push(f);
  }

  return { ok: unmatched.length === 0, unmatched, found };
}

export function formatGuardError(unmatched: FoundNumber[]): string {
  const lines = unmatched.map(u => `  - "${u.raw}" (parsed as ${u.value} ${u.unit})`);
  return `Numeric guard rejected your response. The following values do not match any whitelisted figure from the raw data blocks. Either copy the exact value from the data, or remove the claim entirely:\n${lines.join('\n')}\n\nRegenerate the summary using ONLY values that appear verbatim in the data blocks. Do not invent, paraphrase, or back-solve numbers.`;
}
