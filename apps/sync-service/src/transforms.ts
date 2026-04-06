/**
 * Post-sync transforms: compute derived columns on lookup tables.
 *
 * Two-tier fruit parsing on the product table:
 *   Tier 1 — Parse UDF_BoC ("FRUIT -> COUNTRY -> VARIANT") when present
 *   Tier 2 — Fall back to Description-based matching against ref_* lookup tables
 *
 * Lookup tables used (must be synced/seeded before this runs):
 *   ref_fruits, ref_fruit_aliases, ref_countries, ref_country_aliases, ref_fruit_variants
 */

import { PoolClient } from 'pg';

// ── Tier 1: UDF_BoC parsing ─────────────────────────────────────────────────

function parseUdfBoC(udfBoC: string | null): {
  fruitName: string | null;
  fruitCountry: string | null;
  fruitVariant: string | null;
} {
  if (!udfBoC || !udfBoC.includes('->')) {
    return { fruitName: null, fruitCountry: null, fruitVariant: null };
  }
  const parts = udfBoC.split('->').map((s) => s.trim()).filter(Boolean);
  return {
    fruitName: parts[0] || null,
    fruitCountry: parts[1] || null,
    fruitVariant: parts[2] || null,
  };
}

// ── Tier 2: Description-based matching ──────────────────────────────────────

interface LookupSets {
  /** Canonical fruit names (uppercase), longest-first for greedy matching */
  fruits: string[];
  /** alias (uppercase) → canonical fruit name */
  fruitAliases: Map<string, string>;
  /** Canonical country names (uppercase), longest-first */
  countries: string[];
  /** alias (uppercase) → canonical country name */
  countryAliases: Map<string, string>;
  /** "FRUIT|VARIANT" → true (for validation) */
  knownVariants: Set<string>;
}

async function loadLookups(client: PoolClient): Promise<LookupSets> {
  const [fruitsRes, fruitAliasRes, countriesRes, countryAliasRes, variantsRes] =
    await Promise.all([
      client.query('SELECT name FROM ref_fruits ORDER BY LENGTH(name) DESC'),
      client.query('SELECT alias, standard_name FROM ref_fruit_aliases'),
      client.query('SELECT name FROM ref_countries ORDER BY LENGTH(name) DESC'),
      client.query('SELECT alias, standard_name FROM ref_country_aliases'),
      client.query('SELECT fruit, variant FROM ref_fruit_variants'),
    ]);

  const fruitAliases = new Map<string, string>();
  for (const r of fruitAliasRes.rows) {
    fruitAliases.set(r.alias.toUpperCase(), r.standard_name.toUpperCase());
  }

  const countryAliases = new Map<string, string>();
  for (const r of countryAliasRes.rows) {
    countryAliases.set(r.alias.toUpperCase(), r.standard_name.toUpperCase());
  }

  const knownVariants = new Set<string>();
  for (const r of variantsRes.rows) {
    knownVariants.add(`${r.fruit.toUpperCase()}|${r.variant.toUpperCase()}`);
  }

  return {
    fruits: fruitsRes.rows.map((r: { name: string }) => r.name.toUpperCase()),
    fruitAliases,
    countries: countriesRes.rows.map((r: { name: string }) => r.name.toUpperCase()),
    countryAliases,
    knownVariants,
  };
}

/**
 * Match a fruit name in the description. Tries canonical names first (longest
 * match wins), then aliases. Returns the canonical name or null.
 */
function matchFruit(
  desc: string,
  lookups: LookupSets,
): { fruitName: string; matchEnd: number } | null {
  const upper = desc.toUpperCase();

  // Try canonical fruit names (sorted longest-first)
  for (const fruit of lookups.fruits) {
    const idx = upper.indexOf(fruit);
    if (idx !== -1) {
      return { fruitName: fruit, matchEnd: idx + fruit.length };
    }
  }

  // Try aliases
  for (const [alias, canonical] of lookups.fruitAliases) {
    const idx = upper.indexOf(alias);
    if (idx !== -1) {
      return { fruitName: canonical, matchEnd: idx + alias.length };
    }
  }

  return null;
}

/**
 * Match a country name in the description. Tries canonical names first
 * (longest match wins), then aliases.
 */
function matchCountry(desc: string, lookups: LookupSets): string | null {
  const upper = desc.toUpperCase();

  for (const country of lookups.countries) {
    if (upper.includes(country)) return country;
  }

  for (const [alias, canonical] of lookups.countryAliases) {
    // Only match alias as a whole word to avoid false positives (e.g., "SA" in "SALAK")
    const regex = new RegExp(`\\b${alias}\\b`);
    if (regex.test(upper)) return canonical;
  }

  return null;
}

/**
 * Extract a variant from the description by removing the already-matched
 * fruit name and country, then checking if the remainder (or parts of it)
 * match a known variant.
 */
function matchVariant(
  desc: string,
  fruitName: string,
  country: string | null,
  lookups: LookupSets,
): string | null {
  let remainder = desc.toUpperCase();

  // Remove fruit name and country from description to isolate variant text
  remainder = remainder.replace(fruitName, '').trim();
  if (country) {
    remainder = remainder.replace(country, '').trim();
  }

  // Clean up common noise: sizes, packaging, punctuation
  remainder = remainder
    .replace(/\b\d+\s*(PCS|KG|GM|GMS|LBS|CTN|BOX|PKT|PACK|TRAY|SET|PC)\b/gi, '')
    .replace(/[()[\]{}/\\#@!$%^&*+=<>|~`"';:,.?_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!remainder) return null;

  // Check against known variants for this fruit
  const key = `${fruitName}|${remainder}`;
  if (lookups.knownVariants.has(key)) return remainder;

  // Try matching each known variant as a substring of the remainder
  for (const kv of lookups.knownVariants) {
    if (!kv.startsWith(`${fruitName}|`)) continue;
    const variant = kv.split('|')[1];
    if (remainder.includes(variant)) return variant;
  }

  return null;
}

function parseDescription(
  description: string | null,
  lookups: LookupSets,
): { fruitName: string | null; fruitCountry: string | null; fruitVariant: string | null } {
  if (!description) return { fruitName: null, fruitCountry: null, fruitVariant: null };

  const fruitMatch = matchFruit(description, lookups);
  if (!fruitMatch) return { fruitName: null, fruitCountry: null, fruitVariant: null };

  const fruitName = fruitMatch.fruitName;
  const fruitCountry = matchCountry(description, lookups);
  const fruitVariant = matchVariant(description, fruitName, fruitCountry, lookups);

  return { fruitName, fruitCountry, fruitVariant };
}

// ── Main transform ──────────────────────────────────────────────────────────

/**
 * Update product table with parsed fruit columns.
 * Tier 1: UDF_BoC  →  Tier 2: Description + lookup tables
 */
/**
 * Normalize a value from UDF_BoC against canonical names + aliases.
 * Returns the canonical name if found, otherwise the original value.
 */
function normalizeFruit(value: string | null, lookups: LookupSets): string | null {
  if (!value) return null;
  const upper = value.toUpperCase().trim();
  // Check if it's already a canonical fruit name
  if (lookups.fruits.includes(upper)) return upper;
  // Check aliases
  const canonical = lookups.fruitAliases.get(upper);
  if (canonical) return canonical;
  return upper; // keep as-is if not found (will still show in data)
}

function normalizeCountry(value: string | null, lookups: LookupSets): string | null {
  if (!value) return null;
  const upper = value.toUpperCase().trim();
  if (lookups.countries.includes(upper)) return upper;
  const canonical = lookups.countryAliases.get(upper);
  if (canonical) return canonical;
  return upper;
}

export async function transformProducts(client: PoolClient): Promise<number> {
  // Load lookup tables for tier-2 fallback and tier-1 normalization
  const lookups = await loadLookups(client);

  const { rows } = await client.query(
    `SELECT itemcode, description, udf_boc FROM product`
  );

  if (rows.length === 0) return 0;

  let updated = 0;
  for (const row of rows) {
    // Tier 1: Try UDF_BoC first, then normalize against ref tables
    let parsed = parseUdfBoC(row.udf_boc);
    if (parsed.fruitName) {
      parsed.fruitName = normalizeFruit(parsed.fruitName, lookups);
      parsed.fruitCountry = normalizeCountry(parsed.fruitCountry, lookups);
      // Normalize variant against known variants
      if (parsed.fruitName && parsed.fruitVariant) {
        parsed.fruitVariant = parsed.fruitVariant.toUpperCase().trim();
      }
    }

    // Tier 2: Fall back to Description if UDF_BoC didn't yield a fruit name
    if (!parsed.fruitName) {
      parsed = parseDescription(row.description, lookups);
    }

    const category = parsed.fruitName;
    const variety = parsed.fruitVariant;
    const displayName =
      category && variety && variety !== 'OTHERS'
        ? `${category} (${variety})`
        : category || null;

    await client.query(
      `UPDATE product SET
        fruitname = $1, fruitcountry = $2, fruitvariant = $3,
        category = $4, variety = $5, displayname = $6
       WHERE itemcode = $7`,
      [parsed.fruitName, parsed.fruitCountry, parsed.fruitVariant,
       category, variety, displayName, row.itemcode]
    );
    updated++;
  }

  return updated;
}
