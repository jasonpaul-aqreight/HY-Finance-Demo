# Fruit Taxonomy — Classification Reference

> Detailed specification of the two-tier product classification system used to categorize Hoi-Yong's ~6,400 product items into a fruit taxonomy (Fruit Name → Country of Origin → Variant).

---

## 1. Overview

Every product in the catalog is classified into three levels:

| Level | Example |
|-------|---------|
| **Fruit Name** | APPLE, BANANA, MANGO, DRAGON FRUIT, DURIAN |
| **Country of Origin** | USA, CHINA, AUSTRALIA, MALAYSIA |
| **Variant** | FUJI, GALA, CAVENDISH |

Products that cannot be classified are marked **"Uncategorized"**.

**Excluded items:** Products with certain code prefixes (packing materials, pallets, non-product items) are excluded from fruit-based analysis.

---

## 2. Two-Tier Classification Algorithm

Classification runs during sync Phase 1b (after product table sync, before pre-computed aggregation).

### Tier 1 — UDF_BoC Field Parsing (Primary)

Each product record has a structured field `UDF_BoC` with the format:

```
FRUIT -> COUNTRY -> VARIANT
```

**Parsing rules:**
1. Split on `->` separator
2. Trim whitespace from each part
3. Extract: part[0] = Fruit Name, part[1] = Country, part[2] = Variant
4. If the field is empty or contains no `->`, skip to Tier 2

**Normalization:** After parsing, each value is normalized against reference lookup tables:
- Fruit name is matched against canonical names and aliases (e.g., "APRICORT" → "APRICOT")
- Country is matched against canonical names and aliases (e.g., "USA" → "UNITED STATES")
- If no canonical match is found, the original value is kept as-is

### Tier 2 — Description-Based Matching (Fallback)

When `UDF_BoC` does not yield a fruit name, the product **description** is pattern-matched against reference lookup tables.

**Matching order:**
1. **Fruit matching** — Greedy longest-first substring match against canonical fruit names, then aliases. This prevents false positives (e.g., "APPLE" matching inside "PINEAPPLE" — because "PINEAPPLE" is longer and matched first).
2. **Country matching** — Substring match against canonical country names (longest-first), then word-boundary-protected alias matching (e.g., alias "SA" only matches as a whole word to avoid matching inside "SALAK").
3. **Variant extraction** — Remove the matched fruit name and country from the description, clean noise (sizes like "10 KG", packaging like "CTN", punctuation), then check the remainder against known variants for that fruit.

**Variant noise removal patterns:** Strips sizes (`PCS`, `KG`, `GM`, `LBS`, `CTN`, `BOX`, `PKT`, `PACK`, `TRAY`, `SET`, `PC`) and special characters before matching.

---

## 3. Reference Lookup Tables

Five reference tables store the canonical classification data:

| Table | Count | Purpose |
|-------|-------|---------|
| `ref_fruits` | 76 entries | Canonical fruit names |
| `ref_countries` | 56 entries | Country names with 2-letter abbreviations |
| `ref_fruit_aliases` | ~40 entries | Alias → canonical fruit name (e.g., "JAMBU BATU" → "GUAVA", "NANAS" → "PINEAPPLE") |
| `ref_country_aliases` | ~14 entries | Alias → canonical country name (e.g., "NZ" → "NEW ZEALAND", "UAE" → "UNITED ARAB EMIRATES") |
| `ref_fruit_variants` | 637 entries | Known fruit + variant combinations (e.g., APPLE has 47 variants: FUJI, GALA, GRANNY SMITH, etc.) |

**Data source:** Reconstructed from 918 unique `UDF_BoC` combinations + 2,737 description-parsed items from AutoCount.

**Schema location:** `migrations/007_ref_fruit_tables.sql`

---

## 4. Output Columns

After classification, each product record is updated with six derived columns:

| Column | Description |
|--------|-------------|
| `fruitname` | Canonical fruit name (e.g., "APPLE") |
| `fruitcountry` | Country of origin (e.g., "CHINA") |
| `fruitvariant` | Variant name (e.g., "FUJI") |
| `category` | Same as `fruitname` (used for grouping) |
| `variety` | Same as `fruitvariant` (used for grouping) |
| `displayname` | Human-readable label: "FRUIT (VARIANT)" if variant exists and is not "OTHERS", otherwise just fruit name. Null if unclassified. |

---

## 5. Usage in Aggregation

The parsed fruit columns are used during Phase 2 (pre-computed aggregation) to build sales-by-product breakdowns. The sync builders load a `itemcode → {fruitname, fruitcountry, fruitvariant}` mapping from the local product table to aggregate transactions by fruit taxonomy dimensions.

**Key implementation files:**
- Classification logic: `apps/sync-service/src/transforms.ts`
- Aggregation usage: `apps/sync-service/src/builders.ts`
- Reference data schema & seeds: `migrations/007_ref_fruit_tables.sql`
